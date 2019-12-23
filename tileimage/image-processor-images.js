/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

/* global Promise */

let fs = require('fs');
let path = require('path');
let images = require('images');
images.setLimit(100000, 100000);

let JPEG_BLOCK = 8;

/**
 * 適切な分割サイズを求める
 * @param {number} resolution 解像度
 * @param {number} split 分割数
 * @returns {number} 分割サイズ
 */
let calcSplitSize = function(resolution, split) {
	let size = resolution / split;
	return Math.ceil(size / JPEG_BLOCK) * JPEG_BLOCK;
};

/**
 * 画像のサムネイルを作成
 * @param {string} filepath 入力ファイルパス
 * @param {number} maxreso 最大辺サイズ
 * @returns {Promise<Buffer>} 縮小処理終了後resolve
 */
let generateThumb = function(filepath, maxreso) {
	if (!fs.existsSync(filepath)) {
		throw new Error(filepath + 'は存在しません。');
	}

	let image = images(filepath);
	let ext = path.extname(filepath).slice(1);

	let width = image.width();
	let height = image.height();
	let scale = Math.min(1.0, maxreso / Math.max(width, height));
	let thumbWidth = Math.round(width * scale);
	let thumbHeight = Math.round(height * scale);

	let buffer = image.size(thumbWidth, thumbHeight).encode(ext);
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
let splitImage = function(filepath, xsplit, ysplit, parallels, forEach) {
	if (!fs.existsSync(filepath)) {
		throw new Error(filepath + 'は存在しません。');
	}

	let image = images(filepath);
	let ext = path.extname(filepath).slice(1);

	let width = image.width();
	let height = image.height();
	let sizex = calcSplitSize(width, xsplit);
	let sizey = calcSplitSize(height, ysplit);

	let task = Promise.resolve();

	for (let iy = 0; iy < ysplit; iy ++) {
		for (let ix = 0; ix < xsplit; ix ++) {
			let x = ix * sizex;
			let y = iy * sizey;
			let i = ix + iy * xsplit;
			let splitted = images(
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