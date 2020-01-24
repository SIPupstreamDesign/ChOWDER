
class ChOWDERInjection {
    constructor() {
        this.messageID = 1;
        this.layerDataList = [];
    }

    // カメラにworldMatを設定して動かす
    applyCameraWorldMat(view, worldMat) {
        view.camera.camera3D.matrixAutoUpdate = false;
        view.camera.camera3D.matrixWorld.elements = worldMat;

        let d = new itowns.THREE.Vector3(),
            q = new itowns.THREE.Quaternion(),
            s = new itowns.THREE.Vector3();
        view.camera.camera3D.matrixWorld.decompose(d, q, s);
        view.camera.camera3D.position.copy(d);
        view.camera.camera3D.quaternion.copy(q);
        view.camera.camera3D.scale.copy(s);
        view.camera.camera3D.matrixAutoUpdate = true;
        view.notifyChange(view.camera.camera3D);
    }

    resizeToThumbnail(srcCanvas) {
        let width = document.body.clientWidth;
        let height = document.body.clientHeight;
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 256 * (height / width);
        ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, canvas.width, canvas.height);
        //return toArrayBuffer(canvas);
        return canvas.toDataURL("image/jpeg");
    }

    disableITownResizeFlow() {
        // Display以外はリサイズを弾く
        if (window.chowder_itowns_view_type !== "display") { return; }
        window.removeEventListener("resize");
    }

    /**
     * レイヤーを返す. ない場合はnullを返す
     * @param id : 対象レイヤのID
     */
    getLayer(view, id) {
        let layers = view.getLayers();
        for (let i = 0; i < layers.length; ++i) {
            if (layers[i].id === id) {
                return layers[i];
            }
        }
        return null;
    }

    /**
     * レイヤーの作成
     * @param {*} type 
     */
    createLayerByType(config, type) {
        let mapSource = new itowns.TMSSource(config);
        if (type === "color") {
            return new itowns.ColorLayer(config.id, {
                source: mapSource
            });
        }
        if (type === "elevation") {
            return new itowns.ElevationLayer(config.id, {
                source: mapSource
            });
        }
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
    addLayer(view, params) {
        console.error("addLayer", params)

        let type = "color";
        if (params.hasOwnProperty('type')) {
            type = params.type;
        }
        let url = params.url;
        if (url.indexOf("${z}") >= 0) {
            url = url.split("${z}").join("%TILEMATRIX");
        }
        if (url.indexOf("${x}") >= 0) {
            url = url.split("${x}").join("%COL");
        }
        if (url.indexOf("${y}") >= 0) {
            url = url.split("${y}").join("%ROW");
        }
        let config;
        if (type === "color") {
            config = {
                "projection": "EPSG:3857",
                "isInverted": true,
                "format": "image/png",
                "url": url,
                "tileMatrixSet": "PM",
                "updateStrategy": {
                    "type": 3
                }
            };
        }
        if (type === "elevation") {
            config = {
                "projection": "EPSG:3857",
                "isInverted": true,
                "format": url.indexOf('.png') > 0 ? "image/png" : "",
                "url": url
            };
        }
        if (params.hasOwnProperty('id')) {
            config.id = params.id;
        }
        if (params.hasOwnProperty('zoom')) {
            config.zoom = params.zoom;
        }
        if (params.hasOwnProperty('format')) {
            config.format = params.format;
        }
        let layer = this.createLayerByType(config, type);
        view.addLayer(layer);
    }

    /**
     * マップ削除 
     * @param view
     * @param params
     * { 
     *   id : 対象レイヤのID
     * }
     */
    deleteLayer(view, params) {
        let id = params.id;
        let layer = this.getLayer(view, id);
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
    changeLayerOrder(view, params) {
        let id = params.id;
        let isUp = params.isUp ? true : false;
        let layers = view._layers[0].attachedLayers;
        let layer = this.getLayer(view, id);
        console.log("pre", layers)
        if (layer) {
            if (isUp && i > 0) {
                console.error("up!", view, id)
                itowns.ColorLayersOrdering.moveLayerUp(view, id);
                layers.splice(i - 1, 2, layers[i], layers[i - 1]);
                console.log(layers)
                view.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED });
                view.notifyChange();
            } else if (i < (layer.length - 1)) {
                itowns.ColorLayersOrdering.moveLayerDown(view, id);
                layers.splice(i, 2, layers[i + 1], layers[i]);
                console.log(layers)
                view.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED });
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
    changeLayerProperty(view, params) {
        let id = params.id;
        let layer = this.getLayer(view, id);
        let isChanged = false;
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

    resizeWindow(rect) {
        if (!rect) return;
        let width = document.body.clientWidth;
        let height = document.body.clientHeight;
        let fullWidth = width;
        let fullHeight = height;

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

    injectChOWDERiTownCallbacks(view, viewerDiv) {
        window.addEventListener('message', (evt) => {
            try {
                let data = JSON.parse(evt.data);
                // 親フレームから情報を受け取り
                if (data.method === "UpdateCamera") {
                    // カメラ更新命令
                    this.applyCameraWorldMat(view, data.params);
                    // メッセージの返信
                    this.sendResponse(data, {});
                }
                else if (data.method === "Resize") {
                    // リサイズ命令
                    this.resizeWindow(data.params);
                    // メッセージの返信
                    this.sendResponse(data, {});
                }
                else if (data.method === "AddLayer") {
                    // レイヤー追加命令
                    this.addLayer(view, data.params);
                    // メッセージの返信
                    this.sendResponse(data, {});
                }
                else if (data.method === "DeleteLayer") {
                    // レイヤー削除命令
                    this.deleteLayer(view, data.params);
                    // メッセージの返信
                    this.sendResponse(data, {});
                }
                else if (data.method === "ChangeLayerOrder") {
                    // レイヤー順序変更命令
                    this.changeLayerOrder(view, data.params);
                    // メッセージの返信
                    this.sendResponse(data, {});
                }
                else if (data.method === "ChangeLayerProperty") {
                    // レイヤープロパティ変更命令
                    this.changeLayerProperty(view, data.params);
                    // メッセージの返信
                    this.sendResponse(data, {});
                }
            } catch (ex) {
                console.error(ex);
            }
        });
    };

    // 操作可能なレイヤーのデータリストを返す
    getLayerDataList(view) {
        let layers = view.getLayers();
        let i;
        let dataList = [];
        let data = {}
        let layer;
        for (i = 0; i < layers.length; ++i) {
            layer = layers[i];
            data = {};
            if (
                (layer.hasOwnProperty('source') && layer.source.hasOwnProperty('url')) ||
                (layer.hasOwnProperty('file') && layer.hasOwnProperty('url'))
            ) {
                if (layer.hasOwnProperty('source') || layer.hasOwnProperty('file')) {
                    data.visible = layer.visible;
                    data.projection = layer.projection;
                    data.id = layer.id;
                    data.url = layer.hasOwnProperty('source') ? layer.source.url : layer.url;
                    data.zoom = layer.hasOwnProperty('source') ? layer.source.zoom : undefined;
                    data.file = layer.hasOwnProperty('file') ? layer.file : undefined;
                    data.type = (((layer) => {
                        if (layer instanceof itowns.ElevationLayer) {
                            return "Elevation";
                        } else if (layer instanceof itowns.ColorLayer) {
                            return "Color";
                        } else if (layer instanceof itowns.PointCloudLayer) {
                            return "PointCloud";
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

    // 一定時間経過後にコンテンツ追加命令をpostMessageする
    addContentWithInterval(view) {
        let done = false;
        let interval = 500;
        let timer;
        let thumbnailBase64;
        let count = 0;
        view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, () => {
            // サムネイルを即時作成
            if (!done) {
                let canvas = viewerDiv.getElementsByTagName('canvas')[0];
                thumbnailBase64 = this.resizeToThumbnail(canvas);
                ++count;
            }
            // 一定間隔同じイベントが来なかったら実行
            clearTimeout(timer);
            timer = setTimeout((() => {
                return () => {
                    if (!done && (count > 1)) {
                        window.parent.postMessage(JSON.stringify({
                            jsonrpc: "2.0",
                            id: this.messageID + 1,
                            method: "AddContent",
                            params: {
                                thumbnail: thumbnailBase64,
                                layerList: this.layerDataList
                            },
                            to: "parent"
                        }));
                        done = true;
                    }
                }
            })(), interval);
        });

        // AFTER_RENDERが延々と来てたりすると, サムネイルは作れないけどとりあえず追加する
        setTimeout(() => {
            if (!done) {
                window.parent.postMessage(JSON.stringify({
                    jsonrpc: "2.0",
                    id: this.messageID + 1,
                    method: "AddContent",
                    params: {
                        thumbnail: thumbnailBase64,
                        layerList: this.layerDataList
                    },
                    to: "parent"
                }));
                done = true;
            }
        }, 10 * 1000);
    }

    // メッセージの返信をpostMessageする
    sendResponse(data, result_ = {}) {
        window.parent.postMessage(JSON.stringify({
            jsonrpc: "2.0",
            id: data.id,
            method: data.method,
            result: result_
        }));
    }

    injectAsChOWDERiTownController(view, viewerDiv) {
        let menuDiv = document.getElementById('menuDiv');
        if (menuDiv) {
            menuDiv.style.position = "absolute";
            menuDiv.style.top = "10px";
            menuDiv.style.left = "10px";
        }

        this.layerDataList = this.getLayerDataList(view);
        view.addEventListener(itowns.VIEW_EVENTS.LAYER_ADDED, (evt) => {
            this.layerDataList = this.getLayerDataList(view);
            window.parent.postMessage(JSON.stringify({
                jsonrpc: "2.0",
                id: this.messageID + 1,
                method: "AddLayer",
                params: this.layerDataList,
                to: "parent"
            }));
        });
        view.addEventListener(itowns.VIEW_EVENTS.LAYER_REMOVED, (evt) => {
            this.layerDataList = this.getLayerDataList(view);
            window.parent.postMessage(JSON.stringify({
                jsonrpc: "2.0",
                id: this.messageID + 1,
                method: "UpdateLayer",
                params: this.layerDataList,
                to: "parent"
            }));
        });
        view.addEventListener(itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED, (evt) => {
            this.layerDataList = this.getLayerDataList(view);
            window.parent.postMessage(JSON.stringify({
                jsonrpc: "2.0",
                id: this.messageID + 1,
                method: "UpdateLayer",
                params: this.layerDataList,
                to: "parent"
            }));
        });

        window.addEventListener('message', (evt) => {
            try {
                let data = JSON.parse(evt.data);
                // 初期メッセージの受け取り
                if (data.method === "Init") {
                    // メッセージの返信
                    this.sendResponse(data, {});

                    // 初期カメラ位置送信
                    let worldMat = JSON.stringify(view.camera.camera3D.matrixWorld.elements);
                    window.parent.postMessage(JSON.stringify({
                        jsonrpc: "2.0",
                        id: this.messageID + 1,
                        method: "UpdateCamera",
                        params: worldMat,
                        to: "parent"
                    }), evt.origin);

                    // 初期レイヤー送信
                    if (this.layerDataList.length >= 0) {
                        window.parent.postMessage(JSON.stringify({
                            jsonrpc: "2.0",
                            id: this.messageID + 1,
                            method: "UpdateLayer",
                            params: this.layerDataList,
                            to: "parent"
                        }));
                    }

                    // カメラ動いた時にマトリックスを送信
                    view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_CAMERA_UPDATE, (() => {
                        return () => {
                            let mat = JSON.stringify(view.camera.camera3D.matrixWorld.elements);
                            if (worldMat !== mat) {
                                // カメラが動いた.
                                worldMat = mat;
                                window.parent.postMessage(JSON.stringify({
                                    jsonrpc: "2.0",
                                    id: this.messageID + 1,
                                    method: "UpdateCamera",
                                    params: mat,
                                    to: "parent"
                                }), evt.origin);
                            }
                        };
                    })());
                }
            } catch (e) {

            }
        });

        this.addContentWithInterval(view);
    }

    injectChOWDER(view, viewerDiv, startTime) {
        let done = false;
        view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, (evt) => {
            if (!done) {
                if (window.chowder_itowns_view_type === "itowns") {
                    // itowns追加用コントローラーからひかれた(itowns画面に対して操作可)
                    this.injectAsChOWDERiTownController(view, viewerDiv);
                } else {
                    // displayまたはcontrollerから開かれた(itowns画面に対して操作不可)
                    this.disableITownResizeFlow();

                    // for measure performance
                    view.mainLoop.addEventListener('command-queue-empty', () => {
                        //console.log("command-queue-empty")
                        //console.log("renderingState:", view.mainLoop.renderingState, "time:", ((performance.now() - startTime) / 1000).toFixed(3), "seconds")
                        if (view.mainLoop.renderingState == 0 && startTime) {
                            startTime = null;
                            let time = ((performance.now() - startTime) / 1000).toFixed(3) + "seconds";
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
        this.injectChOWDERiTownCallbacks(view, viewerDiv);
    }
}

export default ChOWDERInjection;