/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	var headerStr = "MetaBin:";
	
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
		var buffer,
			pos = 0,
			metaStr = JSON.stringify(metaData);
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
		buffer.write(metaStr, pos, metaStr.length, 'ascii');
		pos = pos + metaStr.length;
		// binary
		binary.copy(buffer, pos, 0, binary.length);
		//console.dir(buffer);
		return buffer;
	}
	
	/**
	 * メタバイナリのロード
	 * @method loadMetaBinary
	 * @param {BLOB} binary バイナリデータ
	 * @param {Function} endCallback 終了時に呼ばれるコールバック
	 */
	function loadMetaBinary(binary, endCallback) {
		var head = binary.slice(0, headerStr.length).toString('ascii'),
			metaSize,
			metaData,
			version,
			content;
		if (head !== headerStr) { return; }
		
		version = binary.slice(headerStr.length, headerStr.length + 4).readUInt32LE(0);
		metaSize = binary.slice(headerStr.length + 4, headerStr.length + 8).readUInt32LE(0);
		metaData = JSON.parse(binary.slice(headerStr.length + 8, headerStr.length + 8 + metaSize).toString('ascii'));
		//console.log(metaData);

		content = binary.slice(headerStr.length + 8 + metaSize);
		
		if (metaData.type === 'text' || metaData.type === 'url') {
			content = content.toString('utf8');
		}
		if (metaData && content) {
			endCallback(metaData, content);
		}
	}
	
	module.exports.loadMetaBinary = loadMetaBinary;
	module.exports.createMetaBinary = createMetaBinary;
}());
