/**
 * Copyright (c) 2021 National Institute of Information and Communications Technology (NICT). All rights reserved.
 */

import Select from '../components/select';
import Button from '../components/button';
import InputDialog from '../components/input_dialog';
import LayerDialog from './layer_dialog';

class LayerList extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;

        this.dom = document.createElement('div');

        // レイヤー一覧
        this.layerSelect = new Select();
        this.layerSelect.getDOM().className = "layer_select";
        this.layerSelect.getDOM().size = 7;
        this.dom.appendChild(this.layerSelect.getDOM());

        let layerButtonArea = document.createElement('div');
        layerButtonArea.className = "layer_button_area";

        // レイヤー上移動ボタン
        this.layerUpButton = new Button();
        this.layerUpButton.getDOM().className = "layer_up_button btn btn-light";
        layerButtonArea.appendChild(this.layerUpButton.getDOM());

        // レイヤー下移動ボタン
        this.layerDownButton = new Button();
        this.layerDownButton.getDOM().className = "layer_down_button btn btn-light";
        layerButtonArea.appendChild(this.layerDownButton.getDOM());

        // レイヤー追加ボタン
        this.layerAddButton = new Button();
        this.layerAddButton.setDataKey("+");
        this.layerAddButton.getDOM().className = "layer_button btn btn-primary";
        layerButtonArea.appendChild(this.layerAddButton.getDOM());

        // レイヤー削除ボタン
        this.layerDeleteButton = new Button();
        this.layerDeleteButton.setDataKey("-");
        this.layerDeleteButton.getDOM().className = "layer_button btn btn-danger";
        layerButtonArea.appendChild(this.layerDeleteButton.getDOM());


        // レイヤー追加ダイアログ
        this.layerDialog = new LayerDialog(this.store, this.action);
        document.body.appendChild(this.layerDialog.getDOM());

        this.dom.appendChild(layerButtonArea);

        this.initEvents();
    }

    initEvents() {

        this.layerAddButton.on('click', () => {
            this.layerDialog.show((isOK, data) => {
                // OK
                if (isOK) {
                    this.action.addLayer(data);
                }
            });
        });

        this.layerDeleteButton.on('click', () => {
            let dialog = InputDialog.showOKCancelInput({
                name: this.layerSelect.getSelectedValue() + i18next.t('delete_is_ok'),
                okButtonName: "OK"
            }, (isOK) => {
                if (isOK) {
                    this.action.deleteLayer({
                        id: this.layerSelect.getSelectedValue()
                    });
                }
            });
            dialog.style.color = "white"
        });

        this.layerUpButton.on('click', () => {
            this.action.changeLayerOrder({
                id: this.layerSelect.getSelectedValue(),
                isUp: true
            });
        });

        this.layerDownButton.on('click', () => {
            this.action.changeLayerOrder({
                id: this.layerSelect.getSelectedValue(),
                isUp: false
            });
        });

        this.layerSelect.on(Select.EVENT_CHANGE, (err, evt) => {
            const value = this.layerSelect.getSelectedValue();
            const layerData = this.store.getLayerData(value);
            if (layerData.type === "image") {
                this.layerUpButton.getDOM().disabled = true;
                this.layerDownButton.getDOM().disabled = true;
            } else {
                this.layerUpButton.getDOM().disabled = false;
                this.layerDownButton.getDOM().disabled = false;
            }
            const isDisableDelete = layerData.type === "user";
            this.layerDeleteButton.getDOM().disabled = isDisableDelete;
            this.action.selectLayer({ id: layerData.id });
            this.emit(LayerList.EVENT_LAYER_SELECT_CHANGED, null, {
                index: this.layerSelect.getSelectedIndex(),
                value: value
            });
        });
    }


    initLayerSelectList(layerDatas) {
        const currentSelectedIndex = this.layerSelect.getSelectedIndex();
        this.layerSelect.clear();
        for (let i = 0; i < layerDatas.length; ++i) {
            let data = layerDatas[i];
            if (data) {
                let type = data.type;
                this.layerSelect.addOption(data.id, data.id + " - " + type);
            }
        }
        if (currentSelectedIndex >= 0 && currentSelectedIndex < layerDatas.length) {
            this.layerSelect.setSelectedIndex(currentSelectedIndex);
            this.layerSelect.getDOM().focus();
            this.emit(LayerList.EVENT_LAYER_SELECT_CHANGED, null, {
                index: this.layerSelect.getSelectedIndex(),
                value: this.layerSelect.getSelectedValue()
            });
        }
    }

    setSelectedIndex(index) {
        this.layerSelect.setSelectedIndex(index);
        this.layerSelect.getDOM().focus();
        this.emit(LayerList.EVENT_LAYER_SELECT_CHANGED, null, {
            index: this.layerSelect.getSelectedIndex(),
            value: this.layerSelect.getSelectedValue()
        });
    }

    setSelectedID(id) {
        const options = this.layerSelect.getOptions();
        for (let i = 0; i < options.length; ++i) {
            if (options[i].value === id) {
                this.setSelectedIndex(i);
                this.layerSelect.getDOM().focus();
                break;
            }
        }
    }

    setEnable(isEnable) {
        if (!isEnable) {
            this.layerSelect.getDOM().setAttribute('disabled', '');
        } else {
            this.layerSelect.getDOM().removeAttribute('disabled');
        }
    }

    getDOM() {
        return this.dom;
    }
}

LayerList.EVENT_LAYER_SELECT_CHANGED = "layer_select_changed";

export default LayerList;