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
     * レイヤーの追加
     * @param {*} data 
     */
    addLayer(data) {
        this.emit(Action.EVENT_ADD_LAYER, null, data);
    }

    /**
     * レイヤーの削除
     * @param {*} data 
     */
    deleteLayer(data) {
        this.emit(Action.EVENT_DELETE_LAYER, null, data);
    }

    /**
     * レイヤー順序変更
     * @param {*} data 
     */
    changeLayerOrder(data) {
        this.emit(Action.EVENT_CHANGE_LAYER_ORDER, null, data);
    }

    /**
     * レイヤープロパティ変更
     * @param {*} data 
     */
    changeLayerProperty(data) {
        this.emit(Action.EVENT_CHANGE_LAYER_PROPERTY, null, data);
    }

    /**
     * iframeと通信開始
     * @param {*} data iframe
     */
    connectIFrame(data) {
        console.error("connectIFrame")
        this.emit(Action.EVENT_CONNECT_IFRAME, null, data);
    }
}

Action.EVENT_CONNECT = "connect";
Action.EVENT_CONNECT_IFRAME = "connectIFrame";
Action.EVENT_LOGIN = "login";
Action.EVENT_LOGOUT = "logout";
Action.EVENT_RESIZE_WINDOW = "resizeWindow";
Action.EVENT_ADD_CONTENT = "addContent";
Action.EVENT_ADD_LAYER = "addLayer";
Action.EVENT_DELETE_LAYER = "deleteLayer";
Action.EVENT_CHANGE_LAYER_ORDER = "changeLayerOrder";
Action.EVENT_UPDATE_CAMERA_WORLD_MATRIX = "updateCameraWorldMatrix";
Action.EVENT_CHANGE_LAYER_PROPERTY = "changeLayerProperty";
export default Action;
