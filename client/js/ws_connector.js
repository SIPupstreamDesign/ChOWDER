/*jslint devel: true, nomen: true */
/*global WebSocket, Blob */

(function (command, metabinary) {
	'use strict';
	var ws_connector = {},
		resultCallbacks = {},
		recievers = {},
		messageID = 1,
		client,
		currentVersion = "v2",
		url = "ws://" + location.hostname + ":8081/" + currentVersion + "/";

	function eventTextMessage(metaData) {
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
				resultCallbacks[metaData.id](null, metaData.result);
			} else {
				console.error('[Error] ArgumentError in connector.js');
				if (metaData.hasOwnProperty('id')) {
					resultCallbacks[metaData.id]('ArgumentError', null);
				}
			}
		}
	}
	
	function eventBinaryMessage(metaData, contentData) {
		console.log(metaData);
		var data = {
			metaData : metaData.params,
			contentData : contentData
		};
		if (metaData.to === "client") {
			// masterからメッセージがきた
			if (recievers.hasOwnProperty(metaData.method)) {
				recievers[metaData.method](data);
			}
		} else {
			// clientからmasterに送ったメッセージが返ってきた
			if (metaData.error) {
				if (resultCallbacks[metaData.id]) {
					resultCallbacks[metaData.id](metaData.error, null);
				}
			} else if (metaData.id && contentData) {
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
	function connect(onopen, onclose) {
		client = new WebSocket(url);
		/**
		 * View側Window[Display]登録、サーバーにWindow登録通知
		 * @method onopen
		 */
		client.onopen = function () {
			client.send("view");
			if (onopen) {
				console.log("onopen");
				onopen();
			}
		};
	
		/**
		 * close
		 * @method onclose
		 */
		client.onclose = onclose;
		
		/**
		 * Description
		 * @method onmessage
		 * @param {} message
		 */
		client.onmessage = function (message) {
			console.log("ws chowder_request : ", message);
			var data = message.data,
				parsed,
				result;
			
			if (typeof data === "string") {
				try {
					parsed = JSON.parse(data);
					eventTextMessage(parsed);
				} catch (e) {
					console.error("failed to parse json : ", e);
				}
			} else {
				console.log("load meta binary", data);
				metabinary.loadMetaBinary(data, function (metaData, contentData) {
					eventBinaryMessage(metaData, contentData);
				});
			}
			
			/*
			var parsed,
				binary = null;
			console.log('[Info] chowder_response', message);
			//console.log(typeof message.data);
			if (typeof message.data === "string") {
				try {
					parsed = JSON.parse(message.data);
				} catch (e) {
					console.error(e);
				}
			} else {
				metabinary.loadMetaBinary(new Blob([message.data]), function (metaData, contentData) {
					var data = {
						metaData : metaData.params,
						contentData : contentData
					};
					console.log("loadMetaBinaryloadMetaBinary", contentData);
					if (metaData.error) {
						if (resultCallbacks[metaData.id]) {
							resultCallbacks[metaData.id](metaData.error, null);
						}
					} else if (metaData.id && contentData) {
						if (resultCallbacks[metaData.id]) {
							resultCallbacks[metaData.id](null, data);
						}
					} else {
						console.error('[Error] ArgumentError in connector.js');
						resultCallbacks[metaData.id]('ArgumentError', null);
					}
				});
				return;
			}

			console.log(parsed);
			
			if (parsed.method) {
				if (recievers.hasOwnProperty(parsed.method)) {
					recievers[parsed.method](parsed.params);
					return;
				}
			}

			if (parsed.error) {
				if (resultCallbacks[parsed.id]) {
					resultCallbacks[parsed.id](parsed.error, null);
				}
			} else if (parsed.hasOwnProperty('result')) {
				if (!parsed.id) {
					console.error('[Error] Not found message ID');
					console.error(event.data);
					return;
				}
				if (resultCallbacks[parsed.id]) {
					resultCallbacks[parsed.id](null, parsed.result);
				}
			} else {
				console.error('[Error] ArgumentError in connector.js', parsed);
				resultCallbacks[parsed.id]('ArgumentError', null);
			}
			*/
		};
	}
	
	function sendWrapper(id, method, reqdata, resultCallback) {
		if (command.hasOwnProperty(method)) {
			resultCallbacks[id] = resultCallback;

			console.log('[Info] chowder_request', reqdata);
			//socket.emit('chowder_request', reqdata);
			client.send(reqdata);
		} else {
			console.log('[Error] Not found the method in connector: ', method);
		}
	}
	
	/**
	 * サーバへ送信する
	 * @param method メソッド
	 * @param args パラメータ
	 * @param resultCallback サーバから返信があった場合に呼ばれる. resultCallback(err, res)の形式.
	 */
	function send(method, args, resultCallback) {
		var reqjson = {
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
			sendWrapper(reqjson.id, reqjson.method, data, resultCallback);
		} catch (e) {
			console.error(e);
		}
	}
	
	function sendBinary(method, binary, resultCallback) {
		var data = {
			jsonrpc: '2.0',
			type : 'binary',
			id: messageID,
			method: method,
			params: binary,
			to: 'master'
		};
		
		messageID = messageID + 1;
		
		try {
			//data = JSON.stringify(reqjson);
			sendWrapper(data.id, data.method, data, resultCallback);
		} catch (e) {
			console.error(e);
		}
	}
	
	function on(method, callback) {
		recievers[method] = callback;
	}

	window.ws_connector = ws_connector;
	window.ws_connector.connect = connect;
	window.ws_connector.on = on;
	window.ws_connector.send = send;
	window.ws_connector.sendBinary = sendBinary;
	
}(window.command, window.metabinary));
