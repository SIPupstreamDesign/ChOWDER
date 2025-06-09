/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

 /* global Promise */

let fs = require('fs');
let sharp = require('sharp');

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

	let image = sharp(filepath, {limitInputPixels:0});
	return image.metadata().then(function(metadata) {
		let width = metadata.width;
		let height = metadata.height;

		let scale = Math.min(1.0, maxreso / Math.max(width, height));
		let thumbWidth = Math.round(width * scale);
		let thumbHeight = Math.round(height * scale);

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
let splitImage = function(filepath, xsplit, ysplit, parallels, forEach, startLogFunc, endSplitLogFunc, logFunc) {
	if (!fs.existsSync(filepath)) {
		throw new Error(filepath + 'は存在しません。');
	}
	
	let image = sharp(filepath, {limitInputPixels:0} );
	return image.metadata().then(function(metadata) {
		let width = metadata.width;
		let height = metadata.height;

		let tasks = new Array(parallels).fill(Promise.resolve());
		let taskIndex = 0;
		let sizex = calcSplitSize(width, xsplit);
		let sizey = calcSplitSize(height, ysplit);

		for (let iy = 0; iy < ysplit; iy ++) {
			for (let ix = 0; ix < xsplit; ix ++) {
				let x = ix * sizex;
				let y = iy * sizey;
				let w = Math.min(sizex, width - x);
				let h = Math.min(sizey, height - y);

				if (w <= 0 || h <= 0 || x + w > width || y + h > height){
					continue;
				}
				
				let i = ix + iy * xsplit;
				tasks[taskIndex] = tasks[taskIndex].then(function() {
					if (startLogFunc) { startLogFunc(i); }
					return sharp(filepath, {limitInputPixels:0}).extract({
						left: x,
						top: y,
						width: w,
						height: h
					}).toBuffer().then(function(buffer) {
						if (endSplitLogFunc) { endSplitLogFunc(i); }
						return forEach(buffer, i);
					}).then(function () {
						return new Promise(function(resolve) {
							if (logFunc) { logFunc(); }
							resolve();
						});
					});
				});
				taskIndex = (taskIndex + 1) % parallels;
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