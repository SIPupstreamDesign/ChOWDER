import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { AuthService, UserRole } from '../auth/authService';
import { SessionManager } from '../auth/sessionManager';
import { OtpService } from '../auth/otpService';
import { REDIS_KEYS } from '../common/redisKeys';
import { createTestRedis, cleanupTestRedis } from './setup';

describe('Auth Integration Tests', () => {
    let redis: Redis;
    let authService: AuthService;
    let sessionManager: SessionManager;
    let otpService: OtpService;

    beforeEach(() => {
        redis = createTestRedis();
        authService = new AuthService(redis);
        sessionManager = new SessionManager();
        otpService = new OtpService(redis);
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    describe('初期ユーザー作成からログインまでのフロー', () => {
        it('初期adminユーザーでログインできること', async () => {
            // 初期ユーザー作成
            await authService.initializeDefaultUser();

            // ログイン試行
            const authResult = await authService.authenticate('ChOWDERAdministrator', 'ChOWDERAdministrator');
            assert.strictEqual(authResult.success, true);
            assert.strictEqual(authResult.role, UserRole.ADMIN);

            // セッション作成
            await sessionManager.createSession('socket123', 'ChOWDERAdministrator', authResult.role!);

            // セッション確認
            const session = await sessionManager.getSession('socket123');
            assert.ok(session);
            assert.strictEqual(session.userId, 'ChOWDERAdministrator');
            assert.strictEqual(session.role, UserRole.ADMIN);

            // 認証状態確認
            const isAuth = await sessionManager.isAuthenticated('socket123');
            assert.strictEqual(isAuth, true);

            const isAdmin = await sessionManager.isAdmin('socket123');
            assert.strictEqual(isAdmin, true);
        });
    });

    describe('ユーザー作成からログインまでのフロー', () => {
        it('新規ユーザーを作成してログインできること', async () => {
            // ユーザー作成
            const createSuccess = await authService.createUser('testuser', 'password123', UserRole.MEMBER);
            assert.strictEqual(createSuccess, true);

            // ログイン試行
            const authResult = await authService.authenticate('testuser', 'password123');
            assert.strictEqual(authResult.success, true);
            assert.strictEqual(authResult.role, UserRole.MEMBER);

            // セッション作成
            await sessionManager.createSession('socket456', 'testuser', authResult.role!);

            // セッション確認
            const session = await sessionManager.getSession('socket456');
            assert.ok(session);
            assert.strictEqual(session.userId, 'testuser');
            assert.strictEqual(session.role, UserRole.MEMBER);

            // 認証状態確認
            const isAuth = await sessionManager.isAuthenticated('socket456');
            assert.strictEqual(isAuth, true);

            const isAdmin = await sessionManager.isAdmin('socket456');
            assert.strictEqual(isAdmin, false);
        });
    });

    describe('複数ユーザーのセッション管理', () => {
        it('複数ユーザーが同時にログインできること', async () => {
            // 複数ユーザー作成
            await authService.createUser('user1', 'pass1', UserRole.MEMBER);
            await authService.createUser('user2', 'pass2', UserRole.MEMBER);
            await authService.createUser('admin1', 'adminpass', UserRole.ADMIN);

            // 各ユーザーでログイン
            const auth1 = await authService.authenticate('user1', 'pass1');
            const auth2 = await authService.authenticate('user2', 'pass2');
            const auth3 = await authService.authenticate('admin1', 'adminpass');

            assert.strictEqual(auth1.success, true);
            assert.strictEqual(auth2.success, true);
            assert.strictEqual(auth3.success, true);

            // セッション作成
            await sessionManager.createSession('socket1', 'user1', auth1.role!);
            await sessionManager.createSession('socket2', 'user2', auth2.role!);
            await sessionManager.createSession('socket3', 'admin1', auth3.role!);

            // 全セッション取得
            const allSessions = await sessionManager.getAllSessions();
            assert.strictEqual(allSessions.length, 3);

            // 各ユーザーのセッション確認
            assert.ok(allSessions.some(s => s.userId === 'user1'));
            assert.ok(allSessions.some(s => s.userId === 'user2'));
            assert.ok(allSessions.some(s => s.userId === 'admin1'));

            // Admin権限確認
            assert.strictEqual(await sessionManager.isAdmin('socket1'), false);
            assert.strictEqual(await sessionManager.isAdmin('socket2'), false);
            assert.strictEqual(await sessionManager.isAdmin('socket3'), true);
        });
    });

    describe('ログアウトフロー', () => {
        it('ログアウトするとセッションが削除されること', async () => {
            // ユーザー作成とログイン
            await authService.createUser('testuser', 'password123', UserRole.MEMBER);
            const authResult = await authService.authenticate('testuser', 'password123');
            await sessionManager.createSession('socket123', 'testuser', authResult.role!);

            // ログイン確認
            let isAuth = await sessionManager.isAuthenticated('socket123');
            assert.strictEqual(isAuth, true);

            // ログアウト
            await sessionManager.removeSession('socket123');

            // セッション削除確認
            const session = await sessionManager.getSession('socket123');
            assert.strictEqual(session, null);

            isAuth = await sessionManager.isAuthenticated('socket123');
            assert.strictEqual(isAuth, false);
        });
    });

    describe('権限による操作制限', () => {
        it('一般ユーザーはAdmin権限が必要な操作ができないこと', async () => {
            // 一般ユーザーでログイン
            await authService.createUser('normaluser', 'pass123', UserRole.MEMBER);
            const authResult = await authService.authenticate('normaluser', 'pass123');
            await sessionManager.createSession('socket123', 'normaluser', authResult.role!);

            // Admin権限チェック
            const isAdmin = await sessionManager.isAdmin('socket123');
            assert.strictEqual(isAdmin, false);

            // 一般ユーザーなので、Admin専用の操作は拒否されるべき
            // （実際の操作制限はCommandHandlerで実装されている）
        });

        it('管理者ユーザーはAdmin権限が必要な操作ができること', async () => {
            // 管理者ユーザーでログイン
            await authService.createUser('adminuser', 'adminpass', UserRole.ADMIN);
            const authResult = await authService.authenticate('adminuser', 'adminpass');
            await sessionManager.createSession('socket456', 'adminuser', authResult.role!);

            // Admin権限チェック
            const isAdmin = await sessionManager.isAdmin('socket456');
            assert.strictEqual(isAdmin, true);

            // 管理者なので、新規ユーザー作成が可能
            const createSuccess = await authService.createUser('newuser', 'newpass', UserRole.MEMBER);
            assert.strictEqual(createSuccess, true);
        });
    });

    describe('パスワード変更後の再認証', () => {
        it('パスワード変更後は古いパスワードでログインできないこと', async () => {
            // ユーザー作成
            await authService.createUser('testuser', 'oldpass', UserRole.MEMBER);

            // 古いパスワードでログイン成功
            let authResult = await authService.authenticate('testuser', 'oldpass');
            assert.strictEqual(authResult.success, true);

            // パスワード変更（実装例: ユーザー削除→再作成）
            await redis.del(REDIS_KEYS.AUTH.USER('testuser'));
            await authService.createUser('testuser', 'newpass', UserRole.MEMBER);

            // 古いパスワードでログイン失敗
            authResult = await authService.authenticate('testuser', 'oldpass');
            assert.strictEqual(authResult.success, false);

            // 新しいパスワードでログイン成功
            authResult = await authService.authenticate('testuser', 'newpass');
            assert.strictEqual(authResult.success, true);
        });
    });

    describe('OTPフロー', () => {
        it('ログイン済みユーザーがOTPを発行して別ソケットからログインできること', async () => {
            await authService.createUser('testuser', 'password123', UserRole.MEMBER);

            // 通常ログインでセッション作成
            const authResult = await authService.authenticate('testuser', 'password123');
            await sessionManager.createSession('original_socket', 'testuser', authResult.role!);

            // OTP発行
            const token = await otpService.generateOTP('testuser', UserRole.MEMBER);
            assert.ok(token);
            assert.strictEqual(token.length, 64);

            // 別ソケットからOTPでログイン
            const payload = await otpService.consumeOTP(token);
            assert.ok(payload);
            assert.strictEqual(payload.userId, 'testuser');
            assert.strictEqual(payload.role, UserRole.MEMBER);

            await sessionManager.createSession('new_socket', payload.userId, payload.role);

            // 新しいソケットのセッション確認
            const session = await sessionManager.getSession('new_socket');
            assert.ok(session);
            assert.strictEqual(session.userId, 'testuser');
            assert.strictEqual(session.role, UserRole.MEMBER);

            // 元のソケットも有効なままであること
            const originalSession = await sessionManager.getSession('original_socket');
            assert.ok(originalSession);
        });

        it('OTPはワンタイムであること（2回目は失敗する）', async () => {
            await authService.createUser('testuser', 'password123', UserRole.MEMBER);

            const token = await otpService.generateOTP('testuser', UserRole.MEMBER);

            // 1回目: 成功
            const payload1 = await otpService.consumeOTP(token);
            assert.ok(payload1);

            // 2回目: 失敗
            const payload2 = await otpService.consumeOTP(token);
            assert.strictEqual(payload2, null);
        });

        it('ADMINユーザーのOTPでADMINセッションが引き継がれること', async () => {
            await authService.createUser('adminuser', 'adminpass', UserRole.ADMIN);

            // OTP発行
            const token = await otpService.generateOTP('adminuser', UserRole.ADMIN);

            // OTPでログイン
            const payload = await otpService.consumeOTP(token);
            assert.ok(payload);
            assert.strictEqual(payload.role, UserRole.ADMIN);

            await sessionManager.createSession('new_socket', payload.userId, payload.role);
            const isAdmin = await sessionManager.isAdmin('new_socket');
            assert.strictEqual(isAdmin, true);
        });

        it('無効なOTPトークンではセッションを作成できないこと', async () => {
            const payload = await otpService.consumeOTP('a'.repeat(64));
            assert.strictEqual(payload, null);
        });
    });
});
