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
        this.iframeConnector.connect(async() => {
            this.initIFrameEvents();
        });
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
            // console.error(cameraData.params)
            try {
                const preInfo = this.instance.getCameraInfo();
                const cameraInfo = cameraData.params;
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
        if (layerIndex !== null) {
            this.instance.setOpacity(layerIndex, params.opacity);
            this.instance.setVisible(layerIndex, params.visible);
            this.instance.setZoomLevel(params.fixedZoomLevel, params.zoomLevel);
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

    generateDummyThumbnail() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 256;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "black";
        ctx.font = "40px sans-serif";
        ctx.fillText("TileViewer", 10, 50);
        return canvas.toDataURL("image/jpeg");
    }

    initLayerDataList() {
        const options = this.instance.getOptions();
        if (options.hasOwnProperty('backgroundImage')) {
            this.layerDataList.push({
                id: "BackgourndImage",
                url: options.backgroundImage,
                opacity: 1.0,
                visible: true,
                type: "image"
            });
        }
        for (let i = 0; i < options.foregroundImages.length; ++i) {
            const url = options.foregroundImages[i];
            this.layerDataList.push({
                id: "Layer_" + i,
                url: url,
                opacity: 1.0,
                visible: true,
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

    // 一定時間経過後にコンテンツ追加命令をpostMessageする
    addContentWithInterval() {
        let done = false;
        const interval = 500;
        let thumbnailBase64;

        const options = this.instance.getOptions();

        const rect = this.viewerDiv.getBoundingClientRect();
        const width = rect.right - rect.left;
        const height = rect.bottom - rect.top;

        if (options.hasOwnProperty('backgroundImage') && options.backgroundImage) {
            const image = new Image();
            image.crossOrigin = 'Anonymous';
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 256;
                canvas.height = 256 * (image.naturalHeight / image.naturalWidth);
                ctx.drawImage(image, 0, 0);
                thumbnailBase64 = canvas.toDataURL("image/jpeg");
                this.iframeConnector.send(TileViewerCommand.AddContent, {
                    thumbnail: thumbnailBase64,
                    layerList: this.layerDataList,
                    width: width,
                    height: height,
                    cameraParams: JSON.stringify(this.instance.getCameraInfo())
                }, function() {
                    done = true;
                });
            }
            image.onerror = () => {
                // サムネイルは作れないけどとりあえず追加する
                if (!done) {
                    this.iframeConnector.send(TileViewerCommand.AddContent, {
                        thumbnail: this.generateDummyThumbnail(),
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
            image.src = options.backgroundImage;
        } else {
            // サムネイルは作れないけどとりあえず追加する
            setTimeout(() => {
                if (!done) {
                    this.iframeConnector.send(TileViewerCommand.AddContent, {
                        thumbnail: this.generateDummyThumbnail(),
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
        this.instance.addPositionCallback((data) => {
            if (data) {
                this.iframeConnector.send(TileViewerCommand.UpdateCamera, {
                    params: data
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
        if (window.chowder_view_type === "controller") {}
    }

    addLodScaleLabel() {
        let lodScaleLabel = document.createElement('div');
        lodScaleLabel.innerText = LoDScaleLabelPrefix + "0";
        lodScaleLabel.id = LoDScaleLabelID;
        lodScaleLabel.style.left = "1em";
        lodScaleLabel.style.bottom = "5px";
        lodScaleLabel.style.position = "fixed";
        lodScaleLabel.style.zIndex = 10000;
        lodScaleLabel.classList.add('fuchidori')
        document.body.appendChild(lodScaleLabel);

        // カメラ位置送信
        this.instance.addScaleIndexCallback((data) => {
            if (data) {
                const scaleIndex = data;
                let lodScaleLabel = document.getElementById(LoDScaleLabelID);
                const labelText = LoDScaleLabelPrefix + String(scaleIndex)
                if (lodScaleLabel.innerText !== labelText) {
                    lodScaleLabel.innerText = labelText;
                }
            }
        });
    }

    _injectChOWDER(data) {
        this.viewerDiv = data.viewerDiv;
        this.instance = data.instance;
        console.error(window.chowder_view_type)

        if (window.chowder_view_type === "control") {
            // tileviewer追加用コントローラーからひかれた(tileviewer画面に対して操作可)
            this.injectAsControlType(data);
        } else {
            // displayまたはcontrollerから開かれた(tileviewer画面に対して操作不可)
            this.injectAsDisplayType(data);
        }

        this.initLayerDataList();
        this.addLodScaleLabel();

        this.iframeConnector.send(TileViewerCommand.InitLayers, this.instance.getCameraInfo(), () => {});


        this.iframeConnector.send(TileViewerCommand.AddLayer, this.layerDataList);
    }
}

export default Store;