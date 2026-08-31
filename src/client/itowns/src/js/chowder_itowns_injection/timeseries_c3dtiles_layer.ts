/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
import { C3DTileUtil } from './c3dtile_util';

function checkResponse(response: Response): void {
    if (!response.ok) {
        const error: any = new Error(`Error loading ${response.url}: status ${response.status}`);
        error.response = response;
        throw error;
    }
}

function fetchText(url: string, options: RequestInit = {}): Promise<string> {
    return fetch(url, options).then((response) => { checkResponse(response); return response.text(); });
}

function createTimescaleC3DTilesSource(itownsView: any, config: any): any {
    const c3dtilesSource = new itowns.FileSource({
        url: config.source.url,
        crs: 'EPSG:4978',
        fetcher: (url: string, options: RequestInit = {}) => fetchText(url, options),
        parser: (buffer: string) => {
            const data = JSON.parse(buffer);

            const layers: Array<{ time: string; layer: any }> = [];
            for (const timeStr in data) {
                const url = data[timeStr];
                const childConfig = JSON.parse(JSON.stringify(config));
                childConfig.id = config.id + '_' + timeStr;
                childConfig.url = url;

                const childLayer = new itowns.C3DTilesLayer(childConfig.id, {
                    name: childConfig.id,
                    source: new itowns.C3DTilesSource(childConfig),
                    overrideMaterials: false,
                }, itownsView);
                childLayer.isChildLayer = true;

                // ISO8601による時刻文字列からDateを作成する
                childLayer.date = new Date(timeStr);

                // EPSGによる座標変換の設定
                C3DTileUtil.applyConvertSetting(childLayer, config);

                layers.push({ time: timeStr, layer: childLayer });
            }
            const sortLayers = [...layers].sort((a, b) => (a.time > b.time ? 1 : -1));
            return Promise.resolve({ layers: sortLayers, json: buffer });
        },
    });
    return c3dtilesSource;
}

export function createTimescaleC3DTilesLayer(itownsView: any, config: any): any {
    class Timescale3DTilesLayer extends itowns.Layer {
        config: any;
        itownsView: any;
        source: any;
        isTimeseriesC3DTiles: boolean = true;
        tempExtent: any;
        updateParams_: () => void;
        attachedLayers: any[];
        visible: boolean;
        object3d: any;
        root: any;
        wireframe: boolean;
        currentDate: Date | null = null;
        range: any = null;

        constructor() {
            const c3dtilesSource = createTimescaleC3DTilesSource(itownsView, config);
            super(config.id, { source: c3dtilesSource });
            this.config = config;
            this.itownsView = itownsView;
            this.source = c3dtilesSource;
            this.tempExtent = new itowns.Extent('EPSG:4978', 0, 0, 0);
            this.updateParams_ = this.updateParams.bind(this);
            this.attachedLayers = [];
            this.visible = true;
            this.object3d = new itowns.THREE.Group();
            this.root = new itowns.THREE.Group();
            this.wireframe = false;

            this.defineLayerProperty('scale', 1.0, this.updateParams_);
            this.defineLayerProperty('visible', this.visible, this.updateParams_);
            this.defineLayerProperty('wireframe', this.wireframe, this.updateParams_);
            this.defineLayerProperty('opacity', (this as any).opacity ?? 1.0, this.updateParams_);
            this.defineLayerProperty('sseThreshold', (this as any).sseThreshold ?? 2, this.updateParams_);

            if ('conversion' in config) {
                this.defineLayerProperty('conversion', config.conversion, () => {
                    // not implemented
                });
            }
        }

        update(_context: any, _layer: any, _node: any) {}
        preUpdate(_context: any, _changeSources: any) {}
        postUpdate() {}
        convert() {}

        delete(): void {
            this.source.loadData(this.tempExtent, this).then((data: any) => {
                for (let i = 0; i < data.layers.length; ++i) {
                    data.layers[i].layer.delete();
                }
            });
        }

        updateParams(): void {
            this.source.loadData(this.tempExtent, this).then((data: any) => {
                this.updateVisibility();
                this.updateTransform();
                for (let i = 0; i < data.layers.length; ++i) {
                    const layer = data.layers[i].layer;
                    const scaleValue = (this as any).scale;
                    layer.object3d.scale.set(scaleValue, scaleValue, scaleValue);
                    layer.object3d.updateMatrixWorld();
                    layer.sseThreshold = (this as any).sseThreshold;
                    layer.opacity = (this as any).opacity;
                    layer.wireframe = this.wireframe;
                    this.itownsView.notifyChange(data.layers[i].layer);
                }
            });
        }

        updateTransform(): void {
            this.source.loadData(this.tempExtent, this).then((data: any) => {
                for (let i = 0; i < data.layers.length; ++i) {
                    const targetLayer = data.layers[i].layer;
                    const target = targetLayer.object3d;
                    target.matrixAutoUpdate = false;
                    target.position.copy(this.object3d.position);
                    target.quaternion.copy(this.object3d.quaternion);
                    target.updateMatrix();
                    target.updateMatrixWorld();
                    target.matrixAutoUpdate = true;
                }
            });
        }

        updateVisibility(): void {
            this.source.loadData(this.tempExtent, this).then((data: any) => {
                let visibleLayer: any = null;
                if (this.currentDate) {
                    for (let i = data.layers.length - 1; i >= 0; --i) {
                        if (data.layers[i].layer.date <= this.currentDate) {
                            visibleLayer = data.layers[i].layer;
                            break;
                        }
                    }
                }

                // 現在時刻がレンジ範囲外なら非表示
                if (this.range) {
                    if (this.currentDate! < this.range.rangeStartTime
                        || this.currentDate! > this.range.rangeEndTime) {
                        visibleLayer = null;
                    }
                }

                // 対象レイヤー以外非表示
                for (let i = 0; i < data.layers.length; ++i) {
                    data.layers[i].layer.visible = false;
                    if (i === 0) this.root = data.layers[i].layer.root;
                }

                if (this.visible && visibleLayer) {
                    let isExisted = false;
                    const layers = this.itownsView.getLayers();
                    for (let i = 0; i < layers.length; ++i) {
                        if (layers[i].id === visibleLayer.id) { isExisted = true; break; }
                    }
                    if (!isExisted) {
                        itowns.View.prototype.addLayer.call(this.itownsView, visibleLayer);
                    }
                    visibleLayer.visible = true;
                    this.root = visibleLayer.root;
                }
            });
        }

        updateByTime(currentDate: Date | null = null, range: any = null): void {
            this.currentDate = currentDate;
            this.range = range;
            this.updateVisibility();
        }
    }

    return new Timescale3DTilesLayer();
}

// 実行時にPreset側で読みこんだitowns.jsを使いたいため
// この時点でitownsのクラスを露出せず、生成関数をエクスポートする
export default createTimescaleC3DTilesLayer;
