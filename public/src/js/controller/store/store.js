/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../../common/constants.js';
import Validator from '../../common/validator.js';
import Action from '../action.js';
import Connector from '../../common/ws_connector.js';
import ManagementStore from './management_store.js'
import LoginStore from './login_store.js';
import ContentStore from './content_store';
import DisplayStore from './display_store'
import GroupStore from './group_store'
import VideoStore from './video_store'
import ManipulatorStore from './manipulator_store'
import ControllerData from '../controller_data'
import Operation from './operation'
import Translation from '../../common/translation'
import Command from '../../common/command'
import StringUtil from '../../common/string_util'
import Receiver from './reciever.js';

"use strict";

/**
 * エンコードされた文字列を返す.
 * @method fixedEncodeURIComponent
 * @param {String} str 文字列.
 * @return {String} エンコードされた文字列
 */
function fixedEncodeURIComponent(str) {
    return encodeURIComponent(str).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
}

class Store extends EventEmitter {
    constructor(state, action, cookie) {
        super();

        this.state = state;
        this.action = action;
        this.cookie = cookie;

        this.controllerData = new ControllerData();

        this.isInitialized_ = false;

        // 接続状況
        // null = 初期状態(未接続), false = 接続済, true = 接続した後に切断された
        this.isDisconnect = null;

        this.connectionClient = null;
        this.reciever = new Receiver(Connector, this, action);
        this.operation = new Operation(Connector, this); // 各種storeからのみ限定的に使う
        this.managementStore = new ManagementStore(Connector, state, this, action);
        this.contentStore = new ContentStore(Connector, state, this, action);
        this.loginStore = new LoginStore(Connector, state, this, action, cookie);
        this.displayStore = new DisplayStore(Connector, state, this, action, cookie);
        this.groupStore = new GroupStore(Connector, state, this, action);
        this.videoStore = new VideoStore(Connector, state, this, action);
        this.manipulatorStore = new ManipulatorStore(Connector, state, this, action);

        this.virtualDisplayDict = {};
        this.metaDataDict = {};
        this.itownFuncDict = {};

        this.displayPermissionList = [];

        this.initEvents();

        this.on(Store.EVENT_LOGIN_SUCCESS, (err, data) => {
            // management新規作成
            let userList = this.loginStore.getUserList();
            //this.managementStore = new ManagementStore(Connector, state, this, action);
            this.managementStore.globalSetting = null;
            //this.managementStore.userList = userList;
            this.managementStore.authority = data.authority;
        });
        this.on(Store.EVENT_LOGIN_FAILED, () => {
            // management新規作成
            //this.managementStore = new ManagementStore(Connector, state, this, action);
            this.managementStore.globalSetting = null;
            //this.managementStore.userList = null;
            this.managementStore.authority = null;
        });

        // controllerデータの何かが更新されたときにサーバーに保存する処理
        this.controllerData.on(ControllerData.EVENT_UPDATE, (err, data) => {
            let controllerData = {
                controllerID: this.getLoginStore().getControllerID(),
                controllerData: data
            };
            this.operation.updateControllerData(controllerData);
        });

        // websocket切断時の処理
        Connector.on(Command.Disconnect, () => {
            this.isDisconnect = true;
            if (this.connectionClient) {
                this.connectionClient.close();
            }
        });
    }

    // デバッグ用. release版作るときは消す
    emit() {
        if (arguments.length > 0) {
            if (!arguments[0]) {
                console.error("Not found EVENT NAME!", arguments[0])
            }
        }
        super.emit(...arguments);
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

    static extractCallback(data) {
        let callback;
        if (data && data.hasOwnProperty('callback')) {
            callback = data.callback;
            delete data.callback;
        }
        return callback;
    }

    /**
     * 解放処理
     */
    release() {
        if (this.videoStore.release) {
            this.videoStore.release();
        }
        if (this.managementStore.release) {
            this.managementStore.release();
        }
        if (this.contentStore.release) {
            this.contentStore.release();
        }
        if (this.loginStore.release) {
            this.loginStore.release();
        }
        if (this.displayStore.release) {
            this.displayStore.release();
        }
        if (this.groupStore.release) {
            this.groupStore.release();
        }
        if (this.manipulatorStore.release) {
            this.manipulatorStore.release();
        }
    }

    /**
     * 初期化
     * TODO
     */
    _init() {
        this.isInitialized_ = true;
    }

    /**
     * websocket接続する
     */
    _connect(data) {
        let reconnect = () => {
            this.connectionClient = Connector.connect(() => {
                if (this.isDisconnect) {
                    location.reload();
                    return;
                }
                this.isDisconnect = false;
                // 接続確率した
                this.emit(Store.EVENT_CONNECT_SUCCESS, null);

            }, () => {
                // 接続失敗
                this.emit(Store.EVENT_CONNECT_FAILED, null);
                // 再ログイン
                this.isDisconnect = true;
                setTimeout(() => {
                    reconnect();
                }, Constants.ReconnectTimeout);
            });
        };
        reconnect();
    }

    /**
     * 全てのコンテンツ、ディスプレイなどを取得.
     */
    _getAll(data) {
        let callback = Store.extractCallback(data);
        this.operation.update(callback);
    }

    /**
     * 全てのコンテンツ、ディスプレイなどを取得し、グループを含めて全てリロード
     */
    _reloadAll(data) {
        let callback_ = Store.extractCallback(data);

        this._getAll();

        setTimeout(() => {
            Translation.changeLanguage(this.cookie.getLanguage());
            Translation.translate();
            if (callback_) {
                callback_(null, data);
            }
            this.emit(Store.EVENT_DONE_RELOAD_ALL, null);
        }, 100);
    }

    /**
     * タブの変更
     */
    _changeTab(data) {
        if (data.isBefore) {
            this.emit(Store.EVENT_TAB_CHANGED_PRE, null, data.data);
        } else {
            Connector.send(Command.GetLoginUserList, {}, (err, reply) => {
                console.log("🐔",reply);
            });
            this.emit(Store.EVENT_TAB_CHANGED_POST, null, data.data);
        }
    }

    /**
     * スナップタイプの変更
     */
    _changeSnapType(data) {
        this.controllerData.setSnapType(data.isDisplay, data.snapType);
        this.emit(Store.EVENT_SNAP_TYPE_CHANGED, null, data);
    }

    /**
     * 検索文字列変更
     * @param {*} data
     */
    _changeSearchInput(data) {
        this.emit(Store.EVENT_SEARCH_INPUT_CHANGED, null, data.text, data.groups);
    }

    /**
     * 検索文字列変更
     * @param {*} data
     */
    _changeUserSearchInput(data) {
        this.emit(Store.EVENT_USERSEARCH_INPUT_CHANGED, null, data.text, data.groups);
    }

    /**
     * コントローラIDの変更
     */
    _changeControllerID(data) {
        if (data.id) {
            let id = data.id;
            if (id !== this.getLoginStore().getControllerID()) {
                location.hash = fixedEncodeURIComponent(id);
                location.reload(true);
            }
        }
    }

    /**
     * リモートカーソルの更新
     * @param {*} data
     */
    _updateRemoteCursor(data) {
        if (data.hasOwnProperty('rgb')) {
            this.getControllerData().setCursorColor(data.rgb);
        }
        if (data.hasOwnProperty('cursor_size')) {
            this.getControllerData().setCursorSize(data.cursor_size);
        }

        if (data.isEnable === undefined) { // 特にONともOFFともいわれてない
            const nowEnable = this.getControllerData().getUpdateCursorEnable();
            if (nowEnable === false) {
                Connector.send(Command.UpdateMouseCursor, {}, (err, reply) => {});
            } else {
                // ONの場合
                let metaData = data;
                delete metaData.isEnable;
                metaData.controllerID = this.getLoginStore().getControllerID();
                metaData.rgb = this.getControllerData().getCursorColor();
                metaData.cursor_size = this.getControllerData().getCursorSize();
                Connector.send(Command.UpdateMouseCursor, metaData, (err, reply) => {});
            }
        } else if (data.isEnable === false) {
            // OFFにする場合
            this.getControllerData().setUpdateCursorEnable(data.isEnable);

            Connector.send(Command.UpdateMouseCursor, {}, (err, reply) => {});
        } else {
            // ONの場合
            this.getControllerData().setUpdateCursorEnable(data.isEnable);

            let metaData = data;
            delete metaData.isEnable;
            metaData.controllerID = this.getLoginStore().getControllerID();
            metaData.rgb = this.getControllerData().getCursorColor();
            metaData.cursor_size = this.getControllerData().getCursorSize();
            Connector.send(Command.UpdateMouseCursor, metaData, (err, reply) => {});
        }
    }

    _reloadDisplayPermissionList() {
        Connector.send(Command.GetDisplayPermissionList, null, (err, reply) => {
            this.displayPermissionList = reply.permissionList;
            this.emit(Store.EVENT_DISPLAY_PREMISSION_LIST_RELOADED, null, this.displayPermissionList)
        });
    }

    _changeDisplayPermissionList(data) {
        let callback_ = Store.extractCallback(data);

        Connector.send(Command.UpdateDisplayPermissionList, data, (err, reply) => {
            console.log(err, reply)
            this.action.reloadDisplayPermissionList();
            if (callback_) {
                callback_(err, reply);
            }
        });
    }

    _addItownFunc(data) {
        if (data.hasOwnProperty('id') && data.hasOwnProperty('func')) {
            this.itownFuncDict[data.id] = data.func;
        } else {
            console.error("addITownFun - invalid param");
        }
    }

    _updateQgisMetadata(metaData) {
        let dom = document.getElementById(metaData.id);
        if (!dom) {
            return;
        }
        // console.log("[store:_updateQgisMetadata]",dom,metaData.id);
        let iframe = dom.childNodes[0];
        if (!iframe || !iframe.contentWindow || !iframe.contentWindow.Q3D) {
            //iframe読み込みがまだ終わっていない
            return;
        }
        if (!iframe.contentWindow.Q3D.application.hasOwnProperty('camera')) {
            return;
        }

        /* camera matrix */
        iframe.contentWindow.Q3D.application.camera.matrixAutoUpdate = false;
        if (metaData.hasOwnProperty('cameraWorldMatrix')) {
            try {
                iframe.contentWindow.Q3D.application.camera.matrixWorld.elements = JSON.parse(metaData.cameraWorldMatrix);
            } catch (e) {
                // console.error(e, metaData)
            }
        }
        let d = new iframe.contentWindow.THREE.Vector3();
        let q = new iframe.contentWindow.THREE.Quaternion();
        let s = new iframe.contentWindow.THREE.Vector3();
        iframe.contentWindow.Q3D.application.camera.matrixWorld.decompose(d, q, s);
        iframe.contentWindow.Q3D.application.camera.position.copy(d);
        iframe.contentWindow.Q3D.application.camera.quaternion.copy(q);
        iframe.contentWindow.Q3D.application.camera.scale.copy(s);
        iframe.contentWindow.Q3D.application.camera.matrixAutoUpdate = true;
        iframe.contentWindow.Q3D.application.scene.requestRender();

        /* camera matrix */
        const displayProperty = JSON.parse(metaData.displayProperty);
        if (iframe.contentWindow.Q3D.application.labelVisible !== displayProperty.label) {
            iframe.contentWindow.Q3D.application.setLabelVisible(displayProperty.label);
        }
        if (iframe.contentWindow.Q3D.application._wireframeMode !== displayProperty.wireframe) {
            iframe.contentWindow.Q3D.application.setWireframeMode(displayProperty.wireframe);
        }
    }

    async _uploadTileimageFile(data){
        const CONFIG_WS_MAX_MESSAGE_SIZE = this.managementStore.getMaxMessageSize();
        const binSize = CONFIG_WS_MAX_MESSAGE_SIZE - 1000; // meta message の分減らす

        const segment_max = Math.ceil(data.contentData.byteLength / binSize);
        const byteLength = data.contentData.byteLength;
        const hashid = await StringUtil.digestMessage(new Date().toString());
        const filename = data.metaData.filename;

        const file_ext = filename.split('.').pop();

        for(let i=0;i*binSize < data.contentData.byteLength;i++){
            const segment = data.contentData.slice(i*binSize, (i+1)*binSize);

            const params = {
                file_ext: file_ext,
                id : hashid,
                byteLength : byteLength,
                segment_max : segment_max,
                segment_index : i,
                type : "binary"
            };
            Connector.sendBinary(Command.UploadTileimage, params, segment, (err, reply) => {
                console.log("[_uploadTileimageFile]send done");
            });
        }
    }

    getDisplayPermissionList() {
        return this.displayPermissionList;
    }

    /**
     * 接続済かどうか返す
     */
    isConnected() {
        return !this.isDisconnect;
    }

    // TODO 名前変更どうするか
    getManagement() {
        return this.managementStore;
    }

    /**
     * ContentStoreを返す
     */
    getContentStore() {
        return this.contentStore;
    }

    /**
     * LoginStoreを返す
     */
    getLoginStore() {
        return this.loginStore;
    }

    /**
     * GroupStoreを返す
     */
    getGroupStore() {
        return this.groupStore;
    }

    /**
     * VideoStoreを返す
     */
    getVideoStore() {
        return this.videoStore;
    }

    /**
     * Stateオブジェクトを返す
     */
    getState() {
        return this.state;
    }

    /**
     * Cookieオブジェクトを返す
     */
    getCookie() {
        return this.cookie;
    }

    /**
     * 初期化済かどうか
     */
    isInitialized() {
        return this.isInitialized_;
    }

    /**
     * コントローラ固有データを返す.
     * コントローラURLごとにサーバー側で保存されているデータ.
     */
    getControllerData() {
        return this.controllerData;
    }

    /**
     * 指定したIDのVirtualDisplayy情報を設定
     */
    setVirtualDisplayMetaData(groupID, metaData) {
        this.virtualDisplayDict[groupID] = metaData;
    }

    /**
     * 指定したIDのVirtualDisplayy情報を返す
     */
    getVirtualDisplayMetaData(id) {
        return this.virtualDisplayDict[id];
    }

    /**
     * 指定したIDのメタデータを取得
     */
    getMetaData(id) {
        return this.metaDataDict[id];
    }

    /**
     * 指定したIDのメタデータを設定
     */
    setMetaData(id, metaData) {
        this.metaDataDict[id] = metaData;
    }

    /**
     * 指定したIDのメタデータがあるかどうか
     */
    hasMetadata(id) {
        return this.metaDataDict.hasOwnProperty(id);
    }

    /**
     * 指定したIDのメタデータをメタデータ辞書から削除
     */
    deleteMetaData(id) {
        delete this.metaDataDict[id];
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

    /**
     * グループ辞書を取得
     */
    getGroupDict() {
        return this.getGroupStore().getGroupDict();
    }

    /**
     * メタデータ辞書を取得
     */
    getMetaDataDict() {
        return this.metaDataDict;
    }

    /**
     * 選択中のメタデータのリストを返す
     */
    getSelectedMetaDataList() {
        let metaDataList = [];
        for (let i = 0; i < this.state.getSelectedIDList().length; ++i) {
            let metaData = this.getMetaData(this.state.getSelectedIDList()[i]);
            if (metaData) {
                metaDataList.push(metaData);
            }
        }
        return metaDataList;
    }

    /**
     * 枠色を返す
     */
    getBorderColor(meta) {
        if (Validator.isVirtualDisplayType(meta)) {
            return Constants.WindowSelectColor;
        }
        if (Validator.isWindowType(meta)) {
            if (meta.hasOwnProperty('color')) {
                return meta.color;
            }
            return "#0080FF";
        }
        return this.getGroupStore().getGroupColor(meta);
    }

    /**
     * リストエレメントのボーダーカラーをタイプ別に返す
     */
    getListBorderColor(meta) {
        if (Validator.isVirtualDisplayType(meta)) {
            return "white";
        }
        if (Validator.isWindowType(meta)) {
            if (meta.hasOwnProperty('reference_count') && parseInt(meta.reference_count, 10) <= 0) {
                return "gray";
            } else {
                return "white";
            }
        }
        if (Validator.isContentType(meta)) {
            return "rgba(0,0,0,0)";
        }
        if (Validator.isLayoutType(meta)) {
            return "lightgray";
        }
        return "white";
    }

    /**
     * コンテンツのzindexの習得.
     * @param {boolean} isFront 最前面に移動ならtrue, 最背面に移動ならfalse
     * */
    getZIndex(metaData, isFront, isAlwaysOnTop) {
        let max = 0,
            min = 0;

        this.for_each_metadata(function(i, meta) {
            if (meta.id !== metaData.id &&
                Validator.isContentType(meta) &&
                meta.hasOwnProperty("zIndex")) {
                if (meta.zIndex < 0x7FFFFFFF) {
                    max = Math.max(max, parseInt(meta.zIndex, 10));
                    min = Math.min(min, parseInt(meta.zIndex, 10));
                }
            }
        });
        if (isAlwaysOnTop) {
            return 0x7FFFFFFF;
        }

        if (isFront) {
            return max + 1;
        } else {
            return min - 1;
        }
    }

    getITownFuncDict() {
        return this.itownFuncDict;
    }

    getGlobalSetting() {
        return this.managementStore.globalSetting;
    }
}

Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_CONNECT_FAILED = "connect_failed";

Store.EVENT_SNAP_TYPE_CHANGED = "snap_type_changed";
Store.EVENT_USERLIST_RELOADED = "user_list_reloaded";
Store.EVENT_SEARCH_INPUT_CHANGED = "search_input_changed";
Store.EVENT_USERSEARCH_INPUT_CHANGED = "usersearch_input_changed";
Store.EVENT_DONE_RELOAD_ALL = "done_reload_all";

Store.EVENT_DISPLAY_PREMISSION_LIST_RELOADED = "display_permission_list_reloaded";
Store.EVENT_ASK_DISPLAY_PERMISSION = "ask_display_permission";

// operation
Store.EVENT_DONE_UPDATE_METADATA = "done_update_metadata";
Store.EVENT_DONE_ADD_CONTENT = "done_add_content";
Store.EVENT_DONE_GET_CONTENT = "done_get_content";
Store.EVENT_DONE_GET_VIRTUAL_DISPLAY = "done_get_virtual_display";
Store.EVENT_DONE_UPDATE_VIRTUAL_DISPLAY = "done_update_virtual_display";
Store.EVENT_DONE_GET_GROUP_LIST = "done_get_group_list";
Store.EVENT_DONE_GET_METADATA = "done_get_metadata";
Store.EVENT_DONE_GET_WINDOW_METADATA = "done_get_window_metadata";
Store.EVENT_DONE_RESTORE_CONTENT = "done_restore_content";
Store.EVENT_DONE_RESTORE_HISTORY_CONTENT = "done_restore_history_content";

// login_store
Store.EVENT_LOGIN_SUCCESS = "login_success";
Store.EVENT_LOGIN_FAILED = "login_failed";

// management_store
Store.EVENT_DBLIST_RELOADED = "dblist_reloaded";
Store.EVENT_AUTHORITY_CHANGED = "authority_changed";
Store.EVENT_PASSWORD_CHANGED = "password_changed";
Store.EVENT_GLOBAL_SETTING_RELOADED = "global_setting_reloaded";
Store.EVENT_GLOBAL_SETTING_CHANGED = "global_setting_changed";

// content_store
Store.EVENT_DONE_UPDATE_CONTENT = "done_update_content";
Store.EVENT_SELECT_CONTENT = "select_content";
Store.EVENT_UNSELECT_CONTENT = "unselect_content";
Store.EVENT_CONTENT_INDEX_CHANGED = "content_index_changed";
Store.EVENT_CONTENT_TRANSFORM_CHANGED = "content_transform_changed";
Store.EVENT_CONTENT_METAINFO_CHANGED = "content_metainfo_changed";
Store.EVENT_SETUP_CONTENT_ELEMENT = "setup_content_element";
Store.EVENT_TOGGLE_CONTENT_MARK_ICON = "setup_toggle_content_mark_icon";
Store.EVENT_DONE_SNAP_CONTENT_TO_SCREEN = "done_snap_content_to_screen";
Store.EVENT_DONE_DELETE_CONTENT = "done_delete_content";
Store.EVENT_CONTENT_VISIBLE_CHANGED = "content_visible_changed";
Store.EVENT_CONTENT_DISPLAY_TIME_CHANGED = "content_display_time_changed";

// display_store
Store.EVENT_DISPLAY_SCALE_CHANGING = "display_scale_changing";
Store.EVENT_DISPLAY_SCALE_CHANGED = "display_scale_changed";
Store.EVENT_DONE_DISPLAY_TRANS = "done_display_trans";
Store.EVENT_DONE_DELETE_DISPLAY = "done_delete_display";
Store.EVENT_DONE_SHOW_DISPLAY_ID = "done_show_display_id";
Store.EVENT_DONE_RELOAD_DISPLAY = "done_reload_display";
Store.EVENT_DONE_UPDATE_WINDOW_METADATA = "done_update_window_metadata";
Store.EVENT_DISPLAY_PROPERTY_CHANGED = "display_property_changed"
Store.EVENT_DISPLAY_SPLIT_CHANGED = "display_split_changed";
Store.EVENT_CHANGE_DISPLAY_VISIBLE = "change_display_visible";
Store.EVENT_DISPLAY_VISIBLE_CHANGED = "display_visible_changed";

// group_store
Store.EVENT_GROUP_ADDED = "group_added";
Store.EVENT_TAB_CHANGED_PRE = "tab_change_pre";
Store.EVENT_TAB_CHANGED_POST = "tab_change_post";
Store.EVENT_GROUP_SELECT_CHANGED = "group_select_changed";
Store.EVENT_DISPLAY_GROUP_SELECT_CHANGED = "display_group_select_changed";

// reviever
Store.EVENT_DONE_DELETE_WINDOW_METADATA = "done_delete_window_metadata";
Store.EVENT_DONE_UPDATE_GROUP = "done_update_group";
Store.EVENT_DONE_UPDATE_SETTING = "done_update_setting";
Store.EVENT_NEED_UPDATE_MANIPULATOR = "need_update_manipulator";
Store.EVENT_ITOWNS_UPDATE_TIME = "itowns_update_time";
Store.EVENT_TILEVIEWER_UPDATE_TIME = "tileviewer_update_time";

export default Store;