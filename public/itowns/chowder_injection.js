(function () {
    var messageID = 1;
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
        //return toArrayBuffer(canvas);
        return canvas.toDataURL("image/jpeg");
    }

    function disableITownResizeFlow() {
        // Display以外はリサイズを弾く
        if (window.chowder_itowns_view_type !== "display") { return; }
        window.removeEventListener("resize");
    }
    
    var ColorMapSource = function (source) {
        itowns.TMSSource.call(this, source);
        this.url = source.url;
    };
	ColorMapSource.prototype = Object.create(itowns.TMSSource.prototype);

    // マップ追加
    function addMap(view, params) {
        var url = params.url;
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
            "projection": "EPSG:3857",
            "isInverted": true,
            "format": "image/png",
            "url": url,
            "tileMatrixSet": "PM",
            "updateStrategy": {
                "type": 3
            },
        };
        if (params.hasOwnProperty('id')) {
            config.id = params.id;
        }
        if (params.hasOwnProperty('zoom')) {
            config.zoom = params.zoom;
        }
        if (params.hasOwnProperty('format')) {
            config.format = params.format;
        }
        var mapSource = new itowns.TMSSource(config);
        var colorLayer = new itowns.ColorLayer(config.id, {
            source: mapSource
        });
        view.addLayer(colorLayer);
    }

    // マップ削除
    function deleteMap(view, params) {
        var id = params.id;
        var layers = view.getLayers();
        var layer;
        for (var i = 0; i < layers.length; ++i) {
            layer = layers[i];
            if (layer.id === id) {
                view.removeLayer(id);
                break;
            }
        }
    }

    // マップ順序変更
    function changeMapOrder(view, params) {
        var id = params.id;
        var isUp = params.isUp ? true : false;
        var layers = view._layers[0].attachedLayers;
        var layer;
        console.log("pre", layers)
        for (var i = 0; i < layers.length; ++i) {
            layer = layers[i];
            if (layer.id === id) {
                if (isUp && i > 0) {
                    console.error("up!", view, id)
                    itowns.ColorLayersOrdering.moveLayerUp(view, id);
                    layers.splice(i - 1, 2, layers[i], layers[i-1]);
                    console.log(layers)
                    view.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED});
                    view.notifyChange();
                } else if (i < (layer.length - 1)) {
                    itowns.ColorLayersOrdering.moveLayerDown(view, id);
                    layers.splice(i, 2, layers[i+1], layers[i]);
                    console.log(layers)
                    view.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED});
                    view.notifyChange();
                }
                break;
            }
        }
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

        window.addEventListener('message', function (evt) {
            try {
                var data = JSON.parse(evt.data);
                console.error(data)
                // 親フレームから情報を受け取り
                if (data.method === "chowder_itowns_update_camera_callback") 
                {
                    // カメラ更新命令
                    applyCameraWorldMat(view, data.params);
                }
                else if (data.method === "chowder_itowns_resize_callback")
                {
                    // リサイズ命令
                    resizeWindow(data.params);
                }
                else if (data.method === "chowder_itowns_add_map")
                {
                    // マップ追加命令
                    addMap(view, data.params);
                }
                else if (data.method === "chowder_itowns_delete_map")
                {
                    // マップ削除命令
                    deleteMap(view, data.params);
                }
                else if (data.method === "chowder_itowns_change_map_order") 
                {
                    // マップ順序変更命令
                    changeMapOrder(view, data.params);
                }
            } catch(ex) {
                console.error(ex);
            }
        });
    };

    function getLayerData(view)
    {
        var layers = view.getLayers();
        var i;
        var dataList = [];
        var data = {}
        var layer;
        for (i = 0; i < layers.length; ++i) {
            layer = layers[i];
            data = {};
            if (layer.hasOwnProperty('source') && layer.source.hasOwnProperty('url'))
            {
                data.visible =  layer.visible;
                data.projection = layer.projection;
                data.id = layer.id;
                data.url = layer.source.url;
                data.zoom = layer.source.zoom;
                data.type = ((function (layer) {
                    if (layer.isElevationLayer) {
                        return "Elevation";
                    } else if (layer.isColorLayer) {
                        return "Color";
                    } else if (layer.isGeometryLayer) {
                        return "Geometry";
                    }
                })(layer));
                dataList.push(data);
            }
        }
        return dataList;
    }
    
    //var initialWorldMat = null;
    function injectAsChOWDERiTownController(view, viewerDiv)
    {
        var menuDiv = document.getElementById('menuDiv');
        if (menuDiv) {
            menuDiv.style.position = "absolute";
            menuDiv.style.top = "10px";
            menuDiv.style.left = "10px";
        }

        var layerDataList = []
        view.addEventListener(itowns.VIEW_EVENTS.LAYER_ADDED, function (evt) {
            layerDataList = getLayerData(view);
            window.parent.postMessage(JSON.stringify({
                jsonrpc : "2.0",
                id : messageID + 1,
                method :  "chowder_itowns_update_layer",
                params : layerDataList
            }));
        });
        view.addEventListener(itowns.VIEW_EVENTS.LAYER_REMOVED, function (evt) {
            layerDataList = getLayerData(view);
            window.parent.postMessage(JSON.stringify({
                jsonrpc : "2.0",
                id : messageID + 1,
                method :  "chowder_itowns_update_layer",
                params : layerDataList
            }));
        });
        view.addEventListener(itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED, function (evt) {
            layerDataList = getLayerData(view);
            window.parent.postMessage(JSON.stringify({
                jsonrpc : "2.0",
                id : messageID + 1,
                method :  "chowder_itowns_update_layer",
                params : layerDataList
            }));
        });

        window.addEventListener('message', function (evt) {
            try {
                var data = JSON.parse(evt.data);
                // 初期メッセージの受け取り
                if (data.method === "chowder_injection_init") 
                {
                    var worldMat = JSON.stringify(view.camera.camera3D.matrixWorld.elements);
                    window.parent.postMessage(JSON.stringify({
                        jsonrpc : "2.0",
                        id : messageID + 1,
                        method :  "chowder_itowns_update_camera",
                        params : worldMat
                    }), evt.origin);
            
                    // カメラ動いた時にマトリックスを送信
                    view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_CAMERA_UPDATE, (function () {
                        return function () {
                            var mat = JSON.stringify(view.camera.camera3D.matrixWorld.elements);
                            if (worldMat !== mat) {
                                // カメラが動いた.
                                worldMat = mat;
                                window.parent.postMessage(JSON.stringify({
                                    jsonrpc : "2.0",
                                    id : messageID + 1,
                                    method :  "chowder_itowns_update_camera",
                                    params : mat
                                }), evt.origin);
                            }
                        };
                    }()));
                }
            } catch (e) {

            }
        });

        var done = false;

        var interval = 500;
        var timer;
        var thumbnailBase64;
        var count = 0;
        view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, function () {
            // サムネイルを即時作成
            if (!done) {
                var canvas = viewerDiv.getElementsByTagName('canvas')[0];
                thumbnailBase64 = resizeToThumbnail(canvas);
                ++count;
            }
            // 一定間隔同じイベントが来なかったら実行
            clearTimeout(timer);
            timer = setTimeout((function () {
                return function () {
                    if (!done && count > 1) {
                        window.parent.postMessage(JSON.stringify({
                            jsonrpc : "2.0",
                            id : messageID + 1,
                            method : "chowder_itowns_update_thumbnail",
                            params : thumbnailBase64
                        }));
                        done = true;
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

    window.injectChOWDER = function (view, viewerDiv, startTime) {
        var done = false;
        view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, function () {
            if (!done) {
                if (window.chowder_itowns_view_type === "itowns") {
                    // itowns追加用コントローラーからひかれた(itowns画面に対して操作可)
                    injectAsChOWDERiTownController(view, viewerDiv);
                } else {
                    // displayまたはcontrollerから開かれた(itowns画面に対して操作不可)
                    disableITownResizeFlow();

                    // for measure performance
                    view.mainLoop.addEventListener('command-queue-empty', () => {
                        //console.log("command-queue-empty")
                        //console.log("renderingState:", view.mainLoop.renderingState, "time:", ((performance.now() - startTime) / 1000).toFixed(3), "seconds")
                        if (view.mainLoop.renderingState == 0 && startTime) 
                        {
                            startTime = null;
                            var time = ((performance.now() - startTime) / 1000).toFixed(3) + "seconds";
                            if (window.hasOwnProperty("chowder_itowns_measure_time")) {
                                window.chowder_itowns_measure_time(time)
                            }
                        }
                    });
                }
                done = true;
            }
        });
        // windowオブジェクトに対してコールバックを即時設定.
        injectChOWDERiTownCallbacks(view, viewerDiv);
    };
}());