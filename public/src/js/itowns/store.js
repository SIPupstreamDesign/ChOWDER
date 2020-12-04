/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Action from './action'
import Constants from '../common/constants'
import Command from '../common/command';
import Connector from '../common/ws_connector.js';
import Operation from './operation'
import IFrameConnector from '../common/iframe_connector';
import ITownsCommand from '../common/itowns_command';
import ITownsUtil from '../common/itowns_util';

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

        // csvキャッシュ。csvは大きいのでmetaDataとして登録しない。
        this.csvCaches = {}
        // jsonキャッシュ。jsonは大きいのでmetaDataとして登録しない。
        this.jsonCaches = {}

        const year = 2019;
        const month = 8;
        const day = 3;
        const minHour = 10;

        // タイムラインStart Time
        this.timelineStartTime = new Date(year, (month - 1), day, minHour, 0, 0)
        // タイムラインEnd Time
        this.timelineEndTime = new Date(year, (month - 1), day, 23, 59, 59)
        // タイムラインCurrent Time
        this.timelineCurrentTime = new Date(year, (month - 1), day, 13, 51);
        // タイムラインのRangeBar(オレンジのやつ)
        this.timelineRangeBar = null;

        // websocket接続が確立された.
        // ログインする.
        this.on(Store.EVENT_CONNECT_SUCCESS, (err) => {
            console.log("websocket connected")
            //let loginOption = { id: "APIUser", password: "" }
            //this.action.login(loginOption);
        })

        // コンテンツ追加完了した.
        this.on(Store.EVENT_DONE_ADD_CONTENT, (err, reply, endCallback) => {
            let isInitialContent = (!this.metaData);

            this.metaData = reply;
            if (isInitialContent) {
                // 初回追加だった
                // カメラ更新
                if (this.initialMatrix) {
                    this._updateCamera({
                        mat: this.initialMatrix,
                        params: this.initialCameraParams,
                    })
                }
            }
            if (endCallback) { endCallback(); }
        })

        this.performanceResult = {}

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

        // タイムライン時刻変更の受信
        // パフォーマンス計測結果の受信
        Connector.on(Command.SendMessage, (data) => {
            if (data && data.hasOwnProperty('command') && data.command === "measureITownPerformanceResult") {
                if (this.metaData.id === data.id) {
                    this.performanceResult[data.display_id] = data.result;
                    this.emit(Store.EVENT_UPDATE_MEASURE_PERFORMANCE, null, data.id, data.display_id);
                }
            }
            if (data && data.hasOwnProperty('command') && data.command === "changeItownsContentTime") {
                if (data.hasOwnProperty('data') && data.data.hasOwnProperty('time')) {
                     // sync状態でない場合、同じコンテンツIDのものにしか反映させない
                    if (ITownsUtil.isTimelineSync(this.metaData, data.data.id, data.data.senderSync)) {
                        if (this.timelineCurrentTime.toJSON() != data.data.time) {
                            let range = (this.timelineEndTime.getTime() - this.timelineStartTime.getTime()) / 2;
                            this.timelineCurrentTime = new Date(data.data.time);
                            this.timelineStartTime = new Date(this.timelineCurrentTime.getTime() - range);
                            this.timelineEndTime = new Date(this.timelineCurrentTime.getTime() + range);
                            let message = {
                                time : data.data.time,
                            }
                            if (data.data.hasOwnProperty('rangeStartTime') && data.data.hasOwnProperty('rangeEndTime')) {
                                message.rangeStartTime = data.data.rangeStartTime;
                                message.rangeEndTime = data.data.rangeEndTime;
                            }
                            this.iframeConnector.send(ITownsCommand.UpdateTime, message);
                            this.emit(Store.EVENT_DONE_CHANGE_TIMELINE_RANGE, null);
                        }
                    }
                }
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

    __execludeAndCacheCSVData(layerParams) {
        for (let i = 0; i < layerParams.length; ++i) {
            const layerParam = layerParams[i];
            if (layerParam.hasOwnProperty('csv')) {
                this.csvCaches[layerParam.id] = layerParam.csv;
                delete layerParam.csv;
                break;
            }
        }
    }

    __execludeAndCacheJSONData(layerParams) {
        for (let i = 0; i < layerParams.length; ++i) {
            const layerParam = layerParams[i];
            if (layerParam.hasOwnProperty('json')) {
                this.jsonCaches[layerParam.id] = layerParam.json;
                delete layerParam.json;
                break;
            }
        }
    }

    _connectIFrame(data) {
        let iframe = data;
        this.iframeConnector = new IFrameConnector(iframe);
        this.iframeConnector.connect(() => {

            // iframe内のitownsのレイヤーが追加された
            // storeのメンバに保存
            this.iframeConnector.on(ITownsCommand.AddLayer, (err, params) => {
                this.__execludeAndCacheCSVData(params);
                this.__execludeAndCacheJSONData(params);
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
            this.iframeConnector.on(ITownsCommand.DeleteLayer, (err, params) => {
            });

            this.iframeConnector.on(ITownsCommand.UpdateLayer, (err, params) => {
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
                this.operation.updateMetadata(this.metaData, (err, res) => {
                });
            });

            this.emit(Store.EVENT_DONE_IFRAME_CONNECT, null, this.iframeConnector);
        });
    }

    _addContent(data) {
        let metaData = data.metaData;
        let contentData = data.contentData;
        this.operation.addContent(metaData, contentData, () => {});
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

    _updateCamera(data) {
        if (this.metaData) {
            this.metaData.cameraWorldMatrix = data.mat;
            this.metaData.cameraParams = data.params;
            let updateData = JSON.parse(JSON.stringify(this.metaData));
            // 幅高さは更新しない
            delete updateData.width;
            delete updateData.height;
            this.operation.updateMetadata(updateData, (err, res) => {
            });
        } else {
            // コンテンツ追加完了前だった。完了後にカメラを更新するため、matrixをキャッシュしておく。
            this.initialMatrix = data.mat;
            this.initialCameraParams = data.params;
        }
    }

    _logout(data) {
        this.authority = null;
        Connector.send(Command.Logout, {}, function () {
        });
    }

    _addLayer(data) {
        this.iframeConnector.send(ITownsCommand.AddLayer, data);
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
        // TODO サーバ側更新
        let layerList = JSON.parse(this.metaData.layerList);
        for (let i = 0; i < layerList.length; ++i) {
            if (layerList[i]) {
                let id = layerList[i].id;
                if (id === data.id) {
                    // レイヤー削除して上書き
                    layerList.splice(i, 1);
                    this.metaData.layerList = JSON.stringify(layerList);

                    console.log("updateMetadata", data, this.metaData)
                    // iframeへ送る
                    this.iframeConnector.send(ITownsCommand.DeleteLayer, data, (err, data) => {
                        console.error("DeleteLayer")
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
        console.log("Not found layer from current content.", layerID, JSON.parse(this.metaData.layerList));
        return null;
    }

    getCSVCache(layerID) {
        if (this.csvCaches.hasOwnProperty(layerID)) {
            return this.csvCaches[layerID];
        }
        return null;
    }

    getJSONCache(layerID) {
        if (this.jsonCaches.hasOwnProperty(layerID)) {
            return this.jsonCaches[layerID];
        }
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
                    //console.error("saveLayer", layerList)
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
            if (!err && metaData && metaData.type === Constants.TypeWebGL && !metaData.webglType) {
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
        if (meta.hasOwnProperty('cameraWorldMatrix')) {
            // カメラをメタデータの値を元に設定
            this.iframeConnector.send(ITownsCommand.UpdateCamera, {
                mat : JSON.parse(meta.cameraWorldMatrix),
                params : JSON.parse(meta.cameraParams),
            });
        }
        if (layerList.length > 0) {
            // レイヤー初期化
            this.iframeConnector.send(ITownsCommand.InitLayers, layerList, (err, data) => {});
            this.emit(Store.EVENT_DONE_ADD_LAYER, null, layerList);
            this.emit(Store.EVENT_DONE_UPDATE_METADATA, null, meta);
        }
    }

    _changeTime(data) {
        this.timelineCurrentTime = data.currentTime;
        if (this.timelineCurrentTime.getTime() < this.timelineStartTime.getTime()
        ||  this.timelineCurrentTime.getTime() > this.timelineEndTime.getTime()) {
            const span = (this.timelineEndTime.getTime() - this.timelineStartTime.getTime()) / 2;
            this.timelineStartTime = new Date(this.timelineCurrentTime.getTime() - span);
            this.timelineEndTime = new Date(this.timelineCurrentTime.getTime() + span);
        }

        if (this.metaData) {
            const isSync = ITownsUtil.isTimelineSync(this.metaData);
             // console.error("sendmessage", this.metaData.id)
             let message = {
                 command : "changeItownsContentTime",
                 data : {
                     time : data.currentTime.toJSON(),
                     rangeStartTime : this.timelineRangeBar ? this.timelineRangeBar.rangeStartTime.toJSON() : "",
                     rangeEndTime : this.timelineRangeBar ? this.timelineRangeBar.rangeEndTime.toJSON() : "",
                     id : this.metaData.id,
                     senderSync : isSync // 送信元のsync状態
                 }
             };
            Connector.send(Command.SendMessage, message, () => {
                this.iframeConnector.send(ITownsCommand.UpdateTime, {
                    time : data.currentTime.toJSON(),
                    rangeStartTime : this.timelineRangeBar ? this.timelineRangeBar.rangeStartTime.toJSON() : "",
                    rangeEndTime : this.timelineRangeBar ? this.timelineRangeBar.rangeEndTime.toJSON() : "",
                });
            })

            this.emit(Store.EVENT_DONE_CHANGE_TIME, null, data);
        }
    }

    // タイムラインのGUIから時刻を変更した場合
    // 変更完了イベントを投げない（再描画を行わない）
    // 現在のstoreの時刻からタイムラインを再描画させるとタイムラインの設計的にtimeChangeが走って無限ループする。
    _changeTimeByTimeline(data) {
        this.timelineCurrentTime = data.currentTime;
        this.timelineStartTime = data.startTime;
        this.timelineEndTime =  data.endTime;

        if (this.metaData) {
           const isSync = ITownsUtil.isTimelineSync(this.metaData);
            // console.error("sendmessage", this.metaData.id)
            let message = {
                command : "changeItownsContentTime",
                data : {
                    time : data.currentTime.toJSON(),
                    rangeStartTime : this.timelineRangeBar ? this.timelineRangeBar.rangeStartTime.toJSON() : "",
                    rangeEndTime : this.timelineRangeBar ? this.timelineRangeBar.rangeEndTime.toJSON() : "",
                    id : this.metaData.id,
                    senderSync : isSync // 送信元のsync状態
                }
            };
            Connector.send(Command.SendMessage, message, () => {
                this.iframeConnector.send(ITownsCommand.UpdateTime, {
                    time : data.currentTime.toJSON(),
                    rangeStartTime : this.timelineRangeBar ? this.timelineRangeBar.rangeStartTime.toJSON() : "",
                    rangeEndTime : this.timelineRangeBar ? this.timelineRangeBar.rangeEndTime.toJSON() : "",
                });
            })
        }
    }

    _changeTimelineSync(data) {
        if (this.metaData) {
            this.metaData.sync = data.sync;
            this.operation.updateMetadata(this.metaData, (err, res) => {
            });
            this.emit(Store.EVENT_DONE_UPDATE_METADATA, null, this.metaData);
        }
    }

    _measurePerformance(data) {
        if (!this.metaData) return;
        this.performanceResult = {};
        Connector.send(Command.SendMessage, {
            command : "measureITownPerformance",
            id : this.metaData.id
        }, () => {});
    }

    getPerformanceResult() {
        return this.performanceResult;
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
            currentTime : this.timelineCurrentTime,
            startTime: this.timelineStartTime,
            endTime: this.timelineEndTime,
        });
        this.emit(Store.EVENT_DONE_CHANGE_TIMELINE_RANGE_BAR, null);
    }
    
    _upload(data) {
        console.error(data);
        const param = {
            filename : data.filename,
            type : data.type
        };
        Connector.sendBinary(Command.Upload, param, data.binary, (err, reply) => {
            this.emit(Store.EVENT_DONE_UPLOAD, err, reply);
        });
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
Store.EVENT_UPDATE_MEASURE_PERFORMANCE = "update_mesure_performance"; // 計測結果が更新された
Store.EVENT_DONE_CHANGE_TIMELINE_RANGE = "done_change_timeline_range";
Store.EVENT_DONE_CHANGE_TIME = "done_change_time";
Store.EVENT_DONE_CHANGE_TIMELINE_RANGE_BAR = "done_change_timeline_range_bar";
Store.EVENT_DONE_UPLOAD = "done_upload";
export default Store;