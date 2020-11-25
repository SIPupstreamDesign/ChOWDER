/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../../common/constants.js';
import BurgerMenu from '../../components/burger_menu.js';
import ContextMenu from '../../components/context_menu.js';
import Store from '../store/store.js';
import Menu from '../../components/menu.js';
import Layout from '../../components/layout.js';
import ContentPropertyGUI from './content_property_gui.js';
import ContentListGUI from './content_list_gui.js';
import DisplayListGUI from './display_list_gui';
import LayoutListGUI from './layout_list_gui.js';
import ContentViewGUI from './content_view_gui.js';
import DisplayViewGUI from './display_view_gui.js';
import GroupGUI from './group_gui'
import Vscreen from '../../common/vscreen.js';
import RemoteCursorColorPicker from '../../components/remote_cursor_color_picker.js';
import AreaLayoutSetting from './controller_setting/area_layout_setting';
import MenuSetting from './controller_setting/menu_setting';
import DisplayMenuSetting from './controller_setting/display_menu_setting';
import ContentMenuSetting from './controller_setting/content_menu_setting';
import LayoutMenuSetting from './controller_setting/layout_menu_setting'
import ManagementGUI from './management_gui.js';
import ContentInputGUI from './content_input_gui';
import TabSetting from './controller_setting/tab_setting'
import Validator from '../../common/validator.js';
import manipulator from '../manipulator.js';
import VideoController from '../../components/video_controller.js';
import InputDialog from '../../components/input_dialog'
import ITownsUtil from '../../common/itowns_util'

"use strict";

class GUI extends EventEmitter
{
	constructor(store, action)
	{
		super();

		this.store = store;
		this.action = action;
		this.state = store.getState();

		this.displayMenu = null;
		this.contentMenu = null;
		this.layoutMenu = null;
		this.displayScale = 1.0;
		this.management = null;
	}

	initContextPos() {
		this.state.setContextPos(0, 0);
	}

	init(controllerData) {
		this.management = this.store.getManagement();
		this.controllerData = controllerData;

		this.displayScale = controllerData.getDisplayScale();

		// 全体のレイアウトの初期化.
		new Layout(AreaLayoutSetting());

		// 右部コンテンツプロパティ
		this.contentPropertyGUI = new ContentPropertyGUI(this.store, this.action, this.getContentPreviewArea());

		// 上部メニュー
		this.menu = new Menu("controller", MenuSetting.bind(this)(this.management));
		this.menu.setIDValue(this.store.getLoginStore().getControllerID());
		document.getElementById('layout').insertBefore(this.menu.getDOM(), document.getElementById('layout').childNodes[0]);

		// 下部タブ、グループ編集GUI
		this.groupGUI = new GroupGUI(this.store, this.action, TabSetting.bind(this)());

		// 管理画面
		this.managementGUI = new ManagementGUI(this.store, this.action);

		// 右部コンテンツプロパティの初期化.
		this.initContentProperty(Constants.WholeWindowListID, "", Constants.PropertyTypeWholeWindow);

		// ビデオコントローラの初期化
		this.initVideoController();

		// マウスイベントの初期化
		this.initMouseEvent();

		this.contentInputGUI = new ContentInputGUI(this.store, this.action, this.getContentPreviewArea());
		document.body.appendChild(this.contentInputGUI.getDOM());

		// ファイルドラッグアンドドロップの初期化
		this.initDragAndDrop();

		// メインビューの拡大縮小の初期化
		this.initMainViewScaling();

		// コントローラーID入力の初期化
		this.initControllerIDInput();

		// バーガーメニュー
		// 速度測定モードかどうかによってGUIを表示させるため、全体設定更新時まで初期化を遅延させる
		this.store.on(Store.EVENT_GLOBAL_SETTING_RELOADED, (err, data) => {
			if (!this.contentMenu) {
				this.initBurgerMenu();
			}
		});

		// コンテキストメニュー
		this.initContextMenu();

		// コンテンツ一覧
		this.contentListGUI = new ContentListGUI(this.store, this.action);
		this.displayListGUI = new DisplayListGUI(this.store, this.action);
		this.layoutListGUI =  new LayoutListGUI(this.store, this.action);

		// メインビュー
		this.contentViewGUI = new ContentViewGUI(this.store, this.action);
		this.displayViewGUI = new DisplayViewGUI(this.store, this.action);

		document.getElementById('content_preview_area').addEventListener("mousedown", (evt) => {
			if (evt.button === 0) {
				if (!manipulator.getDraggingManip()) {
					this.action.unselectContent({isUpdateMetaInfo : true});
				}
			}
		});

		document.getElementById('display_preview_area').addEventListener("mousedown", (evt) => {
			if (evt.button === 0) {
				if (!manipulator.getDraggingManip()) {
					this.action.unselectContent({isUpdateMetaInfo : true});
				}
			}
		});

		this.store.on(Store.EVENT_TAB_CHANGED_POST, this.onTabChanged.bind(this));

		this.store.on(Store.EVENT_SNAP_TYPE_CHANGED, (err, data) => {
			let elem = document.getElementsByClassName('head_menu_hover_left')[0];
			if (elem) {
				for(let i = 0; i < elem.options.length; ++i){
					if (data.snapType === elem.options[i].value){
						elem.selectedIndex = i;
						break;
					}
				}
			}
		});

		this.store.on(Store.EVENT_TOGGLE_CONTENT_MARK_ICON, (err, data) => {
			let elem = data.element;
			let metaData = data.metaData;
			this.onToggleContentMarkIcon(elem, metaData);
		});

        this.store.on(Store.EVENT_UPDATE_TIME, (err, data) => {
            // 全コンテンツデータの時刻をビューポートをもとに更新
            const metaDataDict = this.store.getMetaDataDict();
			const funcDict = this.store.getITownFuncDict();
			const time = new Date(data.time);
            for (let id in metaDataDict) {
                if (metaDataDict.hasOwnProperty(id)) {
                    let metaData = metaDataDict[id];
                    if (metaData.type === Constants.TypeWebGL) {
						if (ITownsUtil.isTimelineSync(metaData, data.id, data.senderSync))
						{
							if (funcDict && funcDict.hasOwnProperty(metaData.id)) {
								funcDict[metaData.id].chowder_itowns_update_time(metaData, time);
							}
						}
                    }
                }
            }
        })
		// this.store.on(Store.EVENT_ASK_DISPLAY_PERMISSION, (err, logindata)=>{
		// 	console.log("gui",logindata);
		// 	const setting = {
		// 		name : "connection request : " + logindata.displayid,
		// 	}

		// 	InputDialog.showOKCancelInput(setting,(result)=>{
		// 		logindata.permission = result;
		// 		this.action.changeDisplayPermission(logindata);
		// 	});
		// });

	}

	/**
	 * タブが切り替えられた.
	 */
	onTabChanged(err, data) {
		let id;
		if (Validator.isDisplayTabSelected()) {
			this.initContentProperty("", null, "", Constants.PropertyTypeDisplay);
		} else if (Validator.isLayoutTabSelected()) {
			this.initContentProperty("", null, "", Constants.PropertyTypeLayout);
		} else {
			this.initContentProperty("", null, "", Constants.PropertyTypeContent);
		}
		if (Validator.isDisplayTabSelected()) {
			id = this.state.getLastSelectWindowID();
			if (!id) {
				id = Constants.WholeWindowListID;
			}
			// スナップのdisplayを無効にする
			document.getElementsByClassName('snap_display_option')[0].style.display = "none";

			this.action.changeSnapType({
				isDisplay : true,
				snapType : this.store.getControllerData().getSnapType(true)
			});
		} else {
			id = this.state.getLastSelectContentID();
			// スナップのdisplayを有効にする
			document.getElementsByClassName('snap_display_option')[0].style.display = "block";

			this.action.changeSnapType({
				isDisplay : false,
				snapType : this.store.getControllerData().getSnapType(false)
			});
		}

		this.state.setSelectedIDList([]);
		// 以前選択していたものを再選択する.
		if (id) {
			this.action.selectContent({
				id : id,
				isListViewArea : false
			});
		}
		this.state.setDraggingIDList([]);
	}

	changeRemoteCursorColor()
	{
		let colorPicker = new RemoteCursorColorPicker();
		document.body.appendChild(colorPicker.getDOM());
		colorPicker.on(RemoteCursorColorPicker.EVENT_OK, (err, colorstr) => {
			this.action.updateRemoteCursor({rgb : colorstr});
		});
		colorPicker.on(RemoteCursorColorPicker.EVENT_CANCEL, (err) => {
			document.body.removeChild(colorPicker.getDOM());
			colorPicker = null;
		});
		colorPicker.on(RemoteCursorColorPicker.EVENT_CLOSE, (err) => {
			document.body.removeChild(colorPicker.getDOM());
			colorPicker = null;
		});
		colorPicker.show(this.controllerData.getCursorColor());
	}

	changeRemoteCursorSize(){
		let cursorSize = this.controllerData.getCursorSize()
        const setting = {
			name : "Input remote cursor size (px)",
            initialValue : cursorSize,
            okButtonName : "OK",
        }
        InputDialog.showTextInput(setting,(value)=>{
			this.action.updateRemoteCursor({cursor_size : value});
        });
	}

	initVideoController() {
		this.videoController = new VideoController();
		document.body.appendChild(this.videoController.getDOM());

		this.videoController.on(VideoController.EVENT_PLAY, (err, play) => {
			this.action.playAllVideo({
				play : play
			});
		});
		this.videoController.on(VideoController.EVENT_REWIND, (err) => {
			this.action.rewindAllVideo();
		});
	}


	initMouseEvent() {
		let isGesture = false;
		let gestureScale;

		// 一定間隔同じイベントが来なかったら実行するための関数
		let debounceChangeDisplayScale = (() => {
			const interval = 250;
			let timer;
			return () => {
				clearTimeout(timer);
				timer = setTimeout(() => {
					this.action.changeDisplayScale({
						isChanging: false,
						displayScale : this.displayScale
					})

				}, interval);
			};
		})();

		if(window.ontouchstart !== undefined) {
			// タッチイベントの初期化
			document.addEventListener("touchstart", (evt) => {
				if (!isGesture) {
					this.emit('mousemove', evt);
				}
			}, false);
			document.addEventListener("touchmove", (evt) => {
				if (!isGesture) {
					this.emit('mousemove', evt);
					evt.preventDefault();
				}
			}, false);
			document.addEventListener("touchend",  (evt) => {
				this.emit('mouseup', evt);
			}, false);
		} else {
			// マウスイベントの初期化
			window.document.addEventListener("mousemove", (evt) => {
				this.emit('mousemove', evt);
			});
			window.document.addEventListener("mouseup", (evt) => {
				this.emit('mouseup', evt);
			});
		}

		function gesturestartFunc(e) {
			isGesture = true;
			gestureScale = Vscreen.getWholeScale();
			e.stopPropagation();
			e.preventDefault();
		}

		this.onGestureChange = (e) => {
			if (!isGesture) { return false; }
			this.displayScale = gestureScale * e.scale;
			this.action.changeDisplayScale({
				isChanging : true,
				displayScale : this.displayScale
			});
			debounceChangeDisplayScale();
			e.stopPropagation();
			e.preventDefault();
		};

		function gestureendFunc() {
			isGesture = false;
		}

		if (window.ongesturestart !== undefined) {
			// ジェスチャーイベントの初期化
			document.addEventListener("gesturestart", gesturestartFunc, false);
			document.addEventListener("gesturechange", this.onGestureChange, false);
			document.addEventListener("gestureend", gestureendFunc, false);
		}

		// ホイールイベント
		let onWheel = (e) => {
			if (this.managementGUI.isShow()) { return; }
			if (!this.inListviewArea(e) && !this.inPropertyArea(e)) {
				if (!e) e = window.event; //for legacy IE
				let delta = e.deltaY ? -(e.deltaY) : e.wheelDelta ? e.wheelDelta : -(e.detail);
				//e.preventDefault();
				if (delta < 0){
					//下にスクロールした場合の処理
					this.displayScale = this.displayScale + 0.05;
				} else if (delta > 0){
					//上にスクロールした場合の処理
					this.displayScale = this.displayScale - 0.05;
				}

				if (this.displayScale < 0.05) {
					this.displayScale = 0.05
				}
				if (this.displayScale > 2) {
					this.displayScale = 2;
				}
				this.action.changeDisplayScale({
					isChanging : true,
					displayScale : this.displayScale
				});
				debounceChangeDisplayScale();
			}
		};
		let mousewheelevent = 'onwheel' in document ? 'wheel' : 'onmousewheel' in document ? 'mousewheel' : 'DOMMouseScroll';
		try{
			document.addEventListener (mousewheelevent, onWheel, false);
		}catch(e){
			document.attachEvent ("onmousewheel", onWheel); //for legacy IE
		}
	}

	/**
	 * メニュー内のグループ項目に中身(グループ名のアイテム)を挿入する
	 * @param {*} type
	 */
	updateGroupMenus(type) {
		let groupBox;
		let burgerMenu;
		let contextMenu;
		let authority = this.management.getAuthorityObject();

		if (type === "content") {
			groupBox = this.groupGUI.getContentBox();
			burgerMenu = this.contentMenu;
			contextMenu = this.contentContextMenu;
			if (!authority.isEditable(this.getCurrentGroupID())) {
				console.error(this.getCurrentGroupID());
				return;
			}
		}
		if (type === "display") {
			groupBox = this.groupGUI.getDisplayBox();
			burgerMenu = this.displayMenu;
			contextMenu = this.displayContextMenu;
			if (!authority.isDisplayEditable(this.getCurrentDisplayGroupID())) {
				console.error(this.getCurrentDisplayGroupID());
				return;
			}
		}
		if (type === "layout") {
			groupBox = this.groupGUI.getLayoutBox();
			burgerMenu = this.layoutMenu;
			contextMenu = this.layoutContextMenu;
			if (!authority.isEditable(this.getCurrentGroupID())) {
				console.error(this.getCurrentGroupID());
				return;
			}
		}
		let burgerMenuContainer = burgerMenu.getDOM().getElementsByClassName('burger_menu_submenu_change_group')[0];
		burgerMenuContainer.innerHTML = "";

		let contextMenuContainer = contextMenu.getDOM().getElementsByClassName('context_menu_submenu_change_group')[0];
		contextMenuContainer.innerHTML = "";

		let groupIDs = groupBox.getGroupIDs();
		for (let i = 0; i < groupIDs.length; ++i) {
			let groupID = groupIDs[i];
			// グループ変更内のアクセス権限による表示非表示
			if (authority.isEditable(groupID)) {
				// burgerMenu用Item
				{
					let item = document.createElement('li');
					item.className = "burger_menu_submenu_item";
					item.innerHTML = groupBox.getGroupName(groupID);
					burgerMenuContainer.appendChild(item);
					item.onmousedown = ((groupID) => {
						return (evt) => {
							this.action.changeGroup({ groupID : groupID });
							burgerMenu.show(false);
						};
					})(groupID);
				}
				// contextMenu用Item
				{
					let item = document.createElement('li');
					item.className = "context_menu_change_group_item";
					item.innerHTML = groupBox.getGroupName(groupID);
					item.style.top = "-" + (groupIDs.length * 20) + "px";
					contextMenuContainer.appendChild(item);
					item.onmousedown = ((groupID) => {
						return (evt) => {
							this.action.changeGroup({ groupID : groupID });
							contextMenu.close();
						};
					})(groupID);
				}
			}
		}
	}

	/**
	 * ドラッグアンドドロップの初期化
	 */
	initDragAndDrop() {
		window.addEventListener('dragover', (evt) => {
			if (this.managementGUI.isShow()) { return; }
			evt.preventDefault();
			evt.dataTransfer.dropEffect = 'copy';
		});
		window.addEventListener('drop', (evt) => {
			if (this.managementGUI.isShow()) { return; }
			evt.preventDefault();
			evt.stopPropagation();
			this.contentInputGUI.dropFile(evt);
		});
	}

	/**
	 * メインビューの右ドラッグスケーリングの初期化
	 */
	initMainViewScaling() {
		let displayPreviewArea = document.getElementById('display_preview_area');
		let contentPreviewArea = document.getElementById('content_preview_area');
		let is_right_dragging = false;
		let is_middle_dragging = false;
		let mouseDownPos = {
			x : 0,
			y : 0
		}
		let mouseMovePos = {
			x : 0,
			y : 0,
		}

		contentPreviewArea.addEventListener('mousedown', (evt) => {
			if (this.managementGUI.isShow()) { return; }
			if (this.state.isShiftDown()) { return; }
			if (evt.button === 2) {
				let rect = contentPreviewArea.getBoundingClientRect();
				//mouseDownPosY = evt.clientY - rect.top;
				mouseDownPos.y = evt.clientY - rect.top;
				mouseMovePos.y = evt.clientY - rect.top;
				is_right_dragging = true;
			} else if (evt.button === 1 || this.state.isSpaceDown()) {
				let rect = contentPreviewArea.getBoundingClientRect();

				mouseDownPos = {
					x : evt.clientX - rect.left,
					y : evt.clientY - rect.top
				};
				mouseMovePos = {
					x : evt.clientX - rect.left,
					y : evt.clientY - rect.top
				};
				//mouseDownPosX = evt.clientX - rect.left;
				//mouseDownPosY = evt.clientY - rect.top;
				is_middle_dragging = true;
			}
		});

		displayPreviewArea.addEventListener('mousedown', (evt) => {
			if (this.managementGUI.isShow()) { return; }
			if (this.state.isShiftDown()) { return; }
			this.displayScale = Vscreen.getWholeScale();
			if (evt.button === 2) {
				let rect = displayPreviewArea.getBoundingClientRect();
				mouseDownPos.y = evt.clientY - rect.top;
				mouseMovePos.y = evt.clientY - rect.top;
				is_right_dragging = true;
			} else if (evt.button === 1 || this.state.isSpaceDown()) {
				let rect = displayPreviewArea.getBoundingClientRect();
				mouseDownPos = {
					x : evt.clientX - rect.left,
					y : evt.clientY - rect.top
				};
				mouseMovePos = {
					x : evt.clientX - rect.left,
					y : evt.clientY - rect.top
				};
				is_middle_dragging = true;
			}
		});

		window.addEventListener('mousemove', (evt) => {
			if (this.managementGUI.isShow()) { return; }
			if (this.state.isShiftDown()) { return; }
			let rect = contentPreviewArea.getBoundingClientRect();
			if (is_right_dragging) {
				let dy = evt.clientY - rect.top - mouseMovePos.y,
					ds = dy;
				if (ds > 0) {
					this.displayScale += 0.002 * Math.abs(ds + 0.5);
				} else {
					if (this.displayScale < 1.0) {
						this.displayScale -= 0.001 * Math.abs(ds - 0.5);
					} else {
						this.displayScale -= 0.002 * Math.abs(ds - 0.5);
					}
				}
				if (this.displayScale < 0.05) {
					this.displayScale = 0.05;
				}
				if (this.displayScale > 2) {
					this.displayScale = 2;
				}
				this.action.changeDisplayScale({
					isChanging : true,
					displayScale : this.displayScale
				});
			} else if (is_middle_dragging) {
				let dx = evt.clientX - rect.left - mouseMovePos.x,
					dy = evt.clientY - rect.top - mouseMovePos.y;

					this.action.changeDisplayTrans({
						dx : dx,
						dy : dy
					});
			}
			mouseMovePos = {
				x : evt.clientX,
				y : evt.clientY
			}
		});

		window.addEventListener('mouseup', (evt) => {
			if (evt.button === 2) {
				let rect = contentPreviewArea.getBoundingClientRect();
				let dy = evt.clientY - rect.top - mouseDownPos.y;
				if (dy !== 0) {
					this.action.changeDisplayScale({
						isChanging: false,
						displayScale : this.displayScale
					});
				}
				is_right_dragging = false;
			} else {
				is_middle_dragging = false;
			}
		});
	}

	/**
	 * コントローラID入力の初期化
	 */
	initControllerIDInput() {
		let elem = document.getElementsByClassName('head_id_input')[0];
		let controllerID;
		elem.onblur = (ev) => {
			console.log("onblur");
			ev.preventDefault();
			controllerID = elem.value.split(' ').join('');
			controllerID = controllerID.split('　').join('');
			this.action.changeControllerID({ id : controllerID });
		};
		elem.onkeypress = (ev) => {
			if (ev.keyCode === 13) { // enter
				ev.preventDefault();
				controllerID = elem.value.split(' ').join('');
				controllerID = controllerID.split('　').join('');
				this.action.changeControllerID({ id : controllerID });
			}
		};
	}

	/**
	 *  タブが変更された
	 * @param tabName タブ名
	 */
	changeTab(tabName) {
		let displayPreviewArea = document.getElementById('display_preview_area');
		let contentPreviewArea = document.getElementById('content_preview_area');

		if (tabName === 'Display') {
			displayPreviewArea.style.opacity = 1.0;
			contentPreviewArea.style.opacity = 0.3;
			displayPreviewArea.style.zIndex = 10;
			contentPreviewArea.style.zIndex = 0;
			this.displayMenu.show(true);
			this.contentMenu.show(false);
			this.layoutMenu.show(false);
		} else if (tabName === 'Content') {
			displayPreviewArea.style.opacity = 0.3;
			contentPreviewArea.style.opacity = 1.0;
			displayPreviewArea.style.zIndex = 0;
			contentPreviewArea.style.zIndex = 10;
			this.displayMenu.show(false);
			this.contentMenu.show(true);
			this.layoutMenu.show(false);
		} else if (tabName === 'Search') {
			displayPreviewArea.style.opacity = 0.3;
			contentPreviewArea.style.opacity = 1.0;
			displayPreviewArea.style.zIndex = 0;
			contentPreviewArea.style.zIndex = 10;
			this.contentMenu.show(true);
			this.layoutMenu.show(false);
		} else if (tabName === "Layout") {
			displayPreviewArea.style.opacity = 0.3;
			contentPreviewArea.style.opacity = 1.0;
			displayPreviewArea.style.zIndex = 0;
			contentPreviewArea.style.zIndex = 10;
			this.displayMenu.show(false);
			this.contentMenu.show(false);
			this.layoutMenu.show(true);
		}
	}

	/**
	 * グループリストをセットする。
	 * コンテンツタブの中身はすべて消去されてグループボックスが初期化される。
	 * サーチタブ/レイアウトタブにもグループを追加。
	 */
	setGroupList(groupList, displayGroupList)
	{
		let contentSelectedGroup = this.store.getState().getContentSelectedGroup();
		let displaySelectedGroup = this.store.getState().getDisplaySelectedGroup();
		let contentSetting = { tabs : [] };
		let displaySetting = { tabs : [] };
		let searchSetting = { groups : [], colors : [] };
		let layoutSetting = { tabs : [] };
		for (let i = 0; i < groupList.length; i = i + 1) {
			let groupName = groupList[i].name;
			let groupColor = groupList[i].color;
			let groupID = groupList[i].id;
			let contentGroupTab = {};
			contentGroupTab[groupID] = {
				id : groupID,
				name : groupName,
				className : Constants.TabIDContent,
				color : groupColor,
				selected : contentSelectedGroup === groupID
			};
			let layoutGroupTab = {};
			layoutGroupTab[groupID] = {
				id : groupID,
				name : groupName,
				className : Constants.TabIDLayout,
				color : groupColor,
				selected : contentSelectedGroup === groupID
			};
			contentSetting.tabs.push(contentGroupTab);
			searchSetting.groups.push({
				id : groupID,
				name : groupName
			});
			searchSetting.colors.push(groupColor);
			layoutSetting.tabs.push(layoutGroupTab);
		}
		for (let i = 0; i < displayGroupList.length; i = i + 1) {
			let groupName = displayGroupList[i].name;
			let groupColor = displayGroupList[i].color;
			let groupID = displayGroupList[i].id;
			let displayGroupTab = {};
			displayGroupTab[groupID] = {
				id : groupID,
				name : groupName,
				className : Constants.TabIDDisplay,
				color : groupColor,
				selected : displaySelectedGroup === groupID
				//checked : groupCheckDict.hasOwnProperty(groupID) ? groupCheckDict[groupID] : false
			};
			displaySetting.tabs.push(displayGroupTab);
		}

		this.groupGUI.update(contentSetting, displaySetting, searchSetting, layoutSetting);

		/*
		// コンテキストメニューを刷新
		this.contentContextMenu.update();
		this.displayContextMenu.update();
		// コンテキストメニューを刷新
		this.updateLayoutContextMenu();
		*/
		// メニュー内のグループ項目を刷新
		this.updateGroupMenus("content");
		this.updateGroupMenus("display");
		this.updateGroupMenus("layout");
	}

	showManagementGUI(isShow) {
		if (isShow) {
			this.managementGUI.show();
		} else {
			this.managementGUI.close();
		}
	}

	/**
	 * バーガーメニューのコンテンツ追加サブメニュー
	 */
	toggleBurgerSubmenuAddContent(show, bottom) {
		let container = this.contentMenu.getDOM().getElementsByClassName('burger_menu_submenu_add_content')[0];
		if (show) {
			this.initContextPos();
			container.style.display = "block";
			container.style.bottom = bottom;
		} else {
			container.style.display = "none";
		}
	}


	initContextMenuVisible(menu, type, type2) {
		// 出現タイミング調整.
		let mouseDownPosX = null,
			mouseDownPosY = null,
			openContextMenu = false,
			menuElem = menu;

		document.body.addEventListener("mousedown", (evt) => {
			mouseDownPosX = evt.clientX + (document.body.scrollLeft || document.documentElement.scrollLeft),
			mouseDownPosY = evt.clientY + (document.body.scrollTop || document.documentElement.scrollTop);
			openContextMenu = false;
		});

		document.body.addEventListener("contextmenu", (evt) => {
			if (this.groupGUI.getTabs().isActive(type) || this.groupGUI.getTabs().isActive(type2)) {
				if (evt.button === 2 && !this.state.isShiftDown()) {
					openContextMenu = true;
				}
				evt.preventDefault();
			}
		});

		document.body.addEventListener("mouseup", (evt) => {
			if (this.groupGUI.getTabs().isActive(type) || this.groupGUI.getTabs().isActive(type2)) {
				if (evt.button === 2 && !this.state.isShiftDown()) {
					openContextMenu = true;
				}
			}
		});

		addEventListener("mouseup", (evt) => {
			if (openContextMenu) {
				let px = evt.clientX + (document.body.scrollLeft || document.documentElement.scrollLeft),
					py = evt.clientY + (document.body.scrollTop || document.documentElement.scrollTop),
					width,
					height,
					rect,
					i;

				// コンテキストメニューを刷新
				this.updateGroupMenus("content");
				this.updateGroupMenus("display");
				this.updateGroupMenus("layout");
				//this.updateContextMenuAccess(); TODO

				if ( Math.pow(px - mouseDownPosX, 2) + Math.pow(py - mouseDownPosY, 2) < 10) {

					if (type == Constants.TabIDLayout && !this.inListviewArea(evt)) {
						// レイアウトタブはメインビューのエリア内であればコンテンツメニューを開く
						menuElem = document.getElementsByClassName('context_menu')[0];
					} else {
						menuElem = menu;
					}

					menuElem.style.display = 'block';
					if (type === Constants.TabIDDisplay) {
						rect = this.displayContextMenu.getDOM().getBoundingClientRect();
					} else {
						rect = this.contentContextMenu.getDOM().getBoundingClientRect();
					}
					width = rect.right - rect.left;
					height = rect.bottom - rect.top;
					if (px > (document.getElementById("layout").offsetWidth - width)) {
						px -= width;
					}
					if (py > (document.getElementById("layout").offsetHeight - height)) {
						py -= height;
					}
					this.state.setContextPos(px, py);
					menuElem.style.top = py + "px";
					menuElem.style.left = px + "px";
				}
			}
			openContextMenu = false;
		});

		window.addEventListener("mousedown",(evt) => {
			if (evt.target.className !== "context_menu_item") {
				menuElem.style.display = "none";
			}
			this.getContentPropertyGUI().submitText();
		});
	}

	/**
	 * コンテキストメニューを初期化する.
	 */
	initContextMenu()
	{
		// コンテンツ
		this.contentContextMenu = new ContextMenu("content", ContentMenuSetting.bind(this)());
		document.body.appendChild(this.contentContextMenu.getDOM());
		this.initContextMenuVisible(this.contentContextMenu.getDOM(), Constants.TabIDContent, Constants.TabIDSearch);

		// ディスプレイ
		this.displayContextMenu = new ContextMenu("display", DisplayMenuSetting.bind(this)(false));
		document.body.appendChild(this.displayContextMenu.getDOM());
		this.initContextMenuVisible(this.displayContextMenu.getDOM(), Constants.TabIDDisplay, "");

		// レイアウト
		this.layoutContextMenu = new ContextMenu("layout", LayoutMenuSetting.bind(this)());
		document.body.appendChild(this.layoutContextMenu.getDOM());
		this.initContextMenuVisible(this.layoutContextMenu.getDOM(), Constants.TabIDLayout, "");
	}

	// 下部バーガーメニューの初期化
	initBurgerMenu()
	{
		// コンテンツ
		this.contentMenu = new BurgerMenu(ContentMenuSetting.bind(this)());
		let contentMenuDOM = this.contentMenu.getDOM();
		contentMenuDOM.classList.add("bottom_burger_menu_content");
		document.body.appendChild(contentMenuDOM);

		// ディスプレイ
		if (this.store.getManagement().isMeasureTimeEnable())
		{
			this.displayMenu = new BurgerMenu(DisplayMenuSetting.bind(this)(true));
		}
		else
		{
			this.displayMenu = new BurgerMenu(DisplayMenuSetting.bind(this)(false));
		}
		//this.displayMenu = new BurgerMenu(DisplayMenuSetting.bind(this)());
		let displayMenuDOM = this.displayMenu.getDOM();
		displayMenuDOM.classList.add("bottom_burger_menu_display");
		document.body.appendChild(displayMenuDOM);

		// レイアウト
		this.layoutMenu = new BurgerMenu(LayoutMenuSetting.bind(this)());
		let layoutMenuDOM = this.layoutMenu.getDOM();
		layoutMenuDOM.classList.add("bottom_burger_menu_layout");
		document.body.appendChild(layoutMenuDOM);
	}

	getBottomArea() {
		return document.getElementById('bottom_area');
	}
	getRightArea() {
		return document.getElementById('rightArea');
	}
	getDisplayPreviewArea() {
		return document.getElementById('display_preview_area');
	}
	getContentPreviewArea() {
		return document.getElementById('content_preview_area');
	}
	getBox(type) {
		if (type === Constants.TypeContent) {
			return this.groupGUI.getContentBox();
		} else if (type === Constants.TypeWindow) {
			return this.groupGUI.getDisplayBox();
		} else if (type === Constants.TypeLayout) {
			return this.groupGUI.getLayoutBox();
		}
	}
	getBoxArea(type, groupID) {
		let box = this.getBox(type);
		let area;
		if (groupID) {
			area = box ? box.getTab(groupID) : null;
		}
		if (!area) {
			area = box ? box.getTab(Constants.DefaultGroup) : null;
		}
		return area;
	}
	getCurrentGroupID() {
		if (this.groupGUI.getTabs().isActive(Constants.TabIDContent) && this.groupGUI.getContentBox()) {
			return this.groupGUI.getContentBox().getCurrentGroupID();
		} else if (this.groupGUI.getTabs().isActive(Constants.TabIDLayout) && this.groupGUI.getLayoutBox()) {
			return this.groupGUI.getLayoutBox().getCurrentGroupID();
		} else if (this.groupGUI.getTabs().isActive(Constants.TabIDDisplay) && this.groupGUI.getDisplayBox()) {
			return this.groupGUI.getDisplayBox().getCurrentGroupID();
		}
		return Constants.DefaultGroup;
	}
	getCurrentDisplayGroupID() {
		if (this.groupGUI.getTabs().isActive(Constants.TabIDDisplay) && this.groupGUI.getDisplayBox()) {
			return this.groupGUI.getDisplayBox().getCurrentGroupID();
		}
		return Constants.DefaultGroup;
	}
	selectGroup(group_id) {
		this.groupGUI.selectGroup(group_id);
	}
	isActiveTab(tabid) {
		return this.groupGUI.isActiveTab(tabid);
	}
	changeTabByID(tabid) {
		this.groupGUI.changeTab(tabid);
	}
	getDisplayArea() {
		return this.groupGUI.getDisplayBox() ? this.groupGUI.getDisplayBox().getCurrentBoxArea() : null;
	}
	getDisplayAreaForInsert(groupID) {
		if (this.groupGUI.getDisplayBox()) {
			let elems = this.groupGUI.getDisplayBox().getTabgroupToElems();
			if (elems.hasOwnProperty(groupID)) {
				return elems[groupID][1];
			}
			return elems[Constants.DefaultGroup][1]
		}
		return null;
	}
	getListElem(id) {
		return document.getElementById("onlist:" + id);
	}
	getSearchElem(id) {
		return document.getElementById("onsearch:" + id);
	}
	getWholeWindowElem(groupID) {
		return document.getElementById(Constants.WholeWindowListID + "_" + groupID);
	}

	getSearchTargetGroups() {
		return JSON.parse(JSON.stringify(this.groupGUI.getSearchBox().check_groups));
	}

	/**
	 * 発生したイベントがリストビュー領域で発生しているかを判別する
	 * @method isListViewArea
	 * @param {Object} evt イベント.
	 * @return {bool} 発生したイベントがリストビュー領域で発生していたらtrueを返す.
	 */
	inListviewArea(evt) {
		let contentArea = this.getBottomArea();
		let rect = contentArea.getBoundingClientRect();
		let py = evt.clientY + (document.body.scrollTop || document.documentElement.scrollTop);
		if (evt.changedTouches) {
			// タッチ
			py = evt.changedTouches[0].clientY;
		}
		if (!contentArea) {
			return false;
		}
		return py > rect.top;
	}

	inListviewArea2(evt, mouseDownPos) {
		if (mouseDownPos.length < 2) { return false; }
		let contentArea = this.getBottomArea(),
			rect = contentArea.getBoundingClientRect(),
			py = mouseDownPos[1] + (document.body.scrollTop || document.documentElement.scrollTop);
		if (!contentArea) {
			return false;
		}
		return py > rect.top;
	}

	/**
	 * 発生したイベントがプロパティ領域で発生しているかを判別する
	 * @method isListViewArea
	 * @param {Object} evt イベント.
	 * @return {bool} 発生したイベントがリストビュー領域で発生していたらtrueを返す.
	 */
	inPropertyArea(evt) {
		let propertyArea = this.getRightArea();
		let rect = propertyArea.getBoundingClientRect();
		let px = evt.clientX;
		if (evt.changedTouches) {
			// タッチ
			px = evt.changedTouches[0].clientX;
		}
		if (!propertyArea) {
			return false;
		}
		return px > rect.left;
	}

	// Setter.
	setUpdateContentID(id) {
		this.contentInputGUI.setUpdateImageID(id);
	}

	/**
	 * アイコンの更新
	 * @param {*} elem
	 * @param {*} metaData
	 * @param {*} groupDict
	 */
	onToggleContentMarkIcon(elem, metaData) {
		let listElem = document.getElementById("onlist:" + metaData.id);
		let groupDict = this.store.getGroupDict();
		if (metaData.type !== Constants.TypeTileImage) return;
		let icons = [
			elem.getElementsByClassName('tileimage_icon')[0],
			listElem.getElementsByClassName('tileimage_icon_for_list')[0]
		];
		let bgcolor = "lightgray" // 同期していない場合の色
		if (metaData.hasOwnProperty('history_sync')) {
			if (String(metaData.history_sync) === "true") {
				if (groupDict && groupDict.hasOwnProperty(metaData.group)) {
					if (groupDict[metaData.group].hasOwnProperty('color')) {
						bgcolor = groupDict[metaData.group].color;
					} else {
						bgcolor = Constants.DefaultTileIconColor; // default group
					}
				}
			}
		}
		for (let i = 0; i < icons.length; ++i) {
			if (icons[i]) {
				icons[i].style.backgroundColor = bgcolor;
			}
		}
	}

	// Update

	// windowコンテンツのインポート
	importDisplay(windowData) {
		if (!windowData || windowData === undefined || !windowData.hasOwnProperty('id')) {
			return;
		}
		let listElem = this.getListElem(windowData.id);

		let displayBoxArea = this.getBoxArea(Constants.TypeWindow, windowData.group);
		this.displayListGUI.importDisplay(displayBoxArea, listElem, windowData);

		let displayArea = this.getDisplayAreaForInsert(windowData.group);
		this.displayViewGUI.importDisplay(displayArea, listElem, windowData);
	}

	// コンテンツのインポート
	importContent(metaData, contentData, videoPlayer) {
		let listElem = this.getListElem(metaData.id);

		let layoutBoxArea = this.getBoxArea(Constants.TypeLayout, metaData.group);
		this.layoutListGUI.importContent(layoutBoxArea, listElem, metaData, contentData);

		let contentBoxArea = this.getBoxArea(Constants.TypeContent, metaData.group);
		this.contentListGUI.importContent(contentBoxArea, listElem, metaData, contentData, videoPlayer);
		this.contentViewGUI.importContent(this.getContentPreviewArea(), listElem, metaData, contentData, videoPlayer);
	}

	// Search対象グループのチェック
	checkSearchTargetGroups(check_groups, isChecked) {
		let i;
		for (i = 0; i < check_groups.length; ++i) {
			this.groupGUI.getSearchBox().check(check_groups[i], isChecked);
		}
	}

	changeWindowBorderColor(windowData) {
		let divElem = this.getListElem(windowData.id);
		if (divElem) {
			if (windowData.hasOwnProperty('reference_count') && parseInt(windowData.reference_count, 10) <= 0) {
				if (divElem.style.borderColor !== "gray") {
					divElem.style.borderColor = "gray";
					divElem.style.color = "gray";
				}
			} else {
				if (divElem.style.borderColor.indexOf("rgb") < 0) { // 選択中だった場合は変更しない
					if (divElem.style.borderColor !== "white") {
						divElem.style.borderColor = "white";
						divElem.style.color = "white";
					}
				}
			}
		}
	}

	closeContextMenu() {
		this.contentContextMenu.close();
		this.displayContextMenu.close();
		this.layoutContextMenu.close();
	}

	// content_property
	clearContentProperty(updateText) {
		if (this.contentPropertyGUI) {
			this.contentPropertyGUI.clear(updateText);
		}
	}

	assignContentProperty(json) {
		this.contentPropertyGUI.assignContentProperty(json);
	}

	assignVirtualDisplay(whole, splitCount) {
		this.contentPropertyGUI.assignVirtualDisplay(whole, splitCount);
	}

	// isOwnVideo このコントローラページで所有する動画かどうか. typeがvideoではない場合は無視される.
	initContentProperty(metaData, group, type, isOwnVideo) {
		this.contentPropertyGUI.init(metaData, group, type, isOwnVideo);
	}

	getContentPropertyGUI() {
		return this.contentPropertyGUI;
	}

	/**
	 * Snapハイライト解除
	 * @method clearSnapHighLight
	 */
	clearSnapHighLight() {
		let splitWholes = Vscreen.getSplitWholes();
		for (let i in splitWholes) {
			if (splitWholes.hasOwnProperty(i)) {
				if (document.getElementById(splitWholes[i].id)) {
					document.getElementById(splitWholes[i].id).style.background = "transparent";
				}
			}
		}
		let screens = Vscreen.getScreenAll();
		for (let i in screens) {
			if (screens.hasOwnProperty(i)) {
				if (document.getElementById(screens[i].id)) {
					document.getElementById(screens[i].id).style.background = "transparent";
				}
			}
		}
	}

    /**
     * Copyrightを表示.
     * elemにCopyright用エレメントをappendChild
     * @param {*} elem 
     * @param {*} metaData 
     */
    showCopyrights(elem, metaData) {
        if (elem 
            && metaData.type === Constants.TypeWebGL
            && metaData.hasOwnProperty('layerList')) 
            {

            let copyrightText = ITownsUtil.createCopyrightText(metaData);
            if (copyrightText.length === 0) return;

            let previewArea = document.getElementById('preview_area');
            let copyrightElem = document.getElementById("copyright:" + metaData.id);
            let previewRect = previewArea.getBoundingClientRect();
            if (copyrightElem) {
                copyrightElem.innerHTML = copyrightText;
                let rect = elem.getBoundingClientRect();
                copyrightElem.style.right = "0px";
				copyrightElem.style.top =  "0px";
                copyrightElem.style.zIndex = elem.style.zIndex;
            } else {
                copyrightElem = document.createElement("pre");
                copyrightElem.id = "copyright:" + metaData.id;
                copyrightElem.className = "copyright";
                copyrightElem.innerHTML = copyrightText;
                let rect = elem.getBoundingClientRect();
                copyrightElem.style.right = "0px";
				copyrightElem.style.top =  "0px";
                copyrightElem.style.position = "absolute";
                copyrightElem.style.height = "auto";
                copyrightElem.style.whiteSpace = "pre-line";
                copyrightElem.style.zIndex = elem.style.zIndex;
                elem.appendChild(copyrightElem);
            }
        }
    }

	/**
	 * リストビュー領域をクリアする
	 * @method clearWindowList
	 */
	clearWindowList() {
		let displayArea = this.getDisplayArea();
		if (displayArea) {
			displayArea.innerHTML = "";
		}
	}
}

export default GUI;

