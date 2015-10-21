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
		contentRefPrefix = "contentref:",
		windowMetaDataPrefix = "window_metadata:",
		windowContentPrefix = "window_content:",
		io_connector = require('./io_connector.js'),
		ws_connector = require('./ws_connector.js'),
		util = require('./util.js'),
		Command = require('./command.js'),
		path = require('path'),
		fs = require('fs'),
		phantomjs = require('phantomjs'),
		frontPrefix = "tiled_server:t:",
		uuidPrefix = "invalid:",
		socketidToHash = {},
		methods;
	
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
					if (endCallback) {
						endCallback(fs.readFileSync(output), dimensions);
					}
				});
			} else if (endCallback) {
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
			if (doesExist.toString() === "1") {
				generateContentID(endCallback);
			} else if (endCallback) {
				endCallback(id);
			}
		});
	}
	
	/**
	 * MetaDataID生成
	 * @method generateMetaDataID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function generateMetaDataID(endCallback) {
		var id = util.generateUUID8();
		console.log("newid: " + id);
		client.exists(metadataPrefix + id, function (err, doesExist) {
			if (err) {
				console.log(err);
				return;
			}
			if (doesExist.toString() === "1") {
				generateContentID(endCallback);
			} else if (endCallback) {
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
		client.exists(windowMetaDataPrefix + id, function (err, doesExist) {
			if (err) {
				console.log(err);
				return;
			}
			if (doesExist.toString() === 1) {
				generateWindowID(endCallback);
			} else if (endCallback) {
				endCallback(id);
			}
		});
	}
	
	/**
	 * 指定されたタイプ、idのメタデータ設定
	 * @method setMetaData
	 * @param {String} type メタデータタイプ
	 * @param {String} id ContentsID
	 * @param {JSON} data メタデータ
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
			} else if (endCallback) {
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
						if (endCallback) {
							endCallback(data);
						}
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
					if (endCallback) {
						endCallback(data);
					}
				}
			});
		}
	}
	
	function isInvalidImageSize(metaData) {
		if (!metaData.hasOwnProperty('width') || isNaN(metaData.width)) {
			return true;
		}
		if (!metaData.hasOwnProperty('height') || isNaN(metaData.height)) {
			return true;
		}
		if (metaData.width <= 0 || metaData.height <= 0) {
			return true;
		}
		return false;
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
							if (endCallback) {
								endCallback(reply);
							}
						} else {
							console.log(err);
						}
					});
				});
			});
		} else {
			client.get(contentPrefix + id, function (err, reply) {
				if (!err) {
					if (endCallback) {
						endCallback(reply);
					}
				} else {
					console.log(err);
				}
			});
		}
	}
	
	
	/**
	 * メタデータ追加
	 * @method addMetaData
	 * @param {Object} metaData メタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function addMetaData(metaData, endCallback) {
		generateMetaDataID(function (id) {
			if (metaData.hasOwnProperty('id') && metaData.id !== "") {
				id = metaData.id;
			}
			metaData.id = id;
			if (metaData.hasOwnProperty('content_id') && metaData.content_id !== "") {
				client.exists(contentPrefix + metaData.content_id, function (err, doesExists) {
					if (!err && doesExists.toString() === "1") {
						getContent('', metaData.content_id, function (contentData) {
							var dimensions;
							metaData.orgWidth = metaData.width;
							metaData.orgHeight = metaData.height;

							if (metaData.type === 'text') {
								metaData.mime = "text/plain";
							} else if (metaData.type === 'image') {
								metaData.mime = util.detectImageType(contentData);
							} else if (metaData.type === 'url') {
								metaData.mime = util.detectImageType(contentData);
							} else {
								console.log("Error undefined type:" + metaData.type);
							}

							if (!metaData.hasOwnProperty('zIndex')) {
								metaData.zIndex = 0;
							}
							if (metaData.type === 'image') {
								if (isInvalidImageSize(metaData)) {
									dimensions = image_size(contentData);
									metaData.width = dimensions.width;
									metaData.height = dimensions.height;
									metaData.orgWidth = metaData.width;
									metaData.orgHeight = metaData.height;
								}
							}
							setMetaData(metaData.type, id, metaData, function (metaData) {
								// 参照カウント.
								textClient.setnx(contentRefPrefix + metaData.content_id, 0);
								textClient.incr(contentRefPrefix + metaData.content_id);

								if (endCallback) {
									endCallback(metaData);
								}
							});
						});
					} else {
						setMetaData(metaData.type, id, metaData, function (metaData) {
							if (endCallback) {
								endCallback(metaData);
							}
						});
					}
				});
			} else {
				setMetaData(metaData.type, id, metaData, function (metaData) {
					if (endCallback) {
						endCallback(metaData);
					}
				});
			}
		});
	}
						   
	/**
	 * コンテンツ追加
	 * @method addContent
	 * @param {Object} metaData メタデータ
	 * @param {BLOB} data バイナリデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function addContent(metaData, data, endCallback) {
		var contentData = data;
		if (metaData.type === 'text') {
			metaData.mime = "text/plain";
		} else if (metaData.type === 'image') {
			metaData.mime = util.detectImageType(contentData);
		} else if (metaData.type === 'url') {
			metaData.mime = util.detectImageType(contentData);
		} else {
			console.log("Error undefined type:" + metaData.type);
		}
		
		console.log("mime:" + metaData.mime);
		
		addMetaData(metaData, function (metaData) {
			generateContentID(function (content_id) {
				if (metaData.hasOwnProperty('content_id') && metaData.content_id !== "") {
					content_id = metaData.content_id;
				}
				metaData.content_id = content_id;
				
				client.set(contentPrefix + content_id, contentData, function (err, reply) {
					if (err) {
						console.log("Error on addContent:" + err);
					} else {
						redis.print(err, reply);
						
						// 参照カウント.
						textClient.setnx(contentRefPrefix + content_id, 0);
						textClient.incr(contentRefPrefix + content_id);

						setMetaData(metaData.type, metaData.id, metaData, function (metaData) {
							if (endCallback) {
								endCallback(metaData, contentData);
							}
						});
					}
				});
			});
		});
	}
	
	function deleteMetaData(metaData, endCallback) {
		client.exists(metadataPrefix + metaData.id, function (err, doesExist) {
			if (!err && doesExist.toString() === "1") {
				client.del(metadataPrefix + metaData.id, function (err) {
					console.log("deleteMetadata");
					if (endCallback) {
						endCallback(err, metaData);
					}
				});
			} else {
				console.error(err);
			}
		});
	}
	
	/**
	 * 指定されたidのコンテンツ削除
	 * @method deleteContent
	 * @param {String} id ContentsID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function deleteContent(metaData, endCallback) {
		deleteMetaData(metaData, function (err, metaData) {
			if (!err) {
				console.log("deleteContent", metaData);
				if (metaData.hasOwnProperty('content_id') && metaData.content_id !== '') {
					client.exists(contentPrefix + metaData.content_id, function (err, doesExist) {
						if (!err && doesExist.toString() === "1") {
							textClient.decr(contentRefPrefix + metaData.content_id, function (err, value) {
								if (value.toString() === '0') {
									console.log("reference count zero. delete content");
									client.del(contentPrefix + metaData.content_id, function (err) {
										if (!err) {
											textClient.del(contentRefPrefix + metaData.content_id);
											if (endCallback) {
												endCallback(metaData);
											}
										} else {
											console.error(err);
										}
									});
								} else {
									endCallback(metaData);
								}
							});
						}
					});
				}
			} else {
				console.error(err);
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
		console.log("updateContent:" + metaData.id + ":" + metaData.content_id);
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
		
		client.exists(contentPrefix + metaData.content_id, function (err, doesExist) {
			if (!err && doesExist.toString() === "1") {
				client.set(contentPrefix + metaData.content_id, contentData, function (err, reply) {
					if (err) {
						console.log("Error on updateContent:" + err);
					} else {
						redis.print(err, reply);
						//setMetaData(metaData.type, metaData.id, metaData, function (metaData) {
						if (endCallback) {
							endCallback(metaData);
						}
						//});
					}
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
		console.log("add window", windowData);
		generateWindowID(function (id) {
			if (windowData.hasOwnProperty('id') && windowData.id !== "") {
				id = windowData.id;
			}
			windowData.id = id;
			socketidToHash[socketid] = id;
			console.log("registerWindow: " + id);
			textClient.hexists(windowMetaDataPrefix + id, function (err, reply) {
				if (reply === 1) {
					windowData.socketid = socketid;
					windowData.type = "window";
					textClient.hmset(windowMetaDataPrefix + id, windowData, (function (textClient, id) {
						return function (err, reply) {
							textClient.hgetall(windowMetaDataPrefix + id, function (err, reply) {
								if (endCallback) {
									endCallback(reply);
								}
							});
						};
					}(textClient, id)));
				} else {
					windowData.socketid = socketid;
					windowData.orgWidth = windowData.width;
					windowData.orgHeight = windowData.height;
					windowData.type = "window";
					textClient.hmset(windowMetaDataPrefix + id, windowData, (function (textClient, id) {
						return function (err, reply) {
							textClient.hgetall(windowMetaDataPrefix + id, function (err, reply) {
								if (endCallback) {
									endCallback(reply);
								}
							});
						};
					}(textClient, id)));
				}
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
				if (endCallback) {
					endCallback(windowData);
				}
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
			if (endCallback) {
				if (data) {
					endCallback(data);
				} else {
					endCallback({});
				}
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
		client.del(windowMetaDataPrefix + id, function (err) {
			if (err) {
				console.log(err);
			} else {
				console.log("unregister window id:" + id);
			}
			if (endCallback) {
				endCallback();
			}
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
			client.del(windowMetaDataPrefix + id, function (err) {
				if (err) {
					console.log(err);
				} else {
					console.log("unregister window socketid:" + socketid + ", id:" + id);
				}
				if (endCallback) {
					endCallback();
				}
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
			textClient.keys(windowMetaDataPrefix + '*', function (err, replies) {
				replies.forEach(function (id, index) {
					//console.log("getWindowAllID:" + id);
					textClient.hgetall(id, function (err, reply) {
						if (!err) {
							if (endCallback) {
								endCallback(reply);
							}
						} else {
							console.log(err);
						}
					});
				});
			});
		} else {
			textClient.hgetall(windowMetaDataPrefix + windowData.id, function (err, data) {
				if (data) {
					if (endCallback) {
						endCallback(data);
					}
				}
			});
		}
	}
	
	/**
	 * Window更新
	 * @method updateWindow
	 * @param {BLOB} socketid socket.ioオブジェクトid
	 * @param {JSON} windowData windowメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function updateWindow(socketid, windowData, endCallback) {
		if (!windowData.hasOwnProperty("id")) { return; }
		textClient.hmset(windowMetaDataPrefix + windowData.id, windowData, function (err, reply) {
			if (endCallback) {
				endCallback(windowData);
			}
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
	
	function addContentCore(metaData, binaryData, endCallback) {
		if (metaData.type === 'url') {
			renderURL(binaryData, function (image, dimension) {
				if (image) {
					metaData.posx = 0;
					metaData.posy = 0;
					metaData.width = dimension.width;
					metaData.height = dimension.height;
					metaData.orgWidth = dimension.width;
					metaData.orgHeight = dimension.height;
					addContent(metaData, image, function (metaData, contentData) {
						if (endCallback) {
							endCallback(null, metaData);
						}
					});
				}
			});
		} else {
			addContent(metaData, binaryData, function (metaData, contentData) {
				if (endCallback) {
					endCallback(null, metaData);
				}
			});
		}
	}
	
	/**
	 * コンテンツの追加を行うコマンドを実行する.
	 * @method commandAddContent
	 * @param {Object} metaData メタデータ
	 * @param {BLOB} binaryData バイナリデータ
	 * @param {Function} endCallback コンテンツ新規追加した場合に終了時に呼ばれるコールバック
	 * @param {Function} updateEndCallback コンテンツ差し替えした場合に終了時に呼ばれるコールバック
	 */
	function commandAddContent(metaData, binaryData, endCallback, updateEndCallback) {
		console.log("commandAddContent", metaData, binaryData);
		
		if (metaData.hasOwnProperty('id') && metaData.id !== "") {
			client.exists(metadataPrefix + metaData.id, function (err, doesExists) {
				if (!err && doesExists.toString() === "1") {
					getMetaData('', metaData.id, function (meta) {
						var oldContentID,
							newContentID;
						if (metaData.hasOwnProperty('content_id')) {
							oldContentID = metaData.content_id;
						}
						if (meta.hasOwnProperty('content_id')) {
							newContentID = meta.content_id;
						}
						if (newContentID !== '' && oldContentID === newContentID) {
							updateContent(meta, binaryData, function (reply) {
								if (updateEndCallback) {
									updateEndCallback(null, reply);
								}
							});
						} else {
							addContentCore(meta, binaryData, endCallback);
						}
					});
				} else {
					addContentCore(metaData, binaryData, endCallback);
				}
			});
		} else {
			addContentCore(metaData, binaryData, endCallback);
		}
	}
	
	/**
	 * コンテンツの取得を行うコマンドを実行する.
	 * @method commandGetContent
	 * @param {JSON} json socket.io.on:GetContent時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetContent(json, endCallback) {
		console.log("commandGetContent:" + json.id);
		getMetaData(json.type, json.id, function (meta) {
			if (meta && meta.hasOwnProperty('content_id') && meta.content_id !== '') {
				//meta.command = Command.doneGetContent;
				getContent(meta.type, meta.content_id, function (reply) {
					if (reply === null) {
						reply = "";
					}
					endCallback(null, meta, reply);
				});
			}
		});
	}
	
	/**
	 * メタデータの追加を行うコマンドを実行する.
	 * @method commandGetMetaData
	 * @param {JSON} json socket.io.on:GetMetaData時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandAddMetaData(json, endCallback) {
		console.log("commandAddMetaData:", json);
		addMetaData(json, function (metaData) {
			if (endCallback) {
				endCallback(null, metaData);
			}
		});
	}
	
	/**
	 * メタデータの取得を行うコマンドを実行する.
	 * @method commandGetMetaData
	 * @param {JSON} json socket.io.on:GetMetaData時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetMetaData(json, endCallback) {
		console.log("commandGetMetaData:" + json.type + "/" + json.id);
		getMetaData(json.type, json.id, function (metaData) {
			if (endCallback) {
				endCallback(null, metaData);
			}
		});
	}
	
	/**
	 * コンテンツの削除を行うコマンドを実行する.
	 * @method commandDeleteContent
	 * @param {JSON} json socket.io.on:DeleteContent時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandDeleteContent(json, endCallback) {
		console.log("commandDeleteContent:" + json.id);
		deleteContent(json, function (metaData) {
			//socket.emit(Command.doneDeleteContent, JSON.stringify({"id" : id}));
			if (endCallback) {
				endCallback(null, metaData);
			}
		});
	}
	
	/**
	 * コンテンツの更新を行うコマンドを実行する.
	 * @method commandUpdateContent
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション(null)
	 * @param {Object} metaData loadMetaBinaryから受領したメタデータ
	 * @param {BLOB} binaryData loadMetaBinaryから受領したバイナリデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandUpdateContent(metaData, binaryData, endCallback) {
		//console.log("commandUpdateContent");
		updateContent(metaData, binaryData, function (meta) {
			// socket.emit(Command.doneUpdateContent, JSON.stringify({"id" : id}));
			if (endCallback) {
				endCallback(null, meta);
			}
		});
	}
	
	/**
	 * メタデータの更新を行うコマンドを実行する.
	 * @method commandUpdateMetaData
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {JSON} json socket.io.on:UpdateMetaData時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandUpdateMetaData(json, endCallback) {
		//console.log("commandUpdateMetaData:" + json.id);
		setMetaData(json.type, json.id, json, function (meta) {
			if (endCallback) {
				endCallback(null, meta);
			}
		});
	}
	
	/**
	 * ウィンドウの追加を行うコマンドを実行する.
	 * @method commandAddWindow
	 * @param {String} socketid ソケットID
	 * @param {JSON} json socket.io.on:AddWindow時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandAddWindow(socketid, json, endCallback) {
		console.log("commandAddWindow : " + JSON.stringify(json));
		addWindow(socketid, json, function (windowData) {
			if (endCallback) {
				endCallback(null, windowData);
			}
		});
	}
	
	/**
	 * ウィンドウの削除行うコマンドを実行する.
	 * @method commandDeleteWindow
	 * @param {String} socketid ソケットID
	 * @param {JSON} json socket.io.on:UpdateWindow時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandDeleteWindow(socketid, json, endCallback) {
		if (json) {
			if (json.hasOwnProperty('type') && json.type === 'all') {
				client.keys(windowMetaDataPrefix + '*', function (err, replies) {
					var multi = textClient.multi();
					replies.forEach(function (reply, index) {
						multi.del(reply);
					});
					multi.exec(function (err, data) {
						console.log("debugDeleteWindowAll");
					});
					if (endCallback) {
						endCallback(null, {});
					}
				});
			} else {
				getWindow(json, function (data) {
					deleteWindow(json.id, function () {
						console.log("commandDeleteWindow : " + JSON.stringify(json));
						if (endCallback) {
							endCallback(null, { id: json.id });
						}
						if (socketidToHash.hasOwnProperty(data.socketid)) {
							delete socketidToHash[data.socketid];
						}
					});
				});
			}
		} else {
			console.log("commandDeleteWindow : " + socketid);
			deleteWindowBySocketID(socketid, function () {
				if (endCallback) {
					endCallback(null, { socketid: socketid });
				}
			});
		}
	}
	
	/**
	 * VirtualDisplayの更新を行うコマンドを実行する.
	 * @method commandUpdateVirtualDisplay
	 * @param {String} socketid ソケットID
	 * @param {JSON} json socket.io.on:XXXXXXXXX時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandUpdateVirtualDisplay(socketid, json, endCallback) {
		if (json) {
			setVirtualDisplay(json, function (data) {
				if (endCallback) {
					endCallback(null, data);
				}
			});
		}
	}
	
	/**
	 * VirtualDisplayの取得を行うコマンドを実行する.
	 * @method commandGetVirtualDisplay
	 * @param {String} socketid ソケットID
	 * @param {JSON} json socket.io.on:XXXXXXXXX時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetVirtualDisplay(socketid, json, endCallback) {
		getVirtualDisplay(function (data) {
			console.log("commandGetVirtualDisplay", data);
			if (endCallback) {
				endCallback(null, data);
			}
		});
	}
	
	/**
	 * ウィンドウの取得を行うコマンドを実行する.
	 * @method commandGetWindowMetaData
	 * @param {String} socketid ソケットID
	 * @param {JSON} json socket.io.on:GetWindow時JSONデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetWindowMetaData(socketid, json, endCallback) {
		//console.log("commandGetWindowMetaData : " + JSON.stringify(json));
		getWindow(json, function (windowData) {
			console.log("doneGetWindow:", windowData);
			if (endCallback) {
				endCallback(null, windowData);
			}
		});
	}
	
	/**
	 * ウィンドウの更新を行うコマンドを実行する.
	 * @method commandUpdateWindow
	 * @param {String} socketid ソケットID
	 * @param {JSON} json socket.io.on:UpdateWindow時JSONデータ,
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandUpdateWindow(socketid, json, endCallback) {
		updateWindow(socketid, json, function (windowData) {
			endCallback(null, windowData);
		});
	}
	
	/**
	 * websocketイベントの登録を行う.
	 * register websockets events
	 * @method registerWSEvent
	 * @param {String} socketid ソケットID
	 * @param {BLOB} ws_connection WebSocketコネクション
	 * @param {BLOB} io socket.ioオブジェクト
	 * @param {BLOB} ws WebSocketオブジェクト
	 */
	function registerWSEvent(socketid, ws_connection, io, ws) {
		var methods = {},
			post_update = (function (ws, io) {
				return function (resultCallback) {
					return function (err, reply) {
						ws_connector.broadcast(ws, Command.Update);
						io_connector.broadcast(io, Command.Update);
						if (resultCallback) {
							resultCallback(err, reply);
						}
					};
				};
			}(ws, io)),
			post_updateMetaData = (function (ws, io) {
				return function (resultCallback) {
					return function (err, reply) {
						ws_connector.broadcast(ws, Command.UpdateMetaData, reply);
						io_connector.broadcast(io, Command.UpdateMetaData, reply);
						if (resultCallback) {
							resultCallback(err, reply);
						}
					};
				};
			}(ws, io)),
			post_updateContent = (function (ws, io) {
				return function (resultCallback) {
					return function (err, reply) {
						ws_connector.broadcast(ws, Command.UpdateContent, reply);
						io_connector.broadcast(io, Command.UpdateContent, reply);
						if (resultCallback) {
							resultCallback(err, reply);
						}
					};
				};
			}(ws, io)),
			post_deletecontent = (function (ws, io) {
				return function (resultCallback) {
					return function (err, reply) {
						ws_connector.broadcast(ws, Command.DeleteContent, reply);
						io_connector.broadcast(io, Command.DeleteContent, reply);
						if (resultCallback) {
							resultCallback(err, reply);
						}
					};
				};
			}(ws, io)),
			post_updateWindow = (function (ws, io) {
				return function (resultCallback) {
					return function (err, reply) {
						ws_connector.broadcast(ws, Command.UpdateWindow, reply);
						io_connector.broadcast(io, Command.UpdateWindow, reply);
						if (resultCallback) {
							resultCallback(err, reply);
						}
					};
				};
			}(ws, io));

		console.log("registerWSEvent");
		
		ws_connector.on(Command.AddMetaData, function (data, resultCallback) {
			commandAddMetaData(data, resultCallback);
		});
		
		ws_connector.on(Command.GetMetaData, function (data, resultCallback) {
			commandGetMetaData(data, resultCallback);
		});

		ws_connector.on(Command.GetContent, function (data, resultCallback) {
			commandGetContent(data, resultCallback);
		});
		
		ws_connector.on(Command.UpdateMetaData, function (data, resultCallback) {
			commandUpdateMetaData(data, post_updateMetaData(resultCallback));
		});
		
		ws_connector.on(Command.AddWindow, function (data, resultCallback) {
			commandAddWindow(socketid, data, post_updateWindow(resultCallback));
		});
		
		ws_connector.on(Command.GetWindowMetaData, function (data, resultCallback) {
			commandGetWindowMetaData(socketid, data, resultCallback);
		});
		
		ws_connector.on(Command.UpdateWindow, function (data, resultCallback) {
			commandUpdateWindow(socketid, data, post_updateWindow(resultCallback));
		});
		
		ws_connector.on(Command.UpdateVirtualDisplay, function (data, resultCallback) {
			commandUpdateVirtualDisplay(socketid, data, post_updateWindow(resultCallback));
		});
		
		ws_connector.on(Command.GetVirtualDisplay, function (data, resultCallback) {
			commandGetVirtualDisplay(socketid, data, resultCallback);
		});
		
		ws_connector.on(Command.ShowWindowID, function (data, resultCallback) {
			ws_connector.broadcast(ws, Command.ShowWindowID, {id : data.id});
			io_connector.broadcast(io, Command.ShowWindowID, {id : data.id});
			if (resultCallback) {
				resultCallback();
			}
		});
		
		ws_connector.on(Command.AddContent, function (data, resultCallback) {
			var metaData = data.metaData,
				binaryData = data.contentData;
			console.log(Command.AddContent, data);
			commandAddContent(metaData, binaryData, post_update(resultCallback), post_updateContent(resultCallback));
		});
		
		ws_connector.on(Command.DeleteContent, function (data, resultCallback) {
			var metaData = data.metaData,
				binaryData = data.contentData;
			commandDeleteContent(metaData, post_deletecontent(resultCallback));
		});
		
		ws_connector.on(Command.UpdateContent, function (data, resultCallback) {
			var metaData = data.metaData,
				binaryData = data.contentData;
			commandUpdateContent(metaData, binaryData, post_updateContent(resultCallback));
		});

		getSessionList();
		ws_connector.registerEvent(ws, ws_connection);
	}
	
	/**
	 * socketioイベントの登録を行う.
	 * @method registerEvent
	 * @param {String} socketid ソケットID
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} io socket.ioオブジェクト
	 * @param {BLOB} ws WebSocketオブジェクト
	 */
	function registerEvent(socketid, io, socket, ws) {
		var methods = {},
			post_update = (function (ws, io) {
				return function (resultCallback) {
					return function (err, reply) {
						ws_connector.broadcast(ws, Command.Update);
						io_connector.broadcast(io, Command.Update);
						if (resultCallback) {
							resultCallback(err, reply);
						}
					};
				};
			}(ws, io)),
			post_updateMetaData = (function (ws, io) {
				return function (resultCallback) {
					return function (err, reply) {
						ws_connector.broadcast(ws, Command.UpdateMetaData, reply);
						io_connector.broadcast(io, Command.UpdateMetaData, reply);
						if (resultCallback) {
							resultCallback(err, reply);
						}
					};
				};
			}(ws, io)),
			post_updateContent = (function (ws, io) {
				return function (resultCallback) {
					return function (err, reply) {
						ws_connector.broadcast(ws, Command.UpdateContent, reply);
						io_connector.broadcast(io, Command.UpdateContent, reply);
						if (resultCallback) {
							resultCallback(err, reply);
						}
					};
				};
			}(ws, io)),
			post_deleteContent = (function (ws, io) {
				return function (resultCallback) {
					return function (err, reply) {
						ws_connector.broadcast(ws, Command.DeleteContent, reply);
						io_connector.broadcast(io, Command.DeleteContent, reply);
						if (resultCallback) {
							resultCallback(err, reply);
						}
					};
				};
			}(ws, io)),
			post_updateWindow = (function (ws, io) {
				return function (resultCallback) {
					return function (err, reply) {
						ws_connector.broadcast(ws, Command.UpdateWindow, reply);
						io_connector.broadcast(io, Command.UpdateWindow, reply);
						if (resultCallback) {
							resultCallback(err, reply);
						}
					};
				};
			}(ws, io));

		io_connector.on(Command.AddContent, function (data, resultCallback) {
			var metaData = data.metaData,
				binaryData = data.contentData;
			commandAddContent(metaData, binaryData, post_update(resultCallback), post_updateContent(resultCallback));
		});

		io_connector.on(Command.AddMetaData, function (data, resultCallback) {
			commandAddMetaData(data, resultCallback);
		});
		
		io_connector.on(Command.GetContent, function (data, resultCallback) {
			commandGetContent(data, resultCallback);
		});

		io_connector.on(Command.GetMetaData, function (data, resultCallback) {
			commandGetMetaData(data, resultCallback);
		});

		io_connector.on(Command.DeleteContent, function (data, resultCallback) {
			commandDeleteContent(data, post_deleteContent(resultCallback));
		});

		io_connector.on(Command.UpdateContent, function (data, resultCallback) {
			var metaData = data.metaData,
				binaryData = data.contentData;
			
			commandUpdateContent(metaData, binaryData, post_updateContent(resultCallback));
		});

		io_connector.on(Command.UpdateMetaData, function (data, resultCallback) {
			commandUpdateMetaData(data, post_updateMetaData(resultCallback));
		});

		io_connector.on(Command.AddWindow, function (data, resultCallback) {
			commandAddWindow(socketid, data, post_updateWindow(resultCallback));
		});

		io_connector.on(Command.GetWindowMetaData, function (data, resultCallback) {
			commandGetWindowMetaData(socketid, data, resultCallback);
		});

		io_connector.on(Command.UpdateWindow, function (data, resultCallback) {
			commandUpdateWindow(socketid, data, post_updateWindow(resultCallback));
		});

		io_connector.on(Command.DeleteWindow, function (data, resultCallback) {
			commandDeleteWindow(socketid, data, post_update(resultCallback));
		});

		io_connector.on(Command.UpdateVirtualDisplay, function (data, resultCallback) {
			commandUpdateVirtualDisplay(socketid, data, post_updateWindow(resultCallback));
		});

		io_connector.on(Command.GetVirtualDisplay, function (data, resultCallback) {
			commandGetVirtualDisplay(socketid, data, resultCallback);
		});

		io_connector.on(Command.ShowWindowID, function (data, resultCallback) {
			ws_connector.broadcast(ws, Command.ShowWindowID, { id : data.id });
			io_connector.broadcast(io, Command.ShowWindowID, { id : data.id });
		});

		io_connector.registerEvent(io, socket);
	}
	
	/**
	 * UUIDを登録する.
	 * @method registerUUID
	 * @param {String} id UUID
	 */
	function registerUUID(id) {
		uuidPrefix = id + ":";
		client.sadd(frontPrefix + 'sessions', id);
		contentPrefix = frontPrefix + uuidPrefix + contentPrefix;
		contentRefPrefix = frontPrefix + uuidPrefix + contentRefPrefix;
		metadataPrefix = frontPrefix + uuidPrefix + metadataPrefix;
		windowMetaDataPrefix = frontPrefix + uuidPrefix + windowMetaDataPrefix;
		virtualDisplayIDStr = frontPrefix + uuidPrefix + virtualDisplayIDStr;
		console.log("idstr:" + contentPrefix);
		console.log("idstr:" + contentRefPrefix);
		console.log("idstr:" + metadataPrefix);
		console.log("idstr:" + windowMetaDataPrefix);
	}
	
	Operator.prototype.getContent = getContent;
	Operator.prototype.registerEvent = registerEvent;
	Operator.prototype.registerWSEvent = registerWSEvent;
	Operator.prototype.registerUUID = registerUUID;
	Operator.prototype.commandDeleteWindow = commandDeleteWindow;
	Operator.prototype.commandGetContent = commandGetContent;
	Operator.prototype.commandGetMetaData = commandGetMetaData;
	Operator.prototype.commandGetWindowMetaData = commandGetWindowMetaData;
	Operator.prototype.commandAddWindow = commandAddWindow;
	module.exports = new Operator();
}());
