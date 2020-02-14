/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Store from './store';
import Menu from '../components/menu.js';
import Button from '../components/button.js';

class GUI extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;


        this.scannedData = [];
        this.scanCompleteFunction = [];
        this.scanFlagList = [];
        this.displayNumber = 0;
        this.displayNumberX = 0;
        this.displayNumberY = 0;

    }

    init() {
        console.log("display_setting gui init");
        let menuSetting = [];
        this.headMenu = new Menu("display_setting", menuSetting);
        document.getElementsByClassName('head_menu')[0].appendChild(this.headMenu.getDOM());

        this.store.on(Store.EVENT_CONNECT_SUCCESS, () => {
            console.log("CONNECT_SUCCESS");
            this.setStartButton();
            this.setSendButton();
            this.setCompleteButton();
            this.setAdjustmentButton();
            this.setScanButton();
            this.updateScanStatus(null);
            this.updateText("準備ができたら[スキャン開始]ボタンを押してください");
        });

        this.store.on(Store.EVENT_CLOSE_ELECTRON, (err, reply) => {
            console.log("close");
        });

        this.store.on(Store.EVENT_DONE_GET_DATA_LIST, (err, reply) => {
            this.updateScanStatus(reply);
        });

        this.store.on(Store.EVENT_DONE_STORE_SCANNED_DATA, (err, reply) => {
            console.log("store");
        });

        this.store.on(Store.EVENT_DONE_SET_DATA_LIST, (err, reply) => {
            console.log(reply);
            console.log("SET COMPLETE")
            this.updateSendButton(reply);
            this.action.getDataList();
            document.getElementById("scan_toggle_button").style.display = "block";
            document.getElementById("scan_toggle_button").value = "再スキャン";

            this.updateVirtualScreen(reply);
        });
        this.store.on(Store.EVENT_DONE_SEND_DATA, (err, reply) => {
            console.log("send");
        });
        this.store.on(Store.EVENT_DELETE_DATA_LIST, (err, reply) => {
            console.log("delete");
        });
        this.store.on(Store.EVENT_START_SCAN, (err, markerList) => {
            this.setScanStartButtonPopUp(err);
            if (!err) {
                let vd = this.store.getVirtualDisplay();
                this.displayNumber = vd.splitX * vd.splitY;
                this.displayNumberX = vd.splitX;
                this.displayNumberY = vd.splitY;

                this.scanCompleteFunction.push(
                    setInterval((flag) => {
                        for (let i = 0; i < this.displayNumber; i++) {
                            let marker = document.getElementsByTagName("a-marker")[i + 1];
                            this.scannedData[i] = [marker.id, this.scanFlagList[marker.id], marker.object3D.position];
                        }

                        console.log(this.scannedData);
                        console.log(this.scanFlagList);
                        let sendData = this.scannedData;
                        console.log(sendData);
                        this.action.storeScannedData(sendData);
                        this.action.getDataList();
                    }, 100, this.scanFlagList));
                console.log(markerList);

                this.setArMarkerImg(markerList);
                document.getElementById("scan_button").style.display = "block";
                document.getElementById("scan_toggle_button").style.display = "none";
                document.getElementById("send_button").style.display = "none";
                document.getElementById("adjustment_button").style.display = "none";
                document.getElementById("complete_button").style.display = "none";
                document.getElementById("text").style.display = "none";
            } else {
                // エラーダイアログを出す
                document.getElementById('start_popup').classList.toggle('is_show');
                console.error(err);
            }
        });

        this.store.on(Store.EVENT_ADJUSTMENT_EVENT, (err, reply) => {
            console.log("ADJUSTMENT");
        });

        //スキャン開始ボタン
        document.getElementById("scan_toggle_button").onclick = () => {
            this.action.deleteDataList();
            this.action.getVirtualDisplay();
            this.action.startScan();
        };
    }

    updateText(text) {
        document.getElementById("text").innerHTML = text;
    }

    closePopUp(elem, popUp) {
        console.log(elem);
        if (!elem) return;
        elem.onclick = () => {
            popUp.classList.toggle('is_show');
        };
    }

    setScanStartButtonPopUp(err) {
        let popup = document.getElementById('start_popup');
        if (!popup) return;

        let blackBg = document.getElementById('start_black_bg');
        let closeBtn = document.getElementById('start_close_btn');

        this.closePopUp(blackBg, popup);
        this.closePopUp(closeBtn, popup);
        this.updateText("準備ができたら[スキャン開始]ボタンを押してください");
        console.log(err);
    }

    updateScanStatus(data) {
        console.log(data);
        let pointSum = {};
        for (let i in data) {
            let point = [data[i].upPoint, data[i].downPoint, data[i].rightPoint, data[i].leftPoint]
            for (let j in point) {
                for (let k in point[j]) {
                    if (point[j][k] !== -1) {
                        if (pointSum[k]) {
                            pointSum[k] += point[j][k];
                        }
                        else {
                            pointSum[k] = point[j][k];
                        }
                    }
                }
            }
        }
        console.log(pointSum);

        let text = "スキャンされたマーカ:"
        let count = 0;
        for (let i in pointSum) {
            if (pointSum[i] > 30) {
                text += i + ",";
                count++;
            }
        }
        console.log(text)
        document.getElementById("scanned_maekrID").innerHTML = text;
        document.getElementById("scanned_maekrID_number").innerHTML = count + "/" + this.displayNumber;
    }

    updateVirtualScreen(reply) {
        document.getElementById("scan_toggle_button").style.display = "block";
        document.getElementById("scan_toggle_button").value = "再スキャン";
        this.updateText("検出されたmarkerIDの並び順が正しければ、[データ送信]ボタンを押してください。スキャンし直す場合は、もう一度カメラをDisplayに向けて[再スキャン]ボタンを押してください。");

        let ids = []
        for (let i in reply) {
            ids.push(i);
        }
        console.log(ids);
        let text = ""
        for (let i in ids) {
            text += "<option>" + ids[i] + "</option>"
        }
        document.getElementById("marker_id_1").innerHTML = text;
        document.getElementById("marker_id_2").innerHTML = text;

        document.getElementById("whole_sub_window").remove();
        let body = document.getElementById("body");
        let arEntry = document.getElementById("ar_entry");
        let screen = document.createElement("div");
        screen.id = "whole_sub_window";
        console.log(reply);
        let replyLength = Object.keys(reply).length;
        let width = 50;
        let height = 50;
        screen.style.width = String(width) + "%";
        screen.style.height = String(height) + "%";
        screen.style.transform = "translate(" + String(-width) + "%," + String(-height) + "%)";
        body.insertBefore(screen, arEntry);

        for (let i in reply) {
            let column = Math.ceil((i + 1) / replyLength);
            let line = Math.ceil(i + 1 - (column - 1) * replyLength);
            let unitWidth = 100 / this.displayNumberX;
            let unitHeight = 100 / this.displayNumberY;
            let translateX = this.displayNumberX * (reply[i].relativeCoord[0]) * unitWidth - this.displayNumberX * width;
            let translateY = this.displayNumberY * height - this.displayNumberY * (reply[i].relativeCoord[1] + 1) * unitHeight;//height / 2 - (reply[i].relativeCoord[1] + 1) * unitHeight;

            let newVirtualDisplay = document.createElement("div");
            newVirtualDisplay.id = "whole_sub_window:" + column + ":" + line;
            newVirtualDisplay.style.zIndex = 100000;
            newVirtualDisplay.style.fontSize = "100%";
            newVirtualDisplay.style.opacity = "0.5";
            newVirtualDisplay.style.backgroundColor = "white";
            newVirtualDisplay.style.width = unitWidth + "%";
            newVirtualDisplay.style.height = unitHeight + "%";
            newVirtualDisplay.style.border = "2px solid red";
            newVirtualDisplay.style.position = "absolute";
            newVirtualDisplay.style.left = "50%";
            newVirtualDisplay.style.top = "50%";
            newVirtualDisplay.style.transform = "translate(" + translateX + "%," + translateY + "%)";
            newVirtualDisplay.innerHTML = String(i);
            screen.appendChild(newVirtualDisplay);
        }
    }

    updateSendButton(data) {
        let sendBtn = document.getElementById("send_button")
        if (Object.keys(data).length === 0) {
            console.log("Send button none")
            sendBtn.style.display = "none";
        }
        else {
            console.log("Send button block")
            sendBtn.style.display = "block";
        }
    }

    setButtonStylePosition(btn, position, left, top) {
        btn.style.position = position;
        btn.style.left = left;
        btn.style.top = top;
        btn.style.transform = "translate(-50%,-50%)";
    }

    setStartButton() {
        let btn = document.getElementById("scan_toggle_button");
        this.setButtonStylePosition(btn, "absolute", "50%", "10%");
    }

    setScanButton() {
        this.scanButton = new Button;
        let parent = document.getElementById("body");
        let nextDOM = document.getElementById("scan_toggle_button");
        console.log("menu")
        console.log(this.scanButton.getDOM());
        let btn = this.scanButton.getDOM();
        parent.insertBefore(btn, nextDOM);
        btn.id = "scan_button";
        btn.className = "button";
        btn.value = "スキャン完了";
        btn.style.display = "none";
        this.setButtonStylePosition(btn, "absolute", "50%", "10%");

        let complete = document.getElementById("complete_button");
        let description = document.getElementById("text");
        let adjustment = document.getElementById("adjustment_button");
        //let sendData=document.getElementById()

        this.scanButton.on(Button.EVENT_CLICK, (evt) => {
            console.log("scanned")
            console.log(this.scanCompleteFunction);
            for (let i in this.scanCompleteFunction) {
                clearInterval(this.scanCompleteFunction[i]);
            }
            this.action.setDataList();
            this.action.getDataList();
            btn.style.display = "none";
            complete.style.display = "block";
            description.style.display = "block";
            adjustment.style.display = "block";
        });
    }

    setSendButton() {
        this.sendButton = new Button;
        let parent = document.getElementById("body");
        let nextDOM = document.getElementById("scan_toggle_button");
        console.log("menu")
        console.log(this.sendButton.getDOM());
        let btn = this.sendButton.getDOM();
        parent.insertBefore(btn, nextDOM);
        btn.id = "send_button";
        btn.className = "button";
        btn.value = "データ送信";
        btn.style.display = "none";
        this.setButtonStylePosition(btn, "absolute", "80%", "10%");

        this.sendButton.on(Button.EVENT_CLICK, (evt) => {
            this.action.sendData();
            this.updateText("Displayに表示されているmarkerIDの並び順がただしければ、設定完了ボタンを押してください。検出されたmarkerIDの並び順が正しければ、[データ送信]ボタンを押してください。スキャンし直す場合は、もう一度カメラをDisplayに向けて[再スキャン]ボタンを押してください。");
        });
    }

    setCompleteButton() {
        this.completeButton = new Button;
        let parent = document.getElementById("body");
        let nextDOM = document.getElementById("scan_toggle_button");
        console.log("menu")
        console.log(this.completeButton.getDOM());
        let btn = this.completeButton.getDOM();
        parent.insertBefore(btn, nextDOM);
        btn.id = "complete_button";
        btn.className = "button";
        btn.value = "設定完了";
        btn.style.display = "none";
        this.setButtonStylePosition(btn, "absolute", "20%", "10%");

        let popup = document.getElementById('popup');
        if (!popup) return;

        let blackBg = document.getElementById('black_bg');
        let closeBtn = document.getElementById('close_btn');
        let popNo = document.getElementById("pop_no");

        this.closePopUp(blackBg, popup);
        this.closePopUp(closeBtn, popup);
        this.closePopUp(popNo, popup);
        this.closePopUp(btn, popup);

        let popYes = document.getElementById("pop_yes");
        console.log(popYes);
        popYes.onclick = () => {
            console.log(this);
            this.action.closeElectron("a");
            console.log("yes")
            let baseURL;
            if (window.location.href.indexOf('https') >= 0) {
                baseURL = "https://" + window.location.hostname + ":" + window.location.port;
            } else {
                baseURL = "http://" + window.location.hostname + ":" + window.location.port;
            }
            window.location.href = baseURL;
        };
        this.completeButton.on(Button.EVENT_CLICK, (evt) => {
        });
    }

    setAdjustmentButton() {
        this.adjustmentButton = new Button;
        let parent = document.getElementById("body");
        let nextDOM = document.getElementById("scan_toggle_button");
        console.log(this.adjustmentButton.getDOM());
        let btn = this.adjustmentButton.getDOM();
        parent.insertBefore(btn, nextDOM);
        btn.id = "adjustment_button";
        btn.className = "button";
        btn.value = "調整モード";
        this.setButtonStylePosition(btn, "absolute", "50%", "80%");
        btn.style.display = "none";

        let popup = document.getElementById('adjustment_popup');
        if (!popup) return;

        let blackBg = document.getElementById('adjustment_black_bg');
        let closeBtn = document.getElementById('adjustment_close_btn');

        this.closePopUp(blackBg, popup);
        this.closePopUp(closeBtn, popup);
        this.closePopUp(btn, popup);

        let send = document.getElementById('pop_send');
        let marker1 = document.excahnge_marker.marker_id_1//getElementById('marker_id_1');
        let marker2 = document.getElementById('marker_id_2');

        send.onclick = () => {
            let index1 = marker1.selectedIndex;
            let markerId1 = marker1.options[index1].value;
            let index2 = marker2.selectedIndex;
            let markerId2 = marker2.options[index2].value;
            console.log(markerId1);
            console.log(markerId2);
            let sendData = ["Adjustment event occuured", markerId1, markerId2]
            this.action.adjustmentEvent(sendData)
        }

        this.adjustmentButton.on(Button.EVENT_CLICK, (evt) => {
        });
    }

    setArMarkerImg(markerList) {
        let arEntry = document.getElementById("ar_entry");
        let setCamera = document.getElementById("camera");
        console.log(markerList);
        let baseURL;
        if (window.location.href.indexOf('https') >= 0) {
            baseURL = "https://" + window.location.hostname + ":" + window.location.port;
        } else {
            baseURL = "http://" + window.location.hostname + ":" + window.location.port;
        }
        for (let i = 1; i <= this.displayNumber; i++) {
            // HTML標準タグではないのでsetAttributeする必要がある
            let newMarker = document.createElement("a-marker");
            newMarker.setAttribute("id", markerList[i - 1]);
            newMarker.addEventListener("markerFound", (evt) => {
                this.scanFlagList[markerList[i - 1]] = 1;
                console.log("ar_marker" + i + "found")
            });
            newMarker.addEventListener("markerLost", () => {
                this.scanFlagList[markerList[i - 1]] = 0;
                console.log("ar_marker" + i + "lost");
            });
            newMarker.setAttribute("preset", "custom");
            newMarker.setAttribute("type", "pattern");
            newMarker.setAttribute("Url", baseURL + "/src/image/markers/marker" + markerList[i - 1] + ".patt");
            let boxModelOrigin = document.getElementsByClassName("text");
            let boxModelClone = boxModelOrigin[0].cloneNode(true);
            boxModelClone.setAttribute("value", "Marker" + String(markerList[i - 1]));
            arEntry.insertBefore(newMarker, setCamera);
            newMarker.appendChild(boxModelClone);
        }
    }
}

export default GUI;