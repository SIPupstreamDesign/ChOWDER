/*jslint devel:true*/
/*global io, socket, WebSocket, Blob, URL, FileReader, DataView, Uint8Array, unescape */

(function (metabinary, vscreen, vsutil) {
	"use strict";

	console.log(location);
	var client = new WebSocket("ws://" + location.hostname + ":8081/v1/"),
		updateType = "all",
		timer,
		windowData = null,
		metaDataDict = {},
		windowType = "window";
	
	/**
	 * メタデータが表示中であるかを判別する
	 * @method isVisible
	 * @param {JSON} metaData 判別対象メタデータ
	 * @return LogicalExpression
	 */
	function isVisible(metaData) {
		console.log(metaData);
		return (metaData.hasOwnProperty('visible') && (metaData.visible === "true" || metaData.visible === true));
	}
	
	/**
	 * クライアントサイズを取得する
	 * @method getWindowSize
	 * @return ObjectExpression クライアントサイズ
	 */
	function getWindowSize() {
		return {
			width : document.documentElement.clientWidth,
			height : document.documentElement.clientHeight
		};
	}
	
	function insertElementWithDictionarySort(area, elem) {
		var i,
			child,
			isFoundIDNode = false;
		if (!area.childNodes || area.childNodes.lendth === 0) {
			area.appendChild(elem);
			return;
		}
		for (i = 0; i < area.childNodes.length; i = i + 1) {
			child = area.childNodes[i];
			if (child.id && child.id.indexOf('_manip') < 0) {
				if (elem.id < child.id) {
					isFoundIDNode = true;
					area.insertBefore(elem, child);
					break;
				}
			}
		}
		if (!isFoundIDNode) {
			area.appendChild(elem);
			return;
		}
	}
	
	/**
	 * cookie取得
	 * @method getCookie
	 * @param {String} key cookieキー
	 * @return Literal cookieデータ
	 */
	function getCookie(key) {
		var i,
			pos,
			cookies;
		if (document.cookie.length > 0) {
			console.log("all cookie", document.cookie);
			cookies = [document.cookie];
			if (document.cookie.indexOf(';') >= 0) {
				cookies = document.cookie.split(';');
			}
			for (i = 0; i < cookies.length; i = i + 1) {
				pos = cookies[i].indexOf(key + "=");
				if (pos >= 0) {
					return unescape(cookies[i].substring(pos + key.length + 1));
				}
			}
		}
		return "";
	}
	
	/**
	 * cookie保存
	 * @method saveCookie
	 */
	function saveCookie() {
		if (windowData) {
			console.log("saveCookie");
			document.cookie = 'window_id=' + windowData.id;
			document.cookie = 'posx=' + windowData.posx;
			document.cookie = 'posy=' + windowData.posy;
			document.cookie = 'visible=' + windowData.visible;
		}
	}
	
	/**
	 * View側Window[Display]登録
	 * @method registerWindow
	 */
	function registerWindow() {
		var wh = getWindowSize(),
			cx = wh.width / 2.0,
			cy = wh.height / 2.0,
			window_id = getCookie('window_id'),
			visible = (getCookie('visible') === "true"),
			posx = getCookie('posx'),
			posy = getCookie('posy');
		console.log("visible", visible);
		vscreen.assignWhole(wh.width, wh.height, cx, cy, 1.0);
		
		if (window_id !== "" && window_id.length === 8) {
			client.send(JSON.stringify({ command : 'reqAddWindow', id : window_id, posx : posx, posy : posy, width : wh.width, height : wh.height, visible : visible }));
		} else {
			client.send(JSON.stringify({ command : 'reqAddWindow', posx : 0, posy : 0, width : wh.width, height : wh.height, visible : false }));
		}
	}
	
	/**
	 * View側Window[Display]登録、サーバーにWindow登録通知
	 * @method onopen
	 */
	client.onopen = function () {
		client.send("view");
		if (!windowData) {
			registerWindow();
		}
	};
	
	/**
	 * close
	 * @method onclose
	 */
	client.onclose = function () {
		console.log('close');
	};

	/// update all contants
	/**
	 * update contants.
	 * @method update
	 */
	function update() {
		var previewArea = document.getElementById('preview_area');
		
		if (updateType === 'all') {
			console.log("update all");
			previewArea.innerHTML = "";
			client.send(JSON.stringify({ command : 'reqGetContent', type: 'all', id: ''}));
		} else if (updateType === 'window') {
			console.log("update winodow");
			client.send(JSON.stringify({ command : 'reqGetWindow', id : windowData.id}));
		} else {
			console.log("update transform");
			client.send(JSON.stringify({ command : 'reqGetMetaData', type: 'all', id: ''}));
		}
	}
	
	/**
	 * メタバイナリからコンテンツelementを作成してVirtualScreenに登録
	 * @method assignMetaBinary
	 * @param {JSON} metaData
	 * @param {String} contentData
	 */
	function assignMetaBinary(metaData, contentData) {
		var previewArea = document.getElementById('preview_area'),
			tagName,
			blob,
			elem,
			mime = "image/jpeg";
		
		console.log("id=" + metaData.id);

		if (metaData.type === windowType || (metaData.hasOwnProperty('visible') && metaData.visible === "true")) {
			metaDataDict[metaData.id] = metaData;
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
				
				insertElementWithDictionarySort(previewArea, elem);
				//previewArea.appendChild(elem);
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
			vsutil.assignMetaData(elem, metaData, false);
		}
	}
	
	/**
	 * 指定されたメタデータをvisibleにする
	 * @method setVisibleWindow
	 * @param {JSON} metaData
	 */
	function setVisibleWindow(metaData) {
		if (metaData.hasOwnProperty('visible')) {
			console.log("setVisibleWindow:", metaData);
			if (metaData.visible === "true") {
				document.getElementById('preview_area').style.display = "block";
			} else {
				document.getElementById('preview_area').style.display = "none";
			}
		}
	}
	
	/**
	 * VirtualDisplay更新
	 * @method updateWindow
	 * @param {JSON} metaData VirtualDisplayメタデータ
	 */
	function updateWindow(metaData) {
		var cx = parseFloat(metaData.posx, 10),
			cy = parseFloat(metaData.posy, 10),
			w = parseFloat(metaData.width),
			h = parseFloat(metaData.height),
			orgW = parseFloat(vscreen.getWhole().orgW),
			scale = orgW / w;
		
		console.log("scale:" + scale);
		
		// scale
		vscreen.setWholePos(0, 0);
		vscreen.setWholeCenter(0, 0);
		vscreen.setWholeScale(scale);
		
		// trans
		vscreen.translateWhole(-cx, -cy);
	}
	
	/**
	 * リサイズに伴うDisplayの更新
	 * @method resizeViewport
	 * @param {JSON} windowData
	 */
	function resizeViewport(windowData) {
		var wh = getWindowSize(),
			cx = wh.width / 2.0,
			cy = wh.height / 2.0,
			scale,
			id,
			metaTemp;

		updateWindow(windowData);
		
		for (id in metaDataDict) {
			if (metaDataDict.hasOwnProperty(id)) {
				if (document.getElementById(id)) {
					vsutil.assignMetaData(document.getElementById(id), metaDataDict[id], false);
				} else {
					delete metaDataDict[id];
				}
			}
		}
	}
	
	window.document.addEventListener("mousedown", function () {
		var displayArea = document.getElementById('displayid_area');
		if (displayArea.style.display !== "none") {
			displayArea.style.display = "none";
		}
	});
	
	/**
	 * Description
	 * @method showDisplayID
	 * @param {} id
	 */
	function showDisplayID(id) {
		console.log("showDisplayID:" + id);
		if (id && windowData.id === id) {
			document.getElementById('displayid_area').style.display = "block";
			setTimeout(function () {
				document.getElementById('displayid_area').style.display = "none";
			}, 8 * 1000);
		} else if (id === "") {
			document.getElementById('displayid_area').style.display = "block";
			setTimeout(function () {
				document.getElementById('displayid_area').style.display = "none";
			}, 8 * 1000);
		}
	}
	
	
	function assingVisible(json) {
		var elem = document.getElementById("preview_area");
		if (elem) {
			if (isVisible(json)) {
				console.log("isvisible");
				vsutil.assignMetaData(elem, json, false);
				elem.style.display = "block";
			} else {
				console.log("not isvisible");
				elem.style.display = "none";
			}
		}
	}
	
	/**
	 * Description
	 * @method onmessage
	 * @param {} message
	 */
	client.onmessage = function (message) {
		var json,
			elem;
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
			} else if (message.data === "updateWindow") {
				updateType = 'window';
				console.log("updateWindow");
				update();
			} else if (message.data.indexOf("showWindowID:") >= 0) {
				showDisplayID(message.data.split(':')[1]);
			} else {
				// recieve metadata
				json = JSON.parse(message.data);
				metaDataDict[json.id] = json;
				if (json.hasOwnProperty('command')) {
					if (json.command === "doneAddWindow") {
						console.log("doneAddWindow");
						windowData = json;
						saveCookie();
						window.parent.document.title = "Display ID:" + json.id;
						document.getElementById('displayid').innerHTML = "ID:" + json.id;
						updateWindow(windowData);
						assingVisible(windowData);
						return;
					} else if (json.command === "doneGetWindow") {
						console.log("doneGetWindow");
						windowData = json;
						saveCookie();
						console.log(windowData);
						setVisibleWindow(windowData);
						resizeViewport(windowData);
						assingVisible(windowData);
						return;
					}
				}
				elem = document.getElementById(json.id);
				//console.log(elem);
				if (elem) {
					if (isVisible(json)) {
						vsutil.assignMetaData(elem, json, false);
						elem.style.display = "block";
					} else {
						elem.style.display = "none";
					}
				} else if (isVisible(json)) {
					// new visible content
					updateType = 'all';
					update();
				}
				resizeViewport(windowData);
			}
		} else if (message.data instanceof Blob) {
			//console.log("found blob");
			metabinary.loadMetaBinary(message.data, function (metaData, contentData) {
				assignMetaBinary(metaData, contentData);
			});
		}
	};
	
	/// initialize.
	/// setup gui events
	/**
	 * Description
	 * @method init
	 */
	function init() {
		
		// resize event
		/*
		window.onresize = function () {
			if (timer) {
				clearTimeout(timer);
			}
			timer = setTimeout(function () {
				updateWholeWindow();
			}, 200);
		};
		*/

		var registered = false;
		window.addEventListener('mousemove', function (evt) {
			document.getElementById('menu').classList.remove('hide');
			if (!registered) {
				registered = true;
				setTimeout(function() {
					document.getElementById('menu').classList.add('hide');
					registered = false;
				}, 3000);
			}
		});
	}
	
	window.onload = init;
}(window.metabinary, window.vscreen, window.vscreen_util));
