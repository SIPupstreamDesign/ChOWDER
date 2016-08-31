/*jslint devel:true */
/*global FileReader, Uint8Array, Blob, URL, event, unescape, $, $show, $hide */

(function () {
	"use strict";
	var gui = {},
		windowType = "window",
		wholeWindowListID = "onlist:whole_window";
	
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
	 * @param {Function} bottomfunc 下部エリアの開閉ファンクション.
	 */
	function initAddContentArea(bottomfunc) {
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
			bottomfunc(false);
		}, false);
		imageFileInput.addEventListener('change', function (evt) {
			gui.on_imagefileinput_changed(evt);
			
			imageFileInput.value = "";
			bottomfunc(false);
		}, false);
		textFileInput.addEventListener('change', function (evt) {
			gui.on_textfileinput_changed(evt);
			
			textFileInput.value = "";
			bottomfunc(false);
		}, false);
		textSendButton.onclick = function (evt) {
			gui.on_textsendbutton_clicked(evt);
			bottomfunc(false);
		};
		if (duplicateButton) {
			duplicateButton.onclick = function (evt) {
				gui.on_duplicatebutton_clicked(evt);
				bottomfunc(false);
			};
		}
	}
	
	/**
	 * ビュー領域初期化。スケーリング表示、スナップ設定などのelementの初期化を行う。
	 * @method initViewSettingArea
	 */
	function initViewSettingArea(rightfunc) {
		var dropDownCurrent = document.getElementById('snap_dropdown_current'),
			dropdownMenu1 = document.getElementById('dropdownMenu1'),
			dropdownMenu2 = document.getElementById('dropdownMenu2'),
			free = document.getElementById('dropdown_item1'),
			display = document.getElementById('dropdown_item2'),
			grid = document.getElementById('dropdown_item3'),
			displaySettingItem = document.getElementById('virtual_display_setting'),
			i;
		
		free.onclick = function () {
			dropDownCurrent.innerHTML = this.innerHTML;
			console.log("free mode");
			gui.on_snapdropdown_clicked('free');
		};

		display.onclick = function () {
			dropDownCurrent.innerHTML = this.innerHTML;
			console.log("display mode");
			gui.on_snapdropdown_clicked('display');
		};
		
		grid.onclick = function () {
			dropDownCurrent.innerHTML = this.innerHTML;
			console.log("grid mode");
			gui.on_snapdropdown_clicked('grid');
		};

		displaySettingItem.onclick = function () {
			var displayTabTitle = document.getElementById('display_tab_title');
			displayTabTitle.onclick();
			gui.on_virtualdisplaysetting_clicked();
			rightfunc(true);
		};
		
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
	
	/**
	 * 左コンテンツタブ初期化
	 * @method initContentArea
	 * @param {Function} bottomfunc addボタンコールバック
	 */
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
	
	/**
	 * ディスプレイタブの初期化
	 * @method initDisplayArea
	 */
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
	
	
	/**
	 * 左メニュー領域[ディスプレイタブ、コンテンツタブ]の初期化
	 * @method initLeftArea
	 * @param {Function} bottomfunc addボタンコールバック
	 */
	function initLeftArea(bottomfunc) {
		var displayArea = document.getElementById('display_area'),
			displayTabTitle = document.getElementById('display_tab_title'),
			displayTabLink = document.getElementById('display_tab_link'),
			displayButtonArea = document.getElementById('display_button_area'),
			contentArea = document.getElementById('content_area'),
			contentButtonArea = document.getElementById('content_button_area'),
			contentTabTitle = document.getElementById('content_tab_title'),
			contentTabLink = document.getElementById('content_tab_link'),
			showIDButton = document.getElementById('show_display_id_button'),
			displayPreviewArea = document.getElementById('display_preview_area'),
			contentPreviewArea = document.getElementById('content_preview_area');
		
		showIDButton.onclick = function (evt) {
			gui.on_showidbutton_clicked(evt);
		};

		displayTabTitle.onclick = function () {
			displayArea.style.display = "block";
			contentArea.style.display = "none";
			contentButtonArea.style.display = "none";
			displayButtonArea.style.display = "block";
			displayTabTitle.className = "display_tab_title active";
			contentTabTitle.className = "content_tab_title";
			displayTabLink.className = "active";
			contentTabLink.className = "";
			displayPreviewArea.style.opacity = 1.0;
			contentPreviewArea.style.opacity = 0.3;
			displayPreviewArea.style.zIndex = 10;
			contentPreviewArea.style.zIndex = -1000;
			gui.on_lefttab_changed();
		};

		contentTabTitle.onclick = function () {
			displayArea.style.display = "none";
			contentArea.style.display = "block";
			contentButtonArea.style.display = "block";
			displayButtonArea.style.display = "none";
			displayTabTitle.className = "display_tab_title";
			contentTabTitle.className = "content_tab_title active";
			contentTabLink.className = "active";
			displayTabLink.className = "";
			displayPreviewArea.style.opacity = 0.3;
			contentPreviewArea.style.opacity = 1.0;
			displayPreviewArea.style.zIndex = -1000;
			contentPreviewArea.style.zIndex = 10;
			gui.on_lefttab_changed();
		};
		initContentArea(bottomfunc);
		initDisplayArea();
	}
	
	/**
	 * Propertyタブに入力プロパティを追加する
	 * @method addInputProperty
	 * @param {Object} input element id
	 * @param {String} leftLabel 左ラベル
	 * @param {String} rightLabel 右ラベル
	 * @param {String} value 初期入力値
	 */
	function addInputProperty(id, leftLabel, rightLabel, value) {
		/*
			<div class="input-group">
				<span class="input-group-addon">x</span>
				<input type="text" class="form-control" id="content_transform_x" value="0">
				<span class="input-group-addon">px</span>
			</div>
		*/
		var transInput = document.getElementById('transform_input'),
			group = document.createElement('div'),
			leftSpan = document.createElement('span'),
			rightSpan = document.createElement('span'),
			input = document.createElement('input');
		
		group.className = "input-group";
		leftSpan.className = "input-group-addon";
		leftSpan.innerHTML = leftLabel;
		rightSpan.className = "input-group-addon";
		rightSpan.innerHTML = rightLabel;
		input.className = "form-control";
		input.id = id;
		input.value = value;
		//input.nodeType = "text";
		
		group.appendChild(leftSpan);
		group.appendChild(input);
		if (rightLabel) {
			group.appendChild(rightSpan);
		}
		transInput.appendChild(group);
	}
	
	/**
	 * Property表示領域初期化。selectされたtypeに応じて作成されるelementが変更される。
	 * @method initPropertyArea
	 * @param {String} id ContentもしくはDisplay ID
	 * @param {String} type 設定タイプ
	 * @param {String} mime mime
	 */
	function initPropertyArea(id, type, mime) {
		var contentX,
			contentY,
			contentW,
			contentH,
			contentZ,
			wholeW,
			wholeH,
			wholeSplitX,
			wholeSplitY,
			transInput = document.getElementById('transform_input'),
			idlabel = document.getElementById('content_id_label'),
			idtext = document.getElementById('content_id'),
			downloadButton = document.getElementById('download_button'),
			extension,
			rectChangeFunc = gui.on_rect_changed;
		console.log("initPropertyArea");
		if (id) {
			document.getElementById('content_id').innerHTML = id;
		} else {
			document.getElementById('content_id').innerHTML = "";
		}
		transInput.innerHTML = "";
		if (type === "display") {
			idlabel.innerHTML = "Display ID:";
			addInputProperty('content_transform_x', 'x', 'px', '0');
			addInputProperty('content_transform_y', 'y', 'px', '0');
			addInputProperty('content_transform_w', 'w', 'px', '0');
			addInputProperty('content_transform_h', 'h', 'px', '0');
			contentX = document.getElementById('content_transform_x');
			contentY = document.getElementById('content_transform_y');
			contentW = document.getElementById('content_transform_w');
			contentH = document.getElementById('content_transform_h');
			contentX.onchange = rectChangeFunc;
			contentY.onchange = rectChangeFunc;
			contentW.onchange = rectChangeFunc;
			contentH.onchange = rectChangeFunc;
			downloadButton.style.display = "none";
			
		} else if (type === "whole_window") {
			idlabel.innerHTML = "Virtual Display Setting";
			idtext.innerHTML = "";
			addInputProperty('whole_width', 'w', 'px', '1000');
			addInputProperty('whole_height', 'h', 'px', '900');
			addInputProperty('whole_split_x', 'split x', '', '1');
			addInputProperty('whole_split_y', 'split y', '', '1');
			wholeW = document.getElementById('whole_width');
			wholeH = document.getElementById('whole_height');
			wholeSplitX = document.getElementById('whole_split_x');
			wholeSplitY = document.getElementById('whole_split_y');
			wholeW.onchange = function () {
				gui.on_display_value_changed();
			};
			wholeH.onchange = function () {
				gui.on_display_value_changed();
			};
			wholeSplitX.onchange = function () {
				gui.on_change_whole_split(this.value, wholeSplitY.value);
			};
			wholeSplitY.onchange = function () {
				gui.on_change_whole_split(wholeSplitX.value, this.value);
			};
			downloadButton.style.display = "none";
		} else { // content (text, image, url... )
			idlabel.innerHTML = "Content ID:";
			addInputProperty('content_transform_x', 'x', 'px', '0');
			addInputProperty('content_transform_y', 'y', 'px', '0');
			addInputProperty('content_transform_w', 'w', 'px', '0');
			addInputProperty('content_transform_h', 'h', 'px', '0');
			addInputProperty('content_transform_z', 'z', 'index', '0');
			contentX = document.getElementById('content_transform_x');
			contentY = document.getElementById('content_transform_y');
			contentW = document.getElementById('content_transform_w');
			contentH = document.getElementById('content_transform_h');
			contentZ = document.getElementById('content_transform_z');
			contentX.onchange = rectChangeFunc;
			contentY.onchange = rectChangeFunc;
			contentW.onchange = rectChangeFunc;
			contentH.onchange = rectChangeFunc;
			contentZ.onchange = function () {
				var val = parseInt(contentZ.value, 10);
				gui.on_change_zindex(val);
			};
			downloadButton.style.display = "block";
			downloadButton.href = "download?" + id;
			downloadButton.target = "_blank";
			if (type === "text") {
				downloadButton.download = id + ".txt";
			} else {
				// image or url
				if (mime) {
					extension = mime.split('/')[1];
					downloadButton.download = id + "." + extension;
				} else {
					downloadButton.download = id + ".img";
				}
			}
		}
	}
	
	/**
	 * Propertyエリアパラメータ消去
	 * @method clearProperty
	 */
	function clearProperty() {
		var transx = document.getElementById('content_transform_x'),
			transy = document.getElementById('content_transform_y'),
			transw = document.getElementById('content_transform_w'),
			transh = document.getElementById('content_transform_h'),
			transz = document.getElementById('content_transform_z'),
			dlbtn  = document.getElementById('download_button'),
			content_id = document.getElementById('content_id');
		if (transx) { transx.value = 0; }
		if (transy) { transy.value = 0; }
		if (transw) { transw.value = 0; }
		if (transh) { transh.value = 0; }
		if (transz) { transz.value = 0; }
		if (content_id) { content_id.innerHTML = ""; }
		if (dlbtn) { dlbtn.style.display = 'none'; }
	}

	/**
	 * Deleteボタン有効化設定
	 * @method enableDeleteButton
	 * @param {bool} isEnable ボタン有効化
	 */
	function enableDeleteButton(isEnable) {
		if (isEnable) {
			document.getElementById('content_delete_button').className = "btn btn-danger";
		} else {
			document.getElementById('content_delete_button').className = "btn btn-danger disabled";
		}
	}
	
	/**
	 * DisplayDeleteボタン有効化設定
	 * @method enableDisplayDeleteButton
	 * @param {bool} isEnable ボタン有効化
	 */
	function enableDisplayDeleteButton(isEnable) {
		if (isEnable) {
			document.getElementById('display_delete_button').className = "btn btn-primary";
		} else {
			document.getElementById('display_delete_button').className = "btn btn-primary disabled";
		}
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
	 * 選択されているVirtualDisplayをPropertyエリアのパラメータに設定
	 * @method assignVirtualDisplayProperty
	 */
	function assignVirtualDisplayProperty(whole, splitCount) {
		var wholeWidth = document.getElementById('whole_width'),
			wholeHeight = document.getElementById('whole_height'),
			wholeSplitX = document.getElementById('whole_split_x'),
			wholeSplitY = document.getElementById('whole_split_y');

		if (wholeWidth) {
			wholeWidth.value = parseInt(whole.orgW, 10);
		}
		if (wholeHeight) {
			wholeHeight.value = parseInt(whole.orgH, 10);
		}
		if (wholeSplitX) {
			wholeSplitX.value = splitCount.x;
		}
		if (wholeSplitY) {
			wholeSplitY.value = splitCount.y;
		}
	}
	
	/**
	 * Viewスケール設定
	 * @method assignViewSetting
	 */
	function assignViewSetting(wholeScale, isFreeMode, isDisplayMode) {
		var scale_current = document.getElementById('scale_dropdown_current'),
			snap_current = document.getElementById('snap_dropdown_current');
		
		scale_current.innerHTML = wholeScale;
		if (isFreeMode) {
			snap_current.innerHTML = 'Free';
		} else if (isDisplayMode) {
			snap_current.innerHTML = 'Display';
		} else {
			// grid
			snap_current.innerHTML = 'Grid';
		}
	}
	
	/**
	 * メタデータをPropertyエリアに反映
	 * @method assignContentProperty
	 * @param {JSON} metaData メタデータ
	 */
	function assignContentProperty(metaData) {
		console.log("assignContentProperty:" + JSON.stringify(metaData));
		var transx = document.getElementById('content_transform_x'),
			transy = document.getElementById('content_transform_y'),
			transw = document.getElementById('content_transform_w'),
			transh = document.getElementById('content_transform_h'),
			transz = document.getElementById('content_transform_z');
		
		transx.value = parseInt(metaData.posx, 10);
		transy.value = parseInt(metaData.posy, 10);
		transw.value = parseInt(metaData.width, 10);
		transh.value = parseInt(metaData.height, 10);
		if (metaData.hasOwnProperty('zIndex')) {
			transz.value = parseInt(metaData.zIndex, 10);
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
	 * 初期化
	 * @method init
	 */
	function init() {
		var contentstab = window.animtab.create('left', {
				'leftTab' : { min : '0px', max : 'auto' }
			}, {
				'leftArea' : { min : '0px', max : '250px' }
			}, 'Contents'),
			/*bottomfunc = window.animtab.create('bottom',
				{ 'bottomTab' : { min : '0px', max : 'auto' }},
				{ 'bottomArea' : { min : '0px', max : '400px' }}, 'AddContent'),*/
			bottomfunc = function (show) {
				if (show) {
					$show($('overall_block'));
					$show($('bottomArea'));
					$show($('bottomTab'));
				} else {
					$hide($('overall_block'));
					$hide($('bottomArea'));
					$hide($('bottomTab'));
				}
			},
			rightfunc = window.animtab.create('right',
				{ 'rightTab' : { min : '0px', max : 'auto' }},
				{ 'rightArea' : { min : '0px', max : '250px' }}, 'Property');
		
		bottomfunc(false);
		
		initPropertyArea(wholeWindowListID, "whole_window");
		initLeftArea(bottomfunc);
		initAddContentArea(bottomfunc);
		initViewSettingArea(rightfunc);
		
		document.getElementById('content_preview_area').addEventListener("mousedown", function (evt) {
			gui.on_mousedown_content_preview_area();
		});

		document.getElementById('display_preview_area').addEventListener("mousedown", function (evt) {
			gui.on_mousedown_display_preview_area();
		});
		
		document.getElementById('content_area').addEventListener("mousedown", function (evt) {
			gui.on_mousedown_content_area();
		});
		document.getElementById('overall_block').addEventListener('click', function (evt) {
			bottomfunc(false);
		});
		
		// for ie, safari
		document.getElementById('dropdown_item1').addEventListener('mousedown', function (evt) {
			document.getElementById('dropdown_item1').click();
			document.getElementById('dropdown1').className = "dropdown1";
		});
		// for ie, safari
		document.getElementById('dropdown_item2').addEventListener('mousedown', function (evt) {
			document.getElementById('dropdown_item2').click();
			document.getElementById('dropdown1').className = "dropdown2";
		});
		// for ie, safari
		document.getElementById('dropdown_item3').addEventListener('mousedown', function (evt) {
			document.getElementById('dropdown_item3').click();
			document.getElementById('dropdown1').className = "dropdown3";
		});
	}

	window.controller_gui = gui;
	window.controller_gui.init = init;
	window.controller_gui.init_property_area = initPropertyArea;

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
	window.controller_gui.on_lefttab_changed = null;
	window.controller_gui.on_showidbutton_clicked = null;
	window.controller_gui.on_snapdropdown_clicked = null;
	window.controller_gui.on_virtualdisplaysetting_clicked　= null;
	window.controller_gui.on_display_scale_changed = null;
	window.controller_gui.on_rect_changed = null;
	window.controller_gui.on_display_value_changed = null;
	window.controller_gui.on_change_whole_split = null;
	window.controller_gui.on_change_zindex = null;
	
	// enable設定.
	window.controller_gui.enable_delete_button = enableDeleteButton;
	window.controller_gui.enable_display_delete_button = enableDisplayDeleteButton;
	window.controller_gui.enable_update_image_button = enableUpdateImageButton;
	
	// 更新など
	window.controller_gui.clear_property = clearProperty;
	window.controller_gui.assign_virtual_display_property = assignVirtualDisplayProperty;
	window.controller_gui.assign_view_setting = assignViewSetting;
	window.controller_gui.assign_content_property = assignContentProperty;

	window.controller_gui.update_display_value = function () {
		gui.on_display_value_changed();
	};
	window.controller_gui.update_whole_split = function (x, y, flag) {
		gui.on_change_whole_split(x, y, flag);
	};
	
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
		return document.getElementById('content_area');
	};
	window.controller_gui.get_display_area = function () {
		return document.getElementById('display_area');
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
