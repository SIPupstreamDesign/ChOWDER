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

let config = require(filepath);
let tileWindows = {};

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

/**
 * Create windows based on the file conf.json.
 */
function createWindows(config) {
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
	return windowMap;
}

let preventQuitOnetime = false;
function init() {
	let windowMap = createWindows(config);

	if (windowMap) {
		const pass = config.password
		ipcMain.on("electron_login", (event, arg) => {
			event.sender.send("electron_password", pass);
		});

		{
			let messageCount = 0;
			ipcMain.on("electron_reload", (event, arg) => {
				++messageCount;
				if (messageCount >= Object.keys(windowMap).length) {
					preventQuitOnetime = true;
	
					try {
						config = JSON.parse(String(fs.readFileSync(filepath)));
					} catch (err) {
						messageCount = 0;
						console.error(err);
						return;
					}
	
					tileWindows = {}
					for (let id in windowMap) {
						windowMap[id].close();
					}
					windowMap = createWindows(config);
					if (!windowMap) {
						console.error("Error. Failed to create windows");
						electron.app.quit();
					}
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
	} else {
		console.error("Error. Failed to create windows");
		electron.app.quit();
	}
}

electron.app.on('ready', init);

electron.app.on('window-all-closed', function () {
	//if (process.platform !== 'darwin') {
	if (!preventQuitOnetime) {
		console.log("quit")
		electron.app.quit();
	} else {
		preventQuitOnetime = false;
	}
	//}
});

electron.app.on('activate', function () { // macOS
	if (tileWindows === null) {
		init();
	}
});