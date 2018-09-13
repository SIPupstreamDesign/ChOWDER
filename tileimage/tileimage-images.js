/* global Promise */
'use strict';

var fs = require('fs');
var path = require('path');
var argv = require('argv');
var readline = require('readline');

var images = require('images');
images.setLimit(100000, 100000);

var WebSocketWrapper = require('./websocket');

var JPEG_BLOCK = 8;

/**
 * ランダムな色を生成する
 * @returns {string} ランダムな色
 */
var getRandomColor = function() {
	return 'rgb(' + Math.floor(Math.random() * 128 + 127) + ','
	+ Math.floor(Math.random() * 128 + 127) + ','
	+ Math.floor(Math.random() * 128 + 127) + ')';
};

/**
 * 適切な分割サイズを求める
 * @param {number} resolution 解像度
 * @param {number} split 分割数
 * @returns {number} 分割サイズ
 */
var calcSplitSize = function(resolution, split) {
	var size = resolution / split;
	return Math.ceil(size / JPEG_BLOCK) * JPEG_BLOCK;
};

/**
 * 画像のサムネイルを作成
 * @param {string} filepath 入力ファイルパス
 * @param {number} maxreso 最大辺サイズ
 * @returns {Promise<Buffer>} 縮小処理終了後resolve
 */
var generateThumb = function(filepath, maxreso) {
	if (!fs.existsSync(filepath)) {
		throw new Error(filepath + 'は存在しません。');
	}

	var image = images(filepath);
	var ext = path.extname(filepath).slice(1);

	var width = image.width();
	var height = image.height();
	var scale = Math.min(1.0, maxreso / Math.max(width, height));
	var thumbWidth = Math.round(width * scale);
	var thumbHeight = Math.round(height * scale);

	var buffer = image.size(thumbWidth, thumbHeight).encode(ext);
	return Promise.resolve({
		width: width,
		height: height,
		thumbWidth: thumbWidth,
		thumbHeight: thumbHeight,
		buffer: buffer
	});
};

/**
 * 画像を分割
 * @param {string} filepath 入力ファイルパス
 * @param {number} xsplit x方向分割数
 * @param {number} ysplit y方向分割数
 * @param {Function} forEach 各分割済バッファに対して行う処理、Promiseを返す必要あり
 * @returns {Promise<void>} 全分割処理が終了後resolve
 */
var splitImage = function(filepath, xsplit, ysplit, forEach) {
	if (!fs.existsSync(filepath)) {
		throw new Error(filepath + 'は存在しません。');
	}

	var image = images(filepath);
	var ext = path.extname(filepath).slice(1);

	var width = image.width();
	var height = image.height();
	var sizex = calcSplitSize(width, xsplit);
	var sizey = calcSplitSize(height, ysplit);

	for (var iy = 0; iy < ysplit; iy ++) {
		for (var ix = 0; ix < xsplit; ix ++) {
			var x = ix * sizex;
			var y = iy * sizey;
			var i = ix + iy * xsplit;
			var splitted = images(
				image,
				x,
				y,
				Math.min(sizex, width - x),
				Math.min(sizey, height - y)
			).encode(ext);
			forEach(splitted, i);
		}
	}
	
	return Promise.resolve();
};

// == process argv =============================================================
var args = argv.option([
	{
		name: 'config',
		short: 'c',
		type: 'path'
	},
	{
		name: 'metadata',
		short: 'm',
		type: 'string'
	}
]).run();

if (args.targets.length === 0) {
	console.log( 'Usage: tileimage --metadata={\\"key\\":\\"value\\"} image.jpg' );
	process.exit();
}

var configPath = (args.options.config || path.resolve(__dirname, './config.json'));
console.log('Config file: ' + configPath);
var config = require(configPath);

var keyvalue = undefined;
if (args.options.metadata) {
	console.log('Metadata: ' + args.options.metadata);
	keyvalue = JSON.parse(args.options.metadata);
}

var imagePath = path.resolve(process.cwd(), args.targets[ 0 ]);
if (!fs.existsSync(imagePath)) {
	throw new Error('Image file not found: ' + imagePath);
}
console.log('Image file: ' + imagePath);

// == beginning of main procedure ==============================================
var wsWrapper = new WebSocketWrapper();

// == connect to the websocket server ==========================================
wsWrapper.connect(config.url).then(function() {
	console.log('WebSocket connection established');

	// == login as display =======================================================
	return wsWrapper.sendUTF('Login', {
		id: config.id,
		password: config.password
	});
}).then(function(parsed) {
	if (parsed.error) {
		throw new Error('Login failed: ' + parsed.error);
	}
	console.log('Logged in as ' + parsed.result.id);

	// == generate thumbnail =====================================================
	return generateThumb(imagePath, config.thumbsize || 1920);
}).then(function(thumb) {
	console.log('Thumbnail generated');

	// == request group id =======================================================
	return wsWrapper.sendUTF('GetGroupList', {}).then(function(parsed) {
		var desiredGroup = parsed.result.grouplist.filter(function(group) {
			return group.name === config.contentgrp;
		});
		if (desiredGroup.length !== 0) { // if there already are desired group
			return desiredGroup[0].id;
		} else { // else then create the new group
			return wsWrapper.sendUTF('AddGroup', {
				name: config.contentgrp,
				color: getRandomColor()
			}).then(function(parsed) {
				if (parsed.error) {
					throw new Error('Error while creating new content group: ' + parsed.error);
				}

				return parsed.result;
			});
		}
	}).then(function(groupId) {
		console.log('Group id: ' + groupId);

		// == send thumbnail =======================================================
		return wsWrapper.sendBinary('AddHistoricalContent', {
			type: 'tileimage',
			id: config.contentid,
			content_id: config.contentid,
			group: groupId,
			posx: 0,
			posy: 0,
			width: thumb.width,
			height: thumb.height,
			xsplit: config.xsplit,
			ysplit: config.ysplit,
			keyvalue: keyvalue ? JSON.stringify(keyvalue) : undefined
		}, thumb.buffer);
	});
}).then(function(parsed) {
	if (parsed.error) {
		throw new Error('Error while sending thumbnail: ' + parsed.error);
	}
	console.log('Thumbnail sent');

	// == split the image ========================================================
	var historyId = parsed.result.history_id;
	var n = config.xsplit * config.ysplit;
	splitImage(imagePath, config.xsplit, config.ysplit, function(buffer, i) {
		readline.cursorTo(process.stdout, 0);
		process.stdout.write('Tiled image processing: ' + ((i + 1) / n * 100.0).toFixed(0) + '%');

		// == send each image fragment =============================================
		return wsWrapper.sendBinary('AddTileContent', {
			id: config.contentid,
			history_id: historyId,
			tile_index: i
		}, buffer);
	}).then(function() {
		console.log();
		console.log('Done');

		wsWrapper.disconnect();
	});
});