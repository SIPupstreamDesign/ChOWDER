/**
 * タイル画像サービス
 *
 * - SegmentReceiver: WebSocket 分割バイナリの再合成
 * - TileImageService: Worker Thread 起動・Redis 保存・タイル取得
 */

import path from 'path';
import { Worker } from 'worker_threads';
import type { Redis } from 'ioredis';
import { REDIS_KEYS } from '../common/redisKeys';
import type {
    TileWorkerInput,
    TileWorkerMessage,
} from './tileImageWorker';

// ---------------------------------------------------------------------------
// SegmentReceiver
// ---------------------------------------------------------------------------

interface SegmentContainer {
    /** 受け取った各セグメントのバイナリ（未着は null） */
    segments: (Buffer | null)[];
    /** 受信済みセグメント数 */
    receivedCount: number;
    /** 全セグメント数 */
    total: number;
}

/**
 * UploadTileimage コマンドで受け取るメタパラメータ
 */
export interface TileimageSegmentParams {
    /** ファイル拡張子 (例: "jpg") */
    file_ext: string;
    /** アップロードセッション固有 ID */
    id: string;
    /** AddContent で取得したコンテンツのメタデータ ID */
    metadataId: string;
    /** 送信者のユーザー名 */
    creator: string;
    /** 元ファイルの合計バイト数 */
    byteLength: number;
    /** 全セグメント数 */
    segment_max: number;
    /** このセグメントの番号（0 始まり） */
    segment_index: number;
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

    /**
     * セグメントを受け取る。全部そろったら合体した Buffer を返す。
     * まだ揃っていない場合は null を返す。
     */
    receive(params: TileimageSegmentParams, binary: Buffer, socketId: string): Buffer | null {
        const { id, segment_index, segment_max } = params;

        // コンテナ初期化
        if (!this.containers.has(id)) {
            this.containers.set(id, {
                segments: new Array(segment_max).fill(null),
                receivedCount: 0,
                total: segment_max,
            });
            // metadataId を記録
            this.imageToMetadata.set(id, params.metadataId);
        }

        // socketId と imageId の対応を記録（切断時クリーンアップ用）
        if (!this.socketToImages.has(socketId)) {
            this.socketToImages.set(socketId, new Set());
        }
        this.socketToImages.get(socketId)!.add(id);

        const container = this.containers.get(id)!;

        // 重複受信チェック
        if (container.segments[segment_index] !== null) {
            return null;
        }

        container.segments[segment_index] = binary;
        container.receivedCount++;

        if (container.receivedCount < container.total) {
            return null; // まだ揃っていない
        }

        // 全セグメント揃った → 結合して返す
        const assembled = Buffer.concat(
            container.segments.filter((s): s is Buffer => s !== null)
        );
        this.containers.delete(id);
        this.imageToMetadata.delete(id);

        // socketId のマッピングからも削除
        this.socketToImages.get(socketId)?.delete(id);

        return assembled;
    }

    /** ソケット切断時に未完成のセグメント受信状態を削除 */
    deleteBySocketId(socketId: string): void {
        const imageIds = this.socketToImages.get(socketId);
        if (imageIds) {
            imageIds.forEach((id) => {
                this.containers.delete(id);
                this.imageToMetadata.delete(id);
            });
            this.socketToImages.delete(socketId);
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
        if (socketId) {
            this.socketToImages.get(socketId)?.delete(imageId);
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

/**
 * タイル画像の生成・保存・取得を担うサービス
 */
export class TileImageService {
    private readonly tileSize: number;

    constructor(tileSize: number = 256) {
        this.tileSize = tileSize;
    }

    /**
     * 画像バイナリから Worker Thread でタイルを生成する。
     * 進捗は onProgress で通知される。
     * @returns 生成されたタイルセット
     */
    generateTiles(imageBuffer: Buffer, onProgress?: OnWorkerProgress): Promise<TileSet> {
        return new Promise((resolve, reject) => {
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
            };

            const worker = new Worker(workerFile, {
                execArgv,
                workerData: input,
                transferList: [ab],
            });

            worker.on('message', (msg: TileWorkerMessage) => {
                if (msg.type === 'progress') {
                    onProgress?.(msg.completed, msg.total);
                } else if (msg.type === 'done') {
                    resolve({
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
                    reject(new Error(msg.message));
                }
            });

            worker.on('error', reject);
            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`TileImage worker exited with code ${code}`));
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
    async deleteIncompleteContent(redis: Redis, contentId: string): Promise<void> {
        const metaKey = REDIS_KEYS.CONTENT.METADATA(contentId);
        const binaryKey = REDIS_KEYS.CONTENT.BINARY(contentId);
        const tileKey = REDIS_KEYS.CONTENT.TILE_DATA(contentId);
        await redis.del(metaKey, binaryKey, tileKey);
    }
}
