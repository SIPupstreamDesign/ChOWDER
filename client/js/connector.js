/*jslint devel: true, nomen: true */
/*global io */

(function (model) {
	'use strict';
	var connector = {},
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
	
	socket.on("chowder_request", function (data) {
		console.log("chowder_request : ", data);
		var parsed,
			result;

		if (!data.type || data.type === 'utf8') {
			try {
				parsed = JSON.parse(data);
			} catch (e) {
				console.error("failed to parse json : ", e);
			}
		} else {
			parsed = data;
		}

		if (parsed.hasOwnProperty("to") && parsed.to === "client") {
			if (parsed.params === null) {
				parsed.params = [];
			}
			console.log(parsed);
			/*
			if (methods.hasOwnProperty(parsed.method)) {
				methods[parsed.method](parsed.params, (function (injson) {
					return function (err, res) {
						if (err) {
							result = {
								jsonrpc: "2.0",
								error: err,
								id: injson.id
							};
						} else {
							result = {
								jsonrpc: "2.0",
								result: res,
								id: injson.id
							};
						}
						socket.emit("chowder_response", JSON.stringify(result));
					};
				}(parsed)));
			}
			*/
		}
	});
	
	function sendWrapper(id, method, reqdata, resultCallback) {
		var parsed;
		if (methods.hasOwnProperty(method)) {
			resultCallbacks[id] = resultCallback;

			console.log('[Info] chowder_request', reqdata);
			socket.emit('chowder_request', reqdata);

			socket.once('chowder_response', function (resdata) {
				console.log('[Info] chowder_response', resdata);
				
				if (!resdata.type || resdata.type === 'utf8') {
					try {
						parsed = JSON.parse(resdata);
					} catch (e) {
						console.error('[Error] Recieve invalid JSON :', e);
					}
				} else {
					parsed = resdata;
				}
				
				console.log("chowder_responsechowder_response");
				console.log(parsed.hasOwnProperty('result'));
				
				if (parsed.error) {
					if (resultCallbacks[parsed.id]) {
						resultCallbacks[parsed.id](parsed.error, null);
					}
				} else if (parsed.hasOwnProperty('method')) {
					console.log('NotImplementedError: ',  'connector');
					resultCallbacks[parsed.id]('NotImplementedError', null);
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
					console.error('[Error] ArgumentError in connector.js');
					resultCallbacks[parsed.id]('ArgumentError', null);
				}
			});
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
	
	function sendBinary(method, args, resultCallback) {
		var data = {
			jsonrpc: '2.0',
			type : 'binary',
			id: messageID,
			method: method,
			params: args,
			to: 'master'
		};
		
		messageID = messageID + 1;
		
		try {
			sendWrapper(data.id, data.method, data, resultCallback);
		} catch (e) {
			console.error(e);
		}
	}

	socket.on('connect', function () {
		socket.emit('connect_page');
	});

	window.connector = connector;
	window.connector.send = send;
	window.connector.sendBinary = sendBinary;
	window.connector.methods = methods;
}());
