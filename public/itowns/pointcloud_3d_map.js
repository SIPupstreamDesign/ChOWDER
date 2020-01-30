
window.onload = function () {
    var pointcloud;
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
    pointcloud = new itowns.PointCloudLayer('eglise_saint_blaise_arles', {
        file: 'eglise_saint_blaise_arles.js',
        url: 'https://raw.githubusercontent.com/gmaillet/dataset/master/',
    }, view);

    // add pointcloud to scene
    function onLayerReady() {
        debug.PointCloudDebug.initTools(view, pointcloud, debugGui);

        // update stats window
        oldPostUpdate = pointcloud.postUpdate;
        pointcloud.postUpdate = function postUpdate() {
            var info = document.getElementById('info');
            oldPostUpdate.apply(pointcloud, arguments);
            info.textContent = 'Nb points: ' +
                pointcloud.displayedCount.toLocaleString();
        };
    }
    window.view = view;

    itowns.View.prototype.addLayer.call(view, pointcloud).then(onLayerReady);

    itowns.Fetcher.json('./layers/JSONLayers/IGN_MNT_HIGHRES.json').then(function _(config) {
        config.source = new itowns.WMTSSource(config.source);
        var layer = new itowns.ElevationLayer(config.id, config);
        view.addLayer(layer);
    });
    itowns.Fetcher.json('./layers/JSONLayers/Ortho.json').then(function _(config) {
        config.source = new itowns.WMTSSource(config.source);
        var layer = new itowns.ColorLayer(config.id, config);
        view.addLayer(layer);
    });
    
    injectChOWDER(view, viewerDiv);
};