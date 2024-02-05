/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../../common/constants.js';
import Validator from '../../common/validator.js';
import ContentUtil from '../content_util';

"use strict";

/**
 * レイアウトリストビュー
 */
class LayoutListGUI extends EventEmitter {
	constructor(store, action) {
		super();

		this.store = store;
		this.action = action;
	}

	/**
	 * レイアウトをリストビューにインポートする。
	 * doneGetContent時にコールされる。
	 * @method importContentToList
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} layoutData レイアウトデータ
	 */
	importContent(layoutArea, listElem, metaData, layoutData) {
		const metaDataDict = this.store.getMetaDataDict();
		const onlistID = "onlist:" + metaData.id;
		if (!Validator.isLayoutType(metaData)) {
			return;
		}
		// メタデータはGetMetaDataで取得済のものを使う.
		// GetContent送信した後にさらにGetMetaDataしてる場合があるため.
		if (metaDataDict.hasOwnProperty(metaData.id)) {
			metaData = metaDataDict[metaData.id];
		}
		const tagName = "div";
		const classname = "layoutcontent";

		const divElem = ((listElem)=>{
			if(listElem){
				return listElem;
			}else{
				const div = document.createElement('div');
				const onlistID = "onlist:" + metaData.id;
				div.id = onlistID;
				return div;
			}
		})(listElem);


		const layoutElem = document.createElement(tagName);
		layoutElem.classList.add(classname);

		this.action.setupContentElement({
			element : divElem,
			id : onlistID
		});

		//setupContent(divElem, onlistID);
		divElem.appendChild(layoutElem);
		layoutArea.appendChild(divElem);

		//console.log("id=" + metaData.id);
		if (layoutData) {
			// layoutData is text
			let data = JSON.parse(layoutData);
			const memo = JSON.parse(metaData.user_data_text);
			layoutElem.innerHTML = "Layout : " + metaData.id + "<br>"
				+ String(new Date(metaData.date).toLocaleString()) + "<br><br>"
				+ String(memo.text);
			divElem.style.width = "150px";
			divElem.style.height = "150px";
			divElem.style.color = "white";
		}
		layoutElem.style.width = "100%";
		layoutElem.style.height = "100%";
		divElem.style.position = "relative";
		divElem.style.top = "5px";
		divElem.style.left = "20px";
		divElem.style.border = "solid";
		divElem.style.borderColor = "lightgray";
		divElem.style.margin = "5px";
		divElem.style.color = "white";
		divElem.style.float = "left";
		
		ContentUtil.copyContentData(this.store, layoutElem, null, metaData, true);
	}
}	

export default LayoutListGUI;
