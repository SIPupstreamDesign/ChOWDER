/*jslint devel: true, nomen: true */
/*global io, Blob */

(function (command, metabinary) {
	'use strict';
	var io_connector = {},
		socket = io.connect(),
		resultCallbacks = {},
		recievers = {},
		messageID = 1;
	
	socket.on('chowder_response', function (resdata) {
		var parsed;
			
		console.log('[Info] chowder_response', resdata);

		if (typeof resdata === "string") {
			try {
				parsed = JSON.parse(resdata);
			} catch (e) {
				console.error('[Error] Recieve invalid JSON :', e);
			}
		} else {
			metabinary.loadMetaBinary(new Blob([resdata]), function (metaData, contentData) {
				var data = {
					metaData : metaData.params,
					contentData : contentData
				};
				console.log(metaData, contentData);
				if (metaData.error) {
					if (resultCallbacks[metaData.id]) {
						resultCallbacks[metaData.id](metaData.error, null);
					}
				} else if (metaData.id && contentData) {
					if (resultCallbacks[metaData.id]) {
						console.log(data);
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
				console.log(parsed.result);
				resultCallbacks[parsed.id](null, parsed.result);
			}
		} else {
			console.error('[Error] ArgumentError in connector.js');
			resultCallbacks[parsed.id]('ArgumentError', null);
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
			socket.emit('RegisterEvent', "v1");
		});
	}

	window.io_connector = io_connector;
	window.io_connector.send = send;
	window.io_connector.connect = connect;
	window.io_connector.sendBinary = sendBinary;
	window.io_connector.on = on;
}(window.command, window.metabinary));
