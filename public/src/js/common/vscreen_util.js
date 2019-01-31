/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Constants from './constants.js';
import Validator from './validator.js';
import Vscreen from './vscreen.js';

"use strict";

/**
 * 仮想スクリーンユーティリティ
 * @method VscreenUtil
 */
class VscreenUtil
{
	/**
	 * Floatの矩形を作成
	 * @method toFloatRect
	 * @param {Object} metaData メタデータ
	 * @return 浮動小数の矩形
	 */
	static toFloatRect(metaData) {
		return Vscreen.makeRect(
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
	static toIntRect(metaData) {
		return Vscreen.makeRect(
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
	static resizeText(elem, rect) {
		let lineCount = 1,
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
	 * 動画のリサイズ
	 */
	static resizeVideo(elem, rect) {
		if (elem && rect) {
			elem.setAttribute("width", String(rect.w));
			elem.setAttribute("height", String(rect.w));
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
	static assignRect(elem, rect, withoutWidth, withoutHeight) {
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
	static assignZIndex(elem, metaData) {
		let index;
		if (metaData.hasOwnProperty('zIndex')) {
			index = parseInt(metaData.zIndex, 10);
			if (!isNaN(index)) {
				elem.style.zIndex = index;
			}
		}
	}
	
	/**
	 * メタデータが表示中であるかを判別する
	 * @method isVisible
	 * @param {JSON} metaData 判別対象メタデータ
	 * @return LogicalExpression
	 */
	static isVisible(metaData) {
		return (metaData.hasOwnProperty('visible') && (metaData.visible === "true" || metaData.visible === true));
	}
	

	/**
	 * 適切な分割サイズを求める. ※tileimageから持ってきた
	 * @param {number} resolution 解像度
	 * @param {number} split 分割数
	 * @returns {number} 分割サイズ
	 */
	static calcSplitSize(resolution, split) {
		let JPEG_BLOCK = 8;
		let size = resolution / split;
		return Math.ceil(size / JPEG_BLOCK) * JPEG_BLOCK;
	};

	static getTileRect(metaData, xindex, yindex) {
		let rect = {};
		let width = Number(metaData.orgWidth);
		let height = Number(metaData.orgHeight);
		let sizex = VscreenUtil.calcSplitSize(width, Number(metaData.xsplit));
		let sizey = VscreenUtil.calcSplitSize(height, Number(metaData.ysplit));
		let scale = Number(metaData.width) / width;
		rect.posx = Number(metaData.posx) + xindex * sizex * scale;
		rect.posy = Number(metaData.posy) + yindex * sizey * scale;
		rect.width = Math.min(sizex, width);
		rect.height = Math.min(sizey, height);
		return rect;
	}

	static resizeTileImages(elem, metaData) {
		let i, k;
		let rect = Vscreen.transformOrg(VscreenUtil.toIntRect(metaData));
		let mw = rect.w;
		let mh = rect.h;
		let ow = Number(metaData.orgWidth);
		let oh = Number(metaData.orgHeight);
		let posx = 0;
		let posy = 0;
		let tileIndex = 0;

		// タイル全体の幅高さ。実際のmetaData.widthとは小数点の関係で少し違う値になる
		let tileWholeWidth = Number(metaData.width);
		let tileWholeHeight = Number(metaData.height);

		for (i = 0; i < Number(metaData.ysplit); ++i) {
			for (k = 0; k < Number(metaData.xsplit); ++k) {
				let image = elem.getElementsByClassName("tile_index_" + String(tileIndex))[0];
				let tileRect = VscreenUtil.getTileRect(metaData, k, i);
				if (image && image.tagName.toLowerCase() === "img") {
					let w = tileRect.width;
					let h = tileRect.height;
					let width = Math.round(w / ow * mw);
					let height = Math.round(h / oh * mh);
					if (width === 0 || height === 0) { return; }
					image.style.left = posx + "px";
					image.style.top = posy + "px";
					image.style.width = width + "px";
					image.style.height = height + "px";
					if ( (k % Number(metaData.xsplit)) === Number(metaData.xsplit) - 1) {
						tileWholeWidth = posx + width;
						tileWholeHeight = posy + height;
						posx = 0;
						posy += height;
					} else {
						posx += width;
					}
				}
				++tileIndex;
			}
		}

		let reductionElems = elem.getElementsByClassName('reduction_image');
		if (reductionElems.length > 0) {
			let reductionElem = reductionElems[0];
			reductionElem.style.left = "0px";
			reductionElem.style.top = "0px";
			reductionElem.style.width = tileWholeWidth + "px";
			reductionElem.style.height = tileWholeHeight + "px";
		}
	}

	/**
	 * メタデータを割り当て
	 * @method assignMetaData
	 * @param {Element} elem エレメント
	 * @param {Object} metaData メタデータ
	 * @param {Object} useOrg 初期座標系を使うかどうか
	 * @param {Object} groupDict グループ辞書
	 */
	static assignMetaData(elem, metaData, useOrg, groupDict) {
		let rect;
		if (useOrg) {
			rect = Vscreen.transformOrg(VscreenUtil.toIntRect(metaData));
		} else {
			rect = Vscreen.transform(VscreenUtil.toIntRect(metaData));
		}
		if (elem && metaData) {
			VscreenUtil.assignRect(elem, rect, (metaData.width < 10), (metaData.height < 10));
			VscreenUtil.assignZIndex(elem, metaData);
			if (Validator.isTextType(metaData)) {
				VscreenUtil.resizeText(elem, rect);
			} else if (metaData.type === "video") {
				VscreenUtil.resizeVideo(elem, rect);
			} else if (metaData.type === "tileimage") {
				VscreenUtil.resizeTileImages(elem, metaData);
			}
			
			if (VscreenUtil.isVisible(metaData)) {
				//console.log("isvisible");
				elem.style.display = "block";
				if (!Validator.isWindowType(metaData)) {
					if (metaData.mark && groupDict.hasOwnProperty(metaData.group)) {
						if (metaData.group === Constants.DefaultGroup) {
							elem.style.borderColor = "rgb(54,187,68)";
						} else {
							elem.style.borderColor = groupDict[metaData.group].color;
						}
					} else if (!useOrg) {
						elem.style.borderColor = "rgb(54,187,68)";
					}
				}
			} else {
				elem.style.display = "none";
			}
		}
	}
	
	/**
	 * 指定されたelementを矩形情報でstyleを割り当て
	 * @method assignScreenRect
	 * @param {Element} elem エレメント
	 * @param {Object} rect 矩形領域
	 */
	static assignScreenRect(elem, rect) {
		if (elem && rect) {
			elem.style.position = 'absolute';
			elem.style.left = String(rect.x) + 'px';
			elem.style.top = String(rect.y) + 'px';
			elem.style.width = String(rect.w) + 'px';
			elem.style.height = String(rect.h) + 'px';
			// console.log("assignScreenRect:" + JSON.stringify(rect));
		}
	}
	
	/**
	 * 指定されたメタデータの情報を座標逆変換
	 * @method transInv
	 * @param {Object} metaData メタデータ
	 * @return metaData
	 */
	static transInv(metaData) {
		let rect = Vscreen.transformOrgInv(VscreenUtil.toFloatRect(metaData));
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
	static trans(metaData) {
		let rect = Vscreen.transformOrg(VscreenUtil.toFloatRect(metaData));
		metaData.posx = rect.x;
		metaData.posy = rect.y;
		metaData.width = rect.w;
		metaData.height = rect.h;
		return metaData;
	}
	
	
	/**
	 * 指定されたメタデータの位置を初期仮想スクリーンに変換
	 * @method trans
	 * @param {Object} metaData メタデータ
	 * @return metaData メタデータ
	 */
	static transPos(metaData) {
		let rect = Vscreen.transformOrg(
			Vscreen.makeRect(parseFloat(metaData.posx, 10), parseFloat(metaData.posy, 10), 0, 0)
		);
		metaData.posx = rect.x;
		metaData.posy = rect.y;
		return metaData;
	}
	
	/**
	 * 指定されたメタデータの位置を逆変換
	 * @method transPosInv
	 * @param {Object} metaData メタデータ
	 */
	static transPosInv(metaData) {
		let rect = Vscreen.transformOrgInv(
			Vscreen.makeRect(parseFloat(metaData.posx, 10), parseFloat(metaData.posy, 10), 0, 0)
		);
		metaData.posx = rect.x;
		metaData.posy = rect.y;
	}
	
	/**
	 * metaDataが完全にwindowの内側かどうか返す
	 * @param {Object} metaData メタデータ
	 * @param {Object} window ウィンドウレクト
	 */
	static isInsideWindow(metaData, window) {
		// コンテンツのメタデータは, 仮想スクリーン全体を基準としたrect
		let rect = VscreenUtil.toFloatRect(metaData);
		
		// viewのwindowRectは、divの移動量。
		// コントローラで, 仮想スクリーン全体に対して, +x, +yだけdisplayを動かした場合、
		// divを-x, -yだけ動かして、動いたように見せている.

		return (-window.x < rect.x) && // window左端よりコンテンツが右か
			(-window.y < rect.y) &&    // 上
			((window.w - window.x) > (rect.w + rect.x)) && // 右
			((window.h - window.y) > (rect.h + rect.y));   // 下
	}
	
	/**
	 * metaDataが完全にwindowの外側かどうか返す
	 * @method isOutsideWindow
	 * @param {Object} metaData メタデータ
	 * @param {Object} window ウィンドウレクト
	 */
	static isOutsideWindow(metaData, window) {
		// コンテンツのメタデータは, 仮想スクリーン全体を基準としたrect
		let rect = VscreenUtil.toFloatRect(metaData);
		
		/*
		// console.log("isOutsideWindow", window, rect,
					(-window.x > (rect.x + rect.w)),
					(-window.y > (rect.y + rect.h)),
					((window.w - window.x + rect.w) < (rect.w + rect.x)),
					((window.h - window.y + rect.h) < (rect.h + rect.y)));
					*/
		
		return (-window.x > (rect.x + rect.w)) || // window左端よりコンテンツが左か
			(-window.y > (rect.y + rect.h)) ||    // 上
			((window.w - window.x + rect.w) < (rect.w + rect.x)) || // 右
			((window.h - window.y + rect.h) < (rect.h + rect.y));   // 下
	}
}

export default VscreenUtil;
	
