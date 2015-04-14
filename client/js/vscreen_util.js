/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */

/// content, display assignment util
(function (vscreen) {
	"use strict";
	
	/**
	 * 仮想スクリーンユーティリティ
	 * @method VscreenUtil
	 */
	var VscreenUtil = function () {};
	
	/**
	 * Floatの矩形を作成
	 * @method toFloatRect
	 * @param {Object} metaData メタデータ
	 * @return 浮動小数の矩形
	 */
	function toFloatRect(metaData) {
		return vscreen.makeRect(
			parseFloat(metaData.posx),
			parseFloat(metaData.posy),
			parseFloat(metaData.width),
			parseFloat(metaData.height)
		);
	}
	
	/**
	 * Intの矩形を作成
	 * @method toIntRect
	 * @param {Object} metaData メタデータ
	 * @return Intの矩形
	 */
	function toIntRect(metaData) {
		return vscreen.makeRect(
			Math.round(parseFloat(metaData.posx)),
			Math.round(parseFloat(metaData.posy)),
			Math.round(parseFloat(metaData.width)),
			Math.round(parseFloat(metaData.height))
		);
	}
	
	/**
	 * テキストのリサイズ
	 * @method resizeText
	 * @param {Element} elem 対象エレメント
	 * @param {Rect} rect 矩形
	 */
	function resizeText(elem, rect) {
		var lineCount = 1,
			fsize;
		if (elem && rect) {
			lineCount = elem.innerHTML.split("\n").length;
			fsize = parseInt((parseInt(rect.h, 10) - 1) / lineCount, 10);
			elem.style.fontSize = fsize + "px";
			if (fsize < 9) {
				elem.style.fontSize = "9px";
				elem.style.overflow = "auto";
			}
			elem.style.width = rect.w + 'px';
			elem.style.height = rect.h + 'px';
		}
	}
	
	/**
	 * 矩形を割り当て
	 * @method assignRect
	 * @param {Element} elem 対象エレメント
	 * @param {Rect} rect 矩形
	 * @param {Number} withoutWidth trueの場合幅を割り当てない
	 * @param {Number} withoutHeight trueの場合高さを割り当てない
	 */
	function assignRect(elem, rect, withoutWidth, withoutHeight) {
		if (elem && rect) {
			elem.style.position = 'absolute';
			elem.style.left = parseInt(rect.x, 10) + 'px';
			elem.style.top = parseInt(rect.y, 10) + 'px';
			if (!withoutWidth && rect.w) {
				elem.style.width = parseInt(rect.w, 10) + 'px';
			}
			if (!withoutHeight && rect.h) {
				elem.style.height = parseInt(rect.h, 10) + 'px';
			}
		}
		//console.log("assignRect:" + JSON.stringify(rect));
	}
	
	/**
	 * Zインデックスを割り当て
	 * @method assignZIndex
	 * @param {Element} elem エレメント
	 * @param {Object} metaData メタデータ
	 */
	function assignZIndex(elem, metaData) {
		var index;
		if (metaData.hasOwnProperty('zIndex')) {
			index = parseInt(metaData.zIndex, 10);
			if (!isNaN(index)) {
				elem.style.zIndex = index;
			}
		}
	}
	
	/**
	 * メタデータを割り当て
	 * @method assignMetaData
	 * @param {Element} elem エレメント
	 * @param {Object} metaData メタデータ
	 * @param {Object} useOrg ユーザーデータ
	 */
	function assignMetaData(elem, metaData, useOrg) {
		var rect;
		if (useOrg) {
			rect = vscreen.transformOrg(toIntRect(metaData));
		} else {
			rect = vscreen.transform(toIntRect(metaData));
		}
		if (elem && metaData) {
			assignRect(elem, rect, (metaData.width < 10), (metaData.height < 10));
			assignZIndex(elem, metaData);
			if (metaData.type === "text") {
				resizeText(elem, rect);
			}
		}
	}
	
	/**
	 * 指定されたelementを矩形情報でstyleを割り当て
	 * @method assignScreenRect
	 * @param {Element} elem エレメント
	 * @param {Object} rect 矩形領域
	 */
	function assignScreenRect(elem, rect) {
		if (elem && rect) {
			elem.style.position = 'absolute';
			elem.style.left = Math.round(rect.x) + 'px';
			elem.style.top = Math.round(rect.y) + 'px';
			elem.style.width = Math.round(rect.w) + 'px';
			elem.style.height = Math.round(rect.h) + 'px';
			console.log("assignScreenRect:" + JSON.stringify(rect));
		}
	}
	
	/**
	 * 指定されたメタデータの情報を座標逆変換
	 * @method transInv
	 * @param {Object} metaData
	 * @return metaData
	 */
	function transInv(metaData) {
		var rect = vscreen.transformOrgInv(toFloatRect(metaData));
		metaData.posx = rect.x;
		metaData.posy = rect.y;
		metaData.width = rect.w;
		metaData.height = rect.h;
		return metaData;
	}
	
	/**
	 * 指定されたメタデータの矩形情報を初期仮想スクリーンに変換
	 * @method trans
	 * @param {Object} metaData メタデータ
	 * @return metaData メタデータ
	 */
	function trans(metaData) {
		var rect = vscreen.transformOrg(toFloatRect(metaData));
		metaData.posx = rect.x;
		metaData.posy = rect.y;
		metaData.width = rect.w;
		metaData.height = rect.h;
		return metaData;
	}
	
	/**
	 * 指定されたメタデータのザ行位置を逆変換
	 * @method transPosInv
	 * @param {Object} metaData メタデータ
	 */
	function transPosInv(metaData) {
		var rect = vscreen.transformOrgInv(
			vscreen.makeRect(parseFloat(metaData.posx, 10), parseFloat(metaData.posy, 10), 0, 0)
		);
		metaData.posx = rect.x;
		metaData.posy = rect.y;
	}
	
	window.vscreen_util = new VscreenUtil();
	window.vscreen_util.assignMetaData = assignMetaData;
	window.vscreen_util.assignScreenRect = assignScreenRect;
	window.vscreen_util.trans = trans;
	window.vscreen_util.transInv = transInv;
	window.vscreen_util.transPosInv = transPosInv;
}(window.vscreen));
