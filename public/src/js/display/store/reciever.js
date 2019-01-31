

import Validator from '../../common/validator'
import Store from './store'
import Constants from '../../common/constants'

class Receiver
{
    constructor(connector, store, action) {
        this.store = store;
        this.action = action;
        this.connector = connector;

        this.init();
    }

    init() {
        this.connector.on("Update", function (data) {
            if (data === undefined) {
                update('window');
                update('group');
                update('content');
            }
        });

        this.connector.on("UpdateContent", function (data) {
            // console.log("onUpdateContent", data);

            this.connector.send('GetMetaData', data, function (err, json) {
                // 閲覧可能か
                if (!isViewable(json.group)) {
                    return;
                }
                if (json.type === "video") {
                    let rtcKey = getRTCKey(json);
                    if (webRTCDict.hasOwnProperty(rtcKey)) {
                        webRTCDict[rtcKey].close(true);

                        json.from = "view";
                        this.connector.sendBinary('RTCClose', json, JSON.stringify({
                            key : rtcKey
                        }), function (err, reply) {});
                        delete json.from;
                    }
                }
                if (!err) {
                    doneGetMetaData(err, json);
                    this.connector.send('GetContent', json, function (err, reply) {
                        if (metaDataDict.hasOwnProperty(json.id)) {
                            doneGetContent(err, reply);
                        }
                    } );
                }
            });
        });

        this.connector.on("UpdateGroup", function (err, data) {
            update("group", "");
        });

        // 権限変更時に送られてくる
        this.connector.on("ChangeAuthority", () => {
            let request = { id : "Display", password : "" };
            this.connector.send('Login', request, (err, reply) => {
                authority = reply.authority;
                update('window');
                update('group');
                update('content');
            });
        });


        // DB切り替え時にブロードキャストされてくる
        this.connector.on("ChangeDB", () => {
            let request = { id : "Display", password : "" };
            this.connector.send('Login', request, (err, reply) => {
                authority = reply.authority;
                deleteAllElements();
                update('window');
                update('group');
                update('content');
            });
        });

        this.connector.on("DeleteContent", (data) => {
            // console.log("onDeleteContent", data);
            let previewArea = document.getElementById('preview_area');
            for (let i = 0; i < data.length; ++i) {
                let elem = document.getElementById(data[i].id);
                if (elem) {
                    deleteMark(elem, metaDataDict[data[i].id]);
                    previewArea.removeChild(elem);
                    delete metaDataDict[data[i].id];
                }
            }
        });

        this.connector.on("DeleteWindowMetaData", (data) => {
            // console.log("onDeleteWindowMetaData", data);
            update('window');
        });

        this.connector.on("UpdateWindowMetaData", (data) => {
            // console.log("onUpdateWindowMetaData", data);
            for (let i = 0; i < data.length; ++i) {
                if (data[i].hasOwnProperty('id') && data[i].id === getWindowID()) {
                    update('window');
                    gui.updatePreviewAreaVisible(data[i]);
                    resizeViewport(data[i])
                    return;
                }
            }
        });

        this.connector.on("UpdateMouseCursor", (res) => {
            let ctrlid = res.controllerID;
            if (res.hasOwnProperty('data') && res.data.hasOwnProperty('x') && res.data.hasOwnProperty('y')) {
                if (!controllers.hasOwnProperty(ctrlid)) {
                    ++controllers.connectionCount;
                    controllers[ctrlid] = {
                        index: controllers.connectionCount,
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

                autoResizeCursor([elem, controllerID]);
                elem.style.left = Math.round(pos.x) + 'px';
                elem.style.top  = Math.round(pos.y) + 'px';
                controllerID.style.left = Math.round(pos.x) + 'px';
                controllerID.style.top  = Math.round(pos.y + 150 / Number(window.devicePixelRatio)) + 'px';
                controllers[ctrlid].lastActive = Date.now();
            } else {
                if (controllers.hasOwnProperty(ctrlid)) {
                    let elem = document.getElementById('hiddenCursor' + ctrlid);
                    let controllerID = document.getElementById('controllerID' + ctrlid);
                    if (elem) {
                        elem.style.left = '-999999px';
                        elem.style.top  = '-999999px';
                        controllerID.style.left = '-999999px';
                        controllerID.style.top  = '-999999px';
                    }
                    if (elem.parentNode) { elem.removeChild(elem); }
                    if (controllerID.parentNode) { controllerID.removeChild(controllerID); }
                }
            }
        });

        this.connector.on("ShowWindowID", (data) => {
            // console.log("onShowWindowID", data);
            for (let i = 0; i < data.length; i = i + 1) {
                showDisplayID(data[i].id);
            }
        });

        this.connector.on("UpdateMetaData", (data) => {
            let previewArea = document.getElementById("preview_area");
            for (let i = 0; i < data.length; ++i) {
                if (!isViewable(data[i].group)) {
                    let elem = document.getElementById(data[i].id);
                    if (elem) {
                        previewArea.removeChild(elem);
                    }
                    let memo =  document.getElementById("memo:" + data[i].id);
                    if (memo) {
                        previewArea.removeChild(memo);
                    }
                }
                update('', data[i].id);
            }
        });

        this.connector.on("RTCOffer", (data) => {
            //console.error("RTCOffer")
            if (!windowData) return;
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
                if (webRTCDict.hasOwnProperty(rtcKey)) {
                    let webRTC = webRTCDict[rtcKey];
                    webRTC.answer(sdp, (answer) => {
                        //console.error("WebRTC: send answer")
                        this.connector.sendBinary('RTCAnswer', metaData, JSON.stringify({
                            key : rtcKey,
                            sdp : answer
                        }), function () {});
                    });
                }
            }
        });
        
        this.connector.on("RTCClose", (data) => {
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
            if (webRTCDict.hasOwnProperty(rtcKey)) {
                webRTCDict[rtcKey].close(true);
            }
        });

        this.connector.on("RTCIceCandidate", (data) => {
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
            if (webRTCDict.hasOwnProperty(rtcKey)) {
                if (candidate) {
                    webRTCDict[rtcKey].addIceCandidate(candidate);
                }
            }
        });

        this.connector.on("Disconnect", ((client) => {
            return () => {
                let previewArea = document.getElementById("preview_area");
                let disconnectedText = document.getElementById("disconnected_text");
                isDisconnect = true;
                client.close();

                if (previewArea) {
                    previewArea.style.display = "none";
                }
                if (disconnectedText) {
                    disconnectedText.innerHTML = "Display Deleted";
                }
            };
        })(client));
    }
}

export default Receiver;