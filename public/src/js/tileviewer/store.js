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

        this.globalSetting = {};

        // websocket接続が確立された.
        // ログインする.
        this.on(Store.EVENT_CONNECT_SUCCESS, (err) => {
            console.log("websocket connected")
            
            // グローバル設定を取得
            Connector.send(Command.GetGlobalSetting, {}, (err, reply) => {
                this.globalSetting = reply;
            });

                //let loginOption = { id: "APIUser", password: "" }
                //this.action.login(loginOption);
        });

        // 初回追加用カメラパラメータキャッシュ
        this.initialCameraParams = null;

        const year = 2019;
        const month = 4;
        const day = 30;
        const minHour = 10;

        // タイムラインStart Time
        this.timelineStartTime = new Date(year, (month - 1), day, minHour, 0, 0)
            // タイムラインEnd Time
        this.timelineEndTime = new Date(year, (month - 1), day, 23, 59, 59)
            // タイムラインCurrent Time
        this.timelineCurrentTime = new Date(year, (month - 1), day, 13, 51);
        // タイムラインのRangeBar(オレンジのやつ)
        this.timelineRangeBar = null;

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

        // 一定間隔同じイベントが来なかったら実行するための関数
        this.debounceUpdateMetadata = (() => {
            const interval = 100;
            let timer;
            return (targetMetaData, callback) => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    this.operation.updateMetadata(targetMetaData, callback);
                }, interval);
            };
        })();
    }

    __updateMetaData(targetMetaData, callback) {
        if (this.getGlobalSetting().hasOwnProperty('reduceUpdate') &&
            String(this.getGlobalSetting().reduceUpdate) === "true") {
            this.debounceUpdateMetadata(targetMetaData, callback);
        } else {
            this.operation.updateMetadata(targetMetaData, callback);
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
            const preData = this.metaData ? this.metaData.layerList : null;
            for (let i = 0; i < data.length; ++i) {
                let metaData = data[i];
                if (metaData.type === Constants.TypeTileViewer && this.metaData && metaData.id === this.metaData.id) {
                    this.metaData = metaData;
                    hasUpdateData = true;
                    break;
                }
            }

            if (hasUpdateData) {
                this.__changeLayerProeprty(preData);
            }
        });
        
        // タイムライン時刻変更の受信
        // パフォーマンス計測結果の受信
        Connector.on(Command.SendMessage, (data) => {
            if (data && data.hasOwnProperty('command') && data.command === "changeTileViewerContentTime") {
                if (data.hasOwnProperty('data') && data.data.hasOwnProperty('time')) {
                    // sync状態でない場合、同じコンテンツIDのものにしか反映させない)
                    if (TileViewerUtil.isTimelineSync(this.metaData, data.data.id, data.data.senderSync)) {
                        if (this.timelineCurrentTime.toJSON() != data.data.time) {
                            let range = (this.timelineEndTime.getTime() - this.timelineStartTime.getTime()) / 2;
                            this.timelineCurrentTime = new Date(data.data.time);
                            this.timelineStartTime = new Date(this.timelineCurrentTime.getTime() - range);
                            this.timelineEndTime = new Date(this.timelineCurrentTime.getTime() + range);
                            let message = {
                                time: data.data.time,
                            }
                            if (data.data.hasOwnProperty('rangeStartTime') && data.data.hasOwnProperty('rangeEndTime')) {
                                message.rangeStartTime = data.data.rangeStartTime;
                                message.rangeEndTime = data.data.rangeEndTime;
                            }
                            this.iframeConnector.send(TileViewerCommand.UpdateTime, message);
                            this.emit(Store.EVENT_DONE_CHANGE_TIMELINE_RANGE, null);
                        }
                    }
                }
            }
        });
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
            // iframe内のtileviewerのレイヤーが追加された
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
                    this.__updateMetaData(this.metaData, (err, res) => {
                        this.emit(Store.EVENT_DONE_ADD_LAYER, null, params)
                    });
                    return;
                }
                // 初回起動時などで、レイヤー情報がまだmetadataにない場合.
                this.emit(Store.EVENT_DONE_ADD_LAYER, null, params);
            });

            //  iframe内のitownsのレイヤーが削除された
            // storeのメンバに保存
            this.iframeConnector.on(TileViewerCommand.DeleteLayer, (err, params) => {
                this.emit(Store.EVENT_DONE_DELETE_LAYER, null, params);
            });

            this.iframeConnector.on(TileViewerCommand.UpdateLayer, (err, params) => {
                let layerList = [];
                if (params.length > 0 && this.metaData) {
                    for (let i = 0; i < params.length; ++i) {
                        let layerParam = params[i];
                        // let layer = this.getLayerData(layerParam.id);
                        layerList.push(layerParam);
                    }
                }
                this.metaData.layerList = JSON.stringify(layerList);
                this.__updateMetaData(this.metaData,  (err, res) => {});
            });

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
            this.metaData.cameraParams = JSON.stringify(data.params);
            let updateData = JSON.parse(JSON.stringify(this.metaData));
            // 幅高さは更新しない
            delete updateData.width;
            delete updateData.height;
            this.__updateMetaData(updateData, (err, res) => {});
        } else {
            // コンテンツ追加完了前だった。完了後にカメラを更新するため、キャッシュしておく。
            this.initialCameraParams = data.params;
        }
    }

    _changeCameraParams(data) {
        if (data.hasOwnProperty('params')) {
            // カメラをメタデータの値を元に設定
            this.iframeConnector.send(TileViewerCommand.UpdateCamera, {
                params: JSON.stringify(data.params),
            });
            // サーバ側データも更新
            this._updateCamera(data);
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
        this.__updateMetaData(metaData, (err, res) => {});
    }

    // サーバから現在登録されているwebglコンテンツのメタデータを取得してくる
    _fetchContents(data) {
        let metaDataDict = {}; // id, metaData
        Connector.send(Command.GetMetaData, { type: "all", id: '' }, (err, metaData) => {
            if (!err && metaData && metaData.type === Constants.TypeTileViewer) {
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
        if (meta.hasOwnProperty('cameraParams')) {
            // カメラをメタデータの値を元に設定
            this.iframeConnector.send(TileViewerCommand.UpdateCamera, {
                params: meta.cameraParams,
            });
        }
        if (meta.hasOwnProperty('zoomLabelVisible')) {
            TileViewerUtil.updateViewerParam(this.iframeConnector, meta, null);
        }
        this.metaData = meta;
        if (layerList.length > 0) {
            // レイヤー初期化
            this.iframeConnector.send(TileViewerCommand.InitLayers, layerList, (err, data) => {
                this._changeTimeByTimeline({
                    currentTime: this.timelineCurrentTime,
                    startTime: this.timelineStartTime,
                    endTime: this.timelineEndTime,
                });
            });
            //this.emit(Store.EVENT_DONE_ADD_LAYER, null, layerList);
            this.emit(Store.EVENT_DONE_UPDATE_METADATA, null, meta);
        }
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
        console.log("Not found layer from current content.", layerID, JSON.parse(this.metaData.layerList));
        return null;
    }

    getMetaData() {
        return this.metaData;
    }

    // this.metaDataのlayerListにlayerDataを文字列として上書き保存する
    saveLayer(layer) {
        let layerList = JSON.parse(this.metaData.layerList);
        for (let i = 0; i < layerList.length; ++i) {
            if (layerList[i]) {
                let id = layerList[i].id;
                if (id === layer.id) {
                    layerList[i] = layer;
                    //console.error("saveLayer", layerList)
                    this.metaData.layerList = JSON.stringify(layerList);
                    return;
                }
            }
        }
        console.error("Not found layer from current content.");
        return null;
    }

    // this.metaDataをもとに、iframe内のitownsのレイヤー情報を更新
    __changeLayerProeprty(preLayerList = []) {

        try {
            if (this.iframeConnector && this.metaData.hasOwnProperty('layerList')) {
                // レイヤー情報が異なる場合は全レイヤー更新
                if (preLayerList !== this.metaData.layerList) {
                    // console.error(preLayerList, this.metaData.layerList)
                    let layerList = JSON.parse(this.metaData.layerList);
                    for (let i = 0; i < layerList.length; ++i) {
                        let layer = layerList[i];
                        if (layer) {
                            this.iframeConnector.send(TileViewerCommand.ChangeLayerProperty, layer, (err, reply) => {
                                this.emit(Store.EVENT_DONE_CHANGE_LAYER_PROPERTY, null, layer);
                            });
                        }
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    _addLayer(data) {
        this.iframeConnector.send(TileViewerCommand.AddLayer, data);
    }

    _selectLayer(data) {
        this.iframeConnector.send(TileViewerCommand.SelectLayer, data);
    }

    _deleteLayer(data) {
        let layerList = JSON.parse(this.metaData.layerList);
        for (let i = 0; i < layerList.length; ++i) {
            if (layerList[i]) {
                let id = layerList[i].id;
                if (id === data.id) {
                    // iframeへ送る
                    this.iframeConnector.send(TileViewerCommand.DeleteLayer, data, (err, data_) => {
                    });
                    break;
                }
            }
        }
    }

    _changeLayerOrder(data) {
        this.iframeConnector.send(TileViewerCommand.ChangeLayerOrder, data, (err, data_) => {
            this.emit(Store.EVENT_DONE_CHANGE_LAYER_ORDER, null, data);
        });
    }

    _changeLayerProperty(data) {
        let layer = this.getLayerData(data.id);
        if (layer) {
            for (let key in data) {
                if (key !== "id" && key !== "callback") {
                    layer[key] = data[key];
                }
            }

            this.saveLayer(layer);

            this.__updateMetaData(this.metaData, (err, res) => {
                this.iframeConnector.send(TileViewerCommand.ChangeLayerProperty, layer, (err, reply) => {
                    this.emit(Store.EVENT_DONE_CHANGE_LAYER_PROPERTY, null, layer);
                });
                if (data.hasOwnProperty('callback')) {
                    data.callback();
                }
            });
        }
    }

    _changeTimelineRange(data) {
        if (data.hasOwnProperty('start') && data.hasOwnProperty('end')) {
            this.timelineStartTime = data.start;
            this.timelineEndTime = data.end;
            if (this.timelineCurrentTime.getTime() < this.timelineStartTime.getTime()) {
                this.timelineCurrentTime = this.timelineStartTime;
            }
            if (this.timelineCurrentTime.getTime() > this.timelineEndTime.getTime()) {
                this.timelineCurrentTime = this.timelineEndTime;
            }
            this.emit(Store.EVENT_DONE_CHANGE_TIMELINE_RANGE, null);
        }
    }

    _changeTimelineRangeBar(data) {
        if (data.hasOwnProperty('rangeStartTime') && data.hasOwnProperty('rangeEndTime')) {
            this.timelineRangeBar = data;
            if (data.rangeStartTime.getTime() === data.rangeEndTime.getTime()) {
                data.rangeEndTime = new Date(data.rangeStartTime.getTime() + 24 * 60 * 60 * 1000);
            }
        } else {
            this.timelineRangeBar = null;
        }
        this._changeTimeByTimeline({
            currentTime: this.timelineCurrentTime,
            startTime: this.timelineStartTime,
            endTime: this.timelineEndTime,
        });
        this.emit(Store.EVENT_DONE_CHANGE_TIMELINE_RANGE_BAR, null);
    }

    // タイムラインのGUIから時刻を変更した場合
    // 変更完了イベントを投げない（再描画を行わない）
    // 現在のstoreの時刻からタイムラインを再描画させるとタイムラインの設計的にtimeChangeが走って無限ループする。
    _changeTimeByTimeline(data) {
        this.timelineCurrentTime = data.currentTime;
        this.timelineStartTime = data.startTime;
        this.timelineEndTime = data.endTime;

        if (this.metaData) {
            const isSync = TileViewerUtil.isTimelineSync(this.metaData);
            // console.error("sendmessage", this.metaData.id)
            let message = {
                command: "changeTileViewerContentTime",
                data: {
                    time: data.currentTime.toJSON(),
                    rangeStartTime: this.timelineRangeBar ? this.timelineRangeBar.rangeStartTime.toJSON() : "",
                    rangeEndTime: this.timelineRangeBar ? this.timelineRangeBar.rangeEndTime.toJSON() : "",
                    id: this.metaData.id,
                    senderSync: isSync // 送信元のsync状態
                }
            };
            Connector.send(Command.SendMessage, message, () => {
                this.iframeConnector.send(TileViewerCommand.UpdateTime, {
                    time: data.currentTime.toJSON(),
                    rangeStartTime: this.timelineRangeBar ? this.timelineRangeBar.rangeStartTime.toJSON() : "",
                    rangeEndTime: this.timelineRangeBar ? this.timelineRangeBar.rangeEndTime.toJSON() : "",
                });
            })
        }
    }

    _changeZoomLabelVisible(data) {
        if (this.metaData) {
            let updateData = JSON.parse(JSON.stringify(this.metaData));
            // 幅高さは更新しない
            delete updateData.width;
            delete updateData.height;
            updateData.zoomLabelVisible = data.params;
            TileViewerUtil.updateViewerParam(this.iframeConnector, updateData, null);
            this.__updateMetaData(updateData, (err, res) => {});
        }
    }

    _changeTimelineSync(data) {
        if (this.metaData) {
            this.metaData.sync = data.sync;
            this.operation.updateMetadata(this.metaData, (err, res) => {});
            this.emit(Store.EVENT_DONE_UPDATE_METADATA, null, this.metaData);
        }
    }
    
    getTimelineStartTime() {
        return this.timelineStartTime;
    }

    getTimelineEndTime() {
        return this.timelineEndTime;
    }

    getTimelineCurrentTime() {
        return this.timelineCurrentTime;
    }

    getTimelineRangeBar() {
        return this.timelineRangeBar;
    }

    getTimelineCurrentTimeString() {
        const time = this.timelineCurrentTime;
        const year = time.getFullYear();
        const month = ("0" + (time.getMonth() + 1)).slice(-2);
        const date = ("0" + time.getDate()).slice(-2);
        const hour = ("0" + time.getHours()).slice(-2);
        const minutes = ("0" + time.getMinutes()).slice(-2);
        const seconds = ("0" + time.getSeconds()).slice(-2);
        const offset = time.getTimezoneOffset();
        const sign = Math.sign(-offset) >= 0 ? "+" : "-";
        const offsetMin = Math.abs(time.getTimezoneOffset() % 60);
        let offsetStr = "GMT" + sign + Math.floor(Math.abs(time.getTimezoneOffset() / 60));
        if (offsetMin > 0) {
            offsetStr += ":" + offsetMin;
        }
        if (offset === 0) {
            offsetStr = "GMT";
        }
        const ymdhms = year + "/" + month + "/" + date + " " +
            hour + ":" +
            minutes + ":" +
            seconds + " " + offsetStr

        return ymdhms;
    }

    getGlobalSetting() {
        return this.globalSetting;
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
Store.EVENT_DONE_FETCH_CONTENTS = "done_fetch_contents";
Store.EVENT_DONE_ADD_LAYER = "done_add_layer";
Store.EVENT_DONE_DELETE_LAYER = "done_delete_layer";
Store.EVENT_DONE_CHANGE_LAYER_ORDER = "done_change_layer_order";
Store.EVENT_DONE_CHANGE_LAYER_PROPERTY = "done_change_layer_property";
Store.EVENT_DONE_CHANGE_TIMELINE_RANGE = "done_change_timeline_range";
Store.EVENT_DONE_CHANGE_TIME = "done_change_time";
Store.EVENT_DONE_CHANGE_TIMELINE_RANGE_BAR = "done_change_timeline_range_bar";
export default Store;