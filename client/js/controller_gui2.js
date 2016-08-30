/*jslint devel:true */
/*global FileReader, Uint8Array, Blob, URL, event, unescape, $, $show, $hide */

(function () {
	"use strict";
	var gui = {},
		windowType = "window",
		wholeWindowListID = "onlist:whole_window";
	
	/**
	 * Propertyタブにボタン追加
	 * @method addButtonProperty
	 * @param {String} id ボタンID
	 * @param {String} value ボタンinnerHTML
	 * @param {Function} func onclick時コールバック
	 */
	function addButtonProperty(id, value, func) {
		/*
			<div class="btn btn-success" id="content_add_button">Add</div>
		*/
		var transInput = document.getElementById('transform_input'),
			group = document.createElement('div'),
			button = document.createElement('div');
		
		group.className = "input-group";
		button.className = "btn btn-primary property_button";
		button.innerHTML = value;
		button.id = id;
		button.onclick = func;
		group.appendChild(button);
		transInput.appendChild(group);
	}
	
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
	 * コンテンツ追加ポップアップの初期化
	 * @method initAddContentArea
	 */
	/*
	function initAddContentArea() {
		var textSendButton = document.getElementById('text_send_button'),
			urlSendButton = document.getElementById('url_send_button'),
			imageFileInput = document.getElementById('image_file_input'),
			textFileInput = document.getElementById('text_file_input'),
			updateImageInput = document.getElementById('update_image_input'),
			duplicateButton = document.getElementById('duplicate_button');
		
		urlSendButton.onclick = function (evt) {
			gui.on_urlsendbuton_clicked(evt);
		};
		
		updateImageInput.addEventListener('change', function (evt) {
			gui.on_updateimageinput_changed(evt);
			updateImageInput.value = "";
		}, false);
		imageFileInput.addEventListener('change', function (evt) {
			gui.on_imagefileinput_changed(evt);
			
			imageFileInput.value = "";
		}, false);
		textFileInput.addEventListener('change', function (evt) {
			gui.on_textfileinput_changed(evt);
			
			textFileInput.value = "";
		}, false);
		textSendButton.onclick = function (evt) {
			gui.on_textsendbutton_clicked(evt);
		};
		if (duplicateButton) {
			duplicateButton.onclick = function (evt) {
				gui.on_duplicatebutton_clicked(evt);
			};
		}
	}
	*/
	
	/**
	 * ビュー領域初期化。スケーリング表示、スナップ設定などのelementの初期化を行う。
	 * @method initViewSettingArea
	 */
	/*
	function initViewSettingArea(rightfunc) {		
		addScaleDropdown('display_scale_1', 0.1);
		addScaleDropdown('display_scale_2', 0.2);
		addScaleDropdown('display_scale_3', 0.3);
		addScaleDropdown('display_scale_4', 0.4);
		addScaleDropdown('display_scale_5', 0.5);
		addScaleDropdown('display_scale_6', 0.6);
		addScaleDropdown('display_scale_7', 0.7);
		addScaleDropdown('display_scale_8', 0.8);
		addScaleDropdown('display_scale_9', 0.9);
		addScaleDropdown('display_scale_10', 1.0);
		//addScaleDropdown('display_scale_11', "custum");
	}
	*/
	
	/**
	 * 左コンテンツタブ初期化
	 * @method initContentArea
	 * @param {Function} bottomfunc addボタンコールバック
	 */
	/*
	function initContentArea(bottomfunc) {
		var addButton = document.getElementById('content_add_button'),
			contentDeleteButton = document.getElementById('content_delete_button'),
			contentDeleteAllButton = document.getElementById('content_delete_all_button');
		
		addButton.onclick = function () {
			bottomfunc(true);
		};
		
		contentDeleteButton.onclick = function (evt) {
			gui.on_contentdeletebutton_clicked(evt);
		};
		contentDeleteAllButton.onclick = function (evt) {
			gui.on_deleteallcontent_clicked(evt);
		};
	}
	*/
	
	/**
	 * ディスプレイタブの初期化
	 * @method initDisplayArea
	 */
	/*
	function initDisplayArea() {
		var displayDeleteButton = document.getElementById('display_delete_button'),
			displayDeleteAllButton = document.getElementById('display_delete_all_button');
		displayDeleteButton.onclick = function (evt) {
			gui.on_deletedisplay_clicked(evt);
		};
		displayDeleteAllButton.onclick = function (evt) {
			gui.on_deletealldisplay_clicked(evt);
		};
	}
	*/

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
	}
	
	/**
	 * 初期化
	 * @method init
	 */
	function init() {
		window.layout.init();

		// 上部メニューの初期化.
		window.menu.init(document.getElementById('head_menu'));
		// 下部コンテンツボックスの初期化.
		window.content_box.init(document.getElementById('bottomArea'));
		// 右部コンテンツプロパティの初期化.
		window.content_property.init(wholeWindowListID, "whole_window");

		// コンテキストメニューの初期化.
		initContextMenu();


		document.getElementById('content_preview_area').addEventListener("mousedown", function (evt) {
			gui.on_mousedown_content_preview_area();
		});

		document.getElementById('display_preview_area').addEventListener("mousedown", function (evt) {
			gui.on_mousedown_display_preview_area();
		});
		/*
		document.getElementById('content_area').addEventListener("mousedown", function (evt) {
			gui.on_mousedown_content_area();
		});
		*/

	}

	window.controller_gui = gui;
	window.controller_gui.init = init;

	// イベントコールバック.
	window.controller_gui.on_mousedown_content_preview_area = null;
	window.controller_gui.on_mousedown_display_preview_area = null;
	window.controller_gui.on_mousedown_content_area = null;
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
	
	// enable設定.
	window.controller_gui.enable_delete_button = enableDeleteButton;
	window.controller_gui.enable_display_delete_button = enableDisplayDeleteButton;
	window.controller_gui.enable_update_image_button = enableUpdateImageButton;
	

	// Getter.
	window.controller_gui.get_selected_elem = getSelectedElem;
	
	window.controller_gui.get_left_main_area = function () {
		return document.getElementById('left_main_area');
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
		return document.getElementById('content_tab_box');
	};
	window.controller_gui.get_display_area = function () {
		return document.getElementById('display_tab_box');
	};
	window.controller_gui.get_left_area = function () {
		return document.getElementById('leftArea');
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
