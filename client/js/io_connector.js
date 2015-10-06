/*jslint devel: true, nomen: true */
/*global io, Blob */

(function (command, metabinary) {
	'use strict';
	var io_connector = {},
		socket = io.connect(),
		resultCallbacks = {},
		recievers = {},
		messageID = 1,
		currentVersion = "v2";
	
	function eventTextMessage(socket, metaData) {
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
	
	function eventBinaryMessage(socket, metaData, contentData) {
		var data = {
			metaData : metaData.params,
			contentData : contentData
		};
		console.log(metaData);
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
	
	socket.on('chowder_response', function (data) {
		var parsed;
		console.log('chowder_response', data);
		if (typeof data === "string") {
			try {
				parsed = JSON.parse(data);
				eventTextMessage(socket, parsed);
			} catch (e) {
				console.error('[Error] Recieve invalid JSON :', e);
			}
		} else {
			console.log("load meta binary", data);
			metabinary.loadMetaBinary(new Blob([data]), function (metaData, contentData) {
				eventBinaryMessage(socket, metaData, contentData);
			});
		}
	});

	function sendWrapper(id, method, reqdata, resultCallback) {
		if (command.hasOwnProperty(method)) {
			resultCallbacks[id] = resultCallback;

			console.log('[Info] chowder_request', reqdata);
			socket.emit('chowder_request', reqdata);
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
	
	function sendBinary(method, metaData, binary, resultCallback) {
		var data = {
			jsonrpc: '2.0',
			type : 'binary',
			id: messageID,
			method: method,
			params: metaData,
			to: 'master'
		}, metabin;
		
		messageID = messageID + 1;
		try {
			console.log(data, binary);
			metabin = metabinary.createMetaBinary(data, binary);
			console.log(metabin);
			//data = JSON.stringify(reqjson);
			sendWrapper(data.id, data.method, metabin, resultCallback);
		} catch (e) {
			console.error(e);
		}
	}
	
	function on(method, callback) {
		recievers[method] = callback;
	}

	function connect() {
		socket.on('connect', function () {
			console.log("connect");
			socket.emit('RegisterEvent', currentVersion);
		});
	}

	window.io_connector = io_connector;
	window.io_connector.send = send;
	window.io_connector.connect = connect;
	window.io_connector.sendBinary = sendBinary;
	window.io_connector.on = on;
}(window.command, window.metabinary));
