
/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../../common/constants.js';
import Validator from '../../common/validator.js';
import ColorSelector from '../../components/colorselector.js';
import Vscreen from '../../common/vscreen'
import Store from '../store/store'
import InputDialog from '../../components/input_dialog';
import ContentUtil from '../content_util';
import Input from '../../components/input';

"use strict";

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
	let transform_input = document.getElementById('transform_input');
	let group = document.createElement('div');
	let leftSpan = document.createElement('span');
	let rightSpan = document.createElement('span');
	let input = document.createElement('input');

	group.className = "input-group";
	leftSpan.className = "input-group-addon";
	leftSpan.innerHTML = leftLabel;
	rightSpan.className = "input-group-addon";
	rightSpan.innerHTML = rightLabel;
	input.className = "form-control";
	input.id = id;
	input.value = value;
	//input.nodeType = "text";
	input.disabled = !isEditable;

	group.appendChild(leftSpan);
	group.appendChild(input);
	if (rightLabel) {
		group.appendChild(rightSpan);
	}
	transform_input.appendChild(group);

	input.onchange = changeCallback;
}

/**
 * Propertyタブに入力プロパティを追加する
 * @method addCheckProperty
 * @param {Object} input element id
 * @param {String} leftLabel 左ラベル
 * @param {String} rightLabel 右ラベル
 * @param {String} value 初期入力値
 */
function addCheckProperty(isEditable, className, leftLabel, value, changeCallback) {
	/*
		<div class="input-group">
			<span class="input-group-addon">x</span>
			<input type="text" class="form-control" id="content_transform_x" value="0">
			<span class="input-group-addon">px</span>
		</div>
	*/
	let transform_input = document.getElementById('transform_input');
	let group = document.createElement('div');
	let leftSpan = document.createElement('span');
	leftSpan.className = "input-group-addon content_property_checkbox_label";
	let centerSpan = document.createElement('span');
	let input = new Input("checkbox");
	group.className = "input-group";
	leftSpan.innerHTML = leftLabel;
	centerSpan.className = "input-group-addon content_property_checkbox_wrap"
	input.setValue(value);
	input.getDOM().disabled = !isEditable;
	input.getDOM().className = "content_property_checkbox " + className

	centerSpan.appendChild(input.getDOM());
	group.appendChild(leftSpan);
	group.appendChild(centerSpan);
	transform_input.appendChild(group);

	input.getDOM().onchange = changeCallback;
}

/**
 * Propertyタブに入力プロパティを追加する
 * @method addTextInputProperty
 * @param {Object} input element id
 * @param {String} value 初期入力値
 */
function addTextInputProperty(isEditable, id, value) {
	let user_data_input = document.getElementById('user_data_input');
	let input = document.createElement('textarea');

	input.id = id;
	input.value = value;
	input.className = "user_data_text_input";
	user_data_input.appendChild(input);
	input.disabled = !isEditable;
}


/**
 * Propertyタブに入力プロパティを追加する
 * @method addVideoTextLabel
 * @param {Object} input element id
 * @param {String} value 初期入力値
 */
function addVideoTextLabel(id, txt) {
	let video_input = document.getElementById('video_input');
	let text = document.createElement('p');

	text.id = id;
	text.innerText = txt;
	text.className = "property_text_label";
	video_input.appendChild(text);
}

/**
 * Propertyタブに入力プロパティを追加する
 * @method addVideoQualityTextProperty
 * @param {Object} input element id
 * @param {String} value 初期入力値
 */
function addVideoQualityTextProperty(isEditable, id, value) {
	let video_input = document.getElementById('video_input'),
		input = document.createElement('textarea');

	input.id = id;
	input.value = value;
	input.className = "user_data_text_input";
	video_input.appendChild(input);
	input.disabled = !isEditable;
}

/**
 * Propertyタブに選択力プロパティを追加する
 * @method addVideoSelectProperty
 * @param {Object} input element id
 * @param {String} items 初期入力値 items { keys : [...] , values : [....] }
 */
function addVideoSelectProperty(isEditable, id, items, value, changeCallback) {
	let video_input = document.getElementById('video_input'),
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
 * @method addVideoQualityProperty
 * @param {Object} input element id
 * @param {String} leftLabel 左ラベル
 * @param {String} rightLabel 右ラベル
 * @param {String} value 初期入力値
 */
function addVideoQualityProperty(isEditable, containerClassName, id, leftLabel, rightLabel, value, changeCallback) {
	let video_input = document.getElementById('video_input'),
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

// colorselector insert ui
class ContentPropertyGUI extends EventEmitter {
	constructor(store, action, previewArea) {
		super();

		this.store = store;
		this.action = action;
		this.previewArea = previewArea;

		this.colorselector = null;
		this.authority = this.store.getManagement().getAuthorityObject();

		this.store.on(Store.EVENT_CONTENT_TRANSFORM_CHANGED, (err, data) => {
			document.getElementById('content_transform_w').value = data.width;
			document.getElementById('content_transform_h').value = data.height;
		});

		this.store.on(Store.EVENT_DISPLAY_VISIBLE_CHANGED, (err, metaData) => {
			let displayVisibleCheck = document.getElementsByClassName('display_visible')[0];
			if (displayVisibleCheck) {
				displayVisibleCheck.checked = String(metaData.visible) === "true";
			}
		});

		this.store.on(Store.EVENT_CONTENT_VISIBLE_CHANGED, (err, metaData) => {
			let contentVisibleCheck = document.getElementsByClassName('content_visible')[0];
			if (contentVisibleCheck) {
				let setValue = metaData.visible;
				if (metaData.length > 1) {
					setValue = metaData[metaData.length - 1].visible;
				}
				contentVisibleCheck.checked = String(setValue) === "true";
			}
		})

		this.store.on(Store.EVENT_CONTENT_DISPLAY_TIME_CHANGED, (err, metaData) => {
			let contentDisplayTimeCheck = document.getElementsByClassName('display_time')[0];
			if (contentDisplayTimeCheck) {
				contentDisplayTimeCheck.checked = String(metaData.display_time) === "true";
			}
		})
	}


	setIDLabel(str) {
		let idlabel = document.getElementById('content_id_label');
		if (idlabel) {
			idlabel.innerHTML = str;
		}
	}

	setIDLabel2(str) {
		let idlabel = document.getElementById('controller_id_label');
		if (idlabel) {
			idlabel.innerHTML = str;
		}
	}

	setID(str) {
		let content_id = document.getElementById('content_id');
		if (content_id) {
			content_id.innerHTML = str;
		}
	}

	setID2(str) {
		let content_id = document.getElementById('controller_id');
		if (content_id) {
			content_id.innerHTML = str;
		}
	}

	setGroupLabel(str) {
		let grouplabel = document.getElementById('group_name_label');
		if (grouplabel) {
			grouplabel.innerHTML = str;
		}
	}

	setGroupName(str) {
		let group_name = document.getElementById('group_name');
		if (group_name) {
			group_name.innerHTML = str;
		}
	}

	showVideoInfo(isShow) {
		let video_info = document.getElementById('video_info');
		if (video_info) {
			if (isShow) {
				video_info.style.display = "block";
			} else {
				video_info.style.display = "none";
			}
		}
	}

	showDownloadButton(isShow, url) {
		let download_button = document.getElementById('download_button');
		if (download_button) {
			if (isShow) {
				download_button.style.display = "block";
				download_button.href = url;
				download_button.target = "_blank";
			} else {
				download_button.style.display = "none";
			}
		}
	}

	showMetaLabel(isShow) {
		let metalabel = document.getElementById("meta_info");
		if (metalabel) {
			if (isShow) {
				metalabel.style.display = "block";
			} else {
				metalabel.style.display = "none";
			}
		}
	}

	showBackupArea(isShow) {
		let backup_area = document.getElementById("backup_area");
		if (backup_area) {
			if (isShow) {
				backup_area.style.display = "block";
			} else {
				backup_area.style.display = "none";
			}
		}
	}

	showColorPicker(isShow) {
		let color_picker = document.getElementById('color_picker');
		if (color_picker) {
			if (isShow) {
				color_picker.style.display = "block";
			} else {
				color_picker.style.display = "none";
			}
		}
	}

	showHistoryArea(isShow) {
		let history_area = document.getElementById('history_area');
		let history_slider_area = document.getElementById('history_slider_area');
		if (history_area && history_slider_area) {
			if (isShow) {
				history_area.style.display = "block";
				history_slider_area.style.display = "block";
			} else {
				history_area.style.display = "none";
				history_slider_area.style.display = "none";
			}
		}
	}

	disableHistoryArea(isDisable) {
		let history_area = document.getElementById('history_area');
		let history_slider_area = document.getElementById('history_slider_area');
		history_area.disabled = isDisable;
		history_slider_area.disabled = isDisable;
	}

	showAlignmentArea(isShow) {
		let align_area = document.getElementById("alignment_area");
		if (align_area) {
			if (isShow && (this.authority.isAdmin() || this.store.managementStore.userStatus.groupID == "Moderator" )) {
				align_area.style.display = "block";
			} else {
				align_area.style.display = "none";
			}
		}
	}

	disableRestoreButton(isDisable) {
		let restore_button = document.getElementById('backup_restore');
		restore_button.disabled = isDisable;
	}

	isEditableContent(metaData) {
		if (Validator.isWindowType(metaData)) {
			return this.authority.isDisplayEditable(metaData.group);
		} else if (Validator.isVirtualDisplayType(metaData)) {
			return this.authority.isDisplayEditable(metaData.group);
		} else {
			return this.authority.isEditable(metaData.group);
		}
	}

	isAlwaysOnTop(zIndex) {
		return (Number(zIndex) === Constants.ZIndexAlwaysOnTopValue)
			|| (String(zIndex) === Constants.ZIndexAlwaysOnTopString);
	}

	/**
	 * Property表示領域初期化。selectされたtypeに応じて作成されるelementが変更される。
	 * @method initPropertyArea
	 * @param {String} metaData metaData
	 * @param {String} group group名
	 * @param {String} type PropertyType
	 * @param {Boolean} isOwnVideo 動画を所有しているかどうか(optional)
	 */
	initPropertyArea(metaData, groupName, type, isOwnVideo) {
		let rectChangeFunc = (evt) => {
			this.action.changeContentTransform(this.getContentTransform());
		};

		const isEditable = this.isEditableContent(metaData);
		this.disableRestoreButton(!isEditable);
		this.disableHistoryArea(!isEditable);
		this.setID(metaData.id ? metaData.id : "");
		this.setID2(metaData.creator ? metaData.creator : "");
		this.setGroupName(groupName ? groupName : "");

		{
			let transform_input = document.getElementById('transform_input');
			let user_data_input = document.getElementById('user_data_input');
			let video_input = document.getElementById('video_input');
			transform_input.innerHTML = "";
			user_data_input.innerHTML = "";
			video_input.innerHTML = "";
		}

		this.showVideoInfo(false);
		if (type === Constants.PropertyTypeDisplay) {
			this.setIDLabel("Display ID:");
			addCheckProperty(isEditable, 'display_visible', 'visible', String(metaData.visible) === "true", () => {
				let meta = this.store.getMetaData(metaData.id);
				meta.visible = document.getElementsByClassName('display_visible')[0].checked;
				this.action.changeDisplayVisible(meta);
			});
			this.setIDLabel2("");
			addInputProperty(isEditable, 'content_transform_x', 'x', 'px', '0', rectChangeFunc);
			addInputProperty(isEditable, 'content_transform_y', 'y', 'px', '0', rectChangeFunc);
			addInputProperty(isEditable, 'content_transform_w', 'w', 'px', '0', rectChangeFunc);
			addInputProperty(isEditable, 'content_transform_h', 'h', 'px', '0', rectChangeFunc);
			addTextInputProperty(isEditable, 'content_text', "");
			this.showDownloadButton(false);
			this.showMetaLabel(true);
			this.showBackupArea(false);
			this.showHistoryArea(false);
			this.showColorPicker(isEditable);
			this.showAlignmentArea(false);
		}
		else if (Validator.isVirtualDisplayType(metaData)) {
			this.setIDLabel("Virtual Display Setting");
			this.setIDLabel2("");
			this.setID("");
			this.setID2("");
			this.setGroupLabel("");
			addInputProperty(isEditable, 'whole_width', 'w', 'px', '1000', () => {
				this.action.changeDisplayProperty(this.getDisplayValues());
			});
			addInputProperty(isEditable, 'whole_height', 'h', 'px', '900', () => {
				this.action.changeDisplayProperty(this.getDisplayValues());
			});
			addInputProperty(isEditable, 'whole_split_x', 'split x', '', '1', (evt) => {
				this.action.changeDisplayProperty(this.getDisplayValues());
			});
			addInputProperty(isEditable, 'whole_split_y', 'split y', '', '1', (evt) => {
				this.action.changeDisplayProperty(this.getDisplayValues());
			});
			//addTextInputProperty('content_text', "");
			this.showDownloadButton(false);
			this.showMetaLabel(false);
			this.showBackupArea(false);
			this.showHistoryArea(false);
			this.showAlignmentArea(false);
			this.showColorPicker(false);
		}
		else if (type === Constants.PropertyTypeMultiDisplay || type === Constants.PropertyTypeMultiContent) {
			this.setIDLabel("Content ID:");
			this.setIDLabel2("Controller ID:");
			this.setID("");
			this.setID2("");
			this.setGroupLabel("");
			addCheckProperty(isEditable, 'content_visible', 'visible', String(metaData.visible) === "true", () => {
				let meta = this.store.getMetaData(metaData.id);
				meta.visible = document.getElementsByClassName('content_visible')[0].checked;
				this.action.changeContentVisibleMulti(meta);
			});
			addInputProperty(isEditable, 'multi_transform_z', 'z', 'index', '', () => {
				let multiZ = document.getElementById('multi_transform_z');
				let val = parseInt(multiZ.value, 10);
				this.action.changeContentIndex({
					zIndex: val
				});
			});
			this.showDownloadButton(false);
			this.showMetaLabel(false);
			this.showBackupArea(false);
			this.showHistoryArea(false);
			this.showAlignmentArea(true);
			this.showColorPicker(false);
		}
		else if (type === Constants.PropertyTypeLayout) {
			this.setIDLabel("Layout ID:");
			this.setID2("");
			this.setIDLabel2("");
			this.showDownloadButton(false);
			this.setGroupLabel("Group:");
			this.showMetaLabel(true);
			addTextInputProperty(isEditable, 'content_text', "");
			this.showBackupArea(false);
			this.showHistoryArea(false);
			this.showAlignmentArea(false);
			this.showColorPicker(false);
		}
		else { // content (text, image, url... )
			this.setIDLabel("Content ID:");
			this.setIDLabel2("Controller ID:");
			this.setGroupLabel("Group:");
			addCheckProperty(isEditable, 'content_visible', 'visible', String(metaData.visible) === "true", () => {
				let meta = this.store.getMetaData(metaData.id);
				meta.visible = document.getElementsByClassName('content_visible')[0].checked;
				this.action.changeContentVisible(meta);
			});
			addInputProperty(isEditable, 'content_transform_x', 'x', 'px', '0', rectChangeFunc);
			addInputProperty(isEditable, 'content_transform_y', 'y', 'px', '0', rectChangeFunc);
			addInputProperty(isEditable, 'content_transform_w', 'w', 'px', '0', rectChangeFunc);
			addInputProperty(isEditable, 'content_transform_h', 'h', 'px', '0', rectChangeFunc);
			addInputProperty(isEditable, 'content_transform_z', 'z', 'index', '0', () => {
				let transz = document.getElementById('content_transform_z');
				if (this.isAlwaysOnTop(transz.value)) {
					document.getElementsByClassName('always_on_top')[0].checked = true;
				} else {
					let val = parseInt(transz.value, 10);
					this.action.changeContentIndex({
						zIndex: val
					});
				}
			});
			const isTop = this.isAlwaysOnTop(metaData.zIndex);
			addCheckProperty(isEditable, 'always_on_top', 'AlwaysOnTop', isTop, () => {
				let transz = document.getElementById('content_transform_z');
				if (document.getElementsByClassName('always_on_top')[0].checked) {
					this.action.changeContentIndex({
						zIndex: Constants.ZIndexAlwaysOnTopValue
					});
					transz.disabled = true;
				} else {
					this.action.changeContentIndex({
						zIndex: 0
					});
					transz.disabled = false;
				}
			});
			if (isTop) {
				const transz = document.getElementById('content_transform_z');
				transz.disabled = true;
			}
			if (metaData.type === Constants.TypeWebGL) {
				addCheckProperty(isEditable, 'display_time', 'display time', String(metaData.display_time) === "true", () => {
					let meta = this.store.getMetaData(metaData.id);
					meta.display_time = document.getElementsByClassName('display_time')[0].checked;
					this.action.changeContentDisplayTime(meta);
				});
			}
			addTextInputProperty(isEditable, 'content_text', "");
			this.showDownloadButton(true, "download?" + metaData.id);
			this.showMetaLabel(true);
			if (type !== "" && type !== Constants.PropertTypeContent && metaData.type !== Constants.TypeTileImage) {
				this.showBackupArea(true);
			}
			if (metaData.type === Constants.TypeTileImage) {
				this.showDownloadButton(false);
				if (metaData.hasOwnProperty('keyvalue')) {
					this.showHistoryArea(true);
				}
			}
			else {
				this.showHistoryArea(false);
			}
			this.showColorPicker(false);
			if (type === Constants.PropertTypeVideo && metaData.subtype) {
				// 動画の場合、差し替え履歴、ダウンロード非表示
				this.showBackupArea(false);
				this.showHistoryArea(false);
				this.showDownloadButton(false);
				// 動画専用プロパティを追加設定
				if (isOwnVideo) {
					if (metaData.hasOwnProperty('use_datachannel') && String(metaData.use_datachannel) === "true") {
						// datachannel+fmp4版の動画用 設定エリアを表示

					} else {
						// webrtc動画用 設定エリアを表示
						this.showVideoInfo(true);
						this.initVideoPropertyArea(isEditable, metaData, type);
					}
				}
			}
			this.showAlignmentArea(false);
		}
	}
	initVideoPropertyArea(isEditable, metaData, type) {
		if (!navigator.mediaDevices) {
			// IEなど
			return
		}
		navigator.mediaDevices.enumerateDevices()
			.then((devices) => {
				let i;
				let audios = { keys: [], values: [] };
				let videos = { keys: [], values: [] };
				let videoQualities = { keys: [i18next.t("auto"), i18next.t("custom")], values: ["auto", "custom"] };
				if (metaData.hasOwnProperty('subtype') && metaData.subtype === "file") {
					videoQualities = { keys: [i18next.t("auto"), i18next.t("custom"), i18next.t("raw_resolution")], values: ["auto", "custom", "raw_resolution"] };
				}
				let audioQualities = { keys: [i18next.t("auto"), i18next.t("custom")], values: ["auto", "custom"] };
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
					addVideoTextLabel('video_select_video_title', i18next.t('video_input'));
					addVideoSelectProperty(isEditable, 'video_select_input_video', videos, metaData.video_device, (deviceID) => {
						this.action.changeVideoDevice({
							id: metaData.id,
							deviceInfo: this.getDeviceInfo(metaData)
						});
					});
					addVideoTextLabel('video_select_audio_title', i18next.t('audio_input'));
					addVideoSelectProperty(isEditable, 'video_select_input_audio', audios, metaData.audio_device, (deviceID) => {
						this.action.changeAudioDevice({
							id: metaData.id,
							deviceInfo: this.getDeviceInfo(metaData)
						});
					});
				}
				addVideoTextLabel('video_select_quality_title', i18next.t('video_quality'));
				addVideoSelectProperty(isEditable, 'video_select_input_quality', videoQualities, 50, (val) => {
					this.updateQualityDisplay();
					this.action.changeVideoQuality({
						id: metaData.id,
						quality: this.getVideoQualityValues(metaData.id)
					});
				});
				addVideoQualityProperty(isEditable, "video_quality", "video_quality_min", i18next.t("min_bitrate"), "kbps", "300", () => {
					this.action.changeVideoQuality({
						id: metaData.id,
						quality: this.getVideoQualityValues(metaData.id)
					});
				});
				addVideoQualityProperty(isEditable, "video_quality", "video_quality_max", i18next.t("max_bitrate"), "kbps", "1000", () => {
					this.action.changeVideoQuality({
						id: metaData.id,
						quality: this.getVideoQualityValues(metaData.id)
					});
				});
				addVideoTextLabel('video_select_quality_title', i18next.t('audio_quality'));
				addVideoSelectProperty(isEditable, 'audio_select_input_quality', audioQualities, 100, (val) => {
					this.updateQualityDisplay()
					this.action.changeVideoQuality({
						id: metaData.id,
						quality: this.getVideoQualityValues(metaData.id)
					});
				});
				addVideoQualityProperty(isEditable, "audio_quality", "audio_quality_min", i18next.t("min_bitrate"), "kbps", "50", () => {
					this.action.changeVideoQuality({
						id: metaData.id,
						quality: this.getVideoQualityValues(metaData.id)
					});
				});
				addVideoQualityProperty(isEditable, "audio_quality", "audio_quality_max", i18next.t("max_bitrate"), "kbps", "300", () => {
					this.action.changeVideoQuality({
						id: metaData.id,
						quality: this.getVideoQualityValues(metaData.id)
					});
				});
				if (metaData.hasOwnProperty('webrtc_status')) {
					addVideoTextLabel('initial_quality_info_title', i18next.t('initial_quality_info'));
					let qtext = "";
					let quality = JSON.parse(metaData.webrtc_status);
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
						let quality = JSON.parse(metaData.quality);
						this.setQuality(quality);
					}
					catch (e) {
						console.error(e);
					}
				}
			}).catch(function (err) {
				console.error('enumerateDevide ERROR:', err);
			});
	}

	submitText(endcallback) {
		let content_text = document.getElementById('content_text');
		if (content_text && !content_text.disabled) {

			let id = this.store.getState().getSelectedID();
			if (id && this.store.hasMetadata(id)) {
				let metaData = this.store.getMetaData(id);

				let newData = JSON.stringify({ text: content_text.value });
				if (newData !== metaData.user_data_text) {
					metaData.user_data_text = newData;

					if (Validator.isTextType(metaData)) {
						// テキストのメモ変更.
						// テキストはコンテンツ部分にも同じテキストがあるので更新.
						let elem = document.createElement('pre');
						elem.className = "text_content";
						elem.innerHTML = content_text.value;
						this.previewArea.appendChild(elem);
						metaData.orgWidth = elem.offsetWidth / Vscreen.getWholeScale();
						metaData.orgHeight = elem.offsetHeight / Vscreen.getWholeScale();

						// テキストのメモ変更.
						// テキストはコンテンツ部分にも同じテキストがあるので更新.
						this.action.correctContentAspect({
							metaData: metaData,
							callback: () => {
								//console.error("metaData", metaData)
								this.action.changeContentMetaInfo({
									metaData: metaData,
									contentData: content_text.value,
									callback: endcallback
								})
							}
						})
						this.previewArea.removeChild(elem);
					} else {
						this.action.changeContentMetaInfo({
							metaData: metaData,
							contentData: content_text.value,
							callback: endcallback
						})
					}
				}
			}
		}
	}

	clearTransform() {
		let transx = document.getElementById('content_transform_x');
		let transy = document.getElementById('content_transform_y');
		let transw = document.getElementById('content_transform_w');
		let transh = document.getElementById('content_transform_h');
		let transz = document.getElementById('content_transform_z');
		if (transx) {
			transx.value = 0;
			transx.disabled = true;
		}
		if (transy) {
			transy.value = 0;
			transy.disabled = true;
		}
		if (transw) {
			transw.value = 0;
			transw.disabled = true;
		}
		if (transh) {
			transh.value = 0;
			transh.disabled = true;
		}
		if (transz) {
			transz.value = 0;
			transz.disabled = true;
		}
	}

	clearContentText() {
		let content_text = document.getElementById('content_text');
		if (content_text) {
			content_text.value = "";
			content_text.disabled = true;
		}
	}

	/**
	 * Propertyエリアパラメータ消去
	 * @method clearProperty
	 */
	clear(updateText) {
		let content_text = document.getElementById('content_text');
		if (content_text && updateText) {
			this.submitText(() => {
				this.clear(false);
			});
		}
		this.setID("");
		this.setID2("");
		this.clearTransform();
		this.clearContentText();
		this.showDownloadButton(false);
		this.showBackupArea(false);
		this.showHistoryArea(false);
		this.showAlignmentArea(false);
	}

	init(metaData, groupName, type, isOwnVideo) {
		if (!this.colorselector) {
			this.colorselector = new ColorSelector((colorvalue) => {
				let colorstr = "rgb(" + colorvalue[0] + "," + colorvalue[1] + "," + colorvalue[2] + ")";
				// ディスプレイ枠色変更
				this.action.changeDisplayColor({
					color: colorstr
				});
			}, 234, 120); // 幅、高さ
			let color_picker = document.getElementById('color_picker');
			// ColorSelector を new でインスタンス化後、elementWrapper を参照すると、
			// カラーセレクタの一番外側の DOM を取得できます。
			// インスタンス化の際に渡しているコールバックには配列で 0 〜 255 の
			// レンジの RGB と 0 〜 1 のレンジのアルファが引数で渡されてきます
			color_picker.appendChild(this.colorselector.elementWrapper);
		}
		// 復元ボタン
		let restore_button = document.getElementById('backup_restore');
		restore_button.onclick = () => {
			let index = document.getElementById('backup_list_content').selectedIndex;
			if (index >= 0) {
				this.restoreContent(index);
			}
		};

		/*
		let alignLeft_button  = document.getElementById('align_left');
		alignLeft_button.onclick = () => {this.setAllign("left")};

		let alignRight_button  = document.getElementById('align_right');
		alignRight_button.onclick = () => {this.setAllign("right")};
		*/

		let aligngrid_button = document.getElementById('align_grid');
		aligngrid_button.onclick = () => { this.setAllignGrid() };

		this.initPropertyArea(metaData, groupName, type, isOwnVideo);
	}

	setAllignGrid() {
		let metaDataList = [];
		this.store.getState().for_each_selected_id((i, id) => {
			if (this.store.hasMetadata(id)) {
				let metaData = this.store.getMetaData(id);
				metaDataList.push(metaData);
			}
		});
		if (metaDataList.length > 0) {
			// gridレイアウトを取得			
			let splitWholeBase = Vscreen.getSplitWholeByPos(0, 0);
			for (let cnt = 0; cnt < metaDataList.length; cnt++) {
				// セットする座標を探す
				let elem = document.getElementById(metaDataList[cnt].id);

				let x = cnt % splitWholeBase.splits.x;
				let y = Math.floor(cnt / splitWholeBase.splits.x);
				// ↓は「一番近いグリッドに寄せる」機能になっている。これはこれで使えそうなのでコメントで残している
				// let splitWhole = Vscreen.getSplitWholeByPos(metaDataList[cnt].posx, metaDataList[cnt].posy);

				let splitWhole = Vscreen.getSplitWholeByPos(splitWholeBase.w * x,splitWholeBase.h * y);
				if (!splitWhole) {
					splitWhole = {
						x:splitWholeBase.w * x,
						y:splitWholeBase.h * y,
						w:splitWholeBase.w,
						h:splitWholeBase.h 
					};
				}
				this.action.snapContentToScreen({
					element: elem,
					metaData: metaDataList[cnt],
					screen: splitWhole
				});
				this.store.operation.updateMetadata(metaDataList[cnt]);
			}			
			// this.store.operation.updateMetadataMulti(metaDataList);
		}
	}

	setAllign(_flg) {
		let metaDataList = [];
		this.store.getState().for_each_selected_id((i, id) => {
			if (this.store.hasMetadata(id)) {
				let metaData = this.store.getMetaData(id);
				metaDataList.push(metaData);
			}
		});
		if (metaDataList.length > 0) {
			// セットする座標を探す
			let targetPos = -65535;
			// 左寄せ or 上寄せの場合は、最小値を探す必要があるので最大値をセットする
			if (_flg == "left" || _flg == "top") {
				targetPos *= -1;
			}
			if (_flg == "cent1" || _flg == "cent2") { }

			// 各セット地点を探す
			for (let cnt = 0; cnt < metaDataList.length; cnt++) {
				if (_flg == "left") {
					if (metaDataList[cnt].posx < targetPos) {
						targetPos = metaDataList[cnt].posx;
					}
				} else if (_flg == "top") {
					if (metaDataList[cnt].posy < targetPos) {
						targetPos = metaDataList[cnt].posy;
					}
				} else if (_flg == "right") {
					if (metaDataList[cnt].posx + metaDataList[cnt].width > targetPos) {
						targetPos = Number(metaDataList[cnt].posx) + Number(metaDataList[cnt].width);
					}
				} else if (_flg == "bottom") {
					if (metaDataList[cnt].posy + metaDataList[cnt].height > targetPos) {
						targetPos = Number(metaDataList[cnt].posy) + Number(metaDataList[cnt].height);
					}
				} else if (_flg == "cent1") {
					targetPos += metaDataList[cnt].posx;
				} else if (_flg == "cent2") {
					targetPos += metaDataList[cnt].posy;
				}
			}

			if (_flg == "cent1" || _flg == "cent1") {
				targetPos = targetPos / metaDataList.length;
			}

			//実際の値のセット
			for (let cnt = 0; cnt < metaDataList.length; cnt++) {
				if (_flg == "left") {
					metaDataList[cnt].posx = targetPos;
				} else if (_flg == "top") {
					metaDataList[cnt].posy = targetPos;
				} else if (_flg == "right") {
					metaDataList[cnt].posx = targetPos - Number(metaDataList[cnt].width);
				} else if (_flg == "bottom") {
					metaDataList[cnt].posy = targetPos - Number(metaDataList[cnt].height);
				} else if (_flg == "cent1") {

				} else if (_flg == "cent2") {

				}
			}
			this.store.operation.updateMetadataMulti(metaDataList);
		}
	}

	/**
	 * 選択されているVirtualDisplayをPropertyエリアのパラメータに設定
	 * @method assignVirtualDisplay
	 */
	assignVirtualDisplay(whole, splitCount) {
		let wholeWidth = document.getElementById('whole_width');
		let wholeHeight = document.getElementById('whole_height');
		let wholeSplitX = document.getElementById('whole_split_x');
		let wholeSplitY = document.getElementById('whole_split_y');
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
	assignContentProperty(metaData) {
		//console.log("assignContentProperty:" + JSON.stringify(metaData));
		let transx = document.getElementById('content_transform_x');
		let transy = document.getElementById('content_transform_y');
		let transw = document.getElementById('content_transform_w');
		let transh = document.getElementById('content_transform_h');
		let transz = document.getElementById('content_transform_z');
		let text = document.getElementById('content_text');
		let i;
		let option;
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
			if (metaData.zIndex == Constants.ZIndexAlwaysOnTopValue) {
				transz.value = Constants.ZIndexAlwaysOnTopString;
			}
		}
		// メタ情報
		if (metaData.hasOwnProperty('user_data_text')) {
			let parsed = null;
			try {
				parsed = JSON.parse(metaData.user_data_text);
			}
			catch (e) {
				console.error(e);
				return;
			}
			if (text && parsed.hasOwnProperty("text")) {
				text.value = parsed.text;
			}
		}
		// 色変更
		if (metaData.hasOwnProperty('color') && this.colorselector) {
			let col = metaData.color.split('rgb(').join("");
			col = col.split(")").join("");
			col = col.split(",");
			this.colorselector.setColor(col[0], col[1], col[2], 1, true);
		}
		// 差し替え履歴
		if (!Validator.isWindowType(metaData) && metaData.type !== Constants.TypeTileImage) {
			let backup_list = document.getElementById('backup_list');
			let restoreIndex = 0;
			backup_list.innerHTML = "";
			document.getElementById('backup_restore').disabled = true;
			if (metaData.hasOwnProperty('backup_list') && metaData.backup_list.length > 0) {
				if (this.authority.isEditable(metaData.group)) {
					document.getElementById('backup_restore').disabled = false;
				}
				let backups = JSON.parse(metaData.backup_list);
				let select = document.createElement('select');
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
					}
					else {
						option.innerHTML = text;
					}
					select.appendChild(option);
				}
				select.value = backups[0];
				backup_list.appendChild(select);
			}
		}
		// 時系列データ（仮）
		this.updateHistoryArea(metaData);
		// ビデオ品質
		if (metaData.hasOwnProperty('quality')) {
			try {
				let quality = JSON.parse(metaData.quality);
				this.setQuality(quality);
			}
			catch (e) {
				console.error(e, metaData);
			}
		}
	}
	updateHistoryArea(metaData, keyName) {
		let i, option, text;
		if (!Validator.isWindowType(metaData) && metaData.type === Constants.TypeTileImage) {
			let history_area = document.getElementById('history_area');
			let history_list = document.getElementById('history_list');
			let history_select = document.getElementById('history_select');
			let history_up = document.getElementById('history_up');
			let history_down = document.getElementById('history_down');
			let history_sync_button = document.getElementById('history_sync_button');
			let history_slider_area = document.getElementById('history_slider_area');
			let history_slider = document.getElementById('history_slider');
			let history_slider_label = document.getElementById('history_slider_label');
			let history_slider_memori = document.getElementById('history_slider_memori');
			let sliderRect = history_slider.getBoundingClientRect();
			let kv;
			// 中身の登録
			history_area.disabled = true;
			history_slider_area.disabled = true;
			if (metaData.hasOwnProperty('history_data')) {
				if (this.authority.isEditable(metaData.group)) {
					history_area.disabled = false;
					history_slider_area.disabled = false;
				}
				if (!keyName) {
					if (metaData.hasOwnProperty('restore_key')) {
						keyName = metaData.restore_key;
					}
				}
				// 前回と同様のデータかつ選択されたkeyも同じ場合は、更新しない
				if (history_area.pre_id && history_area.pre_id === metaData.id
					&& history_area.pre_history_data && history_area.pre_history_data === metaData.history_data
					&& history_area.pre_keyname && history_area.pre_keyname === keyName
					&& history_area.pre_keyvalue && history_area.pre_keyvalue === metaData.keyvalue) {
					return;
				}
				history_area.pre_id = metaData.id;
				history_area.pre_history_data = metaData.history_data;
				history_area.pre_keyname = keyName;
				history_area.pre_keyvalue = metaData.keyvalue;
				history_list.innerHTML = "";
				history_select.innerHTML = "";
				history_slider_memori.innerHTML = "";
				let historyData = ContentUtil.extractHistoryData(metaData);

				// キーの切り替えボックスの中身を入れる
				for (let key in historyData) {
					let keyTitle = document.createElement('option');
					keyTitle.value = key;
					keyTitle.innerText = key;
					history_select.appendChild(keyTitle);
				}
				// 現在表示中のキー
				if (keyName) {
					history_select.value = keyName;
				}
				else {
					history_select.value = Object.keys(historyData)[0];
				}
				let values = historyData[history_select.value];
				values = ContentUtil.sortHistory(values);

				let select = document.createElement('select');
				select.className = "history_list_content";
				select.id = "history_list_content";
				select.size = 5;
				select.restore_key = keyName;
				history_slider.max = values.length - 1;
				let selectedIndex = 0;
				let memoriSpan = 100 / (values.length - 1) * (sliderRect.right - sliderRect.left - 16) / document.body.clientWidth;
				for (i = 0; i < values.length; i = i + 1) {
					option = document.createElement('option');
					text = values[i];
					option.value = text;
					// 現在表示中のコンテンツかどうか
					try {
						kv = JSON.parse(metaData.keyvalue);
					}
					catch (e) {
						console.error("tileimage history key parse error");
					}
					if (kv && String(kv[history_select.value]) === text) {
						option.innerHTML = "●" + text;
						// // 何とか削除されたことを表示したいがうまくいかない
						// let imageWrapDiv = document.getElementById(metaData.id);
						// if (imageWrapDiv) {
						// 	let tileimageElems = imageWrapDiv.getElementsByClassName('tileimage_image');
						// 	if (tileimageElems.length > 0) {
						// 		if (tileimageElems[0].innerText.indexOf("removed") === 0) {
						// 			option.innerHTML += " - removed"
						// 		}
						// 	}
						// }
						selectedIndex = i;
						history_slider.value = i;
						history_slider_label.innerText = text;
					}
					else {
						option.innerHTML = text;
					}
					select.appendChild(option);
					let sliderMemori = document.createElement('div');
					sliderMemori.title = text;
					sliderMemori.style.position = "absolute";
					sliderMemori.style.marginLeft = (sliderRect.left + 6) / document.body.clientWidth * 100 + "%";
					sliderMemori.style.left = memoriSpan * i + "%";
					if (Constants.IsFirefox) {
						sliderMemori.style.top = "34px";
					}
					else {
						sliderMemori.style.top = "30px";
					}
					sliderMemori.style.width = "4px";
					sliderMemori.style.height = "30px";
					sliderMemori.style.borderRadius = "4px";
					sliderMemori.style.backgroundColor = "lightgray";
					sliderMemori.style.zIndex = -1;
					history_slider_memori.appendChild(sliderMemori);
				}
				select.value = values[0];
				history_list.appendChild(select);
				select.selectedIndex = selectedIndex;
				// キーの切り替えイベントの登録
				history_select.onchange = (evt) => {
					let historyContent = document.getElementById('history_list_content');
					let key = history_select.options[history_select.selectedIndex].value;
					let value = historyContent.value;
					this.restoreHistoryContent(metaData.id, key, value);
				};
				// データ切り替えイベントの登録
				select.onchange = (evt) => {
					let historyContent = document.getElementById('history_list_content');
					let key = history_select.value;
					let value = historyContent.value;
					this.restoreHistoryContent(metaData.id, key, value);
				};
				history_up.onclick = function () {
					let index = select.selectedIndex - 1;
					if (index >= 0) {
						select.selectedIndex = index;
						select.onchange();
					}
				};
				history_down.onclick = function () {
					let index = select.selectedIndex + 1;
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
				history_sync_button.onclick = () => {
					if (history_sync_button.classList.contains('history_sync_on')) {
						history_sync_button.classList.remove('history_sync_on');
						this.action.syncContent({
							isSync: false
						});
					}
					else {
						history_sync_button.classList.add('history_sync_on');
						this.action.syncContent({
							isSync: true
						});
					}
				};
				history_slider.onchange = () => {
					let historyContent = document.getElementById('history_list_content');
					let key = history_select.value;
					let value = historyContent.options[Number(history_slider.value)].value;
					this.restoreHistoryContent(metaData.id, key, value);
				};
			}
		}
	}

	restoreContent(restoreIndex) {
		InputDialog.showYesNoCancelInput({
			name: i18next.t('restore_content'),
			yesButtonName: i18next.t('restore'),
			noButtonName: i18next.t('restore_here'),
			cancelButtonName: "Cancel",
		}, (res) => {
			if (res === "yes" || res === "no") {
				let isRestore = (res === "yes");
				this.action.restoreContent({
					isRestore: isRestore,
					restoreIndex: restoreIndex
				})
			}
		});
	}

	restoreHistoryContent(id, key, value) {
		this.action.restoreHistoryContent({
			id: id,
			restoreKey: key,
			restoreValue: value
		});
	}

	getDisplayValues() {
		let whole = Vscreen.getWhole();
		let wholeWidth = document.getElementById('whole_width');
		let wholeHeight = document.getElementById('whole_height');
		let wholeSplitX = document.getElementById('whole_split_x');
		let wholeSplitY = document.getElementById('whole_split_y');
		let w;
		let h;
		let s = Number(Vscreen.getWholeScale());
		let ix = parseInt(wholeSplitX.value, 10);
		let iy = parseInt(wholeSplitY.value, 10);
		let cx = window.innerWidth / 2;
		let cy = window.innerHeight / 2;

		if (!wholeWidth || !whole.hasOwnProperty('w')) {
			w = Constants.InitialWholeWidth;
		} else {
			w = parseInt(wholeWidth.value, 10);
			if (w <= 1) {
				wholeWidth.value = 100;
				w = 100;
			}
		}
		if (!wholeHeight || !whole.hasOwnProperty('h')) {
			h = Constants.InitialWholeHeight;
		} else {
			h = parseInt(wholeHeight.value, 10);
			if (h <= 1) {
				wholeHeight.value = 100;
				h = 100;
			}
		}
		return {
			width: w,
			height: h,
			centerX: cx,
			centerY: cy,
			splitX: ix,
			splitY: iy,
			scale: s
		};
	}

	getVideoQualityValues(metadataID) {
		let quality = {
			video_quality_enable: this.isVideoQualityEnable(),
			audio_quality_enable: this.isAudioQualityEnable(),
			raw_resolution: this.isRawResolution(),
			screen: this.getVideoQuality(metadataID).min,
			video: this.getVideoQuality(metadataID).min,
			audio: this.getAudioQuality(metadataID).min,
			video_max: this.getVideoQuality(metadataID).max,
			audio_max: this.getAudioQuality(metadataID).max
		};
		if (quality.video_max < quality.video) {
			quality.video_max = quality.video;
		}
		if (quality.audio_max < quality.audio) {
			quality.audio_max = quality.audio;
		}
		if (!quality.video_quality_enable) {
			delete quality["screen"];
			delete quality["video"];
			delete quality["video_max"];
		}
		if (!quality.audio_quality_enable) {
			delete quality["audio"];
			delete quality["audio_max"];
		}
		if (Object.keys(quality).length === 0) {
			quality = null;
		}
		return quality;
	}

	getDeviceInfo(metaData) {
		return {
			isCameraOn: metaData.hasOwnProperty('is_video_on') ? metaData.is_video_on : true,
			isMicOn: metaData.hasOwnProperty('is_audio_on') ? metaData.is_audio_on : true,
			audioDeviceID: this.getAudioDeviceID(),
			videoDeviceID: this.getVideoDeviceID()
		}
	}

	getContentTransform() {
		let elem = this.getSelectedElem();
		return {
			posx: document.getElementById('content_transform_x').value,
			posy: document.getElementById('content_transform_y').value,
			width: document.getElementById('content_transform_w').value,
			height: document.getElementById('content_transform_h').value,
			aspect: elem.naturalHeight / elem.naturalWidth
		}
	}

	getSelectedElem() {
		let targetID = document.getElementById('content_id').innerHTML;
		if (targetID) {
			//targetID = targetID.substr(1); // 最初の空白削除
			return document.getElementById(targetID);
		}
	}

	getVideoDeviceID() {
		let elem = document.getElementById('video_select_input_video');
		if (elem) {
			return elem.options[elem.selectedIndex].value;
		}
		return null;
	}
	getAudioDeviceID() {
		let elem = document.getElementById('video_select_input_audio');
		if (elem) {
			return elem.options[elem.selectedIndex].value;
		}
		return null;
	}
	isVideoQualityEnable() {
		let elem = document.getElementById('video_select_input_quality');
		if (elem) {
			return elem.options[elem.selectedIndex].value === "custom";
		}
		return false;
	}
	isRawResolution() {
		let elem = document.getElementById('video_select_input_quality');
		if (elem) {
			return elem.options[elem.selectedIndex].value === "raw_resolution";
		}
		return false;
	}
	isAudioQualityEnable() {
		let elem = document.getElementById('audio_select_input_quality');
		if (elem) {
			return elem.options[elem.selectedIndex].value === "custom";
		}
		return false;
	}
	// ビデオオーディオ品質の有効状態の変更による表示切り替え
	updateQualityDisplay() {
		// bitrate min/maxの表示
		let vElem = document.getElementById('video_select_input_quality');
		if (vElem) {
			let elems = document.getElementsByClassName('video_quality');
			for (let i = 0; i < elems.length; ++i) {
				elems[i].style.display = (vElem.value === "auto" || vElem.value === "raw_resolution") ? "none" : "block";
			}
		}
		let aElem = document.getElementById('audio_select_input_quality');

		// RawResolutionの場合
		let initialInfo = document.getElementById('video_quality_text');
		let initialTitle = document.getElementById('initial_quality_info_title');
		if (vElem && vElem.value === "raw_resolution") {
			if (aElem) {
				aElem.disabled = true;
				aElem.style.background = "lightgray";
				let elems = document.getElementsByClassName('audio_quality');
				for (let i = 0; i < elems.length; ++i) {
					elems[i].style.display = "none";
				}
			}
			if (initialInfo) { initialInfo.style.display = "none"; }
			if (initialTitle) { initialTitle.style.display = "none"; }
		} else {
			if (aElem) {
				aElem.disabled = false;
				aElem.style.background = "";
				let elems = document.getElementsByClassName('audio_quality');
				for (let i = 0; i < elems.length; ++i) {
					elems[i].style.display = (aElem.value === "auto") ? "none" : "block";
				}
			}
			if (initialInfo) { initialInfo.style.display = "block"; }
			if (initialTitle) { initialTitle.style.display = "block"; }
		}
	}
	getVideoQuality() {
		let elems = document.getElementsByClassName('video_quality');
		if (elems.length > 0) {
			return {
				min: Number(document.getElementById('video_quality_min').value),
				max: Number(document.getElementById('video_quality_max').value)
			};
		}
		return null;
	}
	getAudioQuality() {
		let elems = document.getElementsByClassName('audio_quality');
		if (elems.length > 0) {
			return {
				min: Number(document.getElementById('audio_quality_min').value),
				max: Number(document.getElementById('audio_quality_max').value)
			};
		}
		return null;
	}
	setQuality(quality) {
		// console.error("setQuality", quality)
		let elem;
		/*
		screen : content_property.getVideoQuality(metadataID).min,
		video : content_property.getVideoQuality(metadataID).min,
		audio : content_property.getAudioQuality(metadataID).min,
		video_max : content_property.getVideoQuality(metadataID).max,
		audio_max : content_property.getAudioQuality(metadataID).max
		*/
		elem = document.getElementById('video_select_input_quality');
		if (elem) {
			if (quality.hasOwnProperty('raw_resolution') && String(quality.raw_resolution) === "true") {
				elem.value = "raw_resolution";
			}
			else if (quality.hasOwnProperty('video_quality_enable') && String(quality.video_quality_enable) !== "false") {
				elem.value = "custom";
			}
			else {
				elem.value = "auto";
			}
		}
		elem = document.getElementById('audio_select_input_quality');
		if (elem) {
			if (quality.hasOwnProperty('audio_quality_enable') && String(quality.audio_quality_enable) !== "false") {
				elem.value = "custom";
			}
			else {
				elem.value = "auto";
			}
		}
		if (quality.hasOwnProperty('video')) {
			let vmin = document.getElementById('video_quality_min');
			if (vmin) {
				vmin.value = Number(quality.video);
			}
		}
		if (quality.hasOwnProperty('video_max')) {
			let vmax = document.getElementById('video_quality_max');
			if (vmax) {
				vmax.value = Number(quality.video_max);
			}
		}
		if (quality.hasOwnProperty('audio')) {
			let amin = document.getElementById('audio_quality_min');
			if (amin) {
				amin.value = Number(quality.audio);
			}
		}
		if (quality.hasOwnProperty('audio_max')) {
			let amax = document.getElementById('audio_quality_max');
			if (amax) {
				amax.value = Number(quality.audio_max);
			}
		}
		this.updateQualityDisplay();
	}
}

export default ContentPropertyGUI;
