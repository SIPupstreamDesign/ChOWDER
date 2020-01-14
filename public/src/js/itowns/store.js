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

const reconnectTimeout = 2000;

class Store extends EventEmitter {
    constructor(action) {
        super();
        this.action = action;
        this.operation = new Operation(Connector, this); // 各種storeからのみ限定的に使う
        this.isInitialized_ = false;

        this.initEvents();

        // itownコンテンツのメタデータ
        // 1ウィンドウ1itownコンテンツなのでメタデータは1つ
        this.metaData = null;
        
        // 初回カメラ行列用キャッシュ
        this.initialMatrix = null;

        // websocket接続が確立された.
        // ログインする.
        this.on(Store.EVENT_CONNECT_SUCCESS, (err) => {
            console.log("websocket connected")
            let loginOption = { id: "APIUser", password: "" }
            this.action.login(loginOption);
        })

        // コンテンツ追加完了した.
        this.on(Store.EVENT_DONE_ADD_CONTENT, (err, reply) => {
            let isInitialContent = (!this.metaData);

            this.metaData = reply;

            if (isInitialContent) {
                // 初回追加だった
                // カメラ更新
                if (this.initialMatrix) {
                    this._updateCameraWorldMatrix({
                        mat : this.initialMatrix
                    })
                }
            }
        })
        
        /// メタデータが更新された
        Connector.on(Command.UpdateMetaData, (data) => {
			for (let i = 0; i < data.length; ++i) {
                let metaData = data[i];
                if (this.metaData && metaData.id === this.metaData.id) {
                    this.metaData = metaData;
                }
            }
        });
    }

    // デバッグ用. release版作るときは消す
    emit() {
        if (arguments.length > 0) {
            if (!arguments[0]) {
                console.error("Not found EVENT NAME!")
            }
        }
        super.emit(...arguments);
    }

    release() { }

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
        let isDisconnect = false;
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

                if (!isDisconnect) {
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

    _addContent(data) {
        let metaData = data.metaData;
        let contentData = data.contentData;
        this.operation.addContent(metaData, contentData);
    }

    _resizeWindow(data) {
        let wh = data.size;
        let cx = wh.width / 2.0;
        let cy = wh.height / 2.0;
        let metaData = this.metaData;
        if (!metaData) { return; }
        metaData.width = metaData.width * (wh.width / parseFloat(metaData.orgWidth));
        metaData.height = metaData.height * (wh.height / parseFloat(metaData.orgHeight));
        metaData.orgWidth = wh.width;
        metaData.orgHeight = wh.height;
        this.operation.updateMetadata(metaData, (err, res) => {
        }); 
    }

    _updateCameraWorldMatrix(data) {
        if (this.metaData) {
            this.metaData.cameraWorldMatrix = data.mat;
            let updateData = JSON.parse(JSON.stringify(this.metaData));
            // 幅高さは更新しない
            delete updateData.width;
            delete updateData.height;
            this.operation.updateMetadata(updateData, (err, res) => {
            });   
        } else {
            // コンテンツ追加完了前だった。完了後にカメラを更新するため、matrixをキャッシュしておく。
            this.initialMatrix = data.mat;
        }
    }

    _logout(data) {
        this.authority = null;
        Connector.send(Command.Logout, {}, function () {
        });
    }

    _addMap(data) {
        //if (this.metaData) {
            /*
            this.metaData.mapList = data;
            let updateData = JSON.parse(JSON.stringify(this.metaData));
            // 幅高さは更新しない
            delete updateData.width;
            delete updateData.height;
            this.operation.updateMetadata(updateData, (err, res) => {

            });   
            */
           this.emit(Store.EVENT_DONE_ADD_MAP, null, data);
        //}
    }
}

Store.EVENT_DISCONNECTED = "disconnected";
Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_CONNECT_FAILED = "connect_failed";
Store.EVENT_LOGIN_SUCCESS = "login_success";
Store.EVENT_LOGIN_FAILED = "login_failed";
Store.EVENT_DONE_ADD_CONTENT = "done_add_content";
Store.EVENT_DONE_UPDATE_METADATA = "done_update_metadata";
Store.EVENT_DONE_ADD_MAP = "done_add_map";
export default Store;