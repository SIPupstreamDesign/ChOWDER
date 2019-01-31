/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";
/**
 * ポップアップ表示時の操作防止用の背景
 */
class PopupBackground extends EventEmitter {
	constructor() {
		super();
	}
	show(opacity, zindex) {
		this.background = document.createElement('div');
		this.background.className = "popup_background";
		this.background.style.display = "block";
		if (opacity !== undefined) {
			this.background.style.opacity = opacity;
		}
		if (zindex !== undefined) {
			this.background.style.zIndex = zindex;
		}
		document.body.appendChild(this.background);
		this.background.onclick = () => {
			this.background.style.display = "none";
			this.emit(PopupBackground.EVENT_CLOSE, null);
			this.close();
		};
	}
	close() {
		if (this.background) {
			document.body.removeChild(this.background);
			this.background = null;
		}
	}
}

// ポップアップ背景が閉じた
PopupBackground.EVENT_CLOSE = "close";

export default PopupBackground;

