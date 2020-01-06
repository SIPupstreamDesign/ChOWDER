

window.onload = function () {


    class MyWMTSSource extends itowns.TMSSource {
        /**
         * @param {Object} source - An object that can contain all properties of a
         * WMTSSource and {@link Source}. Only `url` and `name` are mandatory.
         *
         * @constructor
         */
        constructor(source) {
            super(source);
            this.isInverted = true;
            super.isInverted = true;
            this.url = "https://cyberjapandata.gsi.go.jp/xyz/dem_png/%TILEMATRIX/%COL/%ROW.png"
        }

        urlFromExtent(extent) {
            let newExtent = JSON.parse(JSON.stringify(extent));
            console.log("urlFromExtent", extent, newExtent)
            return super.urlFromExtent(newExtent);
        }

        /*
        extentInsideLimit(extent) {
            let result = super.extentInsideLimit(extent);
            console.error("extentInsideLimit", result);
            return result;
        }
        */
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
            //console.log("STD urlFromExtent", extent)
            return super.urlFromExtent(extent);
        }
    }

    // for measure performance
    var startTime = performance.now();

    // # Simple Globe viewer
    // Define initial camera position
    var placement = {
        coord: new itowns.Coordinates("EPSG:4326", 139.839478, 35.652832, 0),
        range: 250000
    };

    // `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
    var viewerDiv = document.getElementById('viewerDiv');
    var miniDiv = document.getElementById('miniDiv');
    // Instanciate iTowns GlobeView*
    var view = new itowns.GlobeView(viewerDiv, placement);
    setupLoadingScreen(viewerDiv, view);

    // This layer is defined in a json file but it could be defined as a plain js
    // object. See Layer* for more info.
    itowns.Fetcher.json('./layers/JSONLayers/OPENSM.json').then(function _(config) {
        config.source = new MyTMSSource(config.source);
        var layer = new itowns.ColorLayer('OPENSM', config);
        view.addEventListener(itowns.VIEW_EVENTS.LAYERS_INITIALIZED, () => {
            console.log("loaded")
        });

        view.addLayer(layer).then(menuGlobe.addLayerGUI.bind(menuGlobe));
    });

    // Add two elevation layers.
    // These will deform iTowns globe geometry to represent terrain elevation.
    function addElevationLayerFromConfig(config) {
        const getTextureFloat = function getTextureFloat(buffer) {
            return new itowns.THREE.DataTexture(buffer, 256, 256, itowns.THREE.AlphaFormat, itowns.THREE.FloatType);
        };
        const textureLoader = new itowns.THREE.TextureLoader();
        let texture2D = function (url, options = {}) {
            let res;
            let rej;
            textureLoader.crossOrigin = options.crossOrigin;
            const promise = new Promise((resolve, reject) => {
                res = resolve;
                rej = reject;
            });
            textureLoader.load(url, res, () => { }, rej);
            return promise;
        }

        console.error(config)
        config.source.fetcher = function (url, options = {}) {
            return texture2D(url, options).then((tex) => { // bufferはpng画像
                if (window.isDownload)
                {
                    download(tex.image.src);
                }

                let canvas = document.createElement("canvas");
                canvas.width = "256";
                canvas.height = "256";
                let context = canvas.getContext('2d');
                context.drawImage(tex.image, 0, 0);
                let pixData = context.getImageData(0, 0, 256, 256).data;
                let alt;
                let heights = [];
                for (let y = 0; y < 256; y++) {
                    for (let x = 0; x < 256; x++) {
                        let addr = (x + y * 256) * 4;
                        let R = pixData[addr];
                        let G = pixData[addr + 1];
                        let B = pixData[addr + 2];
                        //let A = pixData[addr + 3];
                        if (R == 128 && G == 0 && B == 0) {
                            alt = 0;
                        } else {
                            alt = (R * 65536 + G * 256 + B);
                            if (alt > 8388608) {
                                alt = (alt - 16777216);
                            }
                            alt = alt * 0.01;
                        }
                        heights.push(alt);
                    }
                }

                const floatArray = new Float32Array(heights);
                const texture = getTextureFloat(floatArray);
                return texture;
            });
        }

        config.source = new MyWMTSSource(config.source);

        let layer = new itowns.ElevationLayer(config.id, config);
        view.addLayer(layer).then(menuGlobe.addLayerGUI.bind(menuGlobe));
        layer.scale = 1.0;
    }

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