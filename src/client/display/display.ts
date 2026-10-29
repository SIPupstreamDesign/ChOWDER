
interface PendingCameraUpdate {
    params: any;
}

interface StreamProducerNotification {
    producerId: string;
    userId: string;
    kind: 'audio' | 'video';
    metadataId?: string;
    streamId?: string;
    socketId?: string;
}

const MAX_PENDING_STREAM_PRODUCERS = 128;
/**
 * ChOWDER Display Client
 * ディスプレイクライアント - VirtualDisplayの一部を表示
 */

import './display.css';
import { parseMetaBinary } from '../metaBinaryClient';
import { initI18n, applyI18n } from '../i18n';
import { LiveStreamManager, type MediasoupCallbacks } from '../liveStreamManager';
import {
    isContentInWindow as isContentInWindowFn,
    virtualToWindowCoordinates as virtualToWindowCoordinatesFn,
    type WindowMetaData,
    type ContentMetadata,
} from './contentCoordinates';
import { IFrameConnector } from '../common/IFrameConnector';
import { cameraMirrorUpdates } from '../common/cameraMirrorUpdates';
import { ContentRenderer } from './ContentRenderer';
import { ConnectionScreen } from './ConnectionScreen';
import {
    buildDisplayZIndexMapByOrder,
    compareContentMetadataForDisplayOrder,
    normalizeContentZIndex,
} from '../../common/contentOrder';
import { DisplayCursorOverlay } from './displayCursorOverlay';
import { shouldReloadRegularContentByPolicy } from './updateContentReloadPolicy';
import { ensureLiveStreamElement } from './liveStreamElement';

interface VirtualDisplay {
    virtualWidth: number;
    virtualHeight: number;
    splitX: number;
    splitY: number;
    scale: number;
}

interface JSONRPCMessage {
    jsonrpc: '2.0';
    id: string;
    method: string;
    params: any;
    to?: string;
}

interface JSONRPCResponse {
    jsonrpc: '2.0';
    id: string;
    result?: any;
    error?: any;
}

class DisplayClient {
    private ws: WebSocket | null = null;
    private isRegistered = false;
    private isRejected = false;
    private displayId: string = '';
    private displayName: string = '';
    private windowMetaData: WindowMetaData | null = null;
    private diagnosticSessionId: string | null = null;
    private readonly diagnosticInstanceId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    private diagnosticSequence = 0;
    private diagnosticStartedAt = performance.now();
    private lastLayoutDiagnosticAt = Number.NEGATIVE_INFINITY;
    private scrollDiagnosticsInitialized = false;
    private scrollDiagnosticTimer: number | null = null;
    private lastScrollDiagnosticAt = Number.NEGATIVE_INFINITY;
    private lastPointerMoveAt = Number.NEGATIVE_INFINITY;
    private recentScrollInteractions: Array<Record<string, unknown>> = [];
    private virtualDisplay: VirtualDisplay | null = null;
    private contents: Map<string, ContentMetadata> = new Map();
    private displayArea: HTMLElement;
    private contentArea: HTMLElement;
    private pendingCommands: Array<{ method: string; params: any; resolve: (value: any) => void; reject: (reason: any) => void }> = [];
    private pendingStreamProducers: Map<string, StreamProducerNotification> = new Map();
    private streamAttachmentPromises: Map<string, Promise<void>> = new Map();
    private messageId = 0;
    private callbacks: Map<string, (error: any, result?: any) => void> = new Map();
    private liveStreamManager: LiveStreamManager | null = null;

    private wsMessagePool: any[] = [];
    private pendingCameraUpdates: Map<string, PendingCameraUpdate> = new Map();
    private cameraFlushScheduled = false;

    private fps: number = 10;
    private lastTime: number = 0;
    private interval: number = 1000 / this.fps;

    private readonly renderer: ContentRenderer;
    private readonly connectionScreen: ConnectionScreen;
    private readonly cursorOverlay: DisplayCursorOverlay;

    constructor() {
        this.displayArea = document.getElementById('display-area')!;
        this.contentArea = document.getElementById('content-area')!;

        this.renderer = new ContentRenderer(
            (method, params) => this.sendCommand(method, params),
            () => this.windowMetaData,
            (metadataId, interaction) => this.recordIFrameInteraction(metadataId, interaction),
            () => this.diagnosticSessionId,
        );

        const cursorArea = document.getElementById('display-cursor-area');
        if (!cursorArea) {
            throw new Error('[Display] display-cursor-area not found');
        }
        this.cursorOverlay = new DisplayCursorOverlay({
            overlayElement: cursorArea,
            getWindowMetaData: () => this.windowMetaData,
        });

        this.connectionScreen = new ConnectionScreen({
            onConnect: (displayName, displayId) => {
                this.displayName = displayName;
                this.displayId = displayId;
                this.connectionScreen.hideConnectionScreen();
                this.connectionScreen.showLoading(true);
                this.init().catch(console.error);
            },
            onChangeDisplayName: (displayName) => {
                this.displayName = displayName;
                this.changeDisplayName();
            },
        });
        this.connectionScreen.connectIfUrlParam();

        this.initDebugKeys();
        this.initWindowResizeHandler();

        const statusBar = document.getElementById("status-bar");
        //FullScreenBUtton
        const topBtn = document.getElementById('fullscr-btn');

        // 2. マウスが動くたびに処理を実行
        document.addEventListener('mousemove', (event) => {
            const windowHeight = window.innerHeight;
            const threshold = windowHeight * 0.1;
            // マウスの現在のY座標（event.clientY）が境界線より上にあるか判定
            if (event.clientY <= threshold) {
                // 上端10%以内にいる場合：フルスクリーンボタン表示
                topBtn?.classList.add('is-visible');
            } else {
                // 上端10%外の場合：フルスクリーンボタン非表示
                topBtn?.classList.remove('is-visible');
            }
            // マウスの現在のY座標が境界線より下にあるか判定
            if (event.clientY >= windowHeight - threshold) {
                // 下端10%以内にいる場合：ステータスバー表示
                statusBar?.classList.add('is-visible');
            } else {
                // 下端10%外の場合：ステータスバー非表示
                statusBar?.classList.remove('is-visible');
            }
        });
        topBtn?.addEventListener('click', (event) => {
            if (!statusBar) return;
            if (!document.fullscreenElement) {
                statusBar.style.display = "none";
                // ----------------------------------------
                // フルスクリーンではない場合：フルスクリーン化する
                // ----------------------------------------
                // 画面全体（documentElement）をフルスクリーンにする
                document.documentElement.requestFullscreen()
                    .then(() => {
                        // 成功したらテキストを変更
                        topBtn.textContent = 'exitFullScreen';
                    })
                    .catch((err) => {
                        console.error(`フルスクリーン化に失敗しました: ${err.message}`);
                    });

            } else {
                statusBar.style.display = "block";
                // ----------------------------------------
                // フルスクリーン状態の場合：解除する
                // ----------------------------------------
                document.exitFullscreen()
                    .then(() => {
                        // 成功したらテキストを元に戻す
                        topBtn.textContent = 'toFullScreen';
                    })
                    .catch((err) => {
                        console.error(`解除に失敗しました: ${err.message}`);
                    });
            }
        });
    }

    // ----------------------------------------------------------------
    // 初期化
    // ----------------------------------------------------------------

    async init(): Promise<void> {
        await this.connect();
        requestAnimationFrame(() => this.frameUpdate());
    }

    async frameUpdate(): Promise<void> {
        requestAnimationFrame(() => this.frameUpdate());
        const currentTime: number = Date.now();
        const deltaTime = currentTime - this.lastTime;

        if (deltaTime >= this.interval) {
            this.lastTime = currentTime - (deltaTime % this.interval);

            const updatedIds: string[] = [];
            for (let i = this.wsMessagePool.length - 1; i >= 0; i--) {
                let find = false;
                try {
                    const message = JSON.parse(this.wsMessagePool[i].data);
                    if (message.metadataId !== undefined && message.metadataId !== null) {
                        for (let m = updatedIds.length - 1; m >= 0; m--) {
                            if (message.metadataId === updatedIds[m]) {
                                find = true;
                                break;
                            }
                        }
                    }
                    if (!find) {
                        this.handleMessage2(message);
                        if (message.metadataId !== undefined && message.metadataId !== null) {
                            updatedIds.push(message.metadataId);
                        }
                    }
                } catch (e) {
                    console.error('[Display] Failed to parse JSON message:', e);
                }
            }
            this.wsMessagePool = [];
        }
    }

    // ----------------------------------------------------------------
    // WebSocket 接続
    // ----------------------------------------------------------------

    private async connect(): Promise<void> {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('[Display] WebSocket connected');
            this.updateStatus('Connected', true);
            this.registerDisplay();
        };

        this.ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                let message: JSONRPCMessage;
                try {
                    message = JSON.parse(event.data);
                } catch (error) {
                    console.error('[Display] Failed to parse JSON message:', error);
                    return;
                }

                if (this.isCameraUpdateMessage(message)) {
                    this.enqueueCameraUpdate(message.params);
                    return;
                }

                this.wsMessagePool.push(event);
            } else if (event.data instanceof Blob) {
                this.handleBinaryMessage(event.data);
            }
        };

        this.ws.onclose = () => {
            console.log(`[Display] WebSocket disconnected at ${new Date().toLocaleTimeString()}`);
            this.updateStatus('Disconnected', false);
            this.isRegistered = false;
            if (this.isRejected) {
                console.log('[Display] Connection was rejected, not reconnecting');
                return;
            }
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (error) => {
            console.error('[Display] WebSocket error:', error);
        };
    }

    // ----------------------------------------------------------------
    // ディスプレイ登録・承認フロー
    // ----------------------------------------------------------------

    private registerDisplay(): void {
        const registerData = {
            displayName: this.displayName,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
        };

        this.sendCommand('RegisterDisplay', registerData)
            .then(async (res) => {
                console.log('[Display] Registered:', res);
                this.isRegistered = true;

                this.displayId = res.session.displayId;
                this.displayName = res.session.displayName;
                await this.loadDiagnosticConfig();

                if (res.session.status === 'approved') {
                    console.log('[Display] Already approved, fetching window metadata...');
                    this.loadApprovedDisplayWindow(res.session);
                } else {
                    console.log('[Display] Waiting for approval...');
                    this.connectionScreen.showWaitingScreen(this.displayName);
                }
            })
            .catch((err) => {
                console.error('[Display] Registration failed:', err);
            });
    }

    private async loadApprovedDisplayWindow(session: any): Promise<void> {
        try {
            if (!session.windowId) {
                console.error('[Display] No windowId in approved session');
                return;
            }

            const windowData = await this.sendCommand('GetWindowMetaData', {
                id: session.windowId,
                type: 'single'
            });

            if (!windowData) {
                console.error('[Display] Failed to get window metadata');
                return;
            }

            await this.onDisplayApproved({
                windowId: session.windowId,
                posx: windowData.posx,
                posy: windowData.posy,
                virtualWidth: windowData.virtualWidth,
                virtualHeight: windowData.virtualHeight,
                contentVisible: windowData.contentVisible,
                revision: windowData.revision,
            });
        } catch (err) {
            console.error('[Display] Failed to load approved display window:', err);
        }
    }

    private async onDisplayApproved(data: any): Promise<void> {
        console.log('[Display] Display approved:', data);

        this.connectionScreen.hideWaitingScreen();
        this.connectionScreen.showLoading(true);
        this.connectionScreen.onApproved(this.displayName);

        if (data.windowId) {
            const replyId = data.windowId.split('_');
            if (replyId[0] === 'window') {
                this.displayId = replyId[1] + '_' + replyId[2];
            } else {
                this.displayId = data.windowId;
            }
        }

        this.windowMetaData = {
            id: data.windowId || `window_${this.displayId}`,
            posx: data.posx,
            posy: data.posy,
            virtualWidth: data.virtualWidth,
            virtualHeight: data.virtualHeight,
            pixelWidth: this.displayArea.clientWidth,
            pixelHeight: this.displayArea.clientHeight,
            revision: data.revision,
            contentVisible: data.contentVisible !== undefined ? data.contentVisible : true,
        };

        await this.loadVirtualDisplay();
        await this.loadContents();
        await this.fetchActiveProducers();

        this.connectionScreen.showLoading(false);
        this.applyContentVisibility();
        this.updateDebugInfo();

        // 実際のブラウザサイズをサーバーへ同期（承認時のデフォルト値を上書き）
        this.sendCommand('UpdateWindowMetaData', {
            id: this.windowMetaData.id,
            pixelWidth: this.displayArea.clientWidth,
            pixelHeight: this.displayArea.clientHeight,
        }).then((updatedWindow: WindowMetaData) => {
            if (this.windowMetaData !== null) {
                this.windowMetaData.revision = updatedWindow?.revision ?? this.windowMetaData.revision;
                this.reportDisplayLayout('display-initial');
            }
        }).catch((err) => console.warn('[Display] Failed to sync pixel size on approved:', err));
    }

    private async loadDiagnosticConfig(): Promise<void> {
        try {
            const config = await this.sendCommand('GetServerConfig');
            if (config?.clientDiagnostics?.enabled === true && typeof config.clientDiagnostics.sessionId === 'string') {
                this.diagnosticSessionId = config.clientDiagnostics.sessionId;
                this.initializeScrollDiagnostics();
            }
        } catch (error) {
            console.warn('[Display] Failed to load diagnostic config:', error);
        }
    }

    private async loadVirtualDisplay(): Promise<void> {
        try {
            const res = await this.sendCommand('GetDisplaySpace', {});
            this.virtualDisplay = res;
            console.log('[Display] DisplaySpace loaded:', this.virtualDisplay);
            this.updateDebugInfo();
        } catch (err) {
            console.error('[Display] Failed to get DisplaySpace:', err);
            throw err;
        }
    }

    private async loadContents(): Promise<void> {
        try {
            const res = await this.sendCommand('GetMetaData', {});
            const metadataList = (res.metadataList || [])
                .map((metadata: ContentMetadata) => {
                    return this.normalizeMetadataForOrder(metadata);
                })
                .sort(compareContentMetadataForDisplayOrder);
            for (const metadata of metadataList) {
                await this.displayContent(metadata);
            }
            this.reorderContentAreaByMetadataOrder();
        } catch (err) {
            console.error('[Display] Failed to load contents:', err);
        }
    }

    private changeDisplayName(): void {
        this.sendCommand('ChangeDisplayName', {
            displayId: this.displayId,
            displayName: this.displayName,
        })
            .then((res) => console.log('[Display] display name changed:', res))
            .catch((err) => console.error('[Display] Change Display Name failed:', err));
    }

    // ----------------------------------------------------------------
    // 座標計算（contentCoordinates への委譲）
    // ----------------------------------------------------------------

    private isContentInWindow(content: ContentMetadata): boolean {
        return isContentInWindowFn(content, this.windowMetaData);
    }

    private virtualToWindowCoordinates(
        vx: number, vy: number, vw: number, vh: number
    ): { x: number; y: number; w: number; h: number } {
        return virtualToWindowCoordinatesFn(vx, vy, vw, vh, this.windowMetaData);
    }

    private normalizeMetadataForOrder(metadata: ContentMetadata): ContentMetadata {
        return {
            ...metadata,
            zindex: normalizeContentZIndex(metadata.zindex),
        };
    }

    private reorderContentAreaByMetadataOrder(): void {
        const orderedMetadataList = [...this.contents.values()].sort(compareContentMetadataForDisplayOrder);
        const zIndexMap = buildDisplayZIndexMapByOrder(orderedMetadataList);
        let requiresUpdate = false;

        for (const metadata of orderedMetadataList) {
            const elem = document.getElementById(`content-${metadata.metadataId}`) as HTMLElement | null;
            if (elem === null || elem.parentElement !== this.contentArea) {
                continue;
            }
            const expectedZIndex = zIndexMap.get(metadata.metadataId);
            if (expectedZIndex === undefined) {
                continue;
            }
            const currentZIndex = normalizeContentZIndex(Number(elem.style.zIndex));
            if (currentZIndex !== expectedZIndex) {
                requiresUpdate = true;
                break;
            }
        }

        if (!requiresUpdate) {
            return;
        }

        for (const metadata of orderedMetadataList) {
            const elem = document.getElementById(`content-${metadata.metadataId}`) as HTMLElement | null;
            if (elem === null || elem.parentElement !== this.contentArea) {
                continue;
            }
            const expectedZIndex = zIndexMap.get(metadata.metadataId);
            if (expectedZIndex === undefined) {
                continue;
            }
            elem.style.zIndex = `${expectedZIndex}`;
        }
    }

    private applyElementLayout(normalizedMetadata: ContentMetadata, elem: HTMLElement): void {
        const coords = this.virtualToWindowCoordinates(
            normalizedMetadata.posx,
            normalizedMetadata.posy,
            normalizedMetadata.width,
            normalizedMetadata.height,
        );
        elem.style.left = `${coords.x}px`;
        elem.style.top = `${coords.y}px`;
        elem.style.width = `${coords.w}px`;
        elem.style.height = `${coords.h}px`;
        const isInDisplay = normalizedMetadata.type !== 'live-stream'
            || this.isContentInWindow(normalizedMetadata);
        elem.style.display = normalizedMetadata.visible !== false && isInDisplay ? 'block' : 'none';
        elem.style.zIndex = `${normalizeContentZIndex(normalizedMetadata.zindex)}`;
    }

    private reportDisplayLayout(
        event: string,
        options: {
            force?: boolean;
            scrollEvent?: Record<string, unknown>;
            recentInteractions?: Array<Record<string, unknown>>;
            diagnosticInteraction?: Record<string, unknown>;
        } = {},
    ): void {
        if (this.diagnosticSessionId === null || this.windowMetaData === null) {
            return;
        }

        const now = performance.now();
        if (options.force !== true && now - this.lastLayoutDiagnosticAt < 100) {
            return;
        }
        this.lastLayoutDiagnosticAt = now;

        const windowMeta = this.windowMetaData;
        const displayRect = this.displayArea.getBoundingClientRect();
        const contentRect = this.contentArea.getBoundingClientRect();
        const contents = [...this.contents.values()].slice(0, 20).map((metadata) => {
            const element = document.getElementById(`content-${metadata.metadataId}`);
            if (element === null) {
                return { metadataId: metadata.metadataId, rendered: false };
            }

            const expectedRect = this.virtualToWindowCoordinates(
                metadata.posx,
                metadata.posy,
                metadata.width,
                metadata.height,
            );
            const actualRect = element.getBoundingClientRect();
            const offsetParent = element.offsetParent;
            return {
                metadataId: metadata.metadataId,
                rendered: true,
                expectedRect,
                appliedStyle: {
                    left: element.style.left,
                    top: element.style.top,
                    width: element.style.width,
                    height: element.style.height,
                    transform: element.style.transform,
                },
                actualRect: {
                    left: actualRect.left - contentRect.left,
                    top: actualRect.top - contentRect.top,
                    width: actualRect.width,
                    height: actualRect.height,
                },
                actualViewportRect: {
                    left: actualRect.left,
                    top: actualRect.top,
                    width: actualRect.width,
                    height: actualRect.height,
                },
                offsetParent: offsetParent instanceof HTMLElement
                    ? this.describeLayoutElement(offsetParent)
                    : null,
            };
        });
        const layoutAncestors: Array<Record<string, unknown>> = [];
        let ancestor: HTMLElement | null = this.contentArea;
        while (ancestor !== null && layoutAncestors.length < 8) {
            layoutAncestors.push(this.describeLayoutElement(ancestor));
            ancestor = ancestor.parentElement;
        }

        this.diagnosticSequence += 1;
        void this.sendCommand('ReportClientDiagnostic', {
            event,
            diagnosticSessionId: this.diagnosticSessionId,
            instanceId: this.diagnosticInstanceId,
            sequence: this.diagnosticSequence,
            clientWallTime: new Date().toISOString(),
            clientElapsedMs: performance.now() - this.diagnosticStartedAt,
            displayId: this.displayId,
            windowId: windowMeta.id,
            clientAppliedRevision: windowMeta.revision ?? null,
            clientWindow: {
                posx: windowMeta.posx,
                posy: windowMeta.posy,
                virtualWidth: windowMeta.virtualWidth,
                virtualHeight: windowMeta.virtualHeight,
                pixelWidth: windowMeta.pixelWidth,
                pixelHeight: windowMeta.pixelHeight,
            },
            viewport: {
                displayArea: {
                    left: displayRect.left,
                    top: displayRect.top,
                    width: this.displayArea.clientWidth,
                    height: this.displayArea.clientHeight,
                },
                contentArea: {
                    left: contentRect.left,
                    top: contentRect.top,
                    width: this.contentArea.clientWidth,
                    height: this.contentArea.clientHeight,
                    scrollLeft: this.contentArea.scrollLeft,
                    scrollTop: this.contentArea.scrollTop,
                    scrollWidth: this.contentArea.scrollWidth,
                    scrollHeight: this.contentArea.scrollHeight,
                    maxScrollLeft: Math.max(0, this.contentArea.scrollWidth - this.contentArea.clientWidth),
                    maxScrollTop: Math.max(0, this.contentArea.scrollHeight - this.contentArea.clientHeight),
                },
                displayAreaScrollLeft: this.displayArea.scrollLeft,
                displayAreaScrollTop: this.displayArea.scrollTop,
                windowScrollX: window.scrollX,
                windowScrollY: window.scrollY,
                documentScrollLeft: document.scrollingElement?.scrollLeft ?? 0,
                documentScrollTop: document.scrollingElement?.scrollTop ?? 0,
                devicePixelRatio: window.devicePixelRatio,
                visualViewportScale: window.visualViewport?.scale ?? null,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                fullscreen: document.fullscreenElement !== null,
            },
            layoutAncestors,
            contents,
            ...(options.scrollEvent ? {
                scrollEvent: options.scrollEvent,
                recentInteractions: options.recentInteractions ?? [],
            } : {}),
            ...(options.diagnosticInteraction ? { diagnosticInteraction: options.diagnosticInteraction } : {}),
        }).catch((error: unknown) => {
            console.warn('[Display] Failed to report diagnostic layout:', error);
        });
    }

    private initializeScrollDiagnostics(): void {
        if (this.scrollDiagnosticsInitialized || this.diagnosticSessionId === null) {
            return;
        }
        this.scrollDiagnosticsInitialized = true;

        const scrollKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
        const recordInteraction = (event: Event): void => {
            if (!(event.target instanceof HTMLElement) || !this.contentArea.contains(event.target)) {
                return;
            }

            const now = performance.now();
            const interaction: Record<string, unknown> = {
                type: event.type,
                clientWallTime: new Date().toISOString(),
                clientElapsedMs: now - this.diagnosticStartedAt,
                isTrusted: event.isTrusted,
                target: this.describeInteractionTarget(event.target),
            };

            if (event instanceof PointerEvent) {
                if (event.type === 'pointermove') {
                    if (event.buttons === 0 || now - this.lastPointerMoveAt < 100) {
                        return;
                    }
                    this.lastPointerMoveAt = now;
                }
                interaction.pointer = {
                    pointerType: event.pointerType,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    button: event.button,
                    buttons: event.buttons,
                };
            } else if (event instanceof WheelEvent) {
                interaction.wheel = {
                    deltaX: event.deltaX,
                    deltaY: event.deltaY,
                    deltaMode: event.deltaMode,
                };
            } else if (event instanceof KeyboardEvent) {
                if (!scrollKeys.has(event.key)) {
                    return;
                }
                interaction.key = event.key;
            }

            this.storeRecentScrollInteraction(interaction);
        };

        for (const eventType of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel', 'focusin', 'focusout', 'keydown']) {
            this.contentArea.addEventListener(eventType, recordInteraction, { capture: true, passive: true });
        }

        let latestScrollEvent: Record<string, unknown> | null = null;
        this.contentArea.addEventListener('scroll', (event: Event): void => {
            const now = performance.now();
            latestScrollEvent = {
                clientWallTime: new Date().toISOString(),
                clientElapsedMs: now - this.diagnosticStartedAt,
                isTrusted: event.isTrusted,
                target: 'contentArea',
                scrollLeft: this.contentArea.scrollLeft,
                scrollTop: this.contentArea.scrollTop,
                scrollWidth: this.contentArea.scrollWidth,
                scrollHeight: this.contentArea.scrollHeight,
                clientWidth: this.contentArea.clientWidth,
                clientHeight: this.contentArea.clientHeight,
                maxScrollLeft: Math.max(0, this.contentArea.scrollWidth - this.contentArea.clientWidth),
                maxScrollTop: Math.max(0, this.contentArea.scrollHeight - this.contentArea.clientHeight),
                activeElement: this.describeInteractionTarget(document.activeElement),
            };

            if (now - this.lastScrollDiagnosticAt >= 100) {
                this.lastScrollDiagnosticAt = now;
                this.reportDisplayLayout('display-scroll', {
                    force: true,
                    scrollEvent: latestScrollEvent,
                    recentInteractions: this.getRecentScrollInteractions(now),
                });
            }

            if (this.scrollDiagnosticTimer !== null) {
                window.clearTimeout(this.scrollDiagnosticTimer);
            }
            this.scrollDiagnosticTimer = window.setTimeout((): void => {
                this.scrollDiagnosticTimer = null;
                this.lastScrollDiagnosticAt = performance.now();
                this.reportDisplayLayout('display-scroll-settled', {
                    force: true,
                    scrollEvent: latestScrollEvent ?? undefined,
                    recentInteractions: this.getRecentScrollInteractions(performance.now()),
                });
            }, 150);
        }, { passive: true });
    }

    private recordIFrameInteraction(metadataId: string, interaction: Record<string, unknown>): void {
        if (this.diagnosticSessionId === null) {
            return;
        }

        const interactionType = typeof interaction.type === 'string' ? interaction.type : null;
        if (interaction.diagnosticSessionId !== this.diagnosticSessionId) {
            this.reportDisplayLayout('itowns-interaction-rejected', {
                force: true,
                diagnosticInteraction: {
                    metadataId,
                    receivedType: interactionType,
                    reason: 'session-mismatch',
                },
            });
            return;
        }
        if (interactionType === null) {
            this.reportDisplayLayout('itowns-interaction-rejected', {
                force: true,
                diagnosticInteraction: { metadataId, reason: 'missing-type' },
            });
            return;
        }
        if (interactionType === 'diagnostic-ready') {
            this.reportDisplayLayout('itowns-diagnostic-ready', {
                force: true,
                diagnosticInteraction: {
                    metadataId,
                    sessionMatched: true,
                    viewType: interaction.viewType === 'display' ? interaction.viewType : null,
                    listenersInitialized: interaction.listenersInitialized === true,
                    frameWallTime: typeof interaction.frameWallTime === 'string' ? interaction.frameWallTime : null,
                    frameElapsedMs: typeof interaction.frameElapsedMs === 'number' ? interaction.frameElapsedMs : null,
                },
            });
            return;
        }
        const supportedTypes = new Set([
            'pointerdown',
            'pointermove',
            'pointerup',
            'pointercancel',
            'wheel',
            'focusin',
            'focusout',
            'keydown',
            'iframe-focus',
            'iframe-blur',
        ]);
        if (!supportedTypes.has(interactionType)) {
            this.reportDisplayLayout('itowns-interaction-rejected', {
                force: true,
                diagnosticInteraction: {
                    metadataId,
                    receivedType: interactionType,
                    reason: 'unsupported-type',
                },
            });
            return;
        }

        this.storeRecentScrollInteraction({
            type: interactionType.startsWith('iframe-') ? interactionType : `iframe-${interactionType}`,
            source: 'itowns-iframe',
            metadataId,
            clientWallTime: new Date().toISOString(),
            clientElapsedMs: performance.now() - this.diagnosticStartedAt,
            frameWallTime: typeof interaction.frameWallTime === 'string' ? interaction.frameWallTime : null,
            frameElapsedMs: typeof interaction.frameElapsedMs === 'number' ? interaction.frameElapsedMs : null,
            isTrusted: interaction.isTrusted === true,
            target: typeof interaction.target === 'object' && interaction.target !== null
                ? interaction.target
                : null,
            pointer: typeof interaction.pointer === 'object' && interaction.pointer !== null
                ? interaction.pointer
                : null,
            wheel: typeof interaction.wheel === 'object' && interaction.wheel !== null
                ? interaction.wheel
                : null,
            key: typeof interaction.key === 'string' ? interaction.key : null,
        });
    }

    private storeRecentScrollInteraction(interaction: Record<string, unknown>): void {
        this.recentScrollInteractions.push(interaction);
        if (this.recentScrollInteractions.length > 10) {
            this.recentScrollInteractions.shift();
        }
    }

    private describeInteractionTarget(target: Element | null): Record<string, unknown> | null {
        if (target === null) {
            return null;
        }
        const targetElement = target instanceof HTMLElement ? target : null;
        const contentElement = targetElement?.closest('[id^="content-"]') as HTMLElement | null;
        return {
            tagName: target.tagName,
            id: targetElement?.id || null,
            metadataId: contentElement?.id.startsWith('content-')
                ? contentElement.id.slice('content-'.length)
                : null,
            role: target.getAttribute('role'),
        };
    }

    private getRecentScrollInteractions(now: number): Array<Record<string, unknown>> {
        const cutoff = now - 3000;
        return this.recentScrollInteractions
            .filter((interaction) => typeof interaction.clientElapsedMs === 'number' && interaction.clientElapsedMs >= cutoff - this.diagnosticStartedAt)
            .slice(-10);
    }

    private describeLayoutElement(element: HTMLElement): Record<string, unknown> {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
            tagName: element.tagName,
            id: element.id,
            className: typeof element.className === 'string' ? element.className : '',
            rect: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            },
            scrollLeft: element.scrollLeft,
            scrollTop: element.scrollTop,
            computedStyle: {
                position: style.position,
                transform: style.transform,
                overflowX: style.overflowX,
                overflowY: style.overflowY,
            },
        };
    }

    private reportCameraDiagnostic(update: any, result: any): void {
        if (
            this.diagnosticSessionId === null
            || update.diagnosticSessionId !== this.diagnosticSessionId
            || !result
        ) {
            return;
        }

        this.diagnosticSequence += 1;
        void this.sendCommand('ReportClientDiagnostic', {
            event: 'camera-rendered',
            diagnosticSessionId: this.diagnosticSessionId,
            diagnosticId: update.diagnosticId,
            instanceId: this.diagnosticInstanceId,
            sequence: this.diagnosticSequence,
            clientWallTime: new Date().toISOString(),
            clientElapsedMs: performance.now() - this.diagnosticStartedAt,
            displayId: this.displayId,
            metadataId: update.metadataId,
            phase: result.phase,
            clientState: result.state ?? null,
            renderElapsedMs: result.clientElapsedMs ?? null,
        }).catch((error: unknown) => {
            console.warn('[Display] Failed to report camera diagnostic:', error);
        });
    }

    private shouldReloadWebGLContent(
        method: string,
        previous: ContentMetadata | undefined,
        incoming: ContentMetadata,
    ): boolean {
        if (method === 'AddContent' || method === 'NewContentAdded') {
            return true;
        }
        if (previous === undefined) {
            return true;
        }
        if (incoming.type !== 'webgl' && previous.type !== 'webgl') {
            return false;
        }
        if (incoming.url === undefined || incoming.url === null || incoming.url === '') {
            return false;
        }
        return previous.url !== incoming.url;
    }

    private shouldReloadRegularContent(
        method: string,
        previous: ContentMetadata | undefined,
        incoming: ContentMetadata,
    ): boolean {
        return shouldReloadRegularContentByPolicy(method, previous, incoming);
    }

    // ----------------------------------------------------------------
    // コンテンツ表示
    // ----------------------------------------------------------------

    private async displayContent(metadata: ContentMetadata): Promise<void> {
        const normalizedMetadata = this.normalizeMetadataForOrder(metadata);
        this.contents.set(normalizedMetadata.metadataId, normalizedMetadata);
        this.updateContentCount();

        if (normalizedMetadata.type === 'live-stream') {
            console.log('[Display] Live stream metadata received:', normalizedMetadata.metadataId);

            const elem = ensureLiveStreamElement(this.contentArea, normalizedMetadata.metadataId);

            this.applyElementLayout(normalizedMetadata, elem);

            const producerId = (normalizedMetadata as any).producerId;
            if (producerId) {
                const pendingProducer = this.pendingStreamProducers.get(producerId);
                if (pendingProducer) {
                    this.pendingStreamProducers.delete(producerId);
                    await this.handleNewProducer(pendingProducer);
                } else {
                    const existingStream = this.liveStreamManager?.getStreamForExistingConsumer(producerId);
                    const video = elem.querySelector('video');
                    if (existingStream && (video === null || video.srcObject === null)) {
                        this.liveStreamManager?.attachStreamToElement(
                            elem.id,
                            existingStream,
                            'video',
                        );
                    }
                }
            }
            return;
        }

        let elem = document.getElementById(`content-${normalizedMetadata.metadataId}`);
        if (!elem) {
            elem = document.createElement('div');
            elem.id = `content-${normalizedMetadata.metadataId}`;
            elem.className = 'content-item';
            this.contentArea.appendChild(elem);
        }

        this.applyElementLayout(normalizedMetadata, elem as HTMLElement);

        await this.loadAndDisplayContent(normalizedMetadata, elem);
    }

    private async loadAndDisplayContent(metadata: ContentMetadata, elem: HTMLElement): Promise<void> {
        const meta = metadata as any;

        if (meta.type === 'tileimage') {
            if (!meta.tileFinished) {
                this.renderer.destroyTileImage(metadata.metadataId);
                elem.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#888;font-size:12px;">Processing...</div>';
                return;
            }
            await this.renderer.displayTileImage(elem, meta);
            elem.dataset.loaded = 'true';
            return;
        }

        // loaded: コンテンツ取得済み、loading: GetContent 応答待ち中（二重発行を防ぐ）
        if (elem.dataset.loaded === 'true' || elem.dataset.loading === 'true') return;
        elem.dataset.loading = 'true';

        try {
            const content = await this.sendCommand('GetContent', { metadataId: metadata.metadataId });
            const latestMetadata = this.contents.get(metadata.metadataId);
            if (!elem.isConnected || latestMetadata === undefined || (metadata.type === 'webgl' && latestMetadata.url !== metadata.url)) {
                return;
            }

            if (content.type.startsWith('image') && content.binary) {
                this.renderer.displayImage(elem, content.binary, content.mime || 'image/png');
            } else if (content.type === 'text' && content.binary) {
                this.renderer.displayText(elem, content.binary);
            } else if (content.type === 'video' && content.binary) {
                this.renderer.displayVideo(elem, content.binary, content.mime || 'video/mp4');
            } else if (content.type === 'webgl' && content.url) {
                this.renderer.displayWebGL(elem, content, latestMetadata);
            } else if (content.type === 'pdf' && content.binary) {
                this.renderer.displayPDF(elem, content);
            } else {
                console.error('[Display] Invalid content data:', content);
            }

            elem.dataset.loaded = 'true';
        } catch (err) {
            console.error('[Display] Failed to get content:', err);
        } finally {
            delete elem.dataset.loading;
        }
    }

    // ----------------------------------------------------------------
    // コンテンツ削除・再描画
    // ----------------------------------------------------------------

    private applyContentVisibility(): void {
        if (!this.windowMetaData) return;
        this.displayArea.style.visibility = this.windowMetaData.contentVisible ? 'visible' : 'hidden';
        console.log(`[Display] contentVisible: ${this.windowMetaData.contentVisible}`);
    }

    private async refreshDisplay(): Promise<void> {
        console.log('[Display] Refreshing display...');
        for (const metadata of this.contents.values()) {
            await this.displayContent(metadata);
        }
        this.renderer.sendAllWebGLResize();

        //強制リフローで、サイズ変更時の挙動を安定化させる狙いの行
        const vh = this.displayArea.getBoundingClientRect();
        let n = vh.width;
    }

    private async refreshTileImages(): Promise<void> {
        for (const metadata of this.contents.values()) {
            if (metadata.type === 'tileimage') {
                await this.displayContent(metadata);
            }
        }
    }

    private async reloadAllContents(): Promise<void> {
        console.log('[Display] Reloading all contents...');
        for (const [metadataId, metadata] of this.contents) {
            if ((metadata as any).type === 'live-stream') continue;
            this.removeContentElement(metadataId);
            this.renderer.destroyWebGL(metadataId);
        }
        for (const [metadataId, metadata] of this.contents) {
            if ((metadata as any).type !== 'live-stream') {
                this.contents.delete(metadataId);
            }
        }
        await this.loadContents();
    }

    private removeContentElement(metadataId: string): void {
        this.renderer.destroyTileImage(metadataId);
        const elem = document.getElementById(`content-${metadataId}`);
        if (elem) {
            elem.remove();
            return;
        }

        const metadata = this.contents.get(metadataId);
        if (metadata && (metadata as any).producerId) {
            const producerId = (metadata as any).producerId;
            const streamElem = document.getElementById(`remote-stream-${producerId}`);
            if (streamElem) {
                console.log(`[Display] Removing live stream element: remote-stream-${producerId}`);
                streamElem.remove();
            }
        }
    }

    // ----------------------------------------------------------------
    // メッセージ処理
    // ----------------------------------------------------------------

    private handleMessage2(message: any): void {
        if (message.to === 'client') {
            if (message.method !== 'UpdateCameraMatrix') {
                console.log('[Display] Received broadcast:', message.method, message.params);
            }
            this.handleBroadcast(message.method, message.params);
        } else if (message.id !== undefined && message.id !== null && this.callbacks.has(String(message.id))) {
            const callback = this.callbacks.get(String(message.id))!;
            this.callbacks.delete(String(message.id));
            if (message.error) {
                callback(message.error);
            } else {
                callback(null, message.result);
            }
        }
    }

    private isCameraUpdateMessage(message: JSONRPCMessage): boolean {
        const params = message.params;
        return message.to === 'client'
            && message.method === 'UpdateCameraMatrix'
            && Boolean(params?.metadataId)
            && Boolean(params?.cameraWorldMatrix)
            && Boolean(params?.cameraParams);
    }

    private enqueueCameraUpdate(params: any): void {
        this.pendingCameraUpdates.set(params.metadataId, { params });

        if (this.cameraFlushScheduled) return;
        this.cameraFlushScheduled = true;
        queueMicrotask(() => {
            this.cameraFlushScheduled = false;
            const updates = this.pendingCameraUpdates;
            this.pendingCameraUpdates = new Map();
            for (const { params: updateParams } of updates.values()) {
                this.renderer.sendWebGLCameraUpdate(
                    updateParams.metadataId,
                    updateParams.cameraWorldMatrix,
                    updateParams.cameraParams,
                    undefined,
                    undefined,
                    updateParams,
                );
            }
        });
    }

    private async handleBinaryMessage(data: Blob): Promise<void> {
        try {
            const arrayBuffer = await data.arrayBuffer();
            const parsed = parseMetaBinary(arrayBuffer);

            if (!parsed) {
                console.error('[Display] Failed to parse MetaBinary');
                return;
            }

            const message = parsed.metadata;
            const binary = parsed.binary;

            if (message.id && this.callbacks.has(message.id)) {
                const callback = this.callbacks.get(message.id)!;
                this.callbacks.delete(message.id);
                console.log('[Display] Received binary response for id:', message.id);
                if (message.error) {
                    callback(message.error);
                } else {
                    callback(null, { ...message.result, binary });
                }
            } else if (message.method || message.command) {
                const method = message.method || message.command;
                const params = message.params || message.data;
                console.log('[Display] Received binary broadcast:', method, params);
                this.handleBroadcast(method, params);
            }
        } catch (e) {
            console.error('[Display] Failed to handle binary message:', e);
        }
    }

    private async handleBroadcast(method: string, params: any): Promise<void> {
        if (method === 'DisplayApproved') {
            this.onDisplayApproved(params);
        } else if (method === 'DisplayRejected') {
            console.log('[Display] Display rejected by controller');
            this.isRejected = true;
            this.cursorOverlay.clear();
            this.connectionScreen.showRejectedScreen();
        } else if (method === 'UpdateMouseCursor') {
            this.cursorOverlay.updateCursor(params);
        } else if (method === 'ControllerDisconnected') {
            if (typeof params === 'string' && params !== '') {
                this.cursorOverlay.removeCursor(params);
            }
        } else if (method === 'UpdateContent' || method === 'AddContent' || method === 'NewContentAdded') {
            const meta = params?.metadata;
            if (meta) {
                const existing = this.contents.get(meta.metadataId);
                const isWebGLMeta = meta.type === 'webgl' || existing?.type === 'webgl';
                if (isWebGLMeta) {
                    const shouldReload = this.shouldReloadWebGLContent(method, existing, meta);
                    if (!shouldReload) {
                        // URL変化なし/未指定: iframe を再生成せず位置・サイズ・レイヤーのみ更新
                        await this.handleWebGLMetaUpdate(meta);
                    } else {
                        await this.onContentUpdated(meta, true);
                    }
                } else {
                    const shouldReload = this.shouldReloadRegularContent(method, existing, meta);
                    if (!shouldReload) {
                        await this.handleRegularMetaUpdate(meta);
                    } else {
                        await this.onContentUpdated(meta, true);
                    }
                }
            }
        } else if (method === 'UpdateMetaData') {
            // UpdateMetaData は位置・サイズ変更専用。カメラは UpdateCameraMatrix で処理。
            const updatedMeta = (params && params.metadata) ? params.metadata : params;
            if (updatedMeta) {
                const existing = this.contents.get(updatedMeta.metadataId);
                const isWebGLMeta = updatedMeta.type === 'webgl' || existing?.type === 'webgl';
                if (isWebGLMeta) {
                    await this.handleWebGLMetaUpdate(updatedMeta);
                } else {
                    await this.handleRegularMetaUpdate(updatedMeta);
                }
            }
        } else if (method === 'UpdateCameraMatrix') {
            // iTowns カメラ行列のみの更新（位置・サイズDOM更新は不要）
            if (params && params.metadataId && params.cameraWorldMatrix && params.cameraParams) {
                if (typeof params.diagnosticId === 'string' && typeof params.diagnosticSessionId === 'string') {
                    this.renderer.sendWebGLCameraUpdate(
                        params.metadataId,
                        params.cameraWorldMatrix,
                        params.cameraParams,
                        {
                            diagnosticId: params.diagnosticId,
                            diagnosticSessionId: params.diagnosticSessionId,
                        },
                        (result: any) => this.reportCameraDiagnostic(params, result),
                        params,
                    );
                } else {
                    this.renderer.sendWebGLCameraUpdate(
                        params.metadataId,
                        params.cameraWorldMatrix,
                        params.cameraParams,
                        undefined,
                        undefined,
                        params,
                    );
                }
            }
        } else if (method === 'DeleteContent') {
            if (params && params.metadataId) {
                await this.onContentDeleted(params.metadataId);
            }
        } else if (method === 'UpdateDisplaySpace') {
            if (params) {
                this.virtualDisplay = params;
                this.updateDebugInfo();
            }
        } else if (method === 'UpdateWindowMetaData') {
            // サーバーが単一オブジェクトまたは配列でブロードキャストする場合を両方ハンドル
            const candidates: any[] = Array.isArray(params) ? params : [params];
            const myParams = candidates.find((p: any) => p && p.id === this.windowMetaData?.id);
            console.log('[Display] UpdateWindowMetaData broadcast received - params:', JSON.stringify(params, null, 2));
            if (this.windowMetaData) {
                console.log('[Display] My window ID:', this.windowMetaData.id);
                console.log('[Display] Found matching params:', JSON.stringify(myParams, null, 2));
            }
            if (this.windowMetaData && myParams) {
                console.log('[Display] Before update - virtualHeight:', this.windowMetaData.virtualHeight, '-> will become:', myParams.virtualHeight ?? this.windowMetaData.virtualHeight);
                this.windowMetaData.posx = myParams.posx ?? this.windowMetaData.posx;
                this.windowMetaData.posy = myParams.posy ?? this.windowMetaData.posy;
                this.windowMetaData.virtualWidth = myParams.virtualWidth ?? this.windowMetaData.virtualWidth;
                this.windowMetaData.virtualHeight = myParams.virtualHeight ?? this.windowMetaData.virtualHeight;
                this.windowMetaData.revision = myParams.revision ?? this.windowMetaData.revision;
                // pixelWidth/Height は常に実際の表示領域サイズを使用する
                // （コントローラ側から送られてくる古いキャッシュ値で上書きしない）
                this.windowMetaData.pixelWidth = this.displayArea.clientWidth;
                this.windowMetaData.pixelHeight = this.displayArea.clientHeight;
                if (myParams.contentVisible !== undefined) {
                    this.windowMetaData.contentVisible = myParams.contentVisible;
                    this.applyContentVisibility();
                }
                await this.refreshDisplay();
                this.cursorOverlay.reflowAllCursors();
                this.updateDebugInfo();
                this.reportDisplayLayout('window-metadata-applied');
            }
        } else if (method === 'RefreshDisplayContent') {
            await this.reloadAllContents();
        } else if (method === 'NewProducerAvailable') {
            this.handleNewProducer(params);
        } else {
            console.log('[Display] Unknown broadcast method:', method);
        }
    }

    /**
     * WebGLコンテンツのメタデータ（位置・サイズ・レイヤー）を再ロードなしで更新する。
     * UpdateMetaData 受信時と、UpdateContent でURL変化なしの場合（Layer 2フォールバック）に使用。
     */
    private async handleWebGLMetaUpdate(updatedMeta: ContentMetadata): Promise<void> {
        const normalizedMetadata = this.normalizeMetadataForOrder(updatedMeta);
        this.contents.set(normalizedMetadata.metadataId, normalizedMetadata);
        const existingElem = document.getElementById(`content-${normalizedMetadata.metadataId}`);
        if (existingElem !== null) {
            this.applyElementLayout(normalizedMetadata, existingElem as HTMLElement);
            this.renderer.updateWebGLContentMeta(normalizedMetadata.metadataId, normalizedMetadata);
            this.reorderContentAreaByMetadataOrder();
        } else if (this.isContentInWindow(normalizedMetadata)) {
            await this.displayContent(normalizedMetadata);
            this.reorderContentAreaByMetadataOrder();
        }
        this.reportDisplayLayout('content-layout-applied');
    }

    private async handleRegularMetaUpdate(updatedMeta: ContentMetadata): Promise<void> {
        const normalizedMetadata = this.normalizeMetadataForOrder(updatedMeta);
        this.contents.set(normalizedMetadata.metadataId, normalizedMetadata);
        const existingElem = document.getElementById(`content-${normalizedMetadata.metadataId}`);
        if (existingElem !== null) {
            this.applyElementLayout(normalizedMetadata, existingElem as HTMLElement);
            if (normalizedMetadata.type === 'tileimage') {
                await this.displayContent(normalizedMetadata);
            } else if (normalizedMetadata.type === 'text') {
                this.renderer.resizeTextContent(existingElem as HTMLElement);
            }
            this.reorderContentAreaByMetadataOrder();
        } else if (this.isContentInWindow(normalizedMetadata)) {
            await this.displayContent(normalizedMetadata);
            this.reorderContentAreaByMetadataOrder();
        }
        this.reportDisplayLayout('content-layout-applied');
    }

    private async onContentUpdated(metadata: ContentMetadata, forceReload: boolean = false): Promise<void> {
        const normalizedMetadata = this.normalizeMetadataForOrder(metadata);
        const previous = this.contents.get(normalizedMetadata.metadataId);
        if (normalizedMetadata.type === 'webgl' && previous !== undefined && previous.url !== normalizedMetadata.url) {
            cameraMirrorUpdates.invalidateUrl(normalizedMetadata.metadataId, normalizedMetadata.url ?? '');
        }
        console.log('[Display] Content updated:', normalizedMetadata.metadataId, 'pos:', normalizedMetadata.posx, normalizedMetadata.posy, 'size:', normalizedMetadata.width, normalizedMetadata.height);
        this.contents.set(normalizedMetadata.metadataId, normalizedMetadata);
        const existingElem = document.getElementById(`content-${normalizedMetadata.metadataId}`);
        if (forceReload && existingElem !== null) {
            delete existingElem.dataset.loaded;
        }
        await this.displayContent(normalizedMetadata);
        this.reorderContentAreaByMetadataOrder();
        this.reportDisplayLayout('content-layout-applied');
    }

    private async onContentDeleted(metadataId: string): Promise<void> {
        cameraMirrorUpdates.forget(metadataId);
        console.log('[Display] Content deleted:', metadataId);

        const metadata = this.contents.get(metadataId);
        let producerId: string | null = null;
        for (const [pendingProducerId, pendingProducer] of this.pendingStreamProducers.entries()) {
            if (pendingProducer.metadataId === metadataId) {
                this.pendingStreamProducers.delete(pendingProducerId);
            }
        }
        if (metadata) {
            console.log('[Display] Found metadata for deletion:', metadata);
            if ((metadata as any).producerId) {
                producerId = (metadata as any).producerId as string;
                console.log('[Display] ProducerId found:', producerId);
                this.pendingStreamProducers.delete(producerId);
                this.liveStreamManager?.detachStreamFromElement(`content-${metadataId}`, 'video');
            }
        }

        this.removeContentElement(metadataId);
        this.renderer.destroyWebGL(metadataId);
        this.contents.delete(metadataId);
        this.updateContentCount();
        if (producerId !== null) {
            await this.liveStreamManager?.closeConsumer(producerId);
        }
    }

    // ----------------------------------------------------------------
    // コマンド送信
    // ----------------------------------------------------------------

    private sendCommand(method: string, params: any = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                console.warn('[Display] WebSocket not ready, queueing command:', method);
                this.pendingCommands.push({ method, params, resolve, reject });
                return;
            }

            if (!this.isRegistered && method !== 'RegisterDisplay') {
                this.pendingCommands.push({ method, params, resolve, reject });
                return;
            }

            const id = String(this.messageId++);
            const message: JSONRPCMessage = {
                jsonrpc: '2.0',
                id,
                method,
                params,
            };

            this.callbacks.set(id, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });

            console.log('[Display] Sending message:', JSON.stringify(message));
            this.ws.send(JSON.stringify(message));
        });
    }

    // ----------------------------------------------------------------
    // UI 更新
    // ----------------------------------------------------------------

    private updateStatus(text: string, connected: boolean): void {
        const statusConnection = document.getElementById('status-connection');
        const statusDisplayName = document.getElementById('status-display-name');
        const statusWindowId = document.getElementById('status-window-id');

        if (statusConnection) {
            statusConnection.textContent = text;
            statusConnection.className = connected ? 'status-connected' : 'status-disconnected';
        }
        if (statusDisplayName && this.displayName) {
            statusDisplayName.textContent = this.displayName;
        }
        if (statusWindowId && this.displayId) {
            statusWindowId.textContent = this.displayId;
        }
    }

    private updateContentCount(): void {
        // コンテンツカウントはステータスバーから削除されました
    }

    private updateDebugInfo(): void {
        if (this.windowMetaData) {
            const debugWindowId = document.getElementById('debug-window-id');
            const debugPosition = document.getElementById('debug-position');
            const debugSize = document.getElementById('debug-size');
            if (debugWindowId) debugWindowId.textContent = this.windowMetaData.id;
            if (debugPosition) debugPosition.textContent = `(${this.windowMetaData.posx}, ${this.windowMetaData.posy})`;
            if (debugSize) debugSize.textContent = `${this.windowMetaData.virtualWidth}x${this.windowMetaData.virtualHeight}`;
        }
    }

    private initDebugKeys(): void {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'd' || e.key === 'D') {
                const debugInfo = document.getElementById('debug-info');
                if (debugInfo) {
                    debugInfo.classList.toggle('show');
                    const isVisible = debugInfo.classList.contains('show');
                    // D キー押下のタイミングでデバッグ情報をリアルタイムで更新
                    this.updateDebugInfo();
                    console.log(`[Display] Debug info ${isVisible ? 'shown' : 'hidden'}`);
                } else {
                    console.error('[Display] debug-info element not found');
                }
            }
        });
        console.log('[Display] Debug keys initialized (press D to toggle debug info)');
    }

    private initWindowResizeHandler(): void {
        let dprMediaQuery: MediaQueryList | null = null;
        const handleDevicePixelRatioChange = (): void => {
            observeDevicePixelRatio();
            this.renderer.sendAllWebGLResize();
            this.refreshTileImages().catch((error: unknown) => {
                console.error('[Display] Failed to refresh tile images after DPR change:', error);
            });
        };
        const observeDevicePixelRatio = (): void => {
            if (dprMediaQuery !== null) {
                dprMediaQuery.removeEventListener('change', handleDevicePixelRatioChange);
            }
            dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
            dprMediaQuery.addEventListener('change', handleDevicePixelRatioChange, { once: true });
        };
        observeDevicePixelRatio();

        document.addEventListener('fullscreenchange', (): void => {
            this.reportDisplayLayout('display-fullscreen');
        });
        let resizeTimeout: number | null = null;
        window.addEventListener('resize', () => {
            if (resizeTimeout !== null) clearTimeout(resizeTimeout);
            resizeTimeout = window.setTimeout(async () => {
                if (this.windowMetaData && this.isRegistered) {
                    this.windowMetaData.pixelWidth = this.displayArea.clientWidth;
                    this.windowMetaData.pixelHeight = this.displayArea.clientHeight;
                    console.log(`[Display] Window resized: ${this.displayArea.clientWidth}x${this.displayArea.clientHeight}`);
                    this.sendCommand('UpdateWindowMetaData', {
                        id: this.windowMetaData.id,
                        pixelWidth: this.displayArea.clientWidth,
                        pixelHeight: this.displayArea.clientHeight,
                    }).then((updatedWindow: WindowMetaData) => {
                        this.windowMetaData!.revision = updatedWindow?.revision ?? this.windowMetaData!.revision;
                        this.reportDisplayLayout('display-resize');
                    }).catch((err) => console.error('[Display] Failed to notify resize:', err));
                    await this.refreshDisplay();
                    this.cursorOverlay.reflowAllCursors();
                    // ブラウザウィンドウリサイズ完了後、デバッグ欄を更新
                    this.updateDebugInfo();
                }
            }, 500);
        });
    }

    // ----------------------------------------------------------------
    // Live Stream
    // ----------------------------------------------------------------

    private initLiveStreamManager(): void {
        if (this.liveStreamManager) return;

        const callbacks: MediasoupCallbacks = {
            sendCommand: (method, params) => this.sendCommand(method, params),
            log: (message, _type) => console.log(`[Display] ${message}`),
        };

        this.liveStreamManager = new LiveStreamManager(callbacks);
    }

    private async handleNewProducer(params: StreamProducerNotification): Promise<void> {
        const { producerId, userId, kind, metadataId } = params;
        if (kind !== 'video' || typeof metadataId !== 'string' || metadataId === '') {
            return;
        }

        console.log(`[Display] New ${kind} producer available from ${userId}`);
        const metadata = this.contents.get(metadataId);
        if (!metadata) {
            this.queuePendingStreamProducer(params);
            return;
        }
        if (metadata.type !== 'live-stream' || (metadata as any).producerId !== producerId) {
            return;
        }

        const elementId = `content-${metadata.metadataId}`;
        if (!document.getElementById(elementId)) {
            this.queuePendingStreamProducer(params);
            return;
        }

        const pendingAttachment = this.streamAttachmentPromises.get(producerId);
        if (pendingAttachment) {
            await pendingAttachment;
            return;
        }

        this.initLiveStreamManager();
        const attachment = this.attachStreamProducer(params, metadata);
        this.streamAttachmentPromises.set(producerId, attachment);
        try {
            await attachment;
        } finally {
            if (this.streamAttachmentPromises.get(producerId) === attachment) {
                this.streamAttachmentPromises.delete(producerId);
            }
        }
    }

    private async attachStreamProducer(
        params: StreamProducerNotification,
        metadata: ContentMetadata,
    ): Promise<void> {
        const manager = this.liveStreamManager;
        if (!manager) {
            return;
        }

        const producerId = params.producerId;
        const elementId = `content-${metadata.metadataId}`;
        const existingStream = manager.getStreamForExistingConsumer(producerId);
        if (existingStream) {
            manager.attachStreamToElement(elementId, existingStream, 'video');
            return;
        }

        const config = {
            streamName: (metadata as any).streamName || `Stream from ${params.userId}`,
            posx: metadata.posx,
            posy: metadata.posy,
            width: metadata.width,
            height: metadata.height,
        };

        try {
            const { stream, kind } = await manager.consumeStream(producerId, config);
            const currentMetadata = this.contents.get(metadata.metadataId);
            const element = document.getElementById(elementId);
            if (
                currentMetadata === undefined
                || currentMetadata.type !== 'live-stream'
                || (currentMetadata as any).producerId !== producerId
                || element === null
            ) {
                await manager.closeConsumer(producerId);
                return;
            }
            manager.attachStreamToElement(elementId, stream, kind);
            console.log(`[Display] Stream attached to ${elementId}`);
        } catch (error: unknown) {
            console.error('[Display] Failed to consume stream:', error);
        }
    }

    private queuePendingStreamProducer(params: StreamProducerNotification): void {
        if (!this.pendingStreamProducers.has(params.producerId)
            && this.pendingStreamProducers.size >= MAX_PENDING_STREAM_PRODUCERS) {
            const oldestProducerId = this.pendingStreamProducers.keys().next().value;
            if (oldestProducerId !== undefined) {
                this.pendingStreamProducers.delete(oldestProducerId);
            }
        }
        this.pendingStreamProducers.set(params.producerId, params);
    }

    private async fetchActiveProducers(): Promise<void> {
        try {
            const result = await this.sendCommand('GetActiveProducers', {});
            const producers = result.producers || [];
            console.log(`[Display] Found ${producers.length} active producers`);
            for (const producer of producers) {
                await this.handleNewProducer(producer);
            }
        } catch (error: any) {
            console.error(`[Display] Failed to fetch active producers: ${error.message}`);
        }
    }
}

// ----------------------------------------------------------------
// エントリポイント
// ----------------------------------------------------------------

declare global {
    interface Window {
        displayClientInitialized?: boolean;
    }
}

window.addEventListener('load', async () => {
    if (window.displayClientInitialized) {
        console.warn('[Display] Already initialized, skipping duplicate initialization');
        return;
    }
    window.displayClientInitialized = true;
    await initI18n();
    applyI18n();
    new DisplayClient();
});
