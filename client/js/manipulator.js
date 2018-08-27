/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */

/// scale manipulator
(function () {
	"use strict";
	
	/**
	 * マニピュレータ
	 * @method Manipulator
	 */
	var Manipulator;
	
	Manipulator = function () {
		EventEmitter.call(this);
		this.draggingManip = null;
		this.manipulators = [];
		this.manipulatorMenus = [];
		this.manipulatorPDFPage = null;
		this.draggingOffsetFunc = null;
		this.closeFunc = null;
		this.parent = null;
		this.authority = null;
	};
	Manipulator.prototype = Object.create(EventEmitter.prototype);

	/**
	 * ドラッグ中のマニピュレータを返す.
	 * @method getDraggingManip
	 * @return ドラッグ中のマニピュレータ
	 */
	Manipulator.prototype.getDraggingManip = function () {
		return this.draggingManip;
	};
	
	/**
	 * ドラッグ中のオフセットコールバックの設定
	 * @method setDraggingOffsetFunc
	 * @param {Function} func ドラッグ中のオフセットコールバック
	 */
	Manipulator.prototype.setDraggingOffsetFunc = function (func) {
		this.draggingOffsetFunc = func;
	};
	
	/**
	 * クローズコールバックの設定
	 * @method setCloseFunc
	 * @param {Function} func クローズコールバック
	 */
	Manipulator.prototype.setCloseFunc = function (func) {
		this.closeFunc = func;
	};
	
	/**
	 * ドラッグ中のマニピュレータをクリア
	 * @method clearDraggingManip
	 */
	Manipulator.prototype.clearDraggingManip = function () {
		this.draggingManip = null;
	};

	/**
	 * マニピュレータを移動させる
	 * @method moveManipulator
	 * @param {Element} targetElem 移動したエレメント
	 */
	Manipulator.prototype.moveManipulator = function (targetElem) {
		//console.log("moveManipulator:", targetElem);
		if (this.manipulators.length < 3) {
			//console.log("manipulators:", manipulators);
			return;
		}
		//console.error(targetElem);
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
	};
	
	Manipulator.prototype.mousedownFunc = function (manip) {
		return function (evt) {
			var rect = evt.target.getBoundingClientRect(),
				pageX = evt.pageX,
				pageY = evt.pageY,
				clientX = evt.clientX,
				clientY = evt.clientY;

			if (evt.changedTouches) {
				rect = evt.changedTouches[0].target.getBoundingClientRect();
				pageX = evt.changedTouches[0].pageX,
				pageY = evt.changedTouches[0].pageY,
				clientX = evt.changedTouches[0].clientX;
				clientY = evt.changedTouches[0].clientY;
			}
			if (this.draggingOffsetFunc) {
				this.draggingOffsetFunc(clientY - rect.top, clientX - rect.left);
			}
			this.draggingManip = manip;
		}.bind(this);
	};

	Manipulator.prototype.mousemoveFunc = function (manip, cursor) {
		return function (evt) {
			manip.style.cursor = cursor;
		};
	};
	
	/**
	 * マニピュレータのセットアップ
	 * @method setupManipulator
	 * @param {Element} manip マニピュレータエレメント
	 */
	Manipulator.prototype.setupManipulator = function (manip, targetElem) {
		var manipHalfWidth = 5,
			manipHalfHeight = 5,
			cursor,
			isdragging = false;
		
		manip.style.position = "absolute";
		manip.style.border = "solid 2px rgb(4, 180, 49)";
		manip.style.borderColor = targetElem.style.borderColor;
		manip.style.zIndex = '1000000';
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
			manip.style.zIndex = '1000000';
			manip.classList.add('close_button');
		}
		if (manip.id === '_manip_4') {
			manip.onmousedown = function (evt) {
				if (this.closeFunc) {
					this.closeFunc();
				}
			}.bind(this);
		} else {
			if(window.ontouchstart !== undefined) {
				manip.ontouchstart = this.mousedownFunc(manip);
				manip.ontouchmove = this.mousemoveFunc(manip, cursor);
			} else {
				manip.onmousedown = this.mousedownFunc(manip);
				manip.onmousemove = this.mousemoveFunc(manip, cursor);
			}
		}
	};
	
	/**
	 * マニピュレータを取り除く
	 * @method removeManipulator
	 */
	Manipulator.prototype.removeManipulator = function () {
		var i,
			previewArea = this.parent;
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
	};
	
	/**
	 * マニピュレータのセットアップ
	 * @method setupManipulator
	 * @param {Element} previewArea プレビューエリア
	 * @param {Element} targetElem ターゲットエレメント(imgなど)
	 * @param {Element} metaData メタデータ
	 */
	Manipulator.prototype.setupManipulatorMenus = function (previewArea, targetElem, metaData) {
		var star = document.createElement('div'),
			memo = document.createElement('div');

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
		star.onmousedown = function (evt) {
			if (star.classList.contains('active')) {
				star.classList.remove('active');
				this.emit(Manipulator.EVENT_TOGGLE_STAR, null, false);
			} else {
				star.classList.add('active');
				this.emit(Manipulator.EVENT_TOGGLE_STAR, null, true);
			}
			evt.stopPropagation();
		}.bind(this);

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
		memo.onmousedown = function (evt) {
			if (memo.classList.contains('active')) {
				memo.classList.remove('active');
				this.emit(Manipulator.EVENT_TOGGLE_MEMO, null, false);
			} else {
				memo.classList.add('active');
				this.emit(Manipulator.EVENT_TOGGLE_MEMO, null, true);
			}
			evt.stopPropagation();
		}.bind(this);

		// ビデオ再生・停止
		if (metaData.type === 'video' && metaData.subtype === 'file' && !targetElem.play) {
			var button = document.createElement('div');
			button.className = 'manipulator_video';
			previewArea.appendChild(button);
			this.manipulatorVideoPlay = button;

			var isPlaying = metaData.isPlaying === 'true';

			var image = document.createElement('img');
			image.src = isPlaying ? '../image/video_pause.png' : '../image/video_play.png';
			image.className = 'manipulator_video_img';
			button.appendChild(image);
			this.manipulatorVideoPlayImage = image;

			button.onmousedown = function (evt) {
				evt.stopPropagation();
				isPlaying = !isPlaying;
				this.emit('play_video', null, metaData.id, isPlaying);
				image.src = isPlaying ? '../image/video_pause.png' : '../image/video_play.png';
			}.bind(this);
		}

		// pdfページ送り
		if (metaData.type === 'pdf') {
			var parent = document.createElement('div');
			parent.className = 'manipulator_pdf';
			previewArea.appendChild(parent);
			this.manipulatorPDFPage = parent;

			var prev = document.createElement('div');
			prev.className = 'prev';
			parent.appendChild(prev);

			prev.onmousedown = function (evt) {
				evt.stopPropagation();
				this.emit('move_pdf_page', null, metaData.id, -1, function (p) {
					page.innerText = p + ' / ' + metaData.pdfNumPages;
				}); // ページを1つ前に戻す
			}.bind(this);

			var page = document.createElement('div');
			page.className = 'page';
			page.innerText = metaData.pdfPage + ' / ' + metaData.pdfNumPages;
			parent.appendChild(page);

			var next = document.createElement('div');
			next.className = 'next';
			parent.appendChild(next);

			next.onmousedown = function (evt) {
				evt.stopPropagation();
				this.emit('move_pdf_page', null, metaData.id, 1, function (p) {
					page.innerText = p + ' / ' + metaData.pdfNumPages;
				}); // ページを1つ次に進める
			}.bind(this);
		}
	};
	
	/**
	 * マニピュレータを表示
	 * @method showManipulator
	 * @param {Element} targetElem ターゲットエレメント(imgなど)
	 * @param {Element} previewArea 表示先エレメント
	 * @param {Element} metaData メタデータ
	 */
	Manipulator.prototype.showManipulator = function (authority, targetElem, previewArea, metaData) {
		var manips = [
				document.createElement('span'), // 左上
				document.createElement('span'), // 左下
				document.createElement('span'), // 右下
				document.createElement('span'), // 右上
				document.createElement('span') // バッテン
			],
			manip,
			i;
		
		this.authority = authority;
		this.moveManipulator(targetElem);
		this.removeManipulator();
		this.parent = previewArea;
		
		if ( (!Validator.isWindowType(metaData) && this.authority.isEditable(metaData.group))
		|| (Validator.isWindowType(metaData) && this.authority.isDisplayManipulatable())) 
		{
			for (i = 0; i < manips.length; i = i + 1) {
				manip = manips[i];
				manip.id = "_manip_" + i;
				this.setupManipulator(manip, targetElem);
				previewArea.appendChild(manip);
				this.manipulators.push(manip);
			}
			this.setupManipulatorMenus(previewArea, targetElem, metaData);
		}
	};
	
	Manipulator.prototype.isShowManipulator = function () {
		return (document.getElementById("_manip_0") !== null);
	};
	

	Manipulator.EVENT_TOGGLE_STAR = "toggle_star";
	Manipulator.EVENT_TOGGLE_MEMO = "toggle_memo";

	// signleton
	window.manipulator = new Manipulator();
}());
