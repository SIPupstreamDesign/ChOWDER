/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

/// 地理院地図(Color,Elevation)を3D平面で表示する

window.onload = function () {

    // 地理院地図(Color)の読み込み
    function loadGSIColor() {
        var url = "https://cyberjapandata.gsi.go.jp/xyz/std/%TILEMATRIX/%COL/%ROW.png";
        if (url.indexOf("${z}") >= 0) {
            url = url.split("${z}").join("%TILEMATRIX");
        }
        if (url.indexOf("${x}") >= 0) {
            url = url.split("${x}").join("%COL");
        }
        if (url.indexOf("${y}") >= 0) {
            url = url.split("${y}").join("%ROW");
        }
        var config = {
            "id": "GSI Color",
            "projection": "EPSG:3857",
            "isInverted": true,
            "format": "image/png",
            "url": url,
            "tileMatrixSet": "PM",
            "zoom" : {
                "min" : 5,
                "max" : 18
            }
        };
        var mapSource = new itowns.TMSSource(config);
        var layer = new itowns.ColorLayer(config.id, {
            source: mapSource,
            updateStrategy: {
                type: 3
            },
            opacity: 1.0
        });
        view.addLayer(layer);//.then(menuGlobe.addLayerGUI.bind(menuGlobe));
    }

    // 地理院地図(Elevation)の読み込み
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
        var getTextureFloat = function getTextureFloat(buffer) {
            return new itowns.THREE.DataTexture(buffer, 256, 256, itowns.THREE.AlphaFormat, itowns.THREE.FloatType);
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
                var texture = getTextureFloat(floatArray);
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
        maxAltitude: 400000
    });

    loadGSIColor();

    loadGSIElevationCSV();

    injectChOWDER(view, viewerDiv);
};