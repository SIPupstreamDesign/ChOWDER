/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Vscreen from '../common/vscreen'
import Store from './store/store'

class RemoteCursorBuilder
{
    static createCursor(res, store, controllers){
        this.cursor_size = res.data.cursor_size;
        this.store = store;
        this.controllers = controllers;
        let ctrlid = res.data.controllerID;


        if (!this.controllers.hasOwnProperty(ctrlid)) {
            ++this.controllers.connectionCount;
            this.controllers[ctrlid] = {
                index: this.controllers.connectionCount,
                lastActive: 0
            };
        }
        let pos = Vscreen.transform(Vscreen.makeRect(Number(res.data.x), Number(res.data.y), 0, 0));
        this.elem = document.getElementById('hiddenCursor' + ctrlid);
        this.controllerID = document.getElementById('controllerID' + ctrlid);
        if (!this.elem) {
            this.elem = document.createElement('div');
            this.elem.id = 'hiddenCursor' + ctrlid;
            this.elem.className = 'hiddenCursor';
            this.elem.style.backgroundColor = 'transparent';
            let before = document.createElement('div');
            before.className = 'before';
            before.style.backgroundColor = res.data.rgb;
            this.elem.appendChild(before);
            let after = document.createElement('div');
            after.className = 'after';
            after.style.backgroundColor = res.data.rgb;
            this.elem.appendChild(after);

            this.controllerID = document.createElement('div');
            this.controllerID.id = 'controllerID' + ctrlid;
            this.controllerID.className = 'controller_id';
            this.controllerID.style.color = res.data.rgb;
            this.controllerID.style.position = "absolute"
            this.controllerID.style.fontSize = "20px";
            this.controllerID.innerText = res.data.controllerID;
            document.body.appendChild(this.controllerID);

            document.body.appendChild(this.elem);
            // console.log('new controller cursor! => id: ' + res.data.connectionCount + ', color: ' + res.data.rgb);
        } else {
            this.controllerID.innerText = res.data.controllerID;
            this.controllerID.style.color = res.data.rgb;
            this.elem.getElementsByClassName('before')[0].style.backgroundColor = res.data.rgb;
            this.elem.getElementsByClassName('after')[0].style.backgroundColor = res.data.rgb;
        }
        this.controllerID.style.textShadow =
                "1px 1px 0 white,"
                + "-1px 1px 0 white,"
                + " 1px -1px 0 white,"
                + "-1px -1px 0 white";

        let ratio = this.setCursorSize([this.elem, this.controllerID],Number(this.cursor_size));
        this.elem.style.left = Math.round(pos.x) + 'px';
        this.elem.style.top  = Math.round(pos.y) + 'px';
        this.controllerID.style.left = Math.round(pos.x) + 'px';
        this.controllerID.style.top  = Math.round(pos.y + Number(ratio * 100)) + 'px';
        this.controllers[ctrlid].lastActive = Date.now();

        this.store.on(Store.EVENT_DONE_UPDATE_VIRTUAL_DISPLAY, (err, vd)=>{
            let ratio = this.setCursorSize([this.elem, this.controllerID],Number(this.cursor_size));
            this.controllerID.style.top  = Math.round(pos.y + Number(ratio * 100)) + 'px';
        });
    }

    static releaseCursor(res,controllers){
        this.controllers = controllers;
        let ctrlid = res.controllerID;

        if (this.controllers.hasOwnProperty(ctrlid)) {
            let elem = document.getElementById('hiddenCursor' + ctrlid);
            let controllerID = document.getElementById('controllerID' + ctrlid);
            if (elem) {
                elem.style.left = '-999999px';
                elem.style.top  = '-999999px';
                controllerID.style.left = '-999999px';
                controllerID.style.top  = '-999999px';
            }
            if (elem && elem.parentNode) { elem.parentNode.removeChild(elem); }
            if (controllerID && controllerID.parentNode) { controllerID.parentNode.removeChild(controllerID); }
        }
    }

    /**
     * リモートカーソルの自動リサイズ
     */
    static autoResizeCursor(elems) {
        let ratio = Number(window.devicePixelRatio);
        /*
        let width = Number(screen.width);
        let height = Number(screen.height);
        let w = width;
        let h = height;
        let area = w * h;
        let mul = area / 100000.0 / 40.0;
        */
        let  mul = 1.0 / ratio * 2;

        for (let i = 0; i < elems.length; ++i) {
            elems[i].style.transform = "scale(" + mul + ")";
            elems[i].style.transformOrigin = "left top 0";
        }
        return mul;
    }

    /**
     * リモートカーソルのサイズ変更
     */
    static setCursorSize(elems,pixel) {

        let ratio = this.getScalefromSize(pixel);

        for (let i = 0; i < elems.length; ++i) {
            elems[i].style.transform = "scale(" + ratio + ")";
            elems[i].style.transformOrigin = "left top 0";
        }
        return ratio;
    }

    /**
     * css用のscaleを求める
     */
    static getScalefromSize(pixel){
        if (!this.store.getWindowData()) { return 100; }
        let width = window.innerWidth / Number(this.store.getWindowData().width);
        let height = window.innerHeight / Number(this.store.getWindowData().height);
        let normalize = null;
        if(width > height){
            normalize = pixel * height;
        }else{
            normalize = pixel * width;
        }
        return normalize / 100.0;
    }
}

export default RemoteCursorBuilder;