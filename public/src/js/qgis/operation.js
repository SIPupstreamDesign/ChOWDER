/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Validator from '../common/validator'
import Store from './store'
import Vscreen from '../common/vscreen'
import Constants from '../common/constants'
import Command from '../common/command'

class Operation {
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
			//if (this.store.getManagement().isEditable(metaData.group)) {
			this.connector.send(Command.UpdateMetaData, [metaData], (err, reply) => {
				if (endCallback) {
					endCallback(err, reply);
				}
				this.store.emit(Store.EVENT_DONE_UPDATE_METADATA, err, reply);
			});
			//}
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
			metaData.zIndex = 0;
		}
		/*
		if (binary instanceof ArrayBuffer && !Validator.checkCapacity(binary.byteLength)) {
			return;
		}
		if (binary instanceof Blob && !Validator.checkCapacity(binary.size)) {
			return;
		}
		if (binary instanceof String && !Validator.checkCapacity(binary.length)) {
			return;
		}
		*/
		this.connector.sendBinary(Command.AddContent, metaData, binary, (err, reply) => {
			this.store.emit(Store.EVENT_DONE_ADD_CONTENT, err, reply, (err, reply) => {
				if (endCallback) {
					endCallback(err, reply);
				}
			});
		});
	}

}
export default Operation;