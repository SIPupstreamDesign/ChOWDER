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
	filepath = '../../conf.json'
	if (!fs.existsSync(filepath)) {
		filepath = './conf.json';
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

		this.windowAdjacencyList = []

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

	exchangeNum(number1, number2) {
		//console.log("exchange");
		let tmp = number1;
		number1 = number2;
		number2 = tmp;
		let re = [number1, number2];
		return re;
	}

	calcDifferencelist(data, len) {
		let differenceList = [];
		let differenceItr = 0;
		for (let i = 0; i < len - 1; i++) {
			for (let j = 1; j < len - i; j++) {
				differenceList[differenceItr] = {
					id: String(data[i][0]) + String(data[i + j][0]),
					x: data[i + j][1][0] - data[i][1][0],
					y: data[i + j][1][1] - data[i][1][1]
				};

				differenceItr++;
			}
		}
		return JSON.parse(JSON.stringify(differenceList));
	}

	sortData(result) {
		for (let i = 0; i < 2; i++) {
			for (let j = 0; j < result[i].length - 1; j++) {
				for (let k = j + 1; k < result[i].length; k++) {
					if (result[i][j][1][i] > result[i][k][1][i]) {
						let re = this.exchangeNum(result[i][j], result[i][k])
						result[i][j] = JSON.parse(JSON.stringify(re[0]));
						result[i][k] = JSON.parse(JSON.stringify(re[1]));
					}
				}
			}
		}
		//console.log(result)
	}

	groupingData(data) {
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
			/*for (let i in tmpResult) {
				console.log(i);
				console.log(tmpResult[i]);
			}*/
		}
		//console.log(result);
		return JSON.parse(JSON.stringify(result));

	}

	calcSortedCoord(data) {
		let sortedCoord = [];
		for (let i in data) {
			for (let j in data[i]) {
				//console.log(groupedDataX[i])
				for (let k in data[i][j]) {

					//console.log(groupedDataX[i][j][0]);
					if (!sortedCoord[data[i][j][k][0] - 1]) {
						sortedCoord[data[i][j][k][0] - 1] = [j];
					}
					else {
						sortedCoord[data[i][j][k][0] - 1][i] = j;
					}
				}
			}
		}

		//console.log(sortedCoord);
		return JSON.parse(JSON.stringify(sortedCoord));
	}

	calcAdjacency(data) {

		let sortedCoord = this.calcSortedCoord(data);
		//console.log("sortedCoordInFunction")
		//console.log(sortedCoord);
		let adjacency = {};
		for (let i in sortedCoord) {
			adjacency[i] = {};
			for (let j in sortedCoord) {
				let winId = Number(j) + 1;
				if (sortedCoord[j][0] - sortedCoord[i][0] === 1 && sortedCoord[j][1] - sortedCoord[i][1] === 0) {
					adjacency[i]["right"] = winId;
				}
				else if (sortedCoord[j][0] - sortedCoord[i][0] === -1 && sortedCoord[j][1] - sortedCoord[i][1] === 0) {
					adjacency[i]["left"] = winId;
				}
				else if (sortedCoord[j][0] - sortedCoord[i][0] === 0 && sortedCoord[j][1] - sortedCoord[i][1] === 1) {
					adjacency[i]["up"] = winId;
				}
				else if (sortedCoord[j][0] - sortedCoord[i][0] === 0 && sortedCoord[j][1] - sortedCoord[i][1] === -1) {
					adjacency[i]["down"] = winId;
				}
			}
		}
		console.log("adjacencyInFunction")
		console.log(adjacency);
		return JSON.parse(JSON.stringify(adjacency));
	}


	sortMin(pcId, windowId) {
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

		//let differenceList = this.calcDifferencelist(windowPos, windowId.length)
		let groupedData = this.groupingData(windowPos);
		let adjacency = this.calcAdjacency(groupedData);
		this.windowAdjacencyList[pcId] = JSON.parse(JSON.stringify(adjacency)); return JSON.parse(JSON.stringify(adjacency));
	}

	calcWindowCoord() {
		//let relocatedConfig = JSON.parse(JSON.stringify(this.config));
		console.log("calcWindowCoord");
		let alphabet = "ABCDEFGHIJK";
		let windowId = [];
		for (let id in this.config.windows) {
			//console.log(this.config.windows[id]);
			let thisPcId = this.config.windows[id]["marker_id"][0];
			let thisWindowId = this.config.windows[id]["marker_id"][1];
			if (alphabet.indexOf(thisPcId) !== -1) {
				if (!windowId[thisPcId]) {
					windowId[thisPcId] = [thisWindowId];
				}
				else {
					windowId[thisPcId].push(thisWindowId);
				}
				console.log(windowId)
			}
		}
		let sortedWindowCoord = [];
		for (let id in windowId) {
			sortedWindowCoord[id] = this.sortMin(id, windowId[id]);
		}

		console.log("result");
		console.log(this.windowAdjacencyList);
	}

	convertDataFormatReceivedToScanned(received) {
		let receivedData = JSON.parse(JSON.stringify(received.split('{').join('')));
		receivedData = receivedData.split('}').join('');
		receivedData = receivedData.split('[').join('');
		receivedData = receivedData.split(']').join('');
		receivedData = receivedData.split('"').join('');
		receivedData = receivedData.split('data').join('');
		receivedData = receivedData.split('up').join('');
		receivedData = receivedData.split('down').join('');
		receivedData = receivedData.split('right').join('');
		receivedData = receivedData.split('left').join('');
		receivedData = receivedData.split(':');
		let result;
		for (let i in receivedData) {
			for (let j = 0; j < receivedData[i].split(',').length; j++) {
				let tmp = receivedData[i].split(',')[j];
				if (tmp) {
					if (!result) {
						result = [JSON.parse(JSON.stringify(tmp))];
					}
					else {
						result.push(JSON.parse(JSON.stringify(tmp)));
					}
				}
			}
		}
		console.log(result);
		return JSON.parse(JSON.stringify(result));

	}

	convertDataFormatScannedToTrue(scannedData, pcId) {
		let direction = ["up", "down", "right", "left"]
		let trueData = {}
		trueData[pcId] = []
		for (let i in this.windowAdjacencyList[pcId]) {
			trueData[pcId][i] = {};
			for (let j = 0; j < 4; j++) {
				if (scannedData[i][j] !== -1) {
					if (scannedData[i][j][0] === pcId) {
						trueData[pcId][i][direction[j]] = Number(scannedData[i][j][1]);
					}
				}
			}
		}
		return trueData;
	}

	calcRelativeCoord(pcId, relativeCoord, adjacencyList) {
		let directionName = ["right", "left", "up", "down"]
		let rightCount = {};
		rightCount[pcId] = [0]
		let upCount = {};
		upCount[pcId] = [0]
		for (let i in adjacencyList[pcId]) {
			rightCount[pcId].push(0);
			upCount[pcId].push(0);
		}
		let resultCount = { right: rightCount, up: upCount }
		for (let i in adjacencyList[pcId]) {
			for (let j = 0; j < 2; j++) {
				let id = adjacencyList[pcId][i][directionName[2 * j]];
				let count = 1;
				try {
					while (id) {
						resultCount[directionName[2 * j]][pcId][id - 1] += JSON.parse(JSON.stringify(count));
						id = adjacencyList[pcId][id - 1][directionName[2 * j]];
						//隣接リストleft,downへの参照がループしだしたとき、エラー
						if (adjacencyList[pcId].length === count) {
							throw new Error("Error:Adjacency judgment has looped");
						}
					}
				} catch (error) {
					console.log(error.message);
				}
			}
		}
		for (let i in adjacencyList[pcId]) {
			relativeCoord[pcId][i][0] += resultCount["right"][pcId][i];
			relativeCoord[pcId][i][1] += resultCount["up"][pcId][i];
		}
		//console.log(resultCount);
		//console.log(relativeCoord);
	}

	locateScannnedPos(scannedConfigId, trueConfigId, sendConfig) {
		sendConfig.windows[trueConfigId] = JSON.parse(JSON.stringify(this.config.windows[scannedConfigId]));
		sendConfig.windows[trueConfigId].marker_id = JSON.parse(JSON.stringify(this.config.windows[trueConfigId].marker_id));
	}

	//command relocate
	relocateWindowsByRewriteConfig(data) {
		try {
			console.log("relocateWindowsByRewriteConfig:", data);
			let relocatedConfig = JSON.parse(JSON.stringify(this.config));
			let receivedData = this.convertDataFormatReceivedToScanned(data);

			for (let id in this.config.windows) {
				console.log(id);
				let windowProps = this.config.windows[id];

				if (windowProps.hasOwnProperty('marker_id')) {
					console.log(windowProps.marker_id);
					let pcId = this.config.windows[id].marker_id[0];
					let windowId = this.config.windows[id].marker_id[1];
					//スコープ内にある真値とスキャン値を取得する
					let trueData = this.windowAdjacencyList[pcId][windowId - 1];
					let scannedData = [];
					for (let i in this.windowAdjacencyList[pcId]) {
						let pcIdIndex = receivedData.indexOf(pcId)
						scannedData[i] = [receivedData[pcIdIndex + i * 4 + 1], receivedData[pcIdIndex + i * 4 + 2],
						receivedData[pcIdIndex + i * 4 + 3], receivedData[pcIdIndex + i * 4 + 4],]
					}
					scannedData = this.convertDataFormatScannedToTrue(scannedData, pcId);

					console.log(trueData);
					console.log(scannedData);

					//真値とスキャン値のフォーマットを相対座標値に合わせる
					let trueRelativeCoord = {};
					for (let i in this.windowAdjacencyList[pcId]) {
						if (!trueRelativeCoord[pcId]) { trueRelativeCoord[pcId] = [[0, 0]]; }
						else { trueRelativeCoord[pcId].push([0, 0]); }
					}
					let scannedRelativeCoord = {};
					for (let i in this.windowAdjacencyList[pcId]) {
						if (!scannedRelativeCoord[pcId]) { scannedRelativeCoord[pcId] = [[0, 0]]; }
						else { scannedRelativeCoord[pcId].push([0, 0]); }
					}
					this.calcRelativeCoord(pcId, trueRelativeCoord, this.windowAdjacencyList);
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
								console.log("change");
								console.log(id, trueWindowId);
								this.locateScannnedPos(trueWindowId, id, relocatedConfig);
							}
						}
					}

				}
			}
			//console.log("rewritedConfig:", relocatedConfig);
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
		this.calcWindowCoord();
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