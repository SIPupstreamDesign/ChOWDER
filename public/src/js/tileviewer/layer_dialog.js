/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Store from "./store.js";
import PopupBackground from "../components/popup_background";
import Input from "../components/input";
import Button from "../components/button";
import Select from "../components/select";
import TileViewerConstants from "./tileviewer_constants.js"

const SampleURLFileNames = {}
SampleURLFileNames[TileViewerConstants.TypeStandard] = "std/%z/%x/%y.png";
SampleURLFileNames[TileViewerConstants.TypeElevation] = "std/{z}/{x}/{y}.png";
SampleURLFileNames[TileViewerConstants.TypeHimawariJP] = "%cd/%w/2019/04/30/000000_%x_%y.png";
SampleURLFileNames[TileViewerConstants.TypeHimawariFD] = "%cd/%w/2019/04/30/000000_%x_%y.png";
SampleURLFileNames[TileViewerConstants.TypeBackground] = "background.png";
SampleURLFileNames[TileViewerConstants.TypeNone] = "std/%z/%x/%y.png";

class LayerDialog extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;

        this.init();
        this.setting = {};
    }

    changeInputURLValue(fileName) {
        const port = window.location.port ? ":" + window.location.port : "";
        this.urlInput.value = window.location.protocol + "//" + window.location.hostname + port + "/" + fileName;
    }

    init() {
        this.dom = document.createElement('div');
        this.dom.className = "layer_dialog";

        this.wrap = document.createElement('div');
        this.wrap.className = "layer_dialog_wrap";

        this.title = document.createElement('p');
        this.title.className = "layer_dialog_title";
        this.title.innerText = i18next.t('add_layer');
        this.wrap.appendChild(this.title);

        this.createRow = () => {
            let row = document.createElement('div');
            row.className = "layer_dialog_row";
            this.wrap.appendChild(row);
            return row;
        }

        this.createTypeRow();
        this.createIDRow();
        this.createURLRow();
        this.createZoomRow();

        this.createErrorText();

        this.endCallback = null;
        this.createPopupBackground();

        this.dom.appendChild(this.wrap);
    }

    createTypeRow() {
        this.typeTitle = document.createElement('p');
        this.typeTitle.className = "layer_dialog_sub_title";
        this.typeTitle.innerText = "Type:";
        this.typeSelect = new Select();
        this.typeSelect.getDOM().className = "layer_dialog_type_select";
        this.typeSelect.addOption(TileViewerConstants.TypeStandard, "standard");
        this.typeSelect.addOption(TileViewerConstants.TypeHimawariJP, "himawari8.jp");
        this.typeSelect.addOption(TileViewerConstants.TypeHimawariFD, "himawari8.fd");
        this.typeSelect.addOption(TileViewerConstants.TypeBackground, "background image");
        this.typeSelect.addOption(TileViewerConstants.TypeNone, "other");

        let typeRow = this.createRow();
        typeRow.appendChild(this.typeTitle);
        typeRow.appendChild(this.typeSelect.getDOM());

        this.typeSelect.on(Select.EVENT_CHANGE, (err, val) => {
            let type = this.typeSelect.getSelectedValue();
            if (type === TileViewerConstants.TypeHimawariJP ||
                type === TileViewerConstants.TypeHimawariFD ||
                type === TileViewerConstants.TypeBackground) {
                this.zoomRow.style.display = "none";
            } else {
                this.zoomRow.style.display = "block";
            }

            this.changeInputURLValue(SampleURLFileNames[type]);
        });
    }

    createIDRow() {
        this.idTitle = document.createElement('p');
        this.idTitle.className = "layer_dialog_sub_title";
        this.idTitle.innerText = "ID:";
        this.idInput = new Input("text");
        this.idInput.getDOM().className = "layer_dialog_id_input";
        this.idInput.setValue("Layer_" + Math.floor(Math.random() * 100));

        let idRow = this.createRow();
        idRow.appendChild(this.idTitle);
        idRow.appendChild(this.idInput.getDOM());
    }

    createURLRow() {
        this.urlTitle = document.createElement('p');
        this.urlTitle.className = "layer_dialog_sub_title";
        this.urlTitle.innerText = "URL:";
        this.urlInput = document.createElement('textarea');
        this.urlInput.className = "layer_dialog_url_input";
        this.changeInputURLValue(SampleURLFileNames[TileViewerConstants.TypeStandard]);

        let titleRow = this.createRow();
        titleRow.className = "layer_dialog_row2"
        titleRow.appendChild(this.urlTitle);
        titleRow.appendChild(this.urlInput);
    }

    createStyleRow() {
        this.styleURLTitle = document.createElement('p');
        this.styleURLTitle.className = "layer_dialog_sub_title";
        this.styleURLTitle.innerText = "Style:";
        this.styleURLInput = document.createElement('textarea');
        this.styleURLInput.className = "layer_dialog_url_input";
        this.styleURLInput.value = "https://raw.githubusercontent.com/Oslandia/postile-openmaptiles/master/style.json";

        this.styleRow = this.createRow();
        this.styleRow.className = "layer_dialog_row2"
        this.styleRow.appendChild(this.styleURLTitle);
        this.styleRow.appendChild(this.styleURLInput);
        this.styleRow.style.display = "none";
    }

    createZoomRow() {
        this.zoomMinTitle = document.createElement('p');
        this.zoomMinTitle.className = "layer_dialog_zoom_title";
        this.zoomMinTitle.innerText = "ZOOM: Min";
        this.zoomMaxTitle = document.createElement('p');
        this.zoomMaxTitle.className = "layer_dialog_zoom_title layer_dialog_zoom_max_title";
        this.zoomMaxTitle.innerText = "Max";

        this.zoomMinSelect = new Select();
        for (let i = 0; i <= 24; ++i) {
            this.zoomMinSelect.addOption(i, String(i));
        }
        this.zoomMinSelect.getDOM().className = "layer_dialog_zoom_min_select";

        this.zoomMaxSelect = new Select();
        for (let i = 0; i <= 24; ++i) {
            this.zoomMaxSelect.addOption(i, String(i));
        }
        this.zoomMaxSelect.getDOM().className = "layer_dialog_zoom_max_select";
        this.zoomMaxSelect.setSelectedIndex(this.zoomMaxSelect.getOptions().length - 1);

        this.zoomRow = this.createRow();
        this.zoomRow.appendChild(this.zoomMinTitle);
        this.zoomRow.appendChild(this.zoomMinSelect.getDOM());
        this.zoomRow.appendChild(this.zoomMaxTitle);
        this.zoomRow.appendChild(this.zoomMaxSelect.getDOM());
    }

    createErrorText() {
        // エラー表示用文字列
        this.errorRow = this.createRow();
        this.errorText = document.createElement('span');
        this.errorText.className = 'layer_dialog_error'
        this.errorText.textContent = 'Error:'
        this.errorText.style.display = 'none';
        this.errorRow.appendChild(this.errorText);
    }

    createPopupBackground() {
        this.okButton = new Button();
        this.okButton.setDataKey("OK");
        this.okButton.getDOM().className = "layer_dialog_ok_button btn btn-primary";
        this.dom.appendChild(this.okButton.getDOM());

        this.cancelButton = new Button();
        this.cancelButton.setDataKey("Cancel");
        this.cancelButton.getDOM().className = "layer_dialog_cancel_button btn btn-light";
        this.dom.appendChild(this.cancelButton.getDOM());

        let isOK = false;
        this.background = new PopupBackground();
        this.background.on('close', () => {
            const data = {
                id: "",
                url: "",
                zoom: {
                    min: 0,
                    max: 24
                }
            };
            data.type = this.typeSelect.getSelectedValue();
            data.url = this.urlInput.value.split("\n").join("");
            data.id = this.idInput.getValue();
            data.zoom.min = parseInt(this.zoomMinSelect.getSelectedValue(), 10);
            data.zoom.max = parseInt(this.zoomMaxSelect.getSelectedValue(), 10);

            if (this.endCallback) {
                this.endCallback(isOK, data);
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