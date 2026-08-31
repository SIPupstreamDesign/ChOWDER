/**
 * 画像を読み込み、Canvasで縮小後、ArrayBufferとして取得する関数
 * @param img       - ロード済みの HTMLImageElement
 * @param maxWidth  - 最大幅
 * @param maxHeight - 最大高さ
 * @param outputMode - 'encoded'（JPEG等PNG圧縮）または 'raw'（RGBA生データ）
 * @returns 縮小後の画像 ArrayBuffer
 */
export async function getResizedArrayBuffer(
    img: HTMLImageElement,
    maxWidth: number,
    maxHeight: number,
    outputMode: string = 'encoded',
): Promise<ArrayBuffer> {
    if (!img.complete || img.naturalWidth === 0) {
        throw new Error('画像がまだロードされていないか、破損しています。');
    }

    const widthRatio = maxWidth / img.naturalWidth;
    const heightRatio = maxHeight / img.naturalHeight;
    const ratio = Math.min(widthRatio, heightRatio, 1);

    const newWidth = img.naturalWidth * ratio;
    const newHeight = img.naturalHeight * ratio;

    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas 2D context could not be obtained.');
    }

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    if (outputMode === 'raw') {
        const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
        return imageData.data.buffer;
    } else {
        return new Promise((resolve, reject) => {
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    reject(new Error('CanvasからBlobへの変換に失敗しました'));
                    return;
                }
                try {
                    resolve(await blob.arrayBuffer());
                } catch (err) {
                    reject(err);
                }
            }, 'image/png');
        });
    }
}
