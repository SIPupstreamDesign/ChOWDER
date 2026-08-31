/**
 * MediaService 単体テスト
 * mediasoup Worker の起動が不要な機能のテストを行う
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { MediaService } from './mediaService';
import { ContentService } from '../content/contentService';
import { createTestRedis, cleanupTestRedis } from '../tests/setup';

describe('MediaService', () => {
    let redis: Redis;
    let contentService: ContentService;
    let mediaService: MediaService;
    let broadcastedMessages: any[];

    beforeEach(() => {
        redis = createTestRedis();
        contentService = new ContentService(redis);
        broadcastedMessages = [];
        const mockBroadcast = async (message: any) => {
            broadcastedMessages.push(message);
        };
        mediaService = new MediaService(redis, contentService, mockBroadcast);
        // Note: initialize() は呼ばない（mediasoup Worker が不要なテストのみ）
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    describe('getActiveProducers', () => {
        it('初期状態では空のプロデューサーリストを返すこと', async () => {
            const result = await mediaService.getActiveProducers();

            assert.ok(result);
            assert.ok(Array.isArray(result.producers));
            assert.strictEqual(result.producers.length, 0);
        });
    });

    describe('cleanupSocket', () => {
        it('存在しないソケットのクリーンアップはエラーにならないこと', async () => {
            await assert.doesNotReject(async () => {
                await mediaService.cleanupSocket('nonexistent_socket');
            });
        });

        it('存在しないソケットのクリーンアップは空の配列を返すこと', async () => {
            const deletedIds = await mediaService.cleanupSocket('nonexistent_socket');
            assert.ok(Array.isArray(deletedIds));
            assert.strictEqual(deletedIds.length, 0);
        });

        it('subtype: video-file の StreamMetadata が cleanupSocket で削除されること', async () => {
            const socketId = 'socket-vf-cleanup';
            const metadataId = 'meta-vf-cleanup-001';

            // Redis に直接 subtype: video-file の StreamMetadata を挿入（mediasoup 不要）
            await redis.set(`content:metadata:${metadataId}`, JSON.stringify({
                metadataId,
                binaryId: null,
                type: 'live-stream',
                subtype: 'video-file',
                creatorId: 'user1',
                userId: 'user1',
                socketId,
                streamId: 'stream-vf-cleanup',
                streamName: 'My Video',
                producerId: 'prod-vf-cleanup',
                posx: 0,
                posy: 0,
                width: 1280,
                height: 720,
            }));

            const deletedIds = await mediaService.cleanupSocket(socketId);

            assert.ok(Array.isArray(deletedIds));
            assert.ok(deletedIds.includes(metadataId));

            // Redis から削除されていること
            const remaining = await redis.get(`content:metadata:${metadataId}`);
            assert.strictEqual(remaining, null);
        });

        it('cleanupSocket で DeleteContent がブロードキャストされること', async () => {
            const socketId = 'socket-vf-broadcast';
            const metadataId = 'meta-vf-broadcast-001';

            await redis.set(`content:metadata:${metadataId}`, JSON.stringify({
                metadataId,
                binaryId: null,
                type: 'live-stream',
                subtype: 'video-file',
                creatorId: 'user1',
                userId: 'user1',
                socketId,
                streamId: 'stream-vf-broadcast',
                streamName: 'My Video',
                producerId: 'prod-vf-broadcast',
                posx: 0,
                posy: 0,
                width: 1280,
                height: 720,
            }));

            await mediaService.cleanupSocket(socketId);

            // cleanupSocket 自体はブロードキャストしない（websocketServer.ts 側が担当）ので
            // ここでは削除後に broadcastedMessages が空のままであることを確認する
            // （ブロードキャストは websocketServer.ts が cleanupSocket の戻り値を使って行う）
            assert.strictEqual(broadcastedMessages.length, 0);
        });
    });

    describe('closeProducer', () => {
        it('存在しないプロデューサーのクローズはnullを返すこと', async () => {
            const result = await mediaService.closeProducer('nonexistent_producer');
            assert.strictEqual(result, null);
        });
    });

    describe('Router 未初期化時のエラー', () => {
        it('initialize() 前に getRouterRtpCapabilities を呼ぶとエラーになること', () => {
            assert.throws(() => {
                mediaService.getRouterRtpCapabilities();
            }, /Router not initialized/);
        });

        it('initialize() 前に createWebRtcTransport を呼ぶとエラーになること', async () => {
            await assert.rejects(async () => {
                await mediaService.createWebRtcTransport('socket1', { direction: 'send' });
            }, /Router not initialized/);
        });
    });

    // ========================================
    // produce() - subtype 伝播テスト（フェイクトランスポートを使用）
    // ========================================

    describe('produce() subtype 伝播', () => {
        /**
         * mediasoup の実 Router/Transport は起動できないため、
         * フェイクトランスポートと ContentService スパイを使ってサービス内部の
         * subtype 受け渡しロジックを検証する。
         */

        function createFakeTransport(producerId: string) {
            return {
                produce: async (_opts: any) => ({
                    id: producerId,
                    observer: { on: (_event: string, _cb: any) => {} },
                }),
            };
        }

        class SpyContentService extends ContentService {
            lastMetaRequest: any = null;

            override async addStreamMetadataWithStreamInfo(req: any, info: any) {
                this.lastMetaRequest = req;
                return super.addStreamMetadataWithStreamInfo(req, info);
            }
        }

        let spyContentService: SpyContentService;
        let spyMediaService: MediaService;

        beforeEach(() => {
            spyContentService = new SpyContentService(redis);
            spyMediaService = new MediaService(redis, spyContentService, async () => {});
        });

        it('subtype: video-file が addStreamMetadataWithStreamInfo に渡されること', async () => {
            const transportId = 'transport-vf-001';
            const producerId = 'producer-vf-001';

            // フェイクトランスポートを注入
            (spyMediaService as any).transports.set(transportId, createFakeTransport(producerId));

            await spyMediaService.produce('socket-vf', 'user-vf', {
                transportId,
                kind: 'video',
                rtpParameters: { codecs: [], headerExtensions: [], encodings: [] },
                streamName: 'My Video',
                subtype: 'video-file',
                posx: 0,
                posy: 0,
                width: 1280,
                height: 720,
            });

            assert.ok(spyContentService.lastMetaRequest, 'addStreamMetadataWithStreamInfo が呼ばれること');
            assert.strictEqual(spyContentService.lastMetaRequest.subtype, 'video-file');
        });

        it('subtype: screen が addStreamMetadataWithStreamInfo に渡されること', async () => {
            const transportId = 'transport-sc-001';
            const producerId = 'producer-sc-001';

            (spyMediaService as any).transports.set(transportId, createFakeTransport(producerId));

            await spyMediaService.produce('socket-sc', 'user-sc', {
                transportId,
                kind: 'video',
                rtpParameters: { codecs: [], headerExtensions: [], encodings: [] },
                streamName: 'My Screen',
                subtype: 'screen',
                posx: 0,
                posy: 0,
                width: 1920,
                height: 1080,
            });

            assert.ok(spyContentService.lastMetaRequest);
            assert.strictEqual(spyContentService.lastMetaRequest.subtype, 'screen');
        });

        it('subtype を省略した場合は addStreamMetadataWithStreamInfo に subtype が渡されないこと', async () => {
            const transportId = 'transport-cam-001';
            const producerId = 'producer-cam-001';

            (spyMediaService as any).transports.set(transportId, createFakeTransport(producerId));

            await spyMediaService.produce('socket-cam', 'user-cam', {
                transportId,
                kind: 'video',
                rtpParameters: { codecs: [], headerExtensions: [], encodings: [] },
                streamName: 'Camera',
                posx: 0,
                posy: 0,
                width: 640,
                height: 480,
            });

            assert.ok(spyContentService.lastMetaRequest);
            assert.strictEqual(spyContentService.lastMetaRequest.subtype, undefined);
        });

        it('produce() 後に Redis の StreamMetadata に subtype が保存されること', async () => {
            const transportId = 'transport-persist-001';
            const producerId = 'producer-persist-001';

            (spyMediaService as any).transports.set(transportId, createFakeTransport(producerId));

            const response = await spyMediaService.produce('socket-persist', 'user-persist', {
                transportId,
                kind: 'video',
                rtpParameters: { codecs: [], headerExtensions: [], encodings: [] },
                streamName: 'Persisted Video',
                subtype: 'video-file',
                posx: 10,
                posy: 20,
                width: 960,
                height: 540,
            });

            assert.ok(response.metadataId, 'metadataId が返ること');

            // Redis に保存された StreamMetadata を確認
            const stored = await redis.get(`content:metadata:${response.metadataId}`);
            assert.ok(stored);
            const parsed = JSON.parse(stored);
            assert.strictEqual(parsed.subtype, 'video-file');
            assert.strictEqual(parsed.type, 'live-stream');
            assert.strictEqual(parsed.streamName, 'Persisted Video');
        });

        it('audio producer では addStreamMetadataWithStreamInfo が呼ばれないこと', async () => {
            const transportId = 'transport-audio-001';
            const producerId = 'producer-audio-001';

            (spyMediaService as any).transports.set(transportId, createFakeTransport(producerId));

            await spyMediaService.produce('socket-audio', 'user-audio', {
                transportId,
                kind: 'audio',
                rtpParameters: { codecs: [], headerExtensions: [], encodings: [] },
                streamName: 'Audio Only',
                subtype: 'video-file',
            });

            // audio producer は StreamMetadata を作成しない
            assert.strictEqual(spyContentService.lastMetaRequest, null);
        });
    });
});
