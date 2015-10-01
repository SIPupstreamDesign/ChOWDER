/*jslint node:true, devel: true, nomen: true, indent: 4, maxerr: 100 */
/*global io, require */

(function () {
	"use strict";
	var WSConnector = function () {},
		metabinary = require('./metabinary.js'),
		methods = {
			reqRegisterEvent : "reqRegisterEvent",
			
			// request command
			AddContent : "AddContent",
			GetContent : "GetContent",
			GetMetaData : "GetMetaData",
			DeleteContent : "DeleteContent",
			UpdateContent : "UpdateContent",
			UpdateTransform : "UpdateTransform",
			reqAddWindow : "reqAddWindow",
			DeleteWindow : "DeleteWindow",
			GetWindow : "GetWindow",
			UpdateWindow : "UpdateWindow",
			UpdateVirtualDisplay : "UpdateVirtualDisplay",
			GetVirtualDisplay : "GetVirtualDisplay",
			ShowWindowID : "ShowWindowID",

			// update request from server
			update : "update",
			updateTransform : "updateTransform",
			updateWindow : "updateWindow",
			showWindowID : "showWindowID"
		},
		resultCallbacks = {},
		messageID = 1;

	function registerEvent(methods, ws, ws_connection) {
		ws_connection.on('message', function (data) {
			console.log("chowder_request : ", data);
			var parsed,
				result;

			if (!data.type || data.type === 'utf8') {
				try {
					parsed = JSON.parse(data.utf8Data);
				} catch (e) {
					console.error("failed to parse json : ", e);
				}
			} else {
				metabinary.loadMetaBinary(data, function (metaData, contentData) {
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

			console.log(parsed.hasOwnProperty("to"));
			console.log(parsed.to === "master");
			if (parsed.hasOwnProperty("to") && parsed.to === "master") {
				if (parsed.params === null) {
					parsed.params = [];
				}
				if (methods.hasOwnProperty(parsed.method)) {
					methods[parsed.method](parsed.params, (function (injson) {
						return function (err, res, binary) {
							var metabin = null;
							console.log("isBinary", binary);
							if (binary) {
								res.connection_id = injson.id;
								metabin = metabinary.createMetaBinary(res, binary);
								if (metabin === null) {
									console.log('Failed to create Metabinary');
									result = {
										jsonrpc: "2.0",
										id: injson.id,
										method : injson.method,
										to : 'client',
										err : 'Failed to create Metabinary'
									};
									ws_connection.sendUTF(JSON.stringify(result));
								} else {
									ws_connection.sendBytes(metabin);
								}
							} else {
								result = {
									jsonrpc: "2.0",
									id: injson.id,
									method : injson.method,
									to : 'client'
								};
								if (err) {
									result.error = err;
								}
								result.result = res;
								console.log("chowder_response", result);
								ws_connection.sendUTF(JSON.stringify(result));
							}
						};
					}(parsed)));
				}
			} else {
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
			}
		});
	}
	
	/**
	 * サーバへ送信する
	 * @param method メソッド
	 * @param args パラメータ
	 * @param resultCallback サーバから返信があった場合に呼ばれる. resultCallback(err, res)の形式.
	 */
	function send(ws_connection, method, args, resultCallback) {
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
			
			if (methods.hasOwnProperty(reqjson.method)) {
				resultCallbacks[reqjson.id] = resultCallback;

				console.log('[Info] chowder_request', data);
				ws_connection.sendUTF(data);

			} else {
				console.log('[Error] Not found the method in connector: ', data);
			}
		} catch (e) {
			console.error(e);
		}
	}
	
	function sendBinary(ws_connection, method, binary, resultCallback) {
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
			if (methods.hasOwnProperty(data.method)) {
				resultCallbacks[data.id] = resultCallback;

				console.log('[Info] chowder_request binary', data);
				ws_connection.sendBytes(data);

			} else {
				console.log('[Error] Not found the method in connector: ', data);
			}
		} catch (e) {
			console.error(e);
		}
	}
	
	function broadcast(ws, method, args, resultCallback) {
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
			
			if (methods.hasOwnProperty(reqjson.method)) {
				resultCallbacks[reqjson.id] = resultCallback;

				console.log('[Info] chowder_request', data);
				ws.broadcast(data);
			} else {
				console.log('[Error] Not found the method in connector: ', data);
			}
		} catch (e) {
			console.error(e);
		}
	}
	
	WSConnector.prototype.registerEvent = registerEvent;
	WSConnector.prototype.broadcast = broadcast;
	WSConnector.prototype.send = send;
	WSConnector.prototype.sendBinary = sendBinary;
	module.exports = new WSConnector();
}());
