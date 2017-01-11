(function () {
	"use strict";
	/**
	 * ポップアップ表示時の操作防止用の背景
	 */
	var PopupBackground = function () {
		EventEmitter.call(this);
	};
	PopupBackground.prototype = Object.create(EventEmitter.prototype);

	PopupBackground.prototype.show = function (opacity) {
		this.background = document.createElement('div');
		this.background.className = "popup_background";
		this.background.style.display = "block";
		if (opacity !== undefined) {
			this.background.style.opacity = opacity;
		}

		document.body.appendChild(this.background);

		this.background.onclick = function () {
			this.background.style.display = "none";
			this.emit(PopupBackground.EVENT_CLOSE, null);
			this.close();
		}.bind(this);
	};

	PopupBackground.prototype.close = function () {
		if (this.background) {
			document.body.removeChild(this.background);
			this.background = null;
		}
	};
	
	// ポップアップ背景が閉じた
	PopupBackground.EVENT_CLOSE = "close";

	window.PopupBackground = PopupBackground;
}());
