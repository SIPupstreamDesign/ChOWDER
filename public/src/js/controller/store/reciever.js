/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Validator from '../validator'
import Store from './store'
import Vscreen from '../vscreen'
import Constants from '../constants'
import Command from '../../common/command'

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
                        controller.doneGetMetaData(null, metaData);
                        if (this.store.getState().getSelectedID()) {
                            let elem = document.getElementById(this.store.getState().getSelectedID());
                            if (elem) {
                                if (!this.store.getState().isSelectionRectShown()) {
                                    manipulator.moveManipulator(elem);
                                }
                            }
                        }
                    }
                }
            }
            if (this.store.getState().isSelectionRectShown() && data.length > 0) {
                controller.updateSelectionRect();
            }
        });

        // コンテンツが差し替えられたときにブロードキャストされてくる.
        this.connector.on(Command.UpdateContent, (metaData) => {
            // console.log('UpdateContent', metaData);
            let id = metaData.id;
            if (id) {
                this.connector.send(Command.GetContent, metaData, (err, reply) => {
                    if (reply.hasOwnProperty('metaData')) {
                        if (this.store.hasMetadata(metaData.id)) {
                            this.action.correctContentAspect({
                                metaData : reply.metaData,
                                callback : (err, meta) => {
                                    reply.metaData = meta;
                                    controller.doneGetContent(err, reply);
                                    controller.doneGetMetaData(err, meta);
                                }
                            });
                        }
                    }
                });
            }
        });

        // windowが更新されたときにブロードキャストされてくる.
        this.connector.on(Command.UpdateWindowMetaData, (data) => {
            // console.log("onUpdateWindowMetaData", data);

            if (data instanceof Array) {
                for (let i = 0; i < data.length; ++i) {
                    let metaData = data[i];
                    controller.doneGetWindowMetaData(null, metaData);
                    gui.changeWindowBorderColor(metaData);
                    if (this.store.getState().getSelectedID()) {
                        if (!this.store.getState().isSelectionRectShown()) {
                            let elem = document.getElementById(this.store.getState().getSelectedID());
                            manipulator.moveManipulator(elem);
                        }
                    }
                }
                if (this.store.getState().isSelectionRectShown() && data.length > 0) {
                    controller.updateSelectionRect();
                }
            } else {
                let metaData = data;
                controller.doneGetWindowMetaData(null, metaData);
                gui.changeWindowBorderColor(metaData);
                if (this.store.getState().getSelectedID()) {
                    let elem = document.getElementById(this.store.getState().getSelectedID());
                    manipulator.moveManipulator(elem);
                }
            }
        });

        // virtual displayが更新されたときにブロードキャストされてくる.
        this.connector.on(Command.UpdateVirtualDisplay, (data) => {
            controller.removeVirtualDisplay();
            controller.doneGetVirtualDisplay(null, data);
        });

        // グループが更新されたときにブロードキャストされてくる.
        this.connector.on(Command.UpdateGroup, (metaData) => {
            // console.log("onUpdateGroup")
            controller.onUpdateAuthority(() => {
                this.action.getGroupList();
            });
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
            let i;
            controller.doneDeleteContent(null, data);
        });

        // ウィンドウが削除されたときにブロードキャストされてくる.
        this.connector.on(Command.DeleteWindowMetaData, (metaDataList) => {
            // console.log("DeleteWindowMetaData", metaDataList);
            for (let i = 0; i < metaDataList.length; i = i + 1) {
                controller.doneDeleteWindowMetaData(null, metaDataList[i]);
            }
        });

        // Video Controllerで使う.
        this.connector.on(Command.SendMessage, (data) => {
            if (data.command === 'playVideo') {
                data.ids.forEach((id) => {
                    let el = document.getElementById(id);
                    if (el && el.play) {
                        data.play ? el.play() : el.pause();

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
                    let el = document.getElementById(id);
                    if (el && el.play) {
                        el.currentTime = 0.0;
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
                        // 開きなおす
                        gui.showManagementGUI(false);
                        gui.showManagementGUI(true);
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
                keyStr = StringUtil.arrayBufferToString(data.contentData.data);
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
                keyStr = StringUtil.arrayBufferToString(data.contentData.data);
                key = JSON.parse(keyStr).key;
            }  catch (e) {
                console.error(e);
                return;
            }
            if (key) {
                // このコントローラが接続を持っているか判別
                if (this.store.getVideoStore().getWebRTC() && this.store.getVideoStore().getWebRTC().hasOwnProperty(key)) {
                    this.store.getVideoStore().getWebRTC()[key].close(true);
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
            if (this.store.getVideoStore().getWebRTC() && this.store.getVideoStore().getWebRTC().hasOwnProperty(key)) {
                this.store.getVideoStore().getWebRTC()[key].setAnswer(answer, (e) => {
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
            if (this.store.getVideoStore().getWebRTC() && this.store.getVideoStore().getWebRTC().hasOwnProperty(key)) {
                if (candidate) {
                    this.store.getVideoStore().getWebRTC()[key].addIceCandidate(candidate);
                }
            }
        });
    }
}
export default Receiver;
