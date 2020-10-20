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
	
	_connectIFrame(data) {
        let iframe = data;
        this.iframeConnector = new IFrameConnector(iframe);
        this.iframeConnector.connect(() => {

            // // iframe内のitownsのレイヤーが追加された
            // // storeのメンバに保存
            // this.iframeConnector.on(ITownsCommand.AddLayer, (err, params) => {
            //     if (params.length > 0 && this.metaData) {
            //         for (let i = 0; i < params.length; ++i) {
            //             let layerParam = params[i];
            //             let layer = this.getLayerData(layerParam.id);
            //             if (!layer) {
            //                 let layerList = JSON.parse(this.metaData.layerList);
            //                 layerList.push(layerParam);
            //                 this.metaData.layerList = JSON.stringify(layerList);
            //             }
            //         }
            //         this.operation.updateMetadata(this.metaData, (err, res) => {
            //             this.emit(Store.EVENT_DONE_ADD_LAYER, null, params)
            //         });
            //         return;
            //     }
            //     // 初回起動時などで、レイヤー情報がまだmetadata似ない場合.
            //     this.emit(Store.EVENT_DONE_ADD_LAYER, null, params);
            // });

            // //  iframe内のitownsのレイヤーが削除された
            // // storeのメンバに保存
            // this.iframeConnector.on(ITownsCommand.DeleteLayer, (err, params) => {
            // });

            // this.iframeConnector.on(ITownsCommand.UpdateLayer, (err, params) => {
            //     let layerList = [];
            //     if (params.length > 0 && this.metaData) {
            //         for (let i = 0; i < params.length; ++i) {
            //             let layerParam = params[i];
            //             let layer = this.getLayerData(layerParam.id);
            //             if (layer) {
            //                 layerList.push(layerParam);
            //             } else {
            //                 console.error("Not found layer on ChOWDER metadata", layerParam.id)
            //             }
            //         }
            //     }
            //     this.metaData.layerList = JSON.stringify(layerList);
            //     this.operation.updateMetadata(this.metaData, (err, res) => {
            //     });
            // });
			console.log("[store]:_connectIFrame")
            this.emit(Store.EVENT_DONE_IFRAME_CONNECT, null, this.iframeConnector);
        });
    }

    _addContent(data) {
		console.log("[store]addContent");
        let metaData = data.metaData;
        let contentData = data.contentData;
        this.operation.addContent(metaData, contentData);
    }

	// TODO: 仮です。
    getContentInfo() {
		return {
			url : "http://localhost/qgis/qgis2three_noserver/index.html",
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
Store.EVENT_DONE_IFRAME_CONNECT = "done_iframe_connect"
Store.EVENT_DONE_ADD_CONTENT = "done_add_content";

export default Store;