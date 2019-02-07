/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Validator from '../../common/validator.js';
import Vscreen from '../../common/vscreen.js';

"use strict";

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
 * Display枠を追加できるメインビュー
 */
class DisplayViewGUI extends EventEmitter {
	constructor(store, action) {
		super();

		this.store = store;
		this.action = action;
	}

	/**
	 * Displayをメインビューにインポートする。
	 * @method importWindowToView
	 * @param {JSON} windowData ウィンドウデータ
	 */
	importDisplay(displayArea, listElem, windowData) {
		let metaDataDict = this.store.getMetaDataDict();
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
		// エレメントがなかった場合はグループに関係なく、エレメントを作る
		let screen = document.getElementById(windowData.id);
		// console.log("import window:" + JSON.stringify(windowData));
		Vscreen.assignScreen(windowData.id, windowData.orgX, windowData.orgY, windowData.orgWidth, windowData.orgHeight, windowData.visible);
		Vscreen.setScreenSize(windowData.id, windowData.width, windowData.height);
		Vscreen.setScreenPos(windowData.id, windowData.posx, windowData.posy);
		if (!Validator.isVisibleWindow(windowData)) {
			// 非表示だったら非表示に.
			if (screen) {
				screen.style.display = "none";
			}
		}
		else {
			if (screen) {
				// リストをドラッグしてviewに持ってきた場合クラス名を変更する
				if (screen.className === "screen_id") {
					screen.className = "screen";
				}
			}
			this.action.changeDisplayVisible(windowData);
		}
		// ボーダー色の設定
		if (windowData.hasOwnProperty("color")) {
			if (screen) {
				screen.style.borderColor = windowData.color;
			}
		}
	}
}

export default DisplayViewGUI;
