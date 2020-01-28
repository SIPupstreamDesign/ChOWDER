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

    getVirtualDisplay(data) {
        this.emit(Action.EVENT_GET_VIRTUAL_DISPLAY, null, data);
    }
    storeScannedData(data) {
        console.log(this);        
        this.emit(Action.EVENT_STORE_SCANNED_DATA, null, data);
    }
    setAdjacencyList(data) {        
        this.emit(Action.EVENT_SET_ADJACENCY_LIST, null, data);
    }
    sendData(data){
        this.emit(Action.EVENT_SET_SEND_DATA, null, data);    
    }
    
}

Action.EVENT_CONNECT = "connect";
Action.EVENT_GET_VIRTUAL_DISPLAY="getVirtualDisplay";
Action.EVENT_CALC_ABSOLUTE_POSITION="calcAbsolutePosition";
Action.EVENT_STORE_SCANNED_DATA="storeScannedData";
Action.EVENT_SET_ADJACENCY_LIST="setAdjacencyList";
Action.EVENT_SET_SEND_DATA="sendData";
export default Action;