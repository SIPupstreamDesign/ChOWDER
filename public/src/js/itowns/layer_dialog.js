/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Store from "./store.js";
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
SampleURLFileNames[ITownsConstants.TypePointCloudTimeSeries] = "something/timeseries.json";
SampleURLFileNames[ITownsConstants.TypeGeometry] = "something/data.pbf";
SampleURLFileNames[ITownsConstants.TypeBargraph] = "sample_csv_data/data1.csv";
SampleURLFileNames[ITownsConstants.TypeOBJ] = "male02/male02.obj";


class LayerDialog extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;

        this.init();
        this.setting = {};
        this.csv = null;
        this.json = null;

        this.store.on(Store.EVENT_DONE_UPLOAD, (err, data) => {
            if (err) {
                if (this.errorText) {
                    this.errorText.textContent = 'Error: ' + err;
                }
            } else if (data.hasOwnProperty('path')) {
                if (data.path.indexOf('.csv') > 0){
                    this.changeInputURLValue(data.path)
                } else if (data.path.indexOf('.json') > 0){
                    this.changeInputJSONValue(data.path)
                }
            }
        });
    }

    changeInputURLValue(fileName) {
        const port = window.location.port ? ":" + window.location.port : "";
        this.urlInput.value = window.location.protocol + "//" + window.location.hostname + port + "/" + fileName;
    }

    changeInputJSONValue(fileName) {
        const port = window.location.port ? ":" + window.location.port : "";
        this.jsonURLInput.value = window.location.protocol + "//" + window.location.hostname + port + "/" + fileName;
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
        this.createTitleRow();
        this.createJSONRow();
        this.createStyleRow();
        this.createMTLRow();
        this.createZoomRow();
        this.createFormatRow();
        this.createEPSGRow();

        this.createCSVOpenRow();
        this.createJSONOpenRow();
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
        this.typeSelect.addOption(ITownsConstants.TypeColor, "Color");
        this.typeSelect.addOption(ITownsConstants.TypeElevation, "Elevation");
        this.typeSelect.addOption(ITownsConstants.Type3DTile, "3D Tile(tileset.json)");
        this.typeSelect.addOption(ITownsConstants.TypePointCloud, "PointCloud(potree cloud.js)");
        this.typeSelect.addOption(ITownsConstants.TypePointCloudTimeSeries, "PointCloudTimeSeries(.json)");
        this.typeSelect.addOption(ITownsConstants.TypeGeometry, "VectorTile(pbf, geojson)");
        this.typeSelect.addOption(ITownsConstants.TypeBargraph, "Bargraph(csv)");
        this.typeSelect.addOption(ITownsConstants.TypeOBJ, "OBJFile(obj)");

        let typeRow = this.createRow();
        typeRow.appendChild(this.typeTitle);
        typeRow.appendChild(this.typeSelect.getDOM());

        this.typeSelect.on(Select.EVENT_CHANGE, (err, val) => {
            let type = this.typeSelect.getSelectedValue();
            if (type === ITownsConstants.TypePointCloud
                || type === ITownsConstants.TypePointCloudTimeSeries
                || type === ITownsConstants.TypeBargraph
                || type === ITownsConstants.TypeOBJ) {
                this.zoomRow.style.display = "none";
            } else {
                this.zoomRow.style.display = "block";
            }
            if (type === ITownsConstants.TypeGeometry) {
                this.styleRow.style.display = "block";
            } else {
                this.styleRow.style.display = "none";
            }
            if (type === ITownsConstants.TypeOBJ) {
                this.mtlRow.style.display = "block";
            } else {
                this.mtlRow.style.display = "none";
            }
            if (type === ITownsConstants.TypeBargraph) {
                this.csvOpenRow.style.display = "block";
                this.jsonOpenRow.style.display = "block";
                this.jsonRow.style.display = "block";
            } else {
                this.csvOpenRow.style.display = "none";
                this.jsonOpenRow.style.display = "none";
                this.jsonRow.style.display = "none";
            }
            if (type === ITownsConstants.TypeElevation) {
                this.formatRow.style.display = "block";
            } else {
                this.formatRow.style.display = "none";
            }
            if (type === ITownsConstants.Type3DTile) {
                this.epsgRow.style.display = "block";
            } else {
                this.epsgRow.style.display = "none";
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

    createTitleRow() {
        this.urlTitle = document.createElement('p');
        this.urlTitle.className = "layer_dialog_sub_title";
        this.urlTitle.innerText = "URL:";
        this.urlInput = document.createElement('textarea');
        this.urlInput.className = "layer_dialog_url_input";
        this.changeInputURLValue(SampleURLFileNames[ITownsConstants.TypeColor]);

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

    createJSONRow() {
        this.jsonURLTitle = document.createElement('p');
        this.jsonURLTitle.className = "layer_dialog_sub_title";
        this.jsonURLTitle.innerText = "JSON:";
        this.jsonURLInput = document.createElement('textarea');
        this.jsonURLInput.className = "layer_dialog_url_input";
        this.jsonURLInput.value = "https://localhost/userdata/itowns/csv_sample/setting.json";

        this.jsonRow = this.createRow();
        this.jsonRow.className = "layer_dialog_row2"
        this.jsonRow.appendChild(this.jsonURLTitle);
        this.jsonRow.appendChild(this.jsonURLInput);
        this.jsonRow.style.display = "none";
    }

    createMTLRow() {
        this.mtlURLTitle = document.createElement('p');
        this.mtlURLTitle.className = "layer_dialog_sub_title";
        this.mtlURLTitle.innerText = "MTL:";
        this.mtlURLInput = document.createElement('textarea');
        this.mtlURLInput.className = "layer_dialog_url_input";
        this.mtlURLInput.value = "http://localhost/male02/male02.mtl";

        this.mtlRow = this.createRow();
        this.mtlRow.className = "layer_dialog_row2"
        this.mtlRow.appendChild(this.mtlURLTitle);
        this.mtlRow.appendChild(this.mtlURLInput);
        this.mtlRow.style.display = "none";
    }

    createZoomRow() {
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

    createCSVOpenRow() {
        this.csvOpenTitle = document.createElement('p');
        this.csvOpenTitle.className = "layer_dialog_fileopen_title";
        this.csvOpenTitle.innerText = "Import CSV File:";
        this.csvOpenInput = new Input('file');
        this.csvOpenInput.type = "file";
        this.csvOpenInput.getDOM().style.display = "inline-block";

        // csvアップロード中のぐるぐる回るアイコン
        this.csvLoadingImage = document.createElement('span');
        this.csvLoadingImage.className = 'layer_dialog_csv_loading'
        this.csvLoadingImage.textContent = 'Uploading...'
        this.csvLoadingImage.style.display = 'none';

        this.csvOpenRow = this.createRow();
        this.csvOpenRow.appendChild(this.csvOpenTitle);
        this.csvOpenRow.appendChild(this.csvOpenInput.getDOM());
        this.csvOpenRow.appendChild(this.csvLoadingImage);
        this.csvOpenRow.style.display = "none";

        this.csvOpenInput.on(Input.EVENT_CHANGE, (err, evt) => {
            this.csvLoadingImage.style.display = 'inline';
            this.errorText.style.display = 'none';

            let files = evt.target.files;
            let fileReader = new FileReader();
            fileReader.onload = (e) => {
                try {
                    let data = new Uint8Array(e.target.result);
                    let converted = window.Encoding.convert(data, {
                        to: 'UNICODE',
                        from: 'AUTO'
                    });
                    // パースできるか確かめる
                    let str = Encoding.codeToString(converted);
                    let parsed = window.Papa.parse(str);
                    if (parsed.errors.length == 0) {
                        console.error("upload")
                        this.action.upload({
                            filename: files[0].name,
                            type : ITownsConstants.UploadTypeCSV,
                            binary: e.target.result
                        });
                    } else {
                        throw 'Failed to parse CSV.'
                    }
                } catch(err) {
                    this.errorText.textContent = 'Error:' + err.toString();
                    this.errorText.style.display = 'block';
                }
                this.csvLoadingImage.style.display = 'none';
            };
            fileReader.readAsArrayBuffer(files[0]);
        });
    }

    createJSONOpenRow() {
        this.jsonOpenTitle = document.createElement('p');
        this.jsonOpenTitle.className = "layer_dialog_fileopen_title";
        this.jsonOpenTitle.innerText = "Import JSON File:";
        this.jsonOpenInput = new Input('file');
        this.jsonOpenInput.type = "file";
        this.jsonOpenInput.getDOM().style.display = "inline-block";

        // csvアップロード中のぐるぐる回るアイコン
        this.jsonLoadingImage = document.createElement('span');
        this.jsonLoadingImage.className = 'layer_dialog_csv_loading'
        this.jsonLoadingImage.textContent = 'Uploading...'
        this.jsonLoadingImage.style.display = 'none';

        this.jsonOpenRow = this.createRow();
        this.jsonOpenRow.appendChild(this.jsonOpenTitle);
        this.jsonOpenRow.appendChild(this.jsonOpenInput.getDOM());
        this.jsonOpenRow.appendChild(this.jsonLoadingImage);
        this.jsonOpenRow.style.display = "none";

        this.jsonOpenInput.on(Input.EVENT_CHANGE, (err, evt) => {
            this.jsonLoadingImage.style.display = 'inline';
            this.errorText.style.display = 'none';

            let files = evt.target.files;
            let fileReader = new FileReader();
            fileReader.onload = (e) => {
                try {
                    let data = new Uint8Array(e.target.result);
                    let str = new TextDecoder().decode(data);

                    // パースできるか確かめる
                    let parsed = JSON.parse(str);
                    if (parsed) {
                        this.action.upload({
                            filename: files[0].name,
                            type : ITownsConstants.UploadTypeJSON,
                            binary: e.target.result
                        });
                    } else {
                        throw 'Failed to parse JSON.'
                    }
                } catch(err) {
                    this.errorText.textContent = 'Error:' + err.toString();
                    this.errorText.style.display = 'block';
                }
                this.jsonLoadingImage.style.display = 'none';
            };
            fileReader.readAsArrayBuffer(files[0]);
        });
    }

    createFormatRow() {
        this.formatTitle = document.createElement('p');
        this.formatTitle.className = "layer_dialog_sub_title";
        this.formatTitle.innerText = "Format:";
        this.formatSelect = new Select();
        this.formatSelect.getDOM().className = "layer_dialog_type_select";
        this.formatSelect.addOption("image/png", "png");
        this.formatSelect.addOption("csv", "csv");
        this.formatSelect.addOption("image/x-bil;bits=32", "BIL(wmts)");
        this.formatSelect.addOption("image/png", "png(wmts)");

        this.tileMatrixSetTitle = document.createElement('p');
        this.tileMatrixSetTitle.className = "layer_dialog_zoom_title layer_dialog_zoom_max_title";
        this.tileMatrixSetTitle.innerText = "tileMatrixSet:";
        this.tileMatrixSetTitle.style.display = "none"
        
        this.tileMatrixSetSelect = new Select();
        this.tileMatrixSetSelect.addOption("WGS84G", "WGS84G");
        this.tileMatrixSetSelect.addOption("PM", "PM");
        this.tileMatrixSetSelect.addOption("iTowns", "iTowns");
        this.tileMatrixSetSelect.getDOM().className = "layer_dialog_zoom_max_select";
        this.tileMatrixSetSelect.setSelectedIndex(0);
        this.tileMatrixSetSelect.getDOM().style.display = "none"

        this.formatRow = this.createRow();
        this.formatRow.style.display = "none"
        this.formatRow.appendChild(this.formatTitle);
        this.formatRow.appendChild(this.formatSelect.getDOM());
        this.formatRow.appendChild(this.tileMatrixSetTitle);
        this.formatRow.appendChild(this.tileMatrixSetSelect.getDOM());

        this.formatSelect.on(Select.EVENT_CHANGE, (err, val) => {
            let index = this.formatSelect.getSelectedIndex();
            if (index >= 2) {
                // wmts
                this.tileMatrixSetTitle.style.display = "inline"
                this.tileMatrixSetSelect.getDOM().style.display = "inline"
            } else {
                this.tileMatrixSetTitle.style.display = "none"
                this.tileMatrixSetSelect.getDOM().style.display = "none"
            }
        });
    }

    createEPSGRow() {
        this.epsgTitle = document.createElement('p');
        this.epsgTitle.className = "layer_dialog_sub_title";
        this.epsgTitle.innerText = "Conversion:";
        
        this.epsgFromTitle = document.createElement('p');
        this.epsgFromTitle.className = "layer_dialog_epsg_title layer_dialog_epsg_from_title";
        this.epsgFromTitle.innerText = "From";

        this.epsgSrcSelect = new Select();
        this.epsgSrcSelect.addOption("EPSG:4978", "EPSG:4978");
        this.epsgSrcSelect.addOption("EPSG:3857", "EPSG:3857");
        this.epsgSrcSelect.addOption("EPSG:2446", "EPSG:2446");
        this.epsgSrcSelect.addOption("Custom", "Custom");
        this.epsgSrcSelect.getDOM().className = "layer_dialog_epsg_min_select";
        this.epsgSrcSelect.setSelectedIndex(0);

        this.epsgToTile = document.createElement('p');
        this.epsgToTile.className = "layer_dialog_epsg_title";
        this.epsgToTile.innerText = "To";

        this.epsgDstSelect = new Select();
        this.epsgDstSelect.addOption("EPSG:4978", "EPSG:4978");
        this.epsgDstSelect.addOption("EPSG:3857", "EPSG:3857");
        this.epsgDstSelect.addOption("EPSG:2446", "EPSG:2446");
        this.epsgDstSelect.addOption("Custom", "Custom");
        this.epsgDstSelect.getDOM().className = "layer_dialog_epsg_max_select";
        this.epsgDstSelect.setSelectedIndex(0);

        this.epsgRow = this.createRow();
        this.epsgRow.style.display = "none"
        this.epsgRow.appendChild(this.epsgTitle);
        this.epsgRow.appendChild(this.epsgFromTitle);
        this.epsgRow.appendChild(this.epsgSrcSelect.getDOM());
        this.epsgRow.appendChild(this.epsgToTile);
        this.epsgRow.appendChild(this.epsgDstSelect.getDOM());
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
                    min: 1,
                    max: 20
                }
            };
            data.type = this.typeSelect.getSelectedValue();
            if (data.type == ITownsConstants.TypeBargraph) {
                data.isBarGraph = true;
            }
            if (data.type == ITownsConstants.TypeOBJ) {
                data.isOBJ = true;
            }
            data.url = this.urlInput.value.split("\n").join("");
            data.id = this.idInput.getValue();
            data.zoom.min = parseInt(this.zoomMinSelect.getSelectedValue(), 10);
            data.zoom.max = parseInt(this.zoomMaxSelect.getSelectedValue(), 10);

            if (data.type === ITownsConstants.TypeGeometry) {
                data.style = this.styleURLInput.value.split("\n").join("");
            }
            if (data.isOBJ) {
                data.mtlurl = this.mtlURLInput.value.split("\n").join("");
            }
            if (data.type === ITownsConstants.TypeElevation) {
                data.format = this.formatSelect.getSelectedValue();
                if (this.formatSelect.getSelectedIndex() >= 2) {
                    data.tileMatrixSet = this.tileMatrixSetSelect.getSelectedValue();
                } else {
                    data.tileMatrixSet = 'PM'
                }
            }
            if (data.type === ITownsConstants.Type3DTile) {
                data.conversion = {
                    src : this.epsgSrcSelect.getSelectedValue(),
                    dst : this.epsgDstSelect.getSelectedValue()
                };
            }

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