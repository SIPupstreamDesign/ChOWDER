/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import Button from "./button";
import Select from "./select";
import Input from "./input";

class UploadMenu extends EventEmitter
{
    constructor(){
        super();
        this.dom = this.createUploadUI();
    }

    createUploadUI(){
        const dom = document.createElement("div");
        dom.style.display = "inline-block";
        dom.style.backgroundColor = "aqua";
        dom.style.padding = "10px";

        const fileinput = document.createElement("input");
        fileinput.type = "file";
        fileinput.id = "uploadfile";
        dom.appendChild(fileinput);

        // const button = document.createElement("input");
        // button.type = "button";
        // button.value = "send";
        // dom.appendChild(button);

        // button.addEventListener("click",(err)=>{
        //     this.emit(UploadMenu.EVENT_UPLOAD, err);
        // });

        return dom;
    }

    getDOM(){
        return this.dom;
    }
}

UploadMenu.EVENT_UPLOAD = "uploadmenu_upload";

export default UploadMenu;
