/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

 
'use strict';

let headerStr = 'MetaBin:';

/**
 * UTF8文字列をArrayに変換して返す
 * @param {string} str UTF8文字列
 * @return Array
 */
function utf8StringToArray(str) {
	let n = str.length;
	let pos = 0;
	let array = [];
	
	for (let i = 0; i < n; i ++) {
		let charCode = str.charCodeAt(i);
		if (charCode <= 0x7F) {
			array[pos] = charCode;
			pos ++;
		} else if (charCode <= 0x7FF) {
			array[pos] = 0xC0 | (charCode >>> 6);
			pos ++;
			array[pos] = 0x80 | (charCode & 0x3F);
			pos ++;
		} else if (charCode <= 0xFFFF) {
			array[pos] = 0xE0 | (charCode >>> 12);
			pos ++;
			array[pos] = 0x80 | ((charCode >>> 6) & 0x3F);
			pos ++;
			array[pos] = 0x80 | (charCode & 0x3F);
			pos ++;
		} else {
			array[pos] = 0xF0 | (charCode >>> 18);
			pos ++;
			array[pos] = 0x80 | ((charCode >>> 12) & 0x3F);
			pos ++;
			array[pos] = 0x80 | ((charCode >>> 6) & 0x3F);
			pos ++;
			array[pos] = 0x80 | (charCode & 0x3F);
			pos ++;
		}
	}
	return array;
}

/// create binarydata with metadata
/// format -------------------------------------------------
/// -  "MetaBin:"           - header string (string)
/// -  1                      - version (uint32)
/// -  78                      - metadata's length (uint32)
/// -  { id: 1, posx: 0, ...}  - metadata (json string)
/// -  0xfefefe                - binarydata (blob)
/// --------------------------------------------------------

/**
 * メタバイナリの作成
 * @method createMetaBinary
 * @param {Object} metaData メタデータ
 * @param {Blob} binary バイナリデータ
 * @return buffer
 */
function createMetaBinary(metaData, binary) {
	let pos = 0;
	let metaStr = new Buffer(utf8StringToArray(JSON.stringify(metaData)));
	if (!metaStr) { return; }
	
	let buffer = new Buffer(headerStr.length + 8 + metaStr.length + binary.length);

	// headerStr
	buffer.write(headerStr, pos, headerStr.length, 'ascii');
	pos = pos + headerStr.length;

	// version
	buffer.writeUInt32LE(1, pos);
	pos = pos + 4;

	// metadata length
	buffer.writeUInt32LE(metaStr.length, pos);
	pos = pos + 4;

	// metadata
	metaStr.copy(buffer, pos, 0, metaStr.length);
	pos = pos + metaStr.length;

	// binary
	binary.copy(buffer, pos, 0, binary.length);

	return buffer;
}

/**
 * メタバイナリのロード
 * @method loadMetaBinary
 * @param {BLOB} binary バイナリデータ
 * @param {Function} endCallback 終了時に呼ばれるコールバック
 */
function loadMetaBinary(binary, endCallback) {
	let head = binary.slice(0, headerStr.length).toString('ascii');
	if (head !== headerStr) { return; }

	// let version = binary.slice(headerStr.length, headerStr.length + 4).readUInt32LE(0); // somehow it's unused
	let metaSize = binary.slice(headerStr.length + 4, headerStr.length + 8).readUInt32LE(0);
	let metaData = JSON.parse(binary.slice(headerStr.length + 8, headerStr.length + 8 + metaSize).toString());

	let params;
	if (metaData.hasOwnProperty('params')) {
		params = metaData.params;
	} else if (metaData.hasOwnProperty('result')) {
		params = metaData.result;
	} else if (metaData.hasOwnProperty('param')) {
		params = metaData.param;
	}

	let content = binary.slice(headerStr.length + 8 + metaSize);
	
	if (params.type === 'text' || params.type === 'url' || params.type === 'layout') {
		content = content.toString('utf8');
	}
	if (metaData && content) {
		endCallback(metaData, content);
	}
}

module.exports.loadMetaBinary = loadMetaBinary;
module.exports.createMetaBinary = createMetaBinary;