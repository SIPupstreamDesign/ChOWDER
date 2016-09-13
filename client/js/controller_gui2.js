/*jslint devel:true */
/*global FileReader, Uint8Array, Blob, URL, event, unescape, $, $show, $hide */

(function () {
	"use strict";
	var gui = {},
		windowType = "window",
		wholeWindowListID = "onlist:whole_window",
		groupBox = null,
		searchBox = null,
		displayMenu = null,
		contentMenu = null,
		is_display_scale_changing = false,
		display_scale = 1.0;
	
	/**
	 * PropertyエリアのコンテンツIDからElementを取得する
	 * @method getSelectedElem
	 * @return Literal
	 */
	function getSelectedElem() {
		var targetID = document.getElementById('content_id').innerHTML;
		if (targetID) {
			//targetID = targetID.substr(1); // 最初の空白削除
			return document.getElementById(targetID);
		}
		return null;
	}

	/**
	 * コンテキストメニューを初期化する.
	 */
	function initContextMenu() {
		var menu = document.getElementById('context_menu'),
			delete_button = document.getElementById('context_menu_delete'),
			delete_from_redis = document.getElementById('context_menu_delete_from_redis'),
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
			on_change_group = false,
			on_change_group_item = false,
			on_add_content = false,
			on_add_content_item = false;

		delete_button.onclick = function (evt) {
			gui.on_close_item();
			menu.style.display = "none";
		};

		delete_from_redis.onclick = function (evt) {
			gui.on_contentdeletebutton_clicked(evt); 
			menu.style.display = "none";
		};

		add_image_button.onmousedown = function (evt) {
			document.getElementById('image_file_input').click();
			//gui.on_file_dropped()
			menu.style.display = "none";
		};

		add_text_file_button.onmousedown = function (evt) {
		 	document.getElementById('text_file_input').click();	
			menu.style.display = "none";
		};

		add_url_button.onmousedown = function (evt) {
			toggleURLInput();
			menu.style.display = "none";
		};

		add_text_button.onmousedown = function (evt) {
			toggleTextInput();
			menu.style.display = "none";
		};

		change_image_button.onmousedown = function (evt) {
			document.getElementById('update_image_input').click();
			menu.style.display = "none";
		};

		move_front_button.onclick = function (evt) {
			if (gui.on_content_index_changed) {
				gui.on_content_index_changed(true);
			}
			menu.style.display = "none";
		};

		move_back_button.onclick = function (evt) {
			if (gui.on_content_index_changed) {
				gui.on_content_index_changed(false);
			}
			menu.style.display = "none";
		};

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

		document.body.oncontextmenu = function (evt) {
			if (getSelectedElem()) {
				var px = evt.clientX + (document.body.scrollLeft || document.documentElement.scrollLeft),
					py = evt.clientY + (document.body.scrollTop || document.documentElement.scrollTop);

				menu.style.left = px + "px";
				menu.style.top = py + "px";
				menu.style.height = (document.getElementsByClassName("context_menu_item").length * 20) + "px";
				menu.style.display = 'block';
			}
			evt.preventDefault();
		};
		window.addEventListener("mousedown", function (evt) {
			if (evt.target.className !== "context_menu_item") {
				menu.style.display = "none";
			}
		});
	}

	/**
	 * コンテキストメニューの動的に変化する部分を更新.
	 */
	function updateContextMenu() {
		var groupToElems = groupBox.get_tabgroup_to_elems(),
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
				item.onmousedown = (function (gname) {
					return function (evt) {
						window.controller_gui.on_group_change_clicked(gname);
					};
				}(gname));
			}
		}
	}
	
	function updateBurgerMenu() {
		var groupToElems = groupBox.get_tabgroup_to_elems(),
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
				item.onmousedown = (function (gname) {
					return function (evt) {
						window.controller_gui.on_group_change_clicked(gname);
						toggleBurgerSubmenu(false);
						contentMenu.toggle();
					};
				}(gname));
			}
		}
	}

	/**
	 * コンテンツ入力の初期化
	 */
	function initContentInputs() {
		var imageFileInput = document.getElementById('image_file_input'),
			textFileInput = document.getElementById('text_file_input'),
			updateImageInput = document.getElementById('update_image_input');

		imageFileInput.addEventListener('change', function (evt) {
			gui.on_imagefileinput_changed(evt);
			imageFileInput.value = "";
		}, false);
		
		textFileInput.addEventListener('change', function (evt) {
			gui.on_textfileinput_changed(evt);
			textFileInput.value = "";
		}, false);

		updateImageInput.addEventListener('change', function (evt) {
			gui.on_updateimageinput_changed(evt);
			updateImageInput.value = "";
		}, false);
	}
	
	/**
	 * ドラッグアンドドロップの初期化
	 */
	function initDragAndDrop() {
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
			gui.on_file_dropped(evt);
		});
	}

	/**
	 * メインビューの右ドラッグスケーリングの初期化
	 */
	function initMainViewScaling() {
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
		});

		window.addEventListener('mousemove', function (evt) {
			var rect = contentPreviewArea.getBoundingClientRect();
			if (is_right_dragging) {
				var dy = evt.clientY - rect.top - mouseDownPosY,
					ds = dy;
				if (ds > 0) {
					display_scale += 0.005 * Math.abs(ds + 0.5);
				} else {
					if (display_scale < 1.0) {
						display_scale -= 0.002 * Math.abs(ds - 0.5);
					} else {
						display_scale -= 0.005 * Math.abs(ds - 0.5);
					}
				}
				if (display_scale < 0.05) {
					display_scale = 0.05;
				}
				if (display_scale > 2) {
					display_scale = 2;
				}
				gui.on_display_scale_changed(display_scale);
			} else if (is_middle_dragging) {
				var dx = evt.clientX - rect.left - mouseDownPosX,
					dy = evt.clientY - rect.top - mouseDownPosY;
				
				gui.on_display_trans_changed(dx, dy);
			}
			mouseDownPosX = evt.clientX;
			mouseDownPosY = evt.clientY;
		});

		window.addEventListener('mouseup', function (evt) {
			if (evt.button === 2) {
				is_right_dragging = false;
			} else if (evt.button === 1) {
				is_middle_dragging = false;
			}
		})

	}

	/**
	 *  タブが変更された
	 * @param tabName タブ名
	 */
	function changeTab(tabName) {
		var displayPreviewArea = document.getElementById('display_preview_area'),
			contentPreviewArea = document.getElementById('content_preview_area'),
			contentMenu = document.getElementById('bottom_burger_menu_content'),
			displayMenu = document.getElementById('bottom_burger_menu_display'),
			searchMenu = document.getElementById('bottom_burger_menu_search');

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
		} else if (tabName === 'Search') {
			displayPreviewArea.style.opacity = 0.3;
			contentPreviewArea.style.opacity = 1.0;
			displayPreviewArea.style.zIndex = -1000;
			contentPreviewArea.style.zIndex = 10;
			displayMenu.style.display = "none";
			contentMenu.style.display = "none";
			searchMenu.style.display = "block";
		}
	}

	/**
	 * グループのタブに対するイベントを設定. 
	 */
	function initGroupBoxEvents(groupBox) {
		groupBox.on_group_delete = function (groupID) {
			if (window.controller_gui.on_group_delete_clicked) {
				window.controller_gui.on_group_delete_clicked(groupID);
			}
		};

		groupBox.on_group_append = function (groupName) {
			if (window.controller_gui.on_group_append_clicked) {
				window.controller_gui.on_group_append_clicked(groupName);
			}
		};

		groupBox.on_group_up = function (groupName) {
			if (window.controller_gui.on_group_up) {
				window.controller_gui.on_group_up(groupName);
			}
		};
		
		groupBox.on_group_down = function (groupName) {
			if (window.controller_gui.on_group_down) {
				window.controller_gui.on_group_down(groupName);
			}
		};

		groupBox.on_group_edit_name = function (groupID, groupName) {
			if (window.controller_gui.on_group_edit_name) {
				window.controller_gui.on_group_edit_name(groupID, groupName);
			}
		};
		groupBox.on_group_edit_color = function (groupID, color) {
			if (window.controller_gui.on_group_edit_color) {
				window.controller_gui.on_group_edit_color(groupID, color);
			}
		};
	}

	/**
	 * Searchのタブに対するイベントを設定.
	 */
	function initSearchBoxEvents(searchBox) {
		searchBox.on_input_changed = function (value, groups) {
			if (window.controller_gui.on_search_input_changed) {
				window.controller_gui.on_search_input_changed(value, groups);
			}
		};
	}

	/**
	 * グループリストをセットする。
	 * コンテンツタブの中身はすべて消去されてグループボックスが初期化される。
	 * サーチタブにもグループを追加。
	 */
	function setGroupList(groupList) {
		var activeTab = groupBox.get_active_tab_name(),
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
		groupBox = window.group_box.init(document.getElementById('content_tab_box'), contentSetting);
		initGroupBoxEvents(groupBox);

		// コンテキストメニューを刷新
		updateContextMenu();
		// バーガーメニューを刷新
		updateBurgerMenu();

		searchBox = window.search_box.init(document.getElementById('search_tab_box'), searchSetting);
		initSearchBoxEvents(searchBox);
	}

	/**
	 * テキスト入力ダイアログの表示をトグル
	 */
	function toggleTextInput() {
		var background = document.getElementById("popup_background"),
			input = document.getElementById("text_input_dialog"),
			textInput = document.getElementById('text_input');

		background.style.display = (background.style.display === "block") ? "none" : "block";
		input.style.display = background.style.display;
		background.onclick = toggleTextInput;
	}

	/**
	 *  テキスト入力ダイアログの初期化
	 */
	function initTextInputDialog() {
		var textSendButton = document.getElementById('text_send_button');
		
		textSendButton.onclick = function (evt) {
			gui.on_textsendbutton_clicked(evt);
			toggleTextInput();
		};
			
	}

	/**
	 * URL入力ダイアログの表示をトグル
	 */
	function toggleURLInput() {
		window.input_dialog.text_input({
				name : "URLの追加",
				initialName :  "",
				okButtonName : "Send",
			}, function (value) {
				gui.on_urlsendbuton_clicked(value);
			});
	}

	/**
	 * バーガーメニューのサブメニュー
	 */
	function toggleBurgerSubmenu(show, bottom) {
		var container = document.getElementById('burger_menu_submenu');
		if (show) {
			container.style.display = "block";
			container.style.position = "fixed";
			container.style.bottom = bottom;
			container.style.right = "280px";
			container.style.width = "150px";
			container.style.backgroundColor = "white";
			container.style.color = "black";
		} else {
			container.style.display = "none";
		}
	}

	/**
	 * バーガーメニューのコンテンツ追加サブメニュー
	 */
	function toggleBurgerSubmenuAddContent(show, bottom) {
		var container = document.getElementById('burger_menu_submenu_add_content');
		if (show) {
			container.style.display = "block";
			container.style.position = "fixed";
			container.style.bottom = bottom;
			container.style.right = "280px";
			container.style.width = "150px";
			container.style.backgroundColor = "white";
			container.style.color = "black";
		} else {
			container.style.display = "none";
		}
	}

	function initBurgerMenuContent() {
		var add_image_button = document.getElementById('burger_menu_add_image'),
			add_text_button = document.getElementById('burger_menu_add_text'),
			add_text_file_button = document.getElementById('burger_menu_add_text_file'),
			add_url_button = document.getElementById('burger_menu_add_url');
		
		add_image_button.onmousedown = function (evt) {
			toggleBurgerSubmenuAddContent(false);
			contentMenu.toggle();
			document.getElementById('image_file_input').click();
		};

		add_text_file_button.onmousedown = function (evt) {
			toggleBurgerSubmenuAddContent(false);
			contentMenu.toggle();
		 	document.getElementById('text_file_input').click();	
		};

		add_url_button.onmousedown = function (evt) {
			toggleBurgerSubmenuAddContent(false);
			contentMenu.toggle();
			toggleURLInput();
		};

		add_text_button.onmousedown = function (evt) {
			toggleBurgerSubmenuAddContent(false);
			contentMenu.toggle();
			toggleTextInput();
		};
	}

	/**
	 * 初期化
	 * @method init
	 */
	function init() {

		// 全体のレイアウトの初期化.
		window.layout.init();

		// 上部メニューの初期化.
		window.menu.init(document.getElementById('head_menu'),
			{
				menu : [{
					SelectMode : [{
							View : {
								url : "view2.html"
							},
						}, {
							Controller : {
								url : "controller2.html"
							}
						}],
				}, {
					Add : [{
							Image : {
								func : function () { document.getElementById('image_file_input').click() }
							}
						}, {
							Text : {
								func : function () { toggleTextInput(); }
							},
						}, {
							TextFile : {
								func : function () { document.getElementById('text_file_input').click(); }
							},
						}, {
							URL : {
								func : function () { toggleURLInput(); }
							}
						}],
				}, {
					Edit : [{
						VirtualDisplaySetting : {
							func : function () { 
								document.getElementById('display_tab_link').click();
								gui.on_virtualdisplaysetting_clicked();
							}
						},
					}, {
						Snap : [{
							Free : {
								func : function () { gui.on_snapdropdown_clicked('free'); }
							},
						}, {
							Display : {
								func : function () {
									gui.on_snapdropdown_clicked('display');
								}
							},
						}, {
							Grid : {
								func : function () { gui.on_snapdropdown_clicked('grid'); }
							}
						}],
					}, {
						ReplaceImage : {
							func : function () { document.getElementById('update_image_input').click(); }
						}
					}]
				}]
			});

		// 下部コンテンツボックスの初期化.
		window.content_box.init(document.getElementById('bottom_area'),
			{
				tabs : [{
						Display : {
							id : "display_tab",
							func : function () { changeTab('Display'); },
							active : true,
						},
					}, {
						Content : {
							id : "content_tab",
							func : function () { changeTab('Content'); }
						},
					}, {
						Search : {
							id : "search_tab",
							func : function () { changeTab('Search'); }
						}
					}]
			});

		// コンテンツボックスにグループボックスを埋め込み.
		groupBox = window.group_box.init(document.getElementById('content_tab_box'),
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
		initGroupBoxEvents(groupBox);

		// Searchエリアの中身を作成
		searchBox = window.search_box.init(document.getElementById('search_tab_box'),
			{
				groups : ["default"],
				colors : ["rgb(54,187,68)"]
			});
		initSearchBoxEvents(searchBox);

		// 右部コンテンツプロパティの初期化.
		window.content_property.init(wholeWindowListID, "", "whole_window");

		// コンテキストメニューの初期化.
		initContextMenu();

		// コンテンツ入力の初期化
		initContentInputs();

		// ファイルドラッグアンドドロップの初期化
		initDragAndDrop();

		// メインビューの拡大縮小の初期化
		initMainViewScaling();

		// テキスト入力ダイアログの初期化
		initTextInputDialog();

		// 下部バーガーメニューの初期化	
		displayMenu = window.burger_menu.init(
			document.getElementById('bottom_burger_menu_display'),
			{
				menu : [{
						選択DisplayのIDを表示 : {
							func : function (evt) { gui.on_showidbutton_clicked(false); }
						}
					},{
						全てのDisplayのIDを表示 : {
							func : function (evt) { gui.on_showidbutton_clicked(true); }
						}
					},{
						選択Displayを削除 : {
							func : function (evt) { gui.on_deletedisplay_clicked(evt); }
						}
					},
					{
						全てのDisplayを削除 : {
							func : function (evt) { gui.on_deletealldisplay_clicked(evt); }
						}
					}]
			});

		initBurgerMenuContent();

		// 下部バーガーメニューの初期化
		var on_burger_submenu = false,
			on_group_change = false,
			on_burger_submenu_add_content = false,
			on_add_content = false;
		contentMenu = window.burger_menu.init(
			document.getElementById('bottom_burger_menu_content'),
			{
				menu : [{
						最前面に移動 : {
							func : function (evt) { gui.on_content_index_changed(true); }
						}
					},{
						最背面に移動 : {
							func : function (evt) { gui.on_content_index_changed(false); }
						}
					},{
						コンテンツ追加: {
							submenu: true,
							mouseoverfunc : function (evt) {
								toggleBurgerSubmenuAddContent(true, "170px"); 
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
								toggleBurgerSubmenu(true, "150px"); 
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
							func : function (evt) { gui.on_close_item(); }
						}
					},{
						削除 : {
							func : function (evt) { gui.on_contentdeletebutton_clicked(evt); }
						}
					},{
						全て選択 : {
							func : function (evt) { gui.on_select_contents_clicked(false); }
						}
					},{
						グループ内全て選択 : {
							func : function (evt) { gui.on_select_contents_clicked(true); }
						}
					}
										/*
					{
						グループ内一括削除 : {
							func : function (evt) { gui.on_deleteallcontent_clicked(evt); }
						}
					}
					{
							submenu: true,
							mouseoverfunc : function (evt) {
								toggleBurgerSubmenu(true, "87px"); 
								on_group_change_all = true;
							},
							mouseoutfunc : function (evt) {
								on_group_change_all = false; 
							}
						}*/]
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
				toggleBurgerSubmenu(false);
			}
			if (!on_burger_submenu_add_content && !on_add_content) {
				toggleBurgerSubmenuAddContent(false);
			}
		};

		document.getElementById('content_preview_area').addEventListener("mousedown", function (evt) {
			gui.on_mousedown_content_preview_area();
		});

		document.getElementById('display_preview_area').addEventListener("mousedown", function (evt) {
			gui.on_mousedown_display_preview_area();
		});
	}

	window.controller_gui = gui;
	window.controller_gui.init = init;

	// イベントコールバック.
	window.controller_gui.on_mousedown_content_preview_area = null;
	window.controller_gui.on_mousedown_display_preview_area = null;
	window.controller_gui.on_updateimageinput_changed = null;
	window.controller_gui.on_imagefileinput_changed = null;
	window.controller_gui.on_textfileinput_changed = null;
	window.controller_gui.on_urlsendbuton_clicked = null;
	window.controller_gui.on_textsendbutton_clicked = null;
	//window.controller_gui.on_duplicatebutton_clicked = null;
	window.controller_gui.on_contentdeletebutton_clicked = null;
	window.controller_gui.on_select_contents_clicked = null;
	window.controller_gui.on_deletedisplay_clicked = null;
	window.controller_gui.on_deletealldisplay_clicked = null;
	window.controller_gui.on_deleteallcontent_clicked = null;
	window.controller_gui.on_showidbutton_clicked = null;
	window.controller_gui.on_snapdropdown_clicked = null;
	window.controller_gui.on_virtualdisplaysetting_clicked　= null;
	window.controller_gui.on_display_scale_changed = null;
	window.controller_gui.on_display_trans_changed = null;
	window.controller_gui.on_content_index_changed = null;
	window.controller_gui.on_close_item = null;
	window.controller_gui.on_file_dropped = null;
	window.controller_gui.on_group_append_clicked = null;
	window.controller_gui.on_group_delete_clicked = null;
	window.controller_gui.on_group_change_clicked = null;
	window.controller_gui.on_group_down = null;
	window.controller_gui.on_group_up = null;
	window.controller_gui.on_group_edit_name = null;
	window.controller_gui.on_group_edit_color = null;
	window.controller_gui.on_search_input_changed = null;
	
	// Getter.
	window.controller_gui.get_selected_elem = getSelectedElem;
	
	window.controller_gui.get_bottom_area = function () {
		return document.getElementById('bottom_area');
	};
	window.controller_gui.get_display_tab_link = function () {
		return document.getElementById('display_tab_link');
	};
	window.controller_gui.get_display_preview_area = function () {
		return document.getElementById('display_preview_area');
	};
	window.controller_gui.get_content_preview_area = function () {
		return document.getElementById('content_preview_area');
	};
	window.controller_gui.get_content_area = function () {
		return groupBox ? groupBox.get_current_tab() : null;
	};
	window.controller_gui.get_search_area = function () {
		return searchBox ? document.getElementsByClassName('search_item_wrapper')[0] : null;
	};
	window.controller_gui.get_content_area_by_group = function (group) {
		return groupBox ? groupBox.get_tab(group) : null;
	};
	window.controller_gui.get_current_group_name = function () {
		return groupBox ? groupBox.get_current_group_name() : null;
	};
	window.controller_gui.get_display_area = function () {
		return document.getElementById('display_tab_box');
	};
	window.controller_gui.get_list_elem = function (id) {
		return document.getElementById("onlist:" + id);
	};
	window.controller_gui.get_search_elem = function (id) {
		return document.getElementById("onsearch:" + id);
	};
	window.controller_gui.get_whole_window_elem = function () {
		return document.getElementById(wholeWindowListID);
	};
	window.controller_gui.get_update_content_id = function () {
		return document.getElementById('update_content_id').innerHTML;
	};
	
	// Setter.
	window.controller_gui.set_update_content_id = function (id) {
		document.getElementById('update_content_id').innerHTML = id;
	};

	window.controller_gui.set_display_scale = function (scale) {
		display_scale = scale; 
	};

	window.controller_gui.set_group_list = function (grouplist) {
		setGroupList(grouplist);
	};
	
	window.controller_gui.set_search_result = function (search_result) {
		searchBox.set_search_result(search_result);
	};

}());
