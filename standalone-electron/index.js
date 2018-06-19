var electron = require( 'electron' );

var CONFIG = require( './conf.json' );

var tileWindows = [];

function createWindow() {
	CONFIG.id.map( function( id ) {
		if ( tileWindows[ id ] ) { return; }

		if ( !CONFIG.rect[ id ] ) {
			console.error( 'conf.json: there are no rect for id "' + id + '"!' );
			return;
		}

		tileWindows[ id ] = new electron.BrowserWindow( {
			x: CONFIG.rect[ id ][ 0 ],
			y: CONFIG.rect[ id ][ 1 ],
			width: CONFIG.rect[ id ][ 2 ],
			height: CONFIG.rect[ id ][ 3 ],
			frame: CONFIG.frame,
			fullscreen: CONFIG.fullscreen
		} );

		tileWindows[ id ].loadURL( CONFIG.url + '#' + id );

		tileWindows[ id ].on( 'closed', function() {
			tileWindows[ id ] = null;
		} );
	} );
}

electron.app.on( 'ready', createWindow );

electron.app.on( 'window-all-closed', function() {
	if ( process.platform !== 'darwin' ) {
		electron.app.quit();
	}
} );

electron.app.on( 'activate', function() {
	if ( tileWindows === null ) {
		createWindow();
	}
} );