/*jslint devel:true */
/*global FileReader, Uint8Array, Blob, URL, event, unescape, $, $show, $hide */

(function () {
	"use strict";
	var gui = {},
		windowType = "window",
		wholeWindowListID = "onlist:whole_window",
		groupBox = null,
		displayMenu = null,
		contentMenu = null;
	
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
		a.onclick = function (evt) {
			var displayScale = parseFloat(this.innerHTML);
			if (displayScale < 0) {
				displayScale = 0.01;
			} else if (displayScale > 1.0) {
				displayScale = 1.0;
			}
			
			gui.on_display_scale_changed(displayScale);
			
			current.innerHTML = displayScale;
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
	 * Deleteボタン有効化設定
	 * @method enableDeleteButton
	 * @param {bool} isEnable ボタン有効化
	 */
	function enableDeleteButton(isEnable) {
		/*
		if (isEnable) {
			document.getElementById('content_delete_button').className = "btn btn-danger";
		} else {
			document.getElementById('content_delete_button').className = "btn btn-danger disabled";
		}
		*/
	}
	
	/**
	 * DisplayDeleteボタン有効化設定
	 * @method enableDisplayDeleteButton
	 * @param {bool} isEnable ボタン有効化
	 */
	function enableDisplayDeleteButton(isEnable) {
		// TODO burgermenuのボタンの有効化
		/*
		if (isEnable) {
			document.getElementById('display_delete_button').className = "btn btn-primary";
		} else {
			document.getElementById('display_delete_button').className = "btn btn-primary disabled";
		}
		*/
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

	/**
	 * コンテキストメニューを初期化する.
	 */
	function initContextMenu() {
		var menu = document.getElementById('context_menu'),
			delete_button = document.getElementById('context_menu_delete'),
			add_image_button = document.getElementById('context_menu_add_image'),
			add_memo_button = document.getElementById('context_menu_add_memo');

		delete_button.onclick = function (evt) {
			gui.on_close_item();
			menu.style.display = "none";
		};

		add_image_button.onclick = function (evt) {
			document.getElementById('image_file_input').click();
			//gui.on_file_dropped()
			menu.style.display = "none";
		};

		add_memo_button.onclick = function (evt) {
			// TODO
			menu.style.display = "none";
		};

		document.body.oncontextmenu = function (evt) {
			var px = evt.clientX + (document.body.scrollLeft || document.documentElement.scrollLeft),
				py = evt.clientY + (document.body.scrollTop || document.documentElement.scrollTop);

			menu.style.left = px + "px";
			menu.style.top = py + "px";
			menu.style.height = (document.getElementsByClassName("context_menu_item").length * 20) + "px";
			menu.style.display = 'block';
			evt.preventDefault();
		};
		window.addEventListener("mousedown", function (evt) {
			if (evt.target.className !== "context_menu_item") {
				menu.style.display = "none";
			}
		});
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
			displayMenu.style.display = "none";
			contentMenu.style.display = "none";
			searchMenu.style.display = "block";
		}
	}

	/**
	 * 初期化
	 * @method init
	 */
	function init() {


		// 全体のレイアウトの初期化.
		window.layout.init();

		// 上部メニューの初期化.
		window.menu.init(document.getElementById('head_menu'));

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
					}, {
						Group1 : {
							id : "group_1",
							className : "group_tab",
							func : function () {},
							active : true
						}
					}]
			});

		// 右部コンテンツプロパティの初期化.
		window.content_property.init(wholeWindowListID, "whole_window");

		// コンテキストメニューの初期化.
		initContextMenu();

		// コンテンツ入力の初期化
		initContentInputs();

		// ファイルドラッグアンドドロップ
		initDragAndDrop();

		// 下部バーガーメニューの初期化	
		displayMenu = window.burger_menu.init(
			document.getElementById('bottom_burger_menu_display'),
			{
				menu : [{
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

		// 下部バーガーメニューの初期化
		contentMenu = window.burger_menu.init(
			document.getElementById('bottom_burger_menu_content'),
			{
				menu : [{
						選択コンテンツを削除 : {
							func : function (evt) { gui.on_contentdeletebutton_clicked(evt); }
						}
					},
					{
						グループ内のコンテンツを全て削除 : {
							func : function (evt) { gui.on_deleteallcontent_clicked(evt); }
						}
					},
					{
						テストdeletegroup : {
							func : function (evt) {}
						}
					}]
			});

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
	window.controller_gui.on_duplicatebutton_clicked = null;
	window.controller_gui.on_contentdeletebutton_clicked = null;
	window.controller_gui.on_deletedisplay_clicked = null;
	window.controller_gui.on_deletealldisplay_clicked = null;
	window.controller_gui.on_deleteallcontent_clicked = null;
	window.controller_gui.on_showidbutton_clicked = null;
	window.controller_gui.on_snapdropdown_clicked = null;
	window.controller_gui.on_virtualdisplaysetting_clicked　= null;
	window.controller_gui.on_display_scale_changed = null;
	window.controller_gui.on_close_item = null;
	window.controller_gui.on_file_dropped = null;
	
	// enable設定.
	window.controller_gui.enable_delete_button = enableDeleteButton;
	window.controller_gui.enable_display_delete_button = enableDisplayDeleteButton;
	window.controller_gui.enable_update_image_button = enableUpdateImageButton;
	

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
	
}());
