/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
"use strict";

import Input from "../components/input"
import PropertySlider from "../components/property_slider"

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

class GUIProperty extends EventEmitter {
	constructor(store, action) {
		super();

		this.store = store;
		this.action = action;

		this.dom = document.createElement('div');
		this.dom.className = "gui_property";
	}

	// プロパティをもとに初期値を設定
	initFromProps(metaData) {
		this.dom.innerHTML = "";
		const displayProperty = JSON.parse(metaData.displayProperty);
		// label
		if (displayProperty && displayProperty.hasOwnProperty('label')) {
			addCheckProperty(this.dom, true, "props_label", "label", displayProperty.label, (err, data) => {
				this.action.changeProperty({
					label: data
				})
			});
		} else {
			addCheckProperty(this.dom, true, "label", "label", true, (err, data) => {
				// this.action.changeLayerProperty({
				// 	visible: data
				// })
			});
		}

		// wireframe
		if (displayProperty && displayProperty.hasOwnProperty('wireframe')) {
			addCheckProperty(this.dom, true, "wireframe", "wireframe", displayProperty.wireframe, (err, data) => {
				this.action.changeProperty({
					wireframe: data
				})
			});
		} else {
			addCheckProperty(this.dom, true, "wireframe", "wireframe", false, (err, data) => {
				// this.action.changeLayerProperty({
				// 	wireframe: data
				// })
			});
		}

		const resetCameraButton = document.createElement("input");
		resetCameraButton.type = "button";
		resetCameraButton.value = "ResetCamera";
		resetCameraButton.addEventListener("click",()=>{
			const metaData = this.store.getMetaData();
			
			this.action.updateRenderCamera({
				mat:metaData.initCameraMatrix,
				params:"nodata"
			});
		});
		this.dom.appendChild(resetCameraButton);


	}

	getDOM() {
		return this.dom;
	}
}

export default GUIProperty;
