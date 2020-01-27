/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
import Action from './action'
import Connector from '../common/ws_connector.js';
import Command from '../common/command';

function Adjacency() {
    this.id = -1;
    this.pos2d = [0, 0]
    this.adjacency = { up: -1, down: -1, right: -1, left: -1 }
    this.relativeCoord = [0, 0];
};
function DirectionId(){
    this.up=-1;
    this.down=-1;
    this.right=-1;
    this.left=-1;
}


class Store extends EventEmitter {
    constructor(action) {
        super();
        this.action = action;

        this.displayNumber = 0;
        this.displayIndexes = [{ trueIndex: 0, scannedIndex: 0 }];

        this.eachIdPos = [];
        this.adjacencyList;
        this.relativeCoord = [];
        this.differenceList = [];
        this.scanNumber = 0;

        this.AdjacencyList = []

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

    _getVirtualDisplay() {
        Connector.send(Command.GetVirtualDisplay, {}, (err, reply) => {
            this.virtualDisplay = reply;
            this.emit(Store.EVENT_DONE_GET_VIRTUAL_DISPLAY, err, reply);//GUIにイベントを投げる
        });
    }

    _calcAbsolutePosition(data) {
        this.scanNumber++;

        //データのキューへの格納
        console.log("data");
        console.log(JSON.parse(JSON.stringify(data)));

        let arController = document.querySelector("a-scene").systems.arjs._arSession.arContext.arController
        for (let i = 0; i < 10; i++) {
            console.log("marker");
            console.log(arController.getMarker(i));
        }

        //データの各IDへの振り分け
        console.log("pos");
        for (let i = 0; i < data[1].length; i++) {
            let marker;
            if (data[1][i]) {
                for (let j = 0; j < data[0].length; j++) {
                    marker = arController.getMarker(j);
                    if (marker && data[0][marker["id"] - 1] === 1) {
                        //console.log("marker")
                        if (!this.AdjacencyList[marker["id"] - 1]) {
                            this.AdjacencyList[marker["id"] - 1] = new Adjacency;
                        }
                        this.AdjacencyList[marker["id"] - 1].id = this.deepCopy(marker["id"] - 1);
                        this.AdjacencyList[marker["id"] - 1].pos2d[0] = this.deepCopy(marker["pos"][0])
                        this.AdjacencyList[marker["id"] - 1].pos2d[1] = this.deepCopy(marker["pos"][1])
                    }
                }
            }
        }
        console.log(this.AdjacencyList);

        //スキャンした、各データごとの差をとる
        console.log("difference")
        let differenceList = [];
        let itr = 0;
        let IdQuantity = this.AdjacencyList.length;//this.eachIdPos.length
        console.log(IdQuantity);
        for (let i = 0; i < IdQuantity - 1; i++) {
            for (let j = 1; j < IdQuantity - i; j++) {

                if (this.AdjacencyList[i + j] && this.AdjacencyList[i] && data[0][i] === 1 && data[0][i + j] === 1) {
                    differenceList[itr] = {
                        id: String(this.AdjacencyList[i].id) + String(this.AdjacencyList[i + j].id),
                        x: this.AdjacencyList[i + j].pos2d[0] - this.AdjacencyList[i].pos2d[0],
                        y: this.AdjacencyList[i + j].pos2d[1] - this.AdjacencyList[i].pos2d[1],
                    };
                    itr++;
                }
            }
        }
        console.log(differenceList);

        let unitVec = [];
        let rotatedUnitVec = [];
        let squareSum = []
        //２つのマーカーの単位行列をとり、方向ベクトルを得る。
        //その後、45度回転させる
        for (let i = 0; i < differenceList.length; i++) {
            squareSum[i] = Math.sqrt(differenceList[i]["x"] * differenceList[i]["x"] + differenceList[i]["y"] * differenceList[i]["y"]);
            unitVec[i] = [differenceList[i]["x"] / squareSum[i], differenceList[i]["y"] / squareSum[i]];
            rotatedUnitVec[i] = [unitVec[i][0] * Math.cos(Math.PI / 4) - unitVec[i][1] * Math.sin(Math.PI / 4), unitVec[i][0] * Math.sin(Math.PI / 4) + unitVec[i][1] * Math.cos(Math.PI / 4)]
        }
        console.log([Math.cos(Math.PI / 4) - Math.sin(Math.PI / 4), Math.sin(Math.PI / 4) + Math.cos(Math.PI) / 4])
        console.log(unitVec);
        console.log(rotatedUnitVec);


        console.log("adjacency");
        //上下左右の関係を判定
        for (let i = 0; i < differenceList.length; i++) {
            let idA = differenceList[i]["id"].charAt(0);
            let idB = differenceList[i]["id"].charAt(1);
            let margin = 0.5;
            console.log(idA);
            console.log(idB);
            if (rotatedUnitVec[i][0] <= 0 && rotatedUnitVec[i][1] >= 0 && Math.abs(unitVec[i][0]) < margin) {
                this.AdjacencyList[idA].adjacency["down"] = this.deepCopy(idB);
                this.AdjacencyList[idB].adjacency["up"] = this.deepCopy(idA);
                console.log(String(idB) + " is down of " + String(idA));
            }
            else if (rotatedUnitVec[i][0] <= 0 && rotatedUnitVec[i][1] <= 0 && Math.abs(unitVec[i][1]) < margin) {
                this.AdjacencyList[idA].adjacency["left"] = this.deepCopy(idB);
                this.AdjacencyList[idB].adjacency["right"] = this.deepCopy(idA);
                console.log(String(idB) + " is left of " + String(idA));
            }
            else if (rotatedUnitVec[i][0] >= 0 && rotatedUnitVec[i][1] >= 0 && Math.abs(unitVec[i][1]) < margin) {
                this.AdjacencyList[idA].adjacency["right"] = this.deepCopy(idB);
                this.AdjacencyList[idB].adjacency["left"] = this.deepCopy(idA);
                console.log(String(idB) + " is right of " + String(idA));
            }
            else if (rotatedUnitVec[i][0] >= 0 && rotatedUnitVec[i][1] <= 0 && Math.abs(unitVec[i][0]) < margin) {
                this.AdjacencyList[idA].adjacency["up"] = this.deepCopy(idB);
                this.AdjacencyList[idB].adjacency["down"] = this.deepCopy(idA);
                console.log(String(idB) + " is down of " + String(idA));

            }
        }
        console.log(this.AdjacencyList);

        console.log("adjacency")
        for (let i = 0; i < this.AdjacencyList.length; i++) {
            if (this.AdjacencyList[i]) {
                let upId = this.deepCopy(this.AdjacencyList[i].adjacency["up"]);
                if (upId !== -1) {
                    this.AdjacencyList[upId].relativeCoord[1]++
                    console.log("up");
                }
                let rightId = this.deepCopy(this.AdjacencyList[i].adjacency["right"]);
                if (rightId !== -1) {
                    this.AdjacencyList[rightId].relativeCoord[0]++
                    console.log("right");
                }
            }
        }
        console.log(this.AdjacencyList);
        let sendData = [];
        for (let i = 0; i < this.AdjacencyList.length; i++) {
            if (this.AdjacencyList[i]) {
                sendData[i] = this.AdjacencyList[i].relativeCoord;
            }
        }

        this.emit(Store.EVENT_DONE_CALC_ABSOLUTE_POSITION, null, JSON.parse(JSON.stringify(sendData)));
    }
}

Store.EVENT_DISCONNECTED = "disconnected";
Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_CONNECT_FAILED = "connect_failed";
Store.EVENT_DONE_GET_VIRTUAL_DISPLAY = "get_virtual_display";
Store.EVENT_DONE_CALC_ABSOLUTE_POSITION = "calc_absolute_position";
export default Store;