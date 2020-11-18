/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
import * as THREE from 'three';
import { OBJLoader2 } from 'three/examples/jsm/loaders/OBJLoader2.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { MtlObjBridge } from 'three/examples/jsm/loaders/obj2/bridge/MtlObjBridge.js';
import Encoding from '../../../3rd/js/encoding-japanese/encoding.min.js'

const OBJInitialScale = 10000;

function initializeOBJTransform(object) {
	for (let i = 0; i < object.children.length; ++i) {
		object.children[i].rotation.z = 90 * Math.PI / 180;
		object.children[i].rotation.y = 90 * Math.PI / 180;
		object.children[i].geometry.scale(OBJInitialScale, OBJInitialScale, OBJInitialScale);
	}
}

function initializeOBJMaterial(object) {
	const material = new THREE.MeshBasicMaterial({ color: 0x6699FF })
	for (var i = 0; i < object.children.length; ++i) {
		object.children[i].material = material;
	}
}

/**
 * 汎用csvパーサーを,fileSourceに設定する.
 * @param {*} fileSource 
 */
function createOBJSource(config) {
	function checkResponse(response) {
		if (!response.ok) {
			let error = new Error(`Error loading ${response.url}: status ${response.status}`);
			error.response = response;
			throw error;
		}
	}
	const arrayBuffer = (url, options = {}) => fetch(url, options).then((response) => {
		checkResponse(response);
		return response.arrayBuffer();
	});
	const objSource = new itowns.FileSource({
		url: config.url,
		mtlurl: config.mtlurl ? config.mtlurl : null,
		crs: 'EPSG:4978',
		// コンストラクタでfetcherが使用され、結果がfetchedDataに入る.
		fetcher: (url, options = {}) => {
			return arrayBuffer(url, options).then((buffer) => {
				return buffer;
			});
		},
		// 後ほど, parserが使用され、返り値はFileSourceがcacheする
		parser: (buffer, options = {}) => {
			let data = new Uint8Array(buffer);
			let converted = Encoding.convert(data, {
				to: 'UNICODE',
				from: 'AUTO'
			});
			let str = Encoding.codeToString(converted);
			const manager = new itowns.THREE.LoadingManager();

			if (config.mtlurl) {
				const mtlLoader = new MTLLoader(manager);
				let splits = config.mtlurl.split('/');
				let file = splits[splits.length - 1];
				let basePath = config.mtlurl.split(file).join('');
				mtlLoader.setPath(basePath);

				return new Promise((resolve, reject) => {
					mtlLoader.load(file, function (materials) {
						resolve(materials);
					})
				}).then(materials => {
					const objLoader = new OBJLoader2(manager);
					objLoader.setLogging(true, true);
					objLoader.addMaterials(MtlObjBridge.addMaterialsFromMtlLoader(materials));
					const object = objLoader.parse(str);
					initializeOBJTransform(object);

					return Promise.resolve({
						meshGroup: object
					});
				}).catch(e => {
					console.error("Failed to load MTL");
					const objLoader = new OBJLoader2(manager);
					const object = objLoader.parse(str);
					initializeOBJTransform(object);
					initializeOBJMaterial(object);

					return Promise.resolve({
						meshGroup: object
					});
				});
			}
			else {
				const objLoader = new OBJLoader2(manager);
				const object = objLoader.parse(str);
				initializeOBJTransform(object);
				initializeOBJMaterial(object);

				return Promise.resolve({
					meshGroup: object
				});
			}
		}
	});
	return objSource;
}

function CreateOBJLayer(itownsView, config) {
	class OBJLayer extends itowns.GeometryLayer {
		constructor() {
			const group = new itowns.THREE.Group();
			const objSource = createOBJSource(config);
			objSource.mtlurl = config.mtlurl;

			super(config.id, group, {
				source: objSource
			});

			this.source = objSource;
			this.group = group;
			this.isOBJ = true;
			this.OBJExtent = new itowns.Extent('EPSG:4978', 0, 0, 0);

			this.updateOBJ = this.updateOBJ.bind(this);

			this.defineLayerProperty('scale', this.scale || 1.0, () => {
				if (group.children.length > 0) {
					this.updateOBJ();
				}
			});
		}

		update(context, layer, node) { }

		preUpdate(context, changeSources) {
			this.source.loadData(this.OBJExtent, this).then((data) => {
				if (!data) {
					console.error("Not found obj datasource");
				}
				if (!this.group.getObjectById(data.meshGroup.id)) {
					console.log("add mesh group", data);
					this.group.add(data.meshGroup);
					// wireframeやopacityの変更に対応するにはこれが必要
					for (let i = 0; i < data.meshGroup.children.length; ++i) {
						data.meshGroup.children[i].layer = this;
					}
					this.updateOBJ();
				}
			});
		};

		convert() { }

		updateOBJ() {
			this.source.loadData(this.OBJExtent, this).then((data) => {
				const scaleValue = this.scale;
				for (let i = 0; i < data.meshGroup.children.length; ++i) {
					data.meshGroup.children[i].scale.set(scaleValue, scaleValue, scaleValue);
					data.meshGroup.children[i].updateMatrixWorld();
				}
			});
		}
	}
	return new OBJLayer(itownsView, config);
}


// 実行時にPreset側で読みこんだitowns.jsを使いたいため
// この時点でitownsのクラスを露出せず、生成関数をエクスポートする
export default CreateOBJLayer;