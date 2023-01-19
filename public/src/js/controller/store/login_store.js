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

class LoginStore {
	constructor(connector, state, store, action, cookie) {
		this.connector = connector;
		this.state = state;
		this.action = action;
		this.cookie = cookie;
		this.store = store;

		this.loginUserID = "";
		this.userList = [];

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
		const callback = Store.extractCallback(data);

		const controllerID = this.getControllerID();
		if ((!controllerID || controllerID.length === 0) && !data.onetime) {
			this.connector.send(Command.GenerateControllerID, {}, (err, reply) => {
				if (!err) {
					this.controllerID = reply;
					location.hash = this.controllerID;
					let loginData;
					try {
						loginData = JSON.parse(JSON.stringify(data));
					} catch(e) {
						console.error(e);
					}
					loginData.onetime = true;
					this._login(loginData);
				}
			});
			return;
		}
		const request = { id: data.userid, password: data.password, controllerID: controllerID };
		if (data.loginkey && data.loginkey.length > 0) {
			request.loginkey = data.loginkey;
		}
		this.connector.send(Command.Login, request, (err, reply) => {
			if (err || reply === "failed") {
				const data = {};
				data.loginkey = "";
				this.cookie.setLoginKey(this.getControllerID(), data.loginkey);
				this.store.emit(Store.EVENT_LOGIN_FAILED, err, data);
			} else {
				const userList = this.getUserList();

				let data;
				try {
					data = JSON.parse(JSON.stringify(reply));
				} catch(e) {
					console.error(e);
				}
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

	// 権限情報確認のためのログイン
	_loginForCheckAuthority(data) {
		let request = { id: data.userid, password: data.password, loginkey : data.loginkey };
		this.connector.send(Command.Login, request, (err, reply) => {
			if (err || reply === "failed") {
				// ログインに失敗した。リロードする.
				window.location.reload(true);
			}
			this.store.getManagement().authority = reply.authority;
			this.action.getGroupList();
		});
	}

	/**
	 * ユーザーリストを最新に更新
	 */
	_reloadUserList(data) {
		let callback = Store.extractCallback(data);

		this.connector.send(Command.GetUserList, {}, (err, userList) => {
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
		this.connector.send(Command.Logout, data, function () {
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
		const hashid = location.hash.split("#").join("");
		if (hashid.length > 0) {
			const controller_id = decodeURIComponent(hashid);
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