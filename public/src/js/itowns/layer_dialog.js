/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import PopupBackground from "../components/popup_background";
import Input from "../components/input";
import Button from "../components/button";
import Select from "../components/select";

class LayerDialog extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;

        this.data = {
            id: "",
            url: "",
            zoom : {
                min : 1,
                max : 20
            }
        };
        this.init();
        this.setting = {};
    }

    init() {
        this.dom = document.createElement('div');
        this.dom.className = "layer_dialog";

        this.wrap = document.createElement('div');
        this.wrap.className = "layer_dialog_wrap";

        let createRow = () => {
            let row = document.createElement('div');
            row.className = "layer_dialog_row";
            this.wrap.appendChild(row);
            return row;
        }

        this.title = document.createElement('p');
        this.title.className = "layer_dialog_title";
        this.title.innerText = i18next.t('add_layer');

        this.idTitle = document.createElement('p');
        this.idTitle.className = "layer_dialog_id_title";
        this.idTitle.innerText = "ID:";

        this.idInput = new Input("text");
        this.idInput.getDOM().className = "layer_dialog_id_input";
        this.idInput.setValue("Layer_" + Math.floor(Math.random() * 100));


        this.urlTitle = document.createElement('p');
        this.urlTitle.className = "layer_dialog_url_title";
        this.urlTitle.innerText = "URL:";

        this.urlInput = new Input("text");
        this.urlInput.getDOM().className = "layer_dialog_url_input";
        this.urlInput.setValue("http://localhost:8080/std/${z}/${x}/${y}.png");

        this.zoomMinTitle = document.createElement('p');
        this.zoomMinTitle.className = "layer_dialog_zoom_title";
        this.zoomMinTitle.innerText = "ZOOM: Min";

        this.zoomMaxTitle = document.createElement('p');
        this.zoomMaxTitle.className = "layer_dialog_zoom_title layer_dialog_zoom_max_title";
        this.zoomMaxTitle.innerText = "Max";

        this.zoomMinSelect = new Select();
        for (let i = 1; i <= 20; ++i) {
            this.zoomMinSelect.addOption(i, String(i));
        }
        this.zoomMinSelect.getDOM().className = "layer_dialog_zoom_min_select";

        this.zoomMaxSelect = new Select();
        for (let i = 1; i <= 20; ++i) {
            this.zoomMaxSelect.addOption(i, String(i));
        }
        this.zoomMaxSelect.getDOM().className = "layer_dialog_zoom_max_select";
        this.zoomMaxSelect.setSelectedIndex(this.zoomMaxSelect.getOptions().length - 1);

        this.okButton = new Button();
        this.okButton.setDataKey("OK");
        this.okButton.getDOM().className = "layer_dialog_ok_button btn btn-primary";
        this.dom.appendChild(this.okButton.getDOM());

        this.cancelButton = new Button();
        this.cancelButton.setDataKey("Cancel");
        this.cancelButton.getDOM().className = "layer_dialog_cancel_button btn btn-light";
        this.dom.appendChild(this.cancelButton.getDOM());

        this.dom.appendChild(this.wrap);
        this.wrap.appendChild(this.title);
        let idRow = createRow();
        idRow.appendChild(this.idTitle);
        idRow.appendChild(this.idInput.getDOM());
        let titleRow = createRow();
        titleRow.appendChild(this.urlTitle);
        titleRow.appendChild(this.urlInput.getDOM());
        let zoomRow = createRow();
        zoomRow.appendChild(this.zoomMinTitle);
        zoomRow.appendChild(this.zoomMinSelect.getDOM());
        zoomRow.appendChild(this.zoomMaxTitle);
        zoomRow.appendChild(this.zoomMaxSelect.getDOM());
        
        this.endCallback = null;
        let isOK = false;
        this.background = new PopupBackground();
        this.background.on('close', () => {
            this.data.url = this.urlInput.getValue();
            this.data.id = this.idInput.getValue();
            this.data.zoom.min = parseInt(this.zoomMinSelect.getSelectedValue(), 10);
            this.data.zoom.max = parseInt(this.zoomMaxSelect.getSelectedValue(), 10);

            if (this.endCallback) 
            {
                this.endCallback(isOK, this.data);
                this.endCallback = null;
            }
            this.close();
        });
        this.okButton.on('click', () => {
            isOK = true;
            this.background.close();
        });

        this.cancelButton.on('click', () => {
            isOK = false;
            this.background.close();
        });
    }

    close() {
        this.dom.style.display = "none";
    }

    show(endCallback) {
        this.idInput.setValue("Layer_" + Math.floor(Math.random() * 100));

        this.endCallback = endCallback;
        this.dom.style.display = "block";
        this.background.show(this.setting.opacity, this.setting.zIndex);

    }

    getDOM() {
        return this.dom;
    }
}

export default LayerDialog;