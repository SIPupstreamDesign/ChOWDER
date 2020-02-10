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
     * 現在登録されているディスプレイのうち、メタデータに'marker_id'を持っているディスプレイを取得する.
     * 取得すると, Store.EVENT_DONE_GET_CURRENT_DISPLAY_MARKERイベントで取得したmarker_idが投げられる.
     * @param {*} data 
     */
    getCurrentDisplayMarkers(data) {
        this.emit(Action.EVENT_GET_CURRENT_DISPLAY_MARKERS, null, data);
    }
    getVirtualDisplay(data) {
        this.emit(Action.EVENT_GET_VIRTUAL_DISPLAY, null, data);
    }
    getDataList(data){   
        this.emit(Action.EVENT_GET_DATA_LIST, null, data);    
    }
    storeScannedData(data) {
        console.log(this);        
        this.emit(Action.EVENT_STORE_SCANNED_DATA, null, data);
    }
    setDataList(data) {        
        this.emit(Action.EVENT_SET_DATA_LIST, null, data);
    }
    sendData(data){
        this.emit(Action.EVENT_SET_SEND_DATA, null, data);    
    }
    deleteDataList(){
        this.emit(Action.EVENT_DELETE_DATA_LIST, null, null);    
    }
    
}

Action.EVENT_CONNECT = "connect";
Action.EVENT_GET_CURRENT_DISPLAY_MARKERS = "getCurrentDisplayMarkers";
Action.EVENT_GET_VIRTUAL_DISPLAY="getVirtualDisplay";
Action.EVENT_GET_DATA_LIST="getDataList";
Action.EVENT_CALC_ABSOLUTE_POSITION="calcAbsolutePosition";
Action.EVENT_STORE_SCANNED_DATA="storeScannedData";
Action.EVENT_SET_DATA_LIST="setDataList";
Action.EVENT_SET_SEND_DATA="sendData";
Action.EVENT_DELETE_DATA_LIST="deletedataList";
export default Action;