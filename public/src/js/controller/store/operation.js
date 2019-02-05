import Validator from '../../common/validator'
import Store from './store'
import Vscreen from '../../common/vscreen'
import Constants from '../../common/constants'
import Command from '../../common/command'

class Operation
{
    constructor(connector, store) {
        this.store = store;
        this.connector = connector;
    }

	/**
	 * メタデータ(Display, 他コンテンツ)の幾何情報の更新通知を行う。
	 * @param {JSON} metaData メタデータ
	 */
	updateMetadata(metaData, endCallback) {
		if (Validator.isWindowType(metaData)) {
			// window
			this.connector.send(Command.UpdateWindowMetaData, [metaData], (err, reply) => {
                this.store.emit(Store.EVENT_DONE_UPDATE_WINDOW_METADATA, err, reply, endCallback);
			});
		} else {
			if (this.store.getManagement().isEditable(metaData.group)) {
				this.connector.send(Command.UpdateMetaData, [metaData], (err, reply) => {
                    this.store.emit(Store.EVENT_DONE_UPDATE_METADATA, err, reply, endCallback);
				});
			}
		}
	}
	/**
	 * メタデータ(Display, 他コンテンツ)の幾何情報の更新通知を行う。
	 * @param {JSON} metaData メタデータ
	 */
	updateMetadataMulti(metaDataList, endCallback) {
		if (metaDataList.length > 0) {
			if (Validator.isWindowType(metaDataList[0])) {
				this.connector.send(Command.UpdateWindowMetaData, metaDataList, (err, reply) => {
                    this.store.emit(Store.EVENT_DONE_UPDATE_WINDOW_METADATA, err, reply, endCallback);
				});
			}
			else {
				// １つでも変更可能なデータが含まれていたら送る.
				let isEditable = false;
				for (let i = 0; i < metaDataList.length; i = i + 1) {
					isEditable = isEditable || this.store.getManagement().isEditable(metaDataList[i].group);
				}
				if (isEditable) {
					this.connector.send(Command.UpdateMetaData, metaDataList, (err, reply) => {
                        this.store.emit(Store.EVENT_DONE_UPDATE_METADATA, err, reply, endCallback);
					});
				}
			}
		}
    }
    
	/**
	 * コンテンツ更新要求送信
	 * @param {JSON} metaData 更新するコンテンツのメタデータ
	 * @param {Blob} binary 更新するコンテンツのバイナリ
	 */
	updateContent(metaData, binary, endCallback) {
		if (!Validator.checkCapacity(binary.byteLength)) {
			return;
		}
		this.connector.sendBinary(Command.UpdateContent, metaData, binary, (err, reply) => {
            this.store.emit(Store.EVENT_DONE_UPDATE_CONTENT, err, reply, endCallback);
        });
    }
    
    deleteContent(metaDataList, endCallback) {
		if (metaDataList.length > 0) {
			this.connector.send(Command.DeleteContent, metaDataList, (err, reply) => {
				if (endCallback) {
					endCallback(err, reply);
				}
				this.store.emit(Store.EVENT_DONE_DELETE_CONTENT, err, reply);
			});
		}
	}
	
	deleteWindow(metaDataList, endCallback) {
		if (metaDataList.length > 0) {
			this.connector.send(Command.DeleteWindowMetaData, metaDataList, (err, reply) => {
				if (endCallback) {
					endCallback(err, reply);
				}
                this.store.emit(Store.EVENT_DONE_DELETE_DISPLAY, err, reply);
            });
		}
	}

	/**
	 * コンテンツとウィンドウの更新(再取得).
	 * @method update
	 */
	update(endCallback) {
		Vscreen.clearScreenAll();
		this.connector.send(Command.GetMetaData, { type: "all", id: "" }, (err, reply) => {
			if (!err) {
                this.store.emit(Store.EVENT_DONE_GET_METADATA, err, reply, endCallback);
			}
		});
		this.getGroupList();
		this.connector.send(Command.GetVirtualDisplay, { group: Constants.DefaultGroup }, (err, reply) => {
			this.store.emit(Store.EVENT_DONE_GET_VIRTUAL_DISPLAY, err, reply);
		});
		this.connector.send(Command.GetWindowMetaData, { type: "all", id: "" }, (err, reply) => {
			this.store.emit(Store.EVENT_DONE_GET_WINDOW_METADATA, err, reply);
		});
	}
    
	/**
	 * Content追加
	 * @method add_content
	 * @param {JSON} metaData コンテンツのメタデータ
	 * @param {BLOB} binary コンテンツのバイナリデータ
	 */
	addContent(metaData, binary, endCallback) {
		if (!metaData.hasOwnProperty("zIndex")) {
			metaData.zIndex = this.store.getZIndex(metaData, true);
		}
		if (!Validator.checkCapacity(binary.byteLength)) {
			return;
		}
		this.connector.sendBinary(Command.AddContent, metaData, binary, (err, reply) => {
            this.store.emit(Store.EVENT_DONE_ADD_CONTENT, err, reply, (err, reply) => {
                if (endCallback) {
                    endCallback(err, reply);
                }
            });
		});
    }

    getContent(request, endCallback, preventDefaultEmit) {
        this.connector.send(Command.GetContent, request, (err, reply) => {
			if (!preventDefaultEmit) {
				this.store.emit(Store.EVENT_DONE_GET_CONTENT, err, reply, endCallback);
			} else {
                endCallback(err, reply);
			}
		});
    }
    
    getVirtualDisplay(groupID, endCallback, preventDefaultEmit) {
        this.connector.send(Command.GetVirtualDisplay, {group : groupID}, (err, reply) => {
			if (!preventDefaultEmit) {
				this.store.emit(Store.EVENT_DONE_GET_VIRTUAL_DISPLAY, err, reply, endCallback);
			} else if (endCallback) {
                endCallback(err, reply);
            }
        });
    }
    
    updateVirtualDisplay(windowData, endCallback) {
		this.connector.send(Command.UpdateVirtualDisplay, windowData, (err, reply) => {
            this.store.emit(Store.EVENT_DONE_UPDATE_VIRTUAL_DISPLAY, err, reply);
            if (endCallback) {
                endCallback(err, reply);
            }
		});
    }
    
	/**
	 * グループリストの更新(再取得)
	 */
	getGroupList(endCallback) {
		this.connector.send(Command.GetGroupList, {}, (err, reply) => {
            this.store.emit(Store.EVENT_DONE_GET_GROUP_LIST, err, reply);
			if (endCallback) {
				endCallback(err, reply);
			}
		});
    }
    
	updateControllerData(controllerData) {
        this.connector.send(Command.UpdateControllerData, controllerData, function () {
        });
	}
	
	sendMessage(message, endCallback) {
		this.connector.send(Command.SendMessage, message, endCallback);
	}
}
export default Operation;