/*jslint devel:true  bitwise:true regexp:true*/
/*global process, require, socket, module */

var fs = require('fs'),
	path = require('path'),
	cp = require('child_process'),
	crypto = require('crypto');

//-------------------------------------
// Utility functions
//-------------------------------------
/**
 * 指定されたディレクトリのファイル一覧取得
 * @method getFiles
 * @param {String} dir 取得対象ディレクトリ
 * @param {Array} list ファイル一覧
 */
function getFiles(dir, list) {
	"use strict";
	var i,
		files,
		name;
	try {
		files = fs.readdirSync(dir);
	} catch (e) {
		console.warn(e);
		list = {};
		return;
	}
	if (!files) {
		return;
	}
	for (i in files) {
		if (files.hasOwnProperty(i)) {
			name = path.join(dir, files[i]);
			try {
				if (fs.existsSync(name)) {
					if (fs.statSync(name).isDirectory()) {
						list.push({ "name" : files[i], "type" : "dir", "path" : name });
					} else if (files[i].substring(0, 1) !== '.') {
						list.push({ "name" : files[i], "type" : "file", "path" : name });
					}
				}
			} catch (ee) {
				console.warn(ee);
				console.warn("not found dir:" + dir);
			}
		}
	}
}

/**
 * 指定された文字列から拡張子取得
 * @method getExtention
 * @param {String} 取得対象文字列
 * @return CallExpression
 */
function getExtention(fileName) {
	"use strict";
	var ret,
		fileTypes,
		len;
	if (!fileName) {
		return ret;
	}
	fileTypes = fileName.split(".");
	len = fileTypes.length;
	if (len === 0) {
		return ret;
	}
	ret = fileTypes[len - 1];
	return ret.toString().toLowerCase();
}

/**
 * ファイル削除
 * @method removeFile
 * @param {String} 削除対象ファイルフルパス
 */
function removeFile(filePath) {
	"use strict";
	if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
		fs.unlinkSync(filePath);
	}
}

/**
 * ディレクトリ削除
 * @method removeDir
 * @param {String} 削除対象ディレクトリフルパス
 */
function removeDir(dirPath) {
	"use strict";
	if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
		fs.rmdirSync(dirPath);
	}
}

/**
 * ディレクトリ作成
 * @method mkdirSync
 * @param {String} 作成するディレクトリ名
 */
var mkdirSync = function (path) {
	"use strict";
	try {
		fs.mkdirSync(path);
	} catch (e) {
		if (e.code !== 'EEXIST') {
			throw e;
		}
	}
};

/// launch application
/// @param command list with args e.g. [ "hoge.exe", "arg1", "arg2" ]
/**
 * アプリケーション起動
 * @method launchApp
 * @param {String} command アプリケーション実行コマンド
 * @param {Function} startcallback 開始時コールバック
 * @param {Function} endcallback 終了時コールバック
 * @param {String} logname ログファイル名
 * @return proc
 */
function launchApp(command, startcallback, endcallback, logname) {
	"use strict";
	var child,
		cmd,
		args,
		proc,
		isWin32 = (process.platform === 'win32');
	
	console.log("-----launch app ----------", true, logname);
	if (isWin32) {
		cmd = command.join(" ");
		console.log('CMD>' + cmd);
		proc = cp.spawn(process.env.comspec, ['/c', cmd]);
		proc.setMaxListeners(0);
		if (startcallback) {
			startcallback();
		}
	} else {
		cmd = command[0];
		args = command.slice(1);
		proc = cp.spawn(cmd, args);
		proc.setMaxListeners(0);
		if (startcallback) {
			startcallback();
		}
	}
	
	proc.stdout.setEncoding("utf8");
	proc.stdout.on('data', function (data) {
		console.log(data, false, logname);
	});
	proc.stderr.setEncoding("utf8");
	proc.stderr.on('data', function (data) {
		console.log(data, false, logname);
	});
	proc.on('close', function (code, signal) {
		console.log('child process terminated due to receipt of signal ' + signal);
	});
	proc.on('exit', function (code) {
		if (endcallback) {
			endcallback();
		}
		console.log("-----launch app done -----", true, logname);
	});
	return proc;
}

/**
 * プロセスキル
 * @method kill
 * @param {JSON} proc プロセス情報
 */
function kill(proc) {
	"use strict";
	if (process.platform === 'win32') {
		cp.exec('taskkill /PID ' + proc.pid + ' /T', function (error, stdout, stderr) {
		});
	} else {
		proc.kill();
	}
}

/**
 * isRelative
 * @method isRelative
 * @param {String} p Path
 * @return BinaryExpression
 */
function isRelative(p) {
	"use strict";
	var normal = path.normalize(p),
		absolute = path.resolve(p);
	return normal !== absolute;
}

/**
 * 指定されたバイト列からUUID生成
 * @method uuidFromBytes
 * @param {Bytes} rnd バイト列
 * @return CallExpression
 */
function uuidFromBytes(rnd) {
	"use strict";
	rnd[6] = (rnd[6] & 0x0f) | 0x40;
	rnd[8] = (rnd[8] & 0x3f) | 0x80;
	rnd = rnd.toString('hex').match(/(.{8})(.{4})(.{4})(.{4})(.{12})/);
	rnd.shift();
	return rnd.join('-');
}

/**
 * UUID生成。callbackの指定が存在しない場合は無作為な乱数列から生成
 * @method generateUUID
 * @param {Function} callback 暗号化する場合に指定するコールバック関数
 */
function generateUUID(callback) {
	"use strict";
	if (typeof (callback) !== 'function') {
		return uuidFromBytes(crypto.randomBytes(16));
	}
	crypto.randomBytes(16, function (err, rnd) {
		if (err) { return callback(err); }
		callback(null, uuidFromBytes(rnd));
	});
}

/**
 * 8ケタのUUID生成
 * @method generateUUID8
 * @return CallExpression
 */
function generateUUID8() {
	'use strict';
	return generateUUID().slice(0, 8);
}

/**
 * 画像ファイル形式判別
 * @method detectImageType
 * @param {BLOB} binary バイナリデータ
 * @return Literal mimeタイプ
 */
function detectImageType(binary) {
	"use strict";
	if (!binary || binary.length < 4) { return "unknown"; }
	//console.log(binary[0]);
	//console.log(binary[1]);
	//console.log(binary[2]);
	if (binary[0] === 0xff && binary[1] === 0xd8 && binary[2] === 0xff) {
		return "image/jpeg";
	}
	if (binary[0] === 0x89 && binary[1] === 0x50 && binary[2] === 0x4e && binary[3] === 0x47) {
		return "image/png";
	}
	if (binary[0] === 0x47 && binary[1] === 0x49 && binary[2] === 0x46) {
		return "image/gif";
	}
	if (binary[0] === 0x42 && binary[1] === 0x4d) {
		return "image/bmp";
	}
	return "unknown";
}
module.exports.generateUUID = generateUUID;
module.exports.generateUUID8 = generateUUID8;
module.exports.getExtention = getExtention;
module.exports.getFiles = getFiles;
module.exports.removeFile = removeFile;
module.exports.removeDir = removeDir;
module.exports.mkdirSync = mkdirSync;
module.exports.launchApp = launchApp;
module.exports.isRelative = isRelative;
module.exports.kill = kill;
module.exports.detectImageType = detectImageType;