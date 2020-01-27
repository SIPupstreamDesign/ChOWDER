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

	relocateWindowsByRewriteConfig(data) {
		try 
		{
			console.log("relocateWindowsByRewriteConfig:", data);
			let relocatedConfig = JSON.parse(JSON.stringify(this.config));
			for (let id in this.config.windows) {
				let windowProps = this.config.windows[id];
				if (windowProps.hasOwnProperty('marker_id')) {
					// if (windowProps.marker_id === data[marker_id]???) {
					//    
					// }
				}
			}
		
			fs.writeFileSync(this.configPath, JSON.stringify(relocatedConfig, null , "\t"));
			return true;
		}
		catch(err) 
		{
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