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
        registerBroadcast: (method: string, handler: (params: any) => void) => void
    ) {
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
        completionTimeoutMs: number = 120000
    ): Promise<TileImageMetadata> {
        // 1. AddContent(type='tileimage') でコンテンツ登録
        const addResult = await this.sendBinaryCommandFn(
            'AddContent',
            {
                type: 'tileimage',
                posx: contentMeta.posx,
                posy: contentMeta.posy,
                width: contentMeta.width,
                height: contentMeta.height,
            },
            new ArrayBuffer(0)
        );

        const metadataId: string = addResult?.metadataId;
        if (!metadataId) {
            throw new Error('AddContent did not return metadataId');
        }

        // 2. 完了 Promise を登録
        const completionPromise = new Promise<TileImageMetadata>((resolve, reject) => {
            const timeoutId = this.scheduleCompletionTimeout(metadataId, completionTimeoutMs);
            this.pendingUploads.set(metadataId, {
                resolve,
                reject,
                onProgress,
                timeoutId,
                timeoutMs: completionTimeoutMs,
            });
        });

        // 3. ファイルを ArrayBuffer に変換
        const arrayBuffer = await file.arrayBuffer();
        const totalBytes = arrayBuffer.byteLength;
        const totalSegments = Math.max(1, Math.ceil(totalBytes / maxSegmentSize));
        const imageId = generateId();
        const fileExt = getFileExt(file.name);

        // 4. セグメント送信
        try {
            for (let i = 0; i < totalSegments; i++) {
                const start = i * maxSegmentSize;
                const end = Math.min(start + maxSegmentSize, totalBytes);
                const segment = arrayBuffer.slice(start, end);

                const segmentParams = {
                    metadataId,
                    id: imageId,
                    file_ext: fileExt,
                    creator: '',         // サーバー側でセッションから取得するため空文字でよい
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
            throw error;
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
