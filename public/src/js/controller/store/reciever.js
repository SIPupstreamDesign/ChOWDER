/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Store from './store'
import Command from '../../common/command'
import StringUtil from '../../common/string_util'
import manipulator  from '../manipulator'
import Constants from '../../common/constants';
import ContentUtil from '../content_util';

class Receiver
{
    constructor(connector, store, action) {
        this.store = store;
        this.action = action;
        this.connector = connector;

        this.init();
    }

    init() {
        // メタデータが更新されたときにブロードキャストされてくる.
        this.connector.on(Command.UpdateMetaData, (data) => {
            for (let i = 0; i < data.length; ++i) {
                let metaData = data[i];
                let id = metaData.id;
                if (this.store.getManagement().isViewable(metaData.group)) {
                    if (id) {
                        this.store.emit(Store.EVENT_DONE_GET_METADATA, null, metaData, (err, reply) => {
                        });
                    }
                }
            }
            this.store.emit(Store.EVENT_NEET_UPDATE_MANIPULATOR, null);
        });

        // コンテンツが差し替えられたときにブロードキャストされてくる.
        this.connector.on(Command.UpdateContent, (metaData) => {
            // console.log('UpdateContent', metaData);
            let id = metaData.id;
            if (id) {
                if (metaData.hasOwnProperty("id") && metaData.type === Constants.TypeTileImage) {
                    console.log(metaData);
                    if (metaData.hasOwnProperty('reload_latest') && String(metaData.reload_latest) === "true") {
                        try {
                            let keyValue = JSON.parse(metaData.keyvalue);
                            let key = Object.keys(keyValue)[0];
                            // 最新の時系列データ表示
                            let historyData = ContentUtil.extractHistoryData(metaData);
                            if (historyData) {
                                let values = Object.values(historyData[key]);
                                if (values.length > 1) {
                                    let sorted = ContentUtil.sortHistory(values);
                                    this.action.restoreHistoryContent({
                                        restoreKey : key,
                                        restoreValue : sorted[sorted.length - 1]
                                    });
                                    return;
                                }
                            }
                        } catch(e) {
                            console.error(e);
                        }
                    }
                }

                this.store.operation.getContent(metaData, (err, reply) => {
                    if (reply.hasOwnProperty('metaData')) {
                        if (this.store.hasMetadata(metaData.id)) {
                            this.action.correctContentAspect({
                                metaData : reply.metaData,
                                callback : (err, meta) => {
                                    reply.metaData = meta;
                                    this.store.emit(Store.EVENT_DONE_GET_CONTENT, null, reply, (err, reply) => {
                                    });
                                    this.store.emit(Store.EVENT_DONE_GET_METADATA, null, meta, (err, reply) => {
                                    });
                                }
                            });
                        }
                    }
                }, true);
            }
        });

        // windowが更新されたときにブロードキャストされてくる.
        this.connector.on(Command.UpdateWindowMetaData, (data) => {
            // console.log("onUpdateWindowMetaData", data);

            if (data instanceof Array) {
                for (let i = 0; i < data.length; ++i) {
                    let metaData = data[i];
                    this.store.emit(Store.EVENT_DONE_GET_WINDOW_METADATA, null, metaData, (err, reply) => {
                    });
                    if (this.store.getState().getSelectedID()) {
                        if (!this.store.getState().isSelectionRectShown()) {
                            let elem = document.getElementById(this.store.getState().getSelectedID());
                            manipulator.moveManipulator(elem);
                        }
                    }
                }
            } else {
                let metaData = data;
                this.store.emit(Store.EVENT_DONE_GET_WINDOW_METADATA, null, metaData, (err, reply) => {
                });
                if (this.store.getState().getSelectedID()) {
                    let elem = document.getElementById(this.store.getState().getSelectedID());
                    manipulator.moveManipulator(elem);
                }
            }
        });

        // virtual displayが更新されたときにブロードキャストされてくる.
        this.connector.on(Command.UpdateVirtualDisplay, (data) => {
            this.emit(Store.EVENT_DONE_UPDATE_VIRTUAL_DISPLAY, null, data);
        });

        // グループが更新されたときにブロードキャストされてくる.
        this.connector.on(Command.UpdateGroup, (metaData) => {
            // console.log("onUpdateGroup")
            let key = this.store.getLoginStore().getLoginKey();
            if (key.length > 0) {
                let request = { userid: "", password: "", loginkey: key };
                
                this.action.loginForCheckAuthority(request);
            }
            else {
                this.action.getGroupList();
            }
            this.store.emit(Store.EVENT_DONE_UPDATE_GROUP, null, metaData);
        });

        // すべての更新が必要なときにブロードキャストされてくる.
        this.connector.on(Command.Update, () => {
            if (!this.store.isInitialized()) { return; }
            this.action.reloadAll();
        });

        // windowが更新されたときにブロードキャストされてくる.
        this.connector.on(Command.UpdateMouseCursor, (metaData) => { });

        // コンテンツが削除されたときにブロードキャストされてくる.
        this.connector.on(Command.DeleteContent, (data) => {
            // console.log("onDeleteContent", data);
            this.store.emit(Store.EVENT_DONE_DELETE_CONTENT, null, data, (err, reply) => {
            });
        });

        // ウィンドウが削除されたときにブロードキャストされてくる.
        this.connector.on(Command.DeleteWindowMetaData, (metaDataList) => {
            // console.log("DeleteWindowMetaData", metaDataList);
            for (let i = 0; i < metaDataList.length; i = i + 1) {
                this.store.emit(Store.EVENT_DONE_DELETE_WINDOW_METADATA, null, metaDataList[i], (err, reply) => {
                });
            }
        });

        // Video Controllerで使う.
        this.connector.on(Command.SendMessage, (data) => {
            if (data.command === 'playVideo') {
                data.ids.forEach((id) => {
                    let videoPlayer = this.store.getVideoStore().getVideoPlayer(id);
                    if (videoPlayer) {
                        let video = videoPlayer.getVideo();
                        data.play ? video.play() : video.pause();

                        let metaData = this.store.getMetaData(id);
                        metaData.isPlaying = data.play;
                        this.store.operation.updateMetadata(metaData, function(err, reply) {
                            // do nothing
                        });
                    }
                });
            }

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

        // DB切り替え時にブロードキャストされてくる
        this.connector.on(Command.ChangeDB, () => {
            if (!this.store.isInitialized()) { return; }
            window.location.reload(true);
        });

        // 権限変更時に送られてくる
        this.connector.on(Command.ChangeAuthority, (userID) => {
            if (!this.store.isInitialized()) { return; }
            if (this.store.getLoginStore().getLoginUserID() === userID) {
                window.location.reload(true);
            }
        });

        // 管理ページでの設定変更時にブロードキャストされてくる
        this.connector.on(Command.UpdateSetting, () => {
            if (!this.store.isInitialized()) { return; }
            // ユーザーリスト再取得
            this.action.reloadUserList();
            this.action.reloadGlobalSetting();
            this.action.reloadDBList({
                callback : (err, reply) => {
                    if (!err) {
                        this.store.emit(Store.EVENT_DONE_UPDATE_SETTING, err, reply);
                    }
                }
            });
        });

        // WebRTC接続要求が来た
        this.connector.on(Command.RTCRequest, (data) => {
            let metaData = data.metaData;
            if (metaData.from === "controller") { return; }
            let key = null;
            try {
                let keyStr = StringUtil.arrayBufferToString(data.contentData.data);
                key = JSON.parse(keyStr).key;
            }  catch (e) {
                console.error(e);
                return;
            }
            if (key) {
                // このコントローラが動画データを持っているか判別
                if (this.store.getVideoStore().hasVideoData(metaData.id)) {
                    // webrtc接続開始
                    this.store.getVideoStore().connectWebRTC(metaData, key);
                }
            }
        });

        // WebRTC切断要求が来た
        this.connector.on(Command.RTCClose, (data) => {
            let metaData = data.metaData;
            if (metaData.from === "controller") { return; }
            let key = null;
            try {
                let keyStr = StringUtil.arrayBufferToString(data.contentData.data);
                key = JSON.parse(keyStr).key;
            }  catch (e) {
                console.error(e);
                return;
            }
            if (key) {
                // このコントローラが接続を持っているか判別
                let webRTCDict = this.store.getVideoStore().getWebRTCDict();
                if (webRTCDict && webRTCDict.hasOwnProperty(key)) {
                    webRTCDict[key].close(true);
                }
            }
        });

        // WebRTCのAnswerが返ってきた
        this.connector.on(Command.RTCAnswer, (data) => {
            let answer = null;
            let key = null;
            try {
                let sdpStr = StringUtil.arrayBufferToString(data.contentData.data);
                let parsed = JSON.parse(sdpStr);
                key = parsed.key;
                answer = parsed.sdp;
            } catch (e) {
                console.error(e);
                return;
            }
            let webRTCDict = this.store.getVideoStore().getWebRTCDict();
            if (webRTCDict && webRTCDict.hasOwnProperty(key)) {
                webRTCDict[key].setAnswer(answer, (e) => {
                    if (e) {
                        console.error(e);
                    }
                });
            }
        });

        this.connector.on(Command.RTCIceCandidate, (data) => {
            let metaData = data.metaData;
            if (metaData.from == "controller") { return; }
            let contentData = data.contentData;
            let candidate = null;
            let key = null;
            try {
                let dataStr = StringUtil.arrayBufferToString(contentData.data);
                let parsed = JSON.parse(dataStr);
                key = parsed.key;
                candidate = parsed.candidate;
            } catch (e) {
                console.error(e);
                return;
            }
            let webRTCDict = this.store.getVideoStore().getWebRTCDict();
            if (webRTCDict && webRTCDict.hasOwnProperty(key)) {
                if (candidate) {
                    webRTCDict[key].addIceCandidate(candidate);
                }
            }
        });
    }
}
export default Receiver;
