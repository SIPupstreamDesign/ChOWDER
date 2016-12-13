
(function () {
	// colorselector insert ui
	var ContentProperty;
	
	ContentProperty = function () {
		EventEmitter.call(this);
		this.colorselector = null;
	};
	ContentProperty.prototype = Object.create(EventEmitter.prototype);

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
	ContentProperty.prototype.initPropertyArea = function (id, group, type, mime) {
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
			rectChangeFunc = function (evt) {
				this.emit(ContentProperty.EVENT_RECT_CHANGED, null, evt.target.id, evt.target.value);
			}.bind(this);
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
			//addTextInputProperty('content_text', "");
			wholeW = document.getElementById('whole_width');
			wholeH = document.getElementById('whole_height');
			wholeSplitX = document.getElementById('whole_split_x');
			wholeSplitY = document.getElementById('whole_split_y');
			wholeW.onchange = function () {
				this.emit(ContentProperty.EVENT_DISPLAY_VALUE_CHANGED, null);
			}.bind(this);
			wholeH.onchange = function () {
				this.emit(ContentProperty.EVENT_DISPLAY_VALUE_CHANGED, null);
			}.bind(this);
			wholeSplitX.onchange = function () {
				this.emit(ContentProperty.EVENT_CHANGE_WHOLE_SPLIT, null, this.value, wholeSplitY.value);
			}.bind(this);
			wholeSplitY.onchange = function () {
				this.emit(ContentProperty.EVENT_CHANGE_WHOLE_SPLIT, null, wholeSplitX.value, this.value);
			}.bind(this);
			downloadButton.style.display = "none";
			metalabel.style.display = "none";
			document.getElementById('color_picker').style.display = "none";
		} else if (type === "multi_display" || type === "multi_content") {
			idlabel.innerHTML = "Content ID:";
			idtext.innerHTML = "";
			grouplabel.innerHTML = "";
			addInputProperty('multi_transform_z', 'z', 'index', '');
			multiZ = document.getElementById('multi_transform_z');
			multiZ.onchange = function () {
				var val = parseInt(multiZ.value, 10);
				this.emit(ContentProperty.EVENT_CHANGE_ZINDEX, null, val);
			}.bind(this);
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
				this.emit(ContentProperty.EVENT_CHANGE_ZINDEX, null, val);
			}.bind(this);
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

	ContentProperty.prototype.submit_text = function (endcallback) {
		var content_text = document.getElementById('content_text');
		if (content_text) {
			this.emit(ContentProperty.EVENT_METAINFO_CHANGED, null, content_text.value, endcallback);
		}
	};

	/**
	 * Propertyエリアパラメータ消去
	 * @method clearProperty
	 */
	ContentProperty.prototype.clear = function (updateText) {
		var content_text = document.getElementById('content_text');
		if (content_text && updateText) {
			this.submit_text(function () {
				this.clear(false);
			}.bind(this));
		}

		var transx = document.getElementById('content_transform_x'),
			transy = document.getElementById('content_transform_y'),
			transw = document.getElementById('content_transform_w'),
			transh = document.getElementById('content_transform_h'),
			transz = document.getElementById('content_transform_z'),
			dlbtn  = document.getElementById('download_button'),
			content_id = document.getElementById('content_id');
		if (transx) { transx.value = 0; transx.disabled = true; }
		if (transy) { transy.value = 0; transy.disabled = true; }
		if (transw) { transw.value = 0; transw.disabled = true; }
		if (transh) { transh.value = 0; transh.disabled = true; }
		if (transz) { transz.value = 0; transz.disabled = true; }
		if (content_id) { content_id.innerHTML = ""; }
		if (dlbtn) { dlbtn.style.display = 'none'; }
		if (content_text) { content_text.value = ""; content_text.disabled = true; }
	};

	ContentProperty.prototype.init = function (id, group, type, mime) {
		if (!this.colorselector) {
			this.colorselector = new ColorSelector(function(colorvalue){
				var colorstr = "rgb(" + colorvalue[0] + "," + colorvalue[1] + "," + colorvalue[2] + ")"; 
				// ディスプレイ枠色変更
				this.emit(ContentProperty.EVENT_DISPLAY_COLOR_CHANGED, null, colorstr);
				console.log(colorvalue);
			}, 234, 120); // 幅、高さ
			var color_picker = document.getElementById('color_picker');
			// ColorSelector を new でインスタンス化後、elementWrapper を参照すると、
			// カラーセレクタの一番外側の DOM を取得できます。
			// インスタンス化の際に渡しているコールバックには配列で 0 〜 255 の
			// レンジの RGB と 0 〜 1 のレンジのアルファが引数で渡されてきます
			color_picker.appendChild(this.colorselector.elementWrapper);
		}

		this.initPropertyArea(id, group, type, mime);
	};

	/**
	 * 選択されているVirtualDisplayをPropertyエリアのパラメータに設定
	 * @method assign_virtual_display
	 */
	ContentProperty.prototype.assign_virtual_display = function (whole, splitCount) {
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
	};
	
	/**
	 * メタデータをPropertyエリアに反映
	 * @method assign_content_property
	 * @param {JSON} metaData メタデータ
	 */
	ContentProperty.prototype.assign_content_property = function (metaData) {
		console.log("assign_content_property:" + JSON.stringify(metaData));
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

		if (metaData.hasOwnProperty('color') && this.colorselector) {
			var col = metaData.color.split('rgb(').join("");
			col = col.split(")").join("");
			col = col.split(",");
			this.colorselector.setColor(col[0], col[1], col[2], 1, true);
		}
	};

	ContentProperty.prototype.update_display_value = function () {
		this.emit(ContentProperty.EVENT_DISPLAY_VALUE_CHANGED, null);
	};
	ContentProperty.prototype.update_whole_split = function (x, y, flag) {
		this.emit(ContentProperty.EVENT_CHANGE_WHOLE_SPLIT, null, x, y, flag);
	};

	ContentProperty.EVENT_CHANGE_ZINDEX = "change_zindex";
	ContentProperty.EVENT_RECT_CHANGED = "rect_changed";
	ContentProperty.EVENT_DISPLAY_VALUE_CHANGED = "display_value_changed";
	ContentProperty.EVENT_DISPLAY_COLOR_CHANGED = "display_color_changed";
	ContentProperty.EVENT_CHANGE_WHOLE_SPLIT = "change_whole_split";
	ContentProperty.EVENT_METAINFO_CHANGED = "metainfo_changed";

	// singleton
	window.content_property = new ContentProperty();
}());
