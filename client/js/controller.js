/*jslint devel:true */
/*global FileReader, Uint8Array, Blob, URL, event, unescape, $, $show, $hide */

(function (gui, content_property, content_box, vscreen, vscreen_util, manipulator, connector) {
	"use strict";
	
	var currentContent = null,
		draggingIDList = [],
		selectedIDList = [],
		onCtrlDown = false, // Ctrlボタンを押してるかどうか
		isUpdateCursorEnable = false, // マウスカーソル送信が有効かどうか
		lastSelectContentID = null,
		lastSelectWindowID = null,
		dragOffsetTop = 0,
		dragOffsetLeft = 0,
		dragRect = {},
		mouseDownPos = [],
		metaDataDict = {},
		groupList = [],
		groupDict = {},
		windowType = "window",
		wholeWindowID = "whole_window",
		wholeWindowListID = "onlist:whole_window",
		wholeSubWindowID = "whole_sub_window",
		initialWholeWidth = 1000,
		initialWholeHeight = 900,
		initialDisplayScale = 0.5,
		snapSetting = "free",
		contentSelectColor = "#04B431",
		contentBorderColor = "rgba(0,0,0,0)",
		defaultGroup = "default",
		setupContent = function () {},
		updateScreen = function () {},
		setupWindow = function () {},
		changeRect = function () {},
		doneGetVirtualDisplay,
		doneGetContent,
		doneGetWindowMetaData,
		doneGetGroupList,
		doneDeleteContent,
		doneAddContent,
		doneUpdateContent,
		doneUpdateMetaData,
		doneUpdateWindowMetaData,
		doneGetMetaData,
		doneDeleteWindowMetaData;
	
	
	/**
	 * メタデータが表示中かを判定する
	 * @method isVisible
	 * @param {Object} metaData メタデータ
	 * @return {bool} 表示中であればtrue
	 */
	function isVisible(metaData) {
		return (metaData.hasOwnProperty('visible') && (metaData.visible === "true" || metaData.visible === true));
	}
	
	/**
	 * VirtualDisplayのモードがFreeModeかを判別する
	 * @method isFreeMode
	 * @return {bool} FreeModeであればtrueを返す.
	 */
	function isFreeMode() {
		return snapSetting === 'free';
	}
	
	/**
	 * VirtualDisplayのモードがGridModeかを判別する
	 * @method isGridMode
	 * @return {bool} GridModeであればtrueを返す.
	 */
	function isGridMode() {
		return snapSetting === 'grid';
	}
	
	/**
	 * VirtualDisplayのモードがDisplayModeかを判別する
	 * @method isDisplayMode
	 * @return {bool} DisplayModeであればtrueを返す.
	 */
	function isDisplayMode() {
		return snapSetting === 'display';
	}
	
	/**
	 * リスト表示中かをIDから判別する
	 * @method isUnvisibleID
	 * @param {String} id コンテンツID
	 * @return {bool} リストに表示されているコンテンツのIDであればtrueを返す.
	 */
	function isUnvisibleID(id) {
		return (id.indexOf("onlist:") >= 0);
	}
	
	/**
	 * 発生したイベントがリストビュー領域で発生しているかを判別する
	 * @method isContentArea
	 * @param {Object} evt イベント.
	 * @return {bool} 発生したイベントがリストビュー領域で発生していたらtrueを返す.
	 */
	function isContentArea(evt) {
		var contentArea = gui.get_bottom_area(),
			rect = contentArea.getBoundingClientRect(), 
			//px = evt.clientX + (document.body.scrollLeft || document.documentElement.scrollLeft),
			py = evt.clientY + (document.body.scrollTop || document.documentElement.scrollTop);
		if (!contentArea) {
			return false;
		}
		return py > rect.top;
	}
	
	function isContentArea2(evt) {
		if (mouseDownPos.length < 2) { return false; }
		var contentArea = gui.get_bottom_area(),
			rect = contentArea.getBoundingClientRect(),
			//px = mouseDownPos[0] + (document.body.scrollLeft || document.documentElement.scrollLeft),
			py = mouseDownPos[1] + (document.body.scrollTop || document.documentElement.scrollTop);
		if (!contentArea) {
			return false;
		}
		return py > rect.top;
	}

	/**
	 * リストでディスプレイタブが選択されているかを判別する。
	 * @method isDisplayTabSelected
	 * @return {bool} リストでディスプレイタブが選択されていたらtrueを返す.
	 */
	function isDisplayTabSelected() {
		return content_box.is_active("display_tab");
	}
	
	/**
	 * cookie取得
	 * @method getCookie
	 * @param {String} key cookieIDキー
	 * @return {String} cookie
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
		document.cookie = 'update_cursor_enable=' + String(isUpdateCursorEnable);
	}
	
	/**
	 * 辞書順でElementをareaに挿入.
	 * @method insertElementWithDictionarySort
	 * @param {Element} area  挿入先エリアのelement
	 * @param {Element} elem  挿入するelement
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
	 * @param {String} id コンテンツID
	 * @param {bool} isContentArea コンテンツエリアか
	 * @return {Object} Element
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
	 * @return {String} コンテンツID
	 */
	function getSelectedID() {
		//var contentID = document.getElementById('content_id');
		if (selectedIDList.length > 0) {
			return selectedIDList[0];
		}
		return null;//contentID.innerHTML;
	}
	
	/**
	 * 選択されているGroupIDを返却する
	 * @method getSelectedGroup
	 * @return {String} グループID
	 */
	function getSelectedGroup() {
		var i,
			groupElem = document.getElementsByClassName('group_tab');
		for (i = 0; i < groupElem.length; ++i) {
			if (groupElem[i].className.indexOf("active") >= 0) {
				return groupElem[i].id;
			}
		}
		return groupList[0].id;//contentID.innerHTML;
	}

	/**
	 * メタデータの位置情報、サイズ情報をString -> Intへ変換する
	 * @method toIntMetaData
	 * @param {JSON} metaData メタデータ
	 * @return {JSON} metaData
	 */
	function toIntMetaData(metaData) {
		metaData.posx = parseInt(metaData.posx, 10);
		metaData.posy = parseInt(metaData.posy, 10);
		metaData.width = parseInt(metaData.width, 10);
		metaData.height = parseInt(metaData.height, 10);
		return metaData;
	}

	/**
	 * グループリストの更新(再取得)
	 * @method updateGroupList
	 */
	function updateGroupList(endCallback) {
		connector.send('GetGroupList', {}, function (err, reply) {
			doneGetGroupList(err, reply);
			if (endCallback) {
				endCallback();
			}
		});
	}
	
	/**
	 * コンテンツとウィンドウの更新(再取得).
	 * @method update
	 */
	function update(endCallback) {
		vscreen.clearScreenAll();
		connector.send('GetMetaData', {type: "all", id: ""}, function (err, reply) {
			var last = reply.last; 
			delete reply.last;
			doneGetMetaData(err, reply, function (err) {
				updateGroupList();
				if (last) {
					updateGroupList(function () {
						if (endCallback) {
							endCallback();
						}
					});
				}
			});
		});
		connector.send('GetVirtualDisplay', {type: "all", id: ""}, doneGetVirtualDisplay);
		connector.send('GetWindowMetaData', {type: "all", id: ""}, doneGetWindowMetaData);
		updateGroupList();
	}
	
	/**
	 * Content追加
	 * @method addContent
	 * @param {JSON} metaData コンテンツのメタデータ
	 * @param {BLOB} binary コンテンツのバイナリデータ
	 */
	function addContent(metaData, binary) {
		connector.sendBinary('AddContent', metaData, binary, doneAddContent);
	}
	
	/**
	 * メタデータ(Display, 他コンテンツ)の幾何情報の更新通知を行う。
	 * @method updateMetaData
	 * @param {JSON} metaData メタデータ
	 */
	function updateMetaData(metaData, endCallback) {
		if (metaData.type === windowType) {
			// window
			connector.send('UpdateWindowMetaData', [metaData], function (err, reply) {
				doneUpdateWindowMetaData(err, reply, endCallback);
			});
        } else if (metaData.type === 'mouse') {
            // mouse cursor
            connector.send('UpdateMouseCursor', metaData, function (err, reply) {
                // console.log(err, reply);
            });
		} else {
			connector.send('UpdateMetaData', [metaData], function (err, reply) {
				doneUpdateMetaData(err, reply, endCallback);
			});
		}
	}
	
	/**
	 * メタデータ(Display, 他コンテンツ)の幾何情報の更新通知を行う。
	 * @method updateMetaData
	 * @param {JSON} metaData メタデータ
	 */
	function updateMetaDataMulti(metaDataList, endCallback) {
		if (metaDataList.length > 0) {
			if (metaDataList[0].type === windowType) {
				connector.send('UpdateWindowMetaData', metaDataList, function (err, reply) {
					doneUpdateWindowMetaData(err, reply, endCallback);
				});
			} else {
				connector.send('UpdateMetaData', metaDataList, function (err, reply) {
					doneUpdateMetaData(err, reply, endCallback);
				});
			}
		}
	}

	/**
	 * コンテンツ更新要求送信
	 * @method updateContent
	 * @param {JSON} metaData 更新するコンテンツのメタデータ
	 * @param {Blob} binary 更新するコンテンツのバイナリ
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
			windowData.orgHeight = initialWholeHeight;
		}
		connector.send('UpdateVirtualDisplay', windowData, function (err, res) {
			if (!err) {
				doneGetVirtualDisplay(null, res);
			}
		});
	}
	
	/**
	 * リモートカーソルの有効状態を更新
	 * @method updateRemoteCursor
	 */
	function updateRemoteCursorEnable(isEnable) {
		isUpdateCursorEnable = isEnable;
		if (!isEnable) {
			connector.send('UpdateMouseCursor', {}, function (err, reply) {});
		}
		saveCookie();
	}
	
	/**
	 * VirualDisplay分割設定
	 * @method assignSplitWholes
	 * @param {Object} splitWholes VirtualDisplayの分割情報.
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
	 * グループの色を返す
	 */
	function getGroupColor(groupName) {
		var i,
			item;

		for (i = 0; i < groupList.length; i = i + 1) {
			item = groupList[i];
			if (item.name === groupName) {
				if (item.color) {
					return item.color;
				}
			}
		}
		return contentSelectColor;
	}

	/**
	 * windowの枠色を返す
	 */
	function getWindowBorderColor(id) {
		if (metaDataDict.hasOwnProperty(id)) {
			if (metaDataDict[id].hasOwnProperty("color")) {
				return metaDataDict[id].color;
			}
		}
		return "#0080FF";
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
			elem = null,
			metaData,
			draggingManip = manipulator.getDraggingManip(),
			invAspect;
		
		if (draggingManip) {
			elem = document.getElementById(getSelectedID());
			if (elem) {
				metaData = metaDataDict[elem.id];
				if (metaData.type !== windowType && !isVisible(metaData)) {
					// 非表示コンテンツ
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
				vscreen_util.assignMetaData(elem, metaData, true, groupDict);
				metaDataDict[metaData.id] = metaData;
				updateMetaData(metaData);
			}
		}
	}
	
	/**
	 * ContentかDisplayを選択する。
	 * @method select
	 * @param {String} id 選択したID
	 * @parma {bool} コンテンツエリアを対象にするかどうか.
	 */
	function select(id, isContentArea) {
		var elem,
			metaData,
			initialVisible,
			mime = null,
			col;
		
		console.log("selectid", id);
		if (metaDataDict.hasOwnProperty(id)) {
			if (metaDataDict[id].hasOwnProperty('mime')) {
				mime = metaDataDict[id].mime;
			}
		}
		
		if (id === wholeWindowListID || id === wholeWindowID) {
			content_property.init(id, "", "whole_window", mime);
			content_property.assign_virtual_display(vscreen.getWhole(), vscreen.getSplitCount());
			if (gui.get_whole_window_elem()) {
				gui.get_whole_window_elem().style.borderColor = getWindowBorderColor(id);
			}
			return;
		}
		if (id.indexOf(wholeSubWindowID) >= 0) {
			return;
		}
		if (gui.get_whole_window_elem()) {
			gui.get_whole_window_elem().style.borderColor = "white";
		}
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
		elem.style.border = "solid 2px";
		
		if (selectedIDList.indexOf(id) < 0) {
			selectedIDList.push(id);
		}
		draggingIDList = JSON.parse(JSON.stringify(selectedIDList));
		
		if (selectedIDList.length <= 0) {
			manipulator.removeManipulator();
		} else if (selectedIDList.length > 1) {
			// 複数選択.
			manipulator.removeManipulator();
			if (metaData.type === windowType) {
				content_property.init(id, "", "multi_display", mime);
				if (gui.get_list_elem(id)) {
					gui.get_list_elem(id).style.borderColor = getWindowBorderColor(id);
				}
				if (gui.get_search_elem(id)) {
					gui.get_search_elem(id).style.borderColor = getWindowBorderColor(id);
				}
				elem.style.borderColor = getWindowBorderColor(id);
			} else {
				content_property.init(id, "", "multi_content", mime);
				col = getGroupColor(metaDataDict[id].group);
				if (gui.get_list_elem(id)) {
					gui.get_list_elem(id).style.borderColor = col;
				}
				if (gui.get_search_elem(id)) {
					gui.get_search_elem(id).style.borderColor = col;
				}
				elem.style.borderColor = col;
			}
		} else {
			// 単一選択.
			if (metaData.type === windowType) {
				content_property.init(id, "", "display", mime);
				content_property.assign_content_property(metaDataDict[id]);
				if (gui.get_list_elem(id)) {
					gui.get_list_elem(id).style.borderColor = getWindowBorderColor(id);
				}
				if (gui.get_search_elem(id)) {
					gui.get_search_elem(id).style.borderColor = getWindowBorderColor(id);
				}
				elem.style.borderColor = getWindowBorderColor(id);
				manipulator.showManipulator(elem, gui.get_display_preview_area(), metaData);
			} else {
				content_property.init(id, metaData.group, metaData.type, mime);
				content_property.assign_content_property(metaDataDict[id]);
				gui.set_update_content_id(id);
				col = getGroupColor(metaDataDict[id].group);
				if (gui.get_list_elem(id)) {
					gui.get_list_elem(id).style.borderColor = col;
				}
				if (gui.get_search_elem(id)) {
					gui.get_search_elem(id).style.borderColor = col;
				}
				//elem.style.borderColor = contentSelectColor;
				elem.style.borderColor = col;
				manipulator.showManipulator(elem, gui.get_content_preview_area(), metaData);
			}
		}

		if (isDisplayTabSelected()) {
			lastSelectWindowID = id;
		} else {
			lastSelectContentID = id;
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
	function unselect(id, updateText) {
		var elem = null,
			metaData,
			i;

		elem = getElem(id, true);
		if (elem) {
			metaData = metaDataDict[id];
			if (metaData.type !== windowType && isVisible(metaData) && String(metaData.mark) !== "true") {
				elem.style.border = "";
			}
			if (gui.get_list_elem(elem.id)) {
				if (metaData.hasOwnProperty('reference_count') && parseInt(metaData.reference_count, 10) <= 0) {
					gui.get_list_elem(elem.id).style.borderColor = "gray";
				} else {
					if (metaData.type !== windowType) {
						gui.get_list_elem(elem.id).style.borderColor = contentBorderColor;
						if (gui.get_search_elem(elem.id)) {
							gui.get_search_elem(elem.id).style.borderColor = contentBorderColor;
						}
					} else {
						gui.get_list_elem(elem.id).style.borderColor = "white";
						if (gui.get_search_elem(elem.id)) {
							gui.get_list_elem(elem.id).style.borderColor = "white";
						}
					}
				}
			}
			//elem.style.borderColor = "";
		}
		content_property.clear(updateText);
		selectedIDList.splice(selectedIDList.indexOf(id), 1);
		manipulator.removeManipulator();
	}
	
	function unselectAll(updateText) {
		var i;
		for (i = selectedIDList.length - 1; i >= 0; i = i - 1) {
			unselect(selectedIDList[i], updateText);
		}
		dragRect = {};
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
			unselect(id);
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
	 * ContentかDisplayの矩形サイズ変更時ハンドラ。initPropertyAreaのコールバックとして指定されている。
	 * @method changeRect
	 * @param {String} id ContentまたはDisplay ID
	 * @param {String} value 変更値
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
				vscreen_util.assignMetaData(elem, metaData, true, groupDict);
			}
			manipulator.removeManipulator();
		}
	};

	/**
	 * 指定された座標がContentまたはDisplayの内部に存在するかを判定する。setupContentsにて使用されている。
	 * @method isInsideElement
	 * @param {String} id ContentまたはDisplay ID
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
		window.onkeydown = function (evt) {
			if (evt.keyCode === 17) {
				onCtrlDown = true;
			}
		};
		window.onkeyup = function (evt) {
			if (evt.keyCode === 17) {
				onCtrlDown = false;
			}
		};
		elem.onmousedown = function (evt) {
			var rect = evt.target.getBoundingClientRect(),
				metaData = null,
				otherPreviewArea = gui.get_content_preview_area(),
				childs,
				i,
				elem,
				topElement = null,
				e;
			
			if (evt.button === 0) {
				
				if (metaDataDict.hasOwnProperty(id)) {
					metaData = metaDataDict[id];
					if (metaData.type !== windowType) {
						otherPreviewArea = gui.get_display_preview_area();
					}
				}

				
				if (metaData) {
					if (id === wholeWindowID ||
						(!isDisplayTabSelected() && metaData.type === windowType) ||
						(isDisplayTabSelected() && metaData.type !== windowType)) {
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
				}

				// erase last border
				if (!onCtrlDown) {
					unselectAll(true);
					select(id, isContentArea(evt));
					window.controller_gui.close_context_menu();
				} else  {
					select(id, isContentArea(evt));
					window.controller_gui.close_context_menu();
				}
				
				evt = (evt) || window.event;
				mouseDownPos = [
					rect.left,
					rect.top
				];

				dragOffsetTop = evt.clientY - rect.top;
				dragOffsetLeft = evt.clientX - rect.left;

				if (metaData  && evt.target.id) {
					// メインビューのコンテンツ
					for (i = 0; i < draggingIDList.length; i = i + 1) {
						elem = document.getElementById(draggingIDList[i]);
						if (elem) {
							dragRect[draggingIDList[i]] = {
								left : elem.getBoundingClientRect().left - rect.left,
								top : elem.getBoundingClientRect().top - rect.top
							}
						}
					}
				} else {
					// リストのコンテンツ
					for (i = 0; i < draggingIDList.length; i = i + 1) {
						dragRect[draggingIDList[i]] = {
							left : 0,
							top : 0
						}
					}
				}
			
				evt.stopPropagation();
				evt.preventDefault();
			}
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
	 * ContentまたはDisplayのスナップ処理
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
	 * @param {Element} elem 対象エレメント
	 * @param {JSON} metaData 対象メタデータ
	 * @param {Object} screen スナップ先スクリーン
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
			rect = evt.target.getBoundingClientRect(),
			rect2 = null,
			orgPos,
			mousePos,
			splitWhole,
			draggingID,
			selectedID,
			targetMetaDatas = [],
			screen;
			
		evt = (evt) || window.event;
		
        // mouse cursor position
        if(isUpdateCursorEnable && Date.now() % 2 === 0 && evt.target.id !== ''){
			mousePos = vscreen.transformOrgInv(vscreen.makeRect(evt.pageX, evt.pageY, 0, 0));
            var obj = {
                type: 'mouse',
                x: mousePos.x,
                y: mousePos.y
            };
            updateMetaData(obj);
        }

		if (evt.button !== 0) { return; } // 左ドラッグのみ
		
		
		for (i = 0; i < draggingIDList.length; i = i + 1) {
			draggingID = draggingIDList[i];

			// detect content list area
			if (isContentArea2(evt) && isContentArea(evt)) {
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
				if (screen && document.getElementById(screen.id)) {
					document.getElementById(screen.id).style.background = "red";
				}
			}

			// translate
			elem = document.getElementById(draggingID);
			if (elem.style.display === "none") {
				elem.style.display = "block";
			}
			metaData = metaDataDict[draggingID];

			if (dragRect.hasOwnProperty(draggingID)) {
				metaData.posx = evt.clientX - dragOffsetLeft + dragRect[draggingID].left;
				metaData.posy = evt.clientY - dragOffsetTop + dragRect[draggingID].top;
			} else {
				return;
			}

			vscreen_util.transPosInv(metaData);
			vscreen_util.assignMetaData(elem, metaData, true, groupDict);

			if (metaData.type === windowType || isVisible(metaData)) {
				manipulator.moveManipulator(elem);
				targetMetaDatas.push(metaData);
				//updateMetaData(metaData);
			}
		}

		if (targetMetaDatas.length > 0) {
			updateMetaDataMulti(targetMetaDatas);
		}

		if (manipulator.getDraggingManip()) {
			console.log("iscontentarea");
			// scaling
			elem = document.getElementById(getSelectedID());
			if (elem) {
				metaData = metaDataDict[elem.id];
				if (metaData.type === windowType || isVisible(metaData)) {
					onManipulatorMove(evt);
					manipulator.moveManipulator(elem);
				}
			}
			evt.stopPropagation();
			evt.preventDefault();
		}

		if (draggingIDList.length > 0) {
			evt.stopPropagation();
			evt.preventDefault();
		}

	});
	
	// add content mouseup event
	window.document.addEventListener("mouseup", function (evt) {
		var i,
			metaData,
			elem,
			px,
			py,
			rect = evt.target.getBoundingClientRect(),
			draggingID,
			orgPos,
			splitWhole,
			screen;

		for (i = draggingIDList.length - 1; i >= 0; i = i - 1) {
			draggingID = draggingIDList[i];
			if (metaDataDict.hasOwnProperty(draggingID)) {
				elem = document.getElementById(draggingID);
				metaData = metaDataDict[draggingID];
				if (!isContentArea(evt)) {
					//console.log("not onContentArea");
					metaData.visible = true;
					if (isFreeMode()) {
						vscreen_util.assignMetaData(elem, metaData, true, groupDict);
						updateMetaData(metaData);
					} else if (isDisplayMode()) {
						px = rect.left + dragOffsetLeft;
						py = rect.top + dragOffsetTop;
						orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
						screen = vscreen.getScreeByPos(orgPos.x, orgPos.y, draggingID);
						if (screen) {
							snapToScreen(elem, metaData, screen);
						}
						vscreen_util.assignMetaData(elem, metaData, true, groupDict);
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
						vscreen_util.assignMetaData(elem, metaData, true, groupDict);
						updateMetaData(metaData);
						manipulator.moveManipulator(elem);
					}
				}
				clearSnapHightlight();
			}
			draggingIDList.splice(i, 1);
			dragOffsetTop = 0;
			dragOffsetLeft= 0;
		}
		manipulator.clearDraggingManip();
	});
	
	/**
	 * テキストデータ送信
	 * @method sendText
	 * @param {String} text 送信するテキスト.
	 */
	function sendText(text, metaData) {
		var previewArea = gui.get_content_preview_area(),
			textInput = document.getElementById('text_input'),
			elem = document.createElement('pre'),
			width = (textInput.clientWidth + 1),
			height = (textInput.clientHeight + 1);
		
		if (!text) {
			text = "";
		}
		elem.className = "text_content";
		elem.innerHTML = text;
		previewArea.appendChild(elem);
		
		vscreen_util.transPosInv(metaData);
		metaData.width = elem.offsetWidth / vscreen.getWholeScale();
		metaData.height = elem.offsetHeight / vscreen.getWholeScale();
		metaData.group = gui.get_current_group_name();
		previewArea.removeChild(elem);
		metaData.type = "text";

		//currentContent = elem;
		addContent(metaData, text);
	}
	
	function sendImage(data, metaData) {
		var img = document.createElement('img'),
			buffer,
			blob,
		buffer = new Uint8Array(data);
		blob = new Blob([buffer], {type: "image/jpeg"});
		img.src = URL.createObjectURL(blob);
		img.className = "image_content";
		img.onload = (function (metaData) {
			return function () {
				metaData.type = "image";
				metaData.width = img.naturalWidth;
				metaData.height = img.naturalHeight;
				metaData.group = gui.get_current_group_name();
				vscreen_util.transPosInv(metaData);
				img.style.width = img.naturalWidth + "px";
				img.style.height = img.naturalHeight + "px";
				URL.revokeObjectURL(img.src);
				console.log("sendImage");
				addContent(metaData, data);
			};
		}(metaData));
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
				screenElem.id = windowData.id;
				screenElem.style.borderStyle = 'solid';
				previewArea.appendChild(screenElem);
				setupWindow(screenElem, windowData.id);
				vscreen_util.assignScreenRect(screenElem, vscreen.transformScreen(screens[windowData.id]));
			}
			if (screenElem) {
				vscreen_util.assignMetaData(screenElem, windowData, true, groupDict);
			}
		} else {
			content_property.assign_virtual_display(vscreen.getWhole(), vscreen.getSplitCount());
			//content_property.assign_view_setting(vscreen.getWholeScale(), isFreeMode(), isDisplayMode());
			
			// 全可視コンテンツの配置を再計算.
			for (i in metaDataDict) {
				if (metaDataDict.hasOwnProperty(i)) {
					metaData = metaDataDict[i];
					if (isVisible(metaData)) {
						if (metaData.type !== windowType) {
							elem = document.getElementById(metaData.id);
							if (elem) {
								vscreen_util.assignMetaData(elem, metaData, true, groupDict);
							}
						}
					}
				}
			}
			
			// Virtual Displayを生成して配置.
			wholeElem = document.getElementById(wholeWindowID);
			if (!wholeElem) {
				wholeElem = document.createElement('span');
				wholeElem.className = "whole_screen_elem";
				wholeElem.id = wholeWindowID;
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
								screenElem.id = s;
								console.log("screenElemID:" + JSON.stringify(screens[s]));
								screenElem.style.borderStyle = 'solid';
								previewArea.appendChild(screenElem);
								setupWindow(screenElem, s);
							}
						}
						if (screenElem) {
							vscreen_util.assignMetaData(screenElem, metaData, true, groupDict);
							vscreen_util.assignScreenRect(screenElem, vscreen.transformScreen(screens[s]));
						}
					}
				}
			}
			assignSplitWholes(vscreen.getSplitWholes());
		}
	};
	
	/**
	 * コンテンツタイプから適切なタグ名を取得する.
	 * @parma {String} contentType コンテンツタイプ
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
	 * エレメント間でコンテントデータをコピーする.
	 */
	function copyContentData(fromElem, toElem, metaData, isListContent) {
		var elem,
			id;
		
		for (id in metaDataDict) {
			if (metaDataDict.hasOwnProperty(id) && id !== metaData.id) {
				if (metaData.content_id === metaDataDict[id].content_id) {
					if (isListContent) {
						elem = gui.get_list_elem(id);
						if (elem) {
							elem = elem.childNodes[0];
						}
					} else {
						elem = document.getElementById(id);
					}
					if (elem && toElem) {
						if (metaData.type === 'text') {
							if (elem.innerHTML !== "") {
								toElem.innerHTML = elem.innerHTML;
							}
						} else if (elem.src) {
							toElem.src = elem.src;
						}
						if (!isListContent) {
							vscreen_util.assignMetaData(toElem, metaData, true, groupDict);
						}
					}
					if (elem && fromElem) {
						if (metaData.type === 'text') {
							elem.innerHTML = fromElem.innerHTML;
						} else {
							elem.src = fromElem.src;
						}
					}
				}
			}
		}
	}

	/**
	 * メタデータからコンテンツをインポートする
	 * @method importContent
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	function importContent(metaData, contentData) {
		window.content_list.import_content(metaDataDict, metaData, contentData, groupDict);
		window.content_view.import_content(metaDataDict, metaData, contentData, groupDict);
	}
	
	function changeWindowBorderColor(windowData) {
		var divElem = gui.get_list_elem(windowData.id);
		if (divElem) {
			if (windowData.hasOwnProperty('reference_count') && parseInt(windowData.reference_count, 10) <= 0) {
				if (divElem.style.borderColor !== "gray") {
					divElem.style.borderColor = "gray";
					divElem.style.color = "gray";
				}
			} else {
				if (divElem.style.borderColor !== "white") {
					divElem.style.borderColor = "white";
					divElem.style.color = "white";
				}
			}
		}
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
		divElem.style.margin = "5px";
		divElem.style.float = "left";
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
		if (!windowData || windowData === undefined || !windowData.hasOwnProperty('id')) { return; }
		window.window_view.import_window(metaDataDict, windowData);
		window.window_list.import_window(metaDataDict, windowData);
	}
	
	///-------------------------------------------------------------------------------------------------------
	
	/// meta data updated
	
	/**
	 * マークによるコンテンツ強調表示のトグル
	 * @param {Element} elem 対象エレメント
	 * @param {JSON} metaData メタデータ
	 */
	function toggleMark(elem, metaData) {
		var mark_memo = "mark_memo",
			mark = "mark";
		if (elem && metaData.hasOwnProperty("id")) {
			if (metaData.hasOwnProperty(mark) && (metaData[mark] === 'true' || metaData[mark] === true)) {
				if (!elem.classList.contains(mark)) {
					elem.classList.add(mark);
				}
			} else {
				if (elem.classList.contains(mark)) {
					elem.classList.remove(mark);
				}
			}
		}
	}

	/**
	 * GetMetaDataを送信した後の終了コールバック.
	 * @method doneGetMetaData
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneGetMetaData = function (err, reply, endCallback) {
		console.log('doneGetMetaData', reply);
		var json = reply,
			elem,
			metaData = json;
		if (!json.hasOwnProperty('id')) { return; }
		metaDataDict[json.id] = json;
		
		//vscreen_util.assignMetaData(document.getElementById(json.id), json, true);

		if ( (isDisplayTabSelected() && json.type === windowType) ||
			(!isDisplayTabSelected() && json.type !== windowType)) {
				if (lastSelectContentID === json.id || (manipulator.isShowManipulator() && lastSelectContentID === json.id)) {
					content_property.assign_content_property(json);
				}
			}

		
		if (json.type === windowType) { return; }
		elem = document.getElementById(metaData.id);
		if (elem) {
			if (isVisible(json)) {
				vscreen_util.assignMetaData(elem, json, true, groupDict);
				elem.style.display = "block";
			} else {
				elem.style.display = "none";
			}
			if (endCallback) {
				endCallback(null);
			}
			toggleMark(elem, metaData);
		} else {
			// 新規コンテンツロード.
			connector.send('GetContent', { type: json.type, id: json.id }, function (err, data) {
				doneGetContent(err, data, endCallback);
				toggleMark(elem, metaData);
			});
		}
	};
	
	/// content data updated
	/**
	 * GetContentを送信した後の終了コールバック.
	 * @method doneGetContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {Object} reply 返信されたコンテンツ
	 */
	doneGetContent = function (err, reply, endCallback) {
		console.log("doneGetContent", reply);
		if (!err) {
			importContent(reply.metaData, reply.contentData);
			if (endCallback) {
				endCallback(null);
			}
		} else {
			console.error(err);
		}
	};
	
	/**
	 * UpdateMetaDataを送信した後の終了コールバック.
	 * @method doneUpdateMetaData
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneUpdateMetaData = function (err, reply, endCallback) {
		console.log("doneUpdateMetaData", reply);
		var json = reply;

		if (reply.length === 1) {
			json = reply[0];
			metaDataDict[json.id] = json;
			if ( (isDisplayTabSelected() && json.type === windowType) ||
				(!isDisplayTabSelected() && json.type !== windowType)) {
					content_property.assign_content_property(json);
				}
		}
	
		if (endCallback) {
			endCallback(null);
		}
	};
	
	/**
	 * UpdateWindowMetaDataMultiを送信した後の終了コールバック.
	 * @method doneUpdateWindowMetaData
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneUpdateWindowMetaData = function (err, reply, endCallback) {
		console.log("doneUpdateWindowMetaData");
		var i,
			windowData,
			windowDataList = reply;
		for (i = 0; i < windowDataList.length; ++i) {
			windowData = windowDataList[i];
			vscreen.assignScreen(windowData.id, windowData.orgX, windowData.orgY, windowData.orgWidth, windowData.orgHeight);
			vscreen.setScreenSize(windowData.id, windowData.width, windowData.height);
			vscreen.setScreenPos(windowData.id, windowData.posx, windowData.posy);
			updateScreen(windowData);
		}
		if (endCallback) {
			endCallback(null);
		}
	};

	/**
	 * DeleteContentを送信した後の終了コールバック.
	 * @method doneDeleteContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneDeleteContent = function (err, reply) {
		console.log("doneDeleteContent", err, reply);
		var func = function (err, reply) {
			var json = reply,
				previewArea = gui.get_content_preview_area(),
				deleted = document.getElementById(json.id);
			manipulator.removeManipulator();
			if (deleted) {
				previewArea.removeChild(deleted);
			}
			if (gui.get_list_elem(json.id)) {
				gui.get_list_elem(json.id).parentNode.removeChild(gui.get_list_elem(json.id));
			}
			if (gui.get_search_elem(json.id)) {
				gui.get_search_elem(json.id).parentNode.removeChild(gui.get_search_elem(json.id));
			}
			gui.set_update_content_id("No Content Selected.");
			lastSelectContentID = null;
		}

		var i;

		for (i = 0; i < reply.length; i = i + 1) {
			func(err, reply[i]);
		}

	};

	/**
	 * DeleteWindowMetaDataを送信した後の終了コールバック.
	 * @method doneDeleteWindowMetaData
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneDeleteWindowMetaData = function (err, reply) {
		console.log("doneDeleteWindowMetaData", reply);
		var elem,
			id,
			windowData,
			displayArea = gui.get_display_area(),
			previewArea = gui.get_display_preview_area();
		
		manipulator.removeManipulator();
		if (reply.hasOwnProperty('id')) {
			elem = document.getElementById(reply.id);
			if (elem) {
				previewArea.removeChild(elem);
			}
			elem = gui.get_list_elem(reply.id);
			if (elem) {
				displayArea.removeChild(elem);
			}
			delete metaDataDict[reply.id];
		} else {
			// 全部消された.
			console.log(metaDataDict);
			for (id in metaDataDict) {
				if (metaDataDict.hasOwnProperty(id)) {
					windowData = metaDataDict[id];
					if (windowData.type === windowType) {
						elem = document.getElementById(id);
						if (elem) {
							previewArea.removeChild(elem);
						}
						elem = gui.get_list_elem(id);
						if (elem) {
							displayArea.removeChild(elem);
						}
					}
					delete metaDataDict[id];
				}
			}
		}
		lastSelectWindowID = null;
	};
	
	/**
	 * UpdateContentを送信した後の終了コールバック.
	 * @method doneUpdateContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneUpdateContent = function (err, reply) {
		console.log("doneUpdateContent");

		gui.set_update_content_id("No Content Selected.");
	};
	
	/**
	 * AddContentを送信した後の終了コールバック.
	 * @method doneAddContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneAddContent = function (err, reply) {
		var json = reply;
		console.log("doneAddContent:" + json.id + ":" + json.type);
		
		// 新規追加ではなく差し替えだった場合.
		if (metaDataDict.hasOwnProperty(json.id)) {
			doneUpdateContent(err, reply);
			return;
		}
		
		doneGetMetaData(err, reply);
	};
	
	/**
	 * GetWindowMetaDataを送信した後の終了コールバック.
	 * @method doneGetWindowMetaData
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneGetWindowMetaData = function (err, reply) {
		console.log('doneGetWindowMetaData:');
		var windowData = reply,
			elem;
		importWindow(windowData);
		if ( (isDisplayTabSelected() && reply.type === windowType) ||
			(!isDisplayTabSelected() && reply.type !== windowType)) {
				if (lastSelectWindowID === windowData.id || (manipulator.getDraggingManip() && lastSelectWindowID === windowData.id)) {
					content_property.assign_content_property(windowData);
				}
			}

/*
		if (lastSelectWindowID) {
			elem = document.getElementById(lastSelectWindowID);
			if (elem) {
				manipulator.moveManipulator(elem);
			}
		}
		*/
	};

	/**
	 * GetGroupListを送信した後の終了コールバック.
	 * @method doneGetGroupList
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneGetGroupList = function (err, reply) {
		console.log("doneGetGroupList", reply);
		var i,
			groupToElems = { default : [] },
			groupToMeta = { default : [] },
			group,
			elem,
			onlistID,
			meta,
			metaData,
			contentArea,
			selectedGroup,
			searchTargetGroups;

		selectedGroup = getSelectedGroup();

		if (!err && reply.hasOwnProperty('grouplist')) {
			// 一旦全部のリストエレメントをはずす.
			for (meta in metaDataDict) {
				if (metaDataDict.hasOwnProperty(meta)) {
					metaData = metaDataDict[meta];
					if (metaData.type !== windowType) {
						onlistID = "onlist:" + metaData.id;
						elem = document.getElementById(onlistID);
						if (elem) {
							elem.parentNode.removeChild(elem);
							if (metaData.hasOwnProperty('group')) {
								if (!groupToElems.hasOwnProperty(metaData.group)) {
									groupToElems[metaData.group] = [];
									groupToMeta[metaData.group] = [];
								}
								groupToElems[metaData.group].push(elem);
								groupToMeta[metaData.group].push(metaData);
							} else {
								groupToElems[defaultGroup].push(elem);
								groupToMeta[defaultGroup].push(metaData);
							}
						}
					}
				}
			}

			// 一旦チェックされているSearch対象グループを取得
			searchTargetGroups = gui.get_search_target_groups();

			// groupリストを新たにセットして, Searchタブ等を初期化
			gui.set_group_list(reply.grouplist);
			groupList = reply.grouplist;
			groupDict = {};
			for (i = 0; i < groupList.length; i = i + 1) {
				groupDict[groupList[i].name] = groupList[i];
			} 

			// 元々あったリストエレメントを全部つけなおす
			for (group in groupToElems) {
				if (groupToElems.hasOwnProperty(group)) {
					contentArea = gui.get_content_area_by_group(group);
					if (!contentArea) {
						contentArea = gui.get_content_area_by_group(defaultGroup);
					}
					for (i = 0; i < groupToElems[group].length; i = i + 1) {
						contentArea.appendChild(groupToElems[group][i]);
					}
				}
			}

			if (selectedGroup && document.getElementById(selectedGroup)) {
				document.getElementById(selectedGroup).onclick();
			}

			// Search対象グループをチェックし直す
			gui.check_search_target_groups(searchTargetGroups, true);
		}
	};
	
	/**
	 * GetVirtualDisplayを送信した後の終了コールバック.
	 * @method doneGetVirtualDisplay
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
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
			content_property.update_display_value();
			updateWindowData();
		}
	};
	
	///-------------------------------------------------------------------------------------------------------
	
	
	/**
	 * Displayを削除するボタンが押された.
	 * @method on_deletedisplay_clicked
	 */
	gui.on_deletedisplay_clicked = function () {
		var i,
			id,
			metaDataList = [];
			
		for (i = 0; i < selectedIDList.length; i = i + 1) {
			id = selectedIDList[i];
			if (metaDataDict.hasOwnProperty(id)) {
				metaDataList.push(metaDataDict[id]);
			}
		}
		if (metaDataList.length > 0) {
			connector.send('DeleteWindowMetaData', metaDataList, function () {});
		}
	};
	
	/**
	 * Group内のコンテンツ全て削除.
	 */
	gui.on_deleteallcontent_clicked = function () {
		var i,
			metaData,
			selectedGroup = getSelectedGroup(),
			targetList = [],
			groupToID = {};

		for (i = 0; i < groupList.length; ++i) {
			groupToID[groupList[i].name] = groupList[i].id;
		}
		
		if (selectedGroup) {
			for (i in metaDataDict) {
				if (metaDataDict.hasOwnProperty(i)) {
					if (metaDataDict[i] !== windowType) {
						if (groupToID[metaDataDict[i].group] === selectedGroup) {
							targetList.push(metaDataDict[i]);
						}
					}
				}
			}
		}
		if (targetList.length > 0) {
			connector.send('DeleteContent', targetList, doneDeleteContent);
		}
	};
	
	/**
	 * Show Display ID ボタンが押された.
	 * @method on_showidbutton_clicked
	 */
	gui.on_showidbutton_clicked = function (isAll) {
		var i,
			id,
			targetIDList = [];
			
		for (i = 0; i < selectedIDList.length; i = i + 1) {
			id = selectedIDList[i];
			if (metaDataDict.hasOwnProperty(id) && metaDataDict[id].type === windowType) {
				targetIDList.push({id : id});
			}
		}
		if (targetIDList.length > 0) {
			connector.send('ShowWindowID', targetIDList);
		}
	};
	
	/**
	 * VirualDisplay分割数変更
	 * @method on_change_whole_split
	 * @param {String} x x軸分割数
	 * @param {String} y y軸分割数
	 * @param {bool} withoutUpdate 設定後各Displayの更新をするかのフラグ
	 */
	content_property.on_change_whole_split = function (x, y, withoutUpdate) {
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
	};
	
	/**
	 * テキスト送信ボタンが押された.
	 * @param {Object} evt ボタンイベント.
	 */
	gui.on_textsendbutton_clicked = function (evt) {
		var textInput = document.getElementById('text_input'),
			text = textInput.value;
		
		textInput.value = "";
		sendText(text, { posx : 0, posy : 0 });
	};
	
	/**
	 * URLデータ送信ボタンが押された.
	 * @method on_sendbuton_clicked
	 */
	gui.on_urlsendbuton_clicked = function (value) {
		console.log("sendurl");
		var previewArea = gui.get_content_preview_area();

		value = value.split(' ').join('');
		if (value.indexOf("http") < 0) {
			console.error(value)
			return;
		}
		addContent({type : "url", user_data_text : JSON.stringify({ text: value }) }, value);
	};
	
	/** 
	 * 複製ボタンが押された
	 * @method on_duplicatebutton_clicked
	 * @param {Object} evt ボタンイベント.
	 */
	/*
	gui.on_duplicatebutton_clicked = function (evt) {
		console.log('duplicate', getSelectedID());
		var id = getSelectedID(),
			metaData,
			metaDataCopy;
		
		if (id) {
			if (metaDataDict.hasOwnProperty(id)) {
				metaData = metaDataDict[id];
				metaDataCopy = JSON.parse(JSON.stringify(metaData));
				delete metaDataCopy.id;
				addMetaData(metaDataCopy);
			}
		}
	};
	*/
	
	/**
	 * 画像ファイルFileOpenハンドラ
	 * @method on_imagefileinput_changed
	 * @param {Object} evt FileOpenイベント
	 */
	gui.on_imagefileinput_changed = function (evt) {
		var files = evt.target.files,
			file,
			i,
			fileReader = new FileReader();

				console.error();
		fileReader.onload = (function (name) {
			return function (e) {
				var data = e.target.result,
					img;
				if (data && data instanceof ArrayBuffer) {
					sendImage(data,  { posx : 0, posy : 0, visible : true, 
						user_data_text : JSON.stringify({ text: name }) });
				}
			};
		}(files[0].name));
		for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('image.*')) {
				fileReader.readAsArrayBuffer(file);
			}
		}
	};

	/**
	 *  ファイルドロップハンドラ
	 * @param {Object} evt FileDropイベント
	 */
	gui.on_file_dropped = function (evt) {
		var i,
			file,
			files = evt.dataTransfer.files,
			fileReader = new FileReader(),
			rect = evt.target.getBoundingClientRect(),
			px = rect.left + evt.offsetX,
			py = rect.top + evt.offsetY;

		fileReader.onloadend = function (e) {
			var data = e.target.result;
			if (data && data instanceof ArrayBuffer) {
				sendImage(data,  { posx : px, posy : py, visible : true });
			} else {
				sendText(data, { posx : px, posy : py, visible : true });
			}
		};
		for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('image.*')) {
				fileReader.readAsArrayBuffer(file);
			}
			if (file.type.match('text.*')) {
				fileReader.readAsText(file);
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
		
		fileReader.onloadend = function (e) {
			var data = e.target.result;
			if (data) {
				sendText(data, { posx : 0, posy : 0 });
			}
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
			elem,
			metaData;

		fileReader.onloadend = function (e) {
			if (e.target.result) {
				console.log("update_content_id", id);
				elem = document.getElementById(id);
				if (elem) {
					previewArea.removeChild(elem);
				}
				if (metaDataDict.hasOwnProperty(id)) {
					metaData = metaDataDict[id];
					metaData.type = "image";
					updateContent(metaData, e.target.result);
				}
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
	 * ディスプレイトランスが変更された.
	 */
	gui.on_display_trans_changed = function (dx, dy) {
		manipulator.removeManipulator();
		var center = vscreen.getCenter();
		var whole = vscreen.getWhole(),
			cx = window.innerWidth / 2,
			cy = window.innerHeight / 2;
		
		vscreen.assignWhole(whole.orgW, whole.orgH, center.x + dx, center.y + dy, vscreen.getWholeScale());
		updateScreen();
	};

	/**
	 * コンテンツの削除ボタンが押された.
	 * @method on_contentdeletebutton_clicked
	 */
	gui.on_contentdeletebutton_clicked = function (evt) {
		var i,
			id,
			metaData,
			metaDataList = [];
		
		for (i = 0; i < selectedIDList.length; i = i + 1) {
			id = selectedIDList[i];
			if (metaDataDict.hasOwnProperty(id)) {
				metaData = metaDataDict[id];
				metaData.visible = false;
				metaDataList.push(metaData);
			}
		}
		if (metaDataList.length > 0) {
			connector.send('DeleteContent', metaDataList, doneDeleteContent);
		}
	};

	/**
	 * コンテンツのzindex変更が要求された
	 * @param {boolean} isFront 最前面に移動ならtrue, 最背面に移動ならfalse
	 */
	gui.on_content_index_changed = function (isFront) {
		var id,
			i,
			k,
			max = 0,
			min = 0,
			metaData,
			metaDataList = [];
		
		for (k = 0; k < selectedIDList.length; k = k + 1) {
			id = selectedIDList[k];
			if (metaDataDict.hasOwnProperty(id)) {
				metaData = metaDataDict[id];
				for (i in metaDataDict) {
					if (metaDataDict.hasOwnProperty(i)) {
						if (metaDataDict[i].id !== metaData.id && 
							metaDataDict[i].type !== windowType &&
							metaDataDict[i].hasOwnProperty("zIndex")) {
							max = Math.max(max, parseInt(metaDataDict[i].zIndex, 10));
							min = Math.min(min, parseInt(metaDataDict[i].zIndex, 10));
						}
					}
				}
				if (isFront) {
					metaData.zIndex = max + 1;
				} else {
					metaData.zIndex = min - 1;
				}
				metaDataList.push(metaData);
			}
		}
		if (metaDataList.length > 0) {
			updateMetaDataMulti(metaDataList);
		}
	}

	/**
	 * コンテンツリストでセットアップコンテンツが呼ばれた
	 */
	window.content_list.on_setup_content = function (elem, uid) {
		setupContent(elem, uid);
	};

	/**
	 * コンテンツビューでセットアップコンテンツが呼ばれた
	 */
	window.content_view.on_setup_content = function (elem, uid) {
		setupContent(elem, uid);
	};

	/**
	 * コンテンツリストでコピーコンテンツが呼ばれた
	 */
	window.content_list.on_copy_content = function (fromElem, toElem, metaData, isListContent) {
		copyContentData(fromElem, toElem, metaData, isListContent);
	};

	/**
	 * コンテンツビューでコピーコンテンツが呼ばれた
	 */
	window.content_view.on_copy_content = function (fromElem, toElem, metaData, isListContent) {
		copyContentData(fromElem, toElem, metaData, isListContent);
	};

	/**
	 * コンテンツビューでinsertコンテンツが呼ばれた
	 */
	window.content_view.on_insert_content = function (area, elem) {
		insertElementWithDictionarySort(area, elem);
	};
	
	/**
	 * コンテンツビューで強調トグルが必要になった
	 */
	window.content_view.on_toggle_mark = function (contentElem, metaData) {
		toggleMark(contentElem, metaData);
	};

	/**
	 * ウィンドウリストでセットアップコンテンツが呼ばれた
	 */
	window.window_list.on_setup_content = function (elem, uid) {
		setupContent(elem, uid);
	};

	/**
	 * ウィンドウリストでスクリーン更新が呼ばれた
	 */
	window.window_view.on_update_screen = function (windowData) {
		updateScreen(windowData);
	};

	/**
	 * PropertyのDisplayパラメータ更新ハンドル
	 * @method on_display_value_changed
	 */
	content_property.on_display_value_changed = function () {
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
		content_property.update_whole_split(ix, iy, true);
	};

	/**
	 *  ディスプレイ枠色変更
	 */
	content_property.on_display_color_changed = function (colorvalue) {
		var id = getSelectedID(),
			metaData;
		if (metaDataDict.hasOwnProperty(id) && metaDataDict[id].type === windowType) {
			metaData = metaDataDict[id]; 
			metaData.color = colorvalue;
			updateMetaData(metaData, function (err, reply) {});
		}
	};
	
	/**
	 * スナップ設定のドロップダウンがクリックされた.
	 * @method on_snapdropdown_clicked
	 * @param {String} snapType スナップタイプ
	 */
	gui.on_snapdropdown_clicked = function (snapType) {
		snapSetting = snapType;
		saveCookie();
        var e = document.getElementById('head_menu_hover_left');
        if(e){
            var i, o;
            o = e.options;
            for(i = 0; i < o.length; ++i){
                if(snapType === o[i].value){
                    e.selectedIndex = i;
                    break;
                }
            }
        }
	};
	
	/**
	 * Virtual Dsiplay Settingボタンがクリックされた.
	 * @method on_virtualdisplaysetting_clicked
	 */
	gui.on_virtualdisplaysetting_clicked = function () {
		unselectAll(true);
		select(wholeWindowListID);
	};

	/**
	 * Group追加ボタンがクリックされた
	 */
	gui.on_group_append_clicked = function (groupName) {
		var groupColor = "rgb("+ Math.floor(Math.random() * 128 + 127) + "," 
				+ Math.floor(Math.random() * 128 + 127) + "," 
				+ Math.floor(Math.random() * 128 + 127) + ")";
				
		connector.send('AddGroup', { name : groupName, color : groupColor }, function (err, reply) {
			console.log("AddGroup done", err, reply);
		});
	};

	/**
	 * Group削除ボタンがクリックされた
	 */
	gui.on_group_delete_clicked = function (groupID) {
		var i,
			item;
		for (i = 0; i < groupList.length; i = i + 1) {
			item = groupList[i];
			if (item.id === groupID) {
				connector.send('DeleteGroup', item, (function (groupName) {
					return function (err, reply) {
						console.log("DeleteGroup done", err, reply);
						var deleteList = [],
							id,
							metaData;
						console.log("UpdateGroup done", err, reply);
						if (!err) {
							// コンテンツも削除
							for (id in metaDataDict) {
								if (metaDataDict.hasOwnProperty(id)) {
									metaData = metaDataDict[id];
									if (metaData.type !== windowType) {
										if (metaData.group === groupName) {
											deleteList.push(metaData);
										}
									}
								}
							}
							if (deleteList.length > 0) {
								connector.send('DeleteContent', deleteList, doneDeleteContent);
							}
						}
					};
				}(item.name)));
				return;
			}
		}
	};

	/**
	 * Group変更がクリックされた
	 * @param {String} groupName 変更先のグループ名
	 */
	gui.on_group_change_clicked = function (groupName) {
		var i,
			k,
			id,
			targetMetaDataList = [],
			group,
			metaData;

		for (i = 0; i < selectedIDList.length; i = i + 1) {
			id = selectedIDList[i];
			if (metaDataDict.hasOwnProperty(id)) {
				metaData = metaDataDict[id];
				metaData.group = groupName;

				for (k = 0; k < groupList.length; k = k + 1) {
					if (groupList[k].name === groupName) {
						targetMetaDataList.push(metaData);
						group = groupList[k];
						break;
					}
				}
			}
		}

		if (targetMetaDataList.length > 0) {
			updateMetaDataMulti(targetMetaDataList, (function (group) {
				return function (err, data) {
					connector.send('UpdateGroup', group, function (err, reply) {});
					//updateGroupList();
				};
			}(group)));
		}
	};

	gui.on_select_contents_clicked = function (onlyCurrentGroup) {
		var i,
			id,
			currentGroup = gui.get_current_group_name();

		unselectAll(true);
		for (id in metaDataDict) {
			if (metaDataDict.hasOwnProperty(id)) {
				if (metaDataDict[id].type !== windowType) {
					if (onlyCurrentGroup) {
						if (metaDataDict[id].group === currentGroup) {
							select(id, true);
						}
					} else {
						select(id, true);
					}
				}
			}
		}
	};

	gui.on_select_display_clicked = function () {
		var i,
			id;
		unselectAll(true);
		for (id in metaDataDict) {
			if (metaDataDict.hasOwnProperty(id)) {
				if (metaDataDict[id].type === windowType) {
					select("onlist:" + id, true);
				}
			}
		}
	};

	/**
	 * Groupを１つ下に
	 * @param {String} groupName 変更先のグループ名
	 */
	gui.on_group_down = function (groupName) {
		var i,
			target;

		for (i = 0; i < groupList.length; i = i + 1) {
			if (groupList[i].name === groupName) {
				if (i > 0 && i < (groupList.length - 1)) {
					target = {
						id : groupList[i].id,
						index : i + 2
					};
					connector.send('ChangeGroupIndex', target, function (err, reply) {
						console.log("ChangeGroupIndex done", err, reply);
					});
					return;
				}
			}
		}
	};

	/**
	 * Groupを１つ上に
	 * @param {String} groupName 変更先のグループ名
	 */
	gui.on_group_up = function (groupName) {
		var i,
			target;

		for (i = 0; i < groupList.length; i = i + 1) {
			if (groupList[i].name === groupName) {
				if (i > 1 && i <= (groupList.length - 1)) {
					target = {
						id : groupList[i].id,
						index : i - 1
					};
					connector.send('ChangeGroupIndex', target, function (err, reply) {
						console.log("ChangeGroupIndex done", err, reply);
					});
					return;
				}
			}
		}
	};

	/**
	 * Group名変更
	 */
	window.controller_gui.on_group_edit_name =　function (groupID, groupName) {
		var i,
			oldName,
			targetMetaDataList = [],
			item;

		for (i = 0; i < groupList.length; i = i + 1) {
			item = groupList[i];
			if (item.id === groupID) {
				oldName = item.name;
				item.name = groupName;
				connector.send('UpdateGroup', item, (function (oldName, newName) {
					return function (err, reply) {
						var id,
							metaData;
						console.log("UpdateGroup done", err, reply);
						if (!err) {
							// コンテンツのグループ名も変更
							for (id in metaDataDict) {
								if (metaDataDict.hasOwnProperty(id)) {
									metaData = metaDataDict[id];
									if (metaData.type !== windowType) {
										if (metaData.group === oldName) {
											metaData.group = newName;
											updateMetaData(metaData);
										}
									}
								}
							}
						}
					};
				}(oldName, groupName)));
			}
		}
	};
	
	/**
	 * Group色変更
	 */
	window.controller_gui.on_group_edit_color = function (groupID, color) {
		var i,
			item;

		for (i = 0; i < groupList.length; i = i + 1) {
			item = groupList[i];
			if (item.id === groupID) {
				item.color = color;
				connector.send('UpdateGroup', item, function (err, reply) {
					console.log("UpdateGroup done", err, reply);
				});
				return;
			}
		}
	};

	/**
	 * Searchテキストが入力された
	 */
	gui.on_search_input_changed = function (text, groups) {
		var i,
			id, 
			metaData,
			foundContents = [],
			groupDict = {},
			elem,
			copy,
			child;
			
		for (i = 0; i < groupList.length; i = i + 1) {
			groupDict[groupList[i].name] = groupList[i];
		}

		for (id in metaDataDict) {
			if (metaDataDict.hasOwnProperty(id)) {
				metaData = metaDataDict[id];
				if (metaData.type !== windowType) {
					if (groups.indexOf(metaData.group) >= 0) {
						if (text === "" || JSON.stringify(metaData).indexOf(text) >= 0) {
							elem = document.getElementById("onlist:" + metaData.id);
							if (elem) {
								copy = elem.cloneNode();
								copy.id = "onsearch:" + metaData.id;
								child = elem.childNodes[0].cloneNode();
								child.innerHTML = elem.childNodes[0].innerHTML;
								copy.appendChild(child);
								setupContent(copy, metaData.id);
								foundContents.push(copy);
							}
						}
					}
					else if (groups.indexOf(defaultGroup) >= 0 && !groupDict.hasOwnProperty(metaData.group)) {
						elem = document.getElementById("onlist:" + metaData.id);
						if (elem) {
							copy = elem.cloneNode();
							copy.id = "onsearch:" + metaData.id;
							child = elem.childNodes[0].cloneNode();
							child.innerHTML = elem.childNodes[0].innerHTML;
							copy.appendChild(child);
							setupContent(copy, metaData.id);
							foundContents.push(copy);
						}
					}
				}
			}
		}
		gui.set_search_result(foundContents);
	};
	
	/**
	 * 選択中のコンテンツのzIndexを変更する
	 * @method on_change_zindex
	 * @param {String} index 設定するzIndex
	 */
	content_property.on_change_zindex = function (index) {
		var i,
			id,
			elem,
			metaData;
		for (i = 0; i < selectedIDList.length; i = i + 1) {
			id = selectedIDList[i];
			metaData = metaDataDict[id];
			elem = document.getElementById(id);
			if (metaData && elem) {
				elem.style.zIndex = index;
				metaData.zIndex = index;
				updateMetaData(metaData);
				console.log("change zindex:" + index, id);
			}
		}
	};
	
	/**
	 * タブが切り替えられた.
	 */
	content_box.on_tab_changed_pre = function () {
		manipulator.removeManipulator();
		unselectAll(true);
	};

	content_box.on_tab_changed_post = function () {
		var id;
		if (isDisplayTabSelected()) {
			content_property.init("", "", "display");
		} else {
			content_property.init("", "", "content");
		}
		if (isDisplayTabSelected()) {
			id = lastSelectWindowID;
			if (!id) {
				id = wholeWindowListID;
			}
		} else {
			id = lastSelectContentID;
		}
		selectedIDList = [];
		// 以前選択していたものを再選択する.
		if (id) {
			select(id, false);
		}
		draggingIDList = [];
	}

	/**
	 * マニピュレータの星がトグルされた
	 */
	manipulator.on_toggle_star = function (is_active) {
		var id = getSelectedID(),
			metaData;
		if (metaDataDict.hasOwnProperty(id)) {
			metaData = metaDataDict[id];
			metaData.mark = is_active;
			updateMetaData(metaData);
		}
	};

	/**
	 * マニピュレータのmemoがトグルされた
	 */
	manipulator.on_toggle_memo = function (is_active) {
		var id = getSelectedID(),
			metaData;
		if (metaDataDict.hasOwnProperty(id)) {
			metaData = metaDataDict[id];
			if (metaData.type === windowType) {
				gui.on_showidbutton_clicked(false);
			} else {
				metaData.mark_memo = is_active;
				updateMetaData(metaData);
			}
		}
	};

	/**
	 * orgWidth,orgHeightを元にアスペクト比を調整
	 * @method correctAspect
	 * @param {JSON} metaData メタデータ
	 * @param {Function} endCallback 終了時コールバック
	 */
	function correctAspect(metaData, endCallback) {
		var w, h, ow, oh,
			aspect, orgAspect,
			isCorrect = true;
		if (metaData.hasOwnProperty('orgWidth') && metaData.hasOwnProperty('orgHeight')) {
			if (metaData.hasOwnProperty('width') && metaData.hasOwnProperty('height')) {
				w = parseFloat(metaData.width);
				h = parseFloat(metaData.height);
				ow = parseFloat(metaData.orgWidth);
				oh = parseFloat(metaData.orgHeight);
				aspect = w / h;
				orgAspect = ow / oh;
				if (orgAspect !== aspect) {
					if (aspect > 1) {
						metaData.height = w / orgAspect;
					} else {
						metaData.width = h * orgAspect;
					}
					isCorrect = false;
					connector.send('UpdateMetaData', metaData, function (err, metaData) {
						if (endCallback) {
							endCallback(err, metaData);
						}
					});
				}
			}
		}
		if (isCorrect && endCallback) {
			endCallback(null, metaData);
		}
	}
	
	///-------------------------------------------------------------------------------------------------------
	// メタデータが更新されたときにブロードキャストされてくる.
	connector.on("UpdateMetaData", function (data) {
		var i,
			elem,
			id,
			metaData;

		for (i = 0; i < data.length; ++i) {
			metaData = data[i];
			id = metaData.id;
			if (id) {
				doneGetMetaData(null, metaData);
				if (getSelectedID()) {
					elem = document.getElementById(getSelectedID());
					if (elem) {
						manipulator.moveManipulator(elem);
					}
				}
			}
		}
	});
	
	// コンテンツが差し替えられたときにブロードキャストされてくる.
	connector.on('UpdateContent', function (metaData) {
		console.log('UpdateContent', metaData);
		var id = metaData.id;
		if (id) {
			connector.send('GetContent', metaData, function (err, reply) {
				correctAspect(reply.metaData, function (err, meta) {
					reply.metaData = meta;
					doneGetContent(err, reply);
					doneGetMetaData(err, meta);
				});
			});
		}
	});
	
	// windowが更新されたときにブロードキャストされてくる.
	connector.on("UpdateWindowMetaData", function (data) {
		console.log("onUpdateWindowMetaData", data);
		var i,
			metaData;
		for (i = 0; i < data.length; ++i) {
			metaData = data[i];
			if (metaDataDict.hasOwnProperty(metaData.id) && metaDataDict[metaData.id].hasOwnProperty('reference_count')) {
				if (metaDataDict[metaData.id].reference_count !== metaData.reference_count) {
					changeWindowBorderColor(metaData);
				}
			}
			doneGetWindowMetaData(null, metaData);
		}
	});

	// グループが更新されたときにブロードキャストされてくる.
	connector.on('UpdateGroup', function (metaData) {
		console.log("onUpdateGroup")
		updateGroupList();
	});

	// すべての更新が必要なときにブロードキャストされてくる.
	var isInitialUpdate = true;
	connector.on('Update', function () {
		console.log("on update");
		manipulator.removeManipulator();
		update(function () {
			if (isInitialUpdate) {
				var checkbox = document.getElementById('all_check_');
				if (checkbox) {
					checkbox.onclick();
				}
				isInitialUpdate = false;
			}
		});
		clearWindowList();
		addWholeWindowToList();
		updateScreen();
	});
	
	// windowが更新されたときにブロードキャストされてくる.
	connector.on('UpdateMouseCursor', function (metaData) {});
	
	// コンテンツが削除されたときにブロードキャストされてくる.
	connector.on("DeleteContent", function (data) {
		console.log("onDeleteContent", data);
		var i;
		doneDeleteContent(null, data);
	});
	
	// ウィンドウが削除されたときにブロードキャストされてくる.
	connector.on("DeleteWindowMetaData", function (metaDataList) {
		console.log("DeleteWindowMetaData", metaDataList);
		var i;
		for (i = 0; i < metaDataList.length; i = i + 1) {
			doneDeleteWindowMetaData(null, metaDataList[i]);
		}
	});

	///-------------------------------------------------------------------------------------------------------
	/**
	 * コントローラ初期化
	 * @method init
	 */
	function init() {
		var timer = null,
			display_scale,
			update_cursor_enable,
			snap;
			
		display_scale = parseFloat(getCookie('display_scale'));
		update_cursor_enable = getCookie('update_cursor_enable');
		console.log("cookie - display_scale:" + display_scale);
		snap = getCookie('snap_setting');
		console.log("cookie - snap_setting:" + snap);
		if (!isNaN(display_scale) && display_scale > 0) {
			vscreen.setWholeScale(display_scale, true);
			gui.set_display_scale(display_scale);
		}
		if (snap) {
			if (snap === 'display') {
				snapSetting = 'display';
			}
            window.controller_gui.on_snapdropdown_clicked(snap);
		}
		document.getElementById('head_menu_hover_left').addEventListener('change', function(eve){
			var f = eve.currentTarget.value;
			window.controller_gui.on_snapdropdown_clicked(f);
		}, false);

		if (update_cursor_enable && update_cursor_enable === "true") {
			updateRemoteCursorEnable(true);
		} else {
			updateRemoteCursorEnable(false);
		}

		content_property.on_rect_changed = function () {
			console.log('on_rect_changed');
			changeRect(this.id, parseInt(this.value, 10));
		};

		content_property.on_metainfo_changed = function (text, endCallback) {
			var id = getSelectedID(),
				metaData;
			
			if (id && metaDataDict.hasOwnProperty(id)) {
				metaData = metaDataDict[id];
				metaDataDict[id] = metaData;
				metaData.user_data_text = JSON.stringify({ text: text });
				updateMetaData(metaData, function (err, reply) {
					if (endCallback) {
						endCallback(null);
					}
				});
			} else {
				if (endCallback) {
					endCallback(null);
				}
			}
		};
		
		gui.on_mousedown_content_preview_area = function () {
			if (!manipulator.getDraggingManip()) {
				unselectAll(true);
			}
		};
		
		gui.on_mousedown_display_preview_area = function () {
			if (!manipulator.getDraggingManip()) {
				unselectAll(true);
			}
		};

		gui.on_update_cursor_enable = updateRemoteCursorEnable;
		
		gui.on_close_item = function () {
			var i,
				id,
				metaData,
				elem,
				metaDataList = [];

			manipulator.removeManipulator();
			for (i = 0; i < selectedIDList.length; i = i + 1) {
				id = selectedIDList[i]; 
				if (metaDataDict.hasOwnProperty(id)) {
					metaData = metaDataDict[id];
					metaData.visible = false;
					metaDataList.push(metaData);
				}
			}
			if (metaDataList.length > 0) {
				updateMetaDataMulti(metaDataList);
			}
		};
		
		gui.init();
		window.window_view.init(vscreen);
		connector = window.io_connector;
		
		manipulator.setDraggingOffsetFunc(function (top, left) {
			dragOffsetTop = top;
			dragOffsetLeft = left;
		});
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
	window.onunload = function () {
		window.content_property.clear(true);
	};
	window.onblur = function () {
		window.content_property.clear(true);
		onCtrlDown = false;
	};
	connector.connect(function () {
		var e = document.getElementById('head_menu_hover_right');
		if(e){
			//e.textContent = '○';
			e.title = 'サーバーと接続されています';
			e.className = 'connect';
		}
	}, function () {
		var e = document.getElementById('head_menu_hover_right');
		if(e){
			//e.textContent = '×';
			e.title = 'サーバーと接続できていません';
			e.className = 'disconnect';
		}
	});

}(window.controller_gui, window.content_property, window.content_box, 
window.vscreen, window.vscreen_util, window.manipulator, window.io_connector));
