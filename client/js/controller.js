/*jslint devel:true */
/*global FileReader, Uint8Array, Blob, URL, event, unescape, $, $show, $hide */

(function (content_property, vscreen, vscreen_util, manipulator, connector) {
	"use strict";
	
	var store = new Store(),
		state = new State(),
		gui = new ControllerGUI(),
		login = new Login(connector, Cookie),
		management, // 管理情報
		onCtrlDown = false, // Ctrlボタンを押してるかどうか
		dragOffsetTop = 0,
		dragOffsetLeft = 0,
		dragRect = {},
		mouseDownPos = [],
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
		doneDeleteWindowMetaData,
		video = document.createElement('video'); // TODO 複数に対応
	
	Validator.init(gui);

	/**
	 * リストエレメントのボーダーカラーをタイプ別に返す
	 */
	function getListBorderColor(meta) {
		if (Validator.isWindowType(meta)) {
			if (meta.hasOwnProperty('reference_count') && parseInt(meta.reference_count, 10) <= 0) {
				return "gray";
			} else {
				return "white";
			}
		}
		if (Validator.isContentType(meta)) {
			return "rgba(0,0,0,0)";
		}
		if (Validator.isLayoutType(meta)) {
			return "lightgray";
		}
		return "white";
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
	 * @param {bool} isListViewArea リストビュー上のエレメントか
	 * @return {Object} Element
	 */
	function getElem(id, isListViewArea) {
		var elem,
			uid,
			previewArea,
			child,
			srcElem;
		
		if (id === Constants.WholeWindowListID) { return null; }
		if (Validator.isUnvisibleID(id)) {
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
				
				if (Validator.isDisplayTabSelected()) {
					previewArea = gui.get_display_preview_area();
				} else {
					previewArea = gui.get_content_preview_area();
				}
				if (isListViewArea) {
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
		if (state.get_selected_id_list().length > 0) {
			return state.get_selected_id_list()[0];
		}
		return null;//contentID.innerHTML;
	}
	
	/**
	 * 選択されているGroupIDを返却する
	 * @method getSelectedGroup
	 * @return {String} グループID
	 */
	function getSelectedGroup() {
		return gui.get_current_group_id();
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
			if (!err) {
				var last = reply.last; 
				delete reply.last;
				doneGetMetaData(err, reply, function (err) {
					//updateGroupList();
					if (last) {
						updateGroupList(function () {
							if (endCallback) {
								endCallback();
							}
						});
					}
				});
			}
		});
		connector.send('GetVirtualDisplay', {type: "all", id: ""}, doneGetVirtualDisplay);
		connector.send('GetWindowMetaData', {type: "all", id: ""}, doneGetWindowMetaData);
		updateGroupList();
	}
	
	/**
	 * コンテンツのzindexの習得.
	 * @param {boolean} isFront 最前面に移動ならtrue, 最背面に移動ならfalse
	 * */
	function getZIndex(metaData, isFront) {
		var max = 0,
			min = 0;

		store.for_each_metadata(function (i, meta) {
			if (meta.id !== metaData.id && 
				Validator.isContentType(meta.type) &&
				meta.hasOwnProperty("zIndex")) {
				max = Math.max(max, parseInt(meta.zIndex, 10));
				min = Math.min(min, parseInt(meta.zIndex, 10));
			}
		});
		if (isFront) {
			return max + 1;
		} else {
			return min - 1;
		}
	}

	/**
	 * Content追加
	 * @method addContent
	 * @param {JSON} metaData コンテンツのメタデータ
	 * @param {BLOB} binary コンテンツのバイナリデータ
	 */
	function addContent(metaData, binary) {
		if (!metaData.hasOwnProperty("zIndex")) {
			metaData.zIndex = getZIndex(metaData, true);
		}
		connector.sendBinary('AddContent', metaData, binary, doneAddContent);
	}
	
	/**
	 * メタデータ(Display, 他コンテンツ)の幾何情報の更新通知を行う。
	 * @method updateMetaData
	 * @param {JSON} metaData メタデータ
	 */
	function updateMetaData(metaData, endCallback) {
		if (Validator.isWindowType(metaData)) {
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
			if (management.isEditable(metaData.group)) {
				connector.send('UpdateMetaData', [metaData], function (err, reply) {
					doneUpdateMetaData(err, reply, endCallback);
				});
			}
		}
	}
	
	/**
	 * メタデータ(Display, 他コンテンツ)の幾何情報の更新通知を行う。
	 * @method updateMetaData
	 * @param {JSON} metaData メタデータ
	 */
	function updateMetaDataMulti(metaDataList, endCallback) {
		if (metaDataList.length > 0) {
			if (Validator.isWindowType(metaDataList[0])) {
				connector.send('UpdateWindowMetaData', metaDataList, function (err, reply) {
					doneUpdateWindowMetaData(err, reply, endCallback);
				});
			} else {
				// １つでも変更可能なデータが含まれていたら送る.
				var isEditable = false;
				var i;
				for (i = 0; i < metaDataList.length; i = i + 1) {
					isEditable = isEditable || management.isEditable(metaDataList[i].group);
				}
				if (isEditable) {
					connector.send('UpdateMetaData', metaDataList, function (err, reply) {
						doneUpdateMetaData(err, reply, endCallback);
					});
				}
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
			windowData.orgWidth = Constants.InitialWholeWidth;
		}
		if (!windowData.orgHeight || isNaN(windowData.orgHeight)) {
			windowData.orgHeight = Constants.InitialWholeHeight;
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
		Cookie.setUpdateCursorEnable(isEnable);
		if (!isEnable) {
			connector.send('UpdateMouseCursor', {}, function (err, reply) {});
		}
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
	function getGroupColor(groupID) {
		store.for_each_group(function (i, group) {
			if (group.id === groupID) {
				if (group.color) {
					return group.color;
				}
			}
		});
		return Constants.ContentSelectColor;
	}

	/**
	 * 枠色を返す
	 */
	function getBorderColor(meta) {
		if (Validator.isWindowType(meta)) {
			if (meta.hasOwnProperty('color')) {
				return meta.color;
			}
			return "#0080FF";
		}
		return getGroupColor(meta.group);
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
			invAspect,
			pageX = evt.pageX,
			pageY = evt.pageY,
			clientX = evt.clientX,
			clientY = evt.clientY;

		if (evt.changedTouches) {
			pageX = evt.changedTouches[0].pageX,
			pageY = evt.changedTouches[0].pageY,
			clientX = evt.changedTouches[0].clientX;
			clientY = evt.changedTouches[0].clientY;
		}
		
		if (draggingManip) {
			elem = document.getElementById(getSelectedID());
			if (elem) {
				metaData = store.get_metadata(elem.id);
				if (Validator.isContentType(metaData) && !Validator.isVisible(metaData)) {
					// 非表示コンテンツ
					return;
				}
				if (!management.isEditable(metaData.group)) {
					// 編集不可コンテンツ
					return;
				}
				vscreen_util.trans(metaData);
				lastx = metaData.posx;
				lasty = metaData.posy;
				lastw = metaData.width;
				lasth = metaData.height;
				invAspect = metaData.orgHeight / metaData.orgWidth;


				if (draggingManip.id === '_manip_0' || draggingManip.id === '_manip_1') {
					px = clientX - dragOffsetLeft;
					py = clientY - dragOffsetTop;
					currentw = lastw - (px - lastx);
				} else {
					px = clientX - lastw - dragOffsetLeft;
					py = clientY - dragOffsetTop;
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
				store.set_metadata(metaData.id, metaData);
				updateMetaData(metaData);
			}
		}
	}
	
	/**
	 * ContentかDisplayを選択する。
	 * @method select
	 * @param {String} id 選択したID
	 * @parma {bool} isListViewArea リストビューを対象にするかどうか.
	 */
	function select(id, isListViewArea) {
		var elem,
			metaData,
			initialVisible,
			mime = null,
			col;
		
		console.log("selectid", id);
		if (store.has_metadata(id)) {
			metaData = store.get_metadata(id);
			if (metaData.hasOwnProperty('mime')) {
				mime = metaData.mime;
			}
		}
		
		if (id === Constants.WholeWindowListID || id === Constants.WholeWindowID) {
			content_property.init(id, null, "", "whole_window", mime);
			content_property.assign_virtual_display(vscreen.getWhole(), vscreen.getSplitCount());
			if (gui.get_whole_window_elem() && metaData) {
				gui.get_whole_window_elem().style.borderColor = getBorderColor(metaData);
			}
			return;
		}
		if (id.indexOf(Constants.WholeSubWindowID) >= 0) {
			return;
		}
		if (gui.get_whole_window_elem()) {
			gui.get_whole_window_elem().style.borderColor = "white";
		}
		elem = getElem(id, isListViewArea);
		if (elem.id !== id) {
			id = elem.id;
		}
		metaData = store.get_metadata(id);
		if (metaData.hasOwnProperty('mime')) {
			mime = metaData.mime;
		}
		
		console.log("metaData", metaData);
		initialVisible = metaData.visible;
		elem.style.border = "solid 2px";
		
		if (state.get_selected_id_list().indexOf(id) < 0) {
			state.get_selected_id_list().push(id);
		}
		state.set_dragging_id_list(JSON.parse(JSON.stringify(state.get_selected_id_list())));
		
		// 選択ボーダー色設定
		if (gui.get_list_elem(id)) {
			gui.get_list_elem(id).style.borderColor = getBorderColor(metaData);
		}
		if (gui.get_search_elem(id)) {
			gui.get_search_elem(id).style.borderColor = getBorderColor(metaData);
		}
		elem.style.borderColor = getBorderColor(metaData);

		if (state.get_selected_id_list().length <= 0) {
			manipulator.removeManipulator();
		} else if (state.get_selected_id_list().length > 1) {
			// 複数選択. マニピュレーター, プロパティ設定
			manipulator.removeManipulator();
			if (Validator.isWindowType(metaData)) {
				content_property.init(id, null, "", Constants.PropertyTypeMultiDisplay, mime);
			} else {
				content_property.init(id, null,"", Constants.PropertyTypeMultiContent, mime);
			}
		} else {
			// 単一選択.マニピュレーター, プロパティ設定
			if (Validator.isWindowType(metaData)) {
				content_property.init(id, null,"", Constants.DisplayTabType, mime);
				content_property.assign_content_property(metaData);
				manipulator.showManipulator(management.getAuthorityObject(), elem, gui.get_display_preview_area(), metaData);
			} else {
				if (store.has_group(metaData.group)) {
					content_property.init(id, metaData.group, store.get_group(metaData.group).name, metaData.type, mime);
				} else {
					console.warn("not found group", metaData)
					content_property.init(id, null, "", metaData.type, mime);
				}
				content_property.assign_content_property(metaData);
				gui.set_update_content_id(id);
				manipulator.showManipulator(management.getAuthorityObject(), elem, gui.get_content_preview_area(), metaData);
			}
		}

		if (Validator.isDisplayTabSelected()) {
			state.set_last_select_window_id(id);
		} else {
			state.set_last_select_content_id(id);
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
			metaData = store.get_metadata(id);
			if (Validator.isWindowType(metaData)) {
				elem.style.border = "";
				elem.style.borderStyle = "solid";
			}
			if (Validator.isContentType(metaData) && Validator.isVisible(metaData) && String(metaData.mark) !== "true") {
				elem.style.border = "";
			}
			if (gui.get_list_elem(elem.id)) {
				gui.get_list_elem(elem.id).style.borderColor = getListBorderColor(metaData);
				if (gui.get_search_elem(elem.id)) {
					gui.get_search_elem(elem.id).style.borderColor = getListBorderColor(metaData);
				}
			}
		}
		content_property.clear(updateText);
		state.get_selected_id_list().splice(state.get_selected_id_list().indexOf(id), 1);
		manipulator.removeManipulator();
	}
	
	function unselectAll(updateText) {
		var i;
		for (i = state.get_selected_id_list().length - 1; i >= 0; i = i - 1) {
			unselect(state.get_selected_id_list()[i], updateText);
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
		if (store.has_metadata(id)) {
			unselect(id);
			elem = getElem(id, false);
			
			metaData = store.get_metadata(id);
			if (!management.isEditable(metaData.group)) {
				// 編集不可コンテンツ
				return;
			}
			
			metaData.visible = false;
			
			if (Validator.isWindowType(metaData)) {
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
			metaData = store.get_metadata(elem.id);
			if (!management.isEditable(metaData.group)) {
				// 編集不可コンテンツ
				return;
			}
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
		
		if (store.has_metadata(elem.id)) {
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
		function mousedownFunc(evt) {
			var rect = evt.target.getBoundingClientRect(),
				metaData = null,
				otherPreviewArea = gui.get_content_preview_area(),
				childs,
				i,
				elem,
				topElement = null,
				e,
				pageX = evt.pageX,
				pageY = evt.pageY,
				clientX = evt.clientX,
				clientY = evt.clientY,
				target = evt.taget;
			
			if (evt.changedTouches) {
				// タッチ
				target = evt.changedTouches[0].target;
				rect = evt.changedTouches[0].target.getBoundingClientRect();
				pageX = evt.changedTouches[0].pageX,
				pageY = evt.changedTouches[0].pageY,
				clientX = evt.changedTouches[0].clientX;
				clientY = evt.changedTouches[0].clientY;
			} else {
				// マウス
				if (evt.button !== 0) { return; } // 左ドラッグのみ
			}
			
			if (store.has_metadata(id)) {
				metaData = store.get_metadata(id);
				if (Validator.isContentType(metaData)) {
					otherPreviewArea = gui.get_display_preview_area();
				}
			}

			
			if (metaData) {
				if (id === Constants.WholeWindowID ||
					(!Validator.isDisplayTabSelected() && Validator.isWindowType(metaData)) ||
					(Validator.isDisplayTabSelected() && Validator.isContentType(metaData))) {
					childs = otherPreviewArea.childNodes;

					for (i = 0; i < childs.length; i = i + 1) {
						if (childs[i].onmousedown) {
							if (!topElement || topElement.zIndex < childs[i].zIndex) {
								if (isInsideElement(childs[i], clientX, clientY)) {
									topElement = childs[i];
								}
							}
						}
					}
					if (topElement) {
						topElement.onmousedown(evt);
						dragOffsetTop = clientY - topElement.getBoundingClientRect().top;
						dragOffsetLeft = clientX - topElement.getBoundingClientRect().left;
					}
					return;
				}
			}

			// erase last border
			if (!onCtrlDown) {
				unselectAll(true);
				select(id, gui.is_listview_area(evt));
				gui.close_context_menu();
			} else  {
				select(id, gui.is_listview_area(evt));
				gui.close_context_menu();
			}
			
			evt = (evt) || window.event;
			mouseDownPos = [
				rect.left,
				rect.top
			];


			if (evt.changedTouches) {
				// タッチ
				target = evt.changedTouches[0].target;
			} else {
				// マウス
				target = evt.target;
			}

			dragOffsetTop = clientY - rect.top;
			dragOffsetLeft = clientX - rect.left;

			if (metaData  && target.id) {
				// メインビューのコンテンツ
				state.for_each_dragging_id(function (i, id) {
					elem = document.getElementById(id);
					if (elem) {
						dragRect[id] = {
							left : elem.getBoundingClientRect().left - rect.left,
							top : elem.getBoundingClientRect().top - rect.top
						}
					}
				});
			} else {
				// リストのコンテンツ
				state.for_each_dragging_id(function (i, id) {
					dragRect[id] = {
						left : 0,
						top : 0
					}
				});
			}
		
			evt.stopPropagation();
			evt.preventDefault();
		};

		if (window.ontouchstart !== undefined) {
			elem.ontouchstart = mousedownFunc;
		} else {
			elem.onmousedown = mousedownFunc;
		}
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
		
		if (!management.isEditable(metaData.group)) {
			// 編集不可コンテンツ
			return;
		}
		metaData.posx = splitWhole.x;
		metaData.posy = splitWhole.y;
		if (aspect > vaspect) {
			// content is wider than split area
			metaData.width = splitWhole.w;
			metaData.height = splitWhole.w / aspect;
		} else {
			// content is highter than split area
			metaData.height = splitWhole.h;
			metaData.width = splitWhole.h * aspect;
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
	
	/**
	 * レイアウト適用
	 * @method applyLayout
	 * @param {JSON} metaData 対象メタデータ
	 */
	function applyLayout(metaData) {
		window.input_dialog.okcancel_input({
			name : "Layoutを適用します。よろしいですか?"
		}, function (isOK) {
			if (isOK) {
				// レイアウトのコンテンツ(適用対象のメタデータが詰まっている)を取得する
				var request = { type: metaData.type, id: metaData.id };
				connector.send('GetContent', request, function (err, data) {
					var meta,
						metaDatas = [];
					if (!err) {
						try {
							var layoutDatas = JSON.parse(data.contentData);
							if (layoutDatas.hasOwnProperty('contents')) {
								for (meta in layoutDatas.contents) {
									var oldData = layoutDatas.contents[meta];
									if (store.get_metadata(oldData.id)) {
										if (oldData.hasOwnProperty('backup_list')) {
											// コンテンツは過去レイアウト作成時のものにする
											if (meta.resture_index > 0) {
												var oldContent = meta.backup_list[meta.resture_index];
												for (i = 0; i < store.get_metadata(meta.id).backup_list.length; i = i + 1) {
													if (store.get_metadata(meta.id).backup_list[i] === oldContent) {
														meta.restore_index = i;
													}
												}
											}
											// 履歴リストは最新にする.
											oldData.backup_list = store.get_metadata(oldData.id).backup_list;
										}
										// メモは最新にする.
										oldData.user_data_text = store.get_metadata(oldData.id).user_data_text;
									}
									metaDatas.push(oldData);
								}
								updateMetaDataMulti(metaDatas);
							}
						} catch (e) {
							console.error(e);
						}
					}
				});
			}
		});
	}
	
	function mousemoveFunc(evt) {
		var i,
			metaData,
			elem,
			pos,
			px,
			py,
			rect = evt.target.getBoundingClientRect(),
			orgPos,
			mousePos,
			splitWhole,
			draggingID,
			screen,
			targetMetaDatas = [],
			pageX = evt.pageX,
			pageY = evt.pageY,
			clientX = evt.clientX,
			clientY = evt.clientY;
			
		evt = (evt) || window.event;
		

		if (evt.changedTouches) {
			// タッチ
			rect = evt.changedTouches[0].target.getBoundingClientRect();
			pageX = evt.changedTouches[0].pageX,
			pageY = evt.changedTouches[0].pageY,
			clientX = evt.changedTouches[0].clientX;
			clientY = evt.changedTouches[0].clientY;
		} else {
			// マウス
			if (evt.button !== 0) { return; } // 左ドラッグのみ
		}

		// リモートカーソル位置の更新.
		if (Cookie.isUpdateCursorEnable(true) && Date.now() % 2 === 0 && evt.target.id !== ''){
			mousePos = vscreen.transformOrgInv(vscreen.makeRect(pageX, pageY, 0, 0));
			var obj = {
				type: 'mouse',
				x: mousePos.x,
				y: mousePos.y
			};
			updateMetaData(obj);
		}
		
		state.for_each_dragging_id(function (i, draggingID) {
			// detect content list area
			if (gui.is_listview_area2(evt, mouseDownPos) && gui.is_listview_area(evt)) {
				return;
			}

			// clear splitwhole colors
			clearSnapHightlight();
			
			// detect spilt screen area
			if (Validator.isGridMode()) {
				px = rect.left + dragOffsetLeft;
				py = rect.top + dragOffsetTop;
				orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
				splitWhole = vscreen.getSplitWholeByPos(orgPos.x, orgPos.y);
				if (splitWhole) {
					document.getElementById(splitWhole.id).style.background = "red";
				}
			}
			
			if (Validator.isDisplayMode()) {
				px = rect.left + dragOffsetLeft;
				py = rect.top + dragOffsetTop;
				orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
				screen = vscreen.getScreenByPos(orgPos.x, orgPos.y, draggingID);
				if (screen && document.getElementById(screen.id)) {
					document.getElementById(screen.id).style.background = "red";
				}
			}

			// translate
			elem = document.getElementById(draggingID);
			if (elem.style.display === "none") {
				elem.style.display = "block";
			}
			metaData = store.get_metadata(draggingID);

			if (dragRect.hasOwnProperty(draggingID)) {
				if (Validator.isWindowType(metaData) && management.isDisplayManipulatable()) {
					// display操作可能
					metaData.posx = clientX - dragOffsetLeft + dragRect[draggingID].left;
					metaData.posy = clientY - dragOffsetTop + dragRect[draggingID].top;
					vscreen_util.transPosInv(metaData);
					vscreen_util.assignMetaData(elem, metaData, true, store.get_group_dict());
				} else if (!Validator.isWindowType(metaData) && management.isEditable(metaData.group)) {
					// content編集可能
					metaData.posx = clientX - dragOffsetLeft + dragRect[draggingID].left;
					metaData.posy = clientY - dragOffsetTop + dragRect[draggingID].top;
					vscreen_util.transPosInv(metaData);
					vscreen_util.assignMetaData(elem, metaData, true, store.get_group_dict());
				}
			} else {
				return;
			}

			if (Validator.isWindowType(metaData) || Validator.isVisible(metaData)) {
				manipulator.moveManipulator(elem);
				targetMetaDatas.push(metaData);
			}
		});

		if (targetMetaDatas.length > 0) {
			updateMetaDataMulti(targetMetaDatas);
		}

		if (manipulator.getDraggingManip()) {
			console.log("iscontentarea");
			// scaling
			elem = document.getElementById(getSelectedID());
			if (elem) {
				metaData = store.get_metadata(elem.id);
				if (Validator.isWindowType(metaData) || Validator.isVisible(metaData)) {
					manipulator.moveManipulator(elem);
					onManipulatorMove(evt);
				}
			}
			evt.stopPropagation();
			evt.preventDefault();
		}

		if (state.get_dragging_id_list().length > 0) {
			evt.stopPropagation();
			evt.preventDefault();
		}
	}

	function mouseupFunc(evt) {
		var i,
			metaData,
			elem,
			px,
			py,
			rect = evt.target.getBoundingClientRect(),
			draggingID,
			orgPos,
			splitWhole,
			screen,
			draggingIDList = state.get_dragging_id_list();

		for (i = draggingIDList.length - 1; i >= 0; i = i - 1) {
			draggingID = draggingIDList[i];
			if (store.has_metadata(draggingID)) {
				elem = document.getElementById(draggingID);
				metaData = store.get_metadata(draggingID);
				if (!gui.is_listview_area(evt)) {
					// リストビューの項目がリストビューからメインビューにドラッグされた
					if (Validator.isLayoutType(metaData)) {
						applyLayout(metaData);
					} else {
						if (management.isEditable(metaData.group)) {
							metaData.visible = true;
						}
						if (Validator.isFreeMode()) {
							updateMetaData(metaData);
						} else if (Validator.isDisplayMode()) {
							px = rect.left + dragOffsetLeft;
							py = rect.top + dragOffsetTop;
							orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
							screen = vscreen.getScreenByPos(orgPos.x, orgPos.y, draggingID);
							if (screen) {
								snapToScreen(elem, metaData, screen);
							}
							updateMetaData(metaData);
							manipulator.moveManipulator(elem);
						} else {
							// grid mode
							px = rect.left + dragOffsetLeft;
							py = rect.top + dragOffsetTop;
							orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
							splitWhole = vscreen.getSplitWholeByPos(orgPos.x, orgPos.y);
							if (splitWhole) {
								snapToSplitWhole(elem, metaData, splitWhole);
							}
							updateMetaData(metaData);
							manipulator.moveManipulator(elem);
						}
					}
				}
				clearSnapHightlight();
			}
			draggingIDList.splice(i, 1);
			dragOffsetTop = 0;
			dragOffsetLeft= 0;
		}
		state.set_dragging_id_list(draggingIDList);
		manipulator.clearDraggingManip();
	}

	/**
	 * テキストデータ送信
	 * @method sendText
	 * @param {String} text 送信するテキスト.
	 */
	function sendText(text, metaData, width, height) {
		var previewArea = gui.get_content_preview_area(),
			elem = document.createElement('pre');
		
		if (!text) {
			text = "";
		}
		elem.className = "text_content";
		elem.innerHTML = text;
		previewArea.appendChild(elem);
		
		vscreen_util.transPosInv(metaData);
		metaData.width = elem.offsetWidth / vscreen.getWholeScale();
		metaData.height = elem.offsetHeight / vscreen.getWholeScale();
		metaData.group = gui.get_current_group_id();
		previewArea.removeChild(elem);
		metaData.type = "text";
		// テキストのときはメタデータにもテキストをつっこむ
		metaData.user_data_text = JSON.stringify({ text: text });

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
				metaData.group = gui.get_current_group_id();
				vscreen_util.transPosInv(metaData);
				img.style.width = img.naturalWidth + "px";
				img.style.height = img.naturalHeight + "px";
				URL.revokeObjectURL(img.src);
				console.log("sendImage");
				addContent(metaData, data);
			};
		}(metaData));
	}

	function fixedEncodeURIComponent(str) {
		return encodeURIComponent(str).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
	}

	function sendMovie(data, metaData) {
		// 動画は実体は送らずメタデータのみ送る
		// データとしてSDPを送る
		var blob = new Blob([data], {type: "video/mp4"});
		video.src = URL.createObjectURL(blob);
		var stream = video.captureStream();
		var webRTC = new WebRTC();
		webRTC.offer(function (sdp) {
			webRTC.addStream(stream);
			metaData.type = "video";
			metaData.width = 1920;
			metaData.height = 1080;
			metaData.group = gui.get_current_group_id();
			addContent(metaData, sdp);
		});
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
			idElem,
			screenElem,
			metaData;
		
		if (windowData && windowData !== undefined) {
			screenElem = document.getElementById(windowData.id);
			if (!screenElem && Validator.isVisible(windowData)) {
				screenElem = document.createElement('div');
				idElem = document.createElement('div');
				idElem.innerHTML = "ID:" + windowData.id;
				idElem.className = "screen_id";
				screenElem.appendChild(idElem);
				screenElem.className = "screen";
				screenElem.id = windowData.id;
				screenElem.style.borderStyle = 'solid';
				previewArea.appendChild(screenElem);
				setupWindow(screenElem, windowData.id);
				vscreen_util.assignScreenRect(screenElem, vscreen.transformScreen(screens[windowData.id]));
			}
			if (screenElem) {
				vscreen_util.assignMetaData(screenElem, windowData, true, store.get_group_dict());
			}
		} else {
			content_property.assign_virtual_display(vscreen.getWhole(), vscreen.getSplitCount());
			
			// 全可視コンテンツの配置を再計算.
			store.for_each_metadata(function (i, metaData) {
				if (Validator.isVisible(metaData)) {
					if (Validator.isContentType(metaData)) {
						elem = document.getElementById(metaData.id);
						if (elem) {
							vscreen_util.assignMetaData(elem, metaData, true, store.get_group_dict());
						}
					}
				}
			});
			
			// Virtual Displayを生成して配置.
			wholeElem = document.getElementById(Constants.WholeWindowID);
			if (!wholeElem) {
				wholeElem = document.createElement('span');
				wholeElem.className = "whole_screen_elem";
				wholeElem.id = Constants.WholeWindowID;
				setupWindow(wholeElem, wholeElem.id);
				previewArea.appendChild(wholeElem);
			}
			vscreen_util.assignScreenRect(wholeElem, whole);
			
			// 保持しているscreen座標情報から枠を生成して配置.
			for (s in screens) {
				if (screens.hasOwnProperty(s)) {
					screenElem = document.getElementById(s);
					if (store.has_metadata(s)) {
						metaData = store.get_metadata(s);
						if (!screenElem) {
							if (Validator.isVisible(metaData)) {
								screenElem = document.createElement('div');
								idElem = document.createElement('div');
								idElem.innerHTML = "ID:" + s;
								idElem.className = "screen_id";
								screenElem.appendChild(idElem);
								screenElem.className = "screen";
								screenElem.id = s;
								screenElem.style.borderStyle = 'solid';
								previewArea.appendChild(screenElem);
								setupWindow(screenElem, s);
							}
						}
						if (screenElem) {
							vscreen_util.assignMetaData(screenElem, metaData, true, store.get_group_dict());
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
		store.for_each_metadata(function (id, meta) {
			var elem;
			if (id !== metaData.id) {
				if (meta.content_id === metaData.content_id) {
					if (isListContent) {
						elem = gui.get_list_elem(id);
						if (elem) {
							elem = elem.childNodes[0];
						}
					} else {
						elem = document.getElementById(id);
					}
					if (elem && toElem) {
						if (metaData.type === 'text' || metaData.type === 'layout') {
							if (elem.innerHTML !== "") {
								toElem.innerHTML = elem.innerHTML;
							}
						} else if (elem.src) {
							toElem.src = elem.src;
						}
						if (!isListContent) {
							vscreen_util.assignMetaData(toElem, metaData, true, store.get_group_dict());
						}
					}
					if (elem && fromElem) {
						if (metaData.type === 'text' || metaData.type === 'layout') {
							elem.innerHTML = fromElem.innerHTML;
						} else {
							elem.src = fromElem.src;
						}
					}
				}
			}
		});
	}

	/**
	 * メタデータからコンテンツをインポートする
	 * @method importContent
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	function importContent(metaData, contentData) {
		window.layout_list.import_content(gui, store.get_metadata_dict(), metaData, contentData, store.get_group_dict());
		window.content_list.import_content(gui, store.get_metadata_dict(), metaData, contentData, store.get_group_dict());
		window.content_view.import_content(gui, store.get_metadata_dict(), metaData, contentData, store.get_group_dict());
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
	 * wholeWindowをリストビューに追加する
	 * @method addWholeWindowToList
	 */
	function addWholeWindowToList() {
		var displayArea = gui.get_display_area(),
			divElem = document.createElement("div"),
			onlistID = Constants.WholeWindowListID,
			idElem;
		
		idElem = document.createElement('div');
		idElem.innerHTML = "Virtual Display";
		idElem.className = "screen_id";
		divElem.appendChild(idElem);

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
		if (displayArea) {
			displayArea.innerHTML = "";
		}
	}
	
	/**
	 * 指定されたWindowをリストビューにインポートする
	 * @method importWindow
	 * @param {JSON} windowData ウィンドウデータ
	 */
	function importWindow(windowData) {
		if (!windowData || windowData === undefined || !windowData.hasOwnProperty('id')) { return; }
		window.window_view.import_window(gui, store.get_metadata_dict(), windowData);
		window.window_list.import_window(gui, store.get_metadata_dict(), windowData);
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
		if (!store.is_initialized()) { return; }

		console.log('doneGetMetaData', reply);
		var json = reply,
			elem,
			metaData = json,
			isUpdateContent = false;
		if (!json.hasOwnProperty('id')) { return; }
		if (store.has_metadata(json.id)) {
			isUpdateContent = (store.get_metadata(json.id).restore_index !== reply.restore_index);
		}
		if (json.hasOwnProperty('group')) {
			if (!management.getAuthorityObject().isViewable(json.group)) {
				elem = document.getElementById(metaData.id);
				if (elem) {
					elem.style.display = "none"
				}
				return;
			}
		}
		store.set_metadata(json.id, json);
		
		if (Validator.isCurrentTabMetaData(json)) {
			if (state.get_last_select_content_id() === json.id || (manipulator.isShowManipulator() && state.get_last_select_content_id() === json.id)) {
				content_property.assign_content_property(json);
			}
		}

		
		if (Validator.isWindowType(json)) { return; }
		elem = document.getElementById(metaData.id);
		if (elem && !isUpdateContent) {
			if (Validator.isVisible(json)) {
				vscreen_util.assignMetaData(elem, json, true, store.get_group_dict());
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
			var request = { type: json.type, id: json.id };
			if (json.hasOwnProperty('restore_index')) {
				request.restore_index = json.restore_index;
			}
			console.log("新規コンテンツロード", json);
			if (json.type === "video") {
				if (video.src) {
					importContent(json, video.src);
				}
			} else {
				connector.send('GetContent', request, function (err, data) {
					doneGetContent(err, data, endCallback);
					toggleMark(elem, metaData);
				});
			}
		}
	};
	
	/**
	 * GetContentを送信した後の終了コールバック.
	 * @method doneGetContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {Object} reply 返信されたコンテンツ
	 */
	doneGetContent = function (err, reply, endCallback) {
		if (!store.is_initialized()) { return; }

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
		if (!store.is_initialized()) { return; }

		console.log("doneUpdateMetaData", reply);
		var json = reply;

		if (reply.length === 1) {
			json = reply[0];
			store.set_metadata(json.id, json);
			if (Validator.isCurrentTabMetaData(json)) {
				content_property.assign_content_property(json);
			}
		}
	
		if (endCallback) {
			endCallback(null, reply);
		}
	};
	
	/**
	 * UpdateWindowMetaDataMultiを送信した後の終了コールバック.
	 * @method doneUpdateWindowMetaData
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneUpdateWindowMetaData = function (err, reply, endCallback) {
		if (!store.is_initialized()) { return; }

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
		if (!store.is_initialized()) { return; }

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
			state.set_last_select_content_id(null);

			if (store.has_metadata(json.id)) {
				store.delete_metadata(json.id);
			}
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
		if (!store.is_initialized()) { return; }

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
			store.delete_metadata(reply.id);
		} else {
			// 全部消された.
			store.for_each_metadata(function (id, metaData) {
				windowData = metaData;
				if (Validator.isWindowType(windowData)) {
					elem = document.getElementById(id);
					if (elem) {
						previewArea.removeChild(elem);
					}
					elem = gui.get_list_elem(id);
					if (elem) {
						displayArea.removeChild(elem);
					}
				}
				store.delete_metadata(id);
			});
		}
		
		state.set_last_select_window_id(null);
	};
	
	/**
	 * UpdateContentを送信した後の終了コールバック.
	 * @method doneUpdateContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneUpdateContent = function (err, reply) {
		if (!store.is_initialized()) { return; }

		console.log("doneUpdateContent");

		gui.set_update_content_id("No Content Selected.");
		manipulator.removeManipulator();
	};
	
	/**
	 * AddContentを送信した後の終了コールバック.
	 * @method doneAddContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneAddContent = function (err, reply) {
		if (!store.is_initialized()) { return; }

		var json = reply;
		console.log("doneAddContent:" + json.id + ":" + json.type);
		
		// 新規追加ではなく差し替えだった場合.
		if (store.has_metadata(json.id)) {
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
		if (!store.is_initialized()) { return; }

		console.log('doneGetWindowMetaData:');
		var windowData = reply,
			elem;
		importWindow(windowData);
		changeWindowBorderColor(windowData);
		if (Validator.isCurrentTabMetaData(reply)) {
			if (state.get_last_select_window_id() === windowData.id || (manipulator.getDraggingManip() && state.get_last_select_window_id() === windowData.id)) {
				content_property.assign_content_property(windowData);
			}
		}
	};

	/**
	 * GetGroupListを送信した後の終了コールバック.
	 * @method doneGetGroupList
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneGetGroupList = function (err, reply) {
		if (!store.is_initialized()) { return; }

		console.log("doneGetGroupList", reply);
		var i,
			groupToElems = {},
			groupToMeta = {},
			groupToLayoutElems = {},
			groupToLayoutMeta = {},
			group,
			elem,
			onlistID,
			meta,
			contentArea,
			layoutArea,
			currentGroup,
			selectedGroup,
			searchTargetGroups;

		groupToElems[Constants.DefaultGroup] = [];
		groupToMeta[Constants.DefaultGroup] = [];
		groupToLayoutElems[Constants.DefaultGroup] = [];
		groupToLayoutMeta[Constants.DefaultGroup] = [];

		selectedGroup = getSelectedGroup();

		if (!err && reply.hasOwnProperty('grouplist')) {
			// 一旦全部のリストエレメントをはずす.
			store.for_each_metadata(function (id, metaData) {
				if (Validator.isContentType(metaData)) {
					onlistID = "onlist:" + id;
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
							groupToElems[Constants.DefaultGroup].push(elem);
							groupToMeta[Constants.DefaultGroup].push(metaData);
						}
					}
				}
				if (Validator.isLayoutType(metaData)) {
					onlistID = "onlist:" + id;
					elem = document.getElementById(onlistID);
					if (elem) {
						elem.parentNode.removeChild(elem);
						if (metaData.hasOwnProperty('group')) {
							if (!groupToLayoutElems.hasOwnProperty(metaData.group)) {
								groupToLayoutElems[metaData.group] = [];
								groupToLayoutMeta[metaData.group] = [];
							}
							groupToLayoutElems[metaData.group].push(elem);
							groupToLayoutMeta[metaData.group].push(metaData);
						} else {
							groupToLayoutElems[Constants.DefaultGroup].push(elem);
							groupToLayoutMeta[Constants.DefaultGroup].push(metaData);
						}
					}
				}
	
			});
			// 一旦チェックされているSearch対象グループを取得
			searchTargetGroups = gui.get_search_target_groups();
			currentGroup = gui.get_current_group_id();

			// groupリストを新たにセットして, Searchタブ等を初期化
			gui.set_group_list(reply.grouplist);
			store.set_group_list(reply.grouplist);

			// 元々あったリストエレメントを全部つけなおす
			for (group in groupToElems) {
				if (groupToElems.hasOwnProperty(group)) {
					contentArea = gui.get_content_area_by_group(group);
					if (!contentArea) {
						contentArea = gui.get_content_area_by_group(Constants.DefaultGroup);
					}
					for (i = 0; i < groupToElems[group].length; i = i + 1) {
						contentArea.appendChild(groupToElems[group][i]);
					}
				}
			}

			// 元々あったリストエレメントを全部つけなおす
			for (group in groupToLayoutElems) {
				if (groupToLayoutElems.hasOwnProperty(group)) {
					layoutArea = gui.get_layout_area_by_group(group);
					if (!layoutArea) {
						layoutArea = gui.get_content_area_by_group(Constants.DefaultGroup);
					}
					for (i = 0; i < groupToLayoutElems[group].length; i = i + 1) {
						layoutArea.appendChild(groupToLayoutElems[group][i]);
					}
				}
			}

			if (selectedGroup && document.getElementById(selectedGroup)) {
				document.getElementById(selectedGroup).onclick();
			}

			// Search対象グループをチェックし直す
			gui.check_search_target_groups(searchTargetGroups, true);
			// カレントグループを選択し直す.
			gui.select_group(currentGroup);
		}
	};
	
	/**
	 * GetVirtualDisplayを送信した後の終了コールバック.
	 * @method doneGetVirtualDisplay
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneGetVirtualDisplay = function (err, reply) {
		if (!store.is_initialized()) { return; }

		var windowData = reply,
			whole = vscreen.getWhole(),
			split = vscreen.getSplitCount(),
			panel = document.getElementById('preview_area_panel__'),
			cx = (panel.getBoundingClientRect().right - panel.getBoundingClientRect().left) / 2,
			cy = (panel.getBoundingClientRect().bottom - panel.getBoundingClientRect().top) / 2 + 28;
		
		if (windowData.hasOwnProperty('orgWidth')) {
			// set virtual displays
			if (!windowData.orgHeight || isNaN(windowData.orgWidth)) {
				windowData.orgWidth = Constants.InitialWholeWidth;
			}
			if (!windowData.orgHeight || isNaN(windowData.orgHeight)) {
				windowData.orgWidth = Constants.InitialWholeHeight;
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
	 * マウスイベントの登録
	 */
	gui.on('mousemove', mousemoveFunc);
	gui.on('mouseup', mouseupFunc);

	/**
	 * Displayを削除するボタンが押された.
	 * @method on_deletedisplay_clicked
	 */
	gui.on("deletedisplay_clicked", function (err) {
		var metaDataList = [];
			
		state.for_each_selected_id(function (i, id) {
			if (store.has_metadata(id)) {
				metaDataList.push(store.get_metadata(id));
			}
		});
		if (metaDataList.length > 0) {
			connector.send('DeleteWindowMetaData', metaDataList, function () {});
		}
	});
	
	/**
	 * Layoutを削除するボタンが押された.
	 * @method on_deletedisplay_clicked
	 */
	gui.on("deletelayout_clicked", function (err) {
		var metaDataList = [];
			
		state.for_each_selected_id(function (i, id) {
			if (store.has_metadata(id)) {
				metaDataList.push(store.get_metadata(id));
			}
		});
		if (metaDataList.length > 0) {
			connector.send('DeleteContent', metaDataList, doneDeleteContent);
		}
	});

	/**
	 * Group内のコンテンツ全て削除.
	 */
	gui.on("deleteallcontent_clicked", function (err) {
		var i,
			metaData,
			selectedGroup = getSelectedGroup(),
			targetList = [];
		
		if (selectedGroup) {
			store.for_each_metadata(function (i, metaData) {
				if (Validator.isContentType(metaData)) {
					if (metaData.group === selectedGroup) {
						targetList.push(metaData);
					}
				}
			});
		}
		if (targetList.length > 0) {
			connector.send('DeleteContent', targetList, doneDeleteContent);
		}
	});
	
	/**
	 * Show Display ID ボタンが押された.
	 * @method on_showidbutton_clicked
	 */
	gui.on("showidbutton_clicked", function (err, isAll) {
		var targetIDList = [];
			
		state.for_each_selected_id(function (i, id) {
			if (store.has_metadata(id) && Validator.isWindowType(store.get_metadata(id))) {
				targetIDList.push({id : id});
			}
		});
		if (targetIDList.length > 0) {
			connector.send('ShowWindowID', targetIDList);
		}
	});
	
	/**
	 * VirualDisplay分割数変更
	 * @method on_change_whole_split
	 * @param {String} x x軸分割数
	 * @param {String} y y軸分割数
	 * @param {bool} withoutUpdate 設定後各Displayの更新をするかのフラグ
	 */
	content_property.on("change_whole_split", function (err, x, y, withoutUpdate) {
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
	});

	/**
	 * テキスト送信ボタンが押された.
	 * @param {Object} evt ボタンイベント.
	 */
	gui.on("textsendbutton_clicked", function (err, value, posx, posy, width, height) {
		var text = value;
		if (posx === 0 && posy === 0) {
			// メニューから追加したときなど. wholescreenの左上端に置く.
			posx = vscreen.getWhole().x;
			posy = vscreen.getWhole().y;
		}
		sendText(text, { posx : posx, posy : posy, visible : true }, width, height);
	});
	
	/**
	 * URLデータ送信ボタンが押された.
	 * @method on_sendbuton_clicked
	 */
	gui.on("urlsendbuton_clicked", function (err, value) {
		console.log("sendurl");
		var previewArea = gui.get_content_preview_area();

		value = value.split(' ').join('');
		if (value.indexOf("http") < 0) {
			console.error(value)
			return;
		}

		try {
			value = decodeURI(value);
			addContent({type : "url", user_data_text : JSON.stringify({ text: value }) }, value);
		} catch (e) {
			console.error(e);
		}
	});
	
	/**
	 * 画像ファイルFileOpenハンドラ
	 * @method on_imagefileinput_changed
	 * @param {Object} evt FileOpenイベント
	 */
	gui.on("imagefileinput_changed", function (err, evt, posx, posy) {
		var files = evt.target.files,
			file,
			i,
			fileReader = new FileReader();

		if (posx === 0 && posy === 0) {
			// メニューから追加したときなど. wholescreenの左上端に置く.
			posx = vscreen.getWhole().x;
			posy = vscreen.getWhole().y;
		}

		fileReader.onload = (function (name) {
			return function (e) {
				var data = e.target.result,
					img;
				if (data && data instanceof ArrayBuffer) {
					sendImage(data,  { posx : posx, posy : posy, visible : true, 
						user_data_text : JSON.stringify({ text: name }) });
				}
			};
		}(files[0].name));
		for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('image.*')) {
				fileReader.readAsArrayBuffer(file);
			}
		}
	});

	gui.on("add_layout", function (err) {
		window.input_dialog.init_multi_text_input({
			name : "レイアウト追加 - メモ",
			okButtonName : "OK"
		}, function (memo) {
			var id,
				metaData,
				layout = {
					contents: {}
				};

			// コンテンツのメタデータを全部コピー
			store.for_each_metadata(function (id, metaData) {
				if (Validator.isContentType(metaData)) {
					layout.contents[id] = metaData;
				}
			});

			layout = JSON.stringify(layout);
			addContent({type : Constants.TypeLayout,
				user_data_text : JSON.stringify({ text: memo }),
				visible: false,
				group : gui.get_current_group_id()
			}, layout);
		});
	});

	gui.on("overwrite_layout", function (err) {
		var metaData,
			isLayoutSelected = false;

		state.for_each_selected_id(function (i, id) {
			if (store.has_metadata(id)) {
				metaData = store.get_metadata(id);
				if (Validator.isLayoutType(metaData)) {
					isLayoutSelected = true;
					return true;
				}
			}
		});
		if (!isLayoutSelected) {
			window.input_dialog.ok_input({
				name : "上書き対象のレイアウトを選択してください"
			}, function () {});
			return;
		}
		window.input_dialog.okcancel_input({
			name : "選択中のレイアウトを上書きします。よろしいですか？",
			okButtonName : "OK"
		}, function (isOK) {
			if (isOK) {
				var metaDataList = [],
					layout = {
						contents: {}
					},
					layoutData;

				// コンテンツのメタデータを全部コピー
				store.for_each_metadata(function (id, metaData) {
					if (Validator.isContentType(metaData)) {
						layout.contents[id] = metaData;
					}
				});
				layoutData = JSON.stringify(layout);

				state.for_each_selected_id(function (i, id) {
					if (store.has_metadata(id)) {
						metaData = store.get_metadata(id);
						if (Validator.isLayoutType(metaData)) {
							updateContent(metaData, layoutData);
						}
					}
				});
			}
		});
	});

    function offsetX(eve) {
        return eve.offsetX || eve.pageX - eve.target.getBoundingClientRect().left;
    }
    function offsetY(eve) {
        return eve.offsetY || eve.pageY - eve.target.getBoundingClientRect().top;
    }
	
	/**
	 *  ファイルドロップハンドラ
	 * @param {Object} evt FileDropイベント
	 */
	gui.on("file_dropped", function (err, evt) {
		var i,
			file,
			files = evt.dataTransfer.files,
			fileReader = new FileReader(),
			movieReader = new FileReader(),
			rect = evt.target.getBoundingClientRect(),
			px = rect.left + offsetX(evt),
			py = rect.top + offsetY(evt);

		fileReader.onloadend = function (e) {
			var data = e.target.result;
			if (data && data instanceof ArrayBuffer) {
				sendImage(data,  { posx : px, posy : py, visible : true });
			} else {
				sendText(data, { posx : px, posy : py, visible : true });
			}
		};
		movieReader.onloadend = function (e) {
			var data = e.target.result;
			if (data && data instanceof ArrayBuffer) {
				sendMovie(data,  { posx : px, posy : py, visible : true });
			}
		};

		for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('image.*')) {
				fileReader.readAsArrayBuffer(file);
			}
			if (file.type.match('text.*')) {
				fileReader.readAsText(file);
			}
			if (file.type.match('video.*')) {
				movieReader.readAsArrayBuffer(file);
			}
		}
	});

	/**
	 * テキストファイルFileOpenハンドラ
	 * @method openText
	 * @param {Object} evt FileOpenイベント
	 */
	gui.on("textfileinput_changed", function (err, evt, posx, posy) {
		var files = evt.target.files,
			file,
			i,
			fileReader = new FileReader();
		
		if (posx === 0 && posy === 0) {
			// メニューから追加したときなど. wholescreenの左上端に置く.
			posx = vscreen.getWhole().x;
			posy = vscreen.getWhole().y;
		}
		
		fileReader.onloadend = function (e) {
			var data = e.target.result;
			if (data) {
				sendText(data, { posx : posx, posy : posy, visible : true });
			}
		};
		for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('text.*')) {
				fileReader.readAsText(file);
			}
		}
	});
	
	/**
	 * 画像イメージ差し替えFileOpenハンドラ
	 * @method on_updateimageinput_changed
	 * @param {Object} evt FileOpenイベント
	 */
	gui.on("updateimageinput_changed", function (err, evt) {
		var files = evt.target.files,
			file,
			i,
			fileReader = new FileReader(),
			id = gui.get_update_content_id(),
			previewArea = gui.get_content_preview_area(),
			elem,
			metaData;

		fileReader.onloadend = function (e) {
			var buffer, blob, img;
			if (e.target.result) {
				console.log("update_content_id", id);
				elem = document.getElementById(id);
				if (elem) {
					previewArea.removeChild(elem);
				}
				if (store.has_metadata(id)) {
					metaData = store.get_metadata(id);

					buffer = new Uint8Array(e.target.result);
					blob = new Blob([buffer], {type: "image/jpeg"});
					img = document.createElement('img');
					img.src = URL.createObjectURL(blob);
					img.className = "image_content";
					img.onload = (function (metaData) {
						return function () {
							metaData.type = "image";
							metaData.width = img.naturalWidth;
							metaData.height = img.naturalHeight;
							delete metaData.orgWidth;
							delete metaData.orgHeight;
							updateContent(metaData, e.target.result);
							URL.revokeObjectURL(img.src);
						};
					}(metaData));
				}	
			}
		};
		for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('image.*')) {
				fileReader.readAsArrayBuffer(file);
			}
		}
	});

	/**
	 * ディスプレイスケールが変更された.
	 */
	gui.on("display_scale_changed", function (err, displayScale) {
		manipulator.removeManipulator();
		vscreen.setWholeScale(displayScale, true);
		Cookie.setDisplayScale(displayScale);
		updateScreen();
	});

	/**
	 * ディスプレイトランスが変更された.
	 */
	gui.on("display_trans_changed", function (err, dx, dy) {
		manipulator.removeManipulator();
		var center = vscreen.getCenter();
		var whole = vscreen.getWhole();
		
		vscreen.assignWhole(whole.orgW, whole.orgH, center.x + dx, center.y + dy, vscreen.getWholeScale());
		updateScreen();
	});

	/**
	 * コンテンツの削除ボタンが押された.
	 * @method on_contentdeletebutton_clicked
	 */
	gui.on("contentdeletebutton_clicked", function (err, evt) {
		var metaData,
			metaDataList = [];
		
		state.for_each_selected_id(function (i, id) {
			if (store.has_metadata(id)) {
				metaData = store.get_metadata(id);
				if (!management.isEditable(metaData.group)) {
					// 編集不可コンテンツ
					return true;
				}
				metaData.visible = false;
				metaDataList.push(metaData);
			}
		});
		if (metaDataList.length > 0) {
			connector.send('DeleteContent', metaDataList, doneDeleteContent);
		}
	});

	/**
	 * コンテンツのzindex変更が要求された
	 * @param {boolean} isFront 最前面に移動ならtrue, 最背面に移動ならfalse
	 */
	gui.on("content_index_changed", function (err, isFront) {
		var metaData,
			metaDataList = [];
		
		state.for_each_selected_id(function (i, id) {
			if (store.has_metadata(id)) {
				metaData = store.get_metadata(id);
				metaData.zIndex = getZIndex(metaData, isFront);
				metaDataList.push(metaData);
			}
		});
		if (metaDataList.length > 0) {
			updateMetaDataMulti(metaDataList);
		}
	});

	/**
	 * コンテンツリストでセットアップコンテンツが呼ばれた
	 */
	window.content_list.on("setup_content", function (err, elem, uid) {
		setupContent(elem, uid);
	});

	/**
	 * コンテンツリストでコピーコンテンツが呼ばれた
	 */
	window.content_list.on("copy_content", function (err, fromElem, toElem, metaData, isListContent) {
		copyContentData(fromElem, toElem, metaData, isListContent);
	});

	/**
	 * レイアウトリストでセットアップコンテンツが呼ばれた
	 */
	window.layout_list.on("setup_layout", function (err, elem, uid) {
		setupContent(elem, uid);
	});

	/**
	 * レイアウトリストでコピーコンテンツが呼ばれた
	 */
	window.layout_list.on("copy_layout", function (err, fromElem, toElem, metaData, isListContent) {
		copyContentData(fromElem, toElem, metaData, isListContent);
	});

	/**
	 * コンテンツビューでセットアップコンテンツが呼ばれた
	 */
	window.content_view.on("setup_content", function (err, elem, uid) {
		setupContent(elem, uid);
	});

	/**
	 * コンテンツビューでコピーコンテンツが呼ばれた
	 */
	window.content_view.on("copy_content", function (err, fromElem, toElem, metaData, isListContent) {
		copyContentData(fromElem, toElem, metaData, isListContent);
	});

	/**
	 * コンテンツビューでinsertコンテンツが呼ばれた
	 */
	window.content_view.on("insert_content", function (err, area, elem) {
		insertElementWithDictionarySort(area, elem);
	});
	
	/**
	 * コンテンツビューで強調トグルが必要になった
	 */
	window.content_view.on("toggle_mark", function (err, contentElem, metaData) {
		toggleMark(contentElem, metaData);
	});

	/**
	 * ウィンドウリストでセットアップコンテンツが呼ばれた
	 */
	window.window_list.on("setup_content", function (err, elem, uid) {
		setupContent(elem, uid);
	});

	/**
	 * ウィンドウリストでスクリーン更新が呼ばれた
	 */
	window.window_view.on("update_screen", function (windowData) {
		updateScreen(windowData);
	});

	/**
	 * PropertyのDisplayパラメータ更新ハンドル
	 * @method on_display_value_changed
	 */
	content_property.on("display_value_changed", function (err) {
		var whole = vscreen.getWhole(),
			wholeWidth = document.getElementById('whole_width'),
			wholeHeight = document.getElementById('whole_height'),
			wholeSplitX = document.getElementById('whole_split_x'),
			wholeSplitY = document.getElementById('whole_split_y'),
			w,
			h,
			s = Number(vscreen.getWholeScale()),
			ix = parseInt(wholeSplitX.value, 10),
			iy = parseInt(wholeSplitY.value, 10),
			cx = window.innerWidth / 2,
			cy = window.innerHeight / 2;
			
		if (!wholeWidth || !whole.hasOwnProperty('w')) {
			w = Constants.InitialWholeWidth;
		} else {
			w = parseInt(wholeWidth.value, 10);
			if (w <= 1) {
				wholeWidth.value = 100;
				w = 100;
			}
		}
		if (!wholeHeight || !whole.hasOwnProperty('h')) {
			h = Constants.InitialWholeHeight;
		} else {
			h = parseInt(wholeHeight.value, 10);
			if (h <= 1) {
				wholeHeight.value = 100;
				h = 100;
			}
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
	});

	/**
	 *  ディスプレイ枠色変更
	 */
	content_property.on("display_color_changed", function (err, colorvalue) {
		var id = getSelectedID(),
			metaData;
		if (store.has_metadata(id) && Validator.isWindowType(store.get_metadata(id))) {
			metaData = store.get_metadata(id);
			metaData.color = colorvalue;
			updateMetaData(metaData, function (err, reply) {});
		}
	});
	
	/**
	 * コンテンツ復元
	 */
	content_property.on("restore_content", function (err, restoreIndex) {
		window.input_dialog.yesnocancel_input({
			name : "コンテンツを復元します",
			yesButtonName : "復元",
			noButtonName : "現在位置に復元",
			cancelButtonName : "Cancel",
		}, function (res) {
			if (res === "yes" || res === "no") {
				var id = getSelectedID(),
					metaData;
				if (store.has_metadata(id) && Validator.isContentType(store.get_metadata(id))) {
					metaData = store.get_metadata(id); 
					if (metaData.hasOwnProperty('backup_list') && metaData.backup_list.length >= restoreIndex) {
						metaData.restore_index = restoreIndex;
						connector.send('GetContent', metaData, function (err, reply) {
							if (Validator.isTextType(reply.metaData)) {
								metaData.user_data_text = JSON.stringify({ text: reply.contentData });
							}
							reply.metaData.restore_index = restoreIndex;
							if (res === "no") {
								reply.metaData.posx = metaData.posx;
								reply.metaData.posy = metaData.posy;
							}
							updateMetaData(reply.metaData);
							manipulator.removeManipulator();
						});
					}
				}
			}
		});
	});
	
	
	/**
	 * Virtual Dsiplay Settingボタンがクリックされた.
	 * @method on_virtualdisplaysetting_clicked
	 */
	gui.on("virtualdisplaysetting_clicked", function () {
		unselectAll(true);
		select(Constants.WholeWindowListID);
	});

	/**
	 * Group追加ボタンがクリックされた
	 */
	gui.on("group_append_clicked", function (err, groupName) {
		var groupColor = "rgb("+ Math.floor(Math.random() * 128 + 127) + "," 
				+ Math.floor(Math.random() * 128 + 127) + "," 
				+ Math.floor(Math.random() * 128 + 127) + ")";
				
		connector.send('AddGroup', { name : groupName, color : groupColor }, function (err, groupID) {
			// UserList再取得
			connector.send('GetUserList', {}, function (err, userList) {
				management.setUserList(userList);
			});
		});
	});

	/**
	 * Group削除ボタンがクリックされた
	 */
	gui.on("group_delete_clicked", function (err, groupID) {
		store.for_each_group(function (i, group) {
			if (group.id === groupID) {
				connector.send('DeleteGroup', group, function (err, reply) {
					console.log("DeleteGroup done", err, reply);
					var deleteList = [],
						id,
						metaData;
					console.log("UpdateGroup done", err, reply);
					if (!err) {
						// コンテンツも削除
						store.for_each_metadata(function (id, metaData) {
							if (Validator.isContentType(metaData) || Validator.isLayoutType(metaData)) {
								if (metaData.group === groupID) {
									deleteList.push(metaData);
								}
							}
						});
						if (deleteList.length > 0) {
							connector.send('DeleteContent', deleteList, doneDeleteContent);
						}
					}
					// UserList再取得
					connector.send('GetUserList', {}, function (err, userList) {
						management.setUserList(userList);
					});
				});
				return true; // break
			}
		});
	});

	/**
	 * Group変更がクリックされた
	 * @param {String} groupID 変更先のグループID
	 */
	gui.on("group_change_clicked", function (err, groupID) {
		var targetMetaDataList = [],
			group,
			metaData;

		state.for_each_selected_id(function (i, id) {
			if (store.has_metadata(id)) {
				metaData = store.get_metadata(id);
				metaData.group = groupID;

				store.for_each_group(function (k, group_) {
					if (group_.id === groupID) {
						targetMetaDataList.push(metaData);
						group = group_;
						return true; // break
					}
				});
			}
		});
		
		if (targetMetaDataList.length > 0) {
			updateMetaDataMulti(targetMetaDataList, (function (group) {
				return function (err, data) {
					connector.send('UpdateGroup', group, function (err, reply) {
					});
				};
			}(group)));
		}
	});

	gui.on("select_contents_clicked", function (err, onlyCurrentGroup) {
		var currentGroup = gui.get_current_group_id();

		unselectAll(true);
		store.for_each_metadata(function (id, meta) {
			if (Validator.isContentType(meta)) {
				if (onlyCurrentGroup) {
					if (meta.group === currentGroup) {
						select(id, true);
					}
				} else {
					select(id, true);
				}
			}
		});
	});

	gui.on("select_display_clicked", function () {
		var i,
			id;
		unselectAll(true);
		store.for_each_metadata(function (id, meta) {
			if (Validator.isWindowType(meta)) {
				select("onlist:" + id, true);
			}
		});
	});

	gui.on('select_layout_clicked', function () {
		var i,
			id;
		unselectAll(true);
		store.for_each_metadata(function (id, meta) {
			if (Validator.isLayoutType(meta)) {
				select("onlist:" + id, true);
			}
		});
	});

	/**
	 * Groupを１つ下に
	 * @param {String} groupID 変更先のグループID
	 */
	gui.on("group_down", function (err, groupID) {
		store.for_each_group(function (i, group) {
			var target;
			if (group.id === groupID) {
				if (i > 0 && i < (store.get_group_list().length - 1)) {
					target = {
						id : group.id,
						index : i + 2
					};
					connector.send('ChangeGroupIndex', target, function (err, reply) {
						console.log("ChangeGroupIndex done", err, reply);
					});
					return true;
				}
			}
		});
	});

	/**
	 * Groupを１つ上に
	 * @param {String} groupID 変更先のグループID
	 */
	gui.on("group_up", function (err, groupID) {
		store.for_each_group(function (i, group) {
			var target;
			if (group.id === groupID) {
				if (i > 1 && i <= (store.get_group_list().length - 1)) {
					target = {
						id : group.id,
						index : i - 1
					};
					connector.send('ChangeGroupIndex', target, function (err, reply) {
						console.log("ChangeGroupIndex done", err, reply);
					});
					return true;
				}
			}
		});
	});

	/**
	 * Group名変更
	 */
	gui.on("group_edit_name", function (err, groupID, groupName) {
		store.for_each_group(function (i, group) {
			var oldName,
				targetMetaDataList = [];
			if (group.id === groupID) {
				oldName = group.name;
				group.name = groupName;
				connector.send('UpdateGroup', group, (function (oldName, newName) {
					return function (err, reply) {
						var id,
							metaData;
						console.log("UpdateGroup done", err, reply);
						if (!err) {
							// グループリスト更新
							connector.send('GetUserList', {}, function (err, userList) {
								management.setUserList(userList);
							});
						}
					};
				}(oldName, groupName)));
			}
		});
	});
	
	/**
	 * Group色変更
	 */
	gui.on("group_edit_color", function (err, groupID, color) {
		store.for_each_group(function (i, group) {
			if (group.id === groupID) {
				group.color = color;
				connector.send('UpdateGroup', group, function (err, reply) {
				});
				return true;
			}
		});
	});

	/**
	 * Searchテキストが入力された
	 */
	gui.on("search_input_changed", function (err, text, groups) {
		var i,
			foundContents = [],
			groupDict = {},
			elem,
			copy,
			child;
			
		store.for_each_group(function (i, group) {
			groupDict[group.id] = group;
		});

		store.for_each_metadata(function (id, metaData) {
			if (Validator.isContentType(metaData)) {
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
				else if (groups.indexOf(Constants.DefaultGroup) >= 0 && !groupDict.hasOwnProperty(metaData.group)) {
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
		});
		gui.set_search_result(foundContents);
	});
	
	/**
	 * 選択中のコンテンツのzIndexを変更する
	 * @method on_change_zindex
	 * @param {String} index 設定するzIndex
	 */
	content_property.on("change_zindex", function (err, index) {
		var elem,
			metaData;
			
		state.for_each_selected_id(function (i, id) {
			metaData = store.get_metadata(id);
			elem = document.getElementById(id);
			if (metaData && elem) {
				elem.style.zIndex = index;
				metaData.zIndex = index;
				updateMetaData(metaData);
				console.log("change zindex:" + index, id);
			}
		});
	});
	
	/**
	 * タブが切り替えられた.
	 */
	gui.on("tab_changed_pre", function () {
		manipulator.removeManipulator();
		unselectAll(true);
	});

	gui.on("tab_changed_post", function () {
		var id;
		if (Validator.isDisplayTabSelected()) {
			content_property.init("", null, "", Constants.PropertyTypeDisplay);
		} else if (Validator.isLayoutTabSelected()) {
			content_property.init("", null, "", Constants.PropertyTypeLayout);
		} else {
			content_property.init("", null, "", Constants.PropertyTypeContent);
		}
		if (Validator.isDisplayTabSelected()) {
			id = state.get_last_select_window_id();
			if (!id) {
				id = Constants.WholeWindowListID;
			}
		} else {
			id = state.get_last_select_content_id();
		}
		state.set_selected_id_list([]);
		// 以前選択していたものを再選択する.
		if (id) {
			select(id, false);
		}
		state.set_dragging_id_list([]);
	});

	/**
	 * マニピュレータの星がトグルされた
	 */
	manipulator.on("toggle_star", function (err, is_active) {
		var id = getSelectedID(),
			metaData;
		if (store.has_metadata(id)) {
			metaData = store.get_metadata(id);
			metaData.mark = is_active;
			updateMetaData(metaData);
		}
	});

	/**
	 * マニピュレータのmemoがトグルされた
	 */
	manipulator.on("toggle_memo", function (err, is_active) {
		var id = getSelectedID(),
			metaData;
		if (store.has_metadata(id)) {
			metaData = store.get_metadata(id);
			if (Validator.isWindowType(metaData)) {
				gui.toggle_display_id_show(false);
			} else {
				metaData.mark_memo = is_active;
				updateMetaData(metaData);
			}
		}
	});

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
					updateMetaData(metaData, function (err, metaData) {
						if (endCallback) {
							endCallback(err, metaData[0]);
						}
					});
				}
			}
		}
		if (isCorrect && endCallback) {
			endCallback(null, metaData);
		}
	}
	
	/** */
	function updateAuthority(endCallback) {
		var key = login.getLoginKey();
		if (key.length > 0) {
			var request = { id : "", password : "", loginkey : key };
			connector.send('Login', request, function (err, reply) {
				if (err || reply === "failed") {
					// ログインに失敗した。リロードする.
					window.location.reload(true);
				}
				management.setAuthority(reply.authority);
				if (endCallback) {
					endCallback();
				}
			});
		} else {
			if (endCallback) {
				endCallback();
			}
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
			if (management.isViewable(metaData.group)) {
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
		}
	});
	
	// コンテンツが差し替えられたときにブロードキャストされてくる.
	connector.on('UpdateContent', function (metaData) {
		console.log('UpdateContent', metaData);
		var id = metaData.id;
		if (id) {
			connector.send('GetContent', metaData, function (err, reply) {
				if (store.has_metadata(metaData.id)) {
					correctAspect(reply.metaData, function (err, meta) {
						reply.metaData = meta;
						doneGetContent(err, reply);
						doneGetMetaData(err, meta);
					});
				}
			});
		}
	});
	
	// windowが更新されたときにブロードキャストされてくる.
	connector.on("UpdateWindowMetaData", function (data) {
		console.log("onUpdateWindowMetaData", data);
		var i,
			metaData;

		if (data instanceof Array) {
			for (i = 0; i < data.length; ++i) {
				metaData = data[i];
				doneGetWindowMetaData(null, metaData);
				changeWindowBorderColor(metaData);
			}
		} else {
			metaData = data;
			doneGetWindowMetaData(null, metaData);
			changeWindowBorderColor(metaData);
		}
	});

	// グループが更新されたときにブロードキャストされてくる.
	connector.on('UpdateGroup', function (metaData) {
		console.log("onUpdateGroup")
		updateAuthority(function () {
			updateGroupList();
		});
	});

	// 全てリロードする
	var isInitialUpdate = true;
	function reloadAll() {
		console.log("on reloadAll");
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
	}

	// すべての更新が必要なときにブロードキャストされてくる.
	connector.on('Update', function () {
		if (!store.is_initialized()) { return; }
		reloadAll();
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

	// DB切り替え時にブロードキャストされてくる
	connector.on("ChangeDB", function () {
		if (!store.is_initialized()) { return; }
		window.location.reload(true);
	});

	// 権限変更時に送られてくる
	connector.on("ChangeAuthority", function (userID) {
		if (!store.is_initialized()) { return; }
		if (loginUserID === userID) {
			window.location.reload(true);
		}
	});

	// 管理ページでの設定変更時にブロードキャストされてくる
	connector.on("UpdateSetting", function () {
		if (!store.is_initialized()) { return; }
		// ユーザーリスト再取得
		connector.send('GetUserList', {}, function (err, userList) {
			management.setUserList(userList);
		});
		connector.send('GetGlobalSetting', {}, function (err, reply) {
			if (reply && reply.hasOwnProperty('max_history_num')) {
				management.setMaxHistoryNum(reply.max_history_num);
				management.setCurrentDB(reply.current_db);
			}
		});
		connector.send('GetDBList', {}, function (err, reply) {
			if (!err) {
				gui.setDBList(reply);
				// 開きなおす
				management.close();
				management.removeListener('close');
				gui.openManagement();
			}
		});
	});

	///-------------------------------------------------------------------------------------------------------

	/**
	 * コントローラ初期化
	 * @method init
	 */
	function init(management) {
		var timer = null,
			display_scale,
			snap;

		Management.initManagementEvents(connector, login, management);

		gui.init(management);

		connector.send('GetDBList', {}, function (err, reply) {
			if (!err) {
				gui.setDBList(reply);
			}
		});

		display_scale = Cookie.getDisplayScale();
		snap = Cookie.getSnapType();
		
		vscreen.setWholeScale(display_scale, true);
		gui.set_display_scale(display_scale);
		
		if (snap) {
            gui.set_snap_type(snap);
			Cookie.setSnapType(snap);
		}
		document.getElementById('head_menu_hover_left').addEventListener('change', function(eve){
			var f = eve.currentTarget.value;
			gui.set_snap_type(f);
			Cookie.setSnapType(f);
		}, false);

		// リモートカーソルの有効状態を更新
		updateRemoteCursorEnable(Cookie.isUpdateCursorEnable());

		// プロパティの座標変更
		content_property.on("rect_changed", function (err, id, value) {
			console.log('on_rect_changed');
			changeRect(id, parseInt(value, 10));
		});

		// メタ情報(メモ)変更.
		content_property.on("metainfo_changed", function (err, text, endCallback) {
			var id = getSelectedID(),
				newData,
				metaData;
			
			if (id && store.has_metadata(id)) {
				metaData = store.get_metadata(id);
				newData = JSON.stringify({ text: text });
				if (newData !== metaData.user_data_text) {
					metaData.user_data_text = newData;
					if (Validator.isTextType(metaData)) {
						// テキストのメモ変更.
						// テキストはコンテンツ部分にも同じテキストがあるので更新.
						var previewArea = gui.get_content_preview_area(),
							elem = document.createElement('pre');
						elem.className = "text_content";
						elem.innerHTML = text;
						previewArea.appendChild(elem);
						metaData.orgWidth = elem.offsetWidth / vscreen.getWholeScale();
						metaData.orgHeight = elem.offsetHeight / vscreen.getWholeScale();
						correctAspect(metaData, function () {
							//console.error("metaData", metaData)
							metaData.restore_index = -1;
							updateContent(metaData, text);
						})
						previewArea.removeChild(elem);
					} else if (Validator.isLayoutType(metaData)) {
						// レイアウトのメモ変更.
						// レイアウトコンテンツを取得し直しリストを更新する.
						updateMetaData(metaData, function (err, reply) {
							connector.send('GetContent', metaData, function (err, data) {
								doneGetContent(err, data, endCallback);
							});
						});
					} else {
						// その他コンテンツのメモ変更.
						// リストの更新は必要なし
						updateMetaData(metaData, function (err, reply) {
							if (endCallback) {
								endCallback(null);
							}
						});
					}
				}
			} else {
				if (endCallback) {
					endCallback(null);
				}
			}
		});
		
		gui.on('update_cursor_enable', function (err, value) {
			updateRemoteCursorEnable(value);
		});

		gui.on("mousedown_content_preview_area", function () {
			if (!manipulator.getDraggingManip()) {
				unselectAll(true);
			}
		});
		
		gui.on("mousedown_display_preview_area", function () {
			if (!manipulator.getDraggingManip()) {
				unselectAll(true);
			}
		});

		gui.on("close_item", function () {
			var metaData,
				elem,
				metaDataList = [];

			manipulator.removeManipulator();

			state.for_each_selected_id(function (i, id) {
				if (store.has_metadata(id)) {
					metaData = store.get_metadata(id);
					if (!management.isEditable(metaData.group)) {
						// 編集不可コンテンツ
						return;
					}
					metaData.visible = false;
					metaDataList.push(metaData);
				}
			});
			if (metaDataList.length > 0) {
				updateMetaDataMulti(metaDataList);
			}
		});

		gui.get_whole_scale = function () {
			return vscreen.getWholeScale();
		};
		
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
				var panel = document.getElementById('preview_area_panel__'),
					cx = (panel.getBoundingClientRect().right - panel.getBoundingClientRect().left) / 2,
					cy = (panel.getBoundingClientRect().bottom - panel.getBoundingClientRect().top) / 2 + 28,
					whole = vscreen.getWhole();
				
				vscreen.assignWhole(whole.orgW, whole.orgH, cx, cy, vscreen.getWholeScale());
				manipulator.removeManipulator();
				updateScreen();
			}, 200);
		};

		updateScreen();
		vscreen.dump();
		store.init();
	}

	/**
	 * ログイン処理
	 */
	login.on('failed', function (err, data) {
		management = data.management;
	});

	login.on('success', function (err, data) {
		management = data.management;
		init(management);
		reloadAll();
	});

	login.on('logout', function (err, data) {
		connector.send('Logout', data, function () {
			window.location.reload(true);
		});
	})

	window.onload = login.login;
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
			if (e.className === "disconnect") {
				// 再ログイン
				// TODO
			}
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

}(window.content_property, window.vscreen, window.vscreen_util, window.manipulator, window.io_connector));
