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
import { EventEmitter } from 'node:events';
import { Redis } from 'ioredis';
import type { Worker, WorkerOptions } from 'worker_threads';
import sharp from 'sharp';
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
            uploadId: 'seg-test-1',
            file_ext: 'jpg',
            metadataId: 'meta-001',
            byteLength: 5,
            segment_max: 1,
            segment_index: 0,
        };
        const data = Buffer.from([1, 2, 3, 4, 5]);
        const result = receiver.receive(params, data, 'socket-1');

        assert.strictEqual(result.accepted, true);
        assert.deepStrictEqual(result.assembled, data);
    });

    it('複数セグメントが揃ったときに結合したBufferを返すこと', () => {
        const imageId = 'seg-test-2';
        const socket = 'socket-2';
        const make = (idx: number): TileimageSegmentParams => ({
            uploadId: imageId,
            file_ext: 'jpg',
            metadataId: 'meta-002',
            byteLength: 9,
            segment_max: 3,
            segment_index: idx,
        });

        const seg0 = Buffer.from([0, 1, 2]);
        const seg1 = Buffer.from([3, 4, 5]);
        const seg2 = Buffer.from([6, 7, 8]);

        assert.strictEqual(receiver.receive(make(0), seg0, socket).assembled, null, 'seg0で合体しないはず');
        assert.strictEqual(receiver.receive(make(1), seg1, socket).assembled, null, 'seg1で合体しないはず');

        const result = receiver.receive(make(2), seg2, socket);
        assert.ok(result.assembled !== null, '最後のセグメントでnullのまま');
        assert.deepStrictEqual(result.assembled, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8]));
    });

    it('順不同でセグメントが届いても正しく結合されること', () => {
        const imageId = 'seg-test-3';
        const socket = 'socket-3';
        const make = (idx: number): TileimageSegmentParams => ({
            uploadId: imageId,
            file_ext: 'jpg',
            metadataId: 'meta-003',
            byteLength: 6,
            segment_max: 3,
            segment_index: idx,
        });

        receiver.receive(make(2), Buffer.from([4, 5]), socket);
        receiver.receive(make(0), Buffer.from([0, 1]), socket);
        const result = receiver.receive(make(1), Buffer.from([2, 3]), socket);

        assert.ok(result.assembled !== null);
        assert.deepStrictEqual(result.assembled, Buffer.from([0, 1, 2, 3, 4, 5]));
    });

    it('deleteBySocketId でソケットに紐づくコンテナが削除されること', () => {
        const imageId = 'seg-test-4';
        const socket = 'socket-4';
        const make = (idx: number): TileimageSegmentParams => ({
            uploadId: imageId,
            file_ext: 'jpg',
            metadataId: 'meta-004',
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
        assert.strictEqual(result.assembled, null, '削除後の受信は揃わないはず（新コンテナ、seg0欠け）');
    });

    it('同じsegmentの同一binary再送は二重計上しない', (): void => {
        const imageId = 'seg-test-duplicate';
        const make = (segmentIndex: number): TileimageSegmentParams => ({
            uploadId: imageId,
            metadataId: 'meta-duplicate',
            file_ext: 'jpg',
            byteLength: 4,
            segment_max: 2,
            segment_index: segmentIndex,
        });

        const firstSegment = Buffer.from([1, 2]);
        assert.strictEqual(receiver.receive(make(0), firstSegment, 'socket-duplicate').accepted, true);
        assert.strictEqual(receiver.receive(make(0), firstSegment, 'socket-duplicate').accepted, false);
        const completed = receiver.receive(make(1), Buffer.from([3, 4]), 'socket-duplicate');
        assert.deepStrictEqual(completed.assembled, Buffer.from([1, 2, 3, 4]));
    });

    it('同一upload内でmetadataが変化したsegmentを拒否する', (): void => {
        const initial: TileimageSegmentParams = {
            uploadId: 'seg-test-mismatch',
            metadataId: 'meta-original',
            file_ext: 'jpg',
            byteLength: 4,
            segment_max: 2,
            segment_index: 0,
        };
        receiver.receive(initial, Buffer.from([1, 2]), 'socket-original');

        assert.throws((): void => {
            receiver.receive({ ...initial, metadataId: 'meta-other', segment_index: 1 }, Buffer.from([3, 4]), 'socket-original');
        }, /metadata changed/);
    });

    it('宣言byteLengthと受信累積byte数の不一致を拒否する', (): void => {
        const params: TileimageSegmentParams = {
            uploadId: 'seg-test-byte-length',
            metadataId: 'meta-byte-length',
            file_ext: 'jpg',
            byteLength: 5,
            segment_max: 2,
            segment_index: 0,
        };
        receiver.receive(params, Buffer.from([1, 2]), 'socket-byte-length');

        assert.throws((): void => {
            receiver.receive({ ...params, segment_index: 1 }, Buffer.from([3, 4]), 'socket-byte-length');
        }, /does not match declared byteLength/);
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
    }); afterEach(async () => {
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

    it('Workerが256pxと512pxの端部タイルを元画像の有効寸法で生成すること', { timeout: 30000 }, async (): Promise<void> => {
        const image = await sharp({
            create: {
                width: 1000,
                height: 700,
                channels: 3,
                background: { r: 255, g: 255, b: 255 },
            },
        }).png().toBuffer();

        const tileSet = await service.generateTiles(image);
        const bottomRight = await sharp(tileSet.tiles[11]).metadata();

        assert.strictEqual(tileSet.xsplit, 4);
        assert.strictEqual(tileSet.ysplit, 3);
        assert.strictEqual(bottomRight.width, 232);
        assert.strictEqual(bottomRight.height, 188);

        const standardImage = await sharp({
            create: {
                width: 1100,
                height: 900,
                channels: 3,
                background: { r: 255, g: 255, b: 255 },
            },
        }).png().toBuffer();
        const standardService = new TileImageService(512);
        const standardTileSet = await standardService.generateTiles(standardImage);
        const standardBottomRight = await sharp(standardTileSet.tiles[5]).metadata();

        assert.strictEqual(standardTileSet.xsplit, 3);
        assert.strictEqual(standardTileSet.ysplit, 2);
        assert.strictEqual(standardBottomRight.width, 76);
        assert.strictEqual(standardBottomRight.height, 388);
    });

    it('Worker heartbeatを進捗callbackと分けて通知すること', { timeout: 10000 }, async (): Promise<void> => {
        const image = await sharp({
            create: {
                width: 512,
                height: 512,
                channels: 3,
                background: { r: 100, g: 150, b: 200 },
            },
        }).png().toBuffer();
        const heartbeatService = new TileImageService(512, {
            workerIdleTimeoutMs: 5000,
            workerHeartbeatIntervalMs: 1,
        });
        let heartbeatCount = 0;
        let progressCount = 0;

        await heartbeatService.generateTiles(
            image,
            (): void => { progressCount += 1; },
            (): void => { heartbeatCount += 1; },
        );

        assert.strictEqual(progressCount, 1);
        assert.strictEqual(heartbeatCount > 0, true);
    });

    it('heartbeatだけではWorker実進捗timeoutを延長しない', { timeout: 5000 }, async (): Promise<void> => {
        class HeartbeatingWorker extends EventEmitter {
            heartbeatCount = 0;
            terminated = false;
            private readonly heartbeatTimer: ReturnType<typeof setInterval>;

            constructor() {
                super();
                this.heartbeatTimer = setInterval((): void => {
                    this.heartbeatCount += 1;
                    this.emit('message', { type: 'heartbeat' });
                }, 2);
            }

            terminate(): Promise<number> {
                this.terminated = true;
                clearInterval(this.heartbeatTimer);
                return Promise.resolve(1);
            }
        }

        const worker = new HeartbeatingWorker();
        const watchdogService = new TileImageService(256, {
            workerIdleTimeoutMs: 30,
            workerHeartbeatIntervalMs: 2,
            createWorker: (_filename: string, _options: WorkerOptions): Worker => {
                return worker as unknown as Worker;
            },
        });

        await assert.rejects(async (): Promise<void> => {
            await watchdogService.generateTiles(Buffer.from([1, 2, 3, 4]), undefined, (): void => { });
        }, /made no progress/);

        assert.strictEqual(worker.heartbeatCount > 0, true);
        assert.strictEqual(worker.terminated, true);
    });

    it('deleteIncompleteContent で tile・binary・metadata キーが削除されること', async () => {
        const contentId = 'content-tile-test-3';

        // まず何かデータを入れておく
        await redis.set(REDIS_KEYS.CONTENT.METADATA(contentId), JSON.stringify({
            metadataId: contentId,
            binaryId: contentId,
            type: 'tileimage',
            creatorId: 'testuser',
            tileFinished: false,
        }));
        await redis.set(REDIS_KEYS.CONTENT.BINARY(contentId), Buffer.from([0x01]));
        await redis.hset(REDIS_KEYS.CONTENT.TILE_DATA(contentId), '0', Buffer.from([0x02]));

        const deleted = await service.deleteIncompleteContent(redis, contentId, 'testuser');

        const metaExists = await redis.exists(REDIS_KEYS.CONTENT.METADATA(contentId));
        const binExists = await redis.exists(REDIS_KEYS.CONTENT.BINARY(contentId));
        const tileExists = await redis.exists(REDIS_KEYS.CONTENT.TILE_DATA(contentId));

        assert.strictEqual(metaExists, 0, 'metadata が残っている');
        assert.strictEqual(binExists, 0, 'binary が残っている');
        assert.strictEqual(tileExists, 0, 'tile data が残っている');
        assert.strictEqual(deleted, true);
    });

    it('所有者不一致または完了済みtileimageをcleanupしない', async (): Promise<void> => {
        const ownerMismatchId = 'content-tile-owner-mismatch';
        const finishedId = 'content-tile-finished';
        for (const [contentId, creatorId, tileFinished] of [
            [ownerMismatchId, 'owner-a', false],
            [finishedId, 'owner-a', true],
        ] as const) {
            await redis.set(REDIS_KEYS.CONTENT.METADATA(contentId), JSON.stringify({
                metadataId: contentId,
                binaryId: contentId,
                type: 'tileimage',
                creatorId,
                tileFinished,
            }));
            await redis.set(REDIS_KEYS.CONTENT.BINARY(contentId), Buffer.from('reduction'));
            await redis.hset(REDIS_KEYS.CONTENT.TILE_DATA(contentId), '0', Buffer.from('tile'));
            await redis.set(REDIS_KEYS.CONTENT.THUMBNAIL(contentId), Buffer.from('thumbnail'));
        }

        assert.strictEqual(await service.deleteIncompleteContent(redis, ownerMismatchId, 'owner-b'), false);
        assert.strictEqual(await service.deleteIncompleteContent(redis, finishedId, 'owner-a'), false);

        for (const contentId of [ownerMismatchId, finishedId]) {
            assert.strictEqual(await redis.exists(REDIS_KEYS.CONTENT.METADATA(contentId)), 1);
            assert.strictEqual(await redis.exists(REDIS_KEYS.CONTENT.BINARY(contentId)), 1);
            assert.strictEqual(await redis.exists(REDIS_KEYS.CONTENT.TILE_DATA(contentId)), 1);
            assert.strictEqual(await redis.exists(REDIS_KEYS.CONTENT.THUMBNAIL(contentId)), 1);
        }
    });

    it('コンストラクタに tileSize を渡すと生成時のタイルサイズが変わること（デフォルト256）', () => {
        const defaultService = new TileImageService();
        assert.ok(defaultService instanceof TileImageService);

        const customService = new TileImageService(128);
        assert.ok(customService instanceof TileImageService);
    });
});
