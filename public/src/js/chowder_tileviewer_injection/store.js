/**
 * Store.
 * tileviewerに操作を行うため, tileviewerのviewインスタンスを保持する
 * また, iframeの親windowと通信を行う
 */

// chowder_itowns_injectionで1jsにeventemitterもまとめたいので、このファイルでは直接importする
import EventEmitter from '../../../3rd/js/eventemitter3/index.js'
import Action from './action'
import IFrameConnector from '../common/iframe_connector'
import TileViewerCommand from '../common/tileviewer_command.js';

const LoDScaleLabelID = "__lod_scale_label__";
const LoDScaleLabelPrefix = "Zoom Level : ";

class Store extends EventEmitter {
    constructor(action) {
        super();
        this.action = action;
        this.layerDataList = [];

        this.isResizing = false;
        this.initEvents();
        this.connectParent();
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
        this.initIFrameEvents();
        this.iframeConnector.connect(async() => {});
    }

    initIFrameEvents() {
        this.iframeConnector.on(TileViewerCommand.Resize, (err, param, request) => {
            // リサイズ命令
            this.resizeWindow(param);
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
        this.iframeConnector.on(TileViewerCommand.UpdateCamera, (err, cameraData, request) => {
            // カメラ更新命令
            try {
                const preInfo = this.instance.getCameraInfo();
                const cameraInfo = JSON.parse(cameraData.params);
                this.instance.setCameraInfo(cameraInfo);
            } catch (e) {
                console.error(e);
            }
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
        this.iframeConnector.on(TileViewerCommand.ChangeLayerProperty, (err, param, request) => {
            if (param) {
                // レイヤープロパティ変更命令
                this.changeLayerProperty(param);
            }
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
        this.iframeConnector.on(TileViewerCommand.AddLayer, (err, param, request) => {
            // レイヤー追加命令
            this.addLayer(param);
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
        this.iframeConnector.on(TileViewerCommand.InitLayers, (err, param, request) => {
            // レイヤー初期化命令
            this.initLayers(param);
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
        this.iframeConnector.on(TileViewerCommand.DeleteLayer, (err, param, request) => {
            // レイヤー削除命令
            this.deleteLayer(param);
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
        this.iframeConnector.on(TileViewerCommand.ChangeLayerOrder, (err, param, request) => {
            // レイヤー順序変更命令
            this.changeLayerOrder(param);
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
        this.iframeConnector.on(TileViewerCommand.UpdateViewerParam, (err, param, request) => {
            this.updateViewerParam(param);
            // メッセージの返信
            this.iframeConnector.sendResponse(request);
        });
    }

    updateViewerParam(param) {
        if (param && param.params.hasOwnProperty('zoomLabelVisible'))
        {
            let lodScaleLabel = document.getElementById(LoDScaleLabelID);
            if ((String(param.params.zoomLabelVisible) === "true")) {
                lodScaleLabel.style.display = "block";
            } else {
                lodScaleLabel.style.display = "none";
            }
        }
    }


    /**
     * レイヤー追加
     * @param params
     * { 
     *   id : 対象レイヤのID
     *   url : 追加するURL
     *   type : 追加するレイヤのタイプ
     *   zoom : { min : 0, max : 24 } ズーム範囲 (option)
     * }
     */
    async addLayer(params) {
        let layerData = {
            id: params.id,
            url: params.url,
            opacity: 1.0,
            visible: true,
            type: params.type
        };
        if (params.hasOwnProperty('zoom')) {
            layerData.zoom = JSON.parse(JSON.stringify(params.zoom));
        }
        let options = this.instance.getOptions();
        if (options.maps.length === 0) {
            if (params.type.indexOf('himawari8') >= 0) {
                options.geodeticSystem = params.type;
            }
        }
        // 画像の場合は背景画像として扱う
        if (params.type === "image") {
            options.backgroundImage = layerData.url;
            options.backgroundVisible = layerData.visible;
            options.backgroundOpacity = layerData.opacity;
            if (this.layerDataList.length > 0) {
                if (this.layerDataList[0].type === "image")
                {
                    // 既に背景画像が設定されている場合
                    this.layerDataList[0].url = layerData.url;
                } else {
                    // 新規背景追加
                    this.layerDataList.unshift(layerData);
                }
            } else {
                // 新規背景追加
                this.layerDataList.unshift(layerData);
            }
        } else {
            this.layerDataList.push(layerData);
            options.maps.push({
                url: params.url,
                scales: this.instance.generateScales(params, params.type),
                visible : params.visible,
                opacity : params.opacity
            });
        }
        this.instance.setOptions(options, false);
        await this.instance.update();
        this.instance._resizeScaling(true);

        this.iframeConnector.send(TileViewerCommand.AddLayer, this.layerDataList, () => {})
    }

    deleteLayer(params) {
        if (params.hasOwnProperty('id')) {
            const layerIndex = this.getLayerIndex(params.id);
            if (layerIndex >= 0) {
                this.layerDataList.splice(layerIndex, 1);
                this.initLayers(JSON.parse(JSON.stringify(this.layerDataList)));
                this.iframeConnector.send(TileViewerCommand.DeleteLayer, this.layerDataList, () => {})
            }
        }
    }

    changeLayerOrder(param) {
        if (param.hasOwnProperty('id') && param.hasOwnProperty('isUp')) {
            const isUp = param.isUp;
            const layerIndex = this.getLayerIndex(param.id);
            if (layerIndex >= 0) {
                const hasBackground = this.layerDataList[0].type === "image";
                if (layerIndex === 0 && hasBackground) {
                    // 背景は移動できないこととする
                    return;
                }
                const startIndex = hasBackground ? 1 : 0;
                if (isUp && (layerIndex - 1) >= startIndex) {
                    const v = this.layerDataList[layerIndex];
                    this.layerDataList[layerIndex] = this.layerDataList[layerIndex - 1];
                    this.layerDataList[layerIndex - 1] = v;
                    this.initLayers(JSON.parse(JSON.stringify(this.layerDataList)));
                } else if (!isUp && (layerIndex + 1) < this.layerDataList.length) {
                    const v = this.layerDataList[layerIndex];
                    this.layerDataList[layerIndex] = this.layerDataList[layerIndex + 1];
                    this.layerDataList[layerIndex + 1] = v;
                    this.initLayers(JSON.parse(JSON.stringify(this.layerDataList)));
                }
            }
        }
    }

    initLayers(params) {
        console.log('initLayers', params)
        let options = this.instance.getOptions();
        options.maps = [];
        for (let i = 0; i < params.length; ++i) {
            let param = params[i];
            if (i === 0 && param.type === 'image') {
                options.backgroundImage = param.url;
            } else if (i === 0) {
                if (options.hasOwnProperty('backgroundImage')) {
                    delete options.backgroundImage;
                }
                options.maps.push({
                    url: param.url,
                    scales: this.instance.generateScales(param, param.type),
                    visible : param.visible,
                    opacity : param.opacity,
                });
            } else {
                options.maps.push({
                    url: param.url,
                    scales: this.instance.generateScales(param, param.type),
                    visible : param.visible,
                    opacity : param.opacity,
                });
            }
        }
        this.instance.setOptions(options, false);

        // setOptionsでlayerDataListがリセット
        this.layerDataList = [];

        for (let i = 0; i < params.length; ++i) {
            let param = params[i];
            let layerData = {
                id: param.id,
                url: param.url,
                opacity: param.opacity,
                visible: param.visible,
                type: param.type
            }
            if (param.hasOwnProperty('zoom')) {
                layerData.zoom = JSON.parse(JSON.stringify(param.zoom));
            }
            this.layerDataList.push(layerData);
        }
        this.instance.update();
        
        this.iframeConnector.send(TileViewerCommand.UpdateLayer, this.layerDataList, () => {});
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
        const layerIndex = this.getLayerIndex(params.id);
        // this.layerDataListに設定
        if (layerIndex !== null) {
            this.layerDataList[layerIndex].visible = params.visible;
            this.layerDataList[layerIndex].opacity = params.opacity;
        }

        // tileviewerのほうにも設定
        if (params.type ==='image') {
            this.instance.setBackgroundOpacity(params.opacity, false);
            this.instance.setBackgroundVisible(params.visible, false);
            this.instance.update();
        } else {
            const mapIndex = this.getMapIndex(params.id);
            if (mapIndex !== null) {
                this.instance.setOpacity(mapIndex, params.opacity, false);
                this.instance.setVisible(mapIndex, params.visible, false);
                this.instance.update();
            }
        }
    }


    resizeWindow(param) {
        // console.log("resizeWindow", param);
        const contentRect = param.param.contentRect;
        const intersectRect = param.param.intersectRect;

        const contentW = contentRect.right - contentRect.left;
        const contentH = contentRect.bottom - contentRect.top;

        const left = (intersectRect.left - contentRect.left) / contentW;
        const top = (intersectRect.top - contentRect.top) / contentH;
        const right = (intersectRect.right - contentRect.left) / contentW;
        const bottom = (intersectRect.bottom - contentRect.top) / contentH;

        const viewport = [
            left, top, right, bottom
        ];
        this.instance.setViewport(viewport);
    }

    generateDummyThumbnail(id) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 256;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "black";
        ctx.font = "40px sans-serif";
        ctx.fillText("TileViewer", 10, 50);
        ctx.font = "30px sans-serif";
        ctx.fillText("ID:", 10, 100);
        ctx.fillText(id, 60, 100);
        return canvas.toDataURL("image/jpeg");
    }

    initLayerDataList() {
        this.layerDataList = [];
        const options = this.instance.getOptions();
        if (options.hasOwnProperty('backgroundImage')) {
            this.layerDataList.push({
                id: "BackgourndImage",
                url: options.backgroundImage,
                opacity: this.instance.getBackgroundOpacity(),
                visible: this.instance.getBackgroundVisible(),
                type: "image"
            });
        }
        for (let i = 0; i < options.maps.length; ++i) {
            const map = options.maps[i];
            const url = map.url;
            this.layerDataList.push({
                id: "Layer_" + i,
                url: url,
                opacity: this.instance.getOpacity(i),
                visible: this.instance.getVisible(i),
                scales: JSON.parse(JSON.stringify(map.scales)),
                type: options.geodeticSystem ? options.geodeticSystem : "not specified"
            });
        }
    }

    /**
     * レイヤーを返す. ない場合はnullを返す
     * @param id : 対象レイヤのID
     */
    getLayerIndex(id) {
        let layers = this.layerDataList;
        for (let i = 0; i < layers.length; ++i) {
            if (layers[i].id === id) {
                return i;
            }
        }
        return null;
    }

    /**
     * mapのインデックスを返す. ない場合はnullを返す
     * @param id : 対象レイヤのID
     */
     getMapIndex(id) {
        let layers = this.layerDataList;
        let mapIndex = 0;
        for (let i = 0; i < layers.length; ++i) {
            if (layers[i].id === id) {
                return mapIndex;
            }
            if (layers[i].type !== "image") {
                ++mapIndex;
            }
        }
        return null;
    }

    /**
     * random ID (8 chars)
     */
     static generateID() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000000).toString(16);
        }
        return s4();
    }

    // 一定時間経過後にコンテンツ追加命令をpostMessageする
    addContentWithInterval() {
        let done = false;
        const interval = 500;
        let thumbnailBase64;

        // クライアント側で登録IDを作ってしまう
        const id = Store.generateID();
        const options = this.instance.getOptions();

        const rect = this.viewerDiv.getBoundingClientRect();
        const width = rect.right - rect.left;
        const height = rect.bottom - rect.top;

        if (options.hasOwnProperty('backgroundImage') && options.backgroundImage) {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 256;
                canvas.height = 256 * (image.naturalHeight / image.naturalWidth);
                ctx.drawImage(image, 0, 0);
                thumbnailBase64 = canvas.toDataURL("image/jpeg");
                this.iframeConnector.send(TileViewerCommand.AddContent, {
                    id : id,
                    thumbnail: thumbnailBase64,
                    layerList: this.layerDataList,
                    width: width,
                    height: height,
                    cameraParams: JSON.stringify(this.instance.getCameraInfo())
                }, function() {
                    done = true;
                });
            }
            image.onerror = (err) => {
                // サムネイルは作れないけどとりあえず追加する
                if (!done) {
                    this.iframeConnector.send(TileViewerCommand.AddContent, {
                        id : id,
                        thumbnail: this.generateDummyThumbnail(id),
                        layerList: this.layerDataList,
                        width: width,
                        height: height,
                        cameraParams: JSON.stringify(this.instance.getCameraInfo())
                    }, function() {
                        done = true;
                    });
                    done = true;
                }
            }
            image.src = this.instance._formatUrl(options.backgroundImage);
        } else {
            // サムネイルは作れないけどとりあえず追加する
            setTimeout(() => {
                if (!done) {
                    this.iframeConnector.send(TileViewerCommand.AddContent, {
                        id : id,
                        thumbnail: this.generateDummyThumbnail(id),
                        layerList: this.layerDataList,
                        width: width,
                        height: height,
                        cameraParams: JSON.stringify(this.instance.getCameraInfo())
                    }, function() {
                        done = true;
                    });
                    done = true;
                }
            }, interval);
        }
    }

    // tileviewer追加用コントローラーからひかれた(tileviewer画面に対して操作可)
    injectAsControlType(data) {
        console.error("injectAsControlType");
        this.addContentWithInterval();

        // 初期カメラ位置送信
        const camera = this.instance.getCameraInfo();
        this.iframeConnector.send(TileViewerCommand.UpdateCamera, {
            params: camera
        });

        // カメラ位置送信
        this.instance.addEventListener(TileViewer.EVENT_POSITION_CHANGED, (data) => {
            if (data) {
                const camera = this.instance.getCameraInfo();
                this.iframeConnector.send(TileViewerCommand.UpdateCamera, {
                    params: camera
                });
            }
        });

        // リサイズの送信
        const debounceResize = (() => {
            const interval = 500;
            let timer;
            return (func) => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    const rect = this.viewerDiv.getBoundingClientRect();
                    const width = rect.right - rect.left;
                    const height = rect.bottom - rect.top;
                    this.iframeConnector.send(TileViewerCommand.Resize, {
                        size: {
                            width: width,
                            height: height
                        }
                    });
                }, interval);
            };
        })();
        window.addEventListener('resize', () => {
            debounceResize();
        });
    }

    // displayまたはcontrollerから開かれた(tileviewer画面に対して操作不可)
    injectAsDisplayType(data) {
        // 初期化イベントに対する応答
        this.iframeConnector.on(TileViewerCommand.Init, (err, param, request) => {
            this.iframeConnector.sendResponse(request);
        });
    }

    addLodScaleLabel() {
        let lodScaleLabel = document.createElement('div');
        const cameraInfo = this.instance.getCameraInfo();
        if (cameraInfo.hasOwnProperty('zoomLevel')) {
            lodScaleLabel.innerText = LoDScaleLabelPrefix + String(cameraInfo.zoomLevel);
        } else {
            lodScaleLabel.innerText = LoDScaleLabelPrefix + String(cameraInfo.scaleIndex);
        }
        lodScaleLabel.id = LoDScaleLabelID;
        lodScaleLabel.style.left = "1em";
        lodScaleLabel.style.bottom = "5px";
        lodScaleLabel.style.position = "fixed";
        lodScaleLabel.style.zIndex = 10000;
        lodScaleLabel.classList.add('fuchidori')
        document.body.appendChild(lodScaleLabel);


        // カメラ位置送信
        this.instance.addEventListener(TileViewer.EVENT_SCALE_INDEX_CHANGED, (data) => {
            if (data !== undefined && data !== null) {
                const scaleIndex = data;
                let lodScaleLabel = document.getElementById(LoDScaleLabelID);
                let labelText = LoDScaleLabelPrefix + String(scaleIndex);
                if (this.instance.getZoomLevel() >= 0) {
                    labelText = LoDScaleLabelPrefix + this.instance.getZoomLevel();
                }
                if (lodScaleLabel.innerText !== labelText) {
                    lodScaleLabel.innerText = labelText;
                }
            }
        });
    }

    // 時刻更新に対応する画像切り替え処理の初期化
    initTimelineControl(data) {
        this.iframeConnector.on(TileViewerCommand.UpdateTime, (err, param, request) => {
            if (err) {
                console.error(err);
                return;
            }
            this.date = new Date(param.time);
            if (data.timeCallback) {
                data.timeCallback(this.date);
            }
            this.range = {}
            if (param.hasOwnProperty('rangeStartTime') &&
                param.hasOwnProperty('rangeEndTime') &&
                param.rangeStartTime.length > 0 &&
                param.rangeEndTime.length > 0) {
                this.range = {
                    rangeStartTime: new Date(param.rangeStartTime),
                    rangeEndTime: new Date(param.rangeEndTime),
                }
            }
            this.instance.setDate(this.date);
            /*
            const layers = this.getTimescaleLayers();
            if (layers.length > 0) {
                for (let i = 0; i < layers.length; ++i) {
                    layers[i].updateByTime(this.date, this.range);
                }
                this.itownsView.notifyChange();
            }
            */
            this.iframeConnector.sendResponse(request);
        });
    }

    _injectChOWDER(data) {
        this.viewerDiv = data.viewerDiv;
        this.instance = data.instance;
        console.log("chowder_view_type", window.chowder_view_type)

        if (window.chowder_view_type === "control") {
            // tileviewer追加用コントローラーからひかれた(tileviewer画面に対して操作可)
            this.injectAsControlType(data);
        } else {
            // displayまたはcontrollerから開かれた(tileviewer画面に対して操作不可)
            this.injectAsDisplayType(data);
        }

        this.initLayerDataList();
        this.addLodScaleLabel();
        this.initTimelineControl(data);

        // オプションが変更された場合のコールバック
        this.instance.addEventListener(TileViewer.EVENT_OPTIONS_CHANGED, (data) => {
            //this.initLayerDataList();
            this.iframeConnector.send(TileViewerCommand.UpdateLayer, this.layerDataList, () => {});

        });

        this.iframeConnector.send(TileViewerCommand.InitLayers, this.instance.getCameraInfo(), () => {});


        this.iframeConnector.send(TileViewerCommand.AddLayer, this.layerDataList);
    }
}

export default Store;