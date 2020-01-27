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
       
        this.scannedData = [{ id: 0, x: 0, y: 0, z: 0 }];
       // this.screenCoordinate = [];
        this.scanFlag = [];
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
            let displayNumber = reply.splitX * reply.splitY;
            //this.updateVirtualScreen(reply);
            //this.displayNumber = reply.splitX * reply.splitY;
            //console.log("displayNumver:" + this.displayNumber);
            this.setArMarkerImg(displayNumber);
            this.setScanButton(displayNumber);
            for (let i = 0; i < displayNumber; i++) {
                this.scanFlag[i] = 0;
            }
        });

        this.store.on(Store.EVENT_DONE_SET_DISPLAY_INDEXES, (err, reply) => {
            // console.log(reply);
        });

        this.store.on(Store.EVENT_DONE_CALC_ABSOLUTE_POSITION, (err, reply) => {
            console.log(reply);
            this.updateVirtualScreen(reply);
        });

        this.store.on(Store.EVENT_DONE_GET_ADJACENCY_LIST, (err, reply) => {
            console.log(reply);
        });

        //カメラ映像と仮想ディスプレイ画面の切り替え
        document.getElementById("scan_toggle_button").onclick = function () {
            if (document.getElementById("arjs-video").style.display === "block") {
                document.getElementById("arjs-video").style.display = "none"
            }
            else {
                document.getElementById("arjs-video").style.display = "block"
            }
        };


    }

    updateVirtualScreen(reply) {
       /* let tmpScreenCoordinate = []
        for (let i = 0; i < reply.length; i++) {
            tmpScreenCoordinate[i] = [0, 0];
        }
        for (let i = 0; i < reply.length; i++) {
            if (reply[i]) {
                if (reply[i]["up"]) {
                    tmpScreenCoordinate[reply[i]["up"]][1]++;
                    console.log("up");
                    console.log(JSON.parse(JSON.stringify(tmpScreenCoordinate)));
                }
                if (reply[i]["right"]) {
                    tmpScreenCoordinate[reply[i]["right"]][0]++;
                    console.log("right");
                    console.log(JSON.parse(JSON.stringify(tmpScreenCoordinate)));
                }
            }
        }
        let difference = JSON.parse(JSON.stringify(tmpScreenCoordinate[0]));
        for (let i = 0; i < tmpScreenCoordinate.length; i++) {
            if (reply[i]) {
                if (!this.screenCoordinate[i]) {
                    this.screenCoordinate[i] = [tmpScreenCoordinate[i][0], tmpScreenCoordinate[i][1]];
                }
                else {
                    this.screenCoordinate[i][0] = tmpScreenCoordinate[i][0];
                    this.screenCoordinate[i][1] = tmpScreenCoordinate[i][1];

                }
            }
        }
        console.log(tmpScreenCoordinate);
        console.log(this.screenCoordinate);
*/
        document.getElementById("whole_sub_window").remove();
        let body = document.getElementById("body");
        let arEntry = document.getElementById("ar_entry");
        let screen = document.createElement("div");
        screen.setAttribute("id", "whole_sub_window");
        screen.setAttribute("value", "スキャン開始");
       /*  let width = this.screenCoordinate.length * 100;
        let height = this.screenCoordinate.length * 100;
        */
       let width = reply.length * 100;
        let height = reply.length * 100;
        screen.style.width = String(width) + "px";
        screen.style.height = String(height) + "px";
        screen.style.transform = "translate(" + String(-width / 2) + "px," + String(-height / 2) + "px)";
        body.insertBefore(screen, arEntry);

        for (let i = 0; i < reply.length; i++) {
            if (reply[i]) {
                let column = Math.ceil((i + 1) / reply.length);
                let line = Math.ceil(i + 1 - (column - 1) * reply.length);
                let unitWidth = 100;
                let unitHeight = 100;
                let translateX = (reply[i][0]) * unitWidth-width/2;
                let translateY =height/2 - (reply[i][1] + 1) * unitHeight;
    
                let newVirtualDisplay = document.createElement("div");
                newVirtualDisplay.setAttribute("id", "whole_sub_window:" + column + ":" + line);
                newVirtualDisplay.setAttribute("style.z-index", "100000");
                newVirtualDisplay.style.opacity="0.5";
                newVirtualDisplay.style.backgroundColor="white";
                newVirtualDisplay.style.width = unitWidth + "px";
                newVirtualDisplay.style.height = unitHeight + "px";
                newVirtualDisplay.style.border = "2px solid red";
                newVirtualDisplay.style.position = "absolute";
                newVirtualDisplay.style.left = "50%";
                newVirtualDisplay.style.top = "50%";
                newVirtualDisplay.style.transform = "translate(" + translateX + "px," + translateY + "px)";
                newVirtualDisplay.innerHTML = String(i)
                screen.appendChild(newVirtualDisplay);
                }
        }
    }

    setScanButton(displayNumber) {
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
            console.log("onclick");
            for (let i = 0; i < displayNumber; i++) {
                if (this.scanFlag[i] === 1) {
                    let mar = document.getElementById("ar_marker" + (i + 1));
                    //console.log(mar.object3D);
                    this.scannedData[i] = { id: i + 1, x: mar.object3D.position["x"], y: mar.object3D.position["y"], z: mar.object3D.position["z"] };

                    console.log(this.scannedData[i]);
                }
            }
            let sendData = [this.scanFlag, this.scannedData];
            this.action.calcAbsolutePosition(sendData);
            for (let i = 0; i < displayNumber; i++) {
                delete this.scannedData[i];
            }
        });
    }

    setArMarkerImg(displayNumber) {
        let arEntry = document.getElementById("ar_entry");
        let setCamera = document.getElementById("camera");
        for (let i = 1; i <= displayNumber; i++) {
            console.log(displayNumber);
            let newMarker = document.createElement("a-marker");
            newMarker.setAttribute("id", "ar_marker" + i);
            newMarker.addEventListener("markerFound", (evt) => {
                let mar = document.getElementById("ar_marker" + i);
                this.scanFlag[i - 1] = 1;
                console.log(evt);
                console.log("ar_marker" + i + "found")
            });
            newMarker.addEventListener("markerLost", () => {
                let mar = document.getElementById("ar_marker" + i);
                this.scanFlag[i - 1] = 0;
                console.log("ar_marker" + i + "lost");
            });
            newMarker.setAttribute("preset", "custom");
            newMarker.setAttribute("type", "pattern");
            newMarker.setAttribute("Url", "http://localhost:8080/src/image/markers/marker" + String(i) + ".patt");
            //let displayingModel=document.createElement("a-box");
            let boxModelOrigin = document.getElementsByClassName("text");
            let boxModelClone = boxModelOrigin[0].cloneNode(true);
            boxModelClone.setAttribute("value", "Marker" + String(i));
            arEntry.insertBefore(newMarker, setCamera);
            newMarker.appendChild(boxModelClone);
        }

    }
}

export default GUI;