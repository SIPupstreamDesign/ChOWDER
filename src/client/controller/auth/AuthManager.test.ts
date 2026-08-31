/**
 * AuthManager 単体テスト
 *
 * isAdmin() 純粋関数と AuthManager.login() / logout() の状態遷移を検証する。
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { isAdmin, AuthManager } from './AuthManager';

// ============================================================
// isAdmin 純粋関数のテスト
// ============================================================

describe('isAdmin (純粋関数)', () => {
    it('"admin" は true を返す', () => {
        assert.strictEqual(isAdmin('admin'), true);
    });

    it('"member" は false を返す', () => {
        assert.strictEqual(isAdmin('member'), false);
    });

    it('"guest" は false を返す', () => {
        assert.strictEqual(isAdmin('guest'), false);
    });

    it('null は false を返す', () => {
        assert.strictEqual(isAdmin(null), false);
    });

    it('空文字は false を返す', () => {
        assert.strictEqual(isAdmin(''), false);
    });
});

// ============================================================
// AuthManager クラスのテスト
// ============================================================

describe('AuthManager', () => {
    let sentCommands: { method: string; params: any }[];
    let auth: AuthManager;

    beforeEach(() => {
        sentCommands = [];
        const mockSendCmd = async (method: string, params?: any) => {
            sentCommands.push({ method, params });
            if (method === 'Login') {
                if (params.id === 'admin' && params.password === 'secret') {
                    return { success: true, userId: 'admin', role: 'admin', socketId: 'sock-001' };
                }
                return { success: false };
            }
            if (method === 'Logout') return {};
            if (method === 'CreateUser') {
                return { success: true };
            }
            return {};
        };
        auth = new AuthManager(mockSendCmd, () => {});
    });

    it('初期状態は未認証である', () => {
        assert.strictEqual(auth.isAuthenticated, false);
        assert.strictEqual(auth.currentUser, null);
        assert.strictEqual(auth.currentRole, null);
        assert.strictEqual(auth.socketId, null);
    });

    it('正しい認証情報でログインすると状態が更新される', async () => {
        const result = await auth.login('admin', 'secret');
        assert.strictEqual(result.success, true);
        assert.strictEqual(auth.isAuthenticated, true);
        assert.strictEqual(auth.currentUser, 'admin');
        assert.strictEqual(auth.currentRole, 'admin');
        assert.strictEqual(auth.socketId, 'sock-001');
    });

    it('ログイン後に isAdmin() は true を返す', async () => {
        await auth.login('admin', 'secret');
        assert.strictEqual(auth.isAdmin(), true);
    });

    it('ログアウト後は未認証状態に戻る', async () => {
        await auth.login('admin', 'secret');
        await auth.logout();
        assert.strictEqual(auth.isAuthenticated, false);
        assert.strictEqual(auth.currentUser, null);
        assert.strictEqual(auth.currentRole, null);
        assert.strictEqual(auth.socketId, null);
    });

    it('login() は Login コマンドを送信する', async () => {
        await auth.login('admin', 'secret');
        assert.ok(sentCommands.some((c) => c.method === 'Login'));
    });

    it('logout() は Logout コマンドを送信する', async () => {
        await auth.login('admin', 'secret');
        await auth.logout();
        assert.ok(sentCommands.some((c) => c.method === 'Logout'));
    });

    it('createUser() は CreateUser コマンドを送信する', async () => {
        await auth.createUser('newuser', 'pass', 'member');
        assert.ok(sentCommands.some((c) => c.method === 'CreateUser'));
        const cmd = sentCommands.find((c) => c.method === 'CreateUser');
        assert.strictEqual(cmd?.params.id, 'newuser');
        assert.strictEqual(cmd?.params.role, 'member');
    });
});
