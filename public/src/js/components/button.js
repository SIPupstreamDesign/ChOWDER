/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

class Button extends EventEmitter
{
    constructor() {
        super();

        this.dom = document.createElement('input');
        this.dom.className = "btn";
        this.dom.style.color = "black";
        this.dom.setAttribute('type', 'button');
        this.dom.value = "";

        this.dom.onclick = (evt) => {
            this.emit(Button.EVENT_CLICK, null, evt);
        }
    }

    setDataKey(dataKey) {
        this.dom.setAttribute('data-key', dataKey);        
        this.dom.value = i18next.t(dataKey);
    }

    getDOM() {
        return this.dom;
    }
}

Button.EVENT_CLICK = "click";

export default Button;