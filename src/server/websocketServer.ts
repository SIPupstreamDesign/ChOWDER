import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { Server as HttpsServer } from 'https';
import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';
import { WSConnector, ExtendedWebSocket } from './websocket/wsConnector';
import { CommandHandler } from './websocket/commandHandler';
import { WSInterface } from './websocket/wsInterface';
import { SessionManager } from './auth/sessionManager';
import { AuthService } from './auth/authService';
import { ContentService } from './content/contentService';
import { WindowMetaDataService } from './display/windowMetaDataService';
import { DisplaySessionService } from './display/displaySessionService';
import { MediaService } from './media/mediaService';
import { SiteService } from './site/siteService';
import { LayoutService } from './layout/layoutService';
import { ContentIntegrityService } from './content/contentIntegrityService';
import { generateUUID8 } from './websocket/wsUtils';
import { OtpService } from './auth/otpService';
import { loadServerConfig } from './common/serverConfig';

export const createWebSocketServer = async (servers: (Server | HttpsServer)[], redis: Redis) => {
    const serverConfig = loadServerConfig();
    console.log(`[Server] tileImage config: widthThreshold=${serverConfig.tileImage.widthThreshold}, heightThreshold=${serverConfig.tileImage.heightThreshold}, tileSize=${serverConfig.tileImage.tileSize}`);

    const wsConnector = new WSConnector();

    // 認証サービスとセッション管理
    const authService = new AuthService(redis);
    const sessionManager = new SessionManager();

    // コンテンツサービス
    const contentService = new ContentService(redis);

    // ディスプレイサービス
    const windowMetaDataService = new WindowMetaDataService(redis);
    const displaySessionService = new DisplaySessionService(redis);

    // Site サービス（起動時にデフォルト Site を自動生成）
    const siteService = new SiteService(redis);
    await siteService.ensureDefaultSite();

    // サーバー起動時にオンラインDisplay状態をリセット（再起動後の残留状態を解消）
    await displaySessionService.resetAllOnlineStatus();

    // サーバー起動時に Redis の整合性チェック・修復を実行
    // gracePeriodMs=0: 起動時は並行書き込みがないため猶予なしで安全に削除できる
    const integrityService = new ContentIntegrityService(redis);

    // サーバー起動時に WebRTC stream 関連データを全削除
    // stream は再起動後に再利用できないため、stale データを残さない
    try {
        await integrityService.purgeAllLiveStreamsOnStartup();
    } catch (error) {
        console.warn('[Server] Failed to purge live-stream data on startup. Continue startup.');
        console.warn(error);
    }

    await integrityService.checkAndRepair({ gracePeriodMs: 0 });

    // 接続中のクライアント
    const clients = new Set<ExtendedWebSocket>();

    const getApprovedDisplaySocketIds = async (): Promise<Set<string>> => {
        const approvedDisplays = await displaySessionService.getApprovedDisplays();
        const approvedSocketIds = new Set<string>();
        for (const display of approvedDisplays) {
            if (display.isOnline && display.socketId !== '') {
                approvedSocketIds.add(display.socketId);
            }
        }
        return approvedSocketIds;
    };

    // 認証済みクライアントへのブロードキャスト関数（ログイン済みまたは承認済みDisplay）
    const broadcastToAll = async (message: any) => {
        const serialized = JSON.stringify(message);
        const approvedDisplaySocketIds = await getApprovedDisplaySocketIds();
        for (const client of clients) {
            if (client.readyState === 1) {
                // 認証・承認チェック
                const isLoggedIn = await sessionManager.isAuthenticated(client.id);
                const canReceive = isLoggedIn || approvedDisplaySocketIds.has(client.id);

                if (canReceive) {
                    client.sendQueued(serialized);
                }
            }
        }
    };

    // メディアサービス
    const mediaService = new MediaService(redis, contentService, broadcastToAll);
    await mediaService.initialize(1); // Worker数は1

    // レイアウトサービス
    const layoutService = new LayoutService(redis, contentService);

    // コマンドハンドラー
    const commandHandler = new CommandHandler(
        sessionManager,
        authService,
        contentService,
        windowMetaDataService,
        displaySessionService,
        mediaService,
        siteService,
        layoutService,
        serverConfig
    );
    const wsInterface = new WSInterface(wsConnector, commandHandler);

    // commandHandlerにWSConnectorとクライアントセットを設定
    commandHandler.setConnector(wsConnector, clients);

    // OtpServiceを設定（Redisが必要なためここで生成）
    const otpService = new OtpService(redis);
    commandHandler.setOtpService(otpService);

    // コマンドハンドラを登録
    wsInterface.registerWSEvent();

    // 接続ハンドラ（HTTP/HTTPSサーバー間で共有）
    const handleConnection = (ws: WebSocket) => {
        // WebSocketにIDを割り当て
        const extWs = ws as ExtendedWebSocket;
        extWs.id = generateUUID8();
        extWs.isAlive = true;

        console.log(`Client connected: ${extWs.id}`);
        clients.add(extWs);

        extWs.on('pong', () => {
            extWs.isAlive = true;
        });

        // コネクターにイベントを登録
        wsConnector.registerEvent(extWs);

        extWs.on('close', async () => {
            console.log(`Client disconnected: ${extWs.id}`);
            // 送信キューを解放
            extWs._sendQueue?.clear();
            clients.delete(extWs);
            // セッション削除
            await sessionManager.removeSession(extWs.id);
            // タイルイメージ未完了アップロードのクリーンアップ
            await commandHandler.cleanupTileimageOnDisconnect(extWs.id);
            // MediaService のクリーンアップ（削除されたmetadataIdを返す）
            const deletedMetadataIds = await mediaService.cleanupSocket(extWs.id);

            // 削除されたStreamMetadataをブロードキャスト
            if (deletedMetadataIds.length > 0) {
                const approvedDisplaySocketIds = await getApprovedDisplaySocketIds();
                for (const metadataId of deletedMetadataIds) {
                    const deleteMessage = {
                        jsonrpc: '2.0',
                        id: randomBytes(4).toString('hex'),
                        method: 'DeleteContent',
                        params: { metadataId },
                        to: 'client',
                    };
                    for (const client of clients) {
                        if (client.readyState === 1) {
                            // 認証・承認チェック
                            const isLoggedIn = await sessionManager.isAuthenticated(client.id);
                            const canReceive = isLoggedIn || approvedDisplaySocketIds.has(client.id);

                            if (canReceive) {
                                client.sendQueued(JSON.stringify(deleteMessage));
                            }
                        }
                    }
                }
                console.log(`[WebSocket] Broadcast DeleteContent for ${deletedMetadataIds.length} stream(s)`);
            }

            const controllerSessions = await sessionManager.getAllSessions();
            const controllerSocketIds = controllerSessions
                .filter(s => s.role !== 'display')
                .map(s => s.socketId);
            const approvedDisplaySocketIds = await getApprovedDisplaySocketIds();

            // ディスプレイセッションのオンライン状態を解除（承認情報は保持）
            const displayId = await displaySessionService.onSocketDisconnect(extWs.id);

            // Displayが切断した場合、コントローラに通知
            if (displayId) {

                clients.forEach((client) => {
                    if (controllerSocketIds.includes(client.id) && client.readyState === 1) {
                        const notifyMessage = {
                            jsonrpc: '2.0',
                            id: randomBytes(4).toString('hex'),
                            method: 'DisplayDisconnected',
                            params: { displayId },
                            to: 'client',
                        };
                        client.sendQueued(JSON.stringify(notifyMessage));
                    }
                });
            } else {
                // コントローラー切断を、コントローラ + 承認済みDisplay に通知
                clients.forEach((client) => {
                    const shouldNotifyController = controllerSocketIds.includes(client.id);
                    const shouldNotifyDisplay = approvedDisplaySocketIds.has(client.id);
                    if (client.readyState === 1 && (shouldNotifyController || shouldNotifyDisplay)) {
                        const notifyMessage = {
                            jsonrpc: '2.0',
                            id: randomBytes(4).toString('hex'),
                            method: 'ControllerDisconnected',
                            params:  extWs.id ,
                            to: 'client',
                        };
                        client.sendQueued(JSON.stringify(notifyMessage));
                    }
                });
            }
        });

        extWs.on('error', async (error) => {
            console.error(`WebSocket error for ${extWs.id}:`, error);
            // エラー発生時もセッション削除
            clients.delete(extWs);
            await sessionManager.removeSession(extWs.id);
            // MediaService のクリーンアップとメタデータ削除の通知
            const deletedMetadataIds = await mediaService.cleanupSocket(extWs.id);

            // 削除されたメタデータをすべてのクライアントに通知
            deletedMetadataIds.forEach((metadataId) => {
                clients.forEach((client) => {
                    if (client.readyState === 1) {
                        const deleteMessage = {
                            jsonrpc: '2.0',
                            id: randomBytes(4).toString('hex'),
                            method: 'DeleteWindowMetaData',
                            params: { id: metadataId },
                            to: 'client',
                        };
                        client.sendQueued(JSON.stringify(deleteMessage));
                    }
                });
            });
            const displayId = await displaySessionService.onSocketDisconnect(extWs.id);

            // Displayが切断した場合、コントローラに通知
            if (displayId) {
                const controllerSessions = await sessionManager.getAllSessions();
                const controllerSocketIds = controllerSessions
                    .filter(s => s.role !== 'display')
                    .map(s => s.socketId);

                clients.forEach((client) => {
                    if (controllerSocketIds.includes(client.id) && client.readyState === 1) {
                        const notifyMessage = {
                            jsonrpc: '2.0',
                            id: randomBytes(4).toString('hex'),
                            method: 'DisplayDisconnected',
                            params: { displayId },
                            to: 'client',
                        };
                        client.sendQueued(JSON.stringify(notifyMessage));
                    }
                });
            } else {
                const controllerSessions = await sessionManager.getAllSessions();
                const controllerSocketIds = controllerSessions
                    .filter((s) => {
                        return s.role !== 'display';
                    })
                    .map((s) => {
                        return s.socketId;
                    });
                const approvedDisplaySocketIds = await getApprovedDisplaySocketIds();

                clients.forEach((client) => {
                    const shouldNotifyController = controllerSocketIds.includes(client.id);
                    const shouldNotifyDisplay = approvedDisplaySocketIds.has(client.id);
                    if (client.readyState === 1 && (shouldNotifyController || shouldNotifyDisplay)) {
                        const notifyMessage = {
                            jsonrpc: '2.0',
                            id: randomBytes(4).toString('hex'),
                            method: 'ControllerDisconnected',
                            params: extWs.id,
                            to: 'client',
                        };
                        client.sendQueued(JSON.stringify(notifyMessage));
                    }
                });
            }
        });
    };

    // 各サーバー（HTTP/HTTPS）に WebSocketServer を登録
    const wssInstances = servers.map((server) => {
        const wss = new WebSocketServer({ server });
        wss.on('connection', handleConnection);
        return wss;
    });

    // Heartbeat: 30秒ごとにpingを送信してアイドル接続を維持（NATタイムアウト防止）
    const HEARTBEAT_INTERVAL_MS = 30_000;
    const heartbeatInterval = setInterval(() => {
        for (const client of clients) {
            if (client.isAlive === false) {
                console.log(`[Heartbeat] Terminating unresponsive client: ${client.id}`);
                client.terminate();
                continue;
            }
            client.isAlive = false;
            client.ping();
        }
    }, HEARTBEAT_INTERVAL_MS);

    wssInstances[0].on('close', () => {
        clearInterval(heartbeatInterval);
    });

    return { wss: wssInstances[0], mediaService };
};
