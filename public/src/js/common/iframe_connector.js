/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

'use strict';

import ITownsCommand from './itowns_command.js';

let messageID = 1;

class IFrameConnector extends EventEmitter
{
    constructor(iframe_) {
        super();
        this.iframe = iframe_;
        this.contentWindow = iframe_.contentWindow;
        this.resultCallbacks = {};

        this.messageCallback = (evt) => {
            try {
                let data = JSON.parse(evt.data);

                this.eventTextMessage(data);
            }
            catch (e) {
                console.error(e);
            }
        };
    }

	/**
	 * テキストメッセージの処理.
	 * @method eventTextMessage
	 * @param {JSON} metaData メタデータ
	 */
	eventTextMessage(metaData) {
		if (metaData.to === "parent") {
            // iframeからメッセージがきた
            this.emit(metaData.method, null, metaData.params);
		} else {
			// parentからiframeに送ったメッセージが返ってきた
			if (metaData.hasOwnProperty("error")) {
				if (this.resultCallbacks[metaData.id]) {
					this.resultCallbacks[metaData.id](metaData.error, null);
				}
			} else if (metaData.hasOwnProperty('id') && metaData.hasOwnProperty('result')) {
				if (this.resultCallbacks[metaData.id]) {
					this.resultCallbacks[metaData.id](null, metaData.result);
				} else {
					console.error("[Error] not found :", metaData)
				}
			} else {
				if (metaData.hasOwnProperty('id') && this.resultCallbacks.hasOwnProperty(metaData.id)) {
					this.resultCallbacks[metaData.id](null);
				} else {
					console.error('[Error] ArgumentError in connector.js', metaData);
					if (metaData.hasOwnProperty('id')) {
						this.resultCallbacks[metaData.id]('ArgumentError', null);
					}
				}
			}
		}
	}

	sendWrapper(id, method, reqdata, resultCallback) {
		if (ITownsCommand.hasOwnProperty(method)) {
			this.resultCallbacks[id] = resultCallback;

			this.contentWindow.postMessage(reqdata);
		} else {
			console.error('[Error] Not found the method: ', method);
		}
    }
    
	/**
	 * テキストメッセージをiframeへ送信する
	 * @method send
	 * @param {String} method メソッド JSONRPCメソッド
	 * @param {JSON} args パラメータ
	 * @param {Function} resultCallback iframeから返信があった場合に呼ばれる. resultCallback(err, res)の形式.
	 */
	send(method, args, resultCallback) {
		let reqjson = {
			jsonrpc: '2.0',
			type : 'utf8',
			id: messageID,
			method: method,
			params: args,
			to: 'iframe'
		}, data;

		messageID = messageID + 1;
		try {
			data = JSON.stringify(reqjson);
			this.sendWrapper(reqjson.id, reqjson.method, data, resultCallback);
		} catch (e) {
			console.error(e);
		}
	}

	/**
	 * websocketで接続する.
	 * @method connect
	 * @param {Function} onopen 開始時コールバック
	 * @param {Function} onclose クローズ時コールバック
	 */
	connect(onopen, onclose) {
        window.removeEventListener("message", this.messageCallback);
        window.addEventListener("message", this.messageCallback);
        
        // iframe内のchowder injectionの初期化
        this.send(ITownsCommand.Init, {}, onopen);
    }
}

export default IFrameConnector;