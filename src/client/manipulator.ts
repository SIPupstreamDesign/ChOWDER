
// import Validator from '../common/validator.js';



/**
 * マニピュレータ
 * @method Manipulator
 */
export class Manipulator {
	private draggingManip : HTMLElement | null = null;
	private manipulators : HTMLElement[] = [];
	private parent : HTMLElement | null = null;
	private targetElem : HTMLElement  | null = null;
	private closeFunc? : any;

	private isDragging:boolean = false;
	private startX:number = 0;
	private startY:number = 0;
	private startWidth:number =0;
	private startHeight:number =0;

	private createUpdateStock: (elem:HTMLElement | null) => void = () => {};
	private draggingHandleIndex: number = -1;
	private startLeft: number = 0;
	private startTop: number = 0;
	private zoom: number = 1;
	/** null=フリー、数値=ロック (height/width) */
	private aspectRatio: number | null = null;

	constructor() {
		//this.manipulatorMenus = [];
		//this.manipulatorPDFPage = null;
		//this.draggingOffsetFunc = null;
		// this.closeFunc = null;

	}


	init(callCreateStock:(elem:HTMLElement|null)=>void) {
		this.createUpdateStock = callCreateStock;
	}

	/**
	 * アスペクト比ロックを設定する
	 * @param ratio height/width の比。null でフリーリサイズ
	 */
	setAspectRatio(ratio: number | null): void {
		this.aspectRatio = ratio;
	}

	get targetElement(): HTMLElement | null { return this.targetElem; }

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

	setDraggingOffsetFunc(func : any) {
		this.draggingOffsetFunc = func;
	}
 	*/

	/**
	 * クローズコールバックの設定
	 * @method setCloseFunc
	 * @param {Function} func クローズコールバック
	 */
	setCloseFunc(func: any) {
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
	moveManipulator(targetElem : HTMLElement) {
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

		/*
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
		*/
	}

	mousedownFunc(manip : HTMLElement) {
		return (evt : any) => {
			if(evt.button != 0){return;}

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

			/*
			this.action.changeManipulatorMouseDownPos({
				x : clientX,
				y : clientY,
			});
			*/

			/*
			for (let i = 0; i < this.store.getState().getSelectedIDList().length; ++i) {
				let id = this.store.getState().getSelectedIDList()[i];
				let elem = document.getElementById(id);
				let rect = elem.getBoundingClientRect();
				this.store.getState().setDragRect(id, rect);
			}
			this.store.getState().setDraggingIDList([]);
			*/
		};
	}

	mousemoveFunc(manip : HTMLElement, cursor : string) {
		return (evt : any) => {
			manip.style.cursor = cursor;
		};
	}

	/**
		 * マニピュレータのセットアップ
		 * @method setupManipulator
		 * @param {Element} manip マニピュレータエレメント
		 */
	setupManipulator(manip: HTMLElement, targetElem: HTMLElement) {
		let cursor : string = "";
		let manipHalfWidth = 5, manipHalfHeight = 5, isdragging = false;
		manip.classList.add("nativeScale");
		manip.style.position = "absolute";
		manip.style.userSelect = 'none';
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
			/*
			if (window.ontouchstart !== undefined) {
				manip.ontouchstart = this.mousedownFunc(manip);
				manip.ontouchmove = this.mousemoveFunc(manip, cursor);
			}
			else {
				manip.onmousedown = this.mousedownFunc(manip);
				manip.onmousemove = this.mousemoveFunc(manip, cursor);
			}
			*/
			manip.addEventListener('mousedown', (e:MouseEvent) => {
				// 左クリック（0）以外は無視
				if (e.button !== 0) return;

				this.isDragging = true;

				// クリックした瞬間のマウス座標を記録
				this.startX = e.clientX;
				this.startY = e.clientY;

				// クリックした瞬間の要素のサイズを記録
				//const rect = targetElem.getBoundingClientRect();
				this.startWidth = parseInt(targetElem.dataset.width ?? '0');
				this.startHeight = parseInt(targetElem.dataset.height ?? '0');
				this.draggingHandleIndex = parseInt(manip.id.replace('_manip_', ''));
				this.startLeft = Number(targetElem.dataset.worldX ?? 0);
				this.startTop = Number(targetElem.dataset.worldY ?? 0);

				// ドラッグ中のテキスト選択を防ぎ、画面全体のカーソルを固定
				document.body.style.userSelect = 'none';
				document.body.style.cursor = 'nwse-resize';

				// ドラッグ操作用のイベントを document に追加
				document.addEventListener('mousemove', this.onMouseMove);
				document.addEventListener('mouseup', this.onMouseUp);
			});
		}
	}
	// 2. マウスを動かしている時の処理
	onMouseMove = (e:MouseEvent) : void => {
		if (!this.isDragging) return;
		if (!this.targetElem) return;

		// 万が一、左クリックが離されていたら処理を中断（フェイルセーフ）
		if (e.buttons !== 1) {
			this.onMouseUp();
			return;
		}

		// マウス移動量をズームで補正して仮想座標系のデルタに変換
		const dx = (e.clientX - this.startX) / this.zoom;
		const dy = (e.clientY - this.startY) / this.zoom;

		let newWidth = this.startWidth;
		let newHeight = this.startHeight;
		let newLeft = this.startLeft;
		let newTop = this.startTop;
		let positionChanged = false;

		// ハンドル別に拡縮方向を切り替える (0=NW, 1=SW, 2=SE, 3=NE)
		switch (this.draggingHandleIndex) {
			case 0: // NW: 右下固定、左上が移動
				newWidth  = Math.max(50, this.startWidth  - dx);
				newLeft   = this.startLeft + (this.startWidth  - newWidth);
				newHeight = Math.max(50, this.startHeight - dy);
				newTop    = this.startTop  + (this.startHeight - newHeight);
				positionChanged = true;
				break;
			case 1: // SW: 右上固定、左下が移動
				newWidth  = Math.max(50, this.startWidth  - dx);
				newLeft   = this.startLeft + (this.startWidth  - newWidth);
				newHeight = Math.max(50, this.startHeight + dy);
				positionChanged = true;
				break;
			case 2: // SE: 左上固定、右下が移動
				newWidth  = Math.max(50, this.startWidth  + dx);
				newHeight = Math.max(50, this.startHeight + dy);
				break;
			case 3: // NE: 左下固定、右上が移動
				newWidth  = Math.max(50, this.startWidth  + dx);
				newHeight = Math.max(50, this.startHeight - dy);
				newTop    = this.startTop  + (this.startHeight - newHeight);
				positionChanged = true;
				break;
		}

		// アスペクト比ロック: マウス移動を対角線方向に投影して width/height を算出
		if (this.aspectRatio !== null) {
			const r = this.aspectRatio;
			// s: 各ハンドルの拡縮スカラー（対角線方向への正射影）
			let s: number;
			switch (this.draggingHandleIndex) {
				case 2: s =  (dx + r * dy) / (1 + r * r); break; // SE: 右下
				case 0: s = -(dx + r * dy) / (1 + r * r); break; // NW: 左上
				case 1: s = (-dx + r * dy) / (1 + r * r); break; // SW: 左下
				case 3: s =  (dx - r * dy) / (1 + r * r); break; // NE: 右上
				default: s = dx;
			}
			newWidth  = Math.max(50, this.startWidth + s);
			newHeight = newWidth * r;
			// 左辺が動くハンドル (NW=0, SW=1) は left を再調整
			if (this.draggingHandleIndex === 0 || this.draggingHandleIndex === 1) {
				newLeft = this.startLeft + (this.startWidth - newWidth);
				positionChanged = true;
			}
			// 上辺が動くハンドル (NW=0, NE=3) は top を再調整
			if (this.draggingHandleIndex === 0 || this.draggingHandleIndex === 3) {
				newTop = this.startTop + (this.startHeight - newHeight);
				positionChanged = true;
			}
		}

		this.targetElem.style.width = `${newWidth}px`;
		this.targetElem.style.height = `${newHeight}px`;
		this.targetElem.dataset.width = String(newWidth);
		this.targetElem.dataset.height = String(newHeight);

		if (positionChanged) {
			this.targetElem.style.left = `${newLeft}px`;
			this.targetElem.style.top  = `${newTop}px`;
			this.targetElem.dataset.worldX = String(newLeft);
			this.targetElem.dataset.worldY = String(newTop);
		}

		this.moveManipulator(this.targetElem);
	};

	// 3. マウスのボタンを離した時の処理
	onMouseUp = () : void =>{
		if (!this.isDragging) return;
		this.isDragging = false;

		// スタイルを元に戻す
		document.body.style.userSelect = '';
		document.body.style.cursor = '';

		// 不要になったイベントリスナーを削除（メモリ節約）
		document.removeEventListener('mousemove', this.onMouseMove);
		document.removeEventListener('mouseup', this.onMouseUp);

		this.createUpdateStock(this.targetElem);

		this.removeManipulator();
		if (this.targetElem && this.parent) {
			this.showManipulator(this.targetElem, this.parent, this.zoom);
		}
	};

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
			/*
			for (i = 0; i < this.manipulatorMenus.length; i = i + 1) {
				previewArea.removeChild(this.manipulatorMenus[i]);
			}
			if (this.manipulatorPDFPage) {
				previewArea.removeChild(this.manipulatorPDFPage);
			}
			if (this.manipulatorVideoPlay) {
				previewArea.removeChild(this.manipulatorVideoPlay);
			}
			*/
		}
		this.manipulators = [];
		/*
		this.manipulatorMenus = [];
		this.manipulatorPDFPage = null;
		this.manipulatorVideoPlay = null;
		this.parent = null;
		*/
	}
	/**
		 * マニピュレータのセットアップ
		 * @method setupManipulator
		 * @param {Element} previewArea プレビューエリア
		 * @param {Element} targetElem ターゲットエレメント(imgなど)
		 * @param {Element} metaData メタデータ
		 */
	setupManipulatorMenus(previewArea : HTMLElement, targetElem : HTMLElement, metaData : any) {
		let star = document.createElement('div'), memo = document.createElement('div');
		// 星のトグルボタン
		/*
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

		*/
		// メモのトグルボタン
		/*
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
		*/

		// ビデオ再生・停止
		/*
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
		*/
	}
	/**
		 * マニピュレータを表示
		 * @method showManipulator
		 * @param {Element} targetElem ターゲットエレメント(imgなど)
		 * @param {Element} previewArea 表示先エレメント
		 * @param {Element} displayGroup 現在のディスプレイグループ
		 */
	showManipulator(targetElem : HTMLElement, previewArea: HTMLElement, zoom: number = 1) {
		this.zoom = zoom;
		//let authority = this.store.getManagement().getAuthorityObject();
		//let metaDataList = this.store.getSelectedMetaDataList();
		//let displayGroup = this.store.getState().getDisplaySelectedGroup();

		let manips = [
			document.createElement('span'),
			document.createElement('span'),
			document.createElement('span'),
			document.createElement('span'),
			document.createElement('span') // バッテン
		];
		let metaData;
		let editableCount = 1;
		this.removeManipulator();
		this.parent = previewArea;
		this.targetElem = targetElem;
		/*
		for (let k = 0; k < metaDataList.length; ++k) {
			metaData = metaDataList[k];
			if ((!Validator.isWindowType(metaData) && authority.isEditable(metaData.group))
				|| (Validator.isWindowType(metaData) && authority.isDisplayEditable(displayGroup))) {
				++editableCount;
			}
		}
		*/
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
		this.moveManipulator(targetElem);
	}

	// メモボタンのオンオフの表示状態を変更する
	updateMemoToggleButton(metaData : any) {
		if (!this.isShowManipulator()) return;
		const isMemoVisible = (metaData.hasOwnProperty('mark_memo') && (metaData.mark_memo === 'true' || metaData.mark_memo === true));
		const memo = document.getElementById('_manip_menu_1');
		if (memo) {
			if (isMemoVisible) {
				if (!memo.classList.contains('active')) {
					memo.classList.add('active');
				}
			} else {
				if (memo.classList.contains('active')) {
					memo.classList.remove('active');
				}
			}
		}
	}

	// マークボタンのオンオフの表示状態を変更する
	updateMarkToggleButton(metaData: any) {
		if (!this.isShowManipulator()) return;
		const isMemoVisible = (metaData.hasOwnProperty('mark') && (metaData.mark === 'true' || metaData.mark === true));
		const mark = document.getElementById('_manip_menu_0');
		if (mark) {
			if (isMemoVisible) {
				if (!mark.classList.contains('active')) {
					mark.classList.add('active');
				}
			} else {
				if (mark.classList.contains('active')) {
					mark.classList.remove('active');
				}
			}
		}
	}

	isShowManipulator() {
		return (document.getElementById("_manip_0") !== null);
	}
}

// signleton
export default new Manipulator();
