/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

 
/**
 * Choder用DBリストアスクリプト
 * 使用方法:
 *    redisを起動している状態で、
 *    node restore.js バックアップファイルパス
 *    を実行し、Restore Endと表示されると正常終了です.
 *    既存DBで同じ名前のものがあった場合, 上書きされます
 */

var redis = require("redis");
var BSON = require('bson');
var bson = new BSON();
var path = require('path');
var fs = require('fs');
var client = redis.createClient(6379, '127.0.0.1', { 'return_buffers': true });
var textClient = redis.createClient(6379, '127.0.0.1', {'return_buffers': false});

// DBリストに復元したDBが無い場合は追加しておく
// @param key DB内の何かのkey
function appendDBtoDBList(dbentry, endCallback) {
	var dbid = key.split(':')[2];
	textClient.hgetall("tiled_server:t:dblist", function (err, reply) {
		if (!err) {
			textClient.hmset("tiled_server:t:dblist", dbentry.name, String(dbentry.id), endCallback);
		} else {
			endCallback(err)
		}
	});
}

if (process.argv.length > 2) {
	var backupFile = path.resolve(".", process.argv[2]);
	var backup = fs.readFileSync(backupFile);
	var data = bson.deserialize(backup);
	console.log(Object.keys(data));
	var key;
	var dbentry = {};
	if (data.hasOwnProperty("dbentry")) {
		dbentry = data.dbentry;
		delete data.dbentry;
	} else {
		console.error("not found db");
		process.exit(-1);
	}
	var i = 0;
	for (; i < Object.keys(data).length; i = i + 1) {
		key = Object.keys(data)[i];
		var buffer = data[key].buffer;
		textClient.exists(key, (function (isLast, key, buffer, dbentry) {
			return function (err, doesExist) {
				if (!err &&  doesExist === 1) {
					// 削除してからrestore
					client.del(key, function (err) {
						client.restore(key, 0, buffer, function (err, reply) {
							if (err) {
								console.error(err, key);
								process.exit(-1);
							}
							if (isLast) {
								appendDBtoDBList(dbentry, function (err) {
									if (!err) {
										console.log("Restore End");
										process.exit(0);
									} else {
										console.error(err);
										process.exit(-1);
									}
								});
							}
						});
					});
				} else {
					// そのままrestore
					client.restore(key, 0, buffer, function (err, reply) {
						if (err) {
							console.error(err, key);
							process.exit(-1);
						}
						if (isLast) {
							appendDBtoDBList(dbentry, function (err) {
								if (!err) {
									console.log("Restore End");
									process.exit(0);
								} else {
									console.error(err);
									process.exit(-1);
								}
							});
						}
					});
				}
			};
		}(i === Object.keys(data).length - 1, key, buffer, dbentry)));
	}
} else {
	console.log("usage: ");
	console.log("> node restore.js default.backup");
	process.exit(0);
}
