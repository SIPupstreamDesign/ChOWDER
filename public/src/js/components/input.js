/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

class Input extends EventEmitter
{
    constructor(type) {
        super();

        this.type = type;

        this.dom = document.createElement('input');
        this.dom.setAttribute('type', type);
        
        this.dom.style.color = "black";
        this.dom.value = "";

        this.dom.oninput = (evt) => {
            this.emit(Input.EVENT_INPUT, null, evt);
        }
        this.dom.onchange = (evt) => {
            this.emit(Input.EVENT_CHANGE, null, evt);
        }
    }

    setDataKey(dataKey) {
        this.dom.setAttribute('data-key', dataKey);
        this.dom.textContent = i18next.t(dataKey);
    }

    setValue(value) {
        this.dom.value = value;
    }

    getValue() {
        return this.dom.value;
    }

    check(checked) {
        this.dom.checked = checked;
    }

    setEnable(enable) {
        this.dom.disabled = !enable;
    }

    getChecked() {
        return this.dom.checked;
    }

    getDOM() {
        return this.dom;
    }
}

Input.EVENT_INPUT = "input";
Input.EVENT_CHANGE = "change";

export default Input;