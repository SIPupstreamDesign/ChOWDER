/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
"use strict";

import Input from "../components/input"
import PropertySlider from "../components/property_slider"
import ITownsConstants from "./itowns_constants";

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

		/*
        addCheckProperty(this.dom, false, "visible", "visible", true, (err, data) => {
        });
		this.opacitySlider = new PropertySlider(false, "opacity", "", 1.0);
		this.dom.appendChild(this.opacitySlider.getDOM());
		*/

		this.scaleSlider = null;
		this.sizeSlider = null;
	}
	

    // レイヤーID、プロパティをもとに初期値を設定
    // レイヤーを選択しなおすたびに毎回呼ぶ.
    initFromLayer(layerID, layerProps) {
		if (this.opacitySlider) {
			this.opacitySlider.off(PropertySlider.EVENT_CHANGE, this.onOpacityChange)
			this.opacitySlider.release();
			this.opacitySlider = null;
		}
		this.dom.innerHTML = "";
		
        // レイヤーURLタイトル
        let layerURLTitle = document.createElement('p');
        layerURLTitle.className = "property_text_title";
        layerURLTitle.innerHTML = "URL";
        this.dom.appendChild(layerURLTitle);

        // レイヤーURL
        this.layerURL = document.createElement('p');
		this.layerURL.className = "property_text";
		this.layerURL.innerText = layerProps.url;
		if (layerProps.hasOwnProperty('file')) {
			this.layerURL.innerText += layerProps.file;
		}
		this.dom.appendChild(this.layerURL);
		console.log(layerProps)

		// visible
		if (layerProps.type !== ITownsConstants.TypeElevation) {
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
		}

		// opacity
		if (layerProps.type !== ITownsConstants.TypeElevation) {
			if (layerProps && layerProps.hasOwnProperty('opacity')) {
				this.opacitySlider = new PropertySlider(layerID && layerProps, "opacity", "", layerProps.opacity);
			} else {
				this.opacitySlider = new PropertySlider(layerID && layerProps, "opacity", "", 1.0);
			}	
			this.opacitySlider.on(PropertySlider.EVENT_CHANGE,  (err, data) => {
				this.action.changeLayerProperty({
					id : layerID,
					opacity : data
				});
			});
			this.dom.appendChild(this.opacitySlider.getDOM());
		}
		
		// scale
		if (layerProps.type === ITownsConstants.TypeElevation) {
			if (layerProps && layerProps.hasOwnProperty('scale')) {
				this.scaleSlider = new PropertySlider(layerID && layerProps, "scale", "", layerProps.scale / 20.0, 20, true);
			} else {
				this.scaleSlider = new PropertySlider(layerID && layerProps, "scale", "", 1 / 20.0, 20, true);
			}	
			this.scaleSlider.on(PropertySlider.EVENT_CHANGE,  (err, data) => {
				this.action.changeLayerProperty({
					id : layerID,
					scale : data
				});
			});
			this.dom.appendChild(this.scaleSlider.getDOM());
		}
		
		// size
		if (layerProps.type === ITownsConstants.TypePointCloud) 
		{
			if (layerProps && layerProps.hasOwnProperty('pointSize')) {
				this.sizeSlider = new PropertySlider(layerID && layerProps, "size", "", layerProps.pointSize / 20.0, 20, true, 1);
			} else {
				this.sizeSlider = new PropertySlider(layerID && layerProps, "size", "", 4 / 20.0, 20, true, 1);
			}	
			this.sizeSlider.on(PropertySlider.EVENT_CHANGE,  (err, data) => {
				this.action.changeLayerProperty({
					id : layerID,
					pointSize : data
				});
			});
			this.dom.appendChild(this.sizeSlider.getDOM());
		}
		
		// wireframe
		if (layerProps.type === ITownsConstants.Type3DTile || layerProps.type === ITownsConstants.TypeGeometry) 
		{
			if (layerProps && layerProps.hasOwnProperty('wireframe')) {
				addCheckProperty(this.dom, layerID && layerProps, "wireframe", "wireframe", layerProps.wireframe, (err, data) => {
					this.action.changeLayerProperty({
						id : layerID,
						wireframe : data
					})
				});
			} else {
				addCheckProperty(this.dom, layerID && layerProps, "wireframe", "wireframe", false, (err, data) => {
					this.action.changeLayerProperty({
						id : layerID,
						wireframe : data
					})
				});
			}
		}

		// offset_xyz
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
					id : layerID,
					offset_xyz : {
						x : this.offsetX.getValue(),
						y : this.offsetY.getValue(),
						z : this.offsetZ.getValue(),
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
		
		// offset_uv
		if (layerProps.type !== ITownsConstants.TypeColor && 
			layerProps.type !== ITownsConstants.TypeElevation) {
			if (layerProps && layerProps.hasOwnProperty('offset_uvw')) {
				this.offsetU = new PropertySlider(layerID && layerProps, "offset u", "", layerProps.offset_uvw.u / 2000.0 + 0.5, 2000, false, -1000, 1000)
				this.offsetV = new PropertySlider(layerID && layerProps, "offset v", "", layerProps.offset_uvw.v / 2000.0 + 0.5, 2000, false, -1000, 1000)
				this.offsetW = new PropertySlider(layerID && layerProps, "offset w", "", layerProps.offset_uvw.w / 2000.0 + 0.5, 2000, false, -1000, 1000)
			} else {
				this.offsetU = new PropertySlider(layerID && layerProps, "offset u", "", 0.5, 2000, false, -1000, 1000);
				this.offsetV = new PropertySlider(layerID && layerProps, "offset v", "", 0.5, 2000, false, -1000, 1000);
				this.offsetW = new PropertySlider(layerID && layerProps, "offset w", "", 0.5, 2000, false, -1000, 1000);
			}
			const UpdateOffset = (err, data) => {
				this.action.changeLayerProperty({
					id : layerID,
					offset_uvw : {
						u : this.offsetU.getValue(),
						v : this.offsetV.getValue(),
						w : this.offsetW.getValue()
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

    getDOM() {
        return this.dom;
    }
}

export default LayerProperty;
