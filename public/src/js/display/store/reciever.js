

import Command from '../../common/command'
import Store from './store'
import StringUtil from '../../common/string_util'
import Vscreen from '../../common/vscreen'
import DisplayUtil from '../display_util'

class Receiver
{
    constructor(connector, store, action) {
        this.store = store;
        this.action = action;
        this.connector = connector;

        this.controllers = {connectionCount: -1};

        this.init();
    }

    init() {
        this.connector.on(Command.Update, (data) => {
            if (data === undefined) {
                this.action.update({ updateType : 'window'});
                this.action.update({ updateType : 'group' });
                this.action.update({ updateType : 'content' });
            }
        });

        this.connector.on(Command.UpdateContent, function (data) {
            // console.log("onUpdateContent", data);

            this.connector.send(Command.GetMetaData, data, function (err, json) {
                // 閲覧可能か
                if (!isViewable(json.group)) {
                    return;
                }
                if (json.type === "video") {
                    let rtcKey = getRTCKey(json);
                    let webRTCDict = this.store.getVideoStore().getWebRTCDict();
                    if (webRTCDict.hasOwnProperty(rtcKey)) {
                        webRTCDict[rtcKey].close(true);

                        json.from = "view";
                        this.connector.sendBinary(Command.RTCClose, json, JSON.stringify({
                            key : rtcKey
                        }), function (err, reply) {});
                        delete json.from;
                    }
                }
                if (!err) {
                    doneGetMetaData(err, json);
                    this.connector.send(Command.GetContent, json, function (err, reply) {
                        if (metaDataDict.hasOwnProperty(json.id)) {
                            doneGetContent(err, reply);
                        }
                    } );
                }
            });
        });

        this.connector.on(Command.UpdateGroup, (err, data) => {
            this.action.update({ updateType : "group" });
        });

        // 権限変更時に送られてくる
        this.connector.on(Command.ChangeAuthority, () => {
            let request = { id : "Display", password : "" };
            this.connector.send(Command.Login, request, (err, reply) => {
                this.store.setAuthority(reply.authority);
                this.action.update({ updateType : 'window'});
                this.action.update({ updateType : 'group'});
                this.action.update({ updateType : 'content'});
            });
        });


        // DB切り替え時にブロードキャストされてくる
        this.connector.on(Command.ChangeDB, () => {
            let request = { id : "Display", password : "" };
            this.connector.send(Command.Login, request, (err, reply) => {
                this.store.setAuthority(reply.authority);
                this.action.deleteAllElements();
                this.action.update({ updateType : 'window' });
                this.action.update({ updateType : 'group' });
                this.action.update({ updateType : 'content' });
            });
        });

        this.connector.on(Command.DeleteContent, (data) => {
            // console.log("onDeleteContent", data);
            let metaDataDict = this.store.getMetaDataDict();
            for (let i = 0; i < data.length; ++i) {
                if (metaDataDict.hasOwnProperty(data[i].id)) {
                    delete metaDataDict[data[i].id];
                }
            }
            this.store.emit(Store.EVENT_DONE_DELETE_CONTENT, null, data);
        });

        this.connector.on(Command.DeleteWindowMetaData, (data) => {
            // console.log("onDeleteWindowMetaData", data);
            this.action.update({ updateType : 'window' });
        });

        this.connector.on(Command.UpdateWindowMetaData, (data) => {
            for (let i = 0; i < data.length; ++i) {
                if (data[i].hasOwnProperty('id') && data[i].id === this.store.getWindowID()) {
                    this.action.update({ updateType : 'window' });
                    this.store.onUpdateWindowMetaData(null, data);
                }
            }
        });

        /// リモートカーソルが更新された
        this.connector.on(Command.UpdateMouseCursor, (res) => {
            let ctrlid = res.controllerID;
            if (res.hasOwnProperty('data') && res.data.hasOwnProperty('x') && res.data.hasOwnProperty('y')) {
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

                DisplayUtil.autoResizeCursor([elem, controllerID]);
                elem.style.left = Math.round(pos.x) + 'px';
                elem.style.top  = Math.round(pos.y) + 'px';
                controllerID.style.left = Math.round(pos.x) + 'px';
                controllerID.style.top  = Math.round(pos.y + 150 / Number(window.devicePixelRatio)) + 'px';
                this.controllers[ctrlid].lastActive = Date.now();
            } else {
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
        });

        /// WindowID表示要求がきた
        this.connector.on(Command.ShowWindowID, (data) => {
            // console.log("onShowWindowID", data);
            this.store.emit(Store.EVENT_REQUEST_SHOW_DISPLAY_ID, null, data);
        });

        /// メタデータが更新された
        this.connector.on(Command.UpdateMetaData, (data) => {
            this.store.emit(Store.EVENT_DONE_UPDATE_METADATA, null, data);
        });

        /// WebRTC
        this.connector.on(Command.RTCOffer, (data) => {
            if (!this.store.getWindowData()) return;
            let metaData = data.metaData;
            let contentData = data.contentData;
            let sdp = null;
            let rtcKey = null;
            try {
                let dataStr = StringUtil.arrayBufferToString(contentData.data);
                let parsed = JSON.parse(dataStr);
                rtcKey = parsed.key;
                sdp = parsed.sdp;
            } catch (e) {
                console.error(e);
                return;
            }
    
            if (sdp) {
                let webRTCDict = this.store.getVideoStore().getWebRTCDict();
                if (webRTCDict.hasOwnProperty(rtcKey)) {
                    let webRTC = webRTCDict[rtcKey];
                    webRTC.answer(sdp, (answer) => {
                        //console.error("WebRTC: send answer")
                        this.connector.sendBinary(Command.RTCAnswer, metaData, JSON.stringify({
                            key : rtcKey,
                            sdp : answer
                        }), function () {});
                    });
                }
            }
        });
        
        /// WebRTC
        this.connector.on(Command.RTCClose, (data) => {
            let metaData = data.metaData;
            if (metaData.from === "view") { return; }
            let contentData = data.contentData;
            let rtcKey = null;
            try {
                let dataStr = StringUtil.arrayBufferToString(contentData.data);
                let parsed = JSON.parse(dataStr);
                rtcKey = parsed.key;
            } catch (e) {
                console.error(e);
                return;
            }
            let webRTCDict = this.store.getVideoStore().getWebRTCDict();
            if (webRTCDict.hasOwnProperty(rtcKey)) {
                webRTCDict[rtcKey].close(true);
            }
        });

        /// WebRTC
        this.connector.on(Command.RTCIceCandidate, (data) => {
            //console.error("on RTCIceCandidate")
            let metaData = data.metaData;
            if (metaData.from === "view") { return; }
            let contentData = data.contentData;
            let candidate = null;
            let rtcKey = null;
            try {
                let dataStr = StringUtil.arrayBufferToString(contentData.data);
                let parsed = JSON.parse(dataStr);
                rtcKey = parsed.key;
                candidate = parsed.candidate;
            } catch (e) {
                console.error(e);
                return;
            }
            let webRTCDict = this.store.getVideoStore().getWebRTCDict();
            if (webRTCDict.hasOwnProperty(rtcKey)) {
                if (candidate) {
                    webRTCDict[rtcKey].addIceCandidate(candidate);
                }
            }
        });
    }
}

export default Receiver;