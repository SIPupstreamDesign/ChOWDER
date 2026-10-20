/**
 * コンテンツ管理サービス
 * Redisを使ってメタデータとバイナリデータを管理
 */

import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';
import { PerspectiveCamera } from 'three';
import { REDIS_KEYS, REDIS_PATTERNS } from '../common/redisKeys';
import {
    ContentMetadata,
    ITownsCameraData,
    StreamMetadata,
    AddContentRequest,
    AddStreamMetadataRequest,
    UpdateContentRequest,
    GetContentResponse,
    ContentType,
} from './contentTypes';
import {
    compareContentMetadataForDisplayOrder,
    normalizeContentZIndex,
} from '../../common/contentOrder';
import { isCameraRevision, type CameraSourceLease, type CameraSourceUpdate } from '../../common/cameraState';

interface StoredCamera extends ITownsCameraData {
    sourceInstanceId: string;
    sourceEpoch: number;
    sourceSequence: number;
    ownerSocketId: string;
    sourceUrl: string;
    legacyCameraData?: string;
}

/**
 * コンテンツサービスクラス
 */
export class ContentService {
    private redis: Redis;
    private readonly cameraQueues = new Map<string, Promise<void>>();

    constructor(redis: Redis) {
        this.redis = redis;
    }

    /**
     * 更新コマンドで受け取ったメタデータ更新値から、永続化してよいフィールドのみを残す。
     * type/contentType は transport 上の識別子混入を防ぐため除外する。
     */
    private sanitizeMetadataUpdates(updates: Record<string, unknown>): Record<string, unknown> {
        const {
            metadataId: _metadataId,
            id: _id,
            binaryId: _binaryId,
            type: _type,
            contentType: _contentType,
            creatorId: _creatorId,
            createdAt: _createdAt,
            date: _date,
            cameraWorldMatrix: _cameraWorldMatrix,
            cameraParams: _cameraParams,
            ...rawUpdates
        } = updates;

        return Object.fromEntries(
            Object.entries(rawUpdates).filter(([, value]) => {
                return value !== undefined;
            }),
        );
    }

    /**
     * 表示順判定で利用するため zindex を常に number へ正規化する
     */
    private normalizeContentMetadata(metadata: ContentMetadata): ContentMetadata {
        return {
            ...metadata,
            zindex: normalizeContentZIndex(metadata.zindex),
        };
    }

    /**
     * StreamMetadata のまま zindex を正規化する
     */
    private normalizeStreamMetadata(metadata: StreamMetadata): StreamMetadata {
        return {
            ...metadata,
            zindex: normalizeContentZIndex(metadata.zindex),
        };
    }

    /**
     * MULTI/EXEC の実行結果を検証する
     * @throws transactionがアボートされた場合、またはコマンドエラーがあった場合
     */
    private assertExecResult(results: Array<[Error | null, unknown]> | null): void {
        if (results === null) {
            throw new Error('Redis MULTI/EXEC transaction was aborted (WATCH triggered)');
        }
        for (const [err] of results) {
            if (err) {
                throw new Error(`Redis MULTI/EXEC command failed: ${err.message}`);
            }
        }
    }

    /**
     * UUID生成（14文字の16進数列）
     */
    private generateId(): string {
        return randomBytes(7).toString('hex');
    }

    /**
     * Redis クライアントを返す（TileImageService 等から利用）
     */
    getRedis(): Redis {
        return this.redis;
    }

    /**
     * コンテンツを追加
     * 注意: live-stream タイプは addStreamMetadata を使用すること
     */
    async addContent(request: AddContentRequest): Promise<ContentMetadata> {
        const { metadata, binary } = request;

        // creatorIdの必須チェック
        if (!metadata.creatorId) {
            throw new Error('creatorId is required');
        }

        const isTileimage = metadata.type === ContentType.TILEIMAGE;
        const metadataId = isTileimage ? this.generateId() : metadata.metadataId || this.generateId();

        // binaryIdはmetadataIdと同一（1対1対応）
        const binaryId = metadataId;

        // メタデータの作成
        // cameraWorldMatrix/cameraParams は content:camera:{id} キーに別保存するためここからは除外
        const { cameraWorldMatrix: _cwm, cameraParams: _cp, zIndex: _zI, ...safeInput } = metadata as any;
        const now = new Date().toISOString();
        const fullMetadata: ContentMetadata = {
            posx: 0,
            posy: 0,
            width: 0,
            height: 0,
            visible: true,
            ...safeInput,
            // 固定フィールド（上書き不可）
            metadataId,
            binaryId,
            type: (metadata.type ?? safeInput.type) as ContentType,
            creatorId: metadata.creatorId!,
            date: now,
            createdAt: (metadata as any).createdAt ?? now,
        };
        const normalizedMetadata = this.normalizeContentMetadata(fullMetadata);

        if (isTileimage) {
            if (binary !== undefined && binary !== null && binary.byteLength !== 0) {
                throw new Error('Tileimage AddContent cannot include image binary data');
            }
            const createResult = await this.redis.set(
                REDIS_KEYS.CONTENT.METADATA(metadataId),
                JSON.stringify(normalizedMetadata),
                'NX',
            );
            if (createResult !== 'OK') {
                throw new Error(`Tileimage metadata ID collision: ${metadataId}`);
            }
            return normalizedMetadata;
        }

        // tileimage以外のバイナリなしコンテンツをメタデータのみ保存する。
        if (!binary) {
            await this.redis.set(
                REDIS_KEYS.CONTENT.METADATA(metadataId),
                JSON.stringify(normalizedMetadata)
            );
            return normalizedMetadata;
        }

        // メタデータとバイナリをアトミックに保存（MULTI/EXEC）
        const addResults = await this.redis.multi()
            .set(REDIS_KEYS.CONTENT.BINARY(binaryId), binary)
            .set(REDIS_KEYS.CONTENT.METADATA(metadataId), JSON.stringify(normalizedMetadata))
            .exec();
        this.assertExecResult(addResults);

        return normalizedMetadata;
    }

    /**
     * コンテンツを取得（webgl タイプの場合はカメラデータもマージして返す）
     */
    async getContent(metadataId: string): Promise<GetContentResponse | null> {
        // メタデータを取得
        const metadataStr = await this.redis.get(REDIS_KEYS.CONTENT.METADATA(metadataId));
        if (!metadataStr) {
            return null;
        }

        const metadata = this.normalizeContentMetadata(JSON.parse(metadataStr) as ContentMetadata);

        // StreamMetadataの場合はバイナリなし
        if (metadata.binaryId === null) {
            const cameraData = metadata.type === ContentType.WEBGL
                ? await this.getCameraData(metadataId)
                : undefined;
            return { metadata, binary: Buffer.alloc(0), cameraData: cameraData ?? undefined };
        }

        // バイナリデータを取得
        const binary = await this.redis.getBuffer(REDIS_KEYS.CONTENT.BINARY(metadata.binaryId));
        if (!binary) {
            throw new Error(`Binary data not found for binaryId: ${metadata.binaryId}`);
        }

        // webgl タイプの場合はカメラデータも取得
        const cameraData = metadata.type === ContentType.WEBGL
            ? await this.getCameraData(metadataId)
            : undefined;

        return { metadata, binary, cameraData: cameraData ?? undefined };
    }

    /**
     * iTowns カメラデータを取得（content:camera:{id}）
     */
    async getCameraData(metadataId: string): Promise<ITownsCameraData | null> {
        const str = await this.redis.get(REDIS_KEYS.CONTENT.CAMERA(metadataId));
        if (!str) return null;
        const camera: StoredCamera = JSON.parse(str);
        const metadata = await this.getMetadata(metadataId);
        if (!isCameraRevision(camera) || camera.cameraWorldMatrix === '' || metadata === null || camera.sourceUrl !== (metadata.url ?? '')) {
            return null;
        }
        return {
            metadataId,
            generation: camera.generation,
            revision: camera.revision,
            cameraWorldMatrix: camera.cameraWorldMatrix,
            cameraParams: camera.cameraParams,
            sourceUrl: camera.sourceUrl,
        };
    }

    async registerCameraSource(metadataId: string, sourceInstanceId: string, ownerSocketId: string): Promise<CameraSourceLease> {
        return this.serializeCamera(metadataId, async (): Promise<CameraSourceLease> => {
            const metadata = await this.getMetadata(metadataId);
            if (metadata === null || metadata.type !== ContentType.WEBGL || sourceInstanceId.length === 0 || sourceInstanceId.length > 128) {
                throw new Error('Invalid camera source registration');
            }
            const serialized = await this.redis.get(REDIS_KEYS.CONTENT.CAMERA(metadataId));
            const previous: StoredCamera | null = serialized === null ? null : JSON.parse(serialized);
            const sameContent = previous !== null && isCameraRevision(previous) && previous.sourceUrl === (metadata.url ?? '');
            if (sameContent && previous.ownerSocketId === ownerSocketId && previous.sourceInstanceId === sourceInstanceId) {
                return { generation: previous.generation, sourceEpoch: previous.sourceEpoch };
            }
            const generation = sameContent ? previous.generation : await this.redis.incr(REDIS_KEYS.CONTENT.CAMERA_GENERATION);
            const camera: StoredCamera = {
                metadataId,
                generation,
                revision: sameContent ? previous.revision : 0,
                cameraWorldMatrix: sameContent ? previous.cameraWorldMatrix : '',
                cameraParams: sameContent ? previous.cameraParams : '',
                sourceInstanceId,
                sourceEpoch: sameContent ? previous.sourceEpoch + 1 : 1,
                sourceSequence: 0,
                ownerSocketId,
                sourceUrl: metadata.url ?? '',
                legacyCameraData: previous?.legacyCameraData,
            };
            await this.redis.set(REDIS_KEYS.CONTENT.CAMERA(metadataId), JSON.stringify(camera));
            return { generation, sourceEpoch: camera.sourceEpoch };
        });
    }

    /**
     * iTowns カメラデータを保存（content:camera:{id}のみ書き込む）
     */
    async updateCameraData(
        metadataId: string,
        cameraWorldMatrix: string,
        cameraParams: string,
        source: CameraSourceUpdate,
    ): Promise<ITownsCameraData | null> {
        return this.serializeCamera(metadataId, async (): Promise<ITownsCameraData | null> => {
            const serialized = await this.redis.get(REDIS_KEYS.CONTENT.CAMERA(metadataId));
            const metadata = await this.getMetadata(metadataId);
            if (serialized === null || metadata === null || source === undefined) {
                throw new Error('Camera source is not registered');
            }
            const previous: StoredCamera = JSON.parse(serialized);
            if (previous.generation !== source.generation || previous.sourceEpoch !== source.sourceEpoch
                || previous.sourceInstanceId !== source.sourceInstanceId || previous.ownerSocketId !== source.ownerSocketId
                || previous.sourceUrl !== (metadata.url ?? '')) {
                throw new Error('Camera source has been replaced');
            }
            if (!Number.isSafeInteger(source.sourceSequence) || source.sourceSequence <= 0) {
                throw new Error('Invalid camera sequence');
            }
            if (source.sourceSequence <= previous.sourceSequence) {
                return null;
            }
            const stored: StoredCamera = { ...previous, cameraWorldMatrix, cameraParams, revision: previous.revision + 1, sourceSequence: source.sourceSequence };
            await this.redis.set(REDIS_KEYS.CONTENT.CAMERA(metadataId), JSON.stringify(stored));
            return { metadataId, generation: stored.generation, revision: stored.revision, cameraWorldMatrix, cameraParams, sourceUrl: stored.sourceUrl };
        });
    }

    private async serializeCamera<Result>(metadataId: string, operation: () => Promise<Result>): Promise<Result> {
        const previous = this.cameraQueues.get(metadataId) ?? Promise.resolve();
        const result = previous.then(operation);
        const settled = result.then((): void => { }, (): void => { });
        this.cameraQueues.set(metadataId, settled);
        try {
            return await result;
        } finally {
            if (this.cameraQueues.get(metadataId) === settled) {
                this.cameraQueues.delete(metadataId);
            }
        }
    }

    async migrateLegacyCameraData(): Promise<void> {
        const keys = await this.redis.keys('content:camera:*');
        for (const key of keys) {
            const serialized = await this.redis.get(key);
            if (serialized === null) {
                continue;
            }
            try {
                const legacy: { metadataId: string; cameraWorldMatrix: string; cameraParams: string } = JSON.parse(serialized);
                if (isCameraRevision(legacy)) {
                    continue;
                }
                const params: Record<string, unknown> = JSON.parse(legacy.cameraParams);
                const matrix: unknown = JSON.parse(legacy.cameraWorldMatrix);
                const metadata = await this.getMetadata(legacy.metadataId);
                const numericFields = ['fovy', 'aspect', 'near', 'far', 'zoom', 'filmOffset', 'filmGauge', 'preSSE', 'viewportWidth', 'viewportHeight'];
                if (metadata === null || metadata.type !== ContentType.WEBGL
                    || !Array.isArray(matrix) || matrix.length !== 16 || !matrix.every((value): boolean => { return typeof value === 'number' && Number.isFinite(value); })
                    || !numericFields.every((field): boolean => { return typeof params[field] === 'number' && Number.isFinite(params[field]); })) {
                    throw new Error('Legacy camera is incomplete');
                }
                const camera = new PerspectiveCamera(Number(params.fovy), Number(params.aspect), Number(params.near), Number(params.far));
                camera.zoom = Number(params.zoom);
                camera.filmOffset = Number(params.filmOffset);
                camera.filmGauge = Number(params.filmGauge);
                camera.updateProjectionMatrix();
                const migrated: StoredCamera & { legacyCameraData: string } = {
                    metadataId: legacy.metadataId,
                    generation: await this.redis.incr(REDIS_KEYS.CONTENT.CAMERA_GENERATION),
                    revision: 1,
                    sourceEpoch: 0,
                    sourceSequence: 0,
                    sourceInstanceId: '',
                    ownerSocketId: '',
                    sourceUrl: metadata.url ?? '',
                    cameraWorldMatrix: legacy.cameraWorldMatrix,
                    cameraParams: JSON.stringify({ ...params, cameraType: 'perspective', projectionMatrix: camera.projectionMatrix.toArray(), view: null }),
                    legacyCameraData: serialized,
                };
                await this.redis.set(key, JSON.stringify(migrated));
            } catch (error: unknown) {
                console.error('[CameraMigration] Preserving unconvertible camera', key, error);
            }
        }
    }

    /**
     * メタデータのみ取得
     */
    async getMetadata(metadataId: string): Promise<ContentMetadata | null> {
        const metadataStr = await this.redis.get(REDIS_KEYS.CONTENT.METADATA(metadataId));
        if (!metadataStr) {
            return null;
        }
        return this.normalizeContentMetadata(JSON.parse(metadataStr) as ContentMetadata);
    }

    /**
     * 全メタデータを取得
     */
    async getAllMetadata(): Promise<ContentMetadata[]> {
        const keys = await this.redis.keys(REDIS_PATTERNS.CONTENT_METADATA);
        const metadataList: ContentMetadata[] = [];

        for (const key of keys) {
            const metadataStr = await this.redis.get(key);
            if (metadataStr) {
                metadataList.push(this.normalizeContentMetadata(JSON.parse(metadataStr) as ContentMetadata));
            }
        }

        return metadataList.sort(compareContentMetadataForDisplayOrder);
    }

    /**
     * メタデータを更新
     */
    async updateMetadata(
        metadataId: string,
        updates: Partial<ContentMetadata>
    ): Promise<ContentMetadata | null> {
        const metadata = await this.getMetadata(metadataId);
        if (!metadata) {
            return null;
        }

        const safeUpdates = this.sanitizeMetadataUpdates(updates as unknown as Record<string, unknown>);

        const updatedMetadata = {
            ...metadata,
            ...safeUpdates,
            metadataId, // IDは変更不可
            creatorId: metadata.creatorId, // creatorIdは変更不可
            date: new Date().toISOString(),
            createdAt: metadata.createdAt, // 作成日時は変更不可
        };
        const normalizedMetadata = this.normalizeContentMetadata(updatedMetadata as ContentMetadata);

        await this.redis.set(
            REDIS_KEYS.CONTENT.METADATA(metadataId),
            JSON.stringify(normalizedMetadata)
        );

        return normalizedMetadata;
    }

    /**
     * コンテンツを更新（バイナリも含む）
     * 注意: live-stream タイプはバイナリを持たないため、binary 引数は無視される
     */
    async updateContent(request: UpdateContentRequest): Promise<ContentMetadata | null> {
        const { metadataId, binary, metadata: updates } = request;

        const currentMetadata = await this.getMetadata(metadataId);
        if (!currentMetadata) {
            return null;
        }

        // バイナリデータが提供されている場合は上書き
        // ただし、live-stream の場合は無視（binaryId が null）

        const safeUpdates = this.sanitizeMetadataUpdates(updates as unknown as Record<string, unknown>);

        // メタデータを更新
        const updatedMetadata: ContentMetadata = {
            ...currentMetadata,
            ...safeUpdates,
            metadataId,
            binaryId: currentMetadata.binaryId, // 元の binaryId を維持
            creatorId: currentMetadata.creatorId, // creatorIdは変更不可
            date: new Date().toISOString(),
            createdAt: currentMetadata.createdAt, // 作成日時は変更不可
        };
        const normalizedMetadata = this.normalizeContentMetadata(updatedMetadata);

        // バイナリとメタデータをアトミックに更新（MULTI/EXEC）
        if (binary && currentMetadata.binaryId !== null) {
            const updateResults = await this.redis.multi()
                .set(REDIS_KEYS.CONTENT.BINARY(metadataId), binary)
                .set(REDIS_KEYS.CONTENT.METADATA(metadataId), JSON.stringify(normalizedMetadata))
                .exec();
            this.assertExecResult(updateResults);
        } else {
            // バイナリなし or live-stream の場合はメタデータのみ更新
            await this.redis.set(
                REDIS_KEYS.CONTENT.METADATA(metadataId),
                JSON.stringify(normalizedMetadata)
            );
        }

        return normalizedMetadata;
    }

    /**
     * コンテンツを削除
     * live-stream の場合はバイナリを持たないため、メタデータのみ削除
     */
    async deleteContent(metadataId: string): Promise<boolean> {
        const metadata = await this.getMetadata(metadataId);
        if (!metadata) {
            return false;
        }

        // メタデータとバイナリをアトミックに削除（MULTI/EXEC）
        // live-stream の場合は binaryId が null なので、バイナリキーは存在しないが
        // DEL は存在しないキーでもエラーにならないため問題なし
        if (metadata.binaryId !== null) {
            // 通常のコンテンツ: メタデータとバイナリを削除
            // tileimage の場合はタイルデータ（Hashキー）も合わせて削除
            // webgl の場合はカメラデータキーも合わせて削除（存在しなくても DEL はエラーにならない）
            const multi = this.redis.multi()
                .del(REDIS_KEYS.CONTENT.METADATA(metadataId))
                .del(REDIS_KEYS.CONTENT.BINARY(metadataId))
                .del(REDIS_KEYS.CONTENT.CAMERA(metadataId));
            if (metadata.type === ContentType.TILEIMAGE) {
                multi.del(REDIS_KEYS.CONTENT.TILE_DATA(metadataId));
            }
            const deleteResults = await multi.exec();
            this.assertExecResult(deleteResults);
        } else {
            // live-stream: メタデータのみ削除
            await this.redis.del(REDIS_KEYS.CONTENT.METADATA(metadataId));
        }

        return true;
    }

    /**
     * バイナリデータのサイズを取得
     */
    async getBinarySize(binaryId: string): Promise<number | null> {
        const binary = await this.redis.getBuffer(REDIS_KEYS.CONTENT.BINARY(binaryId));
        if (!binary) {
            return null;
        }
        return binary.length;
    }

    /**
     * ライブストリームメタデータを追加
     */
    async addStreamMetadata(request: AddStreamMetadataRequest): Promise<StreamMetadata> {
        const metadataId = this.generateId();

        const now = new Date().toISOString();
        const streamMetadata: StreamMetadata = {
            metadataId,
            binaryId: null,
            type: ContentType.LIVE_STREAM,
            creatorId: request.creatorId,
            streamId: request.streamId,
            streamName: request.streamName,
            userId: request.userId,
            socketId: request.socketId,
            producerId: request.producerId,
            posx: request.posx,
            posy: request.posy,
            width: request.width,
            height: request.height,
            visible: true,
            zindex: 10,
            date: now,
            createdAt: now,
        };
        if (request.subtype !== undefined) {
            streamMetadata.subtype = request.subtype;
        }
        const normalizedMetadata = this.normalizeStreamMetadata(streamMetadata);

        await this.redis.set(
            REDIS_KEYS.CONTENT.METADATA(metadataId),
            JSON.stringify(normalizedMetadata)
        );

        console.log(`[ContentService] Stream metadata added [metadataId:${metadataId}, streamId:${request.streamId}]`);

        return normalizedMetadata;
    }

    /**
     * ライブストリームメタデータを削除（該当socketIdの全エントリを一括アトミック削除）
     */
    async deleteStreamMetadata(socketId: string): Promise<string[]> {
        const keys = await this.redis.keys(REDIS_PATTERNS.CONTENT_METADATA);
        const toDelete: Array<{ key: string; metadataId: string; streamId: string }> = [];

        // 削除対象を収集
        for (const key of keys) {
            const metadataStr = await this.redis.get(key);
            if (metadataStr) {
                const metadata = JSON.parse(metadataStr);
                if (metadata.type === 'live-stream' && metadata.socketId === socketId) {
                    toDelete.push({ key, metadataId: metadata.metadataId, streamId: metadata.streamId });
                }
            }
        }

        if (toDelete.length === 0) {
            return [];
        }

        // 収集した全エントリを MULTI/EXEC で一括削除
        const pipeline = this.redis.multi();
        for (const { key } of toDelete) {
            pipeline.del(key);
        }
        const results = await pipeline.exec();
        this.assertExecResult(results);

        const deletedMetadataIds = toDelete.map(({ metadataId, streamId }) => {
            console.log(`[ContentService] Stream metadata deleted [metadataId:${metadataId}, streamId:${streamId}]`);
            return metadataId;
        });

        return deletedMetadataIds;
    }

    /**
     * ライブストリームメタデータと StreamInfo をアトミックに追加
     * produce() での content:metadata と content:stream の書き込みを原子化する
     */
    async addStreamMetadataWithStreamInfo(
        request: AddStreamMetadataRequest,
        streamInfoBase: {
            streamId: string;
            userId: string;
            socketId: string;
            producerIds: string[];
            streamName: string;
            created: string;
        }
    ): Promise<StreamMetadata> {
        const metadataId = this.generateId();

        const now = new Date().toISOString();
        const streamMetadata: StreamMetadata = {
            metadataId,
            binaryId: null,
            type: ContentType.LIVE_STREAM,
            creatorId: request.creatorId,
            streamId: request.streamId,
            streamName: request.streamName,
            userId: request.userId,
            socketId: request.socketId,
            producerId: request.producerId,
            posx: request.posx,
            posy: request.posy,
            width: request.width,
            height: request.height,
            visible: true,
            zindex: 10,
            date: now,
            createdAt: now,
        };
        if (request.subtype !== undefined) {
            streamMetadata.subtype = request.subtype;
        }
        const normalizedMetadata = this.normalizeStreamMetadata(streamMetadata);

        // metadataId を StreamInfo に埋め込んで一括書き込み
        const streamInfo = { ...streamInfoBase, metadataId };

        const results = await this.redis.multi()
            .set(REDIS_KEYS.CONTENT.METADATA(metadataId), JSON.stringify(normalizedMetadata))
            .set(REDIS_KEYS.CONTENT.STREAM(streamInfoBase.streamId), JSON.stringify(streamInfo))
            .exec();
        this.assertExecResult(results);

        console.log(`[ContentService] Stream metadata + StreamInfo added atomically [metadataId:${metadataId}, streamId:${request.streamId}]`);

        return normalizedMetadata;
    }

    /**
     * ライブストリームメタデータと StreamInfo をアトミックに削除
     * closeProducer() / producer.observer.on('close') での content:metadata と content:stream の削除を原子化する
     */
    async deleteStreamMetadataWithStreamId(metadataId: string, streamId: string): Promise<boolean> {
        const metadata = await this.getMetadata(metadataId);
        if (!metadata) {
            return false;
        }

        const results = await this.redis.multi()
            .del(REDIS_KEYS.CONTENT.METADATA(metadataId))
            .del(REDIS_KEYS.CONTENT.STREAM(streamId))
            .exec();
        this.assertExecResult(results);

        console.log(`[ContentService] Stream metadata + StreamInfo deleted atomically [metadataId:${metadataId}, streamId:${streamId}]`);

        return true;
    }
}
