/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */
import Command from '../common/command'
import Constants from '../common/constants.js';
import Validator from '../common/validator.js';
import Vscreen from '../common/vscreen.js';
import VscreenUtil from '../common/vscreen_util.js';
import Store from './store/store.js';
import Connector from '../common/ws_connector.js';
import DisplayUtil from './display_util';

"use strict";

class Display {
	constructor(store, action, gui) {
		this.store = store;
		this.action = action;
		this.gui = gui;

		this.doneGetContent = this.doneGetContent.bind(this);
		this.doneGetMetaData = this.doneGetMetaData.bind(this);
		this.initEvent();
	}

	/**
	 * コンテンツメタデータがウィンドウ内にあるか再計算する
	 * @method recalculateContentVisible
	 */
	updateContentVisible() {
		let metaDataDict = this.store.getMetaDataDict();
		for (let i in metaDataDict) {
			if (metaDataDict.hasOwnProperty(i)) {
				// console.log(metaDataDict[i]);
				if (metaDataDict[i].type !== 'window') {
					this.doneGetMetaData(null, metaDataDict[i]);
				}
			}
		}
	}

	/**
	 * GetContent終了コールバック
	 * @param {String} err エラー.なければnull
	 * @param {Object} data コンテンツデータ
	 */
	doneGetContent(err, data) {
		// console.log("doneGetContent", err, data);
		if (!err) {
			let metaData = data.metaData;
			let contentData = data.contentData;

			// サムネイルなどの複数バイナリが入っている場合
			// contentData[0]はmetaDataのリスト.
			// contentData[1]はbinaryDataのリスト.
			// contentData[n][0]がコンテンツ本体
			if (data.contentData instanceof Array) {
				contentData = data.contentData[1][0];
			}

			// 閲覧可能か
			if (!this.store.isViewable(metaData.group)) {
				return;
			}
			// レイアウトは無視
			if (Validator.isLayoutType(metaData)) { return; }

			if (metaData.type === 'tileimage') {
				this.gui.assignTileImage(metaData, contentData, true);
			} else {
				// コンテンツ登録&表示
				this.gui.assignContent(metaData, contentData);
			}
		}
	};

	/**
	 * GetMetaData終了コールバック
	 * @param {String} err エラー.なければnull
	 * @param {JSON} json メタデータ
	 */
	doneGetMetaData(err, json) {
		let metaDataDict = this.store.getMetaDataDict();
		let groupDict = this.store.getGroupDict();
		let webRTCDict = this.store.getVideoStore().getWebRTCDict();
		let metaData = json;
		let isUpdateContent = false;
		// console.log("doneGetMetaData", json);
		if (!json) { return; }
		// レイアウトは無視
		if (Validator.isLayoutType(metaData)) { return; }
		// 復元したコンテンツか
		if (!json.hasOwnProperty('id')) { return; }
		if (metaDataDict.hasOwnProperty(json.id)) {
			isUpdateContent = (metaDataDict[json.id].restore_index !== json.restore_index);
			isUpdateContent = isUpdateContent || (metaDataDict[json.id].keyvalue !== json.keyvalue);
		}
		// 閲覧可能か
		if (!this.store.isViewable(json.group)) {
			return;
		}

		// 履歴からのコンテンツ復元.
		if (metaDataDict.hasOwnProperty(json.id) && json.hasOwnProperty('restore_index')) {
			if (metaDataDict[json.id].restore_index !== json.restore_index) {
				let request = { type: json.type, id: json.id, restore_index : json.restore_index };
				Connector.send(Command.GetContent, request, (err, reply) => {
					this.doneGetContent(err, reply);
					this.gui.toggleMark(document.getElementById(json.id), metaData);
				});
			}
		}

		metaDataDict[json.id] = json;
		if (!err) {
			let elem = document.getElementById(json.id);
			let isWindow = Validator.isWindowType(json);
			let isOutside = false;

			if (isWindow) {
				// console.log(json.id, this.store.getWindowID());
				if (json.id !== this.store.getWindowID()) {
					return;
				}
			} else {
				let whole = Vscreen.transformOrgInv(Vscreen.getWhole());
				whole.x = Vscreen.getWhole().x;
				whole.y = Vscreen.getWhole().y;
				isOutside = VscreenUtil.isOutsideWindow(json, whole);
				//// console.log(isOutside, json, Vscreen.getWhole());
			}
			// console.log("isOutside:", isOutside);

			if (isOutside) {
				if (elem) {
					// コンテンツが画面外にいった
					elem.style.display = "none";
					// webrtcコンテンツが画面外にいったら切断して削除しておく.
					let rtcKey = this.store.getVideoStore().getRTCKey(json);
					if (webRTCDict.hasOwnProperty(rtcKey)) {
						webRTCDict[rtcKey].close(true);
						if (elem.parentNode) {
							elem.parentNode.removeChild(elem);
						}

						metaData.from = "view";
						Connector.sendBinary(Command.RTCClose, metaData, JSON.stringify({
							key : rtcKey
						}), function (err, reply) {});
						delete metaData.from;
					}
				}
			} else {
				if (elem && elem.tagName.toLowerCase() === DisplayUtil.getTagName(json.type)) {
					if (Validator.isVisible(json)) {
						VscreenUtil.assignMetaData(elem, json, false, groupDict);
						elem.style.display = "block";

						// pdfページの切り替え
						if (json.type === 'pdf' && elem.loadPage) {
							elem.loadPage(parseInt(json.pdfPage), parseInt(json.width));
						}
					} else {
						elem.style.display = "none";
					}
				}
				if (isUpdateContent || (!isWindow && Validator.isVisible(json))) {
					if (isUpdateContent) {
						// updatecontentの場合はelemがあっても更新
						Connector.send(Command.GetContent, json, (err, reply) => {
							this.doneGetContent(err, reply);
							this.gui.toggleMark(document.getElementById(json.id), metaData);
						});
					} else if (!elem) {
						// コンテンツがロードされるまで枠を表示しておく.
						this.gui.showBoundingBox(json);
						// 新規コンテンツロード.
						Connector.send(Command.GetContent, json, (err, reply) => {
							this.doneGetContent(err, reply);
							this.gui.toggleMark(document.getElementById(json.id), metaData);
						});
					}
					if (json.type === "tileimage") {
						// window範囲外で非表示になっているタイルが
						// window範囲内に来ていた場合は、その部分のタイルを読み込む
						this.gui.assignTileImage(json, null, false);
					}
					elem = document.getElementById(json.id);
					VscreenUtil.assignMetaData(elem, json, false, groupDict);
				}
				if (isWindow) {
					this.gui.updateViewport(this.store.getWindowData());
				} else {
					this.gui.showMemo(elem, metaData);
					this.gui.toggleMark(elem, metaData);
				}
			}
		}
	}

	/**
	 * イベントハンドラを定義
	 */
	initEvent() {

		this.store.on(Store.EVENT_CONNECT_SUCCESS, (err, data) => {
			console.log("EVENT_CONNECT_SUCCESS")
			let disconnectedText = document.getElementById("disconnected_text");
			if (disconnectedText) {
				disconnectedText.style.display = "none";
			}
			if (!this.store.getWindowData()) {
				const login_option = { id : "Display", password : "", displayid : this.store.getWindowID() }
				console.log("registerWindow",login_option);
				this.action.login(login_option);
			}
		});

		this.store.on(Store.EVENT_CONNECT_FAILED, (err, data) => {
			console.log("EVENT_CONNECT_FAILED")
			let disconnected_text = document.getElementById("disconnected_text");
			if (disconnected_text) {
				disconnected_text.style.display = "block";
			}
		});

		this.store.on(Store.EVENT_DISCONNECTED, () => {
			console.log("EVENT_DISCONNECTED")
			let previewArea = document.getElementById("preview_area");
			let disconnectedText = document.getElementById("disconnected_text");
			if (previewArea) {
				previewArea.style.display = "none";
			}
			if (disconnectedText) {
				disconnectedText.innerHTML = "Display Deleted";
			}
		});

		this.store.on(Store.EVENT_LOGIN_SUCCESS, () => {
			console.log("EVENT_LOGIN_SUCCESS")
			this.action.registerWindow({ size : this.gui.getWindowSize()});
		});

		this.store.on(Store.EVENT_DONE_UPDATE_WINDOW_METADATA, (err, data) => {
			if (!err) {
				for (let i = 0; i < data.length; i = i + 1) {
					if (data[i].hasOwnProperty('id') && data[i].id === this.store.getWindowID()) {
						this.gui.setDisplayID(data[i].id);
						this.gui.updatePreviewAreaVisible(this.store.getWindowData());
						this.gui.updateViewport(this.store.getWindowData())
					}
				}
			}
		});

		this.store.on(Store.EVENT_DONE_UPDATE_METADATA, (err, data) => {
			let previewArea = document.getElementById("preview_area");
			for (let i = 0; i < data.length; ++i) {
				if (!this.store.isViewable(data[i].group)) {
					let elem = document.getElementById(data[i].id);
					if (elem) {
						previewArea.removeChild(elem);
					}
					let memo =  document.getElementById("memo:" + data[i].id);
					if (memo) {
						previewArea.removeChild(memo);
					}
				}
				this.action.update({ updateType : '', targetID : data[i].id });
			}
		});

		this.store.on(Store.EVENT_DONE_DELETE_CONTENT, (err, data) => {
			let previewArea = document.getElementById('preview_area');
			for (let i = 0; i < data.length; ++i) {
				let elem = document.getElementById(data[i].id);
				if (elem) {
					this.gui.deleteMark(elem, data[i].id);
					previewArea.removeChild(elem);
				}
			}
		})

		this.store.on(Store.EVENT_DONE_REGISTER_WINDOW, (err, json) => {
			if (!err) {
				for (let i = 0; i < json.length; i = i + 1) {
					this.gui.setDisplayID(json[i].id);
					this.action.changeQueryParam({id: json[i].id});
					this.gui.updatePreviewAreaVisible(this.store.getWindowData());
					this.gui.updateViewport(this.store.getWindowData());
				}
			}
			document.getElementById('preview_area').innerHTML = "";
			this.action.update({ updateType : 'all'});
		});

		this.store.on(Store.EVENT_DONE_GET_WINDOW_METADATA, (err, json) => {
			if (json.hasOwnProperty('id') && json.id === this.store.getWindowID()) {
				this.gui.updatePreviewAreaVisible(json);
				this.gui.updateViewport(json);
				this.updateContentVisible();
			}
		});

		this.store.on(Store.EVENT_DONE_GET_METADATA, this.doneGetMetaData);
		this.store.on(Store.EVENT_DONE_GET_CONTENT, this.doneGetContent);

	}
}

export default Display;
