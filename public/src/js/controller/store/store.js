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

class Store extends EventEmitter
{
	constructor(state, action, cookie)
	{
		super();

		this.state = state;
		this.action = action;
		this.cookie = cookie;

		this.controllerData = new ControllerData();

		this.isInitialized_ = false;
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

		this.initEvents();

		this.on(Store.EVENT_LOGIN_SUCCESS, (err, data) => {
			// management新規作成
			let userList = this.loginStore.getUserList();
			this.managementStore = new ManagementStore(Connector, state, this, action);
			this.managementStore.userList = userList;
			this.managementStore.authority = data.authority;
		});
		this.on(Store.EVENT_LOGIN_FAILED, () => {
			// management新規作成
			this.managementStore = new ManagementStore(Connector, state, this, action);
			this.managementStore.userList = null;
			this.managementStore.authority = null;
		});

		// controllerデータの何かが更新されたときにサーバーに保存する処理
		this.controllerData.on(ControllerData.EVENT_UPDATE, (err, data) => {
			let controllerData = {
				controllerID : this.getLoginStore().getControllerID(),
				controllerData : data
			};
			this.operation.updateControllerData(controllerData);
		});
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

	/**
	 * 解放処理
	 */
	release() {
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
		if (this.videoStore.release) {
			this.videoStore.release();
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
		let isDisconnect = false;
		let reconnect = () => {
			let client;
			Connector.on("Disconnect", (function (client) {
				return function () {
					isDisconnect = true;
					client.close();
				};
			}(client)));
		
			client = Connector.connect(() => {
				if (isDisconnect) {
					location.reload();
					return;
				}
				// 接続確率した
				this.emit(Store.EVENT_CONNECT_SUCCESS, null);

			}, () => {
				// 接続失敗
				this.emit(Store.EVENT_CONNECT_FAILED, null);
				// 再ログイン
				if (!isDisconnect) {
					isDisconnect = true;
					setTimeout(function () {
						reconnect();
					}, Constants.ReconnectTimeout);
				}
			});
		};
		reconnect();
	}

	/**
	 * 全てのコンテンツ、ディスプレイなどを取得.
	 */
	_getAll(data) {
		let callback;
		if (data && data.hasOwnProperty('callback')) {
			callback = data.callback;
			delete data.callback;
		}
		this.operation.update(callback);
	}

	/**
	 * 全てのコンテンツ、ディスプレイなどを取得し、グループを含めて全てリロード
	 */
	_reloadAll(data) {
		this._getAll({
			callback : (err, data) => {
				this.emit(Store.EVENT_DONE_RELOAD_ALL, null);
			}
		});

		this.getGroupStore()._getGroupList(() => {
			
		});
		
		setTimeout(() => {
			Translation.changeLanguage(this.cookie.getLanguage());
			Translation.translate();
		}, 100);
	}

	/**
	 * タブの変更
	 */
	_changeTab(data) {
		if (data.isBefore) {
			this.emit(Store.EVENT_TAB_CHANGED_PRE, null, data.data);
		} else {
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
		this.getControllerData().setUpdateCursorEnable(data.isEnable);
		if (!data.isEnable) {
			Connector.send('UpdateMouseCursor', {}, (err, reply) => { });
		} else {
			if (data.hasOwnProperty('rgb')) {
				this.getControllerData().setCursorColor(data.rgb);
			}
			let metaData = data;
			delete metaData.isEnable;
			metaData.controllerID = this.getLoginStore().getControllerID();
			metaData.rgb = this.getControllerData().getCursorColor();
			Connector.send('UpdateMouseCursor', metaData, (err, reply) => { });
		}
	}

	/**
	 * 全video巻き戻し
	 * @param {*} data 
	 */
	_rewindAllVideo(data) {
		let groupID = this.getGroupStore().getCurrentGroupID();
		let sendIds = [];
		this.for_each_metadata((id, metaData) => {
			if (Validator.isContentType(metaData) || Validator.isLayoutType(metaData)) {
				if (
					(metaData.group === groupID) &&
					(metaData.type === 'video')
				) {
					sendIds.push(metaData.id);
				}
			}
		});

		if (sendIds.length !== 0) {
			Connector.send('SendMessage', {ids: sendIds, command: 'rewindVideo'}, (err, reply) => {
				// do nothing
			});
		}
	}
	
	/**
	 * 全video再生
	 * @param {*} data 
	 */
	_playAllVideo(data) {
		let groupID = this.getGroupStore().getCurrentGroupID();
		let sendIds = [];
		store.for_each_metadata((id, metaData) => {
			if (Validator.isContentType(metaData) || Validator.isLayoutType(metaData)) {
				if (
					(metaData.group === groupID) &&
					(metaData.type === 'video')
				) {
					sendIds.push(metaData.id);
				}
			}
		});

		if (sendIds.length !== 0) {
			Connector.send('SendMessage', {ids: sendIds, command: 'playVideo', play: play}, (err, reply) => {
				// do nothing
			});
		}
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
	getZIndex(metaData, isFront) {
		let max = 0,
			min = 0;

		this.for_each_metadata(function (i, meta) {
			if (meta.id !== metaData.id && 
				Validator.isContentType(meta) &&
				meta.hasOwnProperty("zIndex")) {
				max = Math.max(max, parseInt(meta.zIndex, 10));
				min = Math.min(min, parseInt(meta.zIndex, 10));
			}
		});
		if (isFront) {
			return max + 1;
		} else {
			return min - 1;
		}
	}
}

Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_CONNECT_FAILED = "connect_failed";

Store.EVENT_SNAP_TYPE_CHANGED = "snap_type_changed";
Store.EVENT_USERLIST_RELOADED = "user_list_reloaded";
Store.EVENT_SEARCH_INPUT_CHANGED = "search_input_changed";
Store.EVENT_DONE_RELOAD_ALL = "done_reload_all";


// operation
Store.EVENT_DONE_UPDATE_METADATA = "done_update_metadata";
Store.EVENT_DONE_ADD_CONTENT = "done_add_content";
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

// display_store
Store.EVENT_DISPLAY_SCALE_CHANGING = "display_scale_changing";
Store.EVENT_DISPLAY_SCALE_CHANGED  = "display_scale_changed";
Store.EVENT_DONE_DISPLAY_TRANS = "done_display_trans";
Store.EVENT_DONE_DELETE_DISPLAY = "done_delete_display";
Store.EVENT_DONE_SHOW_DISPLAY_ID = "done_show_display_id";
Store.EVENT_DONE_UPDATE_WINDOW_METADATA = "done_update_window_metadata";
Store.EVENT_DISPLAY_PROPERTY_CHANGED = "display_property_changed"
Store.EVENT_DISPLAY_SPLIT_CHANGED = "display_split_changed";
Store.EVENT_CHANGE_DISPLAY_VISIBLE = "change_display_visible";

// group_store
Store.EVENT_GROUP_ADDED = "group_added";
Store.EVENT_TAB_CHANGED_PRE = "tab_change_pre";
Store.EVENT_TAB_CHANGED_POST = "tab_change_post";
Store.EVENT_GROUP_SELECT_CHANGED = "group_select_changed";

export default Store;

