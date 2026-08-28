/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import Button from "./button";
import Select from "./select";
import Input from "./input";

class ContentsSelect extends EventEmitter
{
    constructor(){
        super();
        this.dom = this.createUI();
    }

    createUI(){
        const dom = document.createElement("div");
        dom.style.display = "inline-block";

        const label = document.createElement("div");
        label.style.display = "inline-block";
        label.style.padding = "10px";
        label.textContent = "登録済みコンテンツを読み込み: "
        dom.appendChild(label);


        this.select = new Select();

        this.select.on(Select.EVENT_CHANGE,(err,event)=>{
            this.emit(ContentsSelect.EVENT_CHANGE, err, event);
        })
        dom.appendChild(this.select.getDOM());

        return dom;
    }

    addOption(value,name){
        this.select.addOption(value, name);
    }

    getSelectedValue(){
        return this.select.getSelectedValue();
    }

    getDOM(){
        return this.dom;
    }
}

ContentsSelect.EVENT_CHANGE = "contentsselect_change";

export default ContentsSelect;
