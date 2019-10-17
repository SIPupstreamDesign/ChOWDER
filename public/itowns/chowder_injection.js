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

    // canvasをArrayBufferに
    function toArrayBuffer(canvas) {
        const mime = "image/png";
        var base64 = canvas.toDataURL(mime);
        // Base64からバイナリへ変換
        var bin = atob(base64.replace(/^.*,/, ''));
        var buffer = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) {
            buffer[i] = bin.charCodeAt(i);
        }
        return buffer.buffer;
    }

    // canvasをblobに
    function toBlob(canvas) {
        const mime = "image/png";
        var base64 = canvas.toDataURL(mime);
        // Base64からバイナリへ変換
        var bin = atob(base64.replace(/^.*,/, ''));
        var buffer = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) {
            buffer[i] = bin.charCodeAt(i);
        }
        // Blobを作成
        var blob = new Blob([buffer.buffer], {
            type: mime
        });
        return blob;
    }

    function resizeToThumbnail(srcCanvas) {
        var width = document.body.clientWidth;
        var height = document.body.clientHeight;
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 256 * (height / width);
        ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, canvas.width, canvas.height);
        return toArrayBuffer(canvas);
    }

    function disableITownResizeFlow() {
        // Display以外はリサイズを弾く
        if (window.chowder_itowns_view_type !== "display") { return; }
        window.removeEventListener("resize");
    }
    
    function injectChOWDERiTownCallbacks(view, viewerDiv) {
        var resizeWindow = function (rect) {
            if (!rect) return;
            var width = document.body.clientWidth;
            var height = document.body.clientHeight;
            var fullWidth = width;
            var fullHeight = height;
            
            document.body.style.pointerEvents = "none"
            viewerDiv.style.left = parseInt(rect.x) + "px";
            viewerDiv.style.top = parseInt(rect.y) + "px";
            viewerDiv.style.width = parseInt(rect.w) + "px";
            viewerDiv.style.height = parseInt(rect.h) + "px";
            viewerDiv.style.position = "relative";
            view.camera.camera3D.setViewOffset(fullWidth, fullHeight, rect.x, rect.y, rect.w, rect.h)
            //console.error(fullWidth, fullHeight, rect.x, rect.y, rect.w, rect.h)
            view.mainLoop.gfxEngine.renderer.setSize(rect.w, rect.h);
            view.notifyChange(view.camera.camera3D);
        }

        window.chowder_itowns_update_camera_callback = (function () {
            return function (mat) {
                applyCameraWorldMat(view, mat);
            };
        }());
        window.chowder_itowns_resize_callback = resizeWindow;
    };
    
    //var initialWorldMat = null;
    function injectAsChOWDERiTownController(view, viewerDiv)
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

        var done = false;

        var interval = 500;
        var timer;
        var thumbnail;
        var count = 0;
        view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, function () {
            // サムネイルを即時作成
            if (!done) {
                var canvas = viewerDiv.getElementsByTagName('canvas')[0];
                thumbnail = resizeToThumbnail(canvas);
                ++count;
            }
            // 一定間隔同じイベントが来なかったら実行
            clearTimeout(timer);
            timer = setTimeout((function () {
                return function () {
                    if (!done && count > 1) {
                        if (window.hasOwnProperty("chowder_itowns_update_thumbnail")) {
                            window.chowder_itowns_update_thumbnail(thumbnail)
                            done = true;
                        }
                    }
                }
            }()), interval);
        });

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

    window.injectChOWDER = function (view, viewerDiv) {
        var done = false;
        view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, function () {
            if (!done) {
                if (window.chowder_itowns_view_type === "itowns") {
                    // itowns追加用コントローラーからひかれた(itowns画面に対して操作可)
                    injectAsChOWDERiTownController(view, viewerDiv);
                } else {
                    // displayまたはcontrollerから開かれた(itowns画面に対して操作不可)
                    disableITownResizeFlow();
                }
                done = true;
            }
        });
        // windowオブジェクトに対してコールバックを即時設定.
        injectChOWDERiTownCallbacks(view, viewerDiv);
    };
}());