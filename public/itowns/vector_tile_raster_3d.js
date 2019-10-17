
window.onload = function() {

    // # Simple Globe viewer + a vector tile layer
    // Define initial camera position
    var positionOnGlobe = { longitude: 2.475, latitude: 48.807, altitude: 12000000 };
    var promises = [];
    // `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
    var viewerDiv = document.getElementById('viewerDiv');
    // Instanciate iTowns GlobeView*
    var view = new itowns.GlobeView(viewerDiv, positionOnGlobe);
    // define pole texture
    view.tileLayer.noTextureColor = new itowns.THREE.Color(0x95c1e1);
    view.getLayerById('atmosphere').visible = false;
    view.getLayerById('atmosphere').fog.enable = false;
    setupLoadingScreen(viewerDiv, view);
    promises.push(itowns.Fetcher.json('./layers/JSONLayers/OPENSM.json').then(function _(config) {
        config.source = new itowns.TMSSource(config.source);
        var layer = new itowns.ColorLayer('OPENSM', config);
        return view.addLayer(layer);
    }));
    // Add a vector tile layer
    promises.push(itowns.Fetcher.json('https://raw.githubusercontent.com/Oslandia/postile-openmaptiles/master/style.json').then(function (style) {
        var supportedLayers = [];
        var backgroundLayer;
        style.layers.forEach(function(layer) {
            if (layer.type === 'background') {
                backgroundLayer = layer;
            } else if (['fill', 'line'].indexOf(layer.type) >= 0 &&
                ['landcover', 'water', 'boundary', 'transportation', 'park'].indexOf(layer['source-layer']) >= 0 &&
                layer.id.indexOf('bridge') < 0 &&
                layer.id.indexOf('tunnel') < 0 &&
                layer.id.indexOf('admin_sub') < 0) {
                supportedLayers.push(layer);
            }
        });
        function inter(z) {
            return z - (z % 5);
        }
        function isValidData(data, extentDestination) {
            const isValid = inter(extentDestination.zoom) == inter(data.extent.zoom);
            return isValid;
        }
        var mvtSource = new itowns.TMSSource({
            // eslint-disable-next-line no-template-curly-in-string
            url: 'https://osm.oslandia.io/data/v3/${z}/${x}/${y}.pbf',
            format: 'application/x-protobuf;type=mapbox-vector',
            attribution: {
                name: 'OpenStreetMap',
                url: 'http://www.openstreetmap.org/',
            },
            zoom: {
                min: 0,
                max: 13,
            },
            tileMatrixSet: 'PM',
            projection: 'EPSG:3857',
            isInverted: true,
        });
        var mvtLayer = new itowns.ColorLayer('MVT', {
            isValidData: isValidData,
            source: mvtSource,
            filter: supportedLayers,
            backgroundLayer,
            fx: 2.5,
        });
        return view.addLayer(mvtLayer);
    }));
    var menuGlobe = new GuiTools('menuDiv', view, 300, viewerDiv);
    // Listen for globe full initialisation event
    view.addEventListener(itowns.GLOBE_VIEW_EVENTS.GLOBE_INITIALIZED, function () {
        Promise.all(promises).then(function () {
            menuGlobe.addImageryLayersGUI(view.getLayers(function (l) { return l.isColorLayer; }));
            itowns.ColorLayersOrdering.moveLayerToIndex(view, 'Ortho', 0);
        }).catch(console.error);
    });
    //debug.createTileDebugUI(menuGlobe.gui, view);
    
    injectChOWDER(view, viewerDiv);
};