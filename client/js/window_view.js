/*jslint devel:true*/
(function (gui) {
	"use strict";

	var WindowView,
		windowType = "window";

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
	 * Displayをリストビューにインポートする。
	 * @method importWindowToView
	 * @param {JSON} windowData ウィンドウデータ
	 */
	WindowView.prototype.import_window = function (gui, metaDataDict, windowData) {
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