/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

let electron = require('electron');

const fs = require('fs');
const path = require('path');
console.log(__dirname);
const os = require('os');
let filepath = "conf.json"
if (os.platform() === "darwin") {
	filepath = path.resolve(__dirname, '../../../../conf.json');
} else {
	filepath = path.resolve(__dirname, '../../../conf.json');
	if (!fs.existsSync(filepath)) {
		filepath = path.resolve(__dirname, '../../conf.json');
		if (!fs.existsSync(filepath)) {
			filepath = './conf.json';
		}
	}
}

const { ipcMain } = require("electron");

/**
 * Convert map into query params string.
 * @param {Object} map Map of parameters you want to convert into
 * @return {string} result
 */
function mapToQueryString(map) {
	let str = '?';
	for (let key in map) {
		if (map[key] !== undefined) {
			str += key + '=' + map[key] + '&';
		}
	}
	str = str.substring(0, str.length - 1); // remove the last '&'

	return str;
}

class ElectornDisplay {
	constructor(confFilePath) {
		this.configPath = confFilePath;
		this.config = require(confFilePath)
		this.windowMap = null;
		this.tileWindows = {};
		this.preventQuitOnetime = false;

		this.dataList = []

		this.initElectronEvents.bind(this)();
	}

	initElectronEvents() {

		electron.app.on('ready', this.init.bind(this));

		electron.app.on('window-all-closed', () => {
			//if (process.platform !== 'darwin') {
			if (!this.preventQuitOnetime) {
				console.log("quit")
				electron.app.quit();
			} else {
				this.preventQuitOnetime = false;
			}
			//}
		});

		electron.app.on('activate', () => { // macOS
			if (this.tileWindows === null) {
				this.init();
			}
		});
	}

	init() {
		this.windowMap = this.createWindows();

		if (this.windowMap) {
			const pass = this.config.password;
			ipcMain.on("electron_login", (event, arg) => {
				event.sender.send("electron_password", pass);
			});

			{
				let messageCount = 0;
				ipcMain.on("electron_reload", (event, arg) => {
					++messageCount;
					if (messageCount >= Object.keys(this.windowMap).length) {
						this.reloadWindows();
						messageCount = 0;
					}
				});
			}

			{
				ipcMain.on("electron_close", (event, arg) => {
					let win = electron.BrowserWindow.fromWebContents(event.sender);
					win.close();
				});
			}

			{
				let messageCount = 0;
				ipcMain.on("electron_relocate", (event, data) => {
					++messageCount;
					if (messageCount >= Object.keys(this.windowMap).length) {
						if (this.relocateWindowsByRewriteConfig(data)) {
							this.reloadWindows();
						}
						messageCount = 0;
					}
				});
			}
		} else {
			console.error("Error. Failed to create windows");
			electron.app.quit();
		}
	}


	/**
	 * 入ってきたオブジェクトの入れ替え
	 * @param {*} number1 
	 * @param {*} number2 
	 */
	exchangeNum(number1, number2) {
		//console.log("exchange");
		let tmp = number1;
		number1 = number2;
		number2 = tmp;
		let re = [number1, number2];
		return re;
	}

	/**
	 * 入ってきたデータをx座標,y座標それぞれでソート
	 * @param {*} data 
	 */
	sortData(data) {
		console.log("sortData")
		for (let i = 0; i < 2; i++) {
			for (let j = 0; j < data[i].length - 1; j++) {
				for (let k = j + 1; k < data[i].length; k++) {
					if (data[i][j][1][i] > data[i][k][1][i]) {
						let re = this.exchangeNum(data[i][j], data[i][k])
						data[i][j] = JSON.parse(JSON.stringify(re[0]));
						data[i][k] = JSON.parse(JSON.stringify(re[1]));
					}
				}
			}
		}
		//console.log("sortedData:")
		//console.log(data);
	}


	/**
	 * データを縦一列に並んでいるもの、横一列に並んでいるものでグループ分けする
	 * @param {*} data  各マーカの隣接関係
	 */
	groupingData(data) {
		console.log("groupingData")
		let sortedData = [JSON.parse(JSON.stringify(data)), JSON.parse(JSON.stringify(data))];
		let result = [];
		this.sortData(sortedData);
		for (let i = 0; i < 2; i++) {
			let tmpResult = [[sortedData[i][0]]];
			let groupingItr = 0;
			for (let j = 1; j < sortedData[i].length; j++) {
				if (sortedData[i][j][1][i] === sortedData[i][j - 1][1][i]) {
					tmpResult[groupingItr].push(sortedData[i][j]);
				}
				else {
					tmpResult.push([sortedData[i][j]]);
					groupingItr++;
				}
			}
			result[i] = tmpResult;
		}
		/*console.log("groupingData:");
		for (let i in result) {
			console.log(i);
			console.log(result[i]);
		}*/
		return JSON.parse(JSON.stringify(result));

	}

	/**
	 * 縦横での座標の昇順でランク分け
	 * @param {*} data グループ分けされたデータ
	 */
	calcRank(data) {
		console.log("calcRank");
		let rank = [];
		for (let i in data) {
			for (let j in data[i]) {
				for (let k in data[i][j]) {

					if (!rank[data[i][j][k][0] - 1]) {
						rank[data[i][j][k][0] - 1] = [j];
					}
					else {
						rank[data[i][j][k][0] - 1][i] = j;
					}
				}
			}
		}

		//console.log("rank:");
		//console.log(rank);
		return JSON.parse(JSON.stringify(rank));
	}

	/**
	 * 隣接関係の判定
	 * @param {*} data コンフィグデータ
	 */
	calcAdjacency(data) {
		console.log("calcAdjacency");
		let rank = this.calcRank(data);
		let adj = {};
		for (let i in rank) {
			adj[i] = {};
			for (let j in rank) {
				let winId = Number(j) + 1;
				if (rank[j][0] - rank[i][0] === 1 && rank[j][1] - rank[i][1] === 0) {
					adj[i]["right"] = winId;
				}
				else if (rank[j][0] - rank[i][0] === -1 && rank[j][1] - rank[i][1] === 0) {
					adj[i]["left"] = winId;
				}
				else if (rank[j][0] - rank[i][0] === 0 && rank[j][1] - rank[i][1] === -1) {
					adj[i]["up"] = winId;
				}
				else if (rank[j][0] - rank[i][0] === 0 && rank[j][1] - rank[i][1] === 1) {
					adj[i]["down"] = winId;
				}
			}
		}
		//console.log("adjacency")
		//console.log(adj);
		return JSON.parse(JSON.stringify(adj));
	}

	/**
	 * 隣接関係の決定
	 * @param {*} pcId　 各PCを定義づけるID
	 */
	decideAdajacency(pcId) {
		console.log("decideAdajacency");
		//データの登録
		let windowPos = [];
		for (let id in this.config.windows) {
			if (this.config.windows[id]["marker_id"][0] === pcId) {
				if (!windowPos) {
					windowPos = [this.config.windows[id]["marker_id"][1], this.config.windows[id]["position"]];
				}
				else {
					windowPos.push([this.config.windows[id]["marker_id"][1], this.config.windows[id]["position"]]);
				}
			}
		}

		let groupedData = this.groupingData(windowPos);
		let adj = this.calcAdjacency(groupedData);
		this.dataList[pcId] = JSON.parse(JSON.stringify(adj)); return JSON.parse(JSON.stringify(adj));
	}

	//コンフィグのデータを使うデータにフォーマットを合わせる
	convertDataFormatConfigToData() {
		console.log("convertDataFormatConfigToData");
		let alphabet = "ABCDEFGHIJK";
		let windowId = [];
		for (let id in this.config.windows) {

			let thisPcId = this.config.windows[id]["marker_id"][0];
			let thisWindowId = this.config.windows[id]["marker_id"][1];
			if (alphabet.indexOf(thisPcId) !== -1) {
				if (!windowId[thisPcId]) {
					windowId[thisPcId] = [thisWindowId];
				}
				else {
					windowId[thisPcId].push(thisWindowId);
				}
			}
		}
		let sortedWindowCoord = [];
		for (let id in windowId) {
			console.log(id);
			sortedWindowCoord[id] = this.decideAdajacency(id);
		}

		/*for (let i in this.dataList) {
			console.log(this.dataList[i]);
		}*/
	}

	/**
	 * 受取ったデータフォーマットを計算用に合わせる
	 * @param {*} scannedData スキャンされた入力データ
	 * @param {*} pcId 各PCを定義づけるID
	 */
	convertDataFormatScannedToTrue(scannedData, pcId) {
		let direction = ["up", "down", "right", "left"]
		let trueData = {}
		trueData[pcId] = {};
		for (let i in this.dataList[pcId]) {
			trueData[pcId][i] = {};
			for (let j = 0; j < 4; j++) {
				if (scannedData[i][j] !== -1) {
					if (scannedData[i][j][0] === pcId) {
						trueData[pcId][i][direction[j]] = Number(scannedData[i][j][1]);
					}
				}
			}
		}
		return JSON.parse(JSON.stringify(trueData));
	}

	/**
	 * 相対座標の算出
	 * @param {*} pcId 各PCを定義づけるID
	 * @param {*} relativeCoord 結果を保存する座標
	 * @param {*} adjList 参照する隣接リスト
	 */
	calcRelativeCoord(pcId, relativeCoord, adjList) {
		console.log("calcRelativeCoord")
		//console.log(adjList);
		let directionName = ["right", "left", "up", "down"]
		let rightCount = {};
		rightCount[pcId] = [0]
		let upCount = {};
		upCount[pcId] = [0]
		for (let i in adjList[pcId]) {
			rightCount[pcId].push(0);
			upCount[pcId].push(0);
		}
		let resultCount = { right: rightCount, up: upCount }
		for (let i in adjList[pcId]) {
			//console.log(pcId + i)
			for (let j = 0; j < 2; j++) {
				//console.log(directionName[2 * j]);
				let id;
				let count = 1;
				if (adjList[pcId][i][directionName[2 * j]]) {
					id = JSON.parse(JSON.stringify(adjList[pcId][i][directionName[2 * j]]));
				}
				try {
					while (id) {
						//console.log(id);
						resultCount[directionName[2 * j]][pcId][id - 1] += JSON.parse(JSON.stringify(count));
						if (adjList[pcId][id - 1][directionName[2 * j]]) {
							id = JSON.parse(JSON.stringify(adjList[pcId][id - 1][directionName[2 * j]]));
						}
						else {
							break;
						}
						//隣接リストleft,downへの参照がループしだしたとき、エラー
						if (adjList[pcId].length === count) {
							throw new Error("Error:Adjacency judgment has looped");
						}
					}
				} catch (error) {
					console.log(error.message);
				}
			}
		}
		for (let i in adjList[pcId]) {
			relativeCoord[pcId][i][0] += resultCount["right"][pcId][i];
			relativeCoord[pcId][i][1] += resultCount["up"][pcId][i];
		}
		//console.log(adjList);
		//console.log(relativeCoord);
	}

	/**
	 * 任意の位置にmakerIdのコンフィグを配置する
	 * @param {*} scannedConfigId スキャンされたコンフィグ
	 * @param {*} trueConfigId 現在のコンフィグ
	 * @param {*} sendConfig 書き直すコンフィグ
	 */
	locateScannnedPos(scannedConfigId, trueConfigId, sendConfig) {
		console.log("locateScannnedPos");
		sendConfig.windows[trueConfigId] = JSON.parse(JSON.stringify(this.config.windows[scannedConfigId]));
		sendConfig.windows[trueConfigId].marker_id = JSON.parse(JSON.stringify(this.config.windows[trueConfigId].marker_id));
	}

	/**
	 * 任意のタイルの位置を交換
	 * @param {*} tileId1 １つ目のdesplayのID
	 * @param {*} tileId2 2つ目のdesplayのID
	 * @param {*} relocatedConfig 書き直すコンフィグ
	 */
	exchangeTilePos(tileId1, tileId2, relocatedConfig) {
		console.log("exchangeTilePos");
		relocatedConfig.windows[tileId1] = JSON.parse(JSON.stringify(this.config.windows[tileId2]));
		relocatedConfig.windows[tileId2] = JSON.parse(JSON.stringify(this.config.windows[tileId1]));
		relocatedConfig.windows[tileId1].marker_id = JSON.parse(JSON.stringify(this.config.windows[tileId1].marker_id));
		relocatedConfig.windows[tileId2].marker_id = JSON.parse(JSON.stringify(this.config.windows[tileId2].marker_id));
	}

	//command relocate
	relocateWindowsByRewriteConfig(data) {
		try {
			console.log("relocateWindowsByRewriteConfig:", data);
			let relocatedConfig = JSON.parse(JSON.stringify(this.config));
			let received = JSON.parse(data);
			if (received[0] === "Adjustment event occuured") {
				console.log("Adjustment event occuured");
				for (let tileId1 in this.config.windows) {
					for (let tileId2 in this.config.windows) {
						let markerId1 = this.config.windows[tileId1].marker_id
						let markerId2 = this.config.windows[tileId2].marker_id
						if (markerId1 === received[1] && markerId2 === received[2]) {
							this.exchangeTilePos(tileId1, tileId2, relocatedConfig)
						}
					}
				}
			}
			else {
				for (let id in this.config.windows) {
					//console.log(id);
					let windowProps = this.config.windows[id];

					if (windowProps.hasOwnProperty('marker_id')) {
						let pcId = this.config.windows[id].marker_id[0];
						let windowId = this.config.windows[id].marker_id[1];
						//スコープ内にある真値とスキャン値を取得する

						let scannedData = [];
						for (let i in this.dataList[pcId]) {
							let markerData = received["data"][pcId][Number(i)]
							scannedData[i] = [markerData["up"], markerData["down"], markerData["right"], markerData["left"]]
						}
						scannedData = this.convertDataFormatScannedToTrue(scannedData, pcId);

						//console.log(trueData);
						//console.log(scannedData);

						//真値とスキャン値のフォーマットを相対座標値に合わせる
						let trueRelativeCoord = {};
						for (let i in this.dataList[pcId]) {
							if (!trueRelativeCoord[pcId]) { trueRelativeCoord[pcId] = [[0, 0]]; }
							else { trueRelativeCoord[pcId].push([0, 0]); }
						}
						let scannedRelativeCoord = {};
						for (let i in this.dataList[pcId]) {
							if (!scannedRelativeCoord[pcId]) { scannedRelativeCoord[pcId] = [[0, 0]]; }
							else { scannedRelativeCoord[pcId].push([0, 0]); }
						}
						this.calcRelativeCoord(pcId, trueRelativeCoord, this.dataList);
						this.calcRelativeCoord(pcId, scannedRelativeCoord, scannedData);

						//相対座標が違っていたらスキャン値の座標を真値から探しに行き、そのwindowIdを保存する
						let trueMarkerId;
						if (scannedRelativeCoord[pcId][windowId - 1][0] !== trueRelativeCoord[pcId][windowId - 1][0] || scannedRelativeCoord[pcId][windowId - 1][1] !== trueRelativeCoord[pcId][windowId - 1][1]) {
							let searchingCoord = [scannedRelativeCoord[pcId][windowId - 1][0], scannedRelativeCoord[pcId][windowId - 1][1]];
							for (let i in trueRelativeCoord[pcId]) {
								if (trueRelativeCoord[pcId][i][0] === searchingCoord[0]) {
									if (trueRelativeCoord[pcId][i][1] === searchingCoord[1]) {
										trueMarkerId = Number(i) + 1;
									}
								}
							}
						}
						//console.log(trueMarkerId);
						//trueMakerIdをコンフィグから探し、そこにスコープ内のマーカを配置する
						if (trueMarkerId) {
							let tmId = pcId + trueMarkerId
							for (let trueWindowId in this.config.windows) {
								if (this.config.windows[trueWindowId].marker_id === tmId) {
									this.locateScannnedPos(trueWindowId, id, relocatedConfig);
								}
							}
						}

					}
				}
			}
			//console.log(this.configPath, "rewritedConfig:", relocatedConfig);
			fs.writeFileSync(this.configPath, JSON.stringify(relocatedConfig, null, "\t"));
			return true;
		}
		catch (err) {
			console.error(err);
		}
		return false;
	}

	/**
	 * Create windows based on the file conf.json.
	 */
	createWindows() {
		let tileWindows = this.tileWindows;
		let config = this.config;
		let windowMap = {};

		if (!config.url) {
			console.error('conf.json is invalid: There are no required parameter "url"');
			return null;
		}

		for (let id in config.windows) {
			if (tileWindows[id]) { // if window already exists
				return null;
			}

			let windowProps = config.windows[id];

			if (!windowProps.position) {
				console.error('conf.json is invalid: There are no required parameter "position" for window "' + id + '"');
				return null;
			}

			if (!windowProps.size) {
				console.error('conf.json is invalid: There are no required parameter "size" for window "' + id + '"');
				return null;
			}

			let frame = typeof windowProps.frame !== 'undefined' ? windowProps.frame : true;
			let window = new electron.BrowserWindow({
				x: windowProps.position[0],
				y: windowProps.position[1],
				width: windowProps.size[0],
				height: windowProps.size[1],
				frame: frame,
				transparent: !frame,
				toolbar: false,
				fullscreen: typeof windowProps.fullscreen !== 'undefined' ? windowProps.fullscreen : true,
				enableLargerThanScreen: true
			});
			window.setSize(windowProps.size[0], windowProps.size[1]);
			tileWindows[id] = window;

			let query = mapToQueryString({
				id: id || undefined,
				group: windowProps.group || undefined,
				posx: windowProps.vda_position ? windowProps.vda_position[0] : undefined,
				posy: windowProps.vda_position ? windowProps.vda_position[1] : undefined,
				scale: windowProps.scale || undefined,
				marker_id: windowProps.marker_id || undefined
			});
			window.loadURL(config.url + query);

			windowMap[id] = window;

			//window.webContents.openDevTools();
		}
		this.convertDataFormatConfigToData();
		return windowMap;
	}

	reloadWindows() {
		this.preventQuitOnetime = true;

		try {
			this.config = JSON.parse(String(fs.readFileSync(filepath)));
		} catch (err) {
			messageCount = 0;
			console.error(err);
			return;
		}

		this.tileWindows = {}
		for (let id in this.windowMap) {
			this.windowMap[id].close();
		}
		this.windowMap = this.createWindows();
		if (!this.windowMap) {
			console.error("Error. Failed to create windows");
			electron.app.quit();
		}
	}
}
const app = new ElectornDisplay(filepath);