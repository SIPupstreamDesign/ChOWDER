



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
            "updateStrategy": {
                "type": 3
            },
            "zoom" : {
                "min" : 5,
                "max" : 18
            },
            "opacity": 1.0
        };
        var mapSource = new itowns.TMSSource(config);
        var layer = new itowns.ColorLayer(config.id, {
            source: mapSource,
            updateStrategy: {
                type: 3
            },
        });
        view.addLayer(layer);
    }

    // `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
    var viewerDiv = document.getElementById('viewerDiv');

    var placement = {
        coord: new itowns.Coordinates("EPSG:4326", 138.7539, 35.3539),
        range: 25000
    };

    var view = new itowns.GlobeView(viewerDiv, placement);

    loadGSIColor();

    injectChOWDER(view, viewerDiv);
};