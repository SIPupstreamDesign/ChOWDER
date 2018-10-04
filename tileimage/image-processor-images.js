/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

/* global Promise */

var fs = require('fs');
var path = require('path');
var images = require('images');
images.setLimit(100000, 100000);

var JPEG_BLOCK = 8;

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
 * @param {number} parallels 並列処理数、images版では意味なし
 * @param {Function} forEach 各分割済バッファに対して行う処理、Promiseを返す必要あり
 * @returns {Promise<void>} 全分割処理が終了後resolve
 */
var splitImage = function(filepath, xsplit, ysplit, parallels, forEach) {
	if (!fs.existsSync(filepath)) {
		throw new Error(filepath + 'は存在しません。');
	}

	var image = images(filepath);
	var ext = path.extname(filepath).slice(1);

	var width = image.width();
	var height = image.height();
	var sizex = calcSplitSize(width, xsplit);
	var sizey = calcSplitSize(height, ysplit);

	var task = Promise.resolve();

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
			task = task.then(forEach(splitted, i));
		}
	}
	
	return Promise.resolve();
};

// == export the module ========================================================
module.exports = {
	generateThumb: generateThumb,
	splitImage: splitImage
};