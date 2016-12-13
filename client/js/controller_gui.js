/*jslint devel:true */
/*global FileReader, Uint8Array, Blob, URL, event, unescape, $, $show, $hide */

(function () {
	"use strict";
	var ControllerGUI,
		wholeWindowListID = "onlist:whole_window";
	
	// コンストラクタ
	ControllerGUI = function () {
		EventEmitter.call(this);
	};
	ControllerGUI.prototype = Object.create(EventEmitter.prototype);

	ControllerGUI.prototype.init = function () {
		

		this.groupBox = null;
		this.searchBox = null;
		this.displayMenu = null;
		this.contentMenu = null;
		this.display_scale = 1.0;

		// 全体のレイアウトの初期化.
		window.layout.init();

		// 上部メニューの初期化.
		window.menu.init(document.getElementById('head_menu'),
			{
				menu : [{
					Controller : [{
							Display : {
								func : function () {
									var viewURL = "view.html#" + guid10();
									window.open(viewURL);
								}
							},
						}],
					url : "controller.html"
				}, {
					Add : [{
							Image : {
								func : function () { document.getElementById('image_file_input').click() }
							}
						}, {
							Text : {
								func : function () { this.toggleTextInput(); }
							},
						}, {
							TextFile : {
								func : function () { document.getElementById('text_file_input').click(); }
							},
						}, {
							URL : {
								func : function () { this.toggleURLInput(); }
							}
						}],
				}, {
					Setting : [{
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
					}]
				}]
			});

		document.getElementById('head_menu_panel__').onmouseup = function (evt) {
			var elems = document.getElementsByClassName('menu_level1');
			if (elems) {
				for (var i = 0; i < elems.length; ++i) {
					if (!elems[i].contains(evt.target)) {
						window.menu.toggle_popup(elems[i], false);
					}
				}
			}
		};


		// 下部コンテンツボックスの初期化.
		window.content_box.init(document.getElementById('bottom_area'),
			{
				tabs : [{
						Display : {
							id : "display_tab",
							func : function () { this.changeTab('Display'); }.bind(this),
							active : true,
						},
					}, {
						Content : {
							id : "content_tab",
							func : function () { this.changeTab('Content'); }.bind(this)
						},
					}, {
						Search : {
							id : "search_tab",
							func : function () { this.changeTab('Search'); }.bind(this)
						}
					}]
			});

		// コンテンツボックスにグループボックスを埋め込み.
		this.groupBox = window.group_box.init(document.getElementById('content_tab_box'),
			{
				tabs : [{
						default : {
							id : "group_default",
							className : "group_tab",
							func : function () {},
							active : true
						}
					}]
			});
		this.initGroupBoxEvents(this.groupBox);

		// Searchエリアの中身を作成
		this.searchBox = window.search_box.init(document.getElementById('search_tab_box'),
			{
				groups : ["default"],
				colors : ["rgb(54,187,68)"]
			});
		this.initSearchBoxEvents(this.searchBox);

		// 右部コンテンツプロパティの初期化.
		window.content_property.init(wholeWindowListID, "", "whole_window");

		// コンテキストメニューの初期化.
		this.initContextMenu();
		this.initDisplayContextMenu();

		// コンテンツ入力の初期化
		this.initContentInputs();

		// ファイルドラッグアンドドロップの初期化
		this.initDragAndDrop();

		// メインビューの拡大縮小の初期化
		this.initMainViewScaling();

		// テキスト入力ダイアログの初期化
		this.initTextInputDialog();

		// 下部バーガーメニューの初期化	
		this.displayMenu = window.burger_menu.init(
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

		this.initBurgerMenuContent();

		// 下部バーガーメニューの初期化
		var on_burger_submenu = false,
			on_group_change = false,
			on_burger_submenu_add_content = false,
			on_add_content = false;

		this.contentMenu = window.burger_menu.init(
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
							},
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
							},
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

	ControllerGUI.prototype.initContextMenuVisible = function (menu, type, type2) {
		// 出現タイミング調整.
		var mouseDownPosX = null,
			mouseDownPosY = null,
			openContextMenu = false;

		document.body.addEventListener("mousedown", function (evt) {
			mouseDownPosX = evt.clientX + (document.body.scrollLeft || document.documentElement.scrollLeft),
			mouseDownPosY = evt.clientY + (document.body.scrollTop || document.documentElement.scrollTop);
			openContextMenu = false;
		});

		document.body.addEventListener("contextmenu", function (evt) {
			if (window.content_box.is_active(type) || window.content_box.is_active(type2)) {
				if (evt.button === 2) {
					openContextMenu = true;
				}
				evt.preventDefault();
			}
		});
		
		document.body.addEventListener("mouseup", function (evt) {
			if (window.content_box.is_active(type) || window.content_box.is_active(type2)) {
				if (evt.button === 2) {
					openContextMenu = true;
				}
			}
		});
		
		window.addEventListener("mouseup", function (evt) {
			if (openContextMenu) {
				var px = evt.clientX + (document.body.scrollLeft || document.documentElement.scrollLeft),
					py = evt.clientY + (document.body.scrollTop || document.documentElement.scrollTop),
					width,
					height,
					rect;

				if ( Math.pow(px - mouseDownPosX, 2) + Math.pow(py - mouseDownPosY, 2) < 10) {
					menu.style.display = 'block';
					if (type === "display_tab") {
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
					menu.style.top = py + "px";
					menu.style.left = px + "px";
				}
			}
			openContextMenu = false;
		});

		window.addEventListener("mousedown", function (evt) {
			if (evt.target.className !== "context_menu_item") {
				menu.style.display = "none";
			}
			window.content_property.submit_text();
		});
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
		};

		add_text_button.onmousedown = function (evt) {
			this.toggleTextInput();
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

		this.initContextMenuVisible(menu, "content_tab", "search_tab");
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
		this.initContextMenuVisible(menu, "display_tab", "");
	};
	
	/**
	 * コンテキストメニューの動的に変化する部分を更新.
	 */
	ControllerGUI.prototype.updateContextMenu = function () {
		var groupToElems = this.groupBox.get_tabgroup_to_elems(),
			container = document.getElementById('context_menu_change_group_submenu'),
			item,
			gname;
		container.innerHTML = "";

		for (gname in groupToElems) {
			if (groupToElems.hasOwnProperty(gname)) {
				item = document.createElement('li');
				item.className = "context_menu_change_group_item";
				item.innerHTML = gname;
				item.style.top = "-" + (Object.keys(groupToElems).length * 20 + 60) + "px";
				container.appendChild(item);
				item.onmousedown = (function (gname, self) {
					return function (evt) {
						this.emit(window.ControllerGUI.EVENT_GROUP_CHANGE_CLICKED, null, gname);
					}.bind(self);
				}(gname, this));
			}
		}
	};
	
	ControllerGUI.prototype.updateBurgerMenu = function () {
		var groupToElems = this.groupBox.get_tabgroup_to_elems(),
			container = document.getElementById('burger_menu_submenu'),
			item,
			gname;
		container.innerHTML = "";

		for (gname in groupToElems) {
			if (groupToElems.hasOwnProperty(gname)) {
				item = document.createElement('li');
				item.className = "burger_menu_submenu_item";
				item.innerHTML = gname;
				container.appendChild(item);
				item.onmousedown = (function (gname, self) {
					return function (evt) {
						this.emit(window.ControllerGUI.EVENT_GROUP_CHANGE_CLICKED, null, gname);
						this.toggleBurgerSubmenu(false);
						this.contentMenu.toggle();
					}.bind(self);
				}(gname, this));
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
			this.emit(window.ControllerGUI.EVENT_IMAGEFILEINPUT_CHANGED, null, evt);
			imageFileInput.value = "";
		}.bind(this), false);
		
		textFileInput.addEventListener('change', function (evt) {
			this.emit(window.ControllerGUI.EVENT_TEXTFILEINPUT_CHANGED, null, evt);
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
			var  e = evt || event;
			e.preventDefault();
			evt.dataTransfer.dropEffect = 'copy';
		});
		window.addEventListener('drop', function(evt) {
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
			content_icon = document.getElementById("bottom_burger_menu_content_icon");

		if (tabName === 'Display') {
			displayPreviewArea.style.opacity = 1.0;
			contentPreviewArea.style.opacity = 0.3;
			displayPreviewArea.style.zIndex = 10;
			contentPreviewArea.style.zIndex = -1000;
			displayMenu.style.display = "block";
			contentMenu.style.display = "none";
			searchMenu.style.display = "none";
		} else if (tabName === 'Content') {
			displayPreviewArea.style.opacity = 0.3;
			contentPreviewArea.style.opacity = 1.0;
			displayPreviewArea.style.zIndex = -1000;
			contentPreviewArea.style.zIndex = 10;
			displayMenu.style.display = "none";
			contentMenu.style.display = "block";
			searchMenu.style.display = "none";
			content_icon.className = "burger_menu_icon bottom_burger_menu_content_icon";
		} else if (tabName === 'Search') {
			displayPreviewArea.style.opacity = 0.3;
			contentPreviewArea.style.opacity = 1.0;
			displayPreviewArea.style.zIndex = -1000;
			contentPreviewArea.style.zIndex = 10;
			displayMenu.style.display = "none";
			contentMenu.style.display = "block";
			searchMenu.style.display = "block";
			content_icon.className = "burger_menu_icon bottom_burger_menu_search_icon"; //色だけ変更
		}
	};

	/**
	 * グループのタブに対するイベントを設定. 
	 */
	ControllerGUI.prototype.initGroupBoxEvents = function (groupBox) {
		groupBox.on_group_delete = function (groupID) {
			window.input_dialog.okcancel_input({
					name : "グループ内のコンテンツも削除されます. よろしいですか?"
				}, (function (groupID, self) {
					return function (value) {
						if (value) {
							this.emit(window.ControllerGUI.EVENT_GROUP_DELETE_CLICKED, null, groupID);
						}
					}.bind(self);
				}(groupID, this)));
		}.bind(this);

		groupBox.on_group_append = function (groupName) {
			this.emit(window.ControllerGUI.EVENT_GROUP_APPEND_CLICKED, null, groupName);
		}.bind(this);

		groupBox.on_group_up = function (groupName) {
			this.emit(window.ControllerGUI.EVENT_GROUP_UP, null, groupName);
		}.bind(this);
		
		groupBox.on_group_down = function (groupName) {
			this.emit(window.ControllerGUI.EVENT_GROUP_DOWN, null, groupName);
		}.bind(this);

		groupBox.on_group_edit_name = function (groupID, groupName) {
			this.emit(window.ControllerGUI.EVENT_GROUP_EDIT_NANE, null, groupID, groupName);
		}.bind(this);
		groupBox.on_group_edit_color = function (groupID, color) {
			this.emit(window.ControllerGUI.EVENT_GROUP_EDIT_COLOR, null, groupID, color);
		}.bind(this);
	};

	/**
	 * Searchのタブに対するイベントを設定.
	 */
	ControllerGUI.prototype.initSearchBoxEvents = function (searchBox) {
		searchBox.on_input_changed = function (value, groups) {
			this.emit(window.ControllerGUI.EVENT_SEARCH_INPUT_CHANGED, null, value, groups);
		}.bind(this);
	};

	/**
	 * グループリストをセットする。
	 * コンテンツタブの中身はすべて消去されてグループボックスが初期化される。
	 * サーチタブにもグループを追加。
	 */
	ControllerGUI.prototype.setGroupList = function (groupList) {
		var activeTab = this.groupBox.get_active_tab_name(),
			contentSetting = { tabs : [] },
			searchSetting = { groups : [], colors : [] },
			groupName,
			tab = {},
			groupColor,
			groupID,
			i;

		for (i = 0; i < groupList.length; i = i + 1) {
			groupName = groupList[i].name;
			groupColor = groupList[i].color;
			groupID = groupList[i].id;
			tab = {};
			tab[groupName] = {
				id : groupID,
				className : "group_tab",
				color : groupColor,
				active : true
			};
			contentSetting.tabs.push(tab);
			searchSetting.groups.push(groupName);
			searchSetting.colors.push(groupColor);
		}

		document.getElementById('content_tab_box').innerHTML = "";
		this.groupBox = window.group_box.init(document.getElementById('content_tab_box'), contentSetting);
		this.initGroupBoxEvents(this.groupBox);

		// コンテキストメニューを刷新
		this.updateContextMenu();
		// バーガーメニューを刷新
		this.updateBurgerMenu();

		this.searchBox = window.search_box.init(document.getElementById('search_tab_box'), searchSetting);
		this.initSearchBoxEvents(this.searchBox);
	};

	/**
	 * テキスト入力ダイアログの表示をトグル
	 */
	ControllerGUI.prototype.toggleTextInput = function () {
		var background = document.getElementById("popup_background"),
			input = document.getElementById("text_input_dialog"),
			textInput = document.getElementById('text_input');

		background.style.display = (background.style.display === "block") ? "none" : "block";
		input.style.display = background.style.display;
		background.onclick = this.toggleTextInput;
	};

	/**
	 *  テキスト入力ダイアログの初期化
	 */
	ControllerGUI.prototype.initTextInputDialog = function () {
		var textSendButton = document.getElementById('text_send_button');
		
		textSendButton.onclick = function (evt) {
			this.emit(window.ControllerGUI.EVENT_TEXTFILEINPUT_CHANGED, null, evt);
			this.toggleTextInput();
		}.bind(this);
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
			});
	};

	/**
	 * バーガーメニューのサブメニュー
	 */
	ControllerGUI.prototype.toggleBurgerSubmenu = function (show, bottom) {
		var container = document.getElementById('burger_menu_submenu');
		if (show) {
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
			this.toggleTextInput();
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

	window.ControllerGUI = ControllerGUI;

	// イベント
	window.ControllerGUI.EVENT_MOUSEDOWN_CONTENT_PREVIEW_AREA = "mousedown_content_preview_area";
	window.ControllerGUI.EVENT_MOUSEDOWN_DISPLAY_PREVIEW_AREA = "mousedown_display_preview_area";
	window.ControllerGUI.EVENT_UPDATEIMAGEINPUT_CHANGED = "updateimageinput_changed";
	window.ControllerGUI.EVENT_IMAGEFILEINPUT_CHANGED = "imagefileinput_changed";
	window.ControllerGUI.EVENT_TEXTFILEINPUT_CHANGED = "textfileinput_changed";
	window.ControllerGUI.EVENT_URLSENDBUTTON_CLICKED = "urlsendbuton_clicked";
	window.ControllerGUI.EVENT_TEXTSENDBUTTON_CLICKED = "textsendbutton_clicked";
	window.ControllerGUI.EVENT_UPDATE_CURSOR_ENABLE = "update_cursor_enable";
	window.ControllerGUI.EVENT_CONTENTDELETEBUTTON_CLICKED = "contentdeletebutton_clicked";
	window.ControllerGUI.EVENT_SELECT_CONTENTS_CLICKED = "select_contents_clicked";
	window.ControllerGUI.EVENT_SELECT_DISPLAY_CLICKED = "select_display_clicked";
	window.ControllerGUI.EVENT_DELETEDISPLAY_CLICKED = "deletedisplay_clicked";
	//window.ControllerGUI.EVENT_DELETEALLDISPLAY_CLICKED = "deletealldisplay_clicked";
	//window.ControllerGUI.EVENT_DELETEALLCONTENT_CLICKED = "deleteallcontent_clicked";
	window.ControllerGUI.EVENT_SHOWIDBUTTON_CLICKED = "showidbutton_clicked";
	//window.ControllerGUI.EVENT_SNAPDROPDOWN_CLICKED = "snapdropdown_clicked";
	//window.ControllerGUI.EVENT_SNAPDROPDOWN_CLICKED = "snapdropdown_clicked";
	window.ControllerGUI.EVENT_VIRTUALDISPLAYSETTING_CLICKED = "virtualdisplaysetting_clicked";
	window.ControllerGUI.EVENT_DISPLAY_SCALE_CHANGED = "display_scale_changed";
	window.ControllerGUI.EVENT_DISPLAY_TRANS_CHANGED = "display_trans_changed";
	window.ControllerGUI.EVENT_CONTENT_INDEX_CHANGED = "content_index_changed";
	window.ControllerGUI.EVENT_CLOSE_ITEM = "close_item";
	window.ControllerGUI.EVENT_FILE_DROPPED = "file_dropped";
	window.ControllerGUI.EVENT_GROUP_APPEND_CLICKED = "group_append_clicked";
	window.ControllerGUI.EVENT_GROUP_DELETE_CLICKED = "group_delete_clicked";
	window.ControllerGUI.EVENT_GROUP_CHANGE_CLICKED = "group_change_clicked";
	window.ControllerGUI.EVENT_GROUP_DOWN = "group_down";
	window.ControllerGUI.EVENT_GROUP_UP = "group_up";
	window.ControllerGUI.EVENT_GROUP_EDIT_NANE = "group_edit_name";
	window.ControllerGUI.EVENT_GROUP_EDIT_COLOR = "group_edit_color";
	window.ControllerGUI.EVENT_SEARCH_INPUT_CHANGED = "search_input_changed";

	// イベントコールバック.
	//window.controller_gui.on_mousedown_content_preview_area = null;
	//window.controller_gui.on_mousedown_display_preview_area = null;
	//window.controller_gui.on_updateimageinput_changed = null;
	//window.controller_gui.on_imagefileinput_changed = null;
	//window.controller_gui.on_textfileinput_changed = null;
	//window.controller_gui.on_urlsendbuton_clicked = null;
	//window.controller_gui.on_textsendbutton_clicked = null;
	//window.controller_gui.on_update_cursor_enable = null;
	//window.controller_gui.on_contentdeletebutton_clicked = null;
	//window.controller_gui.on_select_contents_clicked = null;
	//window.controller_gui.on_select_display_clicked = null;
	//window.controller_gui.on_deletedisplay_clicked = null;
	//window.controller_gui.on_deletealldisplay_clicked = null;
	//window.controller_gui.on_deleteallcontent_clicked = null;
	//window.controller_gui.on_showidbutton_clicked = null;
	//window.controller_gui.on_snapdropdown_clicked = null;
	//window.controller_gui.on_virtualdisplaysetting_clicked　= null;
	//window.controller_gui.on_display_scale_changed = null;
	//window.controller_gui.on_display_trans_changed = null;
	//window.controller_gui.on_content_index_changed = null;
	//window.controller_gui.on_close_item = null;
	//window.controller_gui.on_file_dropped = null;
	//window.controller_gui.on_group_append_clicked = null;
	//window.controller_gui.on_group_delete_clicked = null;
	//window.controller_gui.on_group_change_clicked = null;
	//window.controller_gui.on_group_down = null;
	//window.controller_gui.on_group_up = null;
	//window.controller_gui.on_group_edit_name = null;
	//window.controller_gui.on_group_edit_color = null;
	//window.controller_gui.on_search_input_changed = null;
	
	// Getter.
	//ControllerGUI.prototype.get_selected_elem = this.getSelectedElem;
	
	ControllerGUI.prototype.get_bottom_area = function () {
		return document.getElementById('bottom_area');
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
	ControllerGUI.prototype.get_content_area_by_group = function (group) {
		return this.groupBox ? this.groupBox.get_tab(group) : null;
	};
	ControllerGUI.prototype.get_current_group_name = function () {
		return this.groupBox ? this.groupBox.get_current_group_name() : null;
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

}());
