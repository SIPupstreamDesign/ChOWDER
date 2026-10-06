/**
 * コマンドハンドラ - WebSocketコマンドの処理
 */

import { WSConnector, ExtendedWebSocket } from './wsConnector';
import { Command } from './command';
import { SessionManager } from '../auth/sessionManager';
import { AuthService, UserRole } from '../auth/authService';
import { ContentService } from '../content/contentService';
import { ContentType, type ContentMetadata } from '../content/contentTypes';
import { TileImageService, SegmentReceiver } from '../content/tileImageService';
import { TileImageGenerationGate } from '../content/tileImageGenerationGate';
import type { TileImageUploadReservation } from '../content/tileImageGenerationGate';
import { TileImageProgressBroadcaster } from '../content/tileImageProgressBroadcaster';
import type { TileImageUploadDescriptor, TileimageSegmentParams } from '../content/tileImageService';
import { ThumbnailService } from '../content/thumbnailService';
import type { TileimageProgressPayload, TileImageMetadata } from '../content/contentTypes';

import { WindowMetaDataService } from '../display/windowMetaDataService';
import type { UpdateWindowMetaDataRequest, WindowMetaData } from '../display/displayTypes';
import { DisplaySessionService } from '../display/displaySessionService';
import { MediaService } from '../media/mediaService';
import { SiteService, DEFAULT_SITE_ID } from '../site/siteService';
import { LayoutService } from '../layout/layoutService';
import { OtpService } from '../auth/otpService';
import type { ServerConfig } from '../common/serverConfig';
import type {
    CreateTransportRequest,
    ConnectTransportRequest,
    ProduceRequest,
    ConsumeRequest,
} from '../media/mediaTypes';
import { compareContentMetadataForDisplayOrder } from '../../common/contentOrder';
import { inspectContentSample, normalizeIncomingContentType } from '../utils/binaryInspector';
import type { ContentInspectResult } from '../utils/binaryInspector';
import { KeyedSerialExecutor } from '../utils/keyedSerialExecutor';
import { AuthHandler } from './handlers/AuthHandler';
import { ClientDiagnosticLogService } from '../diagnostics/clientDiagnosticLogService';

type ResultCallback = (err: any, res?: any, binary?: Buffer) => void;
const TILE_IMAGE_UPLOAD_IDLE_TIMEOUT_MS = 120_000;

function isTileImageUploadDescriptor(value: unknown): value is TileImageUploadDescriptor {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const descriptor = value as Record<string, unknown>;
    return typeof descriptor.uploadId === 'string'
        && descriptor.uploadId.length > 0
        && Number.isSafeInteger(descriptor.byteLength)
        && (descriptor.byteLength as number) >= 0
        && Number.isSafeInteger(descriptor.segment_max)
        && (descriptor.segment_max as number) > 0
        && typeof descriptor.file_ext === 'string'
        && descriptor.file_ext.length > 0;
}

const CLIENT_DIAGNOSTIC_EVENTS = new Set([
    'display-initial',
    'display-resize',
    'display-fullscreen',
    'display-scroll',
    'display-scroll-settled',
    'window-metadata-applied',
    'content-layout-applied',
    'camera-rendered',
    'itowns-diagnostic-ready',
    'itowns-interaction-rejected',
]);

/**
 * コマンドハンドラクラス
 */
export class CommandHandler {
    private wsConnector: WSConnector | null = null;
    private clients: Set<ExtendedWebSocket> | null = null;
    private readonly metadataUpdateExecutor = new KeyedSerialExecutor();
    private readonly windowMetadataUpdateExecutor = new KeyedSerialExecutor();
    private sessionManager: SessionManager;
    private authService: AuthService;
    private contentService: ContentService;
    private windowMetaDataService: WindowMetaDataService;
    private displaySessionService: DisplaySessionService;
    private mediaService: MediaService;
    private siteService: SiteService;
    private layoutService: LayoutService;

    /** サーバー設定 */
    private serverConfig: ServerConfig;

    /** タイル画像サービス（タイル生成・保存・取得） */
    private tileImageService: TileImageService;
    /** セグメント受信器（分割バイナリ再合成） */
    private segmentReceiver: SegmentReceiver;
    private readonly tileImageGenerationGate = new TileImageGenerationGate();
    private readonly tileImageUploadTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private tileImageUploadIdleTimeoutMs: number = TILE_IMAGE_UPLOAD_IDLE_TIMEOUT_MS;
    /** OTPサービス（itowns自動ログイン用） */
    private otpService: OtpService;
    /** サムネイルサービス */
    private thumbnailService: ThumbnailService;
    /** 認証ハンドラ */
    private authHandler: AuthHandler;
    private readonly clientDiagnosticLogService: ClientDiagnosticLogService;

    constructor(
        sessionManager: SessionManager,
        authService: AuthService,
        contentService: ContentService,
        windowMetaDataService: WindowMetaDataService,
        displaySessionService: DisplaySessionService,
        mediaService: MediaService,
        siteService: SiteService,
        layoutService: LayoutService,
        serverConfig: ServerConfig,
        clientDiagnosticLogService: ClientDiagnosticLogService = new ClientDiagnosticLogService(),
    ) {
        this.sessionManager = sessionManager;
        this.authService = authService;
        this.contentService = contentService;
        this.windowMetaDataService = windowMetaDataService;
        this.displaySessionService = displaySessionService;
        this.mediaService = mediaService;
        this.siteService = siteService;
        this.layoutService = layoutService;
        this.serverConfig = serverConfig;
        this.clientDiagnosticLogService = clientDiagnosticLogService;
        this.tileImageService = new TileImageService(serverConfig.tileImage.tileSize);
        this.segmentReceiver = new SegmentReceiver();
        // OtpServiceはRedisが必要なため後から設定する
        this.otpService = null as any;
        this.thumbnailService = new ThumbnailService(contentService.getRedis());
        this.authHandler = new AuthHandler({
            sessionManager: this.sessionManager,
            authService: this.authService,
            otpService: null as any,
            notifyExistingStreams: async (socketId: string): Promise<void> => {
                return this.notifyExistingStreams(socketId);
            },
            revokeUserSessionsAndDisconnect: async (userId: string): Promise<void> => {
                return this.revokeUserSessionsAndDisconnect(userId);
            },
        });
    }

    /**
     * OtpServiceを設定する（websocketServer.tsから呼び出す）
     */
    setOtpService(otpService: OtpService): void {
        this.otpService = otpService;
        this.authHandler.setOtpService(otpService);
    }

    /**
     * WSConnectorとクライアントセットを設定
     */
    setConnector(wsConnector: WSConnector, clients: Set<ExtendedWebSocket>): void {
        this.wsConnector = wsConnector;
        this.clients = clients;
    }

    /**
     * 認証チェック
     */
    private async checkAuth(socketId: string, resultCallback: ResultCallback): Promise<boolean> {
        const isAuthenticated = await this.sessionManager.isAuthenticated(socketId);
        if (!isAuthenticated) {
            resultCallback({ code: -32001, message: 'Authentication required' });
            return false;
        }
        return true;
    }

    /**
     * Admin権限チェック
     */
    private async checkAdminAuth(socketId: string, resultCallback: ResultCallback): Promise<boolean> {
        const isAdmin = await this.sessionManager.isAdmin(socketId);
        if (!isAdmin) {
            resultCallback({ code: -32002, message: 'Admin permission required' });
            return false;
        }
        return true;
    }

    /**
     * コントローラまたは承認済みDisplay認証チェック
     * mediasoup関連の操作で使用
     */
    private async checkAuthOrApprovedDisplay(socketId: string, resultCallback: ResultCallback): Promise<boolean> {
        // コントローラ認証チェック
        const isAuthenticated = await this.sessionManager.isAuthenticated(socketId);
        if (isAuthenticated) {
            return true;
        }

        // Display承認チェック
        const displaySession = await this.displaySessionService.getDisplaySessionBySocketId(socketId);
        if (displaySession && displaySession.status === 'approved' && displaySession.isOnline) {
            return true;
        }

        resultCallback({ code: -32001, message: 'Authentication or display approval required' });
        return false;
    }

    /**
     * メタデータ更新リクエストから永続更新対象のフィールドのみ抽出する。
     * transport識別子（type='content', contentType など）は保存しない。
     */
    private sanitizeMetadataUpdates(raw: Record<string, unknown>): Record<string, unknown> {
        const {
            metadataId: _metadataId,
            id: _id,
            binaryId: _binaryId,
            type: _type,
            contentType: _contentType,
            creatorId: _creatorId,
            createdAt: _createdAt,
            date: _date,
            cameraWorldMatrix: _cameraWorldMatrix,
            cameraParams: _cameraParams,
            ...rest
        } = raw;

        return Object.fromEntries(
            Object.entries(rest).filter(([, value]) => {
                return value !== undefined;
            }),
        );
    }

    /**
     * クライアントが配信対象かチェック
     * - ログイン済みコントローラ
     * - 承認済みDisplay
     */
    private async canReceiveBroadcast(socketId: string): Promise<boolean> {
        // ログインチェック
        const isLoggedIn = await this.sessionManager.isAuthenticated(socketId);
        if (isLoggedIn) {
            return true;
        }

        // Display承認チェック
        const displaySession = await this.displaySessionService.getDisplaySessionBySocketId(socketId);
        if (displaySession && displaySession.status === 'approved' && displaySession.isOnline) {
            return true;
        }

        return false;
    }

    /**
     * 指定ユーザーの全セッションを失効し、接続中ソケットを切断
     */
    private async revokeUserSessionsAndDisconnect(userId: string): Promise<void> {
        const targetSocketIds = await this.sessionManager.getSocketIdsByUserId(userId);
        if (targetSocketIds.length === 0) {
            return;
        }

        if (this.clients !== null) {
            for (const socketId of targetSocketIds) {
                const client = Array.from(this.clients).find((c) => c.id === socketId);
                if (client && client.readyState === 1) {
                    let notified = false;
                    try {
                        const revokedMessage = {
                            jsonrpc: '2.0',
                            id: String(Math.random()),
                            method: Command.SessionRevoked,
                            params: { reason: 'user-deleted' },
                            to: 'client',
                        };
                        client.sendQueued(JSON.stringify(revokedMessage), true);
                        notified = true;
                    } catch (error) {
                        console.error(`[CommandHandler] Failed to notify revoked session ${socketId} for deleted user ${userId}:`, error);
                    }

                    if (notified) {
                        // 通知送信成功時のみ短い猶予を入れてから切断
                        setTimeout(() => {
                            try {
                                client.close();
                            } catch (error) {
                                console.error(`[CommandHandler] Failed to close socket ${socketId} for deleted user ${userId}:`, error);
                            }
                        }, 200);
                    } else {
                        // 通知送信に失敗した場合は即時切断
                        try {
                            client.close();
                        } catch (error) {
                            console.error(`[CommandHandler] Failed to close socket ${socketId} for deleted user ${userId}:`, error);
                        }
                    }
                }
            }
        }

        const revokedCount = await this.sessionManager.removeSessionsByUserId(userId);

        console.log(`[CommandHandler] Revoked ${revokedCount} session(s) for deleted user ${userId}`);
    }

    /**
     * 既存の全Producer/Contentをクライアントに通知
     */
    private async notifyExistingStreams(socketId: string): Promise<void> {
        if (!this.clients) {
            return;
        }

        const client = Array.from(this.clients).find(c => c.id === socketId);
        if (!client || client.readyState !== 1) {
            return;
        }

        // 既存のProducerを取得
        const activeProducers = await this.mediaService.getActiveProducers();

        // streamIdごとにmetadataIdを収集
        const streamMetadataMap = new Map<string, string>();
        for (const producer of activeProducers.producers) {
            if (producer.streamId && producer.metadataId && !streamMetadataMap.has(producer.streamId)) {
                streamMetadataMap.set(producer.streamId, producer.metadataId);
            }
        }

        // 各Producerについて通知
        for (const producer of activeProducers.producers) {
            // NewProducerAvailable通知
            const producerMessage = {
                jsonrpc: '2.0',
                id: String(Math.random()),
                method: 'NewProducerAvailable',
                params: {
                    producerId: producer.producerId,
                    userId: producer.userId,
                    socketId: producer.socketId,
                    kind: producer.kind,
                    streamId: producer.streamId,
                    streamName: producer.streamName,
                    metadataId: producer.metadataId,
                },
                to: 'client',
            };
            client.sendQueued(JSON.stringify(producerMessage), true);
        }

        // StreamMetadataを持つProducerについてはNewContentAddedも送信
        const sentMetadataIds = new Set<string>();
        for (const [streamId, metadataId] of streamMetadataMap.entries()) {
            if (!sentMetadataIds.has(metadataId)) {
                const streamMetadata = await this.contentService.getMetadata(metadataId);
                if (streamMetadata) {
                    const contentMessage = {
                        jsonrpc: '2.0',
                        id: String(Math.random()),
                        method: 'NewContentAdded',
                        params: { metadata: streamMetadata },
                        to: 'client',
                    };
                    client.sendQueued(JSON.stringify(contentMessage), true);
                    sentMetadataIds.add(metadataId);
                }
            }
        }

        console.log(`[CommandHandler] Notified ${activeProducers.producers.length} existing producers to socket ${socketId}`);
    }

    // ========================================
    // 認証関連
    // ========================================

    /**
     * ログイン
     */
    async login(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        return this.authHandler.login(socketId, data, resultCallback);
    }

    /**
     * itowns用OTPトークンを発行する
     * ログイン済みコントローラのみ発行可能
     */
    async requestOTP(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        return this.authHandler.requestOTP(socketId, data, resultCallback);
    }

    /**
     * OTPトークンを使ったログイン（itowns自動ログイン用）
     */
    async loginWithOTP(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        return this.authHandler.loginWithOTP(socketId, data, resultCallback);
    }

    /**
     * ログアウト
     */
    async logout(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        return this.authHandler.logout(socketId, data, resultCallback);
    }

    /**
     * ユーザー作成
     * - Admin: 全ロール作成可能
     * - ContentManager: Admin以外のロール作成可能
     */
    async createUser(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        return this.authHandler.createUser(socketId, data, resultCallback);
    }

    /**
     * 全ユーザー一覧取得（Admin専用）
     */
    async getUserList(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        return this.authHandler.getUserList(socketId, data, resultCallback);
    }

    /**
     * ユーザー削除（Admin専用）
     * - 自分自身は削除不可
     * - Adminが1人の場合はAdminを削除不可
     */
    async deleteUser(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        return this.authHandler.deleteUser(socketId, data, resultCallback);
    }

    /**
     * パスワード変更（Admin専用）
     */
    async changePassword(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        return this.authHandler.changePassword(socketId, data, resultCallback);
    }

    /**
     * 自身のパスワード変更（全ユーザー・旧パスワード検証あり・ログイン不要）
     */
    async changeOwnPassword(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        return this.authHandler.changeOwnPassword(socketId, data, resultCallback);
    }

    /**
     * ログインユーザーリスト取得
     */
    async getLoginUserList(data: any, resultCallback: ResultCallback, socketId: string): Promise<void> {
        return this.authHandler.getLoginUserList(data, resultCallback, socketId);
    }

    /**
     * 自身のステータス取得
     */
    async getSelfStatus(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        return this.authHandler.getSelfStatus(socketId, data, resultCallback);
    }

    /**
     * サーバー設定取得（認証不要）
     */
    async getServerConfig(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        resultCallback(null, {
            ...this.serverConfig,
            clientDiagnostics: {
                enabled: this.clientDiagnosticLogService.isActive(),
                sessionId: this.clientDiagnosticLogService.isActive()
                    ? this.clientDiagnosticLogService.sessionId
                    : null,
            },
        });
    }

    async reportClientDiagnostic(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!this.clientDiagnosticLogService.isActive() || this.clientDiagnosticLogService.sessionId === null) {
            resultCallback({ code: -32090, message: 'Client diagnostics are disabled' });
            return;
        }

        const session = await this.sessionManager.getSession(socketId);
        let role: 'controller' | 'display';
        if (session && session.role !== UserRole.DISPLAY) {
            role = 'controller';
        } else {
            const displaySession = await this.displaySessionService.getDisplaySessionBySocketId(socketId);
            if (!displaySession || displaySession.status !== 'approved' || !displaySession.isOnline) {
                resultCallback({ code: -32001, message: 'Authentication or display approval required' });
                return;
            }
            role = 'display';
        }

        if (
            data?.diagnosticSessionId !== this.clientDiagnosticLogService.sessionId
            || typeof data.event !== 'string'
            || !CLIENT_DIAGNOSTIC_EVENTS.has(data.event)
        ) {
            resultCallback({ code: -32091, message: 'Invalid client diagnostic event' });
            return;
        }

        const windowId = typeof data.windowId === 'string' && data.windowId.length <= 128
            ? data.windowId
            : null;
        let serverWindow: WindowMetaData | null = null;
        if (windowId !== null) {
            const result = await this.windowMetaDataService.getWindowMetaData({ id: windowId, type: 'single' });
            serverWindow = result && !Array.isArray(result) ? result : null;
        }
        const serverWindowGeometry = serverWindow === null ? null : {
            id: serverWindow.id,
            revision: serverWindow.revision ?? 0,
            posx: serverWindow.posx,
            posy: serverWindow.posy,
            virtualWidth: serverWindow.virtualWidth,
            virtualHeight: serverWindow.virtualHeight,
            pixelWidth: serverWindow.pixelWidth,
            pixelHeight: serverWindow.pixelHeight,
            contentVisible: serverWindow.contentVisible,
        };

        const accepted = this.clientDiagnosticLogService.append({
            ...data,
            role,
            serverWindow: serverWindowGeometry,
            serverWindowMetaDataRevision: serverWindowGeometry?.revision ?? null,
        });
        if (!accepted) {
            resultCallback({ code: -32092, message: 'Client diagnostic event exceeds limits' });
            return;
        }
        resultCallback(null, { accepted: true });
    }

    /**
     * バイナリデータの内容を簡易判別する。
     * クライアントで判別不能なファイルのフォールバックに利用する。
     */
    async inspectContentData(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) {
            return;
        }

        const meta = data?.metaData ?? {};
        const contentData = data?.contentData;
        if (contentData === undefined || contentData === null) {
            resultCallback({ code: -32080, message: 'Missing contentData' });
            return;
        }

        try {
            const sample = Buffer.isBuffer(contentData)
                ? contentData
                : Buffer.from(contentData);
            const clientMime = typeof meta.mime === 'string' ? meta.mime : '';
            const inspected = inspectContentSample(sample, clientMime);
            resultCallback(null, inspected);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            resultCallback({ code: -32081, message: `InspectContentData failed: ${message}` });
        }
    }

    /**
     * ログインユーザーのコントローラーID更新
     */
    async updateLoginUserControllerID(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log(`[CommandHandler] UpdateLoginUserControllerID called`);
        resultCallback(null, { success: true });
    }

    // ========================================
    // コンテンツ関連
    // ========================================

    /**
     * コンテンツを追加（メタデータ + バイナリ）
     */
    async addContent(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        console.log('[CommandHandler] AddContent called for socketId:', socketId);

        let responseSent = false;
        const respondOnce: ResultCallback = (error: any, response?: any, binary?: Buffer): void => {
            if (responseSent) {
                return;
            }
            responseSent = true;
            resultCallback(error, response, binary);
        };

        if (!await this.checkAuth(socketId, respondOnce)) {
            console.log('[CommandHandler] AddContent auth failed for socketId:', socketId);
            return;
        }

        let reservedUploadId: string | null = null;
        try {
            // セッションから作成者情報を取得
            const session = await this.sessionManager.getSession(socketId);
            console.log('[CommandHandler] Session:', session);

            if (!session) {
                respondOnce({ code: -32020, message: 'Session not found' });
                return;
            }

            // wsConnectorから渡されるデータ形式: { metaData, contentData }
            const inputMetadata: unknown = data?.metaData;
            if (typeof inputMetadata !== 'object' || inputMetadata === null || Array.isArray(inputMetadata)) {
                respondOnce({ code: -32021, message: 'Missing metadata' });
                return;
            }
            const metadata = { ...(inputMetadata as Record<string, unknown>) };
            const binary = data?.contentData;

            const normalizedType = normalizeIncomingContentType(metadata.type);
            if (normalizedType === null) {
                respondOnce({ code: -32023, message: 'Invalid metadata.type' });
                return;
            }
            metadata.type = normalizedType;

            // tileimage はバイナリなし（UploadTileimage で別途送信）で登録を許可
            const isTileimage = metadata.type === ContentType.TILEIMAGE;
            if (!binary && !isTileimage) {
                respondOnce({ code: -32021, message: 'Missing binary' });
                return;
            }
            if (isTileimage && binary !== undefined && binary !== null && (!Buffer.isBuffer(binary) || binary.byteLength !== 0)) {
                respondOnce({ code: -32025, message: 'Tileimage AddContent must not include image binary data' });
                return;
            }

            let uploadDescriptor: TileImageUploadDescriptor | null = null;
            if (isTileimage) {
                const candidateDescriptor: unknown = metadata.tileImageUpload;
                if (!isTileImageUploadDescriptor(candidateDescriptor)) {
                    respondOnce({ code: -32024, message: 'Invalid tileimage upload descriptor' });
                    return;
                }
                uploadDescriptor = candidateDescriptor;
                delete metadata.tileImageUpload;
                delete metadata.metadataId;

                if (!this.tileImageGenerationGate.tryReserve(uploadDescriptor, socketId, session.userId)) {
                    respondOnce({ code: -32072, message: 'Tile image generation is busy; retry the upload later' });
                    return;
                }
                reservedUploadId = uploadDescriptor.uploadId;
                const reservation = this.tileImageGenerationGate.getReservationForSocket(socketId);
                if (reservation === null) {
                    this.tileImageGenerationGate.release(uploadDescriptor.uploadId, socketId);
                    reservedUploadId = null;
                    respondOnce({ code: -32072, message: 'Tile image reservation was cancelled' });
                    return;
                }
                this.refreshTileImageUploadTimeout(reservation, (): void => {
                    respondOnce({ code: -32072, message: 'Tile image AddContent timed out before metadata creation' });
                });
            }

            // creatorIdを自動設定
            metadata.creatorId = session.userId;
            console.log('[CommandHandler] Set creatorId:', metadata.creatorId);

            const result = await this.contentService.addContent({
                metadata,
                binary: binary || Buffer.alloc(0),
            });
            console.log('[CommandHandler] AddContent result:', result);

            if (uploadDescriptor !== null) {
                const isReservationActive = this.tileImageGenerationGate.bindMetadata(
                    uploadDescriptor.uploadId,
                    socketId,
                    result.metadataId,
                );
                if (!isReservationActive) {
                    await this.deleteIncompleteTileimageData(result.metadataId, session.userId);
                    this.tileImageGenerationGate.release(uploadDescriptor.uploadId, socketId);
                    reservedUploadId = null;
                    if (this.isSocketConnected(socketId)) {
                        respondOnce({ code: -32072, message: 'Tile image AddContent was cancelled' });
                    }
                    return;
                }

                const reservation = this.tileImageGenerationGate.getReservationForSocket(socketId);
                if (reservation === null) {
                    await this.deleteIncompleteTileimageData(result.metadataId, session.userId);
                    this.tileImageGenerationGate.release(uploadDescriptor.uploadId, socketId);
                    reservedUploadId = null;
                    if (this.isSocketConnected(socketId)) {
                        respondOnce({ code: -32072, message: 'Tile image AddContent was cancelled' });
                    }
                    return;
                }
                this.refreshTileImageUploadTimeout(reservation);
            }

            // 送信元に成功レスポンス
            respondOnce(null, result);

            // 全クライアントにブロードキャスト
            if (this.wsConnector && this.clients) {
                this.wsConnector.broadcast(
                    this.clients,
                    Command.AddContent,
                    { metadata: result }
                );
            }

            // 画像サムネイルはクライアント側で生成・UpdateThumbnailで送信するためここでは生成しない
            // (TILEIMAGEのサムネイルは uploadTileimage 完了時にサーバー側で生成)
        } catch (error: any) {
            console.error('[CommandHandler] AddContent error:', error);
            if (reservedUploadId !== null) {
                this.clearTileImageUploadTimeout(reservedUploadId);
                this.tileImageGenerationGate.release(reservedUploadId, socketId);
            }
            respondOnce({ code: -32022, message: error.message });
        }
    }

    /**
     * メタデータのみ追加
     */
    async addMetaData(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] AddMetaData called');
        resultCallback(null, { success: true });
    }

    /**
     * メタデータ取得
     */
    async getMetaData(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuthOrApprovedDisplay(socketId, resultCallback)) return;

        console.log(`[CommandHandler] GetMetaData called`);

        try {
            if (data.metadataId) {
                // metadataId 指定: 単一メタデータ取得
                const metadata = await this.contentService.getMetadata(data.metadataId);
                if (!metadata) {
                    resultCallback({ code: -32030, message: 'Metadata not found' });
                    return;
                }
                resultCallback(null, metadata);
            } else {
                // 全件取得: metadataList で返す
                const metadataList = await this.contentService.getAllMetadata();
                resultCallback(null, { metadataList });
            }
        } catch (error: any) {
            console.error('[CommandHandler] GetMetaData error:', error);
            resultCallback({ code: -32031, message: error.message });
        }
    }

    /**
     * コンテンツ取得（メタデータ + バイナリ）
     */
    async getContent(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuthOrApprovedDisplay(socketId, resultCallback)) return;

        console.log(`[CommandHandler] GetContent called for metadataId: ${data.metadataId}`);

        try {
            const { metadataId } = data;

            if (!metadataId) {
                resultCallback({ code: -32032, message: 'Missing metadataId' });
                return;
            }

            const content = await this.contentService.getContent(metadataId);

            if (!content) {
                resultCallback({ code: -32033, message: 'Content not found' });
                return;
            }

            // バイナリ付きでレスポンス。webgl タイプの場合はカメラデータもマージして返す
            const result: any = { ...content.metadata };
            if (content.cameraData) {
                Object.assign(result, content.cameraData);
            }
            resultCallback(null, result, content.binary);
        } catch (error: any) {
            console.error('[CommandHandler] GetContent error:', error);
            resultCallback({ code: -32034, message: error.message });
        }
    }

    /**
     * メタデータ更新
     */
    async updateMetaData(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] UpdateMetaData called');

        try {
            // 配列の場合は各要素を処理
            if (Array.isArray(data)) {
                const results = [];
                for (const item of data) {
                    const metadataId = item.metadataId || item.id;
                    const updates = this.sanitizeMetadataUpdates(item as Record<string, unknown>);

                    if (!metadataId) {
                        continue; // スキップ
                    }

                    const updatedMetadata = await this.metadataUpdateExecutor.run(
                        metadataId,
                        async (): Promise<ContentMetadata | null> => {
                            const metadata = await this.contentService.updateMetadata(metadataId, updates);
                            if (metadata && this.wsConnector && this.clients) {
                                this.wsConnector.broadcast(
                                    this.clients,
                                    Command.UpdateMetaData,
                                    { metadata }
                                );
                            }
                            return metadata;
                        },
                    );
                    if (updatedMetadata) {
                        results.push(updatedMetadata);
                    }
                }

                // 送信元に成功レスポンス
                resultCallback(null, results);
            } else {
                // 単一オブジェクトの場合
                const metadataId = data.metadataId || data.id;
                const updates = this.sanitizeMetadataUpdates(data as Record<string, unknown>);

                if (!metadataId) {
                    resultCallback({ code: -32040, message: 'Missing metadataId' });
                    return;
                }

                const updatedMetadata = await this.metadataUpdateExecutor.run(
                    metadataId,
                    async (): Promise<ContentMetadata | null> => {
                        const metadata = await this.contentService.updateMetadata(metadataId, updates);
                        if (!metadata) {
                            return null;
                        }

                        resultCallback(null, metadata);
                        if (this.wsConnector && this.clients) {
                            this.wsConnector.broadcast(
                                this.clients,
                                Command.UpdateMetaData,
                                { metadata }
                            );
                        }
                        return metadata;
                    },
                );

                if (!updatedMetadata) {
                    resultCallback({ code: -32041, message: 'Metadata not found' });
                    return;
                }
            }
        } catch (error: any) {
            console.error('[CommandHandler] UpdateMetaData error:', error);
            resultCallback({ code: -32042, message: error.message });
        }
    }

    /**
     * iTowns カメラ行列更新
     * content:camera:{id} キーのみ書き込んで UpdateCameraMatrix でブロードキャストする。
     * content:metadata は変更しないため posx/posy のロールバックは起きない。
     */
    async registerCameraSource(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) {
            return;
        }
        try {
            if (typeof data.metadataId !== 'string' || typeof data.sourceInstanceId !== 'string') {
                throw new Error('Missing camera source identity');
            }
            const lease = await this.contentService.registerCameraSource(data.metadataId, data.sourceInstanceId, socketId);
            resultCallback(null, lease);
        } catch (error: unknown) {
            resultCallback({ code: -32063, message: error instanceof Error ? error.message : 'Camera registration failed' });
        }
    }

    async updateCameraMatrix(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] UpdateCameraMatrix called');

        try {
            const { metadataId, id, cameraWorldMatrix, cameraParams } = data;
            const resolvedId = metadataId || id;

            if (!resolvedId) {
                resultCallback({ code: -32060, message: 'Missing metadataId' });
                return;
            }
            if (!cameraWorldMatrix || !cameraParams) {
                resultCallback({ code: -32061, message: 'Missing cameraWorldMatrix or cameraParams' });
                return;
            }

            const cameraData = await this.contentService.updateCameraData(
                resolvedId, cameraWorldMatrix, cameraParams,
                { generation: data.generation, sourceEpoch: data.sourceEpoch, sourceInstanceId: data.sourceInstanceId, sourceSequence: data.sourceSequence, ownerSocketId: socketId },
            );
            if (cameraData === null) {
                resultCallback(null, { phase: 'superseded' });
                return;
            }

            if (
                this.clientDiagnosticLogService.isActive()
                && data.diagnosticSessionId === this.clientDiagnosticLogService.sessionId
                && typeof data.diagnosticId === 'string'
            ) {
                this.clientDiagnosticLogService.append({
                    event: 'camera-source',
                    diagnosticId: data.diagnosticId,
                    instanceId: data.instanceId ?? null,
                    metadataId: resolvedId,
                    role: 'itowns-source',
                    cameraWorldMatrix,
                    cameraParams,
                });
            }

            resultCallback(null, cameraData);

            if (this.wsConnector && this.clients) {
                this.wsConnector.broadcastLatest(
                    this.clients,
                    Command.UpdateCameraMatrix,
                    {
                        ...cameraData,
                        diagnosticId: data.diagnosticId,
                        diagnosticSessionId: data.diagnosticSessionId,
                    },
                    `camera:${resolvedId}`
                );
            }
        } catch (error: any) {
            console.error('[CommandHandler] UpdateCameraMatrix error:', error);
            resultCallback({ code: -32062, message: error.message });
        }
    }

    /**
     * コンテンツ更新（バイナリも含む）
     */
    async updateContent(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] UpdateContent called');

        try {
            let metadataId: string;
            let binary: Buffer | undefined;
            let metadata: any;

            if (data.metaData !== undefined && data.contentData !== undefined) {
                metadataId = data.metaData.metadataId;
                binary = data.contentData;
                metadata = this.sanitizeMetadataUpdates(data.metaData as Record<string, unknown>);
            } else {
                const { metadataId: mid, binary: bin, ...rest } = data;
                metadataId = mid;
                binary = bin;
                metadata = this.sanitizeMetadataUpdates(rest as Record<string, unknown>);
            }

            const normalizedMetadataId = typeof metadataId === 'string' ? metadataId.trim() : '';
            const normalizedMetadataIdLower = normalizedMetadataId.toLowerCase();
            if (
                normalizedMetadataId.length === 0
                || normalizedMetadataIdLower === 'undefined'
                || normalizedMetadataIdLower === 'null'
            ) {
                resultCallback({ code: -32043, message: `Missing metadataId: ${JSON.stringify(data)}` });
                return;
            }

            const updatedMetadata = await this.metadataUpdateExecutor.run(
                normalizedMetadataId,
                async (): Promise<ContentMetadata | null> => {
                    const updated = await this.contentService.updateContent({
                        metadataId: normalizedMetadataId,
                        binary,
                        metadata
                    });
                    if (!updated) {
                        return null;
                    }

                    resultCallback(null, updated);
                    if (this.wsConnector && this.clients) {
                        this.wsConnector.broadcast(
                            this.clients,
                            Command.UpdateContent,
                            { metadata: updated },
                            undefined,
                            socketId
                        );
                    }
                    return updated;
                },
            );

            if (!updatedMetadata) {
                resultCallback({ code: -32044, message: 'Content not found' });
                return;
            }
        } catch (error: any) {
            console.error('[CommandHandler] UpdateContent error:', error);
            resultCallback({ code: -32045, message: error.message });
        }
    }

    /**
     * コンテンツ削除
     */
    async deleteContent(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] DeleteContent called');

        try {
            const { metadataId } = data;

            if (!metadataId) {
                resultCallback({ code: -32050, message: 'Missing metadataId' });
                return;
            }

            const success = await this.contentService.deleteContent(metadataId);

            if (!success) {
                resultCallback({ code: -32051, message: 'Content not found' });
                return;
            }

            // サムネイルも合わせて削除（存在しない場合も例外にならない）
            await this.thumbnailService.deleteThumbnail(metadataId);

            // 送信元に成功レスポンス
            resultCallback(null, { success: true, metadataId });

            // 全クライアントにブロードキャスト
            if (this.wsConnector && this.clients) {
                this.wsConnector.broadcast(
                    this.clients,
                    Command.DeleteContent,
                    { metadataId }
                );
            }
        } catch (error: any) {
            console.error('[CommandHandler] DeleteContent error:', error);
            resultCallback({ code: -32052, message: error.message });
        }
    }

    /**
     * タイルコンテンツ取得
     */
    async getTileContent(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuthOrApprovedDisplay(socketId, resultCallback)) return;

        const metaData = data.metaData || data;
        const metadataId: string | undefined = metaData.metadataId || metaData.id;
        const tileIndex: number | undefined = metaData.tileIndex ?? metaData.tile_index;

        if (!metadataId || tileIndex === undefined) {
            resultCallback({ code: -32061, message: 'Missing metadataId or tileIndex' });
            return;
        }

        try {
            const redis = (this.contentService as any).redis;
            const tileBinary = await this.tileImageService.getTile(redis, metadataId, tileIndex);
            if (!tileBinary) {
                resultCallback({ code: -32062, message: 'Tile not found' });
                return;
            }
            console.log(`[CommandHandler] GetTileContent metadataId=${metadataId} tileIndex=${tileIndex} size=${tileBinary.length}`);
            resultCallback(null, { metadataId, tileIndex }, tileBinary);
        } catch (error: any) {
            console.error('[CommandHandler] GetTileContent error:', error);
            resultCallback({ code: -32063, message: error.message });
        }
    }

    /**
     * タイル画像アップロードハンドラ
     *
     * フロー:
     * 1. セグメント受信 → 進捗通知 (phase: 'uploading')
     * 2. 全セグメント揃ったら Worker Thread で sharp 実行 → 進捗通知 (phase: 'processing')
     * 3. 保存完了 → メタデータ更新 + 全クライアントに UpdateContent ブロードキャスト
     */
    async uploadTileimage(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        const metaParams = data?.metaData as TileimageSegmentParams | undefined;
        const segmentBinary = data?.contentData;
        const reservation = this.tileImageGenerationGate.getReservationForSocket(socketId);
        if (reservation === null || reservation.phase !== 'receiving' || reservation.metadataId === null) {
            resultCallback({ code: -32072, message: 'No active tile image upload; start with AddContent' });
            return;
        }

        const session = await this.sessionManager.getSession(socketId);
        if (session === null || session.userId !== reservation.userId) {
            resultCallback({ code: -32073, message: 'Tile image upload session owner mismatch' });
            return;
        }

        const currentMetadata = await this.contentService.getMetadata(reservation.metadataId);
        if (
            currentMetadata === null
            || currentMetadata.type !== ContentType.TILEIMAGE
            || currentMetadata.creatorId !== session.userId
            || (currentMetadata as TileImageMetadata).tileFinished === true
        ) {
            this.clearTileImageUploadTimeout(reservation.uploadId);
            this.segmentReceiver.deleteByImageId(reservation.uploadId, socketId);
            this.tileImageGenerationGate.release(reservation.uploadId, socketId);
            resultCallback({ code: -32073, message: 'Tile image metadata is unavailable or no longer uploadable' });
            return;
        }

        const failActiveUpload = async (code: number, message: string): Promise<void> => {
            this.clearTileImageUploadTimeout(reservation.uploadId);
            this.segmentReceiver.deleteByImageId(reservation.uploadId, socketId);
            this.tileImageGenerationGate.release(reservation.uploadId, socketId);
            await this.cleanupIncompleteTileimageContent(reservation.metadataId!, session.userId);
            resultCallback({ code, message });
        };

        if (!metaParams || !Buffer.isBuffer(segmentBinary)) {
            await failActiveUpload(-32070, 'Missing or invalid segment metadata or binary');
            return;
        }

        const descriptor = reservation.descriptor;
        if (
            metaParams.uploadId !== descriptor.uploadId
            || metaParams.metadataId !== reservation.metadataId
            || metaParams.byteLength !== descriptor.byteLength
            || metaParams.segment_max !== descriptor.segment_max
            || metaParams.file_ext !== descriptor.file_ext
        ) {
            await failActiveUpload(-32071, 'Segment does not match the AddContent upload descriptor');
            return;
        }

        let receiveResult;
        try {
            receiveResult = this.segmentReceiver.receive(metaParams, segmentBinary, socketId);
        } catch (error: unknown) {
            const reason = error instanceof Error ? error.message : String(error);
            await failActiveUpload(-32073, reason);
            return;
        }

        if (!receiveResult.accepted) {
            resultCallback(null, { ok: true, duplicate: true });
            return;
        }

        this.refreshTileImageUploadTimeout(reservation);

        // 送信元に進捗を通知（アップロードフェーズ）
        if (this.wsConnector && this.clients) {
            const progressPayload: TileimageProgressPayload = {
                metadataId: reservation.metadataId,
                receivedSegments: receiveResult.receivedCount,
                totalSegments: descriptor.segment_max,
                phase: 'uploading',
            };
            this.wsConnector.broadcastToTargets(
                [socketId],
                this.clients,
                Command.TileimageProgress,
                progressPayload
            );
        }

        // セグメント受信の都度クライアントに OK を返す（クライアントが await で次のセグメントを送れるようにする）
        resultCallback(null, { ok: true });

        // まだ揃っていない場合は次のセグメントを待つ
        if (receiveResult.assembled === null) return;

        this.clearTileImageUploadTimeout(reservation.uploadId);
        this.tileImageGenerationGate.markProcessing(reservation.uploadId, socketId);

        console.log(`[CommandHandler] UploadTileimage all segments received: metadataId=${reservation.metadataId} size=${receiveResult.assembled.length}`);
        const progressBroadcaster = new TileImageProgressBroadcaster(
            (completed: number, total: number): void => {
                if (!this.wsConnector || !this.clients) {
                    return;
                }
                try {
                    const progressPayload: TileimageProgressPayload = {
                        metadataId: reservation.metadataId!,
                        receivedSegments: completed,
                        totalSegments: total,
                        phase: 'processing',
                    };
                    this.wsConnector.broadcastToTargets(
                        [socketId],
                        this.clients,
                        Command.TileimageProgress,
                        progressPayload,
                    );
                } catch (error: unknown) {
                    console.warn('[CommandHandler] Failed to broadcast tileimage progress:', error);
                }
            },
        );

        try {
            // Worker Thread でタイル生成（進捗通知 phase: 'processing'）
            const redis = (this.contentService as any).redis;

            const tileSet = await this.tileImageService.generateTiles(
                receiveResult.assembled,
                (completed, total) => {
                    progressBroadcaster.publish(completed, total);
                },
                (): void => {
                    if (this.wsConnector && this.clients) {
                        try {
                            this.wsConnector.broadcastToTargets(
                                [socketId],
                                this.clients,
                                Command.TileimageHeartbeat,
                                { metadataId: reservation.metadataId },
                            );
                        } catch (error: unknown) {
                            console.warn('[CommandHandler] Failed to broadcast tileimage heartbeat:', error);
                        }
                    }
                },
            );

            // Redis にタイルを保存
            await this.tileImageService.storeTiles(redis, reservation.metadataId!, tileSet);

            // アップロード元画像のサイズを元から計算（元バイナリのサイズ情報が必要なためシャープで再取得）
            const updatedMeta = await this.metadataUpdateExecutor.run(
                reservation.metadataId!,
                async (): Promise<ContentMetadata | null> => {
                    const updated = await this.contentService.updateMetadata(reservation.metadataId!, {
                        xsplit: tileSet.xsplit,
                        ysplit: tileSet.ysplit,
                        tileSize: tileSet.tileSize,
                        orgWidth: tileSet.imgWidth,
                        orgHeight: tileSet.imgHeight,
                        reductionWidth: tileSet.reductionWidth,
                        reductionHeight: tileSet.reductionHeight,
                        tileFinished: true,
                    } as Partial<TileImageMetadata>);
                    if (updated && this.wsConnector && this.clients) {
                        this.wsConnector.broadcast(
                            this.clients,
                            Command.UpdateContent,
                            { metadata: updated }
                        );
                    }
                    return updated;
                },
            );

            if (!updatedMeta) {
                console.error(`[CommandHandler] UploadTileimage: metadata not found for ${reservation.metadataId}`);
                this.notifyTileimageUploadFailed(socketId, reservation.metadataId!, 'Tile upload metadata not found after processing');
                return;
            }

            console.log(`[CommandHandler] UploadTileimage complete: metadataId=${reservation.metadataId} xsplit=${tileSet.xsplit} ysplit=${tileSet.ysplit}`);

            // タイル画像の縮小版からサムネイルを生成
            const reductionBuf = Buffer.from(tileSet.reduction);
            this.generateAndBroadcastThumbnail(reservation.metadataId!, reductionBuf, 'image/jpeg')
                .catch((err) => console.error('[CommandHandler] Tileimage thumbnail generation failed:', err));
        } catch (error: any) {
            console.error('[CommandHandler] UploadTileimage processing error:', error);
            const reason = error instanceof Error ? error.message : String(error);
            let cleanedIncompleteContent = false;
            try {
                cleanedIncompleteContent = await this.cleanupIncompleteTileimageContent(
                    reservation.metadataId!,
                    reservation.userId,
                );
            } catch (cleanupErr) {
                console.error('[CommandHandler] UploadTileimage cleanup error:', cleanupErr);
            }
            if (cleanedIncompleteContent) {
                this.notifyTileimageUploadFailed(socketId, reservation.metadataId!, `Tile upload processing failed: ${reason}`);
            }
        } finally {
            progressBroadcaster.dispose();
            this.clearTileImageUploadTimeout(reservation.uploadId);
            this.tileImageGenerationGate.release(reservation.uploadId, socketId);
        }
    }

    private refreshTileImageUploadTimeout(
        reservation: TileImageUploadReservation,
        onCreationTimeout?: () => void,
    ): void {
        if (reservation.phase !== 'creating' && (reservation.phase !== 'receiving' || reservation.metadataId === null)) {
            return;
        }

        const uploadId = reservation.uploadId;
        this.clearTileImageUploadTimeout(uploadId);
        const timeoutId = setTimeout((): void => {
            this.tileImageUploadTimeouts.delete(uploadId);
            const currentReservation = this.tileImageGenerationGate.getReservationForSocket(reservation.socketId);
            if (currentReservation === null || currentReservation.uploadId !== uploadId) {
                return;
            }

            if (currentReservation.phase === 'creating') {
                this.tileImageGenerationGate.release(uploadId, reservation.socketId);
                onCreationTimeout?.();
                return;
            }
            if (currentReservation.phase !== 'receiving' || currentReservation.metadataId === null) {
                return;
            }

            const released = this.tileImageGenerationGate.release(uploadId, reservation.socketId);
            if (released === null) {
                return;
            }
            this.segmentReceiver.deleteByImageId(uploadId, reservation.socketId);
            const reason = 'Tile image upload timed out while receiving segments';
            this.cleanupIncompleteTileimageContent(currentReservation.metadataId!, currentReservation.userId).then((deleted: boolean): void => {
                if (deleted) {
                    this.notifyTileimageUploadFailed(reservation.socketId, currentReservation.metadataId!, reason);
                }
            }).catch((error: unknown) => {
                console.error('[CommandHandler] Tile image upload timeout cleanup failed:', error);
            });
        }, this.tileImageUploadIdleTimeoutMs);
        this.tileImageUploadTimeouts.set(reservation.uploadId, timeoutId);
    }

    private clearTileImageUploadTimeout(imageId: string): void {
        const timeoutId = this.tileImageUploadTimeouts.get(imageId);
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
            this.tileImageUploadTimeouts.delete(imageId);
        }
    }

    private async cleanupIncompleteTileimageContent(metadataId: string, expectedOwner: string): Promise<boolean> {
        const deleted = await this.deleteIncompleteTileimageData(metadataId, expectedOwner);
        if (!deleted) {
            return false;
        }
        if (this.wsConnector && this.clients) {
            this.wsConnector.broadcast(
                this.clients,
                Command.DeleteContent,
                { metadataId },
            );
        }
        return true;
    }

    private async deleteIncompleteTileimageData(metadataId: string, expectedOwner: string): Promise<boolean> {
        const redis = (this.contentService as any).redis;
        return this.tileImageService.deleteIncompleteContent(redis, metadataId, expectedOwner);
    }

    private isSocketConnected(socketId: string): boolean {
        if (this.clients === null) {
            return false;
        }
        for (const client of this.clients) {
            if (client.id === socketId && client.readyState === 1) {
                return true;
            }
        }
        return false;
    }

    private notifyTileimageUploadFailed(socketId: string, metadataId: string, reason: string): void {
        if (!this.wsConnector || !this.clients) {
            return;
        }
        this.wsConnector.broadcastToTargets(
            [socketId],
            this.clients,
            Command.TileimageUploadFailed,
            { metadataId, reason }
        );
    }

    // ========================================
    // サムネイル関連
    // ========================================

    /**
     * サムネイルを生成してRedisに保存し、ThumbnailUpdatedをbroadcastする。
     * IMAGE / TILEIMAGE の自動生成・UpdateThumbnailコマンド共通処理。
     */
    private async generateAndBroadcastThumbnail(
        metadataId: string,
        binary: Buffer,
        mime: string
    ): Promise<void> {
        const thumbnail = await this.thumbnailService.generateFromBinary(binary, mime);
        await this.thumbnailService.saveThumbnail(metadataId, thumbnail);

        if (this.wsConnector && this.clients) {
            this.wsConnector.broadcast(
                this.clients,
                Command.ThumbnailUpdated,
                { metadataId }
            );
        }
    }

    /**
     * サムネイルを取得して返す（PNG バイナリレスポンス）
     */
    async getThumbnail(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        if (!data.metadataId) {
            resultCallback({ code: -32061, message: 'Missing metadataId' });
            return;
        }

        try {
            const thumbnail = await this.thumbnailService.getThumbnail(data.metadataId);
            if (!thumbnail) {
                resultCallback({ code: -32060, message: 'Thumbnail not found' });
                return;
            }
            resultCallback(null, { metadataId: data.metadataId }, thumbnail);
        } catch (error: any) {
            console.error('[CommandHandler] GetThumbnail error:', error);
            resultCallback({ code: -32060, message: error.message });
        }
    }

    /**
     * クライアントからPNGバイナリを受け取り、サムネイルとして保存してbroadcastする。
     * IMAGE以外のタイプ（text/url/pdf/webgl/live-stream）のサムネイル更新に使用。
     */
    async updateThumbnail(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        const metadataId = data?.metaData?.metadataId;
        if (!metadataId) {
            resultCallback({ code: -32062, message: 'Missing metadataId' });
            return;
        }

        const binary: Buffer | Uint8Array | null = data?.contentData ?? null;
        if (!binary || (!Buffer.isBuffer(binary) && !(binary instanceof Uint8Array))) {
            resultCallback({ code: -32063, message: 'Missing binary data' });
            return;
        }

        try {
            const buf = Buffer.isBuffer(binary) ? binary : Buffer.from(binary);
            await this.thumbnailService.saveThumbnail(metadataId, buf);

            resultCallback(null, { success: true, metadataId });

            if (this.wsConnector && this.clients) {
                this.wsConnector.broadcast(
                    this.clients,
                    Command.ThumbnailUpdated,
                    { metadataId }
                );
            }
        } catch (error: any) {
            console.error('[CommandHandler] UpdateThumbnail error:', error);
            resultCallback({ code: -32064, message: error.message });
        }
    }

    /**
     * ソケット切断時のタイルイメージクリーンアップ
     * websocketServer.ts の on('close') 内で呼び出すこと。
     */
    async cleanupTileimageOnDisconnect(socketId: string): Promise<void> {
        const cancellation = this.tileImageGenerationGate.cancelForSocket(socketId);
        this.segmentReceiver.deleteBySocketId(socketId);
        if (cancellation !== null) {
            const { reservation, cleanupAfterMetadataCreate } = cancellation;
            this.clearTileImageUploadTimeout(reservation.uploadId);
            if (cleanupAfterMetadataCreate) {
                return;
            }
            if (reservation.metadataId !== null) {
                this.segmentReceiver.deleteByImageId(reservation.uploadId, socketId);
                try {
                    await this.cleanupIncompleteTileimageContent(reservation.metadataId, reservation.userId);
                } catch (error: unknown) {
                    console.error(`[CommandHandler] Cleanup error for ${reservation.metadataId}:`, error);
                }
            }
        }
    }

    // ========================================
    // ウィンドウメタデータ関連
    // ========================================

    async addWindowMetaData(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] AddWindowMetaData called', data);

        try {
            const windowMetaData = await this.windowMetaDataService.addWindowMetaData({
                id: data.id,
                posx: data.posx || 0,
                posy: data.posy || 0,
                virtualWidth: data.virtualWidth || 1920,
                virtualHeight: data.virtualHeight || 1080,
                pixelWidth: data.pixelWidth || 1920,
                pixelHeight: data.pixelHeight || 1080,
                contentVisible: data.contentVisible !== undefined ? data.contentVisible : true,
                siteId: data.siteId,
            });

            resultCallback(null, windowMetaData);
        } catch (error: any) {
            console.error('[CommandHandler] AddWindowMetaData error:', error);
            resultCallback({ code: -32070, message: error.message });
        }
    }

    async getWindowMetaData(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuthOrApprovedDisplay(socketId, resultCallback)) return;

        try {
            const result = await this.windowMetaDataService.getWindowMetaData({
                id: data.id,
                type: data.type || (data.id ? 'single' : 'all'),
            });

            resultCallback(null, result);
        } catch (error: any) {
            console.error('[CommandHandler] GetWindowMetaData error:', error);
            resultCallback({ code: -32071, message: error.message });
        }
    }

    private async updateControllerWindowMetaData(
        socketId: string,
        data: Record<string, unknown>,
    ): Promise<WindowMetaData | null> {
        const windowId = typeof data.id === 'string' ? data.id : '';
        if (windowId.trim() === '') {
            throw new Error('Missing window id');
        }

        return this.windowMetadataUpdateExecutor.run(windowId, async (): Promise<WindowMetaData | null> => {
            const current = await this.windowMetaDataService.getWindowMetaData({ id: windowId, type: 'single' });
            if (!current || Array.isArray(current)) {
                return null;
            }

            const updates: UpdateWindowMetaDataRequest = { id: windowId };
            const hasVirtualWidth = data.virtualWidth !== undefined;
            const hasVirtualHeight = data.virtualHeight !== undefined;
            if (hasVirtualWidth || hasVirtualHeight) {
                if (
                    !Number.isFinite(current.pixelWidth) ||
                    !Number.isFinite(current.pixelHeight) ||
                    current.pixelWidth <= 0 ||
                    current.pixelHeight <= 0
                ) {
                    throw new Error('Window pixel dimensions are not available');
                }

                const virtualWidth = hasVirtualWidth
                    ? data.virtualWidth
                    : Number(data.virtualHeight) * current.pixelWidth / current.pixelHeight;
                if (typeof virtualWidth !== 'number' || !Number.isFinite(virtualWidth) || virtualWidth <= 0) {
                    throw new Error('Invalid virtualWidth');
                }

                const virtualHeight = virtualWidth * current.pixelHeight / current.pixelWidth;
                if (!Number.isFinite(virtualHeight) || virtualHeight <= 0) {
                    throw new Error('Invalid virtualHeight');
                }
                updates.virtualWidth = virtualWidth;
                updates.virtualHeight = virtualHeight;
            }

            if (data.posx !== undefined) {
                if (typeof data.posx !== 'number' || !Number.isFinite(data.posx)) {
                    throw new Error('Invalid posx');
                }
                updates.posx = data.posx;
            }
            if (data.posy !== undefined) {
                if (typeof data.posy !== 'number' || !Number.isFinite(data.posy)) {
                    throw new Error('Invalid posy');
                }
                updates.posy = data.posy;
            }

            const contentVisible = data.contentVisible ?? data.visible;
            if (contentVisible !== undefined) {
                if (typeof contentVisible !== 'boolean') {
                    throw new Error('Invalid contentVisible');
                }
                updates.contentVisible = contentVisible;
            }
            if (typeof data.siteId === 'string') {
                updates.siteId = data.siteId;
            }
            if (typeof data.displayName === 'string') {
                updates.displayName = data.displayName;
            }

            const updated = await this.windowMetaDataService.updateWindowMetaData(updates);
            if (updated && this.wsConnector && this.clients) {
                this.wsConnector.broadcast(
                    this.clients,
                    Command.UpdateWindowMetaData,
                    updated,
                    undefined,
                    socketId,
                );
            }
            return updated;
        });
    }

    async updateWindowMetaData(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        const isAuthenticated = await this.sessionManager.isAuthenticated(socketId);
        if (!isAuthenticated) {
            // 承認済みDisplayに限り、自分のウィンドウの pixelWidth/pixelHeight のみ更新を許可
            const displaySession = await this.displaySessionService.getDisplaySessionBySocketId(socketId);
            if (!displaySession || displaySession.status !== 'approved' || !displaySession.isOnline) {
                resultCallback({ code: -32001, message: 'Authentication required' });
                return;
            }
            // 単一オブジェクトかつ自分のウィンドウの pixelWidth/pixelHeight のみ許可
            const singleData = Array.isArray(data) ? null : data;
            if (!singleData || singleData.id !== displaySession.windowId) {
                resultCallback({ code: -32003, message: 'Display can only update its own window' });
                return;
            }
            const allowedDisplayFields = new Set(['id', 'pixelWidth', 'pixelHeight']);
            if (Object.keys(singleData).some((field) => !allowedDisplayFields.has(field))) {
                resultCallback({ code: -32003, message: 'Display can only update pixelWidth and pixelHeight' });
                return;
            }
            if (
                typeof singleData.pixelWidth !== 'number' ||
                typeof singleData.pixelHeight !== 'number' ||
                !Number.isFinite(singleData.pixelWidth) ||
                !Number.isFinite(singleData.pixelHeight) ||
                singleData.pixelWidth <= 0 ||
                singleData.pixelHeight <= 0
            ) {
                resultCallback({ code: -32074, message: 'Invalid physical pixel dimensions' });
                return;
            }
            const result = await this.windowMetadataUpdateExecutor.run(
                singleData.id,
                async (): Promise<WindowMetaData | null> => {
                    const current = await this.windowMetaDataService.getWindowMetaData({ id: singleData.id, type: 'single' });
                    if (!current || Array.isArray(current)) {
                        return null;
                    }
                    const virtualHeight = current.virtualWidth * singleData.pixelHeight / singleData.pixelWidth;
                    if (!Number.isFinite(virtualHeight) || virtualHeight <= 0) {
                        throw new Error('Invalid virtualHeight after physical resize');
                    }
                    const updated = await this.windowMetaDataService.updateWindowMetaData({
                        id: singleData.id,
                        pixelWidth: singleData.pixelWidth,
                        pixelHeight: singleData.pixelHeight,
                        virtualHeight,
                    });
                    if (updated && this.wsConnector && this.clients) {
                        this.wsConnector.broadcast(this.clients, Command.UpdateWindowMetaData, updated);
                    }
                    return updated;
                },
            );
            if (!result) {
                resultCallback({ code: -32072, message: 'Window not found' });
                return;
            }
            resultCallback(null, result);
            return;
        }

        console.log('[CommandHandler] UpdateWindowMetaData called', data);

        const containsPixelDimensions = Array.isArray(data)
            ? data.some((item: any) => item?.pixelWidth !== undefined || item?.pixelHeight !== undefined)
            : data?.pixelWidth !== undefined || data?.pixelHeight !== undefined;
        if (containsPixelDimensions) {
            resultCallback({ code: -32074, message: 'Controller cannot update physical pixel dimensions' });
            return;
        }

        try {
            // 配列の場合は各要素を処理
            if (Array.isArray(data)) {
                const results = [];
                for (const item of data) {
                    if (!item || typeof item.id !== 'string') {
                        continue;
                    }
                    const result = await this.updateControllerWindowMetaData(socketId, item as Record<string, unknown>);

                    if (result) {
                        results.push(result);
                    }
                }

                resultCallback(null, results);
            } else {
                // 単一オブジェクトの場合
                if (!data || typeof data !== 'object' || typeof data.id !== 'string') {
                    resultCallback({ code: -32072, message: 'Missing window id' });
                    return;
                }
                const result = await this.updateControllerWindowMetaData(socketId, data as Record<string, unknown>);

                if (!result) {
                    resultCallback({ code: -32072, message: 'Window not found' });
                    return;
                }

                resultCallback(null, result);
            }
        } catch (error: any) {
            console.error('[CommandHandler] UpdateWindowMetaData error:', error);
            resultCallback({ code: -32073, message: error.message });
        }
    }

    async deleteWindowMetaData(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] DeleteWindowMetaData called', data);

        try {
            const success = await this.windowMetaDataService.deleteWindowMetaData({
                id: data.id,
            });

            if (!success) {
                resultCallback({ code: -32074, message: 'Window not found' });
                return;
            }

            // 他のクライアントに通知
            if (this.wsConnector && this.clients) {
                this.wsConnector.broadcast(
                    this.clients,
                    Command.DeleteWindowMetaData,
                    { id: data.id },
                    undefined
                );
            }

            resultCallback(null, { success: true });
        } catch (error: any) {
            console.error('[CommandHandler] DeleteWindowMetaData error:', error);
            resultCallback({ code: -32075, message: error.message });
        }
    }

    // ========================================
    // DisplaySpace 関連
    // ========================================

    async getDisplaySpace(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuthOrApprovedDisplay(socketId, resultCallback)) return;

        try {
            const displaySpace = await this.siteService.getDisplaySpace(data.siteId);

            resultCallback(null, displaySpace);
        } catch (error: any) {
            console.error('[CommandHandler] GetDisplaySpace error:', error);
            resultCallback({ code: -32080, message: error.message });
        }
    }

    async updateDisplaySpace(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] UpdateDisplaySpace called', data);

        try {
            const result = await this.siteService.updateDisplaySpace(data.siteId, {
                virtualWidth: data.virtualWidth,
                virtualHeight: data.virtualHeight,
                splitX: data.splitX,
                splitY: data.splitY,
                scale: data.scale,
            });

            // 他のクライアントに通知
            if (this.wsConnector && this.clients) {
                this.wsConnector.broadcast(
                    this.clients,
                    Command.UpdateDisplaySpace,
                    result,
                    undefined
                );
            }

            resultCallback(null, result);
        } catch (error: any) {
            console.error('[CommandHandler] UpdateDisplaySpace error:', error);
            resultCallback({ code: -32081, message: error.message });
        }
    }

    // ========================================
    // Site 管理
    // ========================================

    async getSiteList(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;
        try {
            const sites = await this.siteService.getAllSites();
            resultCallback(null, { sites });
        } catch (error: any) {
            console.error('[CommandHandler] GetSiteList error:', error);
            resultCallback({ code: -32090, message: error.message });
        }
    }

    async getSite(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;
        try {
            const site = await this.siteService.getSite({ siteId: data.siteId });
            if (!site) {
                resultCallback({ code: -32091, message: 'Site not found' });
                return;
            }
            resultCallback(null, site);
        } catch (error: any) {
            console.error('[CommandHandler] GetSite error:', error);
            resultCallback({ code: -32091, message: error.message });
        }
    }

    async createSite(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAdminAuth(socketId, resultCallback)) return;
        try {
            const site = await this.siteService.createSite({
                siteName: data.siteName,
                description: data.description,
                color: data.color,
            });

            // DisplaySpace パラメータの指定があれば上書き
            const hasDisplaySpaceParams = data.virtualWidth !== undefined
                || data.virtualHeight !== undefined
                || data.splitX !== undefined
                || data.splitY !== undefined
                || data.scale !== undefined;

            if (hasDisplaySpaceParams) {
                await this.siteService.updateDisplaySpace(site.siteId, {
                    virtualWidth: data.virtualWidth,
                    virtualHeight: data.virtualHeight,
                    splitX: data.splitX,
                    splitY: data.splitY,
                    scale: data.scale,
                });
                // displaySpace を上書きした後の Site を再取得
                const siteWithUpdatedSpace = await this.siteService.getSite({ siteId: site.siteId });
                resultCallback(null, siteWithUpdatedSpace);
            } else {
                resultCallback(null, site);
            }
        } catch (error: any) {
            console.error('[CommandHandler] CreateSite error:', error);
            resultCallback({ code: -32092, message: error.message });
        }
    }

    async updateSite(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAdminAuth(socketId, resultCallback)) return;
        try {
            const site = await this.siteService.updateSite({
                siteId: data.siteId,
                siteName: data.siteName,
                description: data.description,
                color: data.color,
            });
            if (!site) {
                resultCallback({ code: -32093, message: 'Site not found' });
                return;
            }
            resultCallback(null, site);
        } catch (error: any) {
            console.error('[CommandHandler] UpdateSite error:', error);
            resultCallback({ code: -32093, message: error.message });
        }
    }

    async deleteSite(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAdminAuth(socketId, resultCallback)) return;
        try {
            const deleted = await this.siteService.deleteSite({ siteId: data.siteId });
            if (!deleted) {
                resultCallback({ code: -32094, message: 'Site not found' });
                return;
            }
            resultCallback(null, { success: true });
        } catch (error: any) {
            console.error('[CommandHandler] DeleteSite error:', error);
            resultCallback({ code: -32094, message: error.message });
        }
    }

    async getDisplaysBySite(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;
        try {
            const site = await this.siteService.getSite({ siteId: data.siteId });
            if (!site) {
                resultCallback({ code: -32091, message: 'Site not found' });
                return;
            }
            const displayIds = await this.windowMetaDataService.getDisplayIdsBySite(data.siteId);
            resultCallback(null, { displayIds });
        } catch (error: any) {
            console.error('[CommandHandler] GetDisplaysBySite error:', error);
            resultCallback({ code: -32095, message: error.message });
        }
    }

    // ========================================
    // その他
    // ========================================

    async updateMouseCursor(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        const payload = {
            ...data,
            color: this.sessionManager.getOrCreateCursorColor(socketId),
        };

        // ログイン済みコントローラ + 承認済みDisplay にのみ通知
        if (this.wsConnector && this.clients) {
            const loggedInSocketIds = new Set<string>();
            const allSessions = await this.sessionManager.getAllSessions();
            for (const session of allSessions) {
                if (session.role !== UserRole.DISPLAY) {
                    loggedInSocketIds.add(session.socketId);
                }
            }

            const approvedDisplaySocketIds = new Set<string>();
            const approvedDisplays = await this.displaySessionService.getApprovedDisplays();
            for (const display of approvedDisplays) {
                if (display.isOnline && display.socketId !== '') {
                    approvedDisplaySocketIds.add(display.socketId);
                }
            }

            const targetSocketIds: string[] = [];
            for (const client of this.clients) {
                if (client.readyState !== 1) {
                    continue;
                }
                const isLoggedIn = loggedInSocketIds.has(client.id);
                const isApprovedDisplay = approvedDisplaySocketIds.has(client.id);
                if (isLoggedIn || isApprovedDisplay) {
                    targetSocketIds.push(client.id);
                }
            }

            this.wsConnector.broadcastToTargets(
                targetSocketIds,
                this.clients,
                Command.UpdateMouseCursor,
                payload,
                undefined
            );
        }

        resultCallback(null, { success: true });
    }

    async sendMessage(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;
        resultCallback(null, { success: true });
        // 全クライアントにブロードキャスト（タイムライン同期・パフォーマンス計測結果など）
        if (this.wsConnector && this.clients) {
            this.wsConnector.broadcast(
                this.clients,
                Command.SendMessage,
                data
            );
        }
    }

    reloadDisplay(socketId: string, data: any, resultCallback: ResultCallback): void {
        resultCallback(null, { success: true });
    }

    /**
     * 承認済み全ディスプレイにコンテンツ再ロードを指示
     */
    async refreshDisplayContent(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAdminAuth(socketId, resultCallback)) return;

        try {
            const approvedDisplays = await this.displaySessionService.getApprovedDisplays();

            resultCallback(null, { success: true, displayCount: approvedDisplays.length });

            if (this.wsConnector && this.clients) {
                const approvedSocketIds = new Set(approvedDisplays.map((d) => d.socketId));
                this.clients.forEach((client) => {
                    if (approvedSocketIds.has(client.id) && client.readyState === 1) {
                        const message = {
                            jsonrpc: '2.0',
                            id: String(Math.random()),
                            method: Command.RefreshDisplayContent,
                            params: {},
                            to: 'client',
                        };
                        client.sendQueued(JSON.stringify(message), true);
                    }
                });
            }
        } catch (error: any) {
            resultCallback({ code: -32099, message: error.message });
        }
    }

    measureDisplay(socketId: string, data: any, resultCallback: ResultCallback): void {
        resultCallback(null, { success: true });
    }

    async showWindowID(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;
        resultCallback(null, { success: true });
    }

    // ========================================
    // ディスプレイセッション管理
    // ========================================

    /**
     * ディスプレイ登録（認証不要）
     */
    async registerDisplay(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        console.log('[CommandHandler] RegisterDisplay called', data);

        try {
            const { displayName, screenWidth, screenHeight } = data;

            if (!displayName || !screenWidth || !screenHeight) {
                resultCallback({ code: -32090, message: 'Missing displayName, screenWidth, or screenHeight' });
                return;
            }

            // Displayは認証不要、DisplaySessionServiceで管理
            const session = await this.displaySessionService.registerDisplay(
                displayName,
                socketId,
                screenWidth,
                screenHeight
            );

            console.log(`[CommandHandler] Display registered: ${session.displayId} (${session.displayName}), status: ${session.status}`);

            // 承認済みの場合、WindowMetaDataが存在するか確認し、なければ作成
            if (session.status === 'approved' && session.windowId) {
                const approvedWindowId = session.windowId;
                await this.windowMetadataUpdateExecutor.run(approvedWindowId, async (): Promise<void> => {
                    const existingWindow = await this.windowMetaDataService.getWindowMetaData({
                        id: approvedWindowId,
                        type: 'single'
                    });

                    if (!existingWindow || Array.isArray(existingWindow)) {
                        await this.windowMetaDataService.addWindowMetaData({
                            id: approvedWindowId,
                            posx: 0,
                            posy: 0,
                            virtualWidth: screenWidth,
                            virtualHeight: screenHeight,
                            pixelWidth: screenWidth,
                            pixelHeight: screenHeight,
                            contentVisible: true,
                            displayId: session.displayId,
                            displayName: session.displayName,
                        });
                        console.log(`[CommandHandler] WindowMetaData recreated for approved display: ${session.displayId}`);
                        return;
                    }

                    const pixelDimensionsValid = Number.isFinite(screenWidth)
                        && Number.isFinite(screenHeight)
                        && screenWidth > 0
                        && screenHeight > 0;
                    const updates: UpdateWindowMetaDataRequest = {
                        id: approvedWindowId,
                        displayName: session.displayName,
                    };
                    if (pixelDimensionsValid) {
                        updates.pixelWidth = screenWidth;
                        updates.pixelHeight = screenHeight;
                        updates.virtualHeight = existingWindow.virtualWidth * screenHeight / screenWidth;
                    }
                    await this.windowMetaDataService.updateWindowMetaData(updates);
                });
            }

            resultCallback(null, {
                session,
                message: session.status === 'approved' ? 'Display approved' : 'Waiting for approval'
            });

            // コントローラーに通知
            if (this.wsConnector && this.clients) {
                const controllerSessions = await this.sessionManager.getAllSessions();
                const controllerSocketIds = controllerSessions
                    .filter(s => s.role !== 'display')
                    .map(s => s.socketId);

                if (session.status === 'pending') {
                    // 未承認の場合: NewDisplayConnected通知
                    this.clients.forEach((client) => {
                        if (controllerSocketIds.includes(client.id) && client.readyState === 1) {
                            const notifyMessage = {
                                jsonrpc: '2.0',
                                id: String(Math.random()),
                                method: 'NewDisplayConnected',
                                params: { session },
                                to: 'client',
                            };
                            client.sendQueued(JSON.stringify(notifyMessage), true);
                        }
                    });
                } else if (session.status === 'approved') {
                    // 承認済みの場合: DisplayListUpdated通知（再接続を通知）
                    this.clients.forEach((client) => {
                        if (controllerSocketIds.includes(client.id) && client.readyState === 1) {
                            const notifyMessage = {
                                jsonrpc: '2.0',
                                id: String(Math.random()),
                                method: 'DisplayListUpdated',
                                params: {},
                                to: 'client',
                            };
                            client.sendQueued(JSON.stringify(notifyMessage), true);
                        }
                    });
                }
            }
        } catch (error: any) {
            console.error('[CommandHandler] RegisterDisplay error:', error);
            resultCallback({ code: -32091, message: error.message });
        }
    }

    /**
     * 未承認ディスプレイ一覧取得
     */
    async getPendingDisplays(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAdminAuth(socketId, resultCallback)) return;

        try {
            const displays = await this.displaySessionService.getPendingDisplays();
            resultCallback(null, { displays });
        } catch (error: any) {
            console.error('[CommandHandler] GetPendingDisplays error:', error);
            resultCallback({ code: -32092, message: error.message });
        }
    }

    /**
     * 承認済みディスプレイ一覧取得
     */
    async getApprovedDisplays(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        try {
            const displays = await this.displaySessionService.getApprovedDisplays();
            resultCallback(null, { displays });
        } catch (error: any) {
            console.error('[CommandHandler] GetApprovedDisplays error:', error);
            resultCallback({ code: -32093, message: error.message });
        }
    }

    /**
     * ディスプレイ承認
     */
    async approveDisplay(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAdminAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] ApproveDisplay called', data);

        try {
            const { displayId, posx, posy, virtualWidth, virtualHeight } = data;

            if (!displayId || posx === undefined || posy === undefined || !virtualWidth || !virtualHeight) {
                resultCallback({ code: -32094, message: 'Missing displayId, posx, posy, virtualWidth, or virtualHeight' });
                return;
            }

            // まずWindowMetaDataを作成
            const windowId = `window_${displayId}`;
            const session = await this.displaySessionService.getDisplaySession(displayId);
            if (!session) {
                resultCallback({ code: -32095, message: 'Display not found' });
                return;
            }

            // WindowMetaData取得（pixelWidth/pixelHeight取得のため）
            const existingWindow = await this.windowMetaDataService.getWindowMetaDataByDisplayId(displayId);
            const pixelWidth = existingWindow?.pixelWidth || virtualWidth;
            const pixelHeight = existingWindow?.pixelHeight || virtualHeight;

            const windowData = await this.windowMetaDataService.addWindowMetaData({
                id: windowId,
                posx,
                posy,
                virtualWidth,
                virtualHeight,
                pixelWidth,
                pixelHeight,
                contentVisible: true,
                displayId,
                displayName: session.displayName,
                siteId: data.siteId || DEFAULT_SITE_ID,
            });

            // DisplaySessionを承認状態に更新
            const updatedSession = await this.displaySessionService.approveDisplay(
                displayId,
                windowId
            );

            if (!updatedSession) {
                resultCallback({ code: -32095, message: 'Failed to approve display' });
                return;
            }

            console.log(`[CommandHandler] Display approved: ${displayId}, position: (${posx}, ${posy})`);

            resultCallback(null, { session: updatedSession, windowData });

            // ディスプレイに承認通知を送信
            if (this.wsConnector && this.clients) {
                this.clients.forEach((client) => {
                    if (client.id === session.socketId && client.readyState === 1) {
                        const approvalMessage = {
                            jsonrpc: '2.0',
                            id: String(Math.random()),
                            method: Command.DisplayApproved,
                            params: {
                                displayId,
                                posx,
                                posy,
                                virtualWidth,
                                virtualHeight,
                                windowId: windowData.id
                            },
                            to: 'client',
                        };
                        client.sendQueued(JSON.stringify(approvalMessage), true);
                    }
                });

                // 承認されたDisplayに既存の配信を通知
                await this.notifyExistingStreams(session.socketId);

                // 全コントローラ（Admin + Member）にディスプレイ一覧更新を通知
                const controllerSessions = await this.sessionManager.getAllSessions();
                const controllerSocketIds = controllerSessions
                    .filter(s => s.role !== 'display')
                    .map(s => s.socketId);

                this.clients.forEach((client) => {
                    if (controllerSocketIds.includes(client.id) && client.readyState === 1) {
                        const updateMessage = {
                            jsonrpc: '2.0',
                            id: String(Math.random()),
                            method: 'DisplayListUpdated',
                            params: {},
                            to: 'client',
                        };
                        client.sendQueued(JSON.stringify(updateMessage), true);
                    }
                });
            }
        } catch (error: any) {
            console.error('[CommandHandler] ApproveDisplay error:', error);
            resultCallback({ code: -32096, message: error.message });
        }
    }

    /**
     * ディスプレイ拒否（接続待ちリストから削除）
     */
    async rejectDisplay(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAdminAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] RejectDisplay called', data);

        try {
            const { displayId } = data;

            if (!displayId) {
                resultCallback({ code: -32097, message: 'Missing displayId' });
                return;
            }

            // ディスプレイセッションを取得
            const session = await this.displaySessionService.getDisplaySession(displayId);
            if (!session) {
                resultCallback({ code: -32098, message: 'Display not found' });
                return;
            }

            // ディスプレイ接続を切断（接続中の場合）
            if (this.clients) {
                this.clients.forEach((client) => {
                    if (client.id === session.socketId && client.readyState === 1) {
                        // 切断前に DisplayRejected 通知を送信（クライアントが再接続しないようにするため）
                        const rejectedMessage = {
                            jsonrpc: '2.0',
                            id: String(Math.random()),
                            method: 'DisplayRejected',
                            params: { displayId },
                            to: 'client',
                        };
                        client.sendQueued(JSON.stringify(rejectedMessage), true);
                        // 少し待ってから切断（メッセージが届くようにするため）
                        setTimeout(() => client.close(), 200);
                    }
                });
            }

            // セッションを削除
            const deleted = await this.displaySessionService.rejectDisplay(displayId);
            if (!deleted) {
                resultCallback({ code: -32099, message: 'Failed to reject display' });
                return;
            }

            console.log(`[CommandHandler] Display rejected: ${displayId}`);

            resultCallback(null, { success: true });

            // 全コントローラ（Admin + Member）にディスプレイ一覧更新を通知
            if (this.wsConnector && this.clients) {
                const controllerSessions = await this.sessionManager.getAllSessions();
                const controllerSocketIds = controllerSessions
                    .filter(s => s.role !== 'display')
                    .map(s => s.socketId);

                this.clients.forEach((client) => {
                    if (controllerSocketIds.includes(client.id) && client.readyState === 1) {
                        const updateMessage = {
                            jsonrpc: '2.0',
                            id: String(Math.random()),
                            method: 'DisplayListUpdated',
                            params: {},
                            to: 'client',
                        };
                        client.sendQueued(JSON.stringify(updateMessage), true);
                    }
                });
            }
        } catch (error: any) {
            console.error('[CommandHandler] RejectDisplay error:', error);
            resultCallback({ code: -32100, message: error.message });
        }
    }

    /**
     * ディスプレイ削除
     */
    async deleteDisplay(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAdminAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] DeleteDisplay called', data);

        try {
            const { displayId } = data;

            if (!displayId) {
                resultCallback({ code: -32097, message: 'Missing displayId' });
                return;
            }

            // ディスプレイセッションを取得
            const session = await this.displaySessionService.getDisplaySession(displayId);
            if (!session) {
                resultCallback({ code: -32098, message: 'Display not found' });
                return;
            }

            // 接続中ディスプレイには削除前に拒否通知を送り、その後切断する
            if (this.clients && session.socketId !== '') {
                const targetClient = Array.from(this.clients).find((client) => {
                    return client.id === session.socketId && client.readyState === 1;
                });

                if (targetClient) {
                    try {
                        const rejectedMessage = {
                            jsonrpc: '2.0',
                            id: String(Math.random()),
                            method: 'DisplayRejected',
                            params: { displayId },
                            to: 'client',
                        };
                        targetClient.sendQueued(JSON.stringify(rejectedMessage), true);

                        // Reject と同じく、通知到達の猶予を置いてから切断
                        setTimeout(() => {
                            try {
                                targetClient.close();
                            } catch (error) {
                                console.error(`[CommandHandler] Failed to close deleted display socket ${session.socketId}:`, error);
                            }
                        }, 200);
                    } catch (error) {
                        console.error(`[CommandHandler] Failed to notify deleted display ${displayId}:`, error);
                        try {
                            targetClient.close();
                        } catch (closeError) {
                            console.error(`[CommandHandler] Failed to close deleted display socket ${session.socketId}:`, closeError);
                        }
                    }
                }
            }

            const success = await this.displaySessionService.deleteDisplaySession(displayId);

            if (!success) {
                resultCallback({ code: -32098, message: 'Display not found' });
                return;
            }

            // 対応するWindowMetaDataも削除
            await this.windowMetaDataService.deleteWindowMetaData({ id: `window_${displayId}` });

            console.log(`[CommandHandler] Display deleted: ${displayId}`);

            resultCallback(null, { success: true });

            // 全Adminにディスプレイ一覧更新を通知
            if (this.wsConnector && this.clients) {
                const controllerSessions = await this.sessionManager.getAllSessions();
                const controllerSocketIds = controllerSessions
                    .filter(s => s.role !== 'display')
                    .map(s => s.socketId);

                this.clients.forEach((client) => {
                    if (controllerSocketIds.includes(client.id) && client.readyState === 1) {
                        const updateMessage = {
                            jsonrpc: '2.0',
                            id: String(Math.random()),
                            method: 'DisplayListUpdated',
                            params: {},
                            to: 'client',
                        };
                        client.sendQueued(JSON.stringify(updateMessage), true);
                    }
                });
            }
        } catch (error: any) {
            console.error('[CommandHandler] DeleteDisplay error:', error);
            resultCallback({ code: -32099, message: error.message });
        }
    }

    // ========================================
    // mediasoup 関連
    // ========================================

    /**
     * Router の RTP Capabilities を取得
     */
    async getRouterRtpCapabilities(
        socketId: string,
        data: any,
        resultCallback: ResultCallback
    ): Promise<void> {
        try {
            if (!(await this.checkAuthOrApprovedDisplay(socketId, resultCallback))) return;

            const rtpCapabilities = this.mediaService.getRouterRtpCapabilities();
            resultCallback(null, { rtpCapabilities });
        } catch (error: any) {
            console.error('[CommandHandler] GetRouterRtpCapabilities error:', error);
            resultCallback({ code: -32100, message: error.message });
        }
    }

    /**
     * WebRTC Transport を作成
     */
    async createWebRtcTransport(
        socketId: string,
        data: any,
        resultCallback: ResultCallback
    ): Promise<void> {
        try {
            if (!(await this.checkAuthOrApprovedDisplay(socketId, resultCallback))) return;

            const request: CreateTransportRequest = data;

            if (!request.direction || !['send', 'recv'].includes(request.direction)) {
                resultCallback({ code: -32101, message: 'Invalid direction' });
                return;
            }

            const response = await this.mediaService.createWebRtcTransport(
                socketId,
                request
            );

            resultCallback(null, response);
        } catch (error: any) {
            console.error('[CommandHandler] CreateWebRtcTransport error:', error);
            resultCallback({ code: -32102, message: error.message });
        }
    }

    /**
     * Transport を接続
     */
    async connectWebRtcTransport(
        socketId: string,
        data: any,
        resultCallback: ResultCallback
    ): Promise<void> {
        try {
            if (!(await this.checkAuthOrApprovedDisplay(socketId, resultCallback))) return;

            const request: ConnectTransportRequest = data;

            if (!request.transportId || !request.dtlsParameters) {
                resultCallback({
                    code: -32103,
                    message: 'Missing transportId or dtlsParameters',
                });
                return;
            }

            await this.mediaService.connectTransport(request);

            resultCallback(null, { success: true });
        } catch (error: any) {
            console.error('[CommandHandler] ConnectWebRtcTransport error:', error);
            resultCallback({ code: -32104, message: error.message });
        }
    }

    /**
     * Producer を作成
     */
    async produce(
        socketId: string,
        data: any,
        resultCallback: ResultCallback
    ): Promise<void> {
        try {
            if (!(await this.checkAuth(socketId, resultCallback))) return;

            const session = await this.sessionManager.getSession(socketId);
            if (!session) {
                resultCallback({ code: -32001, message: 'Session not found' });
                return;
            }

            const request: ProduceRequest = data;

            if (
                !request.transportId ||
                !request.kind ||
                !request.rtpParameters ||
                !['audio', 'video'].includes(request.kind)
            ) {
                resultCallback({
                    code: -32105,
                    message: 'Invalid produce request',
                });
                return;
            }

            const response = await this.mediaService.produce(
                socketId,
                session.userId,
                request
            );

            resultCallback(null, response);

            // 他のクライアントに新しいProducerを通知
            if (this.wsConnector && this.clients) {
                const notifyMessage = {
                    jsonrpc: '2.0',
                    id: String(Math.random()),
                    method: 'NewProducerAvailable',
                    params: {
                        producerId: response.producerId,
                        userId: session.userId,
                        socketId: socketId,  // 送信元のsocketIdを追加
                        kind: request.kind,
                        streamId: response.streamId,
                        metadataId: response.metadataId,
                    },
                    to: 'client',
                };

                let notifyCount = 0;
                for (const client of this.clients) {
                    if (client.id !== socketId && client.readyState === 1) {
                        // 認証・承認チェック
                        if (await this.canReceiveBroadcast(client.id)) {
                            client.sendQueued(JSON.stringify(notifyMessage), true);
                            notifyCount++;
                        }
                    }
                }

                console.log(`[CommandHandler] NewProducerAvailable broadcast [producerId:${response.producerId}, streamId:${response.streamId}, kind:${request.kind}, notified:${notifyCount} clients]`);

                // StreamMetadataが作成された場合（video producer）はNewContentAddedも送信
                if (response.metadataId && request.kind === 'video') {
                    // StreamMetadataを取得
                    const streamMetadata = await this.contentService.getMetadata(response.metadataId);

                    if (streamMetadata) {
                        const contentMessage = {
                            jsonrpc: '2.0',
                            id: String(Math.random()),
                            method: 'NewContentAdded',
                            params: { metadata: streamMetadata },
                            to: 'client',
                        };

                        for (const client of this.clients) {
                            if (client.readyState === 1) {
                                // 認証・承認チェック
                                if (await this.canReceiveBroadcast(client.id)) {
                                    client.sendQueued(JSON.stringify(contentMessage), true);
                                }
                            }
                        }

                        console.log(`[CommandHandler] NewContentAdded broadcast [metadataId:${response.metadataId}, type:live-stream]`);
                    }
                }
            }
        } catch (error: any) {
            console.error('[CommandHandler] Produce error:', error);
            resultCallback({ code: -32106, message: error.message });
        }
    }

    /**
     * Producer を閉じる
     */
    async closeProducer(
        socketId: string,
        data: any,
        resultCallback: ResultCallback
    ): Promise<void> {
        try {
            if (!(await this.checkAuth(socketId, resultCallback))) return;

            const { producerId } = data;

            if (!producerId) {
                resultCallback({ code: -32107, message: 'Missing producerId' });
                return;
            }

            const deletedMetadataId = await this.mediaService.closeProducer(producerId, socketId);

            resultCallback(null, { success: true });

            // 削除されたメタデータがあれば全クライアントに通知
            if (deletedMetadataId && this.wsConnector && this.clients) {
                const deleteMessage = {
                    jsonrpc: '2.0',
                    id: String(Math.random()),
                    method: 'DeleteContent',
                    params: { metadataId: deletedMetadataId },
                    to: 'client',
                };

                for (const client of this.clients) {
                    if (client.readyState === 1) {
                        // 認証・承認チェック
                        if (await this.canReceiveBroadcast(client.id)) {
                            client.sendQueued(JSON.stringify(deleteMessage), true);
                        }
                    }
                }

                console.log(`[CommandHandler] DeleteContent broadcast [metadataId:${deletedMetadataId}]`);
            }
        } catch (error: any) {
            console.error('[CommandHandler] CloseProducer error:', error);
            resultCallback({ code: -32108, message: error.message });
        }
    }

    /**
     * Consumer を作成
     */
    async consume(
        socketId: string,
        data: any,
        resultCallback: ResultCallback
    ): Promise<void> {
        try {
            if (!(await this.checkAuthOrApprovedDisplay(socketId, resultCallback))) return;

            const request: ConsumeRequest = data;

            if (
                !request.transportId ||
                !request.producerId ||
                !request.rtpCapabilities
            ) {
                resultCallback({
                    code: -32107,
                    message: 'Invalid consume request',
                });
                return;
            }

            const response = await this.mediaService.consume(socketId, request);

            resultCallback(null, response);
        } catch (error: any) {
            console.error('[CommandHandler] Consume error:', error);
            resultCallback({ code: -32108, message: error.message });
        }
    }

    /**
     * Consumerと専用受信Transportを閉じる
     */
    async closeConsumer(
        socketId: string,
        data: any,
        resultCallback: ResultCallback
    ): Promise<void> {
        try {
            if (!(await this.checkAuthOrApprovedDisplay(socketId, resultCallback))) return;

            const { consumerId, transportId } = data;
            if (typeof transportId !== 'string' || transportId.length === 0) {
                resultCallback({ code: -32112, message: 'Missing transportId' });
                return;
            }
            if (consumerId !== undefined && typeof consumerId !== 'string') {
                resultCallback({ code: -32113, message: 'Invalid consumerId' });
                return;
            }

            await this.mediaService.closeConsumer(socketId, consumerId, transportId);
            resultCallback(null, { success: true });
        } catch (error: any) {
            console.error('[CommandHandler] CloseConsumer error:', error);
            resultCallback({ code: -32114, message: error.message });
        }
    }

    /**
     * Consumer を再開
     */
    async resumeConsumer(
        socketId: string,
        data: any,
        resultCallback: ResultCallback
    ): Promise<void> {
        try {
            if (!(await this.checkAuthOrApprovedDisplay(socketId, resultCallback))) return;

            const { consumerId } = data;

            if (!consumerId) {
                resultCallback({ code: -32109, message: 'Missing consumerId' });
                return;
            }

            await this.mediaService.resumeConsumer(consumerId);

            resultCallback(null, { success: true });
        } catch (error: any) {
            console.error('[CommandHandler] ResumeConsumer error:', error);
            resultCallback({ code: -32110, message: error.message });
        }
    }

    /**
     * アクティブな Producer 一覧を取得
     */
    async getActiveProducers(
        socketId: string,
        data: any,
        resultCallback: ResultCallback
    ): Promise<void> {
        try {
            if (!(await this.checkAuthOrApprovedDisplay(socketId, resultCallback))) return;

            const response = await this.mediaService.getActiveProducers();

            resultCallback(null, response);
        } catch (error: any) {
            console.error('[CommandHandler] GetActiveProducers error:', error);
            resultCallback({ code: -32111, message: error.message });
        }
    }

    // ========================================
    // ContentsLayout
    // ========================================

    /**
     * 現在のコンテンツ配置をレイアウトとして保存
     */
    async saveContentsLayout(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] SaveContentsLayout called');

        try {
            const { name, layoutId } = data || {};

            if (!name) {
                resultCallback({ code: -32060, message: 'Missing name' });
                return;
            }

            const layout = await this.layoutService.saveLayout({ name, layoutId });
            resultCallback(null, layout);
        } catch (error: any) {
            console.error('[CommandHandler] SaveContentsLayout error:', error);
            resultCallback({ code: -32099, message: error.message });
        }
    }

    /**
     * 保存済みレイアウト一覧を取得（entries は含まない）
     */
    async getContentsLayoutList(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] GetContentsLayoutList called');

        try {
            const layouts = await this.layoutService.getAllLayouts();
            resultCallback(null, { layouts });
        } catch (error: any) {
            console.error('[CommandHandler] GetContentsLayoutList error:', error);
            resultCallback({ code: -32099, message: error.message });
        }
    }

    /**
     * 保存済みレイアウト1件を取得
     */
    async getContentsLayout(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] GetContentsLayout called');

        try {
            const { layoutId } = data || {};

            if (!layoutId) {
                resultCallback({ code: -32060, message: 'Missing layoutId' });
                return;
            }

            const layout = await this.layoutService.getLayout(layoutId);
            if (!layout) {
                resultCallback({ code: -32061, message: 'Layout not found' });
                return;
            }

            resultCallback(null, layout);
        } catch (error: any) {
            console.error('[CommandHandler] GetContentsLayout error:', error);
            resultCallback({ code: -32099, message: error.message });
        }
    }

    /**
     * レイアウトを復元し、全クライアントへ BulkUpdateMetaData をブロードキャスト
     */
    async restoreContentsLayout(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] RestoreContentsLayout called');

        try {
            const { layoutId } = data || {};

            if (!layoutId) {
                resultCallback({ code: -32060, message: 'Missing layoutId' });
                return;
            }

            const result = await this.layoutService.restoreLayout(layoutId);
            if (!result) {
                resultCallback({ code: -32062, message: 'Layout not found' });
                return;
            }

            // 更新されたメタデータを取得してブロードキャスト
            const metadataList: ContentMetadata[] = [];
            for (const metadataId of result.updatedIds) {
                const meta = await this.contentService.getMetadata(metadataId);
                if (meta) {
                    metadataList.push(meta);
                }
            }
            const orderedMetadataList = [...metadataList].sort(compareContentMetadataForDisplayOrder);

            resultCallback(null, { updatedIds: result.updatedIds, skippedIds: result.skippedIds });

            if (this.wsConnector && this.clients && orderedMetadataList.length > 0) {
                this.wsConnector.broadcast(
                    this.clients,
                    Command.BulkUpdateMetaData,
                    { metadataList: orderedMetadataList }
                );
            }
        } catch (error: any) {
            console.error('[CommandHandler] RestoreContentsLayout error:', error);
            resultCallback({ code: -32099, message: error.message });
        }
    }

    /**
     * レイアウトを削除
     */
    async deleteContentsLayout(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) return;

        console.log('[CommandHandler] DeleteContentsLayout called');

        try {
            const { layoutId } = data || {};

            if (!layoutId) {
                resultCallback({ code: -32060, message: 'Missing layoutId' });
                return;
            }

            const deleted = await this.layoutService.deleteLayout(layoutId);
            if (!deleted) {
                resultCallback({ code: -32063, message: 'Layout not found' });
                return;
            }

            resultCallback(null, { success: true });
        } catch (error: any) {
            console.error('[CommandHandler] DeleteContentsLayout error:', error);
            resultCallback({ code: -32099, message: error.message });
        }
    }
    async changeDisplayName(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        try {
            const { displayId, displayName } = data;

            if (!displayId || !displayName) {
                resultCallback({ code: -32090, message: 'Missing displayId, screenWidth, or screenHeight' });
                return;
            }
            await this.displaySessionService.changeDisplayName(displayId, displayName);
        } catch (error: any) {
            console.error('[CommandHandler] ChangeDisplayName error:', error);
            resultCallback({ code: -32100, message: error.message });
        }
    }
}
