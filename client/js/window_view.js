/*jslint devel:true*/
(function (gui) {
	"use strict";

	var vscreenInstance = null, // 外部から初期時に設定する.
		windowType = "window";

	/**
	 * メタデータが表示中かを判定する
	 * @method isVisible
	 * @param {Object} metaData メタデータ
	 * @return {bool} 表示中であればtrue
	 */
	function isVisible(metaData) {
		return (metaData.hasOwnProperty('visible') && (metaData.visible === "true" || metaData.visible === true));
	}

	/**
	 * Displayをリストビューにインポートする。
	 * @method importWindowToView
	 * @param {JSON} windowData ウィンドウデータ
	 */
	function importWindowToView(metaDataDict, windowData) {
		var displayArea,
			screen;
		if (windowData.type !== windowType) {
			return;
		}
		if (windowData.hasOwnProperty('posx')) {
			windowData.posx = parseInt(windowData.posx, 10);
		} else {
			windowData.posx = 0;
		}
		if (windowData.hasOwnProperty('posy')) {
			windowData.posy = parseInt(windowData.posy, 10);
		} else {
			windowData.posy = 0;
		}
		metaDataDict[windowData.id] = windowData;
		if (isVisible(windowData)) {
			console.log("import window:" + JSON.stringify(windowData));
			vscreenInstance.assignScreen(windowData.id, windowData.orgX, windowData.orgY, windowData.orgWidth, windowData.orgHeight);
			vscreenInstance.setScreenSize(windowData.id, windowData.width, windowData.height);
			vscreenInstance.setScreenPos(windowData.id, windowData.posx, windowData.posy);
			//console.log("import windowsc:", vscreen.getScreen(windowData.id));

			if (window.window_view.on_update_screen) {
				window.window_view.on_update_screen(windowData);
			}
			//updateScreen(windowData);
		} else {
			displayArea = document.getElementById("display_preview_area");
			screen = document.getElementById(windowData.id);
			if (displayArea && screen) {
				screen.style.display = "none";
			}
		}
	}
	window.window_view = {};
	window.window_view.init = function (vscreen) {
		vscreenInstance = vscreen;
	};
	window.window_view.import_window = function (metaDataDict, windowData) {
		importWindowToView(metaDataDict, windowData);
	};
	window.window_view.on_update_screen = null;

}(window.controller_gui));