/*jslint devel:true */
/*global FileReader, Uint8Array, Blob, URL, event, unescape, $, $show, $hide */

(function () {
	"use strict";
	var ControllerGUI,
		wholeWindowListID = "onlist:whole_window";
	
	// コンストラクタ
	ControllerGUI = function () {
		EventEmitter.call(this);
		this.groupBox = null;
		this.searchBox = null;
		this.displayMenu = null;
		this.contentMenu = null;
		this.layoutMenu = null;
		this.dblist = [];
		this.display_scale = 1.0;
		this.snapType = "free";
		this.management = null;
		this.contextPosX = 0;
		this.contextPosY = 0;
	};
	ControllerGUI.prototype = Object.create(EventEmitter.prototype);

	ControllerGUI.prototype.initContextPos = function () {
		this.contextPosX = 0;
		this.contextPosY = 0;
	};

	ControllerGUI.prototype.init = function (management) {
		this.management = management;

		// 全体のレイアウトの初期化.
		var bigZIndex = 10000;
		new window.Layout(
			{
				id : 'layout',
				direction : 'horizontal',
				color : 'rgb(112, 180, 239)',
				contents : [
					{
						id : 'head_menu',
						position : 'top',
						size : "30px",
						minSize : "30px",
						zIndex : 1000000
					},
					{
						id : 'layout2',
						size : "-253px",
						direction : 'vertical',
						contents : [
							{
								id : 'preview_area',
								size : "-263px"
							},
							{
								size : "3px",
								splitter : "3px",
								zIndex : bigZIndex
							},
							{
								id : 'rightArea',
								position : 'right',
								size : "260px",
								minSize : "150px"
							}
						]
					},
					{
						size : "3px",
						splitter : "3px",
						zIndex : bigZIndex
					},
					{
						id : 'bottom_area',
						size : "220px",
						minSize : "100px"
					}]
			});

		var settingMenu = [{
				VirtualDisplay : {
					func : function () { 
						document.getElementById('display_tab_link').click();
						this.emit(window.ControllerGUI.EVENT_VIRTUALDISPLAYSETTING_CLICKED, null);
					}.bind(this)
				},
			}, {
				RemoteCursor : [{
					ON : {
						func : function () { this.emit(window.ControllerGUI.EVENT_UPDATE_CURSOR_ENABLE, null, true); }.bind(this)
					}
				}, {
					OFF : {
						func : function () { this.emit(window.ControllerGUI.EVENT_UPDATE_CURSOR_ENABLE, null, false); }.bind(this)
					}
				}]	
			}];

		if (management.getAuthorityObject().isAdmin()) {
			settingMenu.push( {
				Management : {
					func : function () {
						this.openManagement();
					}.bind(this)
				}
			});
		}

		// 上部メニューの初期化.
		this.menu = new Menu(document.getElementById('head_menu'),
			{
				menu : [{
					Controller : [{
							Display : {
								func : function () {
									var viewURL = "view.html";// + guid10();
									window.open(viewURL);
								}
							},
						}],
					url : "controller.html"
				}, {
					Add : [{
							Image : {
								func : function () { 
									this.initContextPos();
									document.getElementById('image_file_input').click();
								}.bind(this)
							}
						}, {
							Text : {
								func : function () { 
									this.initContextPos();
									this.openTextInput();
								}.bind(this)
							},
						}, {
							TextFile : {
								func : function () {
									this.initContextPos();
									document.getElementById('text_file_input').click();
								}.bind(this)
							},
						}, {
							URL : {
								func : function () {
									this.initContextPos();
									this.toggleURLInput();
								}.bind(this)
							}
						}],
				}, {
					Setting : settingMenu
				}]
			});
		
		// 下部タブの初期化.
		this.tabs = new Tabs(document.getElementById('bottom_area'),
			{
				tabs : [{
						Display : {
							id : Constants.TabIDDisplay,
							func : function () { this.changeTab('Display'); }.bind(this),
							active : true,
						},
					}, {
						Content : {
							id : Constants.TabIDContent,
							func : function () { this.changeTab('Content'); }.bind(this)
						},
					}, {
						Search : {
							id : Constants.TabIDSearch,
							func : function () { this.changeTab('Search'); }.bind(this)
						}
					}, {
						Layout : {
							id : Constants.TabIDLayout,
							func : function () { this.changeTab('Layout'); }.bind(this)
						}
					}]
			});
		this.tabs.on('tab_changed_pre', function (err, data) {
			this.emit(window.ControllerGUI.EVENT_TAB_CHANGED_PRE, err, data);
		}.bind(this));

		this.tabs.on('tab_changed_post', function (err, data) {
			this.emit(window.ControllerGUI.EVENT_TAB_CHANGED_POST, err, data);
		}.bind(this));

		// コンテンツボックスにグループボックスを埋め込み.
		this.groupBox = new GroupBox(this.management.getAuthorityObject(), document.getElementById('content_tab_box'),
			{
				tabs : [{
						"group_default" : {
							id : "group_default",
							name : "default",
							className : "group_tab",
							func : function () {},
							active : true
						}
					}]
			});
		this.initGroupBoxEvents(this.groupBox);

		// Searchエリアの中身を作成
		this.searchBox = new SearchBox(this.management.getAuthorityObject(), document.getElementById('search_tab_box'),
			{
				groups : [{
					id : "group_default",
					name : "default"
				}],
				colors : ["rgb(54,187,68)"]
			});
		this.initSearchBoxEvents(this.searchBox);

		// レイアウトボックスにグループボックスを埋め込み.
		this.layoutBox = new GroupBox(this.management.getAuthorityObject(), document.getElementById('layout_tab_box'),
			{
				tabs : [{
						"group_default" : {
							id : "group_default",
							name : "default",
							className : Constants.TabIDLayout,
							func : function () {},
							active : false
						}
					}]
			});
		this.initGroupBoxEvents(this.layoutBox);


		// 右部コンテンツプロパティの初期化.
		window.content_property.setAuthority(this.management.getAuthorityObject());
		window.content_property.init(wholeWindowListID, "", "whole_window");

		// コンテキストメニューの初期化.
		this.initContextMenu();
		this.initDisplayContextMenu();
		this.initLayoutContextMenu();

		// コンテンツ入力の初期化
		this.initContentInputs();

		// ファイルドラッグアンドドロップの初期化
		this.initDragAndDrop();

		// メインビューの拡大縮小の初期化
		this.initMainViewScaling();

		// 下部バーガーメニューの初期化	
		this.displayMenu = new BurgerMenu(
			document.getElementById('bottom_burger_menu_display'),
			{
				menu : [{
						IDを表示 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_SHOWIDBUTTON_CLICKED, null, false); }.bind(this)
						}
					},{
						非表示 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_CLOSE_ITEM, null); }.bind(this)
						}
					},{
						削除 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_DELETEDISPLAY_CLICKED, null, evt); }.bind(this)
						}
					},{
						全て選択 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_SELECT_DISPLAY_CLICKED, null, false); }.bind(this)
						}
					},]
			});

		this.layoutMenu = new BurgerMenu(
			document.getElementById('bottom_burger_menu_layout'),
			{
				menu : [{
					レイアウト追加 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_LAYOUT_ADD_CLICKED, null); }.bind(this)
						}
					},{
					レイアウト上書き : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_LAYOUT_OVERWRITE_CLICKED, null); }.bind(this)
						}
					},{
						グループ変更 : {
							submenu: true,
							mouseoverfunc : function (evt) {
								this.toggleBurgerSubmenuLayout(true, "90px"); 
								on_group_change = true;
							}.bind(this),
							mouseoutfunc : function (evt) {
								on_group_change = false;
							}
						}
					},{
						削除 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_DELETELAYOUT_CLICKED, null, evt); }.bind(this)
						}
					},{
						全て選択 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_SELECT_LAYOUT_CLICKED, null, false); }.bind(this)
						}
					}]
			});

		this.initBurgerMenuContent();

		// 下部バーガーメニューの初期化
		var on_burger_submenu = false,
			on_group_change = false,
			on_burger_submenu_add_content = false,
			on_add_content = false;

		this.contentMenu = new BurgerMenu(
			document.getElementById('bottom_burger_menu_content'),
			{
				menu : [{
						最前面に移動 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_CONTENT_INDEX_CHANGED, null, true); }.bind(this)
						}
					},{
						最背面に移動 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_CONTENT_INDEX_CHANGED, null, false); }.bind(this)
						}
					},{
						コンテンツ追加: {
							submenu: true,
							mouseoverfunc : function (evt) {
								this.toggleBurgerSubmenuAddContent(true, "170px"); 
								on_add_content = true;
							}.bind(this),
							mouseoutfunc : function (evt) {
								on_add_content = false;
							}
						}
					},{
						グループ変更 : {
							submenu: true,
							mouseoverfunc : function (evt) {
								this.toggleBurgerSubmenu(true, "150px"); 
								on_group_change = true;
							}.bind(this),
							mouseoutfunc : function (evt) {
								on_group_change = false;
							}
						}
					},{
						画像差し替え : {
							func : function (evt) {
								document.getElementById('update_image_input').click()
							}
						}
					},{
						非表示 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_CLOSE_ITEM, null); }.bind(this)
						}
					},{
						削除 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_CONTENTDELETEBUTTON_CLICKED, null, evt); }.bind(this)
						}
					},{
						全て選択 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_SELECT_CONTENTS_CLICKED, null, false); }.bind(this)
						}
					},{
						グループ内全て選択 : {
							func : function (evt) { this.emit(window.ControllerGUI.EVENT_SELECT_CONTENTS_CLICKED, null, true); }.bind(this)
						}
					}]
			});

		// サブメニュー用
		document.getElementById('burger_menu_submenu').onmouseover = function (evt) {
			on_burger_submenu = true;
		};
		document.getElementById('burger_menu_submenu').onmouseout = function (evt) {
			on_burger_submenu = false;
		};
		document.getElementById('burger_menu_layout_submenu').onmouseover = function (evt) {
			on_burger_submenu = true;
		};
		document.getElementById('burger_menu_layout_submenu').onmouseout = function (evt) {
			on_burger_submenu = false;
		};
		document.getElementById('burger_menu_submenu_add_content').onmouseover = function (evt) {
			on_burger_submenu_add_content = true;
		};
		document.getElementById('burger_menu_submenu_add_content').onmouseout = function (evt) {
			on_burger_submenu_add_content = false;
		};
		document.getElementById('bottom_burger_menu_content').onmousemove = function (evt) {
			if (!on_burger_submenu && !on_group_change) {
				this.toggleBurgerSubmenu(false);
			}
			if (!on_burger_submenu_add_content && !on_add_content) {
				this.toggleBurgerSubmenuAddContent(false);
			}
		}.bind(this);
		document.getElementById('bottom_burger_menu_layout').onmousemove = function (evt) {
			if (!on_burger_submenu && !on_group_change) {
				this.toggleBurgerSubmenuLayout(false);
			}
		}.bind(this);

		document.getElementById('content_preview_area').addEventListener("mousedown", function (evt) {
			if (evt.button === 0) {
				this.emit(window.ControllerGUI.EVENT_MOUSEDOWN_CONTENT_PREVIEW_AREA, null);
			}
		}.bind(this));

		document.getElementById('display_preview_area').addEventListener("mousedown", function (evt) {
			if (evt.button === 0) {
				this.emit(window.ControllerGUI.EVENT_MOUSEDOWN_DISPLAY_PREVIEW_AREA, null);
			}
		}.bind(this));
	};

	/**
	 * PropertyエリアのコンテンツIDからElementを取得する
	 * @method getSelectedElem
	 * @return Literal
	 */
	ControllerGUI.prototype.get_selected_elem = function () {
		var targetID = document.getElementById('content_id').innerHTML;
		if (targetID) {
			//targetID = targetID.substr(1); // 最初の空白削除
			return document.getElementById(targetID);
		}
		return null;
	};


	ControllerGUI.prototype.updateContextMenuAccess = function () {
		// コンテキストメニューのアクセス制限による表示非表示
		var i;
		var authority = this.management.getAuthorityObject();
		var editableMenus = [
			document.getElementById('context_menu_add_content'),
			document.getElementById("context_menu_move_front"),
			document.getElementById("context_menu_move_back"),
			document.getElementById('context_menu_change_group'),
			document.getElementById('context_menu_change_image')
		];
		if (authority.isEditable(this.get_current_group_id())) {
			for (i = 0; i < editableMenus.length; i = i + 1) {
				editableMenus[i].style.display = "block";
			}
		} else {
			for (i = 0; i < editableMenus.length; i = i + 1) {
				editableMenus[i].style.display = "none";
			}
		}
	}

	ControllerGUI.prototype.initContextMenuVisible = function (menu, type, type2) {
		// 出現タイミング調整.
		var mouseDownPosX = null,
			mouseDownPosY = null,
			openContextMenu = false,
			menuElem = menu;

		document.body.addEventListener("mousedown", function (evt) {
			mouseDownPosX = evt.clientX + (document.body.scrollLeft || document.documentElement.scrollLeft),
			mouseDownPosY = evt.clientY + (document.body.scrollTop || document.documentElement.scrollTop);
			openContextMenu = false;
		});

		document.body.addEventListener("contextmenu", function (evt) {
			if (this.tabs.is_active(type) || this.tabs.is_active(type2)) {
				if (evt.button === 2) {
					openContextMenu = true;
				}
				evt.preventDefault();
			}
		}.bind(this));
		
		document.body.addEventListener("mouseup", function (evt) {
			if (this.tabs.is_active(type) || this.tabs.is_active(type2)) {
				if (evt.button === 2) {
					openContextMenu = true;
				}
			}
		}.bind(this));
		
		window.addEventListener("mouseup", function (evt) {
			if (openContextMenu) {
				var px = evt.clientX + (document.body.scrollLeft || document.documentElement.scrollLeft),
					py = evt.clientY + (document.body.scrollTop || document.documentElement.scrollTop),
					width,
					height,
					rect,
					i;

				// コンテキストメニューを刷新
				this.updateContextMenu();
				this.updateLayoutContextMenu();
				this.updateContextMenuAccess();

				if ( Math.pow(px - mouseDownPosX, 2) + Math.pow(py - mouseDownPosY, 2) < 10) {
					
					if (type == Constants.TabIDLayout && !this.is_listview_area(evt)) {
						// レイアウトタブはメインビューのエリア内であればコンテンツメニューを開く
						menuElem = document.getElementById('context_menu');
					} else {
						menuElem = menu;
					}

					menuElem.style.display = 'block';
					if (type === Constants.TabIDDisplay) {
						rect = document.getElementById('context_menu_display').getBoundingClientRect();
					} else {
						rect = document.getElementById('context_menu').getBoundingClientRect();
					}
					width = rect.right - rect.left;
					height = rect.bottom - rect.top;
					if (px > (document.getElementById("layout").offsetWidth - width)) {
						px -= width;
					}
					if (py > (document.getElementById("layout").offsetHeight - height)) {
						py -= height;
					}
					this.contextPosX = px;
					this.contextPosY = py;
					menuElem.style.top = py + "px";
					menuElem.style.left = px + "px";
				}
			}
			openContextMenu = false;
		}.bind(this));

		window.addEventListener("mousedown",function (evt) {
			if (evt.target.className !== "context_menu_item") {
				menuElem.style.display = "none";
			}
			window.content_property.submit_text();
		}.bind(this));
	};

	/**
	 * コンテキストメニューを初期化する.
	 */
	ControllerGUI.prototype.initContextMenu = function () {
		var menu = document.getElementById('context_menu'),
			hide_button = document.getElementById('context_menu_hide'),
			delete_button = document.getElementById('context_menu_delete'),
			add_content_button = document.getElementById('context_menu_add_content'),
			move_front_button = document.getElementById("context_menu_move_front"),
			move_back_button = document.getElementById("context_menu_move_back"),
			add_image_button = document.getElementById('context_menu_add_image'),
			add_text_button = document.getElementById('context_menu_add_text'),
			add_text_file_button = document.getElementById('context_menu_add_text_file'),
			add_url_button = document.getElementById('context_menu_add_url'),
			change_group_button = document.getElementById('context_menu_change_group'),
			change_group_submenu = document.getElementById('context_menu_change_group_submenu'),
			change_image_button = document.getElementById('context_menu_change_image'),
			add_content_submenu = document.getElementById("context_menu_add_content_submenu"),
			select_all = document.getElementById('context_menu_select_all'),
			select_group = document.getElementById('context_menu_select_group'),
			contentPreviewArea = document.getElementById('content_preview_area'),
			on_change_group = false,
			on_change_group_item = false,
			on_add_content = false,
			on_add_content_item = false;

		hide_button.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_CLOSE_ITEM, null);
			menu.style.display = "none";
		}.bind(this);

		delete_button.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_CONTENTDELETEBUTTON_CLICKED, null, evt); 
			menu.style.display = "none";
		}.bind(this);

		add_image_button.onmousedown = function (evt) {
			document.getElementById('image_file_input').click();
			menu.style.display = "none";
		};

		add_text_file_button.onmousedown = function (evt) {
		 	document.getElementById('text_file_input').click();	
			menu.style.display = "none";
		};

		add_url_button.onmousedown = function (evt) {
			this.toggleURLInput();
			menu.style.display = "none";
		}.bind(this);

		add_text_button.onmousedown = function (evt) {
			this.openTextInput();
			menu.style.display = "none";
		}.bind(this);

		change_image_button.onmousedown = function (evt) {
			document.getElementById('update_image_input').click();
			menu.style.display = "none";
		};

		move_front_button.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_CONTENT_INDEX_CHANGED, null, true);
			menu.style.display = "none";
		}.bind(this);

		move_back_button.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_CONTENT_INDEX_CHANGED, null, false);
			menu.style.display = "none";
		}.bind(this);

		select_all.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_SELECT_CONTENTS_CLICKED, null, false);
			menu.style.display = "none";
		}.bind(this);

		select_group.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_SELECT_CONTENTS_CLICKED, null, true);
			menu.style.display = "none";
		}.bind(this);
		
		// コンテンツ追加サブメニュー
		add_content_button.onmouseover = function () {
			var container = document.getElementById("context_menu_add_content_submenu");
			container.style.display = "block";
			on_add_content = true;
		};

		add_content_button.onmouseout = function () {
			on_add_content = false;
		};
		add_content_submenu.onmouseover = function () {
			on_add_content_item = true;
		};
		add_content_submenu.onmouseout = function () {
			on_add_content_item = false;
		};

		// グループ変更サブメニュー
		change_group_button.onmouseover = function () {
			var container = document.getElementById('context_menu_change_group_submenu');
			container.style.display = "block";
			on_change_group = true;
		};
		change_group_button.onmouseout = function () {
			on_change_group = false;
		};
		change_group_submenu.onmouseover = function () {
			on_change_group_item = true;
		};
		change_group_submenu.onmouseout = function () {
			on_change_group_item = false;
		};
		menu.onmousemove = function () {
			if (!on_change_group && !on_change_group_item) {
				var container = document.getElementById('context_menu_change_group_submenu');
				container.style.display = "none";
			}
			if (!on_add_content && !on_add_content_item) {
				var container = document.getElementById('context_menu_add_content_submenu');
				container.style.display = "none";
			}
		};

		this.initContextMenuVisible(menu, Constants.TabIDContent, Constants.TabIDSearch);
	}


	ControllerGUI.prototype.initDisplayContextMenu = function () {
		var menu = document.getElementById('context_menu_display'),
			showid_button = document.getElementById("context_menu_display_show_id"),
			hide_button = document.getElementById("context_menu_display_hide"),
			delete_button = document.getElementById("context_menu_display_delete"),
			select_all_button = document.getElementById("context_menu_display_select_all");

		showid_button.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_SHOWIDBUTTON_CLICKED, null, false);
			menu.style.display = "none";
		}.bind(this);
		
		hide_button.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_CLOSE_ITEM, null);
			menu.style.display = "none";
		}.bind(this);

		delete_button.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_DELETEDISPLAY_CLICKED, null, evt); 
			menu.style.display = "none";
		}.bind(this);
		
		select_all_button.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_SELECT_DISPLAY_CLICKED, null, false); 
			menu.style.display = "none";
		}.bind(this);
		this.initContextMenuVisible(menu, Constants.TabIDDisplay, "");
	};

	ControllerGUI.prototype.initLayoutContextMenu = function () {
		var menu = document.getElementById('context_menu_layout'),
			add_button = document.getElementById("context_menu_layout_add"),
			overwrite_button = document.getElementById("context_menu_layout_overwrite"),
			delete_button = document.getElementById("context_menu_layout_delete"),
			select_all_button = document.getElementById("context_menu_layout_select_all"),
			change_group_button = document.getElementById('context_menu_layout_change_group'),
			change_group_submenu = document.getElementById('context_menu_layout_change_group_submenu'),
			on_change_group = false,
			on_change_group_item = false;

		add_button.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_LAYOUT_ADD_CLICKED, null, evt); 
			menu.style.display = "none";
		}.bind(this);

		overwrite_button.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_LAYOUT_OVERWRITE_CLICKED, null, evt); 
			menu.style.display = "none";
		}.bind(this);

		delete_button.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_DELETELAYOUT_CLICKED, null, evt); 
			menu.style.display = "none";
		}.bind(this);
		
		select_all_button.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_SELECT_LAYOUT_CLICKED, null, false); 
			menu.style.display = "none";
		}.bind(this);
		
		// グループ変更サブメニュー
		change_group_button.onmouseover = function () {
			var container = document.getElementById('context_menu_layout_change_group_submenu');
			container.style.display = "block";
			on_change_group = true;
		};
		change_group_button.onmouseout = function () {
			on_change_group = false;
		};
		change_group_submenu.onmouseover = function () {
			on_change_group_item = true;
		};
		change_group_submenu.onmouseout = function () {
			on_change_group_item = false;
		};
		menu.onmousemove = function () {
			if (!on_change_group && !on_change_group_item) {
				var container = document.getElementById('context_menu_layout_change_group_submenu');
				container.style.display = "none";
			}
		};

		this.initContextMenuVisible(menu, Constants.TabIDLayout, "");
	};
	
	/**
	 * コンテキストメニューの動的に変化する部分を更新.
	 */
	ControllerGUI.prototype.updateContextMenu = function () {
		var groupToElems = this.groupBox.get_tabgroup_to_elems(),
			container = document.getElementById('context_menu_change_group_submenu'),
			item,
			groupID,
			gname,
			authority = this.management.getAuthorityObject();
		container.innerHTML = "";

		if (!authority.isEditable(this.get_current_group_id())) {
			return;
		}
		
		for (groupID in groupToElems) {
			if (groupToElems.hasOwnProperty(groupID)) {
				// グループ変更内のアクセス権限による表示非表示
				if (authority.isEditable(groupID)) {
					item = document.createElement('li');
					item.className = "context_menu_change_group_item";
					item.innerHTML = this.groupBox.get_group_name(groupID);
					item.style.top = "-" + (Object.keys(groupToElems).length * 20 + 60) + "px";
					container.appendChild(item);
					item.onmousedown = (function (groupID, self) {
						return function (evt) {
							this.emit(window.ControllerGUI.EVENT_GROUP_CHANGE_CLICKED, null, groupID);
						}.bind(self);
					}(groupID, this));
				}
			}
		}
	};

	/**
	 * コンテキストメニューの動的に変化する部分を更新.
	 */
	ControllerGUI.prototype.updateLayoutContextMenu = function () {
		var groupToElems = this.groupBox.get_tabgroup_to_elems(),
			container = document.getElementById('context_menu_layout_change_group_submenu'),
			item,
			groupID,
			gname,
			authority = this.management.getAuthorityObject();
		container.innerHTML = "";

		if (!authority.isEditable(this.get_current_group_id())) {
			return;
		}
		
		for (groupID in groupToElems) {
			if (groupToElems.hasOwnProperty(groupID)) {
				// グループ変更内のアクセス権限による表示非表示
				if (authority.isEditable(groupID)) {
					item = document.createElement('li');
					item.className = "context_menu_change_group_item";
					item.innerHTML = this.groupBox.get_group_name(groupID);
					item.style.top = "-" + (Object.keys(groupToElems).length * 20 + 60) + "px";
					container.appendChild(item);
					item.onmousedown = (function (groupID, self) {
						return function (evt) {
							this.emit(window.ControllerGUI.EVENT_GROUP_CHANGE_CLICKED, null, groupID);
						}.bind(self);
					}(groupID, this));
				}
			}
		}
	};
	
	ControllerGUI.prototype.updateBurgerMenu = function () {
		var groupToElems = this.groupBox.get_tabgroup_to_elems(),
			container = document.getElementById('burger_menu_submenu'),
			item,
			gname,
			groupID;
		container.innerHTML = "";

		for (groupID in groupToElems) {
			if (groupToElems.hasOwnProperty(groupID)) {
				item = document.createElement('li');
				item.className = "burger_menu_submenu_item";
				item.innerHTML = this.groupBox.get_group_name(groupID);
				container.appendChild(item);
				item.onmousedown = (function (groupID, self) {
					return function (evt) {
						this.emit(window.ControllerGUI.EVENT_GROUP_CHANGE_CLICKED, null, groupID);
						this.toggleBurgerSubmenu(false);
						this.contentMenu.toggle();
					}.bind(self);
				}(groupID, this));
			}
		}
	};

	ControllerGUI.prototype.updateBurgerMenuLayout = function () {
		var groupToElems = this.groupBox.get_tabgroup_to_elems(),
			container = document.getElementById('burger_menu_layout_submenu'),
			item,
			gname,
			groupID;
		container.innerHTML = "";

		for (groupID in groupToElems) {
			if (groupToElems.hasOwnProperty(groupID)) {
				item = document.createElement('li');
				item.className = "burger_menu_submenu_item";
				item.innerHTML = this.groupBox.get_group_name(groupID);
				container.appendChild(item);
				item.onmousedown = (function (groupID, self) {
					return function (evt) {
						this.emit(window.ControllerGUI.EVENT_GROUP_CHANGE_CLICKED, null, groupID);
						this.toggleBurgerSubmenu(false);
						this.contentMenu.toggle();
					}.bind(self);
				}(groupID, this));
			}
		}
	};

	/**
	 * コンテンツ入力の初期化
	 */
	ControllerGUI.prototype.initContentInputs = function () {
		var imageFileInput = document.getElementById('image_file_input'),
			textFileInput = document.getElementById('text_file_input'),
			updateImageInput = document.getElementById('update_image_input');

		imageFileInput.addEventListener('change', function (evt) {
			this.emit(window.ControllerGUI.EVENT_IMAGEFILEINPUT_CHANGED, null, evt, this.contextPosX, this.contextPosY);
			imageFileInput.value = "";
		}.bind(this), false);
		
		textFileInput.addEventListener('change', function (evt) {
			this.emit(window.ControllerGUI.EVENT_TEXTFILEINPUT_CHANGED, null, evt, this.contextPosX, this.contextPosY);
			textFileInput.value = "";
		}.bind(this), false);

		updateImageInput.addEventListener('change', function (evt) {
			this.emit(window.ControllerGUI.EVENT_UPDATEIMAGEINPUT_CHANGED, null, evt);
			updateImageInput.value = "";
		}.bind(this), false);
	};

	/**
	 * ドラッグアンドドロップの初期化
	 */
	ControllerGUI.prototype.initDragAndDrop = function () {
		window.addEventListener('dragover', function(evt) {
			if (this.isOpenDialog) { return; }
			var  e = evt || event;
			e.preventDefault();
			evt.dataTransfer.dropEffect = 'copy';
		});
		window.addEventListener('drop', function(evt) {
			if (this.isOpenDialog) { return; }
			var  e = evt || event;
			e.preventDefault();
			e.stopPropagation();
			evt.preventDefault();
			evt.stopPropagation();
			this.emit(window.ControllerGUI.EVENT_FILE_DROPPED, null, evt);
		}.bind(this));
	};

	/**
	 * メインビューの右ドラッグスケーリングの初期化
	 */
	ControllerGUI.prototype.initMainViewScaling = function () {
		var displayPreviewArea = document.getElementById('display_preview_area'),
			contentPreviewArea = document.getElementById('content_preview_area'),
			is_right_dragging = false,
			is_middle_dragging = false,
			mouseDownPosX = 0,
			mouseDownPosY = 0;
		
		contentPreviewArea.addEventListener('mousedown', function (evt) {
			if (this.isOpenDialog) { return; }
			if (evt.button === 2) {
				var rect = contentPreviewArea.getBoundingClientRect();
				mouseDownPosY = evt.clientY - rect.top;
				is_right_dragging = true;
			} else if (evt.button === 1) {
				var rect = contentPreviewArea.getBoundingClientRect();
				mouseDownPosX = evt.clientX - rect.left;
				mouseDownPosY = evt.clientY - rect.top;
				is_middle_dragging = true;
			}
		});

		displayPreviewArea.addEventListener('mousedown', function (evt) {
			if (this.isOpenDialog) { return; }
			if (this.get_whole_scale) {
				this.display_scale = this.get_whole_scale();
			}
			if (evt.button === 2) {
				var rect = displayPreviewArea.getBoundingClientRect();
				mouseDownPosY = evt.clientY - rect.top;
				is_right_dragging = true;
			} else if (evt.button === 1) {
				var rect = displayPreviewArea.getBoundingClientRect();
				mouseDownPosX = evt.clientX - rect.left;
				mouseDownPosY = evt.clientY - rect.top;
				is_middle_dragging = true;
			}
		}.bind(this));

		window.addEventListener('mousemove', function (evt) {
			if (this.isOpenDialog) { return; }
			var rect = contentPreviewArea.getBoundingClientRect();
			if (is_right_dragging) {
				var dy = evt.clientY - rect.top - mouseDownPosY,
					ds = dy;
				if (ds > 0) {
					this.display_scale += 0.002 * Math.abs(ds + 0.5);
				} else {
					if (this.display_scale < 1.0) {
						this.display_scale -= 0.001 * Math.abs(ds - 0.5);
					} else {
						this.display_scale -= 0.002 * Math.abs(ds - 0.5);
					}
				}
				if (this.display_scale < 0.05) {
					this.display_scale = 0.05;
				}
				if (this.display_scale > 2) {
					this.display_scale = 2;
				}
				this.emit(window.ControllerGUI.EVENT_DISPLAY_SCALE_CHANGED, null, this.display_scale);
			} else if (is_middle_dragging) {
				var dx = evt.clientX - rect.left - mouseDownPosX,
					dy = evt.clientY - rect.top - mouseDownPosY;
				
				this.emit(window.ControllerGUI.EVENT_DISPLAY_TRANS_CHANGED, null, dx, dy);
			}
			mouseDownPosX = evt.clientX;
			mouseDownPosY = evt.clientY;
		}.bind(this));

		window.addEventListener('mouseup', function (evt) {
			if (evt.button === 2) {
				is_right_dragging = false;
			} else if (evt.button === 1) {
				is_middle_dragging = false;
			}
		})

	};

	/**
	 *  タブが変更された
	 * @param tabName タブ名
	 */
	ControllerGUI.prototype.changeTab = function (tabName) {
		var displayPreviewArea = document.getElementById('display_preview_area'),
			contentPreviewArea = document.getElementById('content_preview_area'),
			contentMenu = document.getElementById('bottom_burger_menu_content'),
			displayMenu = document.getElementById('bottom_burger_menu_display'),
			searchMenu = document.getElementById('bottom_burger_menu_search'),
			layoutMenu = document.getElementById('bottom_burger_menu_layout'),
			content_icon = document.getElementById("bottom_burger_menu_content_icon");

		if (tabName === 'Display') {
			displayPreviewArea.style.opacity = 1.0;
			contentPreviewArea.style.opacity = 0.3;
			displayPreviewArea.style.zIndex = 10;
			contentPreviewArea.style.zIndex = -1000;
			displayMenu.style.display = "block";
			contentMenu.style.display = "none";
			searchMenu.style.display = "none";
			layoutMenu.style.display = "none";
		} else if (tabName === 'Content') {
			displayPreviewArea.style.opacity = 0.3;
			contentPreviewArea.style.opacity = 1.0;
			displayPreviewArea.style.zIndex = -1000;
			contentPreviewArea.style.zIndex = 10;
			displayMenu.style.display = "none";
			contentMenu.style.display = "block";
			searchMenu.style.display = "none";
			layoutMenu.style.display = "none";
			content_icon.className = "burger_menu_icon bottom_burger_menu_content_icon";
		} else if (tabName === 'Search') {
			displayPreviewArea.style.opacity = 0.3;
			contentPreviewArea.style.opacity = 1.0;
			displayPreviewArea.style.zIndex = -1000;
			contentPreviewArea.style.zIndex = 10;
			displayMenu.style.display = "none";
			contentMenu.style.display = "block";
			searchMenu.style.display = "block";
			layoutMenu.style.display = "none";
			content_icon.className = "burger_menu_icon bottom_burger_menu_search_icon"; //色だけ変更
		} else if (tabName === "Layout") {
			displayPreviewArea.style.opacity = 0.3;
			contentPreviewArea.style.opacity = 1.0;
			displayPreviewArea.style.zIndex = -1000;
			contentPreviewArea.style.zIndex = 10;
			displayMenu.style.display = "none";
			contentMenu.style.display = "none";
			searchMenu.style.display = "none";
			layoutMenu.style.display = "block";
			content_icon.className = "burger_menu_icon bottom_burger_menu_layout_icon"; //色だけ変更		
		}
	};

	/**
	 * グループのタブに対するイベントを設定. 
	 */
	ControllerGUI.prototype.initGroupBoxEvents = function (groupBox) {
		groupBox.on("group_delete", function (err, groupID) {
			window.input_dialog.okcancel_input({
					name : "グループ内のコンテンツも削除されます. よろしいですか?"
				}, (function (groupID, self) {
					return function (value) {
						if (value) {
							this.emit(window.ControllerGUI.EVENT_GROUP_DELETE_CLICKED, null, groupID);
						}
					}.bind(self);
				}(groupID, this)));
		}.bind(this));

		groupBox.on("group_append", function (err, groupName) {
			this.emit(window.ControllerGUI.EVENT_GROUP_APPEND_CLICKED, null, groupName);
		}.bind(this));

		groupBox.on("group_up", function (err, groupID) {
			this.emit(window.ControllerGUI.EVENT_GROUP_UP, null, groupID);
		}.bind(this));
		
		groupBox.on("group_down", function (err, groupID) {
			this.emit(window.ControllerGUI.EVENT_GROUP_DOWN, null, groupID);
		}.bind(this));

		groupBox.on("group_edit_name", function (err, groupID, groupName) {
			this.emit(window.ControllerGUI.EVENT_GROUP_EDIT_NANE, null, groupID, groupName);
		}.bind(this));

		groupBox.on("group_edit_color", function (err, groupID, color) {
			this.emit(window.ControllerGUI.EVENT_GROUP_EDIT_COLOR, null, groupID, color);
		}.bind(this));
	};

	/**
	 * Searchのタブに対するイベントを設定.
	 */
	ControllerGUI.prototype.initSearchBoxEvents = function (searchBox) {
		searchBox.on("input_changed", function (err, value, groups) {
			this.emit(window.ControllerGUI.EVENT_SEARCH_INPUT_CHANGED, null, value, groups);
		}.bind(this));
	};

	/**
	 * グループリストをセットする。
	 * コンテンツタブの中身はすべて消去されてグループボックスが初期化される。
	 * サーチタブ/レイアウトタブにもグループを追加。
	 */
	ControllerGUI.prototype.setGroupList = function (groupList) {
		var contentSetting = { tabs : [] },
			searchSetting = { groups : [], colors : [] },
			layoutSetting = { tabs : [] },
			groupName,
			tab = {},
			layoutGroupTab = {},
			groupColor,
			groupID,
			i;
		for (i = 0; i < groupList.length; i = i + 1) {
			groupName = groupList[i].name;
			groupColor = groupList[i].color;
			groupID = groupList[i].id;
			tab = {};
			tab[groupID] = {
				id : groupID,
				name : groupName,
				className : "group_tab",
				color : groupColor,
				active : true
			};
			layoutGroupTab = {};
			layoutGroupTab[groupID] = {
				id : groupID,
				name : groupName,
				className : Constants.TabIDLayout,
				color : groupColor,
				active : true
			};
			contentSetting.tabs.push(tab);
			searchSetting.groups.push({
				id : groupID,
				name : groupName
			});
			searchSetting.colors.push(groupColor);
			layoutSetting.tabs.push(layoutGroupTab);
		}

		document.getElementById('content_tab_box').innerHTML = "";
		this.groupBox = new GroupBox(this.management.getAuthorityObject(), document.getElementById('content_tab_box'), contentSetting);
		this.initGroupBoxEvents(this.groupBox);

		// コンテキストメニューを刷新
		this.updateContextMenu();
		// コンテキストメニューを刷新
		this.updateLayoutContextMenu();
		// バーガーメニューを刷新
		this.updateBurgerMenu();
		this.updateBurgerMenuLayout();

		this.searchBox = new SearchBox(this.management.getAuthorityObject(), document.getElementById('search_tab_box'), searchSetting);
		this.initSearchBoxEvents(this.searchBox);

		document.getElementById('layout_tab_box').innerHTML = "";
		this.layoutBox = new GroupBox(this.management.getAuthorityObject(), document.getElementById('layout_tab_box'), layoutSetting);
		this.initGroupBoxEvents(this.layoutBox);
	};

	/**
	 * 管理ページを表示
	 */
	ControllerGUI.prototype.openManagement = function () {
		var managementPage = this.management;
		if (!managementPage) {
			return;
		}
		managementPage.show({
			dblist : this.dblist
		});
		managementPage.removeListener('close');
		this.isOpenDialog = true;
		managementPage.on('close', function () {
			this.isOpenDialog = false;
		}.bind(this));
	};

	ControllerGUI.prototype.setDBList = function (dblist) {
		this.dblist = dblist;
	};

	/**
	 * テキスト入力ダイアログの表示をトグル
	 */
	ControllerGUI.prototype.openTextInput = function () {
		window.input_dialog.init_multi_text_input({
				name : "テキストの追加",
				okButtonName : "Send"
			}, function (value, w, h) {
				this.emit(window.ControllerGUI.EVENT_TEXTSENDBUTTON_CLICKED, null, value, this.contextPosX, this.contextPosY, w, h);
			}.bind(this)
		);

	};

	/**
	 * URL入力ダイアログの表示をトグル
	 */
	ControllerGUI.prototype.toggleURLInput = function () {
		window.input_dialog.text_input({
				name : "URLの追加",
				initialName :  "",
				okButtonName : "Send",
			}, function (value) {
				this.emit(window.ControllerGUI.EVENT_URLSENDBUTTON_CLICKED, null, value);
			}.bind(this));
	};

	/**
	 * バーガーメニューのサブメニュー
	 */
	ControllerGUI.prototype.toggleBurgerSubmenu = function (show, bottom) {
		var container = document.getElementById('burger_menu_submenu');
		if (show) {
			this.initContextPos();
			container.style.display = "block";
			container.style.bottom = bottom;
		} else {
			container.style.display = "none";
		}
	};

	/**
	 * バーガーメニューのサブメニュー
	 */
	ControllerGUI.prototype.toggleBurgerSubmenuLayout = function (show, bottom) {
		var container = document.getElementById('burger_menu_layout_submenu');
		
		if (show) {
			this.initContextPos();
			container.style.display = "block";
			container.style.bottom = bottom;
		} else {
			container.style.display = "none";
		}
	};

	/**
	 * バーガーメニューのコンテンツ追加サブメニュー
	 */
	ControllerGUI.prototype.toggleBurgerSubmenuAddContent = function (show, bottom) {
		var container = document.getElementById('burger_menu_submenu_add_content');
		if (show) {
			this.initContextPos();
			container.style.display = "block";
			container.style.bottom = bottom;
		} else {
			container.style.display = "none";
		}
	};

	ControllerGUI.prototype.initBurgerMenuContent = function () {
		var add_image_button = document.getElementById('burger_menu_add_image'),
			add_text_button = document.getElementById('burger_menu_add_text'),
			add_text_file_button = document.getElementById('burger_menu_add_text_file'),
			add_url_button = document.getElementById('burger_menu_add_url');
		
		add_image_button.onmousedown = function (evt) {
			this.toggleBurgerSubmenuAddContent(false);
			this.contentMenu.toggle();
			document.getElementById('image_file_input').click();
		}.bind(this);

		add_text_file_button.onmousedown = function (evt) {
			this.toggleBurgerSubmenuAddContent(false);
			this.contentMenu.toggle();
		 	document.getElementById('text_file_input').click();	
		}.bind(this);

		add_url_button.onmousedown = function (evt) {
			this.toggleBurgerSubmenuAddContent(false);
			this.contentMenu.toggle();
			this.toggleURLInput();
		}.bind(this);

		add_text_button.onmousedown = function (evt) {
			this.toggleBurgerSubmenuAddContent(false);
			this.contentMenu.toggle();
			this.openTextInput();
		}.bind(this);
	};

	function guid10() {
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000)
			.toString(16)
			.substring(1);
		}
		return s4() + s4() + s4().slice(-2);
	};
	

	ControllerGUI.prototype.get_bottom_area = function () {
		return document.getElementById('bottom_area');
	};
	ControllerGUI.prototype.get_right_area = function () {
		return document.getElementById('rightArea');
	};
	ControllerGUI.prototype.get_display_tab_link = function () {
		return document.getElementById('display_tab_link');
	};
	ControllerGUI.prototype.get_display_preview_area = function () {
		return document.getElementById('display_preview_area');
	};
	ControllerGUI.prototype.get_content_preview_area = function () {
		return document.getElementById('content_preview_area');
	};
	ControllerGUI.prototype.get_content_area = function () {
		return this.groupBox ? this.groupBox.get_current_tab() : null;
	};
	ControllerGUI.prototype.get_search_area = function () {
		return this.searchBox ? document.getElementsByClassName('search_item_wrapper')[0] : null;
	};
	ControllerGUI.prototype.get_layout_area = function () {
		return this.layoutBox ? this.layoutBox.get_current_tab() : null;
	};
	ControllerGUI.prototype.get_content_area_by_group = function (group) {
		return this.groupBox ? this.groupBox.get_tab(group) : null;
	};
	ControllerGUI.prototype.get_layout_area_by_group = function (group) {
		return this.layoutBox ? this.layoutBox.get_tab(group) : null;
	};
	ControllerGUI.prototype.get_current_group_id = function () {
		if (this.tabs.is_active(Constants.TabIDContent) && this.groupBox) {
			return this.groupBox.get_current_group_id();
		} else if (this.tabs.is_active(Constants.TabIDLayout) && this.layoutBox) {
			return this.layoutBox.get_current_group_id();
		}
		return null;
	};
	ControllerGUI.prototype.select_group = function (group_id) {
		this.groupBox.select_tab(group_id);
		this.layoutBox.select_tab(group_id);
	};
	ControllerGUI.prototype.is_active_tab = function (tabname) {
		return this.tabs.is_active(tabname);
	};
	ControllerGUI.prototype.get_display_area = function () {
		return document.getElementById('display_tab_box');
	};
	ControllerGUI.prototype.get_list_elem = function (id) {
		return document.getElementById("onlist:" + id);
	};
	ControllerGUI.prototype.get_search_elem = function (id) {
		return document.getElementById("onsearch:" + id);
	};
	ControllerGUI.prototype.get_whole_window_elem = function () {
		return document.getElementById(wholeWindowListID);
	};
	ControllerGUI.prototype.get_update_content_id = function () {
		return document.getElementById('update_content_id').innerHTML;
	};
	
	ControllerGUI.prototype.get_search_target_groups = function () {
		return JSON.parse(JSON.stringify(this.searchBox.check_groups));
	};

	/**
	 * 発生したイベントがリストビュー領域で発生しているかを判別する
	 * @method isListViewArea
	 * @param {Object} evt イベント.
	 * @return {bool} 発生したイベントがリストビュー領域で発生していたらtrueを返す.
	 */
	ControllerGUI.prototype.is_listview_area = function (evt) {
		var contentArea = this.get_bottom_area(),
			rect = contentArea.getBoundingClientRect(), 
			clientY = evt.clientY,
			py;

		if (evt.changedTouches) {
			// タッチ
			clientY = evt.changedTouches[0].clientY;
		}
		py = evt.clientY + (document.body.scrollTop || document.documentElement.scrollTop);
		if (!contentArea) {
			return false;
		}
		return py > rect.top;
	}

	ControllerGUI.prototype.is_listview_area2 = function (evt, mouseDownPos) {
		if (mouseDownPos.length < 2) { return false; }
		var contentArea = this.get_bottom_area(),
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
	ControllerGUI.prototype.is_property_area = function (evt) {
		var propertyArea = this.get_right_area(),
			rect = propertyArea.getBoundingClientRect(),
			clientX = evt.clientX,
			px;

		if (evt.changedTouches) {
			// タッチ
			clientX = evt.changedTouches[0].clientX;
		}
		px = evt.clientX;
		if (!propertyArea) {
			return false;
		}
		return px > rect.left;
	}

	ControllerGUI.prototype.get_whole_scale = null;
	
	// Setter.
	ControllerGUI.prototype.set_update_content_id = function (id) {
		document.getElementById('update_content_id').innerHTML = id;
	};

	ControllerGUI.prototype.set_display_scale = function (scale) {
		this.display_scale = scale; 
	};

	ControllerGUI.prototype.set_group_list = function (grouplist) {
		this.setGroupList(grouplist);
	};

	ControllerGUI.prototype.set_search_result = function (search_result) {
		this.searchBox.set_search_result(search_result);
	};

	ControllerGUI.prototype.get_snap_type = function () {
		return this.snapType;
	};

	/**
	 * スナップ設定
	 * @method set_snap_type
	 * @param {String} snapType スナップタイプ
	 */
	ControllerGUI.prototype.set_snap_type = function (snapType) {
		this.snapType = snapType;
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

	// Update
	ControllerGUI.prototype.update_display_scale = function (scale) {
		this.emit(ControllerGUI.EVENT_DISPLAY_SCALE_CHANGED, null, scale);
	};

	ControllerGUI.prototype.toggle_display_id_show = function (isShow) {
		this.emit(ControllerGUI.EVENT_SHOWIDBUTTON_CLICKED, null, isShow);
	};

	// other
	ControllerGUI.prototype.check_search_target_groups = function (check_groups, isChecked) {
		var i;
		for (i = 0; i < check_groups.length; ++i) {
			this.searchBox.check(check_groups[i], isChecked);
		}
	};

	ControllerGUI.prototype.close_context_menu = function () {
		document.getElementById('context_menu').style.display = "none";
		document.getElementById('context_menu_display').style.display = "none";
	};

	// イベント
	ControllerGUI.EVENT_MOUSEDOWN_CONTENT_PREVIEW_AREA = "mousedown_content_preview_area";
	ControllerGUI.EVENT_MOUSEDOWN_DISPLAY_PREVIEW_AREA = "mousedown_display_preview_area";
	ControllerGUI.EVENT_UPDATEIMAGEINPUT_CHANGED = "updateimageinput_changed";
	ControllerGUI.EVENT_IMAGEFILEINPUT_CHANGED = "imagefileinput_changed";
	ControllerGUI.EVENT_TEXTFILEINPUT_CHANGED = "textfileinput_changed";
	ControllerGUI.EVENT_URLSENDBUTTON_CLICKED = "urlsendbuton_clicked";
	ControllerGUI.EVENT_TEXTSENDBUTTON_CLICKED = "textsendbutton_clicked";
	ControllerGUI.EVENT_UPDATE_CURSOR_ENABLE = "update_cursor_enable";
	ControllerGUI.EVENT_CONTENTDELETEBUTTON_CLICKED = "contentdeletebutton_clicked";
	ControllerGUI.EVENT_SELECT_CONTENTS_CLICKED = "select_contents_clicked";
	ControllerGUI.EVENT_SELECT_DISPLAY_CLICKED = "select_display_clicked";
	ControllerGUI.EVENT_SELECT_LAYOUT_CLICKED = "select_layout_clicked";
	ControllerGUI.EVENT_LAYOUT_ADD_CLICKED = "add_layout";
	ControllerGUI.EVENT_LAYOUT_OVERWRITE_CLICKED = "overwrite_layout";
	ControllerGUI.EVENT_DELETEDISPLAY_CLICKED = "deletedisplay_clicked";
	ControllerGUI.EVENT_DELETELAYOUT_CLICKED = "deletelayout_clicked";
	ControllerGUI.EVENT_SHOWIDBUTTON_CLICKED = "showidbutton_clicked";
	ControllerGUI.EVENT_VIRTUALDISPLAYSETTING_CLICKED = "virtualdisplaysetting_clicked";
	ControllerGUI.EVENT_DISPLAY_SCALE_CHANGED = "display_scale_changed";
	ControllerGUI.EVENT_DISPLAY_TRANS_CHANGED = "display_trans_changed";
	ControllerGUI.EVENT_CONTENT_INDEX_CHANGED = "content_index_changed";
	ControllerGUI.EVENT_CLOSE_ITEM = "close_item";
	ControllerGUI.EVENT_FILE_DROPPED = "file_dropped";
	ControllerGUI.EVENT_GROUP_APPEND_CLICKED = "group_append_clicked";
	ControllerGUI.EVENT_GROUP_DELETE_CLICKED = "group_delete_clicked";
	ControllerGUI.EVENT_GROUP_CHANGE_CLICKED = "group_change_clicked";
	ControllerGUI.EVENT_GROUP_DOWN = "group_down";
	ControllerGUI.EVENT_GROUP_UP = "group_up";
	ControllerGUI.EVENT_GROUP_EDIT_NANE = "group_edit_name";
	ControllerGUI.EVENT_GROUP_EDIT_COLOR = "group_edit_color";
	ControllerGUI.EVENT_SEARCH_INPUT_CHANGED = "search_input_changed";
	ControllerGUI.EVENT_TAB_CHANGED_PRE = "tab_changed_pre";
	ControllerGUI.EVENT_TAB_CHANGED_POST = "tab_changed_post";
	window.ControllerGUI = ControllerGUI;
	
}());
