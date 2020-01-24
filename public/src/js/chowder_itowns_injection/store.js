/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

// chowder_itowns_injectionで1jsにeventemitterもまとめたいので、このファイルでは直接importする
import EventEmitter from '../../../3rd/js/eventemitter3/index.js'
import Action from './action'
import IFrameConnector from '../common/iframe_connector'
import ITownsCommand from '../common/itowns_command';
import ITownsConstants from '../itowns/itowns_constants.js';

/**
 * Store.
 * itownsに操作を行うため, itownsのviewインスタンスを保持する
 * また, iframeの親windowと通信を行う
 */
class Store extends EventEmitter {
    constructor(action) {
        super();
        this.action = action;
        this.layerDataList = [];
        this.initEvents();
        this.connectParent();

        this.itownsView = null;
        this.itownsViewerDiv = null;
    }

    // デバッグ用. release版作るときは消す
    emit() {
        if (arguments.length > 0) {
            if (!arguments[0]) {
                console.error("Not found EVENT NAME!")
            }
        }
        super.emit(...arguments);
    }

    initEvents() {
        for (let i in Action) {
            if (i.indexOf('EVENT') >= 0) {
                this.action.on(Action[i], ((method) => {
                    return (err, data) => {
                        if (this[method]) {
                            this[method](data);
                        }
                    };
                })('_' + Action[i]));
            }
        }
    };

    connectParent() {
        this.iframeConnector = new IFrameConnector();
        this.iframeConnector.connect(() => {
            this.initIFrameEvents();
        });
    }

    initIFrameEvents() {
        this.iframeConnector.on(ITownsCommand.UpdateCamera, (err, param, request) => {
            // カメラ更新命令
            this.applyCameraWorldMat(param);
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
        this.iframeConnector.on(ITownsCommand.Resize, (err, param, request) => {
            // リサイズ命令
            this.resizeWindow(param);
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
        this.iframeConnector.on(ITownsCommand.AddLayer, (err, param, request) => {
            // レイヤー追加命令
            this.addLayer(param);
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
        this.iframeConnector.on(ITownsCommand.DeleteLayer, (err, param, request) => {
            // レイヤー削除命令
            this.deleteLayer(param);
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
        this.iframeConnector.on(ITownsCommand.ChangeLayerOrder, (err, param, request) => {
            // レイヤー順序変更命令
            this.changeLayerOrder(param);
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
        this.iframeConnector.on(ITownsCommand.ChangeLayerProperty, (err, param, request) => {
            console.error("changeLayerProperty", err, param, request)
            // レイヤープロパティ変更命令
            this.changeLayerProperty(param);
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
    }
    
    // カメラにworldMatを設定して動かす
    applyCameraWorldMat(worldMat) {
        this.itownsView.camera.camera3D.matrixAutoUpdate = false;
        this.itownsView.camera.camera3D.matrixWorld.elements = worldMat;

        let d = new itowns.THREE.Vector3(),
            q = new itowns.THREE.Quaternion(),
            s = new itowns.THREE.Vector3();
        this.itownsView.camera.camera3D.matrixWorld.decompose(d, q, s);
        this.itownsView.camera.camera3D.position.copy(d);
        this.itownsView.camera.camera3D.quaternion.copy(q);
        this.itownsView.camera.camera3D.scale.copy(s);
        this.itownsView.camera.camera3D.matrixAutoUpdate = true;
        this.itownsView.notifyChange(this.itownsView.camera.camera3D);
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

    /**
     * レイヤーを返す. ない場合はnullを返す
     * @param id : 対象レイヤのID
     */
    getLayer(id) {
        let layers = this.itownsView.getLayers();
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
     * @param params
     * { 
     *   id : 対象レイヤのID
     *   url : 追加するURL
     *   zoom : { min : 1, max : 20 } ズーム範囲 (option)
     *   format : "image/png"など (option)
     * }
     */
    addLayer(params) {
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
                },
                "opacity" : 1.0
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
        this.itownsView.addLayer(layer);
    }

    /**
     * マップ削除 
     * @param params
     * { 
     *   id : 対象レイヤのID
     * }
     */
    deleteLayer(params) {
        let id = params.id;
        let layer = this.getLayer(id);
        if (layer) {
            this.itownsView.removeLayer(id);
            this.itownsView.notifyChange();
        }
    }

    /**
     * マップ順序変更
     * @param params
     * { 
     *   id : 変更対象レイヤのID
     *   isUp : 上に移動する場合はtrue、下の場合はfalse
     * }
     */
    changeLayerOrder(params) {
        let id = params.id;
        let isUp = params.isUp ? true : false;
        let layers = this.itownsView._layers[0].attachedLayers;
        let layer = this.getLayer(id);
        console.log("pre", layers)
        if (layer) {
            if (isUp && i > 0) {
                console.error("up!", this.itownsView, id)
                itowns.ColorLayersOrdering.moveLayerUp(this.itownsView, id);
                layers.splice(i - 1, 2, layers[i], layers[i - 1]);
                console.log(layers)
                this.itownsView.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED });
                this.itownsView.notifyChange();
            } else if (i < (layer.length - 1)) {
                itowns.ColorLayersOrdering.moveLayerDown(this.itownsView, id);
                layers.splice(i, 2, layers[i + 1], layers[i]);
                console.log(layers)
                this.itownsView.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED });
                this.itownsView.notifyChange();
            }
        }
    }

    /**
     * プロパティの変更
     * @param params 
     * {
     *   id : 変更対象レイヤのID
     *   opacity : 透明度(option)
     *   visible : 表示非表示.表示の場合true(option)
     * }
     */
    changeLayerProperty(params) {
        let id = params.id;
        let layer = this.getLayer(id);
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
                this.itownsView.notifyChange(layer);
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
        this.itownsViewerDiv.style.left = parseInt(rect.x) + "px";
        this.itownsViewerDiv.style.top = parseInt(rect.y) + "px";
        this.itownsViewerDiv.style.width = parseInt(rect.w) + "px";
        this.itownsViewerDiv.style.height = parseInt(rect.h) + "px";
        this.itownsViewerDiv.style.position = "relative";
        this.itownsView.camera.camera3D.setViewOffset(fullWidth, fullHeight, rect.x, rect.y, rect.w, rect.h)
        //console.error(fullWidth, fullHeight, rect.x, rect.y, rect.w, rect.h)
        this.itownsView.mainLoop.gfxEngine.renderer.setSize(rect.w, rect.h);
        this.itownsView.notifyChange(this.itownsView.camera.camera3D);
    }


    disableITownResizeFlow() {
        // Display以外はリサイズを弾く
        if (window.chowder_itowns_view_type !== "display") { return; }
        window.removeEventListener("resize");
    }

    // 操作可能なレイヤーのデータリストを返す
    getLayerDataList() {
        let layers = this.itownsView.getLayers();
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
                            return ITownsConstants.TypeElevation;
                        } else if (layer instanceof itowns.ColorLayer) {
                            return ITownsConstants.TypeColor;
                        } else if (layer instanceof itowns.PointCloudLayer) {
                            return ITownsConstants.TypePointCloud;
                        } else if (layer instanceof itowns.GeometryLayer) {
                            return ITownsConstants.TypeGeometry;
                        } else {
                            return ITownsConstants.TypeLayer;
                        }
                    })(layer));
                    dataList.push(data);
                }
            }
        }
        return dataList;
    }


    // 一定時間経過後にコンテンツ追加命令をpostMessageする
    addContentWithInterval() {
        let done = false;
        let interval = 500;
        let timer;
        let thumbnailBase64;
        let count = 0;
        this.itownsView.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, () => {
            // サムネイルを即時作成
            if (!done) {
                let canvas = this.itownsViewerDiv.getElementsByTagName('canvas')[0];
                thumbnailBase64 = this.resizeToThumbnail(canvas);
                ++count;
            }
            // 一定間隔同じイベントが来なかったら実行
            clearTimeout(timer);
            timer = setTimeout((() => {
                return () => {
                    if (!done && (count > 1)) {
                        this.iframeConnector.send(ITownsCommand.AddContent, {
                            thumbnail: thumbnailBase64,
                            layerList: this.layerDataList
                        });
                        done = true;
                    }
                }
            })(), interval);
        });

        // AFTER_RENDERが延々と来てたりすると, サムネイルは作れないけどとりあえず追加する
        setTimeout(() => {
            if (!done) {
                this.iframeConnector.send(ITownsCommand.AddContent, {
                    thumbnail: thumbnailBase64,
                    layerList: this.layerDataList
                });
                done = true;
            }
        }, 10 * 1000);
    }

    injectAsChOWDERiTownController() {
        let menuDiv = document.getElementById('menuDiv');
        if (menuDiv) {
            menuDiv.style.position = "absolute";
            menuDiv.style.top = "10px";
            menuDiv.style.left = "10px";
        }

        this.layerDataList = this.getLayerDataList();
        this.itownsView.addEventListener(itowns.VIEW_EVENTS.LAYER_ADDED, (evt) => {
            console.error("LAYER_ADDED")
            this.layerDataList = this.getLayerDataList();
            this.iframeConnector.send(ITownsCommand.AddLayer, this.layerDataList);
        });
        this.itownsView.addEventListener(itowns.VIEW_EVENTS.LAYER_REMOVED, (evt) => {
            console.error("LAYER_REMOVED")
            this.layerDataList = this.getLayerDataList();
            this.iframeConnector.send(ITownsCommand.UpdateLayer, this.layerDataList);
        });
        this.itownsView.addEventListener(itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED, (evt) => {
            console.error("COLOR_LAYERS_ORDER_CHANGED")
            this.layerDataList = this.getLayerDataList();
            this.iframeConnector.send(ITownsCommand.UpdateLayer, this.layerDataList);
        });

        this.iframeConnector.on(ITownsCommand.Init, (err, param, data) => {
            // メッセージの返信
            this.iframeConnector.sendResponse(data);

            // 初期カメラ位置送信
            let worldMat = JSON.stringify(this.itownsView.camera.camera3D.matrixWorld.elements);
            this.iframeConnector.send(ITownsCommand.UpdateCamera, worldMat);

            // 初期レイヤー送信
            if (this.layerDataList.length >= 0) {
                this.iframeConnector.send(ITownsCommand.UpdateLayer, this.layerDataList);
            }

            // カメラ動いた時にマトリックスを送信
            this.itownsView.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_CAMERA_UPDATE, (() => {
                return () => {
                    let mat = JSON.stringify(this.itownsView.camera.camera3D.matrixWorld.elements);
                    if (worldMat !== mat) {
                        // カメラが動いた.
                        worldMat = mat;
                        this.iframeConnector.send(ITownsCommand.UpdateCamera, mat);
                    }
                };
            })());
        });

        this.addContentWithInterval();
    }
    
    _injectChOWDER(data) {
        this.itownsView = data.view;
        this.itownsViewerDiv = data.viewerDiv;

        let done = false;
        this.itownsView.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, (evt) => {
            if (!done) {
                if (window.chowder_itowns_view_type === "itowns") {
                    // itowns追加用コントローラーからひかれた(itowns画面に対して操作可)
                    this.injectAsChOWDERiTownController();
                } else {
                    // displayまたはcontrollerから開かれた(itowns画面に対して操作不可)
                    this.disableITownResizeFlow();

                    // for measure performance
                    /*
                    this.itownsView.mainLoop.addEventListener('command-queue-empty', () => {
                        //console.log("command-queue-empty")
                        //console.log("renderingState:", view.mainLoop.renderingState, "time:", ((performance.now() - startTime) / 1000).toFixed(3), "seconds")
                        if (this.itownsView.mainLoop.renderingState == 0 && startTime) {
                            startTime = null;
                            let time = ((performance.now() - startTime) / 1000).toFixed(3) + "seconds";
                            if (window.hasOwnProperty("chowder_itowns_measure_time")) {
                                window.chowder_itowns_measure_time(time)
                            }
                        }
                    });
                    */
                }
                done = true;
            }
        });
    }
}

export default Store;
