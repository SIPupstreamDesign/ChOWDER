/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Input from "../components/input"
import PropertySlider from "../components/property_slider"
import ITownsConstants from "./itowns_constants";
import Select from "../components/select"
import Button from "../components/button"

/**
 * Propertyタブに入力プロパティを追加する
 * @method addInputProperty
 * @param {String} leftLabel 左ラベル
 * @param {String} rightLabel 右ラベル
 * @param {String} value 初期入力値
 */
function addTextAreaProperty(parentElem, isEditable, leftLabel, rightLabel, value, changeCallback) {
	/*
		<div class="input-group">
			<span class="input-group-addon">x</span>
			<input type="text" class="form-control" id="content_transform_x" value="0">
			<span class="input-group-addon">px</span>
		</div>
	*/
	let group = document.createElement('div');
	let leftSpan = document.createElement('span');
	let rightSpan = document.createElement('span');
	let input = document.createElement('textarea');
	input.style.maxWidth = "220px"
	input.style.width = "220px"
	input.style.height = "auto"

	group.className = "input-group";
	group.style.margin = "0px"
	group.style.marginBottom = "5px"
	leftSpan.className = "input-group-addon";
	leftSpan.innerHTML = leftLabel;
	rightSpan.className = "input-group-addon";
	rightSpan.innerHTML = rightLabel;
	input.className = "form-control";
	input.value = value;
	input.disabled = !isEditable;

	//group.appendChild(leftSpan);
	group.appendChild(input);
	if (rightLabel) {
		group.appendChild(rightSpan);
	}
	parentElem.appendChild(group);

	input.onchange = (evt) => {
		try {
			changeCallback(null, evt.target.value);
		} catch (ex) {
			console.error(ex);
			changeCallback(err, evt.target.value);
		}
	};
}

/**
 * Propertyタブに入力プロパティを追加する
 * @method addCheckProperty
 * @param {String} leftLabel 左ラベル
 * @param {String} rightLabel 右ラベル
 * @param {String} value 初期入力値
 */
function addCheckProperty(parent, isEditable, className, leftLabel, value, changeCallback) {
	/*
		<div class="input-group">
			<span class="input-group-addon">x</span>
			<input type="text" class="form-control" id="content_transform_x" value="0">
			<span class="input-group-addon">px</span>
		</div>
	*/
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
	parent.appendChild(group);

	input.on(Input.EVENT_CHANGE, (err, data) => {
		changeCallback(err, data.target.checked);
	});
}


class LayerProperty extends EventEmitter {
	constructor(store, action) {
		super();

		this.store = store;
		this.action = action;

		this.dom = document.createElement('div');
		this.dom.className = "layer_property";

		/*
		addCheckProperty(this.dom, false, "visible", "visible", true, (err, data) => {
		});
		this.opacitySlider = new PropertySlider(false, "opacity", "", 1.0);
		this.dom.appendChild(this.opacitySlider.getDOM());
		*/

		this.scaleSlider = null;
		this.pointSizeSlider = null;
		this.bboxSizeSlider = null;
	}

	addVisible(layerID, layerProps) {
		if (layerProps && layerProps.hasOwnProperty('visible')) {
			addCheckProperty(this.dom, layerID && layerProps, "visible", "visible", layerProps.visible, (err, data) => {
				this.action.changeLayerProperty({
					id: layerID,
					visible: data
				})
			});
		} else {
			addCheckProperty(this.dom, layerID && layerProps, "visible", "visible", true, (err, data) => {
				this.action.changeLayerProperty({
					id: layerID,
					visible: data
				})
			});
		}
	}

	addBBox(layerID, layerProps) {
		if (layerProps && layerProps.hasOwnProperty('bbox')) {
			addCheckProperty(this.dom, layerID && layerProps, "bbox", "bbox", layerProps.bbox, (err, data) => {
				this.action.changeLayerProperty({
					id: layerID,
					bbox: data
				})
			});
		} else {
			addCheckProperty(this.dom, layerID && layerProps, "bbox", "bbox", false, (err, data) => {
				this.action.changeLayerProperty({
					id: layerID,
					bbox: data
				})
			});
		}
	}

	addOpacity(layerID, layerProps) {
		if (layerProps && layerProps.hasOwnProperty('opacity')) {
			this.opacitySlider = new PropertySlider(layerID && layerProps, "opacity", "", layerProps.opacity);
		} else {
			this.opacitySlider = new PropertySlider(layerID && layerProps, "opacity", "", 1.0);
		}
		this.opacitySlider.on(PropertySlider.EVENT_CHANGE, (err, data) => {
			this.action.changeLayerProperty({
				id: layerID,
				opacity: data
			});
		});
		this.dom.appendChild(this.opacitySlider.getDOM());
	}

	addScale(layerID, layerProps) {
		if (layerProps && layerProps.hasOwnProperty('scale')) {
			this.scaleSlider = new PropertySlider(layerID && layerProps, "scale", "", layerProps.scale / 20.0, 20, true);
		} else {
			this.scaleSlider = new PropertySlider(layerID && layerProps, "scale", "", 1 / 20.0, 20, true);
		}
		this.scaleSlider.on(PropertySlider.EVENT_CHANGE, (err, data) => {
			this.action.changeLayerProperty({
				id: layerID,
				scale: data
			});
		});
		this.dom.appendChild(this.scaleSlider.getDOM());
	}

	addPointSize(layerID, layerProps) {
		if (layerProps && layerProps.hasOwnProperty('pointSize')) {
			this.pointSizeSlider = new PropertySlider(layerID && layerProps, "size", "", (layerProps.pointSize - 1) / 20.0, 20, false, 1);
		} else {
			this.pointSizeSlider = new PropertySlider(layerID && layerProps, "size", "", 4 / 20.0, 20, false, 1);
		}
		this.pointSizeSlider.on(PropertySlider.EVENT_CHANGE, (err, data) => {
			this.action.changeLayerProperty({
				id: layerID,
				pointSize: data
			});
		});
		this.dom.appendChild(this.pointSizeSlider.getDOM());
	}

	addBBoxSize(layerID, layerProps) {
		if (layerProps && layerProps.hasOwnProperty('size')) {
			this.bboxSizeSlider = new PropertySlider(layerID && layerProps, "size", "", (layerProps.size - 0.01) / 10.0, 10.0, false, 0.01);
		} else {
			this.bboxSizeSlider = new PropertySlider(layerID && layerProps, "size", "", 5 / 10.0, 10.0, false, 0.01);
		}
		this.bboxSizeSlider.on(PropertySlider.EVENT_CHANGE, (err, data) => {
			this.action.changeLayerProperty({
				id: layerID,
				size: data
			});
		});
		this.dom.appendChild(this.bboxSizeSlider.getDOM());
	}

	addWireFrame(layerID, layerProps) {
		if (layerProps && layerProps.hasOwnProperty('wireframe')) {
			addCheckProperty(this.dom, layerID && layerProps, "wireframe", "wireframe", layerProps.wireframe, (err, data) => {
				this.action.changeLayerProperty({
					id: layerID,
					wireframe: data
				})
			});
		} else {
			addCheckProperty(this.dom, layerID && layerProps, "wireframe", "wireframe", false, (err, data) => {
				this.action.changeLayerProperty({
					id: layerID,
					wireframe: data
				})
			});
		}
	}

	addSSEThreashold(layerID, layerProps) {
		let maxVal = 1.0;
		if (layerProps.type === ITownsConstants.TypePointCloud
			|| layerProps.type === ITownsConstants.TypePointCloudTimeSeries) {
			maxVal = 2.0;
		}
		if (layerProps && layerProps.hasOwnProperty('sseThreshold')) {
			this.sseThresholdSlider = new PropertySlider(layerID && layerProps, "sseThreshold", "", layerProps.sseThreshold / maxVal, maxVal, false, 0.0, maxVal);
		} else {
			this.sseThresholdSlider = new PropertySlider(layerID && layerProps, "sseThreshold", "", 1.0 / maxVal, maxVal, false, 0.0, maxVal);
		}
		this.sseThresholdSlider.on(PropertySlider.EVENT_CHANGE, (err, data) => {
			this.action.changeLayerProperty({
				id: layerID,
				sseThreshold: data
			});
		});
		this.dom.appendChild(this.sseThresholdSlider.getDOM());
	}

	// 現在未使用
	addPointBudget(layerID, layerProps) {
		if (layerProps && layerProps.hasOwnProperty('pointBudget')) {
			this.maxPointCountSlider = new PropertySlider(layerID && layerProps, "max points", "", layerProps.pointBudget / 10000000.0, 10000000, true, 1000);
		} else {
			this.maxPointCountSlider = new PropertySlider(layerID && layerProps, "max points", "", 1000 / 10000000.0, 10000000, true, 1000);
		}
		this.maxPointCountSlider.on(PropertySlider.EVENT_CHANGE, (err, data) => {
			console.error("changeLayerProperty", this.maxPointCountSlider.getValue())
			this.action.changeLayerProperty({
				id: layerID,
				pointBudget: this.maxPointCountSlider.getValue()
			});
		});
		this.dom.appendChild(this.maxPointCountSlider.getDOM());
	}

	addAttribution(layerID, layerProps) {
		// Attributionタイトル
		let attributionTitle = document.createElement('p');
		attributionTitle.className = "property_text_title";
		attributionTitle.innerText = "Attribution";
		attributionTitle.style.paddingTop = "10px";
		this.dom.appendChild(attributionTitle);

		// Attribution枠
		let attributionDiv = document.createElement('div');
		attributionDiv.style.height = "auto";
		attributionDiv.style.border = "1px solid gray"
		attributionDiv.style.marginLeft = "10px";
		attributionDiv.style.marginRight = "10px";
		this.dom.appendChild(attributionDiv);

		// Attribution - Name
		let attributionName = document.createElement('p');
		attributionName.className = "property_text_title attribution_title";
		attributionName.innerText = "Name";
		attributionDiv.appendChild(attributionName);
		const attribName = layerProps.hasOwnProperty('attribution') ? layerProps.attribution.name : "";
		addTextAreaProperty(attributionDiv, layerID && layerProps, "name", "", attribName, (err, data) => {
			let attrib = { name: "", url: "" };
			let layer = this.store.getLayerData(layerID);
			if (layer.hasOwnProperty('attribution')) {
				attrib = JSON.parse(JSON.stringify(layer.attribution));
			}
			attrib.name = data;
			this.action.changeLayerProperty({
				id: layerID,
				attribution: attrib
			});
		});

		// Attribution - URL
		let attributionURL = document.createElement('p');
		attributionURL.className = "property_text_title attribution_title";
		attributionURL.innerText = "URL";
		attributionDiv.appendChild(attributionURL);
		const attribURL = layerProps.hasOwnProperty('attribution') ? layerProps.attribution.url : "";
		addTextAreaProperty(attributionDiv, layerID && layerProps, "url", "", attribURL, (err, data) => {
			let attrib = { name: "", url: "" };
			let layer = this.store.getLayerData(layerID);
			if (layer.hasOwnProperty('attribution')) {
				attrib = JSON.parse(JSON.stringify(layer.attribution));
			}
			attrib.url = data;
			this.action.changeLayerProperty({
				id: layerID,
				attribution: attrib
			});
		});
	}

	// 現在未使用
	addOffsetXYZ(layerID, layerProps) {
		if (layerProps.type !== ITownsConstants.TypeColor &&
			layerProps.type !== ITownsConstants.TypeElevation) {
			if (layerProps && layerProps.hasOwnProperty('offset_xyz')) {
				this.offsetX = new PropertySlider(layerID && layerProps, "offset x", "", layerProps.offset_xyz.x / 2000.0 + 0.5, 2000, false, -1000, 1000)
				this.offsetY = new PropertySlider(layerID && layerProps, "offset y", "", layerProps.offset_xyz.y / 2000.0 + 0.5, 2000, false, -1000, 1000);
				this.offsetZ = new PropertySlider(layerID && layerProps, "offset z", "", layerProps.offset_xyz.z / 2000.0 + 0.5, 2000, false, -1000, 1000);
			} else {
				this.offsetX = new PropertySlider(layerID && layerProps, "offset x", "", 0.5, 2000, false, -1000, 1000);
				this.offsetY = new PropertySlider(layerID && layerProps, "offset y", "", 0.5, 2000, false, -1000, 1000);
				this.offsetZ = new PropertySlider(layerID && layerProps, "offset z", "", 0.5, 2000, false, -1000, 1000);
			}
			const UpdateOffset = (err, data) => {
				this.action.changeLayerProperty({
					id: layerID,
					offset_xyz: {
						x: this.offsetX.getValue(),
						y: this.offsetY.getValue(),
						z: this.offsetZ.getValue(),
					}
				});
			}
			this.offsetX.on(PropertySlider.EVENT_CHANGE, UpdateOffset);
			this.offsetY.on(PropertySlider.EVENT_CHANGE, UpdateOffset);
			this.offsetZ.on(PropertySlider.EVENT_CHANGE, UpdateOffset);
			this.dom.appendChild(this.offsetX.getDOM());
			this.dom.appendChild(this.offsetY.getDOM());
			this.dom.appendChild(this.offsetZ.getDOM());
		}
	}

	addOffsetUV(layerID, layerProps) {
		// offset tu tv
		{
			if (layerProps && layerProps.hasOwnProperty('offset_small_uv')) {
				this.offsetTU = new PropertySlider(layerID && layerProps, "offset tu", "", layerProps.offset_small_uv.u / 2000.0 + 0.5, 2000, false, -1000, 1000)
				this.offsetTV = new PropertySlider(layerID && layerProps, "offset tv", "", layerProps.offset_small_uv.v / 2000.0 + 0.5, 2000, false, -1000, 1000);
			} else {
				this.offsetTU = new PropertySlider(layerID && layerProps, "offset tu", "", 0.5, 2000, false, -1000, 1000);
				this.offsetTV = new PropertySlider(layerID && layerProps, "offset tv", "", 0.5, 2000, false, -1000, 1000);
			}
			const UpdateOffset = (err, data) => {
				this.action.changeLayerProperty({
					id: layerID,
					offset_small_uv: {
						u: this.offsetTU.getValue(),
						v: this.offsetTV.getValue(),
					}
				});
			}
			this.offsetTU.on(PropertySlider.EVENT_CHANGE, UpdateOffset);
			this.offsetTV.on(PropertySlider.EVENT_CHANGE, UpdateOffset);
			this.dom.appendChild(this.offsetTU.getDOM());
			this.dom.appendChild(this.offsetTV.getDOM());
		}

		// offset_uvw
		{
			if (layerProps && layerProps.hasOwnProperty('offset_uvw')) {
				this.offsetU = new PropertySlider(layerID && layerProps, "offset u", "", layerProps.offset_uvw.u / 360.0 + 0.5, 360, false, -180, 180)
				this.offsetV = new PropertySlider(layerID && layerProps, "offset v", "", layerProps.offset_uvw.v / 360.0 + 0.5, 360, false, -180, 180)
				this.offsetW = new PropertySlider(layerID && layerProps, "offset w", "", layerProps.offset_uvw.w / 2000.0 + 0.5, 2000, false, -1000, 1000)
			} else {
				this.offsetU = new PropertySlider(layerID && layerProps, "offset u", "", 0.5, 360, false, -180, 180)
				this.offsetV = new PropertySlider(layerID && layerProps, "offset v", "", 0.5, 360, false, -180, 180)
				this.offsetW = new PropertySlider(layerID && layerProps, "offset w", "", 0.5, 360, false, -180, 180)
			}
			const UpdateOffset = (err, data) => {
				this.action.changeLayerProperty({
					id: layerID,
					offset_uvw: {
						u: this.offsetU.getValue(),
						v: this.offsetV.getValue(),
						w: this.offsetW.getValue()
					}
				});
			};
			this.offsetU.on(PropertySlider.EVENT_CHANGE, UpdateOffset);
			this.offsetV.on(PropertySlider.EVENT_CHANGE, UpdateOffset);
			this.offsetW.on(PropertySlider.EVENT_CHANGE, UpdateOffset);
			this.dom.appendChild(this.offsetU.getDOM());
			this.dom.appendChild(this.offsetV.getDOM());
			this.dom.appendChild(this.offsetW.getDOM());
		}
	}

	addTimeList(layerID, layerProps) {
		let times = [];
		if (layerProps.hasOwnProperty('json') && layerProps.json.length > 0) {
			try {
				const json = JSON.parse(layerProps.json);
				if (json) {
					times = Object.keys(json);
				}
			} catch (err) {
				console.error(err);
				return;
			}
		}
		if (layerProps.hasOwnProperty('csv') && layerProps.csv.data.length > 1) {
			if (layerProps.hasOwnProperty('bargraphParams')) {
				const bargraphParams = layerProps.bargraphParams;
				for (let i = 1; i < layerProps.csv.data.length; ++i) {
					times.push(layerProps.csv.data[i][bargraphParams.time]);
				}
			}
		}

		if (times.length > 0) {
			const buttnList = document.createElement('div');
			buttnList.className = "time_button_list"
			let rangeStartTime = null;
			let rangeEndTime = null;
			// 時刻歴一覧
			for (let i = 0; i < times.length; ++i) {
				if (times[i] && times[i].length > 0)
				{
					const div = document.createElement('div');
					div.className = "time_button_wrap";
					let timeButton = new Button();
					timeButton.getDOM().className = "time_button btn btn-secondary";
					timeButton.getDOM().value = times[i];
					// UTC時刻のUnixTime文字列で初期化されたDateを作成する
					const local = new Date(times[i])
					const offset = -1 * local.getTimezoneOffset() / 60
					const date = new Date(local.getTime() + (offset * 3600000));
					if (!isNaN(date.getTime())) {
						if (!rangeStartTime) {
							rangeStartTime = date;
						}
						if (!rangeEndTime) {
							rangeEndTime = date;
						}
						rangeStartTime = new Date(Math.min(date.getTime(), rangeStartTime.getTime()));
						rangeEndTime = new Date(Math.max(date.getTime(), rangeEndTime.getTime()));
					}
	
					timeButton.on('click', ((date) => {
						return () => {
							this.action.changeTime({
								currentTime: date
							})
						};
					})(date));
					div.appendChild(timeButton.getDOM());
					buttnList.appendChild(div);
				}
			}

			// console.error("rangeStartTime", rangeStartTime, rangeEndTime)
			if (rangeStartTime && rangeEndTime) {
				if (!isNaN(rangeStartTime.getTime()) && !isNaN(rangeEndTime.getTime())) {
					this.action.changeTimelineRangeBar({
						rangeStartTime: rangeStartTime,
						rangeEndTime: rangeEndTime
					});

					// 正しい値がある場合のみ追加
					// 時刻歴タイトル
					let timesTitle = document.createElement('p');
					timesTitle.className = "property_text_title";
					timesTitle.innerText = "Times";
					timesTitle.style.paddingTop = "10px";
					this.dom.appendChild(timesTitle);
					// ボタンリスト
					this.dom.appendChild(buttnList);
					
					let buttonWrap = document.createElement('div');
					buttonWrap.className = "reset_rangebar_button_wrap"
					let button = new Button();
					button.getDOM().className = "reset_rangebar_button btn btn-secondary";
					button.setDataKey('Reset RangeBar by Times');
					button.on('click', () => {
						this.action.changeTimelineRangeBar({
							rangeStartTime: rangeStartTime,
							rangeEndTime: rangeEndTime
						});
					})
					buttonWrap.appendChild(button.getDOM());
					this.dom.appendChild(buttonWrap);
				}
			}
		}
	}

	addBargraphColumns(layerID, layerProps) {
		if (!layerProps.hasOwnProperty('csv') || layerProps.csv.data.length <= 0) return;

		const colTitles = layerProps.csv.data[0];

		this.barGraphSelectLon = new Select();
		this.barGraphSelectLat = new Select();
		this.barGraphSelect1 = new Select();
		this.barGraphSelect2 = new Select();
		this.timeSelect = new Select();
		this.barGraphSelectLon.getDOM().className = "property_bargraph_col"
		this.barGraphSelectLat.getDOM().className = "property_bargraph_col"
		this.barGraphSelect1.getDOM().className = "property_bargraph_col"
		this.barGraphSelect2.getDOM().className = "property_bargraph_col"
		this.timeSelect.getDOM().className = "property_bargraph_col"
		this.barGraphSelectLon.addOption(-1, i18next.t('selection_initial'));
		this.barGraphSelectLat.addOption(-1, i18next.t('selection_initial'));
		this.barGraphSelect1.addOption(-1, i18next.t('selection_initial'));
		this.barGraphSelect2.addOption(-1, i18next.t('selection_initial'));
		this.timeSelect.addOption(-1, i18next.t('selection_initial'));
		for (let i = 0; i < colTitles.length; ++i) {
			const title = colTitles[i];
			this.barGraphSelectLon.addOption(i, title);
			this.barGraphSelectLat.addOption(i, title);
			this.barGraphSelect1.addOption(i, title);
			this.barGraphSelect2.addOption(i, title);
			this.timeSelect.addOption(i, title);
		}

		// 時刻を追加
		let timeTitle = document.createElement('p');
		timeTitle.className = "property_text_title";
		timeTitle.style.paddingTop = "10px";
		timeTitle.innerText = i18next.t('timestamp');
		this.dom.appendChild(timeTitle);
		// selectを追加
		this.dom.appendChild(this.timeSelect.getDOM());

		// Latitude(緯度)
		let latTitle = document.createElement('p');
		latTitle.className = "property_text_title ";
		latTitle.style.paddingTop = "10px";
		latTitle.innerText = i18next.t('latitude');
		this.dom.appendChild(latTitle);
		// selectを追加
		this.dom.appendChild(this.barGraphSelectLat.getDOM());

		// Longitude(経度)
		let lonTitle = document.createElement('p');
		lonTitle.className = "property_text_title ";
		lonTitle.style.paddingTop = "10px";
		lonTitle.innerText = i18next.t('longitude');
		this.dom.appendChild(lonTitle);
		// selectを追加
		this.dom.appendChild(this.barGraphSelectLon.getDOM());

		// 物理量1 (棒グラフの長さ) を追加
		let colTitle1 = document.createElement('p');
		colTitle1.className = "property_text_title ";
		colTitle1.style.paddingTop = "10px";
		colTitle1.innerText = i18next.t('physical_value_1');
		this.dom.appendChild(colTitle1);
		// selectを追加
		this.dom.appendChild(this.barGraphSelect1.getDOM());

		// 物理量2 (棒グラフの色)　を追加
		let colTitle2 = document.createElement('p');
		colTitle2.className = "property_text_title";
		colTitle2.style.paddingTop = "10px";
		colTitle2.innerText = i18next.t('physical_value_2');
		this.dom.appendChild(colTitle2);
		// selectを追加
		this.dom.appendChild(this.barGraphSelect2.getDOM());

		// 初期値の設定
		if (layerProps.hasOwnProperty('bargraphParams')) {
			const bargraphParams = layerProps.bargraphParams;
			if (bargraphParams.hasOwnProperty('time')) {
				this.timeSelect.setSelectedIndex(bargraphParams.time + 1);
			}
			if (bargraphParams.hasOwnProperty('lon')) {
				this.barGraphSelectLon.setSelectedIndex(bargraphParams.lon + 1);
			}
			if (bargraphParams.hasOwnProperty('lat')) {
				this.barGraphSelectLat.setSelectedIndex(bargraphParams.lat + 1);
			}
			if (bargraphParams.hasOwnProperty('physical1')) {
				this.barGraphSelect1.setSelectedIndex(bargraphParams.physical1 + 1);
			}
			if (bargraphParams.hasOwnProperty('physical2')) {
				this.barGraphSelect2.setSelectedIndex(bargraphParams.physical2 + 1);
			}
		}

		// 各種変更イベント
		const UpdateBargraph = (err, data) => {
			this.action.changeLayerProperty({
				id: layerID,
				bargraphParams: {
					time: Number(this.timeSelect.getSelectedValue()),
					lon: Number(this.barGraphSelectLon.getSelectedValue()),
					lat: Number(this.barGraphSelectLat.getSelectedValue()),
					physical1: Number(this.barGraphSelect1.getSelectedValue()),
					physical2: Number(this.barGraphSelect2.getSelectedValue()),
				}
			});
		};

		this.timeSelect.on(Select.EVENT_CHANGE, UpdateBargraph);
		this.barGraphSelectLon.on(Select.EVENT_CHANGE, UpdateBargraph);
		this.barGraphSelectLat.on(Select.EVENT_CHANGE, UpdateBargraph);
		this.barGraphSelect1.on(Select.EVENT_CHANGE, UpdateBargraph);
		this.barGraphSelect2.on(Select.EVENT_CHANGE, UpdateBargraph);
	}

	// レイヤーID、プロパティをもとに初期値を設定
	// レイヤーを選択しなおすたびに毎回呼ぶ.
	initFromLayer(layerID, layerProps) {
		// console.error(layerProps)

		const isBarGraph = (layerProps.hasOwnProperty('isBarGraph') && layerProps.isBarGraph);
		const isOBJ = (layerProps.hasOwnProperty('isOBJ') && layerProps.isOBJ);

		if (this.opacitySlider) {
			this.opacitySlider.off(PropertySlider.EVENT_CHANGE, this.onOpacityChange)
			this.opacitySlider.release();
			this.opacitySlider = null;
		}
		this.dom.innerHTML = "";

		// レイヤーURLタイトル
		let layerURLTitle = document.createElement('p');
		layerURLTitle.className = "property_text_title";
		layerURLTitle.innerText = "URL";
		this.dom.appendChild(layerURLTitle);

		// レイヤーURL
		this.layerURL = document.createElement('p');
		this.layerURL.className = "property_text";
		this.layerURL.innerText = layerProps.url;
		if (layerProps.hasOwnProperty('file')) {
			this.layerURL.innerText += layerProps.file;
		}
		this.dom.appendChild(this.layerURL);

		// visible
		if (layerProps.type !== ITownsConstants.TypeElevation) {
			this.addVisible(layerID, layerProps);
		}

		// bbox
		if (layerProps.type === ITownsConstants.TypePointCloud
			|| layerProps.type === ITownsConstants.TypePointCloudTimeSeries) {
			this.addBBox(layerID, layerProps);
		}

		// opacity
		if (layerProps.type !== ITownsConstants.TypeElevation &&
			layerProps.type !== ITownsConstants.TypeAtomosphere
		) {
			this.addOpacity(layerID, layerProps);
		}

		// scale
		if (layerProps.type === ITownsConstants.TypeElevation
			|| isBarGraph
			|| isOBJ) {
			this.addScale(layerID, layerProps);
		}

		// point size
		if (layerProps.type === ITownsConstants.TypePointCloud
			|| layerProps.type === ITownsConstants.TypePointCloudTimeSeries) {
			this.addPointSize(layerID, layerProps);
		}

		// bbox size
		if (isBarGraph) {
			this.addBBoxSize(layerID, layerProps);
		}

		// wireframe
		if (layerProps.type === ITownsConstants.Type3DTile
			|| layerProps.type === ITownsConstants.TypeGeometry
			|| layerProps.type === ITownsConstants.TypeUser
			|| layerProps.type === ITownsConstants.TypeGlobe
			|| isBarGraph) {
			this.addWireFrame(layerID, layerProps);
		}

		// sseThreshold
		if (layerProps.type === ITownsConstants.Type3DTile
			|| layerProps.type === ITownsConstants.TypePointCloud
			|| layerProps.type === ITownsConstants.TypePointCloudTimeSeries) {
			this.addSSEThreashold(layerID, layerProps);
		}

		// attribution url
		this.addAttribution(layerID, layerProps);

		this.action.changeTimelineRangeBar({});
		if (layerProps.type === ITownsConstants.TypePointCloudTimeSeries
			|| isBarGraph) {
			this.addTimeList(layerID, layerProps);
		}

		if (isBarGraph) {
			this.addBargraphColumns(layerID, layerProps);
		}

		if (!isBarGraph) {
			// offset_small_uv
			// offset_uvの1度の区間を1000分の1にしたスライダー
			if (layerProps.type === ITownsConstants.TypePointCloud
				|| layerProps.type === ITownsConstants.TypePointCloudTimeSeries
				|| layerProps.type === ITownsConstants.Type3DTile
				|| layerProps.type === ITownsConstants.TypeGeometry) {
				this.addOffsetUV(layerID, layerProps);
			}
		}
	}

	getDOM() {
		return this.dom;
	}
}

export default LayerProperty;
