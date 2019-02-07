/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import ManagementDialog from '../../components/management_dialog';
import Store from '../store/store'
import InputDialog from '../../components/input_dialog'

class ManagementGUI
{
	constructor(store, action) {
		this.store = store;
		this.action = action;
		this.management = this.store.getManagement();

		this.dblist = [];
		this.managementDialog = new ManagementDialog();

		this.initEvents();
		
		store.on(Store.EVENT_DBLIST_RELOADED, (err, reply) => {
			this.dblist = reply;
		});
		
		this.action.reloadDBList();
	}

	/**
	 * 管理ページのイベント初期化.
	 * @method initManagementEvents
	 */
	initEvents() {

		// 管理ページでパスワードが変更された
		this.managementDialog.on(ManagementDialog.EVENT_CHANGE_PASSWORD, (userID, prePass, pass, callback) => {
			let request = {
					id : userID,
					pre_password : prePass,
					password : pass,
				},
				loginkey = this.store.getLoginStore().getLoginKey();
			if (loginkey.length > 0) {
				request.loginkey = loginkey;
			};
			request.callback = callback;
			this.action.changePassword(request);
		});
	
		// 権限の変更
		this.managementDialog.on(ManagementDialog.EVENT_CHANGE_AUTHORITY, (
			userID, editable, viewable, displayEditable,
			group_manipulatable, callback) => {
			let request = {
				id : userID,
				editable : editable,
				viewable : viewable,
				displayEditable : displayEditable,
				group_manipulatable : group_manipulatable,
				callback : callback
			};
			this.action.changeAuthority(request);
		});

		// 履歴保存数の変更
		this.managementDialog.on(ManagementDialog.EVENT_CHANGE_HISTORY_NUM, (err, value, callback) => {
			this.store.once(Store.EVENT_UPDATE_GLOBAL_SETTING, () => {
				this.action.reloadGlobalSetting();
				if (callback) {
					callback();
				}
			});
			this.action.changeGlobalSetting({ max_history_num : value });
		});
		
		// 新規DB
		this.managementDialog.on(ManagementDialog.EVENT_NEW_DB, (err, name) => {
			this.action.newDB({ name : name });
		});

		// DB名変更
		this.managementDialog.on(ManagementDialog.EVENT_RENAME_DB, (err, preName, name) => {
			this.action.renameDB( { name : preName, new_name : name });
		});
		
		// DBの切り替え
		this.managementDialog.on(ManagementDialog.EVENT_CHANGE_DB, (err, name) => {
			this.action.changeDB({ name : name });
		});

		// DBの削除
		this.managementDialog.on(ManagementDialog.EVENT_DELETE_DB, (err, name) => {
			InputDialog.showOKCancelInput({
				name : "DB: " + name + " " + i18next.t('delete_is_ok'),
				opacity : 0.7,
				zIndex : 90000001,
				backgroundColor : "#888"
			}, (isOK) => {
				if (isOK) {
					this.action.deleteDB({ name : name });
				}
			})
		});

		// DBの初期化
		this.managementDialog.on(ManagementDialog.EVENT_INIT_DB, (err, name) => {
			InputDialog.showOKCancelInput({
				name : "DB: " + name + " " + i18next.t('init_is_ok'),
				opacity : 0.7,
				zIndex : 90000001,
				backgroundColor : "#888"
			}, (isOK) => {
				if (isOK) {
					this.action.initDB( { name : name });
				}
			})
		});
		this.action.reloadGlobalSetting();
	}

	isShow() {
		return this.managementDialog.isShow();
	}

	show() {
		let userList = this.store.getLoginStore().getUserList();
		let displayGroupList = this.store.getGroupStore().getDisplayGroupList();
		let contents = { dblist : this.dblist };
		let currentDB = this.management.getCurrentDB();
		let maxHistoryNum = this.management.getMaxHistoryNum();
		this.managementDialog.show(userList, displayGroupList, contents, currentDB, maxHistoryNum);
	}

	close() {
		this.managementDialog.close();
	}
}

export default ManagementGUI;