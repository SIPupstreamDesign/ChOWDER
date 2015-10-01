/*jslint devel: true, nomen: true */
/*global io, Blob */

(function (metabinary) {
	'use strict';
	var io_connector = {},
		socket = io.connect(),
		methods = {
			reqRegisterEvent : "reqRegisterEvent",
			
			// request command
			reqAddContent : "reqAddContent",
			reqGetContent : "reqGetContent",
			reqGetMetaData : "reqGetMetaData",
			reqDeleteContent : "reqDeleteContent",
			reqUpdateContent : "reqUpdateContent",
			reqUpdateTransform : "reqUpdateTransform",
			reqAddWindow : "reqAddWindow",
			reqDeleteWindow : "reqDeleteWindow",
			reqGetWindow : "reqGetWindow",
			reqUpdateWindow : "reqUpdateWindow",
			reqUpdateVirtualDisplay : "reqUpdateVirtualDisplay",
			reqGetVirtualDisplay : "reqGetVirtualDisplay",
			reqShowWindowID : "reqShowWindowID",

			// result command
			doneAddContent : "doneAddContent",
			doneGetContent : "doneGetContent",
			doneGetMetaData : "doneGetMetaData",
			doneDeleteContent : "doneDeleteContent",
			doneUpdateContent : "doneUpdateContent",
			doneUpdateTransform : "doneUpdateTransform",
			doneAddWindow : "doneAddWindow",
			doneDeleteWindow : "doneDeleteWindow",
			doneGetWindow : "doneGetWindow",
			doneUpdateWindow : "doneUpdateWindow",
			doneUpdateVirtualDisplay : "doneUpdateVirtualDisplay",
			doneGetVirtualDisplay : "doneGetVirtualDisplay",
			doneShowWindowID : "doneShowWindowID",

			// update request from server
			update : "update",
			updateTransform : "updateTransform",
			updateWindow : "updateWindow",
			showWindowID : "showWindowID"
		},
		resultCallbacks = {},
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
					metaData : metaData,
					contentData : contentData
				};
				//console.log(contentData);
				if (metaData.error) {
					if (resultCallbacks[metaData.connection_id]) {
						resultCallbacks[metaData.connection_id](metaData.error, null);
					}
				} else if (metaData.connection_id && contentData) {
					if (resultCallbacks[metaData.connection_id]) {
						resultCallbacks[metaData.connection_id](null, data);
					}
					delete data.metaData.connection_id;
				} else {
					console.error('[Error] ArgumentError in connector.js');
					resultCallbacks[metaData.id]('ArgumentError', null);
				}
			});
			return;
		}

		console.log(parsed);

		if (parsed.error) {
			if (resultCallbacks[parsed.id]) {
				resultCallbacks[parsed.id](parsed.error, null);
			}
		} else if (parsed.result) {
			if (!parsed.id) {
				console.error('[Error] Not found message ID');
				console.error(event.data);
				return;
			}
			if (resultCallbacks[parsed.id]) {
				resultCallbacks[parsed.id](null, parsed.result);
			}
		} else {
			console.error('[Error] ArgumentError in connector.js');
			resultCallbacks[parsed.id]('ArgumentError', null);
		}
	});
	
	function sendWrapper(id, method, reqdata, resultCallback) {
		if (methods.hasOwnProperty(method)) {
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
		socket.on(method, callback);
	}

	function connect() {
		socket.on('connect', function () {
			console.log("connect");
			socket.emit('reqRegisterEvent', "v1");
		});
	}

	window.io_connector = io_connector;
	window.io_connector.send = send;
	window.io_connector.connect = connect;
	window.io_connector.sendBinary = sendBinary;
	window.io_connector.methods = methods;
	window.io_connector.on = on;
}(window.metabinary));
