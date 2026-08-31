/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
import { OBJLoader2 } from '../../../3rd/js/WWOBJLoader/examples/jsm/loaders/OBJLoader2.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { MtlObjBridge } from '../../../3rd/js/WWOBJLoader/examples/jsm/loaders/obj2/bridge/MtlObjBridge.js';
import encoding_ from '../../../3rd/js/encoding-japanese/encoding.min.js'; // この中でwindow.Encoding が定義されている
const Encoding = window.Encoding;

const OBJInitialScale = 10000;

function initializeOBJTransform(object: any): void {
    for (let i = 0; i < object.children.length; ++i) {
        const child = object.children[i] as any;
        child.rotation.z = 90 * Math.PI / 180;
        child.rotation.y = 90 * Math.PI / 180;
        child.geometry.scale(OBJInitialScale, OBJInitialScale, OBJInitialScale);
    }
}

function initializeOBJMaterial(object: any): void {
    const material = new itowns.THREE.MeshBasicMaterial({ color: 0x6699FF });
    for (let i = 0; i < object.children.length; ++i) {
        (object.children[i] as any).material = material;
    }
}

function createOBJSource(config: any): any {
    function checkResponse(response: Response): void {
        if (!response.ok) {
            const error: any = new Error(`Error loading ${response.url}: status ${response.status}`);
            error.response = response;
            throw error;
        }
    }
    const arrayBuffer = (url: string, options: RequestInit = {}) =>
        fetch(url, options).then((response) => { checkResponse(response); return response.arrayBuffer(); });

    const objSource = new itowns.FileSource({
        url: config.url,
        mtlurl: config.mtlurl ?? null,
        crs: 'EPSG:4978',
        fetcher: (url: string, options: RequestInit = {}) => arrayBuffer(url, options),
        parser: (buffer: ArrayBuffer) => {
            const data = new Uint8Array(buffer);
            const converted = Encoding.convert(data, { to: 'UNICODE', from: 'AUTO' });
            const str = Encoding.codeToString(converted);
            const manager = new itowns.THREE.LoadingManager();

            if (config.mtlurl) {
                const mtlLoader = new MTLLoader(manager);
                const splits = config.mtlurl.split('/');
                const file = splits[splits.length - 1];
                const basePath = config.mtlurl.split(file).join('');
                mtlLoader.setPath(basePath);

                return new Promise<any>((resolve) => {
                    mtlLoader.load(file, (materials: any) => resolve(materials));
                }).then((materials: any) => {
                    const objLoader = new OBJLoader2(manager);
                    objLoader.setLogging(true, true);
                    objLoader.addMaterials(MtlObjBridge.addMaterialsFromMtlLoader(materials), false);
                    const object = objLoader.parse(str);
                    initializeOBJTransform(object);
                    return Promise.resolve({ meshGroup: object });
                }).catch(() => {
                    console.error('Failed to load MTL');
                    const objLoader = new OBJLoader2(manager);
                    const object = objLoader.parse(str);
                    initializeOBJTransform(object);
                    initializeOBJMaterial(object);
                    return Promise.resolve({ meshGroup: object });
                });
            } else {
                const objLoader = new OBJLoader2(manager);
                const object = objLoader.parse(str);
                initializeOBJTransform(object);
                initializeOBJMaterial(object);
                return Promise.resolve({ meshGroup: object });
            }
        },
    });
    return objSource;
}

export function createOBJLayer(itownsView: any, config: any): any {
    class OBJLayer extends itowns.GeometryLayer {
        group: any;
        source: any;
        OBJExtent: any;
        isOBJ: boolean = true;
        updateOBJ: () => void;

        constructor() {
            const group = new itowns.THREE.Group();
            const objSource = createOBJSource(config);
            objSource.mtlurl = config.mtlurl;
            super(config.id, group, { source: objSource });
            this.source = objSource;
            this.group = group;
            this.OBJExtent = new itowns.Extent('EPSG:4978', 0, 0, 0);
            this.updateOBJ = this._updateOBJ.bind(this);
            this.defineLayerProperty('scale', (this as any).scale || 1.0, () => {
                if (group.children.length > 0) this.updateOBJ();
            });
        }

        update(_context: any, _layer: any, _node: any) {}

        preUpdate(_context: any, _changeSources: any) {
            this.source.loadData(this.OBJExtent, this).then((data: any) => {
                if (!data) { console.error('Not found obj datasource'); }
                if (!this.group.getObjectById(data.meshGroup.id)) {
                    console.log('add mesh group', data);
                    this.group.add(data.meshGroup);
                    for (let i = 0; i < data.meshGroup.children.length; ++i) {
                        data.meshGroup.children[i].layer = this;
                    }
                    this.updateOBJ();
                }
            });
        }

        convert() {}

        private _updateOBJ(): void {
            this.source.loadData(this.OBJExtent, this).then((data: any) => {
                const scaleValue = (this as any).scale;
                for (let i = 0; i < data.meshGroup.children.length; ++i) {
                    data.meshGroup.children[i].scale.set(scaleValue, scaleValue, scaleValue);
                    data.meshGroup.children[i].updateMatrixWorld();
                }
            });
        }
    }
    return new OBJLayer();
}

// 実行時にPreset側で読みこんだitowns.jsを使いたいため
// この時点でitownsのクラスを露出せず、生成関数をエクスポートする
export default createOBJLayer;
