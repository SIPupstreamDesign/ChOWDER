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

    /**
     * レイヤーを返す. ない場合はnullを返す
     * @param id : 対象レイヤのID
     */

    function getLayer(view, id) {
        var layers = view.getLayers();
        for (var i = 0; i < layers.length; ++i) {
            if (layers[i].id === id) {
                return layers[i];
            }
        }
        return null;
    }

    /**
     * レイヤー追加
     * @param view
     * @param params
     * { 
     *   id : 対象レイヤのID
     *   url : 追加するURL
     *   zoom : { min : 1, max : 20 } ズーム範囲 (option)
     *   format : "image/png"など (option)
     * }
     */
    function addLayer(view, params) {
        console.error("addLayer", params)
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
            }
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

    /**
     * マップ削除 
     * @param view
     * @param params
     * { 
     *   id : 対象レイヤのID
     * }
     */
    function deleteLayer(view, params) {
        var id = params.id;
        var layer = getLayer(view, id);
        if (layer) {
            view.removeLayer(id);
            view.notifyChange();
        }
    }

    /**
     * マップ順序変更
     * @param view
     * @param params
     * { 
     *   id : 変更対象レイヤのID
     *   isUp : 上に移動する場合はtrue、下の場合はfalse
     * }
     */ 
    function changeLayerOrder(view, params) {
        var id = params.id;
        var isUp = params.isUp ? true : false;
        var layers = view._layers[0].attachedLayers;
        var layer = getLayer(view, id);
        console.log("pre", layers)
        if (layer) {
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
        }
    }

    /**
     * プロパティの変更
     * @param view
     * @param params 
     * {
     *   id : 変更対象レイヤのID
     *   opacity : 透明度(option)
     *   visible : 表示非表示.表示の場合true(option)
     * }
     */ 
    function changeLayerProperty(view, params) {
        var id = params.id;
        var layer = getLayer(view, id);
        var isChanged = false;
        if (layer) {
            if (params.hasOwnProperty('opacity')) {
                layer.opacity = Number(params.opacity);
                isChanged = true;
            }
            if (params.hasOwnProperty('visible')) {
                layer.visible = Boolean(params.visible);
                isChanged = true;
            }
            if (isChanged) {
                view.notifyChange(layer);
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
                // 親フレームから情報を受け取り
                if (data.method === "UpdateCamera") 
                {
                    // カメラ更新命令
                    applyCameraWorldMat(view, data.params);
                    // メッセージの返信
                    sendResponse(data, {});
                }
                else if (data.method === "Resize")
                {
                    // リサイズ命令
                    resizeWindow(data.params);
                    // メッセージの返信
                    sendResponse(data, {});
                }
                else if (data.method === "AddLayer")
                {
                    // レイヤー追加命令
                    addLayer(view, data.params);
                    // メッセージの返信
                    sendResponse(data, {});
                }
                else if (data.method === "DeleteLayer")
                {
                    // レイヤー削除命令
                    deleteLayer(view, data.params);
                    // メッセージの返信
                    sendResponse(data, {});
                }
                else if (data.method === "ChangeLayerOrder") 
                {
                    // レイヤー順序変更命令
                    changeLayerOrder(view, data.params);
                    // メッセージの返信
                    sendResponse(data, {});
                }
                else if (data.method === "ChangeLayerProperty") 
                {
                    // レイヤープロパティ変更命令
                    changeLayerProperty(view, data.params);
                    // メッセージの返信
                    sendResponse(data, {});
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
            if (
                (layer.hasOwnProperty('source') && layer.source.hasOwnProperty('url')) ||
                (layer.hasOwnProperty('file') && layer.hasOwnProperty('url'))
                )
            {
                if (layer.hasOwnProperty('source') || layer.hasOwnProperty('file'))
                {
                    data.visible =  layer.visible;
                    data.projection = layer.projection;
                    data.id = layer.id;
                    data.url = layer.hasOwnProperty('source') ? layer.source.url : layer.url;
                    data.zoom = layer.hasOwnProperty('source') ? layer.source.zoom : undefined;
                    data.file = layer.hasOwnProperty('file') ? layer.file : undefined;
                    data.type = ((function (layer) {
                        if (layer instanceof itowns.ElevationLayer) {
                            return "Elevation";
                        } else if (layer instanceof itowns.ColorLayer) {
                            return "Color";
                        } else if (layer instanceof itowns.GeometryLayer) {
                            return "Geometry";
                        } else {
                            return "Layer"
                        }
                    })(layer));
                    dataList.push(data);
                }
            }
        }
        return dataList;
    }

    function sendResponse(data, result) {
        window.parent.postMessage(JSON.stringify({
            jsonrpc : "2.0",
            id : data.id,
            method :  data.method,
            result : {}
        }));
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

        var layerDataList = getLayerData(view);
        view.addEventListener(itowns.VIEW_EVENTS.LAYER_ADDED, function (evt) {
            layerDataList = getLayerData(view);
            window.parent.postMessage(JSON.stringify({
                jsonrpc : "2.0",
                id : messageID + 1,
                method :  "UpdateLayer",
                params : layerDataList,
                to : "parent"
            }));
        });
        view.addEventListener(itowns.VIEW_EVENTS.LAYER_REMOVED, function (evt) {
            layerDataList = getLayerData(view);
            window.parent.postMessage(JSON.stringify({
                jsonrpc : "2.0",
                id : messageID + 1,
                method :  "UpdateLayer",
                params : layerDataList,
                to : "parent"
            }));
        });
        view.addEventListener(itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED, function (evt) {
            layerDataList = getLayerData(view);
            window.parent.postMessage(JSON.stringify({
                jsonrpc : "2.0",
                id : messageID + 1,
                method :  "UpdateLayer",
                params : layerDataList,
                to : "parent"
            }));
        });

        window.addEventListener('message', function (evt) {
            try {
                var data = JSON.parse(evt.data);
                // 初期メッセージの受け取り
                if (data.method === "Init") 
                {
                    // メッセージの返信
                    sendResponse(data, {});

                    // 初期カメラ位置送信
                    var worldMat = JSON.stringify(view.camera.camera3D.matrixWorld.elements);
                    window.parent.postMessage(JSON.stringify({
                        jsonrpc : "2.0",
                        id : messageID + 1,
                        method :  "UpdateCamera",
                        params : worldMat,
                        to : "parent"
                    }), evt.origin);
            
                    // 初期レイヤー送信
                        if (layerDataList.length >= 0) {
                        window.parent.postMessage(JSON.stringify({
                            jsonrpc : "2.0",
                            id : messageID + 1,
                            method :  "UpdateLayer",
                            params : layerDataList,
                            to : "parent"
                        }));
                    }

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
                                    method :  "UpdateCamera",
                                    params : mat,
                                    to : "parent"
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
                            method : "AddContent",
                            params : {
                                thumbnail : thumbnailBase64,
                                layerList : layerDataList
                            },
                            to : "parent"
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