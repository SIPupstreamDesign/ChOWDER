/*jslint devel:true*/
/*global io, socket, WebSocket, Blob, URL, FileReader, DataView, Uint8Array */

(function (metabinary) {
	"use strict";

	console.log(location);
	var client = new WebSocket("ws://" + location.hostname + ":8081/v1/"),
		updateType = "all";
	
	/**
	 * Description
	 * @method onopen
	 */
	client.onopen = function () {
		client.send("view");
	};
	
	/**
	 * Description
	 * @method onclose
	 */
	client.onclose = function () {
		console.log('close');
	};

	/// update all contants
	/**
	 * Description
	 * @method update
	 */
	function update() {
		var previewArea = document.getElementById('preview_area');
		
		if (updateType === 'all') {
			console.log("update all");
			previewArea.innerHTML = "";
			client.send(JSON.stringify({ command : 'reqGetContent', type: 'all', id: ''}));
		} else {
			console.log("update transform");
			client.send(JSON.stringify({ command : 'reqGetMetaData', type: 'all', id: ''}));
		}
	}
	
	/// initialize.
	/// setup gui events
	/**
	 * Description
	 * @method init
	 */
	function init() {
	}
	
	window.onload = init;

	/**
	 * Description
	 * @method resizeText
	 * @param {} elem
	 * @param {} rect
	 */
	function resizeText(elem, rect) {
		var lineCount = 1,
			fsize;
		console.log("rect:", rect);

		lineCount = elem.innerHTML.split("\n").length;
		fsize = parseInt((parseInt(rect.h, 10) - 1) / lineCount, 10);
		elem.style.fontSize = fsize + "px";
		if (fsize < 9) {
			elem.style.fontSize = "9px";
			elem.style.overflow = "auto";
		}
		elem.style.width = rect.w + 'px';
		elem.style.height = rect.h + 'px';
	}
	
	/**
	 * Description
	 * @method makeRect
	 * @param {} left
	 * @param {} top
	 * @param {} width
	 * @param {} height
	 * @return ObjectExpression
	 */
	function makeRect(left, top, width, height) {
		return {
			x : left,
			y : top,
			w : width,
			h : height
		};
	}
	
	/**
	 * Description
	 * @method toIntRect
	 * @param {Object} metaData
	 * @return CallExpression
	 */
	function toIntRect(metaData) {
		return makeRect(
			parseInt(metaData.posx, 10),
			parseInt(metaData.posy, 10),
			parseInt(metaData.width, 10),
			parseInt(metaData.height, 10)
		);
	}
	
	/**
	 * Description
	 * @method assignMetaData
	 * @param {} elem
	 * @param {Object} metaData
	 */
	function assignMetaData(elem, metaData) {
		elem.style.left = Number(metaData.posx) + "px";
		elem.style.top = Number(metaData.posy) + "px";
		elem.style.width = Number(metaData.width) + "px";
		elem.style.height = Number(metaData.height) + "px";
		if (metaData.type === "text") {
			resizeText(elem, toIntRect(metaData));
		}
		if (metaData.width < 10) {
			elem.style.width = "";
		}
		if (metaData.height < 10) {
			elem.style.height = "";
		}
	}
	
	/**
	 * Description
	 * @method assignMetaBinary
	 * @param {} metaData
	 * @param {} contentData
	 */
	function assignMetaBinary(metaData, contentData) {
		var previewArea = document.getElementById('preview_area'),
			tagName,
			blob,
			elem,
			mime = "image/jpeg";
		
		console.log("id=" + metaData.id);

		if (metaData.type === 'text') {
			tagName = 'pre';
		} else {
			tagName = 'img';
		}
		if (document.getElementById(metaData.id)) {
			elem = document.getElementById(metaData.id);
		} else {
			elem = document.createElement(tagName);
			elem.id = metaData.id;
			elem.style.position = "absolute";
			previewArea.appendChild(elem);
		}
		if (metaData.type === 'text') {
			// contentData is text
			elem.innerHTML = contentData;
		} else {
			// contentData is blob
			if (metaData.hasOwnProperty('mime')) {
				mime = metaData.mime;
			}
			blob = new Blob([contentData], {type: mime});
			if (elem && blob) {
				elem.src = URL.createObjectURL(blob);
			}
		}
		assignMetaData(elem, metaData);
	}
	
	/**
	 * Description
	 * @method onmessage
	 * @param {String} message
	 */
	client.onmessage = function (message) {
		var json;
		//console.log('> got message');
		if (typeof message.data === "string") {
			if (message.data === "update") {
				// recieve update request
				console.log("update");
				updateType = 'all';
				update();
			} else if (message.data === "updateTransform") {
				// recieve update transfrom request
				//console.log("updateTransform");
				updateType = 'transform';
				update();
			} else {
				// recieve metadata
				json = JSON.parse(message.data);
				assignMetaData(document.getElementById(json.id), json);
			}
		} else if (message.data instanceof Blob) {
			//console.log("found blob");
			metabinary.loadMetaBinary(message.data, function (metaData, contentData) {
				assignMetaBinary(metaData, contentData);
			});
		}
	};
}(window.metabinary));
