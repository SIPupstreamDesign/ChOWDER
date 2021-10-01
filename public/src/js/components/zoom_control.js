/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Input from "./input";
import Button from "./button"

class ZoomControl extends EventEmitter {
    constructor(name, initialValue, minValue, maxValue) {
        super();

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

        let subButton = new Button();
        subButton.setDataKey("◀");
        subButton.getDOM().className = "zoom_control_sub_button";

        let levelInput = new Input("text");
        levelInput.setValue(initialValue);
        levelInput.getDOM().className = "zoom_control_input"
        levelInput.getDOM().style.textAlign = "center";
        levelInput.getDOM().style.width = "40px";

        let addButton = new Button();
        addButton.setDataKey("▶");
        addButton.getDOM().className = "zoom_control_add_button";

        group.appendChild(leftSpan);
        group.appendChild(subButton.getDOM());
        group.appendChild(levelInput.getDOM());
        group.appendChild(addButton.getDOM());
        group.appendChild(rightSpan);

        levelInput.on("change", (evt) => {
            this.emit(ZoomControl.EVENT_CHANGE, null, evt);
        });

        addButton.on('click', (evt) => {
            const value = Number(levelInput.getValue());
            if (value < maxValue) {
                levelInput.setValue(value + 1);
            }
        });

        subButton.on('click', (evt) => {
            const value = Number(levelInput.getValue());
            if (value > minValue) {
                levelInput.setValue(value - 1);
            }
        });

        this.dom.appendChild(group);
    }

    setEnable(isEnable) {
        if (!isEnable) {
            this.dom.style.pointerEvents = "none";
        } else {
            this.dom.style.pointerEvents = "auto";
        }
    }

    getDOM() {
        return this.dom;
    }
}

ZoomControl.EVENT_CHANGE = "change";

export default ZoomControl;