/*jslint devel:true */
/*global FileReader, Uint8Array, Blob, URL, event, unescape, $, $show, $hide */

(function (gui, vscreen, vscreen_util, manipulator, connector) {
	"use strict";
	
	var currentContent = null,
		draggingID = 0,
		lastDraggingID = null,
		dragOffsetTop = 0,
		dragOffsetLeft = 0,
		metaDataDict = {},
		windowType = "window",
		wholeWindowID = "whole_window",
		wholeWindowListID = "onlist:whole_window",
		wholeSubWindowID = "whole_sub_window",
		initialWholeWidth = 1000,
		initialWholeHeight = 900,
		initialDisplayScale = 0.5,
		snapSetting = "free",
		contentSelectColor = "#04B431",
		windowSelectColor = "#0080FF",
		setupContent = function () {},
		updateScreen = function () {},
		setupWindow = function () {},
		changeRect = function () {},
		doneGetVirtualDisplay,
		doneGetContent,
		doneGetWindow,
		doneDeleteContent,
		doneAddContent,
		doneUpdateContent,
		doneUpdateMetaData,
		doneUpdateWindow,
		doneGetMetaData;
	
	
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
		return (metaData.hasOwnProperty('visible') && (metaData.visible === "true" || metaData.visible === true));
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
		var contentArea = gui.get_left_main_area(),
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
		return (gui.get_display_tab_link().className.indexOf("active") >= 0);
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
	 * 辞書順でElementをareaに挿入.
	 * @method insertElementWithDictionarySort
	 * @param {Element} area  
	 * @param {Element} elem  
	 */
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
					previewArea = gui.get_display_preview_area();
				} else {
					previewArea = gui.get_content_preview_area();
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
	
	/**
	 * コンテンツとウィンドウの更新(再取得).
	 * @method update
	 */
	function update() {
		vscreen.clearScreenAll();
		connector.send('GetVirtualDisplay', {type: "all", id: ""}, doneGetVirtualDisplay);
		connector.send('GetMetaData', {type: "all", id: ""}, doneGetMetaData);
		connector.send('GetWindow', {type: "all", id: ""}, doneGetWindow);
	}
	
	/**
	 * Displayを削除する
	 * @method deleteDisplay
	 */
	gui.on_deletedisplay_clicked = function () {
		if (getSelectedID()) {
			console.log('DeleteWindow' + getSelectedID());
			connector.send('DeleteWindow', {id : getSelectedID()});
		}
	};
	
	/**
	 * Displayを全削除する
	 * @method deleteDisplayAll
	 */
	gui.on_deletealldisplay_clicked = function () {
		connector.send('DeleteWindow', {type : "all", id : ""});
	};
	
	/**
	 * Show Display ID ボタンが押された.
	 */
	gui.on_showidbutton_clicked = function () {
		var id = getSelectedID();
		console.log("ShowWindowID:" + id);
		if (id && id !== "No Content Selected.") {
			if (metaDataDict[id].type === windowType) {
				connector.send('ShowWindowID', {id : id});
				lastDraggingID = id;
				gui.get_list_elem(id).style.borderColor = windowSelectColor;
			} else {
				connector.send('ShowWindowID', {type : 'all', id : ""});
			}
		} else {
			connector.send('ShowWindowID', {type : 'all', id : ""});
		}
	};
	
	/**
	 * Content追加
	 * @method addContent
	 * @param {BLOB} binary
	 */
	function addContent(metaData, binary) {
		connector.sendBinary('AddContent', metaData, binary, doneAddContent);
	}
	
	/**
	 * メタデータ(Display, 他コンテンツ)の幾何情報の更新通知を行う。
	 * @method updateMetaData
	 * @param {JSON} metaData メタデータ
	 */
	function updateMetaData(metaData) {
		if (metaData.type === windowType) {
			// window
			connector.send('UpdateWindow', metaData, doneUpdateWindow);
		} else {
			//console.log("UpdateMetaData");
			connector.send('UpdateMetaData', metaData, doneUpdateMetaData);
		}
	}
	
	/**
	 * コンテンツ更新要求送信
	 * @method updateContent
	 * @param {} binary
	 */
	function updateContent(metaData, binary) {
		connector.sendBinary('UpdateContent', metaData, binary, doneUpdateContent);
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
		connector.send('UpdateVirtualDisplay', windowData, function (err, res) {
			if (!err) {
				doneGetVirtualDisplay(null, res);
			}
		});
	}
	
	
	/**
	 * VirualDisplay分割設定
	 * @method assignSplitWholes
	 * @param {Object} splitWholes
	 */
	function assignSplitWholes(splitWholes) {
		var screenElem,
			i,
			w,
			previewArea = gui.get_display_preview_area();
			
		console.log("assignSplitWholes");
		
		//console.log(splitWholes);
		for (i in splitWholes) {
			if (splitWholes.hasOwnProperty(i)) {
				w = splitWholes[i];
				console.log(w);
				screenElem = document.getElementById(w.id);
				if (!screenElem) {
					console.log("create_new_window", w);
					screenElem = document.createElement('div');
					screenElem.style.position = "absolute";
					screenElem.className = "screen";
					screenElem.id = w.id;
					screenElem.style.border = 'solid';
					screenElem.style.borderWidth = '1px';
					screenElem.style.borderColor = "gray";
					screenElem.style.zIndex = -100000;
					previewArea.appendChild(screenElem);
					setupWindow(screenElem, w.id);
				}
				vscreen_util.assignScreenRect(screenElem, vscreen.transformScreen(w));
			}
		}
	}
	
	/**
	 * VirualDisplay分割数変更
	 * @method on_change_whole_split
	 * @param {String} x x軸分割数
	 * @param {String} y y軸分割数
	 * @param {bool} withoutUpdate 設定後各Displayの更新をするかのフラグ
	 */
	gui.on_change_whole_split = function (x, y, withoutUpdate) {
		var ix = parseInt(x, 10),
			iy = parseInt(y, 10),
			splitWholes,
			elem,
			i,
			wholes = vscreen.getSplitWholes(),
			previewArea = gui.get_display_preview_area();
		
		if (isNaN(ix) || isNaN(iy)) {
			return;
		}
		
		for (i in wholes) {
			if (wholes.hasOwnProperty(i)) {
				elem = document.getElementById(i);
				if (elem) {
					console.log("removeChildaa");
					previewArea.removeChild(elem);
				}
			}
		}
		
		vscreen.clearSplitWholes();
		vscreen.splitWhole(ix, iy);
		assignSplitWholes(vscreen.getSplitWholes());
		if (!withoutUpdate) {
			updateScreen();
			updateWindowData();
		}
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
			vscreen_util.trans(metaData);
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
			vscreen_util.transInv(metaData);
			vscreen_util.assignMetaData(elem, metaData, true);
			console.log("lastDraggingID:" + lastDraggingID);
			metaDataDict[lastDraggingID] = metaData;
			updateMetaData(metaData);
		}
	}
	
	/**
	 * Content or Display選択。
	 * @method select
	 * @param {String} id 選択したID
	 */
	function select(id, isContentArea) {
		var elem,
			metaData,
			initialVisible,
			mime = null;
		
		console.log("selectid", id);
		if (metaDataDict.hasOwnProperty(id)) {
			if (metaDataDict[id].hasOwnProperty('mime')) {
				mime = metaDataDict[id].mime;
			}
		}
		
		if (id === wholeWindowListID || id === wholeWindowID) {
			gui.init_property_area(id, "whole_window", mime);
			gui.assign_virtual_display_property(vscreen.getWhole(), vscreen.getSplitCount());
			gui.get_whole_window_elem().style.borderColor = windowSelectColor;
			gui.change_left_tab(windowType);
			return;
		}
		if (id.indexOf(wholeSubWindowID) >= 0) {
			return;
		}
		gui.get_whole_window_elem().style.borderColor = "white";
		elem = getElem(id, isContentArea);
		if (elem.id !== id) {
			id = elem.id;
		}
		//elem.style.visibility = "visible";
		metaData = metaDataDict[id];
		if (metaData.hasOwnProperty('mime')) {
			mime = metaData.mime;
		}
		
		console.log("metaData", metaData);
		initialVisible = metaData.visible;
		draggingID = id;
		console.log("draggingID = id:" + draggingID);
		elem.style.border = "solid 2px";
		if (metaData.type === windowType) {
			gui.init_property_area(id, "display", mime);
			gui.assign_content_property(metaDataDict[id]);
			gui.enable_delete_button(false);
			gui.enable_display_delete_button(true);
			gui.enable_update_image_button(false);
			gui.change_left_tab(windowType);
			if (gui.get_list_elem(id)) {
				gui.get_list_elem(id).style.borderColor = windowSelectColor;
			}
			elem.style.borderColor = windowSelectColor;
			manipulator.showManipulator(elem, gui.get_display_preview_area());
		} else {
			gui.init_property_area(id, metaData.type, mime);
			gui.assign_content_property(metaDataDict[id]);
			gui.enable_delete_button(true);
			gui.enable_update_image_button(true);
			gui.enable_display_delete_button(false);
			gui.set_update_content_id(id);
			gui.change_left_tab(metaData.type);
			if (gui.get_list_elem(id)) {
				gui.get_list_elem(id).style.borderColor = contentSelectColor;
			}
			elem.style.borderColor = contentSelectColor;
			manipulator.showManipulator(elem, gui.get_content_preview_area());
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
				if (gui.get_list_elem(lastDraggingID)) {
					gui.get_list_elem(lastDraggingID).style.borderColor = "white";
				}
				elem.style.borderColor = "black";
			}
			lastDraggingID = null;
		}
		manipulator.removeManipulator();
		gui.clear_property();
	}
	
	/**
	 * クローズボタンハンドル。選択されているcontent or windowを削除する。
	 * その後クローズされた結果をupdateMetaDataにて各Windowに通知する。
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
				previewArea = gui.get_display_preview_area();
			} else {
				previewArea = gui.get_content_preview_area();
			}
			previewArea.removeChild(elem);
			
			updateMetaData(metaData);
		}
	}
	
	/**
	 * Content or Displayの矩形サイズ変更時ハンドラ。initPropertyAreaのコールバックとして指定されている。
	 * @method changeRect
	 * @param {String} id Content or Display ID
	 * @param {String } value 変更値
	 */
	changeRect = function (id, value) {
		var elem = gui.get_selected_elem(),
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
					updateMetaData(metaData);
				} else if (id === 'content_transform_y') {
					metaData.posy = value;
					updateMetaData(metaData);
				} else if (id === 'content_transform_w' && value > 10) {
					metaData.width = value;
					metaData.height = value * aspect;
					document.getElementById('content_transform_h').value = metaData.height;
					updateMetaData(metaData);
				} else if (id === 'content_transform_h' && value > 10) {
					metaData.width = value / aspect;
					metaData.height = value;
					document.getElementById('content_transform_w').value = metaData.width;
					updateMetaData(metaData);
				}
			}
			manipulator.removeManipulator();
		}
	};

	/**
	 * 指定された座標がContent or Displayの内部に存在するかを判定する。setupContentsにて使用されている。
	 * @method isInsideElement
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
	setupContent = function (elem, id) {
		elem.onmousedown = function (evt) {
			var rect = evt.target.getBoundingClientRect(),
				metaData = null,
				otherPreviewArea = gui.get_content_preview_area(),
				childs,
				i,
				topElement = null,
				e;
			
			if (metaDataDict.hasOwnProperty(id)) {
				metaData = metaDataDict[id];
				if (metaData.type !== windowType) {
					otherPreviewArea = gui.get_display_preview_area();
				}
			}

			
			if (id === wholeWindowID ||
					(metaData && !isDisplayTabSelected() && metaData.type === windowType) ||
					(metaData && isDisplayTabSelected() && metaData.type !== windowType)) {
				console.log("setupContent", metaData);
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
	};
	
	/**
	 * Display設定
	 * @method setupWindow
	 * @param {Object} elem 設定対象Element
	 * @param {String} id ContentID
	*/
	setupWindow = function (elem, id) {
		setupContent(elem, id);
	};
	
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
	
	/**
	 * Screenへスナップさせる.
	 * @method snapToScreen
	 * @param {Element} elem
	 * @param {JSON} metaData
	 * @param {Object} screen
	 */
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
				if (document.getElementById(splitWholes[i].id)) {
					document.getElementById(splitWholes[i].id).style.background = "transparent";
				}
			}
		}
		
		screens = vscreen.getScreenAll();
		for (i in screens) {
			if (screens.hasOwnProperty(i)) {
				if (document.getElementById(screens[i].id)) {
					document.getElementById(screens[i].id).style.background = "transparent";
				}
			}
		}
	}
	
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
			leftArea = gui.get_left_area(),
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
			vscreen_util.transPosInv(metaData);
			vscreen_util.assignMetaData(elem, metaData, true);
			
			if (metaData.type === windowType || isVisible(metaData)) {
				manipulator.moveManipulator(elem);
				updateMetaData(metaData);
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
		var contentArea = gui.get_content_area(),
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
					vscreen_util.assignMetaData(elem, metaData, true);
					updateMetaData(metaData);
				} else if (isDisplayMode()) {
					px = rect.left + dragOffsetLeft;
					py = rect.top + dragOffsetTop;
					orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
					screen = vscreen.getScreeByPos(orgPos.x, orgPos.y, draggingID);
					if (screen) {
						snapToScreen(elem, metaData, screen);
					}
					vscreen_util.assignMetaData(elem, metaData, true);
					updateMetaData(metaData);
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
					vscreen_util.assignMetaData(elem, metaData, true);
					updateMetaData(metaData);
					manipulator.moveManipulator(elem);
				}
			}
			clearSnapHightlight();
		}
		if (manipulator.getDraggingManip() && lastDraggingID) {
			metaData = metaDataDict[lastDraggingID];
			//updateMetaData(metaData);
		} else {
			lastDraggingID = draggingID;
			draggingID = null;
		}
		manipulator.clearDraggingManip();
		dragOffsetTop = 0;
		dragOffsetLeft = 0;
	});
	
	/**
	 * テキストデータ送信
	 * @method sendText
	 * @param {String} text
	 */
	function sendText(text) {
		var previewArea = gui.get_content_preview_area(),
			textInput = document.getElementById('text_input'),
			elem = document.createElement('pre'),
			width = (textInput.clientWidth + 1),
			height = (textInput.clientHeight + 1);
		
		if (!text) {
			text = "";
		}
		elem.style.position = "absolute";
		elem.style.top = "0px";
		elem.style.left = "0px";
		elem.innerHTML = text;
		previewArea.appendChild(elem);
		
		// calculate width, height
		width = elem.offsetWidth / vscreen.getWholeScale();
		height = elem.offsetHeight / vscreen.getWholeScale();
		previewArea.removeChild(elem);

		currentContent = elem;
		addContent({type : "text", posx : 0, posy : 0, width : width, height : height}, text);
	}
	
	/**
	 * VirualDisplayをVirtualScreenに設定
	 * @method addScreenRect
	 * @param {JSON} windowData ウィンドウデータ. 無い場合はすべてのVirtualScreenが再生成される.
	 */
	function addScreenRect(windowData) {
	}
	
	/**
	 * VirtualScreen更新
	 * @method updateScreen
	 * @param {JSON} windowData ウィンドウデータ. 無い場合はすべてのVirtualScreenが更新される.
	 */
	updateScreen = function (windowData) {
		var i,
			whole = vscreen.getWhole(),
			screens = vscreen.getScreenAll(),
			split_wholes = vscreen.getSplitWholes(),
			s,
			wholeElem,
			previewArea = gui.get_display_preview_area(),
			elem,
			screenElem,
			metaData;
		
		if (windowData && windowData !== undefined) {
			screenElem = document.getElementById(windowData.id);
			if (!screenElem && isVisible(windowData)) {
				screenElem = document.createElement('div');
				screenElem.innerHTML = "ID:" + windowData.id;
				screenElem.className = "screen";
				screenElem.style.zIndex = -100;
				screenElem.style.display = "block";
				screenElem.id = windowData.id;
				screenElem.style.border = 'solid';
				previewArea.appendChild(screenElem);
				setupWindow(screenElem, windowData.id);
				vscreen_util.assignScreenRect(screenElem, vscreen.transformScreen(screens[windowData.id]));
			}
			if (screenElem) {
				vscreen_util.assignMetaData(screenElem, windowData, true);
			}
		} else {
			gui.assign_virtual_display_property(vscreen.getWhole(), vscreen.getSplitCount());
			gui.assign_view_setting(vscreen.getWholeScale(), isFreeMode(), isDisplayMode());
			
			// 全可視コンテンツの配置を再計算.
			for (i in metaDataDict) {
				if (metaDataDict.hasOwnProperty(i)) {
					metaData = metaDataDict[i];
					if (isVisible(metaData)) {
						if (metaData.type !== windowType) {
							elem = document.getElementById(metaData.id);
							if (elem) {
								vscreen_util.assignMetaData(elem, metaData, true);
							}
						}
					}
				}
			}
			
			// Virtual Displayを生成して配置.
			wholeElem = document.getElementById(wholeWindowID);
			if (!wholeElem) {
				wholeElem = document.createElement('span');
				wholeElem.style.border = 'solid';
				wholeElem.style.zIndex = -1000;
				wholeElem.className = "screen";
				wholeElem.id = wholeWindowID;
				wholeElem.style.color = "black";
				setupWindow(wholeElem, wholeElem.id);
				previewArea.appendChild(wholeElem);
			}
			vscreen_util.assignScreenRect(wholeElem, whole);
			
			// 保持しているscreen座標情報から枠を生成して配置.
			for (s in screens) {
				if (screens.hasOwnProperty(s)) {
					screenElem = document.getElementById(s);
					if (metaDataDict.hasOwnProperty(s)) {
						metaData = metaDataDict[s];
						if (!screenElem) {
							if (isVisible(metaData)) {
								screenElem = document.createElement('div');
								screenElem.innerHTML = "ID:" + s;
								screenElem.className = "screen";
								screenElem.style.zIndex = -100;
								screenElem.style.display = "block";
								screenElem.id = s;
								console.log("screenElemID:" + JSON.stringify(screens[s]));
								screenElem.style.border = 'solid';
								previewArea.appendChild(screenElem);
								setupWindow(screenElem, s);
							}
						}
						if (screenElem) {
							vscreen_util.assignMetaData(screenElem, metaData, true);
							vscreen_util.assignScreenRect(screenElem, vscreen.transformScreen(screens[s]));
						}
					}
				}
			}
			assignSplitWholes(vscreen.getSplitWholes());
		}
		addScreenRect(windowData);
		//changeWholeSplit(wholeSplitX.value, this.value);
	};
	
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
	
	/**
	 * コンテンツタイプから適切なクラス名を取得する.
	 */
	function getClassName(contentType) {
		var classname;
		if (contentType === 'text') {
			classname = 'textcontent';
		} else {
			classname = 'imagecontent';
		}
		return classname;
	}
	
	/**
	 * 受領したメタデータからプレビューツリーにコンテンツを反映する。
	 * doneGetContent時にコールされる。
	 * @method importContentToView
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	function importContentToView(metaData, contentData) {
		var previewArea = gui.get_content_preview_area(),
			elem,
			tagName,
			blob,
			mime = "image/jpeg";
		
		console.log("importContentToView:" + JSON.stringify(metaData));
		tagName = getTagName(metaData.type);
		
		// メタデータはGetMetaDataで取得済のものを使う.
		// GetContent送信した後にさらにGetMetaDataしてる場合があるため.
		if (metaDataDict.hasOwnProperty(metaData.id)) {
			metaData = metaDataDict[metaData.id];
		}
		
		if (document.getElementById(metaData.id)) {
			elem = document.getElementById(metaData.id);
		}
		
		if (!elem) {
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
			vscreen_util.assignMetaData(elem, metaData, true);
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
					vscreen_util.assignMetaData(elem, metaData, true);
				};
			}
		}
		//}
	}
	
	/**
	 * 受領したメタデータから左側コンテンツエリアに反映する。
	 * doneGetContent時にコールされる。
	 * @method importContentToList
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	function importContentToList(metaData, contentData) {
		var contentArea = gui.get_content_area(),
			contentElem,
			divElem,
			tagName,
			classname,
			blob,
			mime = "image/jpeg",
			onlistID = "onlist:" + metaData.id;

		// メタデータはGetMetaDataで取得済のものを使う.
		// GetContent送信した後にさらにGetMetaDataしてる場合があるため.
		if (metaDataDict.hasOwnProperty(metaData.id)) {
			metaData = metaDataDict[metaData.id];
		}

		tagName = getTagName(metaData.type);
		classname = getClassName(metaData.type);
		
		if (gui.get_list_elem(metaData.id)) {
			divElem = gui.get_list_elem(metaData.id);
			contentElem = divElem.childNodes[0];
		}
		
		if (!divElem) {
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
	 * コンテンツロード完了まで表示する枠を作る.
	 */
	function createBoundingBox(metaData) {
		var previewArea = gui.get_content_preview_area(),
			tagName = 'div',
			elem = document.createElement(tagName);
		
		elem.id = metaData.id;
		elem.style.position = "absolute";
		elem.className = "temporary_bounds";
		insertElementWithDictionarySort(previewArea, elem);
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
		console.log("importWindowToList", windowData);
		var displayArea = gui.get_display_area(),
			divElem,
			onlistID = "onlist:" + windowData.id;
		
		divElem = gui.get_list_elem(windowData.id);
		if (divElem) { return; }
		
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
		var displayArea = gui.get_display_area(),
			divElem = document.createElement("div"),
			onlistID = wholeWindowListID;
		
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
		var displayArea = gui.get_display_area();
		displayArea.innerHTML = "";
	}
	
	/**
	 * 指定されたWindowをリストビューにインポートする
	 * @method importWindow
	 * @param {JSON} windowData ウィンドウデータ
	 */
	function importWindow(windowData) {
		importWindowToView(windowData);
		importWindowToList(windowData);
	}
	
	///-------------------------------------------------------------------------------------------------------
	
	/// meta data updated
	doneGetMetaData = function (err, reply) {
		console.log('doneGetMetaData', reply);
		var json = reply,
			elem,
			metaData = json;
		if (json.type === windowType) { return; }
		metaDataDict[json.id] = json;
		
		//vscreen_util.assignMetaData(document.getElementById(json.id), json, true);
		if (draggingID === json.id || (manipulator.getDraggingManip() && lastDraggingID === json.id)) {
			gui.assign_content_property(json);
		}
		
		elem = document.getElementById(metaData.id);
		if (elem) {
			if (isVisible(json)) {
				vscreen_util.assignMetaData(elem, json, true);
				elem.style.display = "block";
			} else {
				elem.style.display = "none";
			}
		} else {
			// 新規コンテンツロード.
			connector.send('GetContent', { type: json.type, id: json.id }, doneGetContent);
		}
	};
	
	/// content data updated
	doneGetContent = function (err, reply) {
		console.log("doneGetContent", reply);
		importContent(reply.metaData, reply.contentData);
	};
	
	doneUpdateMetaData = function (err, reply) {
		console.log("doneUpdateMetaData", reply);
		var json = reply;
		metaDataDict[json.id] = json;
	};
	
	doneUpdateWindow = function (err, reply) {
		console.log("doneUpdateWindow");
		//console.log(reply);
		var windowData = reply;
		vscreen.assignScreen(windowData.id, windowData.orgX, windowData.orgY, windowData.orgWidth, windowData.orgHeight);
		vscreen.setScreenSize(windowData.id, windowData.width, windowData.height);
		vscreen.setScreenPos(windowData.id, windowData.posx, windowData.posy);
		updateScreen(windowData);
	};
	
	doneDeleteContent = function (err, reply) {
		console.log("doneDeleteContent");
		var json = reply,
			contentArea = gui.get_content_area(),
			previewArea = gui.get_content_preview_area(),
			deleted = document.getElementById(json.id);
		previewArea.removeChild(deleted);
		if (gui.get_list_elem(json.id)) {
			contentArea.removeChild(gui.get_list_elem(json.id));
		}
		gui.set_update_content_id("No Content Selected.");
	};
	
	doneUpdateContent = function (err, reply) {
		console.log("doneUpdateContent");

		gui.set_update_content_id("No Content Selected.");
		gui.enable_update_image_button(false);
	};
	
	doneAddContent = function (err, reply) {
		var json = reply;
		console.log("doneAddContent:" + json.id + ":" + json.type);
		
		// 新規追加ではなく差し替えだった場合.
		if (metaDataDict.hasOwnProperty(json.id)) {
			doneUpdateContent(err, reply);
			return;
		}
		
		doneGetMetaData(err, reply);
		
		if (currentContent) {
			currentContent.id = json.id;
			setupContent(currentContent, json.id);
			//console.log(currentContent);
		}
		currentContent = null;
	};
	
	doneGetWindow = function (err, reply) {
		console.log('doneGetWindow:');
		var windowData = reply,
			elem;
		importWindow(windowData);
		if (draggingID === windowData.id || (manipulator.getDraggingManip() && lastDraggingID === windowData.id)) {
			gui.assign_content_property(windowData);
		}
		if (lastDraggingID) {
			console.log("moveManipulator");
			elem = document.getElementById(lastDraggingID);
			if (elem) {
				manipulator.moveManipulator(elem);
			}
		}
	};
	
	doneGetVirtualDisplay = function (err, reply) {
		var windowData = reply,
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
			gui.update_display_value();
			updateWindowData();
		}
	};
	
	///-------------------------------------------------------------------------------------------------------
	/**
	 * テキスト送信.
	 */
	gui.on_textsendbutton_clicked = function (evt) {
		var textInput = document.getElementById('text_input'),
			text = textInput.value;
		
		textInput.value = "";
		sendText(text);
	};
	
	/**
	 * URLデータ送信
	 * @method on_sendbuton_clicked
	 */
	gui.on_urlsendbuton_clicked = function () {
		console.log("sendurl");
		var previewArea = gui.get_content_preview_area(),
			urlInput = document.getElementById('url_input');

		console.log(previewArea, urlInput.value);
		urlInput.value = urlInput.value.split(' ').join('');
		if (urlInput.value.indexOf("http") < 0) {
			return;
		}
		
		addContent({type : "url"}, urlInput.value);
		urlInput.value = '';
	};
	
	/**
	 * 画像ファイルFileOpenハンドラ
	 * @method on_imagefileinput_changed
	 * @param {Object} evt FileOpenイベント
	 */
	gui.on_imagefileinput_changed = function (evt) {
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
					var metaData = {type : "image", posx : 0, posy : 0, width : img.naturalWidth, height: img.naturalHeight};
					img.style.width = img.naturalWidth + "px";
					img.style.height = img.naturalHeight + "px";
					console.log("sendImage");
					addContent(metaData, e.target.result);
				};
			}
		};
		for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('image.*')) {
				fileReader.readAsArrayBuffer(file);
			}
		}
	};
	
	/**
	 * テキストファイルFileOpenハンドラ
	 * @method openText
	 * @param {Object} evt FileOpenイベント
	 */
	gui.on_textfileinput_changed = function (evt) {
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
	};
	
	/**
	 * 画像イメージ差し替えFileOpenハンドラ
	 * @method on_updateimageinput_changed
	 * @param {Object} evt FileOpenイベント
	 */
	gui.on_updateimageinput_changed = function (evt) {
		var files = evt.target.files,
			file,
			i,
			fileReader = new FileReader(),
			id = gui.get_update_content_id(),
			previewArea = gui.get_content_preview_area(),
			elem;

		fileReader.onloadend = function (e) {
			if (e.target.result) {
				console.log("update_content_id", id);
				elem = document.getElementById(id);
				if (elem) {
					previewArea.removeChild(elem);
				}
				updateContent({type : "image", id : id}, e.target.result);
			}
		};
		for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('image.*')) {
				fileReader.readAsArrayBuffer(file);
			}
		}
	};

	/**
	 * ディスプレイスケールが変更された.
	 */
	gui.on_display_scale_changed = function (displayScale) {
		manipulator.removeManipulator();
		vscreen.setWholeScale(displayScale, true);
		saveCookie();
		updateScreen();
	};

	/**
	 * コンテンツの削除.
	 * @method deleteContent
	 */
	gui.on_contentdeletebutton_clicked = function (evt) {
		if (getSelectedID()) {
			connector.send('DeleteContent', {id : getSelectedID()}, doneDeleteContent);
		}
	};
	
	/**
	 * PropertyのDisplayパラメータ更新ハンドル
	 * @method on_display_value_changed
	 */
	gui.on_display_value_changed = function () {
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
		gui.update_whole_split(ix, iy, true);
	};
	
	/**
	 * スナップ設定のドロップダウンがクリックされた.
	 */
	gui.on_snapdropdown_clicked = function (snapType) {
		snapSetting = snapType;
		saveCookie();
	};
	
	/**
	 * Virtual Dsiplay Settingボタンがクリックされた.
	 */
	gui.on_virtualdisplaysetting_clicked = function () {
		unselect();
		select(wholeWindowListID);
	};
	
	/**
	 * 選択中のコンテンツのzIndexを変更する
	 * @method changeZIndex
	 * @param {String} index 設定するzIndex
	 */
	gui.on_change_zindex = function (index) {
		var elem = gui.get_selected_elem(),
			metaData;
		if (elem) {
			metaData = metaDataDict[elem.id];
			elem.style.zIndex = index;
			metaData.zIndex = index;
			updateMetaData(metaData);
			console.log("change zindex:" + index);
		}
	};
	
	///-------------------------------------------------------------------------------------------------------
	// メタデータが更新されたときにブロードキャストされてくる.
	connector.on('UpdateMetaData', function (metaData) {
		console.log('UpdateMetaData', metaData.id);
		var elem,
			id = metaData.id;
		if (id) {
			console.log(metaData);
			doneGetMetaData(null, metaData);
			if (lastDraggingID) {
				elem = document.getElementById(lastDraggingID);
				if (elem) {
					manipulator.moveManipulator(elem);
				}
			}
		} else {
			connector.send('GetMetaData', {type: "all", id: ""}, doneGetMetaData);
		}
	});
	
	// コンテンツが差し替えられたときにブロードキャストされてくる.
	connector.on('UpdateContent', function (metaData) {
		console.log('UpdateContent', metaData);
		var id = metaData.id,
			previewArea = gui.get_content_preview_area();
		
		if (id) {
			connector.send('GetMetaData', metaData, function (err, json) {
				doneGetMetaData(err, json);
				connector.send('GetContent', json, doneGetContent);
			});
			
			//connector.send('GetMetaData', metaData, doneGetMetaData);
		}
	});
	
	// windowが更新されたときにブロードキャストされてくる.
	connector.on('UpdateWindow', function (metaData) {
		console.log('UpdateWindow', metaData);
		//updateScreen();
		//clearWindowList();
		doneGetWindow(null, metaData);
		//connector.send('GetWindow', metaData, doneGetWindow);
	});
	
	// すべての更新が必要なときにブロードキャストされてくる.
	connector.on('Update', function () {
		console.log("on update");
		manipulator.removeManipulator();
		update();
		clearWindowList();
		addWholeWindowToList();
		updateScreen();
	});
	
	///-------------------------------------------------------------------------------------------------------
	/**
	 * コントローラ初期化
	 * @method init
	 */
	function init() {
		var timer = null,
			scale,
			snap;
			
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
		
		gui.on_rect_changed = function () {
			changeRect(this.id, parseInt(this.value, 10));
		};
		
		gui.on_mousedown_content_preview_area = function () {
			// erase last border
			if (lastDraggingID && !manipulator.getDraggingManip()) {
				unselect();
			}
		};
		
		gui.on_mousedown_display_preview_area = function () {
			// erase last border
			if (lastDraggingID && !manipulator.getDraggingManip()) {
				unselect();
			}
		};
		
		gui.on_mousedown_content_area = function () {
			// erase last border
			if (lastDraggingID && !manipulator.getDraggingManip()) {
				unselect();
			}
		};
		
		gui.init();
		connector = window.io_connector;
		
		manipulator.setDraggingOffsetFunc(draggingOffsetFunc);
		manipulator.setCloseFunc(closeFunc);
		
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
		
		updateScreen();
		vscreen.dump();
	}
	
	window.onload = init;
	connector.connect();

}(window.controller_gui, window.vscreen, window.vscreen_util, window.manipulator, window.io_connector));
