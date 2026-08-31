/**
 * ContentManager.addImageFile 単体テスト
 *
 * 検証する挙動:
 *   1. 小さい画像（< 4000px）は通常の AddContent として送信される
 *   2. 幅が 4000px 以上の画像はタイルイメージとして送信される
 *   3. 高さが 4000px 以上の画像はタイルイメージとして送信される
 *   4. PDF はサイズ判定なしで AddContent（type='pdf'）として送信される
 *   5. posx/posy が viewArea の style から正しく計算される
 *   6. sendBinaryCmd に渡す arrayBuffer が null/undefined でない
 *   7. 画像サイズ取得失敗時はエラーログを出して処理を中止する
 *   8. tileThresholds が null の場合はエラーログを出して処理を中止する
 *
 * モック方針:
 *   - globalThis.Image を差し込んで naturalWidth/naturalHeight を制御
 *   - globalThis.URL.createObjectURL / revokeObjectURL をスタブ化
 *   - tileUploader.upload を spy 関数で置き換える
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ContentManager } from './ContentManager';

// ============================================================
// Image モック制御
// ============================================================

let mockImageNaturalWidth = 100;
let mockImageNaturalHeight = 100;
let mockImageShouldFail = false;

// ============================================================
// DOM スタブ
// ============================================================

function makeDiv(id = '') {
    const styleStore: Record<string, string> = {};
    const classNameSet = new Set<string>();
    const listeners = new Map<string, Array<(event: any) => void>>();
    return {
        id,
        style: new Proxy(styleStore, {
            set(t, k, v) { t[String(k)] = String(v); return true; },
            get(t, k) { return t[String(k)] ?? ''; },
        }),
        dataset: {} as Record<string, string>,
        classList: {
            add(cls: string) { classNameSet.add(cls); },
            remove(cls: string) { classNameSet.delete(cls); },
            contains(cls: string) { return classNameSet.has(cls); },
        },
        firstChild: null,
        children: [] as unknown[],
        appendChild(child: unknown) { return child; },
        insertBefore(child: unknown) { return child; },
        addEventListener(type: string, handler: (event: any) => void) {
            const registered = listeners.get(type) ?? [];
            registered.push(handler);
            listeners.set(type, registered);
        },
        removeEventListener() {},
        dispatchEvent(event: any) {
            const type = String(event?.type ?? '');
            const registered = listeners.get(type) ?? [];
            for (const handler of registered) {
                handler(event);
            }
            return true;
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        remove() {},
        innerHTML: '',
    };
}

let savedDocument: unknown;
let savedURL: unknown;
let savedImageClass: unknown;

function setupDom() {
    savedDocument = (globalThis as any).document;
    savedURL = (globalThis as any).URL;
    savedImageClass = (globalThis as any).Image;

    (globalThis as any).document = {
        createElement(_tag: string) { return makeDiv(); },
        getElementById(_id: string) { return null; },
        body: { appendChild(_child: unknown) {} },
    };

    (globalThis as any).URL = {
        createObjectURL(_blob: unknown): string { return 'blob:mock'; },
        revokeObjectURL(_url: string): void {},
    };

    (globalThis as any).Image = class MockImage {
        naturalWidth: number = mockImageNaturalWidth;
        naturalHeight: number = mockImageNaturalHeight;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_url: string) {
            if (mockImageShouldFail) {
                Promise.resolve().then(() => {
                    if (this.onerror !== null) { this.onerror(); }
                });
            } else {
                Promise.resolve().then(() => {
                    if (this.onload !== null) { this.onload(); }
                });
            }
        }
    };
}

function teardownDom() {
    (globalThis as any).document = savedDocument;
    (globalThis as any).URL = savedURL;
    (globalThis as any).Image = savedImageClass;
}

// ============================================================
// ContentManager 最小 deps ファクトリ
// ============================================================

interface SpyCalls {
    sendCmdCalls?: string[];
    sendBinaryCalls: Array<{ method: string; params: any; arrayBuffer: ArrayBuffer }>;
    tileUploaderUploadCalls: Array<{ file: File; contentMeta: any }>;
    logCalls: Array<{ message: string; type: string }>;
    addVideoFileCalls: Array<{ file: File; streamName: string }>;
    inspectResult?: any;
    tileUploaderShouldFail?: boolean;
    tileUploaderFailureMessage?: string;
    elements?: any;
}

function makeMinimalDeps(spy: SpyCalls) {
    const fakeViewArea = makeDiv('view-area');
    fakeViewArea.style.left = '-200px';
    fakeViewArea.style.top = '-100px';

    const el: any = {
        viewArea: fakeViewArea,
        previewContent: makeDiv('preview-content'),
        metadataList: { innerHTML: '' },
        width: { value: '1920' },
        height: { value: '1080' },
        tileUploadOverlay: makeDiv('tile-upload-overlay'),
        tileUploadFilename: makeDiv('tile-upload-filename'),
        tileUploadBar: makeDiv('tile-upload-bar'),
        tileUploadLabel: makeDiv('tile-upload-label'),
        tileimageProgressBar: makeDiv('tileimage-progress-bar'),
        tileimageProgressLabel: makeDiv('tileimage-progress-label'),
    };
    spy.elements = el;

    return {
        elements: el,
        sendCmd: async (method: string, _params: unknown): Promise<any> => {
            spy.sendCmdCalls?.push(method);
            return {};
        },
        sendBinaryCmd: async (method: string, params: any, arrayBuffer: ArrayBuffer): Promise<any> => {
            spy.sendBinaryCalls.push({ method, params, arrayBuffer });
            if (method === 'InspectContentData') {
                return spy.inspectResult ?? { kind: 'unknown', mime: '', isSupported: false, reason: 'unknown' };
            }
            return {};
        },
        logFn: (message: string, type?: 'info' | 'error' | 'success'): void => {
            spy.logCalls.push({ message, type: type ?? '' });
        },
        manipulator: null,
        getZoom: (): number => { return 1; },
        pushUpdateStock: (): void => {},
        getSocketId: (): string | null => { return 'socket-id'; },
        getCurrentUser: (): string | null => { return 'user'; },
        getLiveStreamManager: (): null => { return null; },
        tileUploader: {
            upload: async (file: File, contentMeta: any, _progressCb: unknown, _maxSize: number): Promise<void> => {
                spy.tileUploaderUploadCalls.push({ file, contentMeta });
                if (spy.tileUploaderShouldFail === true) {
                    throw new Error(spy.tileUploaderFailureMessage ?? 'Tile upload processing failed: simulated');
                }
            },
        } as any,
        registerBroadcast: (): void => {},
        consumePendingProducer: (): null => { return null; },
        handleNewProducer: async (_params: unknown): Promise<void> => {},
        getEditMode: (): number => { return 0; },
        showRightClickMenu: (_e: MouseEvent): void => {},
        stopVideoFileByMetadata: async (_metadataId: string): Promise<boolean> => { return false; },
        addVideoFile: async (file: File, streamName: string): Promise<void> => {
            spy.addVideoFileCalls.push({ file, streamName });
        },
    };
}

// ============================================================
// テスト
// ============================================================

describe('ContentManager.addImageFile', () => {
    beforeEach(() => {
        setupDom();
        mockImageNaturalWidth = 100;
        mockImageNaturalHeight = 100;
        mockImageShouldFail = false;
    });

    afterEach(() => {
        teardownDom();
    });

    it('小さい画像（800×600）は通常の AddContent として送信される', async () => {
        const spy: SpyCalls = { sendBinaryCalls: [], tileUploaderUploadCalls: [], logCalls: [], addVideoFileCalls: [] };
        const manager = new ContentManager(makeMinimalDeps(spy));
        manager.setTileThresholds({ width: 4000, height: 4000 });

        mockImageNaturalWidth = 800;
        mockImageNaturalHeight = 600;

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'test.png', { type: 'image/png' });
        await manager.addImageFile(file);

        assert.strictEqual(spy.sendBinaryCalls.length, 1);
        assert.strictEqual(spy.sendBinaryCalls[0].method, 'AddContent');
        assert.strictEqual(spy.sendBinaryCalls[0].params.type, 'image');
        assert.strictEqual(spy.tileUploaderUploadCalls.length, 0);
    });

    it('幅が 4000px 以上の画像はタイルイメージとして送信される', async () => {
        const spy: SpyCalls = { sendBinaryCalls: [], tileUploaderUploadCalls: [], logCalls: [], addVideoFileCalls: [] };
        const manager = new ContentManager(makeMinimalDeps(spy));
        manager.setTileThresholds({ width: 4000, height: 4000 });

        mockImageNaturalWidth = 4000;
        mockImageNaturalHeight = 3000;

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'large.png', { type: 'image/png' });
        await manager.addImageFile(file);

        assert.strictEqual(spy.tileUploaderUploadCalls.length, 1);
        assert.strictEqual(spy.sendBinaryCalls.length, 0);
    });

    it('高さが 4000px 以上の画像はタイルイメージとして送信される', async () => {
        const spy: SpyCalls = { sendBinaryCalls: [], tileUploaderUploadCalls: [], logCalls: [], addVideoFileCalls: [] };
        const manager = new ContentManager(makeMinimalDeps(spy));
        manager.setTileThresholds({ width: 4000, height: 4000 });

        mockImageNaturalWidth = 1000;
        mockImageNaturalHeight = 4000;

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'tall.png', { type: 'image/png' });
        await manager.addImageFile(file);

        assert.strictEqual(spy.tileUploaderUploadCalls.length, 1);
        assert.strictEqual(spy.sendBinaryCalls.length, 0);
    });

    it('PDF はサイズ判定なしで AddContent（type="pdf"）として送信される', async () => {
        const spy: SpyCalls = { sendBinaryCalls: [], tileUploaderUploadCalls: [], logCalls: [], addVideoFileCalls: [] };
        const manager = new ContentManager(makeMinimalDeps(spy));
        manager.setTileThresholds({ width: 4000, height: 4000 });

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'doc.pdf', { type: 'application/pdf' });
        await manager.addImageFile(file);

        assert.strictEqual(spy.sendBinaryCalls.length, 1);
        assert.strictEqual(spy.sendBinaryCalls[0].method, 'AddContent');
        assert.strictEqual(spy.sendBinaryCalls[0].params.type, 'pdf');
        assert.strictEqual(spy.tileUploaderUploadCalls.length, 0);
    });

    it('posx/posy は 0 起点から計算される（metadataList が空なら posx=0, posy=0）', async () => {
        const spy: SpyCalls = { sendBinaryCalls: [], tileUploaderUploadCalls: [], logCalls: [], addVideoFileCalls: [] };
        const manager = new ContentManager(makeMinimalDeps(spy));
        manager.setTileThresholds({ width: 4000, height: 4000 });

        mockImageNaturalWidth = 100;
        mockImageNaturalHeight = 100;

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'small.png', { type: 'image/png' });
        await manager.addImageFile(file);

        assert.strictEqual(spy.sendBinaryCalls[0].params.posx, 0);
        assert.strictEqual(spy.sendBinaryCalls[0].params.posy, 0);
    });

    it('sendBinaryCmd に渡す arrayBuffer は null/undefined でない', async () => {
        const spy: SpyCalls = { sendBinaryCalls: [], tileUploaderUploadCalls: [], logCalls: [], addVideoFileCalls: [] };
        const manager = new ContentManager(makeMinimalDeps(spy));
        manager.setTileThresholds({ width: 4000, height: 4000 });

        mockImageNaturalWidth = 100;
        mockImageNaturalHeight = 100;

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'small.png', { type: 'image/png' });
        await manager.addImageFile(file);

        assert.notStrictEqual(spy.sendBinaryCalls[0].arrayBuffer, null);
        assert.notStrictEqual(spy.sendBinaryCalls[0].arrayBuffer, undefined);
    });

    it('画像サイズ取得失敗時はタイルイメージ送信へフォールバックする', async () => {
        const spy: SpyCalls = { sendBinaryCalls: [], tileUploaderUploadCalls: [], logCalls: [], addVideoFileCalls: [] };
        const manager = new ContentManager(makeMinimalDeps(spy));
        manager.setTileThresholds({ width: 4000, height: 4000 });

        mockImageShouldFail = true;

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'broken.png', { type: 'image/png' });
        await manager.addImageFile(file);

        assert.strictEqual(spy.sendBinaryCalls.length, 0);
        assert.strictEqual(spy.tileUploaderUploadCalls.length, 1);
        const hasError = spy.logCalls.some((call) => { return call.type === 'error'; });
        assert.strictEqual(hasError, true);
    });

    it('タイル送信失敗時はメタデータ一覧を再取得する', async () => {
        const spy: SpyCalls = {
            sendCmdCalls: [],
            sendBinaryCalls: [],
            tileUploaderUploadCalls: [],
            logCalls: [],
            addVideoFileCalls: [],
            tileUploaderShouldFail: true,
        };
        const manager = new ContentManager(makeMinimalDeps(spy));
        manager.setTileThresholds({ width: 4000, height: 4000 });

        mockImageNaturalWidth = 5000;
        mockImageNaturalHeight = 3000;

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'large.png', { type: 'image/png' });
        await manager.addImageFile(file);
        await new Promise((resolve) => { setTimeout(resolve, 150); });

        const refreshCalls = spy.sendCmdCalls?.filter((method) => {
            return method === 'GetMetaData';
        }) ?? [];
        assert.ok(refreshCalls.length >= 1);
    });

    it('タイムアウト時はプログレスオーバーレイにエラーを表示して手動で閉じられる', async () => {
        const spy: SpyCalls = {
            sendCmdCalls: [],
            sendBinaryCalls: [],
            tileUploaderUploadCalls: [],
            logCalls: [],
            addVideoFileCalls: [],
            tileUploaderShouldFail: true,
            tileUploaderFailureMessage: 'Tile upload timed out: meta-timeout',
        };
        const manager = new ContentManager(makeMinimalDeps(spy));
        manager.setTileThresholds({ width: 4000, height: 4000 });

        mockImageNaturalWidth = 5000;
        mockImageNaturalHeight = 3000;

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'large-timeout.png', { type: 'image/png' });
        await manager.addImageFile(file);

        assert.strictEqual(spy.elements.tileUploadOverlay.style.display, 'grid');
        assert.strictEqual(spy.elements.tileUploadOverlay.dataset.state, 'error');
        assert.strictEqual(
            spy.elements.tileUploadLabel.textContent.includes('Tile upload timed out.'),
            true,
        );
        assert.strictEqual(
            spy.elements.tileUploadLabel.classList.contains('tile-upload-error'),
            true,
        );

        spy.elements.tileUploadOverlay.dispatchEvent({
            type: 'click',
            target: spy.elements.tileUploadOverlay,
        });

        assert.strictEqual(spy.elements.tileUploadOverlay.style.display, 'none');
        assert.strictEqual(spy.elements.tileUploadOverlay.dataset.state, 'idle');
    });

    it('tileThresholds が null の場合はエラーログを出して処理を中止する', async () => {
        const spy: SpyCalls = { sendBinaryCalls: [], tileUploaderUploadCalls: [], logCalls: [], addVideoFileCalls: [] };
        const manager = new ContentManager(makeMinimalDeps(spy));
        // setTileThresholds を呼び出さない（null のまま）

        mockImageNaturalWidth = 100;
        mockImageNaturalHeight = 100;

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'small.png', { type: 'image/png' });
        await manager.addImageFile(file);

        assert.strictEqual(spy.sendBinaryCalls.length, 0);
        assert.strictEqual(spy.tileUploaderUploadCalls.length, 0);
        const hasError = spy.logCalls.some((call) => { return call.type === 'error'; });
        assert.strictEqual(hasError, true);
    });

    it('setTileThresholds で開値を変更できる（小さい閾値で大きい画像がタイル化される）', async () => {
        const spy: SpyCalls = { sendBinaryCalls: [], tileUploaderUploadCalls: [], logCalls: [], addVideoFileCalls: [] };
        const manager = new ContentManager(makeMinimalDeps(spy));
        manager.setTileThresholds({ width: 500, height: 500 });

        mockImageNaturalWidth = 600;
        mockImageNaturalHeight = 400;

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'medium.png', { type: 'image/png' });
        await manager.addImageFile(file);

        assert.strictEqual(spy.tileUploaderUploadCalls.length, 1);
        assert.strictEqual(spy.sendBinaryCalls.length, 0);
    });

    it('不明MIMEでもサーバー判別でimageなら addImageFile 経路に進む', async () => {
        const spy: SpyCalls = {
            sendBinaryCalls: [],
            tileUploaderUploadCalls: [],
            logCalls: [],
            addVideoFileCalls: [],
            inspectResult: {
                kind: 'image',
                mime: 'image/png',
                width: 800,
                height: 600,
                isSupported: true,
                reason: 'ok',
                needsServerProbe: false,
            },
        };
        const manager = new ContentManager(makeMinimalDeps(spy));
        manager.setTileThresholds({ width: 4000, height: 4000 });

        mockImageNaturalWidth = 800;
        mockImageNaturalHeight = 600;

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'mystery.bin', { type: '' });
        await manager.addFileWithAutoDetection(file);

        const hasInspect = spy.sendBinaryCalls.some((call) => { return call.method === 'InspectContentData'; });
        const hasAddContent = spy.sendBinaryCalls.some((call) => { return call.method === 'AddContent'; });
        assert.strictEqual(hasInspect, true);
        assert.strictEqual(hasAddContent, true);
    });

    it('不明MIMEでもサーバー判別でvideoなら addVideoFile 経路に進む', async () => {
        const spy: SpyCalls = {
            sendBinaryCalls: [],
            tileUploaderUploadCalls: [],
            logCalls: [],
            addVideoFileCalls: [],
            inspectResult: {
                kind: 'video',
                mime: 'video/mp4',
                width: null,
                height: null,
                isSupported: true,
                reason: 'ok',
                needsServerProbe: false,
            },
        };
        const manager = new ContentManager(makeMinimalDeps(spy));
        manager.setTileThresholds({ width: 4000, height: 4000 });

        const file = new File([new Uint8Array([0, 1, 2, 3])], 'mystery.dat', { type: '' });
        await manager.addFileWithAutoDetection(file);

        assert.strictEqual(spy.addVideoFileCalls.length, 1);
    });
});
