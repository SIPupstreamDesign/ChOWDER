
window.onload = function() {
    // # Simple Globe viewer + a vector tile layer

    // Define initial camera position
    var placement = {
        coord: new itowns.Coordinates('EPSG:4326', 2.475, 48.807),
        range: 12000000,
    }
    var promises = [];

    // `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
    var viewerDiv = document.getElementById('viewerDiv');

    // Instanciate iTowns GlobeView*
    var view = new itowns.GlobeView(viewerDiv, placement);
    view.mainLoop.gfxEngine.renderer.outputEncoding = itowns.THREE.sRGBEncoding;

    // define pole texture
    view.tileLayer.noTextureColor = new itowns.THREE.Color(0x95c1e1);

    view.getLayerById('atmosphere').visible = false;
    view.getLayerById('atmosphere').fog.enable = false;

    setupLoadingScreen(viewerDiv, view);

    promises.push(itowns.Fetcher.json('./Ortho.json').then(function _(config) {
        config.source = new itowns.WMTSSource(config.source);
        var layer = new itowns.ColorLayer('Ortho', config);
        return view.addLayer(layer);
    }));

    // Add a vector tile layer
    function inter(z) {
        return z - (z % 5);
    }

    function isValidData(data, extentDestination) {
        const isValid = inter(extentDestination.zoom) == inter(data.extent.zoom);
        return isValid;
    }

    promises.push(itowns.Fetcher.json('./MVT.json').then(function _(config) {
        config.source.filter = function (layer) { return ['fill', 'line'].includes(layer.type) };

        var mvtSource = new itowns.VectorTilesSource(config.source);
    
        var mvtLayer = new itowns.ColorLayer('MVT', {
            isValidData: isValidData,
            source: mvtSource,
            fx: 2.5,
        });
    
        view.addLayer(mvtLayer);
    }));
    
    //var menuGlobe = new GuiTools('menuDiv', view, 300);
    // Listen for globe full initialisation event
    view.addEventListener(itowns.GLOBE_VIEW_EVENTS.GLOBE_INITIALIZED, function () {
        Promise.all(promises).then(function () {
            //menuGlobe.addImageryLayersGUI(view.getLayers(function (l) { return l.isColorLayer; }));
            itowns.ColorLayersOrdering.moveLayerToIndex(view, 'Ortho', 0);
        }).catch(console.error);
    });

    //debug.createTileDebugUI(menuGlobe.gui, view);
    
    injectChOWDER(view, viewerDiv);
};