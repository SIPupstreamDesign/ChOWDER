
window.onload = function() {
    // for measure performance
    var startTime = performance.now();
    
    // # Simple Globe viewer
    // Define initial camera position
    var positionOnGlobe = { longitude: 139.839478, latitude: 35.652832, altitude: 250000 };
    var miniView;
    var minDistance = 10000000;
    var maxDistance = 30000000;
    // `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
    var viewerDiv = document.getElementById('viewerDiv');
    var miniDiv = document.getElementById('miniDiv');
    // Instanciate iTowns GlobeView*
    var view = new itowns.GlobeView(viewerDiv, positionOnGlobe);
    view.mainLoop.gfxEngine.renderer.outputEncoding = itowns.THREE.sRGBEncoding;
    setupLoadingScreen(viewerDiv, view);
    // Dont' instance mini viewer if it's Test env
    miniView = new itowns.GlobeView(miniDiv, positionOnGlobe, {
        // `limit globe' subdivision level:
        // we're don't need a precise globe model
        // since the mini globe will always be seen from a far point of view (see minDistance above)
        maxSubdivisionLevel: 2,
        // Don't instance default controls since miniview's camera will be synced
        // on the main view's one (see view.addFrameRequester)
        noControls: true
    });
    // Set a 0 alpha clear value (instead of the default '1')
    // because we want a transparent background for the miniglobe view to be able
    // to see the main view "behind"
    miniView.mainLoop.gfxEngine.renderer.setClearColor(0x000000, 0);
    // update miniview's camera with the view's camera position
    view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, function updateMiniView() {
        // clamp distance camera from globe
        var distanceCamera = view.camera.camera3D.position.length();
        var distance = Math.min(Math.max(distanceCamera * 1.5, minDistance), maxDistance);
        var camera = miniView.camera.camera3D;
        var cameraTargetPosition = view.controls.getCameraTargetPosition();
        // Update target miniview's camera
        camera.position.copy(cameraTargetPosition).setLength(distance);
        camera.lookAt(cameraTargetPosition);
        miniView.notifyChange(camera);
    });
    // Add one imagery layer to the scene and the miniView
    // This layer is defined in a json file but it could be defined as a plain js
    // object. See Layer* for more info.
    itowns.Fetcher.json('./OPENSM.json').then(function _(config) {
        config.source = new itowns.TMSSource(config.source);
        var layer = new itowns.ColorLayer('OPENSM', config);
        view.addEventListener(itowns.VIEW_EVENTS.LAYERS_INITIALIZED, () =>{
            console.log("loaded")
        });
        
        view.addLayer(layer).then(menuGlobe.addLayerGUI.bind(menuGlobe));
        var miniLayer = new itowns.ColorLayer('OPENSMMini', config);
        miniView.addLayer(miniLayer);
    });
    // Add two elevation layers.
    // These will deform iTowns globe geometry to represent terrain elevation.
    function addElevationLayerFromConfig(config) {
        config.source = new itowns.WMTSSource(config.source);
        var layer = new itowns.ElevationLayer(config.id, config);
        view.addLayer(layer).then(menuGlobe.addLayerGUI.bind(menuGlobe));
        layer.scale = 1.0;
    }
    itowns.Fetcher.json('./WORLD_DTM.json').then(addElevationLayerFromConfig);
    itowns.Fetcher.json('./IGN_MNT_HIGHRES.json').then(addElevationLayerFromConfig);
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
    //debug.createTileDebugUI(menuGlobe.gui, view);
};