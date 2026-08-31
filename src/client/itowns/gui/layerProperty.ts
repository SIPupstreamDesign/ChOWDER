/**
 * レイヤープロパティパネル
 */

import { LayerData } from '../types/types';

type ChangeLayerPropertyFn = (data: Partial<LayerData> & { id: string; callback?: () => void }) => void;

export class LayerProperty {
    private changeLayerPropertyFn: ChangeLayerPropertyFn;
    private dom: HTMLDivElement;
    private currentLayerId: string | null = null;

    constructor(changeLayerPropertyFn: ChangeLayerPropertyFn) {
        this.changeLayerPropertyFn = changeLayerPropertyFn;

        this.dom = document.createElement('div');
        this.dom.className = 'layer_property';
        this.dom.style.cssText = 'padding:8px;font-size:13px;';

        const empty = document.createElement('p');
        empty.className = 'layer_property_empty';
        empty.textContent = 'レイヤーを選択してください';
        empty.style.color = '#888';
        this.dom.appendChild(empty);
    }

    show(layer: LayerData): void {
        this.currentLayerId = layer.id;
        // 一度クリア
        while (this.dom.firstChild) this.dom.removeChild(this.dom.firstChild);

        const addRow = (label: string, control: HTMLElement): void => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.style.cssText = 'min-width:70px;font-size:12px;';
            row.appendChild(lbl);
            row.appendChild(control);
            this.dom.appendChild(row);
        };

        // 表示 / 非表示
        const visibleCheck = document.createElement('input');
        visibleCheck.type = 'checkbox';
        visibleCheck.checked = layer.visible !== false;
        visibleCheck.addEventListener('change', () => {
            this.changeLayerPropertyFn({ id: layer.id, visible: visibleCheck.checked });
        });
        addRow('表示:', visibleCheck);

        // 不透明度
        const opacityInput = document.createElement('input');
        opacityInput.type = 'range';
        opacityInput.min = '0';
        opacityInput.max = '1';
        opacityInput.step = '0.01';
        opacityInput.value = String(layer.opacity ?? 1);
        opacityInput.style.flex = '1';
        opacityInput.addEventListener('change', () => {
            this.changeLayerPropertyFn({ id: layer.id, opacity: parseFloat(opacityInput.value) });
        });
        addRow('不透明度:', opacityInput);
    }

    getDOM(): HTMLDivElement {
        return this.dom;
    }
}
