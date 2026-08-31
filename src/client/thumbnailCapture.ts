/**
 * サムネイルキャプチャ - コンテンツタイプ別キャプチャ処理
 *
 * コントローラ側で各コンテンツ要素をPNGにキャプチャして
 * UpdateThumbnailコマンドで送信するためのユーティリティ。
 *
 * 各タイプの対応:
 * - image:      Canvas に drawImage() でリサイズ → PNG（captureThumbnailFromImage）
 * - tileimage:  サーバー側で自動生成（このモジュールは不使用）
 * - text:    Canvas に fillText() で描画 → PNG
 * - video:   canvas.drawImage(video) → PNG（loadeddata / play後）
 * - pdf:     iframe ロード後に canvasを取得を試みる。失敗時はプレースホルダー
 * - url:     クロスオリジン制限でキャプチャ不可 → ドメイン名入りプレースホルダー
 * - webgl:   IFrameConnector 経由で CaptureScreen コマンドを送信、base64 PNGを受領
 * - live-stream: canvas.drawImage(video) → PNG
 */

/** サムネイルの辺長（px） */
export const THUMBNAIL_SIZE = 128;

/**
 * Canvas を使ってサムネイルを描画する共通ヘルパー。
 * ブラウザAPIに依存するため、テストではモックが必要。
 */
function createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

/**
 * Canvas から PNG の ArrayBuffer を取得する。
 */
async function canvasToPngBuffer(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('canvas.toBlob failed'));
                return;
            }
            blob.arrayBuffer().then(resolve).catch(reject);
        }, 'image/png');
    });
}

/**
 * テキストコンテンツのサムネイルを生成する。
 * テキストをキャンバスに描画して PNG バッファを返す。
 */
export async function captureThumbnailFromText(
    text: string,
    fontSize: number = 32
): Promise<ArrayBuffer> {
    const canvas = createCanvas(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    // 背景
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

    // テキスト描画（文字数カットによる切り詰め）
    const scaledFontSize = Math.min(fontSize, THUMBNAIL_SIZE / 3);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${scaledFontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = THUMBNAIL_SIZE - 8;
    const ellipsis = '\u2026';
    let displayText = text;
    if (ctx.measureText(text).width > maxWidth) {
        // 収まる文字数をバイナリサーチで求める
        let lo = 0;
        let hi = text.length;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (ctx.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        displayText = text.slice(0, lo) + ellipsis;
    }
    ctx.fillText(displayText, THUMBNAIL_SIZE / 2, THUMBNAIL_SIZE / 2);

    return canvasToPngBuffer(canvas);
}

/**
 * URLコンテンツのサムネイルを生成する（プレースホルダー）。
 * クロスオリジン制限でiframe内のキャプチャは不可のため、
 * ドメイン名を描いたプレースホルダーを返す。
 */
export async function captureThumbnailFromUrl(url: string): Promise<ArrayBuffer> {
    const canvas = createCanvas(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    // 背景
    ctx.fillStyle = '#1a3a5c';
    ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

    // ドメイン抽出
    let domain = url;
    try {
        domain = new URL(url).hostname;
    } catch {
        // URLパースに失敗した場合はそのまま使用
    }

    // アイコン文字
    ctx.fillStyle = '#aaccee';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌐', THUMBNAIL_SIZE / 2, THUMBNAIL_SIZE / 2 - 16);

    // ドメイン名
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px sans-serif';
    ctx.fillText(domain, THUMBNAIL_SIZE / 2, THUMBNAIL_SIZE / 2 + 20, THUMBNAIL_SIZE - 8);

    return canvasToPngBuffer(canvas);
}

/**
 * Video 要素からサムネイルを生成する。
 * video.readyState >= 2 (HAVE_CURRENT_DATA) かつ videoWidth > 0 であること。
 * videoWidth === 0 の場合は映像フレームがまだ届いていないため、黒サムネイルを防ぐために Error を throw する。
 */
export async function captureThumbnailFromVideo(video: HTMLVideoElement): Promise<ArrayBuffer> {
    if (video.readyState < 2) {
        throw new Error('Video not ready (readyState < HAVE_CURRENT_DATA)');
    }
    if (video.videoWidth === 0) {
        throw new Error('Video frame not yet available (videoWidth === 0)');
    }
    const w = video.videoWidth;
    const h = video.videoHeight || THUMBNAIL_SIZE;

    // アスペクト比を維持して 128px 以内に収める
    const ratio = Math.min(THUMBNAIL_SIZE / w, THUMBNAIL_SIZE / h, 1);
    const dw = Math.round(w * ratio);
    const dh = Math.round(h * ratio);

    const canvas = createCanvas(dw, dh);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(video, 0, 0, dw, dh);

    return canvasToPngBuffer(canvas);
}

/**
 * 映像フレームが描画されるまで待機してからサムネイルをキャプチャする。
 *
 * `play` イベント直後は WebRTC フレームのデコードが完了しておらず
 * `canvas.drawImage(video)` が黒を返すことがある。この関数は実際に
 * フレームが届くまで待機してからキャプチャする。
 *
 * 待機戦略（優先順）:
 *  1. `requestVideoFrameCallback` が使える環境（Chrome/Edge）では
 *     最初の実フレームレンダリング後のコールバックでキャプチャする。
 *  2. 非対応環境では `timeupdate` イベントを監視し `videoWidth > 0` に
 *     なった時点でキャプチャする。
 *  3. `readyState >= 2` かつ `videoWidth > 0` が既に満たされていれば即時キャプチャ。
 *
 * @param video      キャプチャ対象の video 要素
 * @param timeoutMs  最大待機時間（デフォルト 15000ms）。超過した場合は Error を throw。
 */
export function waitAndCaptureThumbnailFromVideo(
    video: HTMLVideoElement,
    timeoutMs: number = 15000
): Promise<ArrayBuffer> {
    // 既にフレームが利用可能かつ再生が進んでいれば即時キャプチャ
    // currentTime > 0 を要求することで、t=0 の黒フレームを掴まないようにする
    if (video.readyState >= 2 && video.videoWidth > 0 && video.currentTime > 0) {
        return captureThumbnailFromVideo(video);
    }

    return new Promise<ArrayBuffer>((resolve, reject) => {
        let settled = false;

        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error('waitAndCaptureThumbnailFromVideo: timed out waiting for video frame'));
        }, timeoutMs);

        function cleanup() {
            clearTimeout(timeoutId);
            video.removeEventListener('timeupdate', onTimeupdate);
        }

        function tryCapture() {
            if (settled) return;
            if (video.videoWidth === 0) return; // まだフレームが届いていない
            settled = true;
            cleanup();
            captureThumbnailFromVideo(video).then(resolve, reject);
        }

        // timeupdate でフレーム到着を監視（requestVideoFrameCallback 非対応環境のフォールバック）
        const onTimeupdate = () => tryCapture();
        video.addEventListener('timeupdate', onTimeupdate);

        // requestVideoFrameCallback が使える場合（Chrome/Edge）は最初の実フレームで発火する
        const rvfc = (video as any).requestVideoFrameCallback as
            ((cb: () => void) => void) | undefined;
        if (typeof rvfc === 'function') {
            let rvfcRetries = 0;
            const onFrame = () => {
                if (settled) return;
                if (video.videoWidth === 0 && rvfcRetries < 10) {
                    // フレームは届いているがデコード前のため再登録して次フレームを待つ
                    rvfcRetries++;
                    rvfc.call(video, onFrame);
                    return;
                }
                tryCapture();
            };
            rvfc.call(video, onFrame);
        }
    });
}

/**
 * PDF iframe からサムネイルを生成する。
 * pdf.js が描画した canvas 要素を探して取得する。
 * 失敗時はプレースホルダーを返す。
 */
export async function captureThumbnailFromPdfIframe(iframe: HTMLIFrameElement): Promise<ArrayBuffer> {
    try {
        const doc = iframe.contentDocument;
        if (!doc) throw new Error('no contentDocument');
        const pdfCanvas = doc.querySelector('canvas') as HTMLCanvasElement | null;
        if (!pdfCanvas) throw new Error('no canvas in PDF iframe');

        // pdf.js の canvas からコピー
        const ratio = Math.min(THUMBNAIL_SIZE / pdfCanvas.width, THUMBNAIL_SIZE / pdfCanvas.height, 1);
        const dw = Math.round(pdfCanvas.width * ratio);
        const dh = Math.round(pdfCanvas.height * ratio);

        const canvas = createCanvas(dw, dh);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        ctx.drawImage(pdfCanvas, 0, 0, dw, dh);
        return canvasToPngBuffer(canvas);
    } catch {
        // キャプチャ失敗 → プレースホルダー
        return capturePlaceholder('PDF');
    }
}

/**
 * タイプ名入りのグレーのプレースホルダーサムネイルを生成する。
 * WebGL / PDF など、キャプチャが困難な場合に使用。
 */
export async function capturePlaceholder(label: string): Promise<ArrayBuffer> {
    const canvas = createCanvas(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.fillStyle = '#444444';
    ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

    ctx.fillStyle = '#cccccc';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, THUMBNAIL_SIZE / 2, THUMBNAIL_SIZE / 2);

    return canvasToPngBuffer(canvas);
}

/**
 * 画像バイナリ（PNG/JPEG等）からサムネイルを生成する。
 * Canvas に描画してリサイズすることでクライアント側で完結させる。
 */
export async function captureThumbnailFromImage(binary: ArrayBuffer): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([binary]);
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const ratio = Math.min(
                THUMBNAIL_SIZE / img.naturalWidth,
                THUMBNAIL_SIZE / img.naturalHeight,
                1,
            );
            const dw = Math.round(img.naturalWidth * ratio);
            const dh = Math.round(img.naturalHeight * ratio);
            const canvas = createCanvas(dw, dh);
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }
            ctx.drawImage(img, 0, 0, dw, dh);
            canvasToPngBuffer(canvas).then(resolve).catch(reject);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load failed'));
        };
        img.src = url;
    });
}

/**
 * WebGL (iTowns) iframe からサムネイルを取得する。
 * IFrameConnector に CaptureScreen コマンドを送り、
 * iframe 側から base64 PNG を受け取る。
 * タイムアウトまたはエラー時はプレースホルダーを返す。
 *
 * @param sendToIframe CaptureScreen コマンドを iframe に送る関数。
 *                    Promise で base64 PNG 文字列を返すこと。
 */
export async function captureThumbnailFromWebGL(
    sendToIframe: () => Promise<string>,
    timeoutMs: number = 5000
): Promise<ArrayBuffer> {
    try {
        const base64 = await Promise.race([
            sendToIframe(),
            new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error('CaptureScreen timeout')), timeoutMs)
            ),
        ]);
        // "data:image/png;base64,XXXX" 形式を想定
        const prefix = 'data:image/png;base64,';
        const b64 = base64.startsWith(prefix) ? base64.slice(prefix.length) : base64;
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    } catch {
        return capturePlaceholder('WebGL');
    }
}
