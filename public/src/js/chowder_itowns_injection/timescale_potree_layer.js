

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
				layers.push({
					time: timeStr,
					layer: childLayer
				});
			}
			const sortLayers = [...layers].sort((a, b) => a.time > b.time);
			return Promise.resolve({
				layers: sortLayers
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
			this.isTimescalePotree = true;
			this.tempExtent = new itowns.Extent('EPSG:4978', 0, 0, 0);
		}

		update(context, layer, node) {
		}

		preUpdate(context, changeSources) {
		}

		convert() { }

		updateVisibility() {
			this.source.loadData(this.tempExtent, this).then((data) => {
				let visibleLayer = null;
				for (let i = data.layers.length - 1; i >= 0; --i) {
					// UTC時刻のUnixTime文字列で初期化されたDateを作成する
					const local  = new Date(data.layers[i].time)
					const offset = -1 * local.getTimezoneOffset() / 60
					const utcDate = new Date(local.getTime() + (offset * 3600000))
					
					// console.log("date", utcDate, this.currentDate);
					if (utcDate <= this.currentDate) {
						visibleLayer = data.layers[i].layer;
						break;
					}
				}

				// 対象レイヤー以外非表示
				for (let i = 0; i < data.layers.length; ++i) {
					data.layers[i].layer.visible = false;
				}
				
				if (visibleLayer)
				{
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
				}
			});
		}

		updateByTime(currentDate = null) {
			this.currentDate = currentDate;
			this.updateVisibility();
		}
	}

	return new TimescalePotreeLayer(itownsView, config);
}

// 実行時にPreset側で読みこんだitowns.jsを使いたいため
// この時点でitownsのクラスを露出せず、生成関数をエクスポートする
export default CreateTimescalePotreeLayer;