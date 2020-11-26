/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import Button from "./button";
import Select from "./select";
import Input from "./input";

class RadioButton extends EventEmitter
{
    constructor(radioName){
        super();
        this.dom = this.createUI(radioName);
    }

    createUI(radioName){
        const dom = document.createElement("div");
        dom.style.padding = "10px";

        this.form = document.createElement("form");
        this.form.style.display = "flex";
        this.form.style.flexDirection = "column";
        this.radioName = radioName;

        dom.appendChild(this.form);

        return dom;
    }

    _createRadio(value){
        const label = document.createElement("label");
        label.style.display = "inline";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = this.radioName;
        radio.value = value;
        label.appendChild(radio);

        return label;
    }

    addRadio(value,dom){
        const radio = this._createRadio(value);
        if(this.form.childNodes.length === 0){
            radio.childNodes[0].checked = true;
        }
        radio.appendChild(dom);
        this.form.appendChild(radio);
        console.log(this.form.childNodes);
    }

    getSelected(){
        return this.form[this.radioName].value;
    }

    getDOM(){
        return this.dom;
    }
}

RadioButton.EVENT_CHANGE = "radiobutton_change";

export default RadioButton;
