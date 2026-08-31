/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

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

function createTimescalePotreeSource(config: any): any {
    const potreeSource = new itowns.FileSource({
        url: config.url + config.file,
        crs: 'EPSG:4978',
        fetcher: (url: string, options: RequestInit = {}) => fetchText(url, options),
        parser: (buffer: string) => {
            const data = JSON.parse(buffer);

            const layers: Array<{ time: string; layer: any }> = [];
            for (const timeStr in data) {
                const url = data[timeStr];
                const splits = url.split('/');
                const file = splits[splits.length - 1];
                const serverUrl = url.split(file).join('');
                const childConfig = JSON.parse(JSON.stringify(config));
                childConfig.id = config.id + '_' + timeStr;
                childConfig.url = serverUrl;
                childConfig.file = file;

                const childLayer = new itowns.PotreeLayer(childConfig.id, {
                    source: new itowns.PotreeSource(childConfig),
                });
                childLayer.isChildLayer = true;

                // ISO8601による時刻文字列からDateを作成する
                childLayer.date = new Date(timeStr);

                layers.push({ time: timeStr, layer: childLayer });
            }
            const sortLayers = [...layers].sort((a, b) => (a.time > b.time ? 1 : -1));
            return Promise.resolve({ layers: sortLayers, json: buffer });
        },
    });
    return potreeSource;
}

export function createTimescalePotreeLayer(itownsView: any, config: any): any {
    class TimescalePotreeLayer extends itowns.Layer {
        config: any;
        itownsView: any;
        source: any;
        isTimeseriesPotree: boolean = true;
        tempExtent: any;
        updateParams_: () => void;
        attachedLayers: any[];
        bboxes: { visible: boolean };
        visible: boolean;
        object3d: any;
        root: any;
        currentDate: Date | null = null;
        range: any = null;

        constructor() {
            const potreeSource = createTimescalePotreeSource(config);
            super(config.id, { source: potreeSource });
            this.config = config;
            this.itownsView = itownsView;
            this.source = potreeSource;
            this.tempExtent = new itowns.Extent('EPSG:4978', 0, 0, 0);
            this.updateParams_ = this.updateParams.bind(this);
            this.attachedLayers = [];
            this.bboxes = { visible: false };
            this.visible = true;
            this.object3d = new itowns.THREE.Group();
            this.root = new itowns.THREE.Group();

            this.defineLayerProperty('visible', this.visible, this.updateParams_);
            this.defineLayerProperty('bboxes', this.bboxes, this.updateParams_);
            this.defineLayerProperty('opacity', (this as any).opacity ?? 1.0, this.updateParams_);
            this.defineLayerProperty('pointSize', (this as any).pointSize ?? 4, this.updateParams_);
            this.defineLayerProperty('sseThreshold', (this as any).sseThreshold ?? 2, this.updateParams_);
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
                    data.layers[i].layer.pointSize = (this as any).pointSize;
                    data.layers[i].layer.sseThreshold = (this as any).sseThreshold;
                    data.layers[i].layer.opacity = (this as any).opacity;
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

                    // PointCloudLayer.js での LoD 計算における、
                    // カメラオフセット補正（uvw移動前の位置に合わせる）
                    if ('root' in targetLayer && 'bbox' in targetLayer.root) {
                        const min = targetLayer.root.bbox.min;
                        const minOrg = new itowns.THREE.Vector3(min.x, min.y, min.z);
                        const cameraOffset = new itowns.THREE.Vector3(min.x, min.y, min.z);
                        cameraOffset.add(this.object3d.position);
                        if ('initial_position' in target) {
                            cameraOffset.sub(target.initial_position);
                        }
                        cameraOffset.applyQuaternion(this.object3d.quaternion);
                        cameraOffset.sub(minOrg);
                        target.position.set(cameraOffset.x, cameraOffset.y, cameraOffset.z);
                    }
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
                    data.layers[i].layer.bboxes.visible = false;
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
                    visibleLayer.bboxes.visible = this.bboxes.visible;
                }
            });
        }

        updateByTime(currentDate: Date | null = null, range: any = null): void {
            this.currentDate = currentDate;
            this.range = range;
            this.updateVisibility();
        }
    }

    return new TimescalePotreeLayer();
}

// 実行時にPreset側で読みこんだitowns.jsを使いたいため
// この時点でitownsのクラスを露出せず、生成関数をエクスポートする
export default createTimescalePotreeLayer;
