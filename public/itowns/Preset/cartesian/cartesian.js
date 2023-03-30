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
        layer.visible = false;
        view.addLayer(layer);
        if (callback) { callback(); }
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
    view.camera.camera3D.far = itowns.ellipsoidSizes.x * 30;
    view.camera.resize(viewerDiv.clientWidth, viewerDiv.clientHeight);
    view.mainLoop.gfxEngine.renderer.outputEncoding = itowns.THREE.sRGBEncoding;

    loadGSIColor(view, function () {
        view.notifyChange();
    });
    hideAllLayers(view);

    var grid = new itowns.THREE.GridHelper( 10000000, 10);
    grid.geometry.rotateX(Math.PI / 2);
    view.scene.add(grid);

    var axes = new itowns.THREE.AxesHelper(10000000 * 2);
    view.scene.add(axes);

    const light = new THREE.AmbientLight(0xFFFFFF,  0.3);
    view.scene.add(light);

    const sun = new THREE.DirectionalLight(0xFFFFFF, 0.7);
    sun.position.set(1, 1, 1);
    sun.updateMatrixWorld(true);
    view.scene.add(sun);

    var controls = new itowns.EarthControls(view, placement, { isOrbitMode : true });
    view.controls = controls;

    // itownsコントローラから開かれた場合のみコントロールを表示
    var done = false;
    view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, (evt) => {
        if (!done && window.chowder_itowns_view_type === "itowns") {
            var wrap = document.createElement('span');
            wrap.style.position = "absolute";
            wrap.style.left = "30px";
            wrap.style.bottom = "30px";
            wrap.style.zIndex = 1;
            var gridOnOff = document.createElement('input');
            gridOnOff.type = "checkbox"
            gridOnOff.style.width = "20px";
            gridOnOff.style.height = "20px";
            gridOnOff.checked = true;
            wrap.appendChild(gridOnOff)
            var gridText = document.createElement('span');
            gridText.style.fontSize = "16px";
            gridText.style.color = "white"
            gridText.textContent = "Grid On/Off";
            wrap.appendChild(gridText)
            gridOnOff.onchange = function () {
                axes.visible = gridOnOff.checked;
                grid.visible = gridOnOff.checked;
                view.notifyChange();
            };
    
            document.body.appendChild(wrap)
            done = true;
        }
    });
    
    injectChOWDER(view, viewerDiv);
};