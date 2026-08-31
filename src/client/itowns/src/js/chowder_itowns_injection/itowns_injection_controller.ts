/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import { IFrameConnector } from '../common/iframe_connector';
import { ITownsCommand } from '../common/itowns_command';
import { ITownsConstants } from '../itowns/itowns_constants';
import { createBarGraphLayer } from './bargraph_layer';
import { createOBJLayer } from './obj_layer';
import { createTimescalePotreeLayer } from './timeseries_potree_layer';
import { createTimescaleC3DTilesLayer } from './timeseries_c3dtiles_layer';
import { C3DTileUtil } from './c3dtile_util';

// ---------------------------------------------------------------------------
// ユーティリティ関数
// ---------------------------------------------------------------------------

function getTextureFloat(buffer: Float32Array, view: any): any {
    if (view.mainLoop.gfxEngine.renderer.capabilities.isWebGL2) {
        const texture = new itowns.THREE.DataTexture(buffer, 256, 256, itowns.THREE.RedFormat, itowns.THREE.FloatType);
        texture.internalFormat = 'R32F';
        return texture;
    }
    return new itowns.THREE.DataTexture(buffer, 256, 256, itowns.THREE.AlphaFormat, itowns.THREE.FloatType);
}

function checkResponse(response: Response): void {
    if (!response.ok) {
        const error: any = new Error(`Error loading ${response.url}: status ${response.status}`);
        error.response = response;
        throw error;
    }
}

function fetchText(url: string, options: RequestInit = {}): Promise<string> {
    return fetch(url, options).then((response) => {
        checkResponse(response);
        return response.text();
    });
}

const isTimeseriesPotreeLayer = (layer: any): boolean => 'isTimeseriesPotree' in layer && layer.isTimeseriesPotree;
const isTimeseriesC3DTilesLayer = (layer: any): boolean => 'isTimeseriesC3DTiles' in layer && layer.isTimeseriesC3DTiles;
const isBarGraphLayer = (layer: any): boolean => 'isBarGraph' in layer && layer.isBarGraph;
const isOBJLayer = (layer: any): boolean => 'isOBJ' in layer && layer.isOBJ;

// ---------------------------------------------------------------------------
// ITownsInjectionController
// ---------------------------------------------------------------------------

export class ITownsInjectionController {
    private iframeConnector: IFrameConnector;
    private itownsView: any = null;
    private itownsViewerDiv: HTMLElement | null = null;
    private layerDataList: any[] = [];
    private date: Date | null = null;
    private range: { rangeStartTime: Date; rangeEndTime: Date } | null = null;
    private BarGraphExtent: any;
    private isStopDispatchRemoveEvent: boolean = false;

    constructor(view: any, viewerDiv: HTMLElement, timeCallback: ((date: Date) => void) | null = null) {
        this.BarGraphExtent = new itowns.Extent('EPSG:4326', 0, 0, 0);
        itowns.proj4.defs('EPSG:2446', '+proj=tmerc +lat_0=33 +lon_0=133.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

        this.iframeConnector = new IFrameConnector();
        this.iframeConnector.connect(() => {
            this.initIFrameEvents();
        });

        this.itownsView = view;
        this.itownsViewerDiv = viewerDiv;

        // プリセットJSの非同期Fetchコールバックとの競合を防ぐためview.addLayerをラップする
        const origAddLayer = view.addLayer.bind(view);
        view.addLayer = (layer: any, ...args: any[]) => {
            if (this.itownsView.getLayers().find((l: any) => l.id === layer.id)) {
                console.warn(`addLayer: id '${layer.id}' is already used, skipping`);
                return Promise.resolve(layer);
            }
            return origAddLayer(layer, ...args);
        };

        let done = false;
        this.itownsView.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, () => {
            if (!done) {
                if (window.chowder_itowns_view_type === 'itowns') {
                    this.injectAsChOWDERiTownController({ view, viewerDiv, timeCallback });
                } else {
                    this.injectaAsChOWDERDisplayController({ view, viewerDiv, timeCallback });
                }
                done = true;
            }
        });
    }

    // -----------------------------------------------------------------------
    // iframeイベント登録（共通：AddLayer / InitLayers / DeleteLayer / ChangeLayerOrder / ChangeLayerProperty / Resize / UpdateCamera / CaptureScreen）
    // -----------------------------------------------------------------------

    private initIFrameEvents(): void {
        this.iframeConnector.on(ITownsCommand.CaptureScreen, (_err, _param, request) => {
            const doCapture = () => {
                const canvas = this.itownsViewerDiv
                    ? (this.itownsViewerDiv.getElementsByTagName('canvas')[0] as HTMLCanvasElement | undefined)
                    : null;
                const base64 = canvas ? this.resizeToThumbnail(canvas) : '';
                this.iframeConnector.sendResponse(request, { base64 });
            };
            if (this.itownsView) {
                this.itownsView.notifyChange(this.itownsView.camera.camera3D);
                const handler = () => {
                    this.itownsView.removeEventListener(itowns.VIEW_EVENTS.AFTER_RENDER, handler);
                    doCapture();
                };
                this.itownsView.addEventListener(itowns.VIEW_EVENTS.AFTER_RENDER, handler);
            } else {
                doCapture();
            }
        });

        this.iframeConnector.on(ITownsCommand.UpdateCamera, (_err, cameraData: any, request) => {
            this.applyCamera(cameraData.mat, cameraData.params);
            this.iframeConnector.sendResponse(request);
        });

        this.iframeConnector.on(ITownsCommand.Resize, (_err, param: any, request) => {
            this.resizeWindow(param);
            this.iframeConnector.sendResponse(request);
        });

        this.iframeConnector.on(ITownsCommand.AddLayer, (_err, param: any, request) => {
            this.addLayer(param);
            this.iframeConnector.sendResponse(request);
        });

        this.iframeConnector.on(ITownsCommand.InitLayers, (_err, param: any, request) => {
            this.initLayers(param);
            this.iframeConnector.sendResponse(request);
        });

        this.iframeConnector.on(ITownsCommand.DeleteLayer, (_err, param: any, request) => {
            this.deleteLayer(param);
            this.iframeConnector.sendResponse(request);
        });

        this.iframeConnector.on(ITownsCommand.ChangeLayerOrder, (_err, param: any, request) => {
            this.changeLayerOrder(param);
            this.iframeConnector.sendResponse(request);
        });

        this.iframeConnector.on(ITownsCommand.ChangeLayerProperty, (_err, param: any, request) => {
            if (param) {
                this.changeLayerProperty(param);
            }
            this.iframeConnector.sendResponse(request);
        });
    }

    // -----------------------------------------------------------------------
    // display / controller 向け初期化
    // -----------------------------------------------------------------------

    private injectaAsChOWDERDisplayController(data: { view: any; viewerDiv: HTMLElement; timeCallback: ((date: Date) => void) | null }): void {
        window.removeEventListener('resize', undefined as any);

        const debounceRedraw = (() => {
            const interval = 500;
            let timer: ReturnType<typeof setTimeout>;
            let sumDT = 0.0;
            return (func: (view: any, dt: number) => void, view: any, dt: number) => {
                sumDT += dt;
                clearTimeout(timer);
                timer = setTimeout(() => {
                    if (this.isViewReady()) {
                        func(view, sumDT);
                        sumDT = 0.0;
                    } else {
                        debounceRedraw(func, view, sumDT);
                    }
                }, interval);
            };
        })();

        let aspectForResize = 1.0;

        const getAspect = (div: HTMLElement) => {
            const rect = div.getBoundingClientRect();
            return (rect.right - rect.left) / (rect.bottom - rect.top);
        };

        const debounceResize = (() => {
            const interval = 500;
            let timer: ReturnType<typeof setTimeout>;
            return (func: () => void) => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    // アスペクト比にかかわらず常に renderer をリサイズする
                    // （マニピュレータがアスペクト比ロックで拡縮する時も地図が正しくスケールする）
                    func();
                    const canvas = this.itownsViewerDiv!.getElementsByTagName('canvas')[0] as HTMLCanvasElement | undefined;
                    if (canvas) {
                        canvas.style.width = '100%';
                        canvas.style.height = '100%';
                    }
                    // アスペクト比が実際に変化したときのみ親へ通知
                    // （elem.style.height変更 → iframe window.resize → 無限ループを防ぐ）
                    const aspect = getAspect(this.itownsViewerDiv!);
                    if (Math.abs(aspectForResize - aspect) > 0.02) {
                        console.log('[itowns] aspect changed:', aspectForResize.toFixed(3), '->', aspect.toFixed(3));
                        aspectForResize = aspect;
                        this.sendViewportResize();
                    }
                }, interval);
            };
        })();

        this.iframeConnector.on(ITownsCommand.Init, (_err, _param, request) => {
            this.iframeConnector.sendResponse(request);
        });

        // controller セットアップは Init ハンドラに依存せず、
        // AFTER_RENDER 後に確実に呼び出される injectaAsChOWDERDisplayController の
        // 本体に直接書く（Init メッセージのタイミング競合を回避）
        if (window.chowder_itowns_view_type === 'controller') {
            if (this.itownsView.mainLoop.__proto__._renderView) {
                const origRenderView = this.itownsView.mainLoop.__proto__._renderView.bind(this.itownsView.mainLoop);
                this.itownsView.mainLoop.__proto__._renderView = (view: any, dt: number) => {
                    debounceRedraw(origRenderView, view, dt);
                };
            }

            aspectForResize = getAspect(this.itownsViewerDiv!);
            const canvas = this.itownsViewerDiv!.getElementsByTagName('canvas')[0] as HTMLCanvasElement | undefined;
            if (canvas) {
                canvas.style.width = '100%';
                canvas.style.height = '100%';
            }

            const origResize = this.itownsView.__proto__.resize.bind(this.itownsView);
            window.addEventListener('resize', () => {
                debounceResize(origResize);
            });

            // 初期アスペクト比を親へ通知（AFTER_RENDER 後なのでビューポートサイズは有効）
            this.sendViewportResize();
        }

        this.iframeConnector.on(ITownsCommand.UpdateTime, (err, param: any, request) => {
            if (err) { console.error(err); return; }
            this.date = new Date(param.time);
            if (data.timeCallback) data.timeCallback(this.date);
            this.range = null;
            if (param.rangeStartTime?.length > 0 && param.rangeEndTime?.length > 0) {
                this.range = {
                    rangeStartTime: new Date(param.rangeStartTime),
                    rangeEndTime: new Date(param.rangeEndTime),
                };
            }
            const layers = this.getTimescaleLayers();
            if (layers.length > 0) {
                for (const layer of layers) layer.updateByTime(this.date, this.range);
                this.itownsView.notifyChange();
            }
            this.iframeConnector.sendResponse(request);
        });

        if (window.chowder_itowns_view_type === 'display') {
            this.iframeConnector.on(ITownsCommand.MeasurePerformance, (_err, _param, request) => {
                let frameCount: number | null = 0;
                let firstTime = new Date(Date.now());
                let lastUpDateTime = Date.now();
                const reqParams: any = (request as any).params;

                window.nowMeasurePerformance = 1;
                performance.mark('drawStart');

                const updateStart = () => { if (frameCount === null) return; };
                const updateEnd = () => {
                    if (frameCount === null) return;
                    const loop = this.itownsView.mainLoop;
                    if (loop.renderingState !== 0 || window.findb3dm > 0) {
                        frameCount = 0;
                        window.findb3dm = 0;
                        lastUpDateTime = Date.now();
                        performance.mark('drawEnd');
                    } else {
                        frameCount++;
                    }
                    if (frameCount >= 600) {
                        const result = this.measurePerformance();
                        window.nowMeasurePerformance = 0;
                        this.itownsView.removeFrameRequester(itowns.MAIN_LOOP_EVENTS.UPDATE_START, updateStart);
                        this.itownsView.removeFrameRequester(itowns.MAIN_LOOP_EVENTS.UPDATE_END, updateEnd);

                        const formatDate = (date: Date, sep = '') =>
                            date.getFullYear() + sep +
                            ('00' + (date.getMonth() + 1)).slice(-2) + sep +
                            ('00' + date.getDate()).slice(-2) + ' ' +
                            date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + ':' + date.getMilliseconds();

                        const clickTime = new Date(reqParams.clickTime);
                        const broadcastTime = new Date(reqParams.broadcastTime);
                        if (firstTime < broadcastTime) firstTime = new Date(broadcastTime.getTime() + 50);

                        performance.measure('measureDraw', 'drawStart', 'drawEnd');
                        const result2 = performance.getEntriesByName('measureDraw');
                        result.updateDuration = Math.floor(result2[0].duration) / 1000;
                        result.BeginRequestTime = formatDate(clickTime, '/');
                        result.BroadcastTime = formatDate(broadcastTime, '/');
                        result.RequestArrivalTime = formatDate(firstTime, '/');
                        result.usingMemorySize = (performance as any).memory?.usedJSHeapSize ?? 0;
                        result.usingGLTexSize = (window.measureDLTex ?? []).reduce((a: number, b: number) => a + b, 0);

                        frameCount = null;
                        if (window.crossOriginIsolated) {
                            (async () => {
                                const mem = await this.measureMemory();
                                mem.usingMemorySize = 'geted';
                                this.iframeConnector.sendResponse(request, mem);
                            })();
                        } else {
                            this.iframeConnector.sendResponse(request, result);
                        }
                    } else {
                        this.itownsView.notifyChange();
                    }
                };
                this.itownsView.addFrameRequester(itowns.MAIN_LOOP_EVENTS.UPDATE_START, updateStart);
                this.itownsView.addFrameRequester(itowns.MAIN_LOOP_EVENTS.UPDATE_END, updateEnd);
                this.itownsView.notifyChange();
            });
        }
    }

    // -----------------------------------------------------------------------
    // itownsコントローラー向け初期化
    // -----------------------------------------------------------------------

    private async injectAsChOWDERiTownController(data: { view: any; viewerDiv: HTMLElement; timeCallback: ((date: Date) => void) | null }): Promise<void> {
        const menuDiv = document.getElementById('menuDiv');
        if (menuDiv) {
            menuDiv.style.position = 'absolute';
            menuDiv.style.top = '10px';
            menuDiv.style.left = '10px';
        }

        this.iframeConnector.on(ITownsCommand.UpdateTime, (err, param: any, request) => {
            if (err) { console.error(err); return; }
            this.date = new Date(param.time);
            if (data.timeCallback) data.timeCallback(this.date);
            this.range = null;
            if (param.rangeStartTime?.length > 0 && param.rangeEndTime?.length > 0) {
                this.range = {
                    rangeStartTime: new Date(param.rangeStartTime),
                    rangeEndTime: new Date(param.rangeEndTime),
                };
            }
            const layers = this.getTimescaleLayers();
            if (layers.length > 0) {
                for (const layer of layers) layer.updateByTime(this.date, this.range);
                this.itownsView.notifyChange();
            }
            this.iframeConnector.sendResponse(request);
        });

        this.layerDataList = await this.getLayerDataList();

        this.itownsView.addEventListener(itowns.VIEW_EVENTS.LAYER_ADDED, async () => {
            this.layerDataList = await this.getLayerDataList();
            this.iframeConnector.send(ITownsCommand.AddLayer, this.layerDataList);
        });

        this.itownsView.addEventListener(itowns.VIEW_EVENTS.LAYER_REMOVED, async () => {
            if (!this.isStopDispatchRemoveEvent) {
                this.layerDataList = await this.getLayerDataList();
                this.iframeConnector.send(ITownsCommand.UpdateLayer, this.layerDataList);
            }
        });

        this.iframeConnector.on(ITownsCommand.Init, (_err, _param, request) => {
            this.iframeConnector.sendResponse(request as any);

            let worldMat = JSON.stringify(this.itownsView.camera.camera3D.matrixWorld.elements);
            let cameraParams = this.getCameraParams(this.itownsView.camera.camera3D);
            this.iframeConnector.send(ITownsCommand.UpdateCamera, { mat: worldMat, params: cameraParams });

            if (this.layerDataList.length >= 0) {
                this.iframeConnector.send(ITownsCommand.AddLayer, this.layerDataList);
            }

            this.itownsView.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_CAMERA_UPDATE, () => {
                const mat_ = JSON.stringify(this.itownsView.camera.camera3D.matrixWorld.elements);
                const params_ = this.getCameraParams(this.itownsView.camera.camera3D);
                if (worldMat !== mat_ || cameraParams !== params_) {
                    worldMat = mat_;
                    cameraParams = params_;
                    this.iframeConnector.send(ITownsCommand.UpdateCamera, { mat: mat_, params: params_ });
                }
            });
        });

        this.iframeConnector.on(ITownsCommand.SelectLayer, (_err, param: any, request) => {
            const layer = this.getLayer(param.id);
            if (layer) {
                for (const l of this.itownsView.getLayers()) l.isSelected = false;
                layer.isSelected = true;
            }
            this.iframeConnector.sendResponse(request);
        });

        this.addEarthControls();
        this.addContentWithInterval();
    }

    // -----------------------------------------------------------------------
    // カメラ操作
    // -----------------------------------------------------------------------

    private applyCamera(worldMat: number[], cameraParams: any): void {
        const cam = this.itownsView.camera.camera3D;
        cam.matrixAutoUpdate = false;
        cam.matrixWorld.elements = worldMat;

        const d = new itowns.THREE.Vector3();
        const q = new itowns.THREE.Quaternion();
        const s = new itowns.THREE.Vector3();
        cam.matrixWorld.decompose(d, q, s);
        cam.position.copy(d);
        cam.quaternion.copy(q);
        cam.scale.copy(s);

        cam.near = cameraParams.near;
        cam.far = cameraParams.far;
        cam.fov = cameraParams.fovy;
        cam.zoom = cameraParams.zoom;
        cam.filmOffset = cameraParams.filmOffset;
        cam.filmGauge = cameraParams.filmGauge;
        // aspect は送信元環境のビューポートサイズに依存するため、受信側の viewerDiv の実サイズから再計算する。
        // viewerDiv が未取得の場合（初期化前など）は fallback として cameraParams.aspect を使用。
        const viewerW = this.itownsViewerDiv?.clientWidth ?? 0;
        const viewerH = this.itownsViewerDiv?.clientHeight ?? 0;
        cam.aspect = (viewerW > 0 && viewerH > 0) ? viewerW / viewerH : cameraParams.aspect;
        cam.matrixAutoUpdate = true;

        this.itownsView.notifyChange(cam);
    }

    private getCameraParams(camera3D: any): string {
        return JSON.stringify({
            fovy: camera3D.fov,
            zoom: camera3D.zoom,
            near: camera3D.near,
            far: camera3D.far,
            filmOffset: camera3D.filmOffset,
            filmGauge: camera3D.filmGauge,
            aspect: camera3D.aspect,
        });
    }

    // -----------------------------------------------------------------------
    // サムネイル
    // -----------------------------------------------------------------------

    private resizeToThumbnail(srcCanvas: HTMLCanvasElement): string {
        const width = document.body.clientWidth;
        const height = document.body.clientHeight;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = 256;
        canvas.height = 256 * (height / width);
        ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg');
    }

    private addContentWithInterval(): void {
        let done = false;
        const interval = 500;
        let timer: ReturnType<typeof setTimeout>;
        let thumbnailBase64 = '';
        let count = 0;

        this.itownsView.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, () => {
            if (!done) {
                const canvas = this.itownsViewerDiv!.getElementsByTagName('canvas')[0] as HTMLCanvasElement;
                thumbnailBase64 = this.resizeToThumbnail(canvas);
                count++;
            }
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (!done && count > 1) {
                    done = true;
                    this.iframeConnector.send(ITownsCommand.AddContent, {
                        thumbnail: thumbnailBase64,
                        layerList: this.layerDataList,
                    }, () => { done = true; });
                }
            }, interval);
        });

        setTimeout(() => {
            if (!done) {
                this.iframeConnector.send(ITownsCommand.AddContent, {
                    thumbnail: thumbnailBase64,
                    layerList: this.layerDataList,
                }, () => { done = true; });
                done = true;
            }
        }, 10 * 1000);
    }

    // -----------------------------------------------------------------------
    // リサイズ
    // -----------------------------------------------------------------------

    /**
     * ビューポートの現在サイズを親フレーム（コントローラ）へ通知する。
     * controllerモード専用。itowns 初期化完了時・ブラウザリサイズ時に呼ぶ。
     */
    private sendViewportResize(): void {
        if (window.chowder_itowns_view_type !== 'controller') return;
        if (!this.itownsViewerDiv) return;
        const w = this.itownsViewerDiv.clientWidth;
        const h = this.itownsViewerDiv.clientHeight;
        if (w <= 0 || h <= 0) return;
        this.iframeConnector.send(ITownsCommand.ViewportResize, { width: w, height: h });
    }

    private resizeWindow(param: any): void {
        const rect = param.rect;
        const isSetOffset = param.isSetOffset;

        const width = document.body.clientWidth;
        const height = document.body.clientHeight;

        document.body.style.pointerEvents = 'none';
        this.itownsViewerDiv!.style.position = 'relative';

        if (param.displayMode === true) {
            // Display モード: elem が virtualToWindowCoordinates で配置済み
            // iframe は 100%x100% = コンテンツピクセルサイズ、setViewOffset は使わずフルレンダリング
            // body の overflow:hidden がディスプレイ矩形外をクリップする
            this.itownsViewerDiv!.style.left   = '0px';
            this.itownsViewerDiv!.style.top    = '0px';
            this.itownsViewerDiv!.style.width  = '100%';
            this.itownsViewerDiv!.style.height = '100%';
            this.itownsView.camera.camera3D.clearViewOffset();
            this.itownsView.mainLoop.gfxEngine.renderer.setSize(width, height);
            // renderer サイズに合わせて aspect を更新する。
            // applyCamera() で設定された itowns クライアント側の aspect はディスプレイ/コントローラの
            // ビューポートと一致しない場合があるため、常に実レンダラサイズから再計算する。
            if (height > 0) {
                const cam = this.itownsView.camera.camera3D;
                cam.aspect = width / height;
                cam.updateProjectionMatrix();
            }
        } else {
            if (!rect) return;
            // Controller モード: 既存の挙動
            this.itownsViewerDiv!.style.left = parseInt(rect.x) + 'px';
            this.itownsViewerDiv!.style.top  = parseInt(rect.y) + 'px';
            if (isSetOffset) {
                this.itownsViewerDiv!.style.width  = parseInt(rect.w) + 'px';
                this.itownsViewerDiv!.style.height = parseInt(rect.h) + 'px';
            } else {
                this.itownsViewerDiv!.style.width  = '100%';
                this.itownsViewerDiv!.style.height = '100%';
            }
            this.itownsView.camera.camera3D.setViewOffset(width, height, rect.x, rect.y, rect.w, rect.h);
            this.itownsView.mainLoop.gfxEngine.renderer.setSize(rect.w, rect.h);
        }

        if (window.chowder_itowns_view_type === 'controller') {
            for (const listener of window.resizeListeners) {
                (listener as EventListener)(new Event('resize'));
            }
        }

        const canvas = this.itownsViewerDiv!.getElementsByTagName('canvas')[0] as HTMLCanvasElement | undefined;
        if (canvas) {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
        }
        this.itownsView.notifyChange(this.itownsView.camera.camera3D);
    }

    // -----------------------------------------------------------------------
    // レイヤー参照ヘルパー
    // -----------------------------------------------------------------------

    private getLayer(id: string): any {
        return this.itownsView.getLayers().find((l: any) => l.id === id) ?? null;
    }

    private getBarGraphLayers(): any[] {
        return this.itownsView.getLayers().filter(isBarGraphLayer);
    }

    private getOBJLayers(): any[] {
        return this.itownsView.getLayers().filter(isOBJLayer);
    }

    private getTimescaleLayers(): any[] {
        return this.itownsView.getLayers().filter(
            (l: any) => isBarGraphLayer(l) || isTimeseriesPotreeLayer(l) || isTimeseriesC3DTilesLayer(l)
        );
    }

    private getSelectedLayer(): any {
        return this.itownsView.getLayers().find((l: any) => l.isSelected === true) ?? null;
    }

    // -----------------------------------------------------------------------
    // ElevationLayer用パーサー
    // -----------------------------------------------------------------------

    private installCSVElevationParser(mapSource: any): void {
        console.log('installCSVElevationParser');
        mapSource.fetcher = (url: string, options: RequestInit = {}) => {
            return fetchText(url, options).then((data) => {
                const LF = String.fromCharCode(10);
                const lines = data.split(LF);
                const heights: number[] = [];
                for (const line of lines) {
                    for (const v of line.split(',')) {
                        heights.push(v === 'e' ? 0 : Number(v));
                    }
                }
                return getTextureFloat(new Float32Array(heights), this.itownsView);
            });
        };
    }

    private installPNGElevationParser(mapSource: any): void {
        console.log('installPNGElevationParser');
        const textureLoader = new itowns.THREE.TextureLoader();

        const loadTexture = (url: string, options: any = {}): Promise<any> => {
            return new Promise((resolve, reject) => {
                textureLoader.crossOrigin = options.crossOrigin;
                textureLoader.load(url, resolve, () => {}, reject);
            });
        };

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;

        const convertTexToArray = (tex: any): number[] => {
            const context = canvas.getContext('2d')!;
            context.drawImage(tex.image, 0, 0);
            const pixData = context.getImageData(0, 0, 256, 256).data;
            const heights: number[] = [];
            for (let y = 0; y < 256; ++y) {
                for (let x = 0; x < 256; x++) {
                    const addr = (x + y * 256) * 4;
                    const R = pixData[addr];
                    const G = pixData[addr + 1];
                    const B = pixData[addr + 2];
                    let alt: number;
                    if (R === 128 && G === 0 && B === 0) {
                        alt = 0;
                    } else {
                        alt = R * 65536 + G * 256 + B;
                        if (alt > 8388608) alt = alt - 16777216;
                        alt = alt * 0.01;
                    }
                    heights.push(alt);
                }
            }
            return heights;
        };

        mapSource.fetcher = (url: string, options: any = {}) => {
            return loadTexture(url, options).then((tex) => {
                return getTextureFloat(new Float32Array(convertTexToArray(tex)), this.itownsView);
            });
        };
    }

    // -----------------------------------------------------------------------
    // レイヤー生成
    // -----------------------------------------------------------------------

    private createLayerByType(config: any, type: string): any {
        console.log('createLayerByType', config, type);

        if (type === ITownsConstants.TypeColor && config.format !== 'pbf') {
            return new itowns.ColorLayer(config.id, { source: new itowns.TMSSource(config) });
        }

        if (type === ITownsConstants.TypeElevation) {
            let mapSource = new itowns.TMSSource(config);
            if (config.format === 'image/x-bil;bits=32' || ('tileMatrixSet' in config && config.url.indexOf('?LAYER=') > 0)) {
                config.name = config.id;
                mapSource = new itowns.WMTSSource(config);
            } else if (config.format === 'csv' || config.format === 'txt') {
                this.installCSVElevationParser(mapSource);
            } else if (config.format.indexOf('png') >= 0) {
                this.installPNGElevationParser(mapSource);
            }
            const baseOpts = { source: mapSource, updateStrategy: { type: 3 }, scale: 1 };
            if ('tileMatrixSet' in config && config.tileMatrixSet === 'iTowns') {
                return new itowns.ElevationLayer(config.id, {
                    ...baseOpts,
                    useColorTextureElevation: true,
                    colorTextureElevationMinZ: 37,
                    colorTextureElevationMaxZ: 248,
                });
            }
            return new itowns.ElevationLayer(config.id, baseOpts);
        }

        if (type === ITownsConstants.TypePointCloud) {
            config.crs = this.itownsView.referenceCrs;
            return new itowns.PotreeLayer(config.id, { source: new itowns.PotreeSource(config) });
        }

        if (type === ITownsConstants.TypePointCloudTimeSeries) {
            config.crs = this.itownsView.referenceCrs;
            return createTimescalePotreeLayer(this.itownsView, config);
        }

        if (type === ITownsConstants.Type3DTilesTimeSeries) {
            config.crs = this.itownsView.referenceCrs;
            return createTimescaleC3DTilesLayer(this.itownsView, config);
        }

        if (type === ITownsConstants.Type3DTile) {
            const layer = new itowns.C3DTilesLayer(config.id, config, this.itownsView);
            layer.defineLayerProperty('scale', 1.0, () => {
                layer.object3d.scale.set(layer.scale, layer.scale, layer.scale);
                layer.object3d.updateMatrixWorld();
            });
            if ('conversion' in config) {
                layer.defineLayerProperty('conversion', config.conversion, () => {});
                C3DTileUtil.applyConvertSetting(layer, config);
            }
            return layer;
        }

        if (type === ITownsConstants.TypeBargraph) {
            return createBarGraphLayer(this.itownsView, config);
        }

        if (type === ITownsConstants.TypeOBJ) {
            return createOBJLayer(this.itownsView, config);
        }

        if (type === ITownsConstants.TypeGeometry || config.format === 'pbf') {
            if (config.format === 'geojson') {
                const mapSource = new itowns.TMSSource(config);
                if (config.url.indexOf('gsi.go.jp')) mapSource.inCrs = 'EPSG:4326';
                mapSource.style = config.style;
                return new itowns.GeometryLayer(config.id, new itowns.THREE.Group(), {
                    update: itowns.FeatureProcessing.update,
                    convert: itowns.Feature2Mesh.convert({ color: new itowns.THREE.Color(0xbbffbb), extrude: 80 }),
                    source: mapSource,
                });
            }
            if (config.format === 'pbf') {
                const inter = (z: number) => z - (z % 5);
                const isValidData = (data: any, extentDestination: any) => inter(extentDestination.zoom) === inter(data.extent.zoom);
                const mapSource = new itowns.VectorTilesSource(config);
                if (config.url.indexOf('gsi.go.jp')) mapSource.inCrs = 'EPSG:4326';
                mapSource.style = config.style;
                return new itowns.ColorLayer(config.id, { isValidData, source: mapSource, fx: 2.5 });
            }
        }

        return null;
    }

    private createLayerConfigByType(params: any, type: string): any {
        let url: string = params.url ?? '';
        url = url
            .replace(/\${z}/g, '%TILEMATRIX').replace(/\${x}/g, '%COL').replace(/\${y}/g, '%ROW')
            .replace(/\{z\}/g, '%TILEMATRIX').replace(/\{x\}/g, '%COL').replace(/\{y\}/g, '%ROW');

        let config: any = {};

        if (type === ITownsConstants.TypeColor) {
            config = { crs: 'EPSG:3857', isInverted: true, format: 'image/png', url, tileMatrixSet: 'PM', updateStrategy: { type: 3 }, opacity: 1.0 };
        }
        if (type === ITownsConstants.TypeElevation) {
            config = {
                crs: 'EPSG:4326',
                tileMatrixSet: params.tileMatrixSet ?? 'WGS84G',
                format: params.format ?? 'image/x-bil;bits=32',
                url,
                scale: 1,
            };
            if (url.indexOf('.png') > 0) { config.format = 'image/png'; config.crs = 'EPSG:3857'; config.tileMatrixSet = 'PM'; }
            if (url.indexOf('.txt') > 0 || url.indexOf('.csv') > 0) { config.format = 'csv'; config.crs = 'EPSG:3857'; config.tileMatrixSet = 'PM'; }
            if ('style' in params) config.style = params.style;
        }
        if (type === ITownsConstants.TypePointCloud || type === ITownsConstants.TypePointCloudTimeSeries) {
            if ('file' in params) url += params.file;
            const splits = url.split('/');
            const file = splits[splits.length - 1];
            const serverUrl = url.replace(file, '');
            config = { file, url: serverUrl, protocol: 'potreeconverter' };
        }
        if (type === ITownsConstants.Type3DTile || type === ITownsConstants.Type3DTilesTimeSeries) {
            config = {
                name: params.id ?? '3dtile',
                source: new itowns.C3DTilesSource({ url }),
                overrideMaterials: false,
            };
            if ('conversion' in params) config.conversion = JSON.parse(JSON.stringify(params.conversion));
        }
        if (type === ITownsConstants.TypeBargraph) {
            config = { crs: 'EPSG:3857', isUserData: true, opacity: 1.0, url };
            if ('jsonurl' in params) config.jsonurl = params.jsonurl;
        }
        if (type === ITownsConstants.TypeOBJ) {
            config = { crs: 'EPSG:4978', isUserData: true, opacity: 1.0, url };
            if ('mtlurl' in params) config.mtlurl = params.mtlurl;
        }
        if (url && url.indexOf('.geojson') >= 0) {
            config = { crs: 'EPSG:3857', tileMatrixSet: 'PM', url, format: 'geojson' };
            if ('style' in params) config.style = params.style;
        }
        if (url && url.indexOf('.pbf') >= 0) {
            config = { crs: 'EPSG:3857', tileMatrixSet: 'PM', url, format: 'pbf' };
            if ('style' in params) config.style = params.style;
        }

        // 共通パラメータ
        for (const key of ['id', 'zoom', 'format', 'attribution', 'sseThreshold', 'wireframe', 'pointSize']) {
            if (key in params) config[key] = params[key];
        }
        // URL判定によるformatを再確定（params.formatによる上書きを防ぐ）
        if (url && url.indexOf('.pbf') >= 0) config.format = 'pbf';
        if (url && url.indexOf('.geojson') >= 0) config.format = 'geojson';
        return config;
    }

    // -----------------------------------------------------------------------
    // レイヤー操作
    // -----------------------------------------------------------------------

    addLayer(params: any, withoutApplyParams = false): void {
        if (!params) { console.error('Not found params'); return; }
        console.log('addLayer', params);

        if ('id' in params && this.getLayer(params.id)) { console.warn('already loaded'); return; }
        if (!('url' in params)) { console.error('Not found url'); return; }

        let type = params.type ?? 'color';
        if (params.isBarGraph) type = ITownsConstants.TypeBargraph;
        if (params.isTimeseriesPotree) type = ITownsConstants.TypePointCloudTimeSeries;
        if (params.isTimeseriesC3DTiles) type = ITownsConstants.Type3DTilesTimeSeries;
        if (params.isOBJ) type = ITownsConstants.TypeOBJ;

        const config = this.createLayerConfigByType(params, type);
        const layer = this.createLayerByType(config, type);
        if (!layer) return;

        if (!withoutApplyParams) {
            if ('opacity' in params) layer.opacity = params.opacity;
            if ('visible' in params) layer.visible = Boolean(params.visible);
            if ('bbox' in params) layer.bboxes.visible = Boolean(params.bbox);
        }

        const complexTypes = [
            ITownsConstants.TypePointCloud, ITownsConstants.TypePointCloudTimeSeries,
            ITownsConstants.Type3DTile, ITownsConstants.Type3DTilesTimeSeries,
            ITownsConstants.TypeBargraph, ITownsConstants.TypeOBJ,
        ];
        if (complexTypes.includes(type)) {
            itowns.View.prototype.addLayer.call(this.itownsView, layer);
            if (type === ITownsConstants.TypeBargraph) {
                layer.whenReady.then(() => layer.updateBarGraph());
            }
        } else {
            this.itownsView.addLayer(layer);
        }
    }

    initLayers(layerList: any[]): void {
        this.isStopDispatchRemoveEvent = true;
        for (let i = this.layerDataList.length - 1; i >= 0; --i) {
            const item = this.layerDataList[i];
            if (item.type === ITownsConstants.TypeUser) continue;
            if (('url' in item && item.url !== 'none') || ('file' in item && item.file)) {
                const layer = this.getLayer(item.id);
                if (layer) this.itownsView.removeLayer(item.id);
            }
        }
        this.isStopDispatchRemoveEvent = false;

        for (const item of layerList) {
            if (item.type === ITownsConstants.TypeUser) {
                const dst = this.getLayer(item.id);
                if (dst) { dst.wireframe = item.wireframe; dst.visible = item.visible; dst.opacity = item.opacity; }
            } else {
                this.addLayer(item, true);
            }
        }

        const initializeOneTime = () => {
            for (const item of layerList) this.changeLayerProperty(item);
            this.iframeConnector.send(ITownsCommand.LayersInitialized, {}, () => {});
            this.itownsView.removeEventListener('layers-initialized', initializeOneTime);
        };
        this.itownsView.addEventListener('layers-initialized', initializeOneTime);
    }

    deleteLayer(params: any): void {
        const layer = this.getLayer(params.id);
        if (layer) {
            this.itownsView.removeLayer(params.id);
            this.itownsView.notifyChange();
        }
    }

    async changeLayerOrder(params: any): Promise<void> {
        const { id, isUp } = params;
        await this.getLayerDataList();
        const targetLayer = this.getLayer(id);
        if (!targetLayer) return;

        const layers = this.itownsView._layers;
        for (let i = 0; i < layers.length; ++i) {
            const attached: any[] = layers[i].attachedLayers;
            if (attached.length > 0) {
                const idx = attached.indexOf(targetLayer);
                if (idx >= 0) {
                    if (isUp && idx > 0) {
                        itowns.ColorLayersOrdering.moveLayerUp(this.itownsView, id);
                        attached.splice(i - 1, 2, attached[i], attached[i - 1]);
                        this.itownsView.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED });
                        this.itownsView.notifyChange();
                    } else if (!isUp && idx < attached.length - 1) {
                        itowns.ColorLayersOrdering.moveLayerDown(this.itownsView, id);
                        attached.splice(i, 2, attached[i + 1], attached[i]);
                        this.itownsView.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED });
                        this.itownsView.notifyChange();
                    } else {
                        if (isUp && i > 0) {
                            layers.splice(i - 1, 2, layers[i], layers[i - 1]);
                            this.itownsView.dispatchEvent({ type: itowns.VIEW_EVENTS.COLOR_LAYERS_ORDER_CHANGED });
                            this.itownsView.notifyChange();
                        } else if (!isUp && i < layers.length - 1) {
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

    changeLayerProperty(params: any, redraw = true): void {
        const layer = this.getLayer(params.id);
        if (!layer) return;
        if (!layer.ready) { console.warn('layer is not ready'); return; }

        let isChanged = false;
        let isUpdateSource = false;

        if ('url' in params && layer.source?.url !== undefined) {
            isUpdateSource = params.url !== layer.source.url || params.update_id !== layer.update_id;
        }

        if (isUpdateSource) {
            if (layer.source instanceof itowns.C3DTilesSource) {
                this.itownsView.removeLayer(layer.id);
                const config = this.createLayerConfigByType(params, params.type);
                config.source = new itowns.C3DTilesSource({ url: params.url });
                const newLayer = new itowns.C3DTilesLayer(layer.id, config, this.itownsView);
                itowns.View.prototype.addLayer.call(this.itownsView, newLayer);
            }
            if (layer.isOBJ) {
                this.itownsView.removeLayer(layer.id);
                const config = this.createLayerConfigByType(params, params.type);
                const newLayer = createOBJLayer(this.itownsView, config);
                itowns.View.prototype.addLayer.call(this.itownsView, newLayer);
            }
            isChanged = true;
        }

        const setIfPresent = (key: string, transform?: (v: any) => any) => {
            if (key in params) { layer[key] = transform ? transform(params[key]) : params[key]; isChanged = true; }
        };
        setIfPresent('update_id');
        setIfPresent('opacity', Number);
        setIfPresent('visible', Boolean);
        setIfPresent('scale');
        setIfPresent('size', Number);
        setIfPresent('pointSize', Number);
        setIfPresent('wireframe', Boolean);
        setIfPresent('sseThreshold', Number);
        setIfPresent('bargraphParams', (v) => JSON.parse(JSON.stringify(v)));
        setIfPresent('conversion', (v) => JSON.parse(JSON.stringify(v)));
        if ('bbox' in params) { layer.bboxes.visible = Boolean(params.bbox); isChanged = true; }

        if ('offset_xyz' in params || 'offset_uvw' in params || 'offset_small_uv' in params) {
            if (layer.object3d) {
                if ('offset_xyz' in params) layer.offset_xyz = JSON.parse(JSON.stringify(params.offset_xyz));
                if ('offset_small_uv' in params) layer.offset_small_uv = JSON.parse(JSON.stringify(params.offset_small_uv));
                if ('offset_uvw' in params) layer.offset_uvw = JSON.parse(JSON.stringify(params.offset_uvw));

                const target = layer.object3d;
                if (!target.initial_position) {
                    target.initial_position = target.position.clone();
                    target.initial_quaternion = target.quaternion.clone();
                }

                let vec: any = target.initial_position.clone();
                if (vec.length() < 1.0e-6) {
                    if (layer.root?.bbox) layer.root.bbox.getCenter(vec);
                    if (layer.root?.boundingVolume?.box) layer.root.boundingVolume.box.getCenter(vec);
                }
                vec.normalize();
                const u = vec.clone().cross(new itowns.THREE.Vector3(0, 0, 1));
                const v = vec.clone().cross(u);
                const w = vec.clone().normalize();

                const xyz = params.offset_xyz ?? { x: 0, y: 0, z: 0 };
                const initial_position = target.initial_position;
                const position = new itowns.THREE.Vector3(initial_position.x + xyz.x, initial_position.y + xyz.y, initial_position.z + xyz.z);

                const quaternionTUV = new itowns.THREE.Quaternion();
                const quaternionUVW = new itowns.THREE.Quaternion();
                if ('offset_small_uv' in params) {
                    const qu = new itowns.THREE.Quaternion().setFromAxisAngle(u, params.offset_small_uv.u * Math.PI / 180.0 / 1.0e6);
                    const qv = new itowns.THREE.Quaternion().setFromAxisAngle(v, params.offset_small_uv.v * Math.PI / 180.0 / 1.0e6);
                    quaternionTUV.copy(qu).multiply(qv);
                }
                if ('offset_uvw' in params) {
                    const qu = new itowns.THREE.Quaternion().setFromAxisAngle(u, params.offset_uvw.u * Math.PI / 180.0);
                    const qv = new itowns.THREE.Quaternion().setFromAxisAngle(v, params.offset_uvw.v * Math.PI / 180.0);
                    const qw = new itowns.THREE.Quaternion().setFromAxisAngle(w, params.offset_uvw.w * Math.PI / 180.0);
                    quaternionUVW.copy(qu).multiply(qv).multiply(qw);
                }

                position.applyQuaternion(quaternionTUV).applyQuaternion(quaternionUVW);
                target.matrixAutoUpdate = false;
                target.position.copy(position);
                target.quaternion.copy(target.initial_quaternion).multiply(quaternionTUV).multiply(quaternionUVW);
                target.updateMatrix();
                target.updateMatrixWorld();
                target.matrixAutoUpdate = true;
                isChanged = true;
            }
        }

        if (isChanged) {
            if (layer.isTimeseriesPotree || layer.isTimeseriesC3DTiles) layer.updateParams();
            if (redraw) this.itownsView.notifyChange(layer);
        }
    }

    // -----------------------------------------------------------------------
    // レイヤーデータリスト取得
    // -----------------------------------------------------------------------

    async getLayerDataList(): Promise<any[]> {
        const layers: any[] = this.itownsView.getLayers();
        const dataList: any[] = [];

        for (const layer of layers) {
            if (!layer || layer.isChildLayer) continue;
            const data: any = {};

            if ('bboxes' in layer) data.bbox = layer.bboxes.visible;
            if ('pointSize' in layer) data.pointSize = layer.pointSize;
            if ('wireframe' in layer) data.wireframe = layer.wireframe;
            if ('opacity' in layer) data.opacity = layer.opacity;
            if ('sseThreshold' in layer) data.sseThreshold = layer.sseThreshold;
            if ('conversion' in layer) data.conversion = JSON.parse(JSON.stringify(layer.conversion));
            if ('scale' in layer) data.scale = layer.scale;
            if ('size' in layer) data.size = layer.size;
            if ('offset_small_uv' in layer) data.offset_small_uv = JSON.parse(JSON.stringify(layer.offset_small_uv));
            if ('offset_uvw' in layer) data.offset_uvw = JSON.parse(JSON.stringify(layer.offset_uvw));

            if ('isBarGraph' in layer) {
                data.isBarGraph = layer.isBarGraph;
                if (!layer.ready) await layer.whenReady;
                if (layer.source?._featuresCaches?.[layer.crs]) {
                    const loaded = await layer.source.loadData(this.BarGraphExtent, layer);
                    data.csv = loaded.csv;
                    if ('initialBargraphParams' in loaded) data.initialBargraphParams = loaded.initialBargraphParams;
                }
            }
            if ('isTimeseriesPotree' in layer) {
                data.isTimeseriesPotree = layer.isTimeseriesPotree;
                if (!layer.ready) await layer.whenReady;
                const jsonData = await layer.source.loadData(layer.tempExtent, layer);
                data.json = jsonData.json;
            }
            if ('isTimeseriesC3DTiles' in layer) {
                data.isTimeseriesC3DTiles = layer.isTimeseriesC3DTiles;
                if (!layer.ready) await layer.whenReady;
                const jsonData = await layer.source.loadData(layer.tempExtent, layer);
                data.json = jsonData.json;
            }
            if ('isOBJ' in layer) data.isOBJ = layer.isOBJ;

            if (layer.source?.format) data.format = layer.source.format;
            if (layer.source?.attribution) data.attribution = layer.source.attribution;

            data.type = (() => {
                if (layer.isUserLayer) return ITownsConstants.TypeUser;
                if (layer instanceof itowns.ColorLayer) return ITownsConstants.TypeColor;
                if (layer instanceof itowns.ElevationLayer) return ITownsConstants.TypeElevation;
                if (layer instanceof itowns.PotreeLayer) return ITownsConstants.TypePointCloud;
                if (layer.isTimeseriesPotree) return ITownsConstants.TypePointCloudTimeSeries;
                if (layer instanceof itowns.C3DTilesLayer) return ITownsConstants.Type3DTile;
                if (layer.isTimeseriesC3DTiles) return ITownsConstants.Type3DTilesTimeSeries;
                if (layer instanceof itowns.GeometryLayer || layer.isBarGraph || layer.isOBJ) return ITownsConstants.TypeGeometry;
                return ITownsConstants.TypeUser;
            })();

            data.visible = layer.visible;
            data.crs = layer.crs;
            data.id = layer.id;

            const hasUrl = layer.source?.url !== undefined || layer.source?.file !== undefined || (layer.name && layer.url) || layer.isUserLayer;
            if (hasUrl) {
                if (layer.source) {
                    if (data.crs && data.crs.indexOf('EPSG:') <= 0 && layer.source.extent) data.crs = layer.source.extent.crs;
                    data.url = layer.source.url ?? layer.url;
                    data.style = layer.source.style;
                    data.mtlurl = layer.source.mtlurl;
                    data.jsonurl = layer.source.jsonurl;
                    data.file = layer.source.file;
                    data.zoom = layer.source.zoom;
                } else {
                    data.url = layer.url;
                    data.style = layer.style;
                    data.mtlurl = layer.mtlurl;
                    data.jsonurl = layer.jsonurl;
                    data.file = layer.file;
                    data.name = layer.name;
                }

                if (data.url?.indexOf('?LAYER=') > 0) {
                    const getParams = data.url.slice(data.url.indexOf('?LAYER='));
                    for (const p of getParams.split('&')) {
                        if (p.indexOf('TILEMATRIXSET=') >= 0) data.tileMatrixSet = p.slice(p.indexOf('=') + 1);
                        else if (p.indexOf('STYLE=') >= 0) data.style = p.slice(p.indexOf('=') + 1);
                    }
                    data.url = data.url.slice(0, data.url.indexOf('?LAYER='));
                }

                dataList.push(data);
            }
        }
        return dataList;
    }

    // -----------------------------------------------------------------------
    // パフォーマンス計測
    // -----------------------------------------------------------------------

    private isViewReady(): boolean {
        return (
            this.itownsView.mainLoop.scheduler.commandsWaitingExecutionCount() === 0 &&
            this.itownsView.mainLoop.renderingState === 0
        );
    }

    private measurePerformance(): any {
        const status: any = {};
        const tileLayer = this.itownsView.tileLayer;
        if (tileLayer) {
            const stats: any = {};
            status.id = tileLayer.id;
            status.offset_uvw = tileLayer.offset_uvw;
            const countVisible = (node: any, s: any) => {
                if (!node || !node.visible) return;
                if (node.level >= 0 && node.layer === tileLayer) {
                    s[node.level] = s[node.level] ?? [0, 0];
                    s[node.level][0]++;
                    if (node.material.visible) s[node.level][1]++;
                }
                if (node.children) for (const child of node.children) countVisible(child, s);
            };
            countVisible(tileLayer.object3d, stats);
            status.nodeVisible = stats;
        }
        const renderer = this.itownsView.mainLoop.gfxEngine.renderer;
        const memory = renderer.info.memory;
        status.textureCount = memory.textures;
        status.geometryCount = memory.geometries;
        status.triangleCount = renderer.info.render.triangles;
        status.pointCount = renderer.info.render.points;
        status.lineCount = renderer.info.render.lines;
        return status;
    }

    private async measureMemory(): Promise<any> {
        return (performance as any).measureUserAgentSpecificMemory();
    }

    // -----------------------------------------------------------------------
    // GlobeControls ボタン
    // -----------------------------------------------------------------------

    private addEarthControls(): void {
        const controls = this.itownsView.controls;
        console.error('addEarthControls', controls instanceof itowns.GlobeControls);
        if (!(controls instanceof itowns.GlobeControls)) return;

        const makeBtn = (text: string, bottom: string): HTMLButtonElement => {
            const btn = document.createElement('button');
            btn.style.cssText = `position:fixed;bottom:${bottom};left:35px;height:25px;z-index:1;background-color:#3071a9;color:white;border-radius:4px;`;
            btn.textContent = text;
            document.body.appendChild(btn);
            return btn;
        };

        const fitButton = makeBtn('Fit Camera', '70px');
        fitButton.style.display = controls.isMyOrbitMode ? 'block' : 'none';
        fitButton.onclick = () => {
            const layer = this.getSelectedLayer();
            if (layer?.object3d) {
                const bbox = new itowns.THREE.Box3();
                layer.object3d.traverse((obj: any) => {
                    if (obj.type === 'Mesh') {
                        obj.geometry.computeBoundingBox();
                        bbox.union((new itowns.THREE.Box3()).copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld));
                    }
                });
                controls.fitCamera(bbox);
            }
            fitButton.blur();
        };

        const resetButton = makeBtn('Reset Camera', '110px');
        resetButton.onclick = () => controls.resetCamera();

        const changeButton = makeBtn(controls.isMyOrbitMode ? 'Mode: Cartecian' : 'Mode: Earth', '150px');
        changeButton.onclick = () => {
            controls.setMyOrbitMode(!controls.isMyOrbitMode);
            changeButton.textContent = controls.isMyOrbitMode ? 'Mode: Cartecian' : 'Mode: Earth';
            fitButton.style.display = controls.isMyOrbitMode ? 'block' : 'none';
        };
    }
}
