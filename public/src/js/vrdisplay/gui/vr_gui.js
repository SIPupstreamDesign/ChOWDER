
/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Vscreen from '../../common/vscreen.js';
import VscreenUtil from '../../common/vscreen_util.js';
import { VRButton } from '../../../../../node_modules/three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from '../../../../../node_modules/three/examples/jsm/webxr/XRControllerModelFactory.js';
import Store from '../store/store'
import VideoStore from '../store/video_store'

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
		// 枠線の幅
		this.lineWidth = 2;

		this.vrWebGLDict = {};

		this.vrWebGLVideoHandleDict = {};

		// 右手、左手コントローラで選択中のコンテンツIDリスト
		this.selectedIDs = [null, null]; // [右, 左]
		// 最初の1回のトリガーを検知するためのフラグ
		this.isInitialTriger = [true, true]

		// テンポラリRay
		this.tempRay = new THREE.Ray();

		// 平面モードかどうか
		const query = new URLSearchParams(location.search);
		if (query.get('mode') && query.get('mode') === 'plane') {
			this.isPlaneMode = true;
		} else {
			this.isPlaneMode = false;
		}

		if (this.isPlaneMode) {
			this.initCoverPlane();
		} else {
			this.initCoverCylinder();
		}
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

		// 仮想ディスプレイの解像度
		const width = this.getWidth();
		const height = this.getHeight();

		// canvas解像度は、仮想ディスプレイの解像度とする
		this.renderer.setSize(width, height);
		// VRボタンを設置
		document.body.appendChild(VRButton.createButton(this.renderer));

		this.camera = new THREE.PerspectiveCamera(
			93, width / height, 1, 10000);

		this.renderer.autoClear = false;

		// レンダリング
		const render = (timestamp) => {
			this.timestamp = timestamp;
			this.resolveInputs();
			this.renderer.clear();
			this.renderer.render(this.getScene(), this.camera);
			this.renderer.clearDepth();
			this.renderer.render(this.getFrontScene(), this.camera);
		};
		this.renderer.setAnimationLoop(render);
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
		this.frontScene.add(controller1);

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
		this.frontScene.add(controller2);

		const controllerModelFactory = new XRControllerModelFactory();

		// 右手コントローラの3Dオブジェクト
		const grip1 = this.renderer.xr.getControllerGrip(0);
		grip1.add(controllerModelFactory.createControllerModel(grip1));
		this.frontScene.add(grip1);

		// 左手コントローラの3Dオブジェクト
		const grip2 = this.renderer.xr.getControllerGrip(1);
		grip2.add(controllerModelFactory.createControllerModel(grip2));
		this.frontScene.add(grip2);

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

		for (const source of this.currentSession.inputSources) {
			if (!source.gamepad) continue;
			const gamepad = source.gamepad;

			//トリガー（人さし指）押下
			const trigerPressed = gamepad.buttons[0].pressed;
			const isLeft = source.handedness === 'left';
			const controllerIndex = isLeft ? 1 : 0;

			if (trigerPressed) {
				if (this.isInitialTriger[controllerIndex]) {
					this.isInitialTriger[controllerIndex] = false;
					this.select(source);
				}
			} else {
				this.unselect(source);
				this.isInitialTriger[controllerIndex] = true;
			}
		}

		this.move();
	}

	resolveIFrames(id, timestamp) {
		const funcDict = this.store.getITownFuncDict();
		if (funcDict.hasOwnProperty(id)) {
			funcDict[id].chowder_itowns_step_force(timestamp, function (){});
		}
	}

	// VRコントローラの選択イベント（トリガーを引くやつ）
	select(source) {
		const isLeft = source.handedness === 'left';
		const controllerIndex = isLeft ? 1 : 0;

		// コントローラの向きを計算
		const controller = this.renderer.xr.getController(controllerIndex);
		this.controllerDir.set(0, 0, -1);
		this.controllerDir.applyQuaternion(controller.quaternion);

		this.raycaster.set(controller.position, this.controllerDir);
		const intersects = this.raycaster.intersectObjects(this.scene.children);
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
			const objs = Object.values(this.vrPlaneDict);
			const index = objs.indexOf(target);
			if (index >= 0) {
				const id = Object.keys(this.vrPlaneDict)[index];
				if (this.selectedIDs[controllerIndex] !== id) {
					console.log('selected: ', id);
					// IDを保存
					this.selectedIDs[controllerIndex] = id;
					// コントローラ姿勢
					this.tempRay.set(controller.position, this.controllerDir);
					// 選択中の枠を描画
					this.showFrame(id);

					const xy = this.calcPixelPosFromRay(this.tempRay);
					// コンテンツが選択されたことを通知
					if (xy) {
						this.preXY = xy;
						this.emit(VRGUI.EVENT_SELECT, null, id, xy.x, xy.y);
					}
				}
			}
		}
	}

	unselect(source) {
		const isLeft = source.handedness === 'left';
		const controllerIndex = isLeft ? 1 : 0;
		if (this.selectedIDs[controllerIndex]) {
			const id = this.selectedIDs[controllerIndex];
			console.log('unselect', id);
			this.selectedIDs[controllerIndex] = null;
			this.hideFrame(id);
			// 選択中から選択解除になった場合のみ、選択解除イベントを送る
			this.emit(VRGUI.EVENT_UNSELECT, null, id);
		}
	}

	// 選択中のポインター移動によるコンテンツ移動
	move() {
		const isRight = (this.selectedIDs[0] !== null);
		const isLeft = (this.selectedIDs[1] !== null);
		const cindices = [isRight ? 0 : null, isLeft ? 1 : null];
		for (let i = 0; i < cindices.length; ++i) {
			const controllerIndex = cindices[i];
			if (controllerIndex !== null) {
				const controller = this.renderer.xr.getController(controllerIndex);
				this.controllerDir.set(0, 0, -1);
				this.controllerDir.applyQuaternion(controller.quaternion);
				this.tempRay.set(controller.position, this.controllerDir);

				const id = this.selectedIDs[controllerIndex];
				const xy = this.calcPixelPosFromRay(this.tempRay);
				if (xy && this.preXY && (this.preXY.x !== xy.x || this.preXY.y !== xy.y)) {
					this.emit(VRGUI.EVENT_SELECT_MOVE, null, id, xy.x, xy.y);
					this.preXY = xy;
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
	}

	hideFrame(id) {
		if (this.vrLineDict.hasOwnProperty(id)) {
			this.vrLineDict[id].visible = false;
		} else {
			console.error('Not found frame:', id)
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
		if (this.isPlaneMode) {
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
		const material = new THREE.MeshBasicMaterial({ color: 0xFF00FF, side: THREE.DoubleSide, depthTest:false  });
		this.coverPlane = new THREE.Mesh(geometry, material);
		this.setVRPlanePos(this.coverPlane, 0, 0, -100000);
		// 4K中心に中心を合わせる
		this.coverPlane.position.y = height / 2
		this.scene.add(this.coverPlane);

		const texture = new THREE.TextureLoader().load("src/image/cylinder_grid.png");
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

		const material = new THREE.MeshBasicMaterial({ color: 0xFF00FF, side: THREE.DoubleSide, depthTest:false  });
		this.coverCylinder = new THREE.Mesh(geometry, material);
		this.setVRPlanePos(this.coverCylinder, 0, 0, -100000);
		// flip
		this.coverCylinder.scale.z *= -1;
		this.scene.add(this.coverCylinder);

		const texture = new THREE.TextureLoader().load("src/image/cylinder_grid.png");
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		material.map = texture;
		material.needsUpdate = true;
	}

	/**
	 * VRPlaneを追加
	 * @param {*} 
	 * {
	 *   metaData: metaData
	 * }
	 */
	addVRPlane(data) {
		const metaData = data.metaData;
		const w = Number(metaData.orgWidth);
		const h = Number(metaData.orgHeight);
		const lineWidth = this.lineWidth;
		const lineWidth2 = this.lineWidth * 2;
		const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x04b431, side: THREE.DoubleSide, depthTest:false });
		const contentMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide, depthTest:false });
		if (this.isPlaneMode) {
			// コンテンツ本体
			{
				const geometry = new THREE.PlaneGeometry(w, h);
				// 左上を原点とする
				geometry.translate(w / 2, -h / 2, 0);
				const plane = new THREE.Mesh(geometry, contentMaterial);
				this.setVRPlanePos(plane, Number(metaData.posx), Number(metaData.posy), Number(metaData.zIndex));
				this.vrPlaneDict[metaData.id] = plane;
				this.scene.add(plane);
			}

			// 選択時の枠線
			{
				const lines = new THREE.Group();
				const geoTop = new THREE.PlaneGeometry(w + lineWidth, lineWidth);
				const geoLeft = new THREE.PlaneGeometry(lineWidth, h + lineWidth);
				const geoBottom = new THREE.PlaneGeometry(w + lineWidth, lineWidth);
				const geoRight = new THREE.PlaneGeometry(lineWidth, h + lineWidth);

				// 左上を原点とする
				geoTop.translate((w + lineWidth) / 2, - lineWidth / 2, 0);
				geoLeft.translate(lineWidth / 2, - (h + lineWidth) / 2, 0);
				geoBottom.translate((w + lineWidth) / 2, - lineWidth / 2 - h, 0);
				geoRight.translate(lineWidth / 2 + w, - (h + lineWidth) / 2, 0);

				const lineTop = new THREE.Mesh(geoTop, lineMaterial);
				const lineLeft = new THREE.Mesh(geoLeft, lineMaterial);
				const lineBottom = new THREE.Mesh(geoBottom, lineMaterial);
				const lineRight = new THREE.Mesh(geoRight, lineMaterial);

				lines.add(lineTop);
				lines.add(lineBottom);
				lines.add(lineLeft);
				lines.add(lineRight);
				lines.visible = false;

				this.setVRPlanePos(lines, Number(metaData.posx) - lineWidth, Number(metaData.posy) - lineWidth, Number(metaData.zIndex));
				this.vrLineDict[metaData.id] = lines;
				this.frontScene.add(lines);
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
				this.vrPlaneDict[metaData.id] = cylinder;
				this.scene.add(cylinder);
			}


			// 選択時の枠線
			{
				const lines = new THREE.Group();

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
				// cylinderの枠線は、位置をlines Groupに設定し、幅高さによるトランスフォームを、childrenのmeshに設定することとする
				this.setVRPlanePos(lines, Number(metaData.posx) - lineWidth, Number(metaData.posy) - lineWidth, Number(metaData.zIndex));
				const rect = Vscreen.transform(VscreenUtil.toIntRect(metaData));
				this.setVRPlaneWH(lines, metaData, parseInt(rect.w, 10) + lineWidth2, parseInt(rect.h, 10) + lineWidth2);
				lines.visible = false;
				this.vrLineDict[metaData.id] = lines;
				this.frontScene.add(lines);
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
		if (this.vrLineDict.hasOwnProperty(id)) {
			delete this.vrLineDict[id];
		}
		if (this.vrWebGLDict.hasOwnProperty(id)) {
			delete this.vrWebGLDict[id];
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
	setVRPlaneImage(data) {
		const metaData = data.metaData;
		const texture = new THREE.Texture(data.image);
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.needsUpdate = true;
		if (!this.vrPlaneDict.hasOwnProperty(metaData.id)) {
			console.error('not found plane for', metaData.id);
		}

		this.vrPlaneDict[metaData.id].material.map = texture;
		// this.vrPlaneDict[metaData.id].material.blending = THREE.NormalBlending;
		this.vrPlaneDict[metaData.id].material.transparent = true;
		this.vrPlaneDict[metaData.id].material.alphaTest = 0.5;
		this.vrPlaneDict[metaData.id].material.needsUpdate = true;
	}

	/**
	 * VRPlaneに動画を設定
	 * @param {*} data 
	 * {
	 *   video : video,
	 *   metaData: metaData
	 * }
	 */
	setVRPlaneVideo(data) {
		const metaData = data.metaData;
		const video = data.video;
		const texture = new THREE.VideoTexture(video);
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.format = THREE.RGBFormat;
		texture.needsUpdate = true;
		if (!this.vrPlaneDict.hasOwnProperty(metaData.id)) {
			console.error('not found plane for', metaData.id);
		}

		this.vrPlaneDict[metaData.id].material.map = texture;
		// renderOrderを指定した場合に透過するかどうかにより大きく分けられてしまうため
		// 全てtransparentとしておき、renderOrderに完全に一致させる。
		this.vrPlaneDict[metaData.id].material.transparent = true;
		this.vrPlaneDict[metaData.id].material.needsUpdate = true;
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
		if (this.isPlaneMode) {
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
	setVRPlaneWH(plane, metaData, w, h) {
		const orgW = Number(metaData.orgWidth);
		const orgH = Number(metaData.orgHeight);
		if (this.isPlaneMode) {
			const scaleX = w / orgW;
			const scaleY = h / orgH;
			plane.scale.x = scaleX;
			plane.scale.y = scaleY;
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
					const scaleY = h / orgH;
					cylinder.scale.y = scaleY;
				}
				// Right
				{
					const cylinder = plane.children[1];
					// 幅を反映
					cylinder.rotation.set(0, -Math.PI * (w / this.width), 0);
					// 高さを反映
					const scaleY = h / orgH;
					cylinder.scale.y = scaleY;
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

	updateVisible(metaData) {
		const plane = this.getVRPlane(metaData.id);
		if (plane) {
			plane.visible = VscreenUtil.isVisible(metaData);
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
		const metaData = data.metaData;
		const useOrg = data.useOrg;
		const groupDict = this.store.getGroupDict();
		const plane = this.getVRPlane(metaData.id);

		if (!plane) return;
		let rect;
		if (useOrg) {
			rect = Vscreen.transformOrg(VscreenUtil.toIntRect(metaData));
		} else {
			rect = Vscreen.transform(VscreenUtil.toIntRect(metaData));
		}
		if (plane && metaData) {
			// VscreenUtil.assignRect(elem, rect, (metaData.width < 10), (metaData.height < 10));
			// VscreenUtil.assignZIndex(elem, metaData);
			this.setVRPlanePos(plane, parseInt(rect.x, 10), parseInt(rect.y, 10), Number(metaData.zIndex));

			const lines = this.vrLineDict[metaData.id];
			// 枠線の更新
			if (lines) {
				this.setVRPlanePos(lines,
					parseInt(rect.x, 10) - this.lineWidth,
					parseInt(rect.y, 10) - this.lineWidth,
					Number(metaData.zIndex));
			}
			if (!(metaData.width < 10) && rect.w) {
				if (!(metaData.height < 10) && rect.h) {
					this.setVRPlaneWH(plane, metaData, parseInt(rect.w, 10), parseInt(rect.h, 10));

					// 枠線の更新
					if (lines) {
						this.setVRPlaneWH(lines, metaData, parseInt(rect.w, 10) + this.lineWidth, parseInt(rect.h, 10) + this.lineWidth);
					}
				}
			}

			this.updateVisible(metaData);

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
		this.assignVRMetaData({ metaData : metaData, useOrg : false});
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
			video.load();
			video.srcObject = stream;
			this.vrWebGLVideoHandleDict[metaData.id] = setInterval(() => {
				this.resolveIFrames(metaData.id, this.timestamp)
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
			this.assignVRMetaData({ metaData : metaData, useOrg : false});
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
			this.addVRPlane({ metaData : metaData });
		}
		
		const rect = Vscreen.transform(VscreenUtil.toIntRect(metaData));
		const previewArea = document.getElementById("preview_area");
		previewArea.style.visibility = "visible"
		if (elem.style.fontSize) {
			const fontSize = Number(elem.style.fontSize.split("px").join(""));
			elem.style.fontSize = fontSize * Math.sqrt(window.devicePixelRatio) + "px";
		}
		html2canvas(elem, {backgroundColor : null, 
				width : rect.w * window.devicePixelRatio,
				height : rect.h * window.devicePixelRatio }).then(canvas => {
			previewArea.style.visibility = "hidden"
			canvas.toBlob((blob) => {
				const image = new Image();
				image.onload =  () => {
					URL.revokeObjectURL(image.src);
					// Planeの画像を追加
					this.setVRPlaneImage({ image: image, metaData : metaData });
					this.assignVRMetaData({ metaData : metaData, useOrg : false});
				}
				image.src = URL.createObjectURL(blob);
			});
		});
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
			image.onload =  () => {
				URL.revokeObjectURL(image.src);
				this.setVRPlaneImage({ image: image, metaData : metaData });
				this.assignVRMetaData({ metaData : metaData, useOrg : false});
			}
			image.src = URL.createObjectURL(blob);
		});
	}

	/**
	 * 指定したIDのVRPlaneを取得
	 */
	getVRPlane(id) {
		if (!this.vrPlaneDict.hasOwnProperty(id)) {
			return null;
		}
		return this.vrPlaneDict[id];
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

export default VRGUI;