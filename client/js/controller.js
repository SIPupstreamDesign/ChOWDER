/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */

(function (metabinary) {
	"use strict";
	
	var socket = io.connect(),
		lastContentID = 0,
		currentContent = null,
		draggingID = 0,
		lastDraggingID = null,
		manipulators = [],
		draggingManip = null,
		dragOffsetTop = 0,
		dragOffsetLeft = 0,
		metaDataDict = {};
	
	/// get image from server
	/**
	 * 全て更新する
	 * @method update
	 */
	function update() {
		socket.emit('reqGetContent', JSON.stringify({type: "all", id: ""}));
	}
	
	/// delete content
	/**
	 * 選択中のコンテンツを削除する
	 * @method deleteContent
	 */
	function deleteContent() {
		var contentID = document.getElementById('delete_content_id');
		socket.emit('reqDeleteContent', JSON.stringify({id : contentID.innerHTML}));
	}
	
	/**
	 * コンテンツを追加する
	 * @method addContent
	 * @param {BLOB} binary メタバイナリ
	 */
	function addContent(binary) {
		socket.emit('reqAddContent', binary);
	}
	
	/**
	 * トランスフォームを更新する
	 * @method updateTransform
	 * @param {Object} metaData メタデータ
	 */
	function updateTransform(metaData) {
		//console.log("reqUpdateTransform");
		socket.emit('reqUpdateTransform', JSON.stringify(metaData));
	}
	
	/**
	 * コンテンツを更新する
	 * @method updateContent
	 * @param {Object} binary メタバイナリ
	 */
	function updateContent(binary) {
		socket.emit('reqUpdateContent', binary);
	}
	
	/**
	 * マニピュレータを動かす
	 * @method moveManipulator
	 * @param {Array} manips マニピュレータ
	 * @param {Element} targetElem 対象としているエレメント
	 */
	function moveManipulator(manips, targetElem) {
		var left,
			top,
			width,
			height,
			manipHalfWidth = 5,
			manipHalfHeight = 5,
			posx = Number(targetElem.style.left.split("px").join("")),
			posy = Number(targetElem.style.top.split("px").join(""));
		
		left = (posx - manipHalfWidth);
		top = (posy - manipHalfHeight);
		width = targetElem.offsetWidth;
		height = targetElem.offsetHeight;
		
		// left top
		manips[0].style.left = left + "px";
		manips[0].style.top = top + "px";
		// left bottom
		manips[1].style.left = left + "px";
		manips[1].style.top = (top + height) + "px";
		// right bottom
		manips[2].style.left = (left + width) + "px";
		manips[2].style.top = (top + height) + "px";
		// right top
		manips[3].style.left = (left + width) + "px";
		manips[3].style.top = top + "px";
	}
	
	/**
	 * テキストをリサイズする
	 * @method resizeText
	 * @param {Element} elem 対象エレメント
	 * @param {Rect} rect 矩形
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
	 * 矩形を作成する
	 * @method makeRect
	 * @param {Number} left 左
	 * @param {Number} top 上
	 * @param {Number} width 幅
	 * @param {Number} height 高さ
	 * @return Rect
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
	 * Intの矩形を作成する
	 * @method toIntRect
	 * @param {Object} metaData メタデータ
	 * @return Rect
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
	 * メタデータを割り当てる
	 * @method assignMetaData
	 * @param {Element} elem 対象エレメント
	 * @param {Object} metaData メタデータ
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
	 * マニピュレータが動いてるときに呼ばれるコールバック
	 * @method onManipulatorMove
	 * @param {Event} evt マウスイベント
	 */
	function onManipulatorMove(evt) {
		var px, py,
			lastx, lasty,
			lastw, lasth,
			currentw,
			currenth,
			ydiff,
			elem,
			metaData;
		if (draggingManip && lastDraggingID) {
			elem = document.getElementById(lastDraggingID);
			metaData = metaDataDict[lastDraggingID];
			lastx = Number(metaData.posx);
			lasty = Number(metaData.posy);
			lastw = Number(metaData.width);
			lasth = Number(metaData.height);
			if (draggingManip.id === '_manip_0' || draggingManip.id === '_manip_1') {
				px = evt.x - dragOffsetLeft;
				py = evt.y - dragOffsetTop;
				currentw = lastw - (px - lastx);
			} else {
				px = (evt.x - lastw) - dragOffsetLeft;
				py = (evt.y) - dragOffsetTop;
				currentw = lastw + (px - lastx);
			}
			if (currentw < 20) { return; }
			currenth = lasth * (currentw / lastw);
			ydiff = lasth * (currentw / lastw - 1.0);
			
			metaData.width = currentw;
			metaData.height = lasth * (currentw / lastw);
			if (draggingManip.id === '_manip_0') {
				metaData.posx = (lastx + (px - lastx));
				metaData.posy = (lasty - ydiff);
			} else if (draggingManip.id === '_manip_1') {
				metaData.posx = (lastx + (px - lastx));
			} else if (draggingManip.id === '_manip_3') {
				metaData.posy = (lasty - ydiff);
			}
			assignMetaData(elem, metaData);
		}
	}
	
	/**
	 * マニピュレータをセットアップする
	 * @method setupManipulator
	 * @param {Object} manip マニピュレータ
	 */
	function setupManipulator(manip) {
		var manipHalfWidth = 5,
			manipHalfHeight = 5,
			cursor,
			isdragging = false;
		
		manip.style.position = "absolute";
		manip.style.border = "solid 2px black";
		manip.style.zIndex = '10';
		manip.style.width = manipHalfWidth * 2 + "px";
		manip.style.height = manipHalfHeight * 2 + "px";
		manip.style.background = "#000";
		if (manip.id === '_manip_0') {
			cursor = "nw-resize";
		} else if (manip.id === '_manip_1') {
			cursor = "sw-resize";
		} else if (manip.id === '_manip_2') {
			cursor = "se-resize";
		} else if (manip.id === '_manip_3') {
			cursor = "ne-resize";
		}
		manip.onmousedown = function (evt) {
			dragOffsetTop = evt.clientY - manip.offsetTop;
			dragOffsetLeft = evt.clientX - manip.offsetLeft;
			draggingManip = manip;
		};
		manip.onmousemove = function (evt) {
			manip.style.cursor = cursor;
		};
	}
	
	/**
	 * マニピュレータを取り除く
	 * @method removeManipulator
	 */
	function removeManipulator() {
		var i,
			previewArea = document.getElementById('preview_area');
		for (i = 0; i < manipulators.length; i = i + 1) {
			previewArea.removeChild(manipulators[i]);
		}
		manipulators = [];
	}
	
	/**
	 * マニピュレータを表示する
	 * @method showManipulator
	 * @param {Element} elem 対象のエレメント
	 */
	function showManipulator(elem) {
		var manips = [
				document.createElement('span'),
				document.createElement('span'),
				document.createElement('span'),
				document.createElement('span')
			],
			manip,
			previewArea = document.getElementById('preview_area'),
			i,
			posx,
			posy;
		
		moveManipulator(manips, elem, posx, posy);
		removeManipulator();
		
		for (i = 0; i < manips.length; i = i + 1) {
			manip = manips[i];
			manip.id = "_manip_" + i;
			setupManipulator(manip);
			previewArea.appendChild(manip);
			manipulators.push(manip);
		}
	}
	
	/**
	 * コンテンツのセットアップ
	 * @method setupContent
	 * @param {Element} elem エレメント
	 * @param {String} id コンテンツID
	 */
	function setupContent(elem, id) {
		elem.onmousedown = function (evt) {
			var previewArea = document.getElementById('preview_area'),
				elem;
			document.getElementById('delete_content_id').innerHTML = id;
			document.getElementById('update_content_id').innerHTML = id;
			document.getElementById('content_delete_button').disabled = false;
			document.getElementById('update_image_input').disabled = false;
			// erase last border
			if (lastDraggingID) {
				elem = document.getElementById(lastDraggingID);
				elem.style.border = "";
				elem.style.zIndex = 0;
				lastDraggingID = null;
			}
			draggingID = id;
			elem = document.getElementById(id);
			evt = (evt) || window.event;
			dragOffsetTop = evt.clientY - elem.offsetTop;
			dragOffsetLeft = evt.clientX - elem.offsetLeft;
			elem.style.border = "solid 2px black";
			elem.style.zIndex = 1;
			showManipulator(elem);
			evt.stopPropagation();
			evt.preventDefault();
		};
	}
	
	/**
	 * マウスダウン
	 * @method onmousedown
	 * @param {Event} evt マウスイベント
	 */
	window.document.onmousedown = function (evt) {
		var elem;
		// erase last border
		if (lastDraggingID && !draggingManip) {
			elem = document.getElementById(lastDraggingID);
			elem.style.border = "";
			elem.style.zIndex = 0;
			lastDraggingID = null;
			removeManipulator();
		}
	};
	/**
	 * マウスムーブ
	 * @method onmousemove
	 * @param {Event} evt マウスイベント
	 */
	window.document.onmousemove = function (evt) {
		var i,
			metaData,
			elem;
		evt = (evt) || window.event;
		if (draggingID) {
			// translate
			elem = document.getElementById(draggingID);
			metaData = metaDataDict[draggingID];
			metaData.posx = evt.x - dragOffsetLeft;
			metaData.posy = evt.y - dragOffsetTop;
			assignMetaData(elem, metaData);
			moveManipulator(manipulators, elem);
			updateTransform(metaData);
			
			evt.stopPropagation();
			evt.preventDefault();
		} else if (lastDraggingID) {
			// scaling
			elem = document.getElementById(lastDraggingID);
			onManipulatorMove(evt);
			moveManipulator(manipulators, elem);
			evt.stopPropagation();
			evt.preventDefault();
		}
	};
	/**
	 * マウスアップ
	 * @method onmouseup
	 */
	window.document.onmouseup = function () {
		var previewArea = document.getElementById('preview_area'),
			metaData,
			elem;
		if (draggingID) {
			metaData = metaDataDict[draggingID];
			//socket.emit('reqUpdateTransform', JSON.stringify(metaData));
		}
		if (draggingManip && lastDraggingID) {
			metaData = metaDataDict[lastDraggingID];
			//socket.emit('reqUpdateTransform', JSON.stringify(metaData));
		} else {
			lastDraggingID = draggingID;
			draggingID = null;
		}
		draggingManip = null;
		dragOffsetTop = 0;
		dragOffsetLeft = 0;
	};

	/// send text to server
	/**
	 * テキストの送信.
	 * @method sendText
	 */
	function sendText() {
		console.log("sendtest");
		var previewArea = document.getElementById('preview_area'),
			textInput = document.getElementById('text_input'),
			elem = document.createElement('span'),
			width = (textInput.clientWidth + 1),
			height = (textInput.clientHeight + 1),
			binary = metabinary.createMetaBinary({type : "text", posx : 0, posy : 0, width : width, height : height}, textInput.value);
		
		elem.style.position = "absolute";
		elem.style.top = "0px";
		elem.style.left = "0px";
		elem.innerHTML = textInput.value;
		previewArea.appendChild(elem);
		currentContent = elem;
		console.log(textInput.value);
		
		addContent(binary);
	}
	
	/// send url to server
	/**
	 * URLの送信
	 * @method sendURL
	 */
	function sendURL() {
		console.log("sendurl");
		var previewArea = document.getElementById('preview_area'),
			urlInput = document.getElementById('url_input'),
			img = document.createElement('img'),
			binary = metabinary.createMetaBinary({type : "url"}, urlInput.value);

		img.style.position = "absolute";
		img.style.top = "0px";
		img.style.left = "0px";
		previewArea.appendChild(img);
		currentContent = img;
		console.log(urlInput.value);
		
		addContent(binary);
	}
	
	/// send image to server
	/**
	 * 画像の送信
	 * @method sendImage
	 * @param {BLOB} imagebinary 画像バイナリ
	 * @param {Number} width 幅
	 * @param {Number} height 高さ
	 */
	function sendImage(imagebinary, width, height) {
		var metaData = {type : "image", posx : 0, posy : 0, width : width, height: height},
			binary = metabinary.createMetaBinary(metaData, imagebinary);
		console.log("sendImage");
		addContent(binary);
	}
	
	/// open image file
	/**
	 * 画像を開く
	 * @method openImage
	 * @param {Event} evt ファイルイベント
	 */
	function openImage(evt) {
		var files = evt.target.files,
			file,
			i,
			fileReader = new FileReader(),
			buffer,
			blob;

		fileReader.onloadend = function (e) {
			var data = e.target.result,
				img;
			if (data) {
				img = document.createElement('img');
				buffer = new Uint8Array(e.target.result);
				blob = new Blob([buffer], {type: "image/jpeg"});
				img.src = URL.createObjectURL(blob);
				img.style.position = "absolute";
				img.style.left = "0px";
				img.style.right = "0px";
				img.onload = function () {
					img.style.width = img.naturalWidth + "px";
					img.style.height = img.naturalHeight + "px";
					sendImage(e.target.result, img.naturalWidth, img.naturalHeight);
				};
			}
		};
		for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('image.*')) {
				fileReader.readAsArrayBuffer(file);
			}
		}
	}
	
	/// replace image file
	/**
	 * 画像の差し替え
	 * @method replaceImage
	 * @param {Event} evt ファイルイベント
	 */
	function replaceImage(evt) {
		var files = evt.target.files,
			file,
			i,
			fileReader = new FileReader(),
			binary,
			id = document.getElementById('update_content_id').innerHTML;

		fileReader.onloadend = function (e) {
			if (e.target.result) {
				binary = metabinary.createMetaBinary({type : "image", id : id}, e.target.result);
				updateContent(binary);
			}
		};
		for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('image.*')) {
				fileReader.readAsArrayBuffer(file);
			}
		}
	}
	
	/// import content
	/**
	 * コンテンツのインポート
	 * @method importContent
	 * @param {Object} metaData メタデータ
	 * @param {Object} contentData コンテンツデータ
	 */
	function importContent(metaData, contentData) {
		var previewArea = document.getElementById('preview_area'),
			elem,
			tagName,
			blob,
			mime = "image/jpeg";

		metaDataDict[metaData.id] = metaData;
		console.log("doneGetContent:" + JSON.stringify(metaData));

		if (metaData.type === 'text') {
			tagName = 'pre';
		} else {
			tagName = 'img';
		}
		if (document.getElementById(metaData.id)) {
			elem = document.getElementById(metaData.id);
			//console.log("found " + json.type);
		} else {
			elem = document.createElement(tagName);
			elem.id = metaData.id;
			elem.style.position = "absolute";
			setupContent(elem, metaData.id);
			previewArea.appendChild(elem);
		}
		console.log("id=" + metaData.id);
		if (metaData.type === 'text') {
			// contentData is text
			elem.innerHTML = contentData;
			assignMetaData(elem, metaData);
		} else {
			// contentData is blob
			if (metaData.hasOwnProperty('mime')) {
				mime = metaData.mime;
				console.log("mime:" + mime);
			}
			blob = new Blob([contentData], {type: mime});
			if (elem && blob) {
				elem.src = URL.createObjectURL(blob);

				elem.onload = function () {
					if (metaData.width < 10) {
						console.log("naturalWidth:" + elem.naturalWidth);
						metaData.width = elem.naturalWidth;
					}
					if (metaData.height < 10) {
						console.log("naturalHeight:" + elem.naturalHeight);
						metaData.height = elem.naturalHeight;
					}
					//console.log("onload:" + JSON.stringify(metaData));
					assignMetaData(elem, metaData);
				};
			}
		}
		//console.log(metaData);
	}
	
	/**
	 * 初期化
	 * @method init
	 */
	function init() {
		var textSendButton = document.getElementById('text_send_button'),
			urlSendButton = document.getElementById('url_send_button'),
			reloadButton = document.getElementById('reload_button'),
			contentDeleteButton = document.getElementById('content_delete_button'),
			fileInput = document.getElementById('file_input'),
			dropZone = document.getElementById('drop_zone'),
			updateImageInput = document.getElementById('update_image_input');
		
		textSendButton.onclick = sendText;
		urlSendButton.onclick = sendURL;
		reloadButton.onclick = update;
		contentDeleteButton.onclick = deleteContent;
		updateImageInput.addEventListener('change', replaceImage, false);
		fileInput.addEventListener('change', openImage, false);
	}
	
	///------------------------------------------------------------------------
	
	socket.on('connect', function () {
		console.log("connect");
		socket.emit('reqRegisterEvent', "v1");
	});
	

	socket.on('doneAddContent', function (reply) {
		var json = JSON.parse(reply);
		console.log("doneAddContent:" + json.id + ":" + json.type);
		
		if (currentContent) {
			currentContent.id = json.id;
			setupContent(currentContent, json.id);
			//console.log(currentContent);
		}
		lastContentID = json.id;
		currentContent = null;
	});
	
	socket.on('doneUpdateTransform', function (reply) {
	});
	
	socket.on('doneDeleteContent', function (reply) {
		console.log("doneDeleteContent");
		var json = JSON.parse(reply),
			previewArea = document.getElementById('preview_area'),
			contentID = document.getElementById('delete_content_id'),
			deleted = document.getElementById(json.id);
		previewArea.removeChild(deleted);
		contentID.innerHTML = "No Content Selected.";
		document.getElementById('content_delete_button').disabled = true;
	});
	
	socket.on('doneUpdateContent', function (reply) {
		var updateContentID = document.getElementById('update_content_id');
		updateContentID.innerHTML = "No Content Selected.";
		document.getElementById('update_image_input').disabled = true;
		update();
	});
	
	/// meta data updated
	socket.on('doneGetMetaData', function (data) {
		var json = JSON.parse(data);
		metaDataDict[json.id] = json;
		console.log("doneGetMeta:", json);
		assignMetaData(document.getElementById(json.id), json);
	});
	
	/// content data updated
	socket.on('doneGetContent', function (data) {
		metabinary.loadMetaBinary(new Blob([data]), function (metaData, contentData) {
			importContent(metaData, contentData);
		});
	});
	
	socket.on('updateTransform', function () {
		socket.emit('reqGetMetaData', JSON.stringify({type: "all", id: ""}));
	});
	
	socket.on('update', function () {
		update();
	});
	
	window.onload = init;

}(window.metabinary));
