/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
import Action from '../action'
import Connector from '../../common/ws_connector.js';
import Constants from '../../common/constants'
import Command from '../../common/command';
import Vscreen from '../../common/vscreen';
import Validator from '../../common/validator';
import VscreenUtil from '../../common/vscreen_util';
import VideoStore from './video_store';
import Receiver from './reciever';
import PerformanceLogger from '../performance_logger';

"use strict";

const reconnectTimeout = 2000;

class Store extends EventEmitter {
    constructor(action) {
        super();
        this.action = action;

        this.isInitialized_ = false;
        this.authority = null;
        this.windowData = null;
        this.metaDataDict = {};
        this.groupDict = {};
        this.globalSetting = null;
        this.virtualDisplay = null;
        this.itownFuncDict = {};

        // 接続時に遅延して初期化する
        this.receiver = null;
        this.videoStore = null;

        this.initEvents();
        this.time = {};

        this.onGetWindowData = this.onGetWindowData.bind(this);
        this.onGetMetaData = this.onGetMetaData.bind(this);
        this.onRegisterWindow = this.onRegisterWindow.bind(this);
        this.onUpdateWindowMetaData = this.onUpdateWindowMetaData.bind(this);
    }

    // デバッグ用. release版作るときは消す
    emit() {
        if (arguments.length > 0) {
            if (!arguments[0]) {
                console.error("Not found EVENT NAME!")
            }
        }
        super.emit(...arguments);
    }

    static extractCallback(data) {
        let callback;
        if (data && data.hasOwnProperty('callback')) {
            callback = data.callback;
            delete data.callback;
        }
        return callback;
    }

    release() {
        if (this.videoStore && this.videoStore.release) {
            this.videoStore.release();
        }
    }

    initEvents() {
        for (let i in Action) {
            if (i.indexOf('EVENT') >= 0) {
                this.action.on(Action[i], ((method) => {
                    return (err, data) => {
                        if (this[method]) {
                            this[method](data);
                        }
                    };
                })('_' + Action[i]));
            }
        }
    };

    initOtherStores(callback) {
        // 全体設定を取得
        Connector.send(Command.GetGlobalSetting, {}, (err, reply) => {
            this.globalSetting = reply;
            // パフォーマンス計測を初期化
            if (this.isMeasureTimeEnable()) {
                this.prepareMeasureTime();
            }
            this.receiver = new Receiver(Connector, this, this.action);
            this.videoStore = new VideoStore(Connector, this, this.action);

            this.isInitialized_ = true;
            if (callback) {
                callback();
            }
        });
    }

    _connect() {
        let isDisconnect = false;
        let client = Connector.connect(() => {
            if (!this.isInitialized_) {
                this.initOtherStores(() => {
                    this.emit(Store.EVENT_CONNECT_SUCCESS, null);
                });
            } else {
                this.emit(Store.EVENT_CONNECT_SUCCESS, null);
            }
        }, (() => {
            return (ev) => {
                this.emit(Store.EVENT_CONNECT_FAILED, null);

                if (!isDisconnect) {
                    setTimeout(() => {
                        this._connect();
                    }, reconnectTimeout);
                }
            };
        })());

        Connector.on("Disconnect", ((client) => {
            return () => {
                isDisconnect = true;
                client.close();
                this.emit(Store.EVENT_DISCONNECTED, null);
            };
        })(client));
    }

    // パフォーマンス計測のためにConnectorに細工をする
    prepareMeasureTime() {
        PerformanceLogger.init(this);

        // incomming
        const orgOn = Connector.on;
        Connector.on = (method, callback) => {
            if (callback) {
                let orgCallback = callback;
                callback = (data, a, b, c, d) => {
                    if (data instanceof Array) {
                        PerformanceLogger.log(method, data[0]);
                    }
                    orgCallback(data, a, b, c, d);
                }
            }
            orgOn(method, callback);
        };

        // outgoing
        const orgSend = Connector.send;
        Connector.send = (method, args, resultCallback) => {
            let metaData = null;
            if (args instanceof Array) {
                metaData = args[0];
            } else {
                metaData = args ? args : null;
            }
            if (metaData && metaData.hasOwnProperty('id')) {
                PerformanceLogger.log(method, metaData);
            }
            orgSend(method, args, resultCallback);
        };
    }

    // iTownsのパフォーマンス計測を行う
    // PerformanceLoggerは使用しない
    measureITownPerformance(id) {
        let funcDict = this.getITownFuncDict();
        console.log(funcDict, id)
        if (funcDict && funcDict.hasOwnProperty(id)) {
            funcDict[id].chowder_itowns_measure_time((err, status) => {
                Connector.send("SendMessage", {
                    id: id,
                    display_id: this.getWindowID(),
                    command: "measureITownPerformanceResult",
                    result: status
                }, () => { })
            });
        }
    }

    _login(data) {
        Connector.send(Command.Login, data, (err, reply) => {
            if (err || reply === null) {
                console.log(err);
                this.emit(Store.EVENT_LOGIN_FAILED, null);
            } else {
                // ユーザーリスト取得
                this._reloadUserList({
                    callback: () => {
                        this.authority = reply.authority;
                        this.emit(Store.EVENT_LOGIN_SUCCESS, null);
                    }
                });
            }
        });
    }

    _logout(data) {
        this.authority = null;
        Connector.send(Command.Logout, {}, function () {
        });
    }

	/**
	 * ユーザーリストを最新に更新
	 */
    _reloadUserList(data) {
        let callback = Store.extractCallback(data);

        Connector.send(Command.GetUserList, {}, (err, userList) => {
            this.userList = userList;
            if (callback) {
                callback(err, userList);
            }
            this.emit(Store.EVENT_USERLIST_RELOADED, null);
        });
    }

    updateGroupDict(groupList) {
        for (let i = 0; i < groupList.length; ++i) {
            this.groupDict[groupList[i].id] = groupList[i];
        }
    }

    _update(data) {
        let updateType = data.updateType;
        let targetID = data.targetID;

        if (updateType === 'all') {
            // console.log("update all");
            Connector.send(Command.GetWindowMetaData, { id: this.getWindowID() }, (err, json) => {
                this.onGetWindowData(err, json);
                Connector.send(Command.GetMetaData, { type: 'all', id: '' }, this.onGetMetaData);
            });
            Connector.send(Command.GetGroupList, {}, (err, data) => {
                if (!err && data.hasOwnProperty("grouplist")) {
                    this.updateGroupDict(data.grouplist);
                }
            });
        } else if (updateType === 'window') {
            if (this.getWindowData() !== null) {
                // console.log("update winodow", this.getWindowData());
                Connector.send(Command.GetWindowMetaData, { id: this.getWindowData().id }, this.onGetWindowData);
            }
        } else if (updateType === 'group') {
            Connector.send(Command.GetGroupList, {}, (err, data) => {
                if (!err && data.hasOwnProperty("grouplist")) {
                    this.updateGroupDict(data.grouplist);
                }
            });
        } else {
            // console.log("update transform");
            if (targetID) {
                Connector.send(Command.GetMetaData, { type: '', id: targetID }, this.onGetMetaData);
            } else {
                Connector.send(Command.GetMetaData, { type: 'all', id: '' }, this.onGetMetaData);
            }
        }
    }

    _changeDisplayID(data) {
        let newId = data.id.replace(' ', '_');
        let metaData = this.getWindowData();
        let params = { id: newId };
        if (metaData) {
            params.posx = metaData.posx;
            params.posy = metaData.posy;
            params.scale = parseFloat(metaData.orgWidth) / parseFloat(metaData.width);
        } else {
            params.posx = 0;
            params.posy = 0;
            params.scale = 1;
        }

        Connector.send(Command.GetWindowMetaData, { id: newId }, (err, metaData) => {
            if (!err && metaData) {
                // 既にnewIdのdisplayが登録されていた場合は、そちらの位置サイズに合わせる
                params.posx = metaData.posx;
                params.posy = metaData.posy;
                params.scale = parseFloat(metaData.orgWidth) / parseFloat(metaData.width);
            }
            this._changeQueryParam(params);
            location.reload();
        });
        this.emit(Store.EVENT_DISPLAY_ID_CHANGED, null);
    }

    _resizeWindow(data) {
        let wh = data.size;
        let cx = wh.width / 2.0;
        let cy = wh.height / 2.0;
        let metaData = this.getWindowData();
        if (!metaData) { return; }
        metaData.width = metaData.width * (wh.width / parseFloat(metaData.orgWidth));
        metaData.height = metaData.height * (wh.height / parseFloat(metaData.orgHeight));
        metaData.orgWidth = wh.width;
        metaData.orgHeight = wh.height;
        Vscreen.assignWhole(wh.width, wh.height, cx, cy, 1.0);
        Connector.send(Command.UpdateWindowMetaData, [metaData], this.onUpdateWindowMetaData);
    }

    _deleteAllElements(data) {
        let metaDataDict = this.getMetaDataDict();
        let idList = [];
        for (let id in metaDataDict) {
            idList.push(id);
            delete metaDataDict[id];
        }
        this.emit(Store.EVENT_DONE_DELETE_ALL_ELEMENTS, null, idList);
    }

    _changeQueryParam(data) {
        let query = this.mapToQueryString(data);
        history.replaceState(null, '', location.href.match(/^[^?]+/)[0] + query);
    }

    _registerWindow(data) {
        let wh = data.size;
        Vscreen.assignWhole(wh.width, wh.height, wh.width / 2.0, wh.height / 2.0, 1.0);
        let windowID = '';
        {
            let hash = location.hash.substring(1);
            if (hash !== '') {
                windowID = decodeURIComponent(hash);
            }
        }

        let query = this.getQueryParams(location.search) || {};
        windowID = query.id ? decodeURIComponent(query.id) : windowID;
        let groupId = undefined;

        let f = () => {
            if (windowID !== '') {
                Connector.send(Command.GetWindowMetaData, { id: windowID }, (err, metaData) => {
                    if (!err && metaData) {
                        let scale = parseFloat(query.scale) || parseFloat(metaData.orgWidth) / parseFloat(metaData.width);
                        metaData.group = groupId || metaData.group,
                            metaData.width = wh.width / scale;
                        metaData.height = wh.height / scale;
                        metaData.orgWidth = wh.width;
                        metaData.orgHeight = wh.height;
                        metaData.posx = query.posx || metaData.posx;
                        metaData.posy = query.posy || metaData.posy;
                        Connector.send(Command.AddWindowMetaData, metaData, this.onRegisterWindow);
                    } else {
                        let scale = parseFloat(query.scale) || 1.0;
                        Connector.send(Command.AddWindowMetaData, {
                            id: windowID,
                            group: groupId,
                            posx: query.posx || 0,
                            posy: query.posy || 0,
                            width: wh.width / scale,
                            height: wh.height / scale,
                            orgWidth: wh.width,
                            orgHeight: wh.height,
                            visible: true
                        }, this.onRegisterWindow);
                    }
                });
            } else {
                let scale = parseFloat(query.scale) || 1.0;
                Connector.send(Command.AddWindowMetaData, {
                    group: groupId,
                    posx: query.posx || 0,
                    posy: query.posy || 0,
                    width: wh.width / scale,
                    height: wh.height / scale,
                    orgWidth: wh.width,
                    orgHeight: wh.height,
                    visible: true
                }, this.onRegisterWindow);
            }
        };

        let groupName = decodeURIComponent(query.group || '');
        if (groupName) {
            Connector.send(Command.GetGroupList, {}, (err, data) => {
                for (let i = 0; i < data.displaygrouplist.length; i++) {
                    if (data.displaygrouplist[i].name === groupName) {
                        groupId = data.displaygrouplist[i].id;
                    }
                }
                f();
            });
        } else {
            f();
        }
    }

	/**
	 * コンテンツのZインデックスを一番手前にする
	 */
    _changeContentIndexToFront(data) {
        let targetid = data.targetID;
        let max = 0;
        let metaDataDict = this.getMetaDataDict();
        if (metaDataDict.hasOwnProperty(targetid)) {
            let metaData = metaDataDict[targetid];
            for (let i in metaDataDict) {
                if (metaDataDict.hasOwnProperty(i)) {
                    if (metaDataDict[i].id !== metaData.id &&
                        !Validator.isWindowType(metaDataDict[i]) &&
                        metaDataDict[i].hasOwnProperty("zIndex")) {
                        if (metaDataDict[i].zIndex < Constants.ZIndexAlwaysOnTopValue) {
                            let index = parseInt(metaDataDict[i].zIndex, 10);
                            if (!isNaN(index)) {
                                max = Math.max(max, parseInt(metaDataDict[i].zIndex, 10));
                            }
                        }
                    }
                }
            }
            metaData.zIndex = max + 1;
            Connector.send(Command.UpdateMetaData, [metaData], function (err, reply) { });
        }
    }

	/**
	 * コンテンツのTransformを変更
	 * @param {*} data
	 */
    _changeContentTransform(data) {
        let targetid = data.targetID;
        let x = data.x;
        let y = data.y;
        let metaDataDict = this.getMetaDataDict();
        if (metaDataDict.hasOwnProperty(targetid)) {
            let metaData = metaDataDict[targetid];
            metaData.posx = x;
            metaData.posy = y;

            VscreenUtil.transPosInv(metaData);
            metaData.posx -= Vscreen.getWhole().x;
            metaData.posy -= Vscreen.getWhole().y;

            Connector.send(Command.UpdateMetaData, [metaData], function (err, reply) {
            });
        }
    }

    _getTileContent(data) {
        let callback = Store.extractCallback(data);
        Connector.send(Command.GetTileContent, data.request, (err, reply) => {
            if (callback) {
                callback(err, reply);
            }
        });
    }

    _addItownFunc(data) {
        if (data.hasOwnProperty('id') && data.hasOwnProperty('func')) {
            this.itownFuncDict[data.id] = data.func;
            this.emit(Store.EVENT_DONE_ADD_ITOWN_FUNC, null, data.id);
        }
        else {
            console.error("addITownFun - invalid param");
        }
    }

    _updateQgisMetadata(metaData){
		let dom = document.getElementById(metaData.id);
		if(!dom){
			return;
		}
		// console.log("[store:_updateQgisMetadata]",dom,metaData.id);
		let iframe = dom.childNodes[0];
		if(!iframe || !iframe.contentWindow || !iframe.contentWindow.Q3D){
			//iframe読み込みがまだ終わっていない
			return;
		}
		
		/* camera matrix */
		iframe.contentWindow.Q3D.application.camera.matrixAutoUpdate = false;
		iframe.contentWindow.Q3D.application.camera.matrixWorld.elements = JSON.parse(metaData.cameraWorldMatrix);
		let d = new iframe.contentWindow.THREE.Vector3();
		let q = new iframe.contentWindow.THREE.Quaternion();
		let s = new iframe.contentWindow.THREE.Vector3();
		iframe.contentWindow.Q3D.application.camera.matrixWorld.decompose(d,q,s);
		iframe.contentWindow.Q3D.application.camera.position.copy( d );
		iframe.contentWindow.Q3D.application.camera.quaternion.copy( q );
		iframe.contentWindow.Q3D.application.camera.scale.copy( s );
		iframe.contentWindow.Q3D.application.camera.matrixAutoUpdate = true;
		iframe.contentWindow.Q3D.application.scene.requestRender();

		/* camera matrix */
		const displayProperty = JSON.parse(metaData.displayProperty);
		if(iframe.contentWindow.Q3D.application.labelVisible !== displayProperty.label){
			iframe.contentWindow.Q3D.application.setLabelVisible(displayProperty.label);
		}
		if(iframe.contentWindow.Q3D.application._wireframeMode !== displayProperty.wireframe){
			iframe.contentWindow.Q3D.application.setWireframeMode(displayProperty.wireframe);
		}
	}

    onGetWindowData(err, json) {
        if (!err && json) {
            this.metaDataDict[json.id] = json;
            this.windowData = json;
            let group = json.group ? json.group : Constants.DefaultGroup;
            if (!this.virtualDisplay) {
                Connector.send(Command.GetVirtualDisplay, { group: group }, (err, reply) => {
                    this.virtualDisplay = reply;
                    this.emit(Store.EVENT_DONE_GET_VIRTUAL_DISPLAY, err, reply);
                });
            }
            this.emit(Store.EVENT_DONE_GET_WINDOW_METADATA, null, json);
        } else {
            this._logout();
        }
    }

    onGetMetaData(err, json) {
        this.emit(Store.EVENT_DONE_GET_METADATA, null, json);
    }

    onRegisterWindow(err, json) {
        if (!err) {
            for (let i = 0; i < json.length; i = i + 1) {
                this.metaDataDict[json[i].id] = json[i];
                if (!this.windowData || this.windowData.id === json[i].id) {
                    this.windowData = json[i];
                }
            }
        }
        this.emit(Store.EVENT_DONE_REGISTER_WINDOW, err, json)
    }

    onUpdateWindowMetaData(err, json) {
        if (!err) {
            let isGroupChanged = false;
            for (let i = 0; i < json.length; i = i + 1) {
                this.metaDataDict[json[i].id] = json[i];
                if (!this.windowData || this.windowData.id === json[i].id) {
                    if (!isGroupChanged) {
                        if (this.windowData && this.windowData.group !== json[i].group) {
                            isGroupChanged = true;
                        }
                    }
                    this.windowData = json[i];
                }
            }
            if (isGroupChanged) {
                this.emit(Store.EVENT_DONE_UPDATE_WWINDOW_GROUP, err, json)
            }
        }
        this.emit(Store.EVENT_DONE_UPDATE_WWINDOW_METADATA, err, json)
    }

    /**
     * window idの取得.
     * @method getWindowID
     */
    getWindowID() {
        return this.getQueryParams().id;
    }

    /**
     * Parse `location.search` and return it as object.
     * @returns {Object} result
     */
    getQueryParams() {
        let re = /[?&]([^=]+)=([^&]*)/g;
        let ret = {};
        let match;
        while ((match = re.exec(location.search)) !== null) { // while `re` is not depleted
            ret[match[1]] = decodeURIComponent(match[2]);
        }
        return ret;
    }

	/**
	 * VideoStoreを返す
	 */
    getVideoStore() {
        return this.videoStore;
    }

    /**
     * Convert map into query params string.
     * @param {Object} map Map of parameters you want to convert into
     * @return {string} result
     */
    mapToQueryString(map) {
        let str = '?';
        for (let key in map) {
            if (map[key] !== undefined) {
                str += key + '=' + map[key] + '&';
            }
        }
        str = str.substring(0, str.length - 1); // remove the last '&'

        return str;
    }

    setWindowData(windowData) {
        if (this.windowData.id !== windowData.id) { console.error("Error : mismatch window id", windowData); }
        this.windowData = windowData;
    }

    getWindowData() {
        return this.windowData;
    }

    getAuthority() {
        return this.authority;
    }

    setAuthority(authority) {
        this.authority = authority;
    }

	/**
	 * メタデータごとにfuncを実行
	 * @param {*} func
	 */
    for_each_metadata(func) {
        let i;
        for (i in this.metaDataDict) {
            if (this.metaDataDict.hasOwnProperty(i)) {
                if (func(i, this.metaDataDict[i]) === true) {
                    break;
                }
            }
        }
    }

    getMetaDataDict() {
        return this.metaDataDict;
    }

    getITownFuncDict() {
        return this.itownFuncDict;
    }

    getGroupDict() {
        return this.groupDict;
    }

	/**
	 * 指定したIDのメタデータがあるかどうか
	 */
    hasMetadata(id) {
        return this.metaDataDict.hasOwnProperty(id);
    }
	/**
	 * 指定したIDのメタデータを取得
	 */
    getMetaData(id) {
        return this.metaDataDict[id];
    }


    /**
     * 閲覧情報があるか返す
     */
    isViewable(group) {
        if (!this.getAuthority()) {
            return false;
        }
        if (group === undefined || group === "") {
            return true;
        }
        if (group === Constants.DefaultGroup) {
            return true;
        }
        if (!this.isViewableSite(group)) {
            return false;
        }
        let groupDict = this.getGroupDict();
        if (groupDict.hasOwnProperty(group)) {
            if (this.getAuthority().viewable === "all") {
                return true;
            }
            if (this.getAuthority().viewable.indexOf(group) >= 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * socketidユーザーがdisplaygroupを表示可能かどうか返す
     * @method isViewableDisplay
     * @param {String} group group
     */
    isViewableSite(group) {
        if (group === Constants.DefaultGroup) {
            return true;
        }
        if (group === undefined || group === "") {
            return true;
        }
        // displayからのアクセスだった
        const windowData = this.getWindowData();
        if (!windowData) {
            return false;
        }
        for (let i = 0; i < this.userList.length; ++i) {
            const authority = this.userList[i];
            if (authority.id === group) {
                if (authority.hasOwnProperty('viewableSite')) {
                    if (authority.viewableSite !== "all") {
                        return authority.viewableSite.indexOf(windowData.group) >= 0;
                    }
                }
                // viewableSiteの設定が無い、または"all"
                return true;
            }
        }
        return false;
    }

    // パフォーマンス計算を行うかどうか
    isMeasureTimeEnable() {
        if (this.globalSetting && this.globalSetting.enableMeasureTime) {
            return (String(this.globalSetting.enableMeasureTime) === "true");
        }
        return false;
    }
    // パフォーマンス計算用時間を生成して返す
    fetchMeasureTime() {
        let time = null;
        if (this.isMeasureTimeEnable()) {
            time = new Date().toISOString();
        }
        return time;
    }

    getVirtualDisplay() {
        return this.virtualDisplay;
    }

    getTime(id) {
        if (this.time.hasOwnProperty(id)) {
            return this.time[id];
        }
        return null;
    }

    getGlobalSetting() {
        return this.globalSetting;
    }
}

Store.EVENT_DISCONNECTED = "disconnected";
Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_CONNECT_FAILED = "connect_failed";
Store.EVENT_LOGIN_SUCCESS = "login_success";
Store.EVENT_LOGIN_FAILED = "login_failed"
Store.EVENT_DISPLAY_ID_CHANGED = "display_id_changed";
Store.EVENT_DONE_UPDATE_WINDOW_METADATA = "done_update_window_metadata";
Store.EVENT_DONE_DELETE_ALL_ELEMENTS = "done_delete_all_elements";
Store.EVENT_DONE_REGISTER_WINDOW = "done_register_window";
Store.EVENT_DONE_GET_WINDOW_METADATA = "done_get_window_metadata";
Store.EVENT_DONE_GET_METADATA = "done_get_metadata";
Store.EVENT_CONTENT_INDEX_CHANGED = "content_index_changed";
Store.EVENT_CONTENT_TRANSFORM_CHANGED = "content_transform_changed";
Store.EVENT_DONE_GET_VIRTUAL_DISPLAY = "done_get_virtual_display";
Store.EVENT_DONE_UPDATE_VIRTUAL_DISPLAY = "done_update_virtual_display";
Store.EVENT_DONE_ADD_ITOWN_FUNC = "done_add_itown_func";
Store.EVENT_USERLIST_RELOADED = "user_list_reloaded";

// reviever
Store.EVENT_DONE_DELETE_CONTENT = "done_delete_content"
Store.EVENT_REQUEST_SHOW_DISPLAY_ID = "request_show_display_id"
Store.EVENT_DONE_UPDATE_METADATA = "done_update_metadata";
Store.EVENT_DONE_GET_CONTENT = "done_get_content";
Store.EVENT_REQUEST_RELOAD_DISPLAY = "reload_display";
Store.EVENT_UPDATE_TIME = "updat_time";
Store.EVENT_DONE_UPDATE_WWINDOW_METADATA = "done_update_window_metadata";
Store.EVENT_DONE_UPDATE_WWINDOW_GROUP = "done_update_window_group";

export default Store;