/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

class StringUtil {
	/**
	 * arrayBufferをStringに変換して返す
	 * @method arrayBufferToString
	 * @param {ArrayBuffer} arraybuf arrayBuffer
	 * @return URLデコードした文字列
	 */
	static arrayBufferToString(arraybuf) {
		let chars = new Uint8Array(arraybuf),
			encodedString = "",
			decodedString = "",
			i;
		for (i = 0; i < chars.length; i = i + 1) {
			encodedString = encodedString + String.fromCharCode(chars[i]);
		}
		try {
			decodedString = decodeURIComponent(escape(encodedString));
		} catch (e) {
			decodedString = decodeURIComponent(encodedString);
		}
		return decodedString;
	}

	//
	// String To ArrayBuffer funciton
	//
	// quate: http://jsperf.com/test-unicode-to-utf8
	//
	/**
	 * UTF8文字列をArrayBufferに変換して返す
	 * @method utf8StringToArray
	 * @param {String} str UTF8文字列
	 * @return ArrayBuffer
	 */
	static utf8StringToArray(str) {
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

	/**
	 * UTF8文字列をSHA-512hashに変換して返す
	 * @method digestMessage
	 * @param {String} message UTF8文字列
	 * @return {String} hash
	 */
	static async digestMessage(message) {
		const msgUint8 = new TextEncoder("utf-8").encode(message);
		const hashBuffer = await crypto.subtle.digest('SHA-512', msgUint8);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(function(b){return b.toString(16).padStart(2, '0')}).join('');
		return hashHex;
	}
}

export default StringUtil;
