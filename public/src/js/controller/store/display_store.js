

import Action from '../action';
import manipulator from '../manipulator.js';
import Vscreen from '../../common/vscreen';
import Store from './store'
import Validator from '../../common/validator'

class DisplayStore
{
	constructor(connector, state, store, action) {
		this.connector = connector;
        this.state = state;
        this.store = store;
		this.action = action;

		this.initEvents();
	}

	initEvents() {
		for (let i in Action) {
			if (i.indexOf('EVENT') >= 0) {
				this.action.on(Action[i], ((method) => {
					return (err, data) => {
						if (this[method]) {
							this[method](data);
						}
					};
				})('_' + Action[i]));
			}
		}
	};

	/**
	 * ディスプレイスケールの変更
	 * @param {*} data 
	 */
    _changeDisplayScale(data) {
        manipulator.removeManipulator();
        Vscreen.setWholeScale(data.displayScale, true);
        if (data.isChanging) {
	        // ディスプレイスケール変更中
            this.store.emit(Store.EVENT_DISPLAY_SCALE_CHANGING, null, data.displayScale);
        } else {
	        // ディスプレイスケール変更確定
            this.store.emit(Store.EVENT_DISPLAY_SCALE_CHANGED, null, data.displayScale);
        }
    }
    
	/**
	 * 選択中のDisplayを削除する.
	 */
    _deleteDisplay(data) {
		let metaDataList = [];

		this.store.getState().for_each_selected_id((i, id) => {
			if (this.store.hasMetadata(id)) {
				metaDataList.push(this.store.getMetaData(id));
			}
		});
		this.store.operation.deleteWindow(metaDataList);
    }
    
	/**
	 * ディスプレイ位置の変更
	 */
    _changeDisplayTrans(data) {
		manipulator.removeManipulator();
		let center = Vscreen.getCenter();
		let whole = Vscreen.getWhole();
        Vscreen.assignWhole(whole.orgW, whole.orgH, center.x + data.dx, center.y + data.dy, Vscreen.getWholeScale());
        this.store.emit(Store.EVENT_DONE_DISPLAY_TRANS, null);
    }

	/**
	 * Display ID の表示.
	 */
    _showDisplayID(data) {
		let targetIDList = [];

		this.store.getState().for_each_selected_id((i, id) => {
			if (this.store.hasMetadata(id) && Validator.isWindowType(this.store.getMetaData(id))) {
				targetIDList.push({ id: id });
			}
		});
		if (targetIDList.length > 0) {
			this.connector.send('ShowWindowID', targetIDList, (err, reply) => {
                this.store.emit(Store.EVENT_DONE_SHOW_DISPLAY_ID, err, reply);
            });
		}
    }

    /**
     * VirualDisplayボタンをクリックした
     */
    _clickVirtualDisplay(data) {
        this.store.emit(Store.EVENT_VIRTUALDISPLAY_CLICKED, null, data);
	}
	

	/**
	 *  ディスプレイ枠色変更
	 */
	_changeDisplayColor(data) {
		let callback = Store.extractCallback(data);

		let id = this.state.getSelectedID();
		let color = data.color;
		if (this.store.hasMetadata(id) && Validator.isWindowType(this.store.getMetaData(id))) {
			let metaData = this.store.getMetaData(id);
			metaData.color = color;
			this.store.operation.updateMetadataMulti([metaData], (err, reply) => {
				this.store.emit(Store.EVENT_DONE_UPDATE_WINDOW_METADATA, err, reply, callback);
			});
		}
	}

	/**
	 * ディスプレイプロパティの変更
	 * @param {*} data 
	 */
	_changeDisplayProperty(data) {
		if (data.width && data.height && data.scale) {
			Vscreen.assignWhole(data.width, data.height, data.centerX, data.centerY, data.scale);
		}
		let isChangeSplit = false;
		if (Vscreen.getSplitCount().x != data.splitX || Vscreen.getSplitCount().y != data.splitY) {
			isChangeSplit = true;
			Vscreen.clearSplitWholes();
			Vscreen.splitWhole(data.splitX, data.splitY);
		}

		let whole = Vscreen.getWhole();
		let split = Vscreen.getSplitCount();
		// console.log("update_window_data");
		let windowData = {
			orgWidth: whole.orgW,
			orgHeight: whole.orgH,
			splitX: split.x,
			splitY: split.y,
			scale: Vscreen.getWholeScale(),
			type: "virtual_display",
			group: this.store.getState().getDisplaySelectedGroup()
		};
		if (!windowData.orgWidth || isNaN(windowData.orgWidth)) {
			windowData.orgWidth = Constants.InitialWholeWidth;
		}
		if (!windowData.orgHeight || isNaN(windowData.orgHeight)) {
			windowData.orgHeight = Constants.InitialWholeHeight;
		}
		this.store.operation.updateVirtualDisplay(windowData, (err, res) => {
			if (isChangeSplit) {
				this.store.emit(Store.EVENT_DISPLAY_SPLIT_CHANGED, err, split);
			}
		});
	}

	// ディスプレイ可視不可視の変更
	_changeDisplayVisible(data) {
		this.store.emit(Store.EVENT_CHANGE_DISPLAY_VISIBLE, null, data);
	}
}

export default DisplayStore;
