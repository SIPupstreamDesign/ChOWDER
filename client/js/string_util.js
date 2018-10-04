/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

 
/*jslint devel:true bitwise:true */
/*global io, socket, WebSocket, Blob, URL, FileReader, DataView, Uint8Array, module, Uint32Array, ArrayBuffer, escape */

(function () {
	"use strict";
	
	var metabinary = {};
	
	/**
	 * arrayBufferをStringに変換して返す
	 * @method arrayBufferToString
	 * @param {ArrayBuffer} arraybuf arrayBuffer
	 * @return URLデコードした文字列
	 */
	function arrayBufferToString(arraybuf) {
		var chars = new Uint8Array(arraybuf),
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
	function utf8StringToArray(str) {
		var n = str.length,
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


	window.StringUtil = {
		utf8StringToArray : utf8StringToArray,
		arrayBufferToString : arrayBufferToString
	};
}());