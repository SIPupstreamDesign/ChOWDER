/* global Promise */

var fs = require('fs');
var sharp = require('sharp');

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

	var image = sharp(filepath);
	return image.limitInputPixels(0).metadata().then(function(metadata) {
		var width = metadata.width;
		var height = metadata.height;

		var scale = Math.min(1.0, maxreso / Math.max(width, height));
		var thumbWidth = Math.round(width * scale);
		var thumbHeight = Math.round(height * scale);

		return image.resize(thumbWidth, thumbHeight).toBuffer().then(function(buffer) {
			return {
				width: width,
				height: height,
				thumbWidth: thumbWidth,
				thumbHeight: thumbHeight,
				buffer: buffer
			};
		});
	});
};

/**
 * 画像を分割
 * @param {string} filepath 入力ファイルパス
 * @param {number} xsplit x方向分割数
 * @param {number} ysplit y方向分割数
 * @param {number} parallels 並列処理数
 * @param {Function} forEach 各分割済バッファに対して行う処理、Promiseを返す必要あり
 * @returns {Promise<void>} 全分割処理が終了後resolve
 */
var splitImage = function(filepath, xsplit, ysplit, parallels, forEach) {
	if (!fs.existsSync(filepath)) {
		throw new Error(filepath + 'は存在しません。');
	}
	
	var image = sharp(filepath);
	return image.limitInputPixels(0).metadata().then(function(metadata) {
		var width = metadata.width;
		var height = metadata.height;

		var tasks = new Array(parallels).fill(Promise.resolve());
		var taskIndex = 0;
		var sizex = calcSplitSize(width, xsplit);
		var sizey = calcSplitSize(height, ysplit);

		for (var iy = 0; iy < ysplit; iy ++) {
			for (var ix = 0; ix < xsplit; ix ++) {
				(function() {
					var x = ix * sizex;
					var y = iy * sizey;
					var i = ix + iy * xsplit;
					tasks[taskIndex] = tasks[taskIndex].then(function() {
						return image.extract({
							left: x,
							top: y,
							width: Math.min(sizex, width - x),
							height: Math.min(sizey, height - y)
						}).toBuffer().then(function(buffer) {
							return forEach(buffer, i);
						});
					});
					taskIndex = (taskIndex + 1) % parallels;
				})();
			}
		}

		return Promise.all(tasks);
	});
};

// == export the module ========================================================
module.exports = {
	generateThumb: generateThumb,
	splitImage: splitImage
};