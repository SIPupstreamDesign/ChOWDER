
import Vscreen from '../common/vscreen'
import Store from './store/store'
import Validator from '../common/validator';

class RemoteCursorBuilder
{
    static createCursor(res, store, controllers){
        this.cursor_size = res.data.cursor_size;
        this.store = store;
        this.controllers = controllers;
        let ctrlid = res.data.controllerID;

        let pos = Vscreen.transform(Vscreen.makeRect(Number(res.data.x), Number(res.data.y), 0, 0));

        let lonLatText = "";
        let arrow1ClassName = "before";
        let arrow2ClassName = "after";
        let hasLonLat = false;
        if (res.data.hasOwnProperty('lonLat')) {
            if (res.data.lonLat.lon !== null && res.data.lonLat.lat !== null) {
                lonLatText += "\nLon: " + res.data.lonLat.lon.toFixed(10); 
                lonLatText += "\nLat: " + res.data.lonLat.lat.toFixed(10);
                if (res.data.hasOwnProperty('id')) {
                    const meta = store.getMetaData(res.data.id);

                    pos = Vscreen.transform(Vscreen.makeRect(
                        Number(meta.posx) + Number(res.data.x) * Number(meta.width), 
                        Number(meta.posy) + Number(res.data.y) * Number(meta.height),  0, 0));
                
                    arrow1ClassName += "_lonlat";
                    arrow2ClassName += "_lonlat";
                    hasLonLat = true;
                }
            } else {
                return;
            }
        }

        if (!this.controllers.hasOwnProperty(ctrlid)) {
            ++this.controllers.connectionCount;
            this.controllers[ctrlid] = {
                index: this.controllers.connectionCount,
                lastActive: 0
            };
        }
        this.elem = document.getElementById('hiddenCursor' + ctrlid);
        this.controllerID = document.getElementById('controllerID' + ctrlid);
        if (!this.elem) {
            this.elem = document.createElement('div');
            this.elem.style.display = "block";
            this.elem.id = 'hiddenCursor' + ctrlid;
            this.elem.className = 'hiddenCursor';
            this.elem.style.backgroundColor = 'transparent';
            if (hasLonLat) {
                this.elem.style.overflow = "visible";
            }
            let before = document.createElement('div');
            before.className = arrow1ClassName;
            before.style.backgroundColor = res.data.rgb;
            this.elem.appendChild(before);
            let after = document.createElement('div');
            after.className = arrow2ClassName;
            after.style.backgroundColor = res.data.rgb;
            this.elem.appendChild(after);

            this.controllerID = document.createElement('div');
            this.controllerID.id = 'controllerID' + ctrlid;
            this.controllerID.style.display = "block";
            this.controllerID.className = 'controller_id';
            this.controllerID.style.color = res.data.rgb;
            this.controllerID.style.position = "absolute"
            this.controllerID.style.fontSize = "20px";
            this.controllerID.innerText = res.data.controllerID + lonLatText;
            document.body.appendChild(this.controllerID);

            document.body.appendChild(this.elem);
            // console.log('new controller cursor! => id: ' + res.data.connectionCount + ', color: ' + res.data.rgb);
        } else {
            this.controllerID.innerText = res.data.controllerID + lonLatText;
            this.controllerID.style.display = "block";
            this.controllerID.style.color = res.data.rgb;
            this.elem.style.display = "block";
            this.elem.getElementsByClassName(arrow1ClassName)[0].style.backgroundColor = res.data.rgb;
            this.elem.getElementsByClassName(arrow2ClassName)[0].style.backgroundColor = res.data.rgb;
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
        if (hasLonLat) {
            this.controllerID.style.top  = Math.round(pos.y - 50 + Number(ratio * 100)) + 'px';
        }
        this.controllers[ctrlid].lastActive = Date.now();

        this.store.on(Store.EVENT_DONE_UPDATE_VIRTUAL_DISPLAY, (err, vd)=>{
            let ratio = this.setCursorSize([this.elem, this.controllerID],Number(this.cursor_size));
            this.controllerID.style.top  = Math.round(pos.y + Number(ratio * 100)) + 'px';
        });
    }

    static releaseCursor(res, store, controllers){
        this.controllers = controllers;
        let ctrlid = "";

        // コントローラに紐づくカーソル
        if (res.hasOwnProperty('data') && res.data.hasOwnProperty('controllerID')) {
            ctrlid = res.data.controllerID;
        }

        // TileViewer等で使用しているコントローラに紐づかない、コンテンツIDに紐づくカーソル
        if (res.hasOwnProperty('data') && res.data.hasOwnProperty('id')) {
            if (this.controllers.hasOwnProperty(res.data.id)) {
                ctrlid = res.data.id;
            }
        }

        if (this.controllers.hasOwnProperty(ctrlid)) {
            let elem = document.getElementById('hiddenCursor' + ctrlid);
            let controllerID = document.getElementById('controllerID' + ctrlid);
            if (elem) {
                elem.style.display = 'none';
                controllerID.style.display = 'none';
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