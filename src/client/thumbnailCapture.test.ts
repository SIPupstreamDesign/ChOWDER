/**
 * thumbnailCapture 単体テスト
 *
 * DOM APIに依存するため、globalThis.document を最小限モックして実行する。
 *
 * モック方針:
 *   - document.createElement('canvas') → toBlob が PNG を返す最小 Canvas Mock
 *   - HTMLVideoElement は手動で構築したモックオブジェクトで代替
 *   - Blob / ArrayBuffer は Node.js ネイティブ API をそのまま使用
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
    captureThumbnailFromVideo,
    waitAndCaptureThumbnailFromVideo,
} from './thumbnailCapture';

// ============================================================
// モックファクトリ
// ============================================================

/** 最小限のダミーバイナリ（内容はサムネイルの正当性テストでは不問） */
const DUMMY_PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * canvas.toBlob が PNG Blob を非同期に返す最小 Canvas モックを作成する。
 */
function makeMockCanvas() {
    return {
        width: 0,
        height: 0,
        getContext(_type: string) {
            return {
                drawImage() {},
                fillRect() {},
                fillStyle: '' as string,
                font: '' as string,
                textAlign: '' as string,
                textBaseline: '' as string,
                fillText() {},
                measureText(text: string) { return { width: text.length * 8 }; },
            };
        },
        toBlob(cb: (blob: Blob | null) => void, _mime?: string) {
            // 実際のブラウザと同様に非同期で Blob を渡す
            Promise.resolve().then(() => cb(new Blob([DUMMY_PNG_BYTES])));
        },
    };
}

/**
 * HTMLVideoElement モックを作成する。
 *
 * @param opts.readyState   初期 readyState（デフォルト 4 = HAVE_ENOUGH_DATA）
 * @param opts.videoWidth   videoWidth（デフォルト 640）
 * @param opts.videoHeight  videoHeight（デフォルト 480）
 * @param opts.hasRVFC      requestVideoFrameCallback を持つかどうか
 */
function makeVideoMock(opts: {
    readyState?: number;
    videoWidth?: number;
    videoHeight?: number;
    hasRVFC?: boolean;
    currentTime?: number;
} = {}) {
    const listeners = new Map<string, Array<(e: Event) => void>>();
    let rvfcCb: (() => void) | null = null;

    const video: any = {
        readyState: opts.readyState ?? 4,
        videoWidth: opts.videoWidth ?? 640,
        videoHeight: opts.videoHeight ?? 480,
        currentTime: opts.currentTime ?? 1,

        addEventListener(type: string, handler: (e: Event) => void) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type)!.push(handler);
        },
        removeEventListener(type: string, handler: (e: Event) => void) {
            const arr = listeners.get(type);
            if (!arr) return;
            const idx = arr.indexOf(handler);
            if (idx !== -1) arr.splice(idx, 1);
        },

        /** テストからイベントを手動発火する */
        _fire(type: string) {
            const arr = listeners.get(type) ?? [];
            for (const h of [...arr]) h(new Event(type));
        },
    };

    if (opts.hasRVFC) {
        video.requestVideoFrameCallback = (cb: () => void) => {
            rvfcCb = cb;
        };
        /** テストから requestVideoFrameCallback のコールバックを手動発火する */
        video._fireRVFC = () => {
            if (rvfcCb) rvfcCb();
        };
    }

    // テストモックは videoWidth / readyState への書き込みが必要なため any で返す
    return video as any;
}

// ============================================================
// グローバル document モックのセットアップ / クリーンアップ
// ============================================================

let savedDocument: unknown;

beforeEach(() => {
    savedDocument = (globalThis as any).document;
    (globalThis as any).document = {
        createElement(tag: string) {
            if (tag === 'canvas') return makeMockCanvas();
            throw new Error(`createElement: unsupported tag "${tag}"`);
        },
    };
});

afterEach(() => {
    (globalThis as any).document = savedDocument;
});

// ============================================================
// captureThumbnailFromVideo テスト
// ============================================================

describe('captureThumbnailFromVideo', () => {
    it('readyState < 2 の場合は Error を throw する', async () => {
        const video = makeVideoMock({ readyState: 1, videoWidth: 640 });
        await assert.rejects(
            () => captureThumbnailFromVideo(video),
            /Video not ready/
        );
    });

    it('videoWidth === 0 の場合は Error を throw する（黒サムネイル防止）', async () => {
        const video = makeVideoMock({ readyState: 4, videoWidth: 0 });
        await assert.rejects(
            () => captureThumbnailFromVideo(video),
            /videoWidth.*0|frame not yet available/i
        );
    });

    it('readyState >= 2 かつ videoWidth > 0 の場合は ArrayBuffer を返す', async () => {
        const video = makeVideoMock({ readyState: 4, videoWidth: 640, videoHeight: 480 });
        const result = await captureThumbnailFromVideo(video);
        assert.ok(result instanceof ArrayBuffer);
        assert.ok(result.byteLength > 0);
    });
});

// ============================================================
// waitAndCaptureThumbnailFromVideo テスト
// ============================================================

describe('waitAndCaptureThumbnailFromVideo', () => {
    it('既に readyState >= 2 かつ videoWidth > 0 かつ currentTime > 0 なら即時 ArrayBuffer を返す', async () => {
        const video = makeVideoMock({ readyState: 4, videoWidth: 640, currentTime: 1 });
        const result = await waitAndCaptureThumbnailFromVideo(video, 5000);
        assert.ok(result instanceof ArrayBuffer);
        assert.ok(result.byteLength > 0);
    });

    it('currentTime === 0 のときは即時キャプチャを行わず timeupdate を待つ（黒フレーム防止）', async () => {
        const video = makeVideoMock({ readyState: 4, videoWidth: 640, currentTime: 0, hasRVFC: false });
        const capturePromise = waitAndCaptureThumbnailFromVideo(video, 5000);

        // currentTime=0 の状態では即時解決しないはず
        let resolved = false;
        capturePromise.then(() => { resolved = true; });
        await new Promise<void>((r) => setTimeout(r, 20));
        assert.strictEqual(resolved, false, 'currentTime=0 では即時キャプチャされてはいけない');

        // currentTime が進んでから timeupdate を発火 → 解決
        video.currentTime = 0.5;
        (video as any)._fire('timeupdate');

        const result = await capturePromise;
        assert.ok(result instanceof ArrayBuffer);
        assert.ok(result.byteLength > 0);
    });

    it('requestVideoFrameCallback が使える場合: RVFC 発火後にキャプチャして ArrayBuffer を返す', async () => {
        const video = makeVideoMock({ readyState: 1, videoWidth: 0, hasRVFC: true });
        const capturePromise = waitAndCaptureThumbnailFromVideo(video, 5000);

        // フレーム到着をシミュレート: videoWidth / readyState を更新してから RVFC を発火
        video.videoWidth = 640;
        video.readyState = 4;
        video._fireRVFC!();

        const result = await capturePromise;
        assert.ok(result instanceof ArrayBuffer);
        assert.ok(result.byteLength > 0);
    });

    it('requestVideoFrameCallback 非対応: timeupdate 発火後にキャプチャして ArrayBuffer を返す', async () => {
        const video = makeVideoMock({ readyState: 1, videoWidth: 0, hasRVFC: false });
        const capturePromise = waitAndCaptureThumbnailFromVideo(video, 5000);

        // フレーム到着をシミュレート: videoWidth / readyState を更新してから timeupdate
        video.videoWidth = 640;
        video.readyState = 4;
        (video as any)._fire('timeupdate');

        const result = await capturePromise;
        assert.ok(result instanceof ArrayBuffer);
        assert.ok(result.byteLength > 0);
    });

    it('timeupdate が来ても videoWidth === 0 のままなら待機を続け即フェイルしない', async () => {
        const video = makeVideoMock({ readyState: 1, videoWidth: 0, hasRVFC: false });
        const capturePromise = waitAndCaptureThumbnailFromVideo(video, 5000);

        // videoWidth = 0 のまま timeupdate → スキップされるはず
        (video as any)._fire('timeupdate');

        // 直後はまだ未解決のはず
        let resolved = false;
        capturePromise.then(() => {
            resolved = true;
        });
        await new Promise<void>((r) => setTimeout(r, 20));
        assert.strictEqual(resolved, false, 'videoWidth=0 の timeupdate でキャプチャされてはいけない');

        // フレーム到着 → 解決
        video.videoWidth = 640;
        video.readyState = 4;
        (video as any)._fire('timeupdate');

        const result = await capturePromise;
        assert.ok(result instanceof ArrayBuffer);
    });

    it('タイムアウトを超えた場合は Error を throw する', async () => {
        const video = makeVideoMock({ readyState: 1, videoWidth: 0, hasRVFC: false });
        await assert.rejects(
            () => waitAndCaptureThumbnailFromVideo(video, 50), // 50ms タイムアウト
            /timed out/i
        );
    });
});
