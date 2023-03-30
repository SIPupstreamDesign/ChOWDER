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

// コンテンツ取得時にやることが多いので
// このクラスに分離している
class ContentHandler {
	constructor(store, action, gui) {
		this.store = store;
		this.action = action;
		this.gui = gui;

		this.doneGetContent = this.doneGetContent.bind(this);
		this.doneGetMetaData = this.doneGetMetaData.bind(this);
		this.store.on(Store.EVENT_DONE_GET_METADATA, this.doneGetMetaData);
		this.store.on(Store.EVENT_DONE_GET_CONTENT, this.doneGetContent);
	}

	/**
	 * GetContent終了コールバック
	 * @param {String} err エラー.なければnull
	 * @param {Object} data コンテンツデータ
	 */
	doneGetContent(err, data, callback) {
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
				this.gui.deleteContent(metaData.id);
				this.gui.getVRGUI().deleteVRPlane({ id : metaData.id });
				return;
			}
			// レイアウトは無視
			if (Validator.isLayoutType(metaData)) { return; }

			if (metaData.type === 'tileimage') {
				// 時系列画像が更新された（時系列データ切り替わり）など
				this.gui.assignTileReductionImage(metaData, contentData);
				this.gui.assignTileImage(metaData, true, callback);
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
	doneGetMetaData(err, json, forceUpdate, callback) {
		let metaDataDict = this.store.getMetaDataDict();
		let groupDict = this.store.getGroupDict();
		let metaData = json;
		let isUpdateContent = false || forceUpdate;
		// console.log("doneGetMetaData", json);
		if (!json) { return; }
		// レイアウトは無視
		if (Validator.isLayoutType(metaData)) { return; }
		// 復元したコンテンツか
		if (!json.hasOwnProperty('id')) { return; }
		if (metaDataDict.hasOwnProperty(json.id)) {
			isUpdateContent = isUpdateContent ||  (metaDataDict[json.id].restore_index !== json.restore_index);
			isUpdateContent = isUpdateContent || (metaDataDict[json.id].keyvalue !== json.keyvalue);
			if (json.hasOwnProperty('restore_key')) {
				isUpdateContent = isUpdateContent || (metaDataDict[json.id].restore_key !== json.restore_key);
			}
			if (json.hasOwnProperty('restore_value')) {
				isUpdateContent = isUpdateContent || (metaDataDict[json.id].restore_value !== json.restore_value);
			}
		}
		// 閲覧可能か
		if (!this.store.isViewable(json.group)) {
			this.gui.deleteContent(json.id);
			this.gui.getVRGUI().deleteVRPlane({ id : json.id });
			return;
		}

		// 履歴からのコンテンツ復元.
		if (metaDataDict.hasOwnProperty(json.id) && json.hasOwnProperty('restore_index')) {
			if (metaDataDict[json.id].restore_index !== json.restore_index) {
				let request = { type: json.type, id: json.id, restore_index : json.restore_index };
				Connector.send(Command.GetContent, request, (err, reply) => {
					this.doneGetContent(err, reply, callback);
					this.gui.updateSubStatusVisible(document.getElementById(json.id), metaData);
				});
			}
		}

		// 動画ファイルのwebrtc<-->datachannel切り替え
		if (json.type === Constants.TypeVideo && json.hasOwnProperty("subtype") && json.subtype === "file") {
			let oldMetaData = metaDataDict[json.id];
			if (oldMetaData) {
				let videoStore = this.store.getVideoStore();
				let isAlreadyUsed = videoStore.isDataChannelUsed(oldMetaData);
				let isDataChannelUsed = videoStore.isDataChannelUsed(json);
				let videoPlayer = videoStore.getVideoPlayer(json.id);
				if (videoPlayer) {
					if (!isAlreadyUsed && isDataChannelUsed) {
						// DataChannel使用開始
						videoStore.closeVideo(json);
						this.gui.showVideo(videoPlayer, json);
						metaDataDict[json.id] = json;
						videoPlayer.enableSeek(false);
						return;
					}
					if (isAlreadyUsed && !isDataChannelUsed) {
						// DataChannel使用終了、webrtcに切り替え
						videoStore.closeVideo(json);
						this.gui.showVideo(videoPlayer, json);
						metaDataDict[json.id] = json;
						videoPlayer.enableSeek(true);
						return;
					}
					if (json.hasOwnProperty('isPlaying')) {
						// 動画再生状態の変化
						if (String(json.isPlaying) === "true" && videoPlayer.getVideo().paused) {
							// 再生に変化
							if (json.hasOwnProperty('currentTime')) {
								const currentTime = Number(json.currentTime);
								videoPlayer.getVideo().currentTime = currentTime;
							}
							videoPlayer.getVideo().play();
							return;
						} else if (String(json.isPlaying) === "false" && !videoPlayer.getVideo().paused) {
							// 一時停止に変化
							if (json.hasOwnProperty('currentTime')) {
								const currentTime = Number(json.currentTime);
								if (videoPlayer.getVideo().currentTime < currentTime) {
									// コントローラ側より遅れている場合, コントローラの時間まで待ってからpause
									let subTime = currentTime - videoPlayer.getVideo().currentTime;
									setTimeout(() => {
										videoPlayer.getVideo().pause();
									}, subTime * 1000);
									return;
								} else {
									// コントローラ側より進んでいる場合, コントローラの時間に合わせてpause
									videoPlayer.getVideo().currentTime = currentTime;
									videoPlayer.getVideo().pause();
								}
							}
							return;
						}
					}
				}
			}
		}
		// webglカメラなどの適用
		if (metaData.type === Constants.TypeWebGL) {
			if(json.webglType && json.webglType === "qgis2three.js"){
				/* qgis */
				this.action.updateQgisMetadata(metaData);
			}else{
				/* itowns */
				let funcDict = this.store.getITownFuncDict();
				if (funcDict && funcDict.hasOwnProperty(metaData.id)) {
					funcDict[metaData.id].chowder_itowns_update_camera(metaData);
					funcDict[metaData.id].chowder_itowns_update_layer_list(metaData);
				}
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
				// webrtcコンテンツが画面外にいったら切断して削除しておく.
				this.gui.deleteContent(json.id);
				this.gui.getVRGUI().deleteVRPlane({ id : json.id });
				this.store.getVideoStore().closeVideo(json);
			} else {
				if (elem && elem.tagName.toLowerCase() === DisplayUtil.getTagName(json.type)) {
					// 表示非表示の切り替え
					this.gui.updateContentVisible(elem, metaData);
					this.gui.getVRGUI().updateContentVisible(metaData);
					// pdfページの切り替え
					if (json.type === Constants.TypePDF) {
						this.gui.updatePDFPage(elem, metaData);
					}
				}
				if (isUpdateContent || (!isWindow && Validator.isVisible(json))) {
					if (isUpdateContent && json.type !== "tileimage") {
						// updatecontentの場合はelemがあっても更新
						Connector.send(Command.GetContent, json, (err, reply) => {
							let elem = document.getElementById(json.id);
							if (elem) {
								this.gui.regenerateTileElements(elem, metaData);
								elem = document.getElementById(metaData.id);
								VscreenUtil.resizeTileImages(elem, metaData);
							}
							if (json.type !== "tileimage" || reply.contentData instanceof Array) {
								this.doneGetContent(err, reply,  () => {
									if (callback) {
										callback();
									}
								});
							}
							this.gui.updateSubStatusVisible(document.getElementById(json.id), metaData);
						});
					} else if (json.type === "tileimage") {
						// window範囲外で非表示になっているタイルが
						// window範囲内に来ていた場合は、その部分のタイルを読み込む
						let elem = document.getElementById(json.id);
						if (!isUpdateContent && elem) {
								this.gui.assignTileImage(json, false, ((json) => {
								})(json));
						} else {
							// 新規コンテンツロード.
							// 全タイル読み込み済じゃなかったら返る
							if (String(metaData.tile_finished) === "true") {
								Connector.send(Command.GetContent, metaData, (err, reply) => {
									if (reply.contentData instanceof Array) {
										this.doneGetContent(err, reply, () => {
											if (callback) {
												callback();
											}
										});
										let el = document.getElementById(metaData.id);
										this.gui.updateSubStatusVisible(el, metaData);
										VscreenUtil.assignMetaData(el, metaData, false, groupDict);
									}
								});
							}
							return;
						}
					} else if (!elem) {
						// コンテンツがロードされるまで枠を表示しておく.
						this.gui.showBoundingBox(json);
						// 新規コンテンツロード.
						Connector.send(Command.GetContent, json, (err, reply) => {
							this.doneGetContent(err, reply, callback);
							this.gui.updateSubStatusVisible(document.getElementById(json.id), metaData);
						});
					}

					elem = document.getElementById(json.id);
					VscreenUtil.assignMetaData(elem, json, false, groupDict);
					this.gui.getVRGUI().assignVRMetaData({ metaData : metaData, useOrg : false});
					// webgl iframeの更新
					this.gui.updateWebGLFrameRect(metaData);
				}
				if (isWindow) {
					this.gui.updateViewport(this.store.getWindowData());
				} else {
					this.gui.showMemo(elem, metaData);
					this.gui.showTime(elem, metaData);
					this.gui.showCopyrights(elem, metaData);
					this.gui.updateSubStatusVisible(elem, metaData);
				}
			}
		}
	}

}

export default ContentHandler;