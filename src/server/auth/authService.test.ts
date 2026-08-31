import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { AuthService, UserRole } from './authService';
import { createTestRedis, cleanupTestRedis } from '../tests/setup';
import { REDIS_KEYS } from '../common/redisKeys';

describe('AuthService', () => {
    let redis: Redis;
    let authService: AuthService;

    beforeEach(() => {
        redis = createTestRedis();
        authService = new AuthService(redis);
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    describe('hashPassword', () => {
        it('パスワードをハッシュ化できること', async () => {
            const password = 'testpassword123';
            const hash = await authService.hashPassword(password);

            assert.ok(hash);
            assert.notStrictEqual(hash, password);
            assert.ok(hash.startsWith('$2'));
        });

        it('同じパスワードでも異なるハッシュが生成されること（Salt）', async () => {
            const password = 'testpassword123';
            const hash1 = await authService.hashPassword(password);
            const hash2 = await authService.hashPassword(password);

            assert.notStrictEqual(hash1, hash2);
        });
    });

    describe('verifyPassword', () => {
        it('正しいパスワードで検証が成功すること', async () => {
            const password = 'testpassword123';
            const hash = await authService.hashPassword(password);
            const result = await authService.verifyPassword(password, hash);

            assert.strictEqual(result, true);
        });

        it('間違ったパスワードで検証が失敗すること', async () => {
            const password = 'testpassword123';
            const wrongPassword = 'wrongpassword';
            const hash = await authService.hashPassword(password);
            const result = await authService.verifyPassword(wrongPassword, hash);

            assert.strictEqual(result, false);
        });
    });

    describe('createUser', () => {
        it('新しいユーザーを作成できること', async () => {
            const success = await authService.createUser('testuser', 'password123', UserRole.MEMBER);

            assert.strictEqual(success, true);

            // Redisに保存されているか確認
            const userData = await redis.hgetall(REDIS_KEYS.AUTH.USER('testuser'));
            assert.ok(userData.password);
            assert.strictEqual(userData.role, UserRole.MEMBER);
            assert.ok(userData.createdAt);
        });

        it('管理者ユーザーを作成できること', async () => {
            const success = await authService.createUser('admin', 'admin123', UserRole.ADMIN);

            assert.strictEqual(success, true);

            const userData = await redis.hgetall(REDIS_KEYS.AUTH.USER('admin'));
            assert.strictEqual(userData.role, UserRole.ADMIN);
        });

        it('既に存在するユーザーは作成できないこと', async () => {
            await authService.createUser('testuser', 'password123', UserRole.MEMBER);
            const success = await authService.createUser('testuser', 'password456', UserRole.MEMBER);

            assert.strictEqual(success, false);
        });
    });

    describe('getUser', () => {
        it('存在するユーザー情報を取得できること', async () => {
            await authService.createUser('testuser', 'password123', UserRole.MEMBER);
            const user = await authService.getUser('testuser');

            assert.ok(user);
            assert.ok(user.password);
            assert.strictEqual(user.role, UserRole.MEMBER);
            assert.ok(user.createdAt);
        });

        it('存在しないユーザーはnullを返すこと', async () => {
            const user = await authService.getUser('nonexistent');

            assert.strictEqual(user, null);
        });
    });

    describe('authenticate', () => {
        beforeEach(async () => {
            await authService.createUser('testuser', 'password123', UserRole.MEMBER);
        });

        it('正しい認証情報でログインできること', async () => {
            const result = await authService.authenticate('testuser', 'password123');

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.role, UserRole.MEMBER);
        });

        it('間違ったパスワードでログイン失敗すること', async () => {
            const result = await authService.authenticate('testuser', 'wrongpassword');

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.role, undefined);
        });

        it('存在しないユーザーでログイン失敗すること', async () => {
            const result = await authService.authenticate('nonexistent', 'password123');

            assert.strictEqual(result.success, false);
        });
    });

    describe('initializeDefaultUser', () => {
        it('初回実行時にデフォルトユーザーが作成されること', async () => {
            await authService.initializeDefaultUser();

            const user = await authService.getUser('ChOWDERAdministrator');
            assert.ok(user);
            assert.strictEqual(user.role, UserRole.ADMIN);

            // パスワードが"ChOWDERAdministrator"であることを確認
            const authResult = await authService.authenticate('ChOWDERAdministrator', 'ChOWDERAdministrator');
            assert.strictEqual(authResult.success, true);

            // member は初期ユーザーとして自動作成されない
            const memberAuthResult = await authService.authenticate('member', 'member');
            assert.strictEqual(memberAuthResult.success, false);

            const bootstrapInitialized = await authService.isBootstrapInitialized();
            assert.strictEqual(bootstrapInitialized, true);
        });

        it('既存ユーザーがある場合はデフォルトユーザーを再生成せずフラグのみ設定すること', async () => {
            await authService.createUser('custom_admin', 'custompassword', UserRole.ADMIN);
            await authService.initializeDefaultUser();

            const authResult = await authService.authenticate('custom_admin', 'custompassword');
            assert.strictEqual(authResult.success, true);

            const authResultDefault = await authService.authenticate('ChOWDERAdministrator', 'ChOWDERAdministrator');
            assert.strictEqual(authResultDefault.success, false);

            const bootstrapInitialized = await authService.isBootstrapInitialized();
            assert.strictEqual(bootstrapInitialized, true);
        });

        it('一度初期化された後はデフォルト管理者を削除しても再起動時に復活しないこと', async () => {
            await authService.initializeDefaultUser();

            const deleted = await authService.deleteUser('ChOWDERAdministrator');
            assert.strictEqual(deleted, true);

            await authService.initializeDefaultUser();

            const adminUser = await authService.getUser('ChOWDERAdministrator');
            assert.strictEqual(adminUser, null);
        });
    });
});
