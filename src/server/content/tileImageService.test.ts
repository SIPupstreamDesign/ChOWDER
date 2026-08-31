/**
 * tileImageService テスト
 *
 * - SegmentReceiver: セグメント分割・再合成
 * - TileImageService: Redis への保存・取得
 *
 * NOTE: sharp を使うタイル生成は Worker Thread 経由のため、
 *       ここでは generateTiles() のスモークテストのみ行う。
 *       実際のタイル生成は統合テスト（Docker環境）で確認すること。
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { SegmentReceiver, TileImageService } from './tileImageService';
import type { TileimageSegmentParams } from './tileImageService';
import { createTestRedis, cleanupTestRedis } from '../tests/setup';
import { REDIS_KEYS } from '../common/redisKeys';

// ---------------------------------------------------------------------------
// SegmentReceiver テスト
// ---------------------------------------------------------------------------

describe('SegmentReceiver', () => {
    let receiver: SegmentReceiver;

    beforeEach(() => {
        receiver = new SegmentReceiver();
    });

    it('セグメントが1つだけの場合、そのまま結合したBufferを返すこと', () => {
        const params: TileimageSegmentParams = {
            file_ext: 'jpg',
            id: 'seg-test-1',
            metadataId: 'meta-001',
            creator: 'user1',
            byteLength: 100,
            segment_max: 1,
            segment_index: 0,
        };
        const data = Buffer.from([1, 2, 3, 4, 5]);
        const result = receiver.receive(params, data, 'socket-1');

        assert.ok(result !== null, '1セグメントで null が返ってきた');
        assert.deepStrictEqual(result, data);
    });

    it('複数セグメントが揃ったときに結合したBufferを返すこと', () => {
        const imageId = 'seg-test-2';
        const socket = 'socket-2';
        const make = (idx: number): TileimageSegmentParams => ({
            file_ext: 'jpg',
            id: imageId,
            metadataId: 'meta-002',
            creator: 'user1',
            byteLength: 9,
            segment_max: 3,
            segment_index: idx,
        });

        const seg0 = Buffer.from([0, 1, 2]);
        const seg1 = Buffer.from([3, 4, 5]);
        const seg2 = Buffer.from([6, 7, 8]);

        assert.strictEqual(receiver.receive(make(0), seg0, socket), null, 'seg0で合体しないはず');
        assert.strictEqual(receiver.receive(make(1), seg1, socket), null, 'seg1で合体しないはず');

        const result = receiver.receive(make(2), seg2, socket);
        assert.ok(result !== null, '最後のセグメントでnullのまま');
        assert.deepStrictEqual(result, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8]));
    });

    it('順不同でセグメントが届いても正しく結合されること', () => {
        const imageId = 'seg-test-3';
        const socket = 'socket-3';
        const make = (idx: number): TileimageSegmentParams => ({
            file_ext: 'jpg',
            id: imageId,
            metadataId: 'meta-003',
            creator: 'user1',
            byteLength: 6,
            segment_max: 3,
            segment_index: idx,
        });

        receiver.receive(make(2), Buffer.from([4, 5]), socket);
        receiver.receive(make(0), Buffer.from([0, 1]), socket);
        const result = receiver.receive(make(1), Buffer.from([2, 3]), socket);

        assert.ok(result !== null);
        assert.deepStrictEqual(result, Buffer.from([0, 1, 2, 3, 4, 5]));
    });

    it('deleteBySocketId でソケットに紐づくコンテナが削除されること', () => {
        const imageId = 'seg-test-4';
        const socket = 'socket-4';
        const make = (idx: number): TileimageSegmentParams => ({
            file_ext: 'jpg',
            id: imageId,
            metadataId: 'meta-004',
            creator: 'user1',
            byteLength: 6,
            segment_max: 2,
            segment_index: idx,
        });

        // seg0 のみ届いた状態
        receiver.receive(make(0), Buffer.from([0, 1, 2]), socket);

        // getPendingMetadataIds で meta-004 が返ること
        const pending = receiver.getPendingMetadataIds(socket);
        assert.ok(pending.includes('meta-004'), 'pending に meta-004 がない');

        // 切断クリーンアップ
        receiver.deleteBySocketId(socket);

        // 削除後は pending が空になること
        const pendingAfter = receiver.getPendingMetadataIds(socket);
        assert.strictEqual(pendingAfter.length, 0);

        // 削除後に残りセグメントを送っても新しいコンテナとして再受信されること
        const result = receiver.receive(make(1), Buffer.from([3, 4, 5]), socket);
        assert.strictEqual(result, null, '削除後の受信は揃わないはず（新コンテナ、seg0欠け）');
    });
});

// ---------------------------------------------------------------------------
// TileImageService - Redis 保存・取得テスト
// ---------------------------------------------------------------------------

describe('TileImageService (Redis)', () => {
    let redis: Redis;
    let service: TileImageService;

    beforeEach(() => {
        redis = createTestRedis();
        service = new TileImageService();
    });    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    it('storeTiles でタイルを保存し、getTile で取得できること', async () => {
        const contentId = 'content-tile-test-1';
        const tile0 = Buffer.from([0xff, 0xd8, 0xaa]); // fake JPEG
        const tile1 = Buffer.from([0xff, 0xd8, 0xbb]);
        const tile2 = Buffer.from([0xff, 0xd8, 0xcc]);
        const tile3 = Buffer.from([0xff, 0xd8, 0xdd]);

        await service.storeTiles(redis, contentId, {
            xsplit: 2,
            ysplit: 2,
            tileSize: 256,
            imgWidth: 512,
            imgHeight: 512,
            reductionWidth: 512,
            reductionHeight: 512,
            tiles: [tile0, tile1, tile2, tile3],
            reduction: Buffer.from([0xfe, 0xdc]),
        });

        // 各タイルが取得できること
        for (let i = 0; i < 4; i++) {
            const got = await service.getTile(redis, contentId, i);
            assert.ok(got !== null, `tile ${i} が null`);
        }

        // 縮小版が content:binary に保存されていること
        const reductionBuf = await redis.getBuffer(REDIS_KEYS.CONTENT.BINARY(contentId));
        assert.ok(reductionBuf !== null, '縮小版バイナリが保存されていない');
        assert.deepStrictEqual(reductionBuf, Buffer.from([0xfe, 0xdc]));
    });

    it('存在しない tileIndex は null を返すこと', async () => {
        const contentId = 'content-tile-test-2';
        const result = await service.getTile(redis, contentId, 999);
        assert.strictEqual(result, null);
    });

    it('deleteIncompleteContent で tile・binary・metadata キーが削除されること', async () => {
        const contentId = 'content-tile-test-3';

        // まず何かデータを入れておく
        await redis.set(REDIS_KEYS.CONTENT.METADATA(contentId), '{"metadataId":"test"}');
        await redis.set(REDIS_KEYS.CONTENT.BINARY(contentId), Buffer.from([0x01]));
        await redis.hset(REDIS_KEYS.CONTENT.TILE_DATA(contentId), '0', Buffer.from([0x02]));

        await service.deleteIncompleteContent(redis, contentId);

        const metaExists = await redis.exists(REDIS_KEYS.CONTENT.METADATA(contentId));
        const binExists = await redis.exists(REDIS_KEYS.CONTENT.BINARY(contentId));
        const tileExists = await redis.exists(REDIS_KEYS.CONTENT.TILE_DATA(contentId));

        assert.strictEqual(metaExists, 0, 'metadata が残っている');
        assert.strictEqual(binExists, 0, 'binary が残っている');
        assert.strictEqual(tileExists, 0, 'tile data が残っている');
    });

    it('コンストラクタに tileSize を渡すと生成時のタイルサイズが変わること（デフォルト256）', () => {
        const defaultService = new TileImageService();
        assert.ok(defaultService instanceof TileImageService);

        const customService = new TileImageService(128);
        assert.ok(customService instanceof TileImageService);
    });
});
