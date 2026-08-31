import { setLocale, currentLocale, applyI18n, t, type Locale, type TranslationKey } from '../i18n';
import { arrayBufferToBase64 } from '../metaBinaryClient';
import { TileImageUploader } from '../tileImageUploader';
import { Manipulator } from '../manipulator';
import { ClientCursor } from  '../clientCursor';
import { AdminPendingBadge } from '../adminPendingBadge';

import { WebSocketClient } from './websocket/WebSocketClient';
import type { LogFn } from './websocket/WebSocketClient';
import { AuthManager } from './auth/AuthManager';
import { ContentManager } from './content/ContentManager';
import { DisplayManager } from './display/DisplayManager';
import { SiteManager } from './site/SiteManager';
import { LayoutManager } from './layout/LayoutManager';
import { LiveStreamController } from './livestream/LiveStreamController';
import { ViewportState } from './viewport/ViewportState';
import type { UpdateStockData, JSONRPCMessage } from './types';
import {
    compareContentMetadataForDisplayOrder,
    normalizeContentZIndex,
} from '../../common/contentOrder';


interface DragState {
    isDragging: boolean;
    startX: number;
    startY: number;
    startCenterX: number;
    startCenterY: number;
}

export class ChOWDERClient {
    private elements: any = {};
    private viewport: ViewportState;
    private dragState: DragState = { isDragging: false, startX: 0, startY: 0, startCenterX: 0, startCenterY: 0 };
    private nativeScaleClass: CSSStyleRule | null = null;
    private selectedUserId: string | null = null;
    private cachedUserList: { userId: string; role: string }[] = [];

    private updateStock: UpdateStockData[] = [];
    private fps = 5;
    private lastTime = 0;
    private interval = 1000 / this.fps;
    private nowModeNum  = 1; /* 編集中モード。1=contetn、2=display */

    private lastMousePos: {x: number, y: number} = {x: 0, y: 0};
    private hasMouseMoved = false;

    private readonly wsClient: WebSocketClient;
    private readonly auth: AuthManager;
    private readonly siteManager: SiteManager;
    private readonly displayManager: DisplayManager;
    private readonly contentManager: ContentManager;
    private readonly layoutManager: LayoutManager;
    private readonly liveStreamController: LiveStreamController;
    private readonly manipulator: Manipulator;
    private readonly clientCursor: ClientCursor;
    private readonly adminPendingBadge: AdminPendingBadge;
    private readonly tileUploader: TileImageUploader;

    constructor() {
        console.log('🎨 ChOWDER Client initializing...');

        this.initElements();

        this.viewport = new ViewportState({
            width: window.innerWidth,
            height: window.innerHeight - 80,
        });

        const logFn: LogFn = (msg, type) => this.log(msg, type);

        // WebSocket クライアント
        this.wsClient = new WebSocketClient(
            (msg: JSONRPCMessage) => this.handleBroadcast(msg),
            () => {
                this.updateStatus('connected', '✅ Connected');
                this.log('Connected successfully', 'success');
                this.fetchServerConfig();
            },
            () => {
                if (this.auth.isAuthenticated) {
                    location.replace(location.href);
                    return;
                }
                if (this.wsClient.isReconnectEnabled()) {
                    this.log('Disconnected - reconnecting in 5 seconds...', 'error');
                } else {
                    this.log('Disconnected', 'info');
                }
                this.updateStatus('disconnected', '❌ Disconnected');
                this.updateAuthStatus();
                this.disableAuthenticatedFeatures();
            },
            logFn,
        );

        const sendCmd = (m: string, p?: any) => this.wsClient.sendCommand(m, p);
        const sendBinaryCmd = (m: string, p: any, b: ArrayBuffer) => this.wsClient.sendBinaryCommand(m, p, b);

        // 認証
        this.auth = new AuthManager(sendCmd, logFn);

        // ヘルパー類
        this.manipulator = new Manipulator();
        this.clientCursor = new ClientCursor();
        this.adminPendingBadge = new AdminPendingBadge();
        this.tileUploader = new TileImageUploader(
            sendCmd,
            sendBinaryCmd,
            (method, handler) => this.wsClient.registerBroadcastHandler(method, handler),
        );

        // ライブストリーム
        this.liveStreamController = new LiveStreamController({
            elements: this.elements,
            sendCmd,
            sendBinaryCmd,
            logFn,
            getSocketId: () => this.auth.socketId,
            onRetryAttachments: () => this.contentManager.retryOwnStreamAttachments(),
            onVideoFilePreviewReady: (elemId, video) => {
                // view-{metadataId} 形式の elemId から metadataId を取得
                const metadataId = elemId.replace(/^view-/, '');
                this.contentManager.captureAndSendLiveStreamThumbnail(metadataId, video)
                    .catch((err) => console.warn('[ChOWDERClient] video-file thumbnail (pending path) failed:', err));
            },
            captureThumbnail: (metadataId, video) =>
                this.contentManager.captureAndSendLiveStreamThumbnail(metadataId, video),
        });

        // elements オブジェクトに LiveStreamController の video-file 用プロパティをブリッジ
        // producerId をキーにした複数セッション対応
        this.elements._getVideoFilePreviewElement = (producerId: string): HTMLVideoElement | null => {
            return this.liveStreamController.getVideoFilePreviewElementByProducerId(producerId);
        };
        this.elements._setPendingVideoFileElemId = (elemId: string, producerId: string): void => {
            this.liveStreamController.setPendingVideoFileElemId(elemId, producerId);
        };
        this.elements._buildVideoFileOverlay = (elem: HTMLElement, video: HTMLVideoElement) =>
            this.liveStreamController._buildVideoFileOverlay(elem, video);

        // Site 管理
        this.siteManager = new SiteManager({
            elements: this.elements,
            sendCmd,
            logFn,
            renderSiteGrid: (siteId) => this.renderSiteGrid(siteId),
            onSiteSelected: (siteId, displayIds) => {
                this.displayManager.filterApprovedDisplaysByIds(displayIds.length > 0 ? displayIds : null);
                this.refreshVDASettings(siteId);
            },
            onDisplaySelect :() => this.onDisplaySelected("" ,null),
        });

        // Display 管理
        this.displayManager = new DisplayManager({
            elements: this.elements,
            sendCmd,
            logFn,
            adminPendingBadge: this.adminPendingBadge,
            manipulator: this.manipulator,
            getSites: () => this.siteManager.sites,
            getZoom: () => this.viewport.zoom,
            pushUpdateStock: (data) => this.updateStock.push(data),
            getSelectedMetadataId: () => this.contentManager.selectedMetadataId,
            setVisiblePendingList: (v) => this.setVisiblePendingList(v),
            buildSiteSelect: (id?) => this.siteManager.buildSiteSelect(id),
            displayWindowFrames: () => this.displayManager.displayWindowFrames(this.siteManager.currentSiteId),
            renderSiteGrid: (siteId) => this.renderSiteGrid(siteId),
            onDisplaySelected: (displayId, windowData) => this.onDisplaySelected(displayId, windowData),
            getCurrentSiteId: () => this.siteManager.currentSiteId,
            getEditMode:() => this.nowModeNum,
            contentCreateUpdateStock: (elem) => this.contentManager.createUpdateStock(elem),
            getSelectedDisplayId: () => this.getSelectedDisplayId(),
            renderAllSiteGrid:() =>this.renderAllSiteGrid(),
            getIsAdmin: () => this.auth.isAdmin(),
        });

        // コンテンツ管理
        this.contentManager = new ContentManager({
            elements: this.elements,
            sendCmd,
            sendBinaryCmd,
            logFn,
            manipulator: this.manipulator,
            getZoom: () => this.viewport.zoom,
            pushUpdateStock: (data) => this.updateStock.push(data),
            getSocketId: () => this.auth.socketId,
            getCurrentUser: () => this.auth.currentUser,
            getLiveStreamManager: () => this.liveStreamController.liveStreamManager,
            tileUploader: this.tileUploader,
            registerBroadcast: (method, handler) => this.wsClient.registerBroadcastHandler(method, handler),
            consumePendingProducer: (id) => this.liveStreamController.consumePendingProducer(id),
            handleNewProducer: (params, knownMetadata) => this.liveStreamController.handleNewProducer(params, this.contentManager.metadataList, knownMetadata),
            getEditMode:() => this.nowModeNum,
            showRightClickMenu:(e:MouseEvent) => this.showRightClickMenu(e),
            stopVideoFileByMetadata: (id: string) => this.liveStreamController.stopVideoFileByMetadata(id),
            stopLiveStreamByProducerId: (id: string) => this.liveStreamController.stopLiveStreamByProducerId(id),
            addVideoFile: (file: File, streamName: string) => this.liveStreamController.startVideoFileShareWithFile(file, streamName),
        });

        // チェックボックスリスナーを ContentManager に委譲
        this.contentManager.setupCheckboxListener(this.elements.contentVisible as HTMLElement);

        // レイアウト管理
        this.layoutManager = new LayoutManager({
            elements: this.elements,
            sendCmd,
            logFn,
        });

        // Admin pending badge 初期化
        this.adminPendingBadge.init(this.elements.showAdminConfigButton as HTMLElement | null);

        // Manipulator 初期化
        this.manipulator.init(this.contentManager.createUpdateStock);

        // nativeScale クラスを探す
        for (const sheet of Array.from(document.styleSheets)) {
            try {
                const rules = sheet.cssRules || sheet.rules;
                for (let i = 0; i < rules.length; i++) {
                    const rule = rules[i] as CSSStyleRule;
                    if (rule.selectorText === '.nativeScale') {
                        this.nativeScaleClass = rule;
                        break;
                    }
                }
            } catch (_) { /* cross-origin sheet */ }
            if (this.nativeScaleClass) break;
        }

        this.initEventListeners();
        this.setupViewAreaEventListeners();
        this.updateLangButtons();
        this.log('Client initialized', 'info');
        this.wsClient.connect();
        requestAnimationFrame(() => this.frameUpdate());
    }

    // =========================================================================
    // 要素初期化
    // =========================================================================

    private initElements(): void {
        this.elements = {
            status: document.getElementById('status'),
            authStatus: document.getElementById('auth-status'),
            loginForm: document.getElementById('login-form'),
            loginBtn: document.getElementById('login-btn'),
            logoutBtn: document.getElementById('logout-btn'),
            userId: document.getElementById('user-id') as HTMLInputElement,
            password: document.getElementById('password') as HTMLInputElement,
            createUserBtn: document.getElementById('create-user-btn'),
            newUserId: document.getElementById('new-user-id') as HTMLInputElement,
            newPassword: document.getElementById('new-password') as HTMLInputElement,
            newRole: document.getElementById('new-role') as HTMLSelectElement,
            refreshUserListBtn: document.getElementById('refresh-user-list-btn'),
            userListBody: document.getElementById('user-list-body'),
            userListSelectedLabel: document.getElementById('user-list-selected-label'),
            userListChangePwBtn: document.getElementById('user-list-change-pw-btn'),
            userListDeleteBtn: document.getElementById('user-list-delete-btn'),
            userListChangePwForm: document.getElementById('user-list-change-pw-form'),
            userListPwInput: document.getElementById('user-list-pw-input') as HTMLInputElement,
            userListPwConfirmBtn: document.getElementById('user-list-pw-confirm-btn'),
            fileInput: document.getElementById('file-input') as HTMLInputElement,
            urlInput: document.getElementById('url-input') as HTMLInputElement,
            textInput: document.getElementById('text-input') as HTMLInputElement,
            editTextInput: document.getElementById('edit-text-input') as HTMLInputElement,
            posX: document.getElementById('pos-x') as HTMLInputElement,
            posY: document.getElementById('pos-y') as HTMLInputElement,
            width: document.getElementById('width') as HTMLInputElement,
            height: document.getElementById('height') as HTMLInputElement,
            zIndex: document.getElementById('zindex') as HTMLInputElement,
            fontColor: document.getElementById('new-font-color') as HTMLInputElement,
            fontColorPreview: document.getElementById('new-font-color-preview'),
            fontColorHex: document.getElementById('new-font-color-hex'),
            editContentFontColor: document.getElementById('edit-font-color') as HTMLInputElement,
            fixTextWap: document.getElementById('fix-text-wap'),
            fixFontColWap: document.getElementById('fix-fontcol-wap'),
            contentInfoBody: document.getElementById('content-info-body'),
            displayInfoBody: document.getElementById('display-info-body'),

            addContentBtn: document.getElementById('add-content-btn'),
            deleteBtn: document.getElementById('delete-btn'),
            metadataList: document.getElementById('metadata-list'),
            log: document.getElementById('log'),
            viewArea: document.getElementById('view-area'),
            previewContent: document.getElementById('preview-content-area'),
            previewDisplay: document.getElementById('preview-display-area'),
            siteGridOverlay: document.getElementById('site-grid-overlay') as SVGSVGElement | null,
            refreshDisplaysBtn: document.getElementById('refresh-displays-btn'),
            waitApprovalWap:document.getElementById('waitApproval'),
            pendingDisplays: document.getElementById('pending-displays'),
            approvedDisplays: document.getElementById('approved-displays'),
            siteInDisplayList: document.getElementById('site-in-display-list'),
            modalView: document.getElementById('modalView'),
            streamName: document.getElementById('stream-name') as HTMLInputElement,
            streamX: document.getElementById('stream-x') as HTMLInputElement,
            streamY: document.getElementById('stream-y') as HTMLInputElement,
            streamWidth: document.getElementById('stream-width') as HTMLInputElement,
            streamHeight: document.getElementById('stream-height') as HTMLInputElement,
            startCameraBtn: document.getElementById('start-camera-btn'),
            cameraStatus: document.getElementById('camera-status'),
            screenName: document.getElementById('screen-name') as HTMLInputElement,
            screenX: document.getElementById('screen-x') as HTMLInputElement,
            screenY: document.getElementById('screen-y') as HTMLInputElement,
            screenWidth: document.getElementById('screen-width') as HTMLInputElement,
            screenHeight: document.getElementById('screen-height') as HTMLInputElement,
            startScreenBtn: document.getElementById('start-screen-btn'),
            screenStatus: document.getElementById('screen-status'),
            videoFileInput: document.getElementById('video-file-input') as HTMLInputElement,
            videoFileName: document.getElementById('video-file-name') as HTMLInputElement,
            videoFileX: document.getElementById('video-file-x') as HTMLInputElement,
            videoFileY: document.getElementById('video-file-y') as HTMLInputElement,
            videoFileWidth: document.getElementById('video-file-width') as HTMLInputElement,
            videoFileHeight: document.getElementById('video-file-height') as HTMLInputElement,
            startVideoFileBtn: document.getElementById('start-video-file-btn'),
            stopVideoFileBtn: document.getElementById('stop-video-file-btn'),
            videoFileStatus: document.getElementById('video-file-status'),
            toggleLeftBtn: document.getElementById('toggle-left'),
            toggleRightBtn: document.getElementById('toggle-right'),
            leftPanel: document.getElementById('left-panel'),
            rightPanel: document.getElementById('right-panel'),
            newSiteName: document.getElementById('new-site-name') as HTMLInputElement,
            newSiteColor: document.getElementById('new-site-color') as HTMLInputElement,
            newSiteColorPreview: document.getElementById('new-site-color-preview'),
            newSiteColorHex: document.getElementById('new-site-color-hex'),
            createSiteBtn: document.getElementById('create-site-btn'),
            siteList: document.getElementById('site-list'),
            siteListD: document.getElementById('site-list-d'),
            siteNameListHeader:document.getElementById("selectedSiteNameinList"),
            beforeLoginView: document.getElementById('beforeLoginView'),
            loginedView: document.getElementById('loginedView'),
            contentInfo: document.getElementById('content-info'),
            contentList: document.getElementById('content-list'),
            layoutNameInput: document.getElementById('layout-name-input') as HTMLInputElement,
            saveLayoutBtn: document.getElementById('save-layout-btn'),
            layoutList: document.getElementById('layout-list'),
            restoreLayoutBtn: document.getElementById('restore-layout-btn'),
            deleteLayoutBtn: document.getElementById('delete-layout-btn'),
            layoutPanel: document.getElementById('layout-panel'),
            tileimageFileInput: document.getElementById('tileimage-file-input') as HTMLInputElement,
            addTileimageBtn: document.getElementById('add-tileimage-btn') as HTMLButtonElement,
            tileimageProgress: document.getElementById('tileimage-progress'),
            tileimageProgressBar: document.getElementById('tileimage-progress-bar') as HTMLProgressElement,
            tileimageProgressLabel: document.getElementById('tileimage-progress-label'),
            tileUploadOverlay: document.getElementById('tile-upload-overlay'),
            tileUploadBar: document.getElementById('tile-upload-bar') as HTMLProgressElement,
            tileUploadLabel: document.getElementById('tile-upload-label'),
            tileUploadFilename: document.getElementById('tile-upload-filename'),
            initLoadingOverlay: document.getElementById('init-loading-overlay'),
            initLoadingLabel: document.getElementById('init-loading-label'),
            initLoadingBar: document.getElementById('init-loading-bar') as HTMLProgressElement,
            contentVisible: document.getElementById('toggle-content-visible'),
            changeModeContent: document.getElementById('btn-chgmode-c'),
            changeModeDisplay: document.getElementById('btn-chgmode-d'),
            changeModeClear: document.getElementById('btn-chgmode-x'),
            showAdminConfigButton: document.getElementById('btn-adminConfig'),
            openItowns2Btn: document.getElementById('open-itowns2-btn'),
            itowns2ContentSelect: document.getElementById('itowns2-content-select') as HTMLSelectElement,
            posXD: document.getElementById('pos-x-d') as HTMLInputElement,
            posYD: document.getElementById('pos-y-d') as HTMLInputElement,
            widthD: document.getElementById('width-d') as HTMLInputElement,
            heightD: document.getElementById('height-d') as HTMLInputElement,
            toggleDisplayVisible: document.getElementById('toggle-display-visible'),
            deleteBtnD: document.getElementById('delete-btn-d'),
            vdaGridX: document.getElementById('vda-grid-x') as HTMLInputElement,
            vdaGridY: document.getElementById('vda-grid-y') as HTMLInputElement,
            vdaWidth: document.getElementById('vda-width') as HTMLInputElement,
            vdaHeight: document.getElementById('vda-height') as HTMLInputElement,
            toggleVdaAttach: document.getElementById('toggle-vda-attach'),
            sitenameScm: document.getElementById('sitename-scm'),
            infoContentType: document.getElementById('info-content-type'),
            displayNameInInfo:  document.getElementById('display-name-info'),
            adminDisplayButton:  document.getElementById('btn-admin-display'),
            adminUseryButton:  document.getElementById('btn-admin-user'),
            adminDisplayPanel:  document.getElementById('admin-display-manage'),
            adminUseryPanel:  document.getElementById('admin-user-manage'),

            rightMenuPanel:document.getElementById('right-menu-panel'),
            rightMenuWap:document.getElementById('right-menu-wap'),
            rightMenutoTop:document.getElementById('right-menu-top'),
            rightMenutoBack:document.getElementById('right-menu-back'),
            rightMenuSetHide:document.getElementById('right-menu-hide'),
            rightMenuSetVisible:document.getElementById('right-menu-visible'),

            rulerDiv:document.getElementById('preview-ruler'),
            langSwitcher: document.getElementById('lang-switcher'),
            loginLangSwitcher: document.getElementById('login-lang-switcher'),
            gotoChangePasswordBtn: document.getElementById('goto-change-password-btn'),
            changePasswordView: document.getElementById('changePasswordView'),
            chpwUserId: document.getElementById('chpw-user-id') as HTMLInputElement,
            chpwOldPassword: document.getElementById('chpw-old-password') as HTMLInputElement,
            chpwNewPassword: document.getElementById('chpw-new-password') as HTMLInputElement,
            chpwNewPasswordConfirm: document.getElementById('chpw-new-password-confirm') as HTMLInputElement,
            chpwSubmitBtn: document.getElementById('chpw-submit-btn'),
            chpwCancelBtn: document.getElementById('chpw-cancel-btn'),
            clientCursorBase: document.getElementById('client-cursor-base'),
        };

        //ルーラーエレメント
        const targetDiv = this.elements.rulerDiv;
        for(let y = 0; y < 300; y++){
            const d = document.createElement("div");
            d.className = "rurler_y";
            d.style.left = "-5px";
            d.style.top =  (y * 100) + "px";
            targetDiv.appendChild(d);
            if(y % 10 ==0){
                d.style.width = "60px";
            } else if(y % 5 ==0){
                d.style.width = "40px";
            }
        }
        for(let x = 0; x < 400; x++){
            const d = document.createElement("div");
            d.className = "rurler_x";
            d.style.left = (x * 100) + "px";
            d.style.top =  "-5px";
            targetDiv.appendChild(d);
            if(x % 10 ==0){
                d.style.height = "60px";
            } else if(x % 5 ==0){
                d.style.height = "40px";
            }
        }
    }

    private showRightClickMenu(e:MouseEvent):void{
        e.preventDefault();
        // マウスの位置にメニューを移動
        this.elements.rightMenuPanel.style.left = `${e.pageX}px`;
        this.elements.rightMenuPanel.style.top = `${e.pageY}px`;
        //表示/非表示切り替え
        if(!Object.hasOwn(e, 'isVisible') || (e as any).isVisible == "true"){
            this.elements.rightMenuSetHide.style.display = "block";
            this.elements.rightMenuSetVisible.style.display = "none";
        } else {
            this.elements.rightMenuSetHide.style.display = "none";
            this.elements.rightMenuSetVisible.style.display = "block";
        }
        // 表示させる
        this.elements.rightMenuWap.style.display = 'block';
    }


    // =========================================================================
    // イベントリスナー初期化
    // =========================================================================

    private updateLangButtons(): void {
        const locale = currentLocale();
        const switcher = this.elements.langSwitcher as HTMLElement | null;
        switcher?.querySelectorAll<HTMLButtonElement>('.lang-seg-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === locale);
        });
        const loginSwitcher = this.elements.loginLangSwitcher as HTMLElement | null;
        loginSwitcher?.querySelectorAll<HTMLButtonElement>('.lang-seg-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === locale);
        });
    }

    private initEventListeners(): void {
        this.elements.loginForm?.addEventListener('submit', (e: Event) => {
            e.preventDefault();
            this.login();
        });
        this.elements.loginBtn?.addEventListener('click', () => this.login());
        this.elements.userId?.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.elements.password?.focus();
            }
        });
        this.elements.password?.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.login();
        });
        this.elements.logoutBtn?.addEventListener('click', () => this.logout());
        this.elements.gotoChangePasswordBtn?.addEventListener('click', () => this.showChangePasswordView());
        this.elements.chpwSubmitBtn?.addEventListener('click', () => this.submitChangeOwnPassword());
        this.elements.chpwCancelBtn?.addEventListener('click', () => this.hideChangePasswordView());
        (this.elements.langSwitcher as HTMLElement | null)?.addEventListener('click', async (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lang-seg-btn');
            if (!btn) return;
            const lang = btn.getAttribute('data-lang') as Locale;
            if (lang && lang !== currentLocale()) {
                await setLocale(lang);
                this.updateLangButtons();
            }
        });
        (this.elements.loginLangSwitcher as HTMLElement | null)?.addEventListener('click', async (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lang-seg-btn');
            if (!btn) return;
            const lang = btn.getAttribute('data-lang') as Locale;
            if (lang && lang !== currentLocale()) {
                await setLocale(lang);
                this.updateLangButtons();
            }
        });
        this.elements.createUserBtn?.addEventListener('click', () => { this.createUser(); });
        this.elements.refreshUserListBtn?.addEventListener('click', () => { this.getUserList(); });
        this.elements.userListChangePwBtn?.addEventListener('click', () => { this.toggleChangePwForm(); });
        this.elements.userListDeleteBtn?.addEventListener('click', () => { this.deleteSelectedUser(); });
        this.elements.userListPwConfirmBtn?.addEventListener('click', () => { this.changeSelectedUserPassword(); });
        this.elements.addContentBtn?.addEventListener('click', () => this.contentManager.addContent());
        this.elements.deleteBtn?.addEventListener('click', () => this.contentManager.deleteContent());
        this.elements.deleteBtnD?.addEventListener('click', async (): Promise<void> => {
            if (!this.auth.isAdmin()) {
                return;
            }
            await this.displayManager.deleteSelectedDisplay();
        });
        this.elements.refreshDisplaysBtn?.addEventListener('click', async () => {
            await this.displayManager.refreshDisplays();
            await this.wsClient.sendCommand('RefreshDisplayContent', {});
        });
        this.elements.startCameraBtn?.addEventListener('click', () => this.liveStreamController.startCamera());
        this.elements.startScreenBtn?.addEventListener('click', () => this.liveStreamController.startScreenShare());
        this.elements.startVideoFileBtn?.addEventListener('click', () => this.liveStreamController.startVideoFileShare());
        this.elements.createSiteBtn?.addEventListener('click', () => this.siteManager.createSite());
        (this.elements.fontColor as HTMLInputElement)?.addEventListener('input', (e) => {
            const color = (e.target as HTMLInputElement).value;
            //if (this.elements.addContentFontColorPreview) (this.elements.addContentFontColorPreview as HTMLElement).style.backgroundColor = color;
            // if (this.elements.addContentFontColorHex) this.elements.addContentFontColorHex.textContent = color;
        });
        (this.elements.editContentFontColor as HTMLInputElement)?.addEventListener('input', (e) => {
            const color = (e.target as HTMLInputElement).value;
        });
        (this.elements.newSiteColor as HTMLInputElement)?.addEventListener('input', (e) => {
            const color = (e.target as HTMLInputElement).value;
            if (this.elements.newSiteColorPreview) (this.elements.newSiteColorPreview as HTMLElement).style.backgroundColor = color;
            if (this.elements.newSiteColorHex) this.elements.newSiteColorHex.textContent = color;
        });
        this.elements.toggleLeftBtn?.addEventListener('click', () => this.toggleLeftPanel());
        this.elements.toggleRightBtn?.addEventListener('click', () => this.toggleRightPanel());
        this.elements.saveLayoutBtn?.addEventListener('click', () => this.layoutManager.saveLayout());
        this.elements.restoreLayoutBtn?.addEventListener('click', () => this.layoutManager.restoreLayout());
        this.elements.deleteLayoutBtn?.addEventListener('click', () => this.layoutManager.deleteLayout());
        this.elements.addTileimageBtn?.addEventListener('click', () => this.contentManager.addTileimage());
        this.elements.openItowns2Btn?.addEventListener('click', () => this.openItowns2());
        this.loadItowns2ContentOptions();

        this.elements.pendingDisplays?.addEventListener('click', (e: Event) => e.stopPropagation());

        Array.from(this.elements.modalView.children).forEach( child => {
            const childEl = child as HTMLElement;
            childEl.addEventListener('click', (e: Event) => e.stopPropagation());
        });

        this.elements.modalView?.addEventListener('click', () => {
            this.elements.modalView.style.display = 'none';
        });

        this.elements.contentVisible?.addEventListener('change', (e: Event) => {
            e.stopPropagation();
        });

        // Visible状態変更時のリスナーは ContentManager で設定

        this.elements.changeModeContent?.addEventListener('click', () => {
            this.contentManager.resetSelectedMetadata();
            this.displayManager.selectDisplay(null, null);

            document.querySelectorAll<HTMLElement>('[data-panel-group="content"]').forEach((el) => { el.style.display = ''; });
            document.querySelectorAll<HTMLElement>('[data-panel-group="display"]').forEach((el) => { el.style.display = 'none'; });
            const displaysChildren = this.elements.previewDisplay.children;
            Array.from<HTMLElement>(displaysChildren).forEach((el) => {
                if (el.matches('div') || el.matches('svg')) {
                    el.style.display = 'none';
                }
             });
            this.renderAllSiteGrid();
            this.elements.previewContent.style.zIndex = '10';
            this.elements.previewContent.style.opacity = '1.0';
            this.elements.previewDisplay.style.zIndex = '1';
            this.elements.previewDisplay.style.opacity = '0.3';
            this.nowModeNum = 1;
            this.elements.changeModeClear.style.display = "block";
        });

        this.elements.changeModeDisplay?.addEventListener('click', () => {
            this.contentManager.resetSelectedMetadata();
            const selectedSite = this.siteManager.currentSiteId;
            if(selectedSite == null || selectedSite.length == 0 ){
                this.siteManager.selectDefaultsite();
            }
            this.siteManager.filterSites(this.siteManager.currentSiteId);
            this.displayManager.selectDisplay(null, null);

            document.querySelectorAll<HTMLElement>('[data-panel-group="content"]').forEach((el) => { el.style.display = 'none'; });
            document.querySelectorAll<HTMLElement>('[data-panel-group="display"]').forEach((el) => { el.style.display = ''; });
            this.elements.previewContent.style.zIndex = '1';
            this.elements.previewContent.style.opacity = '0.3';
            this.elements.previewDisplay.style.zIndex = '10';
            this.elements.previewDisplay.style.opacity = '1.0';
            this.nowModeNum = 2;
            this.elements.changeModeClear.style.display = "block";
        });

        this.elements.changeModeClear?.addEventListener('click', () => {
            document.querySelectorAll<HTMLElement>('[data-panel-group="content"]').forEach((el) => { el.style.display = 'none'; });
            document.querySelectorAll<HTMLElement>('[data-panel-group="display"]').forEach((el) => { el.style.display = 'none'; });
            this.elements.changeModeClear.style.display = "none";
        });

        this.elements.showAdminConfigButton?.addEventListener('click', () => {
            this.setVisiblePendingList(true);
        });

        this.elements.changeModeClear?.click();
        if (this.elements.changeModeContent) this.elements.changeModeContent.style.display = 'none';
        if (this.elements.changeModeDisplay) this.elements.changeModeDisplay.style.display = 'none';
        if (this.elements.changeModeClear) this.elements.changeModeClear.style.display = 'none';
        if (this.elements.logoutBtn) this.elements.logoutBtn.style.display = 'none';
        if (this.elements.showAdminConfigButton) this.elements.showAdminConfigButton.style.display = 'none';

        // タブ切替
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');
        tabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                tabButtons.forEach((btn) => btn.classList.remove('active'));
                tabPanels.forEach((panel) => panel.classList.remove('active'));
                button.classList.add('active');
                const targetId = button.getAttribute('data-target');
                if (targetId) document.getElementById(targetId)?.classList.add('active');
                const useSubmitButton = button.getAttribute('data-useSubmit');
                if (this.elements.addContentBtn) {
                    this.elements.addContentBtn.style.display = useSubmitButton ? 'block' : 'none';
                }
            });
        });

        // content-info パネル
        const getEditTextValue = () =>
            this.elements.editTextInput.value.trim().replace(/^"|"$/g, '');
        const getEditFontColor = () =>
            this.elements.editContentFontColor?.value ?? '#ffffff';

        const pushContentUpdate = async (e:Event) => {
            const cd = this.contentManager.selectedMetadataId;
            if (!cd) return;
            const elem = document.querySelector(`[data-metadata-id="${this.contentManager.selectedMetadataId}"]`)  as HTMLInputElement;
            if (!elem) { console.log("notFound Content!! :" , cd);  return;}

            elem.dataset.worldX = this.elements.posX.value;
            elem.dataset.worldY = this.elements.posY.value;
            elem.dataset.width = this.elements.width.value;
            elem.dataset.height = this.elements.height.value;
            elem.style.zIndex = this.elements.zIndex.value;

            const updateData = this.contentManager.createUpdateStock(elem as HTMLInputElement);
            if (!updateData) return;

            //metaBinaryの更新が必要な場合1
            if(this.elements.infoContentType.innerText == "text"){
                const textVal = getEditTextValue();
                const fontColor = getEditFontColor();
                const bufferStr = JSON.stringify({
                    type: 'text',
                    value: textVal,
                    fontColor,
                });
                const arrayBuffer = new TextEncoder().encode(bufferStr).buffer;
                this.log('Update content Binary!..', 'info');
                await this.wsClient.sendBinaryCommand('UpdateContent', updateData, arrayBuffer!);
                // サムネイルをローカル即時更新（サーバーのブロードキャスト待ちなし）
                this.contentManager.updateTextThumbnailLocal(cd, textVal, fontColor);
                // コントローラ側VDA表示も即時更新
                this.contentManager.updateTextContentPreview(cd, textVal, fontColor);
            }

        };
        this.elements.posX?.addEventListener('change', pushContentUpdate);
        this.elements.posY?.addEventListener('change', pushContentUpdate);
        this.elements.width?.addEventListener('change', pushContentUpdate);
        this.elements.height?.addEventListener('change', pushContentUpdate);
        this.elements.zIndex?.addEventListener('change', pushContentUpdate);
        this.elements.toggleContentVisible?.addEventListener('change', pushContentUpdate);
        this.elements.editTextInput?.addEventListener('change', pushContentUpdate);
        this.elements.editContentFontColor?.addEventListener('change', pushContentUpdate);

        // display-info パネル
        const pushDisplayUpdate = () => {
            const wd = this.displayManager.selectedWindowData;
            if (!wd) return;
            this.updateStock.push({
                windowId: wd.id,
                type: 'display',
                posx: Number((this.elements.posXD as HTMLInputElement).value),
                posy: Number((this.elements.posYD as HTMLInputElement).value),
                width: Number((this.elements.widthD as HTMLInputElement).value),
                height: Number((this.elements.heightD as HTMLInputElement).value),
                visible: Boolean((this.elements.toggleDisplayVisible as HTMLInputElement).checked),
                originWidth: wd.pixelWidth,
                originHeight: wd.pixelHeight,
                zindex:1
            });
        };
        this.elements.posXD?.addEventListener('change', pushDisplayUpdate);
        this.elements.posYD?.addEventListener('change', pushDisplayUpdate);
        this.elements.widthD?.addEventListener('change', pushDisplayUpdate);
        this.elements.heightD?.addEventListener('change', pushDisplayUpdate);
        this.elements.toggleDisplayVisible?.addEventListener('change', pushDisplayUpdate);

        // VDA 設定変更
        const onVDAChange = () => this.updateVDASettings();
        this.elements.vdaGridX?.addEventListener('change', onVDAChange);
        this.elements.vdaGridY?.addEventListener('change', onVDAChange);
        this.elements.vdaWidth?.addEventListener('change', onVDAChange);
        this.elements.vdaHeight?.addEventListener('change', onVDAChange);

        this.elements.adminDisplayButton?.addEventListener('click', () => this.setAdminPanelDisplay(this.elements.adminDisplayPanel));
        this.elements.adminUseryButton?.addEventListener('click', () => this.setAdminPanelDisplay(this.elements.adminUseryPanel));

        this.elements.rightMenuWap?.addEventListener('click', () => {
            this.elements.rightMenuWap.style.display = 'none';
        });
         this.elements.rightMenuWap?.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
            this.elements.rightMenuWap.style.display = 'none';
        });

        this.elements.rightMenutoTop?.addEventListener('click', () => this.contentManager.contentMoveToMostTopBack(1));
        this.elements.rightMenutoTop?.addEventListener('contextmenu', (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); this.contentManager.contentMoveToMostTopBack(1); });
        this.elements.rightMenutoBack?.addEventListener('click', () =>this.contentManager.contentMoveToMostTopBack(-1));
        this.elements.rightMenutoBack?.addEventListener('contextmenu', (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); this.contentManager.contentMoveToMostTopBack(-1); });
        this.elements.rightMenuSetHide?.addEventListener('click', () =>this.contentManager.contentSetVisible(false));
        this.elements.rightMenuSetHide?.addEventListener('contextmenu', (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); this.contentManager.contentSetVisible(false); });
        this.elements.rightMenuSetVisible?.addEventListener('click', () =>this.contentManager.contentSetVisible(true));
        this.elements.rightMenuSetVisible?.addEventListener('contextmenu', (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); this.contentManager.contentSetVisible(true); });
    }


    // =========================================================================
    // ViewArea イベントリスナー（パン・ズーム）
    // =========================================================================

    private setupViewAreaEventListeners(): void {
        const viewArea = this.elements.loginedView;
        if (!viewArea) return;

        viewArea.addEventListener('contextmenu', (e: Event) => e.preventDefault());

        viewArea.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button === 2) {
                e.preventDefault();
                this.dragState.isDragging = true;
                this.dragState.startX = e.clientX;
                this.dragState.startY = e.clientY;
                this.dragState.startCenterX = this.viewport.centerX;
                this.dragState.startCenterY = this.viewport.centerY;
                viewArea.classList.add('dragging');
            }
        });

        viewArea.addEventListener('mousemove', (e: MouseEvent) => {
            if (this.dragState.isDragging) {
                this.viewport.centerX = this.dragState.startCenterX + (e.clientX - this.dragState.startX);
                this.viewport.centerY = this.dragState.startCenterY + (e.clientY - this.dragState.startY);
                this.renderViewArea();
            } else {
                this.lastMousePos.x = e.clientX;
                this.lastMousePos.y = e.clientY;
                this.hasMouseMoved = true;
            }
        });

        viewArea.addEventListener('mouseup', (e: MouseEvent) => {
            if (e.button === 2) {
                this.dragState.isDragging = false;
                viewArea.classList.remove('dragging');
            }
        });

        viewArea.addEventListener('mouseleave', () => {
            if (this.dragState.isDragging) {
                this.dragState.isDragging = false;
                viewArea.classList.remove('dragging');
            }
        });

        viewArea.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            const rect = this.elements.viewArea.getBoundingClientRect();
            const transformOrigin = this.getTransformOriginPixels(this.elements.viewArea, rect.width, rect.height);
            this.viewport.zoomAtClientPoint(
                factor,
                e.clientX,
                e.clientY,
                rect.left,
                rect.top,
                transformOrigin.x,
                transformOrigin.y,
            );
            if (this.nativeScaleClass) {
                this.nativeScaleClass.style.transform = `scale(${1.0 / this.viewport.zoom})`;
            }
            this.renderViewArea();
        });

        viewArea.addEventListener('dragover', (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes('Files')) { return; }
            e.preventDefault();
            if (e.dataTransfer) { e.dataTransfer.dropEffect = 'copy'; }
            viewArea.classList.add('drag-over');
        });

        viewArea.addEventListener('dragleave', (e: DragEvent) => {
            if (!viewArea.contains(e.relatedTarget as Node | null)) {
                viewArea.classList.remove('drag-over');
            }
        });

        viewArea.addEventListener('drop', (e: DragEvent) => {
            e.preventDefault();
            viewArea.classList.remove('drag-over');
            const file = e.dataTransfer?.files?.[0];
            if (file === undefined) { return; }
            this.contentManager.addFileWithAutoDetection(file).catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                this.log(`Failed to add content: ${message}`, 'error');
            });
        });

        window.addEventListener('resize', () => {
            this.viewport.resize(window.innerWidth, window.innerHeight - 80);
            this.renderViewArea();
        });

        // UI パネルとモードボタンのイベントを loginedView に到達させない
        const panels = document.querySelectorAll<HTMLElement>(
            '[data-panel-group], #mode-button-1, #mode-button-2'
        );
        panels.forEach((panel) => {
            panel.addEventListener('click', (e) => e.stopPropagation());
            panel.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
        });

        // #view-area は transform/left の動的変更でヒット範囲が変わるため、
        // フルビューポートをカバーする loginedView (=viewArea変数) 側で空白クリックを捕捉する。
        viewArea.addEventListener('click', (e: MouseEvent) => {
            if (e.button !== 0) return;
            const target = e.target as HTMLElement;
            if (target.closest('[id^="_manip_"]')) return;

            if (this.nowModeNum === 1) {
                if (!target.closest('.content-item')) {
                    this.contentManager.resetSelectedMetadata();
                }
            } else if (this.nowModeNum === 2) {
                if (!target.closest('.window-frame')) {
                    this.displayManager.selectDisplay(null, null);
                }
            }
        });
    }

    // =========================================================================
    // ログ
    // =========================================================================

    private log(message: string, type: 'info' | 'error' | 'success' = 'info'): void {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        this.elements.log?.prepend(entry);
        while (this.elements.log?.children.length > 100) {
            this.elements.log.removeChild(this.elements.log.lastChild!);
        }
        console.log(`[${type.toUpperCase()}] [${new Date().toLocaleTimeString()}] ${message}`);
    }

    // =========================================================================
    // サーバー設定取得
    // =========================================================================

    private async fetchServerConfig(): Promise<void> {
        try {
            const config = await this.wsClient.sendCommand('GetServerConfig');
            if (config?.tileImage) {
                this.contentManager.setTileThresholds({
                    width: config.tileImage.widthThreshold,
                    height: config.tileImage.heightThreshold,
                });
            } else {
                const msg = 'サーバー設定の取得に失敗しました（レスポンス形式が不正です）。';
                this.log(msg, 'error');
                console.error('[ChOWDERClient] fetchServerConfig: invalid response', config);
            }
        } catch (err) {
            const msg = 'サーバー設定の取得に失敗しました。再接続してください。';
            this.log(msg, 'error');
            console.error('[ChOWDERClient] fetchServerConfig failed:', err);
        }
    }

    // =========================================================================
    // メインループ
    // =========================================================================

    private async frameUpdate(): Promise<void> {
        requestAnimationFrame(() => this.frameUpdate());
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastTime;
        if (deltaTime < this.interval) return;

        this.lastTime = currentTime - (deltaTime % this.interval);

        const stockSnapshot = this.updateStock.slice();
        this.updateStock = [];

        const updatedIds: string[] = [];
        for (let i = stockSnapshot.length - 1; i >= 0; i--) {
            const item = stockSnapshot[i];
            const itemId = item.type === 'display' ? item.windowId : item.metadataId;
            if (updatedIds.includes(itemId)) {
                continue;
            }
            if (item.type === 'display') {
                await this.wsClient.sendCommand('UpdateWindowMetaData', {
                    id: item.windowId,
                    posx: item.posx,
                    posy: item.posy,
                    visible: item.visible,
                    virtualWidth: item.width,
                    virtualHeight: item.height,
                    pixelWidth: item.originWidth,
                    pixelHeight: item.originHeight,
                });
            } else if (item.contentType === 'webgl') {
                // WebGLコンテンツは位置・サイズのみの変更なので UpdateMetaData で通知。
                // ディスプレイ側の iframe を再生成せずに済む。
                await this.wsClient.sendCommand('UpdateMetaData', {
                    metadataId: item.metadataId,
                    posx: item.posx,
                    posy: item.posy,
                    visible: item.visible,
                    width: item.width,
                    height: item.height,
                    zindex: item.zindex,
                });
            } else {
                await this.wsClient.sendCommand('UpdateContent', {
                    metadataId: item.metadataId,
                    posx: item.posx,
                    posy: item.posy,
                    visible: item.visible,
                    width: item.width,
                    height: item.height,
                    zindex: item.zindex,
                });
            }
            updatedIds.push(itemId);
        }

        //マウスカーソル位置のSend
        if (this.hasMouseMoved && this.auth.socketId) {
            this.hasMouseMoved = false;
            const rect = this.elements.viewArea.getBoundingClientRect();
            const viewportLeft = rect.left;
            const viewportTop = rect.top;
            await this.wsClient.sendCommand('UpdateMouseCursor', { socketId: this.auth.socketId, userId: this.auth.currentUser, data:{x:(this.lastMousePos.x - viewportLeft) / this.viewport.zoom, y:(this.lastMousePos.y - viewportTop) / this.viewport.zoom}  });
        }
    }

    // =========================================================================
    // UI ヘルパー
    // =========================================================================

    private toggleLeftPanel(): void {
        const panel = this.elements.leftPanel;
        const btn = this.elements.toggleLeftBtn;
        if (!panel || !btn) return;
        const isVisible = panel.classList.contains('visible');
        panel.classList.toggle('visible', !isVisible);
        btn.classList.toggle('panel-open', !isVisible);
        btn.textContent = isVisible ? '▶' : '◀';
    }

    private toggleRightPanel(): void {
        const panel = this.elements.rightPanel;
        const btn = this.elements.toggleRightBtn;
        if (!panel || !btn) return;
        const isVisible = panel.classList.contains('visible');
        panel.classList.toggle('visible', !isVisible);
        btn.classList.toggle('panel-open', !isVisible);
        btn.textContent = isVisible ? '◀' : '▶';
    }

    private updateEditDisplayDeleteButtonState(isDisplaySelected: boolean | null = null): void {
        const deleteBtn = this.elements.deleteBtnD as HTMLButtonElement | null;
        if (deleteBtn === null) {
            return;
        }

        const hasSelection = isDisplaySelected !== null
            ? isDisplaySelected
            : this.displayManager.selectedDisplayId !== null && this.displayManager.selectedWindowData !== null;

        deleteBtn.disabled = !(this.auth.isAdmin() && hasSelection);
    }

    private onDisplaySelected(displayId: string | null, windowData: any | null): void {
        const posXD = this.elements.posXD as HTMLInputElement;
        const posYD = this.elements.posYD as HTMLInputElement;
        const widthD = this.elements.widthD as HTMLInputElement;
        const heightD = this.elements.heightD as HTMLInputElement;
        const toggleVisible = this.elements.toggleDisplayVisible as HTMLInputElement;
        const displayName = this.elements.displayNameInInfo as HTMLElement;
        const displayInfoBody = this.elements.displayInfoBody as HTMLElement | null;

        if (displayId !== null && windowData !== null) {
            if (displayInfoBody) displayInfoBody.style.display = 'block';
            displayName.innerText = windowData.displayName;
            displayName.dataset.displayId = displayId;
            posXD.value = String(Math.round(windowData.posx ?? 0));
            posYD.value = String(Math.round(windowData.posy ?? 0));
            widthD.value = String(Math.round(windowData.virtualWidth ?? 0));
            heightD.value = String(Math.round(windowData.virtualHeight ?? 0));
            const visible = windowData.contentVisible !== false;
            toggleVisible.checked = visible;
            toggleVisible.dataset.checked = String(visible);
            this.updateEditDisplayDeleteButtonState(true);
        } else {
            if (displayInfoBody) displayInfoBody.style.display = 'none';
            displayName.innerText = "";
            displayName.dataset.displayId = "";
            posXD.value = '';
            posYD.value = '';
            widthD.value = '';
            heightD.value = '';
            toggleVisible.checked = true;
            toggleVisible.dataset.checked = 'true';
            this.updateEditDisplayDeleteButtonState(false);
        }
    }

    private getSelectedDisplayId():string {
        const displayName = this.elements.displayNameInInfo as HTMLElement;
        const refstr = displayName.dataset.displayId;
        return refstr? refstr : "";
    }

    private refreshVDASettings(siteId: string | null): void {
        if (this.elements.sitenameScm) {
            if (siteId) {
                const site = this.siteManager.sites.find((s: any) => s.siteId === siteId);
                this.elements.sitenameScm.textContent = site ? `🏢 ${site.siteName}` : '';
            } else {
                this.elements.sitenameScm.textContent = '';
            }
        }

        const site = siteId ? this.siteManager.sites.find((s: any) => s.siteId === siteId) : null;
        const ds = site?.displaySpace;
        if (ds) {
            (this.elements.vdaGridX as HTMLInputElement).value = String(ds.splitX ?? 4);
            (this.elements.vdaGridY as HTMLInputElement).value = String(ds.splitY ?? 4);
            (this.elements.vdaWidth as HTMLInputElement).value = String(ds.virtualWidth ?? 1024);
            (this.elements.vdaHeight as HTMLInputElement).value = String(ds.virtualHeight ?? 1024);
        }
    }

    private async updateVDASettings(): Promise<void> {
        const siteId = this.siteManager.currentSiteId;
        if (!siteId) return;
        try {
            await this.wsClient.sendCommand('UpdateDisplaySpace', {
                siteId,
                splitX: Number((this.elements.vdaGridX as HTMLInputElement).value),
                splitY: Number((this.elements.vdaGridY as HTMLInputElement).value),
                virtualWidth: Number((this.elements.vdaWidth as HTMLInputElement).value),
                virtualHeight: Number((this.elements.vdaHeight as HTMLInputElement).value),
            });
        } catch (error: any) {
            this.log(`Failed to update display space: ${error.message}`, 'error');
        }
    }
    private updateStatus(status: 'connected' | 'disconnected', text: string): void {
        if (this.elements.status) {
            this.elements.status.className = `status ${status}`;
            this.elements.status.textContent = text;
        }
    }

    private updateAuthStatus(): void {
        if (this.elements.authStatus) {
            if (this.auth.isAuthenticated && this.auth.currentUser) {
                this.elements.authStatus.className = 'status authenticated';
                this.elements.authStatus.textContent = `Logged in: ${this.auth.currentUser} (${this.auth.currentRole})`;
            }
            this.elements.authStatus.style.display = 'none';
        }
    }

    setVisiblePendingList(flg: boolean): void {
        this.setAdminPanelDisplay(this.elements.adminDisplayPanel);
        if (this.elements.modalView) {
            this.elements.modalView.style.display = flg ? 'grid' : 'none';
        }
    }

    setVisibleAdminMenu(flg: boolean): void {
        if (this.elements.modalView) {
            this.elements.modalView.style.display = flg ? 'grid' : 'none';
        }
    }

    setAdminPanelDisplay (elm : HTMLElement): void{
        const panelArray = [this.elements.adminDisplayPanel, this.elements.adminUseryPanel];
        panelArray.forEach(element => {
            if(elm == element){
                element.style.display = "flex";
            } else {
                element.style.display = "none";
            }
        });
    }


    private renderViewArea(): void {
        if (!this.elements.viewArea) return;
        this.elements.viewArea.style.transform = `scale(${this.viewport.zoom})`;
        this.elements.viewArea.style.left = `${this.viewport.centerX}px`;
        this.elements.viewArea.style.top = `${this.viewport.centerY}px`;
        this.clientCursor.updateAllCursorScales(this.viewport.zoom);
        const selectedId = this.nowModeNum == 1? this.contentManager.selectedMetadataId : this.displayManager.selectedDisplayId;
        if (selectedId) {
            const elem = document.getElementById(`view-${selectedId}`);
            if (elem) this.manipulator.showManipulator(elem, this.elements.viewArea, this.viewport.zoom);
        }
    }

    private getTransformOriginPixels(target: HTMLElement, boxWidth: number, boxHeight: number): { x: number; y: number } {
        const style = window.getComputedStyle(target);
        const parts = style.transformOrigin.trim().split(/\s+/);

        const toPx = (value: string | undefined, size: number, axis: 'x' | 'y'): number => {
            if (value === undefined) {
                return axis === 'x' ? boxWidth / 2 : boxHeight / 2;
            }
            if (value.endsWith('px')) {
                const parsed = Number.parseFloat(value);
                return Number.isFinite(parsed) ? parsed : (axis === 'x' ? boxWidth / 2 : boxHeight / 2);
            }
            if (value.endsWith('%')) {
                const parsed = Number.parseFloat(value);
                if (!Number.isFinite(parsed)) {
                    return axis === 'x' ? boxWidth / 2 : boxHeight / 2;
                }
                return size * parsed / 100;
            }
            if (value === 'left' || value === 'top') {
                return 0;
            }
            if (value === 'right') {
                return boxWidth;
            }
            if (value === 'bottom') {
                return boxHeight;
            }
            if (value === 'center') {
                return axis === 'x' ? boxWidth / 2 : boxHeight / 2;
            }

            const parsed = Number.parseFloat(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
            return axis === 'x' ? boxWidth / 2 : boxHeight / 2;
        };

        const originX = toPx(parts[0], boxWidth, 'x');
        const originY = toPx(parts[1], boxHeight, 'y');
        return { x: originX, y: originY };
    }

    /**
     * 指定サイトの DisplaySpace グリッドを SVG で描画
     */
    private renderSiteGrid(siteId: string | null): void {
        const svg = this.elements.siteGridOverlay;
        if (!svg) return;
        if (!siteId) { svg.style.display = 'none'; return; }

        const site = this.siteManager.sites.find((s: any) => s.siteId === siteId);
        if (!site?.displaySpace) { svg.style.display = 'none'; return; }

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
        rect.setAttribute('fill', '#ffffff10');
        rect.setAttribute('stroke', '#ffffff');
        rect.setAttribute('stroke-width', '2');
        svg.appendChild(rect);

        for (let i = 1; i < splitX; i++) {
            const x = Math.round(virtualWidth * i / splitX);
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', String(x)); line.setAttribute('y1', '0');
            line.setAttribute('x2', String(x)); line.setAttribute('y2', String(virtualHeight));
            line.setAttribute('stroke', '#ffffff'); line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
        }

        for (let j = 1; j < splitY; j++) {
            const y = Math.round(virtualHeight * j / splitY);
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', '0'); line.setAttribute('y1', String(y));
            line.setAttribute('x2', String(virtualWidth)); line.setAttribute('y2', String(y));
            line.setAttribute('stroke', '#ffffff'); line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
        }

        svg.style.display = 'block';
    }


    /**
     * 全サイトの DisplaySpace グリッドを SVG で描画
     */
    private renderAllSiteGrid(): void {
        const svg = this.elements.siteGridOverlay;
        if (!svg) return;

        while (svg.firstChild) svg.removeChild(svg.firstChild);
        svg.setAttribute('width', String(65535));
        svg.setAttribute('height', String(65535));
        this.siteManager.sites.forEach(site => {
            // if (!site?.displaySpace) { continue; }

            const { virtualWidth, virtualHeight, splitX, splitY } = site.displaySpace;

            // while (svg.firstChild) svg.removeChild(svg.firstChild);

            const ns = 'http://www.w3.org/2000/svg';

            const rect = document.createElementNS(ns, 'rect');
            rect.setAttribute('x', '0');
            rect.setAttribute('y', '0');
            rect.setAttribute('width', String(virtualWidth));
            rect.setAttribute('height', String(virtualHeight));
            rect.setAttribute('fill', '#ffffff01');
            rect.setAttribute('stroke', '#ffffff');
            rect.setAttribute('stroke-width', '2');
            svg.appendChild(rect);

            for (let i = 1; i < splitX; i++) {
                const x = Math.round(virtualWidth * i / splitX);
                const line = document.createElementNS(ns, 'line');
                line.setAttribute('x1', String(x)); line.setAttribute('y1', '0');
                line.setAttribute('x2', String(x)); line.setAttribute('y2', String(virtualHeight));
                line.setAttribute('stroke', '#ffffff'); line.setAttribute('stroke-width', '2');
                svg.appendChild(line);
            }

            for (let j = 1; j < splitY; j++) {
                const y = Math.round(virtualHeight * j / splitY);
                const line = document.createElementNS(ns, 'line');
                line.setAttribute('x1', '0'); line.setAttribute('y1', String(y));
                line.setAttribute('x2', String(virtualWidth)); line.setAttribute('y2', String(y));
                line.setAttribute('stroke', '#ffffff'); line.setAttribute('stroke-width', '2');
                svg.appendChild(line);
            }

        });

        svg.style.display = 'block';
    }


    // =========================================================================
    // 認証
    // =========================================================================

    private showChangePasswordView(): void {
        this.elements.beforeLoginView.style.display = 'none';
        this.elements.changePasswordView.style.display = 'flex';
        this.elements.chpwUserId.value = '';
        this.elements.chpwOldPassword.value = '';
        this.elements.chpwNewPassword.value = '';
        this.elements.chpwNewPasswordConfirm.value = '';
    }

    private hideChangePasswordView(): void {
        this.elements.changePasswordView.style.display = 'none';
        this.elements.beforeLoginView.style.display = 'flex';
    }

    private async submitChangeOwnPassword(): Promise<void> {
        const id = this.elements.chpwUserId.value;
        const oldPassword = this.elements.chpwOldPassword.value;
        const newPassword = this.elements.chpwNewPassword.value;
        const confirm = this.elements.chpwNewPasswordConfirm.value;

        if (!id || !oldPassword || !newPassword || !confirm) {
            alert('すべての項目を入力してください。');
            return;
        }
        if (newPassword !== confirm) {
            alert('新しいパスワードと確認用パスワードが一致しません。');
            return;
        }

        try {
            const result = await this.auth.changeOwnPassword(id, oldPassword, newPassword);
            if (result.success) {
                alert('パスワードを変更しました。');
                this.hideChangePasswordView();
            } else {
                alert('パスワードの変更に失敗しました。IDまたは現在のパスワードが正しくありません。');
            }
        } catch (error: any) {
            alert(`パスワードの変更に失敗しました: ${error.message || '不明なエラー'}`);
        }
    }

    async login(): Promise<void> {
        const userId = this.elements.userId.value;
        const password = this.elements.password.value;
        if (!userId || !password) {
            this.log('Please enter user ID and password', 'error');
            return;
        }
        try {
            const result = await this.auth.login(userId, password);
            if (result.success) {
                this.elements.loginedView.style.display = 'block';
                this.elements.beforeLoginView.style.display = 'none';
                (this.elements.loginLangSwitcher as HTMLElement | null)?.style.setProperty('display', 'none');
                this.elements.changeModeContent.style.display = 'block';
                this.elements.changeModeDisplay.style.display = 'block';
                this.elements.changeModeClear.style.display = 'block';
                this.elements.changeModeContent.click();

                this.elements.logoutBtn.style.display = 'block';

                this.updateAuthStatus();
                this.showInitLoading('initLoadingFetchContents');
                await this.contentManager.refreshMetadataList();
                this.updateInitLoading('initLoadingLoadContents', 20);
                await this.contentManager.displayAllContentsOnCanvas();
                this.updateInitLoading('initLoadingFetchDisplays', 65);
                await this.displayManager.displayWindowFrames(this.siteManager.currentSiteId);
                this.updateInitLoading('initLoadingLoadSettings', 80);
                this.enableAuthenticatedFeatures();
                await this.layoutManager.refreshLayoutList();
                this.updateInitLoading('initLoadingComplete', 100);

                // 全ての要素が読み終わったときの処理
                window.setTimeout( ()=>{
                    this.hideInitLoading();
                    this.elements.changeModeContent.click();
                    this.fizZoomAllContent();
                } ,33);

            }
        } catch (error: any) {
            this.log(`Login failed: ${error.message || 'Invalid credentials'}`, 'error');
            const errinfoWap = document.getElementById("errinfoWap");
            if (errinfoWap) errinfoWap.style.display = "block";
            const errInfo2 = document.getElementById("errinfo2");
            if (errInfo2) errInfo2.innerHTML = `${error.message || 'Invalid credentials'}`;
        }
    }

    async logout(): Promise<void> {
        try {
            await this.auth.logout();
            await this.updateAuthStatus();
            await this.disableAuthenticatedFeatures();
            await this.contentManager.clearViewArea();

            location.replace(location.href);
        } catch (error: any) {
            this.log(`Logout failed: ${error.message}`, 'error');
        }
    }

    async createUser(): Promise<void> {
        const userId = this.elements.newUserId.value;
        const password = this.elements.newPassword.value;
        const role = this.elements.newRole.value;
        if (!userId || !password) {
            this.log('Please enter user ID and password', 'error');
            return;
        }
        try {
            await this.auth.createUser(userId, password, role);
            this.elements.newUserId.value = '';
            this.elements.newPassword.value = '';
            await this.getUserList();
        } catch (error: any) {
            this.log(`Failed to create user: ${error.message}`, 'error');
        }
    }

    async getUserList(): Promise<void> {
        try {
            const users = await this.auth.getUserList();
            this.cachedUserList = users;
            const tbody = this.elements.userListBody as HTMLTableSectionElement;
            if (tbody === null) { return; }
            tbody.innerHTML = '';
            this.selectedUserId = null;
            this.updateUserListActions();
            for (const user of users) {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.dataset.userId = user.userId;
                tr.innerHTML = `
                    <td style="padding:4px 8px;">${user.userId}</td>
                    <td style="padding:4px 8px;">${user.role}</td>`;
                tr.addEventListener('click', () => { this.selectUserRow(tr, user.userId); });
                tbody.appendChild(tr);
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            this.log(`Failed to get user list: ${msg}`, 'error');
        }
    }

    private selectUserRow(row: HTMLTableRowElement, userId: string): void {
        const tbody = this.elements.userListBody as HTMLTableSectionElement;
        const alreadySelected = this.selectedUserId === userId;

        // すべての行のハイライトを解除
        for (const tr of Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr'))) {
            tr.style.background = '';
        }

        if (alreadySelected) {
            this.selectedUserId = null;
            this.closePwForm();
        } else {
            this.selectedUserId = userId;
            row.style.background = 'rgba(255,255,255,0.12)';
        }
        this.updateUserListActions();
    }

    private updateUserListActions(): void {
        const changePwBtn = this.elements.userListChangePwBtn as HTMLButtonElement | null;
        const deleteBtn = this.elements.userListDeleteBtn as HTMLButtonElement | null;
        const label = this.elements.userListSelectedLabel as HTMLElement | null;
        const hasSelection = this.selectedUserId !== null;
        if (changePwBtn !== null) { changePwBtn.disabled = !hasSelection; }
        if (deleteBtn !== null) {
            const canDelete = hasSelection && !this.isDeleteForbidden(this.selectedUserId as string);
            deleteBtn.disabled = !canDelete;
        }
        if (label !== null) {
            label.textContent = hasSelection ? `Selected: ${this.selectedUserId}` : '';
        }
        if (!hasSelection) { this.closePwForm(); }
    }

    private isDeleteForbidden(userId: string): boolean {
        if (userId === this.auth.currentUser) { return true; }
        const selectedUser = this.cachedUserList.find((u) => { return u.userId === userId; });
        if (selectedUser !== undefined && selectedUser.role === 'admin') {
            const adminCount = this.cachedUserList.filter((u) => { return u.role === 'admin'; }).length;
            if (adminCount <= 1) { return true; }
        }
        return false;
    }

    private toggleChangePwForm(): void {
        const form = this.elements.userListChangePwForm as HTMLElement | null;
        if (form === null) { return; }
        const isHidden = form.style.display === 'none' || form.style.display === '';
        if (isHidden) {
            form.style.display = 'block';
            const input = this.elements.userListPwInput as HTMLInputElement | null;
            input?.focus();
        } else {
            this.closePwForm();
        }
    }

    private closePwForm(): void {
        const form = this.elements.userListChangePwForm as HTMLElement | null;
        if (form !== null) { form.style.display = 'none'; }
        const input = this.elements.userListPwInput as HTMLInputElement | null;
        if (input !== null) { input.value = ''; }
    }

    private async deleteSelectedUser(): Promise<void> {
        const userId = this.selectedUserId;
        if (userId === null) { return; }
        if (!confirm(`Delete user "${userId}"?`)) { return; }
        try {
            await this.auth.deleteUser(userId);
            await this.getUserList();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            this.log(`Failed to delete user: ${msg}`, 'error');
        }
    }

    private async changeSelectedUserPassword(): Promise<void> {
        const userId = this.selectedUserId;
        if (userId === null) { return; }
        const input = this.elements.userListPwInput as HTMLInputElement | null;
        const newPassword = input?.value ?? '';
        if (newPassword === '') {
            this.log('Please enter a new password', 'error');
            return;
        }
        try {
            await this.auth.changeUserPassword(userId, newPassword);
            this.closePwForm();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            this.log(`Failed to change password: ${msg}`, 'error');
        }
    }

    ///すべてのコンテンツが見えるようにズームを調整する
    private fizZoomAllContent(): void{
        let minX = 655350;
        let maxX = -655350;
        let minY = 655350;
        let maxY = -655350;

        const contentItemsDom = [...this.elements.previewContent.children];
        contentItemsDom.forEach((contentDom: any) => {
            let targetX= Number(contentDom.offsetLeft);
            let targetY= Number(contentDom.offsetTop);
            minX = Math.min(minX, targetX);
            minY = Math.min(minY, targetY);
            targetX += Number(contentDom.offsetWidth);
            targetY += Number(contentDom.offsetHeight);
            maxX = Math.max(maxX, targetX);
            maxY = Math.max(maxY, targetY);
        });

        // ビューポート（画面）のサイズを取得
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const totalWidth = maxX - minX;
        const totalHeight = maxY - minY;
        // ズーム率（スケール）の計算
        const scaleX = viewportWidth / totalWidth;
        const scaleY = viewportHeight / totalHeight;

        // 縦横で「より厳しい方（小さい値）」を採用する
        // ※画面ギリギリだと見づらいので、0.9 を掛けて 10% の余白(マージン)を持たせる
        let zoomLevel = Math.min(scaleX, scaleY) * 0.7;

        // （オプション）ズームしすぎを防ぐ上限・下限の設定
        zoomLevel = Math.max(0.1, Math.min(zoomLevel, 2.0)); // 最小0.1倍、最大2倍まで
        this.viewport.applyZoom(zoomLevel);
        if (this.nativeScaleClass) {
            this.nativeScaleClass.style.transform = `scale(${1.0 / this.viewport.zoom})`;
        }

        const centerX = minX * zoomLevel - (viewportWidth - totalWidth) * zoomLevel / 2;
        const centerY = minY * zoomLevel - (viewportHeight - totalHeight) * zoomLevel / 2;
        this.viewport.centerX = -centerX;
        this.viewport.centerY = -centerY;
        this.renderViewArea();
    }

    // =========================================================================
    // ブロードキャスト処理
    // =========================================================================

    private async handleBroadcast(message: JSONRPCMessage): Promise<void> {
        switch (message.method) {
            case 'AddContent':
            case 'NewContentAdded':
                this.log('🔔 New content added by another user', 'success');
                if (this.auth.isAuthenticated) {
                    this.contentManager.refreshMetadataList();
                    if (message.params?.metadata) {
                        const meta = message.params.metadata;
                        this.contentManager.applyIncomingMetadata({
                            ...meta,
                            zindex: normalizeContentZIndex(meta.zindex),
                        });
                        // 自分が送信した video-file の metadataId を登録して Delete 時の逆引きに使う
                        if (
                            meta.type === 'live-stream' &&
                            meta.subtype === 'video-file' &&
                            meta.socketId === this.auth.socketId &&
                            meta.producerId
                        ) {
                            this.liveStreamController.registerVideoFileMetadata(meta.producerId, meta.metadataId);
                        }
                        await this.contentManager.displayContentOnViewArea(meta);
                    }
                }
                break;

            case 'UpdateMetaData':
                // UpdateMetaData は位置・サイズ変更専用。カメラは UpdateCameraMatrix で処理。
                this.log('🔔 Metadata updated by another user', 'info');
                if (this.auth.isAuthenticated && message.params?.metadata) {
                    const updatedMeta = message.params.metadata;
                    const existingElem = document.getElementById(`view-${updatedMeta.metadataId}`) as HTMLElement | null;
                    const hasWebGLConnector = this.contentManager.webglConnectors.has(updatedMeta.metadataId);
                    const isWebGLMeta = updatedMeta.type === 'webgl'
                        || hasWebGLConnector
                        || existingElem?.dataset.type === 'webgl';
                    if (isWebGLMeta) {
                        if (existingElem) {
                            // 既存要素は常に in-place 更新する（再生成しない）
                            this.contentManager.updateWebGLContentLayout(updatedMeta);
                        } else {
                            // 要素がまだない = 新規作成
                            await this.contentManager.displayContentOnViewArea(updatedMeta);
                        }
                    } else {
                        // 非webglコンテンツ: 要素が存在する場合は位置・サイズのみin-place更新（削除・再作成しない）
                        if (existingElem) {
                            this.contentManager.updateContentLayout(updatedMeta);
                        } else {
                            await this.contentManager.displayContentOnViewArea(updatedMeta);
                        }
                    }
                    this.contentManager.applyIncomingMetadata({
                        ...updatedMeta,
                        zindex: normalizeContentZIndex(updatedMeta.zindex),
                    });
                    this.contentManager.reorderPreviewContentByMetadata();
                    this.contentManager.refreshMetadataList();
                }
                break;

            case 'UpdateCameraMatrix':
                if (this.auth.isAuthenticated && message.params?.metadataId) {
                    const { metadataId, cameraWorldMatrix, cameraParams } = message.params;
                    const webgl = this.contentManager.webglConnectors.get(metadataId);
                    if (webgl && cameraWorldMatrix && cameraParams) {
                        try {
                            webgl.connector.send('UpdateCamera', {
                                mat: JSON.parse(cameraWorldMatrix),
                                params: JSON.parse(cameraParams),
                            });
                        } catch (e) {
                            console.error('[ChOWDERClient] UpdateCamera parse error:', e);
                        }
                    }
                }
                break;

            case 'DeleteContent':
                this.log('🔔 Content deleted by another user', 'info');
                if (this.auth.isAuthenticated) {
                    if (message.params?.metadataId &&
                        message.params.metadataId === this.contentManager.selectedMetadataId) {
                        this.contentManager.resetSelectedMetadata();
                    }
                    this.contentManager.refreshMetadataList();
                    if (message.params?.metadataId) {
                        this.contentManager.removeContentFromViewArea(message.params.metadataId);
                    }
                }
                break;

            case 'NewDisplayConnected': {
                const displayName = message.params?.session?.displayName || 'Unknown';
                this.log(`🔔 New display connected: ${displayName}`, 'info');
                if (this.auth.isAuthenticated) {
                    this.displayManager.refreshDisplays();

                }
                break;
            }

            case 'DisplayListUpdated':
                this.log('🔔 Display list updated', 'info');
                if (this.auth.isAuthenticated) {
                    this.displayManager.refreshDisplays();
                }
                break;

            case 'NewProducerAvailable':
                this.log('🔔 New live stream available', 'success');
                this.liveStreamController.handleNewProducer(message.params, this.contentManager.metadataList);
                break;

            case 'DisplayDisconnected':
                this.log('🔔 Display disconnected', 'info');
                if (this.auth.isAuthenticated) {
                    this.displayManager.refreshDisplays();
                }
                break;

            case 'BulkUpdateMetaData':
                this.log('🔔 BulkUpdateMetaData received', 'info');
                if (this.auth.isAuthenticated && message.params?.metadataList) {
                    const orderedMetadataList = [...message.params.metadataList]
                        .map((metadata) => {
                            return {
                                ...metadata,
                                zindex: normalizeContentZIndex(metadata.zindex),
                            };
                        })
                        .sort(compareContentMetadataForDisplayOrder);
                    for (const metadata of orderedMetadataList) {
                        this.contentManager.applyIncomingMetadata(metadata);
                        const existingElem = document.getElementById(`view-${metadata.metadataId}`) as HTMLElement | null;
                        const hasWebGLConnector = this.contentManager.webglConnectors.has(metadata.metadataId);
                        const isWebGLMeta = metadata.type === 'webgl'
                            || hasWebGLConnector
                            || existingElem?.dataset.type === 'webgl';
                        if (isWebGLMeta) {
                            if (existingElem) {
                                this.contentManager.updateWebGLContentLayout(metadata);
                            } else {
                                await this.contentManager.displayContentOnViewArea(metadata);
                            }
                        } else {
                            if (existingElem) {
                                this.contentManager.updateContentLayout(metadata);
                            } else {
                                await this.contentManager.displayContentOnViewArea(metadata);
                            }
                        }
                    }
                    this.contentManager.reorderPreviewContentByMetadata();
                    this.contentManager.refreshMetadataList();
                }
                break;

            case 'UpdateContent':
                if (message.params) {
                    this.tileUploader.handleUpdateContent(message.params);
                    const updatedMeta = message.params.metadata;
                    if (updatedMeta) {
                        const normalizedUpdatedMeta = {
                            ...updatedMeta,
                            zindex: normalizeContentZIndex(updatedMeta.zindex),
                        };
                        this.contentManager.applyIncomingMetadata(normalizedUpdatedMeta);
                        if (updatedMeta.tileFinished) {
                            // タイル画像の完了通知: 処理中プレースホルダーを削除してから再生成
                            this.contentManager.removeContentFromViewArea(normalizedUpdatedMeta.metadataId);
                            await this.contentManager.displayContentOnViewArea(normalizedUpdatedMeta);
                            this.contentManager.reorderPreviewContentByMetadata();
                            this.contentManager.refreshMetadataList();
                        } else if (updatedMeta.type === 'text' || updatedMeta.type === 'url') {
                            // テキスト・URL コンテンツは内容更新を確実に反映するため、既存要素を再生成する。
                            this.contentManager.invalidateThumbnailCache(normalizedUpdatedMeta.metadataId);
                            this.contentManager.removeContentFromViewArea(normalizedUpdatedMeta.metadataId);
                            await this.contentManager.displayContentOnViewArea(normalizedUpdatedMeta);
                            this.contentManager.reorderPreviewContentByMetadata();
                            if (updatedMeta.type === 'text') {
                                this.contentManager.refreshTextThumbnail(normalizedUpdatedMeta.metadataId);
                            }
                        } else {
                            const existingElem = document.getElementById(`view-${normalizedUpdatedMeta.metadataId}`);
                            const hasWebGLConnector = this.contentManager.webglConnectors.has(normalizedUpdatedMeta.metadataId);
                            const isWebGLMeta = updatedMeta.type === 'webgl'
                                || hasWebGLConnector
                                || ((existingElem as HTMLElement | null)?.dataset.type === 'webgl');
                            if (isWebGLMeta && existingElem) {
                                this.contentManager.updateWebGLContentLayout(normalizedUpdatedMeta);
                                this.contentManager.reorderPreviewContentByMetadata();
                            } else if (isWebGLMeta) {
                                await this.contentManager.displayContentOnViewArea(normalizedUpdatedMeta);
                                this.contentManager.reorderPreviewContentByMetadata();
                            } else {
                                // 画像等のレイアウト更新
                                for (const metadata of this.contentManager.metadataList) {
                                    if(metadata.metadataId == normalizedUpdatedMeta.metadataId){
                                        metadata.posx = normalizedUpdatedMeta.posx;
                                        metadata.posy = normalizedUpdatedMeta.posy;
                                        metadata.width = normalizedUpdatedMeta.width;
                                        metadata.height = normalizedUpdatedMeta.height;
                                        metadata.visible = normalizedUpdatedMeta.visible;
                                        metadata.zindex = normalizedUpdatedMeta.zindex;
                                        this.contentManager.updateContentLayout(normalizedUpdatedMeta);
                                    }
                                }
                                this.contentManager.reorderPreviewContentByMetadata();
                            }
                        }
                    }
                }
                break;

            case 'TileimageProgress': {
                const handler = this.wsClient.getRegisteredBroadcastHandler('TileimageProgress');
                if (handler && message.params) handler(message.params);
                break;
            }

            case 'TileimageUploadFailed': {
                const handler = this.wsClient.getRegisteredBroadcastHandler('TileimageUploadFailed');
                if (handler && message.params) {
                    handler(message.params);
                }
                break;
            }

            case 'ThumbnailUpdated':
                if (this.auth.isAuthenticated && message.params?.metadataId) {
                    const updatedId = message.params.metadataId;
                    // テキストは HTML 表示のためサムネイル PNG を適用しない
                    const updatedMeta = this.contentManager.metadataList.find(m => m.metadataId === updatedId);
                    if (updatedMeta?.type === 'text') break;
                    this.contentManager.invalidateThumbnailCache(updatedId);
                    this.wsClient.sendCommand('GetThumbnail', { metadataId: updatedId })
                        .then((result) => {
                            if (result?.binary) {
                                const base64 = arrayBufferToBase64(result.binary);
                                const dataUrl = `data:image/png;base64,${base64}`;
                                this.contentManager.applyThumbnailToItem(updatedId, dataUrl);
                            }
                        })
                        .catch(() => { /* サムネイルなし */ });
                }
                break;

            case 'UpdateDisplaySpace':
                if (this.auth.isAuthenticated) {
                    this.siteManager.refreshSites().then(() => {
                        this.refreshVDASettings(this.siteManager.currentSiteId);
                    });
                }
                break;

            case 'UpdateWindowMetaData':
                if (this.auth.isAuthenticated && message.params) {
                    const p = Array.isArray(message.params) ? message.params : [message.params];
                    for (const item of p) {
                        this.displayManager.updateWindowFrameByMetaData(item);
                    }
                }
                break;

            case 'ControllerDisconnected':
                this.log('🔔 Controller disconnected', 'info');
                if (message.params) {
                    if(message.params != this.auth.socketId){
                        this.clientCursor.removeCursor(message.params);
                    }
                }
                break;

            case 'SessionRevoked':
                this.log('🔔 Session revoked by server', 'error');
                this.wsClient.stopReconnect();
                this.auth['_isAuthenticated'] = false;
                this.auth['_currentUser'] = null;
                this.auth['_currentRole'] = null;
                this.auth['_socketId'] = null;
                this.updateAuthStatus();
                this.disableAuthenticatedFeatures();
                location.replace(location.href);
                break;

            case 'UpdateMouseCursor':
                //自分以外を対象とする
                // console.log(message.params);
                if (message.params) {
                    if(message.params.socketId != this.auth.socketId){
                        this.clientCursor.updateCursor(message.params, this.viewport.zoom);
                    }
                }
                break;
        }
    }

    // =========================================================================
    // 初期化ローディングオーバーレイ
    // =========================================================================

    private showInitLoading(key: TranslationKey): void {
        this.elements.initLoadingLabel.textContent = t(key);
        this.elements.initLoadingBar.value = 0;
        this.elements.initLoadingOverlay.style.display = 'grid';
    }

    private updateInitLoading(key: TranslationKey, percent: number): void {
        this.elements.initLoadingLabel.textContent = t(key);
        this.elements.initLoadingBar.value = percent;
    }

    private hideInitLoading(): void {
        this.elements.initLoadingOverlay.style.display = 'none';
    }

    // =========================================================================
    // 認証後の機能有効化 / 無効化
    // =========================================================================

    private async enableAuthenticatedFeatures(): Promise<void> {
        this.elements.loginBtn.disabled = true;
        this.elements.logoutBtn.disabled = false;
        this.elements.addContentBtn.disabled = false;
        if (this.elements.addTileimageBtn) this.elements.addTileimageBtn.disabled = false;
        this.elements.startCameraBtn.disabled = false;
        this.elements.startScreenBtn.disabled = false;
        if (this.elements.startVideoFileBtn) (this.elements.startVideoFileBtn as HTMLButtonElement).disabled = false;
        if (this.elements.saveLayoutBtn) (this.elements.saveLayoutBtn as HTMLButtonElement).disabled = false;

        await this.siteManager.refreshSites();
        this.displayManager.refreshDisplays();

        if (this.auth.isAdmin()) {
            this.elements.showAdminConfigButton.style.display = 'block';
            this.elements.refreshDisplaysBtn.disabled = false;
            if (this.elements.createUserBtn) this.elements.createUserBtn.disabled = false;
            if (this.elements.refreshUserListBtn) (this.elements.refreshUserListBtn as HTMLButtonElement).disabled = false;

            if (this.elements.createSiteBtn) this.elements.createSiteBtn.disabled = false;

            await this.getUserList();
        }

        this.updateEditDisplayDeleteButtonState();

        this.liveStreamController.fetchActiveProducers(this.contentManager.metadataList);
    }

    private disableAuthenticatedFeatures(): void {
        this.elements.loginBtn.disabled = false;
        this.elements.logoutBtn.disabled = true;
        if (this.elements.createUserBtn) { this.elements.createUserBtn.disabled = true; }
        if (this.elements.refreshUserListBtn) { (this.elements.refreshUserListBtn as HTMLButtonElement).disabled = true; }
        if (this.elements.userListChangePwBtn) { (this.elements.userListChangePwBtn as HTMLButtonElement).disabled = true; }
        if (this.elements.userListDeleteBtn) { (this.elements.userListDeleteBtn as HTMLButtonElement).disabled = true; }
        this.selectedUserId = null;
        this.cachedUserList = [];
        this.closePwForm();
        const label = this.elements.userListSelectedLabel as HTMLElement | null;
        if (label !== null) { label.textContent = ''; }
        this.elements.addContentBtn.disabled = true;
        if (this.elements.addTileimageBtn) this.elements.addTileimageBtn.disabled = true;
        this.elements.startScreenBtn.disabled = true;
        this.elements.deleteBtn.disabled = true;
        this.elements.refreshDisplaysBtn.disabled = true;
        if (this.elements.saveLayoutBtn) (this.elements.saveLayoutBtn as HTMLButtonElement).disabled = true;
        if (this.elements.cameraStatus) this.elements.cameraStatus.textContent = '';
        if (this.elements.screenStatus) this.elements.screenStatus.textContent = '';
        if (this.elements.createSiteBtn) this.elements.createSiteBtn.disabled = true;
        this.siteManager.clearSites();

        this.liveStreamController.stopAllStreams();
        this.liveStreamController.stopAllVideoFileSessions().catch((err: unknown) => {
            console.warn('[ChOWDERClient] stopAllVideoFileSessions on logout failed:', err);
        });

        const newRoleSelect = this.elements.newRole as HTMLSelectElement;
        const adminOption = newRoleSelect?.querySelector('option[value="admin"]');
        if (adminOption) (adminOption as HTMLOptionElement).style.display = '';

        this.contentManager.clearContentList();
        this.displayManager.clearApprovedDisplays();
        this.layoutManager.reset();
        this.updateEditDisplayDeleteButtonState(false);
    }

    // =========================================================================
    // GIS (iTowns)
    // =========================================================================


    private loadItowns2ContentOptions(): void {
        const select = this.elements.itowns2ContentSelect;
        if (!select) return;
        fetch('/itowns/Preset/preset_list.json')
            .then((r) => r.json())
            .then((json) => {
                for (const preset of json.preset_list ?? []) {
                    const absoluteUrl = preset.url.startsWith('/') || preset.url.startsWith('http')
                        ? preset.url
                        : '/' + preset.url;
                    const opt = document.createElement('option');
                    opt.value = JSON.stringify({ type: 'preset', url: absoluteUrl });
                    opt.textContent = 'Preset: ' + preset.name;
                    select.appendChild(opt);
                }
            })
            .catch(() => { /* プリセット取得失敗は無視 */ });
    }

    private async openItowns2(): Promise<void> {
        try {
            const result = await this.wsClient.sendCommand('RequestOTP', {});
            const contentVal = this.elements.itowns2ContentSelect?.value ?? '';
            const params = new URLSearchParams({ otp: result.token });
            if (contentVal) params.set('content', contentVal);
            window.open(`/itowns/index.html?${params.toString()}`, '_blank');
        } catch (err) {
            console.error('[ChOWDERClient] Failed to open itowns:', err);
        }
    }
}
