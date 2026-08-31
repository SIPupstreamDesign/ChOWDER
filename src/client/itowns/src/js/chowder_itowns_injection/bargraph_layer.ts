/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import papaparse_ from '../../../3rd/js/papaparse/papaparse.js'; // この中でwindow.Papa が定義される
const Papa = window.Papa;
import Rainbow from '../../../3rd/js/colormap.js';
import ExprEval from '../../../3rd/js/expr-eval.mjs';
import encoding_ from '../../../3rd/js/encoding-japanese/encoding.min.js'; // この中でwindow.Encoding が定義される
const Encoding = window.Encoding;

function checkResponse(response: Response): void {
    if (!response.ok) {
        const error: any = new Error(`Error loading ${response.url}: status ${response.status}`);
        error.response = response;
        throw error;
    }
}

function fetchJSON(url: string, options: RequestInit = {}): Promise<any> {
    return fetch(url, options).then((response) => { checkResponse(response); return response.json(); });
}

function createCSVBargraphSource(itownsView: any, config: any): any {
    const arrayBuffer = (url: string, options: RequestInit = {}) =>
        fetch(url, options).then((r) => { checkResponse(r); return r.arrayBuffer(); });

    const bargraphSource = new itowns.FileSource({
        url: config.url,
        jsonurl: config.jsonurl ?? null,
        crs: 'EPSG:4326',
        fetcher: (url: string, options: RequestInit = {}) => arrayBuffer(url, options),
        parser: (buffer: ArrayBuffer) => {
            const data = new Uint8Array(buffer);
            const converted = Encoding.convert(data, { to: 'UNICODE', from: 'AUTO' });
            const str = Encoding.codeToString(converted);
            const parsed = Papa.parse(str);

            const group = new itowns.THREE.Group();
            for (let i = 1; i < parsed.data.length; ++i) {
                if (parsed.data[i].length !== parsed.data[0].length) continue;
                const material = itownsView.isPlanarView
                    ? new itowns.THREE.MeshBasicMaterial({ color: 0x5555ff })
                    : new itowns.THREE.MeshToonMaterial({ color: 0x5555ff });
                material.opacity = 1.0;
                const geo = new itowns.THREE.BoxGeometry(1, 1, 1);
                geo.translate(0, 0, -0.5);
                const mesh = new itowns.THREE.Mesh(geo, material);
                mesh.scale.set(1, 1, 1);
                mesh.lookAt(0, 0, 0);
                mesh.updateMatrixWorld();
                mesh.CSVIndex = i;
                mesh.visible = false;
                group.add(mesh);
            }

            const jsonKeyToParamKey: Record<string, string> = {
                Time: 'time', Longitude: 'lon', Latitude: 'lat', Physical1: 'physical1', Physical2: 'physical2',
            };

            if (config.jsonurl) {
                return new Promise<any>((resolve) => {
                    fetchJSON(config.jsonurl).then((data: any) => {
                        const csvKeys: string[] = parsed.data[0];
                        const params: any = {};
                        for (const jsonKey in jsonKeyToParamKey) {
                            if (jsonKey in data) {
                                const jsonVal = data[jsonKey];
                                const paramKey = jsonKeyToParamKey[jsonKey];
                                const idx = csvKeys.indexOf(jsonVal);
                                if (idx >= 0) {
                                    params[paramKey] = idx;
                                } else if (paramKey === 'physical1') {
                                    params.physical1 = 'Custom'; params.physical1Expr = jsonVal;
                                } else if (paramKey === 'physical2') {
                                    params.physical2 = 'Custom'; params.physical2Expr = jsonVal;
                                }
                            }
                        }
                        resolve({ initialBargraphParams: params, csv: parsed, meshGroup: group });
                    }).catch((err: any) => {
                        console.error(err);
                        resolve({ csv: parsed, meshGroup: group });
                    });
                });
            }
            return Promise.resolve({ csv: parsed, meshGroup: group });
        },
    });
    return bargraphSource;
}

class ColorMap {
    private map: string[];
    private numMin: number = 0;
    private numMax: number = 1;

    constructor() {
        this.map = window.colormap({ colormap: 'jet', nshades: 1000, format: 'hex', alpha: 1 });
    }

    setNumberRange(numMin: number, numMax: number): void {
        this.numMin = numMin;
        this.numMax = numMax;
    }

    getColorAt(number: number): string {
        const num = Math.max(this.numMin, Math.min(this.numMax, number));
        const len = this.numMax - this.numMin;
        const ratio = len > 0 ? (num - this.numMin) / len : 0;
        const index = Math.max(0, Math.min(999, Math.floor(ratio * 1000)));
        return this.map[index].replace('#', '');
    }
}

export function createBarGraphLayer(itownsView: any, config: any): any {
    class BarGraphLayer extends itowns.GeometryLayer {
        group: any;
        source: any;
        BarGraphExtent: any;
        colormap: ColorMap;
        exprParser: any;
        isBarGraph: boolean = true;
        currentDate: Date | null = null;
        range: any = null;
        initialBargraphParams: any = null;
        updateBarGraph: () => void;

        constructor() {
            const group = new itowns.THREE.Group();
            const bargraphSource = createCSVBargraphSource(itownsView, config);
            bargraphSource.jsonurl = config.jsonurl;
            super(config.id, group, { source: bargraphSource });
            this.group = group;
            this.source = bargraphSource;
            this.BarGraphExtent = new itowns.Extent('EPSG:4326', 0, 0, 0);
            this.colormap = new ColorMap();
            this.exprParser = new ExprEval.Parser();
            this.updateBarGraph = this._updateBarGraph.bind(this);
            this.defineLayerProperty('scale', this.scale || 1.0, this.updateBarGraph);
            this.defineLayerProperty('size', (this as any).size || 5, this.updateBarGraph);
            this.defineLayerProperty('bargraphParams', {}, this.updateBarGraph);
        }

        update(_context: any, _layer: any, _node: any) {}

        preUpdate(_context: any, _changeSources: any) {
            this.source.loadData(this.BarGraphExtent, this).then((data: any) => {
                if (!data) { console.error('Not found bargraph datasource'); return; }
                if (!this.group.getObjectById(data.meshGroup.id)) {
                    this.group.add(data.meshGroup);
                    for (const child of data.meshGroup.children) child.layer = this;
                }
            });
        }

        convert() {}

        convertPhisicalValueByExpr(exprStr: string, csvData: any[], csvIndex: number): number {
            const expr = this.exprParser.parse(exprStr);
            const currentValues: Record<string, any> = {};
            for (let k = 0; k < csvData[0].length; ++k) currentValues[csvData[0][k]] = csvData[csvIndex][k];
            return expr.evaluate(currentValues);
        }

        private _updateBarGraph() {
            if (!('bargraphParams' in this)) return;
            this.source.loadData(this.BarGraphExtent, this).then((data: any) => {
                let params: any = null;
                if ('initialBargraphParams' in data) {
                    this.initialBargraphParams = data.initialBargraphParams;
                    params = JSON.parse(JSON.stringify(this.initialBargraphParams));
                }
                if (!params) {
                    params = (this as any).bargraphParams;
                } else {
                    for (const key in (this as any).bargraphParams) params[key] = (this as any).bargraphParams[key];
                }

                const csvData = data.csv.data;
                const getVal = (p: any, key: string) => (key.length > 0 && key in p) ? p[key] : '';
                const isValidIndex = (i: any, arr: any[]) => Number.isInteger(i) && i >= 0 && i < arr.length;

                const lonIndex = getVal(params, 'lon');
                const latIndex = getVal(params, 'lat');
                const timeIndex = getVal(params, 'time');
                const physicalVal1Index = getVal(params, 'physical1');
                const physicalVal2Index = getVal(params, 'physical2');
                const physical1Expr = getVal(params, 'physical1Expr');
                const physical2Expr = getVal(params, 'physical2Expr');

                let physicalVal2Range = { min: +Infinity, max: -Infinity };
                for (const mesh of data.meshGroup.children) {
                    let v2 = Number(csvData[mesh.CSVIndex][physicalVal2Index]);
                    if (physical2Expr.length > 0) v2 = this.convertPhisicalValueByExpr(physical2Expr, csvData, mesh.CSVIndex);
                    if (isNaN(v2)) v2 = 0;
                    physicalVal2Range.min = Math.min(physicalVal2Range.min, v2);
                    physicalVal2Range.max = Math.max(physicalVal2Range.max, v2);
                }
                if (physicalVal2Range.min !== physicalVal2Range.max) {
                    this.colormap.setNumberRange(physicalVal2Range.min, physicalVal2Range.max);
                }

                for (let i = 0; i < data.meshGroup.children.length; ++i) {
                    const mesh = data.meshGroup.children[i];
                    let isValidLon = isValidIndex(lonIndex, csvData[i]);
                    let isValidLat = isValidIndex(latIndex, csvData[i]);
                    const isValidTime = isValidIndex(timeIndex, csvData[i]);

                    let lon = isValidLon ? Number(csvData[i][lonIndex]) : 0;
                    let lat = isValidLat ? Number(csvData[i][latIndex]) : 0;
                    if (isNaN(lon)) { lon = 0; isValidLon = false; }
                    if (isNaN(lat)) { lat = 0; isValidLat = false; }

                    const coord = new itowns.Coordinates('EPSG:4326', lon, lat, 0);
                    let v1 = isValidIndex(physicalVal1Index, csvData[mesh.CSVIndex])
                        ? Number(csvData[mesh.CSVIndex][physicalVal1Index]) * 1000 * (this as any).scale
                        : 1.0;
                    if (physical1Expr.length > 0) v1 = this.convertPhisicalValueByExpr(physical1Expr, csvData, mesh.CSVIndex) * 1000 * (this as any).scale;

                    let v2 = Number(csvData[mesh.CSVIndex][physicalVal2Index]);
                    if (physical2Expr.length > 0) v2 = this.convertPhisicalValueByExpr(physical2Expr, csvData, mesh.CSVIndex);
                    if (isNaN(v2)) v2 = 0;

                    mesh.material.color.setHex('0x' + this.colormap.getColorAt(v2));
                    const size = (this as any).size;
                    mesh.scale.set(size * 10000, size * 10000, itownsView.isPlanarView ? -v1 : v1);
                    mesh.position.copy(coord.as(itownsView.referenceCrs));
                    if (!itownsView.isPlanarView) {
                        const z = new itowns.Coordinates('EPSG:4978', 0, 0, 0).as(itownsView.referenceCrs);
                        mesh.lookAt(new itowns.THREE.Vector3(z.x, z.y, z.z));
                    }
                    mesh.visible = isValidLon && isValidLat;

                    if (mesh.visible && isValidTime && this.currentDate) {
                        const date = new Date(csvData[i][timeIndex]);
                        mesh.visible = date.getTime() <= this.currentDate.getTime();
                        if (this.range) {
                            if (this.currentDate < this.range.rangeStartTime || this.currentDate > this.range.rangeEndTime) mesh.visible = false;
                            if (date.getTime() < this.range.rangeStartTime || date.getTime() > this.range.rangeEndTime) mesh.visible = false;
                        }
                    }
                    mesh.updateMatrixWorld();
                }
            });
        }

        updateByTime(currentDate: Date | null = null, range: any = null) {
            this.currentDate = currentDate;
            this.range = range;
            this.updateBarGraph();
        }
    }
    return new BarGraphLayer();
}
