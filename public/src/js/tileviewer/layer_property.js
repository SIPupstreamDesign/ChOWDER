import Input from "../components/input"
import PropertySlider from "../components/property_slider"
import LayerList from './layer_list'
import ZoomControl from '../components/zoom_control'

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
    input.style.maxWidth = "215px"
    input.style.width = "215px"
    input.style.height = "auto"

    group.className = "input-group";
    group.style.margin = "0px";
    group.style.marginLeft = "5px";
    group.style.marginBottom = "5px";
    group.style.paddingBottom = "5px";
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
    }

    // レイヤーID、プロパティをもとに初期値を設定
    // レイヤーを選択しなおすたびに毎回呼ぶ.
    init(layerID, layerProps) {
        this.dom.innerHTML = "";
        this.addVisible(layerID, layerProps)
        this.addOpacity(layerID, layerProps);
        this.addFixedZoomLevel(layerID, layerProps);
        this.addZoomLevel(layerID, layerProps);
        this.addAttribution(layerID, layerProps);
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

    addFixedZoomLevel(layerID, layerProps) {
        if (layerProps.type === "image") return;

        // TODO レイヤーではなくコンテンツごとにzoomLevelを持つ
        if (layerProps && layerProps.hasOwnProperty('fixedZoomLevel')) {
            addCheckProperty(this.dom, layerID && layerProps, "fixedZoomLevel", "enable fixed zoom", layerProps.fixedZoomLevel, (err, data) => {
                //let layer = this.store.getLayerData(layerID);
                //this.zoomControl.setValue(layer.zoomLevel);
                this.zoomControl.setEnable(data);
                this.action.changeLayerProperty({
                    id: layerID,
                    fixedZoomLevel: data
                })
            });
        } else {
            addCheckProperty(this.dom, layerID && layerProps, "fixedZoomLevel", "enable fixed zoom", false, (err, data) => {
                //let layer = this.store.getLayerData(layerID);
                //this.zoomControl.setValue(layer.zoomLevel);
                this.zoomControl.setEnable(data);
                this.action.changeLayerProperty({
                    id: layerID,
                    fixedZoomLevel: data
                })
            });
        }
    }

    addZoomLevel(layerID, layerProps) {
        if (layerProps.type === "image") return;

        // TODO レイヤーではなくコンテンツごとにzoomLevelを持つ
        if (layerProps && layerProps.hasOwnProperty('zoomLevel')) {
            this.zoomControl = new ZoomControl("zoom level", layerProps.zoomLevel, 0, 20);
        } else {
            this.zoomControl = new ZoomControl("zoom level", 0, 0, 20);
        }
        this.zoomControl.setEnable(layerProps.fixedZoomLevel);
        this.zoomControl.on(ZoomControl.EVENT_CHANGE, (err, data) => {
            this.action.changeLayerProperty({
                id: layerID,
                zoomLevel: data.value
            });
        });
        this.dom.appendChild(this.zoomControl.getDOM());
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
        attributionURL.className = "tileviewer_property_text_title tileviewer_attribution_title";
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
LayerProperty.EVENT_LAYER_PROPERTY_NEED_UPDATE_GUI = "layer_property_need_update_gui";

export default LayerProperty;