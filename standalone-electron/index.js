/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

var electron = require('electron');

const path = require('path');
console.log(__dirname);
const os = require('os');
const filepath = "conf.json"
if (os.platform() === "darwin") {
	filepath = path.resolve(__dirname, '../../../../conf.json');
} else {
	filepath = '../../conf.json'
}
var CONFIG = require(filepath);

var tileWindows = {};

const {ipcMain} = require("electron");

/**
 * Convert map into query params string.
 * @param {Object} map Map of parameters you want to convert into
 * @return {string} result
 */
function mapToQueryString(map) {
	var str = '?';
	for (var key in map) {
		if (map[key] !== undefined) {
			str += key + '=' + map[key] + '&';
		}
	}
	str = str.substring( 0, str.length - 1 ); // remove the last '&'

	return str;
}

/**
 * Create windows based on the file conf.json.
 */
function createWindows() {
	if (!CONFIG.url) {
		console.error('conf.json is invalid: There are no required parameter "url"');
		return;
	}

	for (var id in CONFIG.windows) {
		if (tileWindows[id]) { // if window already exists
			return;
		}

		var windowProps = CONFIG.windows[id];

		if (!windowProps.position) {
			console.error('conf.json is invalid: There are no required parameter "position" for window "' + id + '"');
			return;
		}

		if (!windowProps.size) {
			console.error('conf.json is invalid: There are no required parameter "size" for window "' + id + '"');
			return;
		}

		var frame = typeof windowProps.frame !== 'undefined' ? windowProps.frame : true;
		var window = new electron.BrowserWindow({
			x: windowProps.position[0],
			y: windowProps.position[1],
			width: windowProps.size[0],
			height: windowProps.size[1],
			frame: frame,
			transparent: !frame,
			toolbar: false,
			fullscreen: typeof windowProps.fullscreen !== 'undefined' ? windowProps.fullscreen : true
		});
		tileWindows[id] = window;

		var query = mapToQueryString({
			id: id || undefined,
			group: windowProps.group || undefined,
			posx: windowProps.vda_position ? windowProps.vda_position[0] : undefined,
			posy: windowProps.vda_position ? windowProps.vda_position[1] : undefined,
			scale: windowProps.scale || undefined
		});
		const pass = CONFIG.password
		ipcMain.on("electron_login", (event,arg)=>{
			event.sender.send("electron_password", pass);
		});
		window.loadURL(CONFIG.url + query);
	}
}

electron.app.on('ready', createWindows);

electron.app.on('window-all-closed', function() {
	//if (process.platform !== 'darwin') {
		electron.app.quit();
	//}
} );

electron.app.on('activate', function() { // macOS
	if (tileWindows === null) {
		createWindows();
	}
} );