import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { OtpService } from './otpService';
import { UserRole } from './authService';
import { REDIS_KEYS } from '../common/redisKeys';
import { createTestRedis, cleanupTestRedis } from '../tests/setup';

describe('OtpService', () => {
    let redis: Redis;
    let otpService: OtpService;

    beforeEach(() => {
        redis = createTestRedis();
        otpService = new OtpService(redis);
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    // ===== generateOTP =====

    describe('generateOTP', () => {
        it('64文字のhexトークンを生成できること', async () => {
            const token = await otpService.generateOTP('user1', UserRole.MEMBER);
            assert.strictEqual(typeof token, 'string');
            assert.strictEqual(token.length, 64);
            assert.match(token, /^[0-9a-f]+$/);
        });

        it('同じ引数で呼んでも毎回異なるトークンが生成されること', async () => {
            const token1 = await otpService.generateOTP('user1', UserRole.MEMBER);
            const token2 = await otpService.generateOTP('user1', UserRole.MEMBER);
            assert.notStrictEqual(token1, token2);
        });

        it('トークンがRedisに保存されること', async () => {
            const token = await otpService.generateOTP('user1', UserRole.MEMBER);
            const key = REDIS_KEYS.OTP.TOKEN(token);
            const raw = await redis.get(key);
            assert.ok(raw, 'Redisにトークンが保存されていること');
            const payload = JSON.parse(raw);
            assert.strictEqual(payload.userId, 'user1');
            assert.strictEqual(payload.role, UserRole.MEMBER);
        });

        it('TTLが設定されていること（60秒以内）', async () => {
            const token = await otpService.generateOTP('user1', UserRole.MEMBER);
            const key = REDIS_KEYS.OTP.TOKEN(token);
            const ttl = await redis.ttl(key);
            assert.ok(ttl > 0, 'TTLが設定されていること');
            assert.ok(ttl <= 60, 'TTLが60秒以内であること');
        });

        it('ADMINロールのトークンを生成できること', async () => {
            const token = await otpService.generateOTP('admin', UserRole.ADMIN);
            const key = REDIS_KEYS.OTP.TOKEN(token);
            const raw = await redis.get(key);
            assert.ok(raw);
            const payload = JSON.parse(raw);
            assert.strictEqual(payload.role, UserRole.ADMIN);
        });
    });

    // ===== consumeOTP =====

    describe('consumeOTP', () => {
        it('有効なトークンでペイロードを取得できること', async () => {
            const token = await otpService.generateOTP('user1', UserRole.MEMBER);
            const payload = await otpService.consumeOTP(token);
            assert.ok(payload);
            assert.strictEqual(payload.userId, 'user1');
            assert.strictEqual(payload.role, UserRole.MEMBER);
        });

        it('ワンタイム保証: 同一トークンを2回使うと2回目はnullを返すこと', async () => {
            const token = await otpService.generateOTP('user1', UserRole.MEMBER);

            const first = await otpService.consumeOTP(token);
            assert.ok(first, '1回目は成功すること');

            const second = await otpService.consumeOTP(token);
            assert.strictEqual(second, null, '2回目はnullを返すこと');
        });

        it('consume後にRedisからトークンが削除されていること', async () => {
            const token = await otpService.generateOTP('user1', UserRole.MEMBER);
            await otpService.consumeOTP(token);

            const key = REDIS_KEYS.OTP.TOKEN(token);
            const raw = await redis.get(key);
            assert.strictEqual(raw, null, 'consume後はRedisから削除されていること');
        });

        it('存在しないトークンに対してnullを返すこと', async () => {
            const result = await otpService.consumeOTP('a'.repeat(64));
            assert.strictEqual(result, null);
        });

        it('空文字列に対してnullを返すこと', async () => {
            const result = await otpService.consumeOTP('');
            assert.strictEqual(result, null);
        });

        it('非string値に対してnullを返すこと', async () => {
            const result = await otpService.consumeOTP(null as any);
            assert.strictEqual(result, null);
        });

        it('複数ユーザーのOTPが独立して管理されること', async () => {
            const token1 = await otpService.generateOTP('alice', UserRole.MEMBER);
            const token2 = await otpService.generateOTP('bob', UserRole.ADMIN);

            const payload1 = await otpService.consumeOTP(token1);
            const payload2 = await otpService.consumeOTP(token2);

            assert.strictEqual(payload1?.userId, 'alice');
            assert.strictEqual(payload2?.userId, 'bob');
            assert.strictEqual(payload2?.role, UserRole.ADMIN);
        });
    });
});
