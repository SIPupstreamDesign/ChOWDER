/**
 * レイヤー一覧 UI
 */

import { LayerDialog } from './layerDialog';
import { LayerData } from '../types/types';

type AddLayerFn = (data: any) => void;
type DeleteLayerFn = (id: string) => void;
type SelectLayerFn = (id: string) => void;
type LayerSelectCallback = (id: string) => void;

export class LayerList {
    private addLayerFn: AddLayerFn;
    private deleteLayerFn: DeleteLayerFn;
    private selectLayerFn: SelectLayerFn;
    private layerSelectCallbacks: LayerSelectCallback[] = [];
    private dom: HTMLDivElement;
    private listEl: HTMLSelectElement;
    private addBtn: HTMLButtonElement;
    private deleteBtn: HTMLButtonElement;
    private layerDialog: LayerDialog;

    constructor(addLayerFn: AddLayerFn, deleteLayerFn: DeleteLayerFn, selectLayerFn: SelectLayerFn, layerDialog: LayerDialog) {
        this.addLayerFn = addLayerFn;
        this.deleteLayerFn = deleteLayerFn;
        this.selectLayerFn = selectLayerFn;
        this.layerDialog = layerDialog;

        this.dom = document.createElement('div');
        this.dom.className = 'layer_list';

        // レイヤーリスト（複数行 select）
        this.listEl = document.createElement('select');
        this.listEl.className = 'layer_select';
        this.listEl.size = 10;
        this.listEl.style.cssText = 'width:100%;min-height:150px;font-size:13px;';
        this.dom.appendChild(this.listEl);

        // ボタンエリア
        const btnArea = document.createElement('div');
        btnArea.className = 'layer_button_area';
        btnArea.style.cssText = 'display:flex;gap:6px;margin-top:6px;';

        this.addBtn = document.createElement('button');
        this.addBtn.textContent = '+';
        this.addBtn.className = 'layer_button';
        this.addBtn.style.cssText = 'flex:1;background:#007bff;color:#fff;border:none;border-radius:4px;padding:4px 0;cursor:pointer;';
        btnArea.appendChild(this.addBtn);

        this.deleteBtn = document.createElement('button');
        this.deleteBtn.textContent = '−';
        this.deleteBtn.className = 'layer_button';
        this.deleteBtn.style.cssText = 'flex:1;background:#dc3545;color:#fff;border:none;border-radius:4px;padding:4px 0;cursor:pointer;';
        this.deleteBtn.disabled = true;
        btnArea.appendChild(this.deleteBtn);

        this.dom.appendChild(btnArea);

        this.initEvents();
    }

    private initEvents(): void {
        this.addBtn.addEventListener('click', () => {
            this.layerDialog.show((isOK, data) => {
                if (isOK && data) this.addLayerFn(data);
            });
        });

        this.deleteBtn.addEventListener('click', () => {
            const value = this.listEl.value;
            if (!value) return;
            if (confirm(`レイヤー「${value}」を削除しますか？`)) {
                this.deleteLayerFn(value);
            }
        });

        this.listEl.addEventListener('change', () => {
            const value = this.listEl.value;
            if (!value) return;
            this.deleteBtn.disabled = false;
            this.selectLayerFn(value);
            for (const cb of this.layerSelectCallbacks) cb(value);
        });
    }

    onLayerSelected(cb: LayerSelectCallback): void {
        this.layerSelectCallbacks.push(cb);
    }

    private updateList(layers: LayerData[]): void {
        const current = this.listEl.value;
        while (this.listEl.firstChild) {
            this.listEl.removeChild(this.listEl.firstChild);
        }
        for (const layer of layers) {
            if (!layer) continue;
            const opt = document.createElement('option');
            opt.value = layer.id;
            opt.textContent = layer.name ?? layer.id;
            this.listEl.appendChild(opt);
        }
        // 選択を復元
        this.listEl.value = current;
    }

    initLayerSelectList(layers: LayerData[]): void {
        this.updateList(layers);
    }

    getDOM(): HTMLDivElement {
        return this.dom;
    }
}
