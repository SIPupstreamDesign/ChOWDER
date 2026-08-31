import type { LogFn, SendCommandFn } from '../websocket/WebSocketClient';

export interface SiteManagerDeps {
    elements: any;
    sendCmd: SendCommandFn;
    logFn: LogFn;
    renderSiteGrid: (siteId: string | null) => void;
    onSiteSelected?: (siteId: string | null, displayIds: string[]) => void;
    onDisplaySelect?: () =>void;
}

export class SiteManager {
    private _sites: any[] = [];
    private _currentSiteId: string | null = null;

    private readonly el: any;
    private readonly sendCmd: SendCommandFn;
    private readonly logFn: LogFn;
    private readonly renderSiteGridFn: (siteId: string | null) => void;
    private readonly onSiteSelectedFn?: (siteId: string | null, displayIds: string[]) => void;
    private readonly onDisplaySelectFn?: () => void;

    constructor(deps: SiteManagerDeps) {
        this.el = deps.elements;
        this.sendCmd = deps.sendCmd;
        this.logFn = deps.logFn;
        this.renderSiteGridFn = deps.renderSiteGrid;
        this.onSiteSelectedFn = deps.onSiteSelected;
        this.onDisplaySelectFn = deps.onDisplaySelect;
    }

    get sites(): any[] { return this._sites; }
    get currentSiteId(): string | null { return this._currentSiteId; }

    async refreshSites(): Promise<void> {
        try {
            const result = await this.sendCmd('GetSiteList', {});
            this._sites = result.sites || [];
            this.renderSiteList();
            this.renderSiteListD();
            this.renderSiteGridFn(this._currentSiteId);
        } catch (error: any) {
            this.logFn(`Failed to load sites: ${error.message}`, 'error');
        }
    }

    renderSiteListD(): void {
        const container = this.el.siteListD;
        if (!container) return;

        container.innerHTML = '';
        if (this._sites.length === 0) {
            container.innerHTML = '<div class="display-empty">No sites</div>';
            return;
        }

        for (const site of this._sites) {
            const item = document.createElement('div');
            item.className = 'site-item';
            item.dataset.siteId = site.siteId;
            if (site.siteId === this._currentSiteId) {
                item.classList.add('selected');
            }

            if (site.color) {
                const dot = document.createElement('span');
                dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${site.color};flex-shrink:0;`;
                item.appendChild(dot);
            }

            const nameSpan = document.createElement('span');
            nameSpan.className = 'site-name';
            nameSpan.textContent = site.siteName;
            item.appendChild(nameSpan);

            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {this.filterSites(site.siteId) ; this.onDisplaySelectFn?.();});
            container.appendChild(item);
        }
    }

    renderSiteList(): void {
        const container = this.el.siteList;
        if (!container) return;

        container.innerHTML = '';
        if (this._sites.length === 0) {
            container.innerHTML = '<div class="display-empty">No sites</div>';
            return;
        }

        for (const site of this._sites) {
            const item = document.createElement('div');
            item.className = 'site-item';
            item.dataset.siteName = site.siteName;
            item.dataset.siteId = site.siteId;

            const nameDiv = document.createElement('div');
            nameDiv.className = 'site-name';
            nameDiv.textContent = site.siteName;
            item.appendChild(nameDiv);

            if (site.isDefault) {
                const badge = document.createElement('span');
                badge.className = 'site-default-badge';
                badge.textContent = 'default';
                item.appendChild(badge);
            } else {
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.className = 'danger';
                deleteBtn.style.cssText = 'width:auto; padding:3px 10px; font-size:11px; margin-top:0; flex-shrink:0;';
                deleteBtn.onclick = () => {
                    if (confirm(`Site "${site.siteName}" を削除しますか？`)) {
                        this.deleteSite(site.siteId);
                    }
                };
                item.appendChild(deleteBtn);
            }

            item.addEventListener('click', () => this.filterSites(site.siteId));
            container.appendChild(item);
        }
    }

    renderSiteGrid(siteId: string | null): void {
        const svg = this.el.siteGridOverlay;
        if (!svg) return;

        if (!siteId) {
            svg.style.display = 'none';
            return;
        }

        const site = this._sites.find((s: any) => s.siteId === siteId);
        if (!site?.displaySpace) {
            svg.style.display = 'none';
            return;
        }

        const { virtualWidth, virtualHeight, splitX, splitY } = site.displaySpace;
        svg.setAttribute('width', String(virtualWidth));
        svg.setAttribute('height', String(virtualHeight));

        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const ns = 'http://www.w3.org/2000/svg';
        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('x', '0');
        rect.setAttribute('y', '0');
        rect.setAttribute('width', String(virtualWidth));
        rect.setAttribute('height', String(virtualHeight));
        rect.setAttribute('fill', '#ffffff18');
        rect.setAttribute('stroke', '#ffffff');
        rect.setAttribute('stroke-width', '2');
        svg.appendChild(rect);

        for (let i = 1; i < splitX; i++) {
            const x = Math.round(virtualWidth * i / splitX);
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', String(x));
            line.setAttribute('y1', '0');
            line.setAttribute('x2', String(x));
            line.setAttribute('y2', String(virtualHeight));
            line.setAttribute('stroke', '#ffffff');
            line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
        }

        for (let j = 1; j < splitY; j++) {
            const y = Math.round(virtualHeight * j / splitY);
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', '0');
            line.setAttribute('y1', String(y));
            line.setAttribute('x2', String(virtualWidth));
            line.setAttribute('y2', String(y));
            line.setAttribute('stroke', '#ffffff');
            line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
        }

        svg.style.display = 'block';
    }

    selectDefaultsite(): void {
       for (const site of this._sites) {
            if (site.isDefault) {
                this._currentSiteId = site.siteId;
                break;
            }
        }
    }

    async filterSites(siteId: string | null = null): Promise<void> {
        this._currentSiteId = siteId;
        this.renderSiteGridFn(this._currentSiteId);

        const contentItemsDom = [...(this.el.siteList?.children ?? [])];
        contentItemsDom.forEach((contentDom: any) => {
            contentDom.classList.toggle('selected', contentDom.dataset.siteId === siteId);
        });

        this.el.siteNameListHeader.innerText = "";
        const siteListDItems = [...(this.el.siteListD?.children ?? [])];
        siteListDItems.forEach((item: any) => {
            item.classList.toggle('selected', item.dataset.siteId === siteId);
            if(item.dataset.siteId === siteId){
                const siteItemElements = [...(item.children ?? [])];
                siteItemElements.forEach((item2: any) => {
                    if(item2.classList.contains('site-name')){
                        this.el.siteNameListHeader.innerText = item2.innerText;
                    }
                });
            }
        });

        const result = await this.sendCmd('GetDisplaysBySite', { siteId: siteId });
        if (result) {
            const displayIds: string[] = result.displayIds || [];
            const viewAreaChildren = [...this.el.previewDisplay.children];
            viewAreaChildren.forEach((contentDom: any) => {
                if (contentDom.classList.contains('window-frame')) {
                    const find = displayIds.some((id) => contentDom.dataset.displayId === id);
                    contentDom.style.display = find ? 'block' : 'none';
                }
            });
            this.onSiteSelectedFn?.(this._currentSiteId, displayIds);
        }
    }

    async createSite(): Promise<void> {
        const name = (this.el.newSiteName as HTMLInputElement)?.value?.trim();
        if (!name) {
            this.logFn('Please enter a site name', 'error');
            return;
        }
        const color = (this.el.newSiteColor as HTMLInputElement)?.value || undefined;
        try {
            const result = await this.sendCmd('CreateSite', { siteName: name, color });
            this.logFn(`✅ Site "${result.siteName}" created`, 'success');
            (this.el.newSiteName as HTMLInputElement).value = '';
            await this.refreshSites();
        } catch (error: any) {
            this.logFn(`Failed to create site: ${error.message}`, 'error');
        }
    }

    async deleteSite(siteId: string): Promise<void> {
        try {
            await this.sendCmd('DeleteSite', { siteId });
            this.logFn('Site deleted', 'success');
            await this.refreshSites();
        } catch (error: any) {
            this.logFn(`Failed to delete site: ${error.message}`, 'error');
        }
    }

    buildSiteSelect(selectedSiteId?: string): HTMLSelectElement {
        const select = document.createElement('select');
        select.style.marginTop = '0';

        for (const site of this._sites) {
            const opt = document.createElement('option');
            opt.value = site.siteId;
            opt.textContent = site.siteName + (site.isDefault ? ' (default)' : '');
            if (site.siteId === (selectedSiteId || 'default')) opt.selected = true;
            select.appendChild(opt);
        }

        return select;
    }

    clearSites(): void {
        this._sites = [];
        this._currentSiteId = null;
        if (this.el.siteList) this.el.siteList.innerHTML = '';
        if (this.el.siteListD) this.el.siteListD.innerHTML = '';
    }
}
