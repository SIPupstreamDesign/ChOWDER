/*jslint devel: true, nomen: true */
/*global io */

(function (controller) {
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
	
	socket.on("chowder_request", function (data, binary) {
		console.log("chowder_request : ", data);
		var parsed,
			result;

		if (binary === undefined || !binary) {
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
			/*
			console.log(parsed);
            if (controller[parsed.method]) {
                console.log("call ", parsed.method);
                controller[parsed.method](null, parsed.param);
            }
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
	

	socket.on('chowder_response', function (resdata, binary) {
		var isBinary = (!(binary === undefined || !binary)),
			parsed;
		console.log('[Info] chowder_response', resdata);

		try {
			parsed = JSON.parse(resdata);
		} catch (e) {
			console.error('[Error] Recieve invalid JSON :', e);
		}

		console.log("chowder_responsechowder_response");
		console.log(parsed.hasOwnProperty('result'));
		console.log(parsed);

		if (parsed.error) {
			if (resultCallbacks[parsed.id]) {
				resultCallbacks[parsed.id](parsed.error, null);
			}
		} else if (parsed.result || isBinary) {
			if (!parsed.id) {
				console.error('[Error] Not found message ID');
				console.error(event.data);
				return;
			}
			if (resultCallbacks[parsed.id]) {
				if (isBinary) {
					resultCallbacks[parsed.id](null, binary);
				} else {
					resultCallbacks[parsed.id](null, parsed.result);
				}
			}
		} else {
			console.error('[Error] ArgumentError in connector.js');
			resultCallbacks[parsed.id]('ArgumentError', null);
		}
	});
	
	function sendWrapper(id, method, reqdata, binary, resultCallback) {
		if (methods.hasOwnProperty(method)) {
			resultCallbacks[id] = resultCallback;

			console.log('[Info] chowder_request', reqdata);
			socket.emit('chowder_request', reqdata, binary);
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
			sendWrapper(reqjson.id, reqjson.method, data, null, resultCallback);
		} catch (e) {
			console.error(e);
		}
	}
	
	function sendBinary(method, binary, resultCallback) {
		var reqjson = {
			jsonrpc: '2.0',
			type : 'binary',
			id: messageID,
			method: method,
			to: 'master'
		}, data;
		
		messageID = messageID + 1;
		
		try {
			data = JSON.stringify(reqjson);
			sendWrapper(data.id, data.method, data, binary, resultCallback);
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
}(window.controller));
