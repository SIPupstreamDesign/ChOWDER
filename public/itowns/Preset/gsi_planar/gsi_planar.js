/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

/// 地理院地図(Color,Elevation)を3D平面で表示する

window.onload = function () {

    // 地理院地図(Color)の読み込み
    function loadGSIColor() {
        itowns.Fetcher.json('./gsi.json').then(function (config) {
            var mapSource = new itowns.TMSSource(config.source);
            var layer = new itowns.ColorLayer(config.id, {
                source: mapSource,
                updateStrategy: {
                    type: 3
                },
                opacity: 1.0
            });
            view.addLayer(layer);//.then(menuGlobe.addLayerGUI.bind(menuGlobe));
        });
    }

    function getTextureFloat(buffer, view) {
        // webgl2
        if (view.mainLoop.gfxEngine.renderer.capabilities.isWebGL2)
        {
            const texture = new itowns.THREE.DataTexture(buffer, 256, 256, itowns.THREE.RedFormat, itowns.THREE.FloatType);
            texture.internalFormat = 'R32F';
            return texture;
        }
        else
        {
            // webgl1
            return new itowns.THREE.DataTexture(buffer, 256, 256, itowns.THREE.AlphaFormat, itowns.THREE.FloatType);
        }
    }

    // 地理院地図(Elevation/CSV)の読み込み
    function loadGSIElevationCSV() {
        var url = "https://cyberjapandata.gsi.go.jp/xyz/dem/%TILEMATRIX/%COL/%ROW.txt";
        var config = {
            "id": "GSI Elevation",
            "projection": "EPSG:3857",
            "format": url.indexOf('.png') > 0 ? "image/png" : "",
            "url": url,
            "tileMatrixSet": "PM",
            "zoom" : {
                "min" : 2,
                "max" : 12
            }
        };

        function checkResponse(response) {
            if (!response.ok) {
                var error = new Error(`Error loading ${response.url}: status ${response.status}`);
                error.response = response;
                throw error;
            }
        }

        var text = function (url, options = {}) {
            return fetch(url, options).then((response) => {
                checkResponse(response);
                return response.text();
            });
        };

        var mapSource = new itowns.TMSSource(config);
        mapSource.fetcher = function (url, options = {}) {
            return text(url, options).then((data) => {
                var LF = String.fromCharCode(10);
                var lines = data.split(LF);
                var heights = [];
                for (var i = 0; i < lines.length; i++) {
                    var sp = lines[i].split(",");
                    for (var j = 0; j < sp.length; j++) {
                        if (sp[j] == "e") {
                            heights.push(0);
                        } else {
                            heights.push(Number(sp[j]));
                        }
                    }
                }
                var floatArray = new Float32Array(heights);
                var texture = getTextureFloat(floatArray, view);
                return texture;
            });
        };
        var layer = new itowns.ElevationLayer(config.id, {
            source: mapSource,
            updateStrategy: {
                type: 3
            },
            scale: 1
        });
        view.addLayer(layer);
    }

    // 地理院地図(Elevation/PNG)の読み込み
    function loadGSIElevationPNG() {
        itowns.Fetcher.json('./gsi_elevation.json').then(function (config) {
            var url = config.source.url;
            var textureLoader = new itowns.THREE.TextureLoader();
            function texture(url, options = {}) {
                var res;
                var rej;
                textureLoader.crossOrigin = options.crossOrigin;
                const promise = new Promise((resolve, reject) => {
                    res = resolve;
                    rej = reject;
                });
                textureLoader.load(url, res, () => { }, rej);
                return promise;
            }
            var canvas = document.createElement("canvas");
            canvas.width = "256";
            canvas.height = "256";
    
            function convertTexToArray(tex) {
                var context = canvas.getContext('2d');
                context.drawImage(tex.image, 0, 0);
                var pixData = context.getImageData(0, 0, 256, 256).data;
                var heights = []
                var alt = 0;
                for (var y = 0; y < 256; ++y) {
                    for (var x = 0; x < 256; x++) {
                        var addr = (x + y * 256) * 4;
                        var R = pixData[addr];
                        var G = pixData[addr + 1];
                        var B = pixData[addr + 2];
                        var A = pixData[addr + 3];
                        if (R == 128 && G == 0 && B == 0) {
                            alt = 0;
                        } else {
                            //                          alt = (R << 16 + G << 8 + B);
                            alt = (R * 65536 + G * 256 + B);
                            if (alt > 8388608) {
                                alt = (alt - 16777216);
                            }
                            alt = alt * 0.01;
                        }
                        heights.push(alt);
                    }
                }
                return heights;
            }
            var mapSource = new itowns.TMSSource(config.source);
            mapSource.fetcher = function (url, options = {}) {
                return texture(url, options).then(function (tex) {
                    var floatArray = convertTexToArray(tex);
                    var float32Array = new Float32Array(floatArray);
                    var tt = getTextureFloat(float32Array, view);
                    return tt;
                });
            };
            var layer = new itowns.ElevationLayer(config.id, {
                source: mapSource,
                updateStrategy: {
                    type: 3
                },
                scale: 1
            });
            view.addLayer(layer);
        });
    }

    // `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
    var viewerDiv = document.getElementById('viewerDiv');

    var extent = new itowns.Extent(
        'EPSG:3857',
        -20037508.342789244, 20037508.342789244,
        -20037508.342789244, 20037508.342789244)

    var placement = {
        coord: new itowns.Coordinates("EPSG:4326", 138.7539, 35.3539),
        range: 25000
    };

    var view = new itowns.PlanarView(viewerDiv, extent, {
        placement: placement,
        maxSubdivisionLevel: 20
    });

    new itowns.PlanarControls(view, {
        maxAltitude: 40000000
    });

    loadGSIColor();

    loadGSIElevationPNG();

    injectChOWDER(view, viewerDiv);
};