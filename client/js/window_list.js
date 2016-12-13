/*jslint devel:true*/
(function () {
	"use strict";


	/**
	 * Displayをリストビューにインポートする。
	 * @method importWindowToList
	 * @param {JSON} windowData ウィンドウデータ
	 */
	function importWindowToList(gui, metaDataDict, windowData, displayArea, listElem) {
		console.log("importWindowToList");
		var displayArea = gui.get_display_area(),
			divElem,
			idElem,
			onlistID = "onlist:" + windowData.id;
		
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
		if (window.window_list.on_setup_content) {
			window.window_list.on_setup_content(divElem, onlistID);
		}
		//setupContent(divElem, onlistID);
		displayArea.appendChild(divElem);
		if (window.window_list.on_change_border_color) {
			window.window_list.on_change_border_color(windowData);
		}
		//changeWindowBorderColor(windowData);
	}
	


	window.window_list = {};
	window.window_list.import_window = function (gui, metaDataDict, windowData) {
		importWindowToList(gui, metaDataDict, windowData);
	};
	window.window_list.on_setup_content = null;
	//window.window_list.on_copy_content = null;
	window.window_list.on_change_border_color = null;

}(window.controller_gui));