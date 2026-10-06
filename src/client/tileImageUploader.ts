/**
 * TileImageUploader - タイルイメージのアップロードを管理するクラス
 *
 * フロー:
 *  1. AddContent(type='tileimage') → metadataId 取得
 *  2. ファイルを maxSegmentSize バイトのセグメントに分割
 *  3. 各セグメントを UploadTileimage (MetaBinary) で送信
 *  4. TileimageProgress ブロードキャストで進捗通知
 *  5. UpdateContent(tileFinished=true) で完了
 */

export interface TileimageProgressPayload {
    metadataId: string;
    receivedSegments: number;
    totalSegments: number;
    phase: 'uploading' | 'processing';
}

export interface TileimageUploadFailedPayload {
    metadataId: string;
    reason: string;
}

export interface TileimageHeartbeatPayload {
    metadataId: string;
}

export interface TileImageMetadata {
    metadataId: string;
    type: 'tileimage';
    xsplit: number;
    ysplit: number;
    tileSize: number;
    orgWidth: number;
    orgHeight: number;
    reductionWidth: number;
    reductionHeight: number;
    tileFinished: boolean;
    posx: number;
    posy: number;
    width: number;
    height: number;
}

export interface UploadContentMetadata {
    posx: number;
    posy: number;
    width: number;
    height: number;
}

export interface TileImageUploadDescriptor {
    uploadId: string;
    byteLength: number;
    segment_max: number;
    file_ext: string;
}

export type ProgressCallback = (
    phase: 'uploading' | 'processing',
    received: number,
    total: number
) => void;

interface PendingUpload {
    resolve: (result: TileImageMetadata) => void;
    reject: (err: Error) => void;
    onProgress?: ProgressCallback;
    timeoutId: ReturnType<typeof setTimeout>;
    timeoutMs: number;
}

/**
 * アップロード完了または失敗時の状態
 */
export interface UploadResult {
    success: boolean;
    metadata?: TileImageMetadata;
    error?: string;
}

/** ランダムな8文字の識別子を生成 */
function generateId(): string {
    return Math.random().toString(36).slice(2, 10);
}

/** ファイル拡張子を取得 */
function getFileExt(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
}

function normalizeUploadError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }
    if (typeof error === 'object' && error !== null) {
        const message: unknown = Reflect.get(error, 'message');
        if (typeof message === 'string' && message.length > 0) {
            return new Error(message);
        }
    }
    return new Error(String(error));
}

export class TileImageUploader {
    private sendCommandFn: (method: string, params: any) => Promise<any>;
    private sendBinaryCommandFn: (method: string, params: any, binary: ArrayBuffer) => Promise<any>;
    private registerBroadcastFn: (method: string, handler: (params: any) => void) => void;

    // 進行中アップロードの解決関数マップ (metadataId -> { resolve, reject, onProgress })
    private pendingUploads: Map<string, PendingUpload> = new Map();

    private scheduleCompletionTimeout(metadataId: string, timeoutMs: number): ReturnType<typeof setTimeout> {
        return setTimeout(() => {
            const pending = this.pendingUploads.get(metadataId);
            if (pending !== undefined) {
                this.pendingUploads.delete(metadataId);
                pending.reject(new Error(`Tile upload timed out: ${metadataId}`));
            }
        }, timeoutMs);
    }

    private refreshCompletionTimeout(metadataId: string, pending: PendingUpload): void {
        clearTimeout(pending.timeoutId);
        pending.timeoutId = this.scheduleCompletionTimeout(metadataId, pending.timeoutMs);
    }

    /**
     * @param sendCommand       JSON-RPC コマンド送信関数 (controller.ts の sendCommand)
     * @param sendBinaryCommand MetaBinary コマンド送信関数 (controller.ts の sendBinaryCommand)
     * @param registerBroadcast ブロードキャスト受信登録関数
     */
    constructor(
        sendCommand: (method: string, params: any) => Promise<any>,
        sendBinaryCommand: (method: string, params: any, binary: ArrayBuffer) => Promise<any>,
        registerBroadcast: (method: string, handler: (params: any) => void) => void,
        private readonly minimumCompletionTimeoutMs: number = 360000,
    ) {
        if (!Number.isSafeInteger(minimumCompletionTimeoutMs) || minimumCompletionTimeoutMs < 0) {
            throw new Error('minimumCompletionTimeoutMs must be a non-negative safe integer');
        }
        this.sendCommandFn = sendCommand;
        this.sendBinaryCommandFn = sendBinaryCommand;
        this.registerBroadcastFn = registerBroadcast;

        // TileimageProgress ブロードキャスト受信登録
        this.registerBroadcastFn('TileimageProgress', (params: TileimageProgressPayload) => {
            const pending = this.pendingUploads.get(params.metadataId);
            if (pending !== undefined) {
                this.refreshCompletionTimeout(params.metadataId, pending);
                if (pending.onProgress !== undefined) {
                    pending.onProgress(params.phase, params.receivedSegments, params.totalSegments);
                }
            }
        });

        this.registerBroadcastFn('TileimageHeartbeat', (params: TileimageHeartbeatPayload) => {
            this.handleHeartbeat(params);
        });

        this.registerBroadcastFn('TileimageUploadFailed', (params: TileimageUploadFailedPayload) => {
            this.handleUploadFailed(params);
        });
    }

    /**
     * UpdateContent ブロードキャストを tileimage 完了通知として処理する。
     * controller.ts の handleBroadcast から呼ぶこと。
     */
    handleUpdateContent(params: any): void {
        const metadata = params?.metadata as TileImageMetadata | undefined;
        if (!metadata || metadata.type !== 'tileimage' || !metadata.tileFinished) return;

        const pending = this.pendingUploads.get(metadata.metadataId);
        if (pending) {
            this.pendingUploads.delete(metadata.metadataId);
            clearTimeout(pending.timeoutId);
            pending.resolve(metadata);
        }
    }

    handleUploadFailed(params: TileimageUploadFailedPayload): void {
        const pending = this.pendingUploads.get(params.metadataId);
        if (pending !== undefined) {
            this.pendingUploads.delete(params.metadataId);
            clearTimeout(pending.timeoutId);
            pending.reject(new Error(params.reason));
        }
    }

    handleHeartbeat(params: TileimageHeartbeatPayload): void {
        const pending = this.pendingUploads.get(params.metadataId);
        if (pending !== undefined) {
            this.refreshCompletionTimeout(params.metadataId, pending);
        }
    }

    /**
     * タイルイメージをアップロードする。
     *
     * @param file            アップロードするファイル
     * @param contentMeta     コンテンツの位置・サイズ情報
     * @param onProgress      進捗コールバック（省略可）
     * @param maxSegmentSize  1セグメントの最大バイト数（デフォルト 512KB）
     * @returns               完了時の TileImageMetadata
     */
    async upload(
        file: File,
        contentMeta: UploadContentMetadata,
        onProgress?: ProgressCallback,
        maxSegmentSize: number = 512 * 1024,
        completionTimeoutMs: number = 360000
    ): Promise<TileImageMetadata> {
        if (!Number.isSafeInteger(maxSegmentSize) || maxSegmentSize <= 0) {
            throw new Error('maxSegmentSize must be a positive safe integer');
        }
        if (!Number.isSafeInteger(completionTimeoutMs) || completionTimeoutMs <= 0) {
            throw new Error('completionTimeoutMs must be a positive safe integer');
        }
        const effectiveCompletionTimeoutMs = Math.max(completionTimeoutMs, this.minimumCompletionTimeoutMs);

        // Prepare the complete transfer descriptor before creating server metadata.
        const arrayBuffer = await file.arrayBuffer();
        const totalBytes = arrayBuffer.byteLength;
        const totalSegments = Math.max(1, Math.ceil(totalBytes / maxSegmentSize));
        const uploadId = generateId();
        const fileExt = getFileExt(file.name);

        // AddContent reserves the server-side upload slot before persisting metadata.
        const addResult = await this.sendBinaryCommandFn(
            'AddContent',
            {
                type: 'tileimage',
                posx: contentMeta.posx,
                posy: contentMeta.posy,
                width: contentMeta.width,
                height: contentMeta.height,
                tileImageUpload: {
                    uploadId,
                    byteLength: totalBytes,
                    segment_max: totalSegments,
                    file_ext: fileExt,
                } satisfies TileImageUploadDescriptor,
            },
            new ArrayBuffer(0)
        ).catch((error: unknown): never => {
            throw normalizeUploadError(error);
        });

        const metadataId: string = addResult?.metadataId;
        if (!metadataId) {
            throw new Error('AddContent did not return metadataId');
        }

        // 2. 完了 Promise を登録
        const completionPromise = new Promise<TileImageMetadata>((resolve, reject) => {
            const timeoutId = this.scheduleCompletionTimeout(metadataId, effectiveCompletionTimeoutMs);
            this.pendingUploads.set(metadataId, {
                resolve,
                reject,
                onProgress,
                timeoutId,
                timeoutMs: effectiveCompletionTimeoutMs,
            });
        });

        // Send all segments after the server has accepted and reserved the upload.
        try {
            for (let i = 0; i < totalSegments; i++) {
                const start = i * maxSegmentSize;
                const end = Math.min(start + maxSegmentSize, totalBytes);
                const segment = arrayBuffer.slice(start, end);

                const segmentParams = {
                    metadataId,
                    uploadId,
                    file_ext: fileExt,
                    byteLength: totalBytes,
                    segment_max: totalSegments,
                    segment_index: i,
                };

                await this.sendBinaryCommandFn('UploadTileimage', segmentParams, segment);
            }
        } catch (error: unknown) {
            const pending = this.pendingUploads.get(metadataId);
            if (pending !== undefined) {
                this.pendingUploads.delete(metadataId);
                clearTimeout(pending.timeoutId);
            }
            throw normalizeUploadError(error);
        }

        // 5. 完了（UpdateContent tileFinished=true）まで待機
        return completionPromise;
    }

    /**
     * 進行中の全アップロードをキャンセル（エラーとして reject する）
     */
    cancelAll(reason = 'Upload cancelled'): void {
        for (const [id, pending] of this.pendingUploads.entries()) {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error(reason));
            this.pendingUploads.delete(id);
        }
    }
}
