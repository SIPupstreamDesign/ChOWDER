/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Input from "./input";
import Button from "./button"

class ZoomControl extends EventEmitter {
    constructor(name, initialValue, minValue, maxValue) {
        super();

        this.minValue = minValue;
        this.maxValue = maxValue;

        this.dom = document.createElement('div');

        let group = document.createElement('div');
        group.className = "input-group zoom_control_group";

        let leftSpan = document.createElement('span');

        leftSpan.className = "zoom_control input-group-addon zoom_control_left_span";
        leftSpan.style.borderRadius = "4px 0px 0px 4px"
        leftSpan.innerHTML = name;

        let rightSpan = document.createElement('span');
        rightSpan.className = "zoom_control input-group-addon zoom_control_right_span";
        rightSpan.style.borderRadius = "0px 4px 4px 0px"

        this.subButton = new Button();
        this.subButton.setDataKey("◀");
        this.subButton.getDOM().className = "zoom_control_sub_button";

        this.levelInput = new Input("text");
        this.levelInput.setValue(initialValue);
        this.levelInput.getDOM().className = "zoom_control_input"
        this.levelInput.getDOM().style.textAlign = "center";
        this.levelInput.getDOM().style.width = "40px";

        this.addButton = new Button();
        this.addButton.setDataKey("▶");
        this.addButton.getDOM().className = "zoom_control_add_button";

        group.appendChild(leftSpan);
        group.appendChild(this.subButton.getDOM());
        group.appendChild(this.levelInput.getDOM());
        group.appendChild(this.addButton.getDOM());
        group.appendChild(rightSpan);

        this.levelInput.on("change", (evt) => {
            this.emit(ZoomControl.EVENT_CHANGE, null, {
                value: this.getValue()
            });
        });

        this.addButton.on('click', (evt) => {
            const value = Number(this.levelInput.getValue());
            if (value < maxValue) {
                this.levelInput.setValue(value + 1);
                this.emit(ZoomControl.EVENT_CHANGE, null, {
                    value: this.getValue()
                });
            }
        });

        this.subButton.on('click', (evt) => {
            const value = Number(this.levelInput.getValue());
            if (value > minValue) {
                this.levelInput.setValue(value - 1);
                this.emit(ZoomControl.EVENT_CHANGE, null, {
                    value: this.getValue()
                });
            }
        });

        this.dom.appendChild(group);
    }

    getValue() {
        return this.levelInput.getValue();
    }

    setValue(value) {
        if (value >= this.minValue && value <= this.maxValue) {
            this.levelInput.setValue(value);
        }
    }

    setMinValue(minValue) {
        this.minValue = minValue;
    }

    setMaxValue(maxValue) {
        this.maxValue = maxValue;
    }

    getMinValue() {
        return this.minValue;
    }

    getMaxValue() {
        return this.maxValue;
    }

    setEnable(isEnable) {
        if (!isEnable) {
            this.dom.style.pointerEvents = "none";
            this.levelInput.getDOM().style.background = "lightgray";
            this.addButton.getDOM().style.color = "lightgray";
            this.subButton.getDOM().style.color = "lightgray";
        } else {
            this.dom.style.pointerEvents = "auto";
            this.levelInput.getDOM().style.background = "white";
            this.addButton.getDOM().style.color = "dodgerblue";
            this.subButton.getDOM().style.color = "dodgerblue";
        }
    }

    getDOM() {
        return this.dom;
    }
}

ZoomControl.EVENT_CHANGE = "change";

export default ZoomControl;