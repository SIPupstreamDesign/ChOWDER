import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { ContentService } from './contentService';
import { ContentType } from './contentTypes';
import { createTestRedis, cleanupTestRedis } from '../tests/setup';

describe('ContentService', () => {
    let redis: Redis;
    let service: ContentService;

    beforeEach(() => {
        redis = createTestRedis();
        service = new ContentService(redis);
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    describe('addContent', () => {
        it('新しいコンテンツを追加できること', async () => {
            const binary = Buffer.from('test image data');
            const metadata = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    posx: 100,
                    posy: 200,
                    width: 640,
                    height: 480,
                    orgWidth: 640,
                    orgHeight: 480,
                    mime: 'image/png',
                },
                binary,
            });

            assert.ok(metadata.metadataId);
            assert.ok(metadata.binaryId);
            assert.strictEqual(metadata.type, ContentType.IMAGE);
            assert.strictEqual(metadata.creatorId, 'testuser');
            assert.strictEqual(metadata.posx, 100);
            assert.strictEqual(metadata.posy, 200);
            assert.strictEqual(metadata.mime, 'image/png');
        });

        it('creatorIdが必須であること', async () => {
            const binary = Buffer.from('test data');

            await assert.rejects(
                async () => {
                    await service.addContent({
                        metadata: {
                            type: ContentType.IMAGE,
                            width: 100,
                            height: 100,
                        },
                        binary,
                    });
                },
                (error: any) => {
                    assert.ok(error.message.includes('creatorId'));
                    return true;
                }
            );
        });

        it('metadataIdを指定して追加できること', async () => {
            const customId = 'custom_metadata_123';
            const binary = Buffer.from('test data');
            const metadata = await service.addContent({
                metadata: {
                    metadataId: customId,
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                },
                binary,
            });

            assert.strictEqual(metadata.metadataId, customId);
        });

        it('binaryIdとmetadataIdが同じであること', async () => {
            const binary = Buffer.from('test data');
            const metadata = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                },
                binary,
            });

            assert.strictEqual(metadata.binaryId, metadata.metadataId);
        });

        it('作成日時が自動設定されること', async () => {
            const binary = Buffer.from('test data');
            const metadata = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                },
                binary,
            });

            assert.ok(metadata.date);
            // ISO 8601形式であることを確認
            const parsedDate = new Date(metadata.date);
            assert.ok(!isNaN(parsedDate.getTime()));
        });
    });

    describe('getContent', () => {
        it('コンテンツを取得できること', async () => {
            const binary = Buffer.from('test content');
            const added = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                },
                binary,
            });

            const content = await service.getContent(added.metadataId);

            assert.ok(content);
            assert.strictEqual(content.metadata.metadataId, added.metadataId);
            assert.strictEqual(content.metadata.creatorId, 'testuser');
            assert.ok(Buffer.isBuffer(content.binary));
            assert.strictEqual(content.binary.toString(), 'test content');
        });

        it('存在しないIDはnullを返すこと', async () => {
            const content = await service.getContent('nonexistent');
            assert.strictEqual(content, null);
        });
    });

    describe('getMetadata', () => {
        it('メタデータのみを取得できること', async () => {
            const binary = Buffer.from('test data');
            const added = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                },
                binary,
            });

            const metadata = await service.getMetadata(added.metadataId);

            assert.ok(metadata);
            assert.strictEqual(metadata.metadataId, added.metadataId);
            assert.strictEqual(metadata.type, ContentType.IMAGE);
            assert.strictEqual(metadata.creatorId, 'testuser');
        });

        it('存在しないIDはnullを返すこと', async () => {
            const metadata = await service.getMetadata('nonexistent');
            assert.strictEqual(metadata, null);
        });
    });

    describe('getAllMetadata', () => {
        it('全メタデータを取得できること', async () => {
            await service.addContent({
                metadata: { type: ContentType.IMAGE, creatorId: 'user1', width: 100, height: 100 },
                binary: Buffer.from('data1'),
            });
            await service.addContent({
                metadata: { type: ContentType.TEXT, creatorId: 'user2', width: 200, height: 200 },
                binary: Buffer.from('data2'),
            });

            const allMetadata = await service.getAllMetadata();

            assert.strictEqual(allMetadata.length, 2);
            assert.ok(allMetadata.every(m => m.creatorId));
        });

        it('コンテンツが存在しない場合は空配列を返すこと', async () => {
            const allMetadata = await service.getAllMetadata();
            assert.strictEqual(allMetadata.length, 0);
        });
    });

    describe('updateMetadata', () => {
        it('メタデータを更新できること', async () => {
            const added = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    posx: 0,
                    posy: 0,
                    width: 100,
                    height: 100,
                },
                binary: Buffer.from('data'),
            });

            const updated = await service.updateMetadata(added.metadataId, {
                posx: 50,
                posy: 100,
            });

            assert.ok(updated);
            assert.strictEqual(updated.posx, 50);
            assert.strictEqual(updated.posy, 100);
            assert.strictEqual(updated.width, 100); // 変更されていない
            assert.strictEqual(updated.creatorId, 'testuser'); // 変更されていない
        });

        it('creatorIdは更新で変更されないこと', async () => {
            const added = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'original_user',
                    width: 100,
                    height: 100,
                },
                binary: Buffer.from('data'),
            });

            const updated = await service.updateMetadata(added.metadataId, {
                creatorId: 'hacker',
                posx: 50,
            });

            assert.ok(updated);
            assert.strictEqual(updated.creatorId, 'original_user'); // 元のまま
            assert.strictEqual(updated.posx, 50); // 他のフィールドは更新される
        });

        it('存在しないIDの更新はnullを返すこと', async () => {
            const updated = await service.updateMetadata('nonexistent', {
                posx: 100,
            });
            assert.strictEqual(updated, null);
        });

        it('undefined値のフィールドは既存値を上書きしないこと', async () => {
            const added = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    posx: 100,
                    posy: 200,
                    width: 640,
                    height: 480,
                },
                binary: Buffer.from('data'),
            });

            const updated = await service.updateMetadata(added.metadataId, {
                posx: undefined,
                posy: undefined,
            });

            assert.ok(updated);
            assert.strictEqual(updated.posx, 100); // undefined で上書きされない
            assert.strictEqual(updated.posy, 200); // undefined で上書きされない
        });

        it('cameraWorldMatrix/cameraParamsはupdateMetadataでは保存されないこと', async () => {
            const added = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    posx: 300,
                    posy: 400,
                    width: 800,
                    height: 600,
                },
                binary: Buffer.from('data'),
            });

            const cameraMatrix = JSON.stringify({ elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1] });
            const cameraParams = JSON.stringify({ fov: 50 });

            // camera フィールドを含むペイロードで updateMetadata を呼び出す
            const updated = await service.updateMetadata(added.metadataId, {
                metadataId: added.metadataId,
                cameraWorldMatrix: cameraMatrix,
                cameraParams: cameraParams,
            } as any);

            assert.ok(updated);
            assert.strictEqual(updated.posx, 300);     // posx が変化しないこと
            assert.strictEqual(updated.posy, 400);     // posy が変化しないこと
            // camera フィールドは content:metadata に保存されない
            assert.strictEqual((updated as any).cameraWorldMatrix, undefined);
            assert.strictEqual((updated as any).cameraParams, undefined);
        });

        it('type/contentType は updateMetadata で保存されず、既存typeが維持されること', async () => {
            const added = await service.addContent({
                metadata: {
                    type: ContentType.WEBGL,
                    creatorId: 'testuser',
                    posx: 10,
                    posy: 20,
                    width: 800,
                    height: 600,
                },
                binary: Buffer.from('webgl-data'),
            });

            const updated = await service.updateMetadata(added.metadataId, {
                type: 'content' as any,
                contentType: 'image' as any,
                posx: 30,
            } as any);

            assert.ok(updated);
            assert.strictEqual(updated.type, ContentType.WEBGL);
            assert.strictEqual(updated.posx, 30);

            const fetched = await service.getMetadata(added.metadataId);
            assert.ok(fetched);
            assert.strictEqual(fetched.type, ContentType.WEBGL);
            assert.strictEqual((fetched as any).contentType, undefined);
        });
    });

    describe('updateContent', () => {
        it('type/contentType は updateContent で保存されず、既存typeが維持されること', async () => {
            const added = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    posx: 0,
                    posy: 0,
                    width: 100,
                    height: 100,
                },
                binary: Buffer.from('image-data'),
            });

            const updated = await service.updateContent({
                metadataId: added.metadataId,
                binary: Buffer.from('updated-image-data'),
                metadata: {
                    type: 'content' as any,
                    contentType: 'webgl' as any,
                    width: 300,
                    height: 200,
                } as any,
            });

            assert.ok(updated);
            assert.strictEqual(updated.type, ContentType.IMAGE);
            assert.strictEqual(updated.width, 300);
            assert.strictEqual(updated.height, 200);

            const fetched = await service.getMetadata(added.metadataId);
            assert.ok(fetched);
            assert.strictEqual(fetched.type, ContentType.IMAGE);
            assert.strictEqual((fetched as any).contentType, undefined);
        });
    });

    describe('getCameraData / updateCameraData', () => {
        it('カメラデータを保存・取得できること', async () => {
            const added = await service.addContent({
                metadata: { type: ContentType.WEBGL, creatorId: 'testuser', width: 800, height: 600 },
                binary: Buffer.from(''),
            });
            const matrix = JSON.stringify({ elements: [1, 0, 0, 0] });
            const params = JSON.stringify({ fov: 60 });

            const saved = await service.updateCameraData(added.metadataId, matrix, params);
            assert.strictEqual(saved.metadataId, added.metadataId);
            assert.strictEqual(saved.cameraWorldMatrix, matrix);
            assert.strictEqual(saved.cameraParams, params);

            const fetched = await service.getCameraData(added.metadataId);
            assert.ok(fetched);
            assert.strictEqual(fetched.cameraWorldMatrix, matrix);
            assert.strictEqual(fetched.cameraParams, params);
        });

        it('存在しないIDの getCameraData は null を返すこと', async () => {
            const result = await service.getCameraData('nonexistent-id');
            assert.strictEqual(result, null);
        });

        it('deleteContent でカメラデータも削除されること', async () => {
            const added = await service.addContent({
                metadata: { type: ContentType.WEBGL, creatorId: 'testuser', width: 800, height: 600 },
                binary: Buffer.from(''),
            });
            const matrix = JSON.stringify({ elements: [1, 0, 0, 0] });
            await service.updateCameraData(added.metadataId, matrix, '{}');

            // 削除前にカメラデータが存在することを確認
            const before = await service.getCameraData(added.metadataId);
            assert.ok(before);

            await service.deleteContent(added.metadataId);

            // 削除後はカメラデータも消えることを確認
            const after = await service.getCameraData(added.metadataId);
            assert.strictEqual(after, null);
        });
    });

    describe('updateContent', () => {
        it('メタデータとバイナリを同時に更新できること', async () => {
            const originalBinary = Buffer.from('original');
            const added = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                },
                binary: originalBinary,
            });

            const newBinary = Buffer.from('updated');
            const updated = await service.updateContent({
                metadataId: added.metadataId,
                metadata: {
                    posx: 200,
                },
                binary: newBinary,
            });

            assert.ok(updated);
            assert.strictEqual(updated.posx, 200);
            assert.strictEqual(updated.creatorId, 'testuser'); // 変更されない
            assert.strictEqual(updated.binaryId, added.binaryId); // binaryIdは変わらない

            // 更新されたコンテンツを取得
            const content = await service.getContent(updated.metadataId);
            assert.ok(content);
            assert.strictEqual(content.binary.toString(), 'updated');
        });

        it('updateContentでもcreatorIdは変更されないこと', async () => {
            const added = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'original_user',
                    width: 100,
                    height: 100,
                },
                binary: Buffer.from('original'),
            });

            const updated = await service.updateContent({
                metadataId: added.metadataId,
                metadata: {
                    creatorId: 'attacker',
                    posx: 200,
                },
                binary: Buffer.from('new data'),
            });

            assert.ok(updated);
            assert.strictEqual(updated.creatorId, 'original_user'); // 元のまま
        });
    });

    describe('deleteContent', () => {
        it('コンテンツを削除できること', async () => {
            const added = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                },
                binary: Buffer.from('data'),
            });

            const deleted = await service.deleteContent(added.metadataId);
            assert.strictEqual(deleted, true);

            const content = await service.getContent(added.metadataId);
            assert.strictEqual(content, null);
        });

        it('削除するとバイナリも削除されること', async () => {
            const added = await service.addContent({
                metadata: { type: ContentType.IMAGE, creatorId: 'testuser', width: 100, height: 100 },
                binary: Buffer.from('data'),
            });

            const binaryId = added.binaryId;

            await service.deleteContent(added.metadataId);

            const binarySize = await service.getBinarySize(binaryId);
            assert.strictEqual(binarySize, null);
        });

        it('存在しないIDの削除はfalseを返すこと', async () => {
            const deleted = await service.deleteContent('nonexistent');
            assert.strictEqual(deleted, false);
        });

        it('tileimageのコンテンツを削除するとタイルデータも削除されること', async () => {
            const added = await service.addContent({
                metadata: { type: ContentType.TILEIMAGE, creatorId: 'testuser', width: 100, height: 100 },
                binary: Buffer.from('reduction-image'),
            });

            // タイルハッシュを直接書き込み（TileImageService の役割を模倣）
            await redis.hset(`content:tile:${added.metadataId}`, '0', Buffer.from('tile-data'));

            await service.deleteContent(added.metadataId);

            const metaExists = await redis.exists(`content:metadata:${added.metadataId}`);
            const binaryExists = await redis.exists(`content:binary:${added.metadataId}`);
            const tileExists = await redis.exists(`content:tile:${added.metadataId}`);

            assert.strictEqual(metaExists, 0, 'metadata が削除されること');
            assert.strictEqual(binaryExists, 0, 'binary（縮小版）が削除されること');
            assert.strictEqual(tileExists, 0, 'タイルデータも削除されること');
        });
    });

    describe('addStreamMetadata', () => {
        it('StreamMetadataを追加できること', async () => {
            const streamMetadata = await service.addStreamMetadata({
                streamId: 'stream123',
                streamName: 'Test Stream',
                creatorId: 'streamer1',
                userId: 'streamer1',
                socketId: 'socket456',
                producerId: 'producer789',
                posx: 0,
                posy: 0,
                width: 640,
                height: 480,
            });

            assert.ok(streamMetadata.metadataId);
            assert.strictEqual(streamMetadata.binaryId, null);
            assert.strictEqual(streamMetadata.type, ContentType.LIVE_STREAM);
            assert.strictEqual(streamMetadata.streamId, 'stream123');
            assert.strictEqual(streamMetadata.streamName, 'Test Stream');
            assert.strictEqual(streamMetadata.creatorId, 'streamer1');
            assert.strictEqual(streamMetadata.userId, 'streamer1');
            assert.strictEqual(streamMetadata.socketId, 'socket456');
            assert.strictEqual(streamMetadata.producerId, 'producer789');
        });

        it('StreamMetadataのcreatorIdとuserIdが設定されること', async () => {
            const streamMetadata = await service.addStreamMetadata({
                streamId: 'stream123',
                streamName: 'Test Stream',
                creatorId: 'user123',
                userId: 'user123',
                socketId: 'socket456',
                producerId: 'producer789',
                posx: 100,
                posy: 200,
                width: 1280,
                height: 720,
            });

            // creatorIdは親クラスから継承
            assert.strictEqual(streamMetadata.creatorId, 'user123');
            // userIdはmediasoup管理用
            assert.strictEqual(streamMetadata.userId, 'user123');
            // 両方が存在することを確認
            assert.ok(streamMetadata.creatorId && streamMetadata.userId);
        });

        it('StreamMetadataを取得できること', async () => {
            const added = await service.addStreamMetadata({
                streamId: 'stream123',
                streamName: 'Test Stream',
                creatorId: 'streamer1',
                userId: 'streamer1',
                socketId: 'socket456',
                producerId: 'producer789',
                posx: 0,
                posy: 0,
                width: 640,
                height: 480,
            });

            const metadata = await service.getMetadata(added.metadataId);

            assert.ok(metadata);
            assert.strictEqual(metadata.metadataId, added.metadataId);
            assert.strictEqual(metadata.type, ContentType.LIVE_STREAM);
            assert.strictEqual(metadata.creatorId, 'streamer1');
        });
    });

    describe('addStreamMetadataWithStreamInfo', () => {
        it('StreamMetadata\u3068StreamInfo\u3092\u30a2\u30c8\u30df\u30c3\u30af\u306b\u8ffd\u52a0\u3067\u304d\u308b\u3053\u3068', async () => {
            const streamId = 'stream-atomic-001';
            const streamMetadata = await service.addStreamMetadataWithStreamInfo(
                {
                    streamId,
                    streamName: 'Atomic Stream',
                    creatorId: 'user1',
                    userId: 'user1',
                    socketId: 'socket1',
                    producerId: 'producer1',
                    posx: 0,
                    posy: 0,
                    width: 640,
                    height: 480,
                },
                {
                    streamId,
                    userId: 'user1',
                    socketId: 'socket1',
                    producerIds: ['producer1'],
                    streamName: 'Atomic Stream',
                    created: new Date().toISOString(),
                }
            );

            // StreamMetadata\u304c\u6b63\u3057\u304f\u4fdd\u5b58\u3055\u308c\u3066\u3044\u308b\u3053\u3068
            assert.ok(streamMetadata.metadataId);
            assert.strictEqual(streamMetadata.streamId, streamId);
            assert.strictEqual(streamMetadata.type, ContentType.LIVE_STREAM);
            assert.strictEqual(streamMetadata.binaryId, null);

            // Redis\u4e0a\u306bmetadata\u304c\u5b9f\u5728\u3059\u308b\u3053\u3068
            const savedMetadata = await service.getMetadata(streamMetadata.metadataId);
            assert.ok(savedMetadata);
            assert.strictEqual(savedMetadata.metadataId, streamMetadata.metadataId);
        });

        it('StreamInfo\u306bmetadataId\u304c\u57cb\u3081\u8fbc\u307e\u308c\u308b\u3053\u3068', async () => {
            const streamId = 'stream-atomic-002';
            const redis = (service as any).redis as import('ioredis').Redis;

            const streamMetadata = await service.addStreamMetadataWithStreamInfo(
                {
                    streamId,
                    streamName: 'Check StreamInfo',
                    creatorId: 'user2',
                    userId: 'user2',
                    socketId: 'socket2',
                    producerId: 'producer2',
                    posx: 0,
                    posy: 0,
                    width: 1280,
                    height: 720,
                },
                {
                    streamId,
                    userId: 'user2',
                    socketId: 'socket2',
                    producerIds: ['producer2'],
                    streamName: 'Check StreamInfo',
                    created: new Date().toISOString(),
                }
            );

            // content:stream \u30ad\u30fc\u306b StreamInfo \u304c\u4fdd\u5b58\u3055\u308c\u3066\u3044\u308b\u3053\u3068
            const streamInfoStr = await redis.get(`content:stream:${streamId}`);
            assert.ok(streamInfoStr);
            const streamInfo = JSON.parse(streamInfoStr);
            assert.strictEqual(streamInfo.metadataId, streamMetadata.metadataId);
            assert.strictEqual(streamInfo.streamId, streamId);
            assert.deepStrictEqual(streamInfo.producerIds, ['producer2']);
        });
    });

    describe('deleteStreamMetadataWithStreamId', () => {
        it('StreamMetadata\u3068StreamInfo\u3092\u30a2\u30c8\u30df\u30c3\u30af\u306b\u524a\u9664\u3067\u304d\u308b\u3053\u3068', async () => {
            const streamId = 'stream-del-001';
            const redis = (service as any).redis as import('ioredis').Redis;

            // \u307e\u305a\u30a2\u30c8\u30df\u30c3\u30af\u306b\u8ffd\u52a0
            const streamMetadata = await service.addStreamMetadataWithStreamInfo(
                {
                    streamId,
                    streamName: 'Delete Test',
                    creatorId: 'user3',
                    userId: 'user3',
                    socketId: 'socket3',
                    producerId: 'producer3',
                    posx: 0,
                    posy: 0,
                    width: 640,
                    height: 480,
                },
                {
                    streamId,
                    userId: 'user3',
                    socketId: 'socket3',
                    producerIds: ['producer3'],
                    streamName: 'Delete Test',
                    created: new Date().toISOString(),
                }
            );

            // \u30a2\u30c8\u30df\u30c3\u30af\u306b\u524a\u9664
            const result = await service.deleteStreamMetadataWithStreamId(
                streamMetadata.metadataId,
                streamId
            );
            assert.strictEqual(result, true);

            // metadata \u304c\u524a\u9664\u3055\u308c\u3066\u3044\u308b\u3053\u3068
            const savedMetadata = await service.getMetadata(streamMetadata.metadataId);
            assert.strictEqual(savedMetadata, null);

            // StreamInfo \u304c\u524a\u9664\u3055\u308c\u3066\u3044\u308b\u3053\u3068
            const streamInfoStr = await redis.get(`content:stream:${streamId}`);
            assert.strictEqual(streamInfoStr, null);
        });

        it('存在しないmetadataIdは false を返すこと', async () => {
            const result = await service.deleteStreamMetadataWithStreamId(
                'nonexistent-metadata',
                'nonexistent-stream'
            );
            assert.strictEqual(result, false);
        });
    });

    describe('addStreamMetadataWithStreamInfo で subtype を保存', () => {
        it('subtype: video-file が StreamMetadata に保存されること', async () => {
            const streamId = 'stream-subtype-001';
            const streamMetadata = await service.addStreamMetadataWithStreamInfo(
                {
                    streamId,
                    streamName: 'Test Video File',
                    creatorId: 'user1',
                    userId: 'user1',
                    socketId: 'socket1',
                    producerId: 'producer1',
                    posx: 0,
                    posy: 0,
                    width: 1280,
                    height: 720,
                    subtype: 'video-file',
                },
                {
                    streamId,
                    userId: 'user1',
                    socketId: 'socket1',
                    producerIds: ['producer1'],
                    streamName: 'Test Video File',
                    created: new Date().toISOString(),
                }
            );

            // 戻り値に subtype が含まれること
            assert.strictEqual((streamMetadata as any).subtype, 'video-file');

            // Redis 上の JSON にも subtype が保存されていること
            const redisObj = (service as any).redis as import('ioredis').Redis;
            const stored = await redisObj.get(`content:metadata:${streamMetadata.metadataId}`);
            assert.ok(stored);
            const parsed = JSON.parse(stored);
            assert.strictEqual(parsed.subtype, 'video-file');
        });

        it('subtype: screen が StreamMetadata に保存されること', async () => {
            const streamId = 'stream-subtype-002';
            const streamMetadata = await service.addStreamMetadataWithStreamInfo(
                {
                    streamId,
                    streamName: 'Screen Share',
                    creatorId: 'user2',
                    userId: 'user2',
                    socketId: 'socket2',
                    producerId: 'producer2',
                    posx: 0,
                    posy: 0,
                    width: 1920,
                    height: 1080,
                    subtype: 'screen',
                },
                {
                    streamId,
                    userId: 'user2',
                    socketId: 'socket2',
                    producerIds: ['producer2'],
                    streamName: 'Screen Share',
                    created: new Date().toISOString(),
                }
            );

            assert.strictEqual((streamMetadata as any).subtype, 'screen');
        });

        it('subtype を省略した場合は undefined であること', async () => {
            const streamId = 'stream-subtype-003';
            const streamMetadata = await service.addStreamMetadataWithStreamInfo(
                {
                    streamId,
                    streamName: 'Camera',
                    creatorId: 'user3',
                    userId: 'user3',
                    socketId: 'socket3',
                    producerId: 'producer3',
                    posx: 0,
                    posy: 0,
                    width: 640,
                    height: 480,
                },
                {
                    streamId,
                    userId: 'user3',
                    socketId: 'socket3',
                    producerIds: ['producer3'],
                    streamName: 'Camera',
                    created: new Date().toISOString(),
                }
            );

            assert.strictEqual((streamMetadata as any).subtype, undefined);
        });
    });

    describe('deleteStreamMetadata (socketId ベース)', () => {
        it('socketId が一致する live-stream メタデータが削除されること', async () => {
            const socketId = 'socket-del-001';
            const added = await service.addStreamMetadata({
                streamId: 'stream-del-s-001',
                streamName: 'Camera',
                creatorId: 'user1',
                userId: 'user1',
                socketId,
                producerId: 'prod1',
                posx: 0,
                posy: 0,
                width: 640,
                height: 480,
            });

            const deletedIds = await service.deleteStreamMetadata(socketId);

            assert.ok(Array.isArray(deletedIds));
            assert.ok(deletedIds.includes(added.metadataId));

            // Redis から削除されていること
            const remaining = await service.getMetadata(added.metadataId);
            assert.strictEqual(remaining, null);
        });

        it('subtype: video-file の StreamMetadata も socketId ベースで削除されること', async () => {
            const socketId = 'socket-del-002';
            const redisObj = (service as any).redis as import('ioredis').Redis;

            // subtype: video-file を持つ StreamMetadata を直接 Redis に挿入
            const metadataId = 'meta-videofile-001';
            const streamMetadata = {
                metadataId,
                binaryId: null,
                type: 'live-stream',
                subtype: 'video-file',
                creatorId: 'user1',
                userId: 'user1',
                socketId,
                streamId: 'stream-vf-001',
                streamName: 'My Video',
                producerId: 'prod-vf-001',
                posx: 0,
                posy: 0,
                width: 1280,
                height: 720,
            };
            await redisObj.set(`content:metadata:${metadataId}`, JSON.stringify(streamMetadata));

            const deletedIds = await service.deleteStreamMetadata(socketId);

            assert.ok(Array.isArray(deletedIds));
            assert.ok(deletedIds.includes(metadataId));

            const remaining = await redisObj.get(`content:metadata:${metadataId}`);
            assert.strictEqual(remaining, null);
        });

        it('存在しない socketId は空配列を返すこと', async () => {
            const deletedIds = await service.deleteStreamMetadata('nonexistent-socket');
            assert.ok(Array.isArray(deletedIds));
            assert.strictEqual(deletedIds.length, 0);
        });

        it('別の socketId の StreamMetadata は削除されないこと', async () => {
            const socketIdA = 'socket-keep-A';
            const socketIdB = 'socket-keep-B';

            const addedA = await service.addStreamMetadata({
                streamId: 'stream-keep-A',
                streamName: 'Stream A',
                creatorId: 'user1',
                userId: 'user1',
                socketId: socketIdA,
                producerId: 'prod-A',
                posx: 0, posy: 0, width: 640, height: 480,
            });
            const addedB = await service.addStreamMetadata({
                streamId: 'stream-keep-B',
                streamName: 'Stream B',
                creatorId: 'user2',
                userId: 'user2',
                socketId: socketIdB,
                producerId: 'prod-B',
                posx: 0, posy: 0, width: 640, height: 480,
            });

            // socketIdA のみ削除
            const deletedIds = await service.deleteStreamMetadata(socketIdA);

            assert.ok(deletedIds.includes(addedA.metadataId));
            assert.ok(!deletedIds.includes(addedB.metadataId));

            // B は残っていること
            const remainingB = await service.getMetadata(addedB.metadataId);
            assert.ok(remainingB);
        });
    });

    describe('getBinarySize', () => {
        it('バイナリのサイズを取得できること', async () => {
            const binary = Buffer.from('test data with some length');
            const added = await service.addContent({
                metadata: { type: ContentType.IMAGE, creatorId: 'testuser', width: 100, height: 100 },
                binary,
            });

            const size = await service.getBinarySize(added.binaryId);

            assert.ok(size);
            assert.strictEqual(size, binary.length);
        });

        it('存在しないIDはnullを返すこと', async () => {
            const size = await service.getBinarySize('nonexistent');
            assert.strictEqual(size, null);
        });
    });

    describe('createdAt', () => {
        it('addContent で createdAt が自動設定されること', async () => {
            const before = new Date();
            const metadata = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                },
                binary: Buffer.from('data'),
            });
            const after = new Date();

            assert.ok(metadata.createdAt, 'createdAt が存在すること');
            const parsed = new Date(metadata.createdAt);
            assert.ok(!isNaN(parsed.getTime()), 'ISO 8601 形式であること');
            assert.ok(parsed >= before && parsed <= after, 'addContent 呼び出し時刻の範囲内であること');
        });

        it('addContent で createdAt を明示的に指定できること（テスト用固定値）', async () => {
            const fixedDate = '2020-01-01T00:00:00.000Z';
            const metadata = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                    createdAt: fixedDate,
                } as any,
                binary: Buffer.from('data'),
            });

            assert.strictEqual(metadata.createdAt, fixedDate);
        });

        it('updateMetadata 後も createdAt が保持されること', async () => {
            const added = await service.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                },
                binary: Buffer.from('data'),
            });
            const originalCreatedAt = added.createdAt;

            // 少し待って更新（date が変わることを確認するため）
            await new Promise((resolve) => setTimeout(resolve, 10));
            const updated = await service.updateMetadata(added.metadataId, { posx: 999 });

            assert.ok(updated);
            assert.strictEqual(updated.createdAt, originalCreatedAt, 'createdAt は変化しないこと');
            // date（更新日時）は変わっていること
            assert.notStrictEqual(updated.date, added.date, 'date（更新日時）は更新されること');
        });

        it('getAllMetadata が createdAt 昇順でソートされること', async () => {
            // 3件のコンテンツを異なる createdAt で追加
            const dates = [
                '2024-03-01T00:00:00.000Z',
                '2024-01-01T00:00:00.000Z',
                '2024-02-01T00:00:00.000Z',
            ];
            for (const d of dates) {
                await service.addContent({
                    metadata: {
                        type: ContentType.IMAGE,
                        creatorId: 'testuser',
                        width: 100,
                        height: 100,
                        createdAt: d,
                    } as any,
                    binary: Buffer.from('data'),
                });
            }

            const list = await service.getAllMetadata();

            // コンテンツのみ抽出して順序を確認
            const createdAts = list
                .filter((m) => dates.includes(m.createdAt))
                .map((m) => m.createdAt);

            assert.deepStrictEqual(createdAts, [
                '2024-01-01T00:00:00.000Z',
                '2024-02-01T00:00:00.000Z',
                '2024-03-01T00:00:00.000Z',
            ], 'createdAt 昇順でソートされること');
        });

        it('getAllMetadata が zindex -> createdAt -> metadataId の順でソートされること', async () => {
            const sameCreatedAt = '2024-06-01T00:00:00.000Z';
            await service.addContent({
                metadata: {
                    metadataId: 'meta-c',
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                    zindex: 1,
                    createdAt: sameCreatedAt,
                } as any,
                binary: Buffer.from('c'),
            });
            await service.addContent({
                metadata: {
                    metadataId: 'meta-a',
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                    zindex: 0,
                    createdAt: sameCreatedAt,
                } as any,
                binary: Buffer.from('a'),
            });
            await service.addContent({
                metadata: {
                    metadataId: 'meta-b',
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                    zindex: 0,
                    createdAt: sameCreatedAt,
                } as any,
                binary: Buffer.from('b'),
            });

            const list = await service.getAllMetadata();
            const orderedIds = list
                .filter((metadata) => {
                    return metadata.metadataId === 'meta-a'
                        || metadata.metadataId === 'meta-b'
                        || metadata.metadataId === 'meta-c';
                })
                .map((metadata) => {
                    return metadata.metadataId;
                });

            assert.deepStrictEqual(orderedIds, ['meta-a', 'meta-b', 'meta-c']);
        });

        it('getAllMetadata で zindex 未設定値が 0 に正規化されること', async () => {
            const added = await service.addContent({
                metadata: {
                    metadataId: 'meta-no-z',
                    type: ContentType.IMAGE,
                    creatorId: 'testuser',
                    width: 100,
                    height: 100,
                    createdAt: '2024-07-01T00:00:00.000Z',
                } as any,
                binary: Buffer.from('no-z'),
            });

            assert.strictEqual(added.zindex, 0);

            const metadata = await service.getMetadata('meta-no-z');
            assert.ok(metadata);
            assert.strictEqual(metadata.zindex, 0);
        });
    });
});
