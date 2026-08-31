
// import Validator from '../common/validator.js';

import type { LogFn, SendCommandFn } from './controller/websocket/WebSocketClient';

export interface clientCursorrDeps {
	getSocketId: () => string | null;
	sendCmd: SendCommandFn;
}

interface CursorPoint {
	x: number;
	y: number;
}

interface RemoteCursorParams {
	socketId: string;
	userId?: string;
	color: string;
	data: CursorPoint;
}

/**
 * 他のコントローラーのマウスカーソル
 * @method ClientCursor
 */
export class ClientCursor {
	private parentElement : HTMLElement | null = null;
	private cursorElements : HTMLElement[] | null = [];
	private baseElement : HTMLElement | null = null;
	//private targetScoketId : string = "";
	//private posX:number =0;
	//private posY:number =0;
	private isVisible:boolean = true;

	//private readonly getSocketId: () => string | null;
    //private readonly sendCmd : SendCommandFn;


	constructor(/*deps:clientCursorrDeps*/) {

		//this.getSocketId = deps.getSocketId;
        //this.sendCmd = deps.sendCmd;
		this.init();
	}

	init(): void {
		this.parentElement = document.getElementById("preview-cursor-area");
		this.baseElement = document.getElementById("client-cursor-base");
		this.cursorElements = [];
		this.setupCursor(null, true);
	}

	CursorElement(socketId:string): HTMLElement | null {
		if(this.cursorElements ==null){return null;}

		for (const el of this.cursorElements) {
			if(el.dataset.socketId === socketId){
				return el;
			}
		}
		return null;
	 }

	/**
	 * マウスカーソルを移動させる
	 * @method moveManipulator
	 * @param {Element} targetElem 移動したエレメント
	 */
	updateCursor(params : RemoteCursorParams, zoom: number = 1) {

		if (!this.isValidCursorParams(params)) {
			return;
		}

		if(this.isVisible && params.socketId != "mine"){
			if(this.cursorElements ==null){return null;}
			const target = this.CursorElement(params.socketId);
			if (target) {
				target.style.left = params.data.x + "px";
				target.style.top = params.data.y + "px";
				target.style.transform = `scale(${1 / zoom})`;
				target.style.transformOrigin = "top left";
			} else {
				this.setupCursor(params, this.isVisible, zoom);
			}
		}
	}

	/**
		 * マウスカーソルのセットアップ
		 * @method setupCursor
		 * @param {HTMLElement} manip マウスカーソルエレメント
		 * @param {any} params socketリプライ
		 */
	setupCursor(params : RemoteCursorParams | null, isVisible:boolean, zoom: number = 1) {

		this.isVisible = isVisible;
		if(params){
			if (!this.isValidCursorParams(params)) {
				return;
			}
			const cursorElement = this.baseElement?.cloneNode(true) as HTMLElement;
			cursorElement.id = "cursor-" + params.socketId;
			cursorElement.dataset.socketId = params.socketId;

			const firstTarget = cursorElement.querySelector('.cursor-item-label') as HTMLElement;
			if (firstTarget) {
				firstTarget.textContent = params.userId ?? params.socketId;
				firstTarget.style.backgroundColor =  params.color;
			}
			cursorElement.style.display = "block";
			this.parentElement?.appendChild(cursorElement);
			this.cursorElements?.push(cursorElement);
			this.showCursor(isVisible);
			this.updateCursor(params, zoom);
		}

	}

	/**
		 * マニピュレータを表示
		 * @method showManipulator
		 * @param {Element} targetElem ターゲットエレメント(imgなど)
		 * @param {Element} previewArea 表示先エレメント
		 * @param {Element} displayGroup 現在のディスプレイグループ
		 */
	showCursor(isVisible:boolean, zoom: number = 1) {
		if(this.isVisible != isVisible){
			this.isVisible = isVisible;
			if (this.parentElement) this.parentElement.style.opacity = this.isVisible ? "0.5" : "0.0";
		}

	}

	updateAllCursorScales(zoom: number): void {
		if (this.cursorElements == null) return;
		for (const el of this.cursorElements) {
			el.style.transform = `scale(${1 / zoom})`;
			el.style.transformOrigin = "top left";
		}
	}

	removeCursor(_socketId:string){
		if(this.cursorElements == null || this.cursorElements.length == 0 ){return;}
		for(let i=0; i < this.cursorElements.length; i++){
			if(this.cursorElements[i].dataset.socketId == _socketId){
				this.cursorElements[i].remove();
				this.cursorElements.splice(i, 1);
				break;
			}
		}
	}

	private isValidCursorParams(params: RemoteCursorParams): boolean {
		if (typeof params.socketId !== 'string' || params.socketId === '') {
			return false;
		}
		if (typeof params.color !== 'string') {
			return false;
		}
		if (!/^#[0-9a-fA-F]{6}$/.test(params.color)) {
			return false;
		}
		if (typeof params.data?.x !== 'number' || typeof params.data?.y !== 'number') {
			return false;
		}
		return true;
	}

}

// signleton
export default new ClientCursor();
