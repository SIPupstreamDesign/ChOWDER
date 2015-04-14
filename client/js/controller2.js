/*jslint devel:true */
/*global io, socket, FileReader, Uint8Array, Blob, URL, event, unescape */

(function (metabinary, vscreen, vsutil, manipulator) {
	"use strict";
	
	var socket = io.connect(),
		currentContent = null,
		draggingID = 0,
		lastDraggingID = null,
		dragOffsetTop = 0,
		dragOffsetLeft = 0,
		metaDataDict = {},
		windowType = "window",
		onContentArea = false,
		wholeWindowID = "whole_window",
		wholeWindowListID = "onlist:whole_window",
		wholeSubWindowID = "whole_sub_window",
		initialWholeWidth = 1000,
		initialWholeHeight = 900,
		initialDisplayScale = 0.5,
		snapSetting = "free",
		contentSelectColor = "#04B431",
		windowSelectColor = "#0080FF";
	
	socket.on('connect', function () {
		console.log("connect");
		socket.emit('reqRegisterEvent', "v1");
	});
	
	/**
	 * ドラッグ中のオフセット設定。Manipulatorにて使用される。
	 * @method draggingOffsetFunc
	 * @param {Function} top
	 * @param {Function} left
	 */
	function draggingOffsetFunc(top, left) {
		dragOffsetTop = top;
		dragOffsetLeft = left;
	}
	
	/**
	 * メタデータが表示中かを判定する
	 * @method isVisible
	 * @param {Object} metaData
	 * @return LogicalExpression
	 */
	function isVisible(metaData) {
		return (metaData.hasOwnProperty('visible') && metaData.visible === "true");
	}
	
	/**
	 * VirtualDisplayのモードがFreeModeかを判別する
	 * @method isFreeMode
	 * @return BinaryExpression
	 */
	function isFreeMode() {
		return snapSetting === 'free';
	}
	
	/**
	 * VirtualDisplayのモードがGridModeかを判別する
	 * @method isGridMode
	 * @return BinaryExpression
	 */
	function isGridMode() {
		return snapSetting === 'grid';
	}
	
	/**
	 * VirtualDisplayのモードがDisplayModeかを判別する
	 * @method isDisplayMode
	 * @return BinaryExpression
	 */
	function isDisplayMode() {
		return snapSetting === 'display';
	}
	
	/**
	 * 左リスト表示中かをIDから判別する
	 * @method isUnvisibleID
	 * @param {String} id
	 * @return BinaryExpression
	 */
	function isUnvisibleID(id) {
		return (id.indexOf("onlist:") >= 0);
	}
	
	/**
	 * 発生したイベントが左リストビュー領域で発生しているかを判別する
	 * @method isContentArea
	 * @return LogicalExpression
	 */
	function isContentArea(evt) {
		var contentArea = document.getElementById('left_main_area'),
			px = evt.clientX + (document.body.scrollLeft || document.documentElement.scrollLeft),
			py = evt.clientY + (document.body.scrollTop || document.documentElement.scrollTop);
		if (!contentArea) {
			return false;
		}
		return (px < (contentArea.scrollWidth) && py > 100 && py < (100 + contentArea.offsetTop + contentArea.scrollHeight));
	}
	
	/**
	 * 左リストにて選択されたアクティブなタブを判別する。
	 * @method isDisplayTabSelected
	 * @return BinaryExpression
	 */
	function isDisplayTabSelected() {
		return (document.getElementById('display_tab_link').className.indexOf("active") >= 0);
	}
	
	/**
	 * cookie取得
	 * @method getCookie
	 * @param {String} key cookieIDキー
	 * @return Literal
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
		var displayScale = vscreen.getWholeScale();
		console.log("saveCookie");
		document.cookie = 'display_scale=' + displayScale;
		document.cookie = 'snap_setting=' + snapSetting;
	}
	
	/**
	 * 選択されたタブに左リストdomの切り替えを行う。
	 * onclickはinit時に設定される
	 * @method changeLeftTab
	 * @param {String} type WindowかContentのタブ名
	 */
	function changeLeftTab(type) {
		var displayTabTitle = document.getElementById('display_tab_title'),
			contentTabTitle = document.getElementById('content_tab_title');
		if (type === windowType) {
			displayTabTitle.onclick();
		} else {
			contentTabTitle.onclick();
		}
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
			if (child.hasOwnProperty('id') && child.id.indexOf('_manip') < 0) {
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
	 * 選択されたIDからElement取得
	 * @method getElem
	 * @param {String} id element id
	 * @param {bool} isContentArea コンテンツエリアか
	 * @return CallExpression
	 */
	function getElem(id, isContentArea) {
		var elem,
			uid,
			previewArea,
			child,
			srcElem;
		
		if (id === wholeWindowListID) { return null; }
		if (isUnvisibleID(id)) {
			uid = id.split('onlist:').join('');
			if (document.getElementById(uid)) {
				return document.getElementById(uid);
			} else {
				srcElem = document.getElementById(id);
				elem = srcElem.cloneNode();
				elem.id = uid;
				child = srcElem.childNodes[0].cloneNode();
				child.innerHTML = srcElem.childNodes[0].innerHTML;
				elem.appendChild(child);
				
				if (isDisplayTabSelected()) {
					previewArea = document.getElementById('display_preview_area');
				} else {
					previewArea = document.getElementById('content_preview_area');
				}
				if (isContentArea) {
					elem.style.display = "none";
				}

				insertElementWithDictionarySort(previewArea, elem);
				setupContent(elem, uid);
				elem.style.marginTop = "0px";
				
				return elem;
			}
		}
		return document.getElementById(id);
	}
	
	/**
	 * 選択されているContentIDを返却する
	 * @method getSelectedID
	 * @return MemberExpression
	 */
	function getSelectedID() {
		var contentID = document.getElementById('content_id');
		return contentID.innerHTML;
	}
	
	/**
	 * メタデータの位置情報、サイズ情報をString -> Intへ変換する
	 * @method toIntMetaData
	 * @param {JSON} metaData メタデータ
	 * @return metaData
	 */
	function toIntMetaData(metaData) {
		metaData.posx = parseInt(metaData.posx, 10);
		metaData.posy = parseInt(metaData.posy, 10);
		metaData.width = parseInt(metaData.width, 10);
		metaData.height = parseInt(metaData.height, 10);
		return metaData;
	}
	
	/// get image from server
	/**
	 * get image from server
	 * @method update
	 */
	function update() {
		vscreen.clearScreenAll();
		socket.emit('reqGetVirtualDisplay', JSON.stringify({type: "all", id: ""}));
		socket.emit('reqGetContent', JSON.stringify({type: "all", id: ""}));
		socket.emit('reqGetWindow', JSON.stringify({type: "all", id: ""}));
	}
	
	/// delete content
	/**
	 * delete content
	 * @method deleteContent
	 */
	function deleteContent(evt) {
		if (getSelectedID()) {
			socket.emit('reqDeleteContent', JSON.stringify({id : getSelectedID()}));
		}
	}
	
	/**
	 * Displayを削除する
	 * @method deleteDisplay
	 */
	function deleteDisplay() {
		if (getSelectedID()) {
			console.log('reqDeleteWindow' + getSelectedID());
			socket.emit('reqDeleteWindow', JSON.stringify({id : getSelectedID()}));
		}
	}
	
	/**
	 * Displayを全削除する
	 * @method deleteDisplayAll
	 */
	function deleteDisplayAll() {
		socket.emit('reqDeleteWindow', JSON.stringify({type : "all", id : ""}));
	}
	
	/**
	 * Content追加
	 * @method addContent
	 * @param {BLOB} binary
	 */
	function addContent(binary) {
		socket.emit('reqAddContent', binary);
	}
	
	/**
	 * メタデータ(Display, 他コンテンツ)の幾何情報の更新通知を行う。
	 * @method updateTransform
	 * @param {JSON} metaData メタデータ
	 */
	function updateTransform(metaData) {
		//console.log(JSON.stringify(metaData));
		if (metaData.type === windowType) {
			// window
			socket.emit('reqUpdateWindow', JSON.stringify(metaData));
		} else {
			//console.log("reqUpdateTransform");
			socket.emit('reqUpdateTransform', JSON.stringify(metaData));
		}
	}
	
	/**
	 * コンテンツ更新要求送信
	 * @method updateContent
	 * @param {} binary
	 */
	function updateContent(binary) {
		socket.emit('reqUpdateContent', binary);
	}
	
	/**
	 * VirtualDisplay情報更新要求送信
	 * @method updateWindowData
	 */
	function updateWindowData() {
		var windowData,
			whole = vscreen.getWhole(),
			split = vscreen.getSplitCount();
		
		console.log("updateWindowData");
		
		windowData = {
			orgWidth : whole.orgW,
			orgHeight : whole.orgH,
			splitX : split.x,
			splitY : split.y,
			scale : vscreen.getWholeScale()
		};
		if (!windowData.orgWidth || isNaN(windowData.orgWidth)) {
			windowData.orgWidth = initialWholeWidth;
		}
		if (!windowData.orgHeight || isNaN(windowData.orgHeight)) {
			windowData.orgWidth = initialWholeHeight;
		}
		socket.emit('reqUpdateVirtualDisplay', JSON.stringify(windowData));
	}
	
	/**
	 * Propertyタブに入力プロパティを追加する
	 * @method addInputProperty
	 * @param {Object} input element id
	 * @param {String} leftLabel 左ラベル
	 * @param {String} rightLabel 右ラベル
	 * @param {String} value 初期入力値
	 */
	function addInputProperty(id, leftLabel, rightLabel, value) {
		/*
			<div class="input-group">
				<span class="input-group-addon">x</span>
				<input type="text" class="form-control" id="content_transform_x" value="0">
				<span class="input-group-addon">px</span>
			</div>
		*/
		var transInput = document.getElementById('transform_input'),
			group = document.createElement('div'),
			leftSpan = document.createElement('span'),
			rightSpan = document.createElement('span'),
			input = document.createElement('input');
		
		group.className = "input-group";
		leftSpan.className = "input-group-addon";
		leftSpan.innerHTML = leftLabel;
		rightSpan.className = "input-group-addon";
		rightSpan.innerHTML = rightLabel;
		input.className = "form-control";
		input.id = id;
		input.value = value;
		//input.nodeType = "text";
		
		group.appendChild(leftSpan);
		group.appendChild(input);
		if (rightLabel) {
			group.appendChild(rightSpan);
		}
		transInput.appendChild(group);
	}
	
	/**
	 * Propertyタブにボタン追加
	 * @method addButtonProperty
	 * @param {String} id ボタンID
	 * @param {String} value ボタンinnerHTML
	 * @param {Function} func onclick時コールバック
	 */
	function addButtonProperty(id, value, func) {
		/*
			<div class="btn btn-success" id="content_add_button">Add</div>
		*/
		var transInput = document.getElementById('transform_input'),
			group = document.createElement('div'),
			button = document.createElement('div');
		
		group.className = "input-group";
		button.className = "btn btn-primary property_button";
		button.innerHTML = value;
		button.id = id;
		button.onclick = func;
		group.appendChild(button);
		transInput.appendChild(group);
	}
	
	/**
	 * VirtualDisplayスケール設定ボタン追加
	 * @method addScaleDropdown
	 * @param {String} id ID
	 * @param {String} value ボタンinnerHTML
	 */
	function addScaleDropdown(id, value) {
		/*
			<li role="presentation">
				<a role="menuitem" tabindex="-1" href="#" id="scale_dropdown_item1">Display</a>
			</li>
		*/
		var dropDown = document.getElementById('scale_drop_down'),
			current = document.getElementById('scale_dropdown_current'),
			li = document.createElement('li'),
			a = document.createElement('a');
		
		li.role = "presentation";
		a.role = "menuitem";
		a.tabindex = "-1";
		a.href = "#";
		a.id = id;
		a.innerHTML = value;
		/**
		 * Description
		 * @method onclick
		 * @param {} evt
		 */
		a.onclick = function (evt) {
			var displayScale = parseFloat(this.innerHTML);
			if (displayScale < 0) {
				displayScale = 0.01;
			} else if (displayScale > 1.0) {
				displayScale = 1.0;
			}
			vscreen.setWholeScale(displayScale, true);
			saveCookie();
			current.innerHTML = displayScale;
			updateScreen();
		};
		li.appendChild(a);
		dropDown.appendChild(li);
		
		// for ie, safari
		a.addEventListener('mousedown', function (evt) {
			a.click();
			document.getElementById('dropdown2').className = "dropdown2";
		});
	}
	
	/**
	 * VirualDisplay分割設定
	 * @method assignSplitWholes
	 * @param {} splitWholes
	 */
	function assignSplitWholes(splitWholes) {
		var screenElem,
			i,
			w,
			previewArea = document.getElementById('display_preview_area');
			
		console.log("assignSplitWholes");
		
		//console.log(splitWholes);
		for (i in splitWholes) {
			if (splitWholes.hasOwnProperty(i)) {
				w = splitWholes[i];
				console.log(w.id);
				if (!document.getElementById(w.id)) {
					screenElem = document.createElement('div');
					screenElem.style.position = "absolute";
					screenElem.className = "screen";
					screenElem.id = w.id;
					screenElem.style.border = 'solid';
					screenElem.style.borderWidth = '1px';
					screenElem.style.borderColor = "gray";
					screenElem.style.zIndex = -100000;
					vsutil.assignScreenRect(screenElem, vscreen.transformScreen(w));
					previewArea.appendChild(screenElem);
					setupWindow(screenElem, w.id);
				}
			}
		}
	}
	
	/**
	 * VirualDisplay分割数変更
	 * @method changeWholeSplit
	 * @param {String} x x軸分割数
	 * @param {String} y y軸分割数
	 * @param {bool} withoutUpdate 設定後各Displayの更新をするかのフラグ
	 */
	function changeWholeSplit(x, y, withoutUpdate) {
		var ix = parseInt(x, 10),
			iy = parseInt(y, 10),
			splitWholes,
			elem,
			i,
			previewArea = document.getElementById('display_preview_area');
		
		if (isNaN(ix) || isNaN(iy)) {
			return;
		}
		
		for (i = previewArea.childNodes.length - 1; i >= 0; i = i - 1) {
			elem = previewArea.childNodes[i];
			if (elem.hasOwnProperty('id')) {
				if (elem.id.indexOf(wholeSubWindowID) >= 0) {
					previewArea.removeChild(elem);
				}
			}
		}
		vscreen.clearSplitWholes();
		vscreen.splitWhole(ix, iy);
		assignSplitWholes(vscreen.getSplitWholes());
		if (!withoutUpdate) {
			updateWindowData();
		}
	}
	
	/**
	 * Property表示領域初期化。selectされたtypeに応じて作成されるelementが変更される。
	 * @method initPropertyArea
	 * @param {String} id ContentもしくはDisplay ID
	 * @param {String} type 設定タイプ
	 */
	function initPropertyArea(id, type) {
		var contentX,
			contentY,
			contentW,
			contentH,
			contentZ,
			wholeW,
			wholeH,
			wholeSplitX,
			wholeSplitY,
			transInput = document.getElementById('transform_input'),
			idlabel = document.getElementById('content_id_label'),
			idtext = document.getElementById('content_id'),
			downloadButton = document.getElementById('download_button'),
			extension,
			rectChangeFunc = function () {
				changeRect(this.id, parseInt(this.value, 10));
			};
		console.log("initPropertyArea");
		if (id) {
			document.getElementById('content_id').innerHTML = id;
		} else {
			document.getElementById('content_id').innerHTML = "";
		}
		transInput.innerHTML = "";
		if (type === "display") {
			idlabel.innerHTML = "Display ID:";
			addInputProperty('content_transform_x', 'x', 'px', '0');
			addInputProperty('content_transform_y', 'y', 'px', '0');
			addInputProperty('content_transform_w', 'w', 'px', '0');
			addInputProperty('content_transform_h', 'h', 'px', '0');
			contentX = document.getElementById('content_transform_x');
			contentY = document.getElementById('content_transform_y');
			contentW = document.getElementById('content_transform_w');
			contentH = document.getElementById('content_transform_h');
			contentX.onchange = rectChangeFunc;
			contentY.onchange = rectChangeFunc;
			contentW.onchange = rectChangeFunc;
			contentH.onchange = rectChangeFunc;
			downloadButton.style.display = "none";
			
		} else if (type === "whole_window") {
			idlabel.innerHTML = "Virtual Display Setting";
			idtext.innerHTML = "";
			addInputProperty('whole_width', 'w', 'px', '1000');
			addInputProperty('whole_height', 'h', 'px', '900');
			addInputProperty('whole_split_x', 'split x', '', '1');
			addInputProperty('whole_split_y', 'split y', '', '1');
			wholeW = document.getElementById('whole_width');
			wholeH = document.getElementById('whole_height');
			wholeSplitX = document.getElementById('whole_split_x');
			wholeSplitY = document.getElementById('whole_split_y');
			wholeW.onchange = function () {
				changeDisplayValue();
			};
			wholeH.onchange = function () {
				changeDisplayValue();
			};
			wholeSplitX.onchange = function () {
				changeWholeSplit(this.value, wholeSplitY.value);
			};
			wholeSplitY.onchange = function () {
				changeWholeSplit(wholeSplitX.value, this.value);
			};
			downloadButton.style.display = "none";
		} else { // content (text, image, url... )
			idlabel.innerHTML = "Content ID:";
			addInputProperty('content_transform_x', 'x', 'px', '0');
			addInputProperty('content_transform_y', 'y', 'px', '0');
			addInputProperty('content_transform_w', 'w', 'px', '0');
			addInputProperty('content_transform_h', 'h', 'px', '0');
			addInputProperty('content_transform_z', 'z', 'index', '0');
			contentX = document.getElementById('content_transform_x');
			contentY = document.getElementById('content_transform_y');
			contentW = document.getElementById('content_transform_w');
			contentH = document.getElementById('content_transform_h');
			contentZ = document.getElementById('content_transform_z');
			contentX.onchange = rectChangeFunc;
			contentY.onchange = rectChangeFunc;
			contentW.onchange = rectChangeFunc;
			contentH.onchange = rectChangeFunc;
			contentZ.onchange = function () {
				var val = parseInt(contentZ.value, 10);
				changeZIndex(val);
			};
			downloadButton.style.display = "block";
			downloadButton.href = "download?" + id;
			downloadButton.target = "_blank";
			if (type === "text") {
				downloadButton.download = id + ".txt";
			} else {
				// image or url
				if (metaDataDict[id].hasOwnProperty('mime')) {
					extension = metaDataDict[id].mime.split('/')[1];
					downloadButton.download = id + "." + extension;
				} else {
					downloadButton.download = id + ".img";
				}
			}
		}
	}
	
	/**
	 * メタデータをPropertyエリアに反映
	 * @method assignContentProperty
	 * @param {JSON} metaData メタデータ
	 */
	function assignContentProperty(metaData) {
		console.log("assignContentProperty:" + JSON.stringify(metaData));
		var transx = document.getElementById('content_transform_x'),
			transy = document.getElementById('content_transform_y'),
			transw = document.getElementById('content_transform_w'),
			transh = document.getElementById('content_transform_h'),
			transz = document.getElementById('content_transform_z');
		
		transx.value = parseInt(metaData.posx, 10);
		transy.value = parseInt(metaData.posy, 10);
		transw.value = parseInt(metaData.width, 10);
		transh.value = parseInt(metaData.height, 10);
		if (metaData.hasOwnProperty('zIndex')) {
			transz.value = parseInt(metaData.zIndex, 10);
		}
	}

	/**
	 * Propertyエリアパラメータ消去
	 * @method clearProperty
	 */
	function clearProperty() {
		var transx = document.getElementById('content_transform_x'),
			transy = document.getElementById('content_transform_y'),
			transw = document.getElementById('content_transform_w'),
			transh = document.getElementById('content_transform_h'),
			transz = document.getElementById('content_transform_z'),
			dlbtn  = document.getElementById('download_button'),
			content_id = document.getElementById('content_id');
		if (transx) { transx.value = 0; }
		if (transy) { transy.value = 0; }
		if (transw) { transw.value = 0; }
		if (transh) { transh.value = 0; }
		if (transz) { transz.value = 0; }
		if (content_id) { content_id.innerHTML = ""; }
		if (dlbtn)  { dlbtn.style.display = 'none'; }
	}
	
	/**
	 * 選択されているVirtualDisplayをPropertyエリアのパラメータに設定
	 * @method assignVirtualDisplayProperty
	 */
	function assignVirtualDisplayProperty() {
		var whole = vscreen.getWhole(),
			splitCount = vscreen.getSplitCount(),
			wholeWidth = document.getElementById('whole_width'),
			wholeHeight = document.getElementById('whole_height'),
			wholeSplitX = document.getElementById('whole_split_x'),
			wholeSplitY = document.getElementById('whole_split_y');

		if (wholeWidth) {
			wholeWidth.value = parseInt(whole.orgW, 10);
		}
		if (wholeHeight) {
			wholeHeight.value = parseInt(whole.orgH, 10);
		}
		if (wholeSplitX) {
			wholeSplitX.value = splitCount.x;
		}
		if (wholeSplitY) {
			wholeSplitY.value = splitCount.y;
		}
	}
	
	/**
	 * Viewスケール設定
	 * @method assignViewSetting
	 */
	function assignViewSetting() {
		var scale = vscreen.getWholeScale(),
			scale_current = document.getElementById('scale_dropdown_current'),
			snap_current = document.getElementById('snap_dropdown_current');
		
		scale_current.innerHTML = scale;
		if (isFreeMode()) {
			snap_current.innerHTML = 'Free';
		} else if (isDisplayMode()) {
			snap_current.innerHTML = 'Display';
		} else {
			// grid
			snap_current.innerHTML = 'Grid';
		}
		
		manipulator.removeManipulator();
	}
	
	/**
	 * コンテンツの四隅マニピュレーター移動。マウスmove時にコールされる
	 * @method onManipulatorMove
	 * @param {Object} evt マウスイベント
	 */
	function onManipulatorMove(evt) {
		var px, py,
			lastx, lasty,
			lastw, lasth,
			currentw,
			currenth,
			ydiff,
			elem,
			metaData,
			draggingManip = manipulator.getDraggingManip(),
			invAspect;
		
		if (draggingManip && lastDraggingID) {
			elem = document.getElementById(lastDraggingID);
			metaData = metaDataDict[lastDraggingID];
			if (metaData.type !== windowType && !isVisible(metaData)) {
				return;
			}
			vsutil.trans(metaData);
			lastx = metaData.posx;
			lasty = metaData.posy;
			lastw = metaData.width;
			lasth = metaData.height;
			invAspect = metaData.orgHeight / metaData.orgWidth;
			
			if (draggingManip.id === '_manip_0' || draggingManip.id === '_manip_1') {
				px = evt.clientX - dragOffsetLeft;
				py = evt.clientY - dragOffsetTop;
				currentw = lastw - (px - lastx);
			} else {
				px = evt.clientX - lastw - dragOffsetLeft;
				py = evt.clientY - dragOffsetTop;
				currentw = lastw + (px - lastx);
			}
			if (isNaN(invAspect)) {
				invAspect = lasth / lastw;
				console.log("aspect NaN" + invAspect);
			}
			
			if (currentw < 20) {
				currentw = 20;
			}
			currenth = currentw * invAspect;
			ydiff = currentw * invAspect - lasth;
			
			metaData.width = currentw;
			metaData.height = currentw * invAspect;
			if (draggingManip.id === '_manip_0') {
				metaData.posx = px;
				metaData.posy = (lasty - ydiff);
			} else if (draggingManip.id === '_manip_1') {
				metaData.posx = px;
			} else if (draggingManip.id === '_manip_3') {
				metaData.posy = (lasty - ydiff);
			}
			vsutil.transInv(metaData);
			vsutil.assignMetaData(elem, metaData, true);
			console.log("lastDraggingID:" + lastDraggingID);
			metaDataDict[lastDraggingID] = metaData;
			updateTransform(metaData);
		}
	}
	
	/**
	 * Deleteボタン有効化設定
	 * @method enableDeleteButton
	 * @param {bool} isEnable ボタン有効化
	 */
	function enableDeleteButton(isEnable) {
		if (isEnable) {
			document.getElementById('content_delete_button').className = "btn btn-danger";
		} else {
			document.getElementById('content_delete_button').className = "btn btn-danger disabled";
		}
	}
	
	/**
	 * DisplayDeleteボタン有効化設定
	 * @method enableDisplayDeleteButton
	 * @param {bool} isEnable ボタン有効化
	 */
	function enableDisplayDeleteButton(isEnable) {
		if (isEnable) {
			document.getElementById('display_delete_button').className = "btn btn-primary";
		} else {
			document.getElementById('display_delete_button').className = "btn btn-primary disabled";
		}
	}
	
	/**
	 * 画像更新ボタン有効化
	 * @method enableUpdateImageButton
	 * @param {bool} isEnable ボタン有効化
	 */
	function enableUpdateImageButton(isEnable) {
		if (isEnable) {
			document.getElementById('update_image_input').disabled = false;
		} else {
			document.getElementById('update_image_input').disabled = true;
		}
	}
	
	/// select content or window
	/**
	 * Content or Display選択。
	 * @method select
	 * @param {String} id 選択したID
	 */
	function select(id, isContentArea) {
		var elem,
			metaData,
			initialVisible;
		
		if (id === wholeWindowListID || id === wholeWindowID) {
			initPropertyArea(id, "whole_window");
			assignVirtualDisplayProperty();
			document.getElementById(wholeWindowListID).style.borderColor = windowSelectColor;
			changeLeftTab(windowType);
			return;
		}
		if (id.indexOf(wholeSubWindowID) >= 0) {
			return;
		}
		document.getElementById(wholeWindowListID).style.borderColor = "white";
		elem = getElem(id, isContentArea);
		if (elem.id !== id) {
			id = elem.id;
		}
		//elem.style.visibility = "visible";
		metaData = metaDataDict[id];
		console.log("metaData", metaData);
		initialVisible = metaData.visible;
		draggingID = id;
		console.log("draggingID = id:" + draggingID);
		elem.style.border = "solid 2px";
		if (metaData.type === windowType) {
			initPropertyArea(id, "display");
			assignContentProperty(metaDataDict[id]);
			enableDeleteButton(false);
			enableDisplayDeleteButton(true);
			enableUpdateImageButton(false);
			changeLeftTab(windowType);
			if (document.getElementById("onlist:" + id)) {
				document.getElementById("onlist:" + id).style.borderColor = windowSelectColor;
			}
			elem.style.borderColor = windowSelectColor;
			manipulator.showManipulator(elem, document.getElementById('display_preview_area'));
		} else {
			initPropertyArea(id, metaData.type);
			assignContentProperty(metaDataDict[id]);
			enableDeleteButton(true);
			enableUpdateImageButton(true);
			enableDisplayDeleteButton(false);
			document.getElementById('update_content_id').innerHTML = id;
			changeLeftTab(metaData.type);
			if (document.getElementById("onlist:" + id)) {
				document.getElementById("onlist:" + id).style.borderColor = contentSelectColor;
			}
			elem.style.borderColor = contentSelectColor;
			manipulator.showManipulator(elem, document.getElementById('content_preview_area'));
		}
		if (elem.style.zIndex === "") {
			elem.style.zIndex = 0;
		}
		if (initialVisible === "true" || initialVisible === true) {
			manipulator.moveManipulator(elem);
		} else {
			manipulator.removeManipulator();
		}
	}
	
	/// unselect content or window
	/**
	 * 現在選択されているContents, もしくはVirtualDisplayを非選択状態にする
	 * @method unselect
	 */
	function unselect() {
		var elem,
			metaData;
		
		if (lastDraggingID) {
			elem = document.getElementById(lastDraggingID);
			if (elem) {
				metaData = metaDataDict[lastDraggingID];
				if (metaData.type !== windowType && isVisible(metaData)) {
					elem.style.border = "";
				}
				if (document.getElementById("onlist:" + lastDraggingID)) {
					document.getElementById("onlist:" + lastDraggingID).style.borderColor = "white";
				}
				elem.style.borderColor = "black";
			}
			lastDraggingID = null;
		}
		manipulator.removeManipulator();
		clearProperty();
	}
	
	/// close selected content or window
	/**
	 * クローズボタンハンドル。選択されているcontent or windowを削除する。
	 * その後クローズされた結果をupdateTransformにて各Windowに通知する。
	 * @method closeFunc
	 */
	function closeFunc() {
		var id = getSelectedID(),
			metaData = null,
			elem,
			previewArea;
		
		console.log("closeFunc");
		if (metaDataDict.hasOwnProperty(id)) {
			unselect();
			elem = getElem(id, false);
			
			metaData = metaDataDict[id];
			metaData.visible = false;
			
			if (metaData.type === "window") {
				previewArea = document.getElementById('display_preview_area');
			} else {
				previewArea = document.getElementById('content_preview_area');
			}
			previewArea.removeChild(elem);
			
			updateTransform(metaData);
		}
	}
	
	/**
	 * PropertyエリアのコンテンツIDからElementを取得する
	 * @method getSelectedElem
	 * @return Literal
	 */
	function getSelectedElem() {
		var targetID = document.getElementById('content_id').innerHTML;
		if (targetID) {
			return document.getElementById(targetID);
		}
		return null;
	}
	
	/// change zIndex
	/**
	 * 選択中のコンテンツのzIndexを変更する
	 * @method changeZIndex
	 * @param {String} index 設定するzIndex
	 */
	function changeZIndex(index) {
		var elem = getSelectedElem(),
			metaData;
		if (elem) {
			metaData = metaDataDict[elem.id];
			elem.style.zIndex = index;
			metaData.zIndex = index;
			updateTransform(metaData);
			console.log("change zindex:" + index);
		}
	}
	
	/// change rect
	/**
	 * Content or Displayの矩形サイズ変更時ハンドラ。initPropertyAreaのコールバックとして指定されている。
	 * @method changeRect
	 * @param {String} id Content or Display ID
	 * @param {String } value 変更値
	 */
	function changeRect(id, value) {
		var elem = getSelectedElem(),
			metaData,
			aspect = 1.0;
		if (elem) {
			metaData = metaDataDict[elem.id];
			if (metaData) {
				if (metaData.orgHeight) {
					aspect = metaData.orgHeight / metaData.orgWidth;
				} else {
					aspect = elem.naturalHeight / elem.naturalWidth;
				}
				if (id === 'content_transform_x') {
					metaData.posx = value;
					updateTransform(metaData);
				} else if (id === 'content_transform_y') {
					metaData.posy = value;
					updateTransform(metaData);
				} else if (id === 'content_transform_w' && value > 10) {
					metaData.width = value;
					metaData.height = value * aspect;
					document.getElementById('content_transform_h').value = metaData.height;
					updateTransform(metaData);
				} else if (id === 'content_transform_h' && value > 10) {
					metaData.width = value / aspect;
					metaData.height = value;
					document.getElementById('content_transform_w').value = metaData.width;
					updateTransform(metaData);
				}
			}
			manipulator.removeManipulator();
		}
	}

	/**
	 * 指定された座標がContent or Displayの内部に存在するかを判定する。setupContentsにて使用されている。
	 * @method changeRect
	 * @param {String} id Content or Display ID
	 * @param {String} x x座標値
	 * @param {String} y y座標値
	 */
	function isInsideElement(elem, x, y) {
		var posx = parseInt(elem.style.left.split("px").join(''), 10),
			posy = parseInt(elem.style.top.split("px").join(''), 10),
			width = parseInt(elem.style.width.split("px").join(''), 10),
			height = parseInt(elem.style.height.split("px").join(''), 10);
		
		if (metaDataDict.hasOwnProperty(elem.id)) {
			return (posx <= x && posy <= y &&
					(posx + width) > x &&
					(posy + height) > y);
		}
		return false;
	}

	/**
	 * Content設定
	 * @method setupContent
	 * @param {Object} elem 設定対象Object
	 * @param {String} id ContentID
	 */
	function setupContent(elem, id) {
		elem.onmousedown = function (evt) {
			var rect = evt.target.getBoundingClientRect(),
				metaData = null,
				otherPreviewArea = document.getElementById('content_preview_area'),
				childs,
				i,
				topElement = null,
				e;
			
			if (metaDataDict.hasOwnProperty(id)) {
				metaData = metaDataDict[id];
				if (metaData.type !== windowType) {
					otherPreviewArea = document.getElementById('display_preview_area');
				}
			}

			
			if (id === wholeWindowID ||
				(metaData && !isDisplayTabSelected() && metaData.type === windowType) ||
				(metaData && isDisplayTabSelected() && metaData.type !== windowType)) {
				console.log(metaData);
				childs = otherPreviewArea.childNodes;

				for (i = 0; i < childs.length; i = i + 1) {
					if (childs[i].onmousedown) {
						if (!topElement || topElement.zIndex < childs[i].zIndex) {
							if (isInsideElement(childs[i], evt.clientX, evt.clientY)) {
								topElement = childs[i];
							}
						}
					}
				}
				if (topElement) {
					//console.log("left", elem.offsetLeft - topElement.offsetLeft);
					//console.log("top", elem.offsetTop - topElement.offsetTop);
					topElement.onmousedown(evt);
					dragOffsetTop = evt.clientY - topElement.getBoundingClientRect().top;
					dragOffsetLeft = evt.clientX - topElement.getBoundingClientRect().left;
				}
				return;
			}
			
			// erase last border
			unselect();
			select(id, isContentArea(evt));
			
			evt = (evt) || window.event;
			dragOffsetTop = evt.clientY - rect.top;
			dragOffsetLeft = evt.clientX - rect.left;
			//dragOffsetTop = evt.clientY - elem.offsetTop;
			//dragOffsetLeft = evt.clientX - elem.offsetLeft;
			evt.stopPropagation();
			evt.preventDefault();
		};
	}
	
	///  setup window
	/**
	 * Display設定
	 * @method setupWindow
	 * @param {Object} elem 設定対象Element
	 * @param {String} id ContentID
	*/
	function setupWindow(elem, id) {
		setupContent(elem, id);
	}
	
	/**
	 * Content or Displayのスナップ処理
	 * @method snapToSplitWhole
	 * @param {Object} elem スナップ対象Object
	 * @param {JSON} metaData メタデータ
	 * @param {Object} splitWhole スナップ先Object
	 */
	function snapToSplitWhole(elem, metaData, splitWhole) {
		var orgWidth = parseFloat(metaData.orgWidth),
			orgHeight = parseFloat(metaData.orgHeight),
			vaspect = splitWhole.w / splitWhole.h,
			aspect = orgWidth / orgHeight;
		
		metaData.posx = splitWhole.x;
		metaData.posy = splitWhole.y;
		if (aspect > vaspect) {
			// content is wider than split area
			metaData.width = splitWhole.w;
			metaData.height = splitWhole.w / aspect;
			//console.log("a", metaData, aspect);
		} else {
			// content is highter than split area
			metaData.height = splitWhole.h;
			metaData.width = splitWhole.h * aspect;
			//console.log("b", metaData, aspect);
		}
		manipulator.moveManipulator(elem);
	}
	
	function snapToScreen(elem, metaData, screen) {
		return snapToSplitWhole(elem, metaData, screen);
	}
	
	/**
	 * Snapハイライト解除
	 * @method clearSnapHightlight
	 */
	function clearSnapHightlight() {
		var splitWholes,
			i,
			screens;
		splitWholes = vscreen.getSplitWholes();
		//console.log("splitWholes", splitWholes);
		for (i in splitWholes) {
			if (splitWholes.hasOwnProperty(i)) {
				document.getElementById(splitWholes[i].id).style.background = "transparent";
			}
		}
		
		screens = vscreen.getScreenAll();
		for (i in screens) {
			if (screens.hasOwnProperty(i)) {
				document.getElementById(screens[i].id).style.background = "transparent";
			}
		}
	}
	
	// add content mousedown event
	/*
	window.document.addEventListener("mousedown", function (evt) {
		// erase last border
		if (lastDraggingID && !manipulator.getDraggingManip()) {
			console.log("UNSELECT");
			//unselect();
		}
	});
	*/
	
	// add content mousemove event
	window.document.addEventListener("mousemove", function (evt) {
		var i,
			metaData,
			metaTemp,
			elem,
			pos,
			px,
			py,
			elemOnPos,
			onInvisibleContent,
			leftArea = document.getElementById('leftArea'),
			rect = evt.target.getBoundingClientRect(),
			orgPos,
			splitWhole,
			screen;
		
		evt = (evt) || window.event;
		
		if (draggingID) {
			// detect content list area
			if (isContentArea(evt)) {
				elem = document.getElementById(draggingID);
				return;
			}

			// clear splitwhole colors
			clearSnapHightlight();
			
			// detect spilt screen area
			if (isGridMode()) {
				px = rect.left + dragOffsetLeft;
				py = rect.top + dragOffsetTop;
				orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
				splitWhole = vscreen.getSplitWholeByPos(orgPos.x, orgPos.y);
				console.log("px py whole", px, py, splitWhole);
				if (splitWhole) {
					document.getElementById(splitWhole.id).style.background = "red";
				}
			}
			
			if (isDisplayMode()) {
				px = rect.left + dragOffsetLeft;
				py = rect.top + dragOffsetTop;
				orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
				screen = vscreen.getScreeByPos(orgPos.x, orgPos.y, draggingID);
				console.log("px py whole", px, py, screen);
				if (screen) {
					document.getElementById(screen.id).style.background = "red";
				}
			}

			// translate
			elem = document.getElementById(draggingID);
			if (elem.style.display === "none") {
				elem.style.display = "block";
			}
			metaData = metaDataDict[draggingID];
			
			metaData.posx = evt.clientX - dragOffsetLeft;
			metaData.posy = evt.clientY - dragOffsetTop;
			vsutil.transPosInv(metaData);
			vsutil.assignMetaData(elem, metaData, true);
			
			if (metaData.type === windowType || isVisible(metaData)) {
				manipulator.moveManipulator(elem);
				updateTransform(metaData);
			}
			evt.stopPropagation();
			evt.preventDefault();
		} else if (lastDraggingID && manipulator.getDraggingManip()) {
			console.log("iscontentarea");
			// scaling
			elem = document.getElementById(lastDraggingID);
			metaData = metaDataDict[lastDraggingID];
			if (metaData.type === windowType || isVisible(metaData)) {
				onManipulatorMove(evt);
				manipulator.moveManipulator(elem);
			}
			evt.stopPropagation();
			evt.preventDefault();
		}
	});
	
	// add content mouseup event
	window.document.addEventListener("mouseup", function (evt) {
		var contentArea = document.getElementById('content_area'),
			metaData,
			elem,
			px,
			py,
			rect = evt.target.getBoundingClientRect(),
			orgPos,
			splitWhole,
			screen;
		if (draggingID && metaDataDict.hasOwnProperty(draggingID)) {
			elem = document.getElementById(draggingID);
			metaData = metaDataDict[draggingID];
			if (!isContentArea(evt)) {
				console.log("not onContentArea");
				metaData.visible = true;
				elem.style.color = "black";
				if (isFreeMode()) {
					vsutil.assignMetaData(elem, metaData, true);
					updateTransform(metaData);
				} else if (isDisplayMode()) {
					px = rect.left + dragOffsetLeft;
					py = rect.top + dragOffsetTop;
					orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
					screen = vscreen.getScreeByPos(orgPos.x, orgPos.y, draggingID);
					if (screen) {
						snapToScreen(elem, metaData, screen);
					}
					vsutil.assignMetaData(elem, metaData, true);
					updateTransform(metaData);
					manipulator.moveManipulator(elem);
				} else {
					// grid mode
					px = rect.left + dragOffsetLeft;
					py = rect.top + dragOffsetTop;
					orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
					splitWhole = vscreen.getSplitWholeByPos(orgPos.x, orgPos.y);
					//console.log(splitWhole);
					if (splitWhole) {
						snapToSplitWhole(elem, metaData, splitWhole);
					}
					vsutil.assignMetaData(elem, metaData, true);
					updateTransform(metaData);
					manipulator.moveManipulator(elem);
				}
			}
			clearSnapHightlight();
		}
		if (manipulator.getDraggingManip() && lastDraggingID) {
			metaData = metaDataDict[lastDraggingID];
			//updateTransform(metaData);
		} else {
			lastDraggingID = draggingID;
			draggingID = null;
		}
		manipulator.clearDraggingManip();
		dragOffsetTop = 0;
		dragOffsetLeft = 0;
	});
	
	/// send text to server
	/**
	 * テキストデータ送信
	 * @method sendText
	 * @param {String} text
	 */
	function sendText(text) {
		var previewArea = document.getElementById('content_preview_area'),
			textInput = document.getElementById('text_input'),
			elem = document.createElement('pre'),
			width = (textInput.clientWidth + 1),
			height = (textInput.clientHeight + 1),
			textData = "",
			binary = null;
		
		if (text) {
			textData = text;
		} else {
			textData = textInput.value;
			textInput.value = "";
		}
		elem.style.position = "absolute";
		elem.style.top = "0px";
		elem.style.left = "0px";
		elem.innerHTML = textData;
		previewArea.appendChild(elem);
		
		// calculate width, height
		width = elem.offsetWidth / vscreen.getWholeScale();
		height = elem.offsetHeight / vscreen.getWholeScale();
		/*
		if (width > vscreen.getWhole().orgW) {
			width = vscreen.getWhole().orgW;
			elem.style.overflow = "auto";
		}
		if (height > vscreen.getWhole().orgH) {
			height = vscreen.getWhole().orgH;
			elem.style.overflow = "auto";
		}
		*/
		previewArea.removeChild(elem);
		binary = metabinary.createMetaBinary({type : "text", posx : 0, posy : 0, width : width, height : height}, textData);

		currentContent = elem;
		addContent(binary);
	}
	
	/// send url to server
	/**
	 * URLデータ送信
	 * @method sendURL
	 */
	function sendURL() {
		console.log("sendurl");
		var previewArea = document.getElementById('content_preview_area'),
			urlInput = document.getElementById('url_input'),
			img = document.createElement('img'),
			binary;

		console.log(urlInput.value);
		urlInput.value = urlInput.value.split(' ').join('');
		if (urlInput.value.indexOf("http") < 0) {
			return;
		}
		
		binary = metabinary.createMetaBinary({type : "url"}, urlInput.value);
		addContent(binary);
		urlInput.value = '';
	}
	
	/// send image to server
	/**
	 * 画像データ送信
	 * @method sendImage
	 * @param {BLOB} imagebinary
	 * @param {String} width
	 * @param {String} height
	 */
	function sendImage(imagebinary, width, height) {
		var metaData = {type : "image", posx : 0, posy : 0, width : width, height: height},
			binary = metabinary.createMetaBinary(metaData, imagebinary);
		console.log("sendImage");
		addContent(binary);
	}
	
	/// open image file
	/**
	 * 画像ファイルFileOpenハンドラ
	 * @method openImage
	 * @param {Object} evt FileOpenイベント
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
	
	/// open text file
	/**
	 * テキストファイルFileOpenハンドラ
	 * @method openText
	 * @param {Object} evt FileOpenイベント
	 */
	function openText(evt) {
		var files = evt.target.files,
			file,
			i,
			fileReader = new FileReader();
		
		console.log("openText");
		fileReader.onloadend = function (e) {
			var data = e.target.result;
			//console.log(data);
			sendText(data);
		};
		for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('text.*')) {
				fileReader.readAsText(file);
			}
		}
	}
	
	/// replace image file
	/**
	 * 画像イメージ差し替えFileOpenハンドラ
	 * @method replaceImage
	 * @param {Object} evt FileOpenイベント
	 */
	function replaceImage(evt) {
		var files = evt.target.files,
			file,
			i,
			fileReader = new FileReader(),
			binary,
			id = document.getElementById('update_content_id').innerHTML,
			previewArea = document.getElementById('content_preview_area'),
			elem;

		fileReader.onloadend = function (e) {
			if (e.target.result) {
				console.log("update_content_id", id);
				binary = metabinary.createMetaBinary({type : "image", id : id}, e.target.result);
				
				elem = document.getElementById(id);
				if (elem) {
					previewArea.removeChild(elem);
				}
				
				updateContent(binary);
				
			}
		};
		for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('image.*')) {
				fileReader.readAsArrayBuffer(file);
			}
		}
	}
	
	/// add all screens
	/**
	 * VirualDisplayをVirtualScreenに設定
	 * @method addScreenRect
	 * @param {JSON} windowData ウィンドウデータ
	 */
	function addScreenRect(windowData) {
		var whole = vscreen.getWhole(),
			screens = vscreen.getScreenAll(),
			split_wholes = vscreen.getSplitWholes(),
			s,
			wholeElem,
			previewArea = document.getElementById('display_preview_area'),
			screenElem;
		
		if (windowData) {
			screenElem = document.getElementById(windowData.id);
			if (screenElem) {
				vsutil.assignScreenRect(screenElem, vscreen.transformScreen(screens[windowData.id]));
				return;
			}
		}

		wholeElem = document.getElementById(wholeWindowID);
		if (!wholeElem) {
			wholeElem = document.createElement('span');
		}
		console.log("screens:" + JSON.stringify(vscreen));
		wholeElem.style.border = 'solid';
		wholeElem.style.zIndex = -1000;
		wholeElem.className = "screen";
		wholeElem.id = wholeWindowID;
		wholeElem.style.color = "black";
		setupWindow(wholeElem, wholeElem.id);
		vsutil.assignScreenRect(wholeElem, whole);
		previewArea.appendChild(wholeElem);
		for (s in screens) {
			if (screens.hasOwnProperty(s)) {
				screenElem = document.getElementById(s);
				if (!screenElem) {
					screenElem = document.createElement('div');
				}
				screenElem.className = "screen";
				screenElem.style.zIndex = -100;
				screenElem.style.display = "block";
				screenElem.id = s;
				console.log("screenElemID:" + JSON.stringify(screens[s]));
				screenElem.style.border = 'solid';
				vsutil.assignScreenRect(screenElem, vscreen.transformScreen(screens[s]));
				previewArea.appendChild(screenElem);
				setupWindow(screenElem, s);
			}
		}
		assignSplitWholes(vscreen.getSplitWholes());
	}
	
	/// update all screens
	/**
	 * VirtualScreen更新
	 * @method updateScreen
	 * @param {JSON} windowData ウィンドウデータ
	 */
	function updateScreen(windowData) {
		var whole = vscreen.getWhole(),
			splitCount = vscreen.getSplitCount(),
			previewArea = document.getElementById('display_preview_area'),
			screens = previewArea.getElementsByClassName('screen'),
			scale = vscreen.getWholeScale(),
			i,
			metaData,
			elem;
		
		console.log("updateScreen", windowData);
		if (windowData) {
			elem = document.getElementById(windowData.id);
			if (elem) {
				console.log("assignScreenRect");
				vsutil.assignMetaData(elem, windowData, true);
				elem.style.display = "block";
				return;
			}
		} else {
			// recreate all screens
			assignVirtualDisplayProperty();
			assignViewSetting();
			for (i = screens.length - 1; i >= 0; i = i - 1) {
				previewArea.removeChild(screens.item(i));
			}
			for (i in metaDataDict) {
				if (metaDataDict.hasOwnProperty(i)) {
					metaData = metaDataDict[i];
					if (isVisible(metaData)) {
						if (metaData.type !== windowType) {
							elem = document.getElementById(metaData.id);
							if (elem) {
								vsutil.assignMetaData(elem, metaData, true);
							}
						}
					}
				}
			}
		}
		addScreenRect(windowData);
		//changeWholeSplit(wholeSplitX.value, this.value);
	}
	
	/**
	 * PropertyのDisplayパラメータ更新ハンドル
	 * @method changeDisplayValue
	 */
	function changeDisplayValue() {
		var whole = vscreen.getWhole(),
			wholeWidth = document.getElementById('whole_width'),
			wholeHeight = document.getElementById('whole_height'),
			wholeSplitX = document.getElementById('whole_split_x'),
			wholeSplitY = document.getElementById('whole_split_y'),
			scale_current = document.getElementById('scale_dropdown_current'),
			w,
			h,
			s = parseFloat(scale_current.innerHTML),
			ix = parseInt(wholeSplitX.value, 10),
			iy = parseInt(wholeSplitY.value, 10),
			cx = window.innerWidth / 2,
			cy = window.innerHeight / 2;

		if (!wholeWidth || !whole.hasOwnProperty('w')) {
			w = initialWholeWidth;
		} else {
			w = parseInt(wholeWidth.value, 10);
			if (w <= 1) {
				wholeWidth.value = 100;
				w = 100;
			}
		}
		if (!wholeHeight || !whole.hasOwnProperty('h')) {
			h = initialWholeHeight;
		} else {
			h = parseInt(wholeHeight.value, 10);
			if (h <= 1) {
				wholeHeight.value = 100;
				h = 100;
			}
		}
		
		if (s <= 0) {
			s = 0.1;
			scale_current.innerHTML = 0.1;
		}
		console.log("changeDisplayValue", w, h, s);
		if (w && h && s) {
			vscreen.assignWhole(w, h, cx, cy, s);
		}
		if (ix && iy) {
			vscreen.splitWhole(ix, iy);
		}
		updateWindowData();
		updateScreen();
		changeWholeSplit(ix, iy, true);
	}
	
	/**
	 * 受領したメタデータからプレビューツリーにコンテンツを反映する。
	 * doneGetContent時にコールされる。
	 * @method importContentToView
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	function importContentToView(metaData, contentData) {
		var previewArea = document.getElementById('content_preview_area'),
			elem,
			tagName,
			blob,
			mime = "image/jpeg";

		if (isVisible(metaData)) {
			metaDataDict[metaData.id] = metaData;
			console.log("importContentToView:" + JSON.stringify(metaData));

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
				
				insertElementWithDictionarySort(previewArea, elem);
				//previewArea.appendChild(elem);
			}
			
			console.log("id=" + metaData.id);
			if (metaData.type === 'text') {
				// contentData is text
				elem.innerHTML = contentData;
				elem.style.overflow = "visible"; // Show all text
				vsutil.assignMetaData(elem, metaData, true);
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
						vsutil.assignMetaData(elem, metaData, true);
					};
				}
			}
		}
	}
	
	/**
	 * 受領したメタデータから左側コンテンツエリアに反映する。
	 * doneGetContent時にコールされる。
	 * @method importContentToList
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	function importContentToList(metaData, contentData) {
		var hasVisible = metaData.hasOwnProperty('visible'),
			contentArea = document.getElementById('content_area'),
			contentElem,
			divElem,
			tagName,
			classname,
			blob,
			mime = "image/jpeg",
			onlistID = "onlist:" + metaData.id;
		
		metaDataDict[metaData.id] = metaData;
		if (metaData.type === 'text') {
			tagName = 'pre';
			classname = 'textcontent';
		} else {
			tagName = 'img';
			classname = 'imagecontent';
		}
		if (document.getElementById(onlistID)) {
			divElem = document.getElementById(onlistID);
			contentElem = divElem.childNodes[0];
			//console.log("found " + json.type);
		} else {
			contentElem = document.createElement(tagName);
			
			divElem = document.createElement('div');
			divElem.id = onlistID;
			setupContent(divElem, onlistID);
			divElem.appendChild(contentElem);
			contentArea.appendChild(divElem);
		}
		contentElem.classList.add(classname);

		//console.log("id=" + metaData.id);
		if (metaData.type === 'text') {
			// contentData is text
			contentElem.innerHTML = contentData;
			divElem.style.width = "200px";
			divElem.style.height = "50px";
		} else {
			// contentData is blob
			if (metaData.hasOwnProperty('mime')) {
				mime = metaData.mime;
				//console.log("mime:" + mime);
			}
			divElem.style.width = "200px";
			blob = new Blob([contentData], {type: mime});
			if (contentElem && blob) {
				contentElem.src = URL.createObjectURL(blob);

				contentElem.onload = function () {
					var aspect;
					if (contentElem.offsetHeight > 200) {
						aspect = contentElem.offsetWidth / contentElem.offsetHeight;
						divElem.style.height = "100px";
						divElem.style.width = 100 * aspect;
					}
				};
			}
		}
		contentElem.style.width = "100%";
		contentElem.style.height = "100%";
		divElem.style.position = "relative";
		divElem.style.top = "5px";
		divElem.style.left = "20px";
		divElem.style.border = "solid";
		divElem.style.borderColor = "white";
		divElem.style.marginTop = "5px";
		divElem.style.color = "white";
	}
	
	/// import content
	/**
	 * メタデータからコンテンツをインポートする
	 * @method importContent
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	function importContent(metaData, contentData) {
		importContentToList(metaData, contentData);
		importContentToView(metaData, contentData);
	}
	
	/**
	 * Displayを左リストビューにインポートする。
	 * @method importWindowToView
	 * @param {JSON} windowData ウィンドウデータ
	 */
	function importWindowToView(windowData) {
		var displayArea,
			screen;
		if (windowData.type !== windowType) {
			return;
		}
		if (windowData.hasOwnProperty('posx')) {
			windowData.posx = parseInt(windowData.posx, 10);
		} else {
			windowData.posx = 0;
		}
		if (windowData.hasOwnProperty('posy')) {
			windowData.posy = parseInt(windowData.posy, 10);
		} else {
			windowData.posy = 0;
		}
		metaDataDict[windowData.id] = windowData;
		if (isVisible(windowData)) {
			console.log("import window:" + JSON.stringify(windowData));
			vscreen.assignScreen(windowData.id, windowData.orgX, windowData.orgY, windowData.orgWidth, windowData.orgHeight);
			vscreen.setScreenSize(windowData.id, windowData.width, windowData.height);
			vscreen.setScreenPos(windowData.id, windowData.posx, windowData.posy);
			//console.log("import windowsc:", vscreen.getScreen(windowData.id));
			updateScreen(windowData);
		} else {
			displayArea = document.getElementById("display_preview_area");
			screen = document.getElementById(windowData.id);
			if (displayArea && screen) {
				screen.style.display = "none";
			}
		}
	}
	
	/**
	 * Displayを左リストビューにインポートする。
	 * @method importWindowToList
	 * @param {JSON} windowData ウィンドウデータ
	 */
	function importWindowToList(windowData) {
		var displayArea = document.getElementById('display_area'),
			divElem,
			onlistID = "onlist:" + windowData.id;
		
		divElem = document.getElementById(onlistID);
		if (divElem) { return; }
		
		console.log("importWindowToList");
		
		divElem = document.createElement("div");
		divElem.innerHTML = "ID:" + windowData.id;
		divElem.id = onlistID;
		divElem.className = "screen";
		divElem.style.position = "relative";
		divElem.style.top = "5px";
		divElem.style.left = "20px";
		divElem.style.width = "200px";
		divElem.style.height = "50px";
		divElem.style.border = "solid";
		divElem.style.borderColor = "white";
		divElem.style.marginTop = "5px";
		divElem.style.color = "white";
		setupContent(divElem, onlistID);
		displayArea.appendChild(divElem);
	}
	
	/**
	 * 全Windowをリストビューに追加する
	 * @method addWholeWindowToList
	 */
	function addWholeWindowToList() {
		var displayArea = document.getElementById('display_area'),
			divElem = document.createElement("div"),
			onlistID = "onlist:" + "whole_window";
		
		divElem.innerHTML = "Virtual Display";
		divElem.id = onlistID;
		divElem.style.position = "relative";
		divElem.style.top = "5px";
		divElem.style.left = "20px";
		divElem.style.width = "200px";
		divElem.style.height = "50px";
		divElem.style.border = "solid";
		divElem.style.borderColor = "white";
		divElem.style.marginTop = "5px";
		divElem.style.color = "white";
		divElem.classList.add("screen");
		setupContent(divElem, onlistID);
		displayArea.appendChild(divElem);
	}
	
	/**
	 * リストビュー領域をクリアする
	 * @method clearWindowList
	 */
	function clearWindowList() {
		var displayArea = document.getElementById('display_area');
		displayArea.innerHTML = "";
	}
	
	/// import window
	/**
	 * 指定されたWindowをリストビューにインポートする
	 * @method importWindow
	 * @param {JSON} windowData ウィンドウデータ
	 */
	function importWindow(windowData) {
		importWindowToView(windowData);
		importWindowToList(windowData);
	}
	
	/**
	 * コンテンツ追加ポップアップの初期化
	 * @method initAddContentArea
	 * @param {Function} bottomfunc
	 */
	function initAddContentArea(bottomfunc) {
		var textSendButton = document.getElementById('text_send_button'),
			urlSendButton = document.getElementById('url_send_button'),
			imageFileInput = document.getElementById('image_file_input'),
			textFileInput = document.getElementById('text_file_input'),
			updateImageInput = document.getElementById('update_image_input');
		
		urlSendButton.onclick = sendURL;
		updateImageInput.addEventListener('change', function (evt) {
			replaceImage(evt);
			updateImageInput.value = "";
			bottomfunc(false);
		}, false);
		imageFileInput.addEventListener('change', function (evt) {
			openImage(evt);
			imageFileInput.value = "";
			bottomfunc(false);
		}, false);
		textFileInput.addEventListener('change', function (evt) {
			openText(evt);
			textFileInput.value = "";
			bottomfunc(false);
		}, false);
		textSendButton.onclick = function (evt) {
			sendText(null);
			bottomfunc(false);
		};
	}
	
	/**
	 * ビュー領域初期化。スケーリング表示、スナップ設定などのelementの初期化を行う。
	 * @method initViewSettingArea
	 */
	function initViewSettingArea(rightfunc) {
		var dropDownCurrent = document.getElementById('snap_dropdown_current'),
			dropdownMenu1 = document.getElementById('dropdownMenu1'),
			dropdownMenu2 = document.getElementById('dropdownMenu2'),
			free = document.getElementById('dropdown_item1'),
			display = document.getElementById('dropdown_item2'),
			grid = document.getElementById('dropdown_item3'),
			displaySettingItem = document.getElementById('virtual_display_setting'),
			i;
		
		/*
		dropdownMenu1.onmousedown = function () {
			rightfunc(false);
		};
		dropdownMenu2.onmousedown = function () {
			rightfunc(false);
		};
		*/
	
		free.onclick = function () {
			dropDownCurrent.innerHTML = this.innerHTML;
			console.log("free mode");
			snapSetting = 'free';
			saveCookie();
		};

		display.onclick = function () {
			dropDownCurrent.innerHTML = this.innerHTML;
			console.log("display mode");
			snapSetting = 'display';
			saveCookie();
		};
		
		grid.onclick = function () {
			dropDownCurrent.innerHTML = this.innerHTML;
			console.log("grid mode");
			snapSetting = 'grid';
			saveCookie();
		};

		displaySettingItem.onclick = function () {
			unselect();
			select(wholeWindowListID);
			rightfunc(true);
		};
		
		addScaleDropdown('display_scale_1', 0.1);
		addScaleDropdown('display_scale_2', 0.2);
		addScaleDropdown('display_scale_3', 0.3);
		addScaleDropdown('display_scale_4', 0.4);
		addScaleDropdown('display_scale_5', 0.5);
		addScaleDropdown('display_scale_6', 0.6);
		addScaleDropdown('display_scale_7', 0.7);
		addScaleDropdown('display_scale_8', 0.8);
		addScaleDropdown('display_scale_9', 0.9);
		addScaleDropdown('display_scale_10', 1.0);
		//addScaleDropdown('display_scale_11', "custum");
	}
	
	/**
	 * 左コンテンツタブ初期化
	 * @method initContentArea
	 * @param {Function} bottomfunc addボタンコールバック
	 */
	function initContentArea(bottomfunc) {
		var addButton = document.getElementById('content_add_button'),
			contentDeleteButton = document.getElementById('content_delete_button');
		
		addButton.onclick = function () {
			bottomfunc(true);
		};
		contentDeleteButton.onclick = deleteContent;
	}
	
	/**
	 * ディスプレイタブの初期化
	 * @method initDisplayArea
	 */
	function initDisplayArea() {
		var displayDeleteButton = document.getElementById('display_delete_button'),
			displayDeleteAllButton = document.getElementById('display_delete_all_button');
		displayDeleteButton.onclick = deleteDisplay;
		displayDeleteAllButton.onclick = deleteDisplayAll;
	}
	
	
	/**
	 * 左メニュー領域[ディスプレイタブ、コンテンツタブ]の初期化
	 * @method initLeftArea
	 * @param {Function} bottomfunc addボタンコールバック
	 */
	function initLeftArea(bottomfunc) {
		var displayArea = document.getElementById('display_area'),
			displayTabTitle = document.getElementById('display_tab_title'),
			displayTabLink = document.getElementById('display_tab_link'),
			displayButtonArea = document.getElementById('display_button_area'),
			contentArea = document.getElementById('content_area'),
			contentButtonArea = document.getElementById('content_button_area'),
			contentTabTitle = document.getElementById('content_tab_title'),
			contentTabLink = document.getElementById('content_tab_link'),
			showIDButton = document.getElementById('show_display_id_button'),
			displayPreviewArea = document.getElementById('display_preview_area'),
			contentPreviewArea = document.getElementById('content_preview_area');
		
		showIDButton.onclick = function () {
			var id = document.getElementById('content_id').innerHTML;
			console.log("reqShowWindowID:" + id);
			if (id) {
				if (metaDataDict[id].type === windowType) {
					socket.emit('reqShowWindowID', JSON.stringify({id : id}));
					lastDraggingID = id;
					document.getElementById("onlist:" + id).style.borderColor = windowSelectColor;
				} else {
					socket.emit('reqShowWindowID', JSON.stringify({type : 'all', id : ""}));
				}
			} else {
				socket.emit('reqShowWindowID', JSON.stringify({type : 'all', id : ""}));
			}
		};

		displayTabTitle.onclick = function () {
			displayArea.style.display = "block";
			contentArea.style.display = "none";
			contentButtonArea.style.display = "none";
			displayButtonArea.style.display = "block";
			displayTabTitle.className = "display_tab_title active";
			contentTabTitle.className = "content_tab_title";
			displayTabLink.className = "active";
			contentTabLink.className = "";
			displayPreviewArea.style.opacity = 1.0;
			contentPreviewArea.style.opacity = 0.3;
			displayPreviewArea.style.zIndex = 10;
			contentPreviewArea.style.zIndex = -1000;
		};

		contentTabTitle.onclick = function () {
			displayArea.style.display = "none";
			contentArea.style.display = "block";
			contentButtonArea.style.display = "block";
			displayButtonArea.style.display = "none";
			displayTabTitle.className = "display_tab_title";
			contentTabTitle.className = "content_tab_title active";
			contentTabLink.className = "active";
			displayTabLink.className = "";
			displayPreviewArea.style.opacity = 0.3;
			contentPreviewArea.style.opacity = 1.0;
			displayPreviewArea.style.zIndex = -1000;
			contentPreviewArea.style.zIndex = 10;
		};
		initContentArea(bottomfunc);
		initDisplayArea();
	}
	
	/// initialize elemets, events
	/**
	 * コントローラ初期化
	 * @method init
	 */
	function init() {
		var timer = null,
			scale,
			snap,
			contentstab = window.animtab.create('left', {
					'leftTab' : { min : '0px', max : 'auto' },
				}, {
					'leftArea' : { min : '0px', max : '250px' },
				}, 'Contents'
			),
			/*bottomfunc = window.animtab.create('bottom',
				{ 'bottomTab' : { min : '0px', max : 'auto' }},
				{ 'bottomArea' : { min : '0px', max : '400px' }}, 'AddContent'),*/
			bottomfunc = function (show) {
				if (show) {
					$show($('overall_block'));
					$show($('bottomArea'));
					$show($('bottomTab'));
				} else {
					$hide($('overall_block'));
					$hide($('bottomArea'));
					$hide($('bottomTab'));
				}
			},
			rightfunc = window.animtab.create('right',
				{ 'rightTab' : { min : '0px', max : 'auto' }},
				{ 'rightArea' : { min : '0px', max : '250px' }}, 'Property');
		
		scale = parseFloat(getCookie('display_scale'));
		console.log("cookie - display_scale:" + scale);
		snap = getCookie('snap_setting');
		console.log("cookie - snap_setting:" + snap);
		if (!isNaN(scale) && scale > 0) {
			vscreen.setWholeScale(scale, true);
		}
		if (snap) {
			if (snap === 'display') {
				snapSetting = 'display';
			}
		}
		
		manipulator.setDraggingOffsetFunc(draggingOffsetFunc);
		manipulator.setCloseFunc(closeFunc);
		bottomfunc(false);
		
		initPropertyArea(wholeWindowListID, "whole_window");
		initLeftArea(bottomfunc);
		initAddContentArea(bottomfunc);
		initViewSettingArea(rightfunc);
		
		// resize event
		window.onresize = function () {
			if (timer) {
				clearTimeout(timer);
			}
			timer = setTimeout(function () {
				var whole = vscreen.getWhole(),
					cx = window.innerWidth / 2,
					cy = window.innerHeight / 2;
				
				vscreen.assignWhole(whole.orgW, whole.orgH, cx, cy, vscreen.getWholeScale());
				manipulator.removeManipulator();
				updateScreen();
			}, 200);
		};
		
	
		document.getElementById('content_preview_area').addEventListener("mousedown", function (evt) {
			// erase last border
			if (lastDraggingID && !manipulator.getDraggingManip()) {
				unselect();
			}
		});

		document.getElementById('display_preview_area').addEventListener("mousedown", function (evt) {
			// erase last border
			if (lastDraggingID && !manipulator.getDraggingManip()) {
				unselect();
			}
		});
		
		document.getElementById('content_area').addEventListener("mousedown", function (evt) {
			// erase last border
			if (lastDraggingID && !manipulator.getDraggingManip()) {
				unselect();
			}
		});
		document.getElementById('overall_block').addEventListener('click', function (evt) {
			bottomfunc(false);
		});
		
		// for ie, safari
		document.getElementById('dropdown_item1').addEventListener('mousedown', function (evt) {
			document.getElementById('dropdown_item1').click();
			document.getElementById('dropdown1').className = "dropdown1";
		});
		// for ie, safari
		document.getElementById('dropdown_item2').addEventListener('mousedown', function (evt) {
			document.getElementById('dropdown_item2').click();
			document.getElementById('dropdown1').className = "dropdown1";
		});
		
		updateScreen();
		vscreen.dump();
	}
	
	///------------------------------------------------------------------------
	
	/// meta data updated
	socket.on('doneGetMetaData', function (data) {
		var json = JSON.parse(data);
		if (json.type === windowType) { return; }
		metaDataDict[json.id] = json;
		if (isVisible(json)) {
			vsutil.assignMetaData(document.getElementById(json.id), json, true);
			if (draggingID === json.id || (manipulator.getDraggingManip() && lastDraggingID === json.id)) {
				assignContentProperty(json);
			}
		}
	});
	
	/// content data updated
	socket.on('doneGetContent', function (data) {
		metabinary.loadMetaBinary(new Blob([data]), function (metaData, contentData) {
			importContent(metaData, contentData);
		});
	});
	
	socket.on('doneUpdateTransform', function (reply) {
	});
	
	socket.on('doneUpdateWindow', function (reply) {
		console.log("doneUpdateWindow");
		//console.log(reply);
		var windowData = JSON.parse(reply);
		vscreen.assignScreen(windowData.id, windowData.orgX, windowData.orgY, windowData.orgWidth, windowData.orgHeight);
		vscreen.setScreenSize(windowData.id, windowData.width, windowData.height);
		vscreen.setScreenPos(windowData.id, windowData.posx, windowData.posy);
		updateScreen(windowData);
	});
	
	socket.on('doneDeleteContent', function (reply) {
		console.log("doneDeleteContent");
		var json = JSON.parse(reply),
			contentArea = document.getElementById('content_area'),
			previewArea = document.getElementById('content_preview_area'),
			contentID = document.getElementById('content_id'),
			deleted = document.getElementById(json.id);
		previewArea.removeChild(deleted);
		if (document.getElementById("onlist:" + json.id)) {
			contentArea.removeChild(document.getElementById("onlist:" + json.id));
		}
		contentID.innerHTML = "No Content Selected.";
	});
	
	socket.on('doneUpdateContent', function (reply) {
		var updateContentID = document.getElementById('update_content_id');
		updateContentID.innerHTML = "No Content Selected.";
		document.getElementById('update_image_input').disabled = true;
		update();
	});
	
	socket.on('doneAddContent', function (reply) {
		var json = JSON.parse(reply);
		console.log("doneAddContent:" + json.id + ":" + json.type);
		
		if (currentContent) {
			currentContent.id = json.id;
			setupContent(currentContent, json.id);
			//console.log(currentContent);
		}
		currentContent = null;
	});
	
	socket.on('doneGetWindow', function (reply) {
		console.log('doneGetWindow:');
		var windowData = JSON.parse(reply);
		importWindow(windowData);
		if (draggingID === windowData.id || (manipulator.getDraggingManip() && lastDraggingID === windowData.id)) {
			assignContentProperty(windowData);
		}
	});
	
	socket.on('doneGetVirtualDisplay', function (reply) {
		var windowData = JSON.parse(reply),
			whole = vscreen.getWhole(),
			split = vscreen.getSplitCount(),
			cx = window.innerWidth / 2,
			cy = window.innerHeight / 2;
		
		console.log('doneGetVirtualDisplay', reply, whole);
		if (windowData.hasOwnProperty('orgWidth')) {
			// set virtual displays
			if (!windowData.orgHeight || isNaN(windowData.orgWidth)) {
				windowData.orgWidth = initialWholeWidth;
			}
			if (!windowData.orgHeight || isNaN(windowData.orgHeight)) {
				windowData.orgWidth = initialWholeHeight;
			}
			vscreen.assignWhole(windowData.orgWidth, windowData.orgHeight, cx, cy, vscreen.getWholeScale());
			vscreen.splitWhole(windowData.splitX, windowData.splitY);
			console.log("doneGetVirtualDisplay", vscreen.getWhole());
			updateScreen();
		} else {
			// running first time
			changeDisplayValue();
			updateWindowData();
		}
	});
	
	socket.on('updateTransform', function () {
		socket.emit('reqGetMetaData', JSON.stringify({type: "all", id: ""}));
	});
	
	socket.on('updateWindow', function () {
		console.log('updateWindow');
		//updateScreen();
		//clearWindowList();
		socket.emit('reqGetWindow', JSON.stringify({type: "all", id: ""}));
	});
	
	socket.on('update', function () {
		manipulator.removeManipulator();
		update();
		clearWindowList();
		addWholeWindowToList();
		updateScreen();
	});
	
	window.onload = init;

}(window.metabinary, window.vscreen, window.vscreen_util, window.manipulator));
