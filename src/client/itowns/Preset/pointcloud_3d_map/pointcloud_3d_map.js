
window.onload = function () {
    var potreeLayer;
    var oldPostUpdate;
    var viewerDiv;
    var debugGui;
    var view;

    viewerDiv = document.getElementById('viewerDiv');
    viewerDiv.style.display = 'block';

    debugGui = new dat.GUI();

    var placement = {
        coord: new itowns.Coordinates('EPSG:4326', 4.631512, 43.675626),
        range: 100,
        tilt: 45,
        heading: -60
    }

    view = new itowns.GlobeView(viewerDiv, placement, { handleCollision: false });
    setupLoadingScreen(viewerDiv, view);

    view.controls.minDistance = 50;

    // Configure Point Cloud layer
    potreeLayer = new itowns.PotreeLayer('eglise_saint_blaise_arles', {
        source: new itowns.PotreeSource({
            file: 'eglise_saint_blaise_arles.js',
            url: 'https://raw.githubusercontent.com/gmaillet/dataset/master/',
            projection: view.referenceCrs,
        }),
    });
    view.mainLoop.gfxEngine.renderer.outputEncoding = itowns.THREE.sRGBEncoding;

    // add pointcloud to scene
    /*
    function onLayerReady() {
        debug.PointCloudDebug.initTools(view, potreeLayer, debugGui);

        // update stats window
        oldPostUpdate = potreeLayer.postUpdate;
        potreeLayer.postUpdate = function postUpdate() {
            var info = document.getElementById('info');
            oldPostUpdate.apply(potreeLayer, arguments);
            info.textContent = 'Nb points: ' +
                potreeLayer.displayedCount.toLocaleString();
        };
    }
    */
    window.view = view;

    itowns.View.prototype.addLayer.call(view, potreeLayer);//.then(onLayerReady);

    itowns.Fetcher.json('./IGN_MNT_HIGHRES.json').then(function _(config) {
        config.source = new itowns.WMTSSource(config.source);
        var layer = new itowns.ElevationLayer(config.id, config);
        view.addLayer(layer);
    });
    itowns.Fetcher.json('./Ortho.json').then(function _(config) {
        config.source = new itowns.WMTSSource(config.source);
        var layer = new itowns.ColorLayer(config.id, config);
        view.addLayer(layer);
    });
    
    injectChOWDER(view, viewerDiv);
};