

window.onload = function() {
    
    class MyWMTSSource extends itowns.WMTSSource {
        /**
         * @param {Object} source - An object that can contain all properties of a
         * WMTSSource and {@link Source}. Only `url` and `name` are mandatory.
         *
         * @constructor
         */
        constructor(source) {
            super(source);
            this.url = "https://cyberjapandata.gsi.go.jp/xyz/dem_png/%TILEMATRIX/%COL/%ROW.png"
        }

        urlFromExtent(extent) {
            console.error("urlFromExtent", extent)
            return super.urlFromExtent(extent);
        }
    }

    class MyTMSSource extends itowns.TMSSource {
        /**
         * @param {Object} source - An object that can contain all properties of a
         * WMTSSource and {@link Source}. Only `url` and `name` are mandatory.
         *
         * @constructor
         */
        constructor(source) {
            super(source);
            this.url = "https://cyberjapandata.gsi.go.jp/xyz/std/%TILEMATRIX/%COL/%ROW.png"
        }

        urlFromExtent(extent) {
            console.error("STD urlFromExtent", extent)
            return super.urlFromExtent(extent);
        }
    }

    // for measure performance
    var startTime = performance.now();
    
    // # Simple Globe viewer
    // Define initial camera position
    var placement  = { 
        coord : new itowns.Coordinates("EPSG:4326", 139.839478, 35.652832, 0),
        range: 250000
    };

    // `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
    var viewerDiv = document.getElementById('viewerDiv');
    var miniDiv = document.getElementById('miniDiv');
    // Instanciate iTowns GlobeView*
    var view = new itowns.GlobeView(viewerDiv, placement );
    setupLoadingScreen(viewerDiv, view);
    
    // This layer is defined in a json file but it could be defined as a plain js
    // object. See Layer* for more info.
    itowns.Fetcher.json('./layers/JSONLayers/OPENSM.json').then(function _(config) {
        config.source = new MyTMSSource(config.source);
        var layer = new itowns.ColorLayer('OPENSM', config);
        view.addEventListener(itowns.VIEW_EVENTS.LAYERS_INITIALIZED, () =>{
            console.log("loaded")
        });
        
        view.addLayer(layer).then(menuGlobe.addLayerGUI.bind(menuGlobe));
    });

    // Add two elevation layers.
    // These will deform iTowns globe geometry to represent terrain elevation.
    function addElevationLayerFromConfig(config) {
        config.source = new MyWMTSSource(config.source);

        let layer = new itowns.ElevationLayer(config.id, config);
        view.addLayer(layer).then(menuGlobe.addLayerGUI.bind(menuGlobe));
        layer.scale = 10.0;
    }

    let textureFloatOrg = itowns.Fetcher.textureFloat;

    /*
    const arrayBuffer = (url, options = {}) => fetch(url, options).then((response) => {
        //checkResponse(response);
        return response.arrayBuffer();
    });
    
    let textureFloat = (url, options = {}) => {
        return arrayBuffer(url, options).then((buffer) => {
            const floatArray = new Float32Array(buffer);
            const texture = getTextureFloat(floatArray);
            return texture;
        });
    };
    */

    itowns.Fetcher.json('./layers/JSONLayers/WORLD_DTM.json').then(addElevationLayerFromConfig);
    //itowns.Fetcher.json('./layers/JSONLayers/IGN_MNT_HIGHRES.json').then(addElevationLayerFromConfig);
    var menuGlobe = new GuiTools('menuDiv', view, null, viewerDiv);
    var divScaleWidget = document.getElementById('divScaleWidget');
    function updateScaleWidget() {
        var value = view.controls.pixelsToMeters(200);
        value = Math.floor(value);
        var digit = Math.pow(10, value.toString().length - 1);
        value = Math.round(value / digit) * digit;
        var pix = view.controls.metersToPixels(value);
        var unit = 'm';
        if (value >= 1000) {
            value /= 1000;
            unit = 'km';
        }
        divScaleWidget.innerHTML = `${value} ${unit}`;
        divScaleWidget.style.width = `${pix}px`;
    }
    // Listen for globe full initialisation event
    view.addEventListener(itowns.GLOBE_VIEW_EVENTS.GLOBE_INITIALIZED, function () {
        // eslint-disable-next-line no-console
        console.info('Globe initialized');
        updateScaleWidget();
    });
    view.controls.addEventListener(itowns.CONTROL_EVENTS.RANGE_CHANGED, function () {
        updateScaleWidget();
    });

    injectChOWDER(view, viewerDiv, startTime);
    debug.createTileDebugUI(menuGlobe.gui, view);
    var menuDiv = document.getElementById('menuDiv');
    if (menuDiv) {
        menuDiv.style.position = "absolute";
        menuDiv.style.top = "10px";
        menuDiv.style.left = "10px";
    }
};