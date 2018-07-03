/*jslint devel:true*/
/*global module, require, socket */

(function () {
	"use strict";
	
	/**
	 * Operator生成
	 * @method Operator
	 */
	var Operator = function () {},
		cryptkey = "ChOWDERCRYPTKEY",
		redis = require("redis"),
		image_size = require('image-size'),
		client = redis.createClient(6379, '127.0.0.1', {'return_buffers': true}),
		textClient = redis.createClient(6379, '127.0.0.1', {'return_buffers': false}),
		contentIDStr = "content_id",
		windowIDStr = "window_id",
		virtualDisplayIDStr = "virtual_display",
		metadataPrefix = "metadata:",
		metadataBackupPrefix = "metadata_backup:",
		contentPrefix = "content:",
		contentBackupPrefix = "content_backup:",
		contentRefPrefix = "contentref:",
		windowContentRefPrefix = "window_contentref:",
		windowMetaDataPrefix = "window_metadata:",
		windowContentPrefix = "window_content:",
		groupListPrefix = "grouplist",
		adminListPrefix = "adminlist",
		globalSettingPrefix = "global_setting",
		groupUserPrefix = "group_user",
		adminUserPrefix = "admin_user",
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
		socketidToAccessAuthority = {},
		socketidToUserID = {},
		socketidToLoginKey = {},
		methods,
        connectionId = {},
        connectionCount = 0,
		userSettingKeys = [
			"viewable",
			"editable",
			"group_manipulatable",
			"display_manipulatable"
		];
	
	client.on('error', function (err) {
		console.log('Error ' + err);
	});

	function renderURLInternal(command, endCallback) {
		var command;
		var output = "out.png";
		if (command.length > 4) {
			output = "out" + command[5] + ".png";
			command[2] = output;
		}
		util.launchApp(command, null, function () {
			if (fs.existsSync(output)) {
				image_size(output, function (err, dimensions) {
					if (endCallback) {
						if (dimensions.height > 4000) {
							command.push(dimensions.width);
							command.push(4000);
							renderURLInternal(command, endCallback);
						} else {
							endCallback(fs.readFileSync(output), dimensions);
						}
					}
				});
			} else if (endCallback) {
				endCallback(null);
			}
		});
	}
	
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
		renderURLInternal(command, endCallback);
	}
	
	function generateID(prefix, endCallback) {
		var id = util.generateUUID8();
		console.log("newid: " + id);
		textClient.exists(prefix + id, function (err, doesExist) {
			if (err) {
				console.log(err);
				return;
			}
			if (doesExist === 1) {
				generateID(prefix, endCallback);
			} else if (endCallback) {
				endCallback(id);
			}
		});
	}
	
	/**
	 * ContentID生成。generateUUID8を用いる。
	 * @method generateContentID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function generateContentID(endCallback) {
		generateID(contentPrefix, endCallback);
	}
	
	/**
	 * MetaDataID生成
	 * @method generateMetaDataID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function generateMetaDataID(endCallback) {
		generateID(metadataPrefix, endCallback);
	}
	
	/**
	 * WindowID生成。generateUUID8を用いる。
	 * @method generateWindowMetaDataID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function generateWindowMetaDataID(endCallback) {
		generateID(windowMetaDataPrefix, endCallback);
	}
	
	/**
	 * WindowID生成。generateUUID8を用いる。
	 * @method generateWindowContentID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function generateWindowContentID(endCallback) {
		generateID(windowContentPrefix, endCallback);
	}

	/**
	 * グループリストの取得. ない場合は空がendcallbackにわたる.
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function getGroupList(endCallback) {
		textClient.exists(groupListPrefix, function (err, doesExists) {
			if (!err && doesExists !== 0)  {
				textClient.get(groupListPrefix, function (err, reply) {
					var data = reply;
					if (!reply) {
						data = { "grouplist" : [] };
						endCallback(err, data);
						return;
					}
					try {
						data = JSON.parse(data);
					} catch (e) {
						return false;
					}
					endCallback(err, data);
				});
			} else {
				var data = { "grouplist" : [] };
				endCallback(null, data);
			}
		});
	}

	function getAdminList(endCallback) {
		textClient.exists(adminListPrefix, function (err, doesExists) {
			if (!err && doesExists !== 0)  {
				textClient.get(adminListPrefix, function (err, reply) {
					var data = reply;
					if (!reply) {
						data = { "adminlist" : [] };
						endCallback(err, data);
						return;
					}
					try {
						data = JSON.parse(data);
					} catch (e) {
						return false;
					}
					endCallback(err, data);
				});
			} else {
				var data = { "adminlist" : [] };
				endCallback(null, data);
			}
		});
	}

	function getGroupIndex(groupList, id) {
		var i;
		for (i = 0; i < groupList.length; i = i + 1) {
			if (groupList[i].id === id) {
				return i;
			}
		}
		return -1;
	}

	function getGroupIndexByName(groupList, name) {
		var i;
		for (i = 0; i < groupList.length; i = i + 1) {
			if (groupList[i].name === name) {
				return i;
			}
		}
		return -1;
	}

	/**
	 * グループリストにgroupを追加
	 * @param {String} id グループid. nullの場合自動割り当て.
	 * @param {String} groupName グループ名.
	 * @param {String} color グループ色.
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function addGroup(socketid, groupID, groupName, color, endCallback) {
		getGroupList(function (err, data) {
			var index = getGroupIndexByName(data.grouplist, groupName);
			if (index >= 0) {
				if (endCallback) {
					endCallback("Detect same group name");
				}
				return;
			}
			if (groupID) {
				data.grouplist.push({ name : groupName, color : color, id : groupID });
			} else {
				data.grouplist.push({ name : groupName, color : color, id : util.generateUUID8() });
			}
			textClient.set(groupListPrefix, JSON.stringify(data), function () {
				getGroupID(groupName, function (id) {
					// グループ設定を追加する.
					changeGroupUserSetting(socketid, id, {
						viewable : [id],
						editable : [id],
						group_manipulatable : false,
						display_manipulatable : true
					}, function (err, reply) {
						if (endCallback) {
							endCallback(err, id);
						}
					});
				})
			});
		});
	}

	/**
	 * 管理者リストにadminを追加
	 * @param {String} id 管理id. nullの場合自動割り当て.
	 * @param {String} adminName 管理者名.
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function addAdmin(socketid, adminID, adminName, password, endCallback) {
		isAdmin(socketid, function (err, isAdmin) {
			if (!err && isAdmin) {
				getAdminList(function (err, data) {
					var i,
						isSameNameFound = false;
					for (i = 0; i < data.adminlist.length; i = i + 1) {
						if (data.adminlist[i].name === adminName) {
							adminID = data.adminlist[i].id;
							isSameNameFound = true;
							changeAdminUserSetting(socketid, adminID, {
								password : password
							}, endCallback);
							return;
						}
					}
					if (!isSameNameFound) {
						if (adminID) {
							data.adminlist.push({ name : adminName, id : adminID });
						} else {
							data.adminlist.push({ name : adminName, id : util.generateUUID8() });
						}
					}
					textClient.set(adminListPrefix, JSON.stringify(data), function () {
						changeAdminUserSetting(socketid, adminID, {
							pre_password : password,
							password : password
						}, endCallback);
					});
				});
			} else {
				endCallback("access denied");
			}
		});	
	}

	function deleteAdmin(socketid, adminName, endCallback) {
		isAdmin(socketid, function (err, isAdmin) {
			if (!err && isAdmin) {
				getAdminList(function (err, data) {
					var i;
					
					if (!data.hasOwnProperty('adminlist')) {
						endCallback("not found adminlist");
						return;
					}
					for (i = 0; i < data.adminlist.length; i = i + 1) {
						if (data.adminlist[i].name === adminName) {
							var id = data.adminlist[i].id;
							data.adminlist.splice(i, 1);
							textClient.set(adminListPrefix, JSON.stringify(data), endCallback);
							
							getAdminUserSetting((function (adminid) {
								return function (err, adminSetting) {
									if (adminSetting && adminSetting.hasOwnProperty(adminid)) {
										delete adminSetting[adminid];
										textClient.set(adminUserPrefix, JSON.stringify(adminSetting), function (err, reply) {
											updateAuthority(adminSetting, null);
											if (endCallback) {
												endCallback(err, reply)
											}
										});
									}
								};
							}(id)));	
							return;
						}
					}
				});
			}
		});
	}

	// コンテンツメタデータ中のグループ名の変更
	function changeContentGroupName(socketid, oldID, newID) {
		var metaDatas = [];
		getMetaData(socketid, 'all', null, function (err, metaData) {
			if (err) {
				return;
			}
			if (metaData && metaData.group === oldID) {
				getGroupID(newID, function (id) {
					metaData.group = id;
					setMetaData(metaData.type, metaData.id, metaData, function (meta) {});
				});
			}
		});
	}

	/**
	 * グループリストからgroupの削除
	 * @param {String} id グループid.
	 * @param {String} groupName グループ名.
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function deleteGroup(socketid, id, groupName, endCallback) {
		isGroupManipulatable(socketid, id, function (isManipulatable) {
			if (isManipulatable) {
				getGroupList(function (err, data) {
					var index = getGroupIndex(data.grouplist, id);
					if (index >= 0) { 
						data.grouplist.splice(index, 1);
						textClient.set(groupListPrefix, JSON.stringify(data), endCallback);
						
						getGroupUserSetting(function (err, data) {
							if (!err && data) {
								if (data.hasOwnProperty(id)) {
									delete data[id];
									textClient.set(groupUserPrefix, JSON.stringify(data), (function (data) {
										return function (err, reply) {
											updateAuthority(null, data);
										}
									}(data)));
								}
							}
						});
						return true;
					} else {
						endCallback("not found");
						return false;
					}
				});
			} else {
				endCallback("access denied");
			}
		});
	}

	/**
	 * グループ更新
	 * @param {String} id グループid.
	 * @param {String} json グループメタデータ.
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function updateGroup(socketid, id, json, endCallback) {
		isGroupManipulatable(socketid, id, function (isManipulatable) {
			if (isManipulatable) {
				getGroupList(function (err, data) {
					var index = getGroupIndex(data.grouplist, id);
					if (index >= 0) {
						var group = data.grouplist[index];
						if (group.name !== json.name) {
							// グループ名が変更された.
							// 全てのコンテンツのメタデータのグループ名も変更する
							changeContentGroupName(socketid, group.id, json.id);
						}
						data.grouplist[index] = json;
						textClient.set(groupListPrefix, JSON.stringify(data), function () {
							endCallback(null, json);
						});
						return true;
					} else {
						if (endCallback) {
							endCallback("Not Found Group:" + id + ":" + groupName);
							return false;
						}
					}
				});
			} else {
				endCallback("access denied");
			}
		});
	}

	/**
	 * グループリストのgroupのインデックスを変更する
	 * @param {String} id グループid.
	 * @param {Integer} insertIndex 新規に割り当てるインデックス.
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function changeGroupIndex(socketid, id, insertIndex, endCallback) {
		isGroupManipulatable(socketid, id,  function (isManipulatable) {
			if (isManipulatable) {
				getGroupList(function (err, data) {
					var index = getGroupIndex(data.grouplist, id),
						item;
					if (index >= 0) {
						item = data.grouplist[index];
						data.grouplist.splice(index, 1);
						if (insertIndex > 0 && insertIndex >= index) {
							insertIndex -= 1;
						}
						data.grouplist.splice(insertIndex, 0, item);
						textClient.set(groupListPrefix, JSON.stringify(data), endCallback);
						return true;
					} else {
						endCallback("not found");
						return false;
					}
				});
			} else {
				endCallback("access denied");
			}
		});
	}

	function changeUUIDPrefix(socketid, dbname, endCallback) {
		isAdmin(socketid, function (err, isAdmin) {
			if (!err && isAdmin) {
				textClient.hget(frontPrefix + 'dblist', dbname, function (err, reply) {
					if (!err) {
						getGlobalSetting(function (err, setting) {
							setting.current_db = reply;
							changeGlobalSetting(socketid, setting, function () {
								var id = setting.current_db;
								console.log("DB ID:", setting.current_db);
								uuidPrefix = id + ":";
								contentPrefix = frontPrefix + uuidPrefix + "content:";
								contentRefPrefix = frontPrefix + uuidPrefix + "contentref:";
								contentBackupPrefix = frontPrefix + uuidPrefix + "content_backup:";
								metadataPrefix = frontPrefix + uuidPrefix + "metadata:";
								metadataBackupPrefix = frontPrefix + uuidPrefix + "metadata_backup:";
								windowMetaDataPrefix = frontPrefix + uuidPrefix + "window_metadata:";
								windowContentPrefix = frontPrefix + uuidPrefix + "window_contentref:";
								windowContentRefPrefix = frontPrefix + uuidPrefix + "window_content:";
								virtualDisplayIDStr = frontPrefix + uuidPrefix + "virtual_display";
								groupListPrefix = frontPrefix + uuidPrefix + "grouplist";
								groupUserPrefix = frontPrefix + uuidPrefix + "group_user"; // グループユーザー設定
								endCallback(null);
							});
						});
					} else {
						endCallback("failed to get dblist");
					}
				});
			} else {
				endCallback("access denied");
			}
		});	
	}

	function groupInitialSettting() {
		textClient.exists(groupUserPrefix,  function (err, doesExists) {
			if (doesExists !== 1) {
				// group設定の初期登録
				changeGroupUserSetting("master", "Guest", {
					viewable : [],
					editable : [],
					group_manipulatable : false,
					display_manipulatable : true
				}, function () {
					// Display設定の初期登録
					changeGroupUserSetting("master", "Display", {
						viewable : "all",
						editable : "all",
						group_manipulatable : false,
						display_manipulatable : true
					});
				});
			}
			addGroup("master", "group_default", "default", function (err, reply) {} );
		});
		textClient.exists(globalSettingPrefix,  function (err, doesExists) {
			if (doesExists !== 1) {
				// global設定の初期登録
				changeGlobalSetting("master", {
					max_history_num : 10
				});
			}
		});
		// virtualdisplayの初期設定
		textClient.exists(virtualDisplayIDStr, function (err, doesExists) {
			if (doesExists !== 1) {
				var windowData = {
					orgWidth : 1000,
					orgHeight : 1000,
					splitX : 1,
					splitY : 1,
					scale : 1.0
				};
				setVirtualDisplay(windowData);
			}
		});
	}

	/**
	 * 新規保存領域の作成
	 * @param name 保存領域の名前
	 * @param endCallback 終了コールバック
	 */
	function newDB(socketid, name, endCallback) {
		isAdmin(socketid, function (err, isAdmin) {
			if (!err && isAdmin) {
				if (name.length > 0) {
					textClient.hexists(frontPrefix + 'dblist', name, function (err, doesExists) {
						if (!err && doesExists !== 1) {
							// 存在しない場合のみ作って切り替え
							var id = util.generateUUID8();
							if (name === "default") {
								id = "default";
							}
							textClient.hset(frontPrefix + 'dblist', name, id, function (err, reply) {
								if (!err) {
									changeUUIDPrefix(socketid, name, function (err, reply) {
										groupInitialSettting();
										endCallback(err);
									});
								} else {
									endCallback("failed to create new db");
								}
							});
						} else {
							endCallback("already exists");
						}
					});
				} else {
					endCallback("invalid db name");
				}
			} else {
				endCallback("Failed newDB - access denied");
			}
		});
	}

	/**
	 * 新規保存領域の作成
	 * @param name 保存領域の名前
	 * @param endCallback 終了コールバック
	 */
	function renameDB(socketid, name, newName, endCallback) {
		isAdmin(socketid, function (err, isAdmin) {
			if (!err && isAdmin) {
				if (name.length > 0 && newName.length > 0) {
					if (name === "default" || newName === "default") {
						endCallback("cannot change default db name");
						return;
					}
					textClient.hexists(frontPrefix + 'dblist', name, function (err, doesExists) {
						if (!err && doesExists === 1) {
							textClient.hget(frontPrefix + 'dblist', name, function (err, reply) {
								if (!err) {
									textClient.hdel(frontPrefix + 'dblist', name);
									textClient.hset(frontPrefix + 'dblist', newName, reply);
									endCallback(null, {});
								} else {
									endCallback("failed to rename db");
								}
							});
						} else {
							endCallback("failed to rename db - invalid db name");
						}
					});
				} else {
					endCallback("failed to rename db - invalid db name");
				}
			} else {
				endCallback("Failed renameDB - access denied");
			}
		});
	}

	/**
	 * DBの参照先の変更
	 * @param name 保存領域の名前
	 * @param endCallback 終了コールバック
	 */
	function changeDB(socketid, name, endCallback) {
		if (name.length > 0) {
			textClient.hget(frontPrefix + 'dblist', name, function (err, reply) {
				if (!err) {
					var id = reply;
					textClient.exists(frontPrefix + id + ":grouplist", function (err, doesExists) {
						if (doesExists !== 1) {
							// 存在しないdbnameが指定された
							endCallback("Failed to change db: not exists db name");
							return;
						}
						changeUUIDPrefix(socketid, name, endCallback);
					});
				} else {
					// 存在しないdbnameが指定された
					endCallback("Failed to change db: not exists db name");
				}
			});
		}
	}

	/**
	 * DBの指定したデータ保存領域を削除
	 * @param name 保存領域の名前
	 * @param endCallback 終了コールバック
	 */
	function deleteDB(socketid, name, endCallback) {
		if (name.length > 0) {
			textClient.hget(frontPrefix + 'dblist', name, function (err, reply) {
				if (!err) {
					var id = reply;
					textClient.hdel(frontPrefix + 'dblist', name);
					textClient.exists(frontPrefix + id + ":grouplist", function (err, doesExists) {
						if (!err && doesExists == 1) {
							textClient.keys(frontPrefix + id + "*", function (err, replies) {
								var i;
								console.log("deletedb : ", name);
								if (!err) {
									for (i = 0; i < replies.length; i = i + 1) {
										console.log("delete : ", replies[i]);
										textClient.del(replies[i]);
									}

									if (uuidPrefix === (id + ":") && name !== "default") {
										// 現在使用中のDBが消去された.
										// defaultに戻す.
										changeDB(socketid, "default", endCallback);
									} else {
										endCallback(null);
									}
								} else {
									endCallback("Failed deleteDB:" + err)
								}
							});
						} else {
							endCallback("Failed deleteDB: not exists db name")
						}
					});
				} else {
					endCallback("Failed deleteDB: not exists db name")
				}
			});
		} else {
			endCallback("Failed deleteDB: invalid parameter")
		}
	}

	/**
	 * DBの指定したデータ保存領域を初期化
	 * @param name 保存領域の名前
	 * @param endCallback 終了コールバック
	 */
	function initDB(socketid, name, endCallback) {
		if (name.length > 0) {
			deleteDB(socketid, name, function (err, reply) {
				if (!err) {
					newDB(socketid,name, function (err, reply) {
						if (endCallback) {
							endCallback(err, reply)
						}
					});
				} else {
					endCallback("Failed initDB");
				}
			});
		} else {
			endCallback("Failed initDB: invalid parameter");
		}
	}
	
	/**
	 * グローバル設定の変更
	 */
	function changeGlobalSetting(socketid, json, endCallback) {
		isAdmin(socketid, function (err, isAdmin) {
			if (!err && isAdmin) {
				textClient.hmset(globalSettingPrefix, json, function (err) {
					if (err) {
						console.error(err);
					} else if (endCallback) {
						endCallback(json);
					}
				});
			} else {
				endCallback("access denied");
			}
		});	
	}

	/**
	 * グローバル設定の取得
	 */
	function getGlobalSetting(endCallback) {
		textClient.hgetall(globalSettingPrefix, endCallback);
	}

	/**
	 * グループユーザー設定情報の取得.
	 */
	function getGroupUserSetting(endCallback) {
		textClient.exists(groupUserPrefix,  function (err, doesExists) {
			if (!err && doesExists === 1) {
				textClient.get(groupUserPrefix, function (err, reply) {
					var data = reply;
					if (!reply) {
						data = {};
					} else {
						try {
							data = JSON.parse(data);
						} catch (e) {
							return false;
						}
					}
					endCallback(err, data);
				});
			} else {
				endCallback("getGroupUserSetting failed");
			}
		});
	}

	/**
	 * グループユーザー設定の変更.
	 */
	function changeGroupUserSetting(socketid, groupID, setting, endCallback) {
		console.log("changeGroupUserSetting", groupID, setting)
		getGroupUserSetting(function (err, data) {
			var groupSetting;
			if (!data) {
				// 新規.
				data = {};
			}
			if (!data.hasOwnProperty(groupID)) {
				data[groupID] = {};
			}
			if (setting.hasOwnProperty('password')) {
				data[groupID].password = util.encrypt(setting.password, cryptkey);
			}
			for (var i = 0; i < userSettingKeys.length; i = i + 1) {
				var key = userSettingKeys[i];
				if (setting.hasOwnProperty(key)) {
					data[groupID][key] = setting[key];
				}
			}
			textClient.set(groupUserPrefix, JSON.stringify(data), (function (data) {
				return function (err, reply) {
					updateAuthority(null, data);
					if (endCallback) {
						endCallback(err, data)
					}
				};
			}(data)));
		});
	}

	/**
	 * 管理ユーザー設定情報の取得.
	 */
	function getAdminUserSetting(endCallback) {
		textClient.get(adminUserPrefix, function (err, reply) {
			var data = reply;
			if (!reply) {
				data = "{}";
			}
			try {
				data = JSON.parse(data);
			} catch (e) {
				endCallback("getAdminUserSetting failed");
				return;
			}
			endCallback(err, data);
		});
	}

	/**
	 * 管理ユーザー設定の変更.
	 */
	function changeAdminUserSetting(socketid, id, setting, endCallback) {
		getAdminUserSetting(function (err, data) {
			if (!err) {
				if (setting.hasOwnProperty('password')) {
					var prePass;
					if (!data.hasOwnProperty(id)) {
						data[id] = {};
					}
					if (data[id].hasOwnProperty('pre_password') && setting.hasOwnProperty('pre_password')) {
						prePass = util.encrypt(setting.pre_password, cryptkey);
					} else {
						// 初回追加時.またはjsonから追加時.
						var pass = util.encrypt(setting.password, cryptkey);
						data[id].pre_password = pass;
						prePass = pass;
					}
					if (data[id].pre_password === prePass || socketid === "master") {
						data[id].password = util.encrypt(setting.password, cryptkey);
						textClient.set(adminUserPrefix, JSON.stringify(data), function (err, reply) {
							updateAuthority(data, null);
							if (endCallback) {
								endCallback(err, reply)
							}
						});
						return;
					} else {
						if (endCallback) {
							endCallback("invalid password");
							return;
						}
					}
				} 
				
				if (endCallback) {
					endCallback("invalid admin setting");
				}
			} else {
				if (endCallback) {
					endCallback(err);
				}
			}
		});
	}

	/**
	 * ユーザーリストの取得
	 * 全グループ名と、guest, display, 全管理者名が返る.
	 */
	function getUserList(endCallback) {
		getAdminList(function (err, data) {
			var i,
				userList = [];
			
			// 管理ユーザー
			for (i = 0; i < data.adminlist.length; i = i + 1) {
				userList.push({ name : data.adminlist[i].name, id : data.adminlist[i].id, type : "admin"});;
			}
			getGroupUserSetting(function (err, setting) {
				if (!setting) { 
					endCallback(null, userList);
					return;
				}
				getGroupList(function (err, groupData) {
					var isFoundGuest = false;

					// Guestユーザー
					var guestUserData = { name : "Guest", id : "Guest", type : "guest"};
					if (setting.hasOwnProperty("Guest")) {
						for (var k = 0; k < userSettingKeys.length; k = k + 1) {
							var key = userSettingKeys[k];
							if (setting.Guest.hasOwnProperty(key)) {
								guestUserData[key] = setting.Guest[key];
							}
						}
					}
					userList.push(guestUserData);

					// 通常のグループユーザー
					if (groupData.hasOwnProperty("grouplist")) {
						var i,
							name,
							userListData,
							groupSetting,
							id;
						for (i = 0; i < groupData.grouplist.length; i = i + 1) {
							groupSetting = {};
							name = groupData.grouplist[i].name;
							id = groupData.grouplist[i].id;
							// defaultグループは特殊扱いでユーザー無し
							if (id !== "group_default") {
								userListData = { name : name, id : id, type : "group"};
								if (setting.hasOwnProperty(id)) {
									groupSetting = setting[id];
								}
								for (var k = 0; k < userSettingKeys.length; k = k + 1) {
									var key = userSettingKeys[k];
									if (groupSetting.hasOwnProperty(key)) {
										userListData[key] = groupSetting[key];
									}
								}
								userList.push(userListData);
							}
						}
					}
					// Displayユーザー
					var displayUserData = { name : "Display", id : "Display", type : "display"};
					if (setting.hasOwnProperty("Display")) {
						for (var k = 0; k < userSettingKeys.length; k = k + 1) {
							var key = userSettingKeys[k];
							if (setting.Display.hasOwnProperty(key)) {
								displayUserData[key] = setting.Display[key];
							}
						}
					}
					userList.push(displayUserData);

					if (endCallback) {
						endCallback(null, userList);
					}
				});
			});
		});
	}

	function validatePassword(master, pass) {
		return master === util.encrypt(pass, cryptkey);
	}

	/**
	 * socketidごとの権限情報キャッシュを全て更新する
	 */
	function updateAuthority(adminSetting, groupSetting) {
		var i,
			socketid,
			authority;

		for (socketid in socketidToAccessAuthority) {
			authority = socketidToAccessAuthority[socketid];
			if (socketidToUserID.hasOwnProperty(socketid)) {
				var id = socketidToUserID[socketid];
				if (adminSetting) {
					if (adminSetting.hasOwnProperty(id)) {
						authority.id = id;
						authority.viewable = "all";
						authority.editable = "all";
						authority.group_manipulatable = true;
						authority.display_manipulatable = true;
						authority.is_admin = true;
						socketidToAccessAuthority[socketid] = authority;
					}
				}
				if (groupSetting) {
					if (groupSetting.hasOwnProperty(id)) {
						authority.id = id;
						for (var k = 0; k < userSettingKeys.length; k = k + 1) {
							var key = userSettingKeys[k];
							if (groupSetting[id].hasOwnProperty(key)) {
								authority[key] = groupSetting[id][key];
							}
						}
						socketidToAccessAuthority[socketid] = authority;
					}
				}
			}
		}
		console.log("-----updateAuthority------")
		//console.log(socketidToAccessAuthority)
	}

	/**
	 * socketidの権限情報キャッシュを削除する
	 */
	function removeAuthority(socketid) {
		if (socketidToLoginKey.hasOwnProperty(socketid)) {
			socketid = socketidToLoginKey[socketid];
			delete socketidToLoginKey[socketid];
		}
		if (socketidToAccessAuthority.hasOwnProperty(socketid)) {
			delete socketidToAccessAuthority[socketid];
		}
		if (socketidToUserID.hasOwnProperty(socketid)) {
			delete socketidToUserID[socketid];
		}
	}

	/**
	 * ログイン情報の一時的な保存. ログイン成功した場合に必ず呼ぶ.
	 */
	function saveLoginInfo(socketid, id, adminSetting, groupSetting) {
		if (!socketidToUserID.hasOwnProperty(socketid)) {
			socketidToUserID[socketid] = id;
		}
		if (!socketidToAccessAuthority.hasOwnProperty(socketid)) {
			socketidToAccessAuthority[socketid] = {};
	 		// socketidごとの権限情報キャッシュを全て更新する
			updateAuthority(adminSetting, groupSetting);
		}
	}

	/**
	 * ログインする
	 * @method login
	 * @param {String} id ユーザーid
	 * @param {String} password パスワード
	 * @param {String} socketid socketID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function login(id, password, socketid, endCallback) {
		var getLoginResult = function () {
			if (socketidToAccessAuthority.hasOwnProperty(socketid)) {
				return {
					id : id,
					loginkey : socketid,
					authority : socketidToAccessAuthority[socketid]
				};
			} else {
				return {
					id : id,
					loginkey : socketid,
					authority : null,
				};
			}
		};
		getAdminUserSetting(function (err, data) {
			if (data.hasOwnProperty(id)) {
				// 管理ユーザー
				var isValid = validatePassword(data[id].password, password);
				if (isValid) {
					saveLoginInfo(socketid, id, data);
					// 成功したらsocketidを返す
					endCallback(null, getLoginResult());
				} else {
					endCallback("failed to login");
				}
			} else {
				getGroupUserSetting(function (err, setting) {
					if (!err) {
						if (setting.hasOwnProperty(id)) {
							// グループユーザー設定登録済グループユーザー
							var isValid = validatePassword(setting[id].password, password);
							if (id === "Guest" || id === "Display") {
								isValid = true;
							}
							if (isValid) {
								saveLoginInfo(socketid, id, null, setting);
								endCallback(null, getLoginResult());
							} else {
								endCallback("failed to login");
							}
						} else {
							// グループユーザー設定に登録されていないグループ
							endCallback(null, getLoginResult());
						}
					} else {
						endCallback("failed to login");
					}
				});
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
			console.error("invalid matadata.");
			return;
		}
		if (metaData.hasOwnProperty('command')) {
			delete metaData.command;
		}
	
		textClient.hmset(metadataPrefix + id, metaData, function (err) {
			if (err) {
				console.error(err);
			} else if (endCallback) {
				endCallback(metaData);
			}
		});
	}

	function sortBackupList(backupList) {
		backupList.sort(function (a, b) {
			return new Date(b) - new Date(a);
		});
		return backupList;
	}
	
	/**
	 * 指定されたタイプ、idのメタデータ取得
	 * @method getMetaData
	 * @param {String} type メタデータタイプ
	 * @param {String} id ContentsID
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function getMetaData(socketid, type, id, endCallback) {
		if (type === 'all') {
			textClient.keys(metadataPrefix + '*', function (err, replies) {
				var all_done = replies.length;
				replies.forEach(function (id, index) {
					textClient.hgetall(id, function (err, data) {
						textClient.exists(metadataBackupPrefix + data.id, (function (metaData) {
							return function (err, doesExists) {
								if (!isViewable(socketid, data.group)) {
									endCallback("access denied", {});
									return;
								}
								if (doesExists) {

									// バックアップがあった. バックアップのキーリストをmetadataに追加しておく.
									textClient.hkeys(metadataBackupPrefix + metaData.id, function (err, reply) {
										metaData.backup_list = JSON.stringify(sortBackupList(reply));
										if (endCallback) {
											endCallback(null, metaData);
										}
									});
									return;
								}
								if (endCallback) {
									metaData.last = ((replies.length - 1) === index);
									endCallback(null, metaData);
								}
							};
						}(data)));
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
					textClient.exists(metadataBackupPrefix + data.id, (function (metaData) {
						return function (err, doesExists) {
							if (doesExists) {
								if (!isViewable(socketid, metaData.group)) {
									endCallback("access denied", {});
									console.log("access denied2")
									return;
								}
								// バックアップがあった. バックアップのキーリストをmetadataに追加しておく.
								textClient.hkeys(metadataBackupPrefix + metaData.id, function (err, reply) {
									metaData.backup_list = JSON.stringify(sortBackupList(reply));
									if (endCallback) {
										endCallback(null, metaData);
									}
								});
								return;
							}
							if (endCallback) {
								endCallback(null, metaData);
							}
						};
					}(data)));
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
							console.error(err);
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
					console.error(err);
				}
			});
		}
	}
	
	/**
	 * メタデータをコンテンツバイナリから初期設定する.
	 * @method initialMetaDataSetting
	 * @param {JSON} metaData contentメタデータ
	 * @param {BLOB} contentData バイナリデータ
	 */
	function initialMetaDataSetting(metaData, contentData) {
		var dimensions;
		if (metaData.hasOwnProperty('orgWidth')) {
			metaData.width = metaData.orgWidth;
		} else if (metaData.hasOwnProperty('width')) {
			metaData.orgWidth = metaData.width;
		}
		if (metaData.hasOwnProperty('orgHeight')) {
			metaData.height = metaData.orgHeight;
		} else if (metaData.hasOwnProperty('height')) {
			metaData.orgHeight = metaData.height;
		}
		if (metaData.type === "video") {
			metaData.mime = "video/mp4";
		} else if (metaData.type === 'text') {
			metaData.mime = "text/plain";
		} else if (metaData.type === 'image') {
			metaData.mime = util.detectImageType(contentData);
		} else if (metaData.type === 'url') {
			metaData.mime = util.detectImageType(contentData);
		} else {
			console.error("Error undefined type:" + metaData.type);
		}
		if (metaData.type === 'image') {
			if (isInvalidImageSize(metaData)) {
				dimensions = image_size(contentData);
				if (!metaData.hasOwnProperty('orgWidth')) {
					metaData.width = dimensions.width;
					metaData.orgWidth = metaData.width;
				}
				if (!metaData.hasOwnProperty('orgHeight')) {
					metaData.height = dimensions.height;
					metaData.orgHeight = metaData.height;
				}
			}
		}
	}
	
	function initialOrgWidthHeight(metaData, contentData) {
		var dimensions;
		if (metaData.hasOwnProperty('width')) {
			metaData.orgWidth = metaData.width;
		}
		if (metaData.hasOwnProperty('height')) {
			metaData.orgHeight = metaData.height;
		}
		if (metaData.type === "video") {
			metaData.mime = "video/mp4";
		} else if (metaData.type === 'text') {
			metaData.mime = "text/plain";
		} else if (metaData.type === 'image') {
			metaData.mime = util.detectImageType(contentData);
		} else if (metaData.type === 'url') {
			metaData.mime = util.detectImageType(contentData);
		} else {
			console.error("Error undefined type:" + metaData.type);
		}
		if (metaData.type === 'image') {
			if (isInvalidImageSize(metaData)) {
				dimensions = image_size(contentData);
				if (!metaData.hasOwnProperty('orgWidth')) {
					metaData.orgWidth = dimensions.width;
				}
				if (!metaData.hasOwnProperty('orgHeight')) {
					metaData.orgHeight = dimensions.height;
				}
			}
		}
	}

	/**
	 * メタデータ追加
	 * @method addMetaData
	 * @param {JSON} metaData contentメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function addMetaData(metaData, endCallback) {
		generateMetaDataID(function (id) {
			if (metaData.hasOwnProperty('id') && metaData.id !== "") {
				id = metaData.id;
			}
			metaData.id = id;
			if (metaData.hasOwnProperty('content_id') && metaData.content_id !== "") {
				textClient.exists(contentPrefix + metaData.content_id, function (err, doesExists) {
					if (!err && doesExists === 1) {
						getContent('', metaData.content_id, function (contentData) {
							// 参照カウント.
							textClient.setnx(contentRefPrefix + metaData.content_id, 0);
							textClient.incr(contentRefPrefix + metaData.content_id);
							
							// メタデータを初回設定.
							initialMetaDataSetting(metaData, contentData);
							setMetaData(metaData.type, id, metaData, function (metaData) {
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
	 * @param {JSON} metaData contentメタデータ
	 * @param {BLOB} data バイナリデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function addContent(metaData, data, endCallback) {
		var contentData = data;
		if (metaData.type === "video") {
			metaData.mime = "video/mp4";
		} else if (metaData.type === 'text') {
			metaData.mime = "text/plain";
		} else if (metaData.type === 'image') {
			metaData.mime = util.detectImageType(contentData);
		} else if (metaData.type === 'url') {
			metaData.mime = util.detectImageType(contentData);
		} else {
			console.error("Error undefined type:" + metaData.type);
		}
		
		console.log("mime:" + metaData.mime);
		
		addMetaData(metaData, function (metaData) {
			generateContentID(function (content_id) {
				if (metaData.hasOwnProperty('content_id') && metaData.content_id !== "") {
					content_id = metaData.content_id;
				}
				metaData.content_id = content_id;
				metaData.date = new Date().toISOString();
				
				textClient.set(contentPrefix + content_id, contentData, function (err, reply) {
					if (err) {
						console.error("Error on addContent:" + err);
					} else {
						// 参照カウント.
						textClient.setnx(contentRefPrefix + content_id, 0);
						textClient.incr(contentRefPrefix + content_id);
						
						// メタデータを初回設定.
						initialMetaDataSetting(metaData, contentData);
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
		textClient.exists(metadataPrefix + metaData.id, function (err, doesExist) {
			if (!err &&  doesExist === 1) {
				textClient.del(metadataPrefix + metaData.id, function (err) {
					console.log("deleteMetadata", metaData.id);
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
	 * @param {JSON} metaData contentメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function deleteContent(metaData, endCallback) {
		deleteMetaData(metaData, function (err, metaData) {
			if (!err) {
				console.log("deleteContent", metaData);
				if (metaData.hasOwnProperty('content_id') && metaData.content_id !== '') {
					textClient.exists(contentPrefix + metaData.content_id, function (err, doesExist) {
						if (!err && doesExist === 1) {
							// 参照カウントを減らす.
							textClient.decr(contentRefPrefix + metaData.content_id, function (err, value) {
								if (value <= 0) {
									console.log("reference count zero. delete content");
									textClient.del(contentPrefix + metaData.content_id, function (err) {
										if (!err) {
											textClient.del(metadataBackupPrefix + metaData.id);
											textClient.del(contentBackupPrefix + metaData.content_id);
											textClient.del(contentRefPrefix + metaData.content_id);
											if (endCallback) {
												endCallback(metaData);
											}
										} else {
											console.error(err);
										}
									});
								} else {
									if (endCallback) {
										endCallback(metaData);
									}
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
	 * 古いバックアップをnum個削除
	 */
	function removeOldBackup(metaData, num, endCallback) {
		textClient.hkeys(metadataBackupPrefix + metaData.id, function (err, keys) {
			var i;
			var backupList = sortBackupList(keys);
			if (backupList.length > num) {
				for (i = 0; i < num; i = i + 1) {
					var last = backupList[backupList.length - i - 1];
					textClient.hdel(metadataBackupPrefix + metaData.id, last);
					client.hdel(contentBackupPrefix + metaData.content_id, last);
					console.log("removeOldBackup", last);
				}
			}
			if (endCallback) {
				endCallback();
			}
		});
	}

	/**
	 * コンテンツとメタデータのバックアップ(元データは移動される)
	 */
	function backupContent(socketid, metaData, endCallback) {
		var backupFunc = function () {
			var backupMetaData = {};
			backupMetaData[metaData.date] = JSON.stringify(metaData);
			client.hmset(metadataBackupPrefix + metaData.id, backupMetaData, function (err) {
				getContent(metaData.type, metaData.content_id, function (reply) {
					if (reply) {
						var backupContentData = {};
						backupContentData[metaData.date] = reply;
						client.hmset(contentBackupPrefix + metaData.content_id, backupContentData, function (err, reply) {
							if (endCallback) {
								endCallback(err, reply);
							}
						});
					}
				});
			});
		};
		getMetaData(socketid, metaData.type, metaData.id, function (err, meta) {
			if (err) {
				endCallback(err);
				return;
			}
			getGlobalSetting(function (err, setting) {
				if (!err && setting) {
					var maxHistorySetting = 0;
					if (setting.hasOwnProperty('max_history_num')) {
						maxHistorySetting = setting.max_history_num;
					}
					client.hlen(metadataBackupPrefix + metaData.id, function (err, num) {
						if (!err) {
							if (maxHistorySetting !== 0 && num > maxHistorySetting) {
								// 履歴保存数を超えたので、古いものを削除
								removeOldBackup(metaData, num - maxHistorySetting, backupFunc);
							} else {
								backupFunc();
							}
						}
					});
				} else {
					endCallback(null);
				}
			});
		});
	}
	
	/**
	 * コンテンツ更新
	 * @method updateContent
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} data     バイナリデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function updateContent(socketid, metaData, data, endCallback) {
		var contentData = null;
		console.log("updateContent:" + metaData.id + ":" + metaData.content_id);
		if (metaData.type === "video") {
			contentData = data;
			metaData.mime = "video/mp4";
		} else if (metaData.type === 'text' || metaData.type === 'layout') {
			contentData = data;
			metaData.mime = "text/plain";
		} else if (metaData.type === 'image') {
			contentData = data;
			metaData.mime = util.detectImageType(data);
		} else if (metaData.type === 'url') {
			contentData = data;
			metaData.mime = util.detectImageType(data);
		} else {
			console.error("Error undefined type:" + metaData.type);
		}
		textClient.exists(contentPrefix + metaData.content_id, function (err, doesExist) {
			if (!err && doesExist === 1) {
				var backupList = [];
				if (metaData.hasOwnProperty('backup_list')) {
					try {
						backupList = JSON.parse(metaData.backup_list);
					} catch (e) {

					}
				}
				// 復元時に初回復元の場合、バックアップリストに更新前コンテンツと更新後コンテンツを両方格納する.
				if (backupList.length === 0) {
					// 更新前コンテンツ
					// メタデータ初期設定.
					getMetaData(socketid, metaData.type, metaData.id, function (err, oldMeta) {
						if (err) {
							endCallback(err);
							return;
						}
						backupContent(socketid, oldMeta, function (err, reply) {
							if (!metaData.hasOwnProperty('orgWidth') || !metaData.hasOwnProperty('orgHeight')) {
								initialOrgWidthHeight(metaData, contentData);
							}
							metaData.date = new Date().toISOString();
							metaData.restore_index = -1;
							setMetaData(metaData.type, metaData.id, metaData, function (meta) {
								textClient.set(contentPrefix + meta.content_id, contentData, function (err, reply) {
									if (err) {
										console.error("Error on updateContent:" + err);
									} else {
										// 更新後コンテンツ
										backupContent(socketid, meta, function (err, reply) {
											if (endCallback) {
												endCallback(meta);
											}
										});
									}
								});
							});
						});
					});
				} else {
					// 現在のコンテンツより新しいものを削除する.
					if (Number(metaData.restore_index) > 0 && metaData.hasOwnProperty('backup_list')) {
						var backupList = sortBackupList(JSON.parse(metaData.backup_list));
						for (var i = 0; i < Number(metaData.restore_index); i = i + 1) {
							var date = backupList[i];
							textClient.hdel(metadataBackupPrefix + metaData.id, date);
							textClient.hdel(contentBackupPrefix + metaData.content_id, date);
						}
					}

					// 更新後コンテンツのみバックアップ
					metaData.date = new Date().toISOString();
					metaData.restore_index = -1;
					// メタデータ初期設定.
					if (!metaData.hasOwnProperty('orgWidth') || !metaData.hasOwnProperty('orgHeight')) {
						initialOrgWidthHeight(metaData, contentData);
					}
					setMetaData(metaData.type, metaData.id, metaData, function (meta) {
						textClient.set(contentPrefix + meta.content_id, contentData, function (err, reply) {
							if (err) {
								console.error("Error on updateContent:" + err);
							} else {
								// 更新後コンテンツ
								backupContent(socketid, meta, function (err, reply) {
									if (endCallback) {
										endCallback(meta);
									}
								});
							}
						});
					});
				}
			}
		});
	}
	
	function addWindowMetaData(socketid, windowData, endCallback) {
		generateWindowMetaDataID(function (id) {
			if (windowData.hasOwnProperty('id') && windowData.id !== "") {
				id = windowData.id;
			}
			windowData.id = id;
			socketidToHash[socketid] = id;
			console.log("registerWindow: " + id);
			textClient.hexists(windowMetaDataPrefix + id, function (err, reply) {
				if (reply === 1) {
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
					if (!windowData.hasOwnProperty('orgWidth')) {
						windowData.orgWidth = windowData.width;
					}
					if (!windowData.hasOwnProperty('orgHeight')) {
						windowData.orgHeight = windowData.height;
					}
					
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
	 * Window追加
	 * @method addWindow
	 * @param {BLOB} socket socket id
	 * @param {JSON} windowData windowメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function addWindow(socketid, windowData, endCallback) {
		console.log("add window");
		addWindowMetaData(socketid, windowData, function (metaData) {
			generateWindowContentID(function (content_id) {
				if (metaData.hasOwnProperty('content_id') && metaData.content_id !== "") {
					content_id = metaData.content_id;
				}
				metaData.content_id = content_id;
				console.log("add window content id:", content_id);
				
				textClient.hmset(windowContentPrefix + content_id, metaData, function (err, reply) {
					if (err) {
						console.error("Error on addWindow:" + err);
					} else {
						
						// 参照カウント.
						textClient.setnx(windowContentRefPrefix + content_id, 0);
						textClient.incr(windowContentRefPrefix + content_id, function (err, value) {
							metaData.reference_count = value;
							textClient.hmset(windowMetaDataPrefix + metaData.id, metaData, function (err, reply) {
								if (endCallback) {
									endCallback(metaData);
								}
							});
						});
					}
				});
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
	 * Window取得
	 * @method getWindow
	 * @param {JSON} windowData windowメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function getWindowMetaData(windowData, endCallback) {
		if (windowData.hasOwnProperty('type') && windowData.type === 'all') {
			//console.log("getWindowAll");
			textClient.keys(windowMetaDataPrefix + '*', function (err, replies) {
				replies.forEach(function (id, index) {
					//console.log("getWindowAllID:" + id);
					textClient.hgetall(id, function (err, reply) {
						if (err) {
							console.error(err);
						} else {
							if (endCallback && reply) {
								endCallback(reply);
							}
						}
					});
				});
			});
		} else {
			textClient.exists(windowMetaDataPrefix + windowData.id, function (err, doesExist) {
				if (!err && doesExist === 1) {
					textClient.hgetall(windowMetaDataPrefix + windowData.id, function (err, data) {
						if (err) {
							console.error(err);
						} else {
							if (endCallback) {
								endCallback(data);
							}
						}
					});
				} else {
					if (endCallback) {
						endCallback(null);
					}
				}
			});
		}
	}
	
	/**
	 * Window削除
	 * @method deleteWindowMetaData
	 * @param {JSON} metaData windowメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function deleteWindowMetaData(metaData, endCallback) {
		textClient.del(windowMetaDataPrefix + metaData.id, function (err) {
			if (!err) {
				console.log("unregister window id:" + metaData.id);
			}
			if (endCallback) {
				endCallback(err, metaData);
			}
		});
	}
	
	/**
	 * Window削除
	 * @method deleteWindow
	 * @param {JSON} windowData windowメタデータJSON
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function deleteWindow(metaData, endCallback) {
		deleteWindowMetaData(metaData, function (err, meta) {
			if (meta.hasOwnProperty('content_id') && meta.content_id !== '') {
				textClient.exists(windowContentPrefix + meta.content_id, function (err, doesExist) {
					if (!err && doesExist === 1) {
						
						textClient.del(windowContentPrefix + meta.content_id, function (err) {
							if (!err) {
								textClient.del(windowContentRefPrefix + meta.content_id);
								if (meta.hasOwnProperty('reference_count')) {
									delete meta.reference_count;
								}
								if (endCallback) {
									endCallback(meta);
								}
							} else {
								console.error(err);
							}
						});
					}
				});
			} else {
				console.error(err);
			}
		});
	}
	
	/**
	 * SocketIDで指定されたWindowの参照カウントをsocketidをもとに減らす
	 * @method decrWindowReferenceCount
	 * @param {string} socketid socket id
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function decrWindowReferenceCount(socketid, endCallback) {
		var id;
		if (socketidToHash.hasOwnProperty(socketid)) {
			id = socketidToHash[socketid];
			
			textClient.exists(windowMetaDataPrefix + id, function (err, doesExist) {
				if (!err && doesExist === 1) {
					textClient.hgetall(windowMetaDataPrefix + id, function (err, data) {
						if (!err && data) {
							// 参照カウントのみを減らす
							textClient.decr(windowContentRefPrefix + data.content_id, function (err, value) {
								data.reference_count = value;
								textClient.hmset(windowMetaDataPrefix + id, data, function (err, result) {
									if (endCallback) {
										endCallback(null, data);
									}
								});
							});
						}
					});
				}
			});
		}
	}
	
	/**
	 * Window更新
	 * @method updateWindowMetaData
	 * @param {BLOB} socketid socket id
	 * @param {JSON} windowData windowメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function updateWindowMetaData(socketid, windowData, endCallback) {
		if (!windowData.hasOwnProperty("id")) { return; }
		textClient.hmset(windowMetaDataPrefix + windowData.id, windowData, function (err, reply) {
			if (endCallback) {
				endCallback(windowData);
			}
		});
	}
	
	/**
	 * cursor更新
	 * @method updateMouseCursor
	 * @param {BLOB} socketid socket id
	 * @param {JSON} mouseData mouseメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function updateMouseCursor(socketid, mouseData, endCallback) {
		var obj = {data: mouseData, id: socketid};
		if (endCallback) {
			endCallback(obj);
		}
	}
	
	/**
	 * セッションリスト取得。registerWSEventにてコールされる。
	 * @method getSessionList
	 */
	function getSessionList() {
		textClient.smembers('sessions', function (err, replies) {
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
	 * socketidユーザーがgroupを閲覧可能かどうか返す
	 * @method isEditable
	 * @param {String} socketid socketid
	 * @param {String} group group
	 */
	function isViewable(socketid, groupID) {
		if (groupID === "group_default") {
			return true;
		}
		if (groupID === undefined || groupID === "") {
			return true;
		}
		if (socketidToLoginKey.hasOwnProperty(socketid)) {
			socketid = socketidToLoginKey[socketid];
		}
		var authority;
		if (socketidToAccessAuthority.hasOwnProperty(socketid)) {
			authority = socketidToAccessAuthority[socketid];
			if (authority.viewable === "all") {
				return true;
			}
			if (authority.viewable.indexOf(groupID) >= 0) {
				return true;
			}
		}
		return false;
	}

	/**
	 * socketidユーザーがgroupを編集可能かどうか返す
	 * @method isEditable
	 * @param {String} socketid socketid
	 * @param {String} group group
	 */
	function isEditable(socketid, groupID) {
		if (groupID === "group_default") {
			return true;
		}
		if (groupID === undefined || groupID === "") {
			return true;
		}
		if (socketidToLoginKey.hasOwnProperty(socketid)) {
			socketid = socketidToLoginKey[socketid];
		}
		var authority;
		if (socketidToAccessAuthority.hasOwnProperty(socketid)) {
			authority = socketidToAccessAuthority[socketid];
			if (authority.editable === "all") {
				return true;
			}
			if (authority.editable.indexOf(groupID) >= 0) {
				return true;
			}
		}
		return false;
	}

	function isGroupManipulatable(socketid, groupID, endCallback) {
		getGroupList(function (err, data) {
			if (groupID === "group_default") {
				endCallback(true);
				return;
			}
			if (groupID === undefined || groupID === "") {
				endCallback(true);
				return;
			}
			if (socketidToLoginKey.hasOwnProperty(socketid)) {
				socketid = socketidToLoginKey[socketid];
			}
			var authority;
			if (socketidToAccessAuthority.hasOwnProperty(socketid)) {
				authority = socketidToAccessAuthority[socketid];
				endCallback(authority.group_manipulatable);
				return;
			}
			endCallback(false);
			return;
		});
	}

	function isDisplayManipulatable(socketid, endCallback) {
		if (socketidToLoginKey.hasOwnProperty(socketid)) {
			socketid = socketidToLoginKey[socketid];
		}
		var authority;
		if (socketidToAccessAuthority.hasOwnProperty(socketid)) {
			authority = socketidToAccessAuthority[socketid];
			endCallback(authority.display_manipulatable);
			return;
		}
	}

	function isAdmin(socketid, endCallback) {
		var userid;
		if (socketidToLoginKey.hasOwnProperty(socketid)) {
			socketid = socketidToLoginKey[socketid];
		}
		if (socketidToUserID.hasOwnProperty(socketid)) {
			userid = socketidToUserID[socketid];
		}
		getAdminUserSetting(function (err, adminSetting) {
			if (adminSetting && adminSetting.hasOwnProperty(userid) || socketid === "master") {
				endCallback(null, true);
			} else {
				endCallback(null, false);
			}
		});
	}

	/**
	 * コンテンツの追加を行うコマンドを実行する.
	 * @method commandAddContent
	 * @param {Object} metaData メタデータ
	 * @param {BLOB} binaryData バイナリデータ
	 * @param {Function} endCallback コンテンツ新規追加した場合に終了時に呼ばれるコールバック
	 * @param {Function} updateEndCallback コンテンツ差し替えした場合に終了時に呼ばれるコールバック
	 */
	function commandAddContent(socketid, metaData, binaryData, endCallback, updateEndCallback) {
		console.log("commandAddContent", metaData, binaryData);
		
		if (isEditable(socketid, metaData.group)) {
			if (metaData.hasOwnProperty('id') && metaData.id !== "") {
				textClient.exists(metadataPrefix + metaData.id, function (err, doesExists) {
					if (!err && doesExists === 1) {
						getMetaData(socketid, '', metaData.id, function (err, meta) {
							if (err) {
								endCallback(err);
								return;
							}
							var oldContentID,
								newContentID;
							if (metaData.hasOwnProperty('content_id')) {
								oldContentID = metaData.content_id;
							}
							if (meta.hasOwnProperty('content_id')) {
								newContentID = meta.content_id;
							}
							
							if (newContentID !== '' && oldContentID === newContentID) {
								updateContent(socketid, metaData, binaryData, function (reply) {
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
		} else {
			if (endCallback) {
				endCallback("access denied");
			}
		}
	}
	
	/**
	 * コンテンツの取得を行うコマンドを実行する.
	 * @method commandGetContent
	 * @param {JSON} json contentメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetContent(socketid, json, endCallback) {
		console.log("commandGetContent:" + json.id);
		if (!isViewable(socketid, json.group)) {
			endCallback("access denied");
			return;
		}
		getMetaData(socketid, json.type, json.id, function (err, meta) {
			if (err) {
				endCallback(err);
				return;
			}
			if (meta && meta.hasOwnProperty('content_id') && meta.content_id !== '') {
				//meta.command = Command.doneGetContent;

				// 履歴から復元して取得
				if (json.hasOwnProperty('restore_index') && meta.hasOwnProperty('backup_list')) {
					var backupList = sortBackupList(JSON.parse(meta.backup_list));
					var restore_index = Number(json.restore_index);
					if (restore_index >= 0 && backupList.length > restore_index) {
						var backup_date = backupList[restore_index];
						textClient.hmget(metadataBackupPrefix + meta.id, backup_date, function (err, metaData) {
							client.hmget(contentBackupPrefix + meta.content_id, backup_date, function (err, reply) {
								endCallback(null, JSON.parse(metaData), reply[0]);
							});
						})
						return;
					}
				}

				// 通常の取得
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
	 * @method commandAddMetaData
	 * @param {JSON} json contentメタデータ
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
	 * @param {JSON} json contentメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetMetaData(socketid, json, endCallback) {
		console.log("commandGetMetaData:" + json.type + "/" + json.id);
		getMetaData(socketid, json.type, json.id, function (err, metaData) {
			if (endCallback) {
				endCallback(err, metaData);
			}
		});
	}
	
	/**
	 * コンテンツの削除を行うコマンドを実行する.
	 * @method commandDeleteContent
	 * @param {JSON} json メタデータリスト
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandDeleteContent(socketid, json, endCallback) {
		console.log("commandDeleteContent:", json.length);
		var i,
			metaData,
			results = [],
			all_done = json.length,
			syncDelete = function (results, all_done) {
				if (all_done <= 0) {
					if (endCallback) {
						endCallback(null, results);
						return;
					}
				} else {
					var metaData = json[all_done - 1];
					if (isEditable(socketid, metaData.group)) {
						if (metaData && metaData.hasOwnProperty('type') && metaData.type === 'all') {
							textClient.keys(metadataPrefix + '*', function (err, replies) {
								replies.forEach(function (id, index) {
									console.log(id);
									textClient.hgetall(id, function (err, data) {
										if (!err && data) {
											deleteContent(data, function (meta) {
												if (endCallback) {
													endCallback(null, meta);
												}
											});
										}
									});
								});
							});
							all_done = 0;
							if (endCallback) {
								endCallback(null, results);
								return;
							}
						} else {
							deleteContent(metaData, function (meta) {
								results.push(meta);
								syncDelete(results, all_done - 1);
							});
						}
					} else {
						syncDelete(results, all_done - 1);
					}
				}
			};

			syncDelete(results, all_done);
	}

	/**
	 * コンテンツの更新を行うコマンドを実行する.
	 * @method commandUpdateContent
	 * @param {Object} metaData contentメタデータ
	 * @param {BLOB} binaryData loadMetaBinaryから受領したバイナリデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandUpdateContent(socketid, metaData, binaryData, endCallback) {
		//console.log("commandUpdateContent");
		if (isEditable(socketid, metaData.group)) {
			updateContent(socketid, metaData, binaryData, function (meta) {
				// socket.emit(Command.doneUpdateContent, JSON.stringify({"id" : id}));
				if (endCallback) {
					endCallback(null, meta);
				}
			});
		} else {
			endCallback("access denied");
		}
	}
	
	/**
	 * メタデータの更新を行うコマンドを実行する.
	 * @method commandUpdateMetaData
	 * @param {JSON} json windowメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandUpdateMetaData(socketid, json, endCallback) {
		console.log("commandUpdateMetaData:", json.length);
		var i,
			metaData,
			results = [],
			all_done = json.length;

		for (i = 0; i < json.length; i = i + 1) {
			metaData = json[i];
			if (isEditable(socketid, metaData.group)) {
				textClient.exists(metadataPrefix + json[i].id, (function (metaData) {
					return function (err, doesExists) {
						if (!err && doesExists === 1) {
							
							if (!metaData.hasOwnProperty('orgWidth') || !metaData.hasOwnProperty('orgHeight')) {
								getContent(metaData.type, metaData.content_id, function (reply) {
									// メタデータ初期設定.
									initialOrgWidthHeight(metaData, reply);
									
									if (metaData.hasOwnProperty('restore_index')) {
										var restore_index = Number(metaData.restore_index);
										if (restore_index >= 0) {
											var backupMetaData = {};
											backupMetaData[metaData.date] = JSON.stringify(metaData);
											client.hmset(metadataBackupPrefix + metaData.id, backupMetaData, function (err) {});
										}
									}
									
									setMetaData(metaData.type, metaData.id, metaData, function (meta) {
										getMetaData(socketid, meta.type, meta.id, function (err, meta) {
											--all_done;
											if (!err) {
												results.push(meta);
											}
											if (all_done <= 0) {
												if (endCallback) {
													endCallback(null, results);
													return;
												}
											}
										});
									});
								});
							} else {

								if (metaData.hasOwnProperty('restore_index')) {
									var restore_index = Number(metaData.restore_index);
									if (restore_index >= 0) {
										var backupMetaData = {};
										backupMetaData[metaData.date] = JSON.stringify(metaData);
										client.hmset(metadataBackupPrefix + metaData.id, backupMetaData, function (err) {});
									}
								}
								setMetaData(metaData.type, metaData.id, metaData, function (meta) {
									getMetaData(socketid, meta.type, meta.id, function (err, meta) {
										--all_done;
										if (!err) {
											results.push(meta);
										}
										if (all_done <= 0) {
											if (endCallback) {
												endCallback(null, results);
												return;
											}
										}
									});
								});
							}
						}
					};
				}(metaData)));
			} else {
				--all_done;
			}
		}
	}

	/**
	 * ウィンドウの追加を行うコマンドを実行する.
	 * @method commandAddWindowMetaData
	 * @param {String} socketid ソケットID
	 * @param {JSON} json windowメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandAddWindowMetaData(socketid, json, endCallback) {
		console.log("commandAddWindowMetaData : " + JSON.stringify(json));
		addWindow(socketid, json, function (windowData) {
			if (endCallback) {
				endCallback(null, [windowData]);
			}
		});
	}
	
	/**
	 * ウィンドウの削除行うコマンドを実行する.
	 * @method commandDeleteWindowMetaData
	 * @param {String} socketid ソケットID
	 * @param {JSON} json windowメタデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandDeleteWindowMetaData(socketid, json, endCallback) {
		console.log("commandDeleteWindowMetaData");
		var i,
			meta,
			results = [],
			all_done = json.length;

		isDisplayManipulatable(socketid, function (isManipulatable) {
			if (isManipulatable) {
				for (i = 0; i < json.length; i = i + 1) {
					meta = json[i];
					getWindowMetaData(meta, function (metaData) {
						if (metaData) {
							deleteWindow(metaData, function (meta) {
								--all_done;
								results.push(meta);
								if (all_done <= 0) {
									if (endCallback) {
										endCallback(null, results);
										return;
									}
								}
							});
						} else {
							if (endCallback) {
								endCallback("not exists window metadata", null);
							}
						}
					});
				}
			}
		});
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
	 *  グループリストを取得する.
	 * @method commandGetGroupList
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetGroupList(endCallback) {
		getGroupList(endCallback);
	}
	
	/**
	 *  グループを追加する.
	 * @method commandAddGroup
	 * @param {JSON} json 対象のnameを含むjson
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandAddGroup(socketid, json, endCallback) {
		var groupColor = "";
		if (json.hasOwnProperty("name") && json.name !== "") {
			if (socketidToLoginKey.hasOwnProperty(socketid)) {
				socketid = socketidToLoginKey[socketid];
			}
			var userid = socketidToUserID[socketid];
			isGroupManipulatable(socketid, userid, function (isManipulatable) {
				if (isManipulatable) {
					if (json.hasOwnProperty("color")) {
						groupColor = json.color;
					}
					addGroup(socketid, null, json.name, groupColor, function (err, groupID) {
						// グループユーザーの権限情報に、グループを追加する.
						if (!err) {
							getGroupUserSetting(function (err, setting) {
								if (setting.hasOwnProperty(userid)) {
									if (setting[userid].viewable !== "all") {
										setting[userid].viewable.push(groupID);
									}
									if (setting[userid].editable !== "all") {
										setting[userid].editable.push(groupID);
									}
									// defaultグループは特殊扱いでユーザー無し
									if (userid !== "group_default") {
										changeGroupUserSetting(socketid, userid, setting[userid], function () {
											if (endCallback) {
												endCallback(err, groupID);
											}
										});
									}
								} else {
									if (endCallback) {
										endCallback(err, groupID);
									}
								}
							});
						} else {
							endCallback("faild to add group");
						}
					});
				} else {
					endCallback("access denied");
				}
			});
		} else {
			endCallback("faild to add group : invalid parameter");
		}
	}

	/**
	 *  グループを削除する.
	 * @method commandDeleteGroup
	 * @param {JSON} json 対象のid, nameを含むjson
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandDeleteGroup(socketid, json, endCallback) {
		if (json.hasOwnProperty("id") && json.hasOwnProperty("name") && json.name !== "") {
			deleteGroup(socketid, json.id, json.name, endCallback);
		}
	}

	/**
	 * グループを更新する
	 * @method commandUpdateGroup
	 * @param {JSON} json 対象のid, nameを含むjson
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandUpdateGroup(socketid, json, endCallback) {
		if (json.hasOwnProperty("id")) {
			updateGroup(socketid, json.id, json, endCallback);
		}
	}

	/**
	 * グループインデックスを変更する.
	 * @method commandChangeGroupIndex
	 * @param {JSON} json 対象のid, indexを含むjson
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandChangeGroupIndex(socketid, json, endCallback) {
		if (json.hasOwnProperty("id") && json.hasOwnProperty("index")) {
			changeGroupIndex(socketid, json.id, json.index, endCallback);
		}
	}

	/**
	 * 新しい保存領域を作成
	 * @method commandChangeGroupIndex
	 * @param {JSON} json 対象のnameを含むjson
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandNewDB(socketid, json, endCallback) {
		if (json.hasOwnProperty("name")) {
			newDB(socketid, json.name, endCallback);
		} else {
			endCallback("faild to newdb : invalid parameter");
		}
	}

	/**
	 * 保存領域の名前を変更
	 * @method commandRenameDB
	 * @param {JSON} json 対象のname, new_nameを含むjson
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandRenameDB(socketid, json, endCallback) {
		if (json.hasOwnProperty('name') && json.hasOwnProperty('new_name')) {
			renameDB(socketid, json.name, json.new_name, endCallback);
		} else {
			endCallback("faild to renamedb : invalid parameter");
		}
	}

	/**
	 * DBの参照先保存領域の変更
	 * @method commandChangeDB
	 * @param {JSON} json 対象のnameを含むjson
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandChangeDB(socketid, json, endCallback) {
		if (json.hasOwnProperty("name")) {
			changeDB(socketid, json.name, endCallback);
		} else {
			endCallback("faild to changedb : invalid parameter");
		}
	}
	
	/**
	 * DBの保存領域の削除
	 * @method commandDeleteDB
	 * @param {JSON} json 対象のnameを含むjson
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandDeleteDB(socketid, json, endCallback) {
		if (json.hasOwnProperty("name")) {
			if (json.name === "default") {
				endCallback("Unauthorized name for deleting")
			} else {
				deleteDB(socketid, json.name, endCallback);
			}
		} else {
			endCallback("faild to deletedb : invalid parameter");
		}
	}

	/**
	 * DBの保存領域の初期化
	 * @method commandInitDB
	 * @param {JSON} json 対象のnameを含むjson
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandInitDB(socketid, json, endCallback) {
		if (json.hasOwnProperty("name")) {
			initDB(socketid, json.name, endCallback);
		} else {
			endCallback("faild to initdb : invalid parameter");
		}
	}

	/**
	 * DBの保存領域のリストを取得
	 * @method commandGetDBList
	 * @param {Function} resultCallback 終了時に呼ばれるコールバック
	 */
	function commandGetDBList(socketid, resultCallback) {
		isAdmin(socketid, function (err, isAdmin) {
			if (!err && isAdmin) {
				textClient.hgetall(frontPrefix + 'dblist', resultCallback);
			} else {
				resultCallback("access denied");
			}
		});	
	}

	/**
	 * 各種設定の変更
	 * @method commandChangeGlobalSetting
	 * TODO
	 */
	function commandChangeGlobalSetting(socketid, json, endCallback) {
		changeGlobalSetting(socketid, json, endCallback);
	}

	/**
	 * 各種設定の取得
	 */
	function commandGetGlobalSetting(json, endCallback) {
		getGlobalSetting(endCallback);
	}

	/**
	 * ウィンドウの取得を行うコマンドを実行する.
	 * @method commandGetWindowMetaData
	 * @param {String} socketid ソケットID
	 * @param {JSON} json 対象のid, typeを含むjson
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetWindowMetaData(socketid, json, endCallback) {
		var isAllType = json.hasOwnProperty('type') && json.type === 'all',
			isIdentityType = json.hasOwnProperty('id') && json.id !== undefined && json.id !== "undefined" && json.id !== "";
		if (isAllType || isIdentityType) {
			getWindowMetaData(json, function (windowData) {
				if (windowData) {
					console.log("doneGetWindow:", windowData);
					if (endCallback) {
						endCallback(null, windowData);
					}
				} else {
					endCallback("not found window metadata", null);
				}
			});
		}
	}

	/**
	 * ウィンドウの更新を行うコマンドを実行する.
	 * @method commandUpdateWindowMetaData
	 * @param {String} socketid ソケットID
	 * @param {JSON} json 対象のjson
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandUpdateWindowMetaData(socketid, json, endCallback) {
		console.log("commandUpdateWindowMetaData:", json.length);
		var i,
			metaData,
			results = [],
			all_done = json.length;

		isDisplayManipulatable(socketid, function (isManipulatable) {
			if (isManipulatable) {
				for (i = 0; i < json.length; i = i + 1) {
					metaData = json[i];
					updateWindowMetaData(socketid, metaData, function (meta) {
						--all_done;
						results.push(meta);
						if (all_done <= 0) {
							if (endCallback) {
								endCallback(null, results);
								return;
							}
						}
					});
				}
			}
		});
	}

    /**
     * mouseコマンドを実行する.
     * リモートマウスカーソル表示のために HSV カラーを新規接続に応じて生成する
     * @method commandUpdateMouseCursor
     * @param {String} socketid ソケットID
	 * @param {JSON} json mouse情報を含んだjson
     * @param {Function} endCallback 終了時に呼ばれるコールバック
     */
    function commandUpdateMouseCursor(socketid, json, endCallback) {
        var c, i, j;
        if(!connectionId.hasOwnProperty(socketid)){
            connectionId[socketid] = connectionCount;
            ++connectionCount;
        }
		json.connectionCount = connectionId[socketid];
        updateMouseCursor(socketid, json, function (windowData) {
            endCallback(null, windowData);
        });
    }

	/**
	 * グループユーザー設定変更コマンドを実行する
     * @method commandUpdateMouseCursor
	 * @param {JSON} data 対象のnameを含むjson
     * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandChangeGroupUserSetting(socketid, data, endCallback) {
		var setting,
			name;
		if (data.hasOwnProperty('name')) {
			name = data.name;
			delete data.name;
			getGroupID(data.name, function (id) {
				changeGroupUserSetting(socketid, id, data, endCallback);
			});
		}
	}
	
	/**
	 * ユーザーリスト取得コマンドを実行する
     * @method commandGetUserList
     * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandGetUserList(endCallback) {
		getUserList(endCallback);
	}

	/**
	 * ログインコマンドを実行する
     * @method commandLogin
	 * @param {JSON} data 対象のid, passwordを含むjson
	 *               再ログインする場合はコールバックで返ってくる値を loginkey としてjsonに入れる.
	 * @param {String} socketid ソケットID
     * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function commandLogin(data, socketid, endCallback) {
		console.log("----------------------------" , socketid, "----------------------------")
		if (data.hasOwnProperty('id') && data.hasOwnProperty('password')) {
			// 再ログイン用のsocketidがloginkeyに入っていたらそちらを使う.
			if (data.hasOwnProperty('loginkey')) {
				if (socketidToAccessAuthority.hasOwnProperty(data.loginkey)) 
				{
					// 対応関係を保存
					socketidToLoginKey[socketid] = data.loginkey;
					socketid = data.loginkey;
					var result = {
						id : socketidToUserID[socketid],
						loginkey : socketid,
						authority : socketidToAccessAuthority[socketid]
					}
					endCallback(null, result);
					return;
				} else {
					endCallback("ログアウトしました", false);
					return;
				}
			}
			login(data.id, data.password, socketid, endCallback);
		} else {
			endCallback("ユーザ名またはパスワードが正しくありません.");
		}
	}

	/**
	 * パスワードを変更する
	 * @method commandChangePassword
	 */
	function commandChangePassword(socketid, data, endCallback) {
		var authority;
		if (socketidToLoginKey.hasOwnProperty(socketid)) {
			socketid = socketidToLoginKey[socketid];
		}
		if (!socketidToAccessAuthority.hasOwnProperty(socketid)) {
			endCallback("failed to change password (1)");
			return;
		}
		authority = socketidToAccessAuthority[socketid];
		if (authority.editable !== 'all') {
			endCallback("failed to change password (2)");
			return;
		}
		if (data.hasOwnProperty('id') && data.hasOwnProperty('pre_password') && data.hasOwnProperty('password'))
		{
			getUserList(function (err, userList) {
				var i;
				for (i = 0; i < userList.length; i = i + 1) {
					if (userList[i].id === data.id) {
						if (userList[i].type === "admin") {
							changeAdminUserSetting(socketid, userList[i].id, {
								pre_password : data.pre_password,
								password : data.password
							}, endCallback);
						} else if (userList[i].type === "group") {
							changeGroupUserSetting(socketid, userList[i].id, {
								password : data.password
							}, endCallback);
						} else {
							endCallback("failed to change password (3)");
						}
						break;
					}
				}
			});
		}
	}

	function getGroupID(groupName, endCallback) {
		getGroupList(function (err, groupList) {
			var k;
			for (k = 0; k < groupList.grouplist.length; k = k + 1) {
				if (groupList.grouplist[k].name === groupName) {
					endCallback(groupList.grouplist[k].id);
				}
			}
		});
	}

	function getAdminID(adminName, endCallback) {
		getAdminList(function (err, adminList) {
			var k;
			for (k = 0; k < adminList.adminlist.length; k = k + 1) {
				if (adminList.adminlist[k].name === groupName) {
					endCallback(adminList.adminlist[k].id);
				}
			}
		});
	}

	/**
	 * 権限情報を変更する
	 */
	function commandChangeAuthority(socketid, data, endCallback) {
		var authority;
		if (socketidToLoginKey.hasOwnProperty(socketid)) {
			socketid = socketidToLoginKey[socketid];
		}
		if (!socketidToAccessAuthority.hasOwnProperty(socketid)) {
			endCallback("failed to change authority (1)");
			return;
		}
		authority = socketidToAccessAuthority[socketid];
		if (authority.editable !== 'all') {
			endCallback("failed to change authority (2)");
			return;
		}
		if (data.hasOwnProperty('id') 
			&& data.hasOwnProperty('editable') 
			&& data.hasOwnProperty('viewable')
			&& data.hasOwnProperty('group_manipulatable')
			&& data.hasOwnProperty('display_manipulatable'))
		{
			getUserList(function (err, userList) {
				var i;
				getGroupList(function (err, groupList) {
					for (i = 0; i < userList.length; i = i + 1) {
						if (userList[i].id === data.id) {
							if (userList[i].type === "group" || userList[i].type === "guest" || userList[i].type === "display") {
								var setting = {
									viewable : data.viewable,
									editable : data.editable,
									group_manipulatable : data.group_manipulatable,
									display_manipulatable : data.display_manipulatable
								};
								changeGroupUserSetting(socketid, userList[i].id, setting, function (err, reply) {
									if (!err) {
										endCallback(err, userList[i].id);
									} else {
										endCallback(err);
									}
								});	
							}
							break;
						}
					}
				});
			});
		} else {
			endCallback("failed to change authority (3)");
		}
	}

	/**
	 * ログアウトコマンドを実行する
	 */
	function commandLogout(data, socketid, endCallback) {
		if (data.hasOwnProperty('loginkey')) {
			console.log("Logout", data.loginkey)
			removeAuthority(data.loginkey);
			endCallback(null, data.loginkey);
		} else {
			console.log("Logout", socketid)
			removeAuthority(socketid);
			endCallback(null, socketid);
		}
	}

	/**
	 * update処理実行後のブロードキャスト用ラッパー.
	 * @method post_update
	 */
	function post_update(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.Update);
			io_connector.broadcast(io, Command.Update);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}
	
	/**
	 * updateMetaData処理実行後のブロードキャスト用ラッパー.
	 * @method post_updateMetaData
	 */
	function post_updateMetaData(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.UpdateMetaData, reply);
			io_connector.broadcast(io, Command.UpdateMetaData, reply);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}
	
	/**
	 * updateGroup処理実行後のブロードキャスト用ラッパー.
	 * @method post_updateGroup
	 */
	function post_updateGroup(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.UpdateGroup, reply);
			io_connector.broadcast(io, Command.UpdateGroup, reply);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}

	/**
	 * updateContent処理実行後のブロードキャスト用ラッパー.
	 * @method post_updateContent
	 */
	function post_updateContent(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.UpdateContent, reply);
			io_connector.broadcast(io, Command.UpdateContent, reply);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}

	/**
	 * updateDB処理実行後のブロードキャスト用ラッパー.
	 * @method post_updateContent
	 */
	function post_updateDB(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.UpdateContent, reply);
			io_connector.broadcast(io, Command.UpdateContent, reply);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}
	
	/**
	 * deletecontent処理実行後のブロードキャスト用ラッパー.
	 * @method post_deleteContent
	 */
	function post_deleteContent(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.DeleteContent, reply);
			io_connector.broadcast(io, Command.DeleteContent, reply);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}

	/**
	 * deleteWindow処理実行後のブロードキャスト用ラッパー.
	 * @method post_deleteWindow
	 */
	function post_deleteWindow(ws, io, ws_connections, resultCallback) {
		return function (err, reply) {
			var socketid,
				id,
				i;
			ws_connector.broadcast(ws, Command.DeleteWindowMetaData, reply);
			io_connector.broadcast(io, Command.DeleteWindowMetaData, reply);
			
			for (socketid in socketidToHash) {
				if (socketidToHash.hasOwnProperty(socketid)) {
					id = socketidToHash[socketid];
					for (i = 0; i < reply.length; i = i + 1) {
						if (reply[i].id === id) {
							if (ws_connections.hasOwnProperty(socketid)) {
								ws_connector.send(ws_connections[socketid], Command.Disconnect);
							}
						}
					}
					delete socketidToHash[socketid];
				}
			}
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}
	
	/**
	 * updateWindowMetaData処理実行後のブロードキャスト用ラッパー.
	 * @method post_updateWindowMetaData
	 */
	function post_updateWindowMetaData(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.UpdateWindowMetaData, reply);
			io_connector.broadcast(io, Command.UpdateWindowMetaData, reply);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}
	
	/**
	 * updateMouseCursor処理実行後のブロードキャスト用ラッパー.
	 * @method post_updateMouseCursor
	 */
	function post_updateMouseCursor(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.UpdateMouseCursor, reply);
			io_connector.broadcast(io, Command.UpdateMouseCursor, reply);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}

	/**
	 * 設定変更処理終了後のブロードキャスト用ラッパー.
	 * カレントDBが変更された場合も設定変更であるので通知される.
	 * @method post_updateSetting
	 */
	function post_updateSetting(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.UpdateSetting, reply);
			io_connector.broadcast(io, Command.UpdateSetting, reply);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}

	/**
	 * DBが変更されたことを通知する
	 * @method post_db_change
	 */
	function post_db_change(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.ChangeDB, reply);
			io_connector.broadcast(io, Command.ChangeDB, reply);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}

	/**
	 * 権限が変更されたことを通知する
	 * @method post_updateAuthority
	 */
	function post_updateAuthority(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.ChangeAuthority, reply);
			io_connector.broadcast(io, Command.ChangeAuthority, reply);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
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
	function registerWSEvent(ws_connection, io, ws) {
		var methods = {};

		console.log("registerWSEvent");
		
		ws_connector.on(Command.AddMetaData, function (data, resultCallback) {
			commandAddMetaData(data, resultCallback);
		});
		
		ws_connector.on(Command.GetMetaData, function (data, resultCallback, socketid) {
			commandGetMetaData(socketid, data, resultCallback);
		});

		ws_connector.on(Command.GetContent, function (data, resultCallback, socketid) {
			commandGetContent(socketid, data, resultCallback);
		});
		
		ws_connector.on(Command.UpdateMetaData, function (data, resultCallback, socketid) {
			commandUpdateMetaData(socketid, data, post_updateMetaData(ws, io, resultCallback));
		});
		
		ws_connector.on(Command.AddWindowMetaData, function (data, resultCallback, socketid) {
			commandAddWindowMetaData(socketid, data, post_updateWindowMetaData(ws, io, resultCallback));
		});
		
		ws_connector.on(Command.GetWindowMetaData, function (data, resultCallback, socketid) {
			commandGetWindowMetaData(socketid, data, resultCallback);
		});
		
		ws_connector.on(Command.UpdateWindowMetaData, function (data, resultCallback, socketid) {
			commandUpdateWindowMetaData(socketid, data, post_updateWindowMetaData(ws, io, resultCallback));
		});

		ws_connector.on(Command.DeleteWindowMetaData, function (data, resultCallback, socketid) {
			commandDeleteWindowMetaData(socketid, data, post_deleteWindow(ws, io, ws_connections, resultCallback));
		});

		ws_connector.on(Command.UpdateMouseCursor, function(data, resultCallback, socketid){
			commandUpdateMouseCursor(socketid, data, post_updateMouseCursor(ws, io, resultCallback));
		});
		
		ws_connector.on(Command.UpdateVirtualDisplay, function (data, resultCallback, socketid) {
			commandUpdateVirtualDisplay(socketid, data, post_updateWindowMetaData(ws, io, resultCallback));
		});
		
		ws_connector.on(Command.GetVirtualDisplay, function (data, resultCallback, socketid) {
			commandGetVirtualDisplay(socketid, data, resultCallback);
		});

		ws_connector.on(Command.GetGroupList, function (data, resultCallback) {
			commandGetGroupList(resultCallback);
		});
		
		ws_connector.on(Command.AddGroup, function (data, resultCallback, socketid) {
			commandAddGroup(socketid, data, post_updateGroup(ws, io, resultCallback));
		});

		ws_connector.on(Command.DeleteGroup, function (data, resultCallback, socketid) {
			commandDeleteGroup(socketid, data, post_updateGroup(ws, io, resultCallback));
		});

		ws_connector.on(Command.UpdateGroup, function (data, resultCallback, socketid) {
			commandUpdateGroup(socketid, data, post_updateGroup(ws, io, resultCallback));
		});
		
		ws_connector.on(Command.ChangeGroupIndex, function (data, resultCallback, socketid) {
			commandChangeGroupIndex(socketid, data, post_updateGroup(ws, io, resultCallback));
		});

		ws_connector.on(Command.ShowWindowID, function (data, resultCallback) {
			ws_connector.broadcast(ws, Command.ShowWindowID, data);
			io_connector.broadcast(io, Command.ShowWindowID, data);
			if (resultCallback) {
				resultCallback();
			}
		});

		ws_connector.on(Command.SendMessage, function (data, resultCallback) {
			ws_connector.broadcast(ws, Command.SendMessage, data);
			io_connector.broadcast(io, Command.SendMessage, data);
			if (resultCallback) {
				resultCallback();
			}
		});
		
		ws_connector.on(Command.AddContent, function (data, resultCallback, socketid) {
			var metaData = data.metaData,
				binaryData = data.contentData;
			console.log(Command.AddContent, data);
			commandAddContent(socketid, metaData, binaryData, post_update(ws, io, resultCallback), post_updateContent(ws, io, resultCallback));
		});
		
		ws_connector.on(Command.DeleteContent, function (data, resultCallback, socketid) {
			commandDeleteContent(socketid, data, post_deleteContent(ws, io, resultCallback));
		});

		ws_connector.on(Command.UpdateContent, function (data, resultCallback, socketid) {
			var metaData = data.metaData,
				binaryData = data.contentData;
			commandUpdateContent(socketid, metaData, binaryData, post_updateContent(ws, io, resultCallback));
		});

		ws_connector.on(Command.NewDB, function (data, resultCallback, socketid) {
			commandNewDB(socketid, data, post_db_change(ws, io, resultCallback));
		});
		ws_connector.on(Command.RenameDB, function (data, resultCallback, socketid) {
			commandRenameDB(socketid, data, post_updateSetting(ws, io, resultCallback));
		});
		ws_connector.on(Command.ChangeDB, function (data, resultCallback, socketid) {
			commandChangeDB(socketid, data, post_db_change(ws, io, resultCallback));
		});
		ws_connector.on(Command.DeleteDB, function (data, resultCallback, socketid) {
			commandDeleteDB(socketid, data, post_db_change(ws, io, resultCallback));
		});
		ws_connector.on(Command.InitDB, function (data, resultCallback, socketid) {
			commandInitDB(socketid, data, post_db_change(ws, io, resultCallback));
		});
		ws_connector.on(Command.GetDBList, function (data, resultCallback, socketid) {
			commandGetDBList(socketid, resultCallback);
		});

		ws_connector.on(Command.Logout, function (data, resultCallback, socketid) {
			commandLogout(data, socketid, resultCallback);
		});
		ws_connector.on(Command.Login, function (data, resultCallback, socketid) {
			commandLogin(data, socketid, resultCallback);
		});
		ws_connector.on(Command.ChangePassword, function (data, resultCallback, socketid) {
			commandChangePassword(socketid, data, resultCallback);
		});
		ws_connector.on(Command.ChangeAuthority, function (data, resultCallback, socketid) {
			commandChangeAuthority(socketid, data, post_updateAuthority(ws, io, resultCallback));
		});
		ws_connector.on(Command.GetUserList, function (data, resultCallback) {
			commandGetUserList(resultCallback);
		});
		ws_connector.on(Command.ChangeGlobalSetting, function (data, resultCallback, socketid) {
			commandChangeGlobalSetting(socketid, data, post_updateSetting(ws, io, resultCallback));
		});
		ws_connector.on(Command.GetGlobalSetting, function (data, resultCallback) {
			commandGetGlobalSetting(data, resultCallback);
		});
		ws_connector.on(Command.RTCOffer, function (data, resultCallback) {
			ws_connector.broadcast(ws, Command.RTCOffer, data);
			io_connector.broadcast(io, Command.RTCOffer, data);
			if (resultCallback) {
				resultCallback();
			}
		});
		ws_connector.on(Command.RTCRequest, function (data, resultCallback) {
			io_connector.broadcast(io, Command.RTCRequest, data);
			if (resultCallback) {
				resultCallback();
			}
		});
		ws_connector.on(Command.RTCAnswer, function (data, resultCallback) {
			ws_connector.broadcast(ws, Command.RTCAnswer, data);
			io_connector.broadcast(io, Command.RTCAnswer, data);
			if (resultCallback) {
				resultCallback();
			}
		});
		ws_connector.on(Command.RTCIceCandidate, function (data, resultCallback) {
			//ws_connector.broadcast(ws, Command.RTCIceCandidate, data);
			io_connector.broadcast(io, Command.RTCIceCandidate, data);
			if (resultCallback) {
				resultCallback();
			}
		});
		ws_connector.on(Command.RTCClose, function (data, resultCallback) {
			io_connector.broadcast(io, Command.RTCClose, data);
			if (resultCallback) {
				resultCallback();
			}
		});

		getSessionList();
		ws_connector.registerEvent(ws, ws_connection);

		
		console.log("registerWSEvent End");
	}
	
	/**
	 * socketioイベントの登録を行う.
	 * @method registerEvent
	 * @param {BLOB} socket socket.ioオブジェクト
	 * @param {BLOB} io socket.ioオブジェクト
	 * @param {BLOB} ws WebSocketオブジェクト
	 */
	function registerEvent(io, socket, ws, ws_connections) {
		var methods = {};

		io_connector.on(Command.AddContent, function (data, resultCallback, socketid) {
			var metaData = data.metaData,
				binaryData = data.contentData;
			commandAddContent(socketid, metaData, binaryData, post_update(ws, io, resultCallback), post_updateContent(ws, io, resultCallback));
		});

		io_connector.on(Command.AddMetaData, function (data, resultCallback) {
			commandAddMetaData(data, resultCallback);
		});
		
		io_connector.on(Command.GetContent, function (data, resultCallback, socketid) {
			commandGetContent(socketid, data, resultCallback);
		});

		io_connector.on(Command.GetMetaData, function (data, resultCallback, socketid) {
			commandGetMetaData(socketid, data, resultCallback);
		});

		io_connector.on(Command.DeleteContent, function (data, resultCallback, socketid) {
			commandDeleteContent(socketid, data, post_deleteContent(ws, io, resultCallback));
		});

		io_connector.on(Command.UpdateContent, function (data, resultCallback, socketid) {
			var metaData = data.metaData,
				binaryData = data.contentData;
			
			commandUpdateContent(socketid, metaData, binaryData, post_updateContent(ws, io, resultCallback));
		});

		io_connector.on(Command.UpdateMetaData, function (data, resultCallback, socketid) {
			commandUpdateMetaData(socketid, data, post_updateMetaData(ws, io, resultCallback));
		});

		io_connector.on(Command.AddWindowMetaData, function (data, resultCallback, socketid) {
			commandAddWindowMetaData(socketid, data, post_updateWindowMetaData(ws, io, resultCallback));
		});

		io_connector.on(Command.GetWindowMetaData, function (data, resultCallback, socketid) {
			commandGetWindowMetaData(socketid, data, resultCallback);
		});

		io_connector.on(Command.UpdateWindowMetaData, function (data, resultCallback, socketid) {
			commandUpdateWindowMetaData(socketid, data, post_updateWindowMetaData(ws, io, resultCallback));
		});

		io_connector.on(Command.DeleteWindowMetaData, function (data, resultCallback, socketid) {
			commandDeleteWindowMetaData(socketid, data, post_deleteWindow(ws, io, ws_connections, resultCallback));
		});

		io_connector.on(Command.UpdateMouseCursor, function(data, resultCallback, socketid){
			commandUpdateMouseCursor(socketid, data, post_updateMouseCursor(ws, io, resultCallback));
		});

        io_connector.on(Command.UpdateVirtualDisplay, function (data, resultCallback, socketid) {
			commandUpdateVirtualDisplay(socketid, data, post_updateWindowMetaData(ws, io, resultCallback));
		});

		io_connector.on(Command.GetVirtualDisplay, function (data, resultCallback, socketid) {
			commandGetVirtualDisplay(socketid, data, resultCallback);
		});
		
		io_connector.on(Command.GetGroupList, function (data, resultCallback) {
			commandGetGroupList(resultCallback);
		});

		io_connector.on(Command.AddGroup, function (data, resultCallback, socketid) {
			commandAddGroup(socketid, data, post_updateGroup(ws, io, resultCallback));
		});

		io_connector.on(Command.DeleteGroup, function (data, resultCallback, socketid) {
			commandDeleteGroup(socketid, data, post_updateGroup(ws, io, resultCallback));
		});

		io_connector.on(Command.UpdateGroup, function (data, resultCallback, socketid) {
			commandUpdateGroup(socketid, data, post_updateGroup(ws, io, resultCallback));
		});

		io_connector.on(Command.ChangeGroupIndex, function (data, resultCallback, socketid) {
			commandChangeGroupIndex(socketid, data, post_updateGroup(ws, io, resultCallback));
		});

		io_connector.on(Command.ShowWindowID, function (data, resultCallback) {
			ws_connector.broadcast(ws, Command.ShowWindowID, data);
			io_connector.broadcast(io, Command.ShowWindowID, data);
		});

		io_connector.on(Command.SendMessage, function (data, resultCallback) {
			ws_connector.broadcast(ws, Command.SendMessage, data);
			io_connector.broadcast(io, Command.SendMessage, data);
			if (resultCallback) {
				resultCallback();
			}
		});

		io_connector.on(Command.NewDB, function (data, resultCallback, socketid) {
			commandNewDB(socketid, data, post_db_change(ws, io, resultCallback));
		});
		io_connector.on(Command.RenameDB, function (data, resultCallback, socketid) {
			commandRenameDB(socketid, data, post_updateSetting(ws, io, resultCallback));
		});
		io_connector.on(Command.ChangeDB, function (data, resultCallback, socketid) {
			commandChangeDB(socketid, data, post_db_change(ws, io, resultCallback));
		});
		io_connector.on(Command.DeleteDB, function (data, resultCallback, socketid) {
			commandDeleteDB(socketid, data, post_db_change(ws, io, resultCallback));
		});
		io_connector.on(Command.InitDB, function (data, resultCallback, socketid) {
			commandInitDB(socketid, data, post_db_change(ws, io, resultCallback));
		});
		io_connector.on(Command.GetDBList, function (data, resultCallback, socketid) {
			commandGetDBList(socketid, resultCallback);
		});

		io_connector.on(Command.Logout, function (data, resultCallback, socketid) {
			commandLogout(data, socketid, resultCallback);
		});
		io_connector.on(Command.Login, function (data, resultCallback, socketid) {
			commandLogin(data, socketid, resultCallback);
		});
		io_connector.on(Command.ChangePassword, function (data, resultCallback, socketid) {
			commandChangePassword(socketid, data, resultCallback);
		});
		io_connector.on(Command.ChangeAuthority, function (data, resultCallback, socketid) {
			commandChangeAuthority(socketid, data, post_updateAuthority(ws, io, resultCallback));
		});
		io_connector.on(Command.GetUserList, function (data, resultCallback) {
			commandGetUserList(resultCallback);
		});
		io_connector.on(Command.ChangeGlobalSetting, function (data, resultCallback, socketid) {
			commandChangeGlobalSetting(socketid, data, post_updateSetting(ws, io, resultCallback));
		});
		io_connector.on(Command.GetGlobalSetting, function (data, resultCallback) {
			commandGetGlobalSetting(data, resultCallback);
		});
		io_connector.on(Command.RTCOffer, function (data, resultCallback) {
			ws_connector.broadcast(ws, Command.RTCOffer, data);
			io_connector.broadcast(io, Command.RTCOffer, data);
			if (resultCallback) {
				resultCallback();
			}
		});
		io_connector.on(Command.RTCRequest, function (data, resultCallback) {
			io_connector.broadcast(io, Command.RTCRequest, data);
			if (resultCallback) {
				resultCallback();
			}
		});
		io_connector.on(Command.RTCAnswer, function (data, resultCallback) {
			ws_connector.broadcast(ws, Command.RTCAnswer, data);
			io_connector.broadcast(io, Command.RTCAnswer, data);
			if (resultCallback) {
				resultCallback();
			}
		});
		io_connector.on(Command.RTCIceCandidate, function (data, resultCallback) {
			ws_connector.broadcast(ws, Command.RTCIceCandidate, data);
			//io_connector.broadcast(io, Command.RTCIceCandidate, data);
			if (resultCallback) {
				resultCallback();
			}
		});
		io_connector.on(Command.RTCClose, function (data, resultCallback) {
			ws_connector.broadcast(ws, Command.RTCClose, data);
			if (resultCallback) {
				resultCallback();
			}
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
		textClient.hset(frontPrefix + 'dblist', "default", id);
		contentPrefix = frontPrefix + uuidPrefix + contentPrefix;
		contentRefPrefix = frontPrefix + uuidPrefix + contentRefPrefix;
		contentBackupPrefix = frontPrefix + uuidPrefix + contentBackupPrefix;
		metadataPrefix = frontPrefix + uuidPrefix + metadataPrefix;
		metadataBackupPrefix = frontPrefix + uuidPrefix + metadataBackupPrefix;
		windowMetaDataPrefix = frontPrefix + uuidPrefix + windowMetaDataPrefix;
		windowContentPrefix = frontPrefix + uuidPrefix + windowContentPrefix;
		windowContentRefPrefix = frontPrefix + uuidPrefix + windowContentRefPrefix;
		virtualDisplayIDStr = frontPrefix + uuidPrefix + virtualDisplayIDStr;
		groupListPrefix = frontPrefix + uuidPrefix + groupListPrefix;
		adminListPrefix = frontPrefix + adminListPrefix;
		globalSettingPrefix = frontPrefix + globalSettingPrefix;
		adminUserPrefix = frontPrefix + adminUserPrefix; // 管理ユーザー設定
		groupUserPrefix = frontPrefix + uuidPrefix + groupUserPrefix; // グループユーザー設定
		console.log("idstr:" + contentPrefix);
		console.log("idstr:" + contentRefPrefix);
		console.log("idstr:" + metadataPrefix);
		console.log("idstr:" + windowMetaDataPrefix);
		console.log("idstr:" + windowContentPrefix);
		console.log("idstr:" + windowContentRefPrefix);
		console.log("idstr:" + groupListPrefix);
		console.log("idstr:" + contentBackupPrefix);
		console.log("idstr:" + metadataBackupPrefix);

		/// 管理者の初期登録
		
		textClient.exists(adminUserPrefix,  function (err, doesExists) {
			if (doesExists !== 1) {
				addAdmin("master", util.generateUUID8(), "管理者", "admin", function (err, reply) {});
			}
			// jsonから追加.
			fs.readFile("../admin.json", function (err, reply) {
				var name, data;
				if (!err) {
					try {
						var admins = JSON.parse(reply);
						for (name in admins) {
							data = admins[name];
							if (data.hasOwnProperty('command') && data.command === "add") {
								if (data.hasOwnProperty('password') && data.password.length > 0) {
									addAdmin("master", util.generateUUID8(), name, admins[name].password, (function (name) {
										return function (err, reply) {
											if (!err) {
												console.log(name, "を上書きしました");
											}
										};
									}(name)));
								}
							}
							else if (data.hasOwnProperty('command') && data.command === "delete") {
								deleteAdmin("master", name, (function (name) {
									return function (err, reply) {
										if (!err) {
											console.log(name, "を削除しました");
										}
									};
								}(name)));
							}
						}
					} catch (e) {
						console.error(e);
					}
				}
			});
		});
		groupInitialSettting();

		getGlobalSetting(function (err, setting) {
			if (!err && setting && setting.current_db) {
				textClient.hgetall(frontPrefix + 'dblist', function (err, dblist) {
					var name;
					for (name in dblist) {
						if (dblist[name] === setting.current_db) {
							changeDB("master", name, function () {});
						}
					}
				});
			}
		});
	}

	Operator.prototype.getContent = getContent;
	Operator.prototype.registerEvent = registerEvent;
	Operator.prototype.registerWSEvent = registerWSEvent;
	Operator.prototype.registerUUID = registerUUID;
	Operator.prototype.decrWindowReferenceCount = decrWindowReferenceCount;
	Operator.prototype.removeAuthority = removeAuthority;
	Operator.prototype.commandGetContent = commandGetContent;
	Operator.prototype.commandGetMetaData = commandGetMetaData;
	Operator.prototype.commandGetWindowMetaData = commandGetWindowMetaData;
	Operator.prototype.commandGetGroupList = commandGetGroupList;
	Operator.prototype.commandAddWindowMetaData = commandAddWindowMetaData;
	Operator.prototype.commandUpdateWindowMetaData = commandUpdateWindowMetaData;
	Operator.prototype.commandUpdateMouseCursor = commandUpdateMouseCursor;
	Operator.prototype.commandUpdateMetaData = commandUpdateMetaData;
	module.exports = new Operator();
}());
