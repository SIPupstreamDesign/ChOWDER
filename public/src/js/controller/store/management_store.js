/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../../common/constants.js';
import Store from './store';
import Action from '../action';
import Command from '../../common/command'

"use strict";

class ManagementStore {
	constructor(connector, state, store, action) {

		this.connector = connector;
		this.state = state;
		this.action = action;
		this.store = store;

		this.authority = null;
		this.userStatus = null;
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
		let callback = Store.extractCallback(data);
		this.connector.send(Command.GetDBList, {}, (err, reply) => {
			this.store.emit(Store.EVENT_DBLIST_RELOADED, err, reply);
		});

	}

	_newDB(data) {
		this.connector.send(Command.NewDB, data,  () => {
		});
	}

	_renameDB(data) {
		this.connector.send(Command.RenameDB, data, () => {});
	}

	_changeDB(data) {
		console.error("changeDB")
		this.connector.send(Command.ChangeDB, data, () => {});
	}

	_deleteDB(data) {
		this.connector.send(Command.DeleteDB, data, () => {});
	}

	_initDB(data) {
		this.connector.send(Command.InitDB, data, () => {});
	}

	/**
	 * 全体設定の再ロード
	 */
	_reloadGlobalSetting() {
		this.connector.send(Command.GetGlobalSetting, {}, (err, reply) => {
			this.store.emit(Store.EVENT_GLOBAL_SETTING_RELOADED, err, reply);
		});
	}

	/**
	 * 全体設定の更新
	 */
	_changeGlobalSetting(data) {
		let callback = Store.extractCallback(data);
		this.connector.send(Command.ChangeGlobalSetting, data, (err, reply) => {
			this.store.emit(Store.EVENT_GLOBAL_SETTING_CHANGED, err, reply);
			if (callback) {
				callback(err, reply)
			}
		});
	}

	/**
	 * パスワード更新
	 */
	_changePassword(data) {
		let callback = Store.extractCallback(data);
		this.connector.send(Command.ChangePassword, data, (err, reply) => {
			if (callback) {
				callback(err, reply);
			}
			this.store.emit(Store.EVENT_PASSWORD_CHANGED, err, reply)
		});
	}

	/**
	 * 権限変更
	 * @param {*} data
	 */
	_changeAuthority(data) {
		let callback = Store.extractCallback(data);
		this.connector.send(Command.ChangeAuthority, data, (err, data) => {
			this.action.reloadUserList({
				callback : (err, userList) => {
					if (callback) {
						callback(err, userList);
					}
					this.store.emit(Store.EVENT_AUTHORITY_CHANGED, null);
				}
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

	isModerator(){
		console.log("[isModerator]🐔",this.userStatus);
		if(this.userStatus){
			if(this.userStatus.groupID === "Moderator"){
				console.log("[isModerator]🐔",true);
				return true;
			}else{
				console.log("[isModerator]🐔",false);
				return false;
			}
		}else{
			return null;
		}
	}

	isViewable(group) {
		return this.getAuthorityObject().isViewable(group) && this.isViewableSite(group);
	}
    /**
     * groupのコンテンツが、displaygroupでで表示可能かどうか返す
     * @method isViewableDisplay
     * @param {String} group group
     */
    isViewableSite(group) {
		// displayからのアクセスだった
		let userList = this.store.getLoginStore().userList;
		if (!userList) { return false; }
		const displayGroup = this.store.getState().getDisplaySelectedGroup();
		if (displayGroup === "" || displayGroup === Constants.DefaultGroup) {
			// defaultグループだった
			return true;
		}
		if (group === "" || group === Constants.DefaultGroup) {
			// defaultグループだった
			return true;
		}
        for (let i = 0; i < userList.length; ++i) {
            const authority = userList[i];
            if (authority.id === group) {
                if (authority.hasOwnProperty('viewableSite')) {
                    if (authority.viewableSite !== "all") {
                        return authority.viewableSite.indexOf(displayGroup) >= 0;
                    }
                }
                // viewableSiteの設定が無い、または"all"
                return true;
            }
        }
        return false;
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
	// パフォーマンス計算を行うかどうか
	isMeasureTimeEnable() {
		if (this.globalSetting && this.globalSetting.enableMeasureTime) {
			return (String(this.globalSetting.enableMeasureTime) === "true");
		}
		return false;
	}
	// パフォーマンス計算用時間を生成して返す
	fetchMeasureTime() {
		let time = null;
		if (this.isMeasureTimeEnable()) {
			time = new Date().toISOString();
		}
		return time;
	}
}

export default ManagementStore;
