/*jslint node:true, devel: true, nomen: true, indent: 4, maxerr: 100 */
/*global io, require */

(function () {
	"use strict";
	var Connector = function () {},
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

	function registerEvent(methods, io, socket) {
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

			console.log(parsed.hasOwnProperty("to"));
			console.log(parsed.to === "master");
			if (parsed.hasOwnProperty("to") && parsed.to === "master") {
				if (parsed.params === null) {
					parsed.params = [];
				}
				if (methods.hasOwnProperty(parsed.method)) {
					methods[parsed.method](parsed.params, (function (injson) {
						return function (err, res) {
							var isBinary = (res instanceof Buffer);
							result = {
								jsonrpc: "2.0",
								id: injson.id,
								method : injson.method,
								to : 'client'
							};
							if (err) {
								result.error = err;
							}
							console.log("isBinary", isBinary);
							if (isBinary) {
								result.type = 'binary';
								result.result = res;
								console.log("chowder_response", result);
								socket.emit("chowder_response", result);
							} else {
								result.type = 'utf8';
								result.result = res;
								console.log("chowder_response", result);
								socket.emit("chowder_response", JSON.stringify(result));
							}
						};
					}(parsed)));
				}
			}
		});

		socket.on('chowder_response', function (resdata) {
			var parsed;
			console.log('[Info] chowder_response', resdata);

			try {
				parsed = JSON.parse(resdata);
			} catch (e) {
				console.error('[Error] Recieve invalid JSON :', e);
			}

			if (parsed.error) {
				if (resultCallbacks[parsed.id]) {
					resultCallbacks[parsed.id](parsed.error, null);
				}
			} else if (parsed.method) {
				console.log('NotImplementedError: ',  'connector');
				resultCallbacks[parsed.id]('NotImplementedError', null);
			} else if (parsed.result) {
				if (!parsed.id) {
					console.error('[Error] Not found message ID');
					console.error(event.data);
					return;
				}
				resultCallbacks[parsed.id](null, parsed.result);
			} else {
				console.error('[Error] ArgumentError in connector.js');
				resultCallbacks[parsed.id]('ArgumentError', null);
			}
		});
	}
	
	function sendWrapper(socket, id, method, reqdata, resultCallback) {
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
	function send(socket, method, args, resultCallback) {
		var reqjson = {
			jsonrpc: '2.0',
			type : 'utf8',
			id: messageID,
			method: method,
			params: args,
			to: 'client'
		}, data;
		
		messageID = messageID + 1;
		try {
			data = JSON.stringify(reqjson);
			sendWrapper(socket, reqjson.id, reqjson.method, data, resultCallback);
		} catch (e) {
			console.error(e);
		}
	}
	
	function sendBinary(socket, method, binary, resultCallback) {
		var data = {
			jsonrpc: '2.0',
			type : 'binary',
			id: messageID,
			method: method,
			params: binary,
			to: 'client'
		};
		
		messageID = messageID + 1;
		
		try {
			sendWrapper(socket, data.id, data.method, data, resultCallback);
		} catch (e) {
			console.error(e);
		}
	}
	
	Connector.prototype.registerEvent = registerEvent;
	Connector.prototype.send = send;
	Connector.prototype.sendBinary = sendBinary;
	module.exports = new Connector();
}());
