import C3DTileUtil from "./c3dtile_util";


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

function createTimescaleC3DTilesSource(itownsView, config) {
	const c3dtilesSource = new itowns.FileSource({
		url: config.source.url,
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
				let childConfig = JSON.parse(JSON.stringify(config));
				childConfig.id = config.id + "_" + timeStr;
				childConfig.url = url;

				const childLayer = new itowns.C3DTilesLayer(childConfig.id, {
					name: childConfig.id,
					source: new itowns.C3DTilesSource(childConfig),
					overrideMaterials: false
				}, itownsView);
				childLayer.isChildLayer = true;

				// UTC時刻のUnixTime文字列で初期化されたDateを作成する
				const local = new Date(timeStr)
				const offset = -1 * local.getTimezoneOffset() / 60
				const utcDate = new Date(local.getTime() + (offset * 3600000))
				childLayer.date = utcDate;
	
				// EPSGによる座標変換の設定
				C3DTileUtil.applyConvertSetting(childLayer, config);
				
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
	return c3dtilesSource;
}


function CreateTimescaleC3DTilesLayer(itownsView, config) {
	class Timescale3DTilesLayer extends itowns.Layer {
		constructor(itownsView, config) {
			const c3dtilesSource = createTimescaleC3DTilesSource(itownsView, config);
			super(config.id, {
				source: c3dtilesSource
			});
			this.config = config;
			this.itownsView = itownsView;
			this.source = c3dtilesSource;
			this.isTimeseriesC3DTiles = true;
			this.tempExtent = new itowns.Extent('EPSG:4978', 0, 0, 0);

			this.updateParams_ = this.updateParams.bind(this);

			this.attachedLayers = [];
			this.visible = true;
			this.object3d = new itowns.THREE.Group();
			this.root = new itowns.THREE.Group();
			this.wireframe = false;

			this.defineLayerProperty('scale', 1.0, this.updateParams_);
			this.defineLayerProperty('visible', this.visible, this.updateParams_);
			this.defineLayerProperty('wireframe', this.wireframe, this.updateParams_);
			this.defineLayerProperty('opacity', this.opacity || 1.0, this.updateParams_);
			this.defineLayerProperty('sseThreshold', this.sseThreshold || 2, this.updateParams_);
			
			if (config.hasOwnProperty('conversion')) {
				this.defineLayerProperty('conversion', config.conversion, () => {
					// not implemented
				});
			}
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
					let layer = data.layers[i].layer;
					const scaleValue = this.scale;
					layer.object3d.scale.set(scaleValue, scaleValue, scaleValue);
					layer.object3d.updateMatrixWorld();

					layer.sseThreshold = this.sseThreshold;
					layer.opacity = this.opacity;
					layer.wireframe = this.wireframe;
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
					
					this.root = visibleLayer.root;
				}
			});
		}

		updateByTime(currentDate = null, range = null) {
			this.currentDate = currentDate;
			this.range = range;
			this.updateVisibility();
		}
	}


	const layer = new Timescale3DTilesLayer(itownsView, config);	
	return layer;
}

// 実行時にPreset側で読みこんだitowns.jsを使いたいため
// この時点でitownsのクラスを露出せず、生成関数をエクスポートする
export default CreateTimescaleC3DTilesLayer;