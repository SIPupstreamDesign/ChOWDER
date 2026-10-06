/**
 * タイル画像サービス
 *
 * - SegmentReceiver: WebSocket 分割バイナリの再合成
 * - TileImageService: Worker Thread 起動・Redis 保存・タイル取得
 */

import path from 'path';
import { Worker } from 'worker_threads';
import type { WorkerOptions } from 'worker_threads';
import type { Redis } from 'ioredis';
import { REDIS_KEYS } from '../common/redisKeys';
import type {
    TileWorkerInput,
    TileWorkerMessage,
} from './tileImageWorker';

const TILE_WORKER_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const TILE_WORKER_HEARTBEAT_INTERVAL_MS = 30 * 1000;

// ---------------------------------------------------------------------------
// SegmentReceiver
// ---------------------------------------------------------------------------

interface SegmentContainer {
    segments: Map<number, Buffer>;
    receivedBytes: number;
    total: number;
    byteLength: number;
    metadataId: string;
    fileExt: string;
    socketId: string;
}

export interface TileImageUploadDescriptor {
    /** クライアントが生成する一時upload ID */
    uploadId: string;
    /** 元ファイルの合計バイト数 */
    byteLength: number;
    /** 全セグメント数 */
    segment_max: number;
    /** ファイル拡張子 */
    file_ext: string;
}

/**
 * UploadTileimage コマンドで受け取るsegment metadata
 */
export interface TileimageSegmentParams extends TileImageUploadDescriptor {
    /** AddContent で取得したコンテンツのメタデータ ID */
    metadataId: string;
    /** このセグメントの番号（0 始まり） */
    segment_index: number;
}

export interface SegmentReceiveResult {
    accepted: boolean;
    receivedCount: number;
    assembled: Buffer | null;
}

/**
 * 分割バイナリを受け取り、全部揃ったら結合した Buffer を返すクラス。
 * SocketID と imageID の対応も管理して、切断時クリーンアップに使用する。
 */
export class SegmentReceiver {
    /** imageId -> SegmentContainer */
    private containers: Map<string, SegmentContainer> = new Map();
    /** socketId -> Set<imageId> */
    private socketToImages: Map<string, Set<string>> = new Map();
    /** imageId -> metadataId (AddContent で登録したコンテンツID) */
    private imageToMetadata: Map<string, string> = new Map();
    private imageToSocket: Map<string, string> = new Map();

    /**
     * セグメントを受け取る。全部そろったら合体した Buffer を返す。
     * まだ揃っていない場合は null を返す。
     */
    receive(params: TileimageSegmentParams, binary: Buffer, socketId: string): SegmentReceiveResult {
        const { uploadId, metadataId, byteLength, segment_max, segment_index, file_ext } = params;
        if (
            typeof uploadId !== 'string' || uploadId.length === 0
            || typeof metadataId !== 'string' || metadataId.length === 0
            || typeof socketId !== 'string' || socketId.length === 0
            || !Number.isSafeInteger(byteLength) || byteLength < 0
            || !Number.isSafeInteger(segment_max) || segment_max <= 0
            || !Number.isSafeInteger(segment_index) || segment_index < 0 || segment_index >= segment_max
            || typeof file_ext !== 'string' || file_ext.length === 0
            || !Buffer.isBuffer(binary)
            || binary.byteLength > byteLength
        ) {
            throw new Error('Invalid tileimage segment metadata or binary');
        }

        let container = this.containers.get(uploadId);
        if (container === undefined) {
            container = {
                segments: new Map<number, Buffer>(),
                receivedBytes: 0,
                total: segment_max,
                byteLength,
                metadataId,
                fileExt: file_ext,
                socketId,
            };
            this.containers.set(uploadId, container);
            this.imageToMetadata.set(uploadId, metadataId);
            this.imageToSocket.set(uploadId, socketId);
            let imageIds = this.socketToImages.get(socketId);
            if (imageIds === undefined) {
                imageIds = new Set<string>();
                this.socketToImages.set(socketId, imageIds);
            }
            imageIds.add(uploadId);
        } else if (
            container.socketId !== socketId
            || container.metadataId !== metadataId
            || container.byteLength !== byteLength
            || container.total !== segment_max
            || container.fileExt !== file_ext
        ) {
            throw new Error('Tileimage segment metadata changed within an upload');
        }

        const existingSegment = container.segments.get(segment_index);
        if (existingSegment !== undefined) {
            if (existingSegment.equals(binary)) {
                return { accepted: false, receivedCount: container.segments.size, assembled: null };
            }
            throw new Error('Conflicting duplicate tileimage segment');
        }
        if (binary.byteLength > container.byteLength - container.receivedBytes) {
            throw new Error('Tileimage upload exceeds declared byteLength');
        }

        container.segments.set(segment_index, Buffer.from(binary));
        container.receivedBytes += binary.byteLength;
        if (container.segments.size < container.total) {
            return { accepted: true, receivedCount: container.segments.size, assembled: null };
        }
        if (container.receivedBytes !== container.byteLength) {
            throw new Error('Tileimage upload does not match declared byteLength');
        }

        const orderedSegments: Buffer[] = [];
        for (let index = 0; index < container.total; index++) {
            const segment = container.segments.get(index);
            if (segment === undefined) {
                throw new Error('Tileimage upload is missing a segment');
            }
            orderedSegments.push(segment);
        }

        const assembled = Buffer.concat(orderedSegments, container.receivedBytes);
        const receivedCount = container.segments.size;
        this.deleteByImageId(uploadId, socketId);
        return { accepted: true, receivedCount, assembled };
    }

    /** ソケット切断時に未完成のセグメント受信状態を削除 */
    deleteBySocketId(socketId: string): void {
        const imageIds = this.socketToImages.get(socketId);
        if (imageIds) {
            for (const imageId of imageIds) {
                this.deleteByImageId(imageId, socketId);
            }
        }
    }

    /**
     * 切断されたソケットに紐づく未完了アップロードの metadataId 一覧を返す。
     * deleteBySocketId() の前に呼ぶこと。
     */
    getPendingMetadataIds(socketId: string): string[] {
        const imageIds = this.socketToImages.get(socketId);
        if (!imageIds) return [];
        const result: string[] = [];
        imageIds.forEach((id) => {
            const meta = this.imageToMetadata.get(id);
            if (meta) result.push(meta);
        });
        return result;
    }

    /** imageId に紐づくコンテナを削除 */
    deleteByImageId(imageId: string, socketId?: string): void {
        this.containers.delete(imageId);
        this.imageToMetadata.delete(imageId);
        const ownerSocketId = this.imageToSocket.get(imageId);
        this.imageToSocket.delete(imageId);
        const cleanupSocketId = socketId ?? ownerSocketId;
        if (cleanupSocketId !== undefined) {
            const imageIds = this.socketToImages.get(cleanupSocketId);
            imageIds?.delete(imageId);
            if (imageIds?.size === 0) {
                this.socketToImages.delete(cleanupSocketId);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// TileImageService
// ---------------------------------------------------------------------------

/**
 * Worker Thread からの完了データ
 */
export interface TileSet {
    xsplit: number;
    ysplit: number;
    tileSize: number;
    /** 元画像の幅（ピクセル） */
    imgWidth: number;
    /** 元画像の高さ（ピクセル） */
    imgHeight: number;
    reductionWidth: number;
    reductionHeight: number;
    /** tile_index 順のタイル Buffer 一覧 */
    tiles: Buffer[];
    /** 縮小版 Buffer */
    reduction: Buffer;
}

/**
 * Worker 進捗コールバック（タイル生成フェーズ）
 */
export type OnWorkerProgress = (completed: number, total: number) => void;
export type OnWorkerHeartbeat = () => void;

export interface TileImageServiceOptions {
    workerIdleTimeoutMs?: number;
    workerHeartbeatIntervalMs?: number;
    createWorker?: (filename: string, options: WorkerOptions) => Worker;
}

/**
 * タイル画像の生成・保存・取得を担うサービス
 */
export class TileImageService {
    private readonly tileSize: number;
    private readonly workerIdleTimeoutMs: number;
    private readonly workerHeartbeatIntervalMs: number;
    private readonly createWorker: (filename: string, options: WorkerOptions) => Worker;

    constructor(tileSize: number = 256, options: TileImageServiceOptions = {}) {
        this.tileSize = tileSize;
        this.workerIdleTimeoutMs = options.workerIdleTimeoutMs ?? TILE_WORKER_IDLE_TIMEOUT_MS;
        this.workerHeartbeatIntervalMs = options.workerHeartbeatIntervalMs ?? TILE_WORKER_HEARTBEAT_INTERVAL_MS;
        this.createWorker = options.createWorker ?? ((filename: string, workerOptions: WorkerOptions): Worker => {
            return new Worker(filename, workerOptions);
        });
        if (!Number.isSafeInteger(this.workerIdleTimeoutMs) || this.workerIdleTimeoutMs <= 0) {
            throw new Error('Worker idle timeout must be a positive safe integer');
        }
        if (!Number.isSafeInteger(this.workerHeartbeatIntervalMs) || this.workerHeartbeatIntervalMs <= 0) {
            throw new Error('Worker heartbeat interval must be a positive safe integer');
        }
    }

    /**
     * 画像バイナリから Worker Thread でタイルを生成する。
     * 進捗は onProgress で通知される。
     * @returns 生成されたタイルセット
     */
    generateTiles(
        imageBuffer: Buffer,
        onProgress?: OnWorkerProgress,
        onHeartbeat?: OnWorkerHeartbeat,
    ): Promise<TileSet> {
        return new Promise((resolvePromise, rejectPromise) => {
            // 本番(`*.js`)と開発(`*.ts`)で Worker スクリプトパスを切り替え
            const isDev = __filename.endsWith('.ts');
            const workerFile = isDev
                ? path.join(__dirname, 'tileImageWorker.ts')
                : path.join(__dirname, 'tileImageWorker.js');
            const execArgv = isDev ? ['--require', require.resolve('tsx/cjs')] : [];

            // ArrayBuffer として Worker に渡す（転送でゼロコピー）
            const ab = imageBuffer.buffer.slice(
                imageBuffer.byteOffset,
                imageBuffer.byteOffset + imageBuffer.byteLength
            ) as ArrayBuffer;

            const input: TileWorkerInput = {
                imageBuffer: ab,
                tileSize: this.tileSize,
                heartbeatIntervalMs: this.workerHeartbeatIntervalMs,
            };

            const worker = this.createWorker(workerFile, {
                execArgv,
                workerData: input,
                transferList: [ab],
            });

            let settled = false;
            let idleTimeoutId: ReturnType<typeof setTimeout>;
            const rejectWorker = (error: Error): void => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(idleTimeoutId);
                rejectPromise(error);
                void worker.terminate().catch((terminateError: unknown) => {
                    console.error('[TileImageService] Failed to terminate idle worker:', terminateError);
                });
            };
            const resetIdleTimeout = (): void => {
                clearTimeout(idleTimeoutId);
                idleTimeoutId = setTimeout((): void => {
                    rejectWorker(new Error('TileImage worker made no progress before the idle timeout'));
                }, this.workerIdleTimeoutMs);
            };
            resetIdleTimeout();

            worker.on('message', (msg: TileWorkerMessage) => {
                if (msg.type === 'heartbeat') {
                    try {
                        onHeartbeat?.();
                    } catch (error: unknown) {
                        rejectWorker(error instanceof Error ? error : new Error(String(error)));
                    }
                } else if (msg.type === 'progress') {
                    resetIdleTimeout();
                    try {
                        onProgress?.(msg.completed, msg.total);
                    } catch (error: unknown) {
                        rejectWorker(error instanceof Error ? error : new Error(String(error)));
                    }
                } else if (msg.type === 'done') {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    clearTimeout(idleTimeoutId);
                    resolvePromise({
                        xsplit: msg.xsplit,
                        ysplit: msg.ysplit,
                        tileSize: msg.tileSize,
                        imgWidth: msg.imgWidth,
                        imgHeight: msg.imgHeight,
                        reductionWidth: msg.reductionWidth,
                        reductionHeight: msg.reductionHeight,
                        tiles: msg.tiles.map((ab) => Buffer.from(ab)),
                        reduction: Buffer.from(msg.reduction),
                    });
                } else if (msg.type === 'error') {
                    rejectWorker(new Error(msg.message));
                }
            });

            worker.on('error', (error: Error) => {
                rejectWorker(error);
            });
            worker.on('exit', (code) => {
                if (!settled) {
                    const message = code === 0
                        ? 'TileImage worker exited before returning a result'
                        : `TileImage worker exited with code ${code}`;
                    rejectWorker(new Error(message));
                }
            });
        });
    }

    /**
     * 生成したタイルセットを Redis に保存する。
     * - 各タイル: TILE_DATA ハッシュのフィールド（tile_index文字列 -> Binary）
     * - 縮小版: BINARY（GetContent で取得可能）
     */
    async storeTiles(redis: Redis, contentId: string, tileSet: TileSet): Promise<void> {
        const tileKey = REDIS_KEYS.CONTENT.TILE_DATA(contentId);
        const binaryKey = REDIS_KEYS.CONTENT.BINARY(contentId);

        // タイルをハッシュに一括保存
        const tileArgs: (string | Buffer)[] = [];
        for (let i = 0; i < tileSet.tiles.length; i++) {
            tileArgs.push(String(i));
            tileArgs.push(tileSet.tiles[i]);
        }
        // ioredis の hmset は (key, field, value, field, value...) を受け付ける
        await (redis as any).hmset(tileKey, ...tileArgs);

        // 縮小版をバイナリとして保存（LOD 低解像度表示 / プレビュー用）
        await (redis as any).set(binaryKey, tileSet.reduction);
    }

    /**
     * Redis から指定インデックスのタイルバイナリを取得する。
     * 存在しない場合は null を返す。
     */
    async getTile(redis: Redis, contentId: string, tileIndex: number): Promise<Buffer | null> {
        const tileKey = REDIS_KEYS.CONTENT.TILE_DATA(contentId);
        // ioredis は Buffer モードでも通常モードでも hget が使えるが、
        // バイナリを正しく扱うため Buffer として受け取る
        const result = await (redis as any).hgetBuffer
            ? await (redis as any).hgetBuffer(tileKey, String(tileIndex))
            : await redis.hget(tileKey, String(tileIndex));
        if (!result) return null;
        return Buffer.isBuffer(result) ? result : Buffer.from(result as string, 'binary');
    }

    /**
     * 未完了（tileFinished: false）コンテンツの Redis データを削除する。
     * セグメント転送途中に切断された場合のクリーンアップに使用。
     */
    async deleteIncompleteContent(
        redis: Redis,
        contentId: string,
        expectedOwner?: string,
    ): Promise<boolean> {
        const metaKey = REDIS_KEYS.CONTENT.METADATA(contentId);
        const thumbnailKey = REDIS_KEYS.CONTENT.THUMBNAIL(contentId);
        const tileKey = REDIS_KEYS.CONTENT.TILE_DATA(contentId);
        const cleanupRedis = redis.duplicate();
        try {
            for (let attempt = 0; attempt < 3; attempt++) {
                await cleanupRedis.watch(metaKey);
                const metadataJson = await cleanupRedis.get(metaKey);
                if (metadataJson === null) {
                    await cleanupRedis.unwatch();
                    return false;
                }

                const metadata = JSON.parse(metadataJson) as {
                    metadataId?: string;
                    binaryId?: string | null;
                    creatorId?: string;
                    type?: string;
                    tileFinished?: unknown;
                };
                if (
                    metadata.metadataId !== contentId
                    || metadata.type !== 'tileimage'
                    || metadata.tileFinished === true
                    || (expectedOwner !== undefined && metadata.creatorId !== expectedOwner)
                ) {
                    await cleanupRedis.unwatch();
                    return false;
                }

                const keysToDelete = [metaKey, tileKey, thumbnailKey];
                if (typeof metadata.binaryId === 'string' && metadata.binaryId !== '') {
                    keysToDelete.push(REDIS_KEYS.CONTENT.BINARY(metadata.binaryId));
                }

                const results = await cleanupRedis.multi().del(...keysToDelete).exec();
                if (results !== null) {
                    for (const [error] of results) {
                        if (error !== null) {
                            throw error;
                        }
                    }
                    return true;
                }
            }
            throw new Error(`Tileimage cleanup conflicted repeatedly: ${contentId}`);
        } finally {
            await cleanupRedis.quit();
        }
    }
}
