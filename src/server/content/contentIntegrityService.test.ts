import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { ContentIntegrityService } from './contentIntegrityService';
import { createTestRedis, cleanupTestRedis } from '../tests/setup';

/** テスト用にRedisへ直接データを書き込むヘルパー */
async function writeMetadata(redis: Redis, id: string, overrides: Record<string, any> = {}): Promise<void> {
    const data = {
        metadataId: id,
        binaryId: id,
        type: 'image',
        creatorId: 'testuser',
        posx: 0, posy: 0, width: 100, height: 100,
        date: new Date().toISOString(),
        ...overrides,
    };
    await redis.set(`content:metadata:${id}`, JSON.stringify(data));
}

async function writeBinary(redis: Redis, id: string): Promise<void> {
    await redis.set(`content:binary:${id}`, Buffer.from('dummy'));
}

async function writeStreamInfo(redis: Redis, streamId: string, overrides: Record<string, any> = {}): Promise<void> {
    const data = {
        streamId,
        userId: 'user1',
        socketId: 'socket1',
        producerIds: ['producer1'],
        streamName: 'Test Stream',
        created: new Date().toISOString(),
        ...overrides,
    };
    await redis.set(`content:stream:${streamId}`, JSON.stringify(data));
}

async function writeTile(redis: Redis, id: string): Promise<void> {
    await redis.hset(`content:tile:${id}`, '0', Buffer.from('tile-data'));
}

async function writeLiveStreamMetadata(
    redis: Redis,
    metadataId: string,
    streamId: string,
    socketId: string = 'socket-live'
): Promise<void> {
    const data = {
        metadataId,
        binaryId: null,
        type: 'live-stream',
        creatorId: 'stream-user',
        streamId,
        streamName: 'Camera',
        userId: 'stream-user',
        socketId,
        producerId: 'producer-1',
        posx: 0,
        posy: 0,
        width: 640,
        height: 480,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
    };
    await redis.set(`content:metadata:${metadataId}`, JSON.stringify(data));
}

describe('ContentIntegrityService', () => {
    let redis: Redis;
    let service: ContentIntegrityService;

    beforeEach(() => {
        redis = createTestRedis();
        service = new ContentIntegrityService(redis);
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    describe('checkAndRepair - 正常ケース', () => {
        it('Redisが空の場合、削除0件で正常終了すること', async () => {
            const result = await service.checkAndRepair();

            assert.strictEqual(result.totalDeleted, 0);
            assert.strictEqual(result.orphanedBinaries.length, 0);
            assert.strictEqual(result.orphanedMetadata.length, 0);
            assert.strictEqual(result.orphanedStreamMetadata.length, 0);
            assert.strictEqual(result.orphanedStreamInfos.length, 0);
            assert.strictEqual(result.orphanedTiles.length, 0);
            assert.strictEqual(result.dryRun, false);
            assert.ok(result.durationMs >= 0);
        });

        it('正常なコンテンツ（metadata + binary）は削除されないこと', async () => {
            await writeMetadata(redis, 'content1');
            await writeBinary(redis, 'content1');

            const result = await service.checkAndRepair();

            assert.strictEqual(result.totalDeleted, 0);
        });

        it('正常な live-stream（metadata + stream info）は削除されないこと', async () => {
            await writeMetadata(redis, 'stream1', {
                binaryId: null,
                type: 'live-stream',
                streamId: 'sid1',
            });
            await writeStreamInfo(redis, 'sid1', { metadataId: 'stream1' });

            const result = await service.checkAndRepair();

            assert.strictEqual(result.totalDeleted, 0);
        });

        it('metadataId を持たない stream info（audio-only）は削除されないこと', async () => {
            await writeStreamInfo(redis, 'audio-sid1');  // metadataId なし

            const result = await service.checkAndRepair();

            assert.strictEqual(result.totalDeleted, 0);
            assert.strictEqual(result.orphanedStreamInfos.length, 0);
        });

        it('正常なtileimage（metadata + binary + tile）は削除されないこと', async () => {
            await writeMetadata(redis, 'tile1', { type: 'tileimage', binaryId: 'tile1' });
            await writeBinary(redis, 'tile1');
            await writeTile(redis, 'tile1');

            const result = await service.checkAndRepair();

            assert.strictEqual(result.totalDeleted, 0);
            assert.strictEqual(result.orphanedTiles.length, 0);
        });
    });

    describe('purgeAllLiveStreamsOnStartup', () => {
        it('live-stream metadata と stream info を全削除すること', async () => {
            await writeLiveStreamMetadata(redis, 'ls-meta-1', 'stream-1');
            await writeLiveStreamMetadata(redis, 'ls-meta-2', 'stream-2');
            await writeStreamInfo(redis, 'stream-1', { metadataId: 'ls-meta-1' });
            await writeStreamInfo(redis, 'stream-2', { metadataId: 'ls-meta-2' });

            const result = await service.purgeAllLiveStreamsOnStartup();

            assert.strictEqual(result.deletedLiveStreamMetadataCount, 2);
            assert.strictEqual(result.deletedStreamInfoCount, 2);
            assert.strictEqual(result.totalDeleted, 4);

            assert.strictEqual(await redis.exists('content:metadata:ls-meta-1'), 0);
            assert.strictEqual(await redis.exists('content:metadata:ls-meta-2'), 0);
            assert.strictEqual(await redis.exists('content:stream:stream-1'), 0);
            assert.strictEqual(await redis.exists('content:stream:stream-2'), 0);
        });

        it('通常コンテンツは削除しないこと', async () => {
            await writeMetadata(redis, 'normal-image-1', { type: 'image' });
            await writeBinary(redis, 'normal-image-1');
            await writeLiveStreamMetadata(redis, 'ls-meta-3', 'stream-3');
            await writeStreamInfo(redis, 'stream-3', { metadataId: 'ls-meta-3' });

            const result = await service.purgeAllLiveStreamsOnStartup();

            assert.strictEqual(result.deletedLiveStreamMetadataCount, 1);
            assert.strictEqual(result.deletedStreamInfoCount, 1);
            assert.strictEqual(await redis.exists('content:metadata:normal-image-1'), 1);
            assert.strictEqual(await redis.exists('content:binary:normal-image-1'), 1);
        });

        it('stream info 単独キーも削除すること', async () => {
            await writeStreamInfo(redis, 'orphan-stream-only', { metadataId: 'missing-meta' });

            const result = await service.purgeAllLiveStreamsOnStartup();

            assert.strictEqual(result.deletedLiveStreamMetadataCount, 0);
            assert.strictEqual(result.deletedStreamInfoCount, 1);
            assert.strictEqual(result.totalDeleted, 1);
            assert.strictEqual(await redis.exists('content:stream:orphan-stream-only'), 0);
        });

        it('削除対象がない場合は 0 件を返すこと', async () => {
            await writeMetadata(redis, 'normal-image-2', { type: 'image' });
            await writeBinary(redis, 'normal-image-2');

            const result = await service.purgeAllLiveStreamsOnStartup();

            assert.strictEqual(result.deletedLiveStreamMetadataCount, 0);
            assert.strictEqual(result.deletedStreamInfoCount, 0);
            assert.strictEqual(result.totalDeleted, 0);
            assert.strictEqual(await redis.exists('content:metadata:normal-image-2'), 1);
            assert.strictEqual(await redis.exists('content:binary:normal-image-2'), 1);
        });
    });

    describe('checkAndRepair - パターン1: 孤立 binary', () => {
        it('対応する metadata がない binary は削除されること', async () => {
            await writeBinary(redis, 'orphan1');

            const result = await service.checkAndRepair();

            assert.strictEqual(result.orphanedBinaries.length, 1);
            assert.ok(result.orphanedBinaries.includes('orphan1'));
            assert.strictEqual(result.totalDeleted, 1);

            // Redis から削除されていること
            const exists = await redis.exists('content:binary:orphan1');
            assert.strictEqual(exists, 0);
        });

        it('複数の孤立 binary を一括検出・削除できること', async () => {
            await writeBinary(redis, 'orphan-a');
            await writeBinary(redis, 'orphan-b');
            await writeMetadata(redis, 'normal1');
            await writeBinary(redis, 'normal1');  // こちらは正常

            const result = await service.checkAndRepair();

            assert.strictEqual(result.orphanedBinaries.length, 2);
            assert.ok(result.orphanedBinaries.includes('orphan-a'));
            assert.ok(result.orphanedBinaries.includes('orphan-b'));

            // 正常なものは残っていること
            const normalBinary = await redis.exists('content:binary:normal1');
            assert.strictEqual(normalBinary, 1);
        });
    });

    describe('checkAndRepair - パターン2: 孤立 metadata', () => {
        it('対応する binary がない metadata は削除されること', async () => {
            await writeMetadata(redis, 'meta-only1');
            // binary は書かない

            const result = await service.checkAndRepair();

            assert.strictEqual(result.orphanedMetadata.length, 1);
            assert.ok(result.orphanedMetadata.includes('meta-only1'));
            assert.strictEqual(result.totalDeleted, 1);

            const exists = await redis.exists('content:metadata:meta-only1');
            assert.strictEqual(exists, 0);
        });

        it('binaryId が null の metadata（live-stream以外）はパターン2対象外であること', async () => {
            // binaryId=null だが type は image（異常なデータだが対象外とする）
            await writeMetadata(redis, 'null-binary1', { binaryId: null });

            const result = await service.checkAndRepair();

            // orphanedMetadata には含まれない（binaryId=null はスキップ）
            assert.strictEqual(result.orphanedMetadata.length, 0);
        });
    });

    describe('checkAndRepair - パターン3: 孤立 stream metadata', () => {
        it('stream info がない live-stream metadata は削除されること', async () => {
            await writeMetadata(redis, 'stream-meta1', {
                binaryId: null,
                type: 'live-stream',
                streamId: 'missing-stream',
            });
            // stream info は書かない

            const result = await service.checkAndRepair();

            assert.strictEqual(result.orphanedStreamMetadata.length, 1);
            assert.ok(result.orphanedStreamMetadata.includes('stream-meta1'));
            assert.strictEqual(result.totalDeleted, 1);

            const exists = await redis.exists('content:metadata:stream-meta1');
            assert.strictEqual(exists, 0);
        });
    });

    describe('checkAndRepair - パターン4: 孤立 stream info', () => {
        it('metadata がない stream info は削除されること', async () => {
            await writeStreamInfo(redis, 'stream-info1', { metadataId: 'gone-meta1' });
            // metadata は書かない

            const result = await service.checkAndRepair();

            assert.strictEqual(result.orphanedStreamInfos.length, 1);
            assert.ok(result.orphanedStreamInfos.includes('stream-info1'));
            assert.strictEqual(result.totalDeleted, 1);

            const exists = await redis.exists('content:stream:stream-info1');
            assert.strictEqual(exists, 0);
        });
    });

    describe('checkAndRepair - パターン5: 孤立 tile', () => {
        it('対応する metadata がない tile は削除されること', async () => {
            await writeTile(redis, 'orphan-tile1');
            // metadata は書かない

            const result = await service.checkAndRepair();

            assert.strictEqual(result.orphanedTiles.length, 1);
            assert.ok(result.orphanedTiles.includes('orphan-tile1'));
            assert.strictEqual(result.totalDeleted, 1);

            const exists = await redis.exists('content:tile:orphan-tile1');
            assert.strictEqual(exists, 0);
        });

        it('複数の孤立 tile を一括検出・削除できること', async () => {
            await writeTile(redis, 'orphan-tile-a');
            await writeTile(redis, 'orphan-tile-b');
            // 正常なtileimage（metadata + binary + tile すべてあり）
            await writeMetadata(redis, 'normal-tile', { type: 'tileimage' });
            await writeBinary(redis, 'normal-tile');  // 縮小版バイナリ
            await writeTile(redis, 'normal-tile');

            const result = await service.checkAndRepair();

            assert.strictEqual(result.orphanedTiles.length, 2);
            assert.ok(result.orphanedTiles.includes('orphan-tile-a'));
            assert.ok(result.orphanedTiles.includes('orphan-tile-b'));

            // 正常なtileは残っていること
            const normalTile = await redis.exists('content:tile:normal-tile');
            assert.strictEqual(normalTile, 1);
        });
    });

    describe('checkAndRepair - dryRun オプション', () => {
        it('dryRun=true の場合、孤立データを検出するが削除しないこと', async () => {
            await writeBinary(redis, 'dry-orphan1');
            await writeMetadata(redis, 'dry-meta1');  // binary なし

            const result = await service.checkAndRepair({ dryRun: true });

            assert.strictEqual(result.dryRun, true);
            assert.ok(result.totalDeleted > 0, '検出されていること');

            // 削除はされていないこと
            const binaryExists = await redis.exists('content:binary:dry-orphan1');
            assert.strictEqual(binaryExists, 1, 'binary は残っていること');
            const metaExists = await redis.exists('content:metadata:dry-meta1');
            assert.strictEqual(metaExists, 1, 'metadata は残っていること');
        });

        it('dryRun=true の場合、孤立タイルを検出するが削除しないこと', async () => {
            await writeTile(redis, 'dry-tile1');

            const result = await service.checkAndRepair({ dryRun: true });

            assert.strictEqual(result.dryRun, true);
            assert.strictEqual(result.orphanedTiles.length, 1);

            const tileExists = await redis.exists('content:tile:dry-tile1');
            assert.strictEqual(tileExists, 1, 'tile は残っていること');
        });
    });

    describe('checkAndRepair - gracePeriodMs オプション', () => {
        it('gracePeriodMs 内に作成された metadata の孤立は削除されないこと', async () => {
            // 現在時刻でmetadataを作成（binary なし）→猶予期間内なので削除対象外
            await writeMetadata(redis, 'recent-meta1'); // date = now
            // binary なし → 通常は孤立だが、gracePeriodMs=60000 内なのでスキップ

            const result = await service.checkAndRepair({ gracePeriodMs: 60 * 1000 });

            assert.strictEqual(result.orphanedMetadata.length, 0, '猶予期間内はスキップされること');
        });

        it('gracePeriodMs を超えた metadata の孤立は削除されること', async () => {
            // 10分前の date を設定
            const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            await writeMetadata(redis, 'old-meta1', { date: oldDate });
            // binary なし

            const result = await service.checkAndRepair({ gracePeriodMs: 5 * 60 * 1000 });

            assert.strictEqual(result.orphanedMetadata.length, 1, '猶予期間を超えた孤立は削除されること');
            assert.ok(result.orphanedMetadata.includes('old-meta1'));
        });

        it('gracePeriodMs 内の stream info の孤立は削除されないこと', async () => {
            await writeStreamInfo(redis, 'recent-stream1', {
                metadataId: 'gone-meta',
                created: new Date().toISOString(),
            });

            const result = await service.checkAndRepair({ gracePeriodMs: 60 * 1000 });

            assert.strictEqual(result.orphanedStreamInfos.length, 0, '猶予期間内はスキップされること');
        });
    });

    describe('checkAndRepair - 複合ケース', () => {
        it('複数パターンの孤立が同時に存在する場合に全て検出・削除できること', async () => {
            // パターン1: 孤立 binary
            await writeBinary(redis, 'p1-orphan');
            // パターン2: 孤立 metadata
            await writeMetadata(redis, 'p2-orphan');
            // パターン3: 孤立 stream metadata
            await writeMetadata(redis, 'p3-orphan', {
                binaryId: null, type: 'live-stream', streamId: 'no-stream',
            });
            // パターン4: 孤立 stream info
            await writeStreamInfo(redis, 'p4-orphan', { metadataId: 'no-meta' });
            // パターン5: 孤立 tile
            await writeTile(redis, 'p5-orphan');
            // 正常なコンテンツ
            await writeMetadata(redis, 'normal');
            await writeBinary(redis, 'normal');

            const result = await service.checkAndRepair();

            assert.strictEqual(result.orphanedBinaries.length, 1);
            assert.strictEqual(result.orphanedMetadata.length, 1);
            assert.strictEqual(result.orphanedStreamMetadata.length, 1);
            assert.strictEqual(result.orphanedStreamInfos.length, 1);
            assert.strictEqual(result.orphanedTiles.length, 1);
            assert.strictEqual(result.totalDeleted, 5);

            // 正常なコンテンツは残っていること
            assert.strictEqual(await redis.exists('content:metadata:normal'), 1);
            assert.strictEqual(await redis.exists('content:binary:normal'), 1);
        });
    });
});
