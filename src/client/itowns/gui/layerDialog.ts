/**
 * レイヤー追加ダイアログ
 */

import { ITownsConstants } from '../constants/layerConstants';

type LayerDialogCallback = (isOK: boolean, data?: any) => void;
type UploadFn = (filename: string, type: string, binary: ArrayBuffer, cb: (err: any, result?: any) => void) => void;

const SAMPLE_URLS: Record<string, string> = {
    [ITownsConstants.TypeColor]: 'std/{z}/{x}/{y}.png',
    [ITownsConstants.TypeElevation]: 'std/{z}/{x}/{y}.png',
    [ITownsConstants.Type3DTile]: 'something/tileset.json',
    [ITownsConstants.Type3DTilesTimeSeries]: 'something/timeseries.json',
    [ITownsConstants.TypePointCloud]: 'something/cloud.js',
    [ITownsConstants.TypePointCloudTimeSeries]: 'something/timeseries.json',
    [ITownsConstants.TypeGeometry]: 'something/data.pbf',
    [ITownsConstants.TypeBargraph]: 'sample_data/bargraph/data1.csv',
    [ITownsConstants.TypeOBJ]: 'sample_data/obj/teapot/teapot.obj',
};

export class LayerDialog {
    private uploadFn: UploadFn;
    private dom: HTMLDivElement;
    private background: HTMLDivElement;
    private typeSelect!: HTMLSelectElement;
    private idInput!: HTMLInputElement;
    private titleInput!: HTMLInputElement;
    private urlInput!: HTMLInputElement;
    private jsonURLInput!: HTMLInputElement;
    private epsgInput!: HTMLInputElement;
    private errorText!: HTMLParagraphElement;
    private endCallback: LayerDialogCallback | null = null;
    private csvBinary: ArrayBuffer | null = null;
    private jsonBinary: ArrayBuffer | null = null;

    constructor(uploadFn: UploadFn) {
        this.uploadFn = uploadFn;
        this.dom = document.createElement('div');
        this.dom.className = 'layer_dialog';
        this.dom.style.display = 'none';
        this.background = document.createElement('div');
        this.background.className = 'layer_dialog_background';
        this.background.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999';
        document.body.appendChild(this.background);
        this.init();
    }

    onUploadDone(err: any, data: any): void {
        if (err) {
            this.errorText.textContent = 'Error: ' + err;
        } else if (data?.path) {
            const base = `${location.protocol}//${location.hostname}${location.port ? ':' + location.port : ''}`;
            if (data.path.indexOf('.csv') >= 0) {
                this.urlInput.value = `${base}/${data.path}`;
            } else if (data.path.indexOf('.json') >= 0) {
                this.jsonURLInput.value = `${base}/${data.path}`;
            }
        }
    }

    private init(): void {
        const wrap = document.createElement('div');
        wrap.className = 'layer_dialog_wrap';
        wrap.style.cssText = 'background:#fff;border-radius:6px;padding:20px;min-width:400px;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000;max-height:80vh;overflow-y:auto;';

        const title = document.createElement('p');
        title.textContent = 'レイヤーを追加';
        title.style.cssText = 'font-weight:bold;margin-bottom:12px;font-size:16px;';
        wrap.appendChild(title);

        const row = (label: string): HTMLDivElement => {
            const r = document.createElement('div');
            r.style.cssText = 'margin-bottom:8px;display:flex;align-items:center;gap:8px;';
            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.style.cssText = 'min-width:80px;font-size:13px;';
            r.appendChild(lbl);
            wrap.appendChild(r);
            return r;
        };

        // Type
        const typeRow = row('タイプ:');
        this.typeSelect = document.createElement('select');
        this.typeSelect.style.flex = '1';
        for (const [k, v] of Object.entries(ITownsConstants)) {
            if (!k.startsWith('Upload')) {
                const opt = document.createElement('option');
                opt.value = v as string;
                opt.textContent = v as string;
                this.typeSelect.appendChild(opt);
            }
        }
        typeRow.appendChild(this.typeSelect);

        // ID
        const idRow = row('ID:');
        this.idInput = document.createElement('input');
        this.idInput.type = 'text';
        this.idInput.placeholder = 'layer_id';
        this.idInput.style.flex = '1';
        idRow.appendChild(this.idInput);

        // タイトル
        const titleRow = row('タイトル:');
        this.titleInput = document.createElement('input');
        this.titleInput.type = 'text';
        this.titleInput.placeholder = 'Layer Title';
        this.titleInput.style.flex = '1';
        titleRow.appendChild(this.titleInput);

        // URL
        const urlRow = row('URL:');
        this.urlInput = document.createElement('input');
        this.urlInput.type = 'text';
        this.urlInput.style.flex = '1';
        urlRow.appendChild(this.urlInput);
        this.typeSelect.addEventListener('change', () => {
            this.urlInput.placeholder = SAMPLE_URLS[this.typeSelect.value] ?? '';
        });
        this.urlInput.placeholder = SAMPLE_URLS[this.typeSelect.value] ?? '';

        // CSV / JSON アップロードボタン
        const csvRow = row('CSV:');
        const csvFileInput = document.createElement('input');
        csvFileInput.type = 'file';
        csvFileInput.accept = '.csv';
        csvFileInput.addEventListener('change', () => {
            const file = csvFileInput.files?.[0];
            if (file) {
                file.arrayBuffer().then((buf) => {
                    this.csvBinary = buf;
                    this.uploadFn(file.name, ITownsConstants.UploadTypeCSV, buf, (err, result) => {
                        this.onUploadDone(err, result);
                    });
                });
            }
        });
        csvRow.appendChild(csvFileInput);

        // JSON URL
        const jsonRow = row('JSON URL:');
        this.jsonURLInput = document.createElement('input');
        this.jsonURLInput.type = 'text';
        this.jsonURLInput.style.flex = '1';
        jsonRow.appendChild(this.jsonURLInput);

        // EPSG
        const epsgRow = row('EPSG:');
        this.epsgInput = document.createElement('input');
        this.epsgInput.type = 'text';
        this.epsgInput.placeholder = 'EPSG:4326';
        this.epsgInput.style.flex = '1';
        epsgRow.appendChild(this.epsgInput);

        // エラーテキスト
        this.errorText = document.createElement('p');
        this.errorText.style.cssText = 'color:red;min-height:20px;font-size:12px;';
        wrap.appendChild(this.errorText);

        // ボタン行
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:12px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'キャンセル';
        cancelBtn.addEventListener('click', () => this.hide(false));
        btnRow.appendChild(cancelBtn);

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.cssText = 'background:#007bff;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;';
        okBtn.addEventListener('click', () => this.onOK());
        btnRow.appendChild(okBtn);

        wrap.appendChild(btnRow);
        this.dom.appendChild(wrap);
    }

    private onOK(): void {
        const id = this.idInput.value.trim();
        if (!id) {
            this.errorText.textContent = 'ID は必須です';
            return;
        }
        const data: any = {
            id,
            type: this.typeSelect.value,
            name: this.titleInput.value.trim() || id,
            url: this.urlInput.value.trim(),
            epsg: this.epsgInput.value.trim(),
        };
        if (this.jsonURLInput.value.trim()) {
            data.jsonURL = this.jsonURLInput.value.trim();
        }
        this.hide(true, data);
    }

    show(callback: LayerDialogCallback): void {
        this.endCallback = callback;
        this.errorText.textContent = '';
        this.csvBinary = null;
        this.jsonBinary = null;
        this.dom.style.display = 'block';
        this.background.style.display = 'block';
        document.body.appendChild(this.dom);
    }

    private hide(isOK: boolean, data?: any): void {
        this.dom.style.display = 'none';
        this.background.style.display = 'none';
        this.endCallback?.(isOK, data);
        this.endCallback = null;
    }

    getDOM(): HTMLDivElement {
        return this.dom;
    }
}
