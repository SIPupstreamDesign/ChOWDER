/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */

/// virtual screen
(function () {
	"use strict";
	
	/**
	 * 仮想スクリーン
	 * @method Vscreen
	 */
	var Vscreen = function () {},
		vscreen_scale = 0.5,
		vscreen_rect = {},
		center_x,
		center_y,
		screens = {},
		whole_subscreens = {},
		whole_subscreen_id = "whole_sub_window",
		split_x = 1,
		split_y = 1;
	
	// utility
	/**
	 * 現在のスケールを考慮した位置を返す.
	 * @method scalePos
	 * @param {Number} p 位置
	 * @param {Number} c 中心位置
	 * @return 現在のスケールを考慮した位置
	 */
	function scalePos(p, c) {
		return (p - c) * vscreen_scale + c;
	}
	
	/**
	 * スケールを考慮した位置の逆算を返す
	 * @method scalePosInv
	 * @param {Number} p 位置
	 * @param {Number} c 中心位置
	 * @return スケールを考慮した位置の逆算
	 */
	function scalePosInv(p, c) {
		return (p - c) / vscreen_scale + c;
	}
	
	/**
	 * 四角形の作成
	 * @method makeRect
	 * @param {Number} left 左
	 * @param {Number} top 上
	 * @param {Number} width 幅
	 * @param {Number} height 高さ
	 * @return ObjectExpression
	 */
	function makeRect(left, top, width, height) {
		return {
			x : parseFloat(left),
			y : parseFloat(top),
			w : parseFloat(width),
			h : parseFloat(height)
		};
	}
	
	/**
	 * 四角形を現在の仮想スクリーン(全体)で座標変換
	 * @method transform
	 * @param {Rect} rect 四角形
	 * @return 座標変換した四角形
	 */
	function transform(rect) {
		return {
			x : scalePos(vscreen_rect.x + rect.x, center_x),
			y : scalePos(vscreen_rect.y + rect.y, center_y),
			w : parseFloat(rect.w) * vscreen_scale,
			h : parseFloat(rect.h) * vscreen_scale
		};
	}
	
	/**
	 * 四角形を初期仮想スクリーン(全体)で座標変換
	 * @method transformOrg
	 * @param {Rect} rect 四角形
	 * @return 座標変換した四角形
	 */
	function transformOrg(rect) {
		return {
			x : scalePos(vscreen_rect.orgX + rect.x, center_x),
			y : scalePos(vscreen_rect.orgY + rect.y, center_y),
			w : parseFloat(rect.w) * vscreen_scale,
			h : parseFloat(rect.h) * vscreen_scale
		};
	}
	
	/**
	 * 四角形を初期仮想スクリーン(全体)で座標逆変換
	 * @method transformOrgInv
	 * @param {Rect} rect 四角形
	 * @return 座標逆変換した四角形
	 */
	function transformOrgInv(rect) {
		return {
			x : scalePosInv(rect.x - vscreen_rect.orgX * vscreen_scale, center_x),
			y : scalePosInv(rect.y - vscreen_rect.orgY * vscreen_scale, center_y),
			w : parseFloat(rect.w) / vscreen_scale,
			h : parseFloat(rect.h) / vscreen_scale
		};
	}
	
	/**
	 * 仮想スクリーン(全体)のサイズの設定
	 * @method setWholeSize
	 * @param {Number} w 幅
	 * @param {Number} h 高さ
	 * @param {Number} s スケール
	 */
	function setWholeSize(w, h, s) {
		vscreen_rect.x = scalePos(center_x - w * 0.5, center_x);
		vscreen_rect.y = scalePos(center_y - h * 0.5, center_y);
		vscreen_rect.w = parseFloat(w * s);
		vscreen_rect.h = parseFloat(h * s);
		console.log("w:" + w);
		console.log("s:" + s);
		console.log("vscreen_rect" + JSON.stringify(vscreen_rect));
	}
	
	/**
	 * 仮想スクリーン(全体)の分割
	 * @method splitWhole
	 * @param {Number} xcount x方向分割数
	 * @param {Number} ycount y方向分割数
	 */
	function splitWhole(xcount, ycount) {
		var i,
			k,
			screen,
			subW = vscreen_rect.orgW / parseFloat(xcount),
			subH = vscreen_rect.orgH / parseFloat(ycount);
			
		split_x = parseInt(xcount, 10);
		split_y = parseInt(ycount, 10);
		
		for (k = 1; k <= ycount; k = k + 1) {
			for (i = 1; i <= xcount; i = i + 1) {
				screen = {
					id : whole_subscreen_id + ":" + i + ":" + k,
					x : (i - 1) * subW,
					y : (k - 1) * subH,
					w : subW,
					h : subH
				};
				whole_subscreens[screen.id] = screen;
			}
		}
	}
	
	/**
	 * 分割したスクリーン(サブスクリーン)の取得.
	 * @method getSplitWholes
	 * @return 分割したスクリーン(サブスクリーン)
	 */
	function getSplitWholes() {
		return whole_subscreens;
	}
	
	/**
	 * 位置から、分割したスクリーン(サブスクリーン)を取得する.
	 * @method getSplitWholeByPos
	 * @param {Number} px x座標
	 * @param {Number} py y座標
	 * @return 分割したスクリーン(サブスクリーン)
	 */
	function getSplitWholeByPos(px, py) {
		var i,
			w;
		for (i in whole_subscreens) {
			if (whole_subscreens.hasOwnProperty(i)) {
				w = whole_subscreens[i];
				if (w.x <= px && px < (w.x + w.w)) {
					if (w.y <= py && py < (w.y + w.h)) {
						return w;
					}
				}
			}
		}
		return null;
	}
	
	/**
	 * 位置から、スクリーンを取得する.
	 * @method getScreeByPos
	 * @param {Number} px x座標
	 * @param {Number} py y座標
	 * @param {String} withoutID このIDのものを除く
	 * @return スクリーン
	 */
	function getScreeByPos(px, py, withoutID) {
		var i,
			w;
		for (i in screens) {
			if (screens.hasOwnProperty(i)) {
				w = screens[i];
				if (w.id !== withoutID) {
					if (w.x <= px && px < (w.x + w.w)) {
						if (w.y <= py && py < (w.y + w.h)) {
							return w;
						}
					}
				}
			}
		}
		return null;
	}
	
	/**
	 * 分割数を返す
	 * @method getSplitCount
	 * @return 分割数
	 */
	function getSplitCount() {
		return {
			x : split_x,
			y : split_y
		};
	}
	
	/**
	 * 分割したスクリーン(サブスクリーン)のクリア
	 * @method clearSplitWholes
	 */
	function clearSplitWholes() {
		whole_subscreens = {};
	}
	
	/**
	 * 仮想スクリーン全体を移動
	 * @method translateWhole
	 * @param {Number} x x座標
	 * @param {Number} y y座標
	 */
	function translateWhole(x, y) {
		vscreen_rect.x = vscreen_rect.x + parseFloat(x);
		vscreen_rect.y = vscreen_rect.y + parseFloat(y);
	}
	
	/**
	 * 仮想スクリーン全体の位置をセット
	 * @method setWholePos
	 * @param {Number} x x座標
	 * @param {Number} y y座標
	 */
	function setWholePos(x, y) {
		vscreen_rect.x = parseFloat(x);
		vscreen_rect.y = parseFloat(y);
	}
	
	/**
	 * 仮想スクリーン全体のスケールを返す
	 * @method getWholeScale
	 * @return 仮想スクリーン全体のスケール
	 */
	function getWholeScale() {
		return vscreen_scale;
	}
	
	/// assign whole virtual screen
	/// if exists, overwrite
	/**
	 * 仮想スクリーン全体を設定
	 * @method assignWhole
	 * @param {Number} w 幅
	 * @param {Number} h 高さ
	 * @param {Number} cx 中心x座標
	 * @param {Number} cy 中心y座標
	 * @param {Number} s スケール
	 */
	function assignWhole(w, h, cx, cy, s) {
		var i,
			screen,
			rect;
		center_x = parseFloat(cx);
		center_y = parseFloat(cy);
		vscreen_scale = parseFloat(s);
		setWholeSize(w, h, s);
		vscreen_rect.orgX = parseFloat(center_x - w * 0.5);
		vscreen_rect.orgY = parseFloat(center_y - h * 0.5);
		vscreen_rect.orgW = parseFloat(w);
		vscreen_rect.orgH = parseFloat(h);
		console.log("vscreen_rect" + JSON.stringify(vscreen_rect));
	}
	
	/**
	 * 仮想スクリーン全体のスケールを設定.
	 * @method setWholeScale
	 * @param {Number} s スケール
	 * @param {Boolean} isApply 即適用して全体のRectを再計算するかどうか
	 */
	function setWholeScale(s, isApply) {
		vscreen_scale = parseFloat(s);
		if (isApply) {
			assignWhole(vscreen_rect.orgW, vscreen_rect.orgH, center_x, center_y, s);
		}
	}
	
	/**
	 * 仮想スクリーン全体のRectを取得
	 * @method getWhole
	 * @return 仮想スクリーン全体のRect
	 */
	function getWhole() {
		return vscreen_rect;
	}
	
	/**
	 * 仮想スクリーン全体の中心を取得
	 * @method getCenter
	 * @return 中心
	 */
	function getCenter() {
		return {
			x : center_x,
			y : center_y
		};
	}
	
	/**
	 * 仮想スクリーン全体の中心を設定
	 * @method setWholeCenter
	 * @param {Number} x x座標
	 * @param {Number} y y座標
	 */
	function setWholeCenter(x, y) {
		center_x = parseFloat(x);
		center_y = parseFloat(y);
	}
	
	/// assign single screen
	/// if exists, overwrite.
	/// @param x window coordinate
	/// @param y window coordinate
	/**
	 * スクリーンの設定
	 * @method assignScreen
	 * @param {String} id スクリーンのID
	 * @param {Number} x x座標
	 * @param {Number} y y座標
	 * @param {Number} w 幅
	 * @param {Number} h 高さ
	 */
	function assignScreen(id, x, y, w, h) {
		screens[id] = {
			id : id,
			x : parseFloat(x),
			y : parseFloat(y),
			w : parseFloat(w * vscreen_scale),
			h : parseFloat(h * vscreen_scale),
			orgX : parseFloat(x),
			orgY : parseFloat(y),
			orgW : parseFloat(w),
			orgH : parseFloat(h)
		};
	}
	
	/**
	 * スクリーンの取得
	 * @method getScreen
	 * @param {String} id ID
	 * @return スクリーン
	 */
	function getScreen(id) {
		if (screens.hasOwnProperty(id)) {
			return screens[id];
		}
		return null;
	}
	
	/**
	 * スクリーンをすべて取得
	 * @method getScreenAll
	 * @return スクリーンの連想配列
	 */
	function getScreenAll() {
		return screens;
	}
	
	/**
	 * スクリーンサイズの設定
	 * @method setScreenSize
	 * @param {String} id ID
	 * @param {Number} w 幅
	 * @param {Number} h 高さ
	 */
	function setScreenSize(id, w, h) {
		var screen = getScreen(id);
		if (screen) {
			screen.w = parseFloat(w);
			screen.h = parseFloat(h);
		}
	}
	
	/**
	 * スクリーンの位置を設定
	 * @method setScreenPos
	 * @param {String} id ID
	 * @param {Number} x x座標
	 * @param {Number} y y座標
	 */
	function setScreenPos(id, x, y) {
		var screen = getScreen(id);
		if (screen) {
			screen.x = parseFloat(x);
			screen.y = parseFloat(y);
		}
	}
	
	/**
	 * デバッグ用出力
	 * @method dump
	 */
	function dump() {
		var s;
		console.log("center_x:" + center_x);
		console.log("center_y:" + center_y);
		console.log("vscreen_rect:" + JSON.stringify(vscreen_rect));
		for (s in screens) {
			if (screens.hasOwnProperty(s)) {
				console.log("id:" + s + "| " + JSON.stringify(screens[s]));
			}
		}
	}
	
	/**
	 * スクリーンをすべてクリア
	 * @method clearScreenAll
	 */
	function clearScreenAll() {
		screens = {};
	}
	
	/**
	 * スクリーンを初期仮想スクリーンにより座標変換
	 * @method transformScreen
	 * @param {Screen} screen スクリーン
	 * @return 座標変換後のスクリーンを返す
	 */
	function transformScreen(screen) {
		return transformOrg(makeRect(screen.x, screen.y, screen.w, screen.h));
	}
	
	/**
	 * スクリーンを初期仮想スクリーンにより座標逆変換
	 * @method transformScreenInv
	 * @param {Screen} screen スクリーン
	 * @return 座標逆変換のスクリーンを返す
	 */
	function transformScreenInv(screen) {
		return transformOrgInv(makeRect(screen.x, screen.y, screen.w, screen.h));
	}
	
	window.vscreen = new Vscreen();
	// util
	window.vscreen.dump = dump;
	window.vscreen.makeRect = makeRect;
	// whole screen (one background screen)
	window.vscreen.assignWhole = assignWhole;
	window.vscreen.getCenter = getCenter;
	window.vscreen.getWhole = getWhole;
	window.vscreen.setWholeCenter = setWholeCenter;
	window.vscreen.setWholeSize = setWholeSize;
	window.vscreen.setWholeScale = setWholeScale;
	window.vscreen.getWholeScale = getWholeScale;
	window.vscreen.setWholePos = setWholePos;
	window.vscreen.translateWhole = translateWhole;
	window.vscreen.splitWhole = splitWhole;
	window.vscreen.getSplitWholes = getSplitWholes;
	window.vscreen.getSplitWholeByPos = getSplitWholeByPos;
	window.vscreen.clearSplitWholes = clearSplitWholes;
	window.vscreen.getSplitCount = getSplitCount;
	// screen
	window.vscreen.assignScreen = assignScreen;
	window.vscreen.getScreen = getScreen;
	window.vscreen.getScreenAll = getScreenAll;
	window.vscreen.setScreenSize = setScreenSize;
	window.vscreen.setScreenPos = setScreenPos;
	window.vscreen.clearScreenAll = clearScreenAll;
	window.vscreen.getScreeByPos = getScreeByPos;
	// transform
	window.vscreen.transform = transform;
	window.vscreen.transformOrg = transformOrg;
	window.vscreen.transformOrgInv = transformOrgInv;
	window.vscreen.transformScreen = transformScreen;
	window.vscreen.transformScreenInv = transformScreenInv;
	
}());
