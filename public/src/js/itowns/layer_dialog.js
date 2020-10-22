/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import PopupBackground from "../components/popup_background";
import Input from "../components/input";
import Button from "../components/button";
import Select from "../components/select";
import ITownsConstants from "./itowns_constants.js"

const SampleURLFileNames = {}
SampleURLFileNames[ITownsConstants.TypeColor] = "std/{z}/{x}/{y}.png";
SampleURLFileNames[ITownsConstants.TypeElevation] = "std/{z}/{x}/{y}.png";
SampleURLFileNames[ITownsConstants.Type3DTile] = "something/tileset.json";
SampleURLFileNames[ITownsConstants.TypePointCloud] = "something/cloud.js";
SampleURLFileNames[ITownsConstants.TypeGeometry] = "something/data.pbf";
SampleURLFileNames[ITownsConstants.TypeBargraph] = "sample_csv_data/data1.csv";

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
        this.csv = null;
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

        let createRow = () => {
            let row = document.createElement('div');
            row.className = "layer_dialog_row";
            this.wrap.appendChild(row);
            return row;
        }

        this.title = document.createElement('p');
        this.title.className = "layer_dialog_title";
        this.title.innerText = i18next.t('add_layer');

        this.typeTitle = document.createElement('p');
        this.typeTitle.className = "layer_dialog_sub_title";
        this.typeTitle.innerText = "Type:";

        this.typeSelect = new Select();
        this.typeSelect.getDOM().className = "layer_dialog_type_select";
        this.typeSelect.addOption(ITownsConstants.TypeColor, "Color");
        this.typeSelect.addOption(ITownsConstants.TypeElevation, "Elevation");
        this.typeSelect.addOption(ITownsConstants.Type3DTile, "3D Tile(tileset.json)");
        this.typeSelect.addOption(ITownsConstants.TypePointCloud, "PointCloud(potree cloud.js)");
        this.typeSelect.addOption(ITownsConstants.TypeGeometry, "VectorTile(pbf, geojson)");
        this.typeSelect.addOption(ITownsConstants.TypeBargraph, "Bargraph(csv)");

        this.idTitle = document.createElement('p');
        this.idTitle.className = "layer_dialog_sub_title";
        this.idTitle.innerText = "ID:";

        this.idInput = new Input("text");
        this.idInput.getDOM().className = "layer_dialog_id_input";
        this.idInput.setValue("Layer_" + Math.floor(Math.random() * 100));

        this.urlTitle = document.createElement('p');
        this.urlTitle.className = "layer_dialog_sub_title";
        this.urlTitle.innerText = "URL:";

        this.urlInput = document.createElement('textarea');
        this.urlInput.className = "layer_dialog_url_input";
        this.changeInputURLValue(SampleURLFileNames[ITownsConstants.TypeColor]);
        
        this.styleURLTitle = document.createElement('p');
        this.styleURLTitle.className = "layer_dialog_sub_title";
        this.styleURLTitle.innerText = "Style:";

        this.styleURLInput = document.createElement('textarea');
        this.styleURLInput.className = "layer_dialog_url_input";
        this.styleURLInput.value = "https://raw.githubusercontent.com/Oslandia/postile-openmaptiles/master/style.json";

        this.zoomMinTitle = document.createElement('p');
        this.zoomMinTitle.className = "layer_dialog_zoom_title";
        this.zoomMinTitle.innerText = "ZOOM: Min";

        this.zoomMaxTitle = document.createElement('p');
        this.zoomMaxTitle.className = "layer_dialog_zoom_title layer_dialog_zoom_max_title";
        this.zoomMaxTitle.innerText = "Max";

        this.fileOpenTitle = document.createElement('p');
        this.fileOpenTitle.className = "layer_dialog_fileopen_title";
        this.fileOpenTitle.innerText = "Import From File:";

        this.fileOpenInput = new Input('file');
        this.fileOpenInput.type = "file";
        this.fileOpenInput.getDOM().style.display = "inline-block";

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
        {
            let typeRow = createRow();
            typeRow.appendChild(this.typeTitle);
            typeRow.appendChild(this.typeSelect.getDOM());
        }
        {
            let idRow = createRow();
            idRow.appendChild(this.idTitle);
            idRow.appendChild(this.idInput.getDOM());
        }
        {
            let titleRow = createRow();
            titleRow.className = "layer_dialog_row2"
            titleRow.appendChild(this.urlTitle);
            titleRow.appendChild(this.urlInput);
        }
        {
            this.styleRow = createRow();
            this.styleRow.className = "layer_dialog_row2"
            this.styleRow.appendChild(this.styleURLTitle);
            this.styleRow.appendChild(this.styleURLInput);
            this.styleRow.style.display = "none";
        }
        {
            this.zoomRow = createRow();
            this.zoomRow.appendChild(this.zoomMinTitle);
            this.zoomRow.appendChild(this.zoomMinSelect.getDOM());
            this.zoomRow.appendChild(this.zoomMaxTitle);
            this.zoomRow.appendChild(this.zoomMaxSelect.getDOM());
        }

        {
            this.fileOpenRow = createRow();
            this.fileOpenRow.appendChild(this.fileOpenTitle);
            this.fileOpenRow.appendChild(this.fileOpenInput.getDOM());
            this.fileOpenRow.style.display = "none";
        }
        
        this.endCallback = null;
        let isOK = false;
        this.background = new PopupBackground();
        this.background.on('close', () => {
            this.data.type = this.typeSelect.getSelectedValue();
            if (this.data.type == ITownsConstants.TypeBargraph) {
                this.data.isBarGraph = true;
            }
            this.data.url = this.urlInput.value.split("\n").join("");
            this.data.id = this.idInput.getValue();
            this.data.zoom.min = parseInt(this.zoomMinSelect.getSelectedValue(), 10);
            this.data.zoom.max = parseInt(this.zoomMaxSelect.getSelectedValue(), 10);
            
            let type = this.typeSelect.getSelectedValue();
            if (type === ITownsConstants.TypeGeometry) {
                this.data.style = this.styleURLInput.value.split("\n").join("");
            }

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

        this.fileOpenInput.on(Input.EVENT_CHANGE, (err, evt) => {
            this.csv = null;
            let files = evt.target.files;
            let fileReader = new FileReader();
            fileReader.onload = (e) =>{
                let data = new Uint8Array(e.target.result);
                let converted = window.Encoding.convert(data, {
                    to: 'UNICODE',
                    from: 'AUTO'
                });
                let str = Encoding.codeToString(converted);
                let parsed = window.Papa.parse(str);
                if (parsed.errors.length == 0) {
                    this.csv = str;
                } else {
                    console.error(parsed.errors);
                }
            };
            fileReader.readAsArrayBuffer(files[0]);
        });

        this.typeSelect.on(Select.EVENT_CHANGE, (err, val) => {
            let type = this.typeSelect.getSelectedValue();
            if (type === ITownsConstants.TypePointCloud
                || type === ITownsConstants.TypeBargraph) {
                this.zoomRow.style.display = "none";
            } else {
                this.zoomRow.style.display = "block";
            }
            if (type === ITownsConstants.TypeGeometry) {
                this.styleRow.style.display = "block";
            } else {
                this.styleRow.style.display = "none";
            }
            if (type === ITownsConstants.TypeBargraph) {
                this.fileOpenRow.style.display = "block";
            } else {
                this.fileOpenRow.style.display = "none";
            }
            this.changeInputURLValue(SampleURLFileNames[type]);
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