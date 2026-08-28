/**
 * Copyright (c) 2021 National Institute of Information and Communications Technology (NICT). All rights reserved.
 */

import PropertySlider from "../components/property_slider"
import GUIUtil from "./gui_util"

class LayerProperty extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;

        this.dom = document.createElement('div');
        this.dom.className = "layer_property";
        this.dom.style.display = "block";
        /*
        this.dom.style.position = "absolute";
        this.dom.style.width = "250px"
        this.dom.style.height = "90%"
        this.dom.style.left = "10px";
        this.dom.style.top = "10px";
        this.dom.style.opacity = "0.9"
        this.dom.style.backgroundColor = "gray";
        */

        this.visible = true;

        /*
        this.init("Layer_" + 0, {
            opacity: 1.0,
            visible: true
        });
        */
       this._onOpacityChanged = null;
    }

    onOpacityChanged(layerID, layerProps) {
        return (err, data) => {
             this.action.changeLayerProperty({
                 id: layerID,
                 opacity: data
             });
         };
     }

    // レイヤーID、プロパティをもとに初期値を設定
    // レイヤーを選択しなおすたびに毎回呼ぶ.
    init(layerID, layerProps) {
        
		if (this.opacitySlider) {
			this.opacitySlider.off(PropertySlider.EVENT_CHANGE, this._onOpacityChange)
			this.opacitySlider.release();
			this.opacitySlider = null;
		}

        this.dom.innerHTML = "";
        
        if (layerID !== null && layerProps !== null) {
            // レイヤーURLタイトル
            let layerURLTitle = document.createElement('p');
            layerURLTitle.className = "tileviewer_property_text_title";
            layerURLTitle.innerText = "URL";
            this.dom.appendChild(layerURLTitle);

            // レイヤーURL
            this.layerURL = document.createElement('p');
            this.layerURL.className = "tileviewer_property_text";
            this.layerURL.innerText = layerProps.url;
            this.dom.appendChild(this.layerURL);

            this.addVisible(layerID, layerProps)
            this.addOpacity(layerID, layerProps);
            //this.addFixedZoomLevel(layerID, layerProps);
            //this.addZoomLevel(layerID, layerProps);
            this.addAttribution(layerID, layerProps);
        }
    }

    addVisible(layerID, layerProps) {
        if (layerProps && layerProps.hasOwnProperty('visible')) {
            GUIUtil.addCheckProperty(this.dom, layerID && layerProps, "visible", "visible", layerProps.visible, (err, data) => {
                this.action.changeLayerProperty({
                    id: layerID,
                    visible: data
                })
            });
        } else {
            GUIUtil.addCheckProperty(this.dom, layerID && layerProps, "visible", "visible", true, (err, data) => {
                this.action.changeLayerProperty({
                    id: layerID,
                    visible: data
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
        this._onOpacityChanged = this.onOpacityChanged(layerID, layerProps)
        this.opacitySlider.on(PropertySlider.EVENT_CHANGE, this._onOpacityChanged);
        this.dom.appendChild(this.opacitySlider.getDOM());
    }


    addAttribution(layerID, layerProps) {
        // Attributionタイトル
        let attributionTitle = document.createElement('p');
        attributionTitle.className = "tileviewer_property_text_title";
        attributionTitle.innerText = "Attribution";
        attributionTitle.style.paddingTop = "10px";
        this.dom.appendChild(attributionTitle);

        // Attribution枠
        let attributionDiv = document.createElement('div');
        attributionDiv.style.height = "auto";
        attributionDiv.style.border = "1px solid gray"
        attributionDiv.style.marginLeft = "5px";
        attributionDiv.style.marginRight = "5px";
        this.dom.appendChild(attributionDiv);

        // Attribution - Name
        let attributionName = document.createElement('p');
        attributionName.className = "tileviewer_property_text_title tileviewer_attribution_title";
        attributionName.innerText = "Name";
        attributionDiv.appendChild(attributionName);
        const attribName = layerProps.hasOwnProperty('attribution') ? layerProps.attribution.name : "";
        GUIUtil.addTextAreaProperty(attributionDiv, layerID && layerProps, "name", "", attribName, (err, data) => {
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
        attributionURL.className = "tileviewer_property_text_title tileviewer_attribution_title";
        attributionURL.innerText = "URL";
        attributionDiv.appendChild(attributionURL);
        const attribURL = layerProps.hasOwnProperty('attribution') ? layerProps.attribution.url : "";
        GUIUtil.addTextAreaProperty(attributionDiv, layerID && layerProps, "url", "", attribURL, (err, data) => {
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

    toggleShow() {
        if (this.visible) {
            this.dom.style.display = "none";
            this.visible = false;
        } else {
            this.dom.style.display = "block";
            this.visible = true;
        }
    }

    getDOM() {
        return this.dom;
    }
}

export default LayerProperty;