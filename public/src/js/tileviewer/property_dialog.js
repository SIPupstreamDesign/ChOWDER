import PropertySlider from "../components/property_slider"

class PropertyDialog extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;

        this.dom = document.createElement('div');
        this.dom.className = "layer_property";
        this.dom.style.display = "none";
        this.dom.style.position = "absolute";
        this.dom.style.width = "250px"
        this.dom.style.height = "90%"
        this.dom.style.left = "10px";
        this.dom.style.top = "10px";
        this.dom.style.opacity = "0.9"
        this.dom.style.backgroundColor = "gray";

        this.init();
    }

    // レイヤーID、プロパティをもとに初期値を設定
    // レイヤーを選択しなおすたびに毎回呼ぶ.
    init(layerID, layerProps) {
        this.addOpacity("Layer_" + 0, {
            opacity: 1.0
        });
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

    show() {
        this.dom.style.display = "block";
    }

    getDOM() {
        return this.dom;
    }
}

export default PropertyDialog;