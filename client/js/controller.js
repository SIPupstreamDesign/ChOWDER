/*jslint devel:true */
/*global FileReader, Uint8Array, Blob, URL, event, unescape, $, $show, $hide */

(function (vscreen, vscreen_util, manipulator, connector) {
	"use strict";
	
	var store = new Store(),
		state = new State(),
		gui = new ControllerGUI(),
		login = new Login(connector, Cookie),
		management; // 管理情報
		
	Validator.init(store, gui, state);

	var Controller = function () {
		this.webRTC = {};
		this.isInitialUpdate = true;
		this.setupContent = this.setupContent.bind(this);
		this.setupWindow = this.setupWindow.bind(this);
		this.setupSplit = this.setupSplit.bind(this);
		this.setupSelectionRect = this.setupSelectionRect.bind(this);
		this.showSelectionRect = this.showSelectionRect.bind(this);
		this.updateSelectionRect = this.updateSelectionRect.bind(this);
		this.updateScreen = this.updateScreen.bind(this);
		this.onChangeRect = this.onChangeRect.bind(this);
		this.onManipulatorMove = this.onManipulatorMove.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onUpdateAuthority = this.onUpdateAuthority.bind(this);
		this.onCloseContent = this.onCloseContent.bind(this);
		this.doneGetVirtualDisplay = this.doneGetVirtualDisplay.bind(this);
		this.doneGetContent = this.doneGetContent.bind(this);
		this.doneGetWindowMetaData = this.doneGetWindowMetaData.bind(this);
		this.doneGetGroupList = this.doneGetGroupList.bind(this);
		this.doneDeleteContent = this.doneDeleteContent.bind(this);
		this.doneAddContent = this.doneAddContent.bind(this);
		this.doneUpdateContent = this.doneUpdateContent.bind(this);
		this.doneUpdateMetaData = this.doneUpdateMetaData.bind(this);
		this.doneUpdateWindowMetaData = this.doneUpdateWindowMetaData.bind(this);
		this.doneGetMetaData =this.doneGetMetaData.bind(this);
		this.doneDeleteWindowMetaData = this.doneDeleteWindowMetaData.bind(this);
		this.controllerData = new ControllerData();
	};

	Controller.prototype.release = function () {
		var i;
		for (i in this.webRTC) {
			this.webRTC[i].close(true);
		}
		this.webRTC = {};

		var metaDataList = [];
		for (i in store.videoDict) {
			if (store.has_metadata(i)) {
				metaDataList.push(store.get_metadata(i));
			}
		}
		if (metaDataList.length > 0) {
			connector.send('DeleteContent', metaDataList, function () { });
		}
	};

    /**
     * random ID (8 chars)
     */
    function generateID() {
        function s4() {
			return Math.floor((1 + Math.random()) * 0x10000000).toString(16).substring(1);
		}
		return s4() + s4();
	}
	
	/**
	 * 指定された座標がelementの内部に存在するかを判定する
	 * @method isInsideElement
	 * @param {Element} element
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
	 * コントローラデータインスタンスを返す
	 */
	Controller.prototype.getControllerData = function () {
		return this.controllerData;
	}

	/**
	 * 辞書順でElementをareaに挿入.
	 * @method insertElementWithDictionarySort
	 * @param {Element} area  挿入先エリアのelement
	 * @param {Element} elem  挿入するelement
	 */
	Controller.prototype.insertElementWithDictionarySort = function (area, elem) {
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
	Controller.prototype.getElem = function (id, isListViewArea) {
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
				child = srcElem.childNodes[0].cloneNode();
				child.id = uid;
				child.innerHTML = srcElem.childNodes[0].innerHTML;
				delete srcElem.childNodes[0];
				
				if (Validator.isDisplayTabSelected()) {
					previewArea = gui.get_display_preview_area();
				} else {
					previewArea = gui.get_content_preview_area();
				}
				if (isListViewArea) {
					child.style.display = "none";
					child.style.margin = "5px";
				} else {
					child.style.margin = "0px";
				}
				this.insertElementWithDictionarySort(previewArea, child);
				this.setupContent(child, uid);
				
				return child;
			}
		}
		return document.getElementById(id);
	}
	
	/**
	 * コンテンツの四隅マニピュレーター移動。マウスmove時にコールされる
	 * @method onManipulatorMove
	 * @param {Object} evt マウスイベント
	 */
	Controller.prototype.onManipulatorMove = function (evt) {
		var px, py,
			i,
			lastx, lasty,
			lastw, lasth,
			totalRect = { 
				left : Number.MAX_VALUE, top : Number.MAX_VALUE, 
				right : -Number.MIN_VALUE, bottom : -Number.MIN_VALUE },
			currentw,
			currenth,
			ydiff,
			elem = null,
			metaData,
			targetMetaDatas = [],
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
			for (i = 0; i < state.get_selected_id_list().length; ++i) {
				elem = document.getElementById(state.get_selected_id_list()[i]);
				if (elem) {
					metaData = store.get_metadata(elem.id);
					if (Validator.isContentType(metaData) && !Validator.isVisible(metaData)) {
						// 非表示コンテンツ
						continue;
					}
					if (!management.isEditable(metaData.group)) {
						// 編集不可コンテンツ
						continue;
					}
					vscreen_util.trans(metaData);
					totalRect.left = Math.min(totalRect.left, metaData.posx);
					totalRect.top = Math.min(totalRect.top, metaData.posy);
					totalRect.right = Math.max(totalRect.right, metaData.posx + metaData.width);
					totalRect.bottom = Math.max(totalRect.bottom, metaData.posy + metaData.height);
				}
			}
			lastx = totalRect.left; // metaData.posx;
			lasty = totalRect.top; //metaData.posy;
			lastw = totalRect.right - totalRect.left; //metaData.width;
			lasth = totalRect.bottom - totalRect.top; //metaData.height;
			
			if (draggingManip.id === '_manip_0' || draggingManip.id === '_manip_1') {
				px = clientX - state.get_drag_offset_left();
				py = clientY - state.get_drag_offset_top();
				currentw = lastw - (px - lastx);
			} else {
				px = clientX - lastw - state.get_drag_offset_left();
				py = clientY - state.get_drag_offset_top();
				currentw = lastw + (px - lastx);
			}
			if (currentw < 20) {
				currentw = 20;
			}

			for (i = 0; i < state.get_selected_id_list().length; ++i) {
				elem = document.getElementById(state.get_selected_id_list()[i]);
				if (elem) {
					metaData = store.get_metadata(elem.id);
					if (Validator.isContentType(metaData) && !Validator.isVisible(metaData)) {
						// 非表示コンテンツ
						continue;
					}
					if (!management.isEditable(metaData.group)) {
						// 編集不可コンテンツ
						continue;
					}
					invAspect = metaData.height / metaData.width;
					currenth = currentw * invAspect;
					ydiff = currentw * invAspect - lasth;
	
					if (isNaN(invAspect)) {
						//invAspect = lasth / lastw;
						console.log("aspect NaN" + invAspect);
						return;
					}
	
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
					targetMetaDatas.push(metaData);
				}
			}
			if (targetMetaDatas.length > 0) {
				this.update_metadata_multi(targetMetaDatas);
			}
		}
	};
	
	/**
	 * ContentかDisplayの矩形サイズ変更時ハンドラ。initPropertyAreaのコールバックとして指定されている。
	 * @method onChangeRect
	 * @param {String} id ContentまたはDisplay ID
	 * @param {String} value 変更値
	 */
	Controller.prototype.onChangeRect = function (id, value) {
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
					this.update_metadata(metaData);
				} else if (id === 'content_transform_y') {
					metaData.posy = value;
					this.update_metadata(metaData);
				} else if (id === 'content_transform_w' && value > 10) {
					metaData.width = value;
					metaData.height = value * aspect;
					document.getElementById('content_transform_h').value = metaData.height;
					this.update_metadata(metaData);
				} else if (id === 'content_transform_h' && value > 10) {
					metaData.width = value / aspect;
					metaData.height = value;
					document.getElementById('content_transform_w').value = metaData.width;
					this.update_metadata(metaData);
				}
			}
			manipulator.removeManipulator();
			this.showSelectionRect(false);
		}
	};

	/**
	 * Content設定
	 * @method setupContent
	 * @param {Object} elem 設定対象Object
	 * @param {String} id ContentID
	 */
	Controller.prototype.setupContent = function (elem, id) {
		if (window.ontouchstart !== undefined) {
			elem.ontouchstart = this.onMouseDown(id);
		} else {
			elem.onmousedown = this.onMouseDown(id);
		}
	};
	
	/**
	 * Display設定
	 * @method setupWindow
	 * @param {Object} elem 設定対象Element
	 * @param {String} id ContentID
	*/
	Controller.prototype.setupWindow = function (elem, id) {
		this.setupContent(elem, id);
	};

	/**
	 * VirualDisplay分割設定
	 * @method setupSplit
	 * @param {Object} splitWholes VirtualDisplayの分割情報.
	 */
	Controller.prototype.setupSplit = function (splitWholes) {
		var screenElem,
			i,
			w,
			previewArea = gui.get_display_preview_area();
			
		console.log("setupSplit");
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
					this.setupWindow(screenElem, w.id);
				}
				vscreen_util.assignScreenRect(screenElem, vscreen.transformScreen(w));
			}
		}
	}

	Controller.prototype.onMouseMove = function (evt) {
		var i,
			metaData,
			elem,
			pos,
			px,
			py,
			rect,
			orgPos,
			mousePos,
			splitWhole,
			screen,
			targetMetaDatas = [],
			target,
			pageX = evt.pageX,
			pageY = evt.pageY,
			clientX = evt.clientX,
			clientY = evt.clientY;
		
		if (state.is_selection_rect_dragging()) {
			this.onMultiMove(evt);
			return;
		}
			
		evt = (evt) || window.event;
		
		if (evt.changedTouches) {
			// タッチ
			target = evt.changedTouches[0].target;
			rect = target.getBoundingClientRect();
			pageX = evt.changedTouches[0].pageX,
			pageY = evt.changedTouches[0].pageY,
			clientX = evt.changedTouches[0].clientX;
			clientY = evt.changedTouches[0].clientY;
		} else {
			// マウス
			if (evt.button !== 0) { return; } // 左ドラッグのみ
			target = evt.target;
			rect = target.getBoundingClientRect()
			pageX = evt.pageX;
			pageY = evt.pageY;
			clientX = evt.clientX;
			clientY = evt.clientY;
		}
		if (target && !target.hasOwnProperty('id')) {
			target = target.parentNode;
		}

		// リモートカーソル位置の更新.
		if (this.controllerData.isUpdateCursorEnable(true) && Date.now() % 2 === 0 && target.id !== ''){
			mousePos = vscreen.transformOrgInv(vscreen.makeRect(pageX, pageY, 0, 0));
			var obj = {
				type: 'mouse',
				x: mousePos.x,
				y: mousePos.y,
				controllerID : login.getControllerID(),
				rgb : this.controllerData.getCursorColor()
			};
			this.update_metadata(obj);
		}
		
		state.for_each_dragging_id(function (i, draggingID) {
			if (Validator.isVirtualDisplayID(draggingID)) return;

			// detect content list area
			if (gui.is_listview_area2(evt, state.get_mousedown_pos()) && gui.is_listview_area(evt)) {
				return;
			}
			metaData = store.get_metadata(draggingID);
			if (metaData && !Validator.isVisible(metaData)) {
				return;
			}

			// clear splitwhole colors
			this.clear_snap_hightlight();
			
			// detect spilt screen area
			if (Validator.isGridMode()) {
				px = rect.left + state.get_drag_offset_left();
				py = rect.top + state.get_drag_offset_top();
				orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
				splitWhole = vscreen.getSplitWholeByPos(orgPos.x, orgPos.y);
				if (splitWhole) {
					document.getElementById(splitWhole.id).style.background = "red";
				}
			}
			
			if (Validator.isDisplayMode()) {
				px = rect.left + state.get_drag_offset_left();
				py = rect.top + state.get_drag_offset_top();
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

			if (state.has_drag_rect(draggingID)) {
				if (Validator.isWindowType(metaData) && management.isDisplayEditable(state.get_display_selected_group())) {
					// display操作可能
					metaData.posx = clientX - state.get_drag_offset_left() + state.get_drag_rect(draggingID).left;
					metaData.posy = clientY - state.get_drag_offset_top() + state.get_drag_rect(draggingID).top;
					vscreen_util.transPosInv(metaData);
					vscreen_util.assignMetaData(elem, metaData, true, store.get_group_dict());
				} else if (!Validator.isWindowType(metaData) && management.isEditable(metaData.group)) {
					// content編集可能
					metaData.posx = clientX - state.get_drag_offset_left() + state.get_drag_rect(draggingID).left;
					metaData.posy = clientY - state.get_drag_offset_top() + state.get_drag_rect(draggingID).top;
					vscreen_util.transPosInv(metaData);
					vscreen_util.assignMetaData(elem, metaData, true, store.get_group_dict());
				}
			} else {
				return;
			}

			if (Validator.isVisibleWindow(metaData) || Validator.isVisible(metaData)) {
				manipulator.moveManipulator(elem);
				targetMetaDatas.push(metaData);
			}
		}.bind(this));

		if (targetMetaDatas.length > 0) {
			this.update_metadata_multi(targetMetaDatas);
			this.updateSelectionRect();
		}

		if (manipulator.getDraggingManip()) {
			if (state.is_selection_rect_shown()) {
				this.updateSelectionRect();
				this.onManipulatorMove(evt);
			} else {
				console.log("iscontentarea");
				// scaling
				elem = document.getElementById(state.get_selected_id());
				if (elem) {
					metaData = store.get_metadata(elem.id);
					if (Validator.isVisibleWindow(metaData) || Validator.isVisible(metaData)) {
						manipulator.moveManipulator(elem);
						this.onManipulatorMove(evt);
					}
				}
			}
			evt.stopPropagation();
			evt.preventDefault();
		}

		if (state.get_dragging_id_list().length > 0) {
			evt.stopPropagation();
			evt.preventDefault();
		}
	};
	
	Controller.prototype.onMouseDown = function (id) {
		return function (evt) {
			var rect,
				metaData = null,
				otherPreviewArea = gui.get_content_preview_area(),
				childs,
				i,
				elem,
				topElement = null,
				clientX,
				clientY,
				target;
			
			evt = (evt) || window.event;
			if (evt.changedTouches) {
				// タッチ
				target = evt.changedTouches[0].target;
				rect = evt.changedTouches[0].target.getBoundingClientRect();
				clientX = evt.changedTouches[0].clientX;
				clientY = evt.changedTouches[0].clientY;
			} else {
				// マウス
				if (evt.button !== 0) { return; } // 左ドラッグのみ
				target = evt.target;
				rect = evt.target.getBoundingClientRect();
				clientX = evt.clientX;
				clientY = evt.clientY;
			}
			if (target && !target.hasOwnProperty('id')) {
				target = target.parentNode;
			}
			
			if (store.has_metadata(id)) {
				metaData = store.get_metadata(id);
				if (Validator.isContentType(metaData)) {
					otherPreviewArea = gui.get_display_preview_area();
				}
			}

			if (metaData) {
				if (id.indexOf(Constants.WholeWindowID) === 0 ||
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
						state.set_drag_offset_top(clientY - topElement.getBoundingClientRect().top);
						state.set_drag_offset_left(clientX - topElement.getBoundingClientRect().left);
					}
					return;
				}
			}

			// erase last border
			if (!state.is_ctrl_down()) {
				this.unselect_all(true);
				this.select(id, gui.is_listview_area(evt));
				gui.close_context_menu();
			} else  {
				this.select(id, gui.is_listview_area(evt));
				gui.close_context_menu();
			}
			
			state.set_mousedown_pos([
					rect.left,
					rect.top
				]);


			state.set_drag_offset_top(clientY - rect.top);
			state.set_drag_offset_left(clientX - rect.left);

			if (metaData  && target && target.id) {
				// メインビューのコンテンツ
				state.for_each_dragging_id(function (i, id) {
					elem = document.getElementById(id);
					if (elem) {
						state.set_drag_rect(id, {
							left : elem.getBoundingClientRect().left - rect.left,
							top : elem.getBoundingClientRect().top - rect.top
						});
					}
				});
			} else {
				// リストのコンテンツ
				state.for_each_dragging_id(function (i, id) {
					state.set_drag_rect(id, {
						left : 0,
						top : 0
					});
				});
			}
			evt.stopPropagation();
			evt.preventDefault();
		}.bind(this);
	};

	Controller.prototype.onMouseUp = function (evt) {
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
					elem.style.margin = "0px";
					if (Validator.isLayoutType(metaData)) {
						this.apply_layout(metaData);
					} else {
						if (Validator.isWindowType(metaData)) {
							metaData.visible = true;
						} else {
							if (management.isEditable(metaData.group)) {
								metaData.visible = true;
							}
						}
						if (Validator.isFreeMode()) {
							this.update_metadata(metaData);
						} else if (Validator.isDisplayMode()) {
							px = rect.left + state.get_drag_offset_left();
							py = rect.top + state.get_drag_offset_top();
							orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
							screen = vscreen.getScreenByPos(orgPos.x, orgPos.y, draggingID);
							if (screen) {
								this.snap_to_screen(elem, metaData, screen);
							}
							this.update_metadata(metaData);
							manipulator.moveManipulator(elem);
						} else {
							// grid mode
							px = rect.left + state.get_drag_offset_left();
							py = rect.top + state.get_drag_offset_top();
							orgPos = vscreen.transformOrgInv(vscreen.makeRect(px, py, 0, 0));
							splitWhole = vscreen.getSplitWholeByPos(orgPos.x, orgPos.y);
							if (splitWhole) {
								this.snap_to_screen(elem, metaData, splitWhole);
							}
							this.update_metadata(metaData);
							manipulator.moveManipulator(elem);
						}
					}
				}
				this.clear_snap_hightlight();
			}
			draggingIDList.splice(i, 1);
		}
		state.set_drag_offset_top(0);
		state.set_drag_offset_left(0);
		state.set_dragging_id_list(draggingIDList);
		manipulator.clearDraggingManip();
		state.set_selection_rect_dragging(false);
	}

	Controller.prototype.removeVirtualDisplay = function () {
		var i,
			previewArea = gui.get_display_preview_area(),
			preWhole = document.getElementsByClassName("whole_screen_elem"),
			screenElems = document.getElementsByClassName("screen");

		if (preWhole[0]) {
			previewArea.removeChild(preWhole[0]);
		}
		for (i = screenElems.length - 1; i >= 0; --i) {
			if (screenElems[i].id.indexOf("whole_sub_window") >= 0) {
				previewArea.removeChild(screenElems[i]);
			}
		}
	}

	/**
	 * VirtualScreen更新
	 * @method updateScreen
	 * @param {JSON} windowData ウィンドウデータ. 無い場合はすべてのVirtualScreenが更新される.
	 */
	Controller.prototype.updateScreen = function (windowData) {
		var i,
			whole = vscreen.getWhole(),
			screens = vscreen.getScreenAll(),
			s,
			wholeElem,
			controllerData = this.getControllerData(),
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
				this.setupWindow(screenElem, windowData.id);
				vscreen_util.assignScreenRect(screenElem, vscreen.transformScreen(screens[windowData.id]));
			}
			if (screenElem) {
				if (Validator.isVisibleWindow(windowData)) {
					screenElem.style.display = "block";
				} else {
					screenElem.style.display = "none";
				}
				vscreen_util.assignMetaData(screenElem, windowData, true, store.get_group_dict());
				//vscreen_util.assignScreenRect(screenElem, vscreen.transformScreen(screens[windowData.id]));
			}
		} else {
			gui.assign_virtual_display(vscreen.getWhole(), vscreen.getSplitCount());
			
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
			wholeElem = document.getElementById(Constants.WholeWindowID + "_" + state.get_display_selected_group());
			if (!wholeElem) {
				wholeElem = document.createElement('span');
				wholeElem.className = "whole_screen_elem";
				wholeElem.id = Constants.WholeWindowID + "_" + state.get_display_selected_group();
				this.setupWindow(wholeElem, wholeElem.id);
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
								this.setupWindow(screenElem, s);
							}
						}
						if (screenElem) {
							if (Validator.isVisibleWindow(metaData)) {
								vscreen_util.assignMetaData(screenElem, metaData, true, store.get_group_dict());
								vscreen_util.assignScreenRect(screenElem, vscreen.transformScreen(screens[s]));
								screenElem.style.display = "block";
							} else {
								screenElem.style.display = "none";
							}
						}
					}
				}
			}
			this.setupSplit(vscreen.getSplitWholes());
		}

		this.updateSelectionRect();
	};
	
	// 権限情報が更新された
	Controller.prototype.onUpdateAuthority = function (endCallback) {
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

	Controller.prototype.create_whole_window = function (groupID) {
		var divElem = document.createElement("div"),
			idElem;

		idElem = document.createElement('div');
		idElem.innerHTML = "Virtual Display";
		idElem.className = "screen_id";
		divElem.appendChild(idElem);
		divElem.id = Constants.WholeWindowListID + "_" + groupID;
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
		this.setupContent(divElem, divElem.id);
		return divElem;
	}

	// 全てリロードする
	Controller.prototype.reload_all = function () {
		console.log("on reloadAll");
		this.setupSelectionRect();

		this.update(function () {
			if (this.isInitialUpdate) {
				var checkbox = document.getElementById('all_check_');
				if (checkbox) {
					checkbox.onclick();
				}
				this.isInitialUpdate = false;
			}
		}.bind(this));
		this.clear_window_list();

		this.update_group_list(function () {
			this.updateScreen();
		}.bind(this));

		setTimeout(function () {
			ChangeLanguage(Cookie.getLanguage());
			Translation();
		}, 100);
	};

	/**
	 * リストビュー領域をクリアする
	 * @method clearWindowList
	 */
	Controller.prototype.clear_window_list = function () {
		var displayArea = gui.get_display_area();
		if (displayArea) {
			displayArea.innerHTML = "";
		}
	};

	/**
	 * 指定されたWindowをリストビューにインポートする
	 * @method import_window
	 * @param {JSON} windowData ウィンドウデータ
	 */
	Controller.prototype.import_window = function (windowData) {
		if (!windowData || windowData === undefined || !windowData.hasOwnProperty('id')) { return; }
		gui.import_window(store.get_metadata_dict(), windowData/*, this.getControllerData().getGroupCheckDict()*/);
	};

	/**
	 * メタデータからコンテンツをインポートする
	 * @method import_content
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	Controller.prototype.import_content = function (metaData, contentData, video) {
		gui.import_content(store.get_metadata_dict(), metaData, contentData, store.get_group_dict(), video);
	};

	/**
	 * テキストデータ送信
	 * @method sendText
	 * @param {String} text 送信するテキスト.
	 */
	Controller.prototype.send_text = function (text, metaData, width, height) {
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
		this.add_content(metaData, text);
	};
	
	/**
	 * 画像データ送信
	 * @param {*} data 
	 * @param {*} metaData 
	 */
	Controller.prototype.send_image = function (data, metaData) {
		var img = document.createElement('img'),
			buffer,
			blob,
		buffer = new Uint8Array(data);

		blob = new Blob([buffer], {type: "image/jpeg"});
		img.src = URL.createObjectURL(blob);
		img.className = "image_content";
		img.onload = function (metaData) {
			metaData.type = "image";
			metaData.width = img.naturalWidth;
			metaData.height = img.naturalHeight;
			metaData.group = gui.get_current_group_id();
			vscreen_util.transPosInv(metaData);
			URL.revokeObjectURL(img.src);
			console.log("sendImage");
			this.add_content(metaData, data);
		}.bind(this, metaData);
	};

	/**
	 * 動画データ送信
	 * @param {*} data 
	 * @param {*} metaData 
	 */
	Controller.prototype.send_movie = function (type, blob, metaData) {
		// 動画は実体は送らずメタデータのみ送る
		// データとしてSDPを送る
		// 追加後のメタデータとローカルで保持しているコンテンツデータを紐づけるため
		// IDはクライアントで作成する
		if (metaData.hasOwnProperty("id") && store.has_metadata(metaData.id)) {
			metaData = store.get_metadata(metaData.id);
		} else {
			metaData.id = generateID();
		}
		var video;
		if (store.has_video_elem(metaData.id)) {
			video = store.get_video_elem(metaData.id);
		} else {
			video = document.createElement('video');
			store.set_video_elem(metaData.id, video);
			
			// カメラ,スクリーン共有は追加したコントローラではmuteにする
			if (type === "camera" || type === "screen") {
				video.muted = true;
			}
		}

		var videoData;
        if (type === "file") {
			videoData = URL.createObjectURL(blob);
			video.src = videoData;
			video.load();
		} else {
			// stream
        	if ('srcObject' in video) {
				videoData = blob;
				video.srcObject = blob;
			} else {
				videoData = URL.createObjectURL(blob);
				video.src = videoData;
			}
			video.load();
			video.play();
		}
		store.set_video_data(metaData.id, videoData);

		video.oncanplaythrough = function () {
			if (type !== "file") {
				window.setTimeout(function(){
					this.play()
				}.bind(this), 1000); // for chrome
			}
		};

		video.onplay = function () {
			if (type !== 'file') { return; }
			metaData = store.get_metadata(metaData.id);
			metaData.isPlaying = true;
			this.update_metadata(metaData);
		}.bind(this);

		video.onpause = function () {
			if (type !== 'file') { return; }
			metaData = store.get_metadata(metaData.id);
			metaData.isPlaying = false;
			this.update_metadata(metaData);
		}.bind(this);

		video.onended = function () {
			if (type !== 'file') { return; }
			this.isEnded = true;

			metaData = store.get_metadata(metaData.id);
			metaData.isPlaying = false;
			this.update_metadata(metaData);
		}.bind(this);

		video.onloadedmetadata = function (e) {
			metaData.type = "video";
			metaData.subtype = type;
			if (!metaData.hasOwnProperty("width")) {
				metaData.width = Number(this.videoWidth);
			}
			if (!metaData.hasOwnProperty("height")) {
				metaData.height = Number(this.videoHeight);
			}
			metaData.group = gui.get_current_group_id();
		};

		video.onloadeddata = function() {
			var data;
			if (!metaData.hasOwnProperty('is_video_on') || 
				metaData.hasOwnProperty('is_video_on') && String(metaData.is_video_on) !== "false")
			{
				// サムネイル生成
				var canvas = document.createElement('canvas');
				var context = canvas.getContext("2d");
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
				context.drawImage(video, 0, 0);
				data = canvas.toDataURL("image/jpeg");
			} else {
				data = this.getElem(metaData.id, true).src;
			}
			this.add_content(metaData, data, function (err, reply) {
			}.bind(this));
		}.bind(this);
	};

	/**
	 * PDFデータ送信
	 */
	Controller.prototype.send_pdf = function (data, metaData) {
		var pdfjsLib = window['pdfjs-dist/build/pdf'];
		window.PDFJS.cMapUrl = './js/3rd/pdfjs/cmaps/';
		window.PDFJS.cMapPacked = true;

		pdfjsLib.getDocument(data).then(function (pdf) {
			pdf.getPage(1).then(function (page) {
				var viewport = page.getViewport(1);

				metaData.type = 'pdf';
				metaData.width = viewport.width;
				metaData.height = viewport.height;
				metaData.group = gui.get_current_group_id();
				metaData.pdfPage = 1;
				metaData.pdfNumPages = pdf.numPages;
				
				vscreen_util.transPosInv(metaData);
				this.add_content(metaData, data);
			}.bind(this));
		}.bind(this));
	};
	
	/**
	 * レイアウト適用
	 * @method apply_layout
	 * @param {JSON} metaData 対象メタデータ
	 */
	Controller.prototype.apply_layout = function (metaData) {
		window.input_dialog.okcancel_input({
			name : i18next.t('layout_apply_is_ok'),
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
								this.update_metadata_multi(metaDatas);
							}
						} catch (e) {
							console.error(e);
						}
					}
				}.bind(this));
			}
		}.bind(this));
	};

	/**
	 * Snapハイライト解除
	 * @method clear_snap_hightlight
	 */
	Controller.prototype.clear_snap_hightlight = function () {
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
	};
	
	/**
	 * ContentまたはDisplayのスナップ処理
	 * @method snap_to_screen
	 * @param {Object} elem スナップ対象Object
	 * @param {JSON} metaData メタデータ
	 * @param {Object} splitWhole スナップ先Object
	 */
	Controller.prototype.snap_to_screen = function (elem, metaData, splitWhole) {
		var orgWidth = parseFloat(metaData.orgWidth),
			orgHeight = parseFloat(metaData.orgHeight),
			vaspect = splitWhole.w / splitWhole.h,
			aspect = orgWidth / orgHeight;
		
		if (Validator.isWindowType(metaData)) {
			if (!management.isDisplayEditable(metaData.group)) {
				// 編集不可コンテンツ
				return;
			}
		} else {
			if (!management.isEditable(metaData.group)) {
				// 編集不可コンテンツ
				return;
			}
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
	};

	Controller.prototype.getSelectedMetaDataList = function () {
		var metaDataList = [],
			metaData,
			i;
		for (i = 0; i < state.get_selected_id_list().length; ++i) {
			metaData = store.get_metadata( state.get_selected_id_list()[i]);
			if (metaData) {
				metaDataList.push(metaData);
			}
		}
		return metaDataList;
	}

	Controller.prototype.updateSelectionRect = function () {
		var i,
			elem,
			id,
			rect,
			rectB,
			selectionRect = getSelectionRectElem();

		if (!state.is_selection_rect_shown()) {
			return;
		}

		function Union(rectA, rectB) {
			if (!rectA) {
				return rectB;
			}
			var left = Math.min(rectA.left, rectB.left)
			var top = Math.min(rectA.top, rectB.top)
			var right = Math.max(rectA.right, rectB.right)
			var bottom = Math.max(rectA.bottom, rectB.bottom)
			return {
				left : left,
				top : top,
				right : right,
				bottom : bottom
			};
		}

		for (i = 0; i < state.get_selected_id_list().length; ++i) {
			id = state.get_selected_id_list()[i];
			elem = this.getElem(id, false);
			if (elem) {
				rectB = elem.getBoundingClientRect();
				rect = Union(rect, rectB);
			}
		}

		if (rect) {
			selectionRect.style.left = rect.left + "px";
			selectionRect.style.top = rect.top + "px";
			selectionRect.style.width = (rect.right - rect.left)+ "px";
			selectionRect.style.height =  (rect.bottom - rect.top) + "px";
		}
		manipulator.moveManipulator(selectionRect);
		
		if (!manipulator.isShowManipulator()) {
			if (Validator.isDisplayTabSelected()) {
				manipulator.showManipulator(
					management.getAuthorityObject(), 
					selectionRect, 
					gui.get_display_preview_area(), 
					this.getSelectedMetaDataList(),
					state.get_display_selected_group());
			} else {
				manipulator.showManipulator(
					management.getAuthorityObject(), 
					selectionRect, 
					gui.get_content_preview_area(), 
					this.getSelectedMetaDataList(),
					state.get_content_selected_group());
			}
			manipulator.moveManipulator(selectionRect);
		}
	}
	
	Controller.prototype.showSelectionRect = function (show, metaData) {
		var selectionRect = getSelectionRectElem();

		if (show) {
			selectionRect.style.display = "block"
			state.set_selection_rect_shown(true);
		} else {
			selectionRect.style.display = "none"
			state.set_selection_rect_shown(false);
		}

		this.updateSelectionRect();
	}
	
	Controller.prototype.onMultiMove = function (evt) {
		if (!state.is_selection_rect_dragging()) return;
		var selectionRect = document.getElementById('selection_rect');
		var i,
			id,
			metaData,
			elem,
			clientX = evt.clientX,
			clientY = evt.clientY,
			targetMetaDatas = [];
			
		for (i = 0; i < state.get_selected_id_list().length; ++i) {
			id = state.get_selected_id_list()[i];
			if (Validator.isVirtualDisplayID(id)) return;
			// detect content list area
			if (gui.is_listview_area2(evt, state.get_mousedown_pos()) && gui.is_listview_area(evt)) {
				return;
			}
			metaData = store.get_metadata(id);
			if (metaData && !Validator.isVisible(metaData)) {
				return;
			}
			
			elem = this.getElem(id, false);
				
			if (state.has_drag_rect(id)) {
				if (Validator.isWindowType(metaData) && management.isDisplayEditable(state.get_display_selected_group())) {
					// display操作可能
					metaData.posx = clientX - state.get_drag_offset_left() + state.get_drag_rect(id).left;
					metaData.posy = clientY - state.get_drag_offset_top() + state.get_drag_rect(id).top;
					vscreen_util.transPosInv(metaData);
					vscreen_util.assignMetaData(elem, metaData, true, store.get_group_dict());
				} else if (!Validator.isWindowType(metaData) && management.isEditable(metaData.group)) {
					// content編集可能
					metaData.posx = clientX - state.get_drag_offset_left() + state.get_drag_rect(id).left;
					metaData.posy = clientY - state.get_drag_offset_top() + state.get_drag_rect(id).top;
					vscreen_util.transPosInv(metaData);
					vscreen_util.assignMetaData(elem, metaData, true, store.get_group_dict());
				}
			}

			if (Validator.isVisibleWindow(metaData) || Validator.isVisible(metaData)) {
				targetMetaDatas.push(metaData);
			}
		}
		
		if (targetMetaDatas.length > 0) {
			this.update_metadata_multi(targetMetaDatas);
		}
		
		this.updateSelectionRect();
	}

	function getSelectionRectElem() {
		if (Validator.isDisplayTabSelected()) {
			return document.getElementById('display_selection_rect');
		} else {
			return document.getElementById('selection_rect');
		}
	}

	Controller.prototype.setupSelectionRect = function () {
		var selectionRect = document.getElementById('selection_rect');
		var displaySelectionRect = document.getElementById('display_selection_rect');
		selectionRect.style.borderColor = "rgb(4, 180, 49)";
		displaySelectionRect.style.borderColor = "rgb(50, 200, 255)";
		
		var onSelectionRectMouseDown = function (evt) {
			var selectionRect = getSelectionRectElem();
			var i,
				id,
				elem,
				clientX,
				clientY,
				target,
				rect;

			evt = (evt) || window.event;
			if (evt.changedTouches) {
				// タッチ
				target = evt.changedTouches[0].target;
				rect = evt.changedTouches[0].target.getBoundingClientRect();
				clientX = evt.changedTouches[0].clientX;
				clientY = evt.changedTouches[0].clientY;
			} else {
				// マウス
				if (evt.button !== 0) {
					state.set_selection_rect_dragging(false);
					 return;
				} // 左ドラッグのみ
				target = evt.target;
				rect = selectionRect.getBoundingClientRect();
				clientX = evt.clientX;
				clientY = evt.clientY;
			}
			state.set_selection_rect_dragging(true);

			state.set_mousedown_pos([
					rect.left,
					rect.top
				]);
			state.set_drag_offset_top(clientY - rect.top);
			state.set_drag_offset_left(clientX - rect.left);
			if (target) {
				// メインビューのコンテンツ
				for (i = 0; i < state.get_selected_id_list().length; ++i) {
					id = state.get_selected_id_list()[i];
					elem = document.getElementById(id);
					if (elem) {
						state.set_drag_rect(id, {
							left : elem.getBoundingClientRect().left - rect.left,
							top : elem.getBoundingClientRect().top - rect.top
						});
					}
				}
			}
			evt.preventDefault();
			evt.stopPropagation();
		}.bind(this);

		selectionRect.ontouchstart = onSelectionRectMouseDown;
		selectionRect.onmousedown = onSelectionRectMouseDown;
		displaySelectionRect.ontouchstart = onSelectionRectMouseDown;
		displaySelectionRect.onmousedown = onSelectionRectMouseDown;
	}

	/**
	 * ContentかDisplayを選択する。
	 * @method select
	 * @param {String} id 選択したID
	 * @parma {bool} isListViewArea リストビューを対象にするかどうか.
	 */
	Controller.prototype.select = function (id, isListViewArea) {
		var elem,
			metaData,
			mime,
			wholeMetaData,
			initialVisible,
			groupID;
		
		console.log("selectid", id);
		if (store.has_metadata(id)) {
			metaData = store.get_metadata(id);
			if (metaData.hasOwnProperty('mime')) {
				mime = metaData.mime;
			}
		}
		
		if (Validator.isVirtualDisplayID(id)) {
			groupID = state.get_display_selected_group();
			wholeMetaData = store.get_virutal_display_metadata(groupID);
			if (wholeMetaData) {
				gui.init_content_property(wholeMetaData, "", "whole_window");
				gui.assign_virtual_display(vscreen.getWhole(), vscreen.getSplitCount());
				if (gui.get_whole_window_elem(groupID)) {
					gui.get_whole_window_elem(groupID).style.borderColor = store.get_border_color(wholeMetaData);
				}
			}
			if (state.get_selected_id_list().indexOf(id) < 0) {
				state.add_selected_id(id);
			}
			state.set_last_select_window_id(id);
			return;
		}
		if (id.indexOf(Constants.WholeSubWindowID) >= 0) {
			return;
		}
		if (gui.get_whole_window_elem(groupID)) {
			gui.get_whole_window_elem(groupID).style.borderColor = "white";
		}
		elem = this.getElem(id, isListViewArea);
		if (!elem) {
			return;
		}
		
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
			state.add_selected_id(id);
		}
		state.set_dragging_id_list(JSON.parse(JSON.stringify(state.get_selected_id_list())));
		
		// 選択ボーダー色設定
		if (gui.get_list_elem(id)) {
			gui.get_list_elem(id).style.borderColor = store.get_border_color(metaData);
		}
		if (gui.get_search_elem(id)) {
			gui.get_search_elem(id).style.borderColor = store.get_border_color(metaData);
		}
		elem.style.borderColor = store.get_border_color(metaData);

		if (state.get_selected_id_list().length <= 0) {
			// 選択されているものがなかった.
			manipulator.removeManipulator();
			this.showSelectionRect(false);
		} else if (state.get_selected_id_list().length > 1) {
			// 複数選択. マニピュレーター, プロパティ設定
			manipulator.removeManipulator();
			if (Validator.isWindowType(metaData)) {
				gui.init_content_property(metaData, "", Constants.PropertyTypeMultiDisplay);
			} else {
				gui.init_content_property(metaData,"", Constants.PropertyTypeMultiContent);
			}
			// まとめて移動/拡縮するための枠を表示
			this.showSelectionRect(true, metaData);
			return;
		} else {
			// 単一選択.マニピュレーター, プロパティ設定
			if (Validator.isWindowType(metaData)) {
				gui.init_content_property(metaData,"", Constants.PropertyTypeDisplay);
				gui.assign_content_property(metaData);
				manipulator.showManipulator(
					management.getAuthorityObject(), 
					elem, 
					gui.get_display_preview_area(), 
					this.getSelectedMetaDataList(),
					state.get_display_selected_group());
			} else {
				// 動画の場合は所有しているかどうか調べる
				var isOwnVideo = false;
				if (metaData.type === Constants.PropertTypeVideo) {
					isOwnVideo = store.has_video_data(metaData.id);
				}
				if (store.has_group(metaData.group)) {
					gui.init_content_property(metaData, store.get_group(metaData.group).name, metaData.type, isOwnVideo);
				} else {
					console.warn("not found group", metaData)
					gui.init_content_property(metaData, "", metaData.type, isOwnVideo);
				}
				gui.assign_content_property(metaData);
				gui.set_update_content_id(id);
				manipulator.showManipulator(
					management.getAuthorityObject(), 
					elem, 
					gui.get_content_preview_area(), 
					this.getSelectedMetaDataList());
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
			this.showSelectionRect(false);
		}
	}
	
	/**
	 * 現在選択されているContents, もしくはVirtualDisplayを非選択状態にする
	 * @method unselect
	 */
	Controller.prototype.unselect = function (id, updateText) {
		var elem = null,
			metaData,
			groupID;

		elem = this.getElem(id, true);
		if (elem) {
			// 選択されていたメタデータの特定
			// 通常データ
			metaData = store.get_metadata(id);
			if (!metaData) {
				if (Validator.isVirtualDisplayID(id)) {
					// VirtualDisplayのデータ
					groupID = id.split("onlist:").join("");
					groupID = groupID.split(Constants.WholeWindowListID + "_").join("");
					groupID = groupID.split(Constants.WholeWindowID + "_").join("");
					metaData = store.get_virutal_display_metadata(groupID);
				}
			}
			if (Validator.isWindowType(metaData)) {
				elem.style.border = "";
				elem.style.borderStyle = "solid";
			}
			if (Validator.isContentType(metaData) && Validator.isVisible(metaData) && String(metaData.mark) !== "true") {
				elem.style.border = "";
			}
			if (gui.get_list_elem(elem.id)) {
				gui.get_list_elem(elem.id).style.borderColor = store.get_list_border_color(metaData);
				if (gui.get_search_elem(elem.id)) {
					gui.get_search_elem(elem.id).style.borderColor = store.get_list_border_color(metaData);
				}
			}
		}
		gui.clear_content_property(updateText);
		state.get_selected_id_list().splice(state.get_selected_id_list().indexOf(id), 1);
		if (state.get_selected_id_list().length === 0) {
			// まとめて移動/拡縮するための枠を非表示
			this.showSelectionRect(false, metaData);
		}
		manipulator.removeManipulator();
	}
	
	Controller.prototype.unselect_all = function (updateText) {
		var i;
		for (i = state.get_selected_id_list().length - 1; i >= 0; i = i - 1) {
			this.unselect(state.get_selected_id_list()[i], updateText);
		}
		state.clear_drag_rect();
	}

	/**
	 * クローズボタンハンドル。選択されているcontent or windowを削除する。
	 * その後クローズされた結果をupdateMetaDataにて各Windowに通知する。
	 * @method onCloseContent
	 */
	Controller.prototype.onCloseContent = function () {
		var id = state.get_selected_id(),
			metaData = null,
			elem,
			previewArea;
		
		console.log("onCloseContent");
		if (store.has_metadata(id)) {
			this.unselect(id);
			elem = this.getElem(id, false);
			
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
			this.update_metadata(metaData);
		}
	}
	/**
	 * グループリストの更新(再取得)
	 * @method update_group_list
	 */
	Controller.prototype.update_group_list = function (endCallback) {
		connector.send('GetGroupList', {}, function (err, reply) {
			this.doneGetGroupList(err, reply);
			if (endCallback) {
				endCallback();
			}
		}.bind(this));
	}
	
	/**
	 * コンテンツとウィンドウの更新(再取得).
	 * @method update
	 */
	Controller.prototype.update = function (endCallback) {
		vscreen.clearScreenAll();
		connector.send('GetMetaData', {type: "all", id: ""}, function (err, reply) {
			if (!err) {
				var last = reply.last; 
				delete reply.last;
				this.doneGetMetaData(err, reply, function (err) {
					if (last) {
						this.update_group_list(function () { // TODO 必要か要調査
							if (endCallback) {
								endCallback();
							}
						});
					}
				}.bind(this));
			}
		}.bind(this));
		this.update_group_list();
		connector.send('GetVirtualDisplay', {group: Constants.DefaultGroup}, this.doneGetVirtualDisplay);
		connector.send('GetWindowMetaData', {type: "all", id: ""}, this.doneGetWindowMetaData);
	}
	
	/**
	 * アップロード容量をチェックし、容量オーバーならfalseを返す
	 */
	Controller.prototype.checkCapacity = function (byteLength) {
		var maxSize = management.getMaxMessageSize();
		if (byteLength >= maxSize) {
			window.input_dialog.okcancel_input({
				name: "Overcapacity. Capacity limit of " + maxSize/1000000 + "MB",
				okButtonName: "OK"
			}, function (isOK) {
			});
			return false;
		}
		return true;
	}
	
	/**
	 * Content追加
	 * @method add_content
	 * @param {JSON} metaData コンテンツのメタデータ
	 * @param {BLOB} binary コンテンツのバイナリデータ
	 */
	Controller.prototype.add_content = function (metaData, binary, endCallback) {
		if (!metaData.hasOwnProperty("zIndex")) {
			metaData.zIndex = store.get_zindex(metaData, true);
		}

		if (!this.checkCapacity(binary.byteLength)) {
			reurn;
		}

		connector.sendBinary('AddContent', metaData, binary, function (err, reply) {
			this.doneAddContent(err, reply);
			if (endCallback) {
				endCallback(err, reply);
			}
		}.bind(this));
	}
	
	/**
	 * メタデータ(Display, 他コンテンツ)の幾何情報の更新通知を行う。
	 * @method update_metadata
	 * @param {JSON} metaData メタデータ
	 */
	Controller.prototype.update_metadata = function (metaData, endCallback) {
		if (Validator.isWindowType(metaData)) {
			// window
			connector.send('UpdateWindowMetaData', [metaData], function (err, reply) {
				this.doneUpdateWindowMetaData(err, reply, endCallback);
			}.bind(this));
        } else if (metaData.type === 'mouse') {
			// mouse cursor
            connector.send('UpdateMouseCursor', metaData, function (err, reply) {
                // console.log(err, reply);
            });
		} else {
			if (management.isEditable(metaData.group)) {
				connector.send('UpdateMetaData', [metaData], function (err, reply) {
					this.doneUpdateMetaData(err, reply, endCallback);
				}.bind(this));
			}
		}
	}
	
	/**
	 * メタデータ(Display, 他コンテンツ)の幾何情報の更新通知を行う。
	 * @method update_metadata_multi
	 * @param {JSON} metaData メタデータ
	 */
	Controller.prototype.update_metadata_multi = function (metaDataList, endCallback) {
		if (metaDataList.length > 0) {
			if (Validator.isWindowType(metaDataList[0])) {
				connector.send('UpdateWindowMetaData', metaDataList, function (err, reply) {
					this.doneUpdateWindowMetaData(err, reply, endCallback);
				}.bind(this));
			} else {
				// １つでも変更可能なデータが含まれていたら送る.
				var isEditable = false;
				var i;
				for (i = 0; i < metaDataList.length; i = i + 1) {
					isEditable = isEditable || management.isEditable(metaDataList[i].group);
				}
				if (isEditable) {
					connector.send('UpdateMetaData', metaDataList, function (err, reply) {
						this.doneUpdateMetaData(err, reply, endCallback);
					}.bind(this));
				}
			}
		}
	}

	/**
	 * コンテンツ更新要求送信
	 * @method update_content
	 * @param {JSON} metaData 更新するコンテンツのメタデータ
	 * @param {Blob} binary 更新するコンテンツのバイナリ
	 */
	Controller.prototype.update_content = function (metaData, binary) {
		if (!this.checkCapacity(binary.byteLength)) {
			return;
		}

		connector.sendBinary('UpdateContent', metaData, binary, this.doneUpdateContent);
	}
	
	/**
	 * VirtualDisplay情報更新要求送信
	 * @method update_window_data
	 */
	Controller.prototype.update_window_data = function () {
		var windowData,
			whole = vscreen.getWhole(),
			split = vscreen.getSplitCount();
		
		console.log("update_window_data");
		
		windowData = {
			orgWidth : whole.orgW,
			orgHeight : whole.orgH,
			splitX : split.x,
			splitY : split.y,
			scale : vscreen.getWholeScale(),
			type : "virtual_display",
			group : state.get_display_selected_group()
		};
		if (!windowData.orgWidth || isNaN(windowData.orgWidth)) {
			windowData.orgWidth = Constants.InitialWholeWidth;
		}
		if (!windowData.orgHeight || isNaN(windowData.orgHeight)) {
			windowData.orgHeight = Constants.InitialWholeHeight;
		}
		connector.send('UpdateVirtualDisplay', windowData, function (err, res) {
			if (!err) {
				this.doneGetVirtualDisplay(null, res);
			}
		}.bind(this));
	}
	
	/**
	 * リモートカーソルの有効状態を更新
	 * @method update_remote_cursor_enable
	 */
	Controller.prototype.update_remote_cursor_enable = function (isEnable) {
		this.controllerData.setUpdateCursorEnable(isEnable);
		if (!isEnable) {
			connector.send('UpdateMouseCursor', {}, function (err, reply) {});
		}
	}

	/**
	 * リモートカーソルの有効状態を更新
	 * @method update_remote_cursor_color
	 */
	Controller.prototype.update_remote_cursor_color = function (color) {
		this.controllerData.setCursorColor(color);
		store.set_cursor_color(color);
	}

	function captureStream(video) {
		if (video.captureStream) {
			return video.captureStream();
		} else if (video.mozCaptureStream) {
			return video.mozCaptureStream();
		}
		return null;
	}

	Controller.prototype.set_enable_video = function (metadataID, isCameraOn, isMicOn) {
		var i, k, n;
		var streams;
		var videos;
		var audios;
		
		for (i in this.webRTC) {
			if (i.indexOf(metadataID) >= 0) {
				streams = this.webRTC[i].peer.getLocalStreams();
				for (k = 0; k < streams.length; ++k) {
					videos = streams[k].getVideoTracks();
					for (n = 0; n < videos.length; ++n) {
						videos[n].enabled = String(isCameraOn) !== "false";
					}
					audios = streams[k].getAudioTracks();
					for (n = 0; n < audios.length; ++n) {
						audios[n].enabled = String(isMicOn) !== "false";
					}
				}
			}
		}
	}

	/**
	 * WebRTC接続開始
	 * @method connect_webrtc
	 */
	Controller.prototype.connect_webrtc = function (metaData, keyStr) {
		var video = store.get_video_elem(metaData.id);
		var webRTC;
		if (!this.webRTC.hasOwnProperty(keyStr)) {
			// 初回読み込み時
			var stream = captureStream(video);
			webRTC = new WebRTC();
			webRTC.setIsScreenSharing(metaData.subtype === "screen");
			this.webRTC[keyStr] = webRTC;
			if (!stream) {
				// for safari
				stream = video.srcObject;
			}
			webRTC.addStream(stream);
			
			video.onseeked = (function (controller) {
				return function () {
					if (this.isEnded) {
						for (var i in controller.webRTC) {
							if (i.indexOf(metaData.id) >= 0) {
								controller.webRTC[i].addStream(captureStream(video));
							}
						}
						this.isEnded = false;
					}
				};
			}(this));
			webRTC.on('icecandidate', function (type, data) {
				if (type === "tincle") {
					metaData.from = "controller";
					connector.sendBinary('RTCIceCandidate', metaData, JSON.stringify({
						key : keyStr,
						candidate: data
					}), function (err, reply) {});
					delete metaData.from;
				}
			});
	
			webRTC.on('negotiationneeded', function () {
				webRTC.offer(function (sdp) {
					connector.sendBinary('RTCOffer', metaData, JSON.stringify({
						key : keyStr,
						sdp : sdp
					}), function (err, reply) {});
				}.bind(this));
				this.set_enable_video(metaData.id, metaData.is_video_on, metaData.is_audio_on);
			}.bind(this));

			webRTC.on('closed', function () {
				delete this.webRTC[keyStr];
			}.bind(this));

			webRTC.on('need_restart', function () {
				webRTC.peer.removeStream(stream);
				webRTC.addStream(stream);
				webRTC.offer(function (sdp) {
					connector.sendBinary('RTCOffer', metaData, JSON.stringify({
						key : keyStr,
						sdp : sdp
					}), function (err, reply) {});
				}.bind(this));
			});

			webRTC.on('connected', function () {
				setTimeout(function () {
					webRTC.getStatus(function (status) {
						var meta = store.get_metadata(metaData.id);
						meta.webrtc_status = JSON.stringify({
							bandwidth : {
								availableSendBandwidth : status.bandwidth.availableSendBandwidth,
								actualEncBitrate : status.bandwidth.googActualEncBitrate,
								targetEncBitrate : status.bandwidth.googTargetEncBitrate,
								transmitBitrate : status.bandwidth.googTransmitBitrate,
							},
							resolution : status.resolutions.send,
							video_codec : status.video.send.codecs[0],
							audio_codec : status.video.send.codecs[0]
						});
						this.update_metadata(meta);
					}.bind(this));
				}.bind(this), 5000);
			}.bind(this));

		} else {
			webRTC = this.webRTC[keyStr];
		}

		webRTC.offer(function (sdp) {
			connector.sendBinary('RTCOffer', metaData, JSON.stringify({
				key : keyStr,
				sdp : sdp
			}), function (err, reply) {});
		});
	}
	
	
	Controller.prototype.update_mark_icon = function (elem, metaData) {
		if (metaData) {
			gui.toggle_mark(elem, metaData);
			gui.update_icon(elem, document.getElementById("onlist:" + metaData.id), metaData, store.get_group_dict());
		}
	}


	///-------------------------------------------------------------------------------------------------------
	
	/// meta data updated

	/**
	 * GetMetaDataを送信した後の終了コールバック.
	 * @method doneGetMetaData
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	Controller.prototype.doneGetMetaData = function (err, reply, endCallback) {
		if (!store.is_initialized()) { return; }

		console.log('doneGetMetaData', reply);
		var json = reply,
			elem,
			metaData = json,
			isUpdateContent = false;
		if (!json.hasOwnProperty('id')) { return; }
		if (store.has_metadata(json.id)) {
			isUpdateContent = (store.get_metadata(json.id).restore_index !== reply.restore_index);
			isUpdateContent = isUpdateContent || (store.get_metadata(json.id).keyvalue !== reply.keyvalue);
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
				gui.assign_content_property(json);
			}
		}

		if (Validator.isWindowType(json)) { return; }
		elem = document.getElementById(metaData.id);
		if (elem && !isUpdateContent) {
			if (Validator.isVisible(json)) {
				vscreen_util.assignMetaData(elem, json, true, store.get_group_dict());
				elem.style.display = "block";

				// pdfページの切り替え
				if (json.type === 'pdf' && elem.loadPage) {
					elem.loadPage(parseInt(json.pdfPage), parseInt(json.width));
				}
			} else {
				elem.style.display = "none";
			}
			this.update_mark_icon(elem, metaData);
			if (endCallback) {
				endCallback(null);
			}
		} else {
			// 新規コンテンツロード.
			var request = { type: json.type, id: json.id };
			if (json.hasOwnProperty('restore_index')) {
				request.restore_index = json.restore_index;
			}
			console.log("新規コンテンツロード", json);
			if (json.type === "video") {
				if (store.has_video_data(json.id)) {
					connector.send('GetContent', request, function (err, data) {
						this.import_content(json, data.contentData, store.get_video_elem(json.id));
						this.update_mark_icon(document.getElementById(metaData.id), data.metaData);
						if (endCallback) {
							endCallback(null);
						}
					}.bind(this));
				} else {
					connector.send('GetContent', request, function (err, data) {
						this.import_content(json, data.contentData);
						this.update_mark_icon(document.getElementById(metaData.id), data.metaData);
						if (endCallback) {
							endCallback(null);
						}
					}.bind(this));
				}
			} else {
				connector.send('GetContent', request, function (err, data) {
					this.doneGetContent(err, data, endCallback);
					this.update_mark_icon(document.getElementById(metaData.id), data.metaData);
				}.bind(this));
			}
		}
	};
	
	/**
	 * GetContentを送信した後の終了コールバック.
	 * @method doneGetContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {Object} reply 返信されたコンテンツ
	 */
	Controller.prototype.doneGetContent = function (err, reply, endCallback) {
		if (!store.is_initialized()) { return; }

		if (!err) {
			if (reply.hasOwnProperty('metaData')) {
				if (reply.metaData.type === "video") {
					if (store.has_video_data(reply.metaData.id)) {
						this.import_content(reply.metaData, reply.contentData, store.get_video_elem(reply.metaData.id));
					} else {
						// ローカルに保持していない動画コンテンツ
						this.import_content(reply.metaData, reply.contentData);
					}
				} else {
					this.import_content(reply.metaData, reply.contentData);
				}
			}
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
	Controller.prototype.doneUpdateMetaData = function (err, reply, endCallback) {
		if (!store.is_initialized()) { return; }

		console.log("doneUpdateMetaData", reply);
		var json;
		var k;
		var quality;

		if (err) {
			console.error(err);
			return;
		}

		if (reply.length === 1) {
			json = reply[0];
			if (Validator.isCurrentTabMetaData(json)) {
				gui.assign_content_property(json);
			}
		}
		
		for (var i = 0; i < reply.length; ++i) {
			json = reply[i];
			if (json.hasOwnProperty('quality')) {
				try {
					quality = JSON.parse(json.quality);
					if (this.webRTC) {
						for (k in this.webRTC) {
							if (k.indexOf(json.id) >= 0) {
								this.webRTC[k].setBandWidth(quality);
							}
						}
					}
				} catch (e) {
					console.error(e);
				}
			}
			// アイコン更新
			this.update_mark_icon(document.getElementById(json.id), json);
			// storeに格納
			store.set_metadata(json.id, json);
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
	Controller.prototype.doneUpdateWindowMetaData = function (err, reply, endCallback) {
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
			this.updateScreen(windowData);
			var elem = this.getElem(windowData.id);
			if (!state.is_selection_rect_shown()) {
				manipulator.moveManipulator(elem);
			}
		}
		if (state.is_selection_rect_shown() && windowDataList.length > 0) {
			this.updateSelectionRect();
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
	Controller.prototype.doneDeleteContent = function (err, reply) {
		if (!store.is_initialized()) { return; }

		console.log("doneDeleteContent", err, reply);
		var func = function (err, reply) {
			var json = reply,
				previewArea = gui.get_content_preview_area(),
				deleted = document.getElementById(json.id),
				elem,
				videoData,
				k;

			manipulator.removeManipulator();
			this.showSelectionRect(false);
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

			// delete webrtc with video
			for (k in this.webRTC) {
				if (k.indexOf(json.id) >= 0) {
					this.webRTC[k].close(true);
					
					json.from = "controller";
					connector.sendBinary('RTCClose', json, JSON.stringify({
						key : k
					}), function (err, reply) {});
					delete json.from;
				}
			}
			if (store.has_video_data(json.id)) {
				store.delete_video_data(json.id);
			}
			if (store.has_video_elem(json.id)) {
				store.delete_video_elem(json.id);
			}
		}.bind(this);

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
	Controller.prototype.doneDeleteWindowMetaData = function (err, reply) {
		if (!store.is_initialized()) { return; }

		console.log("doneDeleteWindowMetaData", reply);
		var elem,
			id,
			windowData,
			displayArea = gui.get_display_area(),
			previewArea = gui.get_display_preview_area();
		
		manipulator.removeManipulator();
		this.showSelectionRect(false);

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
	Controller.prototype.doneUpdateContent = function (err, reply) {
		if (!store.is_initialized()) { return; }

		console.log("doneUpdateContent");

		gui.set_update_content_id("No Content Selected.");
		manipulator.removeManipulator();
		this.showSelectionRect(false);
	};
	
	/**
	 * AddContentを送信した後の終了コールバック.
	 * @method doneAddContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	Controller.prototype.doneAddContent = function (err, reply) {
		if (!store.is_initialized()) { return; }

		var json = reply;
		console.log("doneAddContent:" + json.id + ":" + json.type);

		// DisplayタブだったらContentタブに変更する.
		if (gui.is_active_tab(Constants.TabIDDisplay)) {
			gui.change_tab(Constants.TabIDContent);
		}

		// 新規追加ではなく差し替えだった場合.
		if (store.has_metadata(json.id)) {
			this.doneUpdateContent(err, reply);
			this.unselect_all(true);
			this.select(json.id, true);
			return;
		}
		
		this.doneGetMetaData(err, reply, function () {		
			this.unselect_all(true);
			this.select(json.id, true);
		}.bind(this));
	};
	
	/**
	 * GetWindowMetaDataを送信した後の終了コールバック.
	 * @method doneGetWindowMetaData
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	Controller.prototype.doneGetWindowMetaData = function (err, reply) {
		if (!store.is_initialized()) { return; }

		console.log('doneGetWindowMetaData:');
		var windowData = reply;

		this.import_window(windowData);
		gui.change_window_border_color(windowData);
		if (Validator.isCurrentTabMetaData(reply)) {
			if (state.get_last_select_window_id() === windowData.id || (manipulator.getDraggingManip() && state.get_last_select_window_id() === windowData.id)) {
				gui.assign_content_property(windowData);
			}
		}
	};

	/**
	 * GetGroupListを送信した後の終了コールバック.
	 * @method doneGetGroupList
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	Controller.prototype.doneGetGroupList = function (err, reply) {
		if (!store.is_initialized()) { return; }

		console.log("doneGetGroupList", reply);
		var i,
			groupToElems = {},
			groupToMeta = {},
			group,
			elem,
			onlistID,
			metaData,
			contentArea,
			layoutArea,
			displayArea,
			currentGroup,
			selectedGroup,
			searchTargetGroups,
			controllerData = this.getControllerData();

		groupToElems[Constants.DefaultGroup] = [];
		groupToMeta[Constants.DefaultGroup] = [];

		selectedGroup = gui.get_current_group_id();

		if (!err && reply.hasOwnProperty('grouplist')) {
			// 一旦全部のリストエレメントをはずす.
			store.for_each_metadata(function (id, metaData) {
				if (Validator.isContentType(metaData) || Validator.isWindowType(metaData) || Validator.isLayoutType(metaData)) {
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
			});

			// 一旦チェックされているSearch対象グループを取得
			searchTargetGroups = gui.get_search_target_groups();
			currentGroup = gui.get_current_group_id();

			// Displayタブのグループチェック用の処理
			//this.getControllerData().initGroupCheck(reply.displaygrouplist);
			// groupリストを新たにセットして, Searchタブ等を初期化
			gui.set_group_list(reply.grouplist, reply.displaygrouplist, 
				//controllerData.getGroupCheckDict(),
				state.get_content_selected_group(),
				state.get_display_selected_group());
			store.set_group_list(reply.grouplist, reply.displaygrouplist);
			management.setDisplayGroupList(reply.displaygrouplist);

			// Virtual Displayはすべてに追加しなおす.
			store.for_each_display_group(function (i, group) {
				elem = this.create_whole_window(group.id);
				if (gui.get_display_area_by_group(group.id)) {
					gui.get_display_area_by_group(group.id).appendChild(elem);
				}
			}.bind(this));

			// 元々あったリストエレメントを全部つけなおす
			for (group in groupToElems) {
				if (groupToElems.hasOwnProperty(group)) {
					contentArea = gui.get_content_area_by_group(group);
					if (!contentArea) {
						contentArea = gui.get_content_area_by_group(Constants.DefaultGroup);
					}
					layoutArea = gui.get_layout_area_by_group(group);
					if (!layoutArea) {
						layoutArea = gui.get_layout_area_by_group(Constants.DefaultGroup);
					}
					displayArea = gui.get_display_area_by_group(group);
					if (!displayArea) {
						displayArea = gui.get_display_area_by_group(Constants.DefaultGroup);
					}
					for (i = 0; i < groupToElems[group].length; i = i + 1) {
						metaData = groupToMeta[group][i];
						if (Validator.isContentType(metaData)) {
							contentArea.appendChild(groupToElems[group][i]);
						} else if (Validator.isLayoutType(metaData)) {
							layoutArea.appendChild(groupToElems[group][i]);
						} else if (Validator.isWindowType(metaData)) {
							displayArea.appendChild(groupToElems[group][i]);
						}
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
	Controller.prototype.doneGetVirtualDisplay = function (err, reply) {
		if (!store.is_initialized()) { return; }

		var windowData = reply,
			panel = document.getElementById('preview_area_panel__'),
			cx = (panel.getBoundingClientRect().right - panel.getBoundingClientRect().left) / 2,
			cy = (panel.getBoundingClientRect().bottom - panel.getBoundingClientRect().top) / 2 + 28;
		
		if (windowData.hasOwnProperty('group')) {
			store.set_virtual_display_metadata(windowData.group, windowData);
		} else {
			store.set_virtual_display_metadata(Constants.DefaultGroup, windowData);
		}

		if (windowData.hasOwnProperty('orgWidth')) {
			// set virtual displays
			if (!windowData.orgHeight || isNaN(windowData.orgWidth)) {
				windowData.orgWidth = Constants.InitialWholeWidth;
			}
			if (!windowData.orgHeight || isNaN(windowData.orgHeight)) {
				windowData.orgWidth = Constants.InitialWholeHeight;
			}

			vscreen.assignWhole(windowData.orgWidth, windowData.orgHeight, cx, cy, vscreen.getWholeScale());
			vscreen.clearSplitWholes();
			vscreen.splitWhole(windowData.splitX, windowData.splitY);
			this.updateScreen();
		} else {
			// running first time
			gui.update_display_property();
			this.update_window_data();
		}
		manipulator.removeManipulator();
		this.showSelectionRect(false);
	};
	///-------------------------------------------------------------------------------------------------------

	var controller = new Controller();

	controller.getControllerData().on('update', function (err, data) {
		var controllerData = {
			controllerID : login.getControllerID(),
			controllerData : data
		};
		connector.send('UpdateControllerData', controllerData, function () {
		});
	});

	/**
	 * ログイン処理
	 */
	login.on('failed', function (err, data) {
		management = data.management;
	});

	login.on('success', function (err, data) {
		controller.getControllerData().set(data.controllerData);
		management = data.management;
		ControllerDispatch.init(controller, gui, store, state, management, login);
		controller.reload_all();
	});

	login.on('logout', function (err, data) {
		connector.send('Logout', data, function () {
			window.location.reload(true);
		});
	});

	var isDisconnect = false;
	function reconnect() {
		var client;

		connector.on("Disconnect", (function (client) {
			return function () {
				isDisconnect = true;
				client.close();
			};
		}(client)));

		client = connector.connect(function () {
			if (isDisconnect) {
				location.reload();
				return;
			}
			login.login();
			ChangeLanguage(Cookie.getLanguage());
			Translation(function () {
				var e = document.getElementById('head_menu_hover_right');
				if(e){
					//e.textContent = '×';
					e.title = i18next.t('connected_to_server');
					e.className = 'connect';
				}
			});
		}, function () {
			var e = document.getElementById('head_menu_hover_right');
			if(e){
				//e.textContent = '×';
				e.title = i18next.t('cannot_connect_to_server');
				e.className = 'disconnect';
			}
			// 再ログイン
			if (!isDisconnect) {
				isDisconnect = true;
				setTimeout(function () {
					reconnect();
				}, Constants.ReconnectTimeout);
			}
		});
	}

	window.onload = reconnect;
	window.onunload = function () {
		gui.clear_content_property(true);
		controller.release();
		store.release();
	};
	window.onblur = function () {
		gui.clear_content_property(true);
		state.set_ctrl_down(false);
	};
	window.onkeydown = function (evt) {
		if (evt.keyCode === 17) {
			state.set_ctrl_down(true);
		}
		if (evt.keyCode === 37) { // ←
			var history_up = document.getElementById('history_up');
			if (history_up && history_up.style.display !== "none") {
				history_up.click();
			}
		}
		if (evt.keyCode === 39) {
			var history_down  = document.getElementById('history_down');
			if (history_down && history_down.style.display !== "none") {
				history_down.click();
			}
		}
	};
	window.onkeyup = function (evt) {
		if (evt.keyCode === 17) {
			state.set_ctrl_down(false);
		}
	};
	
}(window.vscreen, window.vscreen_util, window.manipulator, window.ws_connector));
