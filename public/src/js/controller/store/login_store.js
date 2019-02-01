/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../../common/constants.js';
import Store from './store';
import Action from '../action';

"use strict";

class LoginStore {
	constructor(connector, state, store, action, cookie) {
		this.connector = connector;
		this.state = state;
		this.action = action;
		this.cookie = cookie;
		this.store = store;

		this.loginUserID = "";
		this.userList = [];

		this.store.on(Store.EVENT_GROUP_ADDED, (err ,userList) => {
			this.userList = userList;
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

	/**
	 * ログイン
	 */
	_login(data) {
		let callback = Store.extractCallback(data);

		let controllerID = this.getControllerID();
		if ((!controllerID || controllerID.length === 0) && !data.onetime) {
			this.connector.send('GenerateControllerID', {}, (err, reply) => {
				if (!err) {
					this.controllerID = reply;
					location.hash = this.controllerID;
					let loginData = JSON.parse(JSON.stringify(data));
					loginData.onetime = true;
					this._login(loginData);
				}
			});
			return;
		}
		let request = { id: data.userid, password: data.password, controllerID: controllerID };
		if (data.loginkey && data.loginkey.length > 0) {
			request.loginkey = data.loginkey;
		}
		this.connector.send('Login', request, (err, reply) => {
			if (err || reply === "failed") {
				let data = {};
				data.loginkey = "";
				this.cookie.setLoginKey(this.getControllerID(), data.loginkey);
				this.store.emit(Store.EVENT_LOGIN_FAILED, err, data);
			} else {
				let userList = this.getUserList();

				let data = JSON.parse(JSON.stringify(reply));
				for (let i = 0; i < userList.length; i = i + 1) {
					if (userList[i].id === reply.id) {
						data.loginUserName = userList[i].name;
						break;
					}
				}
				this.cookie.setLoginKey(this.getControllerID(), data.loginkey);
				this.loginUserID = reply.id;
				this.store.emit(Store.EVENT_LOGIN_SUCCESS, err, data);
			}
			if (callback) {
				callback(err, reply);
			}
		});
	}

	/**
	 * ユーザーリストを最新に更新
	 */
	_reloadUserList(data) {
		let callback = Store.extractCallback(data);

		this.connector.send('GetUserList', {}, (err, userList) => {
			this.userList = userList;
			if (callback) {
				callback(err, userList);
			}
			this.store.emit(Store.EVENT_USERLIST_RELOADED, null);
		});
	}

	/**
	 * ログアウト
	 */
	_logout(data) {
		this.connector.send('Logout', data, function () {
			window.location.reload(true);
		});
	}

	getUserList() {
		return this.userList;
	}


	getLanguage() {
		return this.cookie.getLanguage();
	}

	/**
	 * ログインユーザIDの取得
	 */
	getLoginUserID() {
		return this.loginUserID;
	}

	/**
	 * コントローラIDの取得.
	 * @method getControllerID
	 */
	getControllerID() {
		let hashid = location.hash.split("#").join("");
		if (hashid.length > 0) {
			let controller_id = decodeURIComponent(hashid);
			if (!controller_id || controller_id === undefined || controller_id === "undefined") {
				controller_id = '';
			}
			return controller_id;
		}
		return "";
    }
    
    /**
     * ログインキーを取得
     */
	getLoginKey() {
		return this.cookie.getLoginKey(this.getControllerID());
	}
	
}

export default LoginStore;