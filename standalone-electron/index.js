var electron = require('electron');

var CONFIG = require('./conf.json');

var tileWindows = {};

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

		if (!windowProps.rect) {
			console.error('conf.json is invalid: There are no required parameter "rect" for window "' + id + '"');
			return;
		}

		if (windowProps.rect.length !== 4) {
			console.error('conf.json is invalid: The parameter "rect" for window "' + id + '" is invalid');
			return;
		}

		var frame = typeof windowProps.frame !== 'undefined' ? windowProps.frame : true;
		var window = new electron.BrowserWindow({
			x: windowProps.rect[0],
			y: windowProps.rect[1],
			width: windowProps.rect[2],
			height: windowProps.rect[3],
			frame: frame,
			transparent: !frame,
			fullscreen: typeof windowProps.fullscreen !== 'undefined' ? windowProps.fullscreen : true
		});
		tileWindows[id] = window;

		var query = mapToQueryString({
			id: id || undefined,
			group: windowProps.group || undefined,
			posx: windowProps.position ? windowProps.position[0] : undefined,
			posy: windowProps.position ? windowProps.position[1] : undefined,
			scale: windowProps.scale || undefined
		});
		
		window.loadURL(CONFIG.url + query);
	}
}

electron.app.on('ready', createWindows);

electron.app.on('window-all-closed', function() {
	if (process.platform !== 'darwin') {
		electron.app.quit();
	}
} );

electron.app.on('activate', function() { // macOS
	if (tileWindows === null) {
		createWindows();
	}
} );