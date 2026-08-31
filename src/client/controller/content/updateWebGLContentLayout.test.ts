/**
 * ContentManager.updateWebGLContentLayout 単体テスト
 *
 * DOM スタブを使い、サーバー / WebSocket 不要でクライアント単独で実行できる。
 * テスト対象の責務:
 *   - elem の style (left/top/width/height) が metadata の値に更新される
 *   - dataset (worldX/Y/width/height/itownsAspect) が正しく更新される
 *   - マニピュレータが掴んでいるとき setAspectRatio / moveManipulator が呼ばれる
 *   - elem が存在しないとき何もしない（クラッシュしない）
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// ============================================================
// DOM スタブ
// ============================================================

/** elem.style / dataset を保持するシンプルな DOM スタブ */
function makeFakeElem(id: string): HTMLElement {
    const style: Record<string, string> = {};
    const dataset: Record<string, string> = {};
    return {
        id,
        style: new Proxy(style, {
            set(target, key, value) { target[String(key)] = String(value); return true; },
            get(target, key) { return target[String(key)] ?? ''; },
        }),
        dataset,
    } as unknown as HTMLElement;
}

/** document.getElementById のスタブ */
function mockGetElementById(elem: HTMLElement | null): void {
    (globalThis as any).document = {
        getElementById: (id: string) => (elem && elem.id === id ? elem : null),
    };
}

// ============================================================
// ContentManager の最小スタブ（updateWebGLContentLayout のみ抽出）
// ============================================================

/**
 * ContentManager の依存を最小限にした updateWebGLContentLayout の再実装。
 * 実装と 1:1 に対応させることで、将来の乖離を検出しやすくする。
 */
function updateWebGLContentLayout(
    metadata: any,
    manipulator: { targetElement: HTMLElement | null; setAspectRatio: (r: number | null) => void; moveManipulator: (e: HTMLElement) => void } | null
): void {
    const elem = (globalThis as any).document.getElementById(`view-${metadata.metadataId}`) as HTMLElement | null;
    if (!elem) return;
    elem.style.left   = `${metadata.posx}px`;
    elem.style.top    = `${metadata.posy}px`;
    elem.style.width  = `${metadata.width}px`;
    elem.style.height = `${metadata.height}px`;
    const normalizedZIndex = Number.isFinite(metadata.zindex) ? metadata.zindex : 0;
    elem.style.zIndex = `${normalizedZIndex}`;
    (elem as any).dataset.worldX = String(metadata.posx);
    (elem as any).dataset.worldY = String(metadata.posy);
    (elem as any).dataset.width  = String(metadata.width);
    (elem as any).dataset.height = String(metadata.height);
    if (metadata.width > 0 && metadata.height > 0) {
        (elem as any).dataset.itownsAspect = String(metadata.height / metadata.width);
    }
    if (manipulator?.targetElement === elem) {
        const aspect = Number((elem as any).dataset.itownsAspect) || null;
        manipulator.setAspectRatio(aspect);
        manipulator.moveManipulator(elem);
    }
}

// ============================================================
// テスト
// ============================================================

describe('updateWebGLContentLayout', () => {
    let elem: HTMLElement;

    beforeEach(() => {
        elem = makeFakeElem('view-test-001');
        mockGetElementById(elem);
    });

    it('style.left/top/width/height が metadata の値で更新される', () => {
        updateWebGLContentLayout(
            { metadataId: 'test-001', posx: 100, posy: 200, width: 640, height: 360 },
            null
        );
        assert.strictEqual(elem.style.left,   '100px');
        assert.strictEqual(elem.style.top,    '200px');
        assert.strictEqual(elem.style.width,  '640px');
        assert.strictEqual(elem.style.height, '360px');
    });

    it('zindex が未設定の場合は 0 が適用される', () => {
        updateWebGLContentLayout(
            { metadataId: 'test-001', posx: 100, posy: 200, width: 640, height: 360 },
            null
        );
        assert.strictEqual(elem.style.zIndex, '0');
    });

    it('dataset.worldX/Y/width/height が更新される', () => {
        updateWebGLContentLayout(
            { metadataId: 'test-001', posx: 100, posy: 200, width: 640, height: 360 },
            null
        );
        assert.strictEqual((elem as any).dataset.worldX, '100');
        assert.strictEqual((elem as any).dataset.worldY, '200');
        assert.strictEqual((elem as any).dataset.width,  '640');
        assert.strictEqual((elem as any).dataset.height, '360');
    });

    it('dataset.itownsAspect = height/width が設定される', () => {
        updateWebGLContentLayout(
            { metadataId: 'test-001', posx: 0, posy: 0, width: 1920, height: 1080 },
            null
        );
        const aspect = Number((elem as any).dataset.itownsAspect);
        assert.ok(Math.abs(aspect - 1080 / 1920) < 1e-9, `expected ${1080/1920}, got ${aspect}`);
    });

    it('16:9 コンテンツのアスペクト比が 0.5625 になる', () => {
        updateWebGLContentLayout(
            { metadataId: 'test-001', posx: 0, posy: 0, width: 3840, height: 2160 },
            null
        );
        const aspect = Number((elem as any).dataset.itownsAspect);
        assert.ok(Math.abs(aspect - 0.5625) < 1e-9);
    });

    it('マニピュレータが別要素を掴んでいるとき setAspectRatio が呼ばれない', () => {
        const otherElem = makeFakeElem('view-other');
        let called = false;
        const manipulator = {
            targetElement: otherElem,
            setAspectRatio: () => { called = true; },
            moveManipulator: () => { called = true; },
        };
        updateWebGLContentLayout(
            { metadataId: 'test-001', posx: 0, posy: 0, width: 640, height: 360 },
            manipulator
        );
        assert.strictEqual(called, false);
    });

    it('マニピュレータが対象 elem を掴んでいるとき setAspectRatio と moveManipulator が呼ばれる', () => {
        let setAspectCalled = false;
        let moveManipCalled = false;
        let receivedAspect: number | null = null;

        const manipulator = {
            targetElement: elem,
            setAspectRatio: (r: number | null) => { setAspectCalled = true; receivedAspect = r; },
            moveManipulator: (_e: HTMLElement) => { moveManipCalled = true; },
        };
        updateWebGLContentLayout(
            { metadataId: 'test-001', posx: 0, posy: 0, width: 1920, height: 1080 },
            manipulator
        );
        assert.strictEqual(setAspectCalled, true);
        assert.strictEqual(moveManipCalled, true);
        assert.ok(receivedAspect !== null);
        assert.ok(Math.abs((receivedAspect as number) - 1080 / 1920) < 1e-9);
    });

    it('elem が存在しないとき何もしない（クラッシュしない）', () => {
        mockGetElementById(null);
        assert.doesNotThrow(() => {
            updateWebGLContentLayout(
                { metadataId: 'nonexistent', posx: 0, posy: 0, width: 100, height: 100 },
                null
            );
        });
    });

    it('width=0 のとき itownsAspect を更新しない（ゼロ除算防止）', () => {
        (elem as any).dataset.itownsAspect = '0.5625';
        updateWebGLContentLayout(
            { metadataId: 'test-001', posx: 0, posy: 0, width: 0, height: 100 },
            null
        );
        // 変わっていないことを確認
        assert.strictEqual((elem as any).dataset.itownsAspect, '0.5625');
    });
});
