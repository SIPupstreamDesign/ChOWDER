import type { LogFn, SendCommandFn } from '../websocket/WebSocketClient';
import type { DisplayUpdateData } from '../types';
import { AdminPendingBadge } from '../../adminPendingBadge';
import { Manipulator } from '../../manipulator';
import { DisplayUpdateQueue, type DisplayUpdateOperation } from './displayUpdateBatch';

interface DisplayInteraction {
    windowId: string;
    target: HTMLElement;
    operation: DisplayUpdateOperation;
    updates: Promise<void>[];
    errors: unknown[];
    detach: () => void;
    settling: boolean;
}

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
    const hasVirtual = params.virtualWidth !== undefined && params.virtualHeight !== undefined;
    const hasPixel = params.pixelWidth !== undefined && params.pixelHeight !== undefined;
    const hasPosition = params.posx !== undefined && params.posy !== undefined;

    return {
        // style.width/height は virtualWidth/virtualHeight をそのまま使う
        width: hasVirtual ? params.virtualWidth! : null,
        height: hasVirtual ? params.virtualHeight! : null,

        pixelWidth: hasPixel ? params.pixelWidth! : null,
        pixelHeight: hasPixel ? params.pixelHeight! : null,

        left: hasPosition ? params.posx! : null,
        top: hasPosition ? params.posy! : null,
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
    setVisiblePendingList: (visible: boolean) => void;
    buildSiteSelect: (selectedSiteId?: string) => HTMLSelectElement;
    renderSiteGrid: (siteId: string | null) => void;
    onDisplaySelected?: (displayId: string | null, windowData: any | null) => void;
    getCurrentSiteId: () => string | null;
    getEditMode: () => number;
    renderAllSiteGrid: () => void;
    getIsAdmin: () => boolean;
    updateQueue: DisplayUpdateQueue;
    isConnected?: () => boolean;
    onEditabilityChanged?: () => void;
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
    private readonly setVisiblePendingList: (visible: boolean) => void;
    private readonly buildSiteSelect: (selectedSiteId?: string) => HTMLSelectElement;
    private readonly renderSiteGridFn: (siteId: string | null) => void;
    private readonly onDisplaySelectedFn?: (displayId: string | null, windowData: any | null) => void;
    private readonly getCurrentSiteIdFn: () => string | null;
    private readonly getEditMode: () => number;
    private readonly renderAllSiteGrid: () => void;
    private readonly getIsAdmin: () => boolean;

    private _allApprovedDisplays: any[] = [];
    private _allWindowMap: Map<string, any> = new Map();
    private _selectedDisplayId: string | null = null;
    private _selectedWindowData: any | null = null;
    private readonly updateQueue: DisplayUpdateQueue;
    private readonly isConnected: () => boolean;
    private readonly onEditabilityChanged: () => void;
    private interaction: DisplayInteraction | null = null;
    private readonly interactions = new Map<string, DisplayInteraction>();
    private readonly needsSync = new Set<string>();
    private refreshTask: Promise<void> | null = null;
    private refreshRequested = false;
    private displayContext = '';
    private generation = 0;
    private interactionRevision = 0;

    constructor(deps: DisplayManagerDeps) {
        this.el = deps.elements;
        this.sendCmd = deps.sendCmd;
        this.logFn = deps.logFn;
        this.adminPendingBadge = deps.adminPendingBadge;
        this.manipulator = deps.manipulator;
        this.getSites = deps.getSites;
        this.getZoom = deps.getZoom;
        this.pushUpdateStock = deps.pushUpdateStock;
        this.setVisiblePendingList = deps.setVisiblePendingList;
        this.buildSiteSelect = deps.buildSiteSelect;
        this.renderSiteGridFn = deps.renderSiteGrid;
        this.onDisplaySelectedFn = deps.onDisplaySelected;
        this.getCurrentSiteIdFn = deps.getCurrentSiteId;
        this.getEditMode = deps.getEditMode;
        this.renderAllSiteGrid = deps.renderAllSiteGrid;
        this.getIsAdmin = deps.getIsAdmin;
        this.updateQueue = deps.updateQueue;
        this.isConnected = deps.isConnected ?? ((): boolean => { return true; });
        this.onEditabilityChanged = deps.onEditabilityChanged ?? ((): void => { });
    }

    get selectedDisplayId(): string | null { return this._selectedDisplayId; }
    get selectedWindowData(): any | null { return this._selectedWindowData; }

    selectDisplay(displayId: string | null, windowData: any | null): void {
        this.checkContext();
        if (displayId !== this._selectedDisplayId) { this.cancelInteraction(); }
        this._selectedDisplayId = displayId;
        this._selectedWindowData = windowData;
        this.syncSelection();
        if (windowData !== null && this.needsSync.has(windowData.id)) { void this.refreshDisplays(); }
    }

    get isInteracting(): boolean { return this.interaction !== null; }

    isWindowEditable(windowId: string): boolean {
        return !this.needsSync.has(windowId) && !this.interactions.has(windowId);
    }

    get isSelectedResizeEnabled(): boolean {
        const windowData = this._selectedWindowData;
        if (windowData === null) { return false; }
        const width = Number(windowData.pixelWidth);
        const height = Number(windowData.pixelHeight);
        const ratio = height / width;
        return Number.isFinite(width) && Number.isFinite(height) && Number.isFinite(ratio) && width > 0 && height > 0 && ratio > 0;
    }

    private checkContext(): void {
        const context = JSON.stringify([this.getCurrentSiteIdFn(), this.getEditMode()]);
        if (context === this.displayContext) { return; }
        this.displayContext = context;
        this.generation++;
        this.cancelInteraction();
        this._selectedDisplayId = null;
        this._selectedWindowData = null;
        this.refreshRequested = true;
    }

    private syncSelection(): void {
        const displayId = this._selectedDisplayId;

        if (this.el.approvedDisplays) {
            (Array.from(this.el.approvedDisplays.children) as HTMLElement[]).forEach((item) => {
                item.classList.toggle('selected', item.dataset.displayId === displayId);
            });
        }

        if (this.el.previewDisplay) {
            (Array.from(this.el.previewDisplay.querySelectorAll('.window-frame')) as HTMLElement[]).forEach((frame) => {
                frame.classList.toggle('selected', frame.dataset.displayId === displayId);
            });
        }

        if (this.el.siteInDisplayList) {
            (Array.from(this.el.siteInDisplayList.children) as HTMLElement[]).forEach((item) => {
                item.classList.toggle('selected', item.dataset.displayId === displayId);
            });
        }

        this.onDisplaySelectedFn?.(displayId, this._selectedWindowData);
        if (this.interaction === null) {
            this.releaseDisplayManipulator();
            const frame = (Array.from(this.el.previewDisplay?.querySelectorAll('.window-frame') ?? []) as HTMLElement[])
                .find((candidate): boolean => { return candidate.dataset.displayId === displayId; });
            const windowData = this._selectedWindowData;
            if (frame !== undefined && windowData !== null && this.getEditMode() === 2 &&
                windowData.siteId === this.getCurrentSiteIdFn() && frame.style.display !== 'none' &&
                typeof windowData.id === 'string' && this.isWindowEditable(windowData.id)) {
                this.prepareDisplayManipulator(frame, windowData.id);
            }
        }
        this.onEditabilityChanged();
    }

    private releaseDisplayManipulator(): void {
        if (this.manipulator?.targetElement?.classList.contains('window-frame') === true) {
            this.manipulator.cancel();
        }
    }

    private prepareDisplayManipulator(frame: HTMLElement, windowId: string): void {
        const width = Number(frame.dataset.pixelWidth);
        const height = Number(frame.dataset.pixelHeight);
        const ratio = height / width;
        if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(ratio) || width <= 0 || height <= 0 || ratio <= 0) { return; }
        this.manipulator?.init((target): void => {
            if (target === null) { return; }
            this.registerInteractionUpdate({
                type: 'display', windowId, posx: Number(target.dataset.worldX), posy: Number(target.dataset.worldY),
                virtualWidth: Number(target.dataset.width),
            });
        });
        this.manipulator?.setAspectRatio(ratio);
        this.manipulator?.setLifecycle({
            onStart: (target): boolean => { return this.beginInteraction(windowId, target); },
            onEnd: (): void => { this.endInteraction(); },
            onCancel: (): void => { this.cancelInteraction(); },
        });
        this.manipulator?.showManipulator(frame, this.el.viewArea, this.getZoom());
    }

    private beginInteraction(windowId: string, target: HTMLElement): boolean {
        if (this.interaction !== null || !this.isWindowEditable(windowId) || !this.isConnected()) { return false; }
        const interaction: DisplayInteraction = {
            windowId, target, operation: { cancelled: false }, updates: [], errors: [], detach: (): void => { }, settling: false,
        };
        this.interaction = interaction;
        this.interactions.set(windowId, interaction);
        this.interactionRevision++;
        this.onEditabilityChanged();
        return true;
    }

    private registerInteractionUpdate(data: DisplayUpdateData): void {
        const interaction = this.interaction;
        if (interaction === null || interaction.operation.cancelled) { return; }
        const update = this.updateQueue.enqueue(data, interaction.operation).catch((error: unknown): void => {
            interaction.errors.push(error);
        });
        interaction.updates.push(update);
    }

    private endInteraction(): void {
        const interaction = this.interaction;
        if (interaction === null) { return; }
        this.interaction = null;
        interaction.detach();
        this.interactionRevision++;
        if (interaction.updates.length === 0) {
            this.interactions.delete(interaction.windowId);
            this.syncSelection();
            if (this.refreshRequested) { void this.refreshDisplays(); }
            return;
        }
        void this.settleInteraction(interaction);
    }

    cancelInteraction(windowId?: string): void {
        for (const interaction of this.interactions.values()) {
            if (windowId !== undefined && interaction.windowId !== windowId) { continue; }
            if (interaction.operation.cancelled) { continue; }
            interaction.operation.cancelled = true;
            this.updateQueue.cancel(interaction.operation);
            interaction.detach();
            if (this.interaction === interaction) { this.interaction = null; }
            this.interactionRevision++;
            this.needsSync.add(interaction.windowId);
            this.releaseDisplayManipulator();
            void this.settleInteraction(interaction);
        }
        this.onEditabilityChanged();
    }

    handleUpdateFailure(windowId: string, error: unknown): void {
        this.needsSync.add(windowId);
        this.logFn(`Display update failed: ${String(error)}`, 'error');
        this.onEditabilityChanged();
        void this.refreshDisplays();
    }

    private async settleInteraction(interaction: DisplayInteraction): Promise<void> {
        if (interaction.settling) { return; }
        interaction.settling = true;
        this.needsSync.add(interaction.windowId);
        this.releaseDisplayManipulator();
        this.onEditabilityChanged();
        this.updateQueue.flush();
        await Promise.all(interaction.updates);
        await this.updateQueue.whenIdle(interaction.windowId);
        this.interactions.delete(interaction.windowId);
        this.interactionRevision++;
        if (interaction.errors.length > 0) {
            this.logFn(`Display update failed; resynchronization required: ${String(interaction.errors[0])}`, 'error');
        }
        await this.refreshDisplays();
    }

    filterApprovedDisplaysByIds(displayIds: string[] | null): void {
        this.checkContext();
        const displays = displayIds === null
            ? this._allApprovedDisplays
            : this._allApprovedDisplays.filter((d) => displayIds.includes(d.displayId));
        this.renderDisplayList(displays, this.el.approvedDisplays, false, this._allWindowMap);
        if (displayIds == null) {
            this.el.siteInDisplayList.innerHTML = "";
        } else {
            this.renderDisplayList2(displays, this.el.siteInDisplayList, this._allWindowMap);
        }
        if (this._selectedDisplayId !== null && displayIds !== null && !displayIds.includes(this._selectedDisplayId)) {
            this.selectDisplay(null, null);
        } else {
            this.syncSelection();
        }
        void this.refreshDisplays();
    }

    async deleteSelectedDisplay(): Promise<void> {
        if (!this._selectedDisplayId) return;
        const display = this._allApprovedDisplays.find((d) => d.displayId === this._selectedDisplayId);
        if (!display) return;
        const label = display.displayName || display.displayId;
        if (confirm(`Delete display "${label}"?`)) {
            this.cancelInteraction(this._selectedWindowData?.id);
            await this.deleteDisplay(display);
            this.selectDisplay(null, null);
        }
    }

    async refreshDisplays(): Promise<void> {
        this.checkContext();
        this.refreshRequested = true;
        if (this.refreshTask !== null) { return this.refreshTask; }
        if (!this.isConnected()) { return; }
        this.refreshTask = this.drainRefreshRequests();
        try { await this.refreshTask; }
        finally { this.refreshTask = null; }
    }

    private async drainRefreshRequests(): Promise<void> {
        while (this.refreshRequested && this.isConnected()) {
            this.refreshRequested = false;
            await this.refreshDisplaySnapshot();
            if (this.interactions.size > 0) { break; }
        }
    }

    private async refreshDisplaySnapshot(): Promise<void> {
        const generation = this.generation;
        const revision = this.interactionRevision;
        const siteId = this.getCurrentSiteIdFn();
        try {
            const isAdmin = this.getIsAdmin();
            const [approvedResult, windowsResult] = await Promise.all([
                this.sendCmd('GetApprovedDisplays', {}),
                this.sendCmd('GetWindowMetaData', { type: 'all' }),
            ]);
            const pendingDisplays: any[] = isAdmin
                ? ((await this.sendCmd('GetPendingDisplays', {})).displays || [])
                : [];
            const siteResult = siteId !== null ? await this.sendCmd('GetDisplaysBySite', { siteId }) : null;
            this.checkContext();
            const windows: any[] = Array.isArray(windowsResult) ? windowsResult : [];
            if (generation === this.generation) {
                for (const interaction of this.interactions.values()) {
                    const current = windows.find((window): boolean => { return window.id === interaction.windowId; });
                    if (current === undefined || current.contentVisible === false || current.siteId !== siteId) {
                        this.cancelInteraction(interaction.windowId);
                    }
                }
            }
            if (generation !== this.generation || revision !== this.interactionRevision || this.interactions.size > 0) {
                this.refreshRequested = true;
                return;
            }

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
            if (siteId) {
                if (siteResult) {
                    const displayIds: string[] = siteResult.displayIds || [];
                    const displays = displayIds === null
                        ? this._allApprovedDisplays
                        : this._allApprovedDisplays.filter((d) => displayIds.includes(d.displayId));
                    this.renderDisplayList2(displays, this.el.siteInDisplayList, this._allWindowMap);
                }
            } else {
                this.renderDisplayList2(this._allApprovedDisplays, this.el.siteInDisplayList, this._allWindowMap);
            }
            this.logFn(`Loaded ${pendingDisplays.length} pending, ${this._allApprovedDisplays.length} approved displays`, 'info');

            this.replaceWindowFrames(windows, this.getEditMode() === 2 ? siteId : null);
            this.needsSync.clear();

            if (this._selectedDisplayId) {
                const stillExists = this._allApprovedDisplays.some((d) => d.displayId === this._selectedDisplayId);
                if (!stillExists) {
                    this.selectDisplay(null, null);
                }
            }
            if (this.getEditMode() == 1) {
                this.renderAllSiteGrid();
            }
            if (this._selectedDisplayId !== null) {
                this._selectedWindowData = windows.find((window): boolean => { return window.displayId === this._selectedDisplayId; }) ?? null;
                if (this._selectedWindowData === null) { this._selectedDisplayId = null; }
            }
            this.syncSelection();

        } catch (error: any) {
            this.logFn(`Failed to refresh displays: ${error.message}`, 'error');
            this.onEditabilityChanged();
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
                if (display.displayId === this._selectedDisplayId) {
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
                posxInput.value = String(totalAdding * 100);
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

                totalAdding += 1;

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

    setVisibleButtonInDisplayList(el: HTMLElement, isVisible: boolean): void {
        el.dataset.isvisible = isVisible ? "true" : "false";
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
            if (display.displayId === this._selectedDisplayId) {
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
                    const targetEl = e.target as HTMLElement;
                    const currentContentVisibleL = targetEl.dataset.isvisible == "true";

                    //暫定処置。ボタンには各種プロパティは保持していないので、画面内Elementから探す
                    let taregetElm2 = null;
                    if (this.el.previewDisplay) {
                        (Array.from(this.el.previewDisplay.querySelectorAll('.window-frame')) as HTMLElement[]).forEach((frame) => {
                            if (frame.dataset.displayId == display.displayId) {
                                taregetElm2 = frame;
                            }
                        });
                    }
                    if (taregetElm2 != null) {
                        this.pushUpdateStock({
                            windowId: display.windowId,
                            type: 'display',
                            contentVisible: !currentContentVisibleL,
                        });
                    }
                    this.setVisibleButtonInDisplayList(targetEl, !currentContentVisibleL);
                    //FixDisplay欄で、displayIdが同じだったら、処理を行う
                    if (this._selectedDisplayId === display.displayId) {
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

    private replaceWindowFrames(windows: any[], siteId: string | null): void {
        if (!this.el.viewArea) { return; }
        this.releaseDisplayManipulator();
        this.el.viewArea.querySelectorAll('.window-frame').forEach((frame: Element): void => { frame.remove(); });
        const addedIds = new Set<string>();
        for (const window of windows) {
            if (window.type !== 'display' || addedIds.has(window.displayId)) { continue; }
            this.createWindowFrame(window, this.getEditMode() === 2 && window.siteId === siteId);
            addedIds.add(window.displayId);
        }
        this.renderSiteGridFn(siteId);
    }

    updateWindowFrameByMetaData(params: any): void {
        const windowId = params.id;
        const existingWindow = this._allWindowMap.get(windowId);
        const updatedWindow = { ...existingWindow, ...params };
        if (windowId) {
            this._allWindowMap.set(windowId, updatedWindow);
        }
        if (this.interactions.has(windowId) && (updatedWindow.contentVisible === false ||
            (updatedWindow.siteId !== undefined && updatedWindow.siteId !== this.getCurrentSiteIdFn()))) {
            this.cancelInteraction(windowId);
        }
        if (this._selectedWindowData?.id === windowId) {
            this._selectedWindowData = updatedWindow;
            this.onDisplaySelectedFn?.(this._selectedDisplayId, updatedWindow);
        }

        if (this.interactions.size > 0) { this.refreshRequested = true; return; }

        if (!this.el.previewDisplay) return;
        const displayId = params.displayId ?? existingWindow?.displayId;
        const frame = this.el.previewDisplay.querySelector(
            `[data-display-id="${displayId}"]`
        ) as HTMLElement | null;
        if (!frame) return;

        const update = calcWindowFrameStyleUpdate(params);

        if (update.width !== null) {
            frame.style.width = `${update.width}px`;
            frame.dataset.width = String(update.width);
            frame.dataset.virtualWidth = String(update.width);
        }
        if (update.height !== null) {
            frame.style.height = `${update.height}px`;
            frame.dataset.height = String(update.height);
            frame.dataset.virtualHeight = String(update.height);
        }

        if (update.pixelWidth !== null) frame.dataset.pixelWidth = `${update.pixelWidth}`;
        if (update.pixelHeight !== null) frame.dataset.pixelHeight = `${update.pixelHeight}`;

        if (update.left !== null && update.top !== null) {
            frame.style.left = `${update.left}px`;
            frame.style.top = `${update.top}px`;
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
            frame.dataset.contentVisible = String(params.contentVisible);
            frame.style.display = params.contentVisible ? 'block' : 'none';
            if (params.contentVisible === false) { this.releaseDisplayManipulator(); }
        }
        this.refreshDisplays();
    }

    createWindowFrame(window: any, forceVisibleSet: boolean): void {
        if (!this.el.viewArea) return;

        const frame = document.createElement('div');
        frame.className = 'window-frame';
        frame.dataset.worldX = `${window.posx}`;
        frame.dataset.worldY = `${window.posy}`;

        frame.dataset.width = `${window.virtualWidth}`;
        frame.dataset.height = `${window.virtualHeight}`;
        frame.dataset.virtualWidth = `${window.virtualWidth}`;
        frame.dataset.virtualHeight = `${window.virtualHeight}`;
        frame.dataset.pixelWidth = `${window.pixelWidth}`;
        frame.dataset.pixelHeight = `${window.pixelHeight}`;

        frame.dataset.displayId = window.displayId;
        frame.dataset.metadataId = window.displayId;
        frame.dataset.contentVisible = String(window.contentVisible);
        frame.style.left = `${window.posx}px`;
        frame.style.top = `${window.posy}px`;
        frame.style.width = `${window.virtualWidth}px`;
        frame.style.height = `${window.virtualHeight}px`;

        if (window.contentVisible) {
            frame.style.display = "block";
        } else {
            frame.style.display = "none";
        }

        frame.addEventListener('mousedown', (event: MouseEvent): void => {
            if (event.button !== 0 || this.getEditMode() !== 2) { return; }
            this.selectDisplay(window.displayId, this._allWindowMap.get(window.id) ?? window);
            if (!this.beginInteraction(window.id, frame)) { return; }
            event.stopPropagation();
            const interaction = this.interaction;
            if (interaction === null) { return; }
            const zoom = this.getZoom();
            const startX = event.clientX;
            const startY = event.clientY;
            const worldX = Number(frame.dataset.worldX);
            const worldY = Number(frame.dataset.worldY);
            let moved = false;
            const setPosition = (posx: number, posy: number): void => {
                if (posx === Number(frame.dataset.worldX) && posy === Number(frame.dataset.worldY)) { return; }
                frame.style.left = `${posx}px`;
                frame.style.top = `${posy}px`;
                frame.dataset.worldX = String(posx);
                frame.dataset.worldY = String(posy);
                this.registerInteractionUpdate({ type: 'display', windowId: window.id, posx, posy });
                this.manipulator?.moveManipulator(frame);
            };
            const onMove = (move: MouseEvent): void => {
                if (move.buttons !== 1) { this.cancelInteraction(); return; }
                const deltaX = move.clientX - startX;
                const deltaY = move.clientY - startY;
                if (!moved && Math.hypot(deltaX, deltaY) < 4) { return; }
                moved = true;
                setPosition(worldX + deltaX / zoom, worldY + deltaY / zoom);
            };
            const onUp = (): void => {
                if (moved && this.el.toggleVdaAttach?.checked === true) {
                    const site = this.getSites().find((candidate): boolean => { return candidate.siteId === this.getCurrentSiteIdFn(); });
                    const space = site?.displaySpace;
                    if (space !== undefined && space.splitX > 0 && space.splitY > 0 && space.virtualWidth > 0 && space.virtualHeight > 0) {
                        const cellWidth = space.virtualWidth / space.splitX;
                        const cellHeight = space.virtualHeight / space.splitY;
                        setPosition(Math.round(Number(frame.dataset.worldX) / cellWidth) * cellWidth,
                            Math.round(Number(frame.dataset.worldY) / cellHeight) * cellHeight);
                    }
                }
                this.endInteraction();
            };
            interaction.detach = (): void => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                frame.classList.remove('content-active');
            };
            frame.classList.add('content-active');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        const label = document.createElement('div');
        label.className = 'window-label';
        label.classList.add('nativeScale');
        label.textContent = window.displayName || window.displayId || window.id;

        const siteColor = this.getSites().find((s: any) => s.siteId === window.siteId)?.color;
        if (siteColor) {
            frame.style.setProperty('--display-frame-color', siteColor);
            frame.style.borderColor = siteColor;
            frame.style.boxShadow = `0 0 10px ${siteColor}80`;
            label.style.backgroundColor = siteColor;
        }

        frame.appendChild(label);

        if (this.getEditMode() == 1 || !forceVisibleSet) {
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
