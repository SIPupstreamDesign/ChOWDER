
window.onload = () => {
    /* global itowns,document,GuiTools*/
    var positionOnGlobe = { longitude: -75.61, latitude: 40.04, altitude: 50000 };
    // iTowns namespace defined here
    var viewerDiv = document.getElementById('viewerDiv');
    var view = new itowns.GlobeView(viewerDiv, positionOnGlobe);
    view.camera.camera3D.near = 5;
    setupLoadingScreen(viewerDiv, view);
    var menuGlobe = new GuiTools('menuDiv', view, 300, viewerDiv);
    itowns.Fetcher.json('./layers/JSONLayers/OPENSM.json').then(function _(config) {
        config.source = new itowns.TMSSource(config.source);
        var layer = new itowns.ColorLayer('Ortho', config);
        view.addLayer(layer).then(menuGlobe.addLayerGUI.bind(menuGlobe));
    });
    // Create a new Layer 3d-tiles For DiscreteLOD
    // -------------------------------------------
    var $3dTilesLayerDiscreteLOD = new itowns.GeometryLayer('3d-tiles-discrete-lod', new itowns.THREE.Group());
    $3dTilesLayerDiscreteLOD.name = 'DiscreteLOD';
    $3dTilesLayerDiscreteLOD.url = 'https://raw.githubusercontent.com/AnalyticalGraphicsInc/3d-tiles-samples/master/tilesets/TilesetWithDiscreteLOD/tileset.json';
    $3dTilesLayerDiscreteLOD.protocol = '3d-tiles'
    $3dTilesLayerDiscreteLOD.overrideMaterials = true;  // custom cesium shaders are not functional
    itowns.View.prototype.addLayer.call(view, $3dTilesLayerDiscreteLOD);
    // Create a new Layer 3d-tiles For Viewer Request Volume
    // -----------------------------------------------------
    var $3dTilesLayerRequestVolume = new itowns.GeometryLayer('3d-tiles-request-volume', new itowns.THREE.Group());
    $3dTilesLayerRequestVolume.name = 'RequestVolume';
    $3dTilesLayerRequestVolume.url = 'https://raw.githubusercontent.com/AnalyticalGraphicsInc/3d-tiles-samples/master/tilesets/TilesetWithRequestVolume/tileset.json';
    $3dTilesLayerRequestVolume.protocol = '3d-tiles'
    $3dTilesLayerRequestVolume.overrideMaterials = true;  // custom cesium shaders are not functional
    $3dTilesLayerRequestVolume.sseThreshold = 1;
    // add an event for picking the 3D Tiles layer and displaying
    // information about the picked feature in an html div
    var pickingArgs = {};
    pickingArgs.htmlDiv = document.getElementById('featureInfo');
    pickingArgs.view = view;
    pickingArgs.layer = $3dTilesLayerRequestVolume;
    itowns.View.prototype.addLayer.call(view,
        $3dTilesLayerRequestVolume).then(function _() {
            window.addEventListener('mousemove', fillHTMLWithPickingInfo.bind(pickingArgs),
                false); });
    // Add the UI Debug
    var d = new debug.Debug(view, menuGlobe.gui);
    debug.createTileDebugUI(menuGlobe.gui, view, view.tileLayer, d);
    debug.create3dTilesDebugUI(menuGlobe.gui, view, $3dTilesLayerDiscreteLOD, d);
    debug.create3dTilesDebugUI(menuGlobe.gui, view, $3dTilesLayerRequestVolume, d);
    d.zoom = function() {
        view.camera.camera3D.position.set(1215013.9, -4736315.5, 4081597.5);
        view.camera.camera3D.quaternion.set(0.9108514448729665, 0.13456816437801225, 0.1107206134840362, 0.3741416847378546);
        view.notifyChange(view.camera.camera3D);
    }
    menuGlobe.gui.add(d, 'zoom').name('Go to point cloud');
    
    injectChOWDER(view, viewerDiv);
};