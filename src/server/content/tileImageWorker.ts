/**
 * タイル画像生成 Worker Thread
 *
 * メインスレッドから画像バイナリを受け取り、sharp でタイル分割 + 縮小版を生成して返す。
 * Worker Thread 内で実行されるため、sharp の重い処理でもイベントループをブロックしない。
 */

import { workerData, parentPort } from 'worker_threads';
import sharp from 'sharp';

/**
 * メインスレッドから受け取る入力データ
 */
export interface TileWorkerInput {
    /** 画像バイナリ（ArrayBuffer） */
    imageBuffer: ArrayBuffer;
    /** タイル1辺のピクセル数 */
    tileSize: number;
}

/**
 * Worker が postMessage で送る進捗通知
 */
export interface TileWorkerProgressMessage {
    type: 'progress';
    /** 処理済みタイル数 */
    completed: number;
    /** 総タイル数 */
    total: number;
}

/**
 * Worker が postMessage で送る完了通知
 */
export interface TileWorkerDoneMessage {
    type: 'done';
    /** 横方向タイル分割数 */
    xsplit: number;
    /** 縦方向タイル分割数 */
    ysplit: number;
    /** タイル1辺のピクセル数 */
    tileSize: number;
    /** 元画像の幅（ピクセル） */
    imgWidth: number;
    /** 元画像の高さ（ピクセル） */
    imgHeight: number;
    /** 縮小版の幅（ピクセル） */
    reductionWidth: number;
    /** 縮小版の高さ（ピクセル） */
    reductionHeight: number;
    /** タイル画像バイナリ一覧（tile_index 順、JPEG） */
    tiles: ArrayBuffer[];
    /** 縮小版バイナリ（JPEG） */
    reduction: ArrayBuffer;
}

/**
 * Worker が postMessage で送るエラー通知
 */
export interface TileWorkerErrorMessage {
    type: 'error';
    message: string;
}

export type TileWorkerMessage =
    | TileWorkerProgressMessage
    | TileWorkerDoneMessage
    | TileWorkerErrorMessage;

// ---------------------------------------------------------------------------
// Worker 本体
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
    const { imageBuffer, tileSize }: TileWorkerInput = workerData;
    const srcBuf = Buffer.from(imageBuffer);
    const createSharpFromSource = () => {
        return sharp(srcBuf, { limitInputPixels: false });
    };

    // 元画像のサイズを取得
    const meta = await createSharpFromSource().metadata();
    const imgWidth = meta.width!;
    const imgHeight = meta.height!;

    // タイル分割数を計算
    const xsplit = Math.ceil(imgWidth / tileSize);
    const ysplit = Math.ceil(imgHeight / tileSize);
    const totalTiles = xsplit * ysplit;

    const tileBuffers: Buffer[] = [];

    // 各タイルを切り出して JPEG に変換
    for (let yi = 0; yi < ysplit; yi++) {
        for (let xi = 0; xi < xsplit; xi++) {
            const left = xi * tileSize;
            const top = yi * tileSize;
            // 端部タイルは画像境界でクリップ
            const extractWidth = Math.min(tileSize, imgWidth - left);
            const extractHeight = Math.min(tileSize, imgHeight - top);

            const tileBuf = await createSharpFromSource()
                .extract({ left, top, width: extractWidth, height: extractHeight })
                // 端部タイルをパディングして tileSize x tileSize に統一
                .resize(tileSize, tileSize, {
                    fit: 'contain',
                    position: 'left top',
                    background: { r: 0, g: 0, b: 0 },
                })
                .jpeg({ quality: 85 })
                .toBuffer();

            tileBuffers.push(tileBuf);

            // 進捗をメインスレッドに通知
            const progressMsg: TileWorkerProgressMessage = {
                type: 'progress',
                completed: yi * xsplit + xi + 1,
                total: totalTiles,
            };
            parentPort!.postMessage(progressMsg);
        }
    }

    // 縮小版（LOD 用）を生成。長辺が 1920px 以内に収まるように縮小
    const reductionBuf = await createSharpFromSource()
        .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

    const reductionMeta = await sharp(reductionBuf, { limitInputPixels: false }).metadata();

    // 完了メッセージを送信（ArrayBuffer として転送）
    const tileABs = tileBuffers.map((b) =>
        b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
    );
    const reductionAB = reductionBuf.buffer.slice(
        reductionBuf.byteOffset,
        reductionBuf.byteOffset + reductionBuf.byteLength
    ) as ArrayBuffer;

    const doneMsg: TileWorkerDoneMessage = {
        type: 'done',
        xsplit,
        ysplit,
        tileSize,
        imgWidth,
        imgHeight,
        reductionWidth: reductionMeta.width!,
        reductionHeight: reductionMeta.height!,
        tiles: tileABs,
        reduction: reductionAB,
    };

    parentPort!.postMessage(doneMsg, [reductionAB, ...tileABs]);
}

run().catch((err: Error) => {
    const errMsg: TileWorkerErrorMessage = {
        type: 'error',
        message: err.message,
    };
    parentPort!.postMessage(errMsg);
});
