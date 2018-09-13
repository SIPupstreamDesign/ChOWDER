/*jslint node:true, devel: true, nomen: true, indent: 4, maxerr: 100 */
/*global io, require */

(function () {
	"use strict";
	var WSConnector = function () {},
		metabinary = require('./metabinary.js'),
		Command = require('./command.js'),
		util = require('./util.js'),
		resultCallbacks = {},
		recievers = {},
		messageID = 1;

	function sendResponse(self, ws_connection, injson) {
		return function (err, res, binary) {
			var metabin = null,
				result;
			//console.log("isBinary", binary);
			if (binary !== undefined && binary !== null) {
				if (res instanceof Array) {
					result = {
						jsonrpc: "2.0",
						id: injson.id,
						method : injson.method,
						result : res[0]
					};
					metabin = metabinary.createMetaBinaryMulti(result, res, binary);
				} else {
					result = {
						jsonrpc: "2.0",
						id: injson.id,
						method : injson.method,
						result : res
					};
					metabin = metabinary.createMetaBinary(result, binary);
				}
				if (metabin === null || metabin === undefined) {
					result.error = 'Failed to create Metabinary';
					console.log('Failed to create Metabinary');
					if (self.socket && self.socket.hasOwnProperty(ws_connection.id)) {
						self.socket[ws_connection.id].send(JSON.stringify(result));
					} else {
						ws_connection.sendUTF(JSON.stringify(result));
					}
				} else {
					console.log("chowder_response", result.method);
					if (self.socket && self.socket.hasOwnProperty(ws_connection.id)) {
						self.socket[ws_connection.id].send(metabin);
					} else {
						ws_connection.sendBytes(metabin);
					}
				}
			} else {
				result = {
					jsonrpc: "2.0",
					id: injson.id,
					method : injson.method
				};
				if (err) {
					result.error = err;
				}
				result.result = res;
				console.log("chowder_response", result.method);
				if (self.socket && self.socket.hasOwnProperty(ws_connection.id)) {
					self.socket[ws_connection.id].send(JSON.stringify(result));
				} else {
					ws_connection.sendUTF(JSON.stringify(result));
				}
			}
		}
	}

	/**
	 * テキストメッセージの処理.
	 * @method eventTextMessage
	 * @param {JSON} metaData メタデータ
	 */
	function eventTextMessage(self, ws_connection, metaData) {
		if (metaData.to === "client") {
			// masterからclientに送ったメッセージが返ってきた.
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
		} else {
			// clientからmasterにメッセージが来た
			if (recievers.hasOwnProperty(metaData.method)) {
				recievers[metaData.method](metaData.params,(function (ws_connection) {
					return sendResponse(self, ws_connection, metaData);
				}(ws_connection)),  ws_connection.id);
			}
		}
	}
	
	/**
	 * バイナリメッセージの処理.
	 * @method eventBinaryMessage
	 * @param {Object} ws_connection websocketコネクション
	 * @param {JSON} metaData メタデータ
	 * @param {Blob} contentData バイナリデータ
	 */
	function eventBinaryMessage(self, ws_connection, metaData, contentData) {
		var data = {
			metaData : metaData.params,
			contentData : contentData
		};
		if (metaData.to === "client") {
			// masterからclientに送ったメッセージが返ってきた.
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
		} else {
			// clientからmasterにメッセージが来た
			if (recievers.hasOwnProperty(metaData.method)) {
				// onで登録していたrecieverを呼び出し
				// 完了後のコールバックでclientにメッセージを返す.
				recievers[metaData.method](data, (function (ws_connection) {
					return sendResponse(self, ws_connection, metaData);
				}(ws_connection)), ws_connection.id);
			}
		}
	}
	
	/**
	 * イベントの登録.
	 * @method registerEvent
	 * @param {Object} ws websocketオブジェクト
	 * @param {Object} ws_connection websocketコネクション
	 */
	function registerEvent(ws, ws_connection) {
		ws_connection.on('message', function (data) {
			if (this.socket && this.socket.hasOwnProperty(ws_connection.id)) {
				return;
			}
			console.log("ws chowder_request : ", data);
			var parsed;
			
			if (!data.type || data.type === 'utf8') {
				try {
					parsed = JSON.parse(data.utf8Data);
					// JSONRPCのidがなかった場合は適当なidを割り当てておく.
					if (!parsed.hasOwnProperty('id')) {
						parsed.id = util.generateUUID8();
					}
					eventTextMessage(this, ws_connection, parsed);
				} catch (e) {
					console.error("failed to parse json : ", e);
				}
			} else if (data.type === 'binary') {
				data = data.binaryData;
				//console.log("load meta binary", data);
				metabinary.loadMetaBinary(data, function (metaData, contentData) {
					// JSONRPCのidがなかった場合は適当なidを割り当てておく.
					if (!metaData.hasOwnProperty('id')) {
						metaData.id = util.generateUUID8();
					}
					eventBinaryMessage(this, ws_connection, metaData, contentData);
				});
			}
		}.bind(this));
	}
	
	function registerIPCEvent(ws, ws_connection) {
		if (this.socket && this.socket.hasOwnProperty(ws_connection.id)) {
			this.socket[ws_connection.id].on('data', function (data) {
				if (data !== undefined && data[0] == 99 && data.length === 7) {
					if (String(data) === "connect" ) {
						return;
					}
				}
				var parsed;
				
				if (data !== undefined && data[0] === 123 && data[data.length-1] === 125) {
					try {
						parsed = JSON.parse(String(data));
						// JSONRPCのidがなかった場合は適当なidを割り当てておく.
						if (!parsed.hasOwnProperty('id')) {
							parsed.id = util.generateUUID8();
						}
						eventTextMessage(this, ws_connection, parsed);
					} catch (e) {
						console.error("failed to parse json : ", e);
					}
				} else {
					console.log("ws chowder_request2 : ", String(data));
					//console.log("load meta binary", data);
					metabinary.loadMetaBinary(data, function (metaData, contentData) {
						// JSONRPCのidがなかった場合は適当なidを割り当てておく.
						if (!metaData.hasOwnProperty('id')) {
							metaData.id = util.generateUUID8();
						}
						console.log("eventBinaryMessage")
						eventBinaryMessage(this, ws_connection, metaData, contentData);
					});
				}
			}.bind(this));
		}
	}
	

	/**
	 * テキストメッセージをclientへ送信する
	 * @method send
	 * @param {Object} ws_connection websocketコネクション
	 * @param {String} method メソッド JSONRPCメソッド
	 * @param {JSON} args パラメータ
	 * @param {Function} resultCallback サーバから返信があった場合に呼ばれる. resultCallback(err, res)の形式.
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
			
			if (Command.hasOwnProperty(reqjson.method)) {
				resultCallbacks[reqjson.id] = resultCallback;

				console.log('[Info] chowder_request', data);
				if (this.socket && this.socket.hasOwnProperty(ws_connection.id)) {
					this.socket[ws_connection.id].send(data);
				} else {
					ws_connection.sendUTF(data);
				}

			} else {
				console.log('[Error] Not found the method in connector: ', data);
			}
		} catch (e) {
			console.error(e);
		}
	}
	
	/**
	 * バイナリメッセージをclientへ送信する
	 * @method sendBinary
	 * @param {Object} ws_connection websocketコネクション
	 * @param {String} method メソッド JSONRPCメソッド
	 * @param {ArrayBuffer} binary バイナリデータ
	 * @param {Function} resultCallback サーバから返信があった場合に呼ばれる. resultCallback(err, res)の形式.
	 */
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
			if (Command.hasOwnProperty(data.method)) {
				resultCallbacks[data.id] = resultCallback;

				console.log('[Info] chowder_request binary', data);
				if (this.socket && this.socket.hasOwnProperty(ws_connection.id)) {
					this.socket[ws_connection.id].send(data);
				} else {
					ws_connection.sendBytes(data);
				}

			} else {
				console.log('[Error] Not found the method in connector: ', data);
			}
		} catch (e) {
			console.error(e);
		}
	}
	
	/**
	 * ブロードキャストする.
	 * @method broadcast
	 * @parma {Object} ws websocketオブジェクト
	 * @param {String} method JSONRPCメソッド
	 * @param {JSON} args パラメータ
	 * @param {Function} resultCallback サーバから返信があった場合に呼ばれる. resultCallback(err, res)の形式.
	 */
	function broadcast(ws, method, args, resultCallback, socketid) {
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
			
			if (Command.hasOwnProperty(reqjson.method)) {
				resultCallbacks[reqjson.id] = resultCallback;
				if(method !== 'UpdateMouseCursor'){console.log("chowder_response broadcast ws", method);}
				if (this.socket) {
					for (var id in this.socket) {
						this.socket[id].send(data);
					}
				}
				for (var i = 0; i < ws.length; ++i) {
					ws[i].broadcast(data);
				}
			} else {
				console.log('[Error] Not found the method in connector: ', data);
			}
		} catch (e) {
			console.error(e);
		}
	}
	
	function on(method, callback) {
		recievers[method] = callback;
	}
	
	WSConnector.prototype.registerEvent = registerEvent;
	WSConnector.prototype.registerIPCEvent = registerIPCEvent;
	WSConnector.prototype.on = on;
	WSConnector.prototype.broadcast = broadcast;
	WSConnector.prototype.send = send;
	WSConnector.prototype.sendBinary = sendBinary;
	WSConnector.prototype.addIPCSocket = function (socket, enableID) {
		if (!this.socket) {
			this.socket = {};
		}
		this.socket[enableID] = socket;
	};
	WSConnector.prototype.removeIPCSocket = function (socket, disableID) {
		if (this.socket) {
			if (this.socket.hasOwnProperty(disableID)) {
				delete this.socket[disableID];
			}
		}
	};
	module.exports = new WSConnector();
}());
