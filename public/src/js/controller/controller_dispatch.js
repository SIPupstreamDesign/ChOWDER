
/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Validator from '../common/validator.js';
import manipulator from './manipulator.js';
import Vscreen from '../common/vscreen.js';
import StringUtil from '../common/string_util.js';
import Connector from '../common/ws_connector.js';


function initGUIEvents(controller, gui, store, action, state, login) {

	/**
	 * マウスイベントの登録
	 */
	gui.on('mousemove', controller.onMouseMove);
	gui.on('mouseup', controller.onMouseUp);

	/** */
	///-------------------------------------------------------------------------------------------------------
	// メタデータが更新されたときにブロードキャストされてくる.
	Connector.on("UpdateMetaData", function (data) {
		let elem;

		for (let i = 0; i < data.length; ++i) {
			let metaData = data[i];
			let id = metaData.id;
			if (store.getManagement().isViewable(metaData.group)) {
				if (id) {
					controller.doneGetMetaData(null, metaData);
					if (state.getSelectedID()) {
						elem = document.getElementById(state.getSelectedID());
						if (elem) {
							if (!state.isSelectionRectShown()) {
								manipulator.moveManipulator(elem);
							}
						}
					}
				}
			}
		}
		if (state.isSelectionRectShown() && data.length > 0) {
			controller.updateSelectionRect();
		}
	});

	// コンテンツが差し替えられたときにブロードキャストされてくる.
	Connector.on('UpdateContent', function (metaData) {
		// console.log('UpdateContent', metaData);
		let id = metaData.id;
		if (id) {
			Connector.send('GetContent', metaData, function (err, reply) {
				if (reply.hasOwnProperty('metaData')) {
					if (store.hasMetadata(metaData.id)) {
						action.correctContentAspect({
							metaData : reply.metaData,
							callback : (err, meta) => {
								reply.metaData = meta;
								controller.doneGetContent(err, reply);
								controller.doneGetMetaData(err, meta);
							}
						});
					}
				}
			});
		}
	});

	// windowが更新されたときにブロードキャストされてくる.
	Connector.on("UpdateWindowMetaData", function (data) {
		// console.log("onUpdateWindowMetaData", data);
		let metaData;

		if (data instanceof Array) {
			for (let i = 0; i < data.length; ++i) {
				metaData = data[i];
				controller.doneGetWindowMetaData(null, metaData);
				gui.changeWindowBorderColor(metaData);
				if (state.getSelectedID()) {
					if (!state.isSelectionRectShown()) {
						let elem = document.getElementById(state.getSelectedID());
						manipulator.moveManipulator(elem);
					}
				}
			}
			if (state.isSelectionRectShown() && data.length > 0) {
				controller.updateSelectionRect();
			}
		} else {
			metaData = data;
			controller.doneGetWindowMetaData(null, metaData);
			gui.changeWindowBorderColor(metaData);
			if (state.getSelectedID()) {
				let elem = document.getElementById(state.getSelectedID());
				manipulator.moveManipulator(elem);
			}
		}
	});

	// virtual displayが更新されたときにブロードキャストされてくる.
	Connector.on("UpdateVirtualDisplay", function (data) {
		controller.removeVirtualDisplay();
		controller.doneGetVirtualDisplay(null, data);
	});

	// グループが更新されたときにブロードキャストされてくる.
	Connector.on('UpdateGroup', function (metaData) {
		controller.onUpdateAuthority(function () {
			action.getGroupList();
		});
	});

	// すべての更新が必要なときにブロードキャストされてくる.
	Connector.on('Update', function () {
		if (!store.isInitialized()) { return; }
		controller.setupSelectionRect();
		action.reloadAll();
	});

	// windowが更新されたときにブロードキャストされてくる.
	Connector.on('UpdateMouseCursor', function (metaData) { });

	// コンテンツが削除されたときにブロードキャストされてくる.
	Connector.on("DeleteContent", function (data) {
		// console.log("onDeleteContent", data);
		let i;
		controller.doneDeleteContent(null, data);
	});

	// ウィンドウが削除されたときにブロードキャストされてくる.
	Connector.on("DeleteWindowMetaData", function (metaDataList) {
		// console.log("DeleteWindowMetaData", metaDataList);
		for (let i = 0; i < metaDataList.length; i = i + 1) {
			controller.doneDeleteWindowMetaData(null, metaDataList[i]);
		}
	});

	// Video Controllerで使う.
	Connector.on('SendMessage', function (data) {
		if (data.command === 'playVideo') {
			data.ids.forEach(function (id) {
				let el = document.getElementById(id);
				if (el && el.play) {
					data.play ? el.play() : el.pause();

					let metaData = store.getMetaData(id);
					metaData.isPlaying = data.play;
					controller.update_metadata(metaData, function(err, reply) {
						// do nothing
					});
				}
			});
		}

		if (data.command === 'rewindVideo') {
			data.ids.forEach(function (id) {
				let el = document.getElementById(id);
				if (el && el.play) {
					el.currentTime = 0.0;
				}
			});
		}
	});

	// DB切り替え時にブロードキャストされてくる
	Connector.on("ChangeDB", function () {
		if (!store.isInitialized()) { return; }
		window.location.reload(true);
	});

	// 権限変更時に送られてくる
	Connector.on("ChangeAuthority", function (userID) {
		if (!store.isInitialized()) { return; }
		if (login.getLoginUserID() === userID) {
			window.location.reload(true);
		}
	});

	// 管理ページでの設定変更時にブロードキャストされてくる
	Connector.on("UpdateSetting", function () {
		if (!store.isInitialized()) { return; }
		// ユーザーリスト再取得
		action.reloadUserList();
		action.reloadGlobalSetting();
		action.reloadDBList({
			callback : (err, reply) => {
				if (!err) {
					// 開きなおす
					gui.showManagementGUI(false);
					gui.showManagementGUI(true);
				}
			}
		});
	});

	// WebRTC接続要求が来た
	Connector.on('RTCRequest', function (data) {
		let metaData = data.metaData;
		if (metaData.from === "controller") { return; }
		let key = null;
		try {
			keyStr = StringUtil.arrayBufferToString(data.contentData.data);
			key = JSON.parse(keyStr).key;
		}  catch (e) {
			console.error(e);
			return;
		}
		if (key) {
			// このコントローラが動画データを持っているか判別
			if (store.getVideoStore().hasVideoData(metaData.id)) {
				// webrtc接続開始
				store.getVideoStore().connectWebRTC(metaData, key);
			}
		}
	});

	// WebRTC切断要求が来た
	Connector.on('RTCClose', function (data) {
		let metaData = data.metaData;
		if (metaData.from === "controller") { return; }
		let key = null;
		try {
			keyStr = StringUtil.arrayBufferToString(data.contentData.data);
			key = JSON.parse(keyStr).key;
		}  catch (e) {
			console.error(e);
			return;
		}
		if (key) {
			// このコントローラが接続を持っているか判別
			if (controller.webRTC && controller.webRTC.hasOwnProperty(key)) {
				controller.webRTC[key].close(true);
			}
		}
	});

	// WebRTCのAnswerが返ってきた
	Connector.on("RTCAnswer", function (data) {
		let answer = null;
		let key = null;
		try {
			let sdpStr = StringUtil.arrayBufferToString(data.contentData.data);
			let parsed = JSON.parse(sdpStr);
			key = parsed.key;
			answer = parsed.sdp;
		} catch (e) {
			console.error(e);
			return;
		}
		if (controller.webRTC && controller.webRTC.hasOwnProperty(key)) {
			controller.webRTC[key].setAnswer(answer, function (e) {
				if (e) {
					console.error(e);
				}
			});
		}
	});

	Connector.on("RTCIceCandidate", function (data) {
		let metaData = data.metaData;
		if (metaData.from == "controller") { return; }
		let contentData = data.contentData;
		let parsed = null;
		let candidate = null;
		let key = null;
		try {
			let dataStr = StringUtil.arrayBufferToString(contentData.data);
			parsed = JSON.parse(dataStr);
			key = parsed.key;
			candidate = parsed.candidate;
		} catch (e) {
			console.error(e);
			return;
		}
		if (controller.webRTC && controller.webRTC.hasOwnProperty(key)) {
			if (candidate) {
				controller.webRTC[key].addIceCandidate(candidate);
			}
		}
	});
}

/**
 * GUI/Dispacher/controller初期化
 * @method init
 */
function init(controller, gui, store, action, state, login) {
	let timer = null;
	let controllerData = controller.getControllerData();

	gui.init(controllerData);

	let display_scale = controllerData.getDisplayScale();
	let snap = controllerData.getSnapType(Validator.isDisplayTabSelected());

	Vscreen.setWholeScale(display_scale, true);
	gui.setDisplayScale(display_scale);

	if (snap) {
		action.changeSnapType({
			isDisplay : Validator.isDisplayTabSelected(),
			snapType : snap
		});
	}
	document.getElementsByClassName('head_menu_hover_left')[0].addEventListener('change', (eve) => {
		let f = eve.currentTarget.value;
		action.changeSnapType({
			isDisplay : Validator.isDisplayTabSelected(),
			snapType : f
		});
	}, false);

	// リモートカーソルの有効状態を更新
	action.updateRemoteCursor({isEnable : controllerData.isUpdateCursorEnable()});

	gui.get_whole_scale = function () {
		return Vscreen.getWholeScale();
	};

	manipulator.setCloseFunc(controller.onCloseContent);

	// gui events etc
	initGUIEvents(controller,  gui,store, action, state, login);

	// resize event
	window.onresize = function () {
		if (timer) {
			clearTimeout(timer);
		}
		timer = setTimeout(function () {
			let panel = document.getElementsByClassName('preview_area_panel__')[0];
			let cx = (panel.getBoundingClientRect().right - panel.getBoundingClientRect().left) / 2;
			let cy = (panel.getBoundingClientRect().bottom - panel.getBoundingClientRect().top) / 2 + 28;
			let whole = Vscreen.getWhole();

			Vscreen.assignWhole(whole.orgW, whole.orgH, cx, cy, Vscreen.getWholeScale());
			manipulator.removeManipulator();
			controller.updateScreen();
		}, 200);
	};

	controller.updateScreen();
	Vscreen.dump();
	//store.init();
	action.init();

}

window.ControllerDispatch = {
	init : init
};
