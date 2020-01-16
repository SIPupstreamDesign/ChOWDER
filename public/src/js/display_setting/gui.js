/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Store from './store';
import Menu from '../components/menu.js';

class GUI extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;
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
            this.showVirtualDisplay(reply)
            this.displayNumber=reply.splitX * reply.splitY; 
            console.log("displayNumver"+this.displayNumber);
            this.setArMarkerImg();
        });

        this.store.on(Store.EVENT_DONE_SET_DISPLAY_INDEXES, (err, reply) => {
           // console.log(reply);
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

        /*document.getElementById("ar_marker1").addEventListener("markerFound", () => {
            //let indexData = { trueIndex: i + 1, scannedIndex: 0 };
            //this.action.setDisplayIndexes(indexData);
            console.log("found");
        });
        document.getElementById("ar_marker1").addEventListener("markerLost", () => {
            console.log("lost");
        });*/
    }

    showVirtualDisplay(reply) {
        let screen = document.getElementById("whole_sub_window");
        let screenNumber = reply.splitX * reply.splitY;
        screen.style.width = String(reply.orgWidth) + "px";
        screen.style.height = String(reply.orgHeight) + "px";

        for (let i = 0; i < screenNumber; i++) {
            let column = Math.ceil((i + 1) / reply.splitX);
            let line = Math.ceil(i + 1 - (column - 1) * reply.splitY);
            let width = reply.orgWidth / reply.splitX;
            let height = reply.orgHeight / reply.splitY;
            let translateX = -reply.orgWidth / 2 + (column - 1) * width;
            let translateY = -reply.orgHeight / 2 + (line - 1) * height;
            //console.log("X:" + translateX + ",Y:" + translateY);


            let newVirtualDisplay = document.createElement("div")
            newVirtualDisplay.setAttribute("id", "whole_sub_window:" + column + ":" + line);
            newVirtualDisplay.setAttribute("style.z-index", "100000");
            newVirtualDisplay.style.width = width + "px";
            newVirtualDisplay.style.height = height + "px";
            newVirtualDisplay.style.border = "2px solid red";
            newVirtualDisplay.style.background = "transparent";
            newVirtualDisplay.style.position = "absolute";
            newVirtualDisplay.style.left = "50%";
            newVirtualDisplay.style.top = "50%";
            newVirtualDisplay.style.transform = "translate(" + translateX + "px," + translateY + "px)";
            screen.appendChild(newVirtualDisplay);
            let indexData = { trueIndex: i + 1, scannedIndex: 0 };
            this.action.setDisplayIndexes(indexData);
        }
    }

    setArMarkerImg() {
        let arEntry = document.getElementById("ar_entry");
        let setCamera = document.getElementById("camera");
        //let imgNumber = reply.splitX * reply.splitY;
        for (let i = 1; i <=2/* this.displayNumber*/; i++) {
            let newMarker=document.createElement("a-marker");
            newMarker.addEventListener("markerFound", () => {
                console.log("found");
            });
            newMarker.addEventListener("markerLost", () => {
                console.log("lost");
            });
            newMarker.setAttribute("preset","custom");
            newMarker.setAttribute("id","ar_marker"+i);
            newMarker.setAttribute("type","pattern");
            newMarker.setAttribute("Url","http://localhost:8080/src/image/markers/marker"+String(i)+".patt");
            //let displayingModel=document.createElement("a-box");
            let boxModelOrigin=document.getElementsByClassName("box");
            let boxModelClone = boxModelOrigin[0].cloneNode(true); 
            //displayingModel.setAttribute("position",{x:0 ,y:0.5, z:0});
            //displayingModel.setAttribute("wireframe","true");
            arEntry.insertBefore(newMarker,setCamera);
            newMarker.appendChild(boxModelClone);
        }

    }
}

export default GUI;