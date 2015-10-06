/*jslint devel:true*/
/*global Blob, URL, FileReader, DataView, Uint8Array, unescape, escape */

(function (vscreen, vscreen_util, connector) {
	"use strict";

	console.log(location);
	var reconnectTimeout = 2000,
		updateType = "all",
		timer,
		windowData = null,
		metaDataDict = {},
		windowType = "window",
		doneAddWindow,
		doneGetWindow,
		doneGetContent,
		doneGetMetaData;
	
	/**
	 * メタデータが表示中であるかを判別する
	 * @method isVisible
	 * @param {JSON} metaData 判別対象メタデータ
	 * @return LogicalExpression
	 */
	function isVisible(metaData) {
		return (metaData.hasOwnProperty('visible') && (metaData.visible === "true" || metaData.visible === true));
	}
	
	/**
	 * クライアントサイズを取得する
	 * @method getWindowSize
	 * @return ObjectExpression クライアントサイズ
	 */
	function getWindowSize() {
		return {
			width : window.innerWidth,
			height : window.innerHeight
		};
	}
	
	function fixedEncodeURIComponent(str) {
		return encodeURIComponent(str).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
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
			console.log("saveCookie", windowData);
			document.cookie = 'window_id=' + windowData.id;
			document.cookie = windowData.id + '_x=' + windowData.posx;
			document.cookie = windowData.id + '_y=' + windowData.posy;
			document.cookie = windowData.id + '_visible=' + windowData.visible;
		}
	}
	
	/**
	 * window idの取得.
	 */
	function getWindowID() {
		var window_id = getCookie('window_id'),
			hashid = location.hash.split("#").join("");
		
		if (hashid.length > 0) {
			window_id = decodeURIComponent(hashid);
		}
		return window_id;
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
			visible,
			posx,
			posy,
			hashid = location.hash.split("#").join("");
		
		vscreen.assignWhole(wh.width, wh.height, cx, cy, 1.0);
		
		if (hashid.length > 0) {
			window_id = decodeURIComponent(hashid);
			visible = "true";
			if (getCookie(window_id + '_visible') === 'false') {
				visible = "false";
			}
			posx = getCookie(window_id + '_x');
			posy = getCookie(window_id + '_y');
			if (!posx) { posx = window.screenX || window.screenLeft; }
			if (!posy) { posy = window.screenY || window.screenTop; }
			connector.send('AddWindow', {id : window_id, posx : posx, posy : posy, width : wh.width, height : wh.height, visible : visible }, doneAddWindow);
		} else if (window_id !== "") {
			visible = (getCookie(window_id + '_visible') === "true");
			posx = getCookie(window_id + '_x');
			posy = getCookie(window_id + '_y');
			connector.send('AddWindow', { id : window_id, posx : posx, posy : posy, width : wh.width, height : wh.height, visible : visible }, doneAddWindow);
		} else {
			connector.send('AddWindow', { posx : 0, posy : 0, width : wh.width, height : wh.height, visible : false }, doneAddWindow);
		}
	}
	
	/// update all contants
	/**
	 * update contants.
	 * @method update
	 */
	function update(targetid) {
		var previewArea = document.getElementById('preview_area');
		
		if (updateType === 'all') {
			console.log("update all");
			previewArea.innerHTML = "";
			connector.send('GetWindow', { id: getWindowID() }, function (err, json) {
				doneGetWindow(err, json);
				connector.send('GetMetaData', { type: 'all', id: '' }, doneGetMetaData);
			});
		} else if (updateType === 'window') {
			console.log("update winodow");
			connector.send('GetWindow', { id : windowData.id}, doneGetWindow);
		} else {
			console.log("update transform");
			if (targetid) {
				connector.send('GetMetaData', { type: '', id: targetid}, doneGetMetaData);
			} else {
				connector.send('GetMetaData', { type: 'all', id: ''}, doneGetMetaData);
			}
		}
	}
	
	/**
	 * コンテンツタイプから適切なタグ名を取得する.
	 */
	function getTagName(contentType) {
		var tagName;
		if (contentType === 'text') {
			tagName = 'pre';
		} else {
			tagName = 'img';
		}
		return tagName;
	}
	
	
	function assignVisible(json) {
		var elem = document.getElementById("preview_area");
		if (elem) {
			if (isVisible(json)) {
				console.log("isvisible");
				vscreen_util.assignMetaData(elem, json, false);
				elem.style.display = "block";
			} else {
				console.log("not isvisible");
				elem.style.display = "none";
			}
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
			mime = "image/jpeg",
			boundElem;
		
		console.log("id=" + metaData.id);

		if (metaData.type === windowType || (metaData.hasOwnProperty('visible') && metaData.visible === "true")) {
			tagName = getTagName(metaData.type);
			
			// 既に読み込み済みのコンテンツかどうか
			if (document.getElementById(metaData.id)) {
				elem = document.getElementById(metaData.id);
				// 読み込み完了までテンポラリで枠を表示してる．枠であった場合は消す.
				if (elem.tagName.toLowerCase() !== tagName) {
					previewArea.removeChild(elem);
					elem = null;
				}
				// メタデータはGetMetaDataで取得済のものを使う.
				// GetContent送信した後にさらにGetMetaDataしてる場合があるため.
				if (metaDataDict.hasOwnProperty(metaData.id)) {
					metaData = metaDataDict[metaData.id];
				}
			}
			
			if (!elem) {
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
			vscreen_util.assignMetaData(elem, metaData, false);
		}
	}
	
	/**
	 * コンテンツロード完了まで表示する枠を作る.
	 */
	function createBoundingBox(metaData) {
		var previewArea = document.getElementById('preview_area'),
			tagName = 'div',
			elem = document.createElement(tagName);
		
		elem.id = metaData.id;
		elem.style.position = "absolute";
		elem.className = "temporary_bounds";
		insertElementWithDictionarySort(previewArea, elem);
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
					vscreen_util.assignMetaData(document.getElementById(id), metaDataDict[id], false);
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
	
	function changeID(e) {
		var elem = document.getElementById('input_id'),
			val,
			url;
		e.preventDefault();
		if (elem && elem.value) {
			console.log(elem.value);
			val = elem.value.split(' ').join('');
			val = val.split('　').join('');
			location.hash = fixedEncodeURIComponent(val);
			location.reload(true);
		}
	}
	

	function updateVisible(json) {
		var elem = document.getElementById(json.id);
		console.log("updateVisible", elem);
		if (elem) {
			if (isVisible(json)) {
				vscreen_util.assignMetaData(elem, json, false);
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
	
	doneAddWindow = function (err, json) {
		metaDataDict[json.id] = json;

		console.log("doneAddWindow", json);
		windowData = json;
		saveCookie();
		window.parent.document.title = "Display ID:" + json.id;
		document.getElementById('input_id').value = json.id;
		document.getElementById('displayid').innerHTML = "ID:" + json.id;
		updateWindow(windowData);
		assignVisible(windowData);
		updateVisible(json);
	};
	
	doneGetWindow = function (err, json) {
		metaDataDict[json.id] = json;

		console.log("doneGetWindow", json);
		windowData = json;
		saveCookie();
		console.log(windowData);
		setVisibleWindow(windowData);
		resizeViewport(windowData);
		assignVisible(windowData);
		//updateVisible(json);
	};
	
	doneGetContent = function (err, data) {
		console.log("doneGetContent", err, data);
		if (!err) {
			var metaData = data.metaData,
				contentData = data.contentData;

			//console.log("doneGetContent", metaData, contentData);
			assignMetaBinary(metaData, contentData);
		}
	};
	
	doneGetMetaData = function (err, json) {
		metaDataDict[json.id] = json;
		var elem = document.getElementById(json.id),
			isWindow = (json.type === windowType),
			isOutside = false;
		console.log("doneGetMetaData", json);
		console.log("isOutside:", isOutside);
		
		if (isWindow) {
			console.log(json.id, getWindowID());
			if (json.id !== getWindowID()) {
				return;
			}
		} else {
			isOutside = vscreen_util.isOutsideWindow(json, vscreen.getWhole());
		}
		
		
		if (isOutside) {
			if (elem) {
				elem.style.display = "none";
			}
		} else {
			console.log("inside", elem);
			if (elem && elem.tagName.toLowerCase() === getTagName(json.type)) {
				if (isVisible(json)) {
					vscreen_util.assignMetaData(elem, json, false);
					elem.style.display = "block";
				} else {
					elem.style.display = "none";
				}
			} else if (isVisible(json)) {
				// コンテンツがロードされるまで枠を表示しておく.
				if (!elem) {
					createBoundingBox(json);
					// 新規コンテンツロード.
					connector.send('GetContent', { type: json.type, id: json.id }, doneGetContent);
				}
				elem = document.getElementById(json.id);
				vscreen_util.assignMetaData(elem, json, false);
			}
			if (isWindow) {
				resizeViewport(windowData);
			}
		}
	};

	function reconnect() {
		connector.connect(function () {
			if (!windowData) {
				console.log("registerWindow");
				registerWindow();
			}
		}, (function () {
			return function (ev) {
				console.log('close');
				setTimeout(function () {
					reconnect();
				}, reconnectTimeout);
			};
		}()));

		connector.on("Update", function (data) {
			console.log("update");
			updateType = 'all';
			update();
		});

		connector.on("UpdateWindow", function (data) {
			updateType = 'window';
			console.log("updateWindow", updateType);
			update();
		});
		
		connector.on("ShowWindowID", function (data) {
			showDisplayID(data.id);
		});
		
		connector.on("UpdateTransform", function (data) {
			updateType = 'transform';
			console.log("updateTransform", data);
			update(data.id);
		});
	}

	/// initialize.
	/// setup gui events
	/**
	 * Description
	 * @method init
	 */
	function init() {
		var input_id = document.getElementById('input_id'),
			registered = false,
			onfocus = false,
			hideMenuFunc = function () {
				console.log("onfocus:", onfocus);
				if (!onfocus) {
					console.log("hideMenuFunc");
					document.getElementById('menu').classList.add('hide');
				}
				registered = false;
			};
		
		reconnect();
		
		// resize event
		window.onresize = function () {
			if (timer) {
				clearTimeout(timer);
			}
			timer = setTimeout(function () {
				registerWindow();
			}, 200);
		};

		window.addEventListener('mousemove', function (evt) {
			document.getElementById('menu').classList.remove('hide');
			if (!registered) {
				registered = true;
				setTimeout(hideMenuFunc, 3000);
			}
		});
		
		document.getElementById('change_id').onclick = changeID;
		
		input_id.onfocus = function (ev) {
			console.log("onfocus");
			onfocus = true;
			document.getElementById('menu').classList.remove('hide');
			clearTimeout(hideMenuFunc);
		};
		input_id.onblur = function (ev) {
			console.log("onblur");
			onfocus = false;
		};
		input_id.onkeypress = function (ev) {
			console.log(ev.keyCode);
			if (ev.keyCode === 13) { // enter
				document.getElementById('change_id').onclick(ev);
			}
		};
	}
	
	window.onload = init;
}(window.vscreen, window.vscreen_util, window.ws_connector));
