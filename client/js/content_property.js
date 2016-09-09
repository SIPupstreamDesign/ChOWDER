
(function (gui) {
	// colorselector insert ui
	var colorselector = null;
	
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
 	 * Propertyタブにボタン追加
 	 * @method addButtonProperty
 	 * @param {String} id ボタンID
 	 * @param {String} value ボタンinnerHTML
 	 * @param {Function} func onclick時コールバック
 	 */
 	function addSubmitButton(id, value, is_display, func) {
 		/*
 			<div class="btn btn-success" id="content_add_button">Add</div>
 		*/
 		var user_data_input = document.getElementById('user_data_input'),
 			group = document.createElement('div'),
 			button = document.createElement('div');
 		
 		group.className = "input-group";
		if (is_display) {
 			button.className = "btn btn-primary property_button";
		} else {
			button.className = "btn btn-success property_button";
		}
 		button.innerHTML = value;
 		button.id = id;
 		button.onclick = func;
 		group.appendChild(button);
 		user_data_input.appendChild(group);
 	}

	/**
	 * Propertyタブに入力プロパティを追加する
	 * @method addInputProperty
	 * @param {Object} input element id
	 * @param {String} value 初期入力値
	 */
	function addTextInputProperty(id, value) {
		var user_data_input = document.getElementById('user_data_input'),
			input = document.createElement('textarea');

		input.id = id;
		input.value = value;
		input.className = "user_data_text_input";
		user_data_input.appendChild(input);
	}

	/**
	 * Property表示領域初期化。selectされたtypeに応じて作成されるelementが変更される。
	 * @method initPropertyArea
	 * @param {String} id ContentもしくはDisplay ID
	 * @param {String} type 設定タイプ
	 * @param {String} mime mime
	 */
	function initPropertyArea(id, group, type, mime) {
		var contentX,
			contentY,
			contentW,
			contentH,
			contentZ,
			multiX,
			multiY,
			multiW,
			multiH,
			multiZ,
			wholeW,
			wholeH,
			wholeSplitX,
			wholeSplitY,
			transInput = document.getElementById('transform_input'),
			user_data_input = document.getElementById('user_data_input'),
			idlabel = document.getElementById('content_id_label'),
			grouplabel = document.getElementById('group_name_label'),
			idtext = document.getElementById('content_id'),
			group_name = document.getElementById('group_name'),
			downloadButton = document.getElementById('download_button'),
			metalabel = document.getElementById("meta_info"),
			extension,
			rectChangeFunc = window.content_property.on_rect_changed;
		console.log("initPropertyArea");
		if (id) {
			document.getElementById('content_id').innerHTML = id;
		} else {
			document.getElementById('content_id').innerHTML = "";
		}
		if (group) {
			document.getElementById('group_name').innerHTML = group;
		} else {
			document.getElementById('group_name').innerHTML = "";
		}
		transInput.innerHTML = "";
		user_data_input.innerHTML = "";
		if (type === "display") {
			idlabel.innerHTML = "Display ID:";
			addInputProperty('content_transform_x', 'x', 'px', '0');
			addInputProperty('content_transform_y', 'y', 'px', '0');
			addInputProperty('content_transform_w', 'w', 'px', '0');
			addInputProperty('content_transform_h', 'h', 'px', '0');
			addTextInputProperty('content_text', "");
			addSubmitButton('content_text_submit', "登録", true, function () {
				var text = document.getElementById('content_text');
				if (window.content_property.on_metainfo_changed) {
					window.content_property.on_metainfo_changed(text.value);
				}
			})
			contentX = document.getElementById('content_transform_x');
			contentY = document.getElementById('content_transform_y');
			contentW = document.getElementById('content_transform_w');
			contentH = document.getElementById('content_transform_h');
			contentX.onchange = rectChangeFunc;
			contentY.onchange = rectChangeFunc;
			contentW.onchange = rectChangeFunc;
			contentH.onchange = rectChangeFunc;
			downloadButton.style.display = "none";
			metalabel.style.display = "block";
			document.getElementById('color_picker').style.display = "block";
		} else if (type === "whole_window") {
			idlabel.innerHTML = "Virtual Display Setting";
			idtext.innerHTML = "";
			grouplabel.innerHTML = "";
			addInputProperty('whole_width', 'w', 'px', '1000');
			addInputProperty('whole_height', 'h', 'px', '900');
			addInputProperty('whole_split_x', 'split x', '', '1');
			addInputProperty('whole_split_y', 'split y', '', '1');
			addTextInputProperty('content_text', "");
			addSubmitButton('content_text_submit', "登録", true, function () {
				var text = document.getElementById('content_text');
				if (window.content_property.on_metainfo_changed) {
					window.content_property.on_metainfo_changed(text.value);
				}
			})
			wholeW = document.getElementById('whole_width');
			wholeH = document.getElementById('whole_height');
			wholeSplitX = document.getElementById('whole_split_x');
			wholeSplitY = document.getElementById('whole_split_y');
			wholeW.onchange = function () {
				if (window.content_property.on_display_value_change) {
					window.content_property.on_display_value_changed();
				}
			};
			wholeH.onchange = function () {
				if (window.content_property.on_display_value_changed) {
					window.content_property.on_display_value_changed();
				}
			};
			wholeSplitX.onchange = function () {
				if (window.content_property.on_change_whole_split) {
					window.content_property.on_change_whole_split(this.value, wholeSplitY.value);
				}
			};
			wholeSplitY.onchange = function () {
				if (window.content_property.on_change_whole_split) {
					window.content_property.on_change_whole_split(wholeSplitX.value, this.value);
				}
			};
			downloadButton.style.display = "none";
			metalabel.style.display = "block";
			document.getElementById('color_picker').style.display = "none";
		} else if (type === "multi_display" || type === "multi_content") {
			idlabel.innerHTML = "Content ID:";
			idtext.innerHTML = "";
			grouplabel.innerHTML = "";
			addInputProperty('multi_transform_z', 'z', 'index', '');
			multiZ = document.getElementById('multi_transform_z');
			multiZ.onchange = function () {
				var val = parseInt(multiZ.value, 10);
				if (window.content_property.on_change_zindex) {
					window.content_property.on_change_zindex(val);
				}
			};
			downloadButton.style.display = "none";
			metalabel.style.display = "none";
			document.getElementById('color_picker').style.display = "none";
		} else { // content (text, image, url... )
			idlabel.innerHTML = "Content ID:";
			grouplabel.innerHTML = "Group:";
			addInputProperty('content_transform_x', 'x', 'px', '0');
			addInputProperty('content_transform_y', 'y', 'px', '0');
			addInputProperty('content_transform_w', 'w', 'px', '0');
			addInputProperty('content_transform_h', 'h', 'px', '0');
			addInputProperty('content_transform_z', 'z', 'index', '0');
			addTextInputProperty('content_text', "");
			addSubmitButton('content_text_submit', "登録", false, function () {
				var text = document.getElementById('content_text');
				if (window.content_property.on_metainfo_changed) {
					window.content_property.on_metainfo_changed(text.value);
				}
			})
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
				if (window.content_property.on_change_zindex) {
					window.content_property.on_change_zindex(val);
				}
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
			if (metalabel) {
				metalabel.style.display = "block";
			}
			document.getElementById('color_picker').style.display = "none";
		}
	}

	/**
	 * Propertyエリアパラメータ消去
	 * @method clearProperty
	 */
	function clear() {
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

	function init(id, group, type, mime) {
		if (!colorselector) {
			colorselector = new ColorSelector(function(colorvalue){
				var colorstr = "rgb(" + colorvalue[0] + "," + colorvalue[1] + "," + colorvalue[2] + ")"; 
				// ディスプレイ枠色変更
				if (window.content_property.on_display_color_changed) {
					window.content_property.on_display_color_changed(colorstr);
				}
				console.log(colorvalue);
			}, 234, 120); // 幅、高さ
			var color_picker = document.getElementById('color_picker');
			// ColorSelector を new でインスタンス化後、elementWrapper を参照すると、
			// カラーセレクタの一番外側の DOM を取得できます。
			// インスタンス化の際に渡しているコールバックには配列で 0 〜 255 の
			// レンジの RGB と 0 〜 1 のレンジのアルファが引数で渡されてきます
			color_picker.appendChild(colorselector.elementWrapper);
		}

		initPropertyArea(id, group, type, mime);
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
			transz = document.getElementById('content_transform_z'),
			text = document.getElementById('content_text');
		
		if (transx) {
			transx.value = parseInt(metaData.posx, 10);
		}
		if (transy) {
			transy.value = parseInt(metaData.posy, 10);
		}
		if (transw) {
			transw.value = parseInt(metaData.width, 10);
		}
		if (transh) {
			transh.value = parseInt(metaData.height, 10);
		}
		if (transz && metaData.hasOwnProperty('zIndex')) {
			transz.value = parseInt(metaData.zIndex, 10);
		}

		if (metaData.hasOwnProperty('user_data_text')) {
			var parsed = null;
			try {
				parsed = JSON.parse(metaData.user_data_text);
			} catch (e) {
				console.error(e);
				return;
			}
			if (text && parsed.hasOwnProperty("text")) {
				text.value = parsed.text;
			}
		}

		if (metaData.hasOwnProperty('color') && colorselector) {
			var col = metaData.color.split('rgb(').join("");
			col = col.split(")").join("");
			col = col.split(",");
			colorselector.setColor(col[0], col[1], col[2], 1, true);
		}
	}

	window.content_property = {}
	window.content_property.init = init;
	window.content_property.clear = clear;
	window.content_property.assign_virtual_display = assignVirtualDisplayProperty;
	window.content_property.on_change_zindex = null;
	window.content_property.on_rect_changed = null;
	window.content_property.on_display_value_changed = null;
	window.content_property.on_display_color_changed = null;
	window.content_property.on_change_whole_split = null;
	window.content_property.on_metainfo_changed = null;
	window.content_property.assign_content_property = assignContentProperty;

	window.content_property.update_display_value = function () {
		if (window.content_property.on_display_value_change) {
			window.content_property.on_display_value_change();
		}
	};
	window.content_property.update_whole_split = function (x, y, flag) {
		window.content_property.on_change_whole_split(x, y, flag);
	};
	

}(window.controller_gui));
