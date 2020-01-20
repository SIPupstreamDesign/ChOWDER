/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
"use strict";

import Input from "../components/input"
import PropertySlider from "../components/property_slider"

/**
 * Propertyタブに入力プロパティを追加する
 * @method addInputProperty
 * @param {String} leftLabel 左ラベル
 * @param {String} rightLabel 右ラベル
 * @param {String} value 初期入力値
 */
function addInputProperty(parentElem, isEditable, leftLabel, rightLabel, value, changeCallback) {
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
	let input = document.createElement('input');

	group.className = "input-group";
	leftSpan.className = "input-group-addon";
	leftSpan.innerHTML = leftLabel;
	rightSpan.className = "input-group-addon";
	rightSpan.innerHTML = rightLabel;
	input.className = "form-control";
	input.value = value;
	input.disabled = !isEditable;

	group.appendChild(leftSpan);
	group.appendChild(input);
	if (rightLabel) {
		group.appendChild(rightSpan);
	}
	parentElem.appendChild(group);

	input.onchange = (evt) => {
        try {
            let val = parseFloat(evt.target.value);
            if (!isNaN(val)) {
                changeCallback(null, val);
            } else {
                throw false;
            }
        } catch(ex) {
            input.value = 1.0;
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

        this.layerID = null;
        this.layerProps = null;

        addCheckProperty(this.dom, false, "visible", "visible", true, (err, data) => {
        });
		this.slider = new PropertySlider(false, "opacity", "", 1.0);
		this.dom.appendChild(this.slider.getDOM());
    }

    // レイヤーID、プロパティをもとに初期値を設定
    // レイヤーを選択しなおすたびに毎回呼ぶ.
    initFromLayer(layerID, layerProps) {
		if (this.slider) {
			this.slider.release();
		}
        this.dom.innerHTML = "";

		if (layerProps && layerProps.hasOwnProperty('visible')) {
			addCheckProperty(this.dom, layerID && layerProps, "visible", "visible", layerProps.visible, (err, data) => {
				this.action.changeLayerProperty({
					id : layerID,
					visible : data
				})
			});
		} else {
			addCheckProperty(this.dom, layerID && layerProps, "visible", "visible", true, (err, data) => {
				this.action.changeLayerProperty({
					id : layerID,
					visible : data
				})
			});
		}

		if (layerProps && layerProps.hasOwnProperty('opacity')) {
			this.slider = new PropertySlider(layerID && layerProps, "opacity", "", layerProps.opacity);
		} else {
			this.slider = new PropertySlider(layerID && layerProps, "opacity", "", 1.0);
		}
		this.slider.on(PropertySlider.EVENT_CHANGE, (err, val) => {
            this.action.changeLayerProperty({
                id : layerID,
                opacity : val
            })
		})
		this.dom.appendChild(this.slider.getDOM());
    }

    getDOM() {
        return this.dom;
    }
}

export default LayerProperty;
