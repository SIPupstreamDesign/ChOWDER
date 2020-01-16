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
    setDisplayIndexes(data) {        
        this.emit(Action.EVENT_SET_DISPLAY_INDEXES, null, data);
    }
}

Action.EVENT_CONNECT = "connect";
Action.EVENT_GET_VIRTUAL_DISPLAY="getVirtualDisplay";
Action.EVENT_SET_DISPLAY_INDEXES="setDisplayIndexes";

export default Action;