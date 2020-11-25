/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

// chowder_itowns_injectionで1jsにeventemitterもまとめたいので、このファイルでは直接importする
import EventEmitter from '../../../3rd/js/eventemitter3/index.js'
import Action from './action'
import IFrameConnector from '../common/iframe_connector'
import ITownsCommand from '../common/itowns_command';
import ITownsConstants from '../itowns/itowns_constants.js';
import CraeteBarGraphLayer from './bargraph_layer.js';
import CreateOBJLayer from './obj_layer.js';
import CreateTimescalePotreeLayer from './timeseries_potree_layer.js';

const getTextureFloat = (buffer, view) => {
    // webgl2
    if (view.mainLoop.gfxEngine.renderer.capabilities.isWebGL2)
    {
        const texture = new itowns.THREE.DataTexture(buffer, 256, 256, itowns.THREE.RedFormat, itowns.THREE.FloatType);
        texture.internalFormat = 'R32F';
        return texture;
    }
    else
    {
        // webgl1
        return new itowns.THREE.DataTexture(buffer, 256, 256, itowns.THREE.AlphaFormat, itowns.THREE.FloatType);
    }
};

function checkResponse(response) {
    if (!response.ok) {
        let error = new Error(`Error loading ${response.url}: status ${response.status}`);
        error.response = response;
        throw error;
    }
}

function fetchText(url, options = {}) {
	return fetch(url, options).then((response) => {
		checkResponse(response);
		return response.text();
	});
}

const isTimeseriesPotreeLayer = (layer) => {
    return layer.hasOwnProperty('isTimeseriesPotree') && layer.isTimeseriesPotree;
};

const isBarGraphLayer = (layer) => {
    return layer.hasOwnProperty('isBarGraph') && layer.isBarGraph;
};

const isOBJLayer = (layer) => {
    return layer.hasOwnProperty('isOBJ') && layer.isOBJ;
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

        this.BarGraphExtent = new itowns.Extent('EPSG:4326', 0, 0, 0);

        this.date = null;
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
            // レイヤー初期化命令
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
     * chowder側で独自にisBarGraphフラグを設定した、BarGraphLayerを返す
     */
    getBarGraphLayers() {
        let res = [];
        let layers = this.itownsView.getLayers();
        for (let i = 0; i < layers.length; ++i) {
            if (isBarGraphLayer(layers[i])) {
                res.push(layers[i]);
            }
        }
        return res;
    }

    /**
     * chowder側で独自にisOBJフラグを設定した、OBJLayerを返す
     */
    getOBJLayers() {
        let res = [];
        let layers = this.itownsView.getLayers();
        for (let i = 0; i < layers.length; ++i) {
            if (isOBJLayer(layers[i])) {
                res.push(layers[i]);
            }
        }
        return res;
    }

    /**
     * chowder itowns appの時系列表示に対応したLayerを返す
     */
    getTimescaleLayers() {
        let res = [];
        let layers = this.itownsView.getLayers();
        for (let i = 0; i < layers.length; ++i) {
            if (isBarGraphLayer(layers[i])
            || isTimeseriesPotreeLayer(layers[i])) {
                res.push(layers[i]);
            }
        }
        return res;
    }

    /**
     * 地理院DEMのtxt用fetcher/parsarを,mapSourceに設定する.
     * @param {*} mapSource 
     */
    installCSVElevationParsar(mapSource) {
        console.log("installCSVElevationParsar");

        mapSource.fetcher = function (url, options = {}) {
            return fetchText(url, options).then((data) => {
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
                let texture = getTextureFloat(floatArray, this.itownsView);
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
        mapSource.fetcher = (url, options = {}) => {
            return texture(url, options).then((tex) => {
                let floatArray = convertTexToArray(tex);
                let float32Array = new Float32Array(floatArray);
                let tt = getTextureFloat(float32Array, this.itownsView);
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
            if (config.format === "image/x-bil;bits=32" || config.hasOwnProperty('tileMatrixSet')) {
                config.name = config.id;
                mapSource = new itowns.WMTSSource(config);
            } else if (config.format === "csv" || config.format === "txt") {
                this.installCSVElevationParsar(mapSource);
            } else if (config.format.indexOf("png") >= 0) {
                this.installPNGElevationParsar(mapSource);
            }
            console.error("mapSource", mapSource, config)
            if (config.hasOwnProperty('tileMatrixSet') && config.tileMatrixSet === "iTowns") {
                return new itowns.ElevationLayer(config.id, {
                    source: mapSource,
                    updateStrategy: {
                        type: 3
                    },
                    useColorTextureElevation : true,
                    colorTextureElevationMinZ : 37,
                    colorTextureElevationMaxZ : 248,
                    scale: 1
                });
            } else {
                return new itowns.ElevationLayer(config.id, {
                    source: mapSource,
                    updateStrategy: {
                        type: 3
                    },
                    scale: 1
                });
            }
        }
        if (type === ITownsConstants.TypePointCloud) {
            config.crs = this.itownsView.referenceCrs;
            return new itowns.PotreeLayer(config.id, {
                source: new itowns.PotreeSource(config)
            });
        }
        if (type === ITownsConstants.TypePointCloudTimeSeries) {
            config.crs = this.itownsView.referenceCrs;
            return CreateTimescalePotreeLayer(this.itownsView, config);
        }
        if (type === ITownsConstants.Type3DTile) {
            return new itowns.C3DTilesLayer(config.id, config, this.itownsView);
        }
        if (type === ITownsConstants.TypeBargraph) {
            return CraeteBarGraphLayer(this.itownsView, config);
        }
        if (type === ITownsConstants.TypeOBJ) {
            return CreateOBJLayer(this.itownsView, config);
        }
        if (type === ITownsConstants.TypeGeometry || config.format === "pbf") {
            let mapSource = null;
            if (config.format === "geojson") {
                mapSource = new itowns.TMSSource(config);
                if (config.url.indexOf('gsi.go.jp')) {
                    mapSource.inCrs = "EPSG:4326";
                }
                mapSource.style = config.style;
                return new itowns.GeometryLayer(config.id, new itowns.THREE.Group(), {
                    update: itowns.FeatureProcessing.update,
                    convert: itowns.Feature2Mesh.convert({
                        color: new itowns.THREE.Color(0xbbffbb),
                        extrude: 80
                    }),
                    source: mapSource
                });
            }
            else if (config.format === "pbf") {
                // Add a vector tile layer
                function inter(z) {
                    return z - (z % 5);
                }
                function isValidData(data, extentDestination) {
                    const isValid = inter(extentDestination.zoom) == inter(data.extent.zoom);
                    return isValid;
                }
                mapSource = new itowns.VectorTilesSource(config);
                if (config.url.indexOf('gsi.go.jp')) {
                    mapSource.inCrs = "EPSG:4326";
                }
                mapSource.style = config.style;
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
        if (url) {
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
        }

        let config = {};
        if (type === ITownsConstants.TypeColor) {
            config = {
                "crs": "EPSG:3857",
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
                "crs": "EPSG:4326",
                "tileMatrixSet": params.hasOwnProperty('tileMatrixSet') ? params.tileMatrixSet : "WGS84G",
                "format": params.hasOwnProperty('format') ? params.format : "image/x-bil;bits=32",
                "url": url,
                "scale": 1
            };
            if (url.indexOf('.png') > 0) {
                // 地理院
                config.format = "image/png";
                config.crs = "EPSG:3857";
                config.tileMatrixSet = "PM";
            }
            if (url.indexOf('.txt') > 0 || url.indexOf('.csv') > 0) {
                // 地理院
                config.format = "csv"
                config.crs = "EPSG:3857";
                config.tileMatrixSet = "PM";
            }

        }
        if (type === ITownsConstants.TypePointCloud
            || type === ITownsConstants.TypePointCloudTimeSeries) {
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
                "source": new itowns.C3DTilesSource({
                    "url": url
                })
            };
        }
        if (type === ITownsConstants.TypeBargraph) {
            config = {
                "crs": "EPSG:3857",
                "isUserData": true,
                "opacity": 1.0,
                "url": url,
            };
        }
        if (type === ITownsConstants.TypeOBJ) {
            config = {
                "crs": "EPSG:4978",
                "isUserData": true,
                "opacity": 1.0,
                "url": url,
            };
            if (params.hasOwnProperty('mtlurl')) {
                config.mtlurl = params.mtlurl;
            }
        }
        if (url && url.indexOf('.geojson') >= 0) {
            config = {
                "crs": "EPSG:3857",
                "tileMatrixSet": "PM",
                "url": url
            }
            if (params.hasOwnProperty('style')) {
                config.style = params.style;
            }
            config.format = "geojson";
        }
        if (url && url.indexOf('.pbf') >= 0) {
            config = {
                "crs": "EPSG:3857",
                "tileMatrixSet": "PM",
                "url": url
            }
            if (params.hasOwnProperty('style')) {
                config.style = params.style;
            }
            config.format = "pbf";
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
        if (params.hasOwnProperty('attribution')) {
            config.attribution = params.attribution;
        }
        if (params.hasOwnProperty('sseThreshold')) {
            config.sseThreshold = params.sseThreshold;
        }
        if (params.hasOwnProperty('wireframe')) {
            config.wireframe = params.wireframe;
        }
        if (params.hasOwnProperty('pointSize')) {
            config.pointSize = params.pointSize;
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
        if (params.hasOwnProperty('isBarGraph') && params.isBarGraph) {
            type = ITownsConstants.TypeBargraph;
        }
        if (params.hasOwnProperty('isTimeseriesPotree') && params.isTimeseriesPotree) {
            type = ITownsConstants.TypePointCloudTimeSeries;
        }
        if (params.hasOwnProperty('isOBJ') && params.isOBJ) {
            type = ITownsConstants.TypeOBJ;
        }
        let config = this.createLayerConfigByType(params, type);
        let layer = this.createLayerByType(config, type);
        if (layer) {
            // 生成時に反映されないレイヤープロパティは、生成後に反映させる
            if (params.hasOwnProperty('opacity')) {
                layer.opacity = params.opacity;
            }
            if (params.hasOwnProperty('visible')) {
                layer.visible = Boolean(params.visible);
            }
            if (params.hasOwnProperty('bbox')) {
                layer.bboxes.visible = Boolean(params.bbox);
            }
            if (type === ITownsConstants.TypePointCloud ||
                type === ITownsConstants.TypePointCloudTimeSeries    ||
                type === ITownsConstants.Type3DTile ||
                type === ITownsConstants.TypeBargraph ||
                type === ITownsConstants.TypeOBJ) {
                itowns.View.prototype.addLayer.call(this.itownsView, layer);
            } else {
                this.itownsView.addLayer(layer);
            }
        }
    }

    /**
     * レイヤーリストを元に初期化する
     * 既存の有効なレイヤーはすべて削除され、layerListに記載されたレイヤーが追加される
     * @param {*} layerList 
     */
    initLayers(layerList) {
        // console.log("layerList", layerList)
        // 特殊なレイヤー以外削除
        this.isStopDispatchRemoveEvent = true;
        for (let i = this.layerDataList.length - 1; i >= 0; --i) {
            if (this.layerDataList[i].type === ITownsConstants.TypeUser) {
                continue;
            } else {
                const id = this.layerDataList[i].id;
                if ((this.layerDataList[i].hasOwnProperty('url') && this.layerDataList[i].url !== "none")
                    || (this.layerDataList[i].hasOwnProperty('file') && this.layerDataList[i].file)) {
                    let layer = this.getLayer(id);
                    if (layer) {
                        this.itownsView.removeLayer(id);
                    }
                }
            }
        }
        this.isStopDispatchRemoveEvent = false;
        // レイヤーの追加
        for (let i = 0; i < layerList.length; ++i) {
            if (layerList[i].type === ITownsConstants.TypeUser) {
                let src = layerList[i];
                let dst = this.getLayer(src.id);
                dst.wireframe = src.wireframe;
                dst.visible = src.visible;
                dst.opacity = src.opacity;
            } else {
                this.addLayer(layerList[i]);
            }
        }
        const initializeOneTime = () => {
            for (let i = 0; i < layerList.length; ++i) {
                this.changeLayerProperty(layerList[i])
            }

            this.iframeConnector.send(ITownsCommand.LayersInitialized, {}, function () { });
            this.itownsView.removeEventListener('layers-initialized', initializeOneTime);
        }

        // iTownsAppで保持しているパラメータを反映させる
        this.itownsView.addEventListener('layers-initialized', initializeOneTime);
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
    async changeLayerOrder(params) {
        const id = params.id;
        const isUp = params.isUp ? true : false;
        const validLayers = await this.getLayerDataList();
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
    changeLayerProperty(params, redraw = true) {
        let id = params.id;
        let layer = this.getLayer(id);
        let isChanged = false;
        if (layer) {
            let isUpdateSource = false;
            if (params.hasOwnProperty('url') 
                && layer.hasOwnProperty('source')
                && layer.source.hasOwnProperty('url'))
            {
                // URLが違う場合はソース更新
                isUpdateSource = isUpdateSource || (params.url !== layer.source.url);
                // update_idが違う場合はソース更新
                isUpdateSource = isUpdateSource || (params.update_id !== layer.update_id);
            }
            if (isUpdateSource)
            {
                if (layer.source instanceof itowns.C3DTilesSource) {
                    this.itownsView.removeLayer(layer.id);
                    let config = this.createLayerConfigByType(params, params.type);
                    config.source = new itowns.C3DTilesSource({
                        "url": params.url
                    });
                    layer = new itowns.C3DTilesLayer(layer.id, config, this.itownsView);
                    itowns.View.prototype.addLayer.call(this.itownsView, layer);
                }
                if (layer.isOBJ) {
                    this.itownsView.removeLayer(layer.id);
                    let config = this.createLayerConfigByType(params, params.type);
                    layer = CreateOBJLayer(this.itownsView, config);
                    itowns.View.prototype.addLayer.call(this.itownsView, layer);
                }
                isChanged = true;
            }
            if (params.hasOwnProperty('update_id')) {
                layer.update_id = params.update_id;
                isChanged = true;
            }
            if (params.hasOwnProperty('opacity')) {
                layer.opacity = Number(params.opacity);
                isChanged = true;
            }
            if (params.hasOwnProperty('visible')) {
                layer.visible = Boolean(params.visible);
                isChanged = true;
            }
            if (params.hasOwnProperty('bbox')) {
                layer.bboxes.visible = Boolean(params.bbox);
                if (layer.isTimeseriesPotree) {
                    layer.updateParams();
                }
                isChanged = true;
            }
            if (params.hasOwnProperty('scale')) {
                layer.scale = params.scale;
                isChanged = true;
            }
            if (params.hasOwnProperty('size')) {
                layer.size = Number(params.size);
                isChanged = true;
            }
            if (params.hasOwnProperty('pointSize')) {
                layer.pointSize = Number(params.pointSize);
                isChanged = true;
            }
            if (params.hasOwnProperty('wireframe')) {
                layer.wireframe = Boolean(params.wireframe);
                isChanged = true;
            }
            if (params.hasOwnProperty('sseThreshold')) {
                layer.sseThreshold = Number(params.sseThreshold);
                isChanged = true;
            }
            if (params.hasOwnProperty('bargraphParams')) {
                layer.bargraphParams = JSON.parse(JSON.stringify(params.bargraphParams));
                isChanged = true;
            }
            /*
            if (params.hasOwnProperty('pointBudget')) {
                layer.pointBudget = Number(params.pointBudget);
                isChanged = true;
                console.error("pointBudget", layer.pointBudget)
            }
            */
            if ((params.hasOwnProperty('offset_xyz')
                || params.hasOwnProperty('offset_uvw')
                || params.hasOwnProperty('offset_small_uv')) &&
                layer.object3d &&
                layer.object3d.children.length > 0) {
                for (let i = 0; i < layer.object3d.children.length; ++i) {
                    let target = layer.object3d.children[i];
                    let initial_position = { x: 0, y: 0, z: 0 };
                    let initial_quaternion = new itowns.THREE.Quaternion();
                    if (target["initial_position"]) {
                        initial_position = target.initial_position;
                        initial_quaternion = target.initial_quaternion;
                    } else {
                        target.initial_position = target.position.clone();
                        target.initial_quaternion = target.quaternion.clone();
                    }
                    let vec = target.initial_position.clone();
                    if (vec.length() === 0) {
                        if (layer.hasOwnProperty('root')) {
                            vec = layer.root.bbox.min.clone()
                        }
                    }

                    vec.normalize();
                    let u = vec.clone();
                    u.cross(new itowns.THREE.Vector3(0, 1, 0));
                    let v = vec.clone();
                    v.cross(u);
                    let w = vec.clone();

                    let mw = { x: 0, y: 0, z: 0 };
                    let xyz = { x: 0, y: 0, z: 0 };
                    // position
                    if (params.hasOwnProperty('offset_xyz')) {
                        xyz = params.offset_xyz;
                    }
                    if (params.hasOwnProperty('offset_uvw')) {
                        w.multiplyScalar(params.offset_uvw.w * 100);
                        mw = w;
                    }
                    let position = new itowns.THREE.Vector3(
                        initial_position.x + xyz.x + mw.x,
                        initial_position.y + xyz.y + mw.y,
                        initial_position.z + xyz.z + mw.z
                    );
                    // rotation
                    let quaternionTUV = new itowns.THREE.Quaternion();
                    let quaternionUV = new itowns.THREE.Quaternion();
                    if (params.hasOwnProperty('offset_small_uv')) {
                        let quaternionTU = new itowns.THREE.Quaternion();
                        let quaternionTV = new itowns.THREE.Quaternion();
                        quaternionTU.setFromAxisAngle(u, params.offset_small_uv.u * Math.PI / 180.0 / 1.0e6);
                        quaternionTV.setFromAxisAngle(v, params.offset_small_uv.v * Math.PI / 180.0 / 1.0e6);
                        quaternionTUV.copy(quaternionTU);
                        quaternionTUV.multiply(quaternionTV);
                    }
                    if (params.hasOwnProperty('offset_uvw')) {
                        let quaternionU = new itowns.THREE.Quaternion();
                        let quaternionV = new itowns.THREE.Quaternion();
                        quaternionU.setFromAxisAngle(u, params.offset_uvw.u * Math.PI / 180.0);
                        quaternionV.setFromAxisAngle(v, params.offset_uvw.v * Math.PI / 180.0);
                        quaternionUV.copy(quaternionU);
                        quaternionUV.multiply(quaternionV);
                    }
                    position.applyQuaternion(quaternionTUV)
                    position.applyQuaternion(quaternionUV)
                    target.matrixAutoUpdate = false;
                    target.position.copy(position);
                    target.quaternion.copy(initial_quaternion);
                    target.quaternion.multiply(quaternionTUV);
                    target.quaternion.multiply(quaternionUV);
                    target.updateMatrix();
                    target.updateMatrixWorld();
                    target.matrixAutoUpdate = true;
                    isChanged = true;
                }
            }
            if (isChanged && redraw) {
                this.itownsView.notifyChange(layer);
            }
        }
    }

    resizeWindow(param) {
        const rect = param.rect;
        const isSetOffset = param.isSetOffset;
        if (!rect) return;
        let width = document.body.clientWidth;
        let height = document.body.clientHeight;
        let fullWidth = width;
        let fullHeight = height;

        document.body.style.pointerEvents = "none"
        this.itownsViewerDiv.style.position = "relative";
        this.itownsViewerDiv.style.left = parseInt(rect.x) + "px";
        this.itownsViewerDiv.style.top = parseInt(rect.y) + "px";
        if (isSetOffset) {
            this.itownsViewerDiv.style.width = parseInt(rect.w) + "px";
            this.itownsViewerDiv.style.height = parseInt(rect.h) + "px";
        } else {
            this.itownsViewerDiv.style.width = "100%";
            this.itownsViewerDiv.style.height =  "100%";
        }
        this.itownsView.camera.camera3D.setViewOffset(fullWidth, fullHeight, rect.x, rect.y, rect.w, rect.h)
        this.itownsView.mainLoop.gfxEngine.renderer.setSize(rect.w, rect.h);
        
        if (window.chowder_itowns_view_type === "controller") {
            for (let i = 0; i < window.resizeListeners.length; ++i) {
                window.resizeListeners[i]();
            }
        }
        let canvas = this.itownsViewerDiv.getElementsByTagName('canvas')[0];
        if (canvas) {
            canvas.style.width = "100%";
            canvas.style.height = "100%";
        }
        this.itownsView.notifyChange(this.itownsView.camera.camera3D);
    }

    isViewReady() {
        //const allReady = this.itownsView.getLayers().every(layer => layer.ready);
        if (//*allReady &&
            this.itownsView.mainLoop.scheduler.commandsWaitingExecutionCount() == 0 &&
            this.itownsView.mainLoop.renderingState == 0 /*RENDERING_PAUSED*/) {
            return true;
        }
        return false;
    }

    injectaAsChOWDERDisplayController(data) {
        // Display, controllerはリサイズを弾く
        window.removeEventListener("resize");

        // 一定間隔同じイベントが来なかったら再描画するための関数
        let debounceRedraw = (() => {
            const interval = 500;
            let timer;
            let sumDT = 0.0;
            return (func, view, dt) => {
                sumDT += dt;
                clearTimeout(timer);
                timer = setTimeout(() => {
                    if (this.isViewReady()) {
                        func(view, sumDT);
                        sumDT = 0.0;
                    }
                    else {
                        debounceRedraw(func, view, sumDT);
                    }
                }, interval);
            };
        })();

        let aspectForResize = 1.0

        const getAspect = function (div) {
            const rect = div.getBoundingClientRect();
            return (rect.right - rect.left) / (rect.bottom - rect.top);
        }

        const debounceResize = (() => {
            const interval = 500;
            let timer;
            return (func) => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    let aspect = getAspect(this.itownsViewerDiv);
                    if (Math.abs(aspectForResize - aspect) > 0.02) {
                        aspectForResize = aspect;
                        func();
                        let canvas = this.itownsViewerDiv.getElementsByTagName('canvas')[0];
                        if (canvas) {
                            canvas.style.width = "100%";
                            canvas.style.height = "100%";
                        }
                    }
                }, interval);
            };
        })();

        // 初期化イベントに対する応答
        this.iframeConnector.on(ITownsCommand.Init, (err, param, request) => {
            this.iframeConnector.sendResponse(request);


            // chowder controllerのみ、負荷を下げるため、頻繁に再描画させないようにする
            // 具体的には、連続したredrawが発行された際に、最後に1回だけ実行するようにする。
            if (window.chowder_itowns_view_type === "controller") {
                const origRenderView = this.itownsView.mainLoop.__proto__._renderView.bind(this.itownsView.mainLoop);
                this.itownsView.mainLoop.__proto__._renderView = function (view, dt) {
                    debounceRedraw(origRenderView, view, dt);
                }

                // chowder controllerのみ、負荷を下げるため、初期の解像度を256,256固定とする
                aspectForResize = getAspect(this.itownsViewerDiv);
                let canvas = this.itownsViewerDiv.getElementsByTagName('canvas')[0];
                if (canvas) {
                    canvas.style.width = "100%";
                    canvas.style.height = "100%";
                }

                const origResize = this.itownsView.__proto__.resize.bind(this.itownsView);
                window.addEventListener("resize", (evt) => {
                    debounceResize(origResize);
                });

            }
        });

        // time更新
        this.iframeConnector.on(ITownsCommand.UpdateTime, (err, param, request) => {
            if (err) {
                console.error(err);
                return;
            }
            this.date = new Date(param.time);
            if (data.timeCallback) {
                data.timeCallback(this.date);
            }
            const layers = this.getTimescaleLayers();
            if (layers.length > 0) {
                for (let i = 0; i < layers.length; ++i) {
                    layers[i].updateByTime(this.date);
                }
                this.itownsView.notifyChange();
            }
            this.iframeConnector.sendResponse(request);
        });

        if (window.chowder_itowns_view_type === "display") {
            // Displayのみ計測
            this.iframeConnector.on(ITownsCommand.MeasurePerformance, (err, param, request) => {
                let before = 0;
                let frameCount = 0;
                let totalMillis = 0;
                // パフォーマンス計測命令
                let result = this.measurePerformance();

                let updateStart = () => {
                    if (frameCount === null) { return; }
                    before = Date.now();
                }
                let updateEnd = () => {
                    if (frameCount === null) { return; }
                    ++frameCount;
                    totalMillis += Date.now() - before;
                    if (frameCount >= 10) {
                        this.itownsView.removeFrameRequester(itowns.MAIN_LOOP_EVENTS.UPDATE_START, updateStart);
                        this.itownsView.removeFrameRequester(itowns.MAIN_LOOP_EVENTS.UPDATE_END, updateEnd);
                        let updateDuration = Math.floor(totalMillis / frameCount);

                        result.updateDuration = updateDuration;
                        // メッセージの返信
                        this.iframeConnector.sendResponse(request, result);

                        frameCount = null; // invalid
                    } else {
                        this.itownsView.notifyChange();
                    }
                }
                this.itownsView.addFrameRequester(itowns.MAIN_LOOP_EVENTS.UPDATE_START, updateStart);
                this.itownsView.addFrameRequester(itowns.MAIN_LOOP_EVENTS.UPDATE_END, updateEnd);
                this.itownsView.notifyChange();
            });
        }
    }

    // 操作可能なレイヤーのデータリストを返す
    async getLayerDataList() {
        let layers = this.itownsView.getLayers();
        let i;
        let dataList = [];
        let layer;
        for (i = 0; i < layers.length; ++i) {
            layer = layers[i];
            if (!layer) continue;
            if (layer.isChildLayer) continue; // 時系列データ用の子レイヤーは除く
            let data = {};
            if (layer.hasOwnProperty('bboxes')) {
                data.bbox = layer.bboxes.visible;
            }
            if (layer.hasOwnProperty('pointSize')) {
                data.pointSize = layer.pointSize;
            }
            if (layer.hasOwnProperty('wireframe')) {
                data.wireframe = layer.wireframe;
            }
            if (layer.hasOwnProperty('opacity')) {
                data.opacity = layer.opacity;
            }
            if (layer.hasOwnProperty('sseThreshold')) {
                data.sseThreshold = layer.sseThreshold;
            }
            if (layer.hasOwnProperty('scale')) {
                data.scale = layer.scale;
            }
            if (layer.hasOwnProperty('size')) {
                data.size = layer.size;
            }
            if (layer.hasOwnProperty('isBarGraph')) {
                data.isBarGraph = layer.isBarGraph;
                if (!layer.ready) {
                    await layer.whenReady;
                }
                if (layer.hasOwnProperty('source') && layer.source._featuresCaches.hasOwnProperty(layer.crs)) {
                    let csvData = await layer.source.loadData(this.BarGraphExtent, layer);
                    data.csv = csvData.csv;
                }
            }
            if (layer.hasOwnProperty('isTimeseriesPotree')) {
                data.isTimeseriesPotree = layer.isTimeseriesPotree;
                if (!layer.ready) {
                    await layer.whenReady;
                }
                let jsonData = await layer.source.loadData(layer.tempExtent, layer);
                data.json = jsonData.json;
            }
            if (layer.hasOwnProperty('isOBJ')) {
                data.isOBJ = layer.isOBJ;
            }
            if (layer.hasOwnProperty('source') && layer.source.hasOwnProperty('format')) {
                data.format = layer.source.format;
            }
            if (layer.hasOwnProperty('source') && layer.source.hasOwnProperty('attribution')) {
                if (layer.source !== undefined) {
                    data.attribution = layer.source.attribution;
                }
            }
            if (
                (layer.hasOwnProperty('source') && layer.source.hasOwnProperty('url')) ||
                (layer.hasOwnProperty('source') && layer.hasOwnProperty('file')) ||
                (layer.hasOwnProperty('name') && layer.hasOwnProperty('url')) ||
                (layer.hasOwnProperty('isUserLayer') && layer.isUserLayer === true)
            ) {
                if (layer.hasOwnProperty('source')) {
                    data.visible = layer.visible;
                    data.crs = layer.crs;
                    data.id = layer.id;
                    data.url = layer.source.hasOwnProperty('url') ? layer.source.url : layer.url;
                    data.style = layer.source.hasOwnProperty('style') ? layer.source.style : undefined;
                    data.mtlurl = layer.source.hasOwnProperty('mtlurl') ? layer.source.mtlurl : undefined;
                    data.zoom = layer.source.hasOwnProperty('zoom') ? layer.source.zoom : undefined;
                    data.file = layer.source.hasOwnProperty('file') ? layer.source.file : undefined;
                    data.type = (((layer) => {
                        if (layer.hasOwnProperty('isUserLayer') && layer.isUserLayer === true) {
                            return ITownsConstants.TypeUser;
                        } else if (layer instanceof itowns.ElevationLayer) {
                            return ITownsConstants.TypeElevation;
                        } else if (layer instanceof itowns.ColorLayer) {
                            return ITownsConstants.TypeColor;
                        } else if (layer instanceof itowns.PotreeLayer) {
                            return ITownsConstants.TypePointCloud;
                        } else if (layer.isTimeseriesPotree) {
                            return ITownsConstants.TypePointCloudTimeSeries;
                        } else if (layer instanceof itowns.C3DTilesLayer) {
                            return ITownsConstants.Type3DTile;
                        } else if (layer instanceof itowns.GeometryLayer || layer.isBarGraph || layer.isOBJ) {
                            return ITownsConstants.TypeGeometry;
                        } else {
                            return ITownsConstants.TypeUser;
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
                    data.mtlurl = layer.hasOwnProperty('mtlurl') ? layer.mtlurl : undefined;
                    data.type = (((layer) => {
                        if (layer.hasOwnProperty('isUserLayer')) {
                            return ITownsConstants.TypeUser;
                        } else if (layer instanceof itowns.ColorLayer) {
                            return ITownsConstants.TypeColor;
                        } else if (layer instanceof itowns.PotreeLayer) {
                            return ITownsConstants.TypePointCloud;
                        } else if (layer.isTimeseriesPotree) {
                            return ITownsConstants.TypePointCloudTimeSeries;
                        } else if (layer instanceof itowns.C3DTilesLayer) {
                            return ITownsConstants.Type3DTile;
                        } else if (layer instanceof itowns.GeometryLayer || layer.isBarGraph || layer.isOBJ) {
                            return ITownsConstants.TypeGeometry;
                        } else {
                            return ITownsConstants.TypeUser;
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
                        done = true;
                        this.iframeConnector.send(ITownsCommand.AddContent, {
                            thumbnail: thumbnailBase64,
                            layerList: this.layerDataList
                        }, function () {
                            done = true;
                        });
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
                }, function () {
                    done = true;
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

        // 各種カウント情報
        {
            let renderer = this.itownsView.mainLoop.gfxEngine.renderer;
            const memory = renderer.info.memory;
            status.textureCount = memory.textures;
            status.geometryCount = memory.geometries;
            status.triangleCount = renderer.info.render.triangles;
            status.pointCount = renderer.info.render.points;
            status.lineCount = renderer.info.render.lines;
        }
        return status;
    }

    async injectAsChOWDERiTownController(data) {
        let menuDiv = document.getElementById('menuDiv');
        if (menuDiv) {
            menuDiv.style.position = "absolute";
            menuDiv.style.top = "10px";
            menuDiv.style.left = "10px";
        }

        // time更新
        this.iframeConnector.on(ITownsCommand.UpdateTime, (err, param, request) => {
            if (err) {
                console.error(err);
                return;
            }
            this.date = new Date(param.time);
            if (data.timeCallback) {
                data.timeCallback(this.date);
            }
            const layers = this.getTimescaleLayers();
            if (layers.length > 0) {
                for (let i = 0; i < layers.length; ++i) {
                    layers[i].updateByTime(this.date);
                }
                this.itownsView.notifyChange();
            }
            this.iframeConnector.sendResponse(request);
        });

        this.layerDataList = await this.getLayerDataList();
        this.itownsView.addEventListener(itowns.VIEW_EVENTS.LAYER_ADDED, async (evt) => {
            this.layerDataList = await this.getLayerDataList();
            this.iframeConnector.send(ITownsCommand.AddLayer, this.layerDataList);
        });
        this.itownsView.addEventListener(itowns.VIEW_EVENTS.LAYER_REMOVED, async (evt) => {
            if (!this.isStopDispatchRemoveEvent) {
                this.layerDataList = await this.getLayerDataList();
                this.iframeConnector.send(ITownsCommand.UpdateLayer, this.layerDataList);
            }
        });
        this.itownsView.addEventListener(itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED, (evt) => {
            //this.layerDataList = this.getLayerDataList();
            //this.iframeConnector.send(ITownsCommand.UpdateLayer, this.layerDataList);
        });

        //  itowns追加用コントローラーからひかれた
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
                    this.injectAsChOWDERiTownController(data);
                } else {
                    // displayまたはcontrollerから開かれた(itowns画面に対して操作不可)
                    this.injectaAsChOWDERDisplayController(data);

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
