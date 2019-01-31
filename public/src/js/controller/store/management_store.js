/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../../common/constants.js';
import Store from './store';
import Action from '../action';

"use strict";

class ManagementStore {
	constructor(connector, state, store, action) {

		this.connector = connector;
		this.state = state;
		this.action = action;
		this.store = store;

		this.authority = null;
		this.maxMesageSize = null;

		this.globalSetting = null;
		
		// 全体設定更新時
		this.store.on(Store.EVENT_GLOBAL_SETTING_RELOADED, (err, data) => {
			if (data && data.hasOwnProperty('max_history_num')) {
				this.globalSetting = data;
			}
		});

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

	_reloadDBList(data) {
		this.connector.send('GetDBList', {}, (err, reply) => {
			this.store.emit(Store.EVENT_DBLIST_RELOADED, err, reply);
		});

	}

	_newDB(data) {
		this.connector.send("NewDB", data,  () => {
		});
	}
	
	_renameDB(data) {
		this.connector.send("RenameDB", data, () => {});
	}

	_changeDB(data) {
		console.error("changeDB")
		this.connector.send("ChangeDB", data, () => {});
	}

	_deleteDB(data) {
		this.connector.send("DeleteDB", data, () => {});
	}

	_initDB(data) {
		this.connector.send("InitDB", data, () => {});
	}

	/**
	 * 全体設定の再ロード
	 */
	_reloadGlobalSetting() {
		this.connector.send('GetGlobalSetting', {}, (err, reply) => {
			this.store.emit(Store.EVENT_GLOBAL_SETTING_RELOADED, err, reply);
		});
	}

	/**
	 * 全体設定の更新
	 */
	_changeGlobalSetting(data) {
		this.connector.send("ChangeGlobalSetting", data, (err, reply) => {
			this.store.emit(Store.EVENT_GLOBAL_SETTING_CHANGED, err, reply)
		});
	}

	/**
	 * パスワード更新
	 */
	_changePassword(data) {
		let callback = data.callback;
		delete data.callback;
		this.connector.send('ChangePassword', data, (err, reply) => {
			if (callback) {
				callback();
			}
			this.store.emit(Store.EVENT_PASSWORD_CHANGED, err, reply)
		});
	}

	/**
	 * 権限変更
	 * @param {*} data 
	 */
	_changeAuthority(data) {
		let callback;
		if (data && data.hasOwnProperty('callback')) {
			callback = data.callback;
			delete data.callback;
		}
		this.connector.send('ChangeAuthority', request, (err, data) => {
			this.action.reloadUserList((err, userList) => {
				if (callback) {
					callback();
				}
				this.store.emit(Store.EVENT_AUTHORITY_CHANGED, null);
			});
		});
	}

	getAuthority() {
		return this.authority;
	}
	getCurrentDB() {
		return this.globalSetting.current_db;
	}
	getMaxHistoryNum() {
		return this.globalSetting.max_history_num;
	}
	getAuthorityObject() {
		let authority = this.authority;
		return {
			isAdmin: function () {
				if (authority && authority.hasOwnProperty('is_admin')) {
					if (String(authority.is_admin) === "true") {
						return true;
					}
				}
				return false;
			},
			isViewable: function (groupID) {
				if (groupID === Constants.DefaultGroup) {
					return true;
				}
				if (groupID === undefined || groupID === "") {
					return true;
				}
				if (authority && authority.hasOwnProperty('viewable')) {
					if (authority.viewable === "all" || authority.viewable.indexOf(groupID) >= 0) {
						return true;
					}
				}
				return false;
			},
			isEditable: function (groupID) {
				if (groupID === Constants.DefaultGroup) {
					return true;
				}
				if (groupID === undefined || groupID === "") {
					return true;
				}
				if (authority) {
					if (authority.hasOwnProperty('editable')) {
						if (authority.editable === "all" || authority.editable.indexOf(groupID) >= 0) {
							return true;
						}
					}
				}
				return false;
			},
			isDisplayEditable: function (groupID) {
				if (authority && authority.hasOwnProperty('is_admin')) {
					if (String(authority.is_admin) === "true") {
						return true;
					}
				}
				if (groupID === Constants.DefaultGroup) {
					return true;
				}
				if (groupID === undefined || groupID === "") {
					return true;
				}
				if (authority) {
					if (authority.hasOwnProperty('displayEditable')) {
						if (authority.displayEditable === "all" || authority.displayEditable.indexOf(groupID) >= 0) {
							return true;
						}
					}
				}
				return false;
			},
			isGroupManipulable: function () {
				if (authority && authority.hasOwnProperty('group_manipulatable')) {
					return authority.group_manipulatable;
				}
				return false;
			}
		};
	}
	isAdmin() {
		return this.getAuthorityObject().isAdmin();
	}
	isViewable(group) {
		return this.getAuthorityObject().isViewable(group);
	}
	isEditable(group) {
		return this.getAuthorityObject().isEditable(group);
	}
	isDisplayEditable(group) {
		let editable = this.getAuthorityObject().isDisplayEditable(group);
		return editable;
	}
	isGroupManipulable() {
		return this.getAuthorityObject().isGroupManipulable();
	}
	getDisplayGroupList() {
		return this.displayGroupList;
	}
	getMaxMessageSize() {
		if (this.globalSetting.wsMaxMessageSize) {
			return this.globalSetting.wsMaxMessageSize;
		}
		return null;
	}
}

export default ManagementStore;
