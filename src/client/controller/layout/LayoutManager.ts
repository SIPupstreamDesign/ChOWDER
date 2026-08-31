import type { LogFn, SendCommandFn } from '../websocket/WebSocketClient';

export interface LayoutManagerDeps {
    elements: any;
    sendCmd: SendCommandFn;
    logFn: LogFn;
}

export class LayoutManager {
    private _layoutSummaries: any[] = [];
    private _selectedLayoutId: string | null = null;

    private readonly el: any;
    private readonly sendCmd: SendCommandFn;
    private readonly logFn: LogFn;

    constructor(deps: LayoutManagerDeps) {
        this.el = deps.elements;
        this.sendCmd = deps.sendCmd;
        this.logFn = deps.logFn;
    }

    get selectedLayoutId(): string | null { return this._selectedLayoutId; }

    async saveLayout(): Promise<void> {
        const inputEl = this.el.layoutNameInput as HTMLInputElement;
        const rawName = inputEl.value.trim() || 'layout';

        let name = rawName;
        const existing = this._layoutSummaries.map((s: any) => s.name);
        if (existing.includes(name)) {
            let counter = 1;
            while (existing.includes(`${rawName} (${counter})`)) counter++;
            name = `${rawName} (${counter})`;
        }

        try {
            await this.sendCmd('SaveContentsLayout', { name });
            this.logFn(`Layout "${name}" saved`, 'success');
            inputEl.value = '';
            await this.refreshLayoutList();
        } catch (error: any) {
            this.logFn(`Failed to save layout: ${error.message}`, 'error');
        }
    }

    async refreshLayoutList(): Promise<void> {
        try {
            const result = await this.sendCmd('GetContentsLayoutList');
            this._layoutSummaries = result?.layouts ?? [];
            this.renderLayoutList();
        } catch (error: any) {
            this.logFn(`Failed to fetch layout list: ${error.message}`, 'error');
        }
    }

    renderLayoutList(): void {
        const container = this.el.layoutList;
        if (!container) return;

        container.innerHTML = '';
        for (const summary of this._layoutSummaries) {
            const item = document.createElement('div');
            item.className = 'layout-item' + (summary.layoutId === this._selectedLayoutId ? ' selected' : '');
            item.dataset['layoutId'] = summary.layoutId;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'layout-item-name';
            nameSpan.textContent = summary.name;
            item.title = new Date(summary.updatedAt).toLocaleString();
            item.appendChild(nameSpan);

            item.addEventListener('click', () => {
                this._selectedLayoutId = summary.layoutId;
                this.renderLayoutList();
                if (this.el.restoreLayoutBtn) {
                    (this.el.restoreLayoutBtn as HTMLButtonElement).disabled = false;
                }
                if (this.el.deleteLayoutBtn) {
                    (this.el.deleteLayoutBtn as HTMLButtonElement).disabled = false;
                }
            });

            container.appendChild(item);
        }

        if (this._layoutSummaries.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'font-size:12px; color:#666; padding:4px 8px;';
            empty.textContent = 'No saved layouts';
            container.appendChild(empty);
        }
    }

    async restoreLayout(): Promise<void> {
        if (!this._selectedLayoutId) return;
        try {
            const result = await this.sendCmd('RestoreContentsLayout', { layoutId: this._selectedLayoutId });
            const skipped = result?.skippedIds?.length ?? 0;
            const updated = result?.updatedIds?.length ?? 0;
            this.logFn(`Layout restored: ${updated} updated, ${skipped} skipped`, 'success');
        } catch (error: any) {
            this.logFn(`Failed to restore layout: ${error.message}`, 'error');
        }
    }

    async deleteLayout(): Promise<void> {
        if (!this._selectedLayoutId) return;
        try {
            await this.sendCmd('DeleteContentsLayout', { layoutId: this._selectedLayoutId });
            this.logFn('Layout deleted', 'success');
            this._selectedLayoutId = null;
            if (this.el.restoreLayoutBtn) {
                (this.el.restoreLayoutBtn as HTMLButtonElement).disabled = true;
            }
            if (this.el.deleteLayoutBtn) {
                (this.el.deleteLayoutBtn as HTMLButtonElement).disabled = true;
            }
            await this.refreshLayoutList();
        } catch (error: any) {
            this.logFn(`Failed to delete layout: ${error.message}`, 'error');
        }
    }

    reset(): void {
        this._layoutSummaries = [];
        this._selectedLayoutId = null;
        if (this.el.layoutList) this.el.layoutList.innerHTML = '';
        if (this.el.restoreLayoutBtn) (this.el.restoreLayoutBtn as HTMLButtonElement).disabled = true;
        if (this.el.deleteLayoutBtn) (this.el.deleteLayoutBtn as HTMLButtonElement).disabled = true;
        if (this.el.saveLayoutBtn) (this.el.saveLayoutBtn as HTMLButtonElement).disabled = true;
    }
}
