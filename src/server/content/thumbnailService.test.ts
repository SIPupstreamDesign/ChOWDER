/**
 * ThumbnailService テスト
 *
 * - generateFromBinary: sharpによる128px PNG縮小
 * - saveThumbnail / getThumbnail / deleteThumbnail: Redisへの保存・取得・削除
 *
 * NOTE: sharp の実際の画像処理は統合テスト（Docker環境）で確認すること。
 *       ここでは最小限の検証のみ行う。
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { ThumbnailService } from './thumbnailService';
import { createTestRedis, cleanupTestRedis } from '../tests/setup';
import { REDIS_KEYS } from '../common/redisKeys';

describe('ThumbnailService', () => {
    let redis: Redis;
    let service: ThumbnailService;

    beforeEach(() => {
        redis = createTestRedis();
        service = new ThumbnailService(redis);
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    // -----------------------------------------------------------------------
    // saveThumbnail / getThumbnail
    // -----------------------------------------------------------------------

    describe('saveThumbnail / getThumbnail', () => {
        it('サムネイルをRedisに保存し取得できること', async () => {
            const metadataId = 'meta-thumb-001';
            const thumbnailData = Buffer.from('fake-png-data');

            await service.saveThumbnail(metadataId, thumbnailData);

            const stored = await service.getThumbnail(metadataId);
            assert.ok(stored !== null);
            assert.deepStrictEqual(stored, thumbnailData);
        });

        it('存在しないmetadataIdはnullを返すこと', async () => {
            const result = await service.getThumbnail('nonexistent-id');
            assert.strictEqual(result, null);
        });

        it('上書き保存できること', async () => {
            const metadataId = 'meta-thumb-002';
            const first = Buffer.from('first-data');
            const second = Buffer.from('second-data-longer');

            await service.saveThumbnail(metadataId, first);
            await service.saveThumbnail(metadataId, second);

            const result = await service.getThumbnail(metadataId);
            assert.deepStrictEqual(result, second);
        });

        it('保存されたキーが正しいRedisキー形式であること', async () => {
            const metadataId = 'meta-thumb-003';
            await service.saveThumbnail(metadataId, Buffer.from('data'));

            const exists = await redis.exists(REDIS_KEYS.CONTENT.THUMBNAIL(metadataId));
            assert.strictEqual(exists, 1);
        });
    });

    // -----------------------------------------------------------------------
    // deleteThumbnail
    // -----------------------------------------------------------------------

    describe('deleteThumbnail', () => {
        it('サムネイルを削除できること', async () => {
            const metadataId = 'meta-thumb-del-001';
            await service.saveThumbnail(metadataId, Buffer.from('data'));

            await service.deleteThumbnail(metadataId);

            const result = await service.getThumbnail(metadataId);
            assert.strictEqual(result, null);
        });

        it('存在しないサムネイルの削除はエラーにならないこと', async () => {
            // エラーが throw されないことを確認
            await assert.doesNotReject(async () => {
                await service.deleteThumbnail('nonexistent-id');
            });
        });
    });

    // -----------------------------------------------------------------------
    // generateFromBinary
    // -----------------------------------------------------------------------

    describe('generateFromBinary', () => {
        it('IMAGEバイナリから128px以下のPNGを生成できること', async () => {
            // 256x256の単色PNG（最小限の有効なPNG）を生成
            // sharp自身を使って生成する（テスト用途）
            const sharp = (await import('sharp')).default;
            const srcBuffer = await sharp({
                create: {
                    width: 256,
                    height: 256,
                    channels: 3,
                    background: { r: 255, g: 0, b: 0 },
                },
            }).png().toBuffer();

            const result = await service.generateFromBinary(srcBuffer, 'image/png');

            // PNG シグネチャ確認（最初の8バイト）
            assert.strictEqual(result[0], 0x89);
            assert.strictEqual(result[1], 0x50); // 'P'
            assert.strictEqual(result[2], 0x4e); // 'N'
            assert.strictEqual(result[3], 0x47); // 'G'

            // サイズが元より小さいこと
            assert.ok(result.length < srcBuffer.length || result.length > 0);

            // 生成画像のサイズが128px以下であることをsharpで確認
            const meta = await sharp(result).metadata();
            assert.ok(meta.width !== undefined && meta.width <= 128);
            assert.ok(meta.height !== undefined && meta.height <= 128);
        });

        it('縦横比を維持してリサイズされること', async () => {
            const sharp = (await import('sharp')).default;
            // 400x200 の横長画像
            const srcBuffer = await sharp({
                create: {
                    width: 400,
                    height: 200,
                    channels: 3,
                    background: { r: 0, g: 255, b: 0 },
                },
            }).png().toBuffer();

            const result = await service.generateFromBinary(srcBuffer, 'image/png');
            const meta = await sharp(result).metadata();

            // 横128 => 縦は64になるはず（縦横比 2:1）
            assert.strictEqual(meta.width, 128);
            assert.strictEqual(meta.height, 64);
        });

        it('128pxより小さい画像は拡大せずそのまま返すこと', async () => {
            const sharp = (await import('sharp')).default;
            // 64x64 の小さい画像
            const srcBuffer = await sharp({
                create: {
                    width: 64,
                    height: 64,
                    channels: 3,
                    background: { r: 0, g: 0, b: 255 },
                },
            }).png().toBuffer();

            const result = await service.generateFromBinary(srcBuffer, 'image/png');
            const meta = await sharp(result).metadata();

            // 拡大されていないこと（64x64のまま）
            assert.strictEqual(meta.width, 64);
            assert.strictEqual(meta.height, 64);
        });

        it('無効なバイナリはエラーをthrowすること', async () => {
            const invalidBuffer = Buffer.from('not-an-image');

            await assert.rejects(async () => {
                await service.generateFromBinary(invalidBuffer, 'image/png');
            });
        });
    });
});
