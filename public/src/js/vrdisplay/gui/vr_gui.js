
/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Vscreen from '../../common/vscreen.js';
import VscreenUtil from '../../common/vscreen_util.js';
import { VRButton } from './vr_button.js';
import { XRControllerModelFactory } from '../../../../../node_modules/three/examples/jsm/webxr/XRControllerModelFactory.js';
import Store from '../store/store'
import VideoStore from '../store/video_store'
import Constants from '../../common/constants'
import { Vector3 } from 'three';

let testLines = null;
/*
function painterSortStable( a, b ) {

	if ( a.groupOrder !== b.groupOrder ) {

		return a.groupOrder - b.groupOrder;

	} else if ( a.renderOrder !== b.renderOrder ) {

		return a.renderOrder - b.renderOrder;

	} else if ( a.program !== b.program ) {

		return a.program.id - b.program.id;

	} else if ( a.material.id !== b.material.id ) {

		return a.material.id - b.material.id;

	} else if ( a.z !== b.z ) {

		return a.z - b.z;

	} else {

		return a.id - b.id;

	}

}


function reversePainterSortStable( a, b ) {

	if ( a.groupOrder !== b.groupOrder ) {

		return a.groupOrder - b.groupOrder;

	} else if ( a.renderOrder !== b.renderOrder ) {

		return a.renderOrder - b.renderOrder;

	} else if ( a.z !== b.z ) {

		return b.z - a.z;

	} else {

		return a.id - b.id;

	}

}
*/

const MarkOnOffPrefix = "markonoff";
const MemoOnOffPrefix = "memoonoff";

function GetMemoOnOffID(id) {
	return "memoonoff:" + id;
}

function GetMarkOnOffID(id) {
	return "markonoff:" + id;
}

function GetMemoID(id) {
	return "memo:" + id;
}

function GetMemoBGID(id) {
	return "memobg:" + id;
}

function GetMemoTxtID(id) {
	return "memotxt:" + id;
}

class VRGUI extends EventEmitter {
	constructor(store, action) {
		super();

		this.store = store;
		this.action = action;

		this.width = 3840;
		this.height = 2160;

		this.planeDepth = -this.width / Math.PI; //-(3840 / 2) * (1 / Math.tan(57 * Math.PI / 180)); //=-1246.8625789392206
		this.planeBaseX = -this.width / 2;
		this.planeBaseY = this.height / 2;

		// 背景画像
		const urls = [
			'src/image/room/posx.jpg',
			'src/image/room/negx.jpg',
			'src/image/room/posy.jpg',
			'src/image/room/negy.jpg',
			'src/image/room/posz.jpg',
			'src/image/room/negz.jpg'
		]

		// chowderコンテンツを描画するシーン
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.CubeTextureLoader().load(urls);

		/*
		const xrPlaneGeometry = new THREE.PlaneBufferGeometry( 10, 10, 100, 100 );
		xrPlaneGeometry.scale(10000, 10000, 10000);
		xrPlaneGeometry.rotateX( -0.5 * Math.PI );
		xrPlaneGeometry.translate(0, -100, 0 );
		const xrPlaneMaterial = new THREE.MeshBasicMaterial( { wireframe: true, side: THREE.DoubleSide } );
		const xrPlaneObject = new THREE.Mesh( xrPlaneGeometry, xrPlaneMaterial );
		this.scene.add( xrPlaneObject );
		*/

		// 確実に手前に描画するシーン（ポインタなど）
		this.frontScene = new THREE.Scene();

		// 衝突検出用
		this.raycaster = new THREE.Raycaster();
		// コントローラの方向計算用ベクトル(テンポラリ)
		this.controllerDir = new THREE.Vector3(0, 0, -1);

		// コンテンツIDと対応するthree.js Meshの辞書
		this.vrPlaneDict = {};

		// コンテンツIDと対応する枠線の辞書
		this.vrLineDict = {};
		// メモ/強調表示ON,OFF用ボタンの辞書
		this.vrMemoMarkOnOffDict = {};
		// 枠線の幅
		this.lineWidth = 2;
		// コンテンツIDと対応する強調表示線の辞書
		this.vrMarkLineDict = {};
		// コンテンツIDと対応するwebgl canvasの辞書
		this.vrWebGLDict = {};
		// コンテンツIDと対応するメモのplaneの辞書
		this.vrMemoDict = {};

		this.vrWebGLVideoHandleDict = {};

		// 右手、左手コントローラで選択中のコンテンツIDリスト
		this.selectedIDs = [null, null]; // [右, 左]
		// 最初の1回のトリガーを検知するためのフラグ
		this.isInitialTriger = [true, true]
		this.isInitialCancel = [true, true]
		// トリガーが押されているかどうか
		this.isTrigerPressed = [false, false]
		// ON/OFFボタンが押されているかどうか
		// falseまたは押されたボタンのID(memoonoff:hogehogeまたはmarkonoff:hogehoge)
		this.pressedButtons = [false, false]
		// トリガーが押されたときのスクリーン座標（移動計算用
		this.preXY = [null, null]
		// 最後に選択したコントローラのインデックス
		this.currentSelectionControllerIndex = null;

		// テンポラリRay
		this.tempRay = new THREE.Ray();

		// 描画用の更新を止めるフラグ
		this.stopUpdate = false;

		// 平面モードかどうか
		this.vrMode = "plane";
		if (this.store.getGlobalSetting().hasOwnProperty('VRMode')) {
			const mode = this.store.getGlobalSetting().VRMode;
			if (mode) {
				if (mode.toLowerCase() === "cylinder") {
					this.vrMode = "cylinder";
				}
			}
		}

		if (this.isPlaneMode()) {
			this.initCoverPlane();
		} else {
			this.initCoverCylinder();
		}

		this.memoOnImage = new Image();
		this.memoOnImage.src = "./src/image/vr_memo_on.png";
		this.memoOffImage = new Image();
		this.memoOffImage.src = "./src/image/vr_memo_off.png";
		this.markOnImage = new Image();
		this.markOnImage.src = "./src/image/vr_star_on.png";
		this.markOffImage = new Image();
		this.markOffImage.src = "./src/image/vr_star_off.png";
	}

	isPlaneMode() {
		return this.vrMode === "plane"
	}

	initVR(windowSize) {
		this.initVRRenderer(windowSize);
		this.initVRController();
		this.initVREvents();
	}

	/**
	 * 
	 * @param {*} windowSize デバイス解像度。1056 x 479 in OculusQuest2
	 */
	initVRRenderer(windowSize) {
		const previewArea = document.querySelector('#vr_area');

		this.renderer = new THREE.WebGLRenderer({ canvas: previewArea, logarithmicDepthBuffer: true });
		// three.jsのXRモードを有効にする
		this.renderer.xr.enabled = true;

		//this.renderer.setOpaqueSort (painterSortStable)
		//this.renderer.setTransparentSort  (reversePainterSortStable)

		// 仮想ディスプレイの解像度
		const width = this.getWidth();
		const height = this.getHeight();

		// canvas解像度は、仮想ディスプレイの解像度とする
		this.renderer.setSize(width, height);
		// VRボタンを設置
		this.vrButton = VRButton.createButton(this.renderer);
		document.body.appendChild(this.vrButton);

		this.cameraBase = new THREE.Object3D();
		this.scene.add(this.cameraBase);

		this.frontScene.add(this.cameraBase);

		this.camera = new THREE.PerspectiveCamera(
			93, width / height, 1, 10000);
		this.cameraBase.add(this.camera);

		this.renderer.autoClear = false;

		this.refSpace = null;

		this.onXRFrame_ = this.onXRFrame.bind(this);

		this.enableTracking = false;

		// レンダリング
		const render = (timestamp) => {
			this.timestamp = timestamp;
			const session = this.renderer.xr.getSession();
			session.requestAnimationFrame(this.onXRFrame_);
			if (!this.stopUpdate) {
				this.resolveInputs();
				this.renderer.clear();
				this.renderer.render(this.getScene(), this.camera);
				this.renderer.clearDepth();
				this.renderer.render(this.getFrontScene(), this.camera);
			}
		};
		
		this.renderer.xr.addEventListener('sessionend', (evt) => {
			const canvas = document.getElementById('vr_area');
			this.renderer.setAnimationLoop(null);
			canvas.style.visibility = "hidden";
			canvas.style.opacity = 0.0;
			// onsessionend
		});
		this.renderer.xr.addEventListener('sessionstart', (evt) => {
			const canvas = document.getElementById('vr_area');
			canvas.style.opacity = 1;
			canvas.style.visibility = "visible";
			this.renderer.setAnimationLoop(render);
			const session = this.renderer.xr.getSession();
			session.updateRenderState({ depthFar: 10000 });

			session.requestReferenceSpace("bounded-floor")
			.then((refSpace) => {
				this.enableTracking = true;
				this.refSpace = refSpace;
			}).catch((err) => {
				this.enableTracking = false;
				session.requestReferenceSpace("local-floor"). then((refSpace) => {
					this.refSpace = refSpace;
				})
			});
		});
	}

	onXRFrame(time, frame) {
		if (this.enableTracking && this.refSpace) {
			const scale = 500;
			const pose = frame.getViewerPose(this.refSpace);
			const pos = pose.transform.position;
			this.cameraBase.position.set(
				pos.x * scale, 
				this.planeBaseY + pos.y, 
				pos.z * scale);
			this.cameraBase.updateMatrix();
		}
	}

	initVRController() {
		const createLine = () => {
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
			geometry.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0.5, 0.5, 0.5], 3));
			const material = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
			const line = new THREE.Line(geometry, material);
			line.scale.z = 5;
			return line;
		}
		const createCircle = () => {
			const gaze_geometry = new THREE.SphereGeometry(5, 16, 16).translate(0, 0, -1);
			const gaze_material = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false });
			const mesh = new THREE.Mesh(gaze_geometry, gaze_material);
			mesh.position.z = this.planeDepth;
			return mesh;
		}

		//右側の光線
		const controller1 = this.renderer.xr.getController(0);
		controller1.addEventListener('connected', function (event) {
			this.add(createLine());
			this.add(createCircle());
		});
		controller1.addEventListener('disconnected', function () {
			for (let i = this.children.length - 1; i >= 0; --i) {
				this.remove(this.children[i]);
			}
		});
		this.cameraBase.add(controller1);

		//左側の光線
		const controller2 = this.renderer.xr.getController(1);
		controller2.addEventListener('connected', function (event) {
			this.add(createLine());
			this.add(createCircle());
		});
		controller2.addEventListener('disconnected', function () {
			for (let i = this.children.length - 1; i >= 0; --i) {
				this.remove(this.children[i]);
			}
		});
		this.cameraBase.add(controller2);

		const controllerModelFactory = new XRControllerModelFactory();

		// 右手コントローラの3Dオブジェクト
		const grip1 = this.renderer.xr.getControllerGrip(0);
		grip1.add(controllerModelFactory.createControllerModel(grip1));
		this.cameraBase.add(grip1);

		// 左手コントローラの3Dオブジェクト
		const grip2 = this.renderer.xr.getControllerGrip(1);
		grip2.add(controllerModelFactory.createControllerModel(grip2));
		this.cameraBase.add(grip2);

		// 選択イベントの初期化
		this.renderer.xr.addEventListener('sessionstart', (event) => {
			const session = this.renderer.xr.getSession();
			this.currentSession = session;
		});
		this.renderer.xr.addEventListener('sessionend', (event) => {
			const session = this.renderer.xr.getSession();
			this.currentSession = null;
		});
	}

	initVREvents() {
		const videoStore = this.store.getVideoStore();
		videoStore.on(VideoStore.EVENT_STREAM_ADDED, (err, metaData) => {
			const player = videoStore.getVideoPlayer(metaData.id);
			if (player) {
				// 動画ストリームが追加された場合に、動画をテクスチャとして貼り付け
				if (!this.vrPlaneDict[metaData.id].material.map) {
					this.setVRPlaneVideo({ metaData: metaData, video: player.getVideo() });
				}
			}
		});
	}

	// VRコントローラのボタン入力に応じた処理を行う
	resolveInputs() {
		if (!this.currentSession) return;

		this.move();
		for (const source of this.currentSession.inputSources) {
			if (!source.gamepad) continue;
			const gamepad = source.gamepad;

			//トリガー（人さし指）押下
			const trigerPressed = gamepad.buttons[0].pressed;
			const cancelPressed = gamepad.buttons[1].pressed;
			const isLeft = source.handedness === 'left';
			const controllerIndex = isLeft ? 1 : 0;
			const otherIndex = isLeft ? 0 : 1;
			this.isTrigerPressed[controllerIndex] = trigerPressed;
			if (cancelPressed) {
				if (this.isInitialCancel[controllerIndex]) {
					this.isInitialCancel[controllerIndex] = false;
					this.unselect(this.selectedIDs[controllerIndex], controllerIndex)
				}
			}

			if (trigerPressed) {
				// コントローラの向きを計算
				const controller = this.renderer.xr.getController(controllerIndex);
				this.controllerDir.set(0, 0, -1);
				this.controllerDir.applyQuaternion(controller.quaternion);
				this.raycaster.set(controller.getWorldPosition(new Vector3()), this.controllerDir);
				// ボタン押してるか調べる
				if (!this.pressedButtons[controllerIndex]) {
					this.tryPressButton(controllerIndex);
				}

				// ボタン押していない場合は、コンテンツ再選択を試す
				if (!this.pressedButtons[controllerIndex]) {
					if (this.isInitialTriger[controllerIndex]) {
						this.isInitialTriger[controllerIndex] = false;
						this.select(source);
					} else if (this.selectedIDs[controllerIndex]) {
						// コントローラ姿勢
						this.tempRay.set(controller.getWorldPosition(new Vector3()), this.controllerDir);
						const xy = this.calcPixelPosFromRay(this.tempRay);
						if (xy) {
							this.preXY[controllerIndex] = xy;
							this.emit(VRGUI.EVENT_SELECT, null, this.selectedIDs[controllerIndex], xy.x, xy.y);
							this.currentSelectionControllerIndex = controllerIndex;
						}
					}
				}
			} else {
				// トリガーが離されている状態

				// トリガー押下時に、何かボタンを押していた場合
				if (this.pressedButtons[controllerIndex] !== false) {
					const key = this.pressedButtons[controllerIndex];
					const splits = key.split(':');
					const prefix = splits[0];
					const id = splits[1];
					if (prefix === MarkOnOffPrefix) {
						this.action.toggleMark({ id : id });
					} else if (prefix === MemoOnOffPrefix) {
						this.action.toggleMemo({ id : id });
					}
					this.pressedButtons[controllerIndex] = false;
				}

				this.preXY[controllerIndex] = null;
				// this.unselect(source);
				this.isInitialTriger[controllerIndex] = true;
				this.isInitialCancel[controllerIndex] = true;
			}
		}
	}

	resolveIFrames(id, timestamp) {
		const funcDict = this.store.getITownFuncDict();
		if (funcDict.hasOwnProperty(id)) {
			funcDict[id].chowder_itowns_step_force(timestamp, function () { });
		}
	}

	// VRコントローラの選択イベント（トリガーを引くやつ）
	// 選択対象のplaneがあったら選択し、this.selectedIDs[idx]に選択中フラグを設定する
	select(source) {
		const isLeft = source.handedness === 'left';
		const controllerIndex = isLeft ? 1 : 0;

		// コントローラの向きを計算
		const controller = this.renderer.xr.getController(controllerIndex);
		this.controllerDir.set(0, 0, -1);
		this.controllerDir.applyQuaternion(controller.quaternion);

		this.raycaster.set(controller.getWorldPosition(new Vector3()), this.controllerDir);
		// ヒットテストを行い、当たったplaneのうち最もrenderOrderが高いものを選択
		const planes = Object.values(this.vrPlaneDict);
		const intersects = this.raycaster.intersectObjects(planes);
		let target = null;
		for (let i = 0; i < intersects.length; ++i) {
			if (!target) {
				target = intersects[i].object;
			}
			if (target.renderOrder <= intersects[i].object.renderOrder) {
				target = intersects[i].object;
			}
		}

		if (target) {
			const index = planes.indexOf(target);
			if (index >= 0) {
				const id = Object.keys(this.vrPlaneDict)[index];
				if (this.selectedIDs[controllerIndex] !== id) {
					this.unselect(this.selectedIDs[controllerIndex], controllerIndex);
					// IDを保存
					this.selectedIDs[controllerIndex] = id;
					// コントローラ姿勢
					this.tempRay.set(controller.getWorldPosition(new Vector3()), this.controllerDir);
					// 選択中の枠を描画
					this.showFrame(id);

					const xy = this.calcPixelPosFromRay(this.tempRay);
					// コンテンツが選択されたことを通知
					if (xy) {
						this.preXY[controllerIndex] = xy;
						this.emit(VRGUI.EVENT_SELECT, null, id, xy.x, xy.y);
						this.currentSelectionControllerIndex = controllerIndex;
					}
				}
			}
		} else {
			if (this.selectedIDs[controllerIndex]) {
				this.unselect(this.selectedIDs[controllerIndex], controllerIndex);
			}
		}
	}

	tryPressButton(controllerIndex) {
		
		// メモ、強調表示ON/OFFボタンに対してヒットテストし, 最もrenderOrderが高いものを選択
		{
			const buttons = Object.values(this.vrMemoMarkOnOffDict);
			const intersectButtons = this.raycaster.intersectObjects(buttons);
			let button = null;
			for (let i = 0; i < intersectButtons.length; ++i) {
				if (!button) {
					button = intersectButtons[i].object;
				}
				if (button.renderOrder <= intersectButtons[i].object.renderOrder) {
					button = intersectButtons[i].object;
				}
			}
			if (button) {
				const index = buttons.indexOf(button);
				if (index >= 0) {
					const key = Object.keys(this.vrMemoMarkOnOffDict)[index];
					this.pressedButtons[controllerIndex] = key;
				}
			}
		}
	}

	unselect(id, controllerIndex) {
		if (id) {
			console.log('unselect', id);
			const otherIndex = (controllerIndex === 0) ? 1 : 0;
			if (this.selectedIDs[controllerIndex] === this.selectedIDs[otherIndex]) {
				this.selectedIDs[otherIndex] = null;
			}
			this.selectedIDs[controllerIndex] = null;
			this.hideFrame(id);
			// 選択中から選択解除になった場合のみ、選択解除イベントを送る
			this.emit(VRGUI.EVENT_UNSELECT, null, id);
		}
	}

	// 選択中のポインター移動によるコンテンツ移動
	move() {
		const isRight = (this.selectedIDs[0] !== null && this.isTrigerPressed[0] === true);
		const isLeft = (this.selectedIDs[1] !== null && this.isTrigerPressed[1] === true);
		const cindices = [isRight ? 0 : null, isLeft ? 1 : null];
		if (isRight && isLeft) {
			if (!this.stopUpdate && this.selectedIDs[0] === this.selectedIDs[1]) {
				const controllerIndex = this.currentSelectionControllerIndex === 1 ? 0 : 1;
				const controller = this.renderer.xr.getController(controllerIndex);
				this.controllerDir.set(0, 0, -1);
				this.controllerDir.applyQuaternion(controller.quaternion);
				this.tempRay.set(controller.getWorldPosition(new Vector3()), this.controllerDir);
				// リサイズ
				const id = this.selectedIDs[0];
				const xy = this.calcPixelPosFromRay(this.tempRay);
				if (xy
					&& this.preXY[controllerIndex]
					&& (this.preXY[controllerIndex].x !== xy.x || this.preXY[controllerIndex].y !== xy.y)) 
					{
						const mx = xy.x - this.preXY[controllerIndex].x;
						const my = xy.y - this.preXY[controllerIndex].y;
						this.emit(VRGUI.EVENT_SELECT_RESIZE, null, id, mx, my);
						this.preXY[controllerIndex] = xy;
					}
			}
		} else {
			// move
			for (let i = 0; i < cindices.length; ++i) {
				const controllerIndex = cindices[i];
				if (controllerIndex !== null) {
					const controller = this.renderer.xr.getController(controllerIndex);
					this.controllerDir.set(0, 0, -1);
					this.controllerDir.applyQuaternion(controller.quaternion);
					this.tempRay.set(controller.getWorldPosition(new Vector3()), this.controllerDir);
	
					const id = this.selectedIDs[controllerIndex];
					const xy = this.calcPixelPosFromRay(this.tempRay);
					if (xy
						 && this.preXY[controllerIndex]
						 && (this.preXY[controllerIndex].x !== xy.x || this.preXY[controllerIndex].y !== xy.y)) {
						this.emit(VRGUI.EVENT_SELECT_MOVE, null, id, xy.x, xy.y);
						this.preXY[controllerIndex] = xy;
					}
				}
			}
		}
	}

	showFrame(id) {
		if (this.vrLineDict.hasOwnProperty(id)) {
			this.vrLineDict[id].visible = true;
		} else {
			console.error('Not found frame:', id)
		}
		const markOnOffID = GetMarkOnOffID(id);
		if (this.vrMemoMarkOnOffDict[markOnOffID]) {
			this.vrMemoMarkOnOffDict[markOnOffID].visible = true;
		}
		const memoOnOffID = GetMemoOnOffID(id);
		if (this.vrMemoMarkOnOffDict[memoOnOffID]) {
			this.vrMemoMarkOnOffDict[memoOnOffID].visible = true;
		}
	}

	hideFrame(id) {
		if (this.vrLineDict.hasOwnProperty(id)) {
			this.vrLineDict[id].visible = false;
		} else {
			console.error('Not found frame:', id)
		}
		const markOnOffID = GetMarkOnOffID(id);
		if (this.vrMemoMarkOnOffDict[markOnOffID]) {
			this.vrMemoMarkOnOffDict[markOnOffID].visible = false;
		}
		const memoOnOffID = GetMemoOnOffID(id);
		if (this.vrMemoMarkOnOffDict[memoOnOffID]) {
			this.vrMemoMarkOnOffDict[memoOnOffID].visible = false;
		}
	}

	// 姿勢Rayから、ピクセル空間で位置割り出す
	calcPixelPosFromRay(ray) {
		// 仮想ディスプレイ情報
		const win = this.store.getWindowData();
		// xyを仮想ディスプレイ範囲内に制限して返す
		const clampToWindow = (xy) => {
			xy.x = Math.max(Number(win.posx), xy.x);
			xy.x = Math.min(Number(win.posx) + Number(win.width), xy.x);
			xy.y = Math.max(Number(win.posy), xy.y);
			xy.y = Math.min(Number(win.posy) + Number(win.height), xy.y);
			return xy;
		}
		let cover = null;
		if (this.isPlaneMode()) {
			cover = this.coverPlane;
		} else {
			cover = this.coverCylinder;
		}

		this.raycaster.set(ray.origin, ray.direction);
		const intersect = this.raycaster.intersectObject(cover);
		if (intersect.length >= 1) {
			const uv = intersect[0].uv;
			// 当たった点の(背景のcyliderの)UVを加工して、
			// 仮想ディスプレイに対するUV座標に変換する。
			// 背景のメッシュの高さ
			const ch = cover.geometry.parameters.height;
			// UVをオフセットさせる値を計算
			const offsetU = Number(win.posx) / this.width;
			const offsetV = -Number(win.posy) / this.height;
			const uScale = this.width / Number(win.width);
			const vScale = ch / win.height;

			uv.x *= uScale;
			uv.x += offsetU;
			uv.y += - ((ch - Number(win.height)) / 2) / ch;
			uv.y += offsetV;
			uv.y *= vScale;

			let xy = {
				x: Math.floor((Number(win.width) * uv.x)),
				y: Math.floor((Number(win.height) * (1.0 - uv.y))),
			}
			return clampToWindow(xy);
		}
		return null;
	}

	// 平面モードの矩形領域
	// 水平視野角114度、垂直視野角120度
	initCoverPlane() {
		const height = (-this.planeDepth) * Math.tan(60 * Math.PI / 180) * 2; // =4234.205916839362
		const geometry = new THREE.PlaneGeometry(this.width, height);
		geometry.translate(this.width / 2, -height / 2, 0);
		const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide, depthTest: false });
		this.coverPlane = new THREE.Mesh(geometry, material);
		this.setVRPlanePos(this.coverPlane, 0, 1080, -100000);
		// 4K中心に中心を合わせる
		this.coverPlane.position.y = height / 2
		this.scene.add(this.coverPlane);

		const texture = new THREE.TextureLoader().load("src/image/vr_background.png");
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		material.map = texture;
		material.needsUpdate = true;
	}

	// 曲面モードの矩形領域と一致するシリンダー
	// 水平視野角180度(にthis.widthピクセル割り当てる)、垂直視野角120度
	initCoverCylinder() {
		const radius = this.width / Math.PI;
		const height = radius * Math.tan(60 * Math.PI / 180) * 2; //= 4234.205916839362
		const radialSegments = 512;
		const heightSegments = 1;
		// thetaStartは+z方向を0として、Y軸に対して反時計回りで角度を指定する。と思われる。
		// xz平面を上から見たときに、+x → +z → -x となるような円弧を描く
		const thetaStart = 1.5 * Math.PI; // right start
		const thetaLength = Math.PI;
		const geometry = new THREE.CylinderGeometry(
			radius, radius, height, radialSegments, heightSegments, true,
			thetaStart, thetaLength);

		const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide, depthTest: false });
		this.coverCylinder = new THREE.Mesh(geometry, material);
		this.setVRPlanePos(this.coverCylinder, 0, 1080, -100000);
		// flip
		this.coverCylinder.scale.z *= -1;
		this.scene.add(this.coverCylinder);

		const texture = new THREE.TextureLoader().load("src/image/vr_background.png");
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		material.map = texture;
		material.needsUpdate = true;
	}

	createVRPlaneFrame(lineMaterial, lineWidth) {
		const lines = new THREE.Group();
		const geoTop = new THREE.PlaneGeometry(lineWidth, lineWidth);
		const geoLeft = new THREE.PlaneGeometry(lineWidth, lineWidth);
		const geoBottom = new THREE.PlaneGeometry(lineWidth, lineWidth);
		const geoRight = new THREE.PlaneGeometry(lineWidth, lineWidth);

		// 左上を原点とする
		geoTop.translate(lineWidth / 2, - lineWidth / 2, 0);
		geoLeft.translate(lineWidth / 2, - lineWidth / 2, 0);
		geoBottom.translate(lineWidth / 2, - lineWidth / 2, 0);
		geoRight.translate(lineWidth / 2, - lineWidth / 2, 0);

		const lineTop = new THREE.Mesh(geoTop, lineMaterial);
		const lineLeft = new THREE.Mesh(geoLeft, lineMaterial);
		const lineBottom = new THREE.Mesh(geoBottom, lineMaterial);
		const lineRight = new THREE.Mesh(geoRight, lineMaterial);

		lines.add(lineLeft);
		lines.add(lineRight);
		lines.add(lineTop);
		lines.add(lineBottom);
		lines.visible = false;
		return lines;
	}

	createVRCylinderFrame(w, h, lineMaterial, lineWidth) {
		const lines = new THREE.Group();
		const radius = this.width / Math.PI;
		const heightSegments = 1;

		// Left
		{
			// 高さ
			const height = h;
			const radialSegments = 2;
			const thetaStart = 1.5 * Math.PI; // right start
			const thetaLength = Math.PI * (lineWidth / this.width);
			const geometry = new THREE.CylinderGeometry(
				radius, radius, height, radialSegments, heightSegments, true,
				thetaStart, thetaLength);
			geometry.translate(0, -height / 2, 0);
			const cylinder = new THREE.Mesh(geometry, lineMaterial);
			cylinder.scale.z *= -1;
			lines.add(cylinder);
		}
		// Right
		{
			// 高さ
			const height = h;
			const radialSegments = 2;
			const thetaStart = 1.5 * Math.PI; // right start
			const thetaLength = Math.PI * (lineWidth / this.width);
			const geometry = new THREE.CylinderGeometry(
				radius, radius, height, radialSegments, heightSegments, true,
				thetaStart, thetaLength);
			geometry.translate(0, -height / 2, 0);
			const cylinder = new THREE.Mesh(geometry, lineMaterial);
			cylinder.scale.z *= -1;
			lines.add(cylinder);
		}
		// Top
		{
			// 高さ
			const height = lineWidth;
			const radialSegments = Math.max(2, Math.floor(32 * w / this.width));
			const thetaStart = 1.5 * Math.PI; // right start
			const thetaLength = Math.PI * (w / this.width);
			const geometry = new THREE.CylinderGeometry(
				radius, radius, height, radialSegments, heightSegments, true,
				thetaStart, thetaLength);
			geometry.translate(0, -height / 2, 0);
			const cylinder = new THREE.Mesh(geometry, lineMaterial);
			cylinder.scale.z *= -1;
			lines.add(cylinder);
		}
		// Bottom
		{
			// 高さ
			const height = lineWidth;
			const radialSegments = Math.max(2, Math.floor(32 * w / this.width));
			const thetaStart = 1.5 * Math.PI; // right start
			const thetaLength = Math.PI * (w / this.width);
			const geometry = new THREE.CylinderGeometry(
				radius, radius, height, radialSegments, heightSegments, true,
				thetaStart, thetaLength);
			geometry.translate(0, -height / 2, 0);
			const cylinder = new THREE.Mesh(geometry, lineMaterial);
			cylinder.scale.z *= -1;
			lines.add(cylinder);
		}
		return lines;
	}

	/**
	 * VRPlaneを追加
	 * @param {*} 
	 * {
	 *   metaData: metaData
	 * }
	 */
	addVRPlane(data, hasFrame = true, planeDict = this.vrPlaneDict) {
		const metaData = data.metaData;
		const w = Number(metaData.orgWidth);
		const h = Number(metaData.orgHeight);
		const lineWidth = this.lineWidth;
		const lineWidth2 = this.lineWidth * 2;
		const memoOnOffID = GetMemoOnOffID(metaData.id);
		const markOnOffID = GetMarkOnOffID(metaData.id);
		const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x04b431, side: THREE.DoubleSide, depthTest: false });
		const contentMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide, depthTest: false });
		if (this.isPlaneMode()) {
			// コンテンツ本体
			{
				const geometry = new THREE.PlaneGeometry(w, h);
				// 左上を原点とする
				geometry.translate(w / 2, -h / 2, 0);
				const plane = new THREE.Mesh(geometry, contentMaterial);
				this.setVRPlanePos(plane, Number(metaData.posx), Number(metaData.posy), Number(metaData.zIndex));
				planeDict[metaData.id] = plane;
				this.scene.add(plane);
			}

			// 選択時の枠線
			if (hasFrame) {
				const lines = this.createVRPlaneFrame(lineMaterial, lineWidth);
				this.setVRPlanePos(lines, Number(metaData.posx) - lineWidth, Number(metaData.posy) - lineWidth, Number(metaData.zIndex));
				const rect = Vscreen.transform(VscreenUtil.toIntRect(metaData));
				this.setVRPlaneWH(lines, metaData, parseInt(rect.w, 10), parseInt(rect.h, 10), lineWidth);
				this.vrLineDict[metaData.id] = lines;
				this.frontScene.add(lines);
			}

			// 選択時のメモマークOn/Off
			if (hasFrame) {
				const w = 30;
				const h = 30;
				{
					const buttonMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide, depthTest: false });
					const geometry = new THREE.PlaneGeometry(w, h);
					// 左上を原点とする
					geometry.translate(w / 2, -h / 2, 0);
					const markOnOff = new THREE.Mesh(geometry, buttonMaterial);
					markOnOff.visible = false;
					this.setVRPlanePos(markOnOff, Number(metaData.posx), Number(metaData.posy) - h - 10, Number(metaData.zIndex));
					this.vrMemoMarkOnOffDict[markOnOffID] = markOnOff;
					this.frontScene.add(markOnOff);
				}
				{
					const buttonMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide, depthTest: false });
					const geometry = new THREE.PlaneGeometry(w, h);
					// 左上を原点とする
					geometry.translate(w / 2, -h / 2, 0);
					const memoOnOff = new THREE.Mesh(geometry, buttonMaterial);
					memoOnOff.visible = false;
					this.setVRPlanePos(memoOnOff, Number(metaData.posx) + w + 5, Number(metaData.posy) - h - 10, Number(metaData.zIndex));
					this.vrMemoMarkOnOffDict[memoOnOffID] = memoOnOff;
					this.frontScene.add(memoOnOff);
				}
				this.updateOnOffButton(metaData);
			}
		} else {
			// metaDataの大きさのシリンダーを作る
			// 高さ: orgHで表現
			// 幅: this.widthの幅に当たる角度がπと考え、角度で表現。
			// シリンダーを外から見たときに正しいUVとなっているため、
			// シリンダーを作成後ｚ反転させる
			// つまり最初カメラから見て後ろ側にシリンダーを作成する。
			const radius = this.width / Math.PI;
			const heightSegments = 1;
			// コンテンツ本体
			{
				// 高さ
				const height = h;
				// セグメント数
				const radialSegments = Math.max(2, Math.floor(256 * w / this.width));
				// thetaStartは+z方向を0として、Y軸に対して反時計回りで角度を指定する。と思われる。
				// xz平面を上から見たときに、+x → +z → -x となるような円弧を描き
				// 円弧の大きさ(thetaLength)は、コンテンツの初期幅となるように設定する。
				const thetaStart = 1.5 * Math.PI; // right start
				// 幅
				const thetaLength = Math.PI * (w / this.width);
				const geometry = new THREE.CylinderGeometry(
					radius, radius, height, radialSegments, heightSegments, true,
					thetaStart, thetaLength);
				// 左上を原点とする
				geometry.translate(0, -h / 2, 0);

				// console.error(radius, radius, height, radialSegments, heightSegments, true, thetaStart, thetaLength)

				const cylinder = new THREE.Mesh(geometry, contentMaterial);

				// flip
				cylinder.scale.z *= -1;

				this.setVRPlanePos(cylinder, Number(metaData.posx), Number(metaData.posy), Number(metaData.zIndex));
				planeDict[metaData.id] = cylinder;
				this.scene.add(cylinder);
			}


			// 選択時の枠線
			if (hasFrame) {
				const lines = this.createVRCylinderFrame(w, 1, lineMaterial, lineWidth);
				// cylinderの枠線は、位置をlines Groupに設定し、幅高さによるトランスフォームを、childrenのmeshに設定することとする
				this.setVRPlanePos(lines, Number(metaData.posx) - lineWidth, Number(metaData.posy) - lineWidth, Number(metaData.zIndex));
				const rect = Vscreen.transform(VscreenUtil.toIntRect(metaData));
				this.setVRPlaneWH(lines, metaData, parseInt(rect.w, 10), parseInt(rect.h, 10), lineWidth2);
				lines.visible = false;
				this.vrLineDict[metaData.id] = lines;
				this.frontScene.add(lines);
			}
			
			// 選択時のメモマークOn/Off
			if (hasFrame) {
				const w = 30;
				const h = 30;
				const height = h;
				const radialSegments = 2;
				const thetaStart = 1.5 * Math.PI; // right start
				const thetaLength = Math.PI * (w / this.width);
				{
					const buttonMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide, depthTest: false });
					const geometry = new THREE.CylinderGeometry(
						radius, radius, height, radialSegments, heightSegments, true,
						thetaStart, thetaLength);
					// 左上を原点とする
					geometry.translate(0, -h / 2, 0);
					const markOnOff = new THREE.Mesh(geometry, buttonMaterial);
					markOnOff.visible = false;
					// flip
					markOnOff.scale.z *= -1;
					this.setVRPlanePos(markOnOff, Number(metaData.posx), Number(metaData.posy) - h - 10, Number(metaData.zIndex));
					this.vrMemoMarkOnOffDict[markOnOffID] = markOnOff;
					this.frontScene.add(markOnOff);
				}
				{
					const buttonMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide, depthTest: false });
					const geometry = new THREE.CylinderGeometry(
						radius, radius, height, radialSegments, heightSegments, true,
						thetaStart, thetaLength);
					// 左上を原点とする
					geometry.translate(0, -h / 2, 0);
					const memoOnOff = new THREE.Mesh(geometry, buttonMaterial);
					memoOnOff.visible = false;
					// flip
					memoOnOff.scale.z *= -1;
					this.setVRPlanePos(memoOnOff, Number(metaData.posx) + w + 5, Number(metaData.posy) - h - 10, Number(metaData.zIndex));
					this.vrMemoMarkOnOffDict[memoOnOffID] = memoOnOff;
					this.frontScene.add(memoOnOff);
				}
				this.updateOnOffButton(metaData);
			}
		}
	}
	
	/**
	 * VRPlaneを削除
	 * @param {*} data 
	 * {
	 *    id : id
	 * }
	 */
	deleteVRPlane(data) {
		const id = data.id;
		if (this.vrWebGLVideoHandleDict.hasOwnProperty(id)) {
			clearInterval(this.vrWebGLVideoHandleDict[id]);
			delete this.vrWebGLVideoHandleDict[id];
		}
		if (this.vrPlaneDict.hasOwnProperty(id)) {
			this.scene.remove(this.vrPlaneDict[id]);
			delete this.vrPlaneDict[id];
		}
		const memoBGID = GetMemoBGID(id);
		if (this.vrMemoDict.hasOwnProperty(memoBGID)) {
			this.scene.remove(this.vrMemoDict[memoBGID]);
			delete this.vrMemoDict[memoBGID];
		}
		const memoTextID = GetMemoTxtID(id);
		if (this.vrMemoDict.hasOwnProperty(memoTextID)) {
			this.scene.remove(this.vrMemoDict[memoTextID]);
			delete this.vrMemoDict[memoTextID];
		}
		if (this.vrLineDict.hasOwnProperty(id)) {
			this.frontScene.remove(this.vrLineDict[id]);
			delete this.vrLineDict[id];
		}
		if (this.vrMarkLineDict.hasOwnProperty(id)) {
			this.scene.remove(this.vrMarkLineDict[id]);
			delete this.vrMarkLineDict[id];
		}
		if (this.vrWebGLDict.hasOwnProperty(id)) {
			delete this.vrWebGLDict[id];
		}
		const memoOnOffID = GetMemoOnOffID(id);
		if (this.vrMemoMarkOnOffDict.hasOwnProperty(memoOnOffID)) {
			this.frontScene.remove(this.vrMemoMarkOnOffDict[memoOnOffID]);
			delete this.vrMemoMarkOnOffDict[memoOnOffID];
		}
		const markOnOffID = GetMarkOnOffID(id);
		if (this.vrMemoMarkOnOffDict.hasOwnProperty(markOnOffID)) {
			this.frontScene.remove(this.vrMemoMarkOnOffDict[markOnOffID]);
			delete this.vrMemoMarkOnOffDict[markOnOffID];
		}
	}

	/**
	 * VRPlaneに画像を設定
	 * @param {*} data 
	 * {
	 *   image : image,
	 *   metaData: metaData
	 * }
	 */
	setVRPlaneImage(data, planeDict = this.vrPlaneDict) {
		const metaData = data.metaData;
		const texture = new THREE.Texture(data.image);
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.needsUpdate = true;
		if (!planeDict.hasOwnProperty(metaData.id)) {
			console.error('not found plane for', metaData.id);
		}

		planeDict[metaData.id].material.map = texture;
		// planeDict[metaData.id].material.blending = THREE.NormalBlending;
		planeDict[metaData.id].material.alphaTest = 0.5;
		planeDict[metaData.id].material.needsUpdate = true;
	}

	/**
	 * VRPlaneに動画を設定
	 * @param {*} data 
	 * {
	 *   video : video,
	 *   metaData: metaData
	 * }
	 */
	setVRPlaneVideo(data, planeDict = this.vrPlaneDict) {
		const metaData = data.metaData;
		const video = data.video;
		const texture = new THREE.VideoTexture(video);
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.format = THREE.RGBFormat;
		texture.needsUpdate = true;
		if (!planeDict.hasOwnProperty(metaData.id)) {
			console.error('not found plane for', metaData.id);
		}

		planeDict[metaData.id].material.map = texture;
		// renderOrderを指定した場合に透過するかどうかにより大きく分けられてしまうため
		// 全てtransparentとしておき、renderOrderに完全に一致させる。
		// planeDict[metaData.id].material.alphaTest = 0.5;
		planeDict[metaData.id].material.needsUpdate = true;
	}

	/**
	 * VRPlaneの位置を設定
	 * @param {*} data 
	 * {
	 *   image : image,
	 *   metaData: metaData,
	 *   x : 2DのVirtualDisplay空間でのx座標
	 *   y : 2DのVirtualDisplay空間でのy座標
	 *   z : zIndex
	 * }
	 */
	setVRPlanePos(plane, x, y, z) {
		let zValue = z;
		if (this.isPlaneMode()) {
			plane.position.x = this.planeBaseX + x;
			plane.position.y = this.planeBaseY - y;
			plane.position.z = this.planeDepth;
			plane.renderOrder = zValue;
		} else {
			// x位置:
			// z反転前の状態で考えたとき、シリンダー表面上でのコンテンツx座標は、
			// xz平面で+x方向を0とし、+x → +z → -x回りの角度で表現することができる。
			// ただしz反転しているため、角度の指定は負となる
			plane.rotation.set(0, -Math.PI * (x / this.width), 0);
			// y位置: 座標で表現
			plane.position.y = this.planeBaseY - y;
			// z位置: 座標で表現
			plane.renderOrder = zValue;
		}
	}

	/**
	 * VRPlaneの幅高さを設定
	 * @param {*} data 
	 * {
	 *   image : image,
	 *   metaData: metaData,
	 *   w : 幅(pixel)
	 *   h : 高さ(pixel)
	 * }
	 */
	setVRPlaneWH(plane, metaData, w, h, lineWidth) {
		const orgW = Number(metaData.orgWidth);
		const orgH = Number(metaData.orgHeight);
		if (this.isPlaneMode()) {
			const scaleX = w / orgW;
			const scaleY = h / orgH;
			if (plane.hasOwnProperty('geometry')) {
				plane.scale.x = scaleX;
				plane.scale.y = scaleY;
			} else {
				// 枠線
				// Left
				const sw = (w + lineWidth) / lineWidth;
				const sh = (h + lineWidth) / lineWidth;
				{
					const line = plane.children[0];
					// 高さを反映
					line.scale.y = sh;
				}
				// Right
				{
					const line = plane.children[1];
					// 高さを反映
					line.scale.y = sh;
					// 幅を反映
					line.position.x = w;
				}
				// Top
				{
					const line = plane.children[2];
					// 幅を反映
					line.scale.x = sw;
				}
				// Bottom
				{
					const line = plane.children[3];
					// 幅を反映
					line.scale.x = sw;
					// 高さを反映
					line.position.y = -h;
				}
			}
		} else {
			if (plane.hasOwnProperty('geometry')) {
				const param = JSON.parse(JSON.stringify(plane.geometry.parameters));
				param.thetaLength = Math.PI * (w / this.width);
				param.height = h;
				param.radialSegments = Math.max(2, Math.floor(256 * Number(metaData.width) / this.width));

				const geometry = new THREE.CylinderGeometry(
					param.radiusTop, param.radiusBottom, param.height,
					param.radialSegments, param.heightSegments, param.openEnded,
					param.thetaStart, param.thetaLength);

				// 左上を原点とする
				geometry.translate(0, -h / 2, 0);

				plane.geometry = geometry;
				plane.needsUpdate = true;

			} else {
				// 枠線
				// Left
				{
					const cylinder = plane.children[0];
					// 高さを反映
					cylinder.scale.y = h;
				}
				// Right
				{
					const cylinder = plane.children[1];
					// 幅を反映
					cylinder.rotation.set(0, -Math.PI * (w / this.width), 0);
					// 高さを反映
					cylinder.scale.y = h;
				}
				// TOp
				{
					const cylinder = plane.children[2];
					// 幅を反映
					const param = JSON.parse(JSON.stringify(cylinder.geometry.parameters));
					param.thetaLength = Math.PI * (w / this.width);
					const geometry = new THREE.CylinderGeometry(
						param.radiusTop, param.radiusBottom, param.height,
						param.radialSegments, param.heightSegments, param.openEnded,
						param.thetaStart, param.thetaLength);
					geometry.translate(0, -param.height / 2, 0);
					cylinder.geometry = geometry;
					cylinder.needsUpdate = true;
				}
				// Bottom
				{
					const cylinder = plane.children[3];
					// 幅を反映
					const param = JSON.parse(JSON.stringify(cylinder.geometry.parameters));
					param.thetaLength = Math.PI * (w / this.width);
					const geometry = new THREE.CylinderGeometry(
						param.radiusTop, param.radiusBottom, param.height,
						param.radialSegments, param.heightSegments, param.openEnded,
						param.thetaStart, param.thetaLength);
					geometry.translate(0, -param.height / 2, 0);
					cylinder.geometry = geometry;
					cylinder.needsUpdate = true;
					// 高さを反映
					cylinder.position.y = -h;
				}
			}
		}
	}

	updateContentVisible(metaData) {
		const plane = this.getVRPlane(metaData.id);
		if (plane) {
			const isVisible = VscreenUtil.isVisible(metaData);
			plane.visible = isVisible;
			this.updateMarkVisible(isVisible, metaData);
		}
	}

	updateOnOffButton(metaData) {
		const memoOnOffID = GetMemoOnOffID(metaData.id);
		const markOnOffID = GetMarkOnOffID(metaData.id);
		const isMarkVisible = metaData.hasOwnProperty(Constants.MARK) && (metaData[Constants.MARK] === 'true' || metaData[Constants.MARK] === true);
		const isMemoVisible = metaData.hasOwnProperty(Constants.MARK_MEMO) && (metaData[Constants.MARK_MEMO] === 'true' || metaData[Constants.MARK_MEMO] === true);
		const markImage = isMarkVisible ? this.markOnImage : this.markOffImage;
		const memoImage = isMemoVisible ? this.memoOnImage : this.memoOffImage;
		if (this.vrMemoMarkOnOffDict.hasOwnProperty(markOnOffID)) {
			this.setVRPlaneImage({ image: markImage, metaData: {id : markOnOffID} }, this.vrMemoMarkOnOffDict);
		}
		if (this.vrMemoMarkOnOffDict.hasOwnProperty(memoOnOffID)) {
			this.setVRPlaneImage({ image: memoImage, metaData: {id : memoOnOffID} }, this.vrMemoMarkOnOffDict);
		}
	}

	assignVRMetaDataToPlane(metaData, rect, plane) {
		this.setVRPlanePos(plane, parseInt(rect.x, 10), parseInt(rect.y, 10), Number(metaData.zIndex));

		if (!(metaData.width < 10) && rect.w) {
			if (!(metaData.height < 10) && rect.h) {
				this.setVRPlaneWH(plane, metaData, parseInt(rect.w, 10), parseInt(rect.h, 10));
			}
		}
	}

	assignVRMetaDataToButton(metaData, rect, button, isMemoOnOff) {
		if (isMemoOnOff) {
			// memoOnOff
			this.setVRPlanePos(button, parseInt(rect.x, 10) + 35, parseInt(rect.y, 10) - 40, Number(metaData.zIndex));
		} else {
			// markOnOff
			this.setVRPlanePos(button, parseInt(rect.x, 10), parseInt(rect.y, 10) - 40, Number(metaData.zIndex));
		}
	}

	assignVRMetaDataToLines(metaData, rect, lines, lineWidth) {
		if (lines) {
			this.setVRPlanePos(lines,
				parseInt(rect.x, 10) - lineWidth,
				parseInt(rect.y, 10) - lineWidth,
				Number(metaData.zIndex));
		}
		if (!(metaData.width < 10) && rect.w) {
			if (!(metaData.height < 10) && rect.h) {
				// 枠線の更新
				if (lines) {
					this.setVRPlaneWH(lines, metaData, parseInt(rect.w, 10), parseInt(rect.h, 10), lineWidth);
				}
			}
		}
	}

	/**
	 * メタデータの位置、幅高さなどをVR用プリミティブに設定
	 * @param {*} 
	 * {
	 *   plane : plane, // VR用Plane Mesh
	 *   metaData : metaData,
	 *   useOrg : useOrg,
	 * }
	 */
	assignVRMetaData(data) {
		this.stopUpdate = true;
		const metaData = data.metaData;
		const useOrg = data.useOrg;
		const groupDict = this.store.getGroupDict();
		const plane = this.getVRPlane(metaData.id);

		if (!plane) {
			this.stopUpdate = false;
			return;
		}
		let rect;
		if (useOrg) {
			rect = Vscreen.transformOrg(VscreenUtil.toIntRect(metaData));
		} else {
			rect = Vscreen.transform(VscreenUtil.toIntRect(metaData));
		}
		if (plane && metaData) {
			// VscreenUtil.assignRect(elem, rect, (metaData.width < 10), (metaData.height < 10));
			// VscreenUtil.assignZIndex(elem, metaData);
			this.assignVRMetaDataToPlane(metaData, rect, plane);

			// 枠線の更新
			const lines = this.vrLineDict[metaData.id];
			this.assignVRMetaDataToLines(metaData, rect, lines, this.lineWidth);

			// 強調表示用の枠線の更新
			if (this.vrMarkLineDict.hasOwnProperty(metaData.id)) {
				const markLines = this.vrMarkLineDict[metaData.id];
				this.assignVRMetaDataToLines(metaData, rect, markLines, this.lineWidth * 2);
			}

			// メモの更新
			const memoID = GetMemoID(metaData.id);
			const memoBGID = GetMemoBGID(metaData.id);
			const memoTextID = GetMemoTxtID(metaData.id);
			const memoElem = document.getElementById(memoID);
			if (memoElem && metaData.user_data_text) {
				const memoBGPlane = this.vrMemoDict[memoBGID];
				const memoTextPlane = this.vrMemoDict[memoTextID];
				const elemRect = memoElem.getBoundingClientRect();
				// 背景色planeは幅高さも変える
				if (memoBGPlane) {
					const memoRect = {
						x: rect.x - this.lineWidth * 2,
						y: rect.y + rect.h,
						w: rect.w + this.lineWidth,
						h: elemRect.bottom - elemRect.top
					}
					this.assignVRMetaDataToMemo(metaData, memoRect, memoBGPlane);
				}
				if (memoTextPlane) {
					const memoTextRect = {
						x: rect.x - this.lineWidth * 2,
						y: rect.y + rect.h
					}
					// メモ用(text)planeは、位置のみ変更
					this.assignVRMetaDataToMemo(metaData, memoTextRect, memoTextPlane);
				}
			}

			// ONOffボタンの更新
			const markOnOffID = GetMarkOnOffID(metaData.id);
			if (this.vrMemoMarkOnOffDict.hasOwnProperty(markOnOffID)) {
				const markOnOffButton = this.vrMemoMarkOnOffDict[markOnOffID];
				this.assignVRMetaDataToButton(metaData, rect, markOnOffButton, false);
			}
			const memoOnOffID = GetMemoOnOffID(metaData.id);
			if (this.vrMemoMarkOnOffDict.hasOwnProperty(memoOnOffID)) {
				const memoOnOffButton = this.vrMemoMarkOnOffDict[memoOnOffID];
				this.assignVRMetaDataToButton(metaData, rect, memoOnOffButton, true);
			}

			this.updateContentVisible(metaData);

			/* TODO
			if (Validator.isTextType(metaData)) {
				VscreenUtil.resizeText(elem, rect);
			} else if (metaData.type === "video") {
				VscreenUtil.resizeVideo(elem, rect);
			} else if (metaData.type === "tileimage") {
				VscreenUtil.resizeTileImages(elem, metaData);
			}
			
			if (VscreenUtil.isVisible(metaData)) {
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
			*/
		}
		this.stopUpdate = false;
	}

	/**
	 * 動画をVRで表示. 動画ストリーム自体は別途アサインする.
	 * この関数では動画用の枠(Plane)だけ設定する
	 * @param {*} data 
	 * {
	 *   metaData: metaData,
	 * }
	 */
	showVideoVR(metaData) {
		this.addVRPlane({ metaData: metaData });
		this.assignVRMetaData({ metaData: metaData, useOrg: false });
	}

	/**
	 * WebGLをVRで表示. 
	 * @param {*} data 
	 * { 
	 *   iframe : webgl canvasを含む, iframe
	 *   metaData: metaData,
	 * }
	 */
	showWebGLVR(iframe, metaData) {
		const canvasList = iframe.contentDocument.getElementsByTagName('canvas');
		if (canvasList.length > 0) {
			const id = metaData.id; 
			let canvas = canvasList[0];
			let size = 0;
			for (let i = 0; i < canvasList.length; ++i) {
				const canvasSize = Number(canvasList[i].width) * Number(canvasList[i].height);
				if (size < canvasSize) {
					size = canvasSize;
					canvas = canvasList[i];
				}
			}

			const stream = canvas.captureStream(10);
			const video = document.createElement('video');
			video.muted = true;
			video.autoplay = true;
			video.loop = true;
			let isInit = false;
			video.addEventListener('canplay', () => {
				if (video.paused) {
					video.play();
					if (!this.vrWebGLDict.hasOwnProperty(metaData.id)) {
						this.vrWebGLDict[metaData.id] = canvas;
						this.setVRPlaneVideo({ metaData: metaData, video: video });
						isInit = true;
					}
				}
			});
			this.vrWebGLVideoHandleDict[metaData.id] = setInterval(() => {
				this.resolveIFrames(id, this.timestamp)
			}, 100);
			setTimeout(() => {
				if (!isInit) {
					if (video.paused) {
						video.play();
						if (!this.vrWebGLDict.hasOwnProperty(metaData.id)) {
							this.vrWebGLDict[metaData.id] = canvas;
							this.setVRPlaneVideo({ metaData: metaData, video: video });
							isInit = true;
						}
					}
				}
			}, 1000);
			this.addVRPlane({ metaData: metaData });
			this.assignVRMetaData({ metaData: metaData, useOrg: false });
			video.load();
			video.srcObject = stream;
		}
	}

	/**
	 * テキストをVRで表示. 
	 * html2canvasによりレンダリングした画像をVR Planeとして表示する.
	 * @param {*} data 
	 * { 
	 *   elem : 通常のdisplayで、テキストを表示させたエレメント
	 *   metaData: metaData,
	 * }
	 */
	showTextVR(elem, metaData) {
		const plane = this.getVRPlane(metaData.id)
		if (!plane) {
			this.addVRPlane({ metaData: metaData });
		}

		const rect = Vscreen.transform(VscreenUtil.toIntRect(metaData));
		const previewArea = document.getElementById("preview_area");
		previewArea.style.visibility = "visible"
		if (elem.style.fontSize) {
			const fontSize = Number(elem.style.fontSize.split("px").join(""));
			elem.style.fontSize = fontSize * Math.sqrt(window.devicePixelRatio) + "px";
		}
		try {
			const preBorder = elem.style.border;
			elem.style.border = "none"
			html2canvas(elem, {
				backgroundColor: null,
				width: rect.w * window.devicePixelRatio,
				height: rect.h * window.devicePixelRatio
			}).then(canvas => {
				previewArea.style.visibility = "hidden"
				elem.style.border = preBorder;
				canvas.toBlob((blob) => {
					const image = new Image();
					image.onload = () => {
						URL.revokeObjectURL(image.src);
						// Planeの画像を追加
						this.setVRPlaneImage({ image: image, metaData: metaData });
						this.assignVRMetaData({ metaData: metaData, useOrg: false });
					};
					image.src = URL.createObjectURL(blob);
				});
			});
		} catch (ex) {
			previewArea.style.visibility = "hidden"
		}
	}

	/**
	 * メモ用テキストをVRで表示. (コントローラのiボタン有効時)
	 * html2canvasによりレンダリングした画像をVR Planeとして表示する.
	 * @param {*} data 
	 * { 
	 *   memoElem : 通常のdisplayで、メモ用テキストを表示させたエレメント
	 *   metaData: metaData,
	 * }
	 */
	showMemoVR(memoElem, metaData, color, isTextChanged) {
		// メモ用ID(内部でのみ使用)
		const memoBGID = GetMemoBGID(metaData.id);
		const memoTextID = GetMemoTxtID(metaData.id);
		let textPlane = this.getVRPlane(memoTextID, this.vrMemoDict)
		let bgPlane = this.getVRPlane(memoBGID, this.vrMemoDict)
		
		if (!textPlane) {
			// 背景色用plane
			let memoMetaData = JSON.parse(JSON.stringify(metaData));
			memoMetaData.id = memoBGID;
			this.addVRPlane({ metaData: memoMetaData }, false, this.vrMemoDict);
			bgPlane = this.getVRPlane(memoBGID, this.vrMemoDict);
			bgPlane.material.color.setStyle(color);
			// bgPlane.material.transparent = true;

			// メモ用plane
			let memoTextMetaData = JSON.parse(JSON.stringify(metaData));
			memoTextMetaData.id = memoTextID;
			this.addVRPlane({ metaData: memoTextMetaData }, false, this.vrMemoDict);
			textPlane = this.getVRPlane(memoTextID, this.vrMemoDict);
			// textPlane.material.transparent = true;
			
		}

		// VRでは解像度の都合上、メモのfontSizeに2emを強制させる
		memoElem.style.fontSize = "2em"
		const elemRect = memoElem.getBoundingClientRect();
		const w = elemRect.right - elemRect.left;
		const h = elemRect.bottom - elemRect.top;
		
		// レンダリング前に枠のサイズを決定しておく
		const rect = Vscreen.transform(VscreenUtil.toIntRect(metaData));
		const memoRect = {
			x: rect.x,
			y: rect.y + rect.h,
			w: w,
			h: h
		}
		
		if (isTextChanged) {
			this.assignVRMetaDataToMemo(metaData, memoRect, bgPlane);
			this.assignVRMetaDataToMemo(metaData, memoRect, textPlane);
			
			const previewArea = document.getElementById("preview_area");
			previewArea.style.visibility = "visible"
			const preBackgroundCol = memoElem.style.backgroundColor;
			// 文字画像については背景を透過させておく必要がある
			memoElem.style.background = "transparent"
			
			html2canvas(memoElem, {
				backgroundColor: null,
				width: w * window.devicePixelRatio,
				height: h * window.devicePixelRatio
			}).then(canvas => {
				previewArea.style.visibility = "hidden"
				memoElem.style.background = preBackgroundCol;
				canvas.toBlob((blob) => {
					const image = new Image();
					image.onload = () => {
						URL.revokeObjectURL(image.src);
						// textPlaneの画像を追加
						this.setVRPlaneImage({ image: image, metaData: { id: memoTextID } }, this.vrMemoDict);
					}
					image.src = window.URL.createObjectURL(blob);
				});
			});
		}
	}

	updateMemoVisible(memoElem, metaData, isMemoVisible) {
		// メモ用ID(内部でのみ使用)
		const memoBGID = GetMemoBGID(metaData.id);
		let plane = this.getVRPlane(memoBGID, this.vrMemoDict);
		if (plane) {
			plane.visible = isMemoVisible;
		}
		const memoTextID = GetMemoTxtID(metaData.id);
		let textPlane = this.getVRPlane(memoTextID, this.vrMemoDict);
		if (textPlane) {
			if (textPlane.visible !== isMemoVisible) {
				this.updateOnOffButton(metaData);
				textPlane.visible = isMemoVisible;
			}
		}
	}

	assignVRMetaDataToMemo(metaData, rect, memoPlane) {
		this.setVRPlanePos(memoPlane, parseInt(rect.x, 10), parseInt(rect.y, 10), Number(metaData.zIndex));
		if (rect.w && rect.h) {
			this.setVRPlaneWH(memoPlane, metaData, parseInt(rect.w, 10), parseInt(rect.h, 10));
		}
	}

	/**
	 * コンテンツ強調表示(コントローラの☆ボタン有効時)
	 */
	showMark(metaData, color = null) {
		const hasMark = this.vrMarkLineDict.hasOwnProperty(metaData.id);
		if (!hasMark) {
			// ジオメトリを節約するために、
			//　強調表示用の枠線は、必要になったタイミングで追加する
			const w = Number(metaData.orgWidth);
			const h = Number(metaData.orgHeight);
			const lineWidth2 = this.lineWidth * 2;
			const markMaterial = new THREE.MeshBasicMaterial({ color: 0x04b431, side: THREE.DoubleSide, depthTest: false });
			if (this.isPlaneMode()) {
				// 強調表示(Mark)用の枠線
				{
					const lines = this.createVRPlaneFrame(markMaterial, lineWidth2);
					this.setVRPlanePos(lines, Number(metaData.posx) - lineWidth2, Number(metaData.posy) - lineWidth2, Number(metaData.zIndex));
					this.vrMarkLineDict[metaData.id] = lines;
					this.scene.add(lines);
				}
			} else {
				// 強調表示(Mark)用の枠線
				{
					const lines = this.createVRCylinderFrame(w, 1, markMaterial, lineWidth2);
					this.setVRPlanePos(lines, Number(metaData.posx) - lineWidth2, Number(metaData.posy) - lineWidth2, Number(metaData.zIndex));
					this.vrMarkLineDict[metaData.id] = lines;
					this.scene.add(lines);
				}
			}
			this.assignVRMetaData({ metaData: metaData, useOrg: false });
		}
		const markLines = this.vrMarkLineDict[metaData.id];
		if (color) {
			for (let i = 0; i < markLines.children.length; ++i) {
				const child = markLines.children[i];
				child.material.color.setStyle(color);
			}
		}
		if (markLines.visible !== true) {
			this.updateOnOffButton(metaData);
			markLines.visible = true;
		}
	}

	/**
	 * コンテンツ強調表示の表示状態の更新
	 */
	updateMarkVisible(isMarkVisible, metaData, color = null) {
		this.showMark(metaData, color);
		if (this.vrMarkLineDict.hasOwnProperty(metaData.id)) {
			const markLines = this.vrMarkLineDict[metaData.id];
			if (markLines.visible !== isMarkVisible) {
				this.updateOnOffButton(metaData);
				markLines.visible = isMarkVisible;
			}
		}
	}

	/**
	 * PDFをVRで表示. 
	 * @param {*} data 
	 * { 
	 *   canvas : PDFをレンダリング済のcanvas
	 *   metaData: metaData,
	 * }
	 */
	showPDFVR(canvas, metaData) {
		const plane = this.getVRPlane(metaData.id)
		if (!plane) {
			this.addVRPlane({ metaData: metaData });
		}
		canvas.toBlob((blob) => {
			const image = new Image();
			image.onload = () => {
				URL.revokeObjectURL(image.src);
				this.setVRPlaneImage({ image: image, metaData: metaData });
				this.assignVRMetaData({ metaData: metaData, useOrg: false });
			}
			image.src = URL.createObjectURL(blob);
		});
	}

	/**
	 * 指定したIDのVRPlaneを取得
	 */
	getVRPlane(id, planeDict = this.vrPlaneDict ) {
		if (!planeDict.hasOwnProperty(id)) {
			return null;
		}
		return planeDict[id];
	}

	getScene() {
		return this.scene;
	}

	getFrontScene() {
		return this.frontScene;
	}

	getWidth() {
		return this.width;
	}

	getHeight() {
		return this.height;
	}
}

VRGUI.EVENT_SELECT = 'select';
VRGUI.EVENT_UNSELECT = 'unselect';
VRGUI.EVENT_SELECT_MOVE = 'select_move';
VRGUI.EVENT_SELECT_RESIZE = 'select_resize';

export default VRGUI;