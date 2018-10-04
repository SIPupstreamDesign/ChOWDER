/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

/**
 * Choder用DBバックアップスクリプト
 * 使用方法:
 *    redisを起動している状態で、
 *    node backup.js
 *    を実行し、表示されるChOWDER DBから、バックアップしたいDBの番号を入力しEnter.
 *    Backup finishedと表示されると正常終了です.
 */

var redis = require("redis");
var BSON = require('bson');
var bson = new BSON();
var client = redis.createClient(6379, '127.0.0.1', {'return_buffers': true });
var textclient = redis.createClient(6379, '127.0.0.1', {'return_buffers': false});
var fs = require("fs");

client.hgetall("tiled_server:t:dblist", function (err, dblist) {
	var i;
	console.log("Please select backup db");
	for (i = 0; i < Object.keys(dblist).length; ++i) {
		console.log((i + 1) +": " + Object.keys(dblist)[i]);
	}
	var reader = require('readline').createInterface({
		input: process.stdin,
		output: process.stdout
	});
	reader.on('line', function (line) {
		var num = Number(line);
		var i;
		if (num !== null && !isNaN(num)) {
			var dbindex = num - 1;
			var dbname = Object.keys(dblist)[dbindex];
			var dbid = dblist[dbname];
			if (dbid) {
				var target = "tiled_server:t:" + dbid + ":*";
				console.log("Backup started:" + dbname, target);

				textclient.keys(target, (function (dbid, dbname) {
					return function (err, keys) {
						var i,
							backupData = {};
							
						if (!err) {
											
							// DBリスト復元用エントリ.
							var entry = {};
							entry.id = dbid;
							entry.name = dbname;
							backupData["dbentry"] = entry;
							
							// 実エントリ
							for (i = 0; i < keys.length; i = i + 1) {
								client.dump(keys[i], (function (isLast, key) {
									return function (err, result) {
										backupData[key] = result;
										if (isLast) {
											fs.writeFileSync(dbname + ".backup", bson.serialize(backupData));
											console.log("Backup finished");
											process.exit();
										}
									};
								}(i === keys.length - 1, keys[i])));
							}
						}
					};
				}(dbid, dbname)));
			}
		}
	});
	reader.on('close', function () {});
});
