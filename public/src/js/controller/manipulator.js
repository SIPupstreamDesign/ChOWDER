/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Validator from '../common/validator.js';

"use strict";

/**
 * マニピュレータ
 * @method Manipulator
 */
class Manipulator extends EventEmitter {
	constructor() {
		super();
		this.draggingManip = null;
		this.manipulators = [];
		this.manipulatorMenus = [];
		this.manipulatorPDFPage = null;
		this.draggingOffsetFunc = null;
		this.closeFunc = null;
		this.parent = null;
	}

	init(store, action) {
		this.store = store;
		this.action = action;
	}

	/**
	 * ドラッグ中のマニピュレータを返す.
	 * @method getDraggingManip
	 * @return ドラッグ中のマニピュレータ
	 */
	getDraggingManip() {
		return this.draggingManip;
	}
	/**
	 * ドラッグ中のオフセットコールバックの設定
	 * @method setDraggingOffsetFunc
	 * @param {Function} func ドラッグ中のオフセットコールバック
	 */
	setDraggingOffsetFunc(func) {
		this.draggingOffsetFunc = func;
	}
	/**
	 * クローズコールバックの設定
	 * @method setCloseFunc
	 * @param {Function} func クローズコールバック
	 */
	setCloseFunc(func) {
		this.closeFunc = func;
	}
	/**
	 * ドラッグ中のマニピュレータをクリア
	 * @method clearDraggingManip
	 */
	clearDraggingManip() {
		this.draggingManip = null;
	}
	/**
	 * マニピュレータを移動させる
	 * @method moveManipulator
	 * @param {Element} targetElem 移動したエレメント
	 */
	moveManipulator(targetElem) {
		//console.log("moveManipulator:", targetElem);
		if (this.manipulators.length < 3) {
			//console.log("manipulators:", manipulators);
			return;
		}
		//console.error(targetElem);
		let left, top, width, height, manipHalfWidth = 5, manipHalfHeight = 5, posx = Number(targetElem.style.left.split("px").join("")), posy = Number(targetElem.style.top.split("px").join(""));
		left = (posx - manipHalfWidth);
		top = (posy - manipHalfHeight);
		width = targetElem.offsetWidth;
		height = targetElem.offsetHeight;
		// left top
		this.manipulators[0].style.left = left + "px";
		this.manipulators[0].style.top = top + "px";
		// left bottom
		this.manipulators[1].style.left = left + "px";
		this.manipulators[1].style.top = (top + height) + "px";
		// right bottom
		this.manipulators[2].style.left = (left + width) + "px";
		this.manipulators[2].style.top = (top + height) + "px";
		// right top
		this.manipulators[3].style.left = (left + width) + "px";
		this.manipulators[3].style.top = top + "px";
		// x button
		this.manipulators[4].style.left = (left + width - 17) + "px";
		this.manipulators[4].style.top = (top - 27) + "px";
		if (this.manipulatorMenus.length !== 0) {
			this.manipulatorMenus.forEach(function (menu, i) {
				menu.style.left = (left + 5 + 30 * i) + 'px';
				menu.style.top = (top - 30) + 'px';
			});
		}
		if (this.manipulatorVideoPlay) {
			this.manipulatorVideoPlay.style.left = (left + 5 + width / 2 - 32) + 'px';
			this.manipulatorVideoPlay.style.top = (top + 5 + height / 2 - 32) + 'px';
		}
		if (this.manipulatorPDFPage) {
			this.manipulatorPDFPage.style.left = (left + 5 + width / 2 - 50) + 'px';
			this.manipulatorPDFPage.style.top = (top + 5 + height - 30) + 'px';
		}
	}
	mousedownFunc(manip) {
		return (evt) => {
			this.draggingManip = manip;
			
			let clientX = evt.clientX;
			let clientY = evt.clientY;

			if (evt.changedTouches) {
				clientX = evt.changedTouches[0].clientX;
				clientY = evt.changedTouches[0].clientY;
			} else {
				clientX = evt.clientX;
				clientY = evt.clientY;
			}

			this.action.changeManipulatorMouseDownPos({
				x : clientX,
				y : clientY,
			});
			

			for (let i = 0; i < this.store.getState().getSelectedIDList().length; ++i) {
				let id = this.store.getState().getSelectedIDList()[i];
				let elem = document.getElementById(id);
				let rect = elem.getBoundingClientRect();
				this.store.getState().setDragRect(id, rect);
			}
			this.store.getState().setDraggingIDList([]);
		};
	}
	mousemoveFunc(manip, cursor) {
		return (evt) => {
			manip.style.cursor = cursor;
			//this.emit(Manipulator.EVENT_MOUSE_MOVE, null, evt);
		};
	}
	/**
		 * マニピュレータのセットアップ
		 * @method setupManipulator
		 * @param {Element} manip マニピュレータエレメント
		 */
	setupManipulator(manip, targetElem) {
		let manipHalfWidth = 5, manipHalfHeight = 5, cursor, isdragging = false;
		manip.style.position = "absolute";
		manip.style.border = "solid 2px rgb(4, 180, 49)";
		manip.style.borderColor = targetElem.style.borderColor;
		manip.style.zIndex = '10000001';
		manip.style.width = manipHalfWidth * 2 + "px";
		manip.style.height = manipHalfHeight * 2 + "px";
		manip.style.background = targetElem.style.borderColor; //"rgb(4, 180, 49)";
		if (manip.id === '_manip_0') {
			cursor = "nw-resize";
		}
		else if (manip.id === '_manip_1') {
			cursor = "sw-resize";
		}
		else if (manip.id === '_manip_2') {
			cursor = "se-resize";
		}
		else if (manip.id === '_manip_3') {
			cursor = "ne-resize";
		}
		else if (manip.id === '_manip_4') {
			// x button
			manip.setAttribute("style", ""); // clear
			manip.style.position = "absolute";
			manip.style.zIndex = '1000000';
			manip.classList.add('close_button');
		}
		if (manip.id === '_manip_4') {
			manip.onmousedown = (evt) => {
				if (this.closeFunc) {
					this.closeFunc();
				}
			};
		}
		else {
			if (window.ontouchstart !== undefined) {
				manip.ontouchstart = this.mousedownFunc(manip);
				manip.ontouchmove = this.mousemoveFunc(manip, cursor);
			}
			else {
				manip.onmousedown = this.mousedownFunc(manip);
				manip.onmousemove = this.mousemoveFunc(manip, cursor);
			}
		}
	}
	/**
		 * マニピュレータを取り除く
		 * @method removeManipulator
		 */
	removeManipulator() {
		let i, previewArea = this.parent;
		if (previewArea) {
			for (i = 0; i < this.manipulators.length; i = i + 1) {
				previewArea.removeChild(this.manipulators[i]);
			}
			for (i = 0; i < this.manipulatorMenus.length; i = i + 1) {
				previewArea.removeChild(this.manipulatorMenus[i]);
			}
			if (this.manipulatorPDFPage) {
				previewArea.removeChild(this.manipulatorPDFPage);
			}
			if (this.manipulatorVideoPlay) {
				previewArea.removeChild(this.manipulatorVideoPlay);
			}
		}
		this.manipulators = [];
		this.manipulatorMenus = [];
		this.manipulatorPDFPage = null;
		this.manipulatorVideoPlay = null;
		this.parent = null;
	}
	/**
		 * マニピュレータのセットアップ
		 * @method setupManipulator
		 * @param {Element} previewArea プレビューエリア
		 * @param {Element} targetElem ターゲットエレメント(imgなど)
		 * @param {Element} metaData メタデータ
		 */
	setupManipulatorMenus(previewArea, targetElem, metaData) {
		let star = document.createElement('div'), memo = document.createElement('div');
		// 星のトグルボタン
		if (!Validator.isWindowType(metaData)) {
			star.id = '_manip_menu_0';
			star.className = 'manipulator_menu star';
			star.style.borderColor = targetElem.style.borderColor;
			previewArea.appendChild(star);
			this.manipulatorMenus.push(star);
		}
		// 初期のトグル設定
		if (metaData.hasOwnProperty('mark') && (metaData.mark === 'true' || metaData.mark === true)) {
			star.classList.add('active');
		}
		star.onmousedown = (evt) => {
			if (star.classList.contains('active')) {
				star.classList.remove('active');
				this.action.toggleManipulatorStar({
					isActive : false
				});
			}
			else {
				star.classList.add('active');
				this.action.toggleManipulatorStar({
					isActive : true
				});
			}
			evt.stopPropagation();
		};
		// メモのトグルボタン
		if (!Validator.isWindowType(metaData)) {
			memo.id = '_manip_menu_1';
			memo.className = 'manipulator_menu memo';
			memo.style.borderColor = targetElem.style.borderColor;
			previewArea.appendChild(memo);
			this.manipulatorMenus.push(memo);
		}
		// 初期のトグル設定
		if (metaData.hasOwnProperty('mark_memo') && (metaData.mark_memo === 'true' || metaData.mark_memo === true)) {
			memo.classList.add('active');
		}
		memo.onmousedown = (evt) => {
			if (memo.classList.contains('active')) {
				memo.classList.remove('active');
				this.action.toggleManipulatorMemo({
					isActive : false
				});
			}
			else {
				memo.classList.add('active');
				this.action.toggleManipulatorMemo({
					isActive : true
				});
			}
			evt.stopPropagation();
		};
		// ビデオ再生・停止
		if (metaData.type === 'video' && metaData.subtype === 'file' && !targetElem.play) {
			let button = document.createElement('div');
			button.className = 'manipulator_video';
			previewArea.appendChild(button);
			this.manipulatorVideoPlay = button;
			let isPlaying = metaData.isPlaying === 'true';
			let image = document.createElement('img');
			image.src = isPlaying ? 'src/image/video_pause.png' : 'src/image/video_play.png';
			image.className = 'manipulator_video_img';
			button.appendChild(image);
			this.manipulatorVideoPlayImage = image;
			button.onmousedown = (evt) => {
				evt.stopPropagation();
				isPlaying = !isPlaying;
				this.action.playVideoOnManipulator({
					id : metaData.id,
					isPlaying : isPlaying
				})
				image.src = isPlaying ? 'src/image/video_pause.png' : 'src/image/video_play.png';
			};
		}
		// pdfページ送り
		if (metaData.type === 'pdf') {
			let parent = document.createElement('div');
			parent.className = 'manipulator_pdf';
			previewArea.appendChild(parent);
			this.manipulatorPDFPage = parent;
			let prev = document.createElement('div');
			prev.className = 'prev';
			parent.appendChild(prev);
			prev.onmousedown = (evt) => {
				evt.stopPropagation();
				// ページを1つ前に戻す
				this.action.movePDFPageOnManipulator({
					id : metaData.id,
					delta : -1,
					callback : (p) => {
						page.innerText = p + ' / ' + metaData.pdfNumPages;
					}
				});
			};
			let page = document.createElement('div');
			page.className = 'page';
			page.innerText = metaData.pdfPage + ' / ' + metaData.pdfNumPages;
			parent.appendChild(page);
			let next = document.createElement('div');
			next.className = 'next';
			parent.appendChild(next);
			next.onmousedown = (evt) => {
				evt.stopPropagation();
				// ページを1つ次に進める
				this.action.movePDFPageOnManipulator({
					id : metaData.id,
					delta : 1,
					callback : (p) => {
						page.innerText = p + ' / ' + metaData.pdfNumPages;
					}
				});
			};
		}
	}
	/**
		 * マニピュレータを表示
		 * @method showManipulator
		 * @param {Element} targetElem ターゲットエレメント(imgなど)
		 * @param {Element} previewArea 表示先エレメント
		 * @param {Element} displayGroup 現在のディスプレイグループ
		 */
	showManipulator(targetElem, previewArea) {
		let authority = this.store.getManagement().getAuthorityObject();
		let metaDataList = this.store.getSelectedMetaDataList();
		let displayGroup = this.store.getState().getDisplaySelectedGroup();

		let manips = [
			document.createElement('span'),
			document.createElement('span'),
			document.createElement('span'),
			document.createElement('span'),
			document.createElement('span') // バッテン
		];
		let metaData;
		let editableCount = 0;
		this.moveManipulator(targetElem);
		this.removeManipulator();
		this.parent = previewArea;

		for (let k = 0; k < metaDataList.length; ++k) {
			metaData = metaDataList[k];
			if ((!Validator.isWindowType(metaData) && authority.isEditable(metaData.group))
				|| (Validator.isWindowType(metaData) && authority.isDisplayEditable(displayGroup))) {
				++editableCount;
			}
		}
		if (editableCount > 0) {
			// 1つでも編集可能なのがあった
			for (let i = 0; i < manips.length; i = i + 1) {
				let manip = manips[i];
				manip.id = "_manip_" + i;
				this.setupManipulator(manip, targetElem);
				previewArea.appendChild(manip);
				this.manipulators.push(manip);
			}
			if (editableCount === 1) {
				// 1つだけ選択されてたときはサブメニューを表示
				this.setupManipulatorMenus(previewArea, targetElem, metaData);
			}
		}
	}
	isShowManipulator() {
		return (document.getElementById("_manip_0") !== null);
	}
}

// signleton
export default new Manipulator();
