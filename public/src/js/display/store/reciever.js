
/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Command from '../../common/command'
import Store from './store'
import StringUtil from '../../common/string_util'
import RemoteCursorBuilder from '../remote_cursor_builder'
import ITownsUtil from '../../common/itowns_util';
import Constants from '../../common/constants';

class Receiver {
    constructor(connector, store, action) {
        this.store = store;
        this.action = action;
        this.connector = connector;

        this.controllers = { connectionCount: -1 };

        this.init();
    }

    init() {
        this.connector.on(Command.Update, (data) => {
            this.action.update({ updateType: 'window' });
            this.action.update({ updateType: 'group' });
            this.action.update({ updateType: 'content' });
        });

        this.connector.on(Command.UpdateContent, (data) => {
            this.connector.send(Command.GetMetaData, data, (err, json) => {
                // 閲覧可能か
                if (!this.store.isViewable(json.group)) {
                    return;
                }
                if (json.type === "video") {
                    let rtcKey = this.store.getVideoStore().getRTCKey(json);
                    let webRTCDict = this.store.getVideoStore().getWebRTCDict();
                    if (webRTCDict.hasOwnProperty(rtcKey)) {
                        webRTCDict[rtcKey].close(true);

                        json.from = "view";
                        this.connector.sendBinary(Command.RTCClose, json, JSON.stringify({
                            key: rtcKey
                        }), function (err, reply) { });
                        delete json.from;
                    }
                }
                if (!err) {
                    this.store.emit(Store.EVENT_DONE_GET_METADATA, err, json, true);
                    /*
                    this.connector.send(Command.GetContent, json, (err, reply) => {
                        let metaDataDict = this.store.getMetaDataDict();
                        if (metaDataDict.hasOwnProperty(json.id)) {
                            this.store.emit(Store.EVENT_DONE_GET_CONTENT, err, reply);
                        }
                    });
                    */
                }
            });
        });

        this.connector.on(Command.UpdateGroup, (err, data) => {
            this.action.update({ updateType: "group" });
        });

        // ディスプレイ配信許可設定で許可/拒否されたとき
        this.connector.on(Command.UpdateDisplayPermissionList, () => {
            let blockedText = document.getElementsByClassName('blocked_text')[0];
            blockedText.style.display = "block";

            this.store.once(Store.EVENT_LOGIN_FAILED, () => {
                window.location.reload(true);
            });
			let loginOption = { id : "Display", password : "", displayid : this.store.getWindowID() }

			let isLoginPrcessed = false;
			window.electronLogin((isElectron,password)=>{
				if(isElectron){
					if (!isLoginPrcessed) {
						loginOption.password = password;
						loginOption.id = "ElectronDisplay";
						isLoginPrcessed = true;
						this.action.login(loginOption);
					}
				}else{
					this.action.login(loginOption);
				}
			});
        });

        // 権限変更時に送られてくる
        this.connector.on(Command.ChangeAuthority, () => {
            let request = { id: "Display", password: "", displayid: this.store.getWindowID() };
            this.connector.send(Command.Login, request, (err, reply) => {
                this.action.reloadUserList({ callback : () => {
                    this.store.setAuthority(reply.authority);
                    this.action.update({ updateType: 'window' });
                    this.action.update({ updateType: 'group' });
                    this.action.update({ updateType: 'content' });
                }});
            });
        });


        // DB切り替え時にブロードキャストされてくる
        this.connector.on(Command.ChangeDB, () => {
            let request = { id: "Display", password: "", displayid: this.store.getWindowID() };
            this.connector.send(Command.Login, request, (err, reply) => {
                this.action.reloadUserList({ callback : () => {
                    this.store.setAuthority(reply.authority);
                    this.action.deleteAllElements();
                    this.action.update({ updateType: 'window' });
                    this.action.update({ updateType: 'group' });
                    this.action.update({ updateType: 'content' });
                }});
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
            this.action.update({ updateType: 'window' });
        });

        this.connector.on(Command.UpdateWindowMetaData, (data) => {
            for (let i = 0; i < data.length; ++i) {
                if (data[i].hasOwnProperty('id') && data[i].id === this.store.getWindowID()) {
                    this.action.update({ updateType: 'window' });
                    this.store.onUpdateWindowMetaData(null, data);
                }
            }
        });

        this.connector.on(Command.UpdateVirtualDisplay, (data) => {
            this.store.virtualDisplay = data;
            // console.log("UpdateVirtualDisplay",this.virtualDisplay)
            this.store.emit(Store.EVENT_DONE_UPDATE_VIRTUAL_DISPLAY, null, data);
        });

        /// リモートカーソルが更新された
        this.connector.on(Command.UpdateMouseCursor, (res) => {
            if (res.hasOwnProperty('data') && res.data.hasOwnProperty('x') && res.data.hasOwnProperty('y')) {
                RemoteCursorBuilder.createCursor(res, this.store, this.controllers);
            } else {
                RemoteCursorBuilder.releaseCursor(res, this.store, this.controllers);
            }
        });

        /// WindowID表示要求がきた
        this.connector.on(Command.ShowWindowID, (data) => {
            // console.log("onShowWindowID", data);
            this.store.emit(Store.EVENT_REQUEST_SHOW_DISPLAY_ID, null, data);
        });

        /// Display全リロード. デバッグ用
        this.connector.on(Command.ReloadDisplay, (data) => {
            if (window.isElectron()) {
                window.electronReload();
            } else {
                window.location.reload(true);
            }
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
                            key: rtcKey,
                            sdp: answer
                        }), function () { });
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

        this.connector.on(Command.SendMessage, (data) => {
            if (data.command === 'measureITownPerformance') {
                this.store.measureITownPerformance(data.id);
            }
            if (data.command === 'changeItownsContentTime') {
                if (data.hasOwnProperty('data')) {
                    // 各メタデータごとに時刻を保存
                    let metaDataDict = this.store.getMetaDataDict();
                    for (let id in metaDataDict) {
                        if (metaDataDict.hasOwnProperty(id)) {
                            let metaData = metaDataDict[id];
                            if (metaData.type === Constants.TypeWebGL) {
                                if (ITownsUtil.isTimelineSync(metaData, data.data.id, data.data.senderSync))
                                {
                                    this.store.time[data.data.id] = new Date(data.data.time);
                                }
                            }
                        }
                    }
                    this.store.emit(Store.EVENT_UPDATE_TIME, null, data.data, (err, reply) => {
                    });
                }
            }
            // VideoControllerの動画一括コントロール.
            if (data.command === 'rewindVideo') {
                data.ids.forEach((id) => {
                    let videoPlayer = this.store.getVideoStore().getVideoPlayer(id);
                    if (videoPlayer) {
                        let video = videoPlayer.getVideo();
                        video.currentTime = 0.0;
                    }
                });
            }
        });
    }
}

export default Receiver;