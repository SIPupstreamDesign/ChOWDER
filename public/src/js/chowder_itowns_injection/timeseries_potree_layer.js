

function checkResponse(response) {
	if (!response.ok) {
		let error = new Error(`Error loading ${response.url}: status ${response.status}`);
		error.response = response;
		throw error;
	}
}

function fetchText(url, options = {}) {
	return fetch(url, options).then((response) => {
		checkResponse(response);
		return response.text();
	});
}

function createTimescalePotreeSource(config) {
	const potreeSource = new itowns.FileSource({
		url: config.url + config.file,
		crs: "EPSG:4978",
		// コンストラクタでfetcherが使用され、結果がfetchedDataに入る.
		fetcher: (url, options = {}) => {
			return fetchText(url, options).then((text) => {
				return text;
			});
		},
		// 後ほど, parserが使用され、返り値はFileSourceがcacheする
		parser: (buffer, options = {}) => {
			let data = JSON.parse(buffer);

			let layers = [];
			for (let timeStr in data) {
				const url = data[timeStr];
				let splits = url.split('/');
				let file = splits[splits.length - 1];
				let serverUrl = url.split(file).join('');
				let childConfig = JSON.parse(JSON.stringify(config));
				childConfig.id = config.id + "_" + timeStr;
				childConfig.url = serverUrl
				childConfig.file = file;

				const childLayer = new itowns.PotreeLayer(childConfig.id, {
					source: new itowns.PotreeSource(childConfig)
				});
				childLayer.isChildLayer = true;

				// UTC時刻のUnixTime文字列で初期化されたDateを作成する
				const local = new Date(timeStr)
				const offset = -1 * local.getTimezoneOffset() / 60
				const utcDate = new Date(local.getTime() + (offset * 3600000))
				childLayer.date = utcDate;

				layers.push({
					time: timeStr,
					layer: childLayer
				});
			}
			const sortLayers = [...layers].sort((a, b) => a.time > b.time);
			return Promise.resolve({
				layers: sortLayers,
				json: buffer
			});
		}
	});
	return potreeSource;
}


function CreateTimescalePotreeLayer(itownsView, config) {
	class TimescalePotreeLayer extends itowns.Layer {
		constructor(itownsView, config) {
			const potreeSource = createTimescalePotreeSource(config);
			super(config.id, {
				source: potreeSource
			});
			this.config = config;
			this.itownsView = itownsView;
			this.source = potreeSource;
			this.isTimeseriesPotree = true;
			this.tempExtent = new itowns.Extent('EPSG:4978', 0, 0, 0);

			this.updateParams_ = this.updateParams.bind(this);

			this.attachedLayers = [];
			this.bboxes = {
				visible: false
			}
			this.visible = true;
			this.object3d = new itowns.THREE.Group();
			this.root = new itowns.THREE.Group();

			this.defineLayerProperty('visible', this.visible, this.updateParams_);
			this.defineLayerProperty('bboxes', this.bboxes, this.updateParams_);
			this.defineLayerProperty('opacity', this.opacity || 1.0, this.updateParams_);
			this.defineLayerProperty('pointSize', this.pointSize || 4, this.updateParams_);
			this.defineLayerProperty('sseThreshold', this.sseThreshold || 2, this.updateParams_);
		}

		update(context, layer, node) { }

		preUpdate(context, changeSources) { }

		postUpdate() { }

		convert() { }

		delete() {
			this.source.loadData(this.tempExtent, this).then((data) => {
				for (let i = 0; i < data.layers.length; ++i) {
					data.layers[i].layer.delete();
				}
			});
		}

		updateParams() {
			this.source.loadData(this.tempExtent, this).then((data) => {
				this.updateVisibility();
				this.updateTransform();
				for (let i = 0; i < data.layers.length; ++i) {
					data.layers[i].layer.pointSize = this.pointSize;
					data.layers[i].layer.sseThreshold = this.sseThreshold;
					data.layers[i].layer.opacity = this.opacity;
					this.itownsView.notifyChange(data.layers[i].layer);
				}
			});
		}

		updateTransform() {
			this.source.loadData(this.tempExtent, this).then((data) => {
				for (let i = 0; i < data.layers.length; ++i) {
					const targetLayer = data.layers[i].layer;
					const target = targetLayer.object3d;

					target.matrixAutoUpdate = false;
					const position = this.object3d.position;
					const quaternion = this.object3d.quaternion;
					target.position.copy(position);
					target.quaternion.copy(quaternion);
					target.updateMatrix();
					target.updateMatrixWorld();
					target.matrixAutoUpdate = true;

					// PointCloudLayer.jsでLoDの指標として使用される、
					// point.copy(context.camera.camera3D.position).sub(this.object3d.position);
					// について、this.object3d.positionを、いじって
					// uvwによる移動前の位置にカメラをオフセットさせた状態にする
					if (targetLayer.hasOwnProperty('root') &&
						targetLayer.root.hasOwnProperty('bbox')) {
						const min = targetLayer.root.bbox.min;
						const minOrg = new itowns.THREE.Vector3(min.x, min.y, min.z);
						const cameraOffset = new itowns.THREE.Vector3(min.x, min.y, min.z);
						cameraOffset.add(position);
						if (target.hasOwnProperty('initial_position')) {
							cameraOffset.sub(target.initial_position);
						}
						cameraOffset.applyQuaternion(quaternion);
						cameraOffset.sub(minOrg);
						target.position.set(cameraOffset.x, cameraOffset.y, cameraOffset.z);
					}
				}
			});
		}

		updateVisibility() {
			this.source.loadData(this.tempExtent, this).then((data) => {
				let visibleLayer = null;
				if (this.currentDate) {
					for (let i = data.layers.length - 1; i >= 0; --i) {
						// console.log("date", utcDate, this.currentDate);
						if (data.layers[i].layer.date <= this.currentDate) {
							visibleLayer = data.layers[i].layer;
							break;
						}
					}
				}

				// 現在時刻がレンジ範囲外なら非表示
				if (this.range) {
					if (this.currentDate < this.range.rangeStartTime
						|| this.currentDate > this.range.rangeEndTime) {
						visibleLayer = null;
					}
				}

				// 対象レイヤー以外非表示
				for (let i = 0; i < data.layers.length; ++i) {
					data.layers[i].layer.visible = false;
					data.layers[i].layer.bboxes.visible = false;

					// uvwオフセットの指標として使用する,this.rootは,
					// 最初のレイヤーのrootとする
					if (i === 0) {
						this.root = data.layers[i].layer.root;
					}
				}

				if (this.visible && visibleLayer) {
					let isExisted = false;
					let layers = this.itownsView.getLayers();
					for (let i = 0; i < layers.length; ++i) {
						if (layers[i].id === visibleLayer.id) {
							isExisted = true;
							break;
						}
					}
					if (!isExisted) {
						itowns.View.prototype.addLayer.call(this.itownsView, visibleLayer);
					}
					visibleLayer.visible = true;
					visibleLayer.bboxes.visible = this.bboxes.visible;
				}
			});
		}

		updateByTime(currentDate = null, range = null) {
			this.currentDate = currentDate;
			this.range = range;
			this.updateVisibility();
		}
	}

	return new TimescalePotreeLayer(itownsView, config);
}

// 実行時にPreset側で読みこんだitowns.jsを使いたいため
// この時点でitownsのクラスを露出せず、生成関数をエクスポートする
export default CreateTimescalePotreeLayer;