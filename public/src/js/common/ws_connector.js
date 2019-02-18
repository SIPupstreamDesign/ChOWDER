/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

'use strict';

import Command from './command.js';
import MetaBinary from './metabinary.js'

function get_protocol() {
	let u = document.URL;
	if (u.substring(0, 5) == "https") {
		return "wss://";
	} else {
		return "ws://";
	}
}

let resultCallbacks = {},
	recievers = {},
	messageID = 1,
	client = null,
	is_connected = false,
	currentVersion = "v2",
	url = get_protocol() + location.hostname + ":" + (Number(location.port) + 1) + "/" + currentVersion + "/";

class WsConnector {

	/**
	 * テキストメッセージの処理.
	 * @method eventTextMessage
	 * @param {JSON} metaData メタデータ
	 */
	static eventTextMessage(metaData) {
		if (metaData.to === "client") {
			// masterからメッセージがきた
			if (recievers.hasOwnProperty(metaData.method)) {
				recievers[metaData.method](metaData.params);
			}
		} else {
			// clientからmasterに送ったメッセージが返ってきた
			if (metaData.error) {
				if (resultCallbacks[metaData.id]) {
					resultCallbacks[metaData.id](metaData.error, null);
				}
			} else if (metaData.hasOwnProperty('id') && metaData.hasOwnProperty('result')) {
				if (resultCallbacks[metaData.id]) {
					resultCallbacks[metaData.id](null, metaData.result);
				} else {
					console.error("[Error] not found :", metaData)
				}
			} else {
				if (metaData.hasOwnProperty('id') && resultCallbacks.hasOwnProperty(metaData.id)) {
					resultCallbacks[metaData.id](null);
				} else {
					console.error('[Error] ArgumentError in connector.js', metaData);
					if (metaData.hasOwnProperty('id')) {
						resultCallbacks[metaData.id]('ArgumentError', null);
					}
				}
			}
		}
	}

	/**
	 * バイナリメッセージの処理.
	 * @method eventBinaryMessage
	 * @param {JSON} metaData メタデータ
	 * @param {Blob} contentData バイナリデータ
	 */
	static eventBinaryMessage(metaData, contentData) {
		// console.log(metaData);
		let data;
		if (metaData.to === "client") {
			// masterからメッセージがきた
			data = {
				metaData : metaData.params,
				contentData : contentData
			};
			if (recievers.hasOwnProperty(metaData.method)) {
				recievers[metaData.method](data);
			}
		} else {
			data = {
				metaData : metaData.result,
				contentData : contentData
			};
			// clientからmasterに送ったメッセージが返ってきた
			if (metaData.error) {
				if (resultCallbacks[metaData.id]) {
					resultCallbacks[metaData.id](metaData.error, null);
				}
			} else if (metaData.id) {
				if (resultCallbacks[metaData.id]) {
					resultCallbacks[metaData.id](null, data);
				}
			} else {
				console.error('[Error] ArgumentError in connector.js');
				if (metaData.id && resultCallbacks[metaData.id]) {
					resultCallbacks[metaData.id]('ArgumentError', null);
				}
			}
		}
	}

	static sendWrapper(id, method, reqdata, resultCallback) {
		if (Command.hasOwnProperty(method)) {
			resultCallbacks[id] = resultCallback;

			// console.log('[Info] chowder_request', reqdata);
			//socket.emit('chowder_request', reqdata);
			client.send(reqdata);
		} else {
			// console.log('[Error] Not found the method in connector: ', method);
		}
	}

	/**
	 * テキストメッセージをサーバへ送信する
	 * @method send
	 * @param {String} method メソッド JSONRPCメソッド
	 * @param {JSON} args パラメータ
	 * @param {Function} resultCallback サーバから返信があった場合に呼ばれる. resultCallback(err, res)の形式.
	 */
	static send(method, args, resultCallback) {
		if (client && client.readyState !== 1) {
			console.error("client.readyState", client.readyState);
			resultCallback(-1, null);
			return;
		}
		let reqjson = {
			jsonrpc: '2.0',
			type : 'utf8',
			id: messageID,
			method: method,
			params: args,
			to: 'master'
		}, data;

		messageID = messageID + 1;
		try {
			data = JSON.stringify(reqjson);
			WsConnector.sendWrapper(reqjson.id, reqjson.method, data, resultCallback);
		} catch (e) {
			console.error(e);
		}
	}

	/**
	 * バイナリメッセージをサーバへ送信する
	 * @method sendBinary
	 * @param {String} method メソッド JSONRPCメソッド
	 * @param {ArrayBuffer} binary バイナリデータ
	 * @param {Function} resultCallback サーバから返信があった場合に呼ばれる. resultCallback(err, res)の形式.
	 */
	static sendBinary(method, metaData, binary, resultCallback) {
		if (client && client.readyState !== 1) {
			console.error("client.readyState", client.readyState);
			resultCallback(-1, null);
			return;
		}
		let data = {
			jsonrpc: '2.0',
			type : 'binary',
			id: messageID,
			method: method,
			params: metaData,
			to: 'master'
		}, metabin;

		messageID = messageID + 1;

		try {
			//console.log(data, binary);
			metabin = MetaBinary.createMetaBinary(data, binary);
			//console.log(metabin);
			//data = JSON.stringify(reqjson);
			WsConnector.sendWrapper(data.id, data.method, metabin, resultCallback);
		} catch (e) {
			console.error(e);
		}
	}

	/**
	 * コールバックの登録.
	 * @method on
	 * @param {String} method JSONRPCメソッド
	 * @param {Function} callback サーバからメッセージを受け取った場合に呼ばれる. callback(err, res)の形式.
	 */
	static on(method, callback) {
		recievers[method] = callback;
	}

	/**
	 * websocketで接続する.
	 * @method connect
	 * @param {Function} onopen 開始時コールバック
	 * @param {Function} onclose クローズ時コールバック
	 */
	static connect(onopen, onclose) {
		client = new WebSocket(url);
		/**
		 * View側Window[Display]登録、サーバーにWindow登録通知
		 * @method onopen
		 */
		client.onopen = function () {
			if (onopen) {
				// console.log("onopen");
				onopen();
			}
			is_connected = true;
		};

		client.onclose = function (ev) {
			if (onclose) {
				onclose(ev);
			}
			is_connected = false;
		};

		client.onmessage = function (message) {
			console.log("ws chowder_request : ", message);
			let data = message.data,
				parsed,
				result;

			if (typeof data === "string") {
				try {
					parsed = JSON.parse(data);
					WsConnector.eventTextMessage(parsed);
				} catch (e) {
					console.error("failed to parse json : ", e);
				}
			} else {
				// console.log("load meta binary", data);
				MetaBinary.loadMetaBinary(data, function (metaData, contentData) {
					WsConnector.eventBinaryMessage(metaData, contentData);
				});
			}
		};
		return client;
	}

	static close () {
		if (client) {
			client.close();
		}
	}

	static isConnected() { return is_connected; }

	static setURL(wsurl) {
		if (wsurl[wsurl.length - 1] !== '/') {
			wsurl = wsurl + '/';
		}
		wsurl = wsurl + currentVersion + "/";
		url = wsurl;
	};

	static getURL() {
		return url;
	};
}

export default WsConnector;
