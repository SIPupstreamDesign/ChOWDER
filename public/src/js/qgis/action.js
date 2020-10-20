/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

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
		console.log("[action]:connectIFrame");
		this.emit(Action.EVENT_CONNECT_IFRAME, null, data);
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
		console.log("[action]addContent");
        this.emit(Action.EVENT_ADD_CONTENT, null, data);
	}
}

Action.EVENT_CONNECT = "connect";
Action.EVENT_ADD_CONTENT = "addContent";
Action.EVENT_CONNECT_IFRAME = "connectIFrame";
Action.EVENT_LOGIN = "login";
Action.EVENT_RESIZE_WINDOW = "resizeWindow";
export default Action;
