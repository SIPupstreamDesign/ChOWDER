/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
import Action from './action'
import Connector from '../common/ws_connector.js';
import Command from '../common/command';
import Constants from '../common/constants'

function Adjacency() {
    this.id = -1;
    this.pos2d = [0, 0];
    this.adjacencyUp = [];
    this.adjacencyDown = [];
    this.adjacencyRight = [];
    this.adjacencyLeft = [];
    this.adjacency = { up: -1, down: -1, right: -1, left: -1 };
    this.relativeCoord = [0, 0];
};


class Store extends EventEmitter {
    constructor(action) {
        super();
        this.action = action;

        this.displayNumber = 0;

        /* this.adjacencyList;
         this.differenceList = [];
 */
        this.AdjacencyList = [];
        this.sendData;

        this.isInitialized_ = false;
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

    // デバッグ用. release版作るときは消す
    emit() {
        if (arguments.length > 0) {
            if (!arguments[0]) {
                console.error("Not found EVENT NAME!", arguments[0])
            }
        }
        super.emit(...arguments);
    }

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

    _getCurrentDisplayMarkers(data) {
        Connector.send(Command.GetWindowMetaData, { type: 'all', id: "" }, (err, json) => {
            if (err) {
                console.error(err);
                return;
            }
            // TODO groupによるサイト判別を追加する
            let group = json.group ? json.group : Constants.DefaultGroup;
            if (json.hasOwnProperty('marker_id')) {
                this.emit(Store.EVENT_DONE_GET_CURRENT_DISPLAY_MARKER, err, json.marker_id)
            }
        });
    }

    _getVirtualDisplay() {
        Connector.send(Command.GetVirtualDisplay, {}, (err, reply) => {
            this.virtualDisplay = reply;
            this.emit(Store.EVENT_DONE_GET_VIRTUAL_DISPLAY, err, reply);//GUIにイベントを投げる
        });
    }

    /**
     * ディスプレイに送るためのデータ構造に変換
     * @param {*} data
     * {
     *   PCID
     *   {  
     *     up
     *     down
     *     right
     *     left
     *   }
     * }
     */
    convertSendData() {
        let data = {};
        for (let i in this.AdjacencyList) {
            let adjacency = this.AdjacencyList[i].adjacency;
            if (!data[i.charAt(0)]) {
                data[i.charAt(0)] = [];
            }
            console.log(adjacency);
            data[i.charAt(0)][i.charAt(1) - 1] = this.deepCopy(adjacency);
        }
        console.log(data);
        return data;
    }

    /**
     *  ディスプレイにデータを送る 
     */
    _sendData() {
        console.log("send")

        // this.convertSendData()
        let data = { data: this.convertSendData() };
        try {
            console.log(JSON.stringify(data));
        }
        catch (err) {
            console.log("err", err);
        }//this.sendData = data;
        //データ送信
        Connector.send(Command.RelocateElectronDisplay, data, (err, reply) => { this.AdjacencyList = []; });
        //隣接リストをリセット
        //this.AdjacencyList = [];
    }

    //スキャン回数の半分に満たないデータは捨てる
    calcScanMinMargin(data) {
        for (let adjacencyId in this.AdjacencyList) {
            if (!data[adjacencyId]) {
                data[adjacencyId] = [];
            }
            data[adjacencyId]["up"] = 0;
            data[adjacencyId]["down"] = 0;
            data[adjacencyId]["right"] = 0;
            data[adjacencyId]["left"] = 0;
            for (let upId in this.AdjacencyList[adjacencyId].adjacencyUp) {
                data[adjacencyId]["up"] += this.AdjacencyList[adjacencyId].adjacencyUp[upId];
            }
            for (let downId in this.AdjacencyList[adjacencyId].adjacencyDown) {
                data[adjacencyId]["down"] += this.AdjacencyList[adjacencyId].adjacencyDown[downId];
            }
            for (let rightId in this.AdjacencyList[adjacencyId].adjacencyRight) {
                data[adjacencyId]["right"] += this.AdjacencyList[adjacencyId].adjacencyRight[rightId];
            }
            for (let leftId in this.AdjacencyList[adjacencyId].adjacencyLeft) {
                data[adjacencyId]["left"] += this.AdjacencyList[adjacencyId].adjacencyLeft[leftId];
            }
        };
        for (let adjacencyId in this.AdjacencyList) {
            let tmpLength=Object.keys(this.AdjacencyList).length;
            console.log(tmpLength);
            data[adjacencyId]["up"] = data[adjacencyId]["up"]/tmpLength;
            data[adjacencyId]["down"] = data[adjacencyId]["down"]/tmpLength;
            data[adjacencyId]["right"] = data[adjacencyId]["right"]/tmpLength;
            data[adjacencyId]["left"] =data[adjacencyId]["left"]/ tmpLength;
        }
        console.log(data);
        /*for (let id in data) {
            for (let markerId in data[id]) {
                data[id][markerId] = data[id][markerId] / 2;
            }
        }*/
    }

    desideAdjacency(minMarginData) {
        for (let i in this.AdjacencyList) {
            let distances = { up: 0, down: 0, right: 0, left: 0 };
            for (let j in this.AdjacencyList) {
                if (this.AdjacencyList[i]) {

                    if (this.AdjacencyList[i].adjacencyUp[j]) {
                        let upIdPoint = this.deepCopy(this.AdjacencyList[i].adjacencyUp[j]);
                        if (/*upIdPoint >= this.AdjacencyList[i].adjacency["up"] &&*/ upIdPoint >= minMarginData[i]["up"]) {
                           
                            let tmpUpDifference = [this.AdjacencyList[j].pos2d[0] - this.AdjacencyList[i].pos2d[0], this.AdjacencyList[j].pos2d[1] - this.AdjacencyList[i].pos2d[1]];
                            let tmpUpDistance = Math.sqrt(tmpUpDifference[0] * tmpUpDifference[0] + tmpUpDifference[1] * tmpUpDifference[1]);
                            if (tmpUpDistance < distances["up"] || distances["up"] === 0) { 
                                console.log(i+j+"up")
                                console.log(tmpUpDistance);
                                distances["up"] = this.deepCopy(tmpUpDistance);

                                this.AdjacencyList[i].adjacency["up"] = j;
                            }
                        }
                    }

                    if (this.AdjacencyList[i].adjacencyDown[j]) {
                        let downIdPoint = this.deepCopy(this.AdjacencyList[i].adjacencyDown[j]);
                        if (/*downIdPoint >= this.AdjacencyList[i].adjacency["down"] &&*/ downIdPoint >= minMarginData[i]["down"]) {
                            let tmpDownDifference = [this.AdjacencyList[j].pos2d[0] - this.AdjacencyList[i].pos2d[0], this.AdjacencyList[j].pos2d[1] - this.AdjacencyList[i].pos2d[1]];
                            let tmpDownDistance = Math.sqrt(tmpDownDifference[0] * tmpDownDifference[0] + tmpDownDifference[1] * tmpDownDifference[1]);
                            if (tmpDownDistance < distances["down"] || distances["down"] === 0) {
                                console.log(i+j+"down")
                                console.log(tmpDownDistance);
                                distances["down"] = this.deepCopy(tmpDownDistance);

                                this.AdjacencyList[i].adjacency["down"] = j;
                            }
                        }
                    }

                    if (this.AdjacencyList[i].adjacencyRight[j]) {
                        let rightIdPoint = this.deepCopy(this.AdjacencyList[i].adjacencyRight[j]);
                        if (/*rightIdPoint >= this.AdjacencyList[i].adjacency["right"] &&*/ rightIdPoint >= minMarginData[i]["right"]) {
                            let tmpRightDifference = [this.AdjacencyList[j].pos2d[0] - this.AdjacencyList[i].pos2d[0], this.AdjacencyList[j].pos2d[1] - this.AdjacencyList[i].pos2d[1]];
                            let tmpRightDistance = Math.sqrt(tmpRightDifference[0] * tmpRightDifference[0] + tmpRightDifference[1] * tmpRightDifference[1]);
                            if (tmpRightDistance < distances["right"] || distances["right"] === 0) {
                                console.log(i+j+"right")
                                console.log(tmpRightDistance);
                                distances["right"] = this.deepCopy(tmpRightDistance);

                                this.AdjacencyList[i].adjacency["right"] = j;
                            }
                        }
                    }

                    if (this.AdjacencyList[i].adjacencyLeft[j]) {
                        let leftIdPoint = this.deepCopy(this.AdjacencyList[i].adjacencyLeft[j]);
                        if (/*leftIdPoint >= this.AdjacencyList[i].adjacency["left"] &&*/ leftIdPoint >= minMarginData[i]["left"]) {
                            let tmpLeftDifference = [this.AdjacencyList[j].pos2d[0] - this.AdjacencyList[i].pos2d[0], this.AdjacencyList[j].pos2d[1] - this.AdjacencyList[i].pos2d[1]];
                            let tmpLeftDistance = Math.sqrt(tmpLeftDifference[0] * tmpLeftDifference[0] + tmpLeftDifference[1] * tmpLeftDifference[1]);
                            if (tmpLeftDistance < distances["left"] || distances["left"] === 0) {
                                console.log(i+j+"left")
                                console.log(tmpLeftDistance);
                                distances["left"] = this.deepCopy(tmpLeftDistance);

                                this.AdjacencyList[i].adjacency["left"] = j;
                            }
                        }
                    }

                    /* if (this.AdjacencyList[i].adjacencyDown[j]) {
                         let downIdPoint = this.deepCopy(this.AdjacencyList[i].adjacencyDown[j]);
                         if (downIdPoint > this.AdjacencyList[i].adjacency["down"] && downIdPoint > minMarginData[i]["down"]) {
                             console.log("DOWN")
                             this.AdjacencyList[i].adjacency["down"] = j;
                         }
                     }
 
                     if (this.AdjacencyList[i].adjacencyRight[j]) {
                         let rightIdPoint = this.deepCopy(this.AdjacencyList[i].adjacencyRight[j]);
                         if (rightIdPoint > this.AdjacencyList[i].adjacency["right"] && rightIdPoint > minMarginData[i]["right"]) {
                             console.log("RIGHT")
                             this.AdjacencyList[i].adjacency["right"] = j;
                         }
                     }
 
                     if (this.AdjacencyList[i].adjacencyLeft[j]) {
                         let leftIdPoint = this.deepCopy(this.AdjacencyList[i].adjacencyLeft[j]);
                         if (leftIdPoint > this.AdjacencyList[i].adjacency["left"] && leftIdPoint > minMarginData[i]["left"]) {
                             console.log("LEFT")
                             this.AdjacencyList[i].adjacency["left"] = j;
                         }
                     }*/
                }
            }
        }
    }
    calcRelativeCoord() {
        let directionName = ["right", "left", "up", "down"]
        let rightCount = [];
        let upCount = []
        for (let i in this.AdjacencyList) {
            rightCount[i] = 0;
            upCount[i] = 0;
        }
        let resultCount = { right: rightCount, up: upCount }
        for (let i in this.AdjacencyList) {
            for (let j = 0; j < 2; j++) {
                if (this.AdjacencyList[i].adjacency[directionName[2 * j]] !== -1 && this.AdjacencyList[i].adjacency[directionName[2 * j + 1]] === -1) {
                    let id = this.AdjacencyList[i].adjacency[directionName[2 * j]];
                    let count = 1;
                    try {
                        while (id !== -1) {
                            resultCount[directionName[2 * j]][id] += count;
                            id = this.AdjacencyList[id].adjacency[directionName[2 * j]];
                            count++;
                            //隣接リストleft,downへの参照がループしだしたとき、エラー
                            if (this.AdjacencyList.length === count) {
                                throw new Error("Error:Adjacency judgment has looped");
                                break;
                            }
                        }
                    } catch (error) {
                        console.log(error.message);
                    }
                }
            }
        }
        for (let i in this.AdjacencyList) {
            this.AdjacencyList[i].relativeCoord[0] += resultCount["right"][i];
            this.AdjacencyList[i].relativeCoord[1] += resultCount["up"][i];
        }
        console.log(this.AdjacencyList);
    }

    /**
     * スキャン後、蓄積したデータから各IDにおける隣接リストを作成する
     * */
    _setAdjacencyList() {
        console.log("SCAN COMPLETE")
        let scanMinMargin = [];
        this.calcScanMinMargin(scanMinMargin);
        this.desideAdjacency(scanMinMargin);
        this.calcRelativeCoord();
   
        this.emit(Store.EVENT_DONE_SET_ADJACENCY_LIST, null, this.AdjacencyList);
    }

    calcDifferenceList(data, differenceList) {
        let itr = 0;
        let IdQuantity = Object.keys(this.AdjacencyList).length;
        console.log(IdQuantity);
        for (let a = 0; a < IdQuantity - 1; a++) {
            for (let b = 1; b < IdQuantity - a; b++) {
                console.log(String(a) + String(b))
                let abId = data[a + b][0];
                let aId = data[a][0];
                if (this.AdjacencyList[abId] && this.AdjacencyList[aId] && data[a][1] === 1 && data[a + b][1] === 1) {
                    differenceList[itr] = {
                        id: String(this.AdjacencyList[aId].id) + String(this.AdjacencyList[abId].id),
                        x: this.AdjacencyList[abId].pos2d[0] - this.AdjacencyList[aId].pos2d[0],
                        y: this.AdjacencyList[abId].pos2d[1] - this.AdjacencyList[aId].pos2d[1],
                    };
                    itr++;
                }
            }
        }
    }

    /*storeAdjacency(differenceList,unitVec){
        for (let i = 0; i < differenceList.length; i++) {
            let idA = differenceList[i]["id"].substr(0, 2);
            let idB = differenceList[i]["id"].substr(2, 4);
            let margin = 0.5;
            console.log(idA + ":" + idB)
            if (!this.AdjacencyList[idA].adjacencyUp[idB]) {
                this.AdjacencyList[idA].adjacencyUp[idB] = 0;
            }
            if (!this.AdjacencyList[idA].adjacencyDown[idB]) {
                this.AdjacencyList[idA].adjacencyDown[idB] = 0;
            }
            if (!this.AdjacencyList[idA].adjacencyLeft[idB]) {
                this.AdjacencyList[idA].adjacencyLeft[idB] = 0;
            }
            if (!this.AdjacencyList[idA].adjacencyRight[idB]) {
                this.AdjacencyList[idA].adjacencyRight[idB] = 0;
            }
            if (!this.AdjacencyList[idB].adjacencyUp[idA]) {
                this.AdjacencyList[idB].adjacencyUp[idA] = 0;
            }
            if (!this.AdjacencyList[idB].adjacencyDown[idA]) {
                this.AdjacencyList[idB].adjacencyDown[idA] = 0;
            }
            if (!this.AdjacencyList[idB].adjacencyLeft[idA]) {
                this.AdjacencyList[idB].adjacencyLeft[idA] = 0;
            }
            if (!this.AdjacencyList[idB].adjacencyRight[idA]) {
                this.AdjacencyList[idB].adjacencyRight[idA] = 0;
            }
            if (squareSum[i] < average * 3 / 2) {
                if (rotatedUnitVec[i][0] >= 0 && rotatedUnitVec[i][1] <= 0 && Math.abs(unitVec[i][0]) < margin) {
                    this.AdjacencyList[idA].adjacencyDown[idB]++;
                    this.AdjacencyList[idB].adjacencyUp[idA]++;
                    //   console.log(String(idB) + " is down of " + String(idA));
                }
                else if (rotatedUnitVec[i][0] <= 0 && rotatedUnitVec[i][1] <= 0 && Math.abs(unitVec[i][1]) < margin) {
                    this.AdjacencyList[idA].adjacencyLeft[idB]++;
                    this.AdjacencyList[idB].adjacencyRight[idA]++;
                    //   console.log(String(idB) + " is left of " + String(idA));
                }
                else if (rotatedUnitVec[i][0] >= 0 && rotatedUnitVec[i][1] >= 0 && Math.abs(unitVec[i][1]) < margin) {
                    this.AdjacencyList[idA].adjacencyRight[idB]++;
                    this.AdjacencyList[idB].adjacencyLeft[idA]++;
                    //  console.log(String(idB) + " is right of " + String(idA));
                }
                else if (rotatedUnitVec[i][0] <= 0 && rotatedUnitVec[i][1] >= 0 && Math.abs(unitVec[i][0]) < margin) {
                    this.AdjacencyList[idA].adjacencyUp[idB]++;
                    this.AdjacencyList[idB].adjacencyDown[idA]++;
                    //  console.log(String(idB) + " is down of " + String(idA));
                }
            }
        }
    }
*/
    //IDの隣接状況の蓄積を行う
    _storeScannedData(data) {
        //データの表示
        console.log("data");
        console.log(this.deepCopy(data));

        //arControllerから2Dの位置を取得
        /*let arController = document.querySelector("a-scene").systems.arjs._arSession.arContext.arController
         for (let i = 0; i < 10; i++) {
             console.log("marker");
             console.log(arController.getMarker(i));
         }*/
        //2次元位置の各IDへの振り分け
        //this.AdjacencyList
        console.log("pos");
        for (let i = 0; i < data.length; i++) {
            if (data[i][1] === 1) {
                if (!this.AdjacencyList[data[i][0]]) {
                    this.AdjacencyList[data[i][0]] = new Adjacency;
                }
                this.AdjacencyList[data[i][0]].id = this.deepCopy(data[i][0]);
                this.AdjacencyList[data[i][0]].pos2d[0] = this.deepCopy(data[i][2]["x"])
                this.AdjacencyList[data[i][0]].pos2d[1] = this.deepCopy(data[i][2]["y"])
            }

        }
        console.log(this.AdjacencyList);

        //スキャンした、各データごとの差をとる
        //differenceList
        console.log("difference")
        let differenceList = [];
        // this.calcDifferenceList(data, differenceList);
        let itr = 0;
        let IdQuantity = Object.keys(this.AdjacencyList).length;
        console.log(IdQuantity);
        for (let a = 0; a < IdQuantity - 1; a++) {
            for (let b = 1; b < IdQuantity - a; b++) {
                console.log(String(a) + String(b))
                let abId = data[a + b][0];
                let aId = data[a][0];
                if (this.AdjacencyList[abId] && this.AdjacencyList[aId] && data[a][1] === 1 && data[a + b][1] === 1) {
                    differenceList[itr] = {
                        id: String(this.AdjacencyList[aId].id) + String(this.AdjacencyList[abId].id),
                        x: this.AdjacencyList[abId].pos2d[0] - this.AdjacencyList[aId].pos2d[0],
                        y: this.AdjacencyList[abId].pos2d[1] - this.AdjacencyList[aId].pos2d[1],
                    };
                    itr++;
                }
            }
        }
        console.log(differenceList);

        //上下左右の隣接判定ができるように座標系を合わせる
        let unitVec = [];
        let rotatedUnitVec = [];
        let squareSum = []
        for (let i = 0; i < differenceList.length; i++) {
            squareSum[i] = Math.sqrt(differenceList[i]["x"] * differenceList[i]["x"] + differenceList[i]["y"] * differenceList[i]["y"]);
            unitVec[i] = [differenceList[i]["x"] / squareSum[i], differenceList[i]["y"] / squareSum[i]];
            rotatedUnitVec[i] = [unitVec[i][0] * Math.cos(Math.PI / 4) - unitVec[i][1] * Math.sin(Math.PI / 4), unitVec[i][0] * Math.sin(Math.PI / 4) + unitVec[i][1] * Math.cos(Math.PI / 4)]
        }
        // console.log(squareSum);
        // console.log(unitVec);
        //console.log(rotatedUnitVec);
        //各マーカーごとの距離の平均をとる
        //（距離の閾値に使う）
        let sum = 0;
        for (let i = 0; i < squareSum.length; i++) {
            sum += squareSum[i];
        }
        let average = sum / squareSum.length;
        // console.log(average);


        //上下左右の関係を判定
        console.log("adjacency");
        //this.storeAdjacency();
        for (let i = 0; i < differenceList.length; i++) {
            let idA = differenceList[i]["id"].substr(0, 2);
            let idB = differenceList[i]["id"].substr(2, 4);
            let margin = 0.5;
            console.log(idA + ":" + idB)
            if (!this.AdjacencyList[idA].adjacencyUp[idB]) {
                this.AdjacencyList[idA].adjacencyUp[idB] = 0;
            }
            if (!this.AdjacencyList[idA].adjacencyDown[idB]) {
                this.AdjacencyList[idA].adjacencyDown[idB] = 0;
            }
            if (!this.AdjacencyList[idA].adjacencyLeft[idB]) {
                this.AdjacencyList[idA].adjacencyLeft[idB] = 0;
            }
            if (!this.AdjacencyList[idA].adjacencyRight[idB]) {
                this.AdjacencyList[idA].adjacencyRight[idB] = 0;
            }
            if (!this.AdjacencyList[idB].adjacencyUp[idA]) {
                this.AdjacencyList[idB].adjacencyUp[idA] = 0;
            }
            if (!this.AdjacencyList[idB].adjacencyDown[idA]) {
                this.AdjacencyList[idB].adjacencyDown[idA] = 0;
            }
            if (!this.AdjacencyList[idB].adjacencyLeft[idA]) {
                this.AdjacencyList[idB].adjacencyLeft[idA] = 0;
            }
            if (!this.AdjacencyList[idB].adjacencyRight[idA]) {
                this.AdjacencyList[idB].adjacencyRight[idA] = 0;
            }
            //if (squareSum[i] < average /2) {

            if (rotatedUnitVec[i][0] >= 0 && rotatedUnitVec[i][1] <= 0 && Math.abs(unitVec[i][0]) < margin) {
                this.AdjacencyList[idA].adjacencyDown[idB]++;
                this.AdjacencyList[idB].adjacencyUp[idA]++;
                //   console.log(String(idB) + " is down of " + String(idA));
            }
            else if (rotatedUnitVec[i][0] <= 0 && rotatedUnitVec[i][1] <= 0 && Math.abs(unitVec[i][1]) < margin) {
                this.AdjacencyList[idA].adjacencyLeft[idB]++;
                this.AdjacencyList[idB].adjacencyRight[idA]++;
                //   console.log(String(idB) + " is left of " + String(idA));
            }
            else if (rotatedUnitVec[i][0] >= 0 && rotatedUnitVec[i][1] >= 0 && Math.abs(unitVec[i][1]) < margin) {
                this.AdjacencyList[idA].adjacencyRight[idB]++;
                this.AdjacencyList[idB].adjacencyLeft[idA]++;
                //  console.log(String(idB) + " is right of " + String(idA));
            }
            else if (rotatedUnitVec[i][0] <= 0 && rotatedUnitVec[i][1] >= 0 && Math.abs(unitVec[i][0]) < margin) {
                this.AdjacencyList[idA].adjacencyUp[idB]++;
                this.AdjacencyList[idB].adjacencyDown[idA]++;
                //  console.log(String(idB) + " is down of " + String(idA));
            }
            // }
        }
        console.log(this.AdjacencyList);

        this.emit(Store.EVENT_DONE_STORE_SCANNED_DATA, null, this.deepCopy(this.AdjacencyList));
    }

}

Store.EVENT_DISCONNECTED = "disconnected";
Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_CONNECT_FAILED = "connect_failed";
Store.EVENT_DONE_GET_CURRENT_DISPLAY_MARKER = "get_current_display_marker";
Store.EVENT_DONE_GET_VIRTUAL_DISPLAY = "get_virtual_display";
Store.EVENT_DONE_STORE_SCANNED_DATA = "store_scanned_data";
Store.EVENT_DONE_SET_ADJACENCY_LIST = "set_adjacency_list";
Store.EVENT_DONE_SEND_DATA = "send_data";
export default Store;