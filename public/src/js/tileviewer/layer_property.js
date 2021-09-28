import Input from "../components/input"
import PropertySlider from "../components/property_slider"
import LayerList from './layer_list'

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