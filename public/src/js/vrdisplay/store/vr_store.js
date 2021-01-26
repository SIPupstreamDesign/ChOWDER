/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Command from '../../common/command';
import Store from './store';
import Action from '../action';
import Vscreen from '../../common/vscreen'
import VscreenUtil from '../../common/vscreen_util'

class VRStore {
	constructor(connector, store, action) {
		this.connector = connector;
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

		this.initEvents();

		this.isPlaneMode = false;

		if (this.isPlaneMode) {
			this.initCoverPlane();
		} else {
			this.initCoverCylinder();
		}
	}

	initEvents() {
		for (let i in Action) {
			if (i.indexOf('EVENT') >= 0) {
				this.action.on(Action[i], ((method) => {
					return (err, data) => {
						if (this[method]) {
							this[method](data);
						}
					};
				})('_' + Action[i]));
			}
		}
	}

	release() {
	}

	// 平面モードの矩形領域
	// 水平視野角114度、垂直視野角120度
	initCoverPlane() {
		const height = (-this.planeDepth) * Math.tan(60 * Math.PI / 180) * 2; // =4234.205916839362
		const geometry = new THREE.PlaneGeometry(this.width, height);
		geometry.translate(this.width / 2, -height / 2, 0);
		const material = new THREE.MeshBasicMaterial({ color: 0xFF00FF, side: THREE.DoubleSide });
		const plane = new THREE.Mesh(geometry, material);
		this._setVRPlanePos(plane, 0, 0, -10);
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
		const thetaStart = 1.5 * Math.PI; // right start
		const thetaLength = Math.PI;
		const geometry = new THREE.CylinderGeometry(
			radius, radius, height, radialSegments, heightSegments, true,
			thetaStart, thetaLength);

		const material = new THREE.MeshBasicMaterial({ color: 0xFF00FF, side: THREE.DoubleSide });
		const cylinder = new THREE.Mesh(geometry, material);
		// flip
		cylinder.scale.z *= -1;
		this.scene.add(cylinder);

		const texture = new THREE.TextureLoader().load("src/image/cylinder_grid.png");
		material.map = texture;
		material.needsUpdate = true;
	}

	_addVRPlane(data) {
		const metaData = data.metaData;
		const geometry = new THREE.PlaneGeometry(Number(metaData.orgWidth), Number(metaData.orgHeight));
		geometry.translate(Number(metaData.orgWidth) / 2, -Number(metaData.orgHeight) / 2, 0);
		const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
		const plane = new THREE.Mesh(geometry, material);
		this._setVRPlanePos(plane, Number(metaData.posx), Number(metaData.posy), Number(metaData.zIndex));
		this.vrPlaneDict[metaData.id] = plane;
		this.scene.add(plane);
	}

	_setVRPlaneImage(data) {
		const metaData = data.metaData;
		const texture = new THREE.Texture(data.image);
		texture.needsUpdate = true;
		if (!this.vrPlaneDict.hasOwnProperty(metaData.id)) {
			console.error('not found plane for', metaData.id);
		}

		this.vrPlaneDict[metaData.id].material.map = texture;
		this.vrPlaneDict[metaData.id].material.needsUpdate = true;
	}

	_setVRPlanePos(plane, x, y, z = null) {
		plane.position.x = this.planeBaseX + x;
		plane.position.y = this.planeBaseY - y;
		if (z) {
			plane.position.z = this.planeDepth + z;
		}
	}

	_setVRPlaneWH(plane, metaData, w, h) {
		const orgW = Number(metaData.orgWidth);
		const orgH = Number(metaData.orgHeight);
		const scaleX = w / orgW;
		const scaleY = h / orgH;
		plane.scale.x = scaleX;
		plane.scale.y = scaleY;
	}

	_assignVRMetaData(data) {
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
			this._setVRPlanePos(plane, parseInt(rect.x, 10), parseInt(rect.y, 10), Number(metaData.zIndex));
			if (!(metaData.width < 10) && rect.w) {
				if (!(metaData.height < 10) && rect.h) {
					this._setVRPlaneWH(plane, metaData, parseInt(rect.w, 10), parseInt(rect.h, 10));
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

export default VRStore;