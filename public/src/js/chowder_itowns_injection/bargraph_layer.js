/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
import Papaparse from '../../../3rd/js/papaparse/papaparse.min.js'
import Encoding from '../../../3rd/js/encoding-japanese/encoding.min.js'
import Rainbow from '../../../3rd/js/rainbowvis.js'

/**
 * 汎用csvパーサーを,fileSourceに設定する.
 * @param {*} fileSource 
 */
function createCSVBargraphSource(itownsView, config) {
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
	const csvSource = new itowns.FileSource({
		url: config.url,
		crs: 'EPSG:4326',
		// コンストラクタでfetcherが使用され、結果がfetchedDataに入る.
		fetcher: (url, options = {}) => {
			return arrayBuffer(url, options).then((buffer) => {
				return buffer;
			});
		},
		// 後ほど（タイミングはよくわからない）, parserが使用され、返り値はFileSourceがcacheする
		parser: (buffer, options = {}) => {
			let data = new Uint8Array(buffer);
			let converted = Encoding.convert(data, {
				to: 'UNICODE',
				from: 'AUTO'
			});
			let str = Encoding.codeToString(converted);
			let parsed = Papaparse.parse(str);

			// 初回パース時にジオメトリを生成しておく
			let group = new itowns.THREE.Group();

			for (let i = 1; i < parsed.data.length; ++i) {
				if (parsed.data[i].length !== parsed.data[0].length) continue;
				// const material = new itowns.THREE.({ color: 0x5555ff });
				let material = new itowns.THREE.MeshToonMaterial({ color: 0x5555ff });
				if (itownsView.isPlanarView) {
					material = new itowns.THREE.MeshBasicMaterial({ color: 0x5555ff });
				}
				material.opacity = 1.0;
				const geo = new itowns.THREE.BoxGeometry(1, 1, 1);
				geo.translate(0, 0, -0.5);
				const mesh = new itowns.THREE.Mesh(geo, material);;
				mesh.scale.set(1, 1, 1);
				mesh.lookAt(0, 0, 0);
				mesh.updateMatrixWorld();
				mesh.CSVIndex = i;
				mesh.visible = false;
				group.add(mesh);
			}

			return Promise.resolve({
				csv: parsed,
				meshGroup: group
			});
		}
	});
	return csvSource;
}

function CreateBargraphLayer(itownsView, config) {
	class BarGraphLayer extends itowns.GeometryLayer {
		constructor(itownsView, config) {
			const group = new itowns.THREE.Group();
			const csvSource = createCSVBargraphSource(itownsView, config);
			super(config.id, group, {
				source: csvSource
			});
			this.group = group;
			this.source = csvSource;

			this.itownsView = itownsView;

			this.BarGraphExtent = new itowns.Extent('EPSG:4326', 0, 0, 0);
			this.rainbow = new Rainbow();
			this.rainbow.setSpectrum('black', 'blue', 'aqua', 'lime', 'yellow', 'red');
	

			// chowder側で判別できるようにフラグを設定
			this.isBarGraph = true;

			this.updateBarGraph = this.updateBarGraph.bind(this);

			this.defineLayerProperty('scale', this.scale || 1.0, this.updateBarGraph);
			this.defineLayerProperty('size', this.size || 5, this.updateBarGraph);
			this.defineLayerProperty('bargraphParams', {
				lon: 0,
				lat: 0,
				time: 0,
				physical1: 0,
				physical2: 0,
			}, this.updateBarGraph);
		}

		update(context, layer, node) { }

		preUpdate(context, changeSources) {
			this.source.loadData(this.BarGraphExtent, this).then((data) => {
				if (!data) {
					console.error("Not found bargraph datasource");
				}
				if (!this.group.getObjectById(data.meshGroup.id)) {
					console.log("add mesh group", data);
					this.group.add(data.meshGroup);
					// wireframeやopacityの変更に対応するにはこれが必要
					for (let i = 0; i < data.meshGroup.children.length; ++i) {
						data.meshGroup.children[i].layer = this;
					}
				}
			});
		}

		convert() { }

		/*
		 layer.bargraphParam = {
			 lon : 1,
			 lat : 2,
			 time : 3,
			 physical1 : 4,
			 physical2 : 5,
		 }
		 のようなchowder泥漿するパラメータを元にメッシュを更新する
		*/
		updateBarGraph() {
			if (!this.hasOwnProperty('bargraphParams')) return;
			this.source.loadData(this.BarGraphExtent, this).then((data) => {
				const params = this.bargraphParams;
				const csvData = data.csv.data;

				// keyがparamsにある場合のみvalueを返す、ない場合は空文字を返す
				function getValIfExist(params, key) {
					if (key.length == 0 || !params.hasOwnProperty(key)) {
						return "";
					}
					return params[key]
				}
				// 正しいインデックスかどうか
				function isValidIndex(index, array) {
					return Number.isInteger(index) && index >= 0 && index < array.length;
				}
				const lonIndex = getValIfExist(params, 'lon');
				const latIndex = getValIfExist(params, 'lat');
				const timeIndex = getValIfExist(params, 'time');
				const physicalVal1Index = getValIfExist(params, 'physical1');
				const physicalVal2Index = getValIfExist(params, 'physical2');

				// 色を付けるために値(PhysicalVal2)の範囲を求める
				let physicalVal2Range = { min: +Infinity, max: -Infinity }
				for (let i = 0; i < data.meshGroup.children.length; ++i) {
					const mesh = data.meshGroup.children[i];
					const isValidPhysical2Index = isValidIndex(physicalVal2Index, csvData[mesh.CSVIndex]);
					let physical2Val = Number(csvData[mesh.CSVIndex][physicalVal2Index]);
					if (isNaN(physical2Val)) {
						physical2Val = 0.0;
					}
					physicalVal2Range.min = Math.min(physicalVal2Range.min, physical2Val);
					physicalVal2Range.max = Math.max(physicalVal2Range.max, physical2Val);
				}
				if (physicalVal2Range.min !== physicalVal2Range.max) {
					this.rainbow.setNumberRange(physicalVal2Range.min, physicalVal2Range.max);
				}
				// 全メッシュにposition/scale/colorを設定して更新
				for (let i = 0; i < data.meshGroup.children.length; ++i) {
					const mesh = data.meshGroup.children[i];
					let isValidLonIndex = isValidIndex(lonIndex, csvData[i]);
					let isValidLatIndex = isValidIndex(latIndex, csvData[i]);
					let isValidTimeIndex = isValidIndex(timeIndex, csvData[i]);
					const isValidPhysical1Index = isValidIndex(physicalVal1Index, csvData[mesh.CSVIndex]);
					const isValidPhysical2Index = isValidIndex(physicalVal2Index, csvData[mesh.CSVIndex]);

					// Lon/Latを求める
					let lonlat = {
						"lon": isValidLonIndex ? Number(csvData[i][lonIndex]) : 0,
						"lat": isValidLatIndex ? Number(csvData[i][latIndex]) : 0,
					};
					if (isNaN(lonlat.lon)) {
						lonlat.lon = 0;
						isValidLonIndex = false;
					}
					if (isNaN(lonlat.lat)) {
						lonlat.lat = 0;
						isValidLatIndex = false;
					}
					// Lon/Latからmeshのpositionを割り出す
					const coord = new itowns.Coordinates('EPSG:4326', lonlat.lon, lonlat.lat, 0);
					// physical1valからmeshのscaleを割り出す
					const scaleZ = isValidPhysical1Index ? Number(csvData[mesh.CSVIndex][physicalVal1Index]) * 1000 * this.scale : 1.0;
					let physical2Val = Number(csvData[mesh.CSVIndex][physicalVal2Index]);
					if (isNaN(physical2Val)) {
						physical2Val = 0.0;
					}
					// physical2valからmeshの色を割り出す
					const color = this.rainbow.colourAt(physical2Val);
					mesh.material.color.setHex("0x" + color);
					if (this.itownsView.isPlanarView) {
						mesh.scale.set(this.size * 10000, this.size * 10000, -scaleZ);
					} else {
						mesh.scale.set(this.size * 10000, this.size * 10000, scaleZ);
					}
					mesh.position.copy(coord.as(this.itownsView.referenceCrs))
					if (!this.itownsView.isPlanarView) {
						const zeroCoord = new itowns.Coordinates('EPSG:4978', 0, 0, 0);
						const zeroVector = zeroCoord.as(this.itownsView.referenceCrs);
						mesh.lookAt(new itowns.THREE.Vector3(zeroVector.x, zeroVector.y, zeroVector.z));
					}
					mesh.visible = (isValidLonIndex && isValidLatIndex);
					if (mesh.visible && isValidTimeIndex && this.currentDate) {
						// meshが可視の場合で、かつ時刻が設定されている場合、
						// 現在時刻と時刻を比較し、visibleを上書きする
						const date = new Date(csvData[i][timeIndex]);
						if (date.getTime() <= this.currentDate.getTime()) {
							mesh.visible = true;
						} else {
							mesh.visible = false;
						}
						
						if (this.range) {
							// 現在時刻がレンジ範囲外なら非表示とする
							if (this.currentDate< this.range.rangeStartTime
								|| this.currentDate > this.range.rangeEndTime) {
									mesh.visible = false;
							}
							// データ時刻がレンジ範囲外なら非表示とする
							if (date.getTime() < this.range.rangeStartTime
								|| date.getTime() > this.range.rangeEndTime) {
									mesh.visible = false;
							}
						}
					}
					mesh.updateMatrixWorld();
				}
			});
		}
		
		updateByTime(currentDate = null, range = null) {
			this.currentDate = currentDate;
			this.range = range;
			this.updateBarGraph(currentDate);
		}
	}
	return new BarGraphLayer(itownsView, config);
}

// 実行時にPreset側で読みこんだitowns.jsを使いたいため
// この時点でitownsのクラスを露出せず、生成関数をエクスポートする
export default CreateBargraphLayer;