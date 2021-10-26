/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

class Action extends EventEmitter {
    constructor() {
        super();
    }

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
     * iframeと通信開始
     * @param {*} data iframe
     */
    connectIFrame(data) {
        // console.log("[action]:connectIFrame");
        this.emit(Action.EVENT_CONNECT_IFRAME, null, data);
    }

    /**
     * コンテンツの追加
     * @param {*} data 
     */
    addContent(data) {
        this.emit(Action.EVENT_ADD_CONTENT, null, data);
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
     * コンテンツのリサイズ
     * @param {*} data
     * {
     *    size : { width : , height : }
     * }
     */
    resizeContent(data) {
        this.emit(Action.EVENT_RESIZE_CONTENT, null, data);
    }

    /**
     * カメラの更新
     * @param {*} data 
     * {
     *    params : カメラのパラメータ
     * }
     */
    updateCamera(data) {
        this.emit(Action.EVENT_UPDATE_CAMERA, null, data);
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
     * レイヤーの追加
     * @param {*} data 
     */
    addLayer(data) {
        this.emit(Action.EVENT_ADD_LAYER, null, data);
    }

    /**
     * レイヤーの選択
     * @param {*} data 
     */
    selectLayer(data) {
        this.emit(Action.EVENT_SELECT_LAYER, null, data);
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
     * (iframe内の)カメラパラメータを, TileViewerAppから変更
     * @param {*} data 
     */
    changeCameraParams(data) {
        this.emit(Action.EVENT_CHANGE_CAMERA_PARAMS, null, data);
    }

    /**
     * コンテンツに対する時刻の変更
     * @param data
     * {
     *    currentTime : 時刻を表すDateインスタンス
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

    /**
     * "Zoom Level"ラベルの表示非表示の切り替え
     * @param {*} data 
     */
    changeZoomLabelVisible(data) {
        this.emit(Action.EVENT_CHANGE_ZOOM_LABEL_VISIBLE, null, data);
    }

    /**
     * 時刻ラベルの表示非表示の切り替え
     * @param {*} data 
     */
    changeDisplayTimeVisible(data) {
        this.emit(Action.EVENT_CHANGE_DISPLAY_TIME_LABEL_VISIBLE, null, data);
    }
}

Action.EVENT_CONNECT = "connect";
Action.EVENT_ADD_CONTENT = "addContent";
Action.EVENT_CONNECT_IFRAME = "connectIFrame";
Action.EVENT_LOGIN = "login";
Action.EVENT_UPDATE_CAMERA = "updateCamera";
Action.EVENT_RESIZE_CONTENT = "resizeContent";
Action.EVENT_FETCH_CONTENTS = "fetchContents";
Action.EVENT_LOAD_USER_DATA = "loadUserData";
Action.EVENT_CHANGE_LAYER_PROPERTY = "changeLayerProperty";
Action.EVENT_CHANGE_CAMERA_PARAMS = "changeCameraParams";
Action.EVENT_ADD_LAYER = "addLayer";
Action.EVENT_SELECT_LAYER = "selectLayer";
Action.EVENT_DELETE_LAYER = "deleteLayer";
Action.EVENT_CHANGE_LAYER_ORDER = "changeLayerOrder";
Action.EVENT_CHANGE_TIME = "changeTime";
Action.EVENT_CHANGE_TIME_BY_TIMELINE = "changeTimeByTimeline";
Action.EVENT_CHANGE_TIMELINE_RANGE = "changeTimelineRange";
Action.EVENT_CHANGE_TIMELINE_RANGE_BAR = "changeTimelineRangeBar";
Action.EVENT_CHANGE_TIMELINE_SYNC = "changeTimelineSync";
Action.EVENT_CHANGE_ZOOM_LABEL_VISIBLE = "changeZoomLabelVisible";
Action.EVENT_CHANGE_DISPLAY_TIME_LABEL_VISIBLE = "changeDisplayTimeLabelVisible";

export default Action;