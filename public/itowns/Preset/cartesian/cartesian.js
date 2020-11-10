/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

/// 地理院地図(Color)を3D球体で表示する
import { OBJLoader } from "./three/OBJLoader.js";

function hideAllLayers(view) {
    var layers = view.getLayers();
    for (var i = 0; i < layers.length; ++i) {
        layers[i].visible = false;
    }
}


// 地理院地図(Color)の読み込み
function loadGSIColor(view, callback) {
    itowns.Fetcher.json('./gsi.json').then(function (config) {
        var mapSource = new itowns.TMSSource(config.source);
        var layer = new itowns.ColorLayer(config.id, {
            source: mapSource,
            updateStrategy: {
                type: 3
            },
        });
        view.addLayer(layer);
        if (callback) { callback(); }
    });
}

function loadObjLayer(view, callback) {
    var manager = new itowns.THREE.LoadingManager();
    var objLoader = new OBJLoader(manager);
    objLoader.load('teapot.obj', function (object) {
        console.log(object);
        console.log(object.children[0].geometry);
        var material = new THREE.MeshBasicMaterial({color: 0x6699FF})
        for (var i = 0; i < object.children.length; ++i) {
            object.children[i].geometry.scale(100000, 100000, 100000);
            object.children[i].material = material;
        }
        view.scene.add(object);
        view.notifyChange();  
        // fitCamera(object,camera);
    });
}

window.onload = function () {
    // `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
    var viewerDiv = document.getElementById('viewerDiv');

    var placement = {
        coord: new itowns.Coordinates('EPSG:4326', 0, 0),
        range: 25e6
    };
    var view = new itowns.GlobeView(viewerDiv, placement, {
        noControls : true
    });

    loadGSIColor(view, function () {
        hideAllLayers(view);
        view.notifyChange();
    });

    var grid = new itowns.THREE.GridHelper( 10000000, 10);
    grid.geometry.rotateX(Math.PI / 2);
    view.scene.add(grid);

    var axes = new itowns.THREE.AxesHelper(10000000 * 2);
    view.scene.add(axes);

    var controls = new itowns.OrbitControls(view, { focusOnClick: true});

    // objを出す
    loadObjLayer(view);

    injectChOWDER(view, viewerDiv);
};