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
     * ログアウト
     * @param {*} data
     */
    logout(data) {
        this.emit(Action.EVENT_LOGOUT, null, data);
    }

    /**
     * ユーザリストの再読み込み
     * @param {*} data
     */
    reloadUserList(data) {
        this.emit(Action.EVENT_RELOAD_USERLIST, null, data);
    }

    /**
     * 指定した種類のデータをサーバから取得し更新
     * @param {*} data
     * {
     *     updateType : 'all' or 'window' or 'group' or 'content',
     *     targetID : 対象のコンテンツID. 一つのコンテンツだけ更新したい場合に入れる
     * }
     */
    update(data) {
        this.emit(Action.EVENT_UPDATE, null, data);
    }

    /**
     * DisplayIDの変更
     * @param {*} data
     * {
     *    id : DisplayID
     * }
     */
    changeDisplayID(data) {
        this.emit(Action.EVENT_CHANGE_DISPLAY_ID, null, data);
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
     * ページに読み込み済コンテンツの全削除. サーバー側のDBからは消さない.
     * @param {*} data
     */
    deleteAllElements(data) {
        this.emit(Action.EVENT_DELETE_ALL_ELEMENTS, null, data);
    }

    /**
     * URLのクエリーの値を変更
     * @param {*} data クエリーのマップ ( { id : aa, .. })
     */
    changeQueryParam(data) {
        this.emit(Action.EVENT_CHANGE_QUERY_PARAM, null, data);
    }

    /**
     * displayの登録
     * @param {*} data
     */
    registerWindow(data) {
        this.emit(Action.EVENT_REGISTER_WINDOW, null, data);
    }

    /**
     * コンテンツのZインデックスを一番手前にする
     * @param {*} data
     * {
	 *    targetID : 対象のコンテンツのID
     * }
     */
    changeContentIndexToFront(data) {
        this.emit(Action.EVENT_CHANGE_CONTENT_INDEX_TO_FRONT, null, data);
    }

    /**
     * コンテンツのTransformを変更
     * @param {*} data
     * {
	 *    targetID : 対象のコンテンツのID
     *    x : x座標
     *    y : y座標
     * }
     */
    changeContentTransform(data) {
        this.emit(Action.EVENT_CHANGE_CONTENT_TRANSFORM, null, data);
    }

    /**
     * webRTC開始リクエストを送る
     * @param {*} data
     * {
     *   metaData: metaData,
     *   request : "{ key : リクエストキー }" (リクエスト文字列).
     *   element : 表示対象エレメント
     * }
     */
    requestWebRTC(data) {
        this.emit(Action.EVENT_REQUEST_WEBRTC, null, data);
    }

    /**
     * タイルコンテンツの取得
     * @param {*} data
     * {
     *   request : "{ tile_index : タイル番号 }"
     * }
     */
    getTileContent(data) {
        this.emit(Action.EVENT_GET_TILE_CONTENT, null, data);
    }

    /**
     * インラインフレームで開いたitownと通信するための関数を、コンテンツごとに登録
     * @param {*} data
     * {
     *   id : metaData.id,
     *   func : { hogeFunc : () => {}, .. }
     * }
     */
    addItownFunc(data) {
        this.emit(Action.EVENT_ADD_ITOWN_FUNC, null, data);
    }

    updateQgisMetadata(metaData){
        this.emit(Action.EVENT_UPDATE_QGIS_METADATA, null, metaData);
    }

}

Action.EVENT_CONNECT = "connect";
Action.EVENT_LOGIN = "login";
Action.EVENT_LOGOUT = "logout";
Action.EVENT_RELOAD_USERLIST = "reloadUserList";
Action.EVENT_CHANGE_DISPLAY_ID = "changeDisplayID";
Action.EVENT_RESIZE_WINDOW = "resizeWindow";
Action.EVENT_DELETE_ALL_ELEMENTS = "deleteAllElements";
Action.EVENT_CHANGE_QUERY_PARAM = "changeQueryParam";
Action.EVENT_REGISTER_WINDOW = "registerWindow";
Action.EVENT_UPDATE = "update";
Action.EVENT_CHANGE_CONTENT_INDEX_TO_FRONT = "changeContentIndexToFront";
Action.EVENT_CHANGE_CONTENT_TRANSFORM = "changeContentTransform";
Action.EVENT_REQUEST_WEBRTC = "requestWebRTC";
Action.EVENT_GET_TILE_CONTENT = "getTileContent";
Action.EVENT_ADD_ITOWN_FUNC = "addItownFunc";
Action.EVENT_UPDATE_QGIS_METADATA = "updateQgisMetadata";
export default Action;