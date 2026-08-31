import type { LogFn, SendCommandFn } from '../websocket/WebSocketClient';
import type { DisplayUpdateData } from '../types';
import { AdminPendingBadge } from '../../adminPendingBadge';
import manipulator, { Manipulator } from '../../manipulator';

/**
 * UpdateWindowMetaData の params からコントローラ上の window-frame に適用する
 * CSS スタイル値・dataset 値を計算する純粋関数。
 *
 * DOM 操作を含まないので単体テストが可能。
 */
export interface WindowFrameStyleUpdate {
    /** style.left (px) */
    left: number | null;
    /** style.top (px) */
    top: number | null;
    /** style.width (px) — virtualWidth */
    width: number | null;
    /** style.height (px) — virtualHeight */
    height: number | null;
    /** dataset.width / dataset.height (実ピクセル) */
    dataWidth: number | null;
    dataHeight: number | null;
    /** dataset.pixelWidth / dataset.pixelHeight */
    pixelWidth: number | null;
    pixelHeight: number | null;
    /** dataset.worldX / dataset.worldY */
    worldX: number | null;
    worldY: number | null;
}

export function calcWindowFrameStyleUpdate(params: {
    posx?: number;
    posy?: number;
    virtualWidth?: number;
    virtualHeight?: number;
    pixelWidth?: number;
    pixelHeight?: number;
}): WindowFrameStyleUpdate {
    const hasVirtual  = params.virtualWidth  !== undefined && params.virtualHeight  !== undefined;
    const hasPixel    = params.pixelWidth    !== undefined && params.pixelHeight    !== undefined;
    const hasPosition = params.posx          !== undefined && params.posy           !== undefined;

    return {
        // style.width/height は virtualWidth/virtualHeight をそのまま使う
        width:      hasVirtual ? params.virtualWidth!  : null,
        height:     hasVirtual ? params.virtualHeight! : null,

        // dataset.width/height は実ピクセルサイズ
        dataWidth:  hasPixel ? params.pixelWidth!  : null,
        dataHeight: hasPixel ? params.pixelHeight! : null,

        pixelWidth:  hasPixel ? params.pixelWidth!  : null,
        pixelHeight: hasPixel ? params.pixelHeight! : null,

        left:   hasPosition ? params.posx! : null,
        top:    hasPosition ? params.posy! : null,
        worldX: hasPosition ? params.posx! : null,
        worldY: hasPosition ? params.posy! : null,
    };
}

export interface DisplayManagerDeps {
    elements: any;
    sendCmd: SendCommandFn;
    logFn: LogFn;
    adminPendingBadge: AdminPendingBadge | null;
    manipulator: Manipulator | null;
    getSites: () => any[];
    getZoom: () => number;
    pushUpdateStock: (data: DisplayUpdateData) => void;
    getSelectedMetadataId: () => string | null;
    setVisiblePendingList: (visible: boolean) => void;
    buildSiteSelect: (selectedSiteId?: string) => HTMLSelectElement;
    displayWindowFrames: () => Promise<void>;
    renderSiteGrid: (siteId: string | null) => void;
    onDisplaySelected?: (displayId: string | null, windowData: any | null) => void;
    getCurrentSiteId: () => string | null;
    getEditMode: () => number;
    contentCreateUpdateStock: (elem: HTMLElement | null) => void;
    getSelectedDisplayId: ()=>string;
    renderAllSiteGrid: ()=> void;
    getIsAdmin: () => boolean;
}

export class DisplayManager {
    private readonly el: any;
    private readonly sendCmd: SendCommandFn;
    private readonly logFn: LogFn;
    private readonly adminPendingBadge: AdminPendingBadge | null;
    private readonly manipulator: Manipulator | null;

    private readonly getSites: () => any[];
    private readonly getZoom: () => number;
    private readonly pushUpdateStock: (data: DisplayUpdateData) => void;
    private readonly getSelectedMetadataId: () => string | null;
    private readonly setVisiblePendingList: (visible: boolean) => void;
    private readonly buildSiteSelect: (selectedSiteId?: string) => HTMLSelectElement;
    private readonly displayWindowFramesFn: () => Promise<void>;
    private readonly renderSiteGridFn: (siteId: string | null) => void;
    private readonly onDisplaySelectedFn?: (displayId: string | null, windowData: any | null) => void;
    private readonly getCurrentSiteIdFn: () => string | null;
    private readonly getEditMode: () => number;
    private readonly contentCreateUpdateStock: (elem: HTMLElement | null) => void;
    private readonly getSelectedDisplayId: ()=> string;
    private readonly renderAllSiteGrid:() => void;
    private readonly getIsAdmin: () => boolean;

    private _allApprovedDisplays: any[] = [];
    private _allWindowMap: Map<string, any> = new Map();
    private _selectedDisplayId: string | null = null;
    private _selectedWindowData: any | null = null;

    constructor(deps: DisplayManagerDeps) {
        this.el = deps.elements;
        this.sendCmd = deps.sendCmd;
        this.logFn = deps.logFn;
        this.adminPendingBadge = deps.adminPendingBadge;
        this.manipulator = deps.manipulator;
        this.getSites = deps.getSites;
        this.getZoom = deps.getZoom;
        this.pushUpdateStock = deps.pushUpdateStock;
        this.getSelectedMetadataId = deps.getSelectedMetadataId;
        this.setVisiblePendingList = deps.setVisiblePendingList;
        this.buildSiteSelect = deps.buildSiteSelect;
        this.displayWindowFramesFn = deps.displayWindowFrames;
        this.renderSiteGridFn = deps.renderSiteGrid;
        this.onDisplaySelectedFn = deps.onDisplaySelected;
        this.getCurrentSiteIdFn = deps.getCurrentSiteId;
        this.getEditMode = deps.getEditMode;
        this.contentCreateUpdateStock = deps.contentCreateUpdateStock;
        this.getSelectedDisplayId = deps.getSelectedDisplayId;
        this.renderAllSiteGrid = deps.renderAllSiteGrid;
        this.getIsAdmin = deps.getIsAdmin;
    }

    get selectedDisplayId(): string | null { return this._selectedDisplayId; }
    get selectedWindowData(): any | null { return this._selectedWindowData; }

    selectDisplay(displayId: string | null, windowData: any | null): void {
        this._selectedDisplayId = displayId;
        this._selectedWindowData = windowData;

        if (this.el.approvedDisplays) {
            (Array.from(this.el.approvedDisplays.children) as HTMLElement[]).forEach((item) => {
                item.classList.toggle('selected', item.dataset.displayId === displayId);
            });
        }

        if (this.el.previewDisplay) {
            (Array.from(this.el.previewDisplay.querySelectorAll('.window-frame')) as HTMLElement[]).forEach((frame) => {
                frame.classList.toggle('selected', frame.dataset.displayId === displayId);
                    if(frame.dataset.displayId === displayId){
                        this.manipulator?.showManipulator(frame, this.el.viewArea, this.getZoom());
                    }
            });
        }

        if (this.el.siteInDisplayList) {
            (Array.from(this.el.siteInDisplayList.children) as HTMLElement[]).forEach((item) => {
                item.classList.toggle('selected', item.dataset.displayId === displayId);
            });
        }

        this.onDisplaySelectedFn?.(displayId, windowData);

        if(displayId == null || displayId.length == 0){
            this.manipulator?.removeManipulator();
        }
    }

    filterApprovedDisplaysByIds(displayIds: string[] | null): void {
        const displays = displayIds === null
            ? this._allApprovedDisplays
            : this._allApprovedDisplays.filter((d) => displayIds.includes(d.displayId));
        this.renderDisplayList(displays, this.el.approvedDisplays, false, this._allWindowMap);
        if(displayIds == null){
            this.el.siteInDisplayList.innerHTML = "";
        } else {
            this.renderDisplayList2(displays, this.el.siteInDisplayList, this._allWindowMap);
        }
        //選択を解除
        this.manipulator?.removeManipulator();
    }

    async deleteSelectedDisplay(): Promise<void> {
        if (!this._selectedDisplayId) return;
        const display = this._allApprovedDisplays.find((d) => d.displayId === this._selectedDisplayId);
        if (!display) return;
        const label = display.displayName || display.displayId;
        if (confirm(`Delete display "${label}"?`)) {
            await this.deleteDisplay(display);
            this.selectDisplay(null, null);
        }
    }

    async refreshDisplays(): Promise<void> {
        try {
            const isAdmin = this.getIsAdmin();
            const [approvedResult, windowsResult] = await Promise.all([
                this.sendCmd('GetApprovedDisplays', {}),
                this.sendCmd('GetWindowMetaData', { type: 'all' }),
            ]);
            const pendingDisplays: any[] = isAdmin
                ? ((await this.sendCmd('GetPendingDisplays', {})).displays || [])
                : [];

            const windows: any[] = Array.isArray(windowsResult) ? windowsResult : [];
            const windowMap = new Map<string, any>();
            for (const w of windows) windowMap.set(w.id, w);

            this._allApprovedDisplays = (approvedResult.displays || []).sort((a: any, b: any) => {
                if (!a.approvedAt && !b.approvedAt) return 0;
                if (!a.approvedAt) return 1;
                if (!b.approvedAt) return -1;
                return a.approvedAt < b.approvedAt ? -1 : a.approvedAt > b.approvedAt ? 1 : 0;
            });
            this._allWindowMap = windowMap;

            this.renderDisplayList(pendingDisplays, this.el.pendingDisplays, true, windowMap);
            this.renderDisplayList(this._allApprovedDisplays, this.el.approvedDisplays, false, windowMap);

            //　サイトに所属しているディスプレイの一覧に出すために、サイトIDの保持が必要
            const siteId = this.getCurrentSiteIdFn();
            if (siteId) {
                const result = await this.sendCmd('GetDisplaysBySite', { siteId: siteId });
                if (result) {
                    const displayIds: string[] = result.displayIds || [];
                    const displays = displayIds === null
                    ? this._allApprovedDisplays
                    : this._allApprovedDisplays.filter((d) => displayIds.includes(d.displayId));
                    this.renderDisplayList2(displays, this.el.siteInDisplayList, this._allWindowMap);
                }
            } else {
                this.renderDisplayList2(this._allApprovedDisplays, this.el.siteInDisplayList, this._allWindowMap);
            }
            this.logFn(`Loaded ${pendingDisplays.length} pending, ${this._allApprovedDisplays.length} approved displays`, 'info');

            if(this.getEditMode() == 2){
                await this.displayWindowFrames(siteId);
            } else {
                await this.displayWindowFrames("");
            }

            if (this._selectedDisplayId) {
                const stillExists = this._allApprovedDisplays.some((d) => d.displayId === this._selectedDisplayId);
                if (!stillExists) {
                    this.selectDisplay(null, null);
                }
            }
            if(this.getEditMode() == 1){
                this.renderAllSiteGrid();
            }

        } catch (error: any) {
            this.logFn(`Failed to refresh displays: ${error.message}`, 'error');
        }
    }

    ///admin UI用ディスプレイリスト
    renderDisplayList(
        displays: any[],
        container: HTMLElement,
        isPending: boolean,
        windowMap: Map<string, any> = new Map(),
    ): void {
        if (!container) return;

        let totalAdding = 1;

        if (isPending) {
            this.adminPendingBadge?.setVisible(displays.length > 0);
            if (displays.length === 0) {
                this.setVisiblePendingList(false);
                this.el.waitApprovalWap.style.display = "none";
            } else {
                this.el.waitApprovalWap.style.display = "block";
            }
        }

        if (displays.length === 0) {
            container.innerHTML = '<div class="display-empty">No displays</div>';
            return;
        }

        container.innerHTML = '';
        for (const display of displays) {
            const item = document.createElement('div');
            item.className = 'display-item';
            item.dataset.displayId = display.displayId;
            item.dataset.windowId = display.windowId;

            let oneItem: HTMLElement;
            if (isPending) {
                oneItem = item;
            } else {
                const innerGroup = document.createElement('div');
                innerGroup.addEventListener('click', () => {
                    const wData = display.windowId ? windowMap.get(display.windowId) : null;
                    this.selectDisplay(display.displayId, wData);
                });
                oneItem = innerGroup;
                if (display.displayId === this.getSelectedMetadataId()) {
                    item.classList.add('selected');
                }
                item.appendChild(oneItem);
            }

            const name = document.createElement('div');
            name.className = 'display-name';
            name.textContent = display.displayName || display.displayId;
            oneItem.appendChild(name);

            if (isPending) {
                const id = document.createElement('div');
                id.className = 'display-id-small';
                id.textContent = `ID: ${display.displayId}`;
                oneItem.appendChild(id);
            }

            const size = document.createElement('div');
            size.className = 'display-info';
            size.textContent = `${display.screenWidth}px * ${display.screenHeight}px`;
            oneItem.appendChild(size);

            const time = document.createElement('div');
            time.className = 'display-info';
            time.textContent = `Connected: ${new Date(display.connectedAt).toLocaleString()}`;
            oneItem.appendChild(time);

            if (isPending) {
                const controls = document.createElement('div');
                controls.className = 'display-controls';

                const pxSpan0 = document.createElement('span');
                pxSpan0.textContent = "left";
                controls.appendChild(pxSpan0);

                const posxInput = document.createElement('input');
                posxInput.type = 'number';
                posxInput.placeholder = 'X';
                posxInput.value =  String(totalAdding * 100);
                controls.appendChild(posxInput);
                const pxSpan = document.createElement('span');
                pxSpan.textContent = "px　　top";
                controls.appendChild(pxSpan);

                const posyInput = document.createElement('input');
                posyInput.type = 'number';
                posyInput.placeholder = 'Y';
                posyInput.value = String(totalAdding * 100);
                controls.appendChild(posyInput);

                const pxSpan2 = document.createElement('span');
                pxSpan2.textContent = "px　　";
                controls.appendChild(pxSpan2);


                const siteSelectPending = this.buildSiteSelect();
                const approveBtn = document.createElement('button');
                approveBtn.textContent = 'Approve';
                approveBtn.className = 'approve';
                approveBtn.onclick = () => {
                    const posx = parseInt(posxInput.value || '0');
                    const posy = parseInt(posyInput.value || '0');
                    this.approveDisplay(display, posx, posy, display.screenWidth, display.screenHeight, siteSelectPending.value || 'default');
                };
                controls.appendChild(approveBtn);

                const rejectBtn = document.createElement('button');
                rejectBtn.textContent = 'Reject';
                rejectBtn.className = 'reject';
                rejectBtn.onclick = () => this.rejectDisplay(display);
                controls.appendChild(rejectBtn);
                oneItem.appendChild(controls);

                if (this.getSites().length > 0) {
                    const siteRow = document.createElement('div');
                    siteRow.className = 'display-site-row';
                    const siteLabel = document.createElement('span');
                    siteLabel.style.cssText = 'font-size:11px; color:#b0b0b0; white-space:nowrap;';
                    siteLabel.textContent = 'Site:';
                    siteRow.appendChild(siteLabel);
                    siteRow.appendChild(siteSelectPending);
                    oneItem.appendChild(siteRow);
                }

                totalAdding +=1;

            } else {
                const status = document.createElement('div');
                status.className = 'display-info';
                status.style.fontWeight = '600';
                if (display.isOnline) {
                    status.textContent = '🟢 Online';
                    status.style.color = '#4ade80';
                } else {
                    status.textContent = '🔴 Offline';
                    status.style.color = '#f87171';
                }
                oneItem.appendChild(status);

                const windowData = display.windowId ? windowMap.get(display.windowId) : null;
                const currentSiteId = windowData?.siteId;
                const currentSiteName = this.getSites().find((s) => s.siteId === currentSiteId)?.siteName;

                if (currentSiteName) {
                    const siteBadge = document.createElement('div');
                    siteBadge.className = 'site-badge';
                    siteBadge.textContent = `🏢 ${currentSiteName}`;
                    item.appendChild(siteBadge);
                }

                if (this.getSites().length > 0 && display.windowId) {
                    const siteRow = document.createElement('div');
                    siteRow.className = 'display-site-row';
                    const siteLabel = document.createElement('span');
                    siteLabel.style.cssText = 'font-size:11px; color:#b0b0b0; white-space:nowrap;';
                    siteLabel.textContent = 'Site:';
                    siteRow.appendChild(siteLabel);
                    const siteSelect = this.buildSiteSelect(currentSiteId);
                    siteSelect.onchange = () => this.changeDisplaySite(display.windowId!, siteSelect.value);
                    siteRow.appendChild(siteSelect);
                    item.appendChild(siteRow);
                }

                const controls = document.createElement('div');
                controls.className = 'display-controls';

                if (display.windowId) {
                    const currentContentVisible = windowData?.contentVisible !== false;
                    const toggleBtn = document.createElement('button');
                    toggleBtn.textContent = currentContentVisible ? '🟢On' : '🚫 Off';  // 👁
                    toggleBtn.className = currentContentVisible ? 'secondary' : 'warning';
                    toggleBtn.title = currentContentVisible ? 'クリックでコンテンツ非表示' : 'クリックでコンテンツ表示';
                    toggleBtn.onclick = async () => {
                        // await this.toggleContentVisible(display.windowId!, !currentContentVisible);
                        this.refreshDisplays();
                    };
                    controls.appendChild(toggleBtn);
                }

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.className = 'danger';
                deleteBtn.onclick = () => {
                    const displayLabel = display.displayName || display.displayId;
                    if (confirm(`Delete display "${displayLabel}"?`)) {
                        this.deleteDisplay(display);
                    }
                };
                controls.appendChild(deleteBtn);
                item.appendChild(controls);
            }

            container.appendChild(item);
        }
    }

    setVisibleButtonInDisplayList(el: HTMLElement, isVisible:boolean):void{
        el.dataset.isvisible = isVisible ? "true":"false";
        el.textContent = isVisible ? '🟢On' : '🚫 Off';  // 👁
        el.className = isVisible ? 'warning' : 'secondary';
        el.title = isVisible ? 'クリックでコンテンツ非表示' : 'クリックでコンテンツ表示';
    }

    ///下段UI用ディスプレイリスト
    async renderDisplayList2(
        displays: any[],
        container: HTMLElement,
        windowMap: Map<string, any> = new Map(),
    ): Promise<void> {
        if (!container) return;

        container.innerHTML = '';
        for (const display of displays) {
            const item = document.createElement('div');
            item.className = 'display-item';
            item.dataset.displayId = display.displayId;
            item.dataset.windowId = display.windowId;

            item.addEventListener('click', (e) => {
                const wData = display.windowId ? windowMap.get(display.windowId) : null;
                this.selectDisplay(display.displayId, wData);
            });

            const oneItem = document.createElement('div');
            if (display.displayId === this.getSelectedMetadataId()) {
                item.classList.add('selected');
            }
            item.appendChild(oneItem);

            const name = document.createElement('div');
            name.className = 'display-name';
            name.textContent = display.displayName || display.displayId;
            oneItem.appendChild(name);

            const size = document.createElement('div');
            size.className = 'display-info';
            size.textContent = `${display.screenWidth}Px * ${display.screenHeight}Px`;
            oneItem.appendChild(size);

            const windowData = display.windowId ? windowMap.get(display.windowId) : null;
            const controls = document.createElement('div');
            controls.className = 'display-controls';

            if (display.windowId) {
                const currentContentVisible = windowData?.contentVisible !== false;
                const toggleBtn = document.createElement('button');
                this.setVisibleButtonInDisplayList(toggleBtn, currentContentVisible);
                toggleBtn.onclick = async (e) => {
                    //強制的に選択状態にする?
                    e.stopPropagation();
                    // windmapも取得する必要がある
                    const windowDataL = windowMap.get(display.windowId);
                    const targetEl =  e.target as HTMLElement;
                    const currentContentVisibleL = targetEl.dataset.isvisible == "true";

                    //暫定処置。ボタンには各種プロパティは保持していないので、画面内Elementから探す
                    let taregetElm2 = null;
                    if (this.el.previewDisplay) {
                        (Array.from(this.el.previewDisplay.querySelectorAll('.window-frame')) as HTMLElement[]).forEach((frame) => {
                            if(frame.dataset.displayId == display.displayId){
                                taregetElm2 = frame;
                            }
                        });
                    }
                    if(taregetElm2 != null){
                        const t2 = taregetElm2 as HTMLElement;
                        this.pushUpdateStock({
                            windowId: display.windowId,
                            type: 'display',
                            posx: Number(t2.dataset.worldX),
                            posy: Number(t2.dataset.worldY),
                            width: Number(t2.dataset.width),
                            height: Number(t2.dataset.height),
                            visible:  !currentContentVisibleL,
                            originWidth: Number(t2.dataset.pixelWidth) || Number(t2.dataset.width),
                            originHeight: Number(t2.dataset.pixelHeight) || Number(t2.dataset.height),
                            zindex:1,
                        });
                    }
                    this.setVisibleButtonInDisplayList(targetEl, !currentContentVisibleL);
                    //FixDisplay欄で、displayIdが同じだったら、処理を行う
                    if(this.getSelectedDisplayId() == display.displayId){
                        const toggleVisible = this.el.toggleDisplayVisible;
                        toggleVisible.checked = !currentContentVisibleL;
                        toggleVisible.dataset.checked = String(!currentContentVisibleL);
                    }
                };
                controls.appendChild(toggleBtn);
            }

            item.appendChild(controls);


            container.appendChild(item);
        }
    }

    displayListChangeSelect(selectedMetadataId: string | null): void {
        const childArray: HTMLElement[] = Array.from(this.el.approvedDisplays.children);
        childArray.forEach((child: HTMLElement) => {
            if (child.dataset.displayId === selectedMetadataId) {
                child.classList.add('selected');
            } else {
                child.classList.remove('selected');
            }
        });
    }

    async approveDisplay(
        display: any,
        posx: number,
        posy: number,
        virtualWidth: number,
        virtualHeight: number,
        siteId?: string,
    ): Promise<void> {
        try {
            await this.sendCmd('ApproveDisplay', { displayId: display.displayId, posx, posy, virtualWidth, virtualHeight, siteId });
            const displayLabel = display.displayName || display.displayId;
            this.logFn(`Display "${displayLabel}" approved at (${posx}, ${posy})`, 'success');
        } catch (error: any) {
            this.logFn(`Failed to approve display: ${error.message}`, 'error');
        }
    }

    async deleteDisplay(display: any): Promise<void> {
        try {
            await this.sendCmd('DeleteDisplay', { displayId: display.displayId });
            this.logFn(`Display "${display.displayName || display.displayId}" deleted`, 'success');
            this.refreshDisplays();
        } catch (error: any) {
            this.logFn(`Failed to delete display: ${error.message}`, 'error');
        }
    }

    async rejectDisplay(display: any): Promise<void> {
        try {
            await this.sendCmd('RejectDisplay', { displayId: display.displayId });
            this.logFn(`Display "${display.displayName || display.displayId}" rejected`, 'success');
            this.refreshDisplays();
        } catch (error: any) {
            this.logFn(`Failed to reject display: ${error.message}`, 'error');
        }
    }

    async displayWindowFrames(siteId: string | null): Promise<void> {
        if (!this.el.viewArea) return;
        try {
            const existingFrames = this.el.viewArea.querySelectorAll('.window-frame');
            existingFrames.forEach((frame: Element) => frame.remove());

            const windows = await this.sendCmd('GetWindowMetaData', { type: 'all' });
            const windowsArray = Array.isArray(windows) ? windows : [];

            const addedIds: string[] = [];
            for (const window of windowsArray) {
                if (window.type === 'display') {
                    let find = false;
                    addedIds.forEach((id) => { if (window.displayId === id) find = true; });
                    if (!find) this.createWindowFrame(window, window.siteId == siteId);
                    addedIds.push(window.displayId);
                }
            }

            this.renderSiteGridFn(siteId);
        } catch (error: any) {
            console.error('Failed to display window frames:', error);
        }
    }

    updateWindowFrameByMetaData(params: any): void {
        if (!this.el.previewDisplay) return;
        const frame = this.el.previewDisplay.querySelector(
            `[data-display-id="${params.displayId}"]`
        ) as HTMLElement | null;
        if (!frame) return;

        const update = calcWindowFrameStyleUpdate(params);

        if (update.width  !== null) frame.style.width  = `${update.width}px`;
        if (update.height !== null) frame.style.height = `${update.height}px`;

        if (update.dataWidth  !== null) frame.dataset.width  = `${update.dataWidth}`;
        if (update.dataHeight !== null) frame.dataset.height = `${update.dataHeight}`;

        if (update.pixelWidth  !== null) frame.dataset.pixelWidth  = `${update.pixelWidth}`;
        if (update.pixelHeight !== null) frame.dataset.pixelHeight = `${update.pixelHeight}`;

        if (update.left !== null && update.top !== null) {
            frame.style.left     = `${update.left}px`;
            frame.style.top      = `${update.top}px`;
            frame.dataset.worldX = `${update.worldX}`;
            frame.dataset.worldY = `${update.worldY}`;
        }

        if (this.manipulator?.targetElement === frame) {
            const pw = Number(frame.dataset.pixelWidth);
            const ph = Number(frame.dataset.pixelHeight);
            const ratio = (pw > 0 && ph > 0) ? ph / pw : null;
            this.manipulator.setAspectRatio(ratio);
            this.manipulator.moveManipulator(frame);
        }

        if (params.contentVisible !== undefined) {
            frame.style.display = params.contentVisible ? 'block' : 'none';
        }
        this.refreshDisplays();
    }

    createWindowFrame(window: any, forceVisibleSet: boolean): void {
        if (!this.el.viewArea) return;

        const frame = document.createElement('div');
        frame.className = 'window-frame';
        frame.dataset.worldX = `${window.posx}`;
        frame.dataset.worldY = `${window.posy}`;

        frame.dataset.width = `${window.pixelWidth}`;
        frame.dataset.height = `${window.pixelHeight}`;
        frame.dataset.pixelWidth = `${window.pixelWidth}`;
        frame.dataset.pixelHeight = `${window.pixelHeight}`;

        frame.dataset.displayId = window.displayId;
        frame.dataset.metadataId = window.displayId;
        frame.style.left = `${window.posx}px`;
        frame.style.top = `${window.posy}px`;
        frame.style.width = `${window.virtualWidth}px`;
        frame.style.height = `${window.virtualHeight}px`;

        if(window.contentVisible){
            frame.style.display = "block";
        } else {
            frame.style.display = "none";
        }

        frame.addEventListener('mousedown', (e) => {
            if (e.buttons !== 1) return;
            if(this.getEditMode() != 2){return;}
            this.selectDisplay(window.displayId, window);

            const zoom = this.getZoom();
            let startX = e.clientX;
            let startY = e.clientY;
            let hasMoved = false;

            const metadataId = (e.currentTarget as HTMLElement | null)?.dataset.displayId;

            const displayCreateUpdateStock = (elem: HTMLElement | null): void => {
                if (!elem) return;

                //マニピュレーターで変更した値を、元ウィンドウのアス比に合わせる
                const basepar = window.pixelHeight /  window.pixelWidth;
                const newWH = { width : Math.round(Number(elem.dataset.width)), height: Math.round(Number(elem.dataset.width) * basepar) };
                elem.dataset.width = String(newWH.width);
                elem.dataset.height = String(newWH.height);
                elem.style.width = `${newWH.width}px`;
                elem.style.height = `${newWH.height}px`;

                this.pushUpdateStock({
                    windowId: window.id,
                    type: 'display',
                    posx: Number(elem.dataset.worldX),
                    posy: Number(elem.dataset.worldY),
                    width: Number(elem.dataset.width),
                    height: Number(elem.dataset.height),
                    visible: true,
                    originWidth: Number(elem.dataset.pixelWidth) || Number(elem.dataset.width),
                    originHeight: Number(elem.dataset.pixelHeight) || Number(elem.dataset.height),
                    zindex:1
                });
            };

            const contentItemsDom = [...this.el.previewDisplay.children];
            contentItemsDom.forEach((contentDom) => {
                if (contentDom.dataset.displayId === metadataId) {
                    contentDom.classList.add('display-active');
                    const pw = Number(contentDom.dataset.pixelWidth);
                    const ph = Number(contentDom.dataset.pixelHeight);
                    const ratio = (pw > 0 && ph > 0) ? ph / pw : null;
                    this.manipulator?.init(displayCreateUpdateStock);
                    this.manipulator?.setAspectRatio(ratio);
                    this.manipulator?.showManipulator(contentDom, this.el.viewArea, this.getZoom());
                }
                else {
                    contentDom.classList.remove('display-active');
                }
            });

            const onMouseMove = (e2: MouseEvent) => {
                hasMoved = true;
                const dx = (e2.clientX - startX) / zoom;
                const dy = (e2.clientY - startY) / zoom;
                const x2 = Number(frame.dataset.worldX) + dx;
                const y2 = Number(frame.dataset.worldY) + dy;
                frame.style.left = `${x2}px`;
                frame.style.top = `${y2}px`;
                frame.dataset.worldX = `${x2}`;
                frame.dataset.worldY = `${y2}`;
                startX = e2.clientX;
                startY = e2.clientY;
                this.pushUpdateStock({
                    windowId: window.id,
                    type: 'display',
                    posx: x2,
                    posy: y2,
                    width: Number(frame.dataset.width),
                    height: Number(frame.dataset.height),
                    visible: true,
                    originWidth: Number(frame.dataset.pixelWidth) || Number(frame.dataset.width),
                    originHeight: Number(frame.dataset.pixelHeight) || Number(frame.dataset.height),
                    zindex:1,
                });
                this.manipulator?.init(displayCreateUpdateStock);
                const pw2 = Number(frame.dataset.pixelWidth);
                const ph2 = Number(frame.dataset.pixelHeight);
                this.manipulator?.setAspectRatio((pw2 > 0 && ph2 > 0) ? ph2 / pw2 : null);
                this.manipulator?.showManipulator(frame, this.el.viewArea, this.getZoom());
            };

            frame.classList.add('content-active');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', () => {
                document.removeEventListener('mousemove', onMouseMove);
                frame.classList.remove('content-active');
                if (!hasMoved) {
                    this.selectDisplay(window.displayId, window);
                } else {
                    const toggleAttach = this.el.toggleVdaAttach as HTMLInputElement | null;
                    if (toggleAttach?.checked) {
                        const siteId = this.getCurrentSiteIdFn();
                        const site = this.getSites().find((s: any) => s.siteId === siteId);
                        const ds = site?.displaySpace;
                        if (ds && ds.splitX > 0 && ds.splitY > 0) {
                            const cellW = ds.virtualWidth / ds.splitX;
                            const cellH = ds.virtualHeight / ds.splitY;
                            const snapX = Math.round(Number(frame.dataset.worldX) / cellW) * cellW;
                            const snapY = Math.round(Number(frame.dataset.worldY) / cellH) * cellH;
                            frame.style.left = `${snapX}px`;
                            frame.style.top = `${snapY}px`;
                            frame.dataset.worldX = `${snapX}`;
                            frame.dataset.worldY = `${snapY}`;
                            this.pushUpdateStock({
                                windowId: window.id,
                                type: 'display',
                                posx: snapX,
                                posy: snapY,
                                width: Number(frame.dataset.width),
                                height: Number(frame.dataset.height),
                                visible: true,
                                originWidth: Number(frame.dataset.pixelWidth) || Number(frame.dataset.width),
                                originHeight: Number(frame.dataset.pixelHeight) || Number(frame.dataset.height),
                                zindex:1,
                            });

                            this.manipulator?.showManipulator(frame, this.el.viewArea, this.getZoom());
                        }
                    }
                }
            }, { once: true });
        });

        const label = document.createElement('div');
        label.className = 'window-label';
        label.classList.add('nativeScale');
        label.textContent = window.displayName || window.displayId || window.id;

        const siteColor = this.getSites().find((s: any) => s.siteId === window.siteId)?.color;
        if (siteColor) {
            frame.style.borderColor = siteColor;
            frame.style.boxShadow = `0 0 10px ${siteColor}80`;
            label.style.backgroundColor = siteColor;
        }

        frame.appendChild(label);

        if(this.getEditMode() == 1 || !forceVisibleSet){
            frame.style.display = "none";
        }

        this.el.previewDisplay.appendChild(frame);
    }

    async changeDisplaySite(windowId: string, siteId: string): Promise<void> {
        try {
            await this.sendCmd('UpdateWindowMetaData', {
                id: windowId,
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                siteId: siteId || 'default',
            });
            this.logFn('✅ Display site updated', 'success');
            await this.refreshDisplays();
        } catch (error: any) {
            this.logFn(`Failed to change site: ${error.message}`, 'error');
        }
    }

    clearApprovedDisplays(): void {
        if (this.el.pendingDisplays) this.el.pendingDisplays.innerHTML = '';
        if (this.el.approvedDisplays) this.el.approvedDisplays.innerHTML = '';
        this.adminPendingBadge?.setVisible(false);
        this.el.waitApprovalWap.style.display = "none";
    }
}
