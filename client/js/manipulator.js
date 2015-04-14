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
			console.log("manipulators:", manipulators);
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
	}
	
	/**
	 * マニピュレータのセットアップ
	 * @method setupManipulator
	 * @param {Element} manip マニピュレータエレメント
	 */
	function setupManipulator(manip) {
		var manipHalfWidth = 5,
			manipHalfHeight = 5,
			cursor,
			isdragging = false;
		
		manip.style.position = "absolute";
		manip.style.border = "solid 2px black";
		manip.style.zIndex = '10';
		manip.style.width = manipHalfWidth * 2 + "px";
		manip.style.height = manipHalfHeight * 2 + "px";
		manip.style.background = "#000";
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
			/*manip.style.cursor = "pointer";
			manip.innerHTML = "<pre>x</pre>";
			manip.style.textAlign = "center";
			manip.style.background = "red";
			manip.style.borderRadius = "3px";*/
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
					console.log("draggingOffsetFunc");
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
		}
		manipulators = [];
		parent = null;
	}
	
	/// show manipulator rects on elem
	/**
	 * マニピュレータを表示
	 * @method showManipulator
	 * @param {Element} elem 対象エレメント
	 * @param {Element} previewArea 表示先エレメント
	 */
	function showManipulator(elem, previewArea) {
		var manips = [
				document.createElement('span'),
				document.createElement('span'),
				document.createElement('span'),
				document.createElement('span'),
				document.createElement('span')
			],
			manip,
			i;
		
		moveManipulator(manips, elem);
		removeManipulator();
		parent = previewArea;
		
		for (i = 0; i < manips.length; i = i + 1) {
			manip = manips[i];
			manip.id = "_manip_" + i;
			setupManipulator(manip);
			previewArea.appendChild(manip);
			manipulators.push(manip);
		}
	}
	
	window.manipulator = new Manipulator();
	window.manipulator.moveManipulator = moveManipulator;
	window.manipulator.setupManipulator = setupManipulator;
	window.manipulator.removeManipulator = removeManipulator;
	window.manipulator.showManipulator = showManipulator;
	window.manipulator.getDraggingManip = getDraggingManip;
	window.manipulator.clearDraggingManip = clearDraggingManip;
	window.manipulator.setDraggingOffsetFunc = setDraggingOffsetFunc;
	window.manipulator.setCloseFunc = setCloseFunc;
}());
