import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import WebSocket from 'ws';
import { Server } from 'http';
import { WebSocketServer } from 'ws';
import { AuthService, UserRole } from '../auth/authService';
import { createTestRedis, cleanupTestRedis, createTestServer, stopTestServer, sendWSCommand, delay } from './setup';

describe('WebSocket Integration Tests', () => {
    let redis: Redis;
    let httpServer: Server;
    let wss: WebSocketServer;
    let mediaService: any;
    let port: number;
    let authService: AuthService;

    beforeEach(async () => {
        redis = createTestRedis();
        authService = new AuthService(redis);

        // テスト用ユーザーを作成
        await authService.createUser('testuser', 'password123', UserRole.MEMBER);
        await authService.createUser('admin', 'admin123', UserRole.ADMIN);

        // テストサーバー起動
        const server = await createTestServer(redis);
        httpServer = server.httpServer;
        wss = server.wss;
        mediaService = server.mediaService;
        port = server.port;
    });

    afterEach(async () => {
        await stopTestServer(httpServer, wss, mediaService);
        await cleanupTestRedis(redis);
    });

    describe('WebSocket接続', () => {
        it('WebSocketサーバーに接続できること', async () => {
            const ws = new WebSocket(`ws://localhost:${port}`, {
                rejectUnauthorized: false, // 自己署名証明書を許可
            });

            await new Promise<void>((resolve, reject) => {
                ws.on('open', () => {
                    resolve();
                });
                ws.on('error', reject);
            });

            assert.strictEqual(ws.readyState, WebSocket.OPEN);
            ws.close();
        });
    });

    describe('認証フロー', () => {
        it('未ログイン状態では認証が必要なコマンドがエラーになること', async () => {
            const ws = new WebSocket(`ws://localhost:${port}`, { rejectUnauthorized: false });

            await new Promise<void>((resolve) => {
                ws.on('open', () => resolve());
            });

            // 認証なしでコマンド送信
            const response = await sendWSCommand(ws, 'GetLoginUserList', {});

            assert.ok(response.error);
            assert.strictEqual(response.error.code, -32001);
            assert.ok(response.error.message.includes('Authentication required'));

            ws.close();
        });

        it('ログインコマンドでセッションが作成されること', async () => {
            const ws = new WebSocket(`ws://localhost:${port}`, { rejectUnauthorized: false });

            await new Promise<void>((resolve) => {
                ws.on('open', () => resolve());
            });

            // ログイン
            const loginResponse = await sendWSCommand(ws, 'Login', {
                id: 'testuser',
                password: 'password123',
            });

            assert.ok(!loginResponse.error);
            assert.strictEqual(loginResponse.result.success, true);
            assert.strictEqual(loginResponse.result.userId, 'testuser');
            assert.strictEqual(loginResponse.result.role, UserRole.MEMBER);

            ws.close();
        });

        it('間違ったパスワードでログインが失敗すること', async () => {
            const ws = new WebSocket(`ws://localhost:${port}`, { rejectUnauthorized: false });

            await new Promise<void>((resolve) => {
                ws.on('open', () => resolve());
            });

            // 間違ったパスワードでログイン
            const loginResponse = await sendWSCommand(ws, 'Login', {
                id: 'testuser',
                password: 'wrongpassword',
            });

            assert.ok(loginResponse.error);
            assert.strictEqual(loginResponse.error.code, -32004);

            ws.close();
        });
    });

    describe('認証後のコマンド実行', () => {
        it('ログイン後は認証が必要なコマンドを実行できること', async () => {
            const ws = new WebSocket(`ws://localhost:${port}`, { rejectUnauthorized: false });

            await new Promise<void>((resolve) => {
                ws.on('open', () => resolve());
            });

            // ログイン
            await sendWSCommand(ws, 'Login', {
                id: 'testuser',
                password: 'password123',
            });

            // 認証が必要なコマンドを実行
            const response = await sendWSCommand(ws, 'GetLoginUserList', {});

            assert.ok(!response.error);
            assert.ok(response.result);
            assert.ok(Array.isArray(response.result.users));

            ws.close();
        });

        it('複数の認証が必要なコマンドを連続実行できること', async () => {
            const ws = new WebSocket(`ws://localhost:${port}`, { rejectUnauthorized: false });

            await new Promise<void>((resolve) => {
                ws.on('open', () => resolve());
            });

            // ログイン
            await sendWSCommand(ws, 'Login', {
                id: 'testuser',
                password: 'password123',
            });

            // 複数コマンド実行
            const res1 = await sendWSCommand(ws, 'GetSelfStatus', {});
            const res2 = await sendWSCommand(ws, 'AddMetaData', { type: 'test', name: 'test-data' });
            const res3 = await sendWSCommand(ws, 'GetMetaData', { id: 'test-id' });

            assert.ok(!res1.error);
            assert.ok(!res2.error);
            assert.ok(!res3.error);

            ws.close();
        });
    });

    describe('Admin権限のテスト', () => {
        it('管理者はユーザーを作成できること', async () => {
            const ws = new WebSocket(`ws://localhost:${port}`, { rejectUnauthorized: false });

            await new Promise<void>((resolve) => {
                ws.on('open', () => resolve());
            });

            // 管理者でログイン
            await sendWSCommand(ws, 'Login', {
                id: 'admin',
                password: 'admin123',
            });

            // ユーザー作成
            const response = await sendWSCommand(ws, 'CreateUser', {
                id: 'newuser',
                password: 'newpass',
                role: 'member',
            });

            assert.ok(!response.error);
            assert.strictEqual(response.result.success, true);
            assert.strictEqual(response.result.userId, 'newuser');

            // 作成されたユーザーが存在することを確認
            const user = await authService.getUser('newuser');
            assert.ok(user);

            ws.close();
        });

        it('一般ユーザーはユーザーを作成できないこと', async () => {
            const ws = new WebSocket(`ws://localhost:${port}`, { rejectUnauthorized: false });

            await new Promise<void>((resolve) => {
                ws.on('open', () => resolve());
            });

            // 一般ユーザーでログイン
            await sendWSCommand(ws, 'Login', {
                id: 'testuser',
                password: 'password123',
            });

            // ユーザー作成試行
            const response = await sendWSCommand(ws, 'CreateUser', {
                id: 'newuser',
                password: 'newpass',
                role: 'member',
            });

            assert.ok(response.error);
            assert.strictEqual(response.error.code, -32002);
            assert.ok(response.error.message.includes('Permission denied'));

            ws.close();
        });
    });

    describe('ログアウトフロー', () => {
        it('ログアウト後は認証が必要なコマンドがエラーになること', async () => {
            const ws = new WebSocket(`ws://localhost:${port}`, { rejectUnauthorized: false });

            await new Promise<void>((resolve) => {
                ws.on('open', () => resolve());
            });

            // ログイン
            await sendWSCommand(ws, 'Login', {
                id: 'testuser',
                password: 'password123',
            });

            // コマンド実行成功
            const res1 = await sendWSCommand(ws, 'GetLoginUserList', {});
            assert.ok(!res1.error);

            // ログアウト
            const logoutResponse = await sendWSCommand(ws, 'Logout', {});
            assert.ok(!logoutResponse.error);
            assert.strictEqual(logoutResponse.result.success, true);

            // ログアウト後はエラー
            const res2 = await sendWSCommand(ws, 'GetLoginUserList', {});
            assert.ok(res2.error);
            assert.strictEqual(res2.error.code, -32001);

            ws.close();
        });
    });

    describe('WebSocket切断時のセッション削除', () => {
        it('WebSocket切断時にセッションが自動削除されること', async () => {
            const ws = new WebSocket(`ws://localhost:${port}`, { rejectUnauthorized: false });

            await new Promise<void>((resolve) => {
                ws.on('open', () => resolve());
            });

            // ログイン
            const loginResponse = await sendWSCommand(ws, 'Login', {
                id: 'testuser',
                password: 'password123',
            });
            assert.ok(!loginResponse.error);

            // セッション確認（ログインユーザーリストに存在）
            const res1 = await sendWSCommand(ws, 'GetLoginUserList', {});
            assert.strictEqual(res1.result.users.length, 1);

            // WebSocket切断
            ws.close();

            // 少し待つ（セッション削除処理）
            await delay(500);

            // 新しい接続で確認
            const ws2 = new WebSocket(`ws://localhost:${port}`, { rejectUnauthorized: false });
            await new Promise<void>((resolve) => {
                ws2.on('open', () => resolve());
            });

            // 管理者でログイン（ログインユーザーリストを見るため）
            await sendWSCommand(ws2, 'Login', {
                id: 'admin',
                password: 'admin123',
            });

            // セッションリストを確認（前のセッションは削除されているはず）
            const res2 = await sendWSCommand(ws2, 'GetLoginUserList', {});

            // adminのみがログイン中（前のtestuserセッションは削除済み）
            const testuserSessions = res2.result.users.filter((u: any) => u.userId === 'testuser');
            assert.strictEqual(testuserSessions.length, 0);

            ws2.close();
        });
    });

    describe('複数クライアントの同時接続', () => {
        it('複数のクライアントが同時にログインできること', async () => {
            // クライアント1
            const ws1 = new WebSocket(`ws://localhost:${port}`, { rejectUnauthorized: false });
            await new Promise<void>((resolve) => {
                ws1.on('open', () => resolve());
            });
            await sendWSCommand(ws1, 'Login', {
                id: 'testuser',
                password: 'password123',
            });

            // クライアント2
            const ws2 = new WebSocket(`ws://localhost:${port}`, { rejectUnauthorized: false });
            await new Promise<void>((resolve) => {
                ws2.on('open', () => resolve());
            });
            await sendWSCommand(ws2, 'Login', {
                id: 'admin',
                password: 'admin123',
            });

            // 両方のクライアントがコマンドを実行できる
            const res1 = await sendWSCommand(ws1, 'GetSelfStatus', {});
            const res2 = await sendWSCommand(ws2, 'GetSelfStatus', {});

            assert.ok(!res1.error);
            assert.ok(!res2.error);

            // ログインユーザーリストに両方が表示される
            const userListResponse = await sendWSCommand(ws1, 'GetLoginUserList', {});
            assert.strictEqual(userListResponse.result.users.length, 2);

            ws1.close();
            ws2.close();
        });
    });
});
