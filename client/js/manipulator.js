/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */

/// scale manipulator
(function () {
	"use strict";
	
	/**
	 * マニピュレータ
	 * @method Manipulator
	 */
	var Manipulator = function () {},
		draggingManip = null,
		windowType = "window",
		manipulators = [],
		manipulatorMenus = [],
		draggingOffsetFunc = null,
		closeFunc = null,
		parent = null;
	
	/**
	 * ドラッグ中のマニピュレータを返す.
	 * @method getDraggingManip
	 * @return ドラッグ中のマニピュレータ
	 */
	function getDraggingManip() {
		return draggingManip;
	}
	
	/**
	 * ドラッグ中のオフセットコールバックの設定
	 * @method setDraggingOffsetFunc
	 * @param {Function} func ドラッグ中のオフセットコールバック
	 */
	function setDraggingOffsetFunc(func) {
		draggingOffsetFunc = func;
	}
	
	/**
	 * クローズコールバックの設定
	 * @method setCloseFunc
	 * @param {Function} func クローズコールバック
	 */
	function setCloseFunc(func) {
		closeFunc = func;
	}
	
	/**
	 * ドラッグ中のマニピュレータをクリア
	 * @method clearDraggingManip
	 */
	function clearDraggingManip() {
		draggingManip = null;
	}

	/// move manipulator rects on elem
	/// @param manips list of manipulator elements
	/// @param targetElem manipulator target
	/**
	 * マニピュレータを移動させる
	 * @method moveManipulator
	 * @param {Element} targetElem 移動したエレメント
	 */
	function moveManipulator(targetElem) {
		if (manipulators.length < 3) {
			//console.log("manipulators:", manipulators);
			return;
		}
		
		var left,
			top,
			width,
			height,
			manipHalfWidth = 5,
			manipHalfHeight = 5,
			posx = Number(targetElem.style.left.split("px").join("")),
			posy = Number(targetElem.style.top.split("px").join(""));
		
		left = (posx - manipHalfWidth);
		top = (posy - manipHalfHeight);
		width = targetElem.offsetWidth;
		height = targetElem.offsetHeight;
		
		// left top
		manipulators[0].style.left = left + "px";
		manipulators[0].style.top = top + "px";
		// left bottom
		manipulators[1].style.left = left + "px";
		manipulators[1].style.top = (top + height) + "px";
		// right bottom
		manipulators[2].style.left = (left + width) + "px";
		manipulators[2].style.top = (top + height) + "px";
		// right top
		manipulators[3].style.left = (left + width) + "px";
		manipulators[3].style.top = top + "px";
		// x button
		manipulators[4].style.left = (left + width - 30) + "px";
		manipulators[4].style.top = (top + 20) + "px";

		// ☆
		manipulatorMenus[0].style.left = (left + 5) + "px";
		manipulatorMenus[0].style.top = (top - 30) + "px";
		// memo
		manipulatorMenus[1].style.left = (left + 35) + "px";
		manipulatorMenus[1].style.top = (top - 30) + "px";
	}
	
	/**
	 * マニピュレータのセットアップ
	 * @method setupManipulator
	 * @param {Element} manip マニピュレータエレメント
	 */
	function setupManipulator(manip, targetElem) {
		var manipHalfWidth = 5,
			manipHalfHeight = 5,
			cursor,
			isdragging = false;
		
		manip.style.position = "absolute";
		manip.style.border = "solid 2px rgb(4, 180, 49)";
		manip.style.borderColor = targetElem.style.borderColor;
		manip.style.zIndex = '10';
		manip.style.width = manipHalfWidth * 2 + "px";
		manip.style.height = manipHalfHeight * 2 + "px";
		manip.style.background = targetElem.style.borderColor;//"rgb(4, 180, 49)";
		if (manip.id === '_manip_0') {
			cursor = "nw-resize";
		} else if (manip.id === '_manip_1') {
			cursor = "sw-resize";
		} else if (manip.id === '_manip_2') {
			cursor = "se-resize";
		} else if (manip.id === '_manip_3') {
			cursor = "ne-resize";
		} else if (manip.id === '_manip_4') {
			// x button
			manip.setAttribute("style", ""); // clear
			manip.style.position = "absolute";
			manip.style.zIndex = '10';
			manip.classList.add('close_button');
		}
		if (manip.id === '_manip_4') {
			manip.onmousedown = function (evt) {
				if (closeFunc) {
					closeFunc();
				}
			};
		} else {
			manip.onmousedown = function (evt) {
				var rect = evt.target.getBoundingClientRect();
				if (draggingOffsetFunc) {
					draggingOffsetFunc(evt.clientY - rect.top, evt.clientX - rect.left);
				}
				draggingManip = manip;
			};
			manip.onmousemove = function (evt) {
				manip.style.cursor = cursor;
			};
		}
	}
	
	/**
	 * マニピュレータを取り除く
	 * @method removeManipulator
	 */
	function removeManipulator() {
		var i,
			previewArea = parent;
		if (previewArea) {
			for (i = 0; i < manipulators.length; i = i + 1) {
				previewArea.removeChild(manipulators[i]);
			}
			for (i = 0; i < manipulatorMenus.length; i = i + 1) {
				previewArea.removeChild(manipulatorMenus[i]);
			}
		}
		manipulators = [];
		manipulatorMenus = [];
		parent = null;
	}
	
	/**
	 * マニピュレータのセットアップ
	 * @method setupManipulator
	 * @param {Element} previewArea プレビューエリア
	 * @param {Element} targetElem ターゲットエレメント(imgなど)
	 * @param {Element} metaData メタデータ
	 */
	function setupManipulatorMenus(previewArea, targetElem, metaData) {
		var star = document.createElement('div'),
			memo = document.createElement('div');

		// 星のトグルボタン
		star.id = "_manip_menu_0";
		star.className = "manipulator_menu_star";
		star.style.borderColor = targetElem.style.borderColor;
		previewArea.appendChild(star);
		manipulatorMenus.push(star);
		// 初期のトグル設定
		if (metaData.hasOwnProperty('mark') && (metaData.mark === "true" || metaData.mark === true)) {
			star.classList.add('active');
		}
		star.onmousedown = function (evt) {
			if (star.classList.contains('active')) {
				star.classList.remove('active');
				if (window.manipulator.on_toggle_star) {
					window.manipulator.on_toggle_star(false);
				}
			} else {
				star.classList.add('active');
				if (window.manipulator.on_toggle_star) {
					window.manipulator.on_toggle_star(true);
				}
			}
			evt.stopPropagation();
		};

		// メモのトグルボタン
		memo.id = "_manip_menu_1";
		memo.className = "manipulator_menu_memo";
		memo.style.borderColor = targetElem.style.borderColor;
		previewArea.appendChild(memo);
		manipulatorMenus.push(memo);
		// 初期のトグル設定
		if (metaData.hasOwnProperty('mark_memo') && (metaData.mark_memo === "true" || metaData.mark_memo === true)) {
			memo.classList.add('active');
		}
		memo.onmousedown = function (evt) {
			if (memo.classList.contains('active')) {
				memo.classList.remove('active');
				if (window.manipulator.on_toggle_memo) {
					window.manipulator.on_toggle_memo(false);
				}
			} else {
				memo.classList.add('active');
				if (window.manipulator.on_toggle_memo) {
					window.manipulator.on_toggle_memo(true);
				}
			}
			evt.stopPropagation();
		};
	}
	

	/**
	 * マニピュレータを表示
	 * @method showManipulator
	 * @param {Element} targetElem ターゲットエレメント(imgなど)
	 * @param {Element} previewArea 表示先エレメント
	 * @param {Element} metaData メタデータ
	 */
	function showManipulator(targetElem, previewArea, metaData) {
		var manips = [
				document.createElement('span'),
				document.createElement('span'),
				document.createElement('span'),
				document.createElement('span'),
				document.createElement('span')
			],
			manip,
			i;
		
		moveManipulator(manips, targetElem);
		removeManipulator();
		parent = previewArea;
		
		for (i = 0; i < manips.length; i = i + 1) {
			manip = manips[i];
			manip.id = "_manip_" + i;
			setupManipulator(manip, targetElem);
			previewArea.appendChild(manip);
			manipulators.push(manip);
		}
		setupManipulatorMenus(previewArea, targetElem, metaData);
	}
	
	function isShowManipulator() {
		return (document.getElementById("_manip_0") !== null);
	}
	
	window.manipulator = new Manipulator();
	window.manipulator.moveManipulator = moveManipulator;
	window.manipulator.setupManipulator = setupManipulator;
	window.manipulator.removeManipulator = removeManipulator;
	window.manipulator.showManipulator = showManipulator;
	window.manipulator.isShowManipulator = isShowManipulator;
	window.manipulator.getDraggingManip = getDraggingManip;
	window.manipulator.clearDraggingManip = clearDraggingManip;
	window.manipulator.setDraggingOffsetFunc = setDraggingOffsetFunc;
	window.manipulator.setCloseFunc = setCloseFunc;
	window.manipulator.on_toggle_star = null;
	window.manipulator.on_toggle_memo = null;
}());
