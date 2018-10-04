/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */
/*jslint devel:true*/
(function () {
	"use strict";
	/**
	 * レイアウトリストビュー
	 */

	var LayoutList;

	LayoutList = function () {
		EventEmitter.call(this);
	};
	LayoutList.prototype = Object.create(EventEmitter.prototype);

	/**
	 * レイアウトをリストビューにインポートする。
	 * doneGetContent時にコールされる。
	 * @method importContentToList
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} layoutData レイアウトデータ
	 */
	LayoutList.prototype.import_content = function (gui, metaDataDict, metaData, layoutData) {
		var layoutArea = null,
			layoutElem,
			id,
			divElem,
			tagName,
			classname,
			data,
			memo,
			onlistID = "onlist:" + metaData.id;

		if (!Validator.isLayoutType(metaData)) {
			return;
		}
		
		// メタデータはGetMetaDataで取得済のものを使う.
		// GetContent送信した後にさらにGetMetaDataしてる場合があるため.
		if (metaDataDict.hasOwnProperty(metaData.id)) {
			metaData = metaDataDict[metaData.id];
		}

		if (metaData.hasOwnProperty('group')) {
			layoutArea = gui.get_layout_area_by_group(metaData.group);
		}
		if (!layoutArea) {
			layoutArea = gui.get_layout_area_by_group(Constants.DefaultGroup);
		}
		tagName = "div";
		classname = "layoutcontent";
		
		if (gui.get_list_elem(metaData.id)) {
			divElem = gui.get_list_elem(metaData.id);
			layoutElem = divElem.childNodes[0];
		}
		
		if (!divElem) {
			layoutElem = document.createElement(tagName);
			divElem = document.createElement('div');
			divElem.id = onlistID;

			this.emit(LayoutList.EVENT_SETUP_LAYOUT, null, divElem, onlistID);

			//setupContent(divElem, onlistID);
			divElem.appendChild(layoutElem);
			layoutArea.appendChild(divElem);
		}
		layoutElem.classList.add(classname);

		//console.log("id=" + metaData.id);
		if (layoutData) {
			// layoutData is text
			data = JSON.parse(layoutData);
			memo = JSON.parse(metaData.user_data_text);
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
		
		this.emit(LayoutList.EVENT_COPY_LAYOUT, null, layoutElem, null, metaData, true);
	}
	

	LayoutList.EVENT_SETUP_LAYOUT = "setup_layout";
	LayoutList.EVENT_COPY_LAYOUT = "copy_layout";

	// singleton
	window.layout_list = new LayoutList();

}());