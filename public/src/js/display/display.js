/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */
import Constants from '../common/constants.js';
import Validator from '../common/validator.js';
import Vscreen from '../common/vscreen.js';
import VscreenUtil from '../common/vscreen_util.js';
import StringUtil from '../common/string_util.js';
import Action from './action.js';
import Store from './store/store.js';
import Connector from '../common/ws_connector.js';
import DisplayUtil from './display_util';
import GUI from './gui.js';

"use strict";

const action = new Action();
const store = new Store(action);
const gui = new GUI(store, action);

let doneGetContent;
let doneGetMetaData;
let controllers = {connectionCount: -1};

/**
 * コンテンツメタデータがウィンドウ内にあるか再計算する
 * @method recalculateContentVisible
 */
function updateContentVisible() {
	let metaDataDict = store.getMetaDataDict();
	for (let i in metaDataDict) {
		if (metaDataDict.hasOwnProperty(i)) {
			// console.log(metaDataDict[i]);
			if (metaDataDict[i].type !== 'window') {
				doneGetMetaData(null, metaDataDict[i]);
			}
		}
	}
}

/**
 * GetContent終了コールバック
 * @param {String} err エラー.なければnull
 * @param {Object} data コンテンツデータ
 */
doneGetContent = function (err, data) {
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
		if (!store.isViewable(metaData.group)) {
			return;
		}
		// レイアウトは無視
		if (Validator.isLayoutType(metaData)) { return; }

		if (metaData.type === 'tileimage') {
			gui.assignTileImage(metaData, contentData, true);
		} else {
			// コンテンツ登録&表示
			gui.assignContent(metaData, contentData);
		}
	}
};

/**
 * GetMetaData終了コールバック
 * @param {String} err エラー.なければnull
 * @param {JSON} json メタデータ
 */
doneGetMetaData = function (err, json) {
	let metaDataDict = store.getMetaDataDict();
	let groupDict = store.getGroupDict();
	let webRTCDict = store.getVideoStore().getWebRTCDict();
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
	if (!store.isViewable(json.group)) {
		return;
	}

	// 履歴からのコンテンツ復元.
	if (metaDataDict.hasOwnProperty(json.id) && json.hasOwnProperty('restore_index')) {
		if (metaDataDict[json.id].restore_index !== json.restore_index) {
			let request = { type: json.type, id: json.id, restore_index : json.restore_index };
			Connector.send('GetContent', request, function (err, reply) {
				doneGetContent(err, reply);
				gui.toggleMark(document.getElementById(json.id), metaData);
			});
		}
	}
	
	metaDataDict[json.id] = json;
	if (!err) {
		let elem = document.getElementById(json.id);
		let isWindow = Validator.isWindowType(json);
		let isOutside = false;

		if (isWindow) {
			// console.log(json.id, store.getWindowID());
			if (json.id !== store.getWindowID()) {
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
				let rtcKey = store.getVideoStore().getRTCKey(json);
				if (webRTCDict.hasOwnProperty(rtcKey)) {
					webRTCDict[rtcKey].close(true);
					if (elem.parentNode) {
						elem.parentNode.removeChild(elem);
					}

					metaData.from = "view";
					Connector.sendBinary('RTCClose', metaData, JSON.stringify({
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
					Connector.send('GetContent', json, function (err, reply) {
						doneGetContent(err, reply);
						gui.toggleMark(document.getElementById(json.id), metaData);
					});
				} else if (!elem) {
					// コンテンツがロードされるまで枠を表示しておく.
					gui.showBoundingBox(json);
					// 新規コンテンツロード.
					Connector.send('GetContent', json, function (err, reply) {
						doneGetContent(err, reply);
						gui.toggleMark(document.getElementById(json.id), metaData);
					});
				}
				if (json.type === "tileimage") {
					// window範囲外で非表示になっているタイルが
					// window範囲内に来ていた場合は、その部分のタイルを読み込む
					gui.assignTileImage(json, null, false);
				}
				elem = document.getElementById(json.id);
				VscreenUtil.assignMetaData(elem, json, false, groupDict);
			}
			if (isWindow) {
				gui.updateViewport(store.getWindowData());
			} else {
				gui.showMemo(elem, metaData);
				gui.toggleMark(elem, metaData);
			}
		}
	}
};

store.on(Store.EVENT_CONNECT_SUCCESS, (err, data) => {
	console.log("EVENT_CONNECT_SUCCESS")
	let disconnectedText = document.getElementById("disconnected_text");
	if (disconnectedText) {
		disconnectedText.style.display = "none";
	}
	if (!store.getWindowData()) {
		// console.log("registerWindow");
		action.login({ id : "Display", password : "" });
	}
});

store.on(Store.EVENT_CONNECT_FAILED, (err, data) => {
	console.log("EVENT_CONNECT_FAILED")
	let disconnected_text = document.getElementById("disconnected_text");
	if (disconnected_text) {
		disconnected_text.style.display = "block";
	}
});

store.on(Store.EVENT_DISCONNECTED, () => {
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

store.on(Store.EVENT_LOGIN_SUCCESS, () => {
	console.log("EVENT_LOGIN_SUCCESS")
	action.registerWindow({ size : gui.getWindowSize()});
});

store.on(Store.EVENT_DONE_UPDATE_WINDOW_METADATA, (err, data) => {
	if (!err) {
		for (let i = 0; i < data.length; i = i + 1) {
			if (data[i].hasOwnProperty('id') && data[i].id === store.getWindowID()) {
				gui.setDisplayID(data[i].id);
				gui.updatePreviewAreaVisible(store.getWindowData());
				gui.updateViewport(store.getWindowData())
			}
		}
	}
});

store.on(Store.EVENT_DONE_UPDATE_METADATA, (err, data) => {
	let previewArea = document.getElementById("preview_area");
	for (let i = 0; i < data.length; ++i) {
		if (!store.isViewable(data[i].group)) {
			let elem = document.getElementById(data[i].id);
			if (elem) {
				previewArea.removeChild(elem);
			}
			let memo =  document.getElementById("memo:" + data[i].id);
			if (memo) {
				previewArea.removeChild(memo);
			}
		}
		action.update({ updateType : '', targetID : data[i].id });
	}
});

store.on(Store.EVENT_DONE_DELETE_CONTENT, (err, data) => {
	let previewArea = document.getElementById('preview_area');
	for (let i = 0; i < data.length; ++i) {
		let elem = document.getElementById(data[i].id);
		if (elem) {
			gui.deleteMark(elem, data[i].id);
			previewArea.removeChild(elem);
		}
	}
})

store.on(Store.EVENT_DONE_REGISTER_WINDOW, (err, json) => {
	if (!err) {
		for (let i = 0; i < json.length; i = i + 1) {
			gui.setDisplayID(json[i].id);
			action.changeQueryParam({id: json[i].id});
			gui.updatePreviewAreaVisible(store.getWindowData());
			gui.updateViewport(store.getWindowData());
		}
	}
	document.getElementById('preview_area').innerHTML = "";
	action.update({ updateType : 'all'});
});

store.on(Store.EVENT_DONE_GET_WINDOW_METADATA, (err, json) => {
	if (json.hasOwnProperty('id') && json.id === store.getWindowID()) {
		gui.updatePreviewAreaVisible(json);
		gui.updateViewport(json);
		updateContentVisible();
	}
});

store.on(Store.EVENT_DONE_GET_METADATA, doneGetMetaData);

/**
 * 初期化
 * @method init
 */
function init() {
	action.connect();
	//initReciever();
	gui.init();
}

window.onload = init;
window.onunload = function () {
	store.release();
}


