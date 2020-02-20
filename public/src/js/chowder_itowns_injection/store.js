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

const getTextureFloat = function getTextureFloat(buffer) {
    return new itowns.THREE.DataTexture(buffer, 256, 256, itowns.THREE.AlphaFormat, itowns.THREE.FloatType);
};

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
        this.iframeConnector.on(ITownsCommand.UpdateCamera, (err, cameraData, request) => {
            // カメラ更新命令
            this.applyCamera(cameraData.mat, cameraData.params);
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
        this.iframeConnector.on(ITownsCommand.InitLayers, (err, param, request) => {
            // レイヤー追加命令
            this.initLayers(param);
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
            if (param) {
                // レイヤープロパティ変更命令
                this.changeLayerProperty(param);
            }
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
    }

    // カメラにworldMatを設定して動かす
    // この関数実行後にview.notifyChangeを呼ぶこと
    applyCamera(worldMat, cameraParams) {
        this.itownsView.camera.camera3D.matrixAutoUpdate = false;
        this.itownsView.camera.camera3D.matrixWorld.elements = worldMat;

        let d = new itowns.THREE.Vector3(),
            q = new itowns.THREE.Quaternion(),
            s = new itowns.THREE.Vector3();
        this.itownsView.camera.camera3D.matrixWorld.decompose(d, q, s);
        this.itownsView.camera.camera3D.position.copy(d);
        this.itownsView.camera.camera3D.quaternion.copy(q);
        this.itownsView.camera.camera3D.scale.copy(s);

        this.itownsView.camera.camera3D.near = cameraParams.near;
        this.itownsView.camera.camera3D.far = cameraParams.far;
        this.itownsView.camera.camera3D.fov = cameraParams.fovy;
        this.itownsView.camera.camera3D.zoom = cameraParams.zoom;
        this.itownsView.camera.camera3D.filmOffset = cameraParams.filmOffset;
        this.itownsView.camera.camera3D.filmGauge = cameraParams.filmGauge;
        this.itownsView.camera.camera3D.aspect = cameraParams.aspect;

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
     * 地理院DEMのtxt用fetcher/parsarを,mapSourceに設定する.
     * @param {*} mapSource 
     */
    installCSVElevationParsar(mapSource) {
        console.log("installCSVElevationParsar");
        function checkResponse(response) {
            if (!response.ok) {
                let error = new Error(`Error loading ${response.url}: status ${response.status}`);
                error.response = response;
                throw error;
            }
        }

        let text = function (url, options = {}) {
            return fetch(url, options).then((response) => {
                checkResponse(response);
                return response.text();
            });
        };

        mapSource.fetcher = function (url, options = {}) {
            return text(url, options).then((data) => {
                let LF = String.fromCharCode(10);
                let lines = data.split(LF);
                let heights = [];
                for (let i = 0; i < lines.length; i++) {
                    let sp = lines[i].split(",");
                    for (let j = 0; j < sp.length; j++) {
                        if (sp[j] == "e") {
                            heights.push(0);
                        } else {
                            heights.push(Number(sp[j]));
                        }
                    }
                }
                let floatArray = new Float32Array(heights);
                let texture = getTextureFloat(floatArray);
                return texture;
            });
        };
    }

    /**
     * 地理院DEMのpng用fetcher/parsarを,mapSourceに設定する.
     * @param {*} mapSource 
     */
    installPNGElevationParsar(mapSource) {
        console.log("installPNGElevationParsar");
        let textureLoader = new itowns.THREE.TextureLoader();
        function texture(url, options = {}) {
            let res;
            let rej;
            textureLoader.crossOrigin = options.crossOrigin;
            const promise = new Promise((resolve, reject) => {
                res = resolve;
                rej = reject;
            });
            textureLoader.load(url, res, () => { }, rej);
            return promise;
        }
        let canvas = document.createElement("canvas");
        canvas.width = "256";
        canvas.height = "256";

        function convertTexToArray(tex) {
            let context = canvas.getContext('2d');
            context.drawImage(tex.image, 0, 0);
            let pixData = context.getImageData(0, 0, 256, 256).data;
            let heights = []
            let alt = 0;
            for (let y = 0; y < 256; ++y) {
                for (let x = 0; x < 256; x++) {
                    let addr = (x + y * 256) * 4;
                    let R = pixData[addr];
                    let G = pixData[addr + 1];
                    let B = pixData[addr + 2];
                    let A = pixData[addr + 3];
                    if (R == 128 && G == 0 && B == 0) {
                        alt = 0;
                    } else {
                        //                          alt = (R << 16 + G << 8 + B);
                        alt = (R * 65536 + G * 256 + B);
                        if (alt > 8388608) {
                            alt = (alt - 16777216);
                        }
                        alt = alt * 0.01;
                    }
                    heights.push(alt);
                }
            }
            return heights;
        }
        mapSource.fetcher = function (url, options = {}) {
            return texture(url, options).then(function (tex) {
                let floatArray = convertTexToArray(tex);
                let float32Array = new Float32Array(floatArray);
                let tt = getTextureFloat(float32Array);
                return tt;
            });
        };
    }

    /**
     * レイヤーの作成
     * @param {*} type 
     */
    createLayerByType(config, type) {
        console.log("createLayerByType", config, type)
        /*
        class TestSource extends itowns.TMSSource {
            constructor(source) {
                super(source);
            }
        
            urlFromExtent(extent) {
                let url = super.urlFromExtent(extent);
                console.log("urlFromExtent",  url)
                return url;//super.urlFromExtent(extent);
            }
        }
        */

        if (type === ITownsConstants.TypeColor && config.format !== "pbf") {
            let mapSource = new itowns.TMSSource(config);
            return new itowns.ColorLayer(config.id, {
                source: mapSource
            });
        }
        if (type === ITownsConstants.TypeElevation) {
            let mapSource = new itowns.TMSSource(config);
            if (config.format === "csv" || config.format === "txt") {
                this.installCSVElevationParsar(mapSource);
            } else if (config.format.indexOf("png") >= 0) {
                this.installPNGElevationParsar(mapSource);
            }
            return new itowns.ElevationLayer(config.id, {
                source: mapSource,
                updateStrategy: {
                    type: 3
                },
                scale: 1
            });
        }
        if (type === ITownsConstants.TypePointCloud) {
            return new itowns.PointCloudLayer(config.id, config, this.itownsView);
        }
        if (type === ITownsConstants.Type3DTile) {
            return new itowns.C3DTilesLayer(config.id, config, this.itownsView);
        }
        if (type === ITownsConstants.TypeGeometry || config.format === "pbf") {
            let mapSource = null;
            if (config.format === "geojson") {
                mapSource = new itowns.TMSSource(config);
                return new itowns.GeometryLayer(config.id, new itowns.THREE.Group(), {
                    update: (context, layer, node) => {
                        return itowns.FeatureProcessing.update(context, layer, node)
                    },
                    convert: itowns.Feature2Mesh.convert({
                        color: new itowns.THREE.Color(0xbbffbb),
                        extrude: 80
                    }),
                    source: mapSource
                });
            }
            if (config.format === "pbf") {
                // Add a vector tile layer
                function inter(z) {
                    return z - (z % 5);
                }
                function isValidData(data, extentDestination) {
                    const isValid = inter(extentDestination.zoom) == inter(data.extent.zoom);
                    return isValid;
                }
                mapSource = new itowns.VectorTilesSource(config);
                return new itowns.ColorLayer(config.id, {
                    isValidData: isValidData,
                    source: mapSource,
                    fx: 2.5,
                });
            }
        }
    }

    createLayerConfigByType(params, type) {
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
        if (url.indexOf("{z}") >= 0) {
            url = url.split("{z}").join("%TILEMATRIX");
        }
        if (url.indexOf("{x}") >= 0) {
            url = url.split("{x}").join("%COL");
        }
        if (url.indexOf("{y}") >= 0) {
            url = url.split("{y}").join("%ROW");
        }

        let config = {};
        if (type === ITownsConstants.TypeColor) {
            config = {
                "projection": "EPSG:3857",
                "isInverted": true,
                "format": "image/png",
                "url": url,
                "tileMatrixSet": "PM",
                "updateStrategy": {
                    "type": 3
                },
                "opacity": 1.0
            };
        }
        if (type === ITownsConstants.TypeElevation) {
            config = {
                "projection": "EPSG:3857",
                "tileMatrixSet": "PM",
                "format": url.indexOf('.png') > 0 ? "image/png" : "csv",
                "url": url,
                "scale": 1
            };
        }
        if (type === ITownsConstants.TypePointCloud) {
            if (params.hasOwnProperty('file')) {
                url += params.file;
            }
            let splits = url.split('/');
            let file = splits[splits.length - 1];
            let serverUrl = url.split(file).join('');
            config = {
                "file": file,
                "url": serverUrl,
                "protocol": 'potreeconverter'
            };
        }
        if (type === ITownsConstants.Type3DTile) {
            config = {
                "name": params.hasOwnProperty('id') ? params.id : "3dtile",
                "url": url
            };
            if (params.hasOwnProperty('wireframe')) {
                config.wireframe = params.wireframe;
            }
        }
        if (type === ITownsConstants.TypeGeometry) {
            config = {
                "projection": "EPSG:3857",
                "url": url
            }
            if (url.indexOf('.geojson') >= 0) {
                config.format = "geojson";
            }
            if (url.indexOf('.pbf') >= 0) {
                config.format = "pbf";
            }
            if (params.hasOwnProperty('style')) {
                config.style = params.style;
            }
        }
        // 以下共通
        if (params.hasOwnProperty('id')) {
            config.id = params.id;
        }
        if (params.hasOwnProperty('zoom')) {
            config.zoom = params.zoom;
        }
        if (params.hasOwnProperty('format')) {
            config.format = params.format;
        }
        return config;
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
        if (!params) {
            console.error("Not found params");
            return;
        }
        console.log("addLayer", params)

        if (params.hasOwnProperty('id')) {
            if (this.getLayer(params.id)) {
                console.warn("already loaded")
                return;
            }
        }
        if (!params.hasOwnProperty('url')) {
            console.error("Not found url");
            return;
        }

        let type = "color";
        if (params.hasOwnProperty('type')) {
            type = params.type;
        }
        let config = this.createLayerConfigByType(params, type);
        let layer = this.createLayerByType(config, type);
        if (type === ITownsConstants.TypePointCloud ||
            type === ITownsConstants.Type3DTile) {
            console.log("addLayer", layer)
            itowns.View.prototype.addLayer.call(this.itownsView, layer);
        } else {
            this.itownsView.addLayer(layer);
        }
    }

    /**
     * レイヤーリストを元に初期化する
     * 既存の有効なレイヤーはすべて削除され、layerListに記載されたレイヤーが追加される
     * @param {*} layerList 
     */
    initLayers(layerList) {
        for (let i = this.layerDataList.length - 1; i >= 0; --i) {
            const id = this.layerDataList[i].id;
            let layer = this.getLayer(id);
            if (layer) {
                this.itownsView.removeLayer(id);
            }
        }
        for (let i = 0; i < layerList.length; ++i) {
            this.addLayer(layerList[i]);
        }
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
        const id = params.id;
        const isUp = params.isUp ? true : false;
        const validLayers = this.getLayerDataList();
        const targetLayer = this.getLayer(id);
        if (targetLayer) {
            for (let i = 0; i < this.itownsView._layers.length; ++i) {
                let layers = this.itownsView._layers;
                let layer = this.itownsView._layers[i];
                let attachedLayers = layer.attachedLayers;
                if (attachedLayers.length > 0) {
                    let attachedIndex = attachedLayers.indexOf(targetLayer);
                    if (attachedIndex >= 0) {
                        // attachedLayerを移動したい
                        // "attachedLayers"内で移動を試みる
                        if (isUp
                            && attachedIndex > 0
                            && validLayers.indexOf(attachedLayers[i]) >= 0) // 入れ替え先レイヤーが有効かどうか
                        {
                            console.log("up!", this.itownsView, id)
                            itowns.ColorLayersOrdering.moveLayerUp(this.itownsView, id);
                            attachedLayers.splice(i - 1, 2, attachedLayers[i], attachedLayers[i - 1]);
                            this.itownsView.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED });
                            this.itownsView.notifyChange();
                        } else if (!isUp
                            && attachedIndex < (attachedLayers.length - 1)
                            && validLayers.indexOf(attachedLayers[i + 1]) >= 0) // 入れ替え先レイヤーが有効かどうか) 
                        {
                            console.log("moveLayerDown", i, i + 1)
                            itowns.ColorLayersOrdering.moveLayerDown(this.itownsView, id);
                            attachedLayers.splice(i, 2, attachedLayers[i + 1], attachedLayers[i]);
                            this.itownsView.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED });
                            this.itownsView.notifyChange();
                        } else {
                            // attachedLayers内で移動できない. 上位の"_layers"内の移動を行う
                            if (isUp && i > 0) {
                                layers.splice(i - 1, 2, layers[i], layers[i - 1]);
                                this.itownsView.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED });
                                this.itownsView.notifyChange();
                            } else if (!isUp && i < (layers.length - 1)) {
                                layers.splice(i, 2, layers[i + 1], layers[i]);
                                this.itownsView.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED });
                                this.itownsView.notifyChange();
                            }
                        }
                        break;
                    }
                }
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
            if (params.hasOwnProperty('scale')) {
                layer.scale = Number(params.scale);
                isChanged = true;
            }
            if (params.hasOwnProperty('pointSize')) {
                layer.pointSize = Number(params.pointSize);
                isChanged = true;
            }
            if (params.hasOwnProperty('wireframe')) {
                layer.wireframe = Number(params.wireframe);
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
        //console.log(fullWidth, fullHeight, rect.x, rect.y, rect.w, rect.h)
        this.itownsView.mainLoop.gfxEngine.renderer.setSize(rect.w, rect.h);
        this.itownsView.notifyChange(this.itownsView.camera.camera3D);
    }


    disableITownResizeFlow() {
        // Display以外はリサイズを弾く
        if (window.chowder_itowns_view_type !== "display") { return; }
        window.removeEventListener("resize");
        
        this.iframeConnector.on(ITownsCommand.MeasurePerformance, (err, param, request) => {
            // パフォーマンス計測命令
            let result = this.measurePerformance();
            // メッセージの返信
            this.iframeConnector.sendResponse(request, result);
        });
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
            if (!layer) continue;
            data = {};
            if (
                (layer.hasOwnProperty('source') && layer.source.hasOwnProperty('url')) ||
                (layer.hasOwnProperty('file') && layer.hasOwnProperty('url')) ||
                (layer.hasOwnProperty('name') && layer.hasOwnProperty('url'))
            ) {
                if (layer.hasOwnProperty('source') || layer.hasOwnProperty('file')) {
                    data.visible = layer.visible;
                    data.projection = layer.projection;
                    data.id = layer.id;
                    data.url = layer.hasOwnProperty('source') ? layer.source.url : layer.url;
                    data.style = layer.hasOwnProperty('style') ? layer.source.style : undefined;
                    data.zoom = layer.hasOwnProperty('source') ? layer.source.zoom : undefined;
                    data.file = layer.hasOwnProperty('file') ? layer.file : undefined;
                    data.type = (((layer) => {
                        if (layer instanceof itowns.ElevationLayer) {
                            return ITownsConstants.TypeElevation;
                        } else if (layer instanceof itowns.ColorLayer) {
                            return ITownsConstants.TypeColor;
                        } else if (layer instanceof itowns.PointCloudLayer) {
                            return ITownsConstants.TypePointCloud;
                        } else if (layer instanceof itowns.C3DTilesLayer) {
                            return ITownsConstants.Type3DTile;
                        } else if (layer instanceof itowns.GeometryLayer) {
                            return ITownsConstants.TypeGeometry;
                        } else {
                            return ITownsConstants.TypeLayer;
                        }
                    })(layer));
                    dataList.push(data);
                } else {
                    data.visible = layer.visible;
                    data.id = layer.id;
                    data.name = layer.hasOwnProperty('name') ? layer.name : undefined;
                    data.file = layer.hasOwnProperty('file') ? layer.file : undefined;
                    data.url = layer.hasOwnProperty('url') ? layer.url : undefined;
                    data.style = layer.hasOwnProperty('style') ? layer.style : undefined;
                    data.type = (((layer) => {
                        if (layer instanceof itowns.ElevationLayer) {
                            return ITownsConstants.TypeElevation;
                        } else if (layer instanceof itowns.ColorLayer) {
                            return ITownsConstants.TypeColor;
                        } else if (layer instanceof itowns.PointCloudLayer) {
                            return ITownsConstants.TypePointCloud;
                        } else if (layer instanceof itowns.C3DTilesLayer) {
                            return ITownsConstants.Type3DTile;
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

    getCameraParams(camera3D) {
        return JSON.stringify({
            fovy: camera3D.fov,
            zoom: camera3D.zoom,
            near: camera3D.near,
            far: camera3D.far,
            filmOffset: camera3D.filmOffset,
            filmGauge: camera3D.filmGauge,
            aspect: camera3D.aspect
        });
    }

    /// 各種パフォーマンスを計測する
    measurePerformance() {
        /*
        {
            ズームレベル: [レベルごとの表示可能ノード, レベルごとの表示済ノード],
            ...
        }
        */
        let status = {}
        let tileLayer = this.itownsView.tileLayer;
        if (tileLayer) {
            function countVisible(node, stats) {
                if (!node || !node.visible) {
                    return;
                }
                if (node.level >= 0 && node.layer === tileLayer) {
                    if (stats[node.level]) {
                        stats[node.level][0] += 1;
                    } else {
                        stats[node.level] = [1, 0];
                    }
                    if (node.material.visible) {
                        stats[node.level][1] += 1;
                    }
                }
                if (node.children) {
                    for (const child of node.children) {
                        countVisible(child, stats);
                    }
                }
            }

            // update bar graph
            const stats = {};
            countVisible(tileLayer.object3d, stats);
            status.nodeVisible = stats;
        }

        // テクスチャ数
        {
            let renderer = this.itownsView.mainLoop.gfxEngine.renderer;
            const memory = renderer.info.memory;
            status.textureCount = memory.textures;
            status.geometryCount = memory.geometries;
            console.log(status)
        }
        return status;
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
            this.layerDataList = this.getLayerDataList();
            this.iframeConnector.send(ITownsCommand.AddLayer, this.layerDataList);
        });
        this.itownsView.addEventListener(itowns.VIEW_EVENTS.LAYER_REMOVED, (evt) => {
            this.layerDataList = this.getLayerDataList();
            this.iframeConnector.send(ITownsCommand.UpdateLayer, this.layerDataList);
        });
        this.itownsView.addEventListener(itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED, (evt) => {
            this.layerDataList = this.getLayerDataList();
            this.iframeConnector.send(ITownsCommand.UpdateLayer, this.layerDataList);
        });

        this.iframeConnector.on(ITownsCommand.Init, (err, param, data) => {
            // メッセージの返信
            this.iframeConnector.sendResponse(data);

            // 初期カメラ位置送信
            let worldMat = JSON.stringify(this.itownsView.camera.camera3D.matrixWorld.elements);
            let cameraParams = this.getCameraParams(this.itownsView.camera.camera3D);
            this.iframeConnector.send(ITownsCommand.UpdateCamera, {
                mat: worldMat,
                params: cameraParams
            });

            // 初期レイヤー送信
            if (this.layerDataList.length >= 0) {
                this.iframeConnector.send(ITownsCommand.AddLayer, this.layerDataList);
            }

            // カメラ動いた時にマトリックスを送信
            this.itownsView.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_CAMERA_UPDATE, (() => {
                return (a, b, c) => {
                    let mat_ = JSON.stringify(this.itownsView.camera.camera3D.matrixWorld.elements);
                    let params_ = this.getCameraParams(this.itownsView.camera.camera3D);
                    if (worldMat !== mat_ || cameraParams !== params_) {
                        // カメラが動いた.
                        worldMat = mat_;
                        cameraParams = params_;
                        this.iframeConnector.send(ITownsCommand.UpdateCamera, {
                            mat: mat_,
                            params: params_
                        });
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
