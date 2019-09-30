(function () {
    var i;
    var originalAddEventListener = window.addEventListener;
    var resizeListeners = [];
    window.addEventListener = function (type, listener, capture) {
        if (type === "resize") {
            resizeListeners.push(listener);
        }
        originalAddEventListener(type, listener, capture);
    };

    var originalRemoveEventListener = window.removeEventListener;
    window.removeEventListener = function (type, listener, capture) {
        if (type === "resize" && listener == undefined) {
            for (i = 0; i < resizeListeners.length; ++i) {
                originalRemoveEventListener(type, resizeListeners[i], capture);
            }
            resizeListeners = []; 
        } else {
            originalRemoveEventListener(type, listener, capture);
        }
    };
    
    // カメラにworldMatを設定して動かす
    function applyCameraWorldMat(view, worldMat) {
        view.camera.camera3D.matrixAutoUpdate = false;
        view.camera.camera3D.matrixWorld.elements = worldMat;

        var d = new itowns.THREE.Vector3(),
            q = new itowns.THREE.Quaternion(),
            s = new itowns.THREE.Vector3();
        view.camera.camera3D.matrixWorld.decompose( d, q, s );
        view.camera.camera3D.position.copy( d );
        view.camera.camera3D.quaternion.copy( q );
        view.camera.camera3D.scale.copy( s );
        view.camera.camera3D.matrixAutoUpdate = true;
        view.notifyChange(view.camera.camera3D);
    }

    function injectChOWDER(view, viewerDiv)
    {
        var width = viewerDiv.getBoundingClientRect().right - viewerDiv.getBoundingClientRect().left;
        var height = viewerDiv.getBoundingClientRect().bottom - viewerDiv.getBoundingClientRect().top;
        var fullWidth = width;
        var fullHeight = height;
        window.removeEventListener("resize");
        setTimeout((function () {
            return function () {
                var rect = document.body.rect;
                if (!rect) return;
                document.body.style.pointerEvents = "none"
                viewerDiv.style.left = parseInt(rect.x) + "px";
                viewerDiv.style.top = parseInt(rect.y) + "px";
                viewerDiv.style.width = parseInt(rect.w) + "px";
                viewerDiv.style.height = parseInt(rect.h) + "px";
                viewerDiv.style.position = "relative";
                view.camera.camera3D.setViewOffset(fullWidth, fullHeight, rect.x, rect.y, rect.w, rect.h)
                console.error(rect.x, rect.y, rect.w, rect.h)
                view.mainLoop.gfxEngine.renderer.setSize(rect.w, rect.h);
                view.notifyChange();
            };
        }()), 1000);

        window.chowder_itowns_update_camera_callback = (function () {
            return function (mat) {
                applyCameraWorldMat(view, mat);
            };
        }());
    };
    
    //var initialWorldMat = null;
    function injectAsChOWDERiTownController(view)
    {
        var worldMat = JSON.stringify(view.camera.camera3D.matrixWorld.elements);
        view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_CAMERA_UPDATE, (function () {
            return function () {
                var mat = JSON.stringify(view.camera.camera3D.matrixWorld.elements);
                if (worldMat !== mat) {
                    // カメラが動いた.
                    worldMat = mat;
                    if (window.hasOwnProperty("chowder_itowns_update_camera")) {
                        window.chowder_itowns_update_camera(mat);
                    }
                }
            };
        }()));

        /*
        window.addEventListener('mousedown', (function () {
            return function (ev) {
                if (ev.button === 1) {
                    initialWorldMat = JSON.stringify(view.camera.camera3D.matrixWorld.elements);
                }
                if (ev.button === 2) {
                    applyCameraWorldMat(view, JSON.parse(initialWorldMat));
                }
            };
        }()));
        */
    }

    window.injectChOWDER = injectChOWDER;
    window.injectAsChOWDERiTownController = injectAsChOWDERiTownController;
}());