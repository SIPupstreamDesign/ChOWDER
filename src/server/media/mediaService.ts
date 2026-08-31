/**
 * MediaService - mediasoup の管理サービス
 * Worker, Router, Transport, Producer, Consumer をメモリで管理
 */

import * as mediasoup from 'mediasoup';
import { randomBytes } from 'crypto';
import type {
    Worker,
    Router,
    WebRtcTransport,
    Producer,
    Consumer,
    RtpCapabilities,
    DtlsParameters,
} from 'mediasoup/types';
import { Redis } from 'ioredis';
import { REDIS_KEYS } from '../common/redisKeys';
import type {
    StreamInfo,
    TransportInfo,
    ProducerInfo,
    ConsumerInfo,
    CreateTransportRequest,
    CreateTransportResponse,
    ConnectTransportRequest,
    ProduceRequest,
    ProduceResponse,
    ConsumeRequest,
    ConsumeResponse,
    ActiveProducersResponse,
} from './mediaTypes';
import type { AddStreamMetadataRequest } from '../content/contentTypes';

/**
 * mediasoup Worker 設定
 */
const getWorkerSettings = () => ({
    rtcMinPort: parseInt(process.env.MEDIASOUP_RTC_MIN_PORT || '10000', 10),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_RTC_MAX_PORT || '10100', 10),
    logLevel: 'warn' as const,
    logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
    ] as mediasoup.types.WorkerLogTag[],
});

/**
 * Router の RTP Codec Capabilities
 */
const ROUTER_CODECS: mediasoup.types.RtpCodecCapability[] = [
    {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        preferredPayloadType: 111,
    },
    {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
            'x-google-start-bitrate': 1000,
        },
        preferredPayloadType: 96,
    },
    {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
            'profile-id': 2,
            'x-google-start-bitrate': 1000,
        },
        preferredPayloadType: 98,
    },
    {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
        },
        preferredPayloadType: 102,
    },
];

/**
 * MediaService クラス
 */
export class MediaService {
    private redis: Redis;
    private contentService: import('../content/contentService').ContentService;
    private broadcastToAll: (message: any) => Promise<void>;
    private workers: Worker[] = [];
    private nextWorkerIndex: number = 0;
    private router: Router | null = null;

    // メモリ管理: Map
    private transports: Map<string, WebRtcTransport> = new Map();
    private transportInfos: Map<string, TransportInfo> = new Map();
    private producers: Map<string, Producer> = new Map();
    private producerInfos: Map<string, ProducerInfo> = new Map();
    private consumers: Map<string, Consumer> = new Map();
    private consumerInfos: Map<string, ConsumerInfo> = new Map();

    constructor(
        redis: Redis,
        contentService: import('../content/contentService').ContentService,
        broadcastToAll: (message: any) => Promise<void>
    ) {
        this.redis = redis;
        this.contentService = contentService;
        this.broadcastToAll = broadcastToAll;
    }

    /**
     * 初期化: Worker と Router の作成
     */
    async initialize(numWorkers: number = 1): Promise<void> {
        console.log('[MediaService] Initializing mediasoup...');

        const workerSettings = getWorkerSettings();
        console.log(`[MediaService] RTC port range: ${workerSettings.rtcMinPort}-${workerSettings.rtcMaxPort}`);

        // Worker を作成
        for (let i = 0; i < numWorkers; i++) {
            const worker = await mediasoup.createWorker(workerSettings);

            worker.on('died', () => {
                console.error(`[MediaService] Worker ${i} died, exiting...`);
                process.exit(1);
            });

            this.workers.push(worker);
            console.log(`[MediaService] Worker ${i} created [pid:${worker.pid}]`);
        }

        // Router を作成（現状は1つ）
        const worker = this.getNextWorker();
        this.router = await worker.createRouter({ mediaCodecs: ROUTER_CODECS });
        console.log(`[MediaService] Router created [id:${this.router.id}]`);

        console.log('[MediaService] Initialization complete');
    }

    /**
     * 次の Worker を取得（ラウンドロビン）
     */
    private getNextWorker(): Worker {
        const worker = this.workers[this.nextWorkerIndex];
        this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
        return worker;
    }

    /**
     * Router の RTP Capabilities を取得
     */
    getRouterRtpCapabilities(): RtpCapabilities {
        if (!this.router) {
            throw new Error('Router not initialized');
        }
        return this.router.rtpCapabilities;
    }

    /**
     * WebRTC Transport を作成
     */
    async createWebRtcTransport(
        socketId: string,
        request: CreateTransportRequest
    ): Promise<CreateTransportResponse> {
        if (!this.router) {
            throw new Error('Router not initialized');
        }

        // 複数のIPアドレスを設定（localhost + LAN + WAN）
        const listenIps = [
            {
                ip: '0.0.0.0',
                announcedIp: '127.0.0.1',  // localhost用
            },
        ];

        // LAN用のIPアドレスを追加
        const lanIp = process.env.MEDIASOUP_LAN_IP;
        if (lanIp) {
            listenIps.push({
                ip: '0.0.0.0',
                announcedIp: lanIp,
            });
        }

        // WAN（インターネット）用のIPアドレスを追加
        const wanIp = process.env.MEDIASOUP_WAN_IP;
        if (wanIp) {
            listenIps.push({
                ip: '0.0.0.0',
                announcedIp: wanIp,
            });
        }

        const transport = await this.router.createWebRtcTransport({
            listenIps,
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        });

        // メモリに保存
        this.transports.set(transport.id, transport);
        this.transportInfos.set(transport.id, {
            transportId: transport.id,
            socketId,
            direction: request.direction,
            created: new Date(),
        });

        const announcedIps = listenIps.map(ip => ip.announcedIp).join(', ');
        console.log(
            `[MediaService] WebRtcTransport created [id:${transport.id}, direction:${request.direction}, announcedIps:${announcedIps}]`
        );

        return {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        };
    }

    /**
     * Transport を接続
     */
    async connectTransport(request: ConnectTransportRequest): Promise<void> {
        const transport = this.transports.get(request.transportId);
        if (!transport) {
            throw new Error(`Transport not found: ${request.transportId}`);
        }

        await transport.connect({ dtlsParameters: request.dtlsParameters });
        console.log(`[MediaService] Transport connected [id:${request.transportId}]`);
    }

    /**
     * Producer を作成
     */
    async produce(
        socketId: string,
        userId: string,
        request: ProduceRequest
    ): Promise<ProduceResponse> {
        const transport = this.transports.get(request.transportId);
        if (!transport) {
            throw new Error(`Transport not found: ${request.transportId}`);
        }

        const producer = await transport.produce({
            kind: request.kind,
            rtpParameters: request.rtpParameters,
        });

        // streamName が指定された場合、既存のstreamIdを検索または新規生成
        let streamId: string | undefined;
        let metadataId: string | undefined;

        if (request.streamName) {
            // 同じsocketIdとstreamNameを持つ既存のStreamInfoを検索
            let existingStreamId: string | undefined;
            for (const [pid, info] of this.producerInfos.entries()) {
                if (info.socketId === socketId && info.streamId) {
                    const streamInfoStr = await this.redis.get(REDIS_KEYS.CONTENT.STREAM(info.streamId));
                    if (streamInfoStr) {
                        const streamInfo: StreamInfo = JSON.parse(streamInfoStr);
                        if (streamInfo.streamName === request.streamName) {
                            existingStreamId = info.streamId;
                            metadataId = streamInfo.metadataId;
                            break;
                        }
                    }
                }
            }

            if (existingStreamId) {
                // 既存のstreamIdを使用
                streamId = existingStreamId;
                console.log(`[MediaService] Using existing streamId [${streamId}] for ${request.kind} producer`);

                // StreamInfoのproducerIdsに追加
                const streamInfoStr = await this.redis.get(REDIS_KEYS.CONTENT.STREAM(streamId));
                if (streamInfoStr) {
                    const streamInfo: StreamInfo = JSON.parse(streamInfoStr);
                    streamInfo.producerIds.push(producer.id);
                    await this.redis.set(
                        REDIS_KEYS.CONTENT.STREAM(streamId),
                        JSON.stringify(streamInfo)
                    );
                }
            } else {
                // 新しいstreamIdを生成
                streamId = this.generateId();
                console.log(`[MediaService] Created new streamId [${streamId}] for ${request.kind} producer`);

                // StreamMetadataとStreamInfoをアトミックに作成（video producerのときのみ）
                const created = new Date().toISOString();
                if (request.kind === 'video') {
                    // content:metadata と content:stream を MULTI/EXEC で一括書き込み
                    const metaRequest: AddStreamMetadataRequest = {
                        streamId,
                        streamName: request.streamName,
                        userId,
                        creatorId: userId,
                        socketId,
                        producerId: producer.id,
                        posx: request.posx ?? 100,
                        posy: request.posy ?? 100,
                        width: request.width ?? 640,
                        height: request.height ?? 480,
                    };
                    if (request.subtype !== undefined) {
                        metaRequest.subtype = request.subtype;
                    }
                    const streamMetadata = await this.contentService.addStreamMetadataWithStreamInfo(
                        metaRequest,
                        {
                            streamId,
                            userId,
                            socketId,
                            producerIds: [producer.id],
                            streamName: request.streamName,
                            created,
                        }
                    );
                    metadataId = streamMetadata.metadataId;

                    // NOTE: AddContent/NewContentAdded のブロードキャストは
                    // commandHandler.produce() が NewContentAdded として送信するため、
                    // ここでの二重ブロードキャストは行わない
                    console.log(`[MediaService] Stream metadata created [metadataId:${metadataId}, streamId:${streamId}]`);
                } else {
                    // audio producer のみの場合は StreamInfo だけ作成（metadataなし）
                    const streamInfo: StreamInfo = {
                        streamId,
                        userId,
                        socketId,
                        producerIds: [producer.id],
                        streamName: request.streamName,
                        created,
                    };
                    await this.redis.set(
                        REDIS_KEYS.CONTENT.STREAM(streamId),
                        JSON.stringify(streamInfo)
                    );
                }
            }
        }

        // メモリに保存
        this.producers.set(producer.id, producer);
        this.producerInfos.set(producer.id, {
            producerId: producer.id,
            socketId,
            userId,
            kind: request.kind,
            streamId,
            created: new Date(),
        });

        // Producerがcloseされたときの自動クリーンアップ
        producer.observer.on('close', async () => {
            console.log(`[MediaService] Producer closed [id:${producer.id}]`);

            const producerInfo = this.producerInfos.get(producer.id);
            if (producerInfo && producerInfo.streamId) {
                const streamInfoStr = await this.redis.get(REDIS_KEYS.CONTENT.STREAM(producerInfo.streamId));
                if (streamInfoStr) {
                    const streamInfo: StreamInfo = JSON.parse(streamInfoStr);

                    // producerIdsから削除
                    streamInfo.producerIds = streamInfo.producerIds.filter(id => id !== producer.id);

                    if (streamInfo.producerIds.length === 0) {
                        // 全てのProducerが削除された場合
                        if (streamInfo.metadataId) {
                            // content:metadata と content:stream を MULTI/EXEC で一括削除
                            await this.contentService.deleteStreamMetadataWithStreamId(
                                streamInfo.metadataId,
                                producerInfo.streamId
                            );

                            // 全クライアントにDeleteContentを通知
                            await this.broadcastToAll({
                                jsonrpc: '2.0',
                                id: String(Math.random()),
                                method: 'DeleteContent',
                                params: { metadataId: streamInfo.metadataId },
                                to: 'client',
                            });
                        } else {
                            // metadataIdなし（audio only stream）: StreamInfoのみ削除
                            await this.redis.del(REDIS_KEYS.CONTENT.STREAM(producerInfo.streamId));
                            console.log(`[MediaService] StreamInfo deleted [streamId:${producerInfo.streamId}]`);
                        }
                    } else {
                        // まだ他のProducerが残っている場合、StreamInfoを更新
                        await this.redis.set(
                            REDIS_KEYS.CONTENT.STREAM(producerInfo.streamId),
                            JSON.stringify(streamInfo)
                        );
                        console.log(`[MediaService] StreamInfo updated, remaining producers: ${streamInfo.producerIds.length}`);
                    }
                }
            }

            // ProducerInfoから削除
            if (producerInfo) {
                this.producerInfos.delete(producer.id);
            }

            // Producerマップから削除
            this.producers.delete(producer.id);
        });

        console.log(
            `[MediaService] Producer created [id:${producer.id}, kind:${request.kind}, streamId:${streamId}, metadataId:${metadataId}]`
        );

        return {
            producerId: producer.id,
            streamId,
            metadataId,
        };
    }

    /**
     * Producer を閉じる
     */
    async closeProducer(producerId: string, socketId?: string): Promise<string | null> {
        const producer = this.producers.get(producerId);
        if (!producer) {
            console.log(`[MediaService] Producer not found: ${producerId}`);
            return null;
        }

        const producerInfo = this.producerInfos.get(producerId);

        // 所有権チェック（socketIdが指定されている場合）
        if (socketId && producerInfo && producerInfo.socketId !== socketId) {
            throw new Error(`Unauthorized: Producer ${producerId} is not owned by socket ${socketId}`);
        }

        let deletedMetadataId: string | null = null;

        // StreamInfoからproducerIdを削除
        if (producerInfo && producerInfo.streamId) {
            const streamInfoStr = await this.redis.get(REDIS_KEYS.CONTENT.STREAM(producerInfo.streamId));
            if (streamInfoStr) {
                const streamInfo: StreamInfo = JSON.parse(streamInfoStr);

                // producerIdsから削除
                streamInfo.producerIds = streamInfo.producerIds.filter(id => id !== producerId);

                if (streamInfo.producerIds.length === 0) {
                    // 全てのProducerが削除された場合
                    if (streamInfo.metadataId) {
                        // content:metadata と content:stream を MULTI/EXEC で一括削除
                        await this.contentService.deleteStreamMetadataWithStreamId(
                            streamInfo.metadataId,
                            producerInfo.streamId
                        );
                        deletedMetadataId = streamInfo.metadataId;
                    } else {
                        // metadataIdなし（audio only stream）: StreamInfoのみ削除
                        await this.redis.del(REDIS_KEYS.CONTENT.STREAM(producerInfo.streamId));
                        console.log(`[MediaService] StreamInfo deleted [streamId:${producerInfo.streamId}]`);
                    }
                } else {
                    // まだ他のProducerが残っている場合
                    await this.redis.set(
                        REDIS_KEYS.CONTENT.STREAM(producerInfo.streamId),
                        JSON.stringify(streamInfo)
                    );
                    console.log(`[MediaService] StreamInfo updated, remaining producers: ${streamInfo.producerIds.length}`);
                }
            }
        }

        // Producerを閉じる
        producer.close();
        this.producers.delete(producerId);
        if (producerInfo) {
            this.producerInfos.delete(producerId);
        }

        console.log(`[MediaService] Producer closed manually [id:${producerId}]`);

        return deletedMetadataId;
    }

    /**
     * Consumer を作成
     */
    async consume(
        socketId: string,
        request: ConsumeRequest
    ): Promise<ConsumeResponse> {
        const transport = this.transports.get(request.transportId);
        if (!transport) {
            throw new Error(`Transport not found: ${request.transportId}`);
        }

        const producer = this.producers.get(request.producerId);
        if (!producer) {
            throw new Error(`Producer not found: ${request.producerId}`);
        }

        // Router が Consumer を作成可能かチェック
        if (
            !this.router!.canConsume({
                producerId: request.producerId,
                rtpCapabilities: request.rtpCapabilities,
            })
        ) {
            throw new Error('Cannot consume this producer');
        }

        const consumer = await transport.consume({
            producerId: request.producerId,
            rtpCapabilities: request.rtpCapabilities,
            paused: true, // 初期状態は一時停止
        });

        // メモリに保存
        this.consumers.set(consumer.id, consumer);
        this.consumerInfos.set(consumer.id, {
            consumerId: consumer.id,
            socketId,
            producerId: request.producerId,
            kind: consumer.kind as 'audio' | 'video',
            created: new Date(),
        });

        console.log(
            `[MediaService] Consumer created [id:${consumer.id}, producerId:${request.producerId}]`
        );

        return {
            consumerId: consumer.id,
            producerId: request.producerId,
            kind: consumer.kind as 'audio' | 'video',
            rtpParameters: consumer.rtpParameters,
        };
    }

    /**
     * Consumer を再開
     */
    async resumeConsumer(consumerId: string): Promise<void> {
        const consumer = this.consumers.get(consumerId);
        if (!consumer) {
            throw new Error(`Consumer not found: ${consumerId}`);
        }

        await consumer.resume();
        console.log(`[MediaService] Consumer resumed [id:${consumerId}]`);
    }

    /**
     * アクティブな Producer 一覧を取得
     */
    async getActiveProducers(): Promise<ActiveProducersResponse> {
        const producers: ActiveProducersResponse['producers'] = [];

        for (const [producerId, info] of this.producerInfos.entries()) {
            let streamName: string | undefined;
            let metadataId: string | undefined;

            // streamId があれば Redis から取得
            if (info.streamId) {
                const streamInfoStr = await this.redis.get(
                    REDIS_KEYS.CONTENT.STREAM(info.streamId)
                );
                if (streamInfoStr) {
                    const streamInfo: StreamInfo = JSON.parse(streamInfoStr);
                    streamName = streamInfo.streamName;
                    metadataId = streamInfo.metadataId;
                }
            }

            producers.push({
                producerId,
                userId: info.userId,
                socketId: info.socketId,  // socketIdを追加
                kind: info.kind,
                streamId: info.streamId,
                streamName,
                metadataId,
            });
        }

        return { producers };
    }

    /**
     * クライアント切断時のクリーンアップ
     */
    async cleanupSocket(socketId: string): Promise<string[]> {
        console.log(`[MediaService] Cleaning up socket: ${socketId}`);

        // StreamMetadataを削除
        const deletedMetadataIds = await this.contentService.deleteStreamMetadata(socketId);
        if (deletedMetadataIds.length > 0) {
            console.log(`[MediaService] Deleted ${deletedMetadataIds.length} stream metadata(s): ${deletedMetadataIds.join(', ')}`);
        }

        // Transport のクリーンアップ
        for (const [transportId, info] of this.transportInfos.entries()) {
            if (info.socketId === socketId) {
                const transport = this.transports.get(transportId);
                if (transport) {
                    transport.close();
                    this.transports.delete(transportId);
                }
                this.transportInfos.delete(transportId);
                console.log(`[MediaService] Transport closed: ${transportId}`);
            }
        }

        // Producer のクリーンアップ
        const streamIdsToDelete = new Set<string>();
        for (const [producerId, info] of this.producerInfos.entries()) {
            if (info.socketId === socketId) {
                const producer = this.producers.get(producerId);
                if (producer) {
                    producer.close();
                    this.producers.delete(producerId);
                }

                // streamIdを収集（後でまとめて削除）
                if (info.streamId) {
                    streamIdsToDelete.add(info.streamId);
                }

                this.producerInfos.delete(producerId);
                console.log(`[MediaService] Producer closed: ${producerId}`);
            }
        }

        // StreamInfoの削除（該当socketIdのProducerがすべて削除された後）
        for (const streamId of streamIdsToDelete) {
            await this.redis.del(REDIS_KEYS.CONTENT.STREAM(streamId));
            console.log(`[MediaService] StreamInfo deleted: ${streamId}`);
        }

        // Consumer のクリーンアップ
        for (const [consumerId, info] of this.consumerInfos.entries()) {
            if (info.socketId === socketId) {
                const consumer = this.consumers.get(consumerId);
                if (consumer) {
                    consumer.close();
                    this.consumers.delete(consumerId);
                }
                this.consumerInfos.delete(consumerId);
                console.log(`[MediaService] Consumer closed: ${consumerId}`);
            }
        }

        return deletedMetadataIds;
    }

    /**
     * UUID 生成（14文字の16進数列）
     */
    private generateId(): string {
        return randomBytes(7).toString('hex');
    }

    /**
     * シャットダウン
     */
    async shutdown(): Promise<void> {
        console.log('[MediaService] Shutting down...');

        // すべての Transport/Producer/Consumer をクローズ
        for (const transport of this.transports.values()) {
            transport.close();
        }
        for (const producer of this.producers.values()) {
            producer.close();
        }
        for (const consumer of this.consumers.values()) {
            consumer.close();
        }

        // Worker をクローズ
        for (const worker of this.workers) {
            worker.close();
        }

        console.log('[MediaService] Shutdown complete');
    }
}
