/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../common/constants.js';
import Validator from '../common/validator.js';
import Store from './store/store.js';
import LoginGUI from './gui/login_gui.js';
import InputDialog from '../components/input_dialog.js';
import cookie from './cookie.js';
import manipulator from './manipulator.js';
import Vscreen from '../common/vscreen.js';
import VscreenUtil from '../common/vscreen_util.js';
import Connector from '../common/ws_connector.js';
import ContentUtil from './content_util';
import Command from '../common/command'

"use strict";


function getSelectionRectElem() {
	if (Validator.isDisplayTabSelected()) {
		return document.getElementById('display_selection_rect');
	} else {
		return document.getElementById('selection_rect');
	}
}

class Controller {
	constructor(store, action, gui) {
		this.store = store;
		this.action = action;
		this.gui = gui;

		this.state = store.getState();

		this.loginGUI = new LoginGUI(store, action);
		manipulator.init(store, action);

		this.resizeTimer = null;
		this.isInitialUpdate = true;
		this.isInitialized = false;

		this.onResize = this.onResize.bind(this);
		this.setupWindow = this.setupWindow.bind(this);
		this.setupSelectionRect = this.setupSelectionRect.bind(this);
		this.showSelectionRect = this.showSelectionRect.bind(this);
		this.updateSelectionRect = this.updateSelectionRect.bind(this);
		this.updateScreen = this.updateScreen.bind(this);
		this.onManipulatorMove = this.onManipulatorMove.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onCloseContent = this.onCloseContent.bind(this);
		this.doneGetVirtualDisplay = this.doneGetVirtualDisplay.bind(this);
		this.doneUpdateVirtualDisplay = this.doneUpdateVirtualDisplay.bind(this);
		this.doneUpdateSetting = this.doneUpdateSetting.bind(this);
		this.doneGetContent = this.doneGetContent.bind(this);
		this.doneGetWindowMetaData = this.doneGetWindowMetaData.bind(this);
		this.doneGetGroupList = this.doneGetGroupList.bind(this);
		this.doneDeleteContent = this.doneDeleteContent.bind(this);
		this.doneAddContent = this.doneAddContent.bind(this);
		this.doneUpdateContent = this.doneUpdateContent.bind(this);
		this.doneUpdateMetaData = this.doneUpdateMetaData.bind(this);
		this.doneUpdateWindowMetaData = this.doneUpdateWindowMetaData.bind(this);
		this.doneGetMetaData = this.doneGetMetaData.bind(this);
		this.doneDeleteWindowMetaData = this.doneDeleteWindowMetaData.bind(this);

		this.initEvent();
	}

	/**
	 * 解放処理
	 */
	release() {
	}

	/**
	 * GUI/Dispacher/controller初期化
	 * @method init
	 */
	init(data) {
		this.getControllerData().set(data.controllerData);
		let controllerData = this.getControllerData();

		let displayScale = controllerData.getDisplayScale();
		Vscreen.setWholeScale(displayScale, true);

		this.gui.init(controllerData);
		// マウスイベントの登録
		this.gui.on('mousemove', this.onMouseMove);
		this.gui.on('mouseup', this.onMouseUp);

		let snap = controllerData.getSnapType(Validator.isDisplayTabSelected());
		if (snap) {
			this.action.changeSnapType({
				isDisplay : Validator.isDisplayTabSelected(),
				snapType : snap
			});
		}
		document.getElementsByClassName('head_menu_hover_left')[0].addEventListener('change', (eve) => {
			let f = eve.currentTarget.value;
			this.action.changeSnapType({
				isDisplay : Validator.isDisplayTabSelected(),
				snapType : f
			});
		}, false);

		// リモートカーソルの有効状態を更新
		this.action.updateRemoteCursor({isEnable : controllerData.isUpdateCursorEnable()});

		manipulator.setCloseFunc(this.onCloseContent);

		this.updateScreen();
		this.setupSelectionRect();
		Vscreen.dump();
		this.action.init();

		this.action.reloadAll({
			callback : () => {
				let head_menu_hover = document.getElementsByClassName('head_menu_hover')[0];
				let logoutButton = document.getElementsByClassName('logout_button')[0];
				let user_text = document.getElementsByClassName('user_text')[0];

				// ログインユーザ名の設定.
				user_text.innerHTML = "Name:" + data.loginUserName;
				// ログアウトボタンを設定.
				head_menu_hover.style.display = "block";
				logoutButton.onclick = () => {
					cookie.setLoginKey(this.store.getLoginStore().getControllerID(), data.loginkey);
					this.action.logout({ loginkey: data.loginkey });
				};

				let connectIcon = document.getElementsByClassName('head_menu_hover_right')[0];
				if (connectIcon){
					//e.textContent = '×';
					connectIcon.title = i18next.t('connected_to_server');
					connectIcon.className = 'head_menu_hover_right connect';
				}
			}
		});

		this.isInitialized = true;
	}

	/**
	 * イベントハンドラを定義
	 */
	initEvent() {
		// ログイン失敗
		this.store.on(Store.EVENT_LOGIN_FAILED, (err, data) => {
			Validator.init(this.store, this.gui);
		});

		// ログイン成功
		this.store.on(Store.EVENT_LOGIN_SUCCESS, (err, data) => {
			Validator.init(this.store, this.gui);

			this.init(data);
		});

		// websocket接続が確立された
		this.store.on(Store.EVENT_CONNECT_SUCCESS, (err) => {
			console.log("websocket connected")
			this.loginGUI.login();
		})

		// websocket接続失敗
		this.store.on(Store.EVENT_CONNECT_FAILED, () => {
			let connectIcon = document.getElementsByClassName('head_menu_hover_right')[0];
			if (connectIcon){
				connectIcon.title = i18next.t('cannot_connect_to_server');
				connectIcon.className = 'head_menu_hover_right disconnect';
			}
		});

		// コンテンツのzIndex変更
		this.store.on(Store.EVENT_CONTENT_INDEX_CHANGED, (err, metaDataList) => {
			for (let i = 0; i < metaDataList.length; ++i) {
				let metaData = metaDataList[i];
				let elem = document.getElementById(metaData.id);
				if (elem) {
					elem.style.zIndex = metaData.zIndex;
				}
			}
		});

		// contentが更新された
		this.store.on(Store.EVENT_DONE_UPDATE_CONTENT, this.doneUpdateContent);

		// groupが更新された
		this.store.on(Store.EVENT_DONE_UPDATE_GROUP, () => {
			this.updateContentVisibleInSite();
		});

		// contentメタデータが更新された
		this.store.on(Store.EVENT_DONE_UPDATE_METADATA, this.doneUpdateMetaData);

		// windowメタデータが更新された
		this.store.on(Store.EVENT_DONE_UPDATE_WINDOW_METADATA, this.doneUpdateWindowMetaData);

		// contentが追加された
		this.store.on(Store.EVENT_DONE_ADD_CONTENT, this.doneAddContent);

		// contentが取得された
		this.store.on(Store.EVENT_DONE_GET_CONTENT, this.doneGetContent);

		// メタデータ取得完了
		this.store.on(Store.EVENT_DONE_GET_METADATA, (err, reply, endCallback) => {
			this.doneGetMetaData(err, reply, (err) => {
			});
		});

		// windowメタデータ取得完了
		this.store.on(Store.EVENT_DONE_GET_WINDOW_METADATA, this.doneGetWindowMetaData);

		// ディスプレイスケール変更中
		this.store.on(Store.EVENT_DISPLAY_SCALE_CHANGING, (err, displayScale) => {
			this.updateScreen();
		});

		// ディスプレイスケール変更確定
		this.store.on(Store.EVENT_DISPLAY_SCALE_CHANGED, (err, displayScale) => {
			this.getControllerData().setDisplayScale(displayScale);
			this.updateScreen();
		});

		// ディスプレイスケール位置確定
		this.store.on(Store.EVENT_DONE_DISPLAY_TRANS, (err) => {
			this.updateScreen();
		});

		// ディスプレイ表示状態変更
		this.store.on(Store.EVENT_CHANGE_DISPLAY_VISIBLE, (err, windowData) => {
			this.updateScreen(windowData);
		});

		// virtualdisplayが取得された
		this.store.on(Store.EVENT_DONE_GET_VIRTUAL_DISPLAY, this.doneGetVirtualDisplay);

		// ディスプレイプロパティが変更された
		this.store.on(Store.EVENT_DONE_UPDATE_VIRTUAL_DISPLAY, this.doneUpdateVirtualDisplay);

		// ディスプレイ分割数が変更された
		this.store.on(Store.EVENT_DISPLAY_SPLIT_CHANGED, (err, split) => {
			let wholes = Vscreen.getSplitWholes();
			for (let i in wholes) {
				if (wholes.hasOwnProperty(i)) {
					let elem = document.getElementById(i);
					if (elem) {
						this.gui.getDisplayPreviewArea().removeChild(elem);
					}
				}
			}
			this.setupSplit(Vscreen.getSplitWholes());
		});

		// Virtual Dsiplay Settingボタンがクリックされた.
		this.store.on(Store.EVENT_VIRTUALDISPLAY_CLICKED, () => {
			this.unselectAll(true);
			this.select(Constants.WholeWindowListID);
		});

		// コンテンツが削除された
		this.store.on(Store.EVENT_DONE_DELETE_CONTENT, this.doneDeleteContent);

		// ディスプレイのメタデータが削除された
		this.store.on(Store.EVENT_DONE_DELETE_WINDOW_METADATA, this.doneDeleteWindowMetaData);

		// コンテンツ選択
		this.store.on(Store.EVENT_SELECT_CONTENT, (err, data) => {
			if (data.hasOwnProperty('id')) {
				this.select(data.id, data.isListArea);
			} else {
				let currentGroup = this.store.getGroupStore().getCurrentGroupID();
				this.unselectAll(true);
				this.store.for_each_metadata((id, meta) => {
					if ((Validator.isContentType(meta) && data.type === Constants.TypeContent) ||
						(Validator.isWindowType(meta) && data.type === Constants.TypeWindow) ||
						(Validator.isLayoutType(meta) && data.type === Constants.TypeLayout))
					{
						if (data.onlyCurrentGroup) {
							if ((!meta.hasOwnProperty('group') && currentGroup === Constants.DefaultGroup) ||
								(meta.group === currentGroup)) {
								if (Validator.isWindowType(meta)) {
									if (Validator.isVisibleWindow(meta)) {
										this.select("onlist:" + id, true);
									}
								} else {
									this.select("onlist:" + id, true);
								}
							}
						} else {
							this.select("onlist:" + id, true);
						}
					}
				});
			}
		});

		// コンテンツtransform更新
		this.store.on(Store.EVENT_CONTENT_TRANSFORM_CHANGED, (err, metaData) => {
			if (metaData) {
				console.error("EVENT_CONTENT_TRANSFORM_CHANGED")
				manipulator.removeManipulator();
				this.showSelectionRect(false);
			}
		});

		// メタデータ更新
		this.store.on(Store.EVENT_UPDATE_METADATA_MULTI, (err, metaDataList, callback) => {
			if (callback) {
				callback();
			}
		});

		// グループ選択変更
		this.store.on(Store.EVENT_GROUP_SELECT_CHANGED, (err, data) => {
			this.unselectAll();
			this.select(Constants.WholeWindowListID);
		});

		// ディスプレイグループ選択変更
		this.store.on(Store.EVENT_DISPLAY_GROUP_SELECT_CHANGED, (err, data) => {
			this.removeVirtualDisplay();
			this.doneGetVirtualDisplay(err, data);
			this.unselectAll();
			this.select(Constants.WholeWindowListID);
			
			this.updateContentVisibleInSite();
		});

		// グループリスト取得された
		this.store.on(Store.EVENT_DONE_GET_GROUP_LIST, this.doneGetGroupList)

		/**
		 * タブが切り替えられた.
		 */
		this.store.on(Store.EVENT_TAB_CHANGED_PRE, () => {
			manipulator.removeManipulator();
			this.unselectAll(true);
		});
		
		this.store.on(Store.EVENT_TAB_CHANGED_POST, () => {
			// グループを選択しなおす
			let currentGroup = this.gui.getCurrentGroupID();
			this.gui.selectGroup(currentGroup);
		});

		// 選択解除された
		this.store.on(Store.EVENT_UNSELECT_CONTENT, (err, data) => {
			if (data.hasOwnProperty('id')) {
				this.unselect(data.id, data.isUpdateMetaInfo);
			} else {
				this.unselectAll(data.isUpdateMetaInfo);
			}
		});

		// ユーザリストがリロードされた
		this.store.on(Store.EVENT_USERLIST_RELOADED, () => {
			this.updateContentVisibleInSite();
		});

		// コンテンツのエレメントのセットアップ（内部用）
		this.store.on(Store.EVENT_SETUP_CONTENT_ELEMENT, (err, data) => {
			this.setupContent(data.element, data.id);
		});

		// コンテンツのスナップ完了
		this.store.on(Store.EVENT_DONE_SNAP_CONTENT_TO_SCREEN, (err, elem) => {
			manipulator.moveManipulator(elem);
		});

		// 全てのコンテンツ、ディスプレイなどを取得し、グループを含めて全てリロード
		this.store.on(Store.EVENT_DONE_RELOAD_ALL, (err, data) => {

			if (this.isInitialUpdate) {
				let checkbox = document.getElementById('all_check_');
				if (checkbox) {
					checkbox.onclick();
				}
				this.isInitialUpdate = false;
			}

			this.action.getGroupList({
				callback : () => {
					this.updateScreen();
				}
			});
		});

		// 復元完了
		this.store.on(Store.EVENT_DONE_RESTORE_CONTENT, this.doneGetContent);

		this.store.on(Store.EVENT_NEED_UPDATE_MANIPULATOR, () => {
            if (this.store.getState().getSelectedID()) {
                let elem = document.getElementById(this.store.getState().getSelectedID());
                if (elem) {
                    manipulator.moveManipulator(elem);
                    if (this.store.getState().isSelectionRectShown()) {
                        this.updateSelectionRect();
                    }
                }
            }
		});

		// ディスプレイ許可リストがリロードされた
        this.store.on(Store.EVENT_DISPLAY_PREMISSION_LIST_RELOADED, (err)=>{
			if (this.store.isInitialized()) {
				this.updateScreen();
			}
		});
	}

	/**
	 * リサイズハンドラ
	 */
	onResize(evt) {
		if (this.resizeTimer) {
			clearTimeout(this.resizeTimer);
		}
		this.resizeTimer = setTimeout(() => {
			let panel = document.getElementsByClassName('preview_area_panel__')[0];
			let cx = (panel.getBoundingClientRect().right - panel.getBoundingClientRect().left) / 2;
			let cy = (panel.getBoundingClientRect().bottom - panel.getBoundingClientRect().top) / 2 + 28;
			let whole = Vscreen.getWhole();

			Vscreen.assignWhole(whole.orgW, whole.orgH, cx, cy, Vscreen.getWholeScale());
			manipulator.removeManipulator();
			this.updateScreen();
		}, 200);
	}

	/**
	 * コントローラデータインスタンスを返す
	 */
	getControllerData() {
		return this.store.getControllerData();
	}

	/**
	 * 選択されたIDからElement取得
	 * @method getElem
	 * @param {String} id コンテンツID
	 * @param {bool} isListViewArea リストビュー上のエレメントか
	 * @return {Object} Element
	 */
	getElem(id, isListViewArea = false) {
		if (id === Constants.WholeWindowListID) {
			return null;
		}
		if (Validator.isUnvisibleID(id)) {
			let uid = id.split('onlist:').join('');
			if (document.getElementById(uid)) {
				return document.getElementById(uid);
			} else {
				let previewArea;
				let srcElem = document.getElementById(id);
				let child = srcElem.childNodes[0].cloneNode();
				child.id = uid;
				child.innerHTML = srcElem.childNodes[0].innerHTML;
				if (Validator.isDisplayTabSelected()) {
					previewArea = this.gui.getDisplayPreviewArea();
				} else {
					previewArea = this.gui.getContentPreviewArea();
				}
				delete srcElem.childNodes[0];
				if (isListViewArea) {
					child.style.display = "none";
					child.style.margin = "0px";
				}
				else {
					child.style.margin = "0px";
				}
				ContentUtil.insertElementWithDictionarySort(previewArea, child);
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
	onManipulatorMove(evt) {
		let width;
		let nextW;
		let posx;
		let posy;
		let scale;
		let targetMetaDatas = [];
		let draggingManip = manipulator.getDraggingManip();
		let clientX = evt.clientX;
		let clientY = evt.clientY;
		if (evt.changedTouches) {
			clientX = evt.changedTouches[0].clientX;
			clientY = evt.changedTouches[0].clientY;
		}
		if (draggingManip) {
			let totalRect = ContentUtil.getTotalSelectionRect(this.store);
			let mx = clientX - this.state.getMousedownPos()[0];
			let totalW = totalRect.right - totalRect.left;
			for (let i = 0; i < this.state.getSelectedIDList().length; ++i) {
				let id = this.state.getSelectedIDList()[i];
				let elem = document.getElementById(id);
				if (elem) {
					width = this.state.getDragRect(id).right - this.state.getDragRect(id).left;
					if (draggingManip.id === '_manip_0' || draggingManip.id === '_manip_1') {
						scale = totalW / (totalW - mx);
						scale = 1.0 / scale;
						nextW = width * scale;
						if (nextW < 20) {
							nextW = 20;
							scale = nextW / width;
						}
						if (draggingManip.id === '_manip_0') {
							// 左上
							posx = totalRect.right - (totalRect.right - this.state.getDragRect(id).left) * scale;
							posy = totalRect.bottom - (totalRect.bottom - this.state.getDragRect(id).top) * scale;
						}
						else {
							// 左下
							posx = totalRect.right - (totalRect.right - this.state.getDragRect(id).left) * scale;
							posy = totalRect.top + (this.state.getDragRect(id).top - totalRect.top) * scale;
						}
					}
					else {
						scale = totalW / (totalW + mx);
						scale = 1.0 / scale;
						nextW = width * scale;
						if (nextW < 20) {
							nextW = 20;
							scale = nextW / width;
						}
						if (draggingManip.id === '_manip_3') {
							// 右上
							posx = totalRect.left + (this.state.getDragRect(id).left - totalRect.left) * scale;
							posy = totalRect.bottom - (totalRect.bottom - this.state.getDragRect(id).top) * scale;
						}
						else {
							// 右下
							posx = totalRect.left + (this.state.getDragRect(id).left - totalRect.left) * scale;
							posy = totalRect.top - (totalRect.top - this.state.getDragRect(id).top) * scale;
						}
					}
					let metaData = this.store.getMetaData(elem.id);
					if (Validator.isContentType(metaData) && !Validator.isVisible(metaData)) {
						// 非表示コンテンツ
						continue;
					}
					if (!this.store.getManagement().isEditable(metaData.group) &&
						!this.store.getManagement().isDisplayEditable(metaData.group)) {
						// 編集不可コンテンツ
						continue;
					}
					let invAspect = metaData.height / metaData.width;
					if (isNaN(invAspect)) {
						//invAspect = lasth / lastw;
						// console.log("aspect NaN" + invAspect);
						return;
					}
					metaData.posx = posx;
					metaData.posy = posy;
					metaData.width = nextW;
					metaData.height = nextW * invAspect;
					VscreenUtil.transInv(metaData);
					this.store.setMetaData(metaData.id, metaData);
					targetMetaDatas.push(metaData);
				}
			}
			if (targetMetaDatas.length > 0) {
				this.store.operation.updateMetadataMulti(targetMetaDatas);
			}
		}
	}

	/**
	 * Display設定
	 * @method setupWindow
	 * @param {Object} elem 設定対象Element
	 * @param {String} id ContentID
	*/
	setupWindow(elem, id) {
		this.setupContent(elem, id);
	}

	/**
	 * VirualDisplay分割設定
	 * @method setupSplit
	 * @param {Object} splitWholes VirtualDisplayの分割情報.
	 */
	setupSplit(splitWholes) {
		let previewArea = this.gui.getDisplayPreviewArea();
		//console.log("setupSplit");
		//console.log(splitWholes);
		for (let i in splitWholes) {
			if (splitWholes.hasOwnProperty(i)) {
				let w = splitWholes[i];
				// console.log(w);
				let screenElem = document.getElementById(w.id);
				if (!screenElem) {
					// console.log("create_new_window", w);
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
				VscreenUtil.assignScreenRect(screenElem, Vscreen.transformScreen(w));
			}
		}
	}
	onMouseMove(evt) {
		let targetMetaDatas = [];
		let target;
		let pageX = evt.pageX;
		let pageY = evt.pageY;
		let clientX = evt.clientX;
		let clientY = evt.clientY;
		if (this.state.isSelectionRectDragging()) {
			this.onMultiMove(evt);
			return;
		}
		evt = (evt) || window.event;
		if (evt.changedTouches) {
			// タッチ
			target = evt.changedTouches[0].target;
			pageX = evt.changedTouches[0].pageX,
			pageY = evt.changedTouches[0].pageY,
			clientX = evt.changedTouches[0].clientX;
			clientY = evt.changedTouches[0].clientY;
		}
		else {
			// マウス
			if (evt.button !== 0) {
				return;
			} // 左ドラッグのみ
			target = evt.target;
			pageX = evt.pageX;
			pageY = evt.pageY;
			clientX = evt.clientX;
			clientY = evt.clientY;
		}
		if (target && !target.hasOwnProperty('id')) {
			target = target.parentNode;
		}
		// リモートカーソル位置の更新.
		if (this.getControllerData().isUpdateCursorEnable(true) && Date.now() % 2 === 0 && target.id !== '') {
			let mousePos = Vscreen.transformOrgInv(Vscreen.makeRect(pageX, pageY, 0, 0));
			let cursorMetaData = {
				x: mousePos.x,
				y: mousePos.y,
				isEnable : true
			};
			this.action.updateRemoteCursor(cursorMetaData);
		}
		let mx = clientX - this.state.getMousedownPos()[0];
		let my = clientY - this.state.getMousedownPos()[1];
		this.state.for_each_dragging_id((i, draggingID) => {
			if (Validator.isVirtualDisplayID(draggingID))
				return;
			// detect content list area
			if (this.gui.inListviewArea2(evt, this.state.getMousedownPos()) && this.gui.inListviewArea(evt)) {
				return;
			}
			let metaData = this.store.getMetaData(draggingID);
			if (Validator.isLayoutType(metaData)) {
				return;
			}
			if (metaData && !Validator.isVisible(metaData)) {
				if (this.state.isMousedownOnList() && !this.gui.inListviewArea(evt)) {
					// リストからビューへドラッグ中のパターン
					metaData.visible = "true";
					if (Validator.isWindowType(metaData)) {
						this.action.changeDisplayVisible(metaData);
						return;
					} else {
						this.action.changeContentVisible(metaData);
						return;
					}
				}
				else {
					return;
				}
			}
			// clear splitwhole colors
			this.gui.clearSnapHighLight();
			// Snap設定により背景色をハイライト
			if (Validator.isGridMode() && this.state.getDraggingIDList().length === 1) {
				let orgPos = Vscreen.transformOrgInv(Vscreen.makeRect(clientX, clientY, 0, 0));
				let splitWhole = Vscreen.getSplitWholeByPos(orgPos.x, orgPos.y);
				if (splitWhole) {
					document.getElementById(splitWhole.id).style.background = "red";
				}
			}
			if (Validator.isDisplayMode() && this.state.getDraggingIDList().length === 1) {
				let orgPos = Vscreen.transformOrgInv(Vscreen.makeRect(clientX, clientY, 0, 0));
				let screen = Vscreen.getScreenByPos(orgPos.x, orgPos.y, draggingID);
				if (screen && document.getElementById(screen.id)) {
					document.getElementById(screen.id).style.background = "red";
				}
			}
			// translate
			let elem = document.getElementById(draggingID);
			if (elem.style.display === "none") {
				elem.style.display = "block";
			}
			if (this.state.hasDragRect(draggingID)) {
				if (Validator.isWindowType(metaData) && this.store.getManagement().isDisplayEditable(this.state.getDisplaySelectedGroup())) {
					// display操作可能
					metaData.posx = this.state.getDragRect(draggingID).left + mx;
					metaData.posy = this.state.getDragRect(draggingID).top + my;
					VscreenUtil.transPosInv(metaData);
					VscreenUtil.assignMetaData(elem, metaData, true, this.store.getGroupDict());
				}
				else if (!Validator.isWindowType(metaData) && this.store.getManagement().isEditable(metaData.group)) {
					// content編集可能
					metaData.posx = this.state.getDragRect(draggingID).left + mx;
					metaData.posy = this.state.getDragRect(draggingID).top + my;
					VscreenUtil.transPosInv(metaData);
					VscreenUtil.assignMetaData(elem, metaData, true, this.store.getGroupDict());
				}
			}
			else {
				return;
			}
			if (Validator.isVisibleWindow(metaData) || Validator.isVisible(metaData)) {
				manipulator.moveManipulator(elem);
				targetMetaDatas.push(metaData);
			}
		});
		if (targetMetaDatas.length > 0) {
			this.store.operation.updateMetadataMulti(targetMetaDatas);
			this.updateSelectionRect();
		}
		if (manipulator.getDraggingManip()) {
			if (this.state.isSelectionRectShown()) {
				this.updateSelectionRect();
				this.onManipulatorMove(evt);
			}
			else {
				// console.log("iscontentarea");
				// scaling
				let elem = document.getElementById(this.state.getSelectedID());
				if (elem) {
					let metaData = this.store.getMetaData(elem.id);
					if (Validator.isVisibleWindow(metaData) || Validator.isVisible(metaData)) {
						manipulator.moveManipulator(elem);
						this.onManipulatorMove(evt);
					}
				}
			}
			evt.stopPropagation();
			evt.preventDefault();
		}
		if (this.state.getDraggingIDList().length > 0) {
			evt.stopPropagation();
			evt.preventDefault();
		}
	}

	onMouseDown(id) {
		return (evt) => {
			let metaData = null;
			let otherPreviewArea = this.gui.getContentPreviewArea();
			let topElement = null;
			let clientX;
			let clientY;
			let target;
			if (this.state.isSpaceDown()) {
				return;
			}
			evt = (evt) || window.event;
			if (evt.changedTouches) {
				// タッチ
				target = evt.changedTouches[0].target;
				clientX = evt.changedTouches[0].clientX;
				clientY = evt.changedTouches[0].clientY;
			}
			else {
				// マウス
				if (evt.button !== 0) {
					return;
				} // 左ドラッグのみ
				target = evt.target;
				clientX = evt.clientX;
				clientY = evt.clientY;
			}
			if (target && !target.hasOwnProperty('id')) {
				target = target.parentNode;
			}
			if (this.store.hasMetadata(id)) {
				metaData = this.store.getMetaData(id);
				if (Validator.isContentType(metaData)) {
					otherPreviewArea = this.gui.getDisplayPreviewArea();
				}
				if (Validator.isVideoType(metaData)) {
					// 動画コントロール上のボタンなどをクリックした場合は選択状態にしない
					if (evt.target && (evt.target.tagName === "INPUT" || evt.target.tagName === "BUTTON")) {
						return;
					}
				}
			}
			if (metaData) {
				if (id.indexOf(Constants.WholeWindowID) === 0 ||
					(!Validator.isDisplayTabSelected() && Validator.isWindowType(metaData)) ||
					(Validator.isDisplayTabSelected() && Validator.isContentType(metaData))) {
					let childs = otherPreviewArea.childNodes;
					for (let i = 0; i < childs.length; i = i + 1) {
						if (childs[i].onmousedown) {
							if (!topElement || topElement.zIndex < childs[i].zIndex) {
								if (ContentUtil.isInsideElement(childs[i], clientX, clientY)) {
									topElement = childs[i];
								}
							}
						}
					}
					if (topElement) {
						topElement.onmousedown(evt);
					}
					return;
				}
			}
			// erase last border
			if (!this.state.isCtrlDown() && !this.state.isShiftDown()) {
				this.unselectAll(true);
				this.select(id, this.gui.inListviewArea(evt));
				this.gui.closeContextMenu();
			}
			else {
				this.select(id, this.gui.inListviewArea(evt));
				this.gui.closeContextMenu();
			}
			this.state.setMousedownPos([
				clientX,
				clientY
			]);
			// メインビューまたはリストビューのコンテンツ
			let isListViewArea = this.gui.inListviewArea(evt);
			this.state.setMousedownOnList(isListViewArea);
			this.state.for_each_dragging_id((i, id) => {
				id = this.state.getSelectedIDList()[i];
				let elem = document.getElementById(id);
				let meta = this.store.getMetaData(id);
				if (elem) {
					if (Validator.isVisibleWindow(meta) || Validator.isVisible(meta)) {
						if (isListViewArea) {
							this.state.setDragRect(id, evt.target.getBoundingClientRect());
						}
						else {
							this.state.setDragRect(id, elem.getBoundingClientRect());
						}
					}
					else {
						this.state.setDragRect(id, evt.target.getBoundingClientRect());
					}
				}
			});
			evt.stopPropagation();
			evt.preventDefault();
		};
	}

	onMouseUp(evt) {
		let draggingIDList = this.state.getDraggingIDList();
		let clientX;
		let clientY;
		evt = (evt) || window.event;
		if (evt.changedTouches) {
			// タッチ
			clientX = evt.changedTouches[0].clientX;
			clientY = evt.changedTouches[0].clientY;
		}
		else {
			// マウス
			clientX = evt.clientX;
			clientY = evt.clientY;
		}
		for (let i = draggingIDList.length - 1; i >= 0; i = i - 1) {
			let draggingID = draggingIDList[i];
			if (this.store.hasMetadata(draggingID)) {
				let elem = document.getElementById(draggingID);
				let metaData = this.store.getMetaData(draggingID);
				if (this.state.isMousedownOnList() && !this.gui.inListviewArea(evt)) {
					// リストビューの項目がリストビューからメインビューにドラッグされた
					elem.style.margin = "0px";
					if (Validator.isLayoutType(metaData)) {
						this.gui.getContentPreviewArea().removeChild(elem);
						this.applyLayout(metaData);
					}
					else {
						if (Validator.isWindowType(metaData)) {
							metaData.visible = true;
						}
						else {
							if (this.store.getManagement().isEditable(metaData.group)) {
								metaData.visible = true;
							}
						}
					}
				}
				if (!this.gui.inListviewArea(evt)) {
					// スナップ
					if (Validator.isFreeMode()) {
						this.store.operation.updateMetadata(metaData);
					}
					else if (Validator.isDisplayMode()) {
						if (draggingIDList.length === 1) {
							let orgPos = Vscreen.transformOrgInv(Vscreen.makeRect(clientX, clientY, 0, 0));
							let screen = Vscreen.getScreenByPos(orgPos.x, orgPos.y, draggingID);
							if (screen) {
								this.action.snapContentToScreen({
									element : elem,
									metaData : metaData,
									screen : screen
								});
							}
							this.store.operation.updateMetadata(metaData);
							manipulator.moveManipulator(elem);
						}
					}
					else {
						// grid mode
						if (draggingIDList.length === 1) {
							let orgPos = Vscreen.transformOrgInv(Vscreen.makeRect(clientX, clientY, 0, 0));
							let splitWhole = Vscreen.getSplitWholeByPos(orgPos.x, orgPos.y);
							if (splitWhole) {
								this.action.snapContentToScreen({
									element : elem,
									metaData : metaData,
									screen : splitWhole
								});
							}
							this.store.operation.updateMetadata(metaData);
							manipulator.moveManipulator(elem);
						}
					}
				}
				this.gui.clearSnapHighLight();
			}
			draggingIDList.splice(i, 1);
		}
		this.state.setDraggingIDList(draggingIDList);
		manipulator.clearDraggingManip();
		this.state.setSelectionRectDragging(false);
		this.state.setMousedownOnList(false);
	}
	
	removeVirtualDisplay() {
		let previewArea = this.gui.getDisplayPreviewArea();
		let preWhole = document.getElementsByClassName("whole_screen_elem");
		let screenElems = document.getElementsByClassName("screen");
		if (preWhole[0]) {
			previewArea.removeChild(preWhole[0]);
		}
		for (let i = screenElems.length - 1; i >= 0; --i) {
			if (screenElems[i].id.indexOf("whole_sub_window") >= 0) {
				previewArea.removeChild(screenElems[i]);
			}
		}
	}

	removeBlockedDisplayRect(metaData) {
		let previewArea = this.gui.getDisplayPreviewArea();
		let elem = document.getElementById(metaData.id);
		let displayArea = this.gui.getBoxArea(Constants.TypeWindow, metaData.group);
		if (!displayArea) {
			displayArea = this.gui.getBoxArea(Constants.TypeWindow, Constants.DefaultGroup);
		}
		if (elem) {
			previewArea.removeChild(elem);
		}
		elem = this.gui.getListElem(metaData.id);
		if (elem) {
			displayArea.removeChild(elem);
		}
		manipulator.removeManipulator();
	}

	/**
	 * 現在のSite表示によって、コンテンツの表示状態を切り替える
	 */
	updateContentVisibleInSite()
	{
		// doneGetMetaDataを再度呼んで権限による可視不可視の切り替え
		this.store.for_each_metadata((i, meta) => {
			if (Validator.isContentType(meta)) {
				this.doneGetMetaData(null, meta);
			}
		});
	}

	/**
	 * VirtualScreen更新
	 * @method updateScreen
	 * @param {JSON} windowData ウィンドウデータ. 無い場合はすべてのVirtualScreenが更新される.
	 */
	updateScreen(windowData) {
		let whole = Vscreen.getWhole();
		let screen;
		let wholeElem;
		let previewArea = this.gui.getDisplayPreviewArea();
		let elem;
		let idElem;
		let screenElem;
		if (windowData && windowData !== undefined) {
			// Screenを登録
			Vscreen.assignScreen(windowData.id, windowData.orgX, windowData.orgY, windowData.orgWidth, windowData.orgHeight, windowData.visible, windowData.group);
			Vscreen.setScreenSize(windowData.id, windowData.width, windowData.height);
			Vscreen.setScreenPos(windowData.id, windowData.posx, windowData.posy);
			screen = Vscreen.getScreen(windowData.id);
			if (screen) {
				screenElem = document.getElementById(windowData.id);
				if (!screenElem) {
					// 新規Screen Element作成
					screenElem = document.createElement('div');
					idElem = document.createElement('div');
					idElem.innerHTML = "ID:" + windowData.id;
					idElem.className = "screen_id";
					screenElem.appendChild(idElem);
					screenElem.className = "screen";
					screenElem.id = windowData.id;
					screenElem.style.borderStyle = 'solid';
					screenElem.style.display = "none";
					previewArea.appendChild(screenElem);
					this.setupWindow(screenElem, windowData.id);
				}
				if (screenElem) {
					if (Validator.isVisibleWindow(windowData)) {
						VscreenUtil.assignMetaData(screenElem, windowData, true, this.store.getGroupDict());
						VscreenUtil.assignScreenRect(screenElem, Vscreen.transformScreen(screen));
						screenElem.style.display = "block";
					}
					else {
						screenElem.style.display = "none";
					}
				}
			}
		}
		else {
			this.gui.assignVirtualDisplay(Vscreen.getWhole(), Vscreen.getSplitCount());
			// 全可視コンテンツの配置を再計算.
			this.store.for_each_metadata((i, metaData) => {
				if (Validator.isVisible(metaData)) {
					if (Validator.isContentType(metaData)) {
						if (this.store.getManagement().isViewable(metaData.group))
						{
							elem = document.getElementById(metaData.id);
							if (elem) {
								VscreenUtil.assignMetaData(elem, metaData, true, this.store.getGroupDict());
							}
						}
					}
				}
			});
			// Virtual Displayを生成して配置.
			wholeElem = document.getElementById(Constants.WholeWindowID + "_" + this.state.getDisplaySelectedGroup());
			if (!wholeElem) {
				wholeElem = document.createElement('span');
				wholeElem.className = "whole_screen_elem";
				wholeElem.id = Constants.WholeWindowID + "_" + this.state.getDisplaySelectedGroup();
				this.setupWindow(wholeElem, wholeElem.id);
				previewArea.appendChild(wholeElem);
			}
			VscreenUtil.assignScreenRect(wholeElem, whole);
			
			let permissionList = this.store.getDisplayPermissionList();
			let permissionDict = {};
			for (let i = 0; i < permissionList.length; ++i) {
				Object.assign(permissionDict, permissionList[i]);
			}

			// 保持しているmetadataから枠を生成して配置.
			this.store.for_each_metadata((i, metaData) => {
				if (Validator.isWindowType(metaData)) {
					if (permissionDict.hasOwnProperty(metaData.id) && String(permissionDict[metaData.id]) !== "true") {
						// 許可されていないディスプレイ
						this.removeBlockedDisplayRect(metaData);
						return;
					}
					// Screenを登録
					Vscreen.assignScreen(metaData.id, metaData.orgX, metaData.orgY, metaData.orgWidth, metaData.orgHeight, metaData.visible, metaData.group);
					Vscreen.setScreenSize(metaData.id, metaData.width, metaData.height);
					Vscreen.setScreenPos(metaData.id, metaData.posx, metaData.posy);
					screen = Vscreen.getScreen(metaData.id);
					if (!screen) {
						console.error("update screen failed");
						return;
					}
					screenElem = document.getElementById(metaData.id);
					if (!screenElem) {
						if (Validator.isVisibleWindow(metaData)) {
							this.gui.importDisplay(metaData);
						}
					}
					if (screenElem) {
						if (Validator.isVisibleWindow(metaData)) {
							VscreenUtil.assignMetaData(screenElem, metaData, true, this.store.getGroupDict());
							VscreenUtil.assignScreenRect(screenElem, Vscreen.transformScreen(screen));
							screenElem.style.display = "block";
						}
						else {
							screenElem.style.display = "none";
						}
					}
				}
			});
			this.setupSplit(Vscreen.getSplitWholes());
		}
		this.updateSelectionRect();
	}

	// 権限情報が更新された
	onUpdateAuthority(endCallback) {
		let key = this.store.getLoginStore().getLoginKey();
		if (key.length > 0) {
			let request = { id: "", password: "", loginkey: key };

			// TODO action化
			Connector.send(Command.Login, request, (err, reply) => {
				if (err || reply === "failed") {
					// ログインに失敗した。リロードする.
					window.location.reload(true);
				}
				// todo 何とかする
				this.store.getManagement().authority = reply.authority;
				if (endCallback) {
					endCallback();
				}
			});
		}
		else {
			if (endCallback) {
				endCallback();
			}
		}
	}

	///-------------------------------------------------------------------------------------------------------
	createWholeWindow(groupID) {
		let divElem = document.createElement("div");
		let idElem = document.createElement('div');
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

	/**
	 * Content設定
	 * @method setupContent
	 * @param {Object} elem 設定対象Object
	 * @param {String} id ContentID
	 */
	setupContent(elem, id) {
		if (window.ontouchstart !== undefined) {
			elem.ontouchstart = this.onMouseDown(id);
		}
		else {
			elem.onmousedown = this.onMouseDown(id);
		}
	}

	/**
	 * レイアウト適用
	 * @method applyLayout
	 * @param {JSON} metaData 対象メタデータ
	 */
	applyLayout(metaData) {
		InputDialog.showOKCancelInput({
			name: i18next.t('layout_apply_is_ok'),
		}, (isOK) => {
			if (isOK) {
				this.action.applyContentLayout({
					type: metaData.type, id: metaData.id
				});
			}
		});
	}

	updateSelectionRect() {
		let rect;
		let selectionRect = getSelectionRectElem();
		if (!this.state.isSelectionRectShown()) {
			return;
		}
		function Union(rectA, rectB) {
			if (!rectA) {
				return rectB;
			}
			let left = Math.min(rectA.left, rectB.left);
			let top = Math.min(rectA.top, rectB.top);
			let right = Math.max(rectA.right, rectB.right);
			let bottom = Math.max(rectA.bottom, rectB.bottom);
			return {
				left: left,
				top: top,
				right: right,
				bottom: bottom
			};
		}
		for (let i = 0; i < this.state.getSelectedIDList().length; ++i) {
			let id = this.state.getSelectedIDList()[i];
			let elem = this.getElem(id, false);
			let meta = this.store.getMetaData(id);
			if (elem && (Validator.isVisible(meta) || Validator.isVisibleWindow(meta))) {
				rect = Union(rect, elem.getBoundingClientRect());
			}
		}
		if (rect) {
			selectionRect.style.left = rect.left + "px";
			selectionRect.style.top = rect.top + "px";
			selectionRect.style.width = (rect.right - rect.left) + "px";
			selectionRect.style.height = (rect.bottom - rect.top) + "px";
		}
		manipulator.moveManipulator(selectionRect);
		if (!manipulator.isShowManipulator()) {
			if (Validator.isDisplayTabSelected()) {
				manipulator.showManipulator(
					selectionRect,
					this.gui.getDisplayPreviewArea());
			}
			else {
				manipulator.showManipulator(
					selectionRect,
					this.gui.getContentPreviewArea());
			}
			manipulator.moveManipulator(selectionRect);
		}
	}

	showSelectionRect(show, metaData) {
		let selectionRect = getSelectionRectElem();
		if (show) {
			selectionRect.style.display = "block";
			this.state.setSelectionRectShown(true);
		}
		else {
			selectionRect.style.display = "none";
			this.state.setSelectionRectShown(false);
		}
		this.updateSelectionRect();
	}

	onMultiMove(evt) {
		if (!this.state.isSelectionRectDragging())
			return;
		let i;
		let id;
		let metaData;
		let elem;
		let clientX = evt.clientX;
		let clientY = evt.clientY;
		let targetMetaDatas = [];
		if (evt.changedTouches) {
			// タッチ
			clientX = evt.changedTouches[0].clientX;
			clientY = evt.changedTouches[0].clientY;
		}
		//totalRect = this.getTotalSelectionRect();
		let mx = clientX - this.state.getMousedownPos()[0];
		let my = clientY - this.state.getMousedownPos()[1];
		for (i = 0; i < this.state.getSelectedIDList().length; ++i) {
			id = this.state.getSelectedIDList()[i];
			if (Validator.isVirtualDisplayID(id))
				return;
			// detect content list area
			if (this.gui.inListviewArea2(evt, this.state.getMousedownPos()) && this.gui.inListviewArea(evt)) {
				return;
			}
			metaData = this.store.getMetaData(id);
			if (metaData && !Validator.isVisible(metaData)) {
				continue;
			}
			elem = this.getElem(id, false);
			if (this.state.hasDragRect(id)) {
				if (Validator.isWindowType(metaData) && this.store.getManagement().isDisplayEditable(this.state.getDisplaySelectedGroup())) {
					// display操作可能
					metaData.posx = this.state.getDragRect(id).left + mx;
					metaData.posy = this.state.getDragRect(id).top + my;
					VscreenUtil.transPosInv(metaData);
					VscreenUtil.assignMetaData(elem, metaData, true, this.store.getGroupDict());
				}
				else if (!Validator.isWindowType(metaData) && this.store.getManagement().isEditable(metaData.group)) {
					// content編集可能
					metaData.posx = this.state.getDragRect(id).left + mx;
					metaData.posy = this.state.getDragRect(id).top + my;
					VscreenUtil.transPosInv(metaData);
					VscreenUtil.assignMetaData(elem, metaData, true, this.store.getGroupDict());
				}
			}
			if (Validator.isVisibleWindow(metaData) || Validator.isVisible(metaData)) {
				targetMetaDatas.push(metaData);
			}
		}
		if (targetMetaDatas.length > 0) {
			this.store.operation.updateMetadataMulti(targetMetaDatas);
		}
		this.updateSelectionRect();
	}

	setupSelectionRect() {
		let selectionRect = document.getElementById('selection_rect');
		let displaySelectionRect = document.getElementById('display_selection_rect');
		selectionRect.style.borderColor = "rgb(4, 180, 49)";
		displaySelectionRect.style.borderColor = "rgb(50, 200, 255)";
		let onSelectionRectMouseDown = (evt) => {
			let clientX;
			let clientY;
			let target;
			evt = (evt) || window.event;
			if (evt.changedTouches) {
				// タッチ
				target = evt.changedTouches[0].target;
				clientX = evt.changedTouches[0].clientX;
				clientY = evt.changedTouches[0].clientY;
			}
			else {
				// マウス
				if (evt.button !== 0) {
					this.state.setSelectionRectDragging(false);
					return;
				} // 左ドラッグのみ
				target = evt.target;
				clientX = evt.clientX;
				clientY = evt.clientY;
			}
			this.state.setSelectionRectDragging(true);
			this.state.setMousedownPos([
				clientX,
				clientY
			]);
			if (target) {
				// メインビューのコンテンツ
				for (let i = 0; i < this.state.getSelectedIDList().length; ++i) {
					let id = this.state.getSelectedIDList()[i];
					let elem = document.getElementById(id);
					if (elem) {
						this.state.setDragRect(id, elem.getBoundingClientRect());
					}
				}
			}
			evt.preventDefault();
			evt.stopPropagation();
		};
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
	select(id, isListViewArea) {
		let metaData;
		let wholeMetaData;
		let groupID;
		// console.log("selectid", id);
		if (this.store.hasMetadata(id)) {
			metaData = this.store.getMetaData(id);
		}
		if (Validator.isVirtualDisplayID(id)) {
			groupID = this.state.getDisplaySelectedGroup();
			wholeMetaData = this.store.getVirtualDisplayMetaData(groupID);
			if (wholeMetaData) {
				this.gui.initContentProperty(wholeMetaData, "", "whole_window");
				this.gui.assignVirtualDisplay(Vscreen.getWhole(), Vscreen.getSplitCount());
				if (this.gui.getWholeWindowElem(groupID)) {
					this.gui.getWholeWindowElem(groupID).style.borderColor = this.store.getBorderColor(wholeMetaData);
				}
			}
			if (this.state.getSelectedIDList().indexOf(id) < 0) {
				this.state.addSelectedID(id);
			}
			this.state.setLastSelectWindowID(id);
			return;
		}
		if (id.indexOf(Constants.WholeSubWindowID) >= 0) {
			return;
		}
		if (this.gui.getWholeWindowElem(groupID)) {
			this.gui.getWholeWindowElem(groupID).style.borderColor = "white";
		}
		let elem = this.getElem(id, isListViewArea);
		if (!elem) {
			return;
		}
		if (elem.id !== id) {
			id = elem.id;
		}
		metaData = this.store.getMetaData(id);
		let initialVisible = (metaData && metaData.hasOwnProperty('visible')) ? metaData.visible : false;
		elem.style.border = "solid 2px";
		if (this.state.getSelectedIDList().indexOf(id) < 0) {
			this.state.addSelectedID(id);
		}

		let isContentInViewableSite = true;
		if (metaData && Validator.isContentType(metaData)) {
			if (!this.store.getManagement().isViewableSite(metaData.group)) {
				// コンテンツは現在表示中のサイトで表示可能な場合のみ
				// マニピュレータを出す
				isContentInViewableSite = false;
			}
		}
		if (isContentInViewableSite)
		{
			this.state.setDraggingIDList(JSON.parse(JSON.stringify(this.state.getSelectedIDList())));
		}

		// 選択ボーダー色設定
		if (this.gui.getListElem(id)) {
			this.gui.getListElem(id).style.borderColor = this.store.getBorderColor(metaData);
		}
		if (this.gui.getSearchElem(id)) {
			this.gui.getSearchElem(id).style.borderColor = this.store.getBorderColor(metaData);
		}
		elem.style.borderColor = this.store.getBorderColor(metaData);

		// レイアウトでは枠を出さない
		if (Validator.isLayoutType(metaData)) {
			return;
		}

		if (this.state.getSelectedIDList().length <= 0) {
			// 選択されているものがなかった.
			manipulator.removeManipulator();
			this.showSelectionRect(false);
		}
		else if (this.state.getSelectedIDList().length > 1) {
			// 複数選択. マニピュレーター, プロパティ設定
			manipulator.removeManipulator();
			if (Validator.isWindowType(metaData)) {
				this.gui.initContentProperty(metaData, "", Constants.PropertyTypeMultiDisplay);
			}
			else {
				this.gui.initContentProperty(metaData, "", Constants.PropertyTypeMultiContent);
			}
			// まとめて移動/拡縮するための枠を表示
			this.showSelectionRect(true, metaData);
			return;
		}
		else {
			// 単一選択.マニピュレーター, プロパティ設定
			if (Validator.isWindowType(metaData)) {
				this.gui.initContentProperty(metaData, "", Constants.PropertyTypeDisplay);
				this.gui.assignContentProperty(metaData);

				if (isContentInViewableSite)
				{
					manipulator.showManipulator(elem, this.gui.getDisplayPreviewArea());
				}
			}
			else {
				// 動画の場合は所有しているかどうか調べる
				let isOwnVideo = false;
				if (metaData.type === Constants.PropertTypeVideo) {
					isOwnVideo = this.store.getVideoStore().hasVideoData(metaData.id);
				}
				if (this.store.getGroupStore().hasGroup(metaData.group)) {
					this.gui.initContentProperty(metaData, this.store.getGroupStore().getGroup(metaData.group).name, metaData.type, isOwnVideo);
				}
				else {
					console.warn("not found group", metaData);
					this.gui.initContentProperty(metaData, "", metaData.type, isOwnVideo);
				}
				this.gui.assignContentProperty(metaData);
				this.gui.setUpdateContentID(id);

				if (isContentInViewableSite)
				{
					manipulator.showManipulator(elem, this.gui.getContentPreviewArea());
				}
			}
		}
		if (Validator.isDisplayTabSelected()) {
			this.state.setLastSelectWindowID(id);
		}
		else {
			this.state.setLastSelectContentID(id);
		}
		if (elem.style.zIndex === "") {
			elem.style.zIndex = 0;
		}
		if (initialVisible === "true" || initialVisible === true) {
			manipulator.moveManipulator(elem);
		}
		else {
			manipulator.removeManipulator();
			this.showSelectionRect(false);
		}
	}

	/**
	 * 現在選択されているContents, もしくはVirtualDisplayを非選択状態にする
	 * @method unselect
	 */
	unselect(id, isUpdateMetaInfo) {
		let elem = this.getElem(id, true);
		let metaData;
		if (elem) {
			// 選択されていたメタデータの特定
			// 通常データ
			metaData = this.store.getMetaData(id);
			if (!metaData) {
				if (Validator.isVirtualDisplayID(id)) {
					// VirtualDisplayのデータ
					let groupID = id.split("onlist:").join("");
					groupID = groupID.split(Constants.WholeWindowListID + "_").join("");
					groupID = groupID.split(Constants.WholeWindowID + "_").join("");
					metaData = this.store.getVirtualDisplayMetaData(groupID);
				}
			}
			if (metaData) {
				if (Validator.isWindowType(metaData)) {
					elem.style.border = "2px solid lightslategray";
				}
				if (Validator.isContentType(metaData) && Validator.isVisible(metaData) && String(metaData.mark) !== "true") {
					elem.style.border = "";
				}
				if (this.gui.getListElem(elem.id)) {
					this.gui.getListElem(elem.id).style.borderColor = this.store.getListBorderColor(metaData);
					if (this.gui.getSearchElem(elem.id)) {
						this.gui.getSearchElem(elem.id).style.borderColor = this.store.getListBorderColor(metaData);
					}
				}
			}
		}
		this.gui.clearContentProperty(isUpdateMetaInfo);
		this.state.getSelectedIDList().splice(this.state.getSelectedIDList().indexOf(id), 1);
		if (this.state.getSelectedIDList().length === 0) {
			// まとめて移動/拡縮するための枠を非表示
			this.showSelectionRect(false, metaData);
		}
		manipulator.removeManipulator();
	}

	unselectAll(isUpdateMetaInfo) {
		for (let i = this.state.getSelectedIDList().length - 1; i >= 0; i = i - 1) {
			this.unselect(this.state.getSelectedIDList()[i], isUpdateMetaInfo);
		}
		this.state.clearDragRect();
	}

	/**
	 * クローズボタンハンドル。選択されているcontent or windowを削除する。
	 * その後クローズされた結果をupdateMetaDataにて各Windowに通知する。
	 * @method onCloseContent
	 */
	onCloseContent() {
		let metaData = null;
		let previewArea;
		// console.log("onCloseContent");
		for (let i = this.state.getSelectedIDList().length - 1; i >= 0; i = i - 1) {
			let id = this.state.getSelectedIDList()[i];
			if (this.store.hasMetadata(id)) {
				this.unselect(id);
				let elem = this.getElem(id, false);
				metaData = this.store.getMetaData(id);
				if (!this.store.getManagement().isEditable(metaData.group)) {
					// 編集不可コンテンツ
					return;
				}
				metaData.visible = false;
				if (Validator.isWindowType(metaData)) {
					previewArea = this.gui.getDisplayPreviewArea();
				}
				else {
					previewArea = this.gui.getContentPreviewArea();
				}
				previewArea.removeChild(elem);
				this.store.operation.updateMetadata(metaData);
			}
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
	doneGetMetaData(err, reply, endCallback) {
		if (!this.store.isInitialized()) {
			return;
		}
		// console.log('doneGetMetaData', reply);
		let json = reply;
		let elem;
		let metaData = json;
		let isUpdateContent = false;
		if (!json.hasOwnProperty('id')) {
			return;
		}
		if (this.store.hasMetadata(json.id)) {
			isUpdateContent = (this.store.getMetaData(json.id).store_index !== reply.store_index);
			isUpdateContent = isUpdateContent || (this.store.getMetaData(json.id).keyvalue !== reply.keyvalue);
		}
		if (json.hasOwnProperty('group')) {
			if (!this.store.getManagement().isViewable(json.group)) {
				elem = document.getElementById(metaData.id);
				if (elem) {
					elem.style.display = "none";
				}
				return;
			}
		}
		if (json.type === "webgl" && json.hasOwnProperty("cameraWorldMatrix")) {
			if(json.webglType && json.webglType === "qgis2three.js"){
				/* qgis */
				this.action.updateQgisMetadata(metaData);
			}else{
				/* itowns */
				let funcDict = this.store.getITownFuncDict();
				if (funcDict && funcDict.hasOwnProperty(json.id)) {
					funcDict[json.id].chowder_itowns_update_camera(json);
				}
				if (funcDict && funcDict.hasOwnProperty(json.id)) {
					funcDict[json.id].chowder_itowns_update_layer_list(json);
				}
				this.gui.showCopyrights(document.getElementById(metaData.id), metaData);
			}
		}
		this.store.setMetaData(json.id, json);
		if (Validator.isCurrentTabMetaData(json)) {
			if (this.state.getLastSelectContentID() === json.id || (manipulator.isShowManipulator() && this.state.getLastSelectContentID() === json.id)) {
				this.gui.assignContentProperty(json);
			}
		}
		if (Validator.isWindowType(json)) {
			return;
		}
		elem = document.getElementById(metaData.id);
		if (elem && !isUpdateContent) {
			if (Validator.isVisible(json)) {
				VscreenUtil.assignMetaData(elem, json, true, this.store.getGroupDict());
				elem.style.display = "block";
				// pdfページの切り替え
				if (json.type === 'pdf' && elem.loadPage) {
					elem.loadPage(parseInt(json.pdfPage), parseInt(json.width));
				}
			}
			else {
				elem.style.display = "none";
			}
			this.action.toggleContentMarkIcon({
				element : elem,
				metaData : metaData
			});
			if (endCallback) {
				endCallback(null);
			}
		}
		else {
			// 新規コンテンツロード.
			let request = { type: json.type, id: json.id };
			if (json.hasOwnProperty('rethis.store_index')) {
				request.rethis.store_index = json.rethis.store_index;
			}
			// console.log("新規コンテンツロード", json);
			if (json.type === "video") {
				if (this.store.getVideoStore().hasVideoData(json.id)) {
					this.action.getContent({
						request : request,
						callback : (err, data) => {
							this.gui.importContent(json, data.contentData, this.store.getVideoStore().getVideoPlayer(json.id));
							this.action.toggleContentMarkIcon({
								element : document.getElementById(metaData.id),
								metaData : data.metaData
							});
							if (endCallback) {
								endCallback(null);
							}
						},
						preventDefaultEmit : true
					});
				}
				else {
					this.action.getContent({
						request : request,
						callback : (err, data) => {
							this.gui.importContent(json, data.contentData);
							this.action.toggleContentMarkIcon({
								element : document.getElementById(metaData.id),
								metaData : data.metaData
							});
							if (endCallback) {
								endCallback(null);
							}
						},
						preventDefaultEmit : true
					});
				}
			}
			else {
				this.action.getContent({
					request : request,
					callback : (err, data) => {
						this.doneGetContent(err, data, endCallback);
						this.action.toggleContentMarkIcon({
							element : document.getElementById(metaData.id),
							metaData : data.metaData
						});
					},
					preventDefaultEmit : true
				});
			}
		}
	}

	/**
	 * GetContentを送信した後の終了コールバック.
	 * @method doneGetContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {Object} reply 返信されたコンテンツ
	 */
	doneGetContent(err, reply, endCallback) {
		let metaData;
		let contentData;
		if (!this.store.isInitialized()) {
			return;
		}
		if (!err) {
			if (reply.hasOwnProperty('metaData')) {
				metaData = reply.metaData;
				contentData = reply.contentData;
			}
			else if (reply.hasOwnProperty("id") && reply.type === Constants.TypeTileImage) {
				metaData = reply;
				contentData = "removed by the capacity limit";
			}
			// キャッシュしていないメタデータだったらキャッシュしておく
			if (!this.store.hasMetadata(metaData.id)) {
				this.store.setMetaData(metaData.id, metaData);
			}
			if (metaData.type === "video") {
				if (this.store.getVideoStore().hasVideoData(metaData.id)) {
					this.gui.importContent(metaData, contentData, this.store.getVideoStore().getVideoPlayer(metaData.id));
				}
				else {
					// ローカルに保持していない動画コンテンツ
					this.gui.importContent(metaData, contentData);
				}
			}
			else {
				this.gui.importContent(metaData, contentData);
			}
			if (endCallback) {
				endCallback(err, reply);
			}
		}
		else {
			console.error(err);
		}
	}
	/**
	 * UpdateMetaDataを送信した後の終了コールバック.
	 * @method doneUpdateMetaData
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneUpdateMetaData(err, reply, endCallback) {
		if (!this.store.isInitialized()) {
			return;
		}
		// console.log("doneUpdateMetaData", reply);
		if (err) {
			console.error(err);
			return;
		}
		if (reply.length === 1) {
			let json = reply[0];
			if (Validator.isCurrentTabMetaData(json)) {
				this.gui.assignContentProperty(json);
			}
		}
		for (let i = 0; i < reply.length; ++i) {
			let json = reply[i];
			if (json.hasOwnProperty('quality')) {
				try {
					let quality = JSON.parse(json.quality);
					let webRTCDict = this.store.getVideoStore().getWebRTCDict();
					if (webRTCDict) {
						for (let k in webRTCDict) {
							if (k.indexOf(json.id) >= 0) {
								webRTCDict[k].setBandWidth(quality);
							}
						}
					}
				}
				catch (e) {
					console.error(e);
				}
			}
			// アイコン更新
			this.action.toggleContentMarkIcon({
				element : document.getElementById(json.id),
				metaData : json
			});
			// this.storeに格納
			this.store.setMetaData(json.id, json);
		}
		if (this.store.getState().isSelectionRectShown() && reply.length > 0) {
			this.updateSelectionRect();
		}
		if (endCallback) {
			endCallback(err, reply);
		}
	}
	/**
	 * UpdateWindowMetaDataMultiを送信した後の終了コールバック.
	 * @method doneUpdateWindowMetaData
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneUpdateWindowMetaData(err, reply, endCallback) {
		if (!this.store.isInitialized()) {
			return;
		}
		if (!reply) {
			return;
		}
		// console.log("doneUpdateWindowMetaData");
		let windowData;
		let windowDataList = reply;
		for (let i = 0; i < windowDataList.length; ++i) {
			windowData = windowDataList[i];
			this.store.setMetaData(windowData.id, windowData);
			this.updateScreen(windowData);
			let elem = this.getElem(windowData.id);
			if (!this.state.isSelectionRectShown()) {
				manipulator.moveManipulator(elem);
			}
		}
		if (this.state.isSelectionRectShown() && windowDataList.length > 0) {
			this.updateSelectionRect();
		}
		if (endCallback) {
			endCallback(err, reply);
		}
	}

	/**
	 * DeleteContentを送信した後の終了コールバック.
	 * @method doneDeleteContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneDeleteContent(err, reply) {
		if (!this.store.isInitialized()) {
			return;
		}
		// console.log("doneDeleteContent", err, reply);
		let func = (err, reply) => {
			let json = reply;
			let previewArea = this.gui.getContentPreviewArea();
			let deleted = document.getElementById(json.id);
			manipulator.removeManipulator();
			this.showSelectionRect(false);
			if (deleted) {
				previewArea.removeChild(deleted);
			}
			if (this.gui.getListElem(json.id)) {
				this.gui.getListElem(json.id).parentNode.removeChild(this.gui.getListElem(json.id));
			}
			if (this.gui.getSearchElem(json.id)) {
				this.gui.getSearchElem(json.id).parentNode.removeChild(this.gui.getSearchElem(json.id));
			}
			this.gui.setUpdateContentID("No Content Selected.");
			this.state.setLastSelectContentID(null);
			if (this.store.hasMetadata(json.id)) {
				this.store.deleteMetaData(json.id);
			}
			// delete webrtc with video
			for (let k in this.webRTC) {
				if (k.indexOf(json.id) >= 0) {
					this.webRTC[k].close(true);
					json.from = "controller";
					// TODO action化
					Connector.sendBinary(Command.RTCClose, json, JSON.stringify({
						key: k
					}), function (err, reply) { });
					delete json.from;
				}
			}
			if (this.store.getVideoStore().hasVideoData(json.id)) {
				this.store.getVideoStore().deleteVideoData(json.id);
			}
			if (this.store.getVideoStore().hasVideoPlayer(json.id)) {
				this.store.getVideoStore().deleteVideoPlayer(json.id);
			}
		};
		for (let i = 0; i < reply.length; i = i + 1) {
			func(err, reply[i]);
		}
	}
	/**
	 * DeleteWindowMetaDataを送信した後の終了コールバック.
	 * @method doneDeleteWindowMetaData
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneDeleteWindowMetaData(err, reply) {
		if (!this.store.isInitialized()) {
			return;
		}
		// console.log("doneDeleteWindowMetaData", reply);
		let elem;
		let windowData;
		let displayArea = this.gui.getDisplayArea();
		let previewArea = this.gui.getDisplayPreviewArea();
		manipulator.removeManipulator();
		this.showSelectionRect(false);
		if (reply.hasOwnProperty('id')) {
			elem = document.getElementById(reply.id);
			if (elem) {
				previewArea.removeChild(elem);
			}
			elem = this.gui.getListElem(reply.id);
			if (elem) {
				displayArea.removeChild(elem);
			}
			this.store.deleteMetaData(reply.id);
		}
		else {
			// 全部消された.
			this.store.for_each_metadata(function (id, metaData) {
				windowData = metaData;
				if (Validator.isWindowType(windowData)) {
					elem = document.getElementById(id);
					if (elem) {
						previewArea.removeChild(elem);
					}
					elem = this.gui.getListElem(id);
					if (elem) {
						displayArea.removeChild(elem);
					}
				}
				this.store.deleteMetaData(id);
			});
		}
		this.state.setLastSelectWindowID(null);
	}

	/**
	 * UpdateContentを送信した後の終了コールバック.
	 * @method doneUpdateContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneUpdateContent(err, reply) {
		if (!this.store.isInitialized()) {
			return;
		}
		// console.log("doneUpdateContent");
		this.gui.setUpdateContentID("No Content Selected.");
		manipulator.removeManipulator();
		this.showSelectionRect(false);
	}

	/**
	 * AddContentを送信した後の終了コールバック.
	 * @method doneAddContent
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneAddContent(err, reply, endCallback) {
		if (!this.store.isInitialized()) {
			return;
		}
		let json = reply;
		// console.log("doneAddContent:" + json.id + ":" + json.type);
		// DisplayタブだったらContentタブに変更する.
		if (this.gui.isActiveTab(Constants.TabIDDisplay)) {
			this.gui.changeTabByID(Constants.TabIDContent);
		}
		// 新規追加ではなく差し替えだった場合.
		if (this.store.hasMetadata(json.id)) {
			this.doneUpdateContent(err, reply);
			this.unselectAll(true);
			this.select(json.id, true);
			if (endCallback) {
				endCallback(err, reply);
			}
			return;
		}
		this.doneGetMetaData(err, reply, () => {
			this.unselectAll(true);
			this.select(json.id, true);
			if (endCallback) {
				endCallback(err, reply);
			}
		});
	}

	/**
	 * GetWindowMetaDataを送信した後の終了コールバック.
	 * @method doneGetWindowMetaData
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneGetWindowMetaData(err, reply) {
		if (!this.store.isInitialized()) {
			return;
		}
		// console.log('doneGetWindowMetaData:');
		let windowData = reply;
		this.store.setMetaData(windowData.id, windowData);
		
		let permissionList = this.store.getDisplayPermissionList();
		let permissionDict = {};
		for (let i = 0; i < permissionList.length; ++i) {
			Object.assign(permissionDict, permissionList[i]);
		}
		if (permissionDict.hasOwnProperty(windowData.id) && String(permissionDict[windowData.id]) === "true") {
			this.gui.importDisplay(windowData);
			this.gui.changeWindowBorderColor(windowData);
			if (Validator.isCurrentTabMetaData(reply)) {
				if (this.state.getLastSelectWindowID() === windowData.id || (manipulator.getDraggingManip() && this.state.getLastSelectWindowID() === windowData.id)) {
					this.gui.assignContentProperty(windowData);
				}
			}
			if (this.store.getState().isSelectionRectShown() && reply) {
				this.updateSelectionRect();
			}
			this.updateScreen(windowData);
		} else {
			// 許可されていないディスプレイ
			this.removeBlockedDisplayRect(windowData);
		}
	}

	/**
	 * GetGroupListを送信した後の終了コールバック.
	 * @method doneGetGroupList
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneGetGroupList(err, reply) {
		if (!this.store.isInitialized()) {
			return;
		}
		// console.log("doneGetGroupList", reply);
		let groupToElems = {};
		let groupToMeta = {};
		groupToElems[Constants.DefaultGroup] = [];
		groupToMeta[Constants.DefaultGroup] = [];
		let selectedGroup = this.gui.getCurrentGroupID();
		if (!err && reply.hasOwnProperty('grouplist')) {
			// 一旦全部のリストエレメントをはずす.
			this.store.for_each_metadata(function (id, metaData) {
				if (Validator.isContentType(metaData) ||
					Validator.isWindowType(metaData) ||
					Validator.isLayoutType(metaData))
				{
					const onlistID = "onlist:" + id;
					let elem = document.getElementById(onlistID);
					if (elem) {
						elem.parentNode.removeChild(elem);

						// 外したエレメントとmetadataを覚えておく
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
			let searchTargetGroups = this.gui.getSearchTargetGroups();
			let currentGroup = this.gui.getCurrentGroupID();
			// groupリストを新たにセットして, Searchタブ等を初期化
			this.gui.setGroupList(reply.grouplist, reply.displaygrouplist);
			this.store.getGroupStore().setGroupList(reply.grouplist, reply.displaygrouplist);
			// Virtual Displayはすべてに追加しなおす.
			this.store.getGroupStore().for_each_display_group((i, group) => {
				let elem = this.createWholeWindow(group.id);
				if (this.gui.getBoxArea(Constants.TypeWindow, group.id)) {
					this.gui.getBoxArea(Constants.TypeWindow, group.id).appendChild(elem);
				}
			});
			// 元々あったリストエレメントを全部つけなおす
			for (let group in groupToElems) {
				if (groupToElems.hasOwnProperty(group)) {
					groupToMeta[group]
					let contentArea = this.gui.getBoxArea(Constants.TypeContent, group);
					if (!contentArea) {
						contentArea = this.gui.getBoxArea(Constants.TypeContent, Constants.DefaultGroup);
					}
					let layoutArea = this.gui.getBoxArea(Constants.TypeLayout, group);
					if (!layoutArea) {
						layoutArea = this.gui.getBoxArea(Constants.TypeLayout, Constants.DefaultGroup);
					}
					let displayArea = this.gui.getBoxArea(Constants.TypeWindow, group);
					if (!displayArea) {
						displayArea = this.gui.getBoxArea(Constants.TypeWindow, Constants.DefaultGroup);
					}
					for (let i = 0; i < groupToElems[group].length; i = i + 1) {
						let metaData = groupToMeta[group][i];
						if (Validator.isContentType(metaData)) {
							contentArea.appendChild(groupToElems[group][i]);
						}
						else if (Validator.isLayoutType(metaData)) {
							layoutArea.appendChild(groupToElems[group][i]);
						}
						else if (Validator.isWindowType(metaData)) {
							displayArea.appendChild(groupToElems[group][i]);
						}
					}
				}
			}
			if (selectedGroup && document.getElementById(selectedGroup)) {
				document.getElementById(selectedGroup).onclick();
			}
			// Search対象グループをチェックし直す
			this.gui.checkSearchTargetGroups(searchTargetGroups, true);
			// カレントグループを選択し直す.
			this.gui.selectGroup(currentGroup);
		}
	}

	/**
	 * GetVirtualDisplayを送信した後の終了コールバック.
	 * @method doneGetVirtualDisplay
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneGetVirtualDisplay(err, reply) {
		if (!this.store.isInitialized()) {
			return;
		}
		let windowData = reply;
		let panel = document.getElementsByClassName('preview_area_panel__')[0];
		let cx = (panel.getBoundingClientRect().right - panel.getBoundingClientRect().left) / 2;
		let cy = (panel.getBoundingClientRect().bottom - panel.getBoundingClientRect().top) / 2 + 28;

		if (windowData.hasOwnProperty('group')) {
			this.store.setVirtualDisplayMetaData(windowData.group, windowData);
		}
		else {
			this.store.setVirtualDisplayMetaData(Constants.DefaultGroup, windowData);
		}
		if (windowData.hasOwnProperty('orgWidth')) {
			// set virtual displays
			if (!windowData.orgHeight || isNaN(windowData.orgWidth)) {
				windowData.orgWidth = Constants.InitialWholeWidth;
			}
			if (!windowData.orgHeight || isNaN(windowData.orgHeight)) {
				windowData.orgWidth = Constants.InitialWholeHeight;
			}
			Vscreen.assignWhole(windowData.orgWidth, windowData.orgHeight, cx, cy, Vscreen.getWholeScale());
			Vscreen.clearSplitWholes();
			Vscreen.splitWhole(windowData.splitX, windowData.splitY);
			this.updateScreen();
		}
		else {
			// 初回
			this.action.changeDisplayProperty(this.gui.getContentPropertyGUI().getDisplayValues());
		}
		manipulator.removeManipulator();
		this.showSelectionRect(false);
	}

	/**
	 * UpdateVirtualDisplayを送信した後の終了コールバック.
	 * @method doneUpdateVirtualDisplay
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneUpdateVirtualDisplay(err, reply) {
		this.removeVirtualDisplay();
		this.doneGetVirtualDisplay(null, reply);
	}

	/**
	 * UpdateSettingコールバック.
	 * @method doneUpdateSetting
	 * @param {String} err エラー. 無ければnull.
	 * @param {JSON} reply 返信されたメタデータ
	 */
	doneUpdateSetting(err, reply) {
		// 開きなおす
		this.gui.showManagementGUI(false);
		this.gui.showManagementGUI(true);
	}
}

export default Controller;