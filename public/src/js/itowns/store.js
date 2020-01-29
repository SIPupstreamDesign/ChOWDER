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
import ITownsCommand from '../common/itowns_command';

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
                        mat: this.initialMatrix
                    })
                }
            }
        })

        /// メタデータが更新された
        Connector.on(Command.UpdateMetaData, (data) => {
            let hasUpdateData = false;
            for (let i = 0; i < data.length; ++i) {
                let metaData = data[i];
                if (metaData.type === Constants.TypeWebGL && this.metaData && metaData.id === this.metaData.id) {
                    this.metaData = metaData;
                    hasUpdateData = true;
                    break;
                }
            }

            if (hasUpdateData) {
                this.__changeLayerProeprty();
            }
        });
    }

    // this.metaDataをもとに、iframe内のitownsのレイヤー情報を更新
    __changeLayerProeprty(preLayerList = []) {

        try {
            if (this.iframeConnector && this.metaData.hasOwnProperty('layerList')) {
                // レイヤー情報が異なる場合は全レイヤー更新
                if (preLayerList !== this.metaData.layerList) {
                    let layerList = JSON.parse(this.metaData.layerList);
                    for (let i = 0; i < layerList.length; ++i) {
                        let layer = layerList[i];
                        if (layer) {
                            this.iframeConnector.send(ITownsCommand.ChangeLayerProperty, layer, (err, reply) => {
                                this.emit(Store.EVENT_DONE_CHANGE_LAYER_PROPERTY, null, layer);
                            });
                        }
                    }
                }
            }
        }
        catch (e) {
            console.error(e);
        }
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

    _connectIFrame(data) {
        let iframe = data;
        this.iframeConnector = new IFrameConnector(iframe);
        this.iframeConnector.connect(() => {

            // iframe内のitownsのレイヤーが追加された
            // storeのメンバに保存
            this.iframeConnector.on(ITownsCommand.AddLayer, (err, params) => {
                if (params.length > 0 && this.metaData) {
                    for (let i = 0; i < params.length; ++i) {
                        let layerParam = params[i];
                        let layer = this.getLayerData(layerParam.id);
                        if (!layer) {
                            let layerList = JSON.parse(this.metaData.layerList);
                            layerList.push(layerParam);
                            this.metaData.layerList = JSON.stringify(layerList);
                        }
                    }
                }
                this.emit(Store.EVENT_DONE_ADD_LAYER, null, params)
            });

            this.emit(Store.EVENT_DONE_IFRAME_CONNECT, null, this.iframeConnector);
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

    _addLayer(data) {
        this.iframeConnector.send(ITownsCommand.AddLayer, data, (err, data) => {
        });
        //if (this.metaData) {
        /*
        this.metaData.layerList = data;
        let updateData = JSON.parse(JSON.stringify(this.metaData));
        // 幅高さは更新しない
        delete updateData.width;
        delete updateData.height;
        this.operation.updateMetadata(updateData, (err, res) => {
        });
        */
        //}
    }

    _deleteLayer(data) {
        console.error(data);
        // TODO サーバ側更新
        let layerList = JSON.parse(this.metaData.layerList);
        for (let i = 0; i < layerList.length; ++i) {
            if (layerList[i]) {
                let id = layerList[i].id;
                if (id === data.id) {
                    // レイヤー削除して上書き
                    delete layerList[i];
                    this.metaData.layerList = JSON.stringify(layerList);

                    console.error("updateMetadata", data, this.metaData)
                    // iframeへ送る
                    this.iframeConnector.send(ITownsCommand.DeleteLayer, data, (err, data) => {
                        // サーバへ送る
                        this.operation.updateMetadata(this.metaData, (err, res) => {
                            this.emit(Store.EVENT_DONE_DELETE_LAYER, null, data);
                        });
                    });
                    break;
                }
            }
        }
    }

    _changeLayerOrder(data) {
        // TODO サーバ側更新
        this.iframeConnector.send(ITownsCommand.ChangeLayerOrder, data, (err, data) => {
            this.emit(Store.EVENT_DONE_CHANGE_LAYER_ORDER, null, data);
        });
    }

    getLayerData(layerID) {
        if (this.metaData && this.metaData.layerList) {
            let layerList = JSON.parse(this.metaData.layerList);
            for (let i = 0; i < layerList.length; ++i) {
                let layer = layerList[i];
                if (layer) {
                    let id = layer.id;
                    if (id === layerID) {
                        return layer;
                    }
                }
            }
        }
        console.error("Not found layer from current content.", layerID);
        return null;
    }

    // this.metaDataのlayerListにlayerDataを文字列として上書き保存する
    saveLayer(layer) {
        let layerList = JSON.parse(this.metaData.layerList);
        for (let i = 0; i < layerList.length; ++i) {
            if (layerList[i]) {
                let id = layerList[i].id;
                if (id === layer.id) {
                    layerList[i] = layer;
                    this.metaData.layerList = JSON.stringify(layerList);
                    return;
                }
            }
        }
        console.error("Not found layer from current content.");
        return null;
    }

    _changeLayerProperty(data) {
        let layer = this.getLayerData(data.id);
        if (layer) {
            for (let key in data) {
                if (key !== "id") {
                    layer[key] = data[key];
                }
            }
            this.saveLayer(layer);

            this.operation.updateMetadata(this.metaData, (err, res) => {
            });

            // 接続されていなくても見た目上変わるようにしておく
            if (!Connector.isConnected) {
                this.iframeConnector.send(ITownsCommand.ChangeLayerProperty, layer, (err, reply) => {
                    this.emit(Store.EVENT_DONE_CHANGE_LAYER_PROPERTY, null, layer);
                });
            }
        }
        //console.error(this);
    }

    // サーバから現在登録されているwebglコンテンツのメタデータを取得してくる
    _fetchContents(data) {
        let metaDataDict = {}; // id, metaData
        Connector.send(Command.GetMetaData, { type: "all", id: '' }, (err, metaData) => {
            if (!err && metaData && metaData.type === Constants.TypeWebGL) {
                if (!metaDataDict.hasOwnProperty(metaData.id)) {
                    metaDataDict[metaData.id] = metaData;
                    this.emit(Store.EVENT_DONE_FETCH_CONTENTS, null, metaData);
                }
            }
        });
    }

    _loadUserData(meta) {
        let layerList = [];
        try {
            layerList = JSON.parse(meta.layerList);
        } catch (err) {
            console.error(err);
        }
        this.metaData = meta;
        if (layerList.length > 0) {
            for (let i = 0; i < layerList.length; ++i) {
                if (layerList[i]) {
                    this._addLayer(layerList[i]);
                ]
                }
                this.emit(Store.EVENT_DONE_ADD_LAYER, null, layerList);
            }
            this.emit(Store.EVENT_DONE_UPDATE_METADATA, null, meta);
        }
    }
}

Store.EVENT_DISCONNECTED = "disconnected";
Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_CONNECT_FAILED = "connect_failed";
Store.EVENT_LOGIN_SUCCESS = "login_success";
Store.EVENT_LOGIN_FAILED = "login_failed";
Store.EVENT_DONE_ADD_CONTENT = "done_add_content";
Store.EVENT_DONE_UPDATE_METADATA = "done_update_metadata";
Store.EVENT_DONE_ADD_LAYER = "done_add_layer";
Store.EVENT_DONE_DELETE_LAYER = "done_delete_layer";
Store.EVENT_DONE_CHANGE_LAYER_ORDER = "done_change_layer_order";
Store.EVENT_DONE_CHANGE_LAYER_PROPERTY = "done_change_layer_property";
Store.EVENT_DONE_IFRAME_CONNECT = "done_iframe_connect"
Store.EVENT_DONE_FETCH_CONTENTS = "done_fetch_contents";

export default Store;