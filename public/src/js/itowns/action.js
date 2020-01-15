/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

class Action extends EventEmitter
{
    constructor()
    {
        super();
    }
    
	// デバッグ用. release版作るときは消す
	emit() {
		if (arguments.length > 0) {
			if (!arguments[0]) {
				console.error("Not found EVENT NAME!");
			}
		}
		super.emit(...arguments);
    }

    /**
     * websocket接続
     * @param {*} data
     */
    connect(data) {
        this.emit(Action.EVENT_CONNECT, null, data);
    }
    
    /**
     * ログイン
     * @param {*} data
     * {
     *  userList : userList,
     *  userid : "",
     *  password : "",
     *  key : loginkey,
     * }
     */
    login(data) {
        this.emit(Action.EVENT_LOGIN, null, data);
    }

    /**
     * windowのリサイズ.
     * サーバに保存されている現在のdisplayサイズを更新する
     * @param {*} data
     * {
     *    size : { w : , h : }
     * }
     */
    resizeWindow(data) {
        this.emit(Action.EVENT_RESIZE_WINDOW, null, data);
    }

    /**
     * コンテンツの追加
     * @param {*} data 
     */
    addContent(data) {
        this.emit(Action.EVENT_ADD_CONTENT, null, data);
    }
    
    /**
     * カメラのワールドマトリックスの更新
     * @param {*} data 
     */
    updateCameraWorldMatrix(data) {
        this.emit(Action.EVENT_UPDATE_CAMERA_WORLD_MATRIX, null, data);
    }

    /**
     * 地図の追加
     * @param {*} data 
     */
    addMap(data) {
        this.emit(Action.EVENT_ADD_MAP, null, data);
    }

    /**
     * 地図の削除
     * @param {*} data 
     */
    deleteMap(data) {
        this.emit(Action.EVENT_DELETE_MAP, null, data);
    }

    /**
     * 地図順序変更
     * @param {*} data 
     */
    changeMapOrder(data) {
        this.emit(Action.EVENT_CHANGE_MAP_ORDER, null, data);
    }
}

Action.EVENT_CONNECT = "connect";
Action.EVENT_LOGIN = "login";
Action.EVENT_LOGOUT = "logout";
Action.EVENT_RESIZE_WINDOW = "resizeWindow";
Action.EVENT_ADD_CONTENT = "addContent";
Action.EVENT_ADD_MAP = "addMap";
Action.EVENT_DELETE_MAP = "deleteMap";
Action.EVENT_CHANGE_MAP_ORDER = "changeMapOrder";
Action.EVENT_UPDATE_CAMERA_WORLD_MATRIX = "updateCameraWorldMatrix";
export default Action;
