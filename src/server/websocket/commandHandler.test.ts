import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Redis } from 'ioredis';
import { CommandHandler } from './commandHandler';
import { Command } from './command';
import { WSConnector, type ExtendedWebSocket } from './wsConnector';
import { SessionManager } from '../auth/sessionManager';
import { AuthService, UserRole } from '../auth/authService';
import { ContentService } from '../content/contentService';
import { WindowMetaDataService } from '../display/windowMetaDataService';
import { DisplaySessionService } from '../display/displaySessionService';
import { MediaService } from '../media/mediaService';
import { SiteService } from '../site/siteService';
import { LayoutService } from '../layout/layoutService';
import { createTestRedis, cleanupTestRedis } from '../tests/setup';
import { OtpService } from '../auth/otpService';
import { ClientDiagnosticLogService } from '../diagnostics/clientDiagnosticLogService';

describe('CommandHandler', () => {
    let redis: Redis;
    let authService: AuthService;
    let sessionManager: SessionManager;
    let contentService: ContentService;
    let windowMetaDataService: WindowMetaDataService;
    let displaySessionService: DisplaySessionService;
    let mediaService: MediaService;
    let siteService: SiteService;
    let layoutService: LayoutService;
    let commandHandler: CommandHandler;
    let clients: Set<ExtendedWebSocket>;

    const createMockClient = (
        socketId: string,
        options?: { throwOnSendQueued?: boolean },
    ): ExtendedWebSocket & { sentMessages: string[] } => {
        const state = { closeCalled: false, sentMessages: [] as string[] };
        const client: any = {
            id: socketId,
            readyState: 1,
            isAlive: true,
            close(): void {
                state.closeCalled = true;
            },
            sendQueued(data: string): void {
                if (options?.throwOnSendQueued === true) {
                    throw new Error('send failed');
                }
                state.sentMessages.push(data);
            },
            get closeCalled(): boolean {
                return state.closeCalled;
            },
            get sentMessages(): string[] {
                return state.sentMessages;
            },
        };
        return client as ExtendedWebSocket & { sentMessages: string[] };
    };

    beforeEach(async () => {
        redis = createTestRedis();
        authService = new AuthService(redis);
        sessionManager = new SessionManager();
        contentService = new ContentService(redis);
        windowMetaDataService = new WindowMetaDataService(redis);
        displaySessionService = new DisplaySessionService(redis);
        // テスト用の broadcastToAll モック関数
        const mockBroadcast = async (message: any) => {
            // テストではブロードキャストしない
        };
        mediaService = new MediaService(redis, contentService, mockBroadcast);
        siteService = new SiteService(redis);
        layoutService = new LayoutService(redis, contentService);
        // テスト用にはmediasoupの初期化をスキップ
        commandHandler = new CommandHandler(
            sessionManager,
            authService,
            contentService,
            windowMetaDataService,
            displaySessionService,
            mediaService,
            siteService,
            layoutService,
            {
                tileImage: { widthThreshold: 3840, heightThreshold: 2160, tileSize: 256 },
            }
        );
        commandHandler.setOtpService(new OtpService(redis));
        clients = new Set<ExtendedWebSocket>();
        commandHandler.setConnector(new WSConnector(), clients);

        // テスト用ユーザーを作成
        await authService.createUser('testuser', 'password123', UserRole.MEMBER);
        await authService.createUser('admin', 'admin123', UserRole.ADMIN);
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    describe('login', () => {
        it('正しい認証情報でログインできること', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.login('socket123', { id: 'testuser', password: 'password123' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            assert.strictEqual((result as any).res.success, true);
            assert.strictEqual((result as any).res.userId, 'testuser');
            assert.strictEqual((result as any).res.role, UserRole.MEMBER);

            // セッションが作成されていることを確認
            const session = await sessionManager.getSession('socket123');
            assert.ok(session);
            assert.strictEqual(session.userId, 'testuser');
        });

        it('間違ったパスワードでログイン失敗すること', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.login('socket123', { id: 'testuser', password: 'wrongpass' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32004);
            assert.ok((result as any).err.message.includes('Invalid credentials'));
        });

        it('idまたはpasswordが欠けている場合はエラーを返すこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.login('socket123', { id: 'testuser' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32003);
        });
    });

    describe('logout', () => {
        it('ログアウトできること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.logout('socket123', {}, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            assert.strictEqual((result as any).res.success, true);

            // セッションが削除されていることを確認
            const session = await sessionManager.getSession('socket123');
            assert.strictEqual(session, null);
        });
    });

    describe('inspectContentData', () => {
        it('未ログインでは inspectContentData を実行できないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.inspectContentData('socket123', {
                    metaData: { mime: '' },
                    contentData: Buffer.from([0x00]),
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
        });

        it('PNGシグネチャから image と寸法を返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const png = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sotW5QAAAAASUVORK5CYII=',
                'base64'
            );

            const result = await new Promise((resolve) => {
                commandHandler.inspectContentData('socket123', {
                    metaData: { mime: '' },
                    contentData: png,
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            assert.strictEqual((result as any).res.kind, 'image');
            assert.strictEqual((result as any).res.mime, 'image/png');
            assert.strictEqual((result as any).res.width, 1);
            assert.strictEqual((result as any).res.height, 1);
            assert.strictEqual((result as any).res.isSupported, true);
        });
    });

    describe('uploadTileimage', () => {
        interface TestTileUpload {
            metadataId: string;
            uploadId: string;
            byteLength: number;
            segmentMax: number;
            fileExt: string;
        }

        const addTileUpload = async (
            socketId: string,
            uploadId: string,
            byteLength: number,
            segmentMax: number,
        ): Promise<TestTileUpload> => {
            const fileExt = 'jpg';
            const result = await new Promise<any>((resolve) => {
                commandHandler.addContent(socketId, {
                    metaData: {
                        type: 'tileimage',
                        metadataId: 'client-chosen-tile-id',
                        posx: 0,
                        posy: 0,
                        width: 100,
                        height: 100,
                        tileImageUpload: {
                            uploadId,
                            byteLength,
                            segment_max: segmentMax,
                            file_ext: fileExt,
                        },
                    },
                    contentData: Buffer.alloc(0),
                }, (error, response) => { resolve({ error, response }); });
            });
            if (result.error) {
                throw new Error(String(result.error.message ?? result.error));
            }
            return {
                metadataId: result.response.metadataId,
                uploadId,
                byteLength,
                segmentMax,
                fileExt,
            };
        };

        const sendTileSegment = async (
            socketId: string,
            upload: TestTileUpload,
            segmentIndex: number,
            content: Buffer,
        ): Promise<{ error: any; response: any }> => {
            let result: { error: any; response: any } = { error: null, response: undefined };
            await commandHandler.uploadTileimage(socketId, {
                metaData: {
                    metadataId: upload.metadataId,
                    uploadId: upload.uploadId,
                    byteLength: upload.byteLength,
                    segment_max: upload.segmentMax,
                    segment_index: segmentIndex,
                    file_ext: upload.fileExt,
                },
                contentData: content,
            }, (error, response) => { result = { error, response }; });
            return result;
        };

        it('タイル生成失敗時に送信元へ TileimageUploadFailed を通知すること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const sender = createMockClient('socket123');
            const watcher = createMockClient('socket456');
            await sessionManager.createSession('socket456', 'watcher', UserRole.MEMBER);
            clients.add(sender);
            clients.add(watcher);

            (commandHandler as any).tileImageService.generateTiles = async (
                _imageBuffer: Buffer,
                onProgress?: (completed: number, total: number) => void,
                onHeartbeat?: () => void,
            ): Promise<any> => {
                onProgress?.(1, 1);
                onHeartbeat?.();
                throw new Error('sharp failed');
            };

            const upload = await addTileUpload('socket123', 'upload-fail-1', 4, 1);
            const callbackResult = await sendTileSegment('socket123', upload, 0, Buffer.from([1, 2, 3, 4]));

            assert.strictEqual(callbackResult.error, null);
            assert.strictEqual(callbackResult.response.ok, true);

            const failedMessage = (sender as any).sentMessages
                .map((raw: string) => {
                    return JSON.parse(raw);
                })
                .find((msg: any) => {
                    return msg.method === Command.TileimageUploadFailed;
                });
            const heartbeatMessage = (sender as any).sentMessages
                .map((raw: string) => { return JSON.parse(raw); })
                .find((msg: any) => { return msg.method === Command.TileimageHeartbeat; });

            const deleteMessageForSender = (sender as any).sentMessages
                .map((raw: string) => {
                    return JSON.parse(raw);
                })
                .find((msg: any) => {
                    return msg.method === Command.DeleteContent;
                });

            const deleteMessageForWatcher = (watcher as any).sentMessages
                .map((raw: string) => {
                    return JSON.parse(raw);
                })
                .find((msg: any) => {
                    return msg.method === Command.DeleteContent;
                });

            assert.ok(failedMessage);
            assert.strictEqual(failedMessage.params.metadataId, upload.metadataId);
            assert.ok(typeof failedMessage.params.reason === 'string');
            assert.ok(failedMessage.params.reason.length > 0);
            assert.ok(heartbeatMessage);
            assert.strictEqual(heartbeatMessage.params.metadataId, upload.metadataId);
            assert.ok(deleteMessageForSender);
            assert.strictEqual(deleteMessageForSender.params.metadataId, upload.metadataId);
            assert.ok(deleteMessageForWatcher);
            assert.strictEqual(deleteMessageForWatcher.params.metadataId, upload.metadataId);
        });

        it('別socketから他ユーザーのmetadataIdでuploadできず、contentを保持する', { timeout: 5000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket-owner', 'testuser', UserRole.MEMBER);
            await sessionManager.createSession('socket-intruder', 'admin', UserRole.ADMIN);
            const ownerClient = createMockClient('socket-owner');
            clients.add(ownerClient);
            const ownerUpload = await addTileUpload('socket-owner', 'upload-owned', 4, 1);

            let workerStarted = false;
            (commandHandler as any).tileImageService.generateTiles = async (): Promise<any> => {
                workerStarted = true;
                throw new Error('should not run');
            };
            let attackResult: any = null;
            await commandHandler.uploadTileimage('socket-intruder', {
                metaData: {
                    metadataId: ownerUpload.metadataId,
                    uploadId: ownerUpload.uploadId,
                    byteLength: ownerUpload.byteLength,
                    segment_max: ownerUpload.segmentMax,
                    segment_index: 0,
                    file_ext: ownerUpload.fileExt,
                },
                contentData: Buffer.from([1, 2, 3, 4]),
            }, (error, response) => { attackResult = { error, response }; });

            assert.strictEqual(attackResult.error.code, -32072);
            assert.strictEqual(workerStarted, false);
            assert.strictEqual((await contentService.getMetadata(ownerUpload.metadataId))?.creatorId, 'testuser');
            assert.strictEqual(ownerClient.sentMessages.some((raw: string): boolean => {
                return JSON.parse(raw).method === Command.DeleteContent;
            }), false);
            await commandHandler.cleanupTileimageOnDisconnect('socket-owner');
        });

        it('生成枠は同時に1件で、Worker失敗後に次のアップロードを受け付けること', { timeout: 10000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket-first', 'testuser', UserRole.MEMBER);
            await sessionManager.createSession('socket-second', 'testuser', UserRole.MEMBER);
            await sessionManager.createSession('socket-third', 'testuser', UserRole.MEMBER);

            let generationCount = 0;
            let signalGenerationStarted: (() => void) | undefined;
            let releaseFirstGeneration: (() => void) | undefined;
            const generationStarted = new Promise<void>((resolve): void => {
                signalGenerationStarted = resolve;
            });
            const firstGenerationReleased = new Promise<void>((resolve): void => {
                releaseFirstGeneration = resolve;
            });
            (commandHandler as any).tileImageService.generateTiles = async (): Promise<any> => {
                generationCount += 1;
                if (generationCount === 1) {
                    signalGenerationStarted?.();
                    await firstGenerationReleased;
                }
                throw new Error('test generation failure');
            };

            const firstTileUpload = await addTileUpload('socket-first', 'upload-first', 4, 1);
            const firstUpload = sendTileSegment(
                'socket-first',
                firstTileUpload,
                0,
                Buffer.from([1, 2, 3, 4]),
            );
            await generationStarted;

            const busyResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket-second', {
                    metaData: {
                        type: 'tileimage',
                        posx: 0,
                        posy: 0,
                        width: 100,
                        height: 100,
                        tileImageUpload: {
                            uploadId: 'upload-second',
                            byteLength: 4,
                            segment_max: 1,
                            file_ext: 'jpg',
                        },
                    },
                    contentData: Buffer.alloc(0),
                }, (error, response) => { resolve({ error, response }); });
            });

            assert.strictEqual(busyResult.error.code, -32072);
            assert.strictEqual(await contentService.getMetadata('upload-second'), null);
            assert.strictEqual(generationCount, 1);
            releaseFirstGeneration?.();
            const firstResult = await firstUpload;
            assert.strictEqual(firstResult.error, null);
            assert.strictEqual(firstResult.response.ok, true);

            const thirdTileUpload = await addTileUpload('socket-third', 'upload-third', 4, 1);
            await sendTileSegment('socket-third', thirdTileUpload, 0, Buffer.from([1, 2, 3, 4]));
            assert.strictEqual(generationCount, 2);
        });

        it('セグメント受信中に切断されたら生成枠を解放すること', { timeout: 10000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket-disconnected', 'testuser', UserRole.MEMBER);
            await sessionManager.createSession('socket-next', 'testuser', UserRole.MEMBER);

            let generationCount = 0;
            (commandHandler as any).tileImageService.generateTiles = async (): Promise<any> => {
                generationCount += 1;
                throw new Error('test generation failure');
            };

            const disconnectedUpload = await addTileUpload('socket-disconnected', 'upload-disconnected', 8, 2);
            await sendTileSegment('socket-disconnected', disconnectedUpload, 0, Buffer.from([1, 2, 3, 4]));

            await commandHandler.cleanupTileimageOnDisconnect('socket-disconnected');

            const nextUpload = await addTileUpload('socket-next', 'upload-next', 4, 1);
            const nextCallbackResult = await sendTileSegment(
                'socket-next',
                nextUpload,
                0,
                Buffer.from([5, 6, 7, 8]),
            );

            assert.strictEqual(nextCallbackResult.error, null);
            assert.strictEqual(nextCallbackResult.response.ok, true);
            assert.strictEqual(generationCount, 1);
        });

        it('AddContent保存がidle timeoutするとslotを解放し、遅延metadataをcleanupする', { timeout: 5000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket-tile-add-timeout', 'testuser', UserRole.MEMBER);
            (commandHandler as any).tileImageUploadIdleTimeoutMs = 15;

            let signalAddContentStored: (() => void) | undefined;
            let releaseAddContent: (() => void) | undefined;
            const addContentStored = new Promise<void>((resolve): void => {
                signalAddContentStored = resolve;
            });
            const addContentRelease = new Promise<void>((resolve): void => {
                releaseAddContent = resolve;
            });
            const originalAddContent = contentService.addContent.bind(contentService);
            contentService.addContent = async (request) => {
                const metadata = await originalAddContent(request);
                signalAddContentStored?.();
                await addContentRelease;
                return metadata;
            };

            let callbackCount = 0;
            const rpcResponse = new Promise<any>((resolve) => {
                const addPromise = commandHandler.addContent('socket-tile-add-timeout', {
                    metaData: {
                        type: 'tileimage',
                        posx: 0,
                        posy: 0,
                        width: 100,
                        height: 100,
                        tileImageUpload: {
                            uploadId: 'upload-tile-add-timeout',
                            byteLength: 4,
                            segment_max: 1,
                            file_ext: 'jpg',
                        },
                    },
                    contentData: Buffer.alloc(0),
                }, (error, response) => {
                    callbackCount += 1;
                    resolve({ error, response });
                });
                void addPromise;
            });

            await addContentStored;
            const response = await rpcResponse;
            assert.strictEqual(response.error.code, -32072);
            releaseAddContent?.();
            await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });

            assert.strictEqual(callbackCount, 1);
            assert.strictEqual((await contentService.getAllMetadata()).length, 0);
        });

        it('Worker開始後に送信元が切断しても処理を継続し完成metadataを保存すること', { timeout: 10000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket-processing-owner', 'testuser', UserRole.MEMBER);
            const sender = createMockClient('socket-processing-owner');
            const watcher = createMockClient('socket-processing-watcher');
            await sessionManager.createSession('socket-processing-watcher', 'watcher', UserRole.MEMBER);
            clients.add(sender);
            clients.add(watcher);

            let signalWorkerStarted: (() => void) | undefined;
            let releaseWorker: (() => void) | undefined;
            const workerStarted = new Promise<void>((resolve): void => { signalWorkerStarted = resolve; });
            const workerRelease = new Promise<void>((resolve): void => { releaseWorker = resolve; });
            (commandHandler as any).tileImageService.generateTiles = async (
                _imageBuffer: Buffer,
                _onProgress?: (completed: number, total: number) => void,
                onHeartbeat?: () => void,
            ): Promise<any> => {
                signalWorkerStarted?.();
                onHeartbeat?.();
                await workerRelease;
                return {
                    xsplit: 1,
                    ysplit: 1,
                    tileSize: 256,
                    imgWidth: 100,
                    imgHeight: 100,
                    reductionWidth: 100,
                    reductionHeight: 100,
                    tiles: [Buffer.from([1, 2, 3])],
                    reduction: Buffer.from([4, 5, 6]),
                };
            };

            const upload = await addTileUpload('socket-processing-owner', 'upload-processing-owner', 4, 1);
            const uploadPromise = sendTileSegment(
                'socket-processing-owner',
                upload,
                0,
                Buffer.from([1, 2, 3, 4]),
            );
            await workerStarted;
            clients.delete(sender);
            await commandHandler.cleanupTileimageOnDisconnect('socket-processing-owner');
            assert.strictEqual(((await contentService.getMetadata(upload.metadataId)) as any)?.tileFinished, undefined);
            releaseWorker?.();
            const result = await uploadPromise;

            assert.strictEqual(result.error, null);
            assert.strictEqual(result.response.ok, true);
            assert.strictEqual(((await contentService.getMetadata(upload.metadataId)) as any)?.tileFinished, true);
            const watcherMethods = watcher.sentMessages.map((raw: string) => { return JSON.parse(raw).method; });
            assert.strictEqual(watcherMethods.includes(Command.UpdateContent), true);
            assert.strictEqual(watcherMethods.includes(Command.DeleteContent), false);
        });
    });

    describe('createUser', () => {
        describe('as Admin', () => {
            beforeEach(async () => {
                await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            });

            it('adminユーザーを作成できること', async () => {
                const result = await new Promise((resolve) => {
                    commandHandler.createUser('admin_socket', { id: 'new_admin', password: 'new_password', role: UserRole.ADMIN }, (err, res) => {
                        resolve({ err, res });
                    });
                });

                assert.strictEqual((result as any).err, null);
                assert.strictEqual((result as any).res.success, true);
                const newUser = await authService.getUser('new_admin');
                assert.strictEqual(newUser?.role, UserRole.ADMIN);
            });

            it('memberユーザーを作成できること', async () => {
                const result = await new Promise((resolve) => {
                    commandHandler.createUser('admin_socket', { id: 'new_user', password: 'new_password', role: UserRole.MEMBER }, (err, res) => {
                        resolve({ err, res });
                    });
                });

                assert.strictEqual((result as any).err, null);
                assert.strictEqual((result as any).res.success, true);
                const newUser = await authService.getUser('new_user');
                assert.strictEqual(newUser?.role, UserRole.MEMBER);
            });
        });

        it('Memberはユーザーを作成できないこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.createUser('socket123', { id: 'newuser', password: 'pass123', role: 'member' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32002);
            assert.ok((result as any).err.message.includes('Permission denied'));
        });

        it('未ログインではユーザーを作成できないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.createUser('socket123', { id: 'newuser', password: 'pass123', role: 'member' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
            assert.ok((result as any).err.message.includes('Authentication required'));
        });
    });

    describe('認証が必要なコマンド', () => {
        it('ログイン済みユーザーはコマンドを実行できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.getLoginUserList({}, (err, res) => {
                    resolve({ err, res });
                }, 'socket123');
            });

            assert.strictEqual((result as any).err, null);
            assert.ok((result as any).res);
        });

        it('未ログインユーザーは認証エラーを受け取ること', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.getLoginUserList({}, (err, res) => {
                    resolve({ err, res });
                }, 'socket123');
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
            assert.ok((result as any).err.message.includes('Authentication required'));
        });
    });

    describe('getLoginUserList', () => {
        it('ログイン中のユーザーリストを取得できること', async () => {
            await sessionManager.createSession('socket1', 'user1', UserRole.MEMBER);
            await sessionManager.createSession('socket2', 'user2', UserRole.MEMBER);
            await sessionManager.createSession('socket3', 'admin', UserRole.ADMIN);

            const result = await new Promise((resolve) => {
                commandHandler.getLoginUserList({}, (err, res) => {
                    resolve({ err, res });
                }, 'socket1');
            });

            assert.strictEqual((result as any).err, null);
            assert.ok((result as any).res.users);
            assert.strictEqual((result as any).res.users.length, 3);
        });
    });

    describe('getUserList', () => {
        beforeEach(async () => {
            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
        });

        it('Adminは全ユーザー一覧を取得できること', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.getUserList('admin_socket', {}, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.strictEqual((result as any).err, null);
            assert.ok(Array.isArray((result as any).res.users));
            assert.ok((result as any).res.users.length >= 2);
        });

        it('Memberはユーザー一覧を取得できないこと', async () => {
            await sessionManager.createSession('member_socket', 'testuser', UserRole.MEMBER);
            const result = await new Promise((resolve) => {
                commandHandler.getUserList('member_socket', {}, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32002);
        });
    });

    describe('deleteUser', () => {
        beforeEach(async () => {
            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            clients.add(createMockClient('admin_socket'));
        });

        it('Adminは別のユーザーを削除できること', async () => {
            await sessionManager.createSession('testuser_socket', 'testuser', UserRole.MEMBER);
            clients.add(createMockClient('testuser_socket'));

            const result = await new Promise((resolve) => {
                commandHandler.deleteUser('admin_socket', { id: 'testuser' }, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.strictEqual((result as any).err, null);
            assert.strictEqual((result as any).res.success, true);
            const deleted = await authService.getUser('testuser');
            assert.strictEqual(deleted, null);

            const deletedSession = await sessionManager.getSession('testuser_socket');
            assert.strictEqual(deletedSession, null);

            await new Promise((resolve) => {
                setTimeout(resolve, 220);
            });

            const targetClient = Array.from(clients).find((c) => c.id === 'testuser_socket') as any;
            assert.strictEqual(targetClient.sentMessages.length, 1);
            const notified = JSON.parse(targetClient.sentMessages[0]);
            assert.strictEqual(notified.method, 'SessionRevoked');
            assert.strictEqual(notified.params.reason, 'user-deleted');
            assert.strictEqual(targetClient.closeCalled, true);
        });

        it('削除対象ユーザーの全セッションを失効すること', async () => {
            await sessionManager.createSession('testuser_socket1', 'testuser', UserRole.MEMBER);
            await sessionManager.createSession('testuser_socket2', 'testuser', UserRole.MEMBER);

            clients.add(createMockClient('testuser_socket1'));
            clients.add(createMockClient('testuser_socket2'));

            const result = await new Promise((resolve) => {
                commandHandler.deleteUser('admin_socket', { id: 'testuser' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            const remainingSockets = await sessionManager.getSocketIdsByUserId('testuser');
            assert.strictEqual(remainingSockets.length, 0);

            await new Promise((resolve) => {
                setTimeout(resolve, 220);
            });

            const targetClient1 = Array.from(clients).find((c) => c.id === 'testuser_socket1') as any;
            const targetClient2 = Array.from(clients).find((c) => c.id === 'testuser_socket2') as any;
            assert.strictEqual(targetClient1.sentMessages.length, 1);
            assert.strictEqual(targetClient2.sentMessages.length, 1);
            assert.strictEqual(targetClient1.closeCalled, true);
            assert.strictEqual(targetClient2.closeCalled, true);
        });

        it('通知送信に失敗した場合は即時に切断すること', async () => {
            await sessionManager.createSession('testuser_socket', 'testuser', UserRole.MEMBER);
            clients.add(createMockClient('testuser_socket', { throwOnSendQueued: true }));

            const result = await new Promise((resolve) => {
                commandHandler.deleteUser('admin_socket', { id: 'testuser' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            const targetClient = Array.from(clients).find((c) => c.id === 'testuser_socket') as any;
            assert.strictEqual(targetClient.closeCalled, true);
            assert.strictEqual(targetClient.sentMessages.length, 0);
        });

        it('自分自身は削除できないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.deleteUser('admin_socket', { id: 'admin' }, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32002);
            assert.ok((result as any).err.message.includes('yourself'));
        });

        it('最後のAdminは削除できないこと', async () => {
            // admin2 を作成しセッションを作る
            await authService.createUser('admin2', 'pass', UserRole.ADMIN);
            await sessionManager.createSession('admin2_socket', 'admin2', UserRole.ADMIN);
            clients.add(createMockClient('admin2_socket'));

            // admin2_socket で admin を削除 → admin2 が唯一の Admin になる
            await new Promise<void>((resolve) => {
                commandHandler.deleteUser('admin2_socket', { id: 'admin' }, () => resolve());
            });

            // セッションのみ存在する仮想Adminで admin2（唯一のAdmin）削除を試みる → 拒否される
            await sessionManager.createSession('ghost_admin_socket', 'ghost_admin', UserRole.ADMIN);
            const result = await new Promise((resolve) => {
                commandHandler.deleteUser('ghost_admin_socket', { id: 'admin2' }, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32002);
            assert.ok((result as any).err.message.includes('last admin'));
        });

        it('存在しないユーザーの削除はエラーになること', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.deleteUser('admin_socket', { id: 'nonexistent' }, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32008);
        });
    });

    describe('changePassword', () => {
        beforeEach(async () => {
            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
        });

        it('Adminは別ユーザーのパスワードを変更できること', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.changePassword('admin_socket', { id: 'testuser', password: 'newpass' }, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.strictEqual((result as any).err, null);
            assert.strictEqual((result as any).res.success, true);
            const auth = await authService.authenticate('testuser', 'newpass');
            assert.strictEqual(auth.success, true);
        });

        it('Memberはパスワードを変更できないこと', async () => {
            await sessionManager.createSession('member_socket', 'testuser', UserRole.MEMBER);
            const result = await new Promise((resolve) => {
                commandHandler.changePassword('member_socket', { id: 'testuser', password: 'newpass' }, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32002);
        });

        it('存在しないユーザーのパスワード変更はエラーになること', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.changePassword('admin_socket', { id: 'nonexistent', password: 'newpass' }, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32008);
        });
    });

    describe('getActiveProducers', () => {
        it('未ログインユーザーは GetActiveProducers を呼べないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.getActiveProducers('no_session_socket', {}, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
        });

        it('ログイン済みユーザーは GetActiveProducers を呼べること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.getActiveProducers('socket123', {}, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            assert.ok((result as any).res);
            assert.ok(Array.isArray((result as any).res.producers));
            assert.strictEqual((result as any).res.producers.length, 0);
        });
    });

    describe('closeConsumer', () => {
        it('未ログインユーザーはConsumerを閉じられない', { timeout: 5000 }, async (): Promise<void> => {
            const result = await new Promise<{ err: any; res: any }>((resolve) => {
                commandHandler.closeConsumer(
                    'no_session_socket',
                    { consumerId: 'consumer-1', transportId: 'transport-1' },
                    (err, res) => resolve({ err, res }),
                );
            });

            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32001);
        });

        it('認証済みユーザーはConsumer closeを要求できる', { timeout: 5000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<{ err: any; res: any }>((resolve) => {
                commandHandler.closeConsumer(
                    'socket123',
                    { consumerId: 'consumer-missing', transportId: 'transport-missing' },
                    (err, res) => resolve({ err, res }),
                );
            });

            assert.strictEqual(result.err, null);
            assert.deepStrictEqual(result.res, { success: true });
        });

        it('transportIdが欠けている場合は入力エラーを返す', { timeout: 5000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<{ err: any; res: any }>((resolve) => {
                commandHandler.closeConsumer(
                    'socket123',
                    { consumerId: 'consumer-1' },
                    (err, res) => resolve({ err, res }),
                );
            });

            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32112);
        });
    });

    describe('produce (WebRTC)', () => {
        it('NewProducerAvailable通知にlive-stream metadataIdを含める', { timeout: 5000 }, async (): Promise<void> => {
            const senderSocketId = 'producer-socket';
            const displaySocketId = 'display-socket';
            await sessionManager.createSession(senderSocketId, 'testuser', UserRole.MEMBER);
            await sessionManager.createSession(displaySocketId, 'testuser', UserRole.MEMBER);
            const displayClient = createMockClient(displaySocketId);
            clients.add(displayClient);
            (mediaService as any).produce = async () => ({
                producerId: 'producer-live-1',
                streamId: 'stream-live-1',
                metadataId: 'metadata-live-1',
            });

            let resolveResult: (result: { err: any; res: any }) => void = () => { };
            const resultPromise = new Promise<{ err: any; res: any }>((resolve) => {
                resolveResult = resolve;
            });
            const producePromise = commandHandler.produce(senderSocketId, {
                transportId: 'send-transport-1',
                kind: 'video',
                rtpParameters: {},
            }, (err, res) => resolveResult({ err, res }));
            await producePromise;
            const result = await resultPromise;

            assert.strictEqual(result.err, null);
            const notification = JSON.parse(displayClient.sentMessages[0]);
            assert.strictEqual(notification.method, 'NewProducerAvailable');
            assert.strictEqual(notification.params.metadataId, 'metadata-live-1');

            (mediaService as any).getActiveProducers = async () => ({
                producers: [{
                    producerId: 'producer-live-2',
                    userId: 'testuser',
                    socketId: senderSocketId,
                    kind: 'video',
                    streamId: 'stream-live-1',
                    streamName: 'Screen Share',
                    metadataId: 'metadata-live-1',
                }],
            });
            await (commandHandler as any).notifyExistingStreams(displaySocketId);

            const existingNotification = JSON.parse(displayClient.sentMessages[1]);
            assert.strictEqual(existingNotification.method, 'NewProducerAvailable');
            assert.strictEqual(existingNotification.params.metadataId, 'metadata-live-1');
        });

        it('未ログインユーザーは Produce を呼べないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.produce('no_session_socket', {
                    transportId: 'transport1',
                    kind: 'video',
                    rtpParameters: {},
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
        });

        it('transportId が欠けている場合はバリデーションエラーになること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.produce('socket123', {
                    kind: 'video',
                    rtpParameters: {},
                    // transportId が無い
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32105);
        });

        it('kind が不正な値の場合はバリデーションエラーになること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.produce('socket123', {
                    transportId: 'transport1',
                    kind: 'invalid_kind',
                    rtpParameters: {},
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32105);
        });

        it('rtpParameters が欠けている場合はバリデーションエラーになること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.produce('socket123', {
                    transportId: 'transport1',
                    kind: 'video',
                    // rtpParameters が無い
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32105);
        });
    });

    describe('consume (WebRTC)', () => {
        it('未ログインユーザーは Consume を呼べないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.consume('no_session_socket', {
                    transportId: 'transport1',
                    producerId: 'producer1',
                    rtpCapabilities: {},
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
        });

        it('transportId が欠けている場合はバリデーションエラーになること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.consume('socket123', {
                    producerId: 'producer1',
                    rtpCapabilities: {},
                    // transportId が無い
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32107);
        });

        it('producerId が欠けている場合はバリデーションエラーになること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.consume('socket123', {
                    transportId: 'transport1',
                    rtpCapabilities: {},
                    // producerId が無い
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32107);
        });

        it('rtpCapabilities が欠けている場合はバリデーションエラーになること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.consume('socket123', {
                    transportId: 'transport1',
                    producerId: 'producer1',
                    // rtpCapabilities が無い
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32107);
        });
    });

    describe('closeProducer', () => {
        it('未ログインユーザーは CloseProducer を呼べないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.closeProducer('no_session_socket', {
                    producerId: 'producer1',
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
        });

        it('producerId が欠けている場合はバリデーションエラーになること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.closeProducer('socket123', {
                    // producerId が無い
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32107);
        });
    });

    // ========================================
    // ContentsLayout
    // ========================================

    describe('saveContentsLayout', () => {
        it('未ログインユーザーはレイアウトを保存できないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.saveContentsLayout('no_session_socket', { name: 'layout1' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
        });

        it('name が欠けている場合はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.saveContentsLayout('socket123', {}, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32060);
        });

        it('レイアウトを保存できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.saveContentsLayout('socket123', { name: 'my layout' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            assert.ok((result as any).res.layoutId);
            assert.strictEqual((result as any).res.name, 'my layout');
        });
    });

    describe('getContentsLayoutList', () => {
        it('未ログインユーザーはレイアウト一覧を取得できないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.getContentsLayoutList('no_session_socket', {}, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
        });

        it('レイアウト一覧を取得できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            // レイアウトを事前保存
            await layoutService.saveLayout({ name: 'layout A' });
            await layoutService.saveLayout({ name: 'layout B' });

            const result = await new Promise((resolve) => {
                commandHandler.getContentsLayoutList('socket123', {}, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            assert.strictEqual((result as any).res.layouts.length, 2);
        });
    });

    describe('getContentsLayout', () => {
        it('未ログインユーザーはレイアウトを取得できないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.getContentsLayout('no_session_socket', { layoutId: 'xxx' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
        });

        it('存在するレイアウトを取得できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const saved = await layoutService.saveLayout({ name: 'snap' });

            const result = await new Promise((resolve) => {
                commandHandler.getContentsLayout('socket123', { layoutId: saved.layoutId }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            assert.strictEqual((result as any).res.layoutId, saved.layoutId);
        });

        it('存在しない layoutId はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.getContentsLayout('socket123', { layoutId: 'no-such-id' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32061);
        });
    });

    describe('restoreContentsLayout', () => {
        it('未ログインユーザーはレイアウトを復元できないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.restoreContentsLayout('no_session_socket', { layoutId: 'xxx' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
        });

        it('存在しない layoutId はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.restoreContentsLayout('socket123', { layoutId: 'no-such-id' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32062);
        });

        it('レイアウトを復元し updatedIds と skippedIds を返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const saved = await layoutService.saveLayout({ name: 'snap' });

            const result = await new Promise((resolve) => {
                commandHandler.restoreContentsLayout('socket123', { layoutId: saved.layoutId }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            assert.ok(Array.isArray((result as any).res.updatedIds));
            assert.ok(Array.isArray((result as any).res.skippedIds));
        });
    });

    describe('deleteContentsLayout', () => {
        it('未ログインユーザーはレイアウトを削除できないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.deleteContentsLayout('no_session_socket', { layoutId: 'xxx' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
        });

        it('存在するレイアウトを削除できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const saved = await layoutService.saveLayout({ name: 'to delete' });

            const result = await new Promise((resolve) => {
                commandHandler.deleteContentsLayout('socket123', { layoutId: saved.layoutId }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            assert.strictEqual((result as any).res.success, true);

            // 削除されていることを確認
            assert.strictEqual(await layoutService.getLayout(saved.layoutId), null);
        });

        it('存在しない layoutId はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const result = await new Promise((resolve) => {
                commandHandler.deleteContentsLayout('socket123', { layoutId: 'no-such-id' }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32063);
        });
    });

    describe('updateWindowMetaData (contentVisible)', () => {
        beforeEach(async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
        });

        it('片側virtual寸法をanchorに最新pixel比から両寸法を確定する', { timeout: 5000 }, async (): Promise<void> => {
            await windowMetaDataService.addWindowMetaData({
                id: 'window_aspect_anchor',
                posx: 0,
                posy: 0,
                virtualWidth: 800,
                virtualHeight: 600,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });

            const update = (data: Record<string, unknown>): Promise<{ err: any; res: any }> => {
                return new Promise((resolve) => {
                    commandHandler.updateWindowMetaData('socket123', data, (err, res) => {
                        resolve({ err, res });
                    });
                });
            };

            const widthResult = await update({ id: 'window_aspect_anchor', virtualWidth: 640 });
            assert.strictEqual(widthResult.err, null);
            assert.strictEqual(widthResult.res.virtualWidth, 640);
            assert.strictEqual(widthResult.res.virtualHeight, 360);
            assert.strictEqual(widthResult.res.pixelWidth, 1920);
            assert.strictEqual(widthResult.res.pixelHeight, 1080);

            const heightResult = await update({ id: 'window_aspect_anchor', virtualHeight: 540 });
            assert.strictEqual(heightResult.err, null);
            assert.strictEqual(heightResult.res.virtualWidth, 960);
            assert.strictEqual(heightResult.res.virtualHeight, 540);

            const positionResult = await update({ id: 'window_aspect_anchor', posx: 120 });
            assert.strictEqual(positionResult.err, null);
            assert.strictEqual(positionResult.res.posx, 120);
            assert.strictEqual(positionResult.res.virtualWidth, 960);
            assert.strictEqual(positionResult.res.virtualHeight, 540);
        });

        it('Controllerからpixel寸法が届いた場合は拒否し保存値を変更しない', { timeout: 5000 }, async (): Promise<void> => {
            await windowMetaDataService.addWindowMetaData({
                id: 'window_pixel_authority',
                posx: 0,
                posy: 0,
                virtualWidth: 800,
                virtualHeight: 450,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });

            const result = await new Promise<{ err: any; res: any }>((resolve) => {
                commandHandler.updateWindowMetaData('socket123', {
                    id: 'window_pixel_authority',
                    pixelWidth: 1280,
                    pixelHeight: 960,
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual(result.err?.code, -32074);
            const stored = await windowMetaDataService.getWindowMetaData({ id: 'window_pixel_authority', type: 'single' });
            assert.ok(!Array.isArray(stored));
            assert.strictEqual(stored?.pixelWidth, 1920);
            assert.strictEqual(stored?.pixelHeight, 1080);
        });

        it('contentVisible: false に更新できること', async () => {
            // 事前にウィンドウを追加
            const added = await windowMetaDataService.addWindowMetaData({
                id: 'window_test_cv',
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });
            assert.strictEqual(added.contentVisible, true);

            const result = await new Promise((resolve) => {
                commandHandler.updateWindowMetaData('socket123', {
                    id: 'window_test_cv',
                    contentVisible: false,
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            assert.strictEqual((result as any).res.contentVisible, false);

            // Redis にも反映されていること
            const stored = await windowMetaDataService.getWindowMetaData({ id: 'window_test_cv', type: 'single' });
            assert.ok(!Array.isArray(stored));
            assert.strictEqual(stored?.contentVisible, false);
        });

        it('contentVisible: true に更新できること', async () => {
            await windowMetaDataService.addWindowMetaData({
                id: 'window_test_cv2',
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                contentVisible: false,
            });

            const result = await new Promise((resolve) => {
                commandHandler.updateWindowMetaData('socket123', {
                    id: 'window_test_cv2',
                    contentVisible: true,
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            assert.strictEqual((result as any).res.contentVisible, true);
        });

        it('contentVisible を省略したとき既存の値が維持されること', async () => {
            await windowMetaDataService.addWindowMetaData({
                id: 'window_test_cv3',
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                contentVisible: false,
            });

            const result = await new Promise((resolve) => {
                commandHandler.updateWindowMetaData('socket123', {
                    id: 'window_test_cv3',
                    posx: 100,
                    // contentVisible は省略
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            assert.strictEqual((result as any).res.posx, 100);
            assert.strictEqual((result as any).res.contentVisible, false); // 維持されている
        });

        it('配列形式で複数ウィンドウの contentVisible を一括更新できること', async () => {
            await windowMetaDataService.addWindowMetaData({
                id: 'window_bulk_a',
                posx: 0, posy: 0,
                virtualWidth: 1920, virtualHeight: 1080,
                pixelWidth: 1920, pixelHeight: 1080,
            });
            await windowMetaDataService.addWindowMetaData({
                id: 'window_bulk_b',
                posx: 0, posy: 0,
                virtualWidth: 1920, virtualHeight: 1080,
                pixelWidth: 1920, pixelHeight: 1080,
            });

            const result = await new Promise((resolve) => {
                commandHandler.updateWindowMetaData('socket123', [
                    { id: 'window_bulk_a', contentVisible: false },
                    { id: 'window_bulk_b', contentVisible: false },
                ], (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            const results = (result as any).res as any[];
            assert.strictEqual(results.length, 2);
            assert.ok(results.every((r: any) => r.contentVisible === false));
        });

        it('未ログインユーザーは更新できないこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.updateWindowMetaData('no_session_socket', {
                    id: 'window_test_cv',
                    contentVisible: false,
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
        });
    });

    describe('updateWindowMetaData (Display専用パス)', () => {
        let displaySocketId: string;
        let windowId: string;

        beforeEach(async () => {
            displaySocketId = 'display_socket_1';
            windowId = 'window_display_test1';

            // Display セッションを登録・承認状態にする
            const session = await displaySessionService.registerDisplay('TestDisplay', displaySocketId, 1920, 1080);
            await windowMetaDataService.addWindowMetaData({
                id: windowId,
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                displayId: session.displayId,
            });
            await displaySessionService.approveDisplay(session.displayId, windowId);
        });

        it('承認済みDisplayがリサイズすると virtualHeight がアスペクト比に合わせて再計算されること', async () => {
            // 1920x1920 → 1280x960 にリサイズ（4:3 → virtualHeight = 1440）
            const result = await new Promise((resolve) => {
                commandHandler.updateWindowMetaData(displaySocketId, {
                    id: windowId,
                    pixelWidth: 1280,
                    pixelHeight: 960,
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual((result as any).err, null);
            const res = (result as any).res;
            assert.strictEqual(res.pixelWidth, 1280);
            assert.strictEqual(res.pixelHeight, 960);
            assert.strictEqual(res.virtualWidth, 1920);  // 変わらない
            assert.strictEqual(res.virtualHeight, 1440); // 1920 * 960 / 1280 = 1440

            // Redis にも反映されていること
            const stored = await windowMetaDataService.getWindowMetaData({ id: windowId, type: 'single' });
            assert.ok(!Array.isArray(stored));
            assert.strictEqual(stored?.virtualHeight, 1440);
        });

        it('同一windowIdのController位置変更とDisplay物理リサイズを直列にマージする', { timeout: 5000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const originalUpdate = windowMetaDataService.updateWindowMetaData.bind(windowMetaDataService);
            const positionWriteStarted: { resolve: () => void } = {
                resolve: (): void => { },
            };
            const releasePositionWrite: { resolve: () => void } = {
                resolve: (): void => { },
            };
            const positionWriteStartedPromise = new Promise<void>((resolve) => {
                positionWriteStarted.resolve = resolve;
            });
            const positionWriteGate = new Promise<void>((resolve) => {
                releasePositionWrite.resolve = resolve;
            });
            let pixelWriteStarted = false;
            windowMetaDataService.updateWindowMetaData = async (request): Promise<any> => {
                const updated = await originalUpdate(request);
                if (request.posx === 100) {
                    positionWriteStarted.resolve();
                    await positionWriteGate;
                }
                if (request.pixelWidth === 1280) {
                    pixelWriteStarted = true;
                }
                return updated;
            };

            const positionUpdate = new Promise<void>((resolve, reject) => {
                commandHandler.updateWindowMetaData('socket123', {
                    id: windowId,
                    posx: 100,
                }, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
            await positionWriteStartedPromise;

            const pixelResize = new Promise<void>((resolve, reject) => {
                commandHandler.updateWindowMetaData(displaySocketId, {
                    id: windowId,
                    pixelWidth: 1280,
                    pixelHeight: 960,
                }, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 0);
            });

            assert.strictEqual(pixelWriteStarted, false);
            releasePositionWrite.resolve();
            await Promise.all([positionUpdate, pixelResize]);

            const stored = await windowMetaDataService.getWindowMetaData({ id: windowId, type: 'single' });
            assert.ok(!Array.isArray(stored));
            assert.strictEqual(stored?.posx, 100);
            assert.strictEqual(stored?.pixelWidth, 1280);
            assert.strictEqual(stored?.pixelHeight, 960);
            assert.strictEqual(stored?.virtualHeight, 1440);
        });

        it('承認済みDisplayが自分以外のウィンドウを更新しようとするとエラーになること', async () => {
            const otherWindowId = 'window_other';
            await windowMetaDataService.addWindowMetaData({
                id: otherWindowId,
                posx: 0, posy: 0,
                virtualWidth: 1920, virtualHeight: 1080,
                pixelWidth: 1920, pixelHeight: 1080,
            });

            const result = await new Promise((resolve) => {
                commandHandler.updateWindowMetaData(displaySocketId, {
                    id: otherWindowId,
                    pixelWidth: 1280,
                    pixelHeight: 960,
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32003);
        });

        it('承認済みDisplayが配列形式で送信するとエラーになること', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.updateWindowMetaData(displaySocketId, [
                    { id: windowId, pixelWidth: 1280, pixelHeight: 960 },
                ], (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32003);
        });
    });

    describe('requestOTP', () => {
        it('ログイン済みユーザーがOTPトークンを発行できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise((resolve) => {
                commandHandler.requestOTP('socket123', {}, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual((result as any).err, null);
            assert.ok((result as any).res.token);
            assert.strictEqual((result as any).res.token.length, 64);
        });

        it('未ログインはOTP発行を拒否すること', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.requestOTP('no_session', {}, (err, res) => resolve({ err, res }));
            });
            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32001);
        });

        it('ADMINユーザーもOTPを発行できること', async () => {
            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            const result = await new Promise((resolve) => {
                commandHandler.requestOTP('admin_socket', {}, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual((result as any).err, null);
            assert.ok((result as any).res.token);
        });
    });

    describe('loginWithOTP', () => {
        it('有効なOTPトークンでログインできること', async () => {
            await sessionManager.createSession('issuer_socket', 'testuser', UserRole.MEMBER);
            const otpResult = await new Promise<any>((resolve) => {
                commandHandler.requestOTP('issuer_socket', {}, (err, res) => resolve({ err, res }));
            });
            const token = otpResult.res.token;

            const loginResult = await new Promise((resolve) => {
                commandHandler.loginWithOTP('new_socket', { token }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual((loginResult as any).err, null);
            assert.strictEqual((loginResult as any).res.success, true);
            assert.strictEqual((loginResult as any).res.userId, 'testuser');
            assert.strictEqual((loginResult as any).res.role, UserRole.MEMBER);

            const session = await sessionManager.getSession('new_socket');
            assert.ok(session);
            assert.strictEqual(session.userId, 'testuser');
        });

        it('同一トークンの2回使用を拒否すること（ワンタイム保証）', async () => {
            await sessionManager.createSession('issuer_socket', 'testuser', UserRole.MEMBER);
            const otpResult = await new Promise<any>((resolve) => {
                commandHandler.requestOTP('issuer_socket', {}, (err, res) => resolve({ err, res }));
            });
            const token = otpResult.res.token;

            await new Promise((resolve) => {
                commandHandler.loginWithOTP('socket_a', { token }, (err, res) => resolve({ err, res }));
            });
            const second = await new Promise((resolve) => {
                commandHandler.loginWithOTP('socket_b', { token }, (err, res) => resolve({ err, res }));
            });
            assert.ok((second as any).err);
            assert.strictEqual((second as any).err.code, -32004);
        });

        it('無効なトークンでログイン失敗すること', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.loginWithOTP('socket123', { token: 'a'.repeat(64) }, (err, res) => resolve({ err, res }));
            });
            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32004);
        });

        it('tokenが欠けている場合はエラーを返すこと', async () => {
            const result = await new Promise((resolve) => {
                commandHandler.loginWithOTP('socket123', {}, (err, res) => resolve({ err, res }));
            });
            assert.ok((result as any).err);
            assert.strictEqual((result as any).err.code, -32003);
        });

        it('ADMINユーザーのOTPでADMINセッションが作成されること', async () => {
            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            const otpResult = await new Promise<any>((resolve) => {
                commandHandler.requestOTP('admin_socket', {}, (err, res) => resolve({ err, res }));
            });
            const token = otpResult.res.token;

            await new Promise((resolve) => {
                commandHandler.loginWithOTP('new_socket', { token }, (err, res) => resolve({ err, res }));
            });
            const isAdmin = await sessionManager.isAdmin('new_socket');
            assert.strictEqual(isAdmin, true);
        });
    });

    // ========================================
    // コンテンツ管理
    // ========================================

    describe('addContent', () => {
        it('ログイン済みユーザーがコンテンツを追加できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'image', posx: 0, posy: 0, width: 100, height: 100 },
                    contentData: Buffer.from('dummy-image-data'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.ok(result.res.metadataId);
            assert.strictEqual(result.res.creatorId, 'testuser');
        });

        it('tileimage AddContentはupload descriptorを保持せず、枠busyならmetadataを作らない', { timeout: 10000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket-tile-first', 'testuser', UserRole.MEMBER);
            await sessionManager.createSession('socket-tile-second', 'admin', UserRole.ADMIN);

            const firstResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket-tile-first', {
                    metaData: {
                        type: 'tileimage',
                        posx: 0,
                        posy: 0,
                        width: 512,
                        height: 512,
                        tileImageUpload: {
                            uploadId: 'upload-tile-first',
                            byteLength: 8,
                            segment_max: 1,
                            file_ext: 'png',
                        },
                    },
                    contentData: Buffer.alloc(0),
                }, (err, res) => { resolve({ err, res }); });
            });

            assert.strictEqual(firstResult.err, null);
            assert.notStrictEqual(firstResult.res.metadataId, 'client-chosen-tile-id');
            const firstMetadata = await contentService.getMetadata(firstResult.res.metadataId);
            assert.strictEqual((firstMetadata as any).tileImageUpload, undefined);

            const secondResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket-tile-second', {
                    metaData: {
                        type: 'tileimage',
                        posx: 10,
                        posy: 20,
                        width: 256,
                        height: 256,
                        tileImageUpload: {
                            uploadId: 'upload-tile-second',
                            byteLength: 4,
                            segment_max: 1,
                            file_ext: 'jpg',
                        },
                    },
                    contentData: Buffer.alloc(0),
                }, (err, res) => { resolve({ err, res }); });
            });

            assert.strictEqual(secondResult.err.code, -32072);
            assert.strictEqual(await contentService.getMetadata(secondResult.res?.metadataId ?? ''), null);
            assert.strictEqual((await contentService.getAllMetadata()).length, 1);
            await commandHandler.cleanupTileimageOnDisconnect('socket-tile-first');
        });

        it('tileimage AddContentの本文binaryは拒否しmetadataを作らない', async (): Promise<void> => {
            await sessionManager.createSession('socket-tile-binary', 'testuser', UserRole.MEMBER);

            const result = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket-tile-binary', {
                    metaData: {
                        type: 'tileimage',
                        tileImageUpload: {
                            uploadId: 'upload-tile-binary',
                            byteLength: 4,
                            segment_max: 1,
                            file_ext: 'jpg',
                        },
                    },
                    contentData: Buffer.from([1, 2, 3, 4]),
                }, (error, response) => { resolve({ error, response }); });
            });

            assert.strictEqual(result.error.code, -32025);
            assert.strictEqual((await contentService.getAllMetadata()).length, 0);
        });

        it('AddContent保存中に切断されたら、遅延保存完了後にmetadataをcleanupする', { timeout: 5000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket-tile-race', 'testuser', UserRole.MEMBER);
            const client = createMockClient('socket-tile-race');
            clients.add(client);

            let signalAddContentStored: (() => void) | undefined;
            let releaseAddContent: (() => void) | undefined;
            const addContentStored = new Promise<void>((resolve): void => {
                signalAddContentStored = resolve;
            });
            const addContentRelease = new Promise<void>((resolve): void => {
                releaseAddContent = resolve;
            });
            const originalAddContent = contentService.addContent.bind(contentService);
            contentService.addContent = async (request) => {
                const metadata = await originalAddContent(request);
                signalAddContentStored?.();
                await addContentRelease;
                return metadata;
            };

            let callbackCalled = false;
            const addPromise = commandHandler.addContent('socket-tile-race', {
                metaData: {
                    type: 'tileimage',
                    posx: 0,
                    posy: 0,
                    width: 100,
                    height: 100,
                    tileImageUpload: {
                        uploadId: 'upload-tile-race',
                        byteLength: 4,
                        segment_max: 1,
                        file_ext: 'jpg',
                    },
                },
                contentData: Buffer.alloc(0),
            }, (): void => { callbackCalled = true; });

            await addContentStored;
            clients.delete(client);
            await commandHandler.cleanupTileimageOnDisconnect('socket-tile-race');
            releaseAddContent?.();
            await addPromise;

            assert.strictEqual(callbackCalled, false);
            assert.strictEqual((await contentService.getAllMetadata()).length, 0);
            assert.strictEqual(client.sentMessages.some((raw: string): boolean => {
                return JSON.parse(raw).method === Command.AddContent;
            }), false);

            const nextReservation = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket-tile-race', {
                    metaData: {
                        type: 'tileimage',
                        posx: 0,
                        posy: 0,
                        width: 100,
                        height: 100,
                        tileImageUpload: {
                            uploadId: 'upload-after-race',
                            byteLength: 1,
                            segment_max: 1,
                            file_ext: 'jpg',
                        },
                    },
                    contentData: Buffer.alloc(0),
                }, (error, response) => { resolve({ error, response }); });
            });
            assert.strictEqual(nextReservation.error, null);
            await commandHandler.cleanupTileimageOnDisconnect('socket-tile-race');
        });

        it('AddContent保存がidle timeoutを超えて後から完了してもmetadataを残さず一度だけ応答する', { timeout: 5000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket-tile-add-timeout', 'testuser', UserRole.MEMBER);
            (commandHandler as any).tileImageUploadIdleTimeoutMs = 15;

            let signalAddContentStored: (() => void) | undefined;
            let releaseAddContent: (() => void) | undefined;
            const addContentStored = new Promise<void>((resolve): void => {
                signalAddContentStored = resolve;
            });
            const addContentRelease = new Promise<void>((resolve): void => {
                releaseAddContent = resolve;
            });
            const originalAddContent = contentService.addContent.bind(contentService);
            contentService.addContent = async (request) => {
                const metadata = await originalAddContent(request);
                signalAddContentStored?.();
                await addContentRelease;
                return metadata;
            };

            let callbackCount = 0;
            let callbackResult: any = null;
            const addPromise = commandHandler.addContent('socket-tile-add-timeout', {
                metaData: {
                    type: 'tileimage',
                    posx: 0,
                    posy: 0,
                    width: 100,
                    height: 100,
                    tileImageUpload: {
                        uploadId: 'upload-tile-add-timeout',
                        byteLength: 4,
                        segment_max: 1,
                        file_ext: 'jpg',
                    },
                },
                contentData: Buffer.alloc(0),
            }, (error, response) => {
                callbackCount += 1;
                callbackResult = { error, response };
            });

            await addContentStored;
            await new Promise<void>((resolve): void => {
                setTimeout(resolve, 30);
            });
            assert.strictEqual(callbackResult.error.code, -32072);

            releaseAddContent?.();
            await addPromise;

            assert.strictEqual(callbackCount, 1);
            assert.strictEqual((await contentService.getAllMetadata()).length, 0);
        });

        it('AddContent後に最初のsegmentが届かなければidle timeoutでcleanupする', { timeout: 5000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket-tile-idle', 'testuser', UserRole.MEMBER);
            const sender = createMockClient('socket-tile-idle');
            clients.add(sender);
            (commandHandler as any).tileImageUploadIdleTimeoutMs = 15;

            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket-tile-idle', {
                    metaData: {
                        type: 'tileimage',
                        posx: 0,
                        posy: 0,
                        width: 100,
                        height: 100,
                        tileImageUpload: {
                            uploadId: 'upload-tile-idle',
                            byteLength: 4,
                            segment_max: 1,
                            file_ext: 'jpg',
                        },
                    },
                    contentData: Buffer.alloc(0),
                }, (error, response) => { resolve({ error, response }); });
            });
            assert.strictEqual(addResult.error, null);
            const metadataId = addResult.response.metadataId;
            assert.notStrictEqual(await contentService.getMetadata(metadataId), null);

            await new Promise<void>((resolve): void => {
                setTimeout(resolve, 40);
            });

            assert.strictEqual(await contentService.getMetadata(metadataId), null);
            const failureMessage = sender.sentMessages
                .map((raw: string) => { return JSON.parse(raw); })
                .find((message: any) => { return message.method === Command.TileimageUploadFailed; });
            assert.ok(failureMessage);
            assert.strictEqual(failureMessage.params.metadataId, metadataId);
        });

        it('未ログインはコンテンツ追加を拒否すること', async () => {
            const result = await new Promise<any>((resolve) => {
                commandHandler.addContent('no_session', {
                    metaData: { type: 'image', posx: 0, posy: 0, width: 100, height: 100 },
                    contentData: Buffer.from('dummy'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32001);
        });

        it('metaDataが欠けている場合はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    contentData: Buffer.from('dummy'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32021);
        });

        it('binaryが欠けている場合（image型）はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'image', posx: 0, posy: 0, width: 100, height: 100 },
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32021);
        });

        it('creatorIdが自動的にセッションのユーザーIDで設定されること', async () => {
            await sessionManager.createSession('socket123', 'admin', UserRole.ADMIN);
            const result = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'image', posx: 10, posy: 20, width: 200, height: 150 },
                    contentData: Buffer.from('image-data'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.creatorId, 'admin');
        });

        it('MIME型（image/png）を受け取っても canonical type=image で保存されること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'image/png', posx: 0, posy: 0, width: 100, height: 100 },
                    contentData: Buffer.from('dummy-image-data'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.type, 'image');
        });

        it('サポート外 metadata.type はエラーで拒否されること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'application/zip', posx: 0, posy: 0, width: 100, height: 100 },
                    contentData: Buffer.from('dummy-zip-data'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32023);
        });
    });

    describe('getMetaData', () => {
        it('全件取得できること（認証済み）', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            // コンテンツ追加
            await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'image', posx: 0, posy: 0, width: 100, height: 100 },
                    contentData: Buffer.from('data1'),
                }, (err, res) => resolve({ err, res }));
            });

            const result = await new Promise<any>((resolve) => {
                commandHandler.getMetaData('socket123', {}, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.ok(Array.isArray(result.res.metadataList));
            assert.strictEqual(result.res.metadataList.length, 1);
        });

        it('metadataId指定で単一取得できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'image', posx: 0, posy: 0, width: 100, height: 100 },
                    contentData: Buffer.from('data'),
                }, (err, res) => resolve({ err, res }));
            });
            const metadataId = addResult.res.metadataId;

            const result = await new Promise<any>((resolve) => {
                commandHandler.getMetaData('socket123', { metadataId }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.metadataId, metadataId);
        });

        it('存在しないmetadataIdの場合はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.getMetaData('socket123', { metadataId: 'nonexistent-id' }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32030);
        });

        it('未ログインはエラーを返すこと', async () => {
            const result = await new Promise<any>((resolve) => {
                commandHandler.getMetaData('no_session', {}, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32001);
        });
    });

    describe('getContent', () => {
        it('コンテンツ（メタデータ+バイナリ）を取得できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'image', posx: 0, posy: 0, width: 100, height: 100 },
                    contentData: Buffer.from('image-binary'),
                }, (err, res) => resolve({ err, res }));
            });
            const metadataId = addResult.res.metadataId;

            const result = await new Promise<any>((resolve) => {
                commandHandler.getContent('socket123', { metadataId }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.ok(result.res);
            assert.strictEqual(result.res.metadataId, metadataId);
        });

        it('metadataIdが欠けている場合はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.getContent('socket123', {}, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32032);
        });

        it('存在しないコンテンツの場合はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.getContent('socket123', { metadataId: 'nonexistent' }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32033);
        });
    });

    describe('updateMetaData', () => {
        it('単一メタデータを更新できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'image', posx: 0, posy: 0, width: 100, height: 100 },
                    contentData: Buffer.from('data'),
                }, (err, res) => resolve({ err, res }));
            });
            const metadataId = addResult.res.metadataId;

            const result = await new Promise<any>((resolve) => {
                commandHandler.updateMetaData('socket123', { metadataId, posx: 50, posy: 60 }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.posx, 50);
            assert.strictEqual(result.res.posy, 60);
        });

        it('同一metadataIdの本文更新をメタデータ更新後に処理すること', { timeout: 5000 }, async (): Promise<void> => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'text', posx: 0, posy: 0, width: 100, height: 80 },
                    contentData: Buffer.from('original'),
                }, (err, res) => resolve({ err, res }));
            });
            const metadataId = addResult.res.metadataId;
            const receiverClient = createMockClient('socket456');
            clients.add(receiverClient);

            const metadataUpdateEntered: { resolve: () => void } = {
                resolve: (): void => { },
            };
            const releaseMetadataUpdate: { resolve: () => void } = {
                resolve: (): void => { },
            };
            const metadataUpdateEnteredPromise = new Promise<void>((resolve) => {
                metadataUpdateEntered.resolve = resolve;
            });
            const metadataUpdateGate = new Promise<void>((resolve) => {
                releaseMetadataUpdate.resolve = resolve;
            });

            const originalUpdateMetadata = contentService.updateMetadata.bind(contentService);
            let shouldPauseMetadataUpdate = true;
            contentService.updateMetadata = async (id, updates) => {
                const updated = await originalUpdateMetadata(id, updates);
                if (shouldPauseMetadataUpdate && updates.posx === 50) {
                    shouldPauseMetadataUpdate = false;
                    metadataUpdateEntered.resolve();
                    await metadataUpdateGate;
                }
                return updated;
            };

            const originalUpdateContent = contentService.updateContent.bind(contentService);
            let contentUpdateStarted = false;
            contentService.updateContent = async (request) => {
                contentUpdateStarted = true;
                return originalUpdateContent(request);
            };

            const metadataUpdatePromise = new Promise<void>((resolve, reject) => {
                commandHandler.updateMetaData('socket123', { metadataId, posx: 50 }, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
            await metadataUpdateEnteredPromise;

            const contentUpdatePromise = new Promise<void>((resolve, reject) => {
                commandHandler.updateContent('socket123', {
                    metadataId,
                    binary: Buffer.from('updated'),
                }, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 0);
            });

            assert.strictEqual(contentUpdateStarted, false);
            releaseMetadataUpdate.resolve();
            await Promise.all([metadataUpdatePromise, contentUpdatePromise]);

            const finalMetadata = await contentService.getMetadata(metadataId);
            assert.strictEqual(finalMetadata?.posx, 50);
            const broadcastMethods = receiverClient.sentMessages.map((message) => {
                return JSON.parse(message).method;
            });
            assert.deepStrictEqual(broadcastMethods, [Command.UpdateMetaData, Command.UpdateContent]);
        });

        it('配列で複数メタデータを一括更新できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const addResult1 = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'image', posx: 0, posy: 0, width: 100, height: 100 },
                    contentData: Buffer.from('data1'),
                }, (err, res) => resolve({ err, res }));
            });
            const addResult2 = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'image', posx: 0, posy: 0, width: 200, height: 200 },
                    contentData: Buffer.from('data2'),
                }, (err, res) => resolve({ err, res }));
            });

            const result = await new Promise<any>((resolve) => {
                commandHandler.updateMetaData('socket123', [
                    { metadataId: addResult1.res.metadataId, posx: 10 },
                    { metadataId: addResult2.res.metadataId, posx: 20 },
                ], (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.ok(Array.isArray(result.res));
            assert.strictEqual(result.res.length, 2);
        });

        it('metadataIdが欠けている場合はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateMetaData('socket123', { posx: 10 }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32040);
        });

        it('未ログインはエラーを返すこと', async () => {
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateMetaData('no_session', { metadataId: 'any', posx: 10 }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32001);
        });

        it('updateMetaData にカメラフィールドが含まれてもメタデータには保存されないこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'webgl', posx: 150, posy: 250, width: 800, height: 600 },
                    contentData: Buffer.from(''),
                }, (err, res) => resolve({ err, res }));
            });
            const metadataId = addResult.res.metadataId;

            const cameraMatrix = JSON.stringify({ elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 10, 15, 1] });
            const cameraParams = JSON.stringify({ fov: 60 });

            const result = await new Promise<any>((resolve) => {
                commandHandler.updateMetaData('socket123', {
                    metadataId,
                    cameraWorldMatrix: cameraMatrix,
                    cameraParams: cameraParams,
                }, (err, res) => resolve({ err, res }));
            });

            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.posx, 150);  // 変化しないこと
            assert.strictEqual(result.res.posy, 250);  // 変化しないこと
            // camera フィールドは content:metadata に保存されない
            assert.strictEqual(result.res.cameraWorldMatrix, undefined);
            assert.strictEqual(result.res.cameraParams, undefined);
        });
    });

    describe('client diagnostic reporting', () => {
        it('records client geometry with the authoritative server window snapshot', async (): Promise<void> => {
            const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chowder-diagnostic-command-'));
            const diagnosticLogService = new ClientDiagnosticLogService({ enabled: true, directory });
            const diagnosticHandler = new CommandHandler(
                sessionManager,
                authService,
                contentService,
                windowMetaDataService,
                displaySessionService,
                mediaService,
                siteService,
                layoutService,
                { tileImage: { widthThreshold: 3840, heightThreshold: 2160, tileSize: 256 } },
                diagnosticLogService,
            );

            try {
                await sessionManager.createSession('diagnostic-socket', 'testuser', UserRole.MEMBER);
                const windowMetaData = await windowMetaDataService.addWindowMetaData({
                    id: 'diagnostic-window',
                    posx: 100,
                    posy: 50,
                    virtualWidth: 1920,
                    virtualHeight: 1080,
                    pixelWidth: 1920,
                    pixelHeight: 1080,
                });

                const result = await new Promise<{ error: any; data: any }>((resolve) => {
                    diagnosticHandler.reportClientDiagnostic('diagnostic-socket', {
                        event: 'display-initial',
                        diagnosticSessionId: diagnosticLogService.sessionId,
                        role: 'display',
                        windowId: windowMetaData.id,
                        clientAppliedRevision: 1,
                        clientWindow: { posx: 100, posy: 50, virtualWidth: 1920, virtualHeight: 1080 },
                    }, (error, data) => {
                        resolve({ error, data });
                    });
                });
                const readyResult = await new Promise<{ error: any; data: any }>((resolve) => {
                    diagnosticHandler.reportClientDiagnostic('diagnostic-socket', {
                        event: 'itowns-diagnostic-ready',
                        diagnosticSessionId: diagnosticLogService.sessionId,
                        windowId: windowMetaData.id,
                        diagnosticInteraction: {
                            metadataId: 'diagnostic-content',
                            sessionMatched: true,
                            listenersInitialized: true,
                        },
                    }, (error, data) => {
                        resolve({ error, data });
                    });
                });
                await diagnosticLogService.flush();

                assert.strictEqual(result.error, null);
                assert.strictEqual(result.data.accepted, true);
                assert.strictEqual(readyResult.error, null);
                assert.strictEqual(readyResult.data.accepted, true);
                const files = await fs.readdir(directory);
                const records = (await fs.readFile(path.join(directory, files[0]), 'utf8'))
                    .trim()
                    .split('\n')
                    .map((line) => JSON.parse(line));
                assert.strictEqual(records[0].role, 'controller');
                assert.strictEqual(records[0].serverWindow.id, 'diagnostic-window');
                assert.strictEqual(records[0].serverWindow.revision, 1);
                assert.strictEqual(records[0].serverWindowMetaDataRevision, 1);
                assert.strictEqual(records[1].event, 'itowns-diagnostic-ready');
                assert.strictEqual(records[1].diagnosticInteraction.sessionMatched, true);
            } finally {
                await fs.rm(directory, { recursive: true, force: true });
            }
        });
    });

    describe('updateCameraMatrix', () => {
        it('カメラデータを保存してブロードキャストできること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'webgl', posx: 100, posy: 200, width: 800, height: 600 },
                    contentData: Buffer.from(''),
                }, (err, res) => resolve({ err, res }));
            });
            const metadataId = addResult.res.metadataId;

            const cameraMatrix = JSON.stringify({ elements: [1, 0, 0, 0] });
            const cameraParams = JSON.stringify({ fov: 45 });
            const lease = await contentService.registerCameraSource(metadataId, 'source', 'socket123');

            const result = await new Promise<any>((resolve) => {
                commandHandler.updateCameraMatrix('socket123', {
                    metadataId,
                    cameraWorldMatrix: cameraMatrix,
                    cameraParams: cameraParams,
                    ...lease,
                    sourceInstanceId: 'source',
                    sourceSequence: 1,
                }, (err, res) => resolve({ err, res }));
            });

            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.metadataId, metadataId);
            assert.strictEqual(result.res.cameraWorldMatrix, cameraMatrix);
            assert.strictEqual(result.res.cameraParams, cameraParams);
        });

        it('未ログインはエラーを返すこと', async () => {
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateCameraMatrix('no_session', {
                    metadataId: 'any',
                    cameraWorldMatrix: '{}',
                    cameraParams: '{}',
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32001);
        });

        it('metadataId が欠けている場合はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateCameraMatrix('socket123', {
                    cameraWorldMatrix: '{}',
                    cameraParams: '{}',
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32060);
        });

        it('getContent でカメラデータが mergeされること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'webgl', posx: 50, posy: 60, width: 800, height: 600 },
                    contentData: Buffer.from(''),
                }, (err, res) => resolve({ err, res }));
            });
            const metadataId = addResult.res.metadataId;

            const cameraMatrix = JSON.stringify({ elements: [2, 0, 0, 0] });
            const cameraParams = JSON.stringify({ fov: 30 });
            const lease = await contentService.registerCameraSource(metadataId, 'source', 'socket123');

            await new Promise<void>((resolve) => {
                commandHandler.updateCameraMatrix('socket123', { metadataId, cameraWorldMatrix: cameraMatrix, cameraParams, ...lease, sourceInstanceId: 'source', sourceSequence: 1 }, (err) => {
                    resolve();
                });
            });

            const getResult = await new Promise<any>((resolve) => {
                commandHandler.getContent('socket123', { metadataId }, (err, res) => resolve({ err, res }));
            });

            assert.strictEqual(getResult.err, null);
            assert.strictEqual(getResult.res.cameraWorldMatrix, cameraMatrix);
            assert.strictEqual(getResult.res.cameraParams, cameraParams);
            assert.strictEqual(getResult.res.posx, 50);  // metadata は変化しないこと
        });
    });

    describe('updateContent', () => {
        it('バイナリコマンド形式（metaData/contentData）でコンテンツを更新できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'text', posx: 0, posy: 0, width: 200, height: 100 },
                    contentData: Buffer.from(JSON.stringify({ type: 'text', value: 'hello' })),
                }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(addResult.err, null);
            const metadataId = addResult.res.metadataId;

            const newBinary = Buffer.from(JSON.stringify({ type: 'text', value: 'updated' }));
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateContent('socket123', {
                    metaData: { metadataId },
                    contentData: newBinary,
                }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.metadataId, metadataId);
        });

        it('UpdateContent のブロードキャストが params.metadata 形式で送信されること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const senderClient = createMockClient('socket123');
            const receiverClient = createMockClient('socket456');
            clients.add(senderClient);
            clients.add(receiverClient);

            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'text', posx: 0, posy: 0, width: 200, height: 100 },
                    contentData: Buffer.from(JSON.stringify({ type: 'text', value: 'hello' })),
                }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(addResult.err, null);
            const metadataId = addResult.res.metadataId;

            (senderClient as any).sentMessages.length = 0;
            (receiverClient as any).sentMessages.length = 0;

            const updateResult = await new Promise<any>((resolve) => {
                commandHandler.updateContent('socket123', {
                    metaData: { metadataId },
                    contentData: Buffer.from(JSON.stringify({ type: 'text', value: 'updated' })),
                }, (err, res) => resolve({ err, res }));
            });

            assert.strictEqual(updateResult.err, null);
            assert.strictEqual((senderClient as any).sentMessages.length, 0);
            assert.strictEqual((receiverClient as any).sentMessages.length, 1);

            const broadcast = JSON.parse((receiverClient as any).sentMessages[0]);
            assert.strictEqual(broadcast.method, Command.UpdateContent);
            assert.ok(broadcast.params);
            assert.ok(broadcast.params.metadata);
            assert.strictEqual(broadcast.params.metadata.metadataId, metadataId);
            assert.strictEqual((broadcast.params as any).metadataId, undefined);
        });

        it('metadataIdが欠けている場合はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateContent('socket123', {
                    metaData: {},
                    contentData: Buffer.from('data'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32043);
        });

        it('metadataIdが空白のみの場合はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateContent('socket123', {
                    metadataId: '   ',
                    binary: Buffer.from('data'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32043);
        });

        it('metadataIdがundefined文字列の場合はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateContent('socket123', {
                    metadataId: 'undefined',
                    binary: Buffer.from('data'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32043);
        });

        it('形式上有効だが存在しないmetadataIdはContent not foundを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateContent('socket123', {
                    metadataId: 'non-existent-id',
                    binary: Buffer.from('data'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32044);
        });

        it('未ログインはエラーを返すこと', async () => {
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateContent('no_session', {
                    metaData: { metadataId: 'any' },
                    contentData: Buffer.from('data'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32001);
        });
    });

    describe('deleteContent', () => {
        it('コンテンツを削除できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'image', posx: 0, posy: 0, width: 100, height: 100 },
                    contentData: Buffer.from('data'),
                }, (err, res) => resolve({ err, res }));
            });
            const metadataId = addResult.res.metadataId;

            const deleteResult = await new Promise<any>((resolve) => {
                commandHandler.deleteContent('socket123', { metadataId }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(deleteResult.err, null);
            assert.strictEqual(deleteResult.res.success, true);

            // 削除後は取得できないことを確認
            const getResult = await new Promise<any>((resolve) => {
                commandHandler.getContent('socket123', { metadataId }, (err, res) => resolve({ err, res }));
            });
            assert.ok(getResult.err);
            assert.strictEqual(getResult.err.code, -32033);
        });

        it('metadataIdが欠けている場合はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.deleteContent('socket123', {}, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32050);
        });

        it('存在しないコンテンツの削除はエラーを返すこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.deleteContent('socket123', { metadataId: 'nonexistent' }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32051);
        });

        it('未ログインはエラーを返すこと', async () => {
            const result = await new Promise<any>((resolve) => {
                commandHandler.deleteContent('no_session', { metadataId: 'any' }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32001);
        });
    });

    // ========================================
    // ディスプレイ管理
    // ========================================

    describe('registerDisplay', () => {
        it('認証なしでディスプレイを登録できること（pending状態）', async () => {
            const result = await new Promise<any>((resolve) => {
                commandHandler.registerDisplay('display_socket', {
                    displayName: 'TestDisplay',
                    screenWidth: 1920,
                    screenHeight: 1080,
                }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.ok(result.res.session);
            assert.strictEqual(result.res.session.displayName, 'TestDisplay');
            assert.strictEqual(result.res.session.status, 'pending');
        });

        it('displayName/screenWidth/screenHeightが欠けている場合はエラーを返すこと', async () => {
            const result = await new Promise<any>((resolve) => {
                commandHandler.registerDisplay('display_socket', {
                    displayName: 'TestDisplay',
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32090);
        });
    });

    describe('getPendingDisplays / getApprovedDisplays', () => {
        it('ADMINが未承認ディスプレイ一覧を取得できること', async () => {
            // ディスプレイ登録
            await new Promise<any>((resolve) => {
                commandHandler.registerDisplay('display_socket', {
                    displayName: 'PendingDisplay',
                    screenWidth: 1920,
                    screenHeight: 1080,
                }, (err, res) => resolve({ err, res }));
            });

            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            const result = await new Promise<any>((resolve) => {
                commandHandler.getPendingDisplays('admin_socket', {}, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.ok(Array.isArray(result.res.displays));
            assert.ok(result.res.displays.length >= 1);
        });

        it('非ADMINは未承認ディスプレイ一覧を取得できないこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.getPendingDisplays('socket123', {}, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32002);
        });

        it('ADMINが承認済みディスプレイ一覧を取得できること', async () => {
            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            const result = await new Promise<any>((resolve) => {
                commandHandler.getApprovedDisplays('admin_socket', {}, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.ok(Array.isArray(result.res.displays));
        });
    });

    describe('approveDisplay / rejectDisplay / deleteDisplay', () => {
        it('ADMINがディスプレイを承認できること', async () => {
            // ディスプレイ登録
            const regResult = await new Promise<any>((resolve) => {
                commandHandler.registerDisplay('display_socket', {
                    displayName: 'ApproveMe',
                    screenWidth: 1920,
                    screenHeight: 1080,
                }, (err, res) => resolve({ err, res }));
            });
            const displayId = regResult.res.session.displayId;

            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            const result = await new Promise<any>((resolve) => {
                commandHandler.approveDisplay('admin_socket', {
                    displayId,
                    posx: 0,
                    posy: 0,
                    virtualWidth: 1920,
                    virtualHeight: 1080,
                }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.session.status, 'approved');
        });

        it('approveDisplayでdisplayIdが欠けている場合はエラーを返すこと', async () => {
            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            const result = await new Promise<any>((resolve) => {
                commandHandler.approveDisplay('admin_socket', {
                    posx: 0, posy: 0, virtualWidth: 1920, virtualHeight: 1080,
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32094);
        });

        it('approveDisplayでsiteId未指定時はDefaultサイトに属すること', async () => {
            const regResult = await new Promise<any>((resolve) => {
                commandHandler.registerDisplay('display_socket_default_site', {
                    displayName: 'DefaultSiteDisplay',
                    screenWidth: 1920,
                    screenHeight: 1080,
                }, (err, res) => resolve({ err, res }));
            });
            const displayId = regResult.res.session.displayId;

            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            const result = await new Promise<any>((resolve) => {
                commandHandler.approveDisplay('admin_socket', {
                    displayId,
                    posx: 0,
                    posy: 0,
                    virtualWidth: 1920,
                    virtualHeight: 1080,
                    // siteId 未指定
                }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.windowData.siteId, 'default');
        });

        it('ADMINがディスプレイを削除できること', async () => {
            // ディスプレイ登録
            const regResult = await new Promise<any>((resolve) => {
                commandHandler.registerDisplay('display_socket2', {
                    displayName: 'DeleteMe',
                    screenWidth: 1280,
                    screenHeight: 720,
                }, (err, res) => resolve({ err, res }));
            });
            const displayId = regResult.res.session.displayId;

            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            const result = await new Promise<any>((resolve) => {
                commandHandler.deleteDisplay('admin_socket', { displayId }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.success, true);
        });

        it('接続中ディスプレイを削除すると通知後に切断されること', async () => {
            const regResult = await new Promise<any>((resolve) => {
                commandHandler.registerDisplay('display_socket_delete_connected', {
                    displayName: 'DeleteConnected',
                    screenWidth: 1280,
                    screenHeight: 720,
                }, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.strictEqual(regResult.err, null);
            const displayId = regResult.res.session.displayId;

            const displayClient = createMockClient('display_socket_delete_connected');
            clients.add(displayClient);

            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);

            const approveResult = await new Promise<any>((resolve) => {
                commandHandler.approveDisplay('admin_socket', {
                    displayId,
                    posx: 0,
                    posy: 0,
                    virtualWidth: 1280,
                    virtualHeight: 720,
                }, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.strictEqual(approveResult.err, null);

            const deleteResult = await new Promise<any>((resolve) => {
                commandHandler.deleteDisplay('admin_socket', { displayId }, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.strictEqual(deleteResult.err, null);
            assert.strictEqual(deleteResult.res.success, true);

            const rejectedMessage = (displayClient as any).sentMessages
                .map((raw: string) => {
                    return JSON.parse(raw);
                })
                .find((message: any) => {
                    return message.method === 'DisplayRejected';
                });
            assert.ok(rejectedMessage);

            await new Promise((resolve) => {
                setTimeout(resolve, 220);
            });
            assert.strictEqual((displayClient as any).closeCalled, true);
        });

        it('非ADMINはディスプレイを削除できないこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.deleteDisplay('socket123', { displayId: 'any' }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32002);
        });

        it('ADMINがディスプレイを拒否できること', async () => {
            const regResult = await new Promise<any>((resolve) => {
                commandHandler.registerDisplay('display_reject_socket', {
                    displayName: 'RejectMe',
                    screenWidth: 1920,
                    screenHeight: 1080,
                }, (err, res) => resolve({ err, res }));
            });
            const displayId = regResult.res.session.displayId;

            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            const result = await new Promise<any>((resolve) => {
                commandHandler.rejectDisplay('admin_socket', { displayId }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.success, true);
        });
    });

    describe('refreshDisplayContent', () => {
        it('ADMINが呼んだ場合は成功すること', async () => {
            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            const result = await new Promise<any>((resolve) => {
                commandHandler.refreshDisplayContent('admin_socket', {}, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.success, true);
            assert.strictEqual(result.res.displayCount, 0);
        });

        it('承認済みディスプレイが存在する場合はdisplayCountに件数が返ること', async () => {
            const regResult = await new Promise<any>((resolve) => {
                commandHandler.registerDisplay('display_socket_refresh', {
                    displayName: 'RefreshTarget',
                    screenWidth: 1920,
                    screenHeight: 1080,
                }, (err, res) => resolve({ err, res }));
            });
            const displayId = regResult.res.session.displayId;
            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            await new Promise<any>((resolve) => {
                commandHandler.approveDisplay('admin_socket', {
                    displayId,
                    posx: 0,
                    posy: 0,
                    virtualWidth: 1920,
                    virtualHeight: 1080,
                }, (err, res) => resolve({ err, res }));
            });

            const result = await new Promise<any>((resolve) => {
                commandHandler.refreshDisplayContent('admin_socket', {}, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.success, true);
            assert.strictEqual(result.res.displayCount, 1);
        });

        it('非ADMINは呼べないこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.refreshDisplayContent('socket123', {}, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32002);
        });

        it('未ログインは呼べないこと', async () => {
            const result = await new Promise<any>((resolve) => {
                commandHandler.refreshDisplayContent('no_session', {}, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32002);
        });
    });

    describe('updateMouseCursor', () => {
        it('ログイン済みコントローラと承認済みDisplayにのみ配信されること', async () => {
            await sessionManager.createSession('admin_socket', 'admin', UserRole.ADMIN);
            await sessionManager.createSession('controller_sender', 'testuser', UserRole.MEMBER);
            await sessionManager.createSession('controller_receiver', 'admin', UserRole.ADMIN);

            const approvedReg = await new Promise<any>((resolve) => {
                commandHandler.registerDisplay('display_socket_approved', {
                    displayName: 'CursorApproved',
                    screenWidth: 1920,
                    screenHeight: 1080,
                }, (err, res) => {
                    resolve({ err, res });
                });
            });
            const pendingReg = await new Promise<any>((resolve) => {
                commandHandler.registerDisplay('display_socket_pending', {
                    displayName: 'CursorPending',
                    screenWidth: 1920,
                    screenHeight: 1080,
                }, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.strictEqual(approvedReg.err, null);
            assert.strictEqual(pendingReg.err, null);

            await new Promise<any>((resolve) => {
                commandHandler.approveDisplay('admin_socket', {
                    displayId: approvedReg.res.session.displayId,
                    posx: 0,
                    posy: 0,
                    virtualWidth: 1920,
                    virtualHeight: 1080,
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            const sender = createMockClient('controller_sender');
            const controllerReceiver = createMockClient('controller_receiver');
            const approvedDisplay = createMockClient('display_socket_approved');
            const pendingDisplay = createMockClient('display_socket_pending');
            const anonymousClient = createMockClient('anonymous_socket');

            clients.add(sender);
            clients.add(controllerReceiver);
            clients.add(approvedDisplay);
            clients.add(pendingDisplay);
            clients.add(anonymousClient);

            const result = await new Promise<any>((resolve) => {
                commandHandler.updateMouseCursor('controller_sender', {
                    socketId: 'controller_sender',
                    userId: 'testuser',
                    data: { x: 100, y: 200 },
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual(result.err, null);
            assert.strictEqual(result.res.success, true);

            const senderMessage = (sender as any).sentMessages.find((raw: string) => {
                const msg = JSON.parse(raw);
                return msg.method === Command.UpdateMouseCursor;
            });
            const controllerMessage = (controllerReceiver as any).sentMessages.find((raw: string) => {
                const msg = JSON.parse(raw);
                return msg.method === Command.UpdateMouseCursor;
            });
            const approvedDisplayMessage = (approvedDisplay as any).sentMessages.find((raw: string) => {
                const msg = JSON.parse(raw);
                return msg.method === Command.UpdateMouseCursor;
            });
            const pendingDisplayMessage = (pendingDisplay as any).sentMessages.find((raw: string) => {
                const msg = JSON.parse(raw);
                return msg.method === Command.UpdateMouseCursor;
            });
            const anonymousMessage = (anonymousClient as any).sentMessages.find((raw: string) => {
                const msg = JSON.parse(raw);
                return msg.method === Command.UpdateMouseCursor;
            });

            assert.ok(senderMessage);
            assert.ok(controllerMessage);
            assert.ok(approvedDisplayMessage);
            assert.strictEqual(pendingDisplayMessage, undefined);
            assert.strictEqual(anonymousMessage, undefined);

            const senderPayload = JSON.parse(senderMessage).params;
            const controllerPayload = JSON.parse(controllerMessage).params;
            const displayPayload = JSON.parse(approvedDisplayMessage).params;

            assert.strictEqual(typeof senderPayload.color, 'string');
            assert.ok(/^#[0-9a-fA-F]{6}$/.test(senderPayload.color));
            assert.strictEqual(senderPayload.color, controllerPayload.color);
            assert.strictEqual(senderPayload.color, displayPayload.color);

            const secondResult = await new Promise<any>((resolve) => {
                commandHandler.updateMouseCursor('controller_sender', {
                    socketId: 'controller_sender',
                    userId: 'testuser',
                    data: { x: 120, y: 240 },
                }, (err, res) => {
                    resolve({ err, res });
                });
            });
            assert.strictEqual(secondResult.err, null);

            const senderMessages = (sender as any).sentMessages
                .map((raw: string) => {
                    return JSON.parse(raw);
                })
                .filter((message: any) => {
                    return message.method === Command.UpdateMouseCursor;
                });
            assert.ok(senderMessages.length >= 2);
            const lastPayload = senderMessages[senderMessages.length - 1].params;
            assert.strictEqual(lastPayload.color, senderPayload.color);
        });

        it('異なる同時接続セッションには重複しない色が割り当てられること', async () => {
            await sessionManager.createSession('controller_a', 'user_a', UserRole.MEMBER);
            await sessionManager.createSession('controller_b', 'user_b', UserRole.MEMBER);

            const clientA = createMockClient('controller_a');
            const clientB = createMockClient('controller_b');
            clients.add(clientA);
            clients.add(clientB);

            const resultA = await new Promise<any>((resolve) => {
                commandHandler.updateMouseCursor('controller_a', {
                    socketId: 'controller_a',
                    userId: 'user_a',
                    data: { x: 10, y: 20 },
                }, (err, res) => {
                    resolve({ err, res });
                });
            });
            const resultB = await new Promise<any>((resolve) => {
                commandHandler.updateMouseCursor('controller_b', {
                    socketId: 'controller_b',
                    userId: 'user_b',
                    data: { x: 30, y: 40 },
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.strictEqual(resultA.err, null);
            assert.strictEqual(resultB.err, null);

            const messagesA = (clientA as any).sentMessages
                .map((raw: string) => {
                    return JSON.parse(raw);
                })
                .filter((message: any) => {
                    return message.method === Command.UpdateMouseCursor && message.params.socketId === 'controller_a';
                });
            const messagesB = (clientB as any).sentMessages
                .map((raw: string) => {
                    return JSON.parse(raw);
                })
                .filter((message: any) => {
                    return message.method === Command.UpdateMouseCursor && message.params.socketId === 'controller_b';
                });

            assert.ok(messagesA.length >= 1);
            assert.ok(messagesB.length >= 1);

            const colorA = messagesA[messagesA.length - 1].params.color;
            const colorB = messagesB[messagesB.length - 1].params.color;

            assert.ok(/^#[0-9a-fA-F]{6}$/.test(colorA));
            assert.ok(/^#[0-9a-fA-F]{6}$/.test(colorB));
            assert.notStrictEqual(colorA, colorB);
        });

        it('未ログインコントローラはエラーになること', async () => {
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateMouseCursor('no_session', {
                    socketId: 'no_session',
                    userId: 'unknown',
                    data: { x: 1, y: 2 },
                }, (err, res) => {
                    resolve({ err, res });
                });
            });

            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32001);
        });
    });

    // -----------------------------------------------------------------------
    // サムネイル
    // -----------------------------------------------------------------------

    describe('getThumbnail', () => {
        it('未ログインはエラーになること', async () => {
            const result = await new Promise<any>((resolve) => {
                commandHandler.getThumbnail('no_session', { metadataId: 'any' }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32001);
        });

        it('存在しないサムネイルはエラーになること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.getThumbnail('socket123', { metadataId: 'nonexistent' }, (err, res, binary) => resolve({ err, res, binary }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32060);
        });

        it('metadataIdが欠けている場合はバリデーションエラーになること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.getThumbnail('socket123', {}, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32061);
        });
    });

    describe('updateThumbnail', () => {
        it('未ログインはエラーになること', async () => {
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateThumbnail('no_session', {
                    metaData: { metadataId: 'any' },
                    contentData: Buffer.from('png'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32001);
        });

        it('metadataIdが欠けている場合はバリデーションエラーになること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateThumbnail('socket123', {
                    metaData: {},
                    contentData: Buffer.from('png'),
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32062);
        });

        it('バイナリが欠けている場合はバリデーションエラーになること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const result = await new Promise<any>((resolve) => {
                commandHandler.updateThumbnail('socket123', {
                    metaData: { metadataId: 'meta-001' },
                    contentData: null,
                }, (err, res) => resolve({ err, res }));
            });
            assert.ok(result.err);
            assert.strictEqual(result.err.code, -32063);
        });

        it('サムネイルを保存でき、その後 getThumbnail で取得できること', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);
            const fakePng = Buffer.from('fake-png-data');

            const updateResult = await new Promise<any>((resolve) => {
                commandHandler.updateThumbnail('socket123', {
                    metaData: { metadataId: 'meta-thumbnail-test' },
                    contentData: fakePng,
                }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(updateResult.err, null);
            assert.strictEqual(updateResult.res.success, true);

            const getResult = await new Promise<any>((resolve) => {
                commandHandler.getThumbnail('socket123', { metadataId: 'meta-thumbnail-test' }, (err, res, binary) => resolve({ err, res, binary }));
            });
            assert.strictEqual(getResult.err, null);
            assert.ok(getResult.binary);
            assert.deepStrictEqual(getResult.binary, fakePng);
        });
    });

    describe('addContent (IMAGE自動サムネイル生成)', () => {
        it('IMAGEタイプ追加後にサーバー側でサムネイルが自動生成されないこと（クライアント側で生成する設計）', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            // 最小限の有効なPNGバイナリを生成
            const sharp = (await import('sharp')).default;
            const pngBuffer = await sharp({
                create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 0, b: 0 } },
            }).png().toBuffer();

            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'image', posx: 0, posy: 0, width: 64, height: 64, mime: 'image/png' },
                    contentData: pngBuffer,
                }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(addResult.err, null);
            const metadataId = addResult.res.metadataId;

            // 少し待ってから確認
            await new Promise(r => setTimeout(r, 300));

            // IMAGEサムネイルはクライアント側で生成するため、サーバー側では自動生成されない
            const getResult = await new Promise<any>((resolve) => {
                commandHandler.getThumbnail('socket123', { metadataId }, (err, res, binary) => resolve({ err, res, binary }));
            });
            assert.ok(getResult.err, 'IMAGEコンテンツ追加直後はサムネイルが未登録であること');
            assert.strictEqual(getResult.err.code, -32060);
        });

        it('IMAGE以外（text）タイプ追加後も自動サムネイルが生成されないこと', async () => {
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            const text = Buffer.from(JSON.stringify({ type: 'text', value: 'hello', fontSize: 32 }));
            const addResult = await new Promise<any>((resolve) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: 'text', posx: 0, posy: 0, width: 200, height: 50 },
                    contentData: text,
                }, (err, res) => resolve({ err, res }));
            });
            assert.strictEqual(addResult.err, null);
            const metadataId = addResult.res.metadataId;

            await new Promise(r => setTimeout(r, 300));

            const getResult = await new Promise<any>((resolve) => {
                commandHandler.getThumbnail('socket123', { metadataId }, (err, res, binary) => resolve({ err, res, binary }));
            });
            // textタイプはサムネイルが自動生成されない → エラーになること
            assert.ok(getResult.err);
            assert.strictEqual(getResult.err.code, -32060);
        });
    });

    // ========================================
    // Site 管理
    // ========================================

    describe('Site管理', () => {
        describe('getSite', () => {
            it('レスポンスに displaySpace フィールドが含まれること', async () => {
                await commandHandler.login('socket_admin', { id: 'admin', password: 'admin123' }, () => { });
                const site = await siteService.createSite({ siteName: 'Test Site' });

                const result = await new Promise<any>((resolve) => {
                    commandHandler.getSite('socket_admin', { siteId: site.siteId }, (err, res) => {
                        resolve({ err, res });
                    });
                });

                assert.strictEqual(result.err, null);
                assert.ok(result.res.displaySpace, 'displaySpace フィールドが存在すること');
                assert.ok(typeof result.res.displaySpace.virtualWidth === 'number');
                assert.ok(typeof result.res.displaySpace.virtualHeight === 'number');
                assert.ok(typeof result.res.displaySpace.splitX === 'number');
                assert.ok(typeof result.res.displaySpace.splitY === 'number');
            });

            it('displaySpace 更新後に getSite で最新の値が返ること', async () => {
                await commandHandler.login('socket_admin', { id: 'admin', password: 'admin123' }, () => { });
                const site = await siteService.createSite({ siteName: 'Updated DS Site' });

                await siteService.updateDisplaySpace(site.siteId, {
                    virtualWidth: 7680,
                    virtualHeight: 4320,
                    splitX: 2,
                    splitY: 2,
                    scale: 1.0,
                });

                const result = await new Promise<any>((resolve) => {
                    commandHandler.getSite('socket_admin', { siteId: site.siteId }, (err, res) => {
                        resolve({ err, res });
                    });
                });

                assert.strictEqual(result.err, null);
                assert.strictEqual(result.res.displaySpace.virtualWidth, 7680);
                assert.strictEqual(result.res.displaySpace.splitX, 2);
            });
        });

        describe('getSiteList', () => {
            it('各 Site に displaySpace フィールドが含まれること', async () => {
                await commandHandler.login('socket_admin', { id: 'admin', password: 'admin123' }, () => { });
                await siteService.createSite({ siteName: 'Site A' });
                await siteService.createSite({ siteName: 'Site B' });

                const result = await new Promise<any>((resolve) => {
                    commandHandler.getSiteList('socket_admin', {}, (err, res) => {
                        resolve({ err, res });
                    });
                });

                assert.strictEqual(result.err, null);
                const sites = result.res.sites;
                assert.ok(Array.isArray(sites));
                assert.ok(sites.length >= 2);
                for (const s of sites) {
                    assert.ok(s.displaySpace, `Site ${s.siteId} に displaySpace が含まれること`);
                    assert.ok(typeof s.displaySpace.virtualWidth === 'number');
                }
            });
        });

        describe('updateSite', () => {
            it('color を指定して更新でき、レスポンスに color と displaySpace が含まれること', async () => {
                await commandHandler.login('socket_admin', { id: 'admin', password: 'admin123' }, () => { });
                const site = await siteService.createSite({ siteName: 'Rainbow' });

                const result = await new Promise<any>((resolve) => {
                    commandHandler.updateSite('socket_admin', {
                        siteId: site.siteId,
                        color: '#00ff88',
                    }, (err, res) => {
                        resolve({ err, res });
                    });
                });

                assert.strictEqual(result.err, null);
                assert.strictEqual(result.res.color, '#00ff88');
                assert.ok(result.res.displaySpace, 'displaySpace フィールドが存在すること');
            });

            it('Admin以外は updateSite できないこと', async () => {
                await commandHandler.login('socket_member', { id: 'testuser', password: 'password123' }, () => { });
                const site = await siteService.createSite({ siteName: 'Protected' });

                const result = await new Promise<any>((resolve) => {
                    commandHandler.updateSite('socket_member', {
                        siteId: site.siteId,
                        color: '#ffffff',
                    }, (err, res) => {
                        resolve({ err, res });
                    });
                });

                assert.ok(result.err);
                assert.strictEqual(result.err.code, -32002);
            });
        });
    });
});
