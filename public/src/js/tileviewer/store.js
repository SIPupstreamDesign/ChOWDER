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
import TileViewerCommand from '../common/tileviewer_command';
import TileViewerUtil from '../common/tileviewer_util';

const reconnectTimeout = 2000;

class Store extends EventEmitter {
    constructor(action) {
        super();
        this.action = action;
        this.operation = new Operation(Connector, this); // 各種storeからのみ限定的に使う
        this.isInitialized_ = false;

        this.initEvents();

        // コンテンツのメタデータ
        // 1ウィンドウ1コンテンツなのでメタデータは1つ
        this.metaData = null;

        // websocket接続が確立された.
        // ログインする.
        this.on(Store.EVENT_CONNECT_SUCCESS, (err) => {
            console.log("websocket connected")
                //let loginOption = { id: "APIUser", password: "" }
                //this.action.login(loginOption);
        });

        // 初回追加用カメラパラメータキャッシュ
        this.initialCameraParams = null;

        // コンテンツ追加完了した.
        this.on(Store.EVENT_DONE_ADD_CONTENT, (err, reply, endCallback) => {
            let isInitialContent = (!this.metaData);

            this.metaData = reply;
            if (isInitialContent) {
                // 初回追加だった
                // カメラ更新
                if (this.initialCameraParams) {
                    this._updateCamera({
                        params: this.initialCameraParams,
                    })
                }
            }
            if (endCallback) { endCallback(); }
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

    release() {}

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

        /// メタデータが更新された
        Connector.on(Command.UpdateMetaData, (data) => {
            let hasUpdateData = false;
            for (let i = 0; i < data.length; ++i) {
                let metaData = data[i];
                if (metaData.type === Constants.TypeTileViewer && this.metaData && metaData.id === this.metaData.id) {
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

    // this.metaDataをもとに、iframe内のレイヤー情報を更新
    __changeLayerProeprty(preLayerList = []) {}

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

            /*
            // iframe内のitownsのレイヤーが追加された
            // storeのメンバに保存
            this.iframeConnector.on(TileViewerCommand.AddLayer, (err, params) => {

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
                    this.operation.updateMetadata(this.metaData, (err, res) => {
                        this.emit(Store.EVENT_DONE_ADD_LAYER, null, params)
                    });
                    return;
                }
                // 初回起動時などで、レイヤー情報がまだmetadataにない場合.
                this.emit(Store.EVENT_DONE_ADD_LAYER, null, params);
            });

            //  iframe内のitownsのレイヤーが削除された
            // storeのメンバに保存
            this.iframeConnector.on(TileViewerCommand.DeleteLayer, (err, params) => {});

            this.iframeConnector.on(TileViewerCommand.UpdateLayer, (err, params) => {
                this.__execludeAndCacheCSVData(params);
                let layerList = [];
                if (params.length > 0 && this.metaData) {
                    for (let i = 0; i < params.length; ++i) {
                        let layerParam = params[i];
                        let layer = this.getLayerData(layerParam.id);
                        if (layer) {
                            layerList.push(layerParam);
                        } else {
                            console.error("Not found layer on ChOWDER metadata", layerParam.id)
                        }
                    }
                }
                this.metaData.layerList = JSON.stringify(layerList);
                this.operation.updateMetadata(this.metaData, (err, res) => {});
            });
            */

            this.emit(Store.EVENT_DONE_IFRAME_CONNECT, null, this.iframeConnector);
        });
    }

    _addContent(data) {
        let metaData = data.metaData;
        let contentData = data.contentData;
        this.operation.addContent(metaData, contentData, () => {});
    }

    _updateCamera(data) {
        if (this.metaData) {
            this.metaData.cameraParams = data.params;
            let updateData = JSON.parse(JSON.stringify(this.metaData));
            // 幅高さは更新しない
            delete updateData.width;
            delete updateData.height;
            this.operation.updateMetadata(updateData, (err, res) => {});
        } else {
            // コンテンツ追加完了前だった。完了後にカメラを更新するため、キャッシュしておく。
            this.initialCameraParams = data.params;
        }
    }

    // コンテンツのリサイズ
    // コンテンツの現在の幅高さを考慮しつつ、入力されたsizeに応じて拡縮する
    _resizeContent(data) {
        let wh = data.size;
        let metaData = this.metaData;
        if (!metaData) { return; }
        metaData.width = metaData.width * (wh.width / parseFloat(metaData.orgWidth));
        metaData.height = metaData.height * (wh.height / parseFloat(metaData.orgHeight));
        metaData.orgWidth = wh.width;
        metaData.orgHeight = wh.height;
        this.operation.updateMetadata(metaData, (err, res) => {});
    }
}

Store.EVENT_DISCONNECTED = "disconnected";
Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_CONNECT_FAILED = "connect_failed";
Store.EVENT_LOGIN_SUCCESS = "login_success";
Store.EVENT_LOGIN_FAILED = "login_failed";
Store.EVENT_DONE_IFRAME_CONNECT = "done_iframe_connect"
Store.EVENT_DONE_ADD_CONTENT = "done_add_content";
Store.EVENT_DONE_UPDATE_METADATA = "done_update_metadata";
export default Store;