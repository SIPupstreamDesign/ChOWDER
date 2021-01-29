

import Vscreen from '../../common/vscreen.js';
import VscreenUtil from '../../common/vscreen_util.js';
import { VRButton } from '../../../../3rd/js/three/VRButton.js';

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

		// シーン作成
		const urls = [
			'src/image/room/posx.jpg',
			'src/image/room/negx.jpg',
			'src/image/room/posy.jpg',
			'src/image/room/negy.jpg',
			'src/image/room/posz.jpg',
			'src/image/room/negz.jpg'
		]
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.CubeTextureLoader().load(urls);

		this.vrPlaneDict = {};

		
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

	initVR(renderer) {
		/*
		const sessionInit = { optionalFeatures: [ 'local-floor', 'bounded-floor', 'hand-tracking' ] };
		navigator.xr.requestSession( 'immersive-vr', sessionInit ).then( (session) => {
			renderer.xr.setSession(session);

		});
		*/
	}

	/**
	 * 
	 * @param {*} windowSize デバイス解像度。1056 x 479 in OculusQuest2
	 */
	initVRPreviewArea(windowSize) {
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
			93, windowSize.width / windowSize.height, 1, 10000);

		// レンダリング
		const render = (timestamp) => {
			this.renderer.render(this.getScene(), this.camera);
		};
		this.renderer.setAnimationLoop(render);

		this.initVR(this.renderer);
	}

	// 平面モードの矩形領域
	// 水平視野角114度、垂直視野角120度
	initCoverPlane() {
		const height = (-this.planeDepth) * Math.tan(60 * Math.PI / 180) * 2; // =4234.205916839362
		const geometry = new THREE.PlaneGeometry(this.width, height);
		geometry.translate(this.width / 2, -height / 2, 0);
		const material = new THREE.MeshBasicMaterial({ color: 0xFF00FF, side: THREE.DoubleSide });
		const plane = new THREE.Mesh(geometry, material);
		this.setVRPlanePos(plane, 0, 0, -10);
		// 4K中心に中心を合わせる
		plane.position.y = height / 2
		this.scene.add(plane);
		
		const texture = new THREE.TextureLoader().load("src/image/cylinder_grid.png");
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

		const material = new THREE.MeshBasicMaterial({ color: 0xFF00FF, side: THREE.DoubleSide });
		const cylinder = new THREE.Mesh(geometry, material);
		// flip
		cylinder.scale.z *= -1;
		cylinder.position.z = -1;
		this.scene.add(cylinder);

		const texture = new THREE.TextureLoader().load("src/image/cylinder_grid.png");
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
		if (this.isPlaneMode) {
			const geometry = new THREE.PlaneGeometry(Number(metaData.orgWidth), Number(metaData.orgHeight));
			// 左上を原点とする
			geometry.translate(Number(metaData.orgWidth) / 2, -Number(metaData.orgHeight) / 2, 0);
			const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
			const plane = new THREE.Mesh(geometry, material);
			this.setVRPlanePos(plane, Number(metaData.posx), Number(metaData.posy), Number(metaData.zIndex));
			this.vrPlaneDict[metaData.id] = plane;
			this.scene.add(plane);
		} else {
			// metaDataの大きさのシリンダーを作る
			// 高さ: orgHで表現
			// 幅: this.widthの幅に当たる角度がπと考え、角度で表現。
			// シリンダーを外から見たときに正しいUVとなっているため、
			// シリンダーを作成後ｚ反転させる
			// つまり最初カメラから見て後ろ側にシリンダーを作成する。
			const radius = this.width / Math.PI;
			const height = Number(metaData.orgHeight);
			const radialSegments = Math.max(2, Math.floor(512 * Number(metaData.orgWidth) / this.width));
			const heightSegments = 1;
			// thetaStartは+z方向を0として、Y軸に対して反時計回りで角度を指定する。と思われる。
			// xz平面を上から見たときに、+x → +z → -x となるような円弧を描き
			// 円弧の大きさ(thetaLength)は、コンテンツの初期幅となるように設定する。
			const thetaStart = 1.5 * Math.PI; // right start
			const thetaLength = Math.PI * (Number(metaData.orgWidth) / this.width);
			const geometry = new THREE.CylinderGeometry(
				radius, radius, height, radialSegments, heightSegments, true,
				thetaStart, thetaLength);
			// 左上を原点とする
			geometry.translate(0, -Number(metaData.orgHeight) / 2, 0);

			// console.error(radius, radius, height, radialSegments, heightSegments, true, thetaStart, thetaLength)

			const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
			const cylinder = new THREE.Mesh(geometry, material);
			// flip
			cylinder.scale.z *= -1;

			this.setVRPlanePos(cylinder, Number(metaData.posx), Number(metaData.posy), Number(metaData.zIndex));
			this.vrPlaneDict[metaData.id] = cylinder;
			this.scene.add(cylinder);
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
		if (this.vrPlaneDict.hasOwnProperty(id)) {
			this.scene.remove(this.vrPlaneDict[id]);
			delete this.vrPlaneDict[id];
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
		texture.needsUpdate = true;
		if (!this.vrPlaneDict.hasOwnProperty(metaData.id)) {
			console.error('not found plane for', metaData.id);
		}

		this.vrPlaneDict[metaData.id].material.map = texture;
		this.vrPlaneDict[metaData.id].material.needsUpdate = true;
	}

	setVRPlanePos(plane, x, y, z = null) {
		if (this.isPlaneMode) {
			plane.position.x = this.planeBaseX + x;
			plane.position.y = this.planeBaseY - y;
			if (z) {
				plane.position.z = this.planeDepth + z * 0.1;
			}
		} else {
			// x位置:
			// z反転前の状態で考えたとき、シリンダー表面上でのコンテンツx座標は、
			// xz平面で+x方向を0とし、+x → +z → -x回りの角度で表現することができる。
			// ただしz反転しているため、角度の指定は負となる
			plane.rotation.set(0, -Math.PI * (x / this.width), 0);
			// y位置: 座標で表現
			plane.position.y = this.planeBaseY - y;
			// z位置: 座標で表現
			plane.position.z = z * 0.1;
		}
	}

	setVRPlaneWH(plane, metaData, w, h) {
		if (this.isPlaneMode) {
			const orgW = Number(metaData.orgWidth);
			const orgH = Number(metaData.orgHeight);
			const scaleX = w / orgW;
			const scaleY = h / orgH;
			plane.scale.x = scaleX;
			plane.scale.y = scaleY;
		} else {
			const param = JSON.parse(JSON.stringify(plane.geometry.parameters));
			param.thetaLength = Math.PI * (Number(metaData.width) / this.width);
			param.height = Number(metaData.height);
			param.radialSegments = Math.max(2, Math.floor(512 * Number(metaData.width) / this.width));
			
			const geometry = new THREE.CylinderGeometry(
				param.radiusTop, param.radiusBottom, param.height, 
				param.radialSegments, param.heightSegments, param.openEnded,
				param.thetaStart, param.thetaLength);
				
			// 左上を原点とする
			geometry.translate(0, -Number(metaData.height) / 2, 0);

			plane.geometry = geometry;
			plane.needsUpdate = true;
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
			if (!(metaData.width < 10) && rect.w) {
				if (!(metaData.height < 10) && rect.h) {
					this.setVRPlaneWH(plane, metaData, parseInt(rect.w, 10), parseInt(rect.h, 10));
				}
			}

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
	 * 指定したIDのVRPlaneを取得
	 */
	getVRPlane(id) {
		return this.vrPlaneDict[id];
	}

	getScene() {
		return this.scene;
	}

	getWidth() {
		return this.width;
	}

	getHeight() {
		return this.height;
	}
}

export default VRGUI;