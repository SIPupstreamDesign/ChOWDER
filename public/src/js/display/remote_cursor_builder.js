
import Vscreen from '../common/vscreen'

class RemoteCursorBuilder
{
    static createCursor(res, controllers){
        this.controllers = controllers;
        let ctrlid = res.controllerID;

        if (!this.controllers.hasOwnProperty(ctrlid)) {
            ++this.controllers.connectionCount;
            this.controllers[ctrlid] = {
                index: this.controllers.connectionCount,
                lastActive: 0
            };
        }
        let pos = Vscreen.transform(Vscreen.makeRect(Number(res.data.x), Number(res.data.y), 0, 0));
        let elem = document.getElementById('hiddenCursor' + ctrlid);
        let controllerID = document.getElementById('controllerID' + ctrlid);
        if (!elem) {
            elem = document.createElement('div');
            elem.id = 'hiddenCursor' + ctrlid;
            elem.className = 'hiddenCursor';
            elem.style.backgroundColor = 'transparent';
            let before = document.createElement('div');
            before.className = 'before';
            before.style.backgroundColor = res.data.rgb;
            elem.appendChild(before);
            let after = document.createElement('div');
            after.className = 'after';
            after.style.backgroundColor = res.data.rgb;
            elem.appendChild(after);

            controllerID = document.createElement('div');
            controllerID.id = 'controllerID' + ctrlid;
            controllerID.className = 'controller_id';
            controllerID.style.color = res.data.rgb;
            controllerID.style.position = "absolute"
            controllerID.style.fontSize = "20px";
            controllerID.innerText = res.data.controllerID;
            document.body.appendChild(controllerID);

            document.body.appendChild(elem);
            // console.log('new controller cursor! => id: ' + res.data.connectionCount + ', color: ' + res.data.rgb);
        } else {
            controllerID.innerText = res.data.controllerID;
            controllerID.style.color = res.data.rgb;
            elem.getElementsByClassName('before')[0].style.backgroundColor = res.data.rgb;
            elem.getElementsByClassName('after')[0].style.backgroundColor = res.data.rgb;
        }
        controllerID.style.textShadow =
                "1px 1px 0 white,"
                + "-1px 1px 0 white,"
                + " 1px -1px 0 white,"
                + "-1px -1px 0 white";

        this.setCursorSize([elem, controllerID],Number(res.data.cursor_size));
        elem.style.left = Math.round(pos.x) + 'px';
        elem.style.top  = Math.round(pos.y) + 'px';
        controllerID.style.left = Math.round(pos.x) + 'px';
        controllerID.style.top  = Math.round(pos.y + Number(res.data.cursor_size)) + 'px';
        this.controllers[ctrlid].lastActive = Date.now();
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
    }

    /**
     * css用のscaleを求める
     */
    static getScalefromSize(pixel){
        return pixel / 100.0;
    }
}

export default RemoteCursorBuilder;