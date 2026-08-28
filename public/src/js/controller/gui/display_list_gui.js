/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Validator from '../../common/validator.js';
import ContentUtil from '../content_util';

"use strict";
/**
 * Dispalyリストビュー
 */
class DisplayListGUI extends EventEmitter {
	constructor(store, action) {
		super();

		this.store = store;
		this.action = action;
	}

	/**
	 * Displayをリストビューにインポートする。
	 * @method importWindowToList
	 * @param {JSON} windowData ウィンドウデータ
	 */
	importDisplay(displayArea, listElem, windowData) {
		// console.log("importWindowToList");
		let divElem = listElem;
		let idElem;
		let onlistID = "onlist:" + windowData.id;
		if (!Validator.isWindowType(windowData)) {
			return;
		}
		if (divElem) {
			return;
		}
		divElem = document.createElement("div");
		idElem = document.createElement('div');
		idElem.innerHTML = "ID:" + windowData.id;
		idElem.className = "screen_id";
		divElem.appendChild(idElem);
		divElem.id = onlistID;
		divElem.className = "screen";
		divElem.style.position = "relative";
		divElem.style.top = "5px";
		divElem.style.left = "20px";
		divElem.style.width = "200px";
		divElem.style.height = "50px";
		divElem.style.border = "solid";
		divElem.style.margin = "5px";
		divElem.style.float = "left";
		this.action.setupContentElement({
			element : divElem,
			id : onlistID
		});
		displayArea.appendChild(divElem);
	}
}

export default DisplayListGUI;