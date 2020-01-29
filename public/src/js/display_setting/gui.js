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
        this.scanCompleteFunction;
        this.scanFlagList = [];
        this.displayNumber = 0;


    }

    init() {
        console.log("display_setting gui init");

        let menuSetting = [];
        this.headMenu = new Menu("display_setting", menuSetting);
        document.getElementsByClassName('head_menu')[0].appendChild(this.headMenu.getDOM());

        this.store.on(Store.EVENT_CONNECT_SUCCESS, () => {
            console.log("CONNECT_SUCCESS");
            this.action.getVirtualDisplay();
        });

        this.store.on(Store.EVENT_DONE_GET_VIRTUAL_DISPLAY, (err, reply) => {
            console.log("getv");
            console.log(reply);

            this.displayNumber = reply.splitX * reply.splitY;
            let markerList = [];
            this.action.getCurrentDisplayMarkers();
            this.store.on(Store.EVENT_DONE_GET_CURRENT_DISPLAY_MARKER, (err, marker_id) => {
                if (err) {
                    console.error(err); return;
                }
                markerList.push(marker_id);
                if (markerList.length === this.displayNumber) {
                    // marker_idを持ったdisplayが、virtualdisplayのgrid枠と同じ個数登録されていた.
                    // アプリを開始してもOK. 初期化する 
                    for (let i = 0; i < this.displayNumber; i++) {
                        this.scanFlagList[markerList[i]] = 0;
                    }
                    this.setArMarkerImg(markerList);
                    this.setScanButton();
                   
                }
            });
            // 10秒くらいたってmarker_idを持ったdisplayが指定数ない場合はエラーとする
            setTimeout(() => {
                if (markerList.length < this.displayNumber) {
                    console.error("Not found for the number: found ", markerList.length, " all ", this.displayNumber);
                }
            }, 10 * 1000);

            //this.updateVirtualScreen(reply);
            //this.displayNumber = reply.splitX * reply.splitY;
            //console.log("displayNumver:" + this.displayNumber);
            /*
            this.setArMarkerImg(displayNumber);
            this.setScanButton(displayNumber);
            for (let i = 0; i < displayNumber; i++) {
                this.scanFlagList[i] = 0;
            }
            */
        });

        this.store.on(Store.EVENT_DONE_STORE_SCANNED_DATA, (err, reply) => {
            console.log("store");
            console.log(reply);

        });

        this.store.on(Store.EVENT_DONE_SET_ADJACENCY_LIST, (err, reply) => {
            console.log(reply);
            console.log("SET COMPLETE")
            this.action.sendData();
            this.updateVirtualScreen(reply);
        });
        this.store.on(Store.EVENT_DONE_SEND_DATA, (err, reply) => {
            console.log(reply);
        });

        //スキャン開始ボタン
        document.getElementById("scan_toggle_button").onclick = () => {
            console.log("SCAN START");
            this.scanCompleteFunction = setInterval((flag) => {
                for (let i = 0; i < this.displayNumber; i++) {
                    let marker = document.getElementsByTagName("a-marker")[i + 1];
                    this.scannedData[i] =[marker.id,this.scanFlagList[marker.id], marker.object3D.position];
                }
                console.log(this.scannedData);
                console.log(this.scanFlagList);
                let sendData = this.scannedData;
                console.log(sendData);
                this.action.storeScannedData(sendData);
            }, 100, this.scanFlagList);
        };
    }

    updateVirtualScreen(reply) {

        document.getElementById("whole_sub_window").remove();
        let body = document.getElementById("body");
        let arEntry = document.getElementById("ar_entry");
        let screen = document.createElement("div");
        screen.setAttribute("id", "whole_sub_window");
        screen.setAttribute("value", "スキャン開始");
        console.log(reply);
        let replyLength=Object.keys(reply).length;
        let width =  replyLength* 100;
        let height = replyLength * 100;
        screen.style.width = String(width) + "px";
        screen.style.height = String(height) + "px";
        screen.style.transform = "translate(" + String(-width / 2) + "px," + String(-height / 2) + "px)";
        body.insertBefore(screen, arEntry);

        for (let i in reply) {
                let column = Math.ceil((i + 1) / replyLength);
                let line = Math.ceil(i + 1 - (column - 1) * replyLength);
                let unitWidth = 100;
                let unitHeight = 100;
                let translateX = (reply[i].relativeCoord[0]) * unitWidth - width / 2;
                let translateY = height / 2-(reply[i].relativeCoord[1]+1) * unitHeight;//height / 2 - (reply[i].relativeCoord[1] + 1) * unitHeight;

                let newVirtualDisplay = document.createElement("div");
                newVirtualDisplay.setAttribute("id", "whole_sub_window:" + column + ":" + line);
                newVirtualDisplay.setAttribute("style.z-index", "100000");
                newVirtualDisplay.style.opacity = "0.5";
                newVirtualDisplay.style.backgroundColor = "white";
                newVirtualDisplay.style.width = unitWidth + "px";
                newVirtualDisplay.style.height = unitHeight + "px";
                newVirtualDisplay.style.border = "2px solid red";
                newVirtualDisplay.style.position = "absolute";
                newVirtualDisplay.style.left = "50%";
                newVirtualDisplay.style.top = "50%";
                newVirtualDisplay.style.transform = "translate(" + translateX + "px," + translateY + "px)";
                newVirtualDisplay.innerHTML = String(i);
                screen.appendChild(newVirtualDisplay);
        }
    }

    setScanButton() {
        this.button = new Button;
        let parent = document.getElementById("body");
        let nextDOM = document.getElementById("scan_toggle_button");
        console.log("menu")
        console.log(this.button.getDOM());
        let btn = this.button.getDOM();
        parent.insertBefore(btn, nextDOM);
        btn.setAttribute("id", "scan_button");
        btn.setAttribute("value", "スキャン完了");
        this.button.on(Button.EVENT_CLICK, (evt) => {
            clearTimeout(this.scanCompleteFunction);
            this.action.setAdjacencyList();
        });
    }

    setArMarkerImg(markerList) {
        let arEntry = document.getElementById("ar_entry");
        let setCamera = document.getElementById("camera");
        console.log(markerList);

        for (let i = 1; i <= this.displayNumber; i++) {
            let newMarker = document.createElement("a-marker");
            newMarker.setAttribute("id",markerList[i - 1]);
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
            newMarker.setAttribute("Url", "http://localhost:8080/src/image/markers/marker" + markerList[i - 1] + ".patt");
            let boxModelOrigin = document.getElementsByClassName("text");
            let boxModelClone = boxModelOrigin[0].cloneNode(true);
            boxModelClone.setAttribute("value", "Marker" + String(markerList[i - 1]));
            arEntry.insertBefore(newMarker, setCamera);
            newMarker.appendChild(boxModelClone);
        }
    }
}

export default GUI;