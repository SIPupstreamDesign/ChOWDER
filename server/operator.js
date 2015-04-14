/*jslint devel:true*/
/*global module, require, socket */

(function () {
	"use strict";
	
	/**
	 * Operator生成
	 * @method Operator
	 */
	var Operator = function () {},
		redis = require("redis"),
		image_size = require('image-size'),
		client = redis.createClient(6379, '127.0.0.1', {'return_buffers': true}),
		textClient = redis.createClient(6379, '127.0.0.1', {'return_buffers': false}),
		contentIDStr = "content_id",
		windowIDStr = "window_id",
		virtualDisplayIDStr = "virtual_display",
		metadataPrefix = "metadata:",
		contentPrefix = "content:",
		windowPrefix = "window:",
		metabinary = require('./metabinary.js'),
		util = require('./util.js'),
		Command = require('./command.js'),
		path = require('path'),
		fs = require('fs'),
		phantomjs = require('phantomjs'),
		frontPrefix = "tiled_server:",
		uuidPrefix = "invalid:",
		socketidToHash = {};
	
	client.on('error', function (err) {
		console.log('Error ' + err);
	});
	
	/**
	 * 指定されたURLをレンダリングする
	 * @method renderURL
	 * @param {String} url URL文字列
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function renderURL(url, endCallback) {
		var output = "out.png",
			command = [ phantomjs.path,
				path.normalize("./capture.js"),
				output,
				url ];
		console.dir("Phantomjs:" + JSON.stringify(phantomjs));
		console.log("Phantomjs path:" + phantomjs.path);
		
		util.launchApp(command, null, function () {
			if (fs.existsSync(output)) {
				console.log("output found");
				image_size(output, function (err, dimensions) {
					endCallback(fs.readFileSync(output), dimensions);
				});
			} else {
				endCallback(null);
			}
		});
	}
	
	/**
	 * ContentID生成。generateUUID8を用いる。
	 * @method generateContentID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function generateContentID(endCallback) {
		var id = util.generateUUID8();
		console.log("newid: " + id);
		client.exists(contentPrefix + id, function (err, doesExist) {
			if (err) {
				console.log(err);
				return;
			}
			if (doesExist === 1) {
				generateContentID(endCallback);
			} else {
				endCallback(id);
			}
		});
	}
	
	/**
	 * WindowID生成。generateUUID8を用いる。
	 * @method generateWindowID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function generateWindowID(endCallback) {
		var id = util.generateUUID8();
		console.log("newid: " + id);
		client.exists(windowPrefix + id, function (err, doesExist) {
			if (err) {
				console.log(err);
				return;
			}
			if (doesExist === 1) {
				generateWindowID(endCallback);
			} else {
				endCallback(id);
			}
		});
	}
	
	/**
	 * 指定されたタイプ、idのメタデータ設定
	 * @method setMetaData
	 * @param {String} type メタデータタイプ
	 * @param {String} id ContentsID
	 * @param {} data
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function setMetaData(type, id, data, endCallback) {
		var metaData = data;
		
		//console.log("setMetaData:" + JSON.stringify(data));
		if (!metaData) {
			metaData = {
				"id" : id,
				"type" : type,
				"posx" : "0",
				"posy" : "0",
				"width" : "0",
				"height" : "0"
			};
		}
		if (metaData.type === "window") {
			console.log("invalid matadata.");
			return;
		}
		if (metaData.hasOwnProperty('command')) {
			delete metaData.command;
		}
		textClient.hmset(metadataPrefix + id, metaData, function (err) {
			if (err) {
				console.log(err);
			} else {
				endCallback(metaData);
			}
		});
	}
	
	/**
	 * 指定されたタイプ、idのメタデータ取得
	 * @method getMetaData
	 * @param {String} type メタデータタイプ
	 * @param {String} id ContentsID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function getMetaData(type, id, endCallback) {
		if (type === 'all') {
			textClient.keys(metadataPrefix + '*', function (err, replies) {
				replies.forEach(function (id, index) {
					textClient.hgetall(id, function (err, data) {
						endCallback(data);
					});
				});
			});
			/*
			textClient.keys(metadataPrefix + '*', function (err, replies) {
				var multi = textClient.multi();
				replies.forEach(function (reply, index) {
					multi.hgetall(reply);
				});
				multi.exec(function (err, data) {
					endCallback(data);
				});
			});
			*/
		} else {
			textClient.hgetall(metadataPrefix + id, function (err, data) {
				if (data) {
					endCallback(data);
				}
			});
		}
	}
	
	/**
	 * コンテンツ追加
	 * @method addContent
	 * @param {Object} metaData メタデータ
	 * @param {BLOB} data バイナリデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function addContent(metaData, data, endCallback) {
		var contentData = null;
		if (metaData.type === 'text') {
			contentData = data;
			metaData.mime = "text/plain";
		} else if (metaData.type === 'image') {
			contentData = data;
			metaData.mime = util.detectImageType(data);
		} else if (metaData.type === 'url') {
			contentData = data;
			metaData.mime = util.detectImageType(data);
		} else {
			console.log("Error undefined type:" + metaData.type);
		}
		
		console.log("mime:" + metaData.mime);
		
		generateContentID(function (id) {
			if (metaData.hasOwnProperty('id') && metaData.id !== "") {
				id = metaData.id;
			}
			client.set(contentPrefix + id, contentData, function (err, reply) {
				if (err) {
					console.log("Error on addContent:" + err);
				} else {
					redis.print(err, reply);
					metaData.id = id;
					metaData.orgWidth = metaData.width;
					metaData.orgHeight = metaData.height;
					if (!metaData.hasOwnProperty('zIndex')) {
						metaData.zIndex = 0;
					}
					setMetaData(metaData.type, id, metaData, function (metaData) {
						endCallback(metaData, contentData);
					});
				}
			});
		});
	}
	
	/**
	 * 指定されたデータタイプ、idのコンテンツ取得
	 * @method getContent
	 * @param {String} type データタイプ
	 * @param {String} id ContentsID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function getContent(type, id, endCallback) {
		if (type === 'all') {
			client.keys(contentPrefix + '*', function (err, replies) {
				replies.forEach(function (id, index) {
					client.get(id, function (err, reply) {
						if (!err) {
							endCallback(reply);
						} else {
							console.log(err);
						}
					});
				});
			});
		} else {
			client.get(contentPrefix + id, function (err, reply) {
				if (!err) {
					endCallback(reply);
				} else {
					console.log(err);
				}
			});
		}
	}
	
	/**
	 * 指定されたidのコンテンツ削除
	 * @method deleteContent
	 * @param {String} id ContentsID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function deleteContent(id, endCallback) {
		client.exists(contentPrefix + id, function (err, doesExist) {
			if (!err && doesExist) {
				client.del(metadataPrefix + id, function (err) {
					client.del(contentPrefix + id, function (err) {
						endCallback(id);
					});
				});
			} else {
				console.log(err);
			}
		});
	}
	
	/**
	 * コンテンツ更新
	 * @method updateContent
	 * @param {Object} metaData メタバイナリ
	 * @param {BLOB} data     バイナリデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function updateContent(metaData, data, endCallback) {
		var contentData = null;
		console.log("updateContent:" + metaData.id);
		if (metaData.type === 'text') {
			contentData = data;
			metaData.mime = "text/plain";
		} else if (metaData.type === 'image') {
			contentData = data;
			metaData.mime = util.detectImageType(data);
		} else if (metaData.type === 'url') {
			contentData = data;
			metaData.mime = util.detectImageType(data);
		} else {
			console.log("Error undefined type:" + metaData.type);
		}
		
		client.set(contentPrefix + metaData.id, contentData, function (err, reply) {
			if (err) {
				console.log("Error on updateContent:" + err);
			} else {
				redis.print(err, reply);
				setMetaData(metaData.type, metaData.id, metaData, function (metaData) {
					endCallback(metaData.id);
				});
			}
		});
	}
	
	/**
	 * Window追加
	 * @method addWindow
	 * @param {BLOB} socket socket.ioオブジェクトid
	 * @param {JSON} windowData 追加するWindowデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function addWindow(socketid, windowData, endCallback) {
		generateWindowID(function (id) {
			if (windowData.hasOwnProperty('id') && windowData.id !== "") {
				id = windowData.id;
			}
			socketidToHash[socketid] = id;
			console.log("registerWindow: " + id);
			windowData.id = id;
			windowData.socketid = socketid;
			windowData.orgWidth = windowData.width;
			windowData.orgHeight = windowData.height;
			windowData.type = "window";
			textClient.hmset(windowPrefix + id, windowData, function (err, reply) {
				endCallback(windowData);
			});
		});
	}
	
	/**
	 * VirtualDisplay設定
	 * @method setVirtualDisplay
	 * @param {JSON} windowData VirtualDisplayのWindowデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function setVirtualDisplay(windowData, endCallback) {
		if (windowData) {
			textClient.hmset(virtualDisplayIDStr, windowData, function (err, reply) {
				endCallback(windowData);
			});
		}
	}
	
	/**
	 * VirtualDisplay取得
	 * @method getVirtualDisplay
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function getVirtualDisplay(endCallback) {
		textClient.hgetall(virtualDisplayIDStr, function (err, data) {
			if (data) {
				endCallback(data);
			} else {
				endCallback({});
			}
		});
	}
	
	/**
	 * Window削除
	 * @method deleteWindow
	 * @param {String} id ContentsID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function deleteWindow(id, endCallback) {
		client.del(windowPrefix + id, function (err) {
			if (err) {
				console.log(err);
			} else {
				console.log("unregister window id:" + id);
			}
			endCallback();
		});
	}
	
	/**
	 * SocketIDで指定されたWindow削除
	 * @method deleteWindowBySocketID
	 * @param {BLOB} socket socket.ioオブジェクトid
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function deleteWindowBySocketID(socketid, endCallback) {
		var id;
		if (socketidToHash.hasOwnProperty(socketid)) {
			id = socketidToHash[socketid];
			client.del(windowPrefix + id, function (err) {
				if (err) {
					console.log(err);
				} else {
					console.log("unregister window socketid:" + socketid + ", id:" + id);
				}
				endCallback();
			});
		}
	}
	
	/**
	 * Window取得
	 * @method getWindow
	 * @param {JSON} windowData windowデータJSON
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function getWindow(windowData, endCallback) {
		if (windowData.hasOwnProperty('type') && windowData.type === 'all') {
			//console.log("getWindowAll");
			textClient.keys(windowPrefix + '*', function (err, replies) {
				replies.forEach(function (id, index) {
					//console.log("getWindowAllID:" + id);
					textClient.hgetall(id, function (err, reply) {
						if (!err) {
							endCallback(reply);
						} else {
							console.log(err);
						}
					});
				});
			});
		} else {
			textClient.hgetall(windowPrefix + windowData.id, function (err, data) {
				if (data) {
					endCallback(data);
				}
			});
		}
	}
	
	/**
	 * Window更新
	 * @method updateWindow
	 * @param {BLOB} socketid socket.ioオブジェクトid
	 * @param {JSON} windowデータJSON
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function updateWindow(socketid, windowData, endCallback) {
		if (!windowData.hasOwnProperty("id")) { return; }
		textClient.hmset(windowPrefix + windowData.id, windowData, function (err, reply) {
			endCallback(windowData);
		});
	}
	
	/**
	 * セッションリスト取得。registerWSEventにてコールされる。
	 * @method getSessionList
	 */
	function getSessionList() {
		client.smembers('sessions', function (err, replies) {
			replies.forEach(function (id, index) {
				console.log(id + ":" + index);
			});
		});
	}
	
	/// send metadata with command using socket.io or ws.
	/**
	 * send metadata with command using socket.io or ws.
	 * @method sendMetaData
	 * @param {String} command
	 * @param {Object} metaData メタデータ
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 */
	function sendMetaData(command, metaData, socket, ws_connection) {
		metaData.command = command;
		if (socket) {
			socket.emit(command, JSON.stringify(metaData));
		} else if (ws_connection) {
			ws_connection.sendUTF(JSON.stringify(metaData));
		}
	}
	
	/// send binary with command using socket.io or ws.
	/**
	 * send binary with command using socket.io or ws.
	 * @method sendBinary
	 * @param {String} command getMetaDataのendCallbackにて受領したコマンド
	 * @param {BLOB} binary createMetaBinaryにて作成されたバイナリデータ
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 */
	function sendBinary(command, binary, socket, ws_connection) {
		if (socket) {
			socket.emit(command, binary);
		} else if (ws_connection) {
			ws_connection.sendBytes(binary);
		}
	}
	
	/// do addContent command
	/**
	 * do addContent command
	 * @method commandAddContent
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {Object} metaData メタデータ
	 * @param {BLOB} binaryData バイナリデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandAddContent(socket, ws_connection, metaData, binaryData, endCallback) {
		console.log("commandAddContent");
		if (metaData.type === 'url') {
			renderURL(binaryData, function (image, dimension) {
				if (image) {
					//console.log(Command.doneAddContent);
					metaData.posx = 0;
					metaData.posy = 0;
					metaData.width = dimension.width;
					metaData.height = dimension.height;
					metaData.orgWidth = dimension.width;
					metaData.orgHeight = dimension.height;
					addContent(metaData, image, function (metaData, contentData) {
						sendMetaData(Command.doneAddContent, metaData, socket, ws_connection);
						endCallback();
					});
				}
			});
		} else {
			//console.log(Command.reqAddContent + ":" + metaData);
			addContent(metaData, binaryData, function (metaData, contentData) {
				sendMetaData(Command.doneAddContent, metaData, socket, ws_connection);
				endCallback();
			});
		}
	}
	
	/// do GetContent command
	/**
	 * do GetContent command
	 * @method commandGetContent
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {JSON} json socket.io.on:reqGetContent時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetContent(socket, ws_connection, json, endCallback) {
		//console.log("commandGetContent:" + json.id);
		getMetaData(json.type, json.id, function (meta) {
			if (meta) {
				meta.command = Command.doneGetContent;
				getContent(meta.type, meta.id, function (reply) {
					var binary = metabinary.createMetaBinary(meta, reply);
					sendBinary(Command.doneGetContent, binary, socket, ws_connection);
					endCallback();
				});
			}
		});
	}
	
	/// do GetMetaData command
	/**
	 * do GetMetaData command
	 * @method commandGetMetaData
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {JSON} json socket.io.on:reqGetMetaData時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetMetaData(socket, ws_connection, json, endCallback) {
		//console.log("commandGetMetaData:" + json.type + "/" + json.id);
		getMetaData(json.type, json.id, function (metaData) {
			sendMetaData(Command.doneGetMetaData, metaData, socket, ws_connection);
			endCallback();
		});
	}
	
	/// do DeleteContent command
	/**
	 * do DeleteContent command
	 * @method commandDeleteContent
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {JSON} json socket.io.on:reqDeleteContent時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandDeleteContent(socket, ws_connection, json, endCallback) {
		//console.log("commandDeleteContent:" + json.id);
		deleteContent(json.id, function (id) {
			socket.emit(Command.doneDeleteContent, JSON.stringify({"id" : id}));
			endCallback();
		});
	}
	
	/// do UpdateContent command
	/**
	 * do UpdateContent command
	 * @method commandUpdateContent
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション(null)
	 * @param {Object} metaData loadMetaBinaryから受領したメタデータ
	 * @param {BLOB} binaryData loadMetaBinaryから受領したバイナリデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandUpdateContent(socket, ws_connection, metaData, binaryData, endCallback) {
		//console.log("commandUpdateContent");
		updateContent(metaData, binaryData, function (id) {
			socket.emit(Command.doneUpdateContent, JSON.stringify({"id" : id}));
			endCallback();
		});
	}
	
	/// do UpdateTransform command
	/**
	 * do UpdateTransform command
	 * @method commandUpdateTransform
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {JSON} json socket.io.on:reqUpdateTransform時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandUpdateTransform(socket, ws_connection, json, endCallback) {
		//console.log("commandUpdateTransform:" + json.id);
		setMetaData(json.type, json.id, json, function () {
			socket.emit(Command.doneUpdateTransform, JSON.stringify(json));
			endCallback();
		});
	}
	
	/// do AddWindow command
	/**
	 * do AddWindow command
	 * @method commandAddWindow
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {JSON} json socket.io.on:reqAddWindow時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandAddWindow(socket, ws_connection, json, endCallback) {
		console.log("commandAddWindow : " + JSON.stringify(json));
		var id = -1;
		if (socket) { id = socket.id; }
		if (ws_connection) { id = ws_connection.id; }
		addWindow(id, json, function (windowData) {
			sendMetaData(Command.doneAddWindow, windowData, socket, ws_connection);
			endCallback();
		});
	}
	
	/// do DeleteWindow
	/**
	 * do DeleteWindow
	 * @method commandDeleteWindow
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {JSON} json socket.io.on:reqUpdateWindow時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandDeleteWindow(socket, ws_connection, json, endCallback) {
		var socketid = -1;
		if (socket) { socketid = socket.id; }
		if (ws_connection) { socketid = ws_connection.id; }
		if (json) {
			if (json.hasOwnProperty('type') && json.type === 'all') {
				client.keys(windowPrefix + '*', function (err, replies) {
					var multi = textClient.multi();
					replies.forEach(function (reply, index) {
						multi.del(reply);
					});
					multi.exec(function (err, data) {
						console.log("debugDeleteWindowAll");
						endCallback();
					});
				});
			} else {
				getWindow(json, function (data) {
					deleteWindow(json.id, function () {
						console.log("commandDeleteWindow : " + JSON.stringify(json));
						sendMetaData(Command.doneDeleteWindow, { id: json.id }, socket, ws_connection);
						if (socketidToHash.hasOwnProperty(data.socketid)) {
							delete socketidToHash[data.socketid];
						}
						endCallback();
					});
				});
			}
		} else {
			console.log("commandDeleteWindow : " + socketid);
			deleteWindowBySocketID(socketid, function () {
				sendMetaData(Command.doneDeleteWindow, { socketid: socketid }, socket, ws_connection);
				endCallback();
			});
		}
	}
	
	/// do UpdateVirtualDisplay command
	/**
	 * do UpdateVirtualDisplay command
	 * @method commandUpdateVirtualDisplay
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {JSON} json socket.io.on:XXXXXXXXX時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandUpdateVirtualDisplay(socket, ws_connection, json, endCallback) {
		if (json) {
			setVirtualDisplay(json, function (data) {
				endCallback();
			});
		}
	}
	
	/// do commandGetVirtualDisplay command
	/**
	 * do commandGetVirtualDisplay command
	 * @method commandGetVirtualDisplay
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {JSON} json socket.io.on:XXXXXXXXX時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetVirtualDisplay(socket, ws_connection, json, endCallback) {
		getVirtualDisplay(function (data) {
			sendMetaData(Command.doneGetVirtualDisplay, data, socket, ws_connection);
			endCallback();
		});
	}
	
	/// do GetWindow command
	/**
	 * do GetWindow command
	 * @method commandGetWindow
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {JSON} json socket.io.on:reqGetWindow時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetWindow(socket, ws_connection, json, endCallback) {
		//console.log("commandGetWindow : " + JSON.stringify(json));
		getWindow(json, function (windowData) {
			sendMetaData(Command.doneGetWindow, windowData, socket, ws_connection);
			endCallback();
		});
	}
	
	/// do UpdateWindow command
	/**
	 * do UpdateWindow command
	 * @method commandUpdateWindow
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {JSON} json socket.io.on:reqUpdateWindow時JSONデータ,
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandUpdateWindow(socket, ws_connection, json, endCallback) {
		var id = -1;
		if (socket) { id = socket.id; }
		if (ws_connection) { id = ws_connection.id; }
		updateWindow(id, json, function (windowData) {
			sendMetaData(Command.doneUpdateWindow, windowData, socket, ws_connection);
			endCallback();
		});
	}
	
	/// register socket.io events
	/// @param socket
	/// @param io
	/// @param ws display's ws connection
	/**
	 * Description
	 * @method registerEvent
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} io socket.ioオブジェクト
	 * @param {BLOB} ws WebSocketオブジェクト
	 */
	function registerEvent(socket, io, ws) {
		
		function update() {
			ws.broadcast(Command.update);
			io.sockets.emit(Command.update);
		}
		
		function updateTransform() {
			ws.broadcast(Command.updateTransform);
			io.sockets.emit(Command.updateTransform);
		}
		
		function updateWindow() {
			ws.broadcast(Command.updateWindow);
			io.sockets.emit(Command.updateWindow);
		}
		
		function showWindowID(data) {
			ws.broadcast(Command.showWindowID + ":" + data.id);
			io.sockets.emit(Command.showWindowID, data.id);
		}
		
		/*
		socket.on("message", function (data) {
			metabinary.loadMetaBinary(data, function (metaData, binaryData) {
				commandAddContent(socket, null, metaData, binaryData, update);
			});
		});
		*/
		
		socket.on(Command.reqAddContent, function (data) {
			metabinary.loadMetaBinary(data, function (metaData, binaryData) {
				commandAddContent(socket, null, metaData, binaryData, update);
			});
		});
		
		socket.on(Command.reqGetContent, function (data) {
			var json = JSON.parse(data);
			commandGetContent(socket, null, JSON.parse(data), function () {});
		});
		
		socket.on(Command.reqGetMetaData, function (data) {
			commandGetMetaData(socket, null, JSON.parse(data), function () {});
		});

		socket.on(Command.reqDeleteContent, function (data) {
			commandDeleteContent(socket, null, JSON.parse(data), update);
		});
		
		socket.on(Command.reqUpdateContent, function (data) {
			metabinary.loadMetaBinary(data, function (metaData, binaryData) {
				commandUpdateContent(socket, null, metaData, binaryData, updateTransform);
			});
		});
		
		socket.on(Command.reqUpdateTransform, function (data) {
			commandUpdateTransform(socket, null, JSON.parse(data), updateTransform);
		});

		socket.on(Command.reqAddWindow, function (data) {
			commandAddWindow(socket, null, JSON.parse(data), updateWindow);
		});
		
		socket.on(Command.reqGetWindow, function (data) {
			commandGetWindow(socket, null, JSON.parse(data), function () {});
		});
		
		socket.on(Command.reqUpdateWindow, function (data) {
			commandUpdateWindow(socket, null, JSON.parse(data), updateWindow);
		});
		
		socket.on(Command.reqDeleteWindow, function (data) {
			commandDeleteWindow(socket, null, JSON.parse(data), update);
		});
		
		socket.on(Command.reqUpdateVirtualDisplay, function (data) {
			commandUpdateVirtualDisplay(socket, null, JSON.parse(data), updateWindow);
		});
		
		socket.on(Command.reqGetVirtualDisplay, function (data) {
			commandGetVirtualDisplay(socket, null, JSON.parse(data), function () {});
		});
		
		socket.on(Command.reqShowWindowID, function (data) {
			showWindowID(JSON.parse(data));
		});
		
		getSessionList();
	}
	
	/// register websockets events
	/// @param ws_connection controller's ws connection
	/// @param io
	/// @param ws display's ws instance
	/**
	 * register websockets events
	 * @method registerWSEvent
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {BLOB} io socket.ioオブジェクト
	 * @param {BLOB} ws WebSocketオブジェクト
	 */
	function registerWSEvent(ws_connection, io, ws) {
		
		function update() {
			ws.broadcast(Command.update);
			io.sockets.emit(Command.update);
		}
		
		function updateTransform() {
			ws.broadcast(Command.updateTransform);
			io.sockets.emit(Command.updateTransform);
		}
		
		function updateWindow() {
			ws.broadcast(Command.updateWindow);
			io.sockets.emit(Command.updateWindow);
		}
		
		function showWindowID(data) {
			ws.broadcast(Command.showWindowID + ":" + data.id);
			io.sockets.emit(Command.showWindowID, data.id);
		}
		
		ws_connection.on('message', function (message) {
			var request;
			if (message.type === 'utf8' && message.utf8Data === 'view') { return; }
			
			if (message.type === 'utf8') {
				// json
				request = JSON.parse(message.utf8Data);
				if (request.command === Command.reqGetMetaData) {
					commandGetMetaData(null, ws_connection, request, function () {});
				} else if (request.command === Command.reqGetContent) {
					commandGetContent(null, ws_connection, request, function () {});
				} else if (request.command === Command.reqUpdateTransform) {
					commandUpdateTransform(null, ws_connection, request, updateTransform);
				} else if (request.command === Command.reqAddWindow) {
					commandAddWindow(null, ws_connection, request, updateWindow);
				} else if (request.command === Command.reqGetWindow) {
					commandGetWindow(null, ws_connection, request, function () {});
				} else if (request.command === Command.reqUpdateWindow) {
					commandUpdateWindow(null, ws_connection, request, updateWindow);
				} else if (request.command === Command.reqUpdateVirtualDisplay) {
					commandUpdateVirtualDisplay(null, ws_connection, request, updateWindow);
				} else if (request.command === Command.reqGetVirtualDisplay) {
					commandGetVirtualDisplay(null, ws_connection, request, function () {});
				} else if (request.command === Command.reqShowWindowID) {
					showWindowID(request);
				}
			} else {
				// binary
				metabinary.loadMetaBinary(message.binaryData, function (metaData, binaryData) {
					if (metaData && metaData.hasOwnProperty('command')) {
						request = metaData.command;
						if (request === Command.reqAddContent) {
							console.log(Command.reqAddContent);
							commandAddContent(null, ws_connection, metaData, binaryData, update);
						} else if (request === Command.reqDeleteContent) {
							commandDeleteContent(null, ws_connection, metaData, update);
						} else if (request === Command.reqUpdateContent) {
							commandUpdateContent(null, ws_connection, metaData, binaryData, updateTransform);
						}
					}
				});
			}
		});
	}
	
	/// @param id server's id
	/**
	 * registerUUID.
	 * @method registerUUID
	 * @param {String} id ContentsID
	 */
	function registerUUID(id) {
		uuidPrefix = id + ":";
		client.sadd(frontPrefix + 'sessions', id);
		contentIDStr = frontPrefix + "s:" + uuidPrefix + contentIDStr;
		windowIDStr = frontPrefix + "s:" + uuidPrefix + windowIDStr;
		contentPrefix = frontPrefix + "s:" + uuidPrefix + contentPrefix;
		metadataPrefix = frontPrefix + "s:" + uuidPrefix + metadataPrefix;
		windowPrefix = frontPrefix + "s:" + uuidPrefix + windowPrefix;
		virtualDisplayIDStr = frontPrefix + "s:" + uuidPrefix + virtualDisplayIDStr;
		console.log("idstr:" + contentIDStr);
		console.log("idstr:" + contentPrefix);
		console.log("idstr:" + metadataPrefix);
		console.log("idstr:" + windowPrefix);
		textClient.setnx(contentIDStr, 0);
		textClient.setnx(windowIDStr, 0);
	}
	
	Operator.prototype.getContent = getContent;
	Operator.prototype.registerEvent = registerEvent;
	Operator.prototype.registerWSEvent = registerWSEvent;
	Operator.prototype.registerUUID = registerUUID;
	Operator.prototype.commandDeleteWindow = commandDeleteWindow;
	Operator.prototype.commandGetContent = commandGetContent;
	Operator.prototype.commandGetMetaData = commandGetMetaData;
	Operator.prototype.commandGetWindow = commandGetWindow;
	Operator.prototype.commandAddWindow = commandAddWindow;
	module.exports = new Operator();
}());
