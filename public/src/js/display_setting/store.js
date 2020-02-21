/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
import Action from './action'
import Connector from '../common/ws_connector.js';
import Command from '../common/command';
import Constants from '../common/constants'

function DispPosData() {
    this.id = -1;
    this.pos2d = [0, 0];
    this.upPoint = {};
    this.downPoint = {};
    this.rightPoint = {};
    this.leftPoint = {};
    this.adj = { up: -1, down: -1, right: -1, left: -1 };
    this.relativeCoord = [0, 0];
};


class Store extends EventEmitter {
    constructor(action) {
        super();
        this.action = action;

        this.dataList = {};
        this.sendData;
        this.virtualDisplay = null;
        this.currentDisplayMarkers = [];

        this.isInitialized_ = false;
        this.initEvents();
        this.initStartupEvent();
        
        // ディスプレイsite
        this.displaySite = "group_default";
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

    // デバッグ用. release版作るときは消す
    emit() {
        if (arguments.length > 0) {
            if (!arguments[0]) {
                console.error("Not found EVENT NAME!", arguments[0])
            }
        }
        super.emit(...arguments);
    }

    release() {

    }

    _login(data) {
        if (data.hasOwnProperty('display_site')) {
            this.displaySite = data.display_site;
            delete data["display_site"]
        }
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

    _requestSiteList(data) {
        Connector.send(Command.GetGroupList, {}, (err, data) => {
            if (!err && data.hasOwnProperty("displaygrouplist")) {
                this.emit(Store.EVENT_DONE_GET_SITE_LIST, null, data.displaygrouplist)
            }
        });
    }

    _closeElectron() {
        Connector.send(Command.SendMessage, {
            command: "CloseElectronDisplay"
        }, (err, reply) => { });
        this.emit(Store.EVENT_CLOSE_ELECTRON, null, null);
    }

    //スキャン開始してよいかの判定の準備 
    initStartupEvent() {
        let displayCount = 0;

        this.on(Store.EVENT_DONE_GET_VIRTUAL_DISPLAY, (err, reply) => {
            if (err) {
                this.emit(Store.EVENT_START_SCAN, err, null);
                return;
            }
            displayCount = reply.splitX * reply.splitY;

            this._getCurrentDisplayMarkers();

            // 10秒くらいたってmarker_idを持ったdisplayが指定数ない場合はエラーとする
            setTimeout(() => {
                if (this.currentDisplayMarkers.length < displayCount) {
                    const errStr = "Not found for the number";
                    this.currentDisplayMarkers = [];
                    this.emit(Store.EVENT_START_SCAN, errStr, null);
                }
            }, 1 * 1000);
        });

        this.on(Store.EVENT_DONE_GET_CURRENT_DISPLAY_MARKERS, (err, marker_id) => {
            console.log("CURRENT_DISPLAY_MARKERS");
            if (err) {
                console.error(err); return;
            }
            this.currentDisplayMarkers.push(marker_id);
            if (this.currentDisplayMarkers.length === displayCount) {
                Connector.send(Command.SendMessage, {
                    command: "StartDisplaySetting"
                }, (err, reply) => { });
                this.emit(Store.EVENT_START_SCAN, null, this.currentDisplayMarkers);
            }
        });
    }

    /**
     * データのディープコピー
     * @param data 任意のデータ 
     */
    deepCopy(data) {
        return JSON.parse(JSON.stringify(data));
    }

    _connect() {
        console.log("_connect")
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

    //現在のマーカ群を取得
    _getCurrentDisplayMarkers() {
        this.currentDisplayMarkers = [];
        Connector.send(Command.GetWindowMetaData, { type: 'all', id: "" }, (err, json) => {
            if (err) {
                console.error(err);
                return;
            }
            // TODO groupによるサイト判別を追加する
            let group = json.group ? json.group : Constants.DefaultGroup;
            if (json.hasOwnProperty('marker_id')) {
                this.emit(Store.EVENT_DONE_GET_CURRENT_DISPLAY_MARKERS, err, json.marker_id)
            }
        });
    }

    getVirtualDisplay() {
        return this.virtualDisplay
    };
    getCurrentDisplayMarkers() {
        return this.currentDisplayMarkers;
    };
    
    //Virtual Displau Setting を取得
    _getVirtualDisplay() {
        this.currentDisplayMarkers = [];
        Connector.send(Command.GetVirtualDisplay, { group : this.displaySite }, (err, reply) => {
            this.virtualDisplay = reply;
            this.emit(Store.EVENT_DONE_GET_VIRTUAL_DISPLAY, err, reply);//GUIにイベントを投げる
        });
    }

    
    //this.dataListの取得 
    _getDataList() {
        console.log("getDataList", this.dataList)
        let dataL;
        if (Object.keys(this.dataList).length !== 0) {
            dataL = this.dataList;
        }
        this.emit(Store.EVENT_DONE_GET_DATA_LIST, null, dataL);
    }

    //データリストをリセット
    _deleteDataList() {
        this.dataList = {};
        this.emit(Store.EVENT_DONE_DELETE_DATA_LIST, null, null);
    }

    //ディスプレイに送るためのデータ構造に変換
    convertSendData() {
        let data = {};
        for (let i in this.dataList) {
            let adj = this.dataList[i].adj;
            if (!data[i.charAt(0)]) {
                data[i.charAt(0)] = [];
            }
            console.log(adj);
            data[i.charAt(0)][i.charAt(1) - 1] = this.deepCopy(adj);
        }
        console.log(data);
        return data;
    }

    //ディスプレイにデータを送る 
    _sendData() {
        console.log("SEND")

        // this.convertSendData()
        let data = { data: this.convertSendData() };
        //データ送信
        Connector.send(Command.SendMessage, {
            command: "RelocateElectronDisplay",
            data: data
        }, (err, reply) => {
            setTimeout(() => {
                // マーカーを再表示させる
                Connector.send(Command.SendMessage, {
                    command: "StartDisplaySetting",
                }, (err, reply) => { });
            }, 10000);
        });
    }

    /**
     * 調整モードでデータを送信する
     * @param data 送るデータ 
     */
    _adjustmentEvent(data) {
        console.log(data);
        Connector.send(Command.SendMessage, {
            command: "RelocateElectronDisplay",
            data: data
        }, (err, reply) => {
            setTimeout(() => {
                // マーカーを再表示させる
                Connector.send(Command.SendMessage, {
                    command: "StartDisplaySetting",
                }, (err, reply) => { });
            }, 10000);
        });
    }

    /**
     * スキャン回数の平均を求める
     * @param data　 戻り値
     */
    calcScanMinMargin(data) {
        let dir = ["up", "down", "right", "left"];
        for (let adjId in this.dataList) {
            let point = [this.dataList[adjId].upPoint, this.dataList[adjId].downPoint, this.dataList[adjId].rightPoint, this.dataList[adjId].leftPoint];
            for (let i in dir) {
                if (!data[adjId]) {
                    data[adjId] = [];
                }
                data[adjId][dir[i]] = 0;

                for (let dirId in point[i]) {
                    data[adjId][dir[i]] += point[i][dirId];
                }
            }
        };
        for (let adjId in this.dataList) {
            let dataLength = Object.keys(this.dataList).length;
            //console.log(dataLength);
            for (let i in dir) {
                data[adjId][dir[i]] = data[adjId][dir[i]] / dataLength;
            }
            //console.log(data);
        }
    }

    /**
     * 隣接関係の決定
     * @param  minMarginData　各マーカごとのスキャン回数の許容する最小値 
     */
    desideAdjacency(minMarginData) {
        for (let i in this.dataList) {
            let distances = { up: 0, down: 0, right: 0, left: 0 };
            for (let j in this.dataList) {
                if (this.dataList[i]) {
                    let point = [this.dataList[i].upPoint[j], this.dataList[i].downPoint[j], this.dataList[i].rightPoint[j], this.dataList[i].leftPoint[j]]
                    let dir = ["up", "down", "right", "left"];
                    for (let dirPointK in point) {
                        if (point[dirPointK]) {
                            let upIdPoint = this.deepCopy(point[dirPointK]);
                            let wholeMinMargin = 0;
                            for (let dirL in minMarginData[i]) {
                                wholeMinMargin += minMarginData[i][dirL];
                            }
                            wholeMinMargin /= 4;
                            if (upIdPoint >= minMarginData[i][dir[dirPointK]] && upIdPoint > wholeMinMargin) {

                                let tmpUpDifference = [this.dataList[j].pos2d[0] - this.dataList[i].pos2d[0], this.dataList[j].pos2d[1] - this.dataList[i].pos2d[1]];
                                let tmpUpDistance = Math.sqrt(tmpUpDifference[0] * tmpUpDifference[0] + tmpUpDifference[1] * tmpUpDifference[1]);
                                if (tmpUpDistance < distances[dir[dirPointK]] || distances[dir[dirPointK]] === 0) {
                                    // console.log(i + j + dir[dirPointK])
                                    //console.log(tmpUpDistance);
                                    distances[dir[dirPointK]] = this.deepCopy(tmpUpDistance);

                                    this.dataList[i].adj[dir[dirPointK]] = j;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    //相対座標の算出
    calcRelativeCoord() {
        let directionName = ["right", "left", "up", "down"]
        let rightCount = [];
        let upCount = []
        for (let i in this.dataList) {
            rightCount[i] = 0;
            upCount[i] = 0;
        }
        let resultCount = { right: rightCount, up: upCount }
        for (let i in this.dataList) {
            for (let j = 0; j < 2; j++) {
                if (this.dataList[i].adj[directionName[2 * j]] !== -1 && this.dataList[i].adj[directionName[2 * j + 1]] === -1) {
                    let id = this.dataList[i].adj[directionName[2 * j]];
                    let count = 1;
                    try {
                        while (id !== -1) {
                            resultCount[directionName[2 * j]][id] += count;
                            id = this.dataList[id].adj[directionName[2 * j]];
                            count++;
                            //隣接リストright,upへの参照がループしだしたとき、エラー
                            if (Object.keys(this.dataList).length <= count) {
                                break;
                            }
                        }
                    } catch (error) {
                        console.log(error.message);
                    }
                }
            }
        }
        for (let i in this.dataList) {
            this.dataList[i].relativeCoord[0] += resultCount["right"][i];
            this.dataList[i].relativeCoord[1] += resultCount["up"][i];
        }
        console.log(this.dataList);
    }

    //スキャン後、蓄積したデータから各IDにおける隣接リストを作成する
    _calcRelativeCoord() {
        let scanMinMargin = [];
        this.calcScanMinMargin(scanMinMargin);
        this.desideAdjacency(scanMinMargin);
        this.calcRelativeCoord();

        this.emit(Store.EVENT_DONE_CALC_RELATIVE_COORD, null, this.dataList);
    }

    /**
     * 各データの2D座標の差を取得
     * @param  data [id,scanFlag,coord]
     */
    calcDifferenceList(data) {
        let itr = 0;
        let IdQuantity = Object.keys(this.dataList).length;
        let differenceList = [];
        //console.log(IdQuantity);
        for (let a = 0; a < IdQuantity - 1; a++) {
            for (let b = 1; b < IdQuantity - a; b++) {
                //      console.log(String(a) + String(b))
                let abId = data[a + b][0];
                let aId = data[a][0];
                if (this.dataList[abId] && this.dataList[aId] && data[a][1] === 1 && data[a + b][1] === 1) {
                    differenceList[itr] = {
                        id: String(this.dataList[aId].id) + String(this.dataList[abId].id),
                        x: this.dataList[abId].pos2d[0] - this.dataList[aId].pos2d[0],
                        y: this.dataList[abId].pos2d[1] - this.dataList[aId].pos2d[1],
                    };
                    itr++;
                }
            }
        }
        return this.deepCopy(differenceList);
    /**
     *  IDの隣接状況の蓄積を行う
     * @param data [id,scanFlag,coord]
     * */}
    _storeScannedData(data) {
        /* console.log("data");
         console.log("data",this.deepCopy(data));
 */

        //データの入力
        console.log("input");
        for (let i = 0; i < data.length; i++) {
            if (data[i][1] === 1) {
                if (!this.dataList[data[i][0]]) {
                    this.dataList[data[i][0]] = new DispPosData;
                }
                this.dataList[data[i][0]].id = this.deepCopy(data[i][0]);
                this.dataList[data[i][0]].pos2d[0] = this.deepCopy(data[i][2]["x"])
                this.dataList[data[i][0]].pos2d[1] = this.deepCopy(data[i][2]["y"])
            }

        }
        //console.log(this.dataList);

        //スキャンした、各データごとの差をとる
        let differenceList = this.calcDifferenceList(data);
        console.log("difference", differenceList)

        //上下左右の隣接判定ができるように座標系を45度傾かせる
        let unitVec = [];
        let rotatedUnitVec = [];
        let squareSum = []
        for (let i = 0; i < differenceList.length; i++) {
            squareSum[i] = Math.sqrt(differenceList[i]["x"] * differenceList[i]["x"] + differenceList[i]["y"] * differenceList[i]["y"]);
            unitVec[i] = [differenceList[i]["x"] / squareSum[i], differenceList[i]["y"] / squareSum[i]];
            rotatedUnitVec[i] = [unitVec[i][0] * Math.cos(Math.PI / 4) - unitVec[i][1] * Math.sin(Math.PI / 4), unitVec[i][0] * Math.sin(Math.PI / 4) + unitVec[i][1] * Math.cos(Math.PI / 4)]
        }
        // console.log("squareSum",squareSum);
        // console.log("unitVec",unitVec);
        //console.log("rotatedUnitVec",rotatedUnitVec);

        //上下左右の関係を判定
        console.log("adjacency");
        for (let i = 0; i < differenceList.length; i++) {
            let idA = differenceList[i]["id"].substr(0, 2);
            let idB = differenceList[i]["id"].substr(2, 4);
            let margin = 0.5;
            if (!this.dataList[idA].upPoint[idB]) {
                this.dataList[idA].upPoint[idB] = 0;
            }
            if (!this.dataList[idA].downPoint[idB]) {
                this.dataList[idA].downPoint[idB] = 0;
            }
            if (!this.dataList[idA].leftPoint[idB]) {
                this.dataList[idA].leftPoint[idB] = 0;
            }
            if (!this.dataList[idA].rightPoint[idB]) {
                this.dataList[idA].rightPoint[idB] = 0;
            }
            if (!this.dataList[idB].upPoint[idA]) {
                this.dataList[idB].upPoint[idA] = 0;
            }
            if (!this.dataList[idB].downPoint[idA]) {
                this.dataList[idB].downPoint[idA] = 0;
            }
            if (!this.dataList[idB].leftPoint[idA]) {
                this.dataList[idB].leftPoint[idA] = 0;
            }
            if (!this.dataList[idB].rightPoint[idA]) {
                this.dataList[idB].rightPoint[idA] = 0;
            }

            if (rotatedUnitVec[i][0] >= 0 && rotatedUnitVec[i][1] <= 0 && Math.abs(unitVec[i][0]) < margin) {
                this.dataList[idA].downPoint[idB]++;
                this.dataList[idB].upPoint[idA]++;
                //   console.log(String(idB) + " is down of " + String(idA));
            }
            else if (rotatedUnitVec[i][0] <= 0 && rotatedUnitVec[i][1] <= 0 && Math.abs(unitVec[i][1]) < margin) {
                this.dataList[idA].leftPoint[idB]++;
                this.dataList[idB].rightPoint[idA]++;
                //   console.log(String(idB) + " is left of " + String(idA));
            }
            else if (rotatedUnitVec[i][0] >= 0 && rotatedUnitVec[i][1] >= 0 && Math.abs(unitVec[i][1]) < margin) {
                this.dataList[idA].rightPoint[idB]++;
                this.dataList[idB].leftPoint[idA]++;
                //  console.log(String(idB) + " is right of " + String(idA));
            }
            else if (rotatedUnitVec[i][0] <= 0 && rotatedUnitVec[i][1] >= 0 && Math.abs(unitVec[i][0]) < margin) {
                this.dataList[idA].upPoint[idB]++;
                this.dataList[idB].downPoint[idA]++;
                //  console.log(String(idB) + " is down of " + String(idA));
            }
        }
        console.log(this.dataList);

        this.emit(Store.EVENT_DONE_STORE_SCANNED_DATA, null, this.deepCopy(this.dataList));
    }

    //スキャン開始イベント
    _startScan() {
        if (!Connector.isConnected()) {
            // 接続されてない
            this.emit(Store.EVENT_START_SCAN, "Cannot connect to server");
            return;
        }
    }
}

Store.EVENT_DISCONNECTED = "disconnected";
Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_LOGIN_SUCCESS = "login_success";
Store.EVENT_LOGIN_FAILED = "login_failed";
Store.EVENT_DONE_GET_SITE_LIST = "get_site_list";
Store.EVENT_CONNECT_FAILED = "connect_failed";
Store.EVENT_DONE_GET_CURRENT_DISPLAY_MARKERS = "get_current_display_markers";
Store.EVENT_DONE_GET_DATA_LIST = "get_data_list";
Store.EVENT_DONE_GET_VIRTUAL_DISPLAY = "get_virtual_display";
Store.EVENT_DONE_STORE_SCANNED_DATA = "store_scanned_data";
Store.EVENT_DONE_CALC_RELATIVE_COORD = "calc_relative_coord";
Store.EVENT_DONE_SEND_DATA = "send_data";
Store.EVENT_DONE_DELETE_DATA_LIST = "delete_data_list";
Store.EVENT_START_SCAN = "start_scan";
Store.EVENT_CLOSE_ELECTRON = "close_erectron";
Store.EVENT_ADJUSTMENT_EVENT = "adjustment_event";
export default Store;