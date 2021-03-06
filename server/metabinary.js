/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

/*jslint devel:true*/
/*global require, socket, module, Buffer */

(()=>{
	"use strict";

	let headerStr = "MetaBin:";

	/**
	 * UTF8文字列をArrayBufferに変換して返す
	 * @method utf8StringToArray
	 * @param {String} str UTF8文字列
	 * @return ArrayBuffer
	 */
	function utf8StringToArray(str) {
		let n = str.length,
			idx = 0,
			bytes = [],
			i,
			j,
			c;

		for (i = 0; i < n; i = i + 1) {
			c = str.charCodeAt(i);
			if (c <= 0x7F) {
				bytes[idx] = c;
				idx = idx + 1;
			} else if (c <= 0x7FF) {
				bytes[idx] = 0xC0 | (c >>> 6);
				idx = idx + 1;
				bytes[idx] = 0x80 | (c & 0x3F);
				idx = idx + 1;
			} else if (c <= 0xFFFF) {
				bytes[idx] = 0xE0 | (c >>> 12);
				idx = idx + 1;
				bytes[idx] = 0x80 | ((c >>> 6) & 0x3F);
				idx = idx + 1;
				bytes[idx] = 0x80 | (c & 0x3F);
				idx = idx + 1;
			} else {
				bytes[idx] = 0xF0 | (c >>> 18);
				idx = idx + 1;
				bytes[idx] = 0x80 | ((c >>> 12) & 0x3F);
				idx = idx + 1;
				bytes[idx] = 0x80 | ((c >>> 6) & 0x3F);
				idx = idx + 1;
				bytes[idx] = 0x80 | (c & 0x3F);
				idx = idx + 1;
			}
		}
		return bytes;
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
	 * @param {BLOB} binary   バイナリデータ
	 * @return buffer
	 */
	function createMetaBinary(metaData, binary) {
		let buffer,
			pos = 0,
			metaStr = new Buffer(utf8StringToArray(JSON.stringify(metaData)));
		if (!metaStr || !binary) { return; }
		//console.log('binary size:' + binary.length);
		//console.log('meta size:' + metaStr.length);

		buffer = new Buffer(headerStr.length + 8 + metaStr.length + binary.length);
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
		//console.dir(buffer);
		return buffer;
	}

	/// create binarydata with metadata
	/// format -------------------------------------------------
	/// -  "MetaBin:"           - header string (string)
	/// -  1                      - version (uint32)
	/// -  78                      - metadata's length (uint32)
	/// -  { id: 1, posx: 0, ...}  - metadata (json string)
	///
	/// -  2                      - metadata/binarydata count (uint32)
	/// -  78                      - metadataA's length (uint32)
	/// -  { id: 1, posx: 0, ...}  - metadata (json string)
	/// -  12345                   - binarydataA's length (uint32)
	/// -  0xfefefe                - binarydataA (blob)
	/// -  86                      - metadataB's length (uint32)
	/// -  { id: 2, posx: 0, ...}  - metadataB (json string)
	/// -  34567                   - binarydataB's length (uint32)
	/// -  0xfefefe                - binarydataB (blob)
	/// --------------------------------------------------------
	/**
	 * メタバイナリの作成　複数対応 (ver2)
	 * @method createMetaBinary
	 * @param {Object} metaData メタデータ
	 * @param {BLOB} binary   バイナリデータ
	 * @return buffer
	 */
	function createMetaBinaryMulti(metaData, metaDataList, binaryList) {
		let buffer,
			pos = 0,
			metaStr = new Buffer(utf8StringToArray(JSON.stringify(metaData))),
			tmpStr,
			metaStrList = [],
			binary,
			totalMetaSize = 0,
			totalBinarySize = 0;
		if (!metaDataList || metaDataList.length <= 0
			|| !binaryList || binaryList.length <= 0
			|| metaDataList.length !== binaryList.length) { console.error("wrong metabinary multi input"); return; }

		for (let i = 0; i < binaryList.length; ++i) {
			totalBinarySize = totalBinarySize + binaryList[i].length;
		}

		for (let i = 0; i < metaDataList.length; ++i) {
			tmpStr = new Buffer(utf8StringToArray(JSON.stringify(metaDataList[i])));
			metaStrList.push(tmpStr);
			totalMetaSize = totalMetaSize + metaStrList[i].length;
		}

		buffer = new Buffer(headerStr.length
			+ 4 // version
			+ 4 // metaStr.length
			+ metaStr.length
			+ 4 // metaDataList/binaryListのサイズ
			+ 4 * metaStrList.length
			+ totalMetaSize
			+ 4 * binaryList.length
			+ totalBinarySize);

		// headerStr
		buffer.write(headerStr, pos, headerStr.length, 'ascii');
		pos = pos + headerStr.length;
		// version
		buffer.writeUInt32LE(2, pos);
		pos = pos + 4;
		// metadata length
		buffer.writeUInt32LE(metaStr.length, pos);
		pos = pos + 4;
		// metadata
		metaStr.copy(buffer, pos, 0, metaStr.length);
		pos = pos + metaStr.length;

		// metaDataList/binaryList count
		buffer.writeUInt32LE(metaDataList.length, pos);
		pos = pos + 4;
		// binaryList
		for (let i = 0; i < binaryList.length; ++i) {
			metaStr = metaStrList[i];
			binary = binaryList[i];

			// metadata length
			buffer.writeUInt32LE(metaStr.length, pos);
			pos = pos + 4;
			// metadata
			metaStr.copy(buffer, pos, 0, metaStr.length);
			pos = pos + metaStr.length;

			// binary length
			buffer.writeUInt32LE(binary.length, pos);
			pos = pos + 4;
			binary.copy(buffer, pos, 0, binary.length);
			pos = pos + binary.length;
		}
		return buffer;
	}

	/**
	 * メタバイナリのロード
	 * @method loadMetaBinary
	 * @param {BLOB} binary バイナリデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function loadMetaBinary(binary, endCallback) {
		let head = binary.slice(0, headerStr.length).toString('ascii'),
			metaSize,
			metaData,
			version,
			content,
			params;
		if (head !== headerStr) { return; }

		//console.log("metabinary load start");

		version = binary.slice(headerStr.length, headerStr.length + 4).readUInt32LE(0);
		metaSize = binary.slice(headerStr.length + 4, headerStr.length + 8).readUInt32LE(0);
		metaData = JSON.parse(binary.slice(headerStr.length + 8, headerStr.length + 8 + metaSize).toString());

		if (metaData.hasOwnProperty('params')) {
			params = metaData.params;
		} else if (metaData.hasOwnProperty('result')) {
			params = metaData.result;
		} else if (metaData.hasOwnProperty('param')) {
			params = metaData.param;
		}
		//console.log(metaData);

		content = binary.slice(headerStr.length + 8 + metaSize);

		if (params.type === 'text' || params.type === 'url' || params.type === 'layout') {
			content = content.toString('utf8');
		}
		if (metaData && content) {
			endCallback(metaData, content);
		}
	}

	module.exports.loadMetaBinary = loadMetaBinary;
	module.exports.createMetaBinary = createMetaBinary; // version 1
	module.exports.createMetaBinaryMulti = createMetaBinaryMulti; // version 2
})();
