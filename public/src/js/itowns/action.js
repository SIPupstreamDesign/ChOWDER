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
     * カメラの更新
     * @param {*} data 
     * {
     *    mat : カメラのワールドマトリックス,
     *    params : カメラのパラメータ(fovy, zoom, near, far, aspect, filmGauge, filmOffset)
     * }
     */
    updateCamera(data) {
        this.emit(Action.EVENT_UPDATE_CAMERA, null, data);
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
        this.emit(Action.EVENT_CONNECT_IFRAME, null, data);
    }

    /**
     * コンテンツ情報を取得
     */
    fetchContents(data) {
        this.emit(Action.EVENT_FETCH_CONTENTS, null, data);
    }

    /**
     * (プリセットをもとに作られた)ユーザーデータを読み込み
     */
    loadUserData(data) {
        this.emit(Action.EVENT_LOAD_USER_DATA, null, data);
    }

    /**
     * コンテンツに対する時刻の変更
     * @param data
     * {
     *    time : 時刻を表すDateインスタンス
     * }
     */
    changeTime(data) {
        this.emit(Action.EVENT_CHANGE_TIME, null, data);
    }
    
    /**
     * コンテンツに対する時刻の変更(GUIを使用して変更した場合)
     * 同時に複数のパラメータが変化したりする
     * @param data
     * {
     *    currentTime: new Date(pTimeInfo.currentTime),
     *    startTime: new Date(pTimeInfo.startTime),
     *    endTime: new Date(pTimeInfo.endTime)
     * }
     */
    changeTimeByTimeline(data) {
        this.emit(Action.EVENT_CHANGE_TIME_BY_TIMELINE, null, data);
    }

    /**
     * パフォーマンス計測命令の発行
     */
    measurePerformance(data) {
        this.emit(Action.EVENT_MEASURE_PERFORMANCE, null, data);
    }

    /**
     * タイムラインのレンジ(start, end)を変更
     * @param {*} data 
     * {
     *   start: Date,
     *   end : Date
     * }
     */
    changeTimelineRange(data) {
        this.emit(Action.EVENT_CHANGE_TIMELINE_RANGE, null, data);
    }

    /**
     * タイムラインのレンジバー(rangeStartTime, rangeEndTime)を変更
     * @param {*} data 
     * {
     *   rangeStartTime: Date,
     *   rangeEndTime : Date
     * }
     * または {} (レンジバー非表示の場合)
     */
    changeTimelineRangeBar(data) {
        this.emit(Action.EVENT_CHANGE_TIMELINE_RANGE_BAR, null, data);
    }


    /**
     * タイムラインの同期設定の変更
     * @param {*} data 
     * {
     *    "sync" : true または false
     * }
     */
    changeTimelineSync(data) {
        this.emit(Action.EVENT_CHANGE_TIMELINE_SYNC, null, data);
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
Action.EVENT_UPDATE_CAMERA = "updateCamera";
Action.EVENT_CHANGE_LAYER_PROPERTY = "changeLayerProperty";
Action.EVENT_FETCH_CONTENTS = "fetchContents";
Action.EVENT_LOAD_USER_DATA = "loadUserData";
Action.EVENT_CHANGE_TIME = "changeTime";
Action.EVENT_CHANGE_TIME_BY_TIMELINE = "changeTimeByTimeline";
Action.EVENT_CHANGE_TIMELINE_RANGE = "changeTimelineRange";
Action.EVENT_CHANGE_TIMELINE_RANGE_BAR = "changeTimelineRangeBar";
Action.EVENT_MEASURE_PERFORMANCE = "measurePerformance";
Action.EVENT_CHANGE_TIMELINE_SYNC = "changeTimelineSync";
export default Action;
