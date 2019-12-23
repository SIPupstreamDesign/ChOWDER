/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

class Select extends EventEmitter
{
    constructor() {
        super();

        this.dom = document.createElement('select');
        this.dom.style.color = "black";
        this.dom.setAttribute('type', 'button');
        this.dom.value = "";

        this.dom.onchange = (evt) => {
            this.emit(Select.EVENT_CHANGE, null, evt);
        }
    }

    setDataKey(dataKey) {
        this.dom.setAttribute('data-key', dataKey);
        this.dom.textContent = i18next.t(dataKey);
    }

    setSelectedIndex(index) {
        this.dom.selectedIndex = index;
    }

    addOption(value, textContent) {
        let option = document.createElement('option');
        option.value = value;
        option.textContent = textContent;
        this.dom.appendChild(option);
    }

    getOptions() {
        return this.dom.options;
    }

    getSelectedIndex() {
        return this.dom.selectedIndex;
    }

    getSelectedValue() {
        return this.dom.childNodes[this.getSelectedIndex()].value;
    }

    clear() {
        this.dom.innerHTML = "";
    }

    getDOM() {
        return this.dom;
    }
}

Select.EVENT_CHANGE = "change";

export default Select;