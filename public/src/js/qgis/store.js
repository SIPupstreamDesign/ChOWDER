/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import Action from './action'
import Constants from '../common/constants'
import Command from '../common/command';
import Connector from '../common/ws_connector.js';
import Operation from './operation'
import IFrameConnector from '../common/iframe_connector';

const reconnectTimeout = 2000;

class Store extends EventEmitter {
	constructor(action) {
		super();
		this.action = action;
		this.operation = new Operation(Connector, this); // 各種storeからのみ限定的に使う
		this.isInitialized_ = false;

		this.initEvents();
	}

	release() { }

	emit() {
		if (arguments.length > 0) {
			if (!arguments[0]) {
				console.error("Not found EVENT NAME!")
			}
		}
		super.emit(...arguments);
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

	_connect() {
		this.isDisconnect = false;
		let client = Connector.connect(() => {
			if (!this.isInitialized_) {
				//this.initOtherStores(() => {
				this.emit(Store.EVENT_CONNECT_SUCCESS, null);
				//});
			} else {
				this.emit(Store.EVENT_CONNECT_SUCCESS, null);
			}
		}, (() => {
			return (ev) => {
				this.emit(Store.EVENT_CONNECT_FAILED, null);

				if (!this.isDisconnect) {
					setTimeout(() => {
						this._connect();
					}, reconnectTimeout);
				}
			};
		})());

		Connector.on("Disconnect", ((client) => {
			return () => {
				isDisconnect = true;
				client.close();
				this.emit(Store.EVENT_DISCONNECTED, null);
			};
		})(client));
	}

	_login(data) {
		Connector.send(Command.Login, data, (err, reply) => {
			if (err || reply === null) {
				console.log(err);
				this.emit(Store.EVENT_LOGIN_FAILED, err, data);
			} else {
				console.log("loginSuccess", reply);
				this.authority = reply.authority;
				this.emit(Store.EVENT_LOGIN_SUCCESS, null);
			}
		});
	}

    _logout(data) {
        this.authority = null;
        Connector.send(Command.Logout, {}, function () {
        });
	}
	
	// TODO: 仮です。
    getContentInfo() {
		return {
			url : "http://localhost/licenses.md",
			contentID : "hogepiyo",
			visible : true,
			wireframe : false,
			label : false
		}
	}
}

Store.EVENT_DISCONNECTED = "disconnected";
Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_CONNECT_FAILED = "connect_failed";
Store.EVENT_LOGIN_SUCCESS = "login_success";
Store.EVENT_LOGIN_FAILED = "login_failed";
export default Store;