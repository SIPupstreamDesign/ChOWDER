/*jslint devel: true, nomen: true */
/*global io, Blob */

(function (command, metabinary) {
	'use strict';
	var io_connector = {},
		resultCallbacks = {},
		recievers = {},
		messageID = 1,
		currentVersion = "v2",
		url = "http://" + location.hostname + ":" + location.port + "/" + currentVersion,
		socket;
	
	/**
	 * テキストメッセージの処理.
	 * @method eventTextMessage
	 * @param {Object} socket socket
	 * @param {JSON} metaData メタデータ
	 */
	function eventTextMessage(socket, metaData) {
		if (metaData.to === "client") {
			// masterからメッセージがきた
			if (recievers.hasOwnProperty(metaData.method)) {
				recievers[metaData.method](metaData.params);
			}
		} else {
			// clientからmasterに送ったメッセージが返ってきた
			if (metaData.hasOwnProperty("error")) {
				if (metaData.hasOwnProperty("id") && resultCallbacks.hasOwnProperty(metaData.id)) {
					resultCallbacks[metaData.id](metaData.error, null);
				} else {
					console.error("error", metaData.error);
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
	
	/**
	 * バイナリメッセージの処理.
	 * @method eventBinaryMessage
	 * @param {Object} socket socket
	 * @param {JSON} metaData メタデータ
	 * @param {Blob} contentData コンテンツバイナリ
	 */
	function eventBinaryMessage(socket, metaData, contentData) {
		var data;
		console.log(metaData);
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
	
	function sendWrapper(id, method, reqdata, resultCallback) {
		if (command.hasOwnProperty(method)) {
			resultCallbacks[id] = resultCallback;

			if(method !== 'UpdateMouseCursor'){console.log('[Info] chowder_request', reqdata);}
			socket.emit('chowder_request', reqdata);
		} else {
			console.log('[Error] Not found the method in connector: ', method);
		}
	}
	
	/**
	 * テキストメッセージをサーバへ送信する
	 * @method send
	 * @param {String} method メソッド JSONRPCメソッド
	 * @param {JSON} args パラメータ
	 * @param {Function} resultCallback サーバから返信があった場合に呼ばれる. resultCallback(err, res)の形式.
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
	
	/**
	 * バイナリメッセージをサーバへ送信する
	 * @method sendBinary
	 * @param {String} method メソッド JSONRPCメソッド
	 * @param {ArrayBuffer} binary バイナリデータ
	 * @param {JSON} args パラメータ
	 * @param {Function} resultCallback サーバから返信があった場合に呼ばれる. resultCallback(err, res)の形式.
	 */
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
	
	/**
	 * コールバックの登録.
	 * @method on
	 * @param {String} method JSONRPCメソッド
	 * @param {Function} callback サーバからメッセージを受け取った場合に呼ばれる. callback(err, res)の形式.
	 */
	function on(method, callback) {
		recievers[method] = callback;
	}

	/**
	 * 接続する.
	 * @method connect
	 */
	function connect() {
		socket = io.connect(url);
		socket.on('connect', function () {
            console.log("connect");
            var e = document.getElementById('head_menu_hover_right');
            if(e){
                e.textContent = '○';
                e.className = 'connect';
            }
        });
        socket.on('disconnect', function(data){
            var e = document.getElementById('head_menu_hover_right');
            if(e){
                e.textContent = '×';
                e.className = 'disconnect';
            }
        });
		socket.on('chowder_response', function (data) {
			var parsed;
			if(!(typeof data === 'string' && data.match(/UpdateMouseCursor/))){console.log('chowder_response', data);}
			if (typeof data === "string") {
				try {
					parsed = JSON.parse(data);
					eventTextMessage(socket, parsed);
				} catch (e) {
					console.error('[Error] Recieve invalid JSON :', e, parsed);
				}
			} else {
				console.log("load meta binary", data);
				metabinary.loadMetaBinary(new Blob([data]), function (metaData, contentData) {
					eventBinaryMessage(socket, metaData, contentData);
				});
			}
		});
	}

	window.io_connector = io_connector;
	window.io_connector.send = send;
	window.io_connector.connect = connect;
	window.io_connector.sendBinary = sendBinary;
	window.io_connector.on = on;
}(window.command, window.metabinary));
