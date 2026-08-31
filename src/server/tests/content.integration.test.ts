import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { ContentService } from '../content/contentService';
import { ContentType } from '../content/contentTypes';
import { AuthService, UserRole } from '../auth/authService';
import { SessionManager } from '../auth/sessionManager';
import { CommandHandler } from '../websocket/commandHandler';
import { DisplaySessionService } from '../display/displaySessionService';
import { WindowMetaDataService } from '../display/windowMetaDataService';
import { MediaService } from '../media/mediaService';
import { SiteService } from '../site/siteService';
import { LayoutService } from '../layout/layoutService';
import type { ServerConfig } from '../common/serverConfig';
import { createTestRedis, cleanupTestRedis } from './setup';

const TEST_SERVER_CONFIG: ServerConfig = {
    tileImage: {
        widthThreshold: 3840,
        heightThreshold: 2160,
        tileSize: 256,
    },
};

describe('Content Integration Tests - creatorId', () => {
    let redis: Redis;
    let contentService: ContentService;
    let authService: AuthService;
    let sessionManager: SessionManager;
    let commandHandler: CommandHandler;

    beforeEach(async () => {
       redis = createTestRedis();
        contentService = new ContentService(redis);
        authService = new AuthService(redis);
        sessionManager = new SessionManager();

        const displaySessionService = new DisplaySessionService(redis);
        const windowMetaDataService = new WindowMetaDataService(redis);
        const mediaService = new MediaService(redis, contentService, async (_msg) => {});
        const siteService = new SiteService(redis);
        const layoutService = new LayoutService(redis, contentService);

        commandHandler = new CommandHandler(
            sessionManager,
            authService,
            contentService,
            windowMetaDataService,
            displaySessionService,
            mediaService,
            siteService,
            layoutService,
            TEST_SERVER_CONFIG
        );

        // テスト用ユーザーを作成
        await authService.createUser('testuser', 'password123', UserRole.MEMBER);
        await authService.createUser('admin', 'admin', UserRole.ADMIN);
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    describe('AddContent with creatorId', () => {
        it('ログインユーザーがコンテンツを追加すると自動的にcreatorIdが設定されること', (context, done) => {
            //セッション作成（ログイン状態）
            sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER).then(() => {
                console.log('[Test] Session created, calling addContent...');
                // コンテンツ追加
                commandHandler.addContent('socket123', {
                    metaData: {
                        type: ContentType.IMAGE,
                        posx: 0,
                        posy: 0,
                        width: 100,
                        height: 100,
                    },
                    contentData: Buffer.from('test image data'),
                }, (err, result) => {
                    console.log('[Test] Callback received - err:', err, 'result:', result);
                    try {
                        assert.ok(!err, `エラーが発生: ${JSON.stringify(err)}`);
                        assert.ok(result);
                        assert.strictEqual(result.creatorId, 'testuser');
                        assert.strictEqual(result.type, ContentType.IMAGE);
                        done();
                    } catch (e) {
                        console.log('[Test] Assertion failed:', e);
                        done(e);
                    }
                });
            });
        });

        it('未ログイン時はコンテンツ追加が拒否されること', (context, done) => {
            // セッションを作成しない（未ログイン状態）
            commandHandler.addContent('unknown_socket', {
                metaData: {
                    type: ContentType.IMAGE,
                    width: 100,
                    height: 100,
                },
                contentData: Buffer.from('test data'),
            }, (err, result) => {
                try {
                    assert.ok(err, '認証エラーが発生するべき');
                    assert.strictEqual(err.code, -32001);
                    assert.ok(!result);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it('異なるユーザーが追加したコンテンツにはそれぞれのcreatorIdが設定されること', async () => {
            // ユーザー1のセッション
            await sessionManager.createSession('socket1', 'testuser', UserRole.MEMBER);

            // ユーザー2のセッション
            await sessionManager.createSession('socket2', 'admin', UserRole.ADMIN);

            // ユーザー1がコンテンツ追加
            const result1 = await new Promise<any>((resolve, reject) => {
                commandHandler.addContent('socket1', {
                    metaData: {
                        type: ContentType.IMAGE,
                        width: 100,
                        height: 100,
                    },
                    contentData: Buffer.from('user1 data'),
                }, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            // ユーザー2がコンテンツ追加
            const result2 = await new Promise<any>((resolve, reject) => {
                commandHandler.addContent('socket2', {
                    metaData: {
                        type: ContentType.TEXT,
                        width: 200,
                        height: 200,
                    },
                    contentData: Buffer.from('admin data'),
                }, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            assert.strictEqual(result1.creatorId, 'testuser');
            assert.strictEqual(result2.creatorId, 'admin');
        });
    });

    describe('UpdateContent with creatorId protection', () => {
        it('updateMetadataでcreatorIdが変更されないこと', async () => {
            // ログイン
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            // コンテンツ追加
            const added = await new Promise<any>((resolve, reject) => {
                commandHandler.addContent('socket123', {
                    metaData: {
                        type: ContentType.IMAGE,
                        posx: 0,
                        posy: 0,
                        width: 100,
                        height: 100,
                    },
                    contentData: Buffer.from('test data'),
                }, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            // 別のユーザーがログイン
            await sessionManager.createSession('socket456', 'admin', UserRole.ADMIN);

            // 悪意のあるユーザーがcreatorIdを変更しようとする
            const updated = await new Promise<any>((resolve, reject) => {
                commandHandler.updateMetaData('socket456', {
                    metadataId: added.metadataId,
                    creatorId: 'hacker',  // 変更を試みる
                    posx: 100,
                }, (err: any, result: any) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            // creatorIdは元のまま
            assert.strictEqual(updated.creatorId, 'testuser');
            // 他のフィールドは更新される
            assert.strictEqual(updated.posx, 100);
        });
    });

    describe('GetMetaData with creatorId', () => {
        it('取得したメタデータにcreatorIdが含まれること', async () => {
            // ログイン
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            // コンテンツ追加
            const added = await new Promise<any>((resolve, reject) => {
                commandHandler.addContent('socket123', {
                    metaData: {
                        type: ContentType.IMAGE,
                        width: 100,
                        height: 100,
                    },
                    contentData: Buffer.from('test data'),
                }, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            // メタデータ取得
            const metadata = await new Promise<any>((resolve, reject) => {
                commandHandler.getMetaData('socket123', {
                    metadataId: added.metadataId,
                }, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            assert.ok(metadata);
            assert.strictEqual(metadata.metadataId, added.metadataId);
            assert.strictEqual(metadata.creatorId, 'testuser');
        });

        it('全メタデータ取得時にcreatorIdが含まれること', async () => {
            // ログイン
            await sessionManager.createSession('socket123', 'testuser', UserRole.MEMBER);

            // 複数のコンテンツを追加
            await new Promise<void>((resolve, reject) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: ContentType.IMAGE, width: 100, height: 100 },
                    contentData: Buffer.from('data1'),
                }, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            await new Promise<void>((resolve, reject) => {
                commandHandler.addContent('socket123', {
                    metaData: { type: ContentType.TEXT, width: 200, height: 200 },
                    contentData: Buffer.from('data2'),
                }, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // 全メタデータ取得
            const result = await new Promise<any>((resolve, reject) => {
                commandHandler.getMetaData('socket123', {}, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            assert.ok(result.metadataList);
            assert.strictEqual(result.metadataList.length, 2);
            assert.ok(result.metadataList.every((m: any) => m.creatorId === 'testuser'));
        });
    });
});
