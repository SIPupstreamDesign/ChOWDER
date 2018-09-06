/*jslint devel:true*/
(function () {
	"use strict";
	/**
	 * Dispalyリストビュー
	 */

	var WindowList = function () {
		EventEmitter.call(this);
	};
	WindowList.prototype = Object.create(EventEmitter.prototype);

	/**
	 * Displayをリストビューにインポートする。
	 * @method importWindowToList
	 * @param {JSON} windowData ウィンドウデータ
	 */
	WindowList.prototype.import_window = function (gui, metaDataDict, windowData, displayArea, listElem) {
		console.log("importWindowToList");
		var displayArea = gui.get_display_area_for_insert(windowData.group),
			divElem,
			idElem,
			onlistID = "onlist:" + windowData.id;
		
		if (!Validator.isWindowType(windowData)) {
			return;
		}
		divElem = gui.get_list_elem(windowData.id);
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
		this.emit(WindowList.EVENT_SETUP_CONTENT, null, divElem, onlistID);
		displayArea.appendChild(divElem);
	}
	
	WindowList.EVENT_SETUP_CONTENT = "setup_content";
	// singleton
	window.window_list = new WindowList();

}());