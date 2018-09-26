
(function () {
	"use strict";
	// colorselector insert ui
	var ContentProperty;

	ContentProperty = function () {
		EventEmitter.call(this);
		this.colorselector = null;
		this.authority = null;
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
	function addInputProperty(isEditable, id, leftLabel, rightLabel, value, changeCallback) {
		/*
			<div class="input-group">
				<span class="input-group-addon">x</span>
				<input type="text" class="form-control" id="content_transform_x" value="0">
				<span class="input-group-addon">px</span>
			</div>
		*/
		var transform_input = document.getElementById('transform_input'),
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
		input.onchange = changeCallback;
		//input.nodeType = "text";
		input.disabled = !isEditable;

		group.appendChild(leftSpan);
		group.appendChild(input);
		if (rightLabel) {
			group.appendChild(rightSpan);
		}
		transform_input.appendChild(group);
	}

	/**
	 * Propertyタブに入力プロパティを追加する
	 * @method addInputProperty
	 * @param {Object} input element id
	 * @param {String} value 初期入力値
	 */
	function addTextInputProperty(isEditable, id, value) {
		var user_data_input = document.getElementById('user_data_input'),
			input = document.createElement('textarea');

		input.id = id;
		input.value = value;
		input.className = "user_data_text_input";
		user_data_input.appendChild(input);
		input.disabled = !isEditable;
	}


	/**
	 * Propertyタブに入力プロパティを追加する
	 * @method addInputProperty
	 * @param {Object} input element id
	 * @param {String} value 初期入力値
	 */
	function addVideoTextLabel(id, txt) {
		var video_input = document.getElementById('video_input'),
			text = document.createElement('p');

		text.id = id;
		text.innerText = txt;
		text.className = "property_text_label";
		video_input.appendChild(text);
	}

	/**
	 * Propertyタブに入力プロパティを追加する
	 * @method addInputProperty
	 * @param {Object} input element id
	 * @param {String} value 初期入力値
	 */
	function addVideoQualityTextProperty(isEditable, id, value) {
		var video_input = document.getElementById('video_input'),
			input = document.createElement('textarea');

		input.id = id;
		input.value = value;
		input.className = "user_data_text_input";
		video_input.appendChild(input);
		input.disabled = !isEditable;
	}

	/**
	 * Propertyタブに選択力プロパティを追加する
	 * @method addInputProperty
	 * @param {Object} input element id
	 * @param {String} items 初期入力値 items { keys : [...] , values : [....] }
	 */
	function addVideoSelectProperty(isEditable, id, items, value, changeCallback) {
		var video_input = document.getElementById('video_input'),
			select = document.createElement('select'),
			i,
			key,
			val,
			option;

		select.id = id;
		select.className = "video_select_input";
		select.onchange = function () {
			changeCallback(select.value);
		};
		for (i = 0; i < items.keys.length; ++i) {
			key = items.keys[i];
			val = items.values[i];
			option = document.createElement('option');
			option.value = val;
			option.innerText = key;
			select.appendChild(option);
			if (i === 0) {
				select.value = val;
			}
		}
		if (value !== undefined && value && value !== "false") {
			if (items.values.indexOf(value) >= 0) {
				select.value = value;
			}
		}
		video_input.appendChild(select);
		select.disabled = !isEditable;
	}
	
	/**
	 * Propertyタブに入力プロパティを追加する
	 * @method addInputProperty
	 * @param {Object} input element id
	 * @param {String} leftLabel 左ラベル
	 * @param {String} rightLabel 右ラベル
	 * @param {String} value 初期入力値
	 */
	function addVideoQualityProperty(isEditable, containerClassName, id, leftLabel, rightLabel, value, changeCallback) {
		var video_input = document.getElementById('video_input'),
			container = document.createElement('div'),
			group = document.createElement('div'),
			leftSpan = document.createElement('span'),
			rightSpan = document.createElement('span'),
			input = document.createElement('input');

		group.className = "input-group";
		leftSpan.className = "input-group-addon";
		leftSpan.innerHTML = leftLabel;
		rightSpan.className = "input-group-addon";
		rightSpan.innerHTML = rightLabel;
		//input.className = "form-control";
		input.style.width = "100%"
		input.style.height = "28px";
		input.style.textAlign = "center";
		input.id = id;
		input.value = value;
		input.onchange = changeCallback;
		input.setAttribute("type", "number");
		input.disabled = !isEditable;

		group.appendChild(leftSpan);
		group.appendChild(input);
		if (rightLabel) {
			group.appendChild(rightSpan);
		}
		container.className = containerClassName
		container.appendChild(group);
		container.style.display = "none"
		video_input.appendChild(container);
	}

	/**
	 * Property表示領域初期化。selectされたtypeに応じて作成されるelementが変更される。
	 * @method initPropertyArea
	 * @param {String} metaData metaData
	 * @param {String} group group名
	 * @param {String} type PropertyType
	 * @param {Boolean} isOwnVideo 動画を所有しているかどうか(optional)
	 */
	ContentProperty.prototype.initPropertyArea = function (metaData, groupName, type, isOwnVideo) {
		var transform_input = document.getElementById('transform_input'),
			user_data_input = document.getElementById('user_data_input'),
			video_info = document.getElementById('video_info'),
			video_input = document.getElementById('video_input'),
			idlabel = document.getElementById('content_id_label'),
			grouplabel = document.getElementById('group_name_label'),
			idtext = document.getElementById('content_id'),
			group_name = document.getElementById('group_name'),
			download_button = document.getElementById('download_button'),
			metalabel = document.getElementById("meta_info"),
			backup_area = document.getElementById("backup_area"),
			content_id = document.getElementById('content_id'),
			color_picker = document.getElementById('color_picker'),
			restore_button = document.getElementById('backup_restore'),
			history_area = document.getElementById('history_area'),
			history_slider_area = document.getElementById('history_slider_area'),
			extension,
			rectChangeFunc = function (evt) {
				this.emit(ContentProperty.EVENT_RECT_CHANGED, null, evt.target.id, evt.target.value);
			}.bind(this),
			isEditableContent;
		
		if (Validator.isWindowType(metaData)) {
			isEditableContent = this.authority.isDisplayEditable(metaData.group)
		} else {
			isEditableContent = this.authority.isEditable(metaData.group)
		}

		restore_button.disabled = !isEditableContent;
		history_area.disabled = !isEditableContent;
		history_slider_area.disabled = !isEditableContent;

		if (metaData.id) {
			content_id.innerHTML = metaData.id;
		} else {
			content_id.innerHTML = "";
		}
		if (groupName) {
			group_name.innerHTML = groupName;
		} else {
			group_name.innerHTML = "";
		}
		transform_input.innerHTML = "";
		user_data_input.innerHTML = "";
		video_input.innerHTML = "";
		video_info.style.display = "none";

		if (type === Constants.PropertyTypeDisplay) {
			idlabel.innerHTML = "Display ID:";
			addInputProperty(isEditableContent, 'content_transform_x', 'x', 'px', '0', rectChangeFunc);
			addInputProperty(isEditableContent, 'content_transform_y', 'y', 'px', '0', rectChangeFunc);
			addInputProperty(isEditableContent, 'content_transform_w', 'w', 'px', '0', rectChangeFunc);
			addInputProperty(isEditableContent, 'content_transform_h', 'h', 'px', '0', rectChangeFunc);
			addTextInputProperty(isEditableContent, 'content_text', "");
			download_button.style.display = "none";
			metalabel.style.display = "block";
			backup_area.style.display = "none";
			history_area.style.display = "none";
			history_slider_area.style.display = "none";
			color_picker.style.display = isEditableContent ? "block" : "none";
		} else if (Validator.isVirtualDisplayType(metaData)) {
			isEditableContent = this.authority.isDisplayEditable(metaData.group)
			idlabel.innerHTML = "Virtual Display Setting";
			
			idtext.innerHTML = "";
			grouplabel.innerHTML = "";
			addInputProperty(isEditableContent, 'whole_width', 'w', 'px', '1000', function () {
				this.emit(ContentProperty.EVENT_DISPLAY_VALUE_CHANGED, null);
			}.bind(this));
			addInputProperty(isEditableContent, 'whole_height', 'h', 'px', '900', function () {
				this.emit(ContentProperty.EVENT_DISPLAY_VALUE_CHANGED, null);
			}.bind(this));
			addInputProperty(isEditableContent, 'whole_split_x', 'split x', '', '1', function (evt) {
				var wholeSplitY = document.getElementById('whole_split_y');
				this.emit(ContentProperty.EVENT_CHANGE_WHOLE_SPLIT, null, evt.target.value, wholeSplitY.value);
			}.bind(this));
			addInputProperty(isEditableContent, 'whole_split_y', 'split y', '', '1', function (evt) {
				var wholeSplitX = document.getElementById('whole_split_x');
				this.emit(ContentProperty.EVENT_CHANGE_WHOLE_SPLIT, null, wholeSplitX.value, evt.target.value);
			}.bind(this));
			//addTextInputProperty('content_text', "");
			download_button.style.display = "none";
			metalabel.style.display = "none";
			backup_area.style.display = "none";
			history_area.style.display = "none";
			history_slider_area.style.display = "none";
			color_picker.style.display = "none";
		} else if (type === Constants.PropertyTypeMultiDisplay || type === Constants.PropertyTypeMultiContent) {
			idlabel.innerHTML = "Content ID:";
			idtext.innerHTML = "";
			grouplabel.innerHTML = "";
			addInputProperty(isEditableContent, 'multi_transform_z', 'z', 'index', '', function () {
				var multiZ = document.getElementById('multi_transform_z');
				var val = parseInt(multiZ.value, 10);
				this.emit(ContentProperty.EVENT_CHANGE_ZINDEX, null, val);
			}.bind(this));
			download_button.style.display = "none";
			metalabel.style.display = "none";
			backup_area.style.display = "none";
			history_area.style.display = "none";
			history_slider_area.style.display = "none";
			color_picker.style.display = "none";
		} else if (type === Constants.PropertyTypeLayout) {
			idlabel.innerHTML = "Layout ID:";
			download_button.style.display = "none";
			grouplabel.innerHTML = "Group:";
			if (metalabel) {
				metalabel.style.display = "block";
			}
			addTextInputProperty(isEditableContent, 'content_text', "");
			backup_area.style.display = "none";
			history_area.style.display = "none";
			history_slider_area.style.display = "none";
			color_picker.style.display = "none";
		} else { // content (text, image, url... )
			idlabel.innerHTML = "Content ID:";
			grouplabel.innerHTML = "Group:";
			addInputProperty(isEditableContent, 'content_transform_x', 'x', 'px', '0', rectChangeFunc);
			addInputProperty(isEditableContent, 'content_transform_y', 'y', 'px', '0', rectChangeFunc);
			addInputProperty(isEditableContent, 'content_transform_w', 'w', 'px', '0', rectChangeFunc);
			addInputProperty(isEditableContent, 'content_transform_h', 'h', 'px', '0', rectChangeFunc);
			addInputProperty(isEditableContent, 'content_transform_z', 'z', 'index', '0', function () {
				var transz = document.getElementById('content_transform_z');
				var val = parseInt(transz.value, 10);
				this.emit(ContentProperty.EVENT_CHANGE_ZINDEX, null, val);
			}.bind(this));
			addTextInputProperty(isEditableContent, 'content_text', "");
			download_button.style.display = "block";
			download_button.href = "download?" + metaData.id;
			download_button.target = "_blank";
			
			if (type === Constants.PropertyTypePDF) {
				download_button.download = metaData.id + ".pdf";
			} else if (type === Constants.PropertyTypeText) {
				download_button.download = metaData.id + ".txt";
			} else {
				// image or url
				if (metaData.mime) {
					extension = metaData.mime.split('/')[1];
					download_button.download = metaData.id + "." + extension;
				} else {
					download_button.download = metaData.id + ".img";
				}
			}
			if (metalabel) {
				metalabel.style.display = "block";
			}
			if (type !== "" && type !== Constants.PropertTypeContent && metaData.type !== Constants.TypeTileImage) {
				backup_area.style.display = "block";
			}
			if (metaData.type === Constants.TypeTileImage) {
				download_button.style.display = "none";
				history_area.style.display = "block";
				history_slider_area.style.display = "block";
			} else {
				history_area.style.display = "none";
				history_slider_area.style.display = "none";
			}
			color_picker.style.display = "none";

			if (type === Constants.PropertTypeVideo && metaData.subtype) {
				// 動画の場合、差し替え履歴、ダウンロード非表示
				backup_area.style.display = "none";
				history_area.style.display = "none";
				history_slider_area.style.display = "none";
				download_button.style.display = "none";

				// 動画専用プロパティを追加設定
				if (isOwnVideo) {
					// 設定エリアを表示
					video_info.style.display = "block";
					this.initVideoPropertyArea(isEditableContent, metaData, type);
				}
			}
		}
	}

	ContentProperty.prototype.initVideoPropertyArea = function (isEditableContent, metaData, type) {
		navigator.mediaDevices.enumerateDevices()
			.then(function (devices) { // 成功時
				var i;
				var audios = { keys: [], values : [] };
				var videos = { keys: [], values : [] };
				var qualities = { keys: ["自動", "手動"], values : ["auto", "custom"] };
				for (i = 0; i < devices.length; ++i) {
					if (devices[i].kind === "audioinput") {
						audios.keys.push(devices[i].label);
						audios.values.push(devices[i].deviceId);
					}
					if (devices[i].kind === "videoinput") {
						videos.keys.push(devices[i].label);
						videos.values.push(devices[i].deviceId);
					}
				}

				if (metaData.subtype === "camera") {
					addVideoTextLabel('video_select_video_title', i18next.t('video_input'))
					addVideoSelectProperty(isEditableContent, 'video_select_input_video', videos, metaData.video_device, function (deviceID) {
						this.emit(ContentProperty.EVENT_VIDEODEVICE_CHANGED, null, metaData.id, deviceID);
					}.bind(this));
					addVideoTextLabel('video_select_audio_title', i18next.t('audio_input'))
					addVideoSelectProperty(isEditableContent, 'video_select_input_audio', audios, metaData.audio_device, function (deviceID) {
						this.emit(ContentProperty.EVENT_AUDIODEVICE_CHANGED, null, metaData.id, deviceID);
					}.bind(this));
				}
				addVideoTextLabel('video_select_quality_title', i18next.t('video_quality'));
				addVideoSelectProperty(isEditableContent, 'video_select_input_quality', qualities, 50, function (val) {
					this.update_quality_display();
					this.emit(ContentProperty.EVENT_VIDEOQUALITY_CHANGED, null, metaData.id);
				}.bind(this));
				addVideoQualityProperty(isEditableContent, "video_quality", "video_quality_min", "最小bitrate", "kbps", "300", function () {
					this.emit(ContentProperty.EVENT_VIDEOQUALITY_CHANGED, null, metaData.id);
				}.bind(this));
				addVideoQualityProperty(isEditableContent, "video_quality", "video_quality_max", "最大bitrate", "kbps", "1000", function () {
					this.emit(ContentProperty.EVENT_VIDEOQUALITY_CHANGED, null, metaData.id);
				}.bind(this));
				addVideoTextLabel('video_select_quality_title', i18next.t('audio_quality'));
				addVideoSelectProperty(isEditableContent, 'audio_select_input_quality', qualities, 100, function (val) {
					this.update_quality_display();
					this.emit(ContentProperty.EVENT_VIDEOQUALITY_CHANGED, null, metaData.id);
				}.bind(this));
				addVideoQualityProperty(isEditableContent, "audio_quality", "audio_quality_min", "最小bitrate", "kbps", "50", function () {
					this.emit(ContentProperty.EVENT_VIDEOQUALITY_CHANGED, null, metaData.id);
				}.bind(this));
				addVideoQualityProperty(isEditableContent, "audio_quality", "audio_quality_max", "最大bitrate", "kbps", "300", function () {
					this.emit(ContentProperty.EVENT_VIDEOQUALITY_CHANGED, null, metaData.id);
				}.bind(this));

				if (metaData.hasOwnProperty('webrtc_status')) {
					addVideoTextLabel('video_select_quality_title', i18next.t('initial_quality_info'));
					var qtext = "";
					var quality = JSON.parse(metaData.webrtc_status);
					qtext += i18next.t('video_src_width') + ": \n    " + quality.resolution.width + "\n";
					qtext += i18next.t('video_src_height') + ": \n    " + quality.resolution.height + "\n";
					qtext += i18next.t('video_codec') + ": \n    " + quality.video_codec + "\n";
					qtext += i18next.t('audio_codec') + ": \n    " + quality.audio_codec + "\n";
					qtext += i18next.t('vailable_send_band_width') + ": \n    " + Math.round(quality.bandwidth.availableSendBandwidth / 100) + "kbps\n";
					qtext += i18next.t('target_enc_bitrate') + ": \n    " + Math.round(quality.bandwidth.targetEncBitrate / 100) + "kbps\n";
					qtext += i18next.t('actual_enc_bitrate') + ": \n    " + Math.round(quality.bandwidth.actualEncBitrate / 100) + "kbps\n";
					qtext += i18next.t('transmit_bitrate') + ": \n    " + Math.round(quality.bandwidth.transmitBitrate / 100) + "kbps\n";
					addVideoQualityTextProperty(false, "video_quality_text", qtext);
				}

				// ビデオ品質
				if (metaData.hasOwnProperty('quality')) {
					try {
						var quality = JSON.parse(metaData.quality);
						this.set_quality(quality);
					} catch(e) {
						console.error(e);
					}
				}
			}.bind(this)).catch(function (err) { // エラー発生時
				console.error('enumerateDevide ERROR:', err);
			});
	}

	ContentProperty.prototype.submit_text = function (endcallback) {
		var content_text = document.getElementById('content_text');
		if (content_text && !content_text.disabled) {
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
			dlbtn = document.getElementById('download_button'),
			content_id = document.getElementById('content_id'),
			backup_area = document.getElementById("backup_area"),
			history_area = document.getElementById("history_area"),
			history_slider_area = document.getElementById("history_slider_area");

		if (transx) { transx.value = 0; transx.disabled = true; }
		if (transy) { transy.value = 0; transy.disabled = true; }
		if (transw) { transw.value = 0; transw.disabled = true; }
		if (transh) { transh.value = 0; transh.disabled = true; }
		if (transz) { transz.value = 0; transz.disabled = true; }
		if (content_id) { content_id.innerHTML = ""; }
		if (dlbtn) { dlbtn.style.display = 'none'; }
		if (content_text) { content_text.value = ""; content_text.disabled = true; }
		if (backup_area) { backup_area.style.display = "none" }
		if (history_area) { history_area.style.display = "none" }
		if (history_slider_area) { history_slider_area.style.display = "none" }
	};

	ContentProperty.prototype.init = function (metaData, groupName, type, isOwnVideo) {
		if (!this.colorselector) {
			this.colorselector = new ColorSelector(function (colorvalue) {
				var colorstr = "rgb(" + colorvalue[0] + "," + colorvalue[1] + "," + colorvalue[2] + ")";
				// ディスプレイ枠色変更
				this.emit(ContentProperty.EVENT_DISPLAY_COLOR_CHANGED, null, colorstr);
				console.log(colorvalue);
			}.bind(this), 234, 120); // 幅、高さ
			var color_picker = document.getElementById('color_picker');
			// ColorSelector を new でインスタンス化後、elementWrapper を参照すると、
			// カラーセレクタの一番外側の DOM を取得できます。
			// インスタンス化の際に渡しているコールバックには配列で 0 〜 255 の
			// レンジの RGB と 0 〜 1 のレンジのアルファが引数で渡されてきます
			color_picker.appendChild(this.colorselector.elementWrapper);
		}

		// 復元ボタン
		var restore_button = document.getElementById('backup_restore');
		restore_button.onclick = function () {
			var index = document.getElementById('backup_list_content').selectedIndex;
			if (index >= 0) {
				this.emit(ContentProperty.EVENT_RESTORE_CONTENT, null, index);
			}
		}.bind(this);

		this.initPropertyArea(metaData, groupName, type, isOwnVideo);
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

	ContentProperty.prototype.setAuthority = function (authority) {
		this.authority = authority;
	};

	/**
	 * メタデータをPropertyエリアに反映
	 * @method assign_content_property
	 * @param {JSON} metaData メタデータ
	 */
	ContentProperty.prototype.assign_content_property = function (metaData) {
		//console.log("assign_content_property:" + JSON.stringify(metaData));
		var transx = document.getElementById('content_transform_x'),
			transy = document.getElementById('content_transform_y'),
			transw = document.getElementById('content_transform_w'),
			transh = document.getElementById('content_transform_h'),
			transz = document.getElementById('content_transform_z'),
			text = document.getElementById('content_text'),
			i,
			option;

		// x, y, w, h, z
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

		// メタ情報
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

		// 色変更
		if (metaData.hasOwnProperty('color') && this.colorselector) {
			var col = metaData.color.split('rgb(').join("");
			col = col.split(")").join("");
			col = col.split(",");
			this.colorselector.setColor(col[0], col[1], col[2], 1, true);
		}

		// 差し替え履歴
		if (!Validator.isWindowType(metaData) && metaData.type !== Constants.TypeTileImage) {
			var backup_list = document.getElementById('backup_list');
			var restoreIndex = 0;
			backup_list.innerHTML = "";
			document.getElementById('backup_restore').disabled = true;
			if (metaData.hasOwnProperty('backup_list') && metaData.backup_list.length > 0) {
				if (this.authority.isEditable(metaData.group)) {
					document.getElementById('backup_restore').disabled = false;
				}
				var backups = JSON.parse(metaData.backup_list);
				var select = document.createElement('select');
				var restore_index = 0;
				select.className = "backup_list_content";
				select.id = "backup_list_content";
				select.size = 5;

				// 現在表示中のコンテンツのインデックス
				if (metaData.hasOwnProperty("restore_index")) {
					restoreIndex = Number(metaData.restore_index);
					if (restoreIndex < 0) {
						restoreIndex = 0;
					}
				}

				for (i = 0; i < backups.length; i = i + 1) {
					option = document.createElement('option');
					text = new Date(backups[i]).toLocaleString();
					option.value = text;
					if (i === restoreIndex) {
						option.innerHTML = "●" + text;
					} else {
						option.innerHTML = text;
					}
					select.appendChild(option);
				}
				select.value = backups[0]
				backup_list.appendChild(select);
			}
		}

		// 時系列データ（仮）
		this.update_history_area(metaData);

		// ビデオ品質
		if (metaData.hasOwnProperty('quality')) {
			try {
				var quality = JSON.parse(metaData.quality);
				this.set_quality(quality);
			} catch(e) {
				console.error(e);
			}
		}
	};

	function sortHistory(values) {
		try {
			values.sort(function (a, b) {
				return b < a;
			});
		} catch (e) {

		}
		return values;
	}

	ContentProperty.prototype.update_history_area = function (metaData, keyName) {
		var i,
			option,
			text;
			
		if (!Validator.isWindowType(metaData) && metaData.type === Constants.TypeTileImage) {
			var history_area = document.getElementById('history_area');
			var history_list = document.getElementById('history_list');
			var history_select  = document.getElementById('history_select');
			var history_up = document.getElementById('history_up');
			var history_down  = document.getElementById('history_down');
			var history_sync_button = document.getElementById('history_sync_button');

			var history_slider_area = document.getElementById('history_slider_area');
			var history_slider = document.getElementById('history_slider');
			var history_slider_label = document.getElementById('history_slider_label');
			var history_slider_memori = document.getElementById('history_slider_memori');

			var sliderRect = history_slider.getBoundingClientRect();
			var kv;

			// 中身の登録
			history_list.innerHTML = "";
			history_select.innerHTML = "";
			history_slider_memori.innerHTML = "";
			history_area.disabled = true;
			history_slider_area.disabled = true;
			if (metaData.hasOwnProperty('history_data')) {
				if (this.authority.isEditable(metaData.group)) {
					history_area.disabled = false;
					history_slider_area.disabled = false;
				}
				var history_data;
				try {
					history_data = JSON.parse(metaData.history_data);
				} catch(e) {
				}
				// キーの切り替えボックスの中身を入れる
				for (var key in history_data) {
					var keyTitle = document.createElement('option');
					keyTitle.value = key;
					keyTitle.innerText = key;
					history_select.appendChild(keyTitle);
				}
				// 現在表示中のキー
				if (keyName) {
					history_select.value = keyName;
				} else if (metaData.hasOwnProperty('restore_key')) {
					history_select.value = metaData.restore_key;
				} else {
					history_select.value = Object.keys(history_data)[0];
				}

				var values = history_data[history_select.value];
				try {
					values = sortHistory(values);
				} catch(e) {

				}
				var select = document.createElement('select');

				select.className = "history_list_content";
				select.id = "history_list_content";
				select.size = 5;
				select.restore_key = key;

				history_slider.max = values.length - 1;

				var selectedIndex = 0;
				var memoriSpan = 100 / (values.length - 1) * (sliderRect.right-sliderRect.left) / document.body.clientWidth;
				for (i = 0; i < values.length; i = i + 1) {
					option = document.createElement('option');
					text = values[i];
					option.value = text;
					// 現在表示中のコンテンツかどうか
					try {
						kv = JSON.parse(metaData.keyvalue);
					} catch(e) {
						console.error("tileimage history key parse error")
					}
					if (kv && String(kv[history_select.value]) === text) {
						option.innerHTML = "●" + text;
						selectedIndex = i;
						history_slider.value = i;
						history_slider_label.innerText = text;
					} else {
						option.innerHTML = text;
					}
					select.appendChild(option);
					
					var sliderMemori = document.createElement('div');
					sliderMemori.title = text;
					sliderMemori.style.position = "absolute";
					sliderMemori.style.marginLeft = sliderRect.left /  document.body.clientWidth * 100  + "%"
					sliderMemori.style.left = memoriSpan * i + "%";
					sliderMemori.style.top = "30px";
					sliderMemori.style.width = "4px";
					sliderMemori.style.height = "30px";
					sliderMemori.style.borderRadius = "4px"
					sliderMemori.style.backgroundColor = "lightgray"
					sliderMemori.style.zIndex = -1;
					history_slider_memori.appendChild(sliderMemori);
				}
				select.value = values[0];
				history_list.appendChild(select);
				select.selectedIndex = selectedIndex;
				
				// キーの切り替えイベントの登録
				history_select.onchange = function (evt) {
					var historyContent = document.getElementById('history_list_content');
					var key = history_select.options[history_select.selectedIndex].value;
					this.update_history_area(metaData, key);
				}.bind(this);

				// データ切り替えイベントの登録
				select.onchange = function (evt) {
					var historyContent = document.getElementById('history_list_content');
					var key = history_select.value;
					var value = historyContent.value;
					this.emit(ContentProperty.EVENT_RESTORE_HISTORY_CONTENT, null, key, value);
				}.bind(this);
				
				history_up.onclick = function () {
					var index = select.selectedIndex - 1;
					if (index >= 0) {
						select.selectedIndex = index;
						select.onchange();
					}
				};
				history_down.onclick = function () {
					var index = select.selectedIndex + 1;
					if (index < select.options.length) {
						select.selectedIndex = index;
						select.onchange();
					}
				};
				history_sync_button.classList.remove('history_sync_on');
				if (metaData.hasOwnProperty('history_sync')) {
					if (String(metaData.history_sync) === "true") {
						history_sync_button.classList.add('history_sync_on');
					}
				}
				history_sync_button.onclick = function () {
					if (history_sync_button.classList.contains('history_sync_on')) {
						history_sync_button.classList.remove('history_sync_on');
						this.emit(ContentProperty.EVENT_SYNC_CONTENT, null, false);
					} else {
						history_sync_button.classList.add('history_sync_on');
						this.emit(ContentProperty.EVENT_SYNC_CONTENT, null, true);
					}
				}.bind(this);

				history_slider.onchange = function () {
					var historyContent = document.getElementById('history_list_content');
					var key = history_select.value;
					var value = historyContent.options[Number(history_slider.value)].value;
					this.emit(ContentProperty.EVENT_RESTORE_HISTORY_CONTENT, null, key, value);
				}.bind(this);
			}
		}
	};

	ContentProperty.prototype.update_display_value = function () {
		this.emit(ContentProperty.EVENT_DISPLAY_VALUE_CHANGED, null);
	};
	ContentProperty.prototype.update_whole_split = function (x, y, flag) {
		this.emit(ContentProperty.EVENT_CHANGE_WHOLE_SPLIT, null, x, y, flag);
	};

	ContentProperty.prototype.get_video_device_id = function () {
		var elem = document.getElementById('video_select_input_video');
		if (elem) {
			return elem.options[elem.selectedIndex].value;
		}
		return null;
	};

	ContentProperty.prototype.get_audio_device_id = function () {
		var elem = document.getElementById('video_select_input_audio');
		if (elem) {
			return elem.options[elem.selectedIndex].value;
		}
		return null;
	};
	
	ContentProperty.prototype.is_video_quality_enable = function () {
		var elem = document.getElementById('video_select_input_quality');
		if (elem) {
			return elem.options[elem.selectedIndex].value === "custom";
		}
		return false;
	};

	ContentProperty.prototype.is_audio_quality_enable = function () {
		var elem = document.getElementById('audio_select_input_quality');
		if (elem) {
			return elem.options[elem.selectedIndex].value === "custom";
		}
		return false;
	};

	// ビデオオーディオ品質の有効状態の変更による表示切り替え
	ContentProperty.prototype.update_quality_display = function () {
		var elem;
		var elems;
		elem = document.getElementById('video_select_input_quality');
		if (elem) {
			elems = document.getElementsByClassName('video_quality');
			for (var i = 0; i < elems.length; ++i) {
				elems[i].style.display = (elem.value === "auto") ? "none" : "block";
			}
		}
		elem = document.getElementById('audio_select_input_quality');
		if (elem) {
			elems = document.getElementsByClassName('audio_quality');
			for (var i = 0; i < elems.length; ++i) {
				elems[i].style.display = (elem.value === "auto") ? "none" : "block";
			}	
		}
	}

	ContentProperty.prototype.get_video_quality = function () {
		var elems = document.getElementsByClassName('video_quality');
		if (elems.length > 0) {
			return {
				min : Number(document.getElementById('video_quality_min').value),
				max : Number(document.getElementById('video_quality_max').value)
			}
		}
		return null;
	};
	
	ContentProperty.prototype.get_audio_quality = function () {
		var elems = document.getElementsByClassName('audio_quality');
		if (elems.length > 0) {
			return {
				min : Number(document.getElementById('audio_quality_min').value),
				max : Number(document.getElementById('audio_quality_max').value)
			}
		}
		return null;
	};

	ContentProperty.prototype.set_quality = function (quality) {
		//console.error("set_quality", quality)
		var elem;
		/*
		screen : content_property.get_video_quality(metadataID).min,
		video : content_property.get_video_quality(metadataID).min,
		audio : content_property.get_audio_quality(metadataID).min,
		video_max : content_property.get_video_quality(metadataID).max,
		audio_max : content_property.get_audio_quality(metadataID).max
		*/
		elem = document.getElementById('video_select_input_quality');
		if (elem) {
			if (quality.hasOwnProperty('video_quality_enable') && String(quality.video_quality_enable) !== "false") {
				elem.value = "custom";
			} else {
				elem.value = "auto";
			}
		}
		elem = document.getElementById('audio_select_input_quality');
		if (elem) {
			if (quality.hasOwnProperty('audio_quality_enable') && String(quality.audio_quality_enable) !== "false") {
				elem.value = "custom";
			} else {
				elem.value = "auto";
			}
		}
		if (quality.hasOwnProperty('video')) {
			var vmin = document.getElementById('video_quality_min');
			if (vmin) { vmin.value = Number(quality.video); }
		}
		if (quality.hasOwnProperty('video_max')) {
			var vmax = document.getElementById('video_quality_max');
			if (vmax) { vmax.value = Number(quality.video_max); }
		}
		if (quality.hasOwnProperty('audio')) {
			var amin = document.getElementById('audio_quality_min');
			if (amin) { amin.value = Number(quality.audio); }
		}
		if (quality.hasOwnProperty('audio_max')) {
			var amax = document.getElementById('audio_quality_max');
			if (amax) { amax.value = Number(quality.audio_max); }
		}
		this.update_quality_display();
	}

	ContentProperty.EVENT_CHANGE_ZINDEX = "change_zindex";
	ContentProperty.EVENT_RECT_CHANGED = "rect_changed";
	ContentProperty.EVENT_VIDEODEVICE_CHANGED = "videodevice_changed";
	ContentProperty.EVENT_AUDIODEVICE_CHANGED = "audiodevice_changed";
	ContentProperty.EVENT_VIDEOQUALITY_CHANGED = "videoquality_changed";
	ContentProperty.EVENT_DISPLAY_VALUE_CHANGED = "display_value_changed";
	ContentProperty.EVENT_DISPLAY_COLOR_CHANGED = "display_color_changed";
	ContentProperty.EVENT_CHANGE_WHOLE_SPLIT = "change_whole_split";
	ContentProperty.EVENT_METAINFO_CHANGED = "metainfo_changed";
	ContentProperty.EVENT_RESTORE_CONTENT = "restore_content";
	ContentProperty.EVENT_RESTORE_HISTORY_CONTENT = "restore_history_content";
	ContentProperty.EVENT_SYNC_CONTENT = "sync_content";

	// singleton
	window.content_property = new ContentProperty();
}());
