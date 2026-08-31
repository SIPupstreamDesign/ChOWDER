import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SessionManager } from './sessionManager';
import { UserRole } from './authService';

describe('SessionManager', () => {
    let sessionManager: SessionManager;

    beforeEach(() => {
        sessionManager = new SessionManager();
    });

    describe('createSession', () => {
        it('セッションを作成できること', async () => {
            await sessionManager.createSession('socket123', 'user1', UserRole.MEMBER);

            const session = await sessionManager.getSession('socket123');
            assert.ok(session);
            assert.strictEqual(session.userId, 'user1');
            assert.strictEqual(session.role, UserRole.MEMBER);
            assert.ok(session.loginAt);
        });

        it('管理者セッションを作成できること', async () => {
            await sessionManager.createSession('socket456', 'admin', UserRole.ADMIN);

            const session = await sessionManager.getSession('socket456');
            assert.ok(session);
            assert.strictEqual(session.userId, 'admin');
            assert.strictEqual(session.role, UserRole.ADMIN);
        });
    });

    describe('getSession', () => {
        it('存在するセッションを取得できること', async () => {
            await sessionManager.createSession('socket123', 'user1', UserRole.MEMBER);
            const session = await sessionManager.getSession('socket123');

            assert.ok(session);
            assert.strictEqual(session.userId, 'user1');
            assert.strictEqual(session.role, UserRole.MEMBER);
            assert.ok(session.loginAt);
        });

        it('存在しないセッションはnullを返すこと', async () => {
            const session = await sessionManager.getSession('nonexistent');

            assert.strictEqual(session, null);
        });
    });

    describe('removeSession', () => {
        it('セッションを削除できること', async () => {
            await sessionManager.createSession('socket123', 'user1', UserRole.MEMBER);
            await sessionManager.removeSession('socket123');

            const session = await sessionManager.getSession('socket123');
            assert.strictEqual(session, null);
        });

        it('存在しないセッションを削除してもエラーにならないこと', async () => {
            await sessionManager.removeSession('nonexistent');
            // エラーが発生しないことを確認
            assert.ok(true);
        });
    });

    describe('getAllSessions', () => {
        it('全てのセッションを取得できること', async () => {
            await sessionManager.createSession('socket1', 'user1', UserRole.MEMBER);
            await sessionManager.createSession('socket2', 'user2', UserRole.MEMBER);
            await sessionManager.createSession('socket3', 'admin', UserRole.ADMIN);

            const sessions = await sessionManager.getAllSessions();

            assert.strictEqual(sessions.length, 3);
            assert.ok(sessions.some(s => s.userId === 'user1'));
            assert.ok(sessions.some(s => s.userId === 'user2'));
            assert.ok(sessions.some(s => s.userId === 'admin'));
        });

        it('セッションがない場合は空配列を返すこと', async () => {
            const sessions = await sessionManager.getAllSessions();

            assert.strictEqual(sessions.length, 0);
        });
    });

    describe('getSocketIdsByUserId', () => {
        it('指定ユーザーに紐づく全socketIdを取得できること', async () => {
            await sessionManager.createSession('socket1', 'user1', UserRole.MEMBER);
            await sessionManager.createSession('socket2', 'user1', UserRole.MEMBER);
            await sessionManager.createSession('socket3', 'user2', UserRole.MEMBER);

            const socketIds = await sessionManager.getSocketIdsByUserId('user1');

            assert.strictEqual(socketIds.length, 2);
            assert.ok(socketIds.includes('socket1'));
            assert.ok(socketIds.includes('socket2'));
        });

        it('対象ユーザーのセッションがない場合は空配列を返すこと', async () => {
            await sessionManager.createSession('socket1', 'user1', UserRole.MEMBER);

            const socketIds = await sessionManager.getSocketIdsByUserId('user2');

            assert.strictEqual(socketIds.length, 0);
        });
    });

    describe('removeSessionsByUserId', () => {
        it('指定ユーザーの全セッションを削除できること', async () => {
            await sessionManager.createSession('socket1', 'user1', UserRole.MEMBER);
            await sessionManager.createSession('socket2', 'user1', UserRole.MEMBER);
            await sessionManager.createSession('socket3', 'user2', UserRole.MEMBER);

            const removedCount = await sessionManager.removeSessionsByUserId('user1');

            assert.strictEqual(removedCount, 2);
            assert.strictEqual(await sessionManager.getSession('socket1'), null);
            assert.strictEqual(await sessionManager.getSession('socket2'), null);
            assert.ok(await sessionManager.getSession('socket3'));
        });

        it('対象ユーザーのセッションがない場合は0を返すこと', async () => {
            await sessionManager.createSession('socket1', 'user1', UserRole.MEMBER);

            const removedCount = await sessionManager.removeSessionsByUserId('user2');

            assert.strictEqual(removedCount, 0);
            assert.ok(await sessionManager.getSession('socket1'));
        });
    });

    describe('isAuthenticated', () => {
        it('セッションが存在する場合はtrueを返すこと', async () => {
            await sessionManager.createSession('socket123', 'user1', UserRole.MEMBER);
            const result = await sessionManager.isAuthenticated('socket123');

            assert.strictEqual(result, true);
        });

        it('セッションが存在しない場合はfalseを返すこと', async () => {
            const result = await sessionManager.isAuthenticated('nonexistent');

            assert.strictEqual(result, false);
        });
    });

    describe('isAdmin', () => {
        it('管理者セッションの場合はtrueを返すこと', async () => {
            await sessionManager.createSession('socket123', 'admin', UserRole.ADMIN);
            const result = await sessionManager.isAdmin('socket123');

            assert.strictEqual(result, true);
        });

        it('一般ユーザーセッションの場合はfalseを返すこと', async () => {
            await sessionManager.createSession('socket123', 'user1', UserRole.MEMBER);
            const result = await sessionManager.isAdmin('socket123');

            assert.strictEqual(result, false);
        });

        it('セッションが存在しない場合はfalseを返すこと', async () => {
            const result = await sessionManager.isAdmin('nonexistent');

            assert.strictEqual(result, false);
        });
    });
});
