/*jslint devel:true*/
(function (gui) {
	"use strict";
	/**
	 * Display枠を追加できるメインビュー
	 */

	var WindowView;

	WindowView = function () {
		EventEmitter.call(this);
		this.vscreenInstance = null; // 外部からinitで設定する.
	};
	WindowView.prototype = Object.create(EventEmitter.prototype);

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
	 * Displayをメインビューにインポートする。
	 * @method importWindowToView
	 * @param {JSON} windowData ウィンドウデータ
	 */
	WindowView.prototype.import_window = function (gui, metaDataDict, windowData, groupCheckDict) {
		var displayArea,
			screen;
		if (!Validator.isWindowType(windowData)) {
			return;
		}
		if (!windowData.hasOwnProperty('posx')) {
			windowData.posx = 0;
		}
		if (!windowData.hasOwnProperty('posy')) {
			windowData.posy = 0;
		}

		metaDataDict[windowData.id] = windowData;

		var visible = true;
		if (windowData.hasOwnProperty("group")) {
			if (!groupCheckDict.hasOwnProperty(windowData.group)) {
				visible = false;
			}
			if (groupCheckDict[windowData.group] === false) {
				visible = false;
			}
		}

		if (visible && isVisible(windowData)) {
			console.log("import window:" + JSON.stringify(windowData));
			this.vscreenInstance.assignScreen(windowData.id, windowData.orgX, windowData.orgY, windowData.orgWidth, windowData.orgHeight);
			this.vscreenInstance.setScreenSize(windowData.id, windowData.width, windowData.height);
			this.vscreenInstance.setScreenPos(windowData.id, windowData.posx, windowData.posy);

			this.emit(WindowView.EVENT_UPDATE_SCREEN, null, windowData);
		} else {
			displayArea = document.getElementById("display_preview_area");
			screen = document.getElementById(windowData.id);
			if (displayArea && screen) {
				screen.style.display = "none";
			}
		}
		if (windowData.hasOwnProperty("color")) {
			screen = document.getElementById(windowData.id);
			if (screen) {
				screen.style.borderColor = windowData.color;
			}
		}
	};

	WindowView.prototype.init = function (vscreen) {
		this.vscreenInstance = vscreen;
	}; 

	WindowView.EVENT_UPDATE_SCREEN = "update_screen";
	// singleton
	window.window_view = new WindowView();
}());