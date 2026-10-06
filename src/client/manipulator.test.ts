/**
 * Manipulator.onMouseMove の zoom 補正 単体テスト
 *
 * リグレッション防止:
 *   showManipulator(elem, area, zoom) に zoom 引数を渡し忘れると
 *   this.zoom がデフォルト値 1 にリセットされ、次回のリサイズドラッグで
 *   移動量が zoom 倍ズレる。
 *
 *   再発箇所: ContentManager.ts で showManipulator を呼ぶ全箇所に
 *   this.getZoom() を渡すこと。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Manipulator } from './manipulator.js';

function withDragDocument(run: () => void): void {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const listeners = new Map<string, unknown>();
    const body = { style: { cursor: 'default', userSelect: 'text' } };
    Object.defineProperty(globalThis, 'document', {
        configurable: true, value: {
            body,
            addEventListener: (name: string, listener: unknown): void => { listeners.set(name, listener); },
            removeEventListener: (name: string): void => { listeners.delete(name); },
        }
    });
    try {
        run();
        assert.equal(listeners.size, 0);
        assert.equal(body.style.cursor, 'default');
        assert.equal(body.style.userSelect, 'text');
    } finally {
        if (original !== undefined) { Object.defineProperty(globalThis, 'document', original); }
        else { Reflect.deleteProperty(globalThis, 'document'); }
    }
}

// ============================================================
// DOM スタブ
// ============================================================

type DataMap = Record<string, string | undefined>;
type StyleMap = Record<string, string>;

function makeFakeElem(dataset: DataMap = {}): HTMLElement {
    const style: StyleMap = {};
    return {
        style: new Proxy(style, {
            set(t, k, v): boolean { t[String(k)] = String(v); return true; },
            get(t, k): string { return t[String(k)] ?? ''; },
        }),
        dataset,
    } as unknown as HTMLElement;
}

// ============================================================
// ヘルパー: SE ハンドル (index=2) でリサイズ中の状態を設定して onMouseMove を呼ぶ
// ============================================================

function resizeSE(
    zoom: number,
    rawDx: number,
    rawDy: number = 0,
    startWidth: number = 640,
    startHeight: number = 480,
): { width: number; height: number } {
    const manip = new Manipulator();
    manip.init(() => { return; });

    const elem = makeFakeElem({
        width: String(startWidth),
        height: String(startHeight),
        worldX: '0',
        worldY: '0',
    });

    // private フィールドをテスト用に直接設定
    const m = manip as any;
    m.isDragging = true;
    m.zoom = zoom;
    m.startX = 0;
    m.startY = 0;
    m.startWidth = startWidth;
    m.startHeight = startHeight;
    m.startLeft = 0;
    m.startTop = 0;
    m.draggingHandleIndex = 2; // SE
    m.aspectRatio = null;
    m.targetElem = elem;
    // manipulators = [] のまま → moveManipulator が length < 3 で early return する

    manip.onMouseMove({ clientX: rawDx, clientY: rawDy, buttons: 1 } as MouseEvent);

    return {
        width: Number(elem.dataset.width),
        height: Number(elem.dataset.height),
    };
}

// ============================================================
// テスト
// ============================================================

describe('Manipulator onMouseMove: zoom 補正', () => {
    it('zoom=1 のとき rawDx がそのまま width に加算される', (): void => {
        // Arrange / Act
        const result = resizeSE(1, 200);

        // Assert: dx = 200/1 = 200 → newWidth = 640 + 200 = 840
        assert.strictEqual(result.width, 840);
    });

    it('zoom=2 のとき rawDx が zoom で割られて width に加算される', (): void => {
        // Arrange / Act
        // リグレッション: showManipulator に zoom 未指定 → zoom=1 のまま → width=840 になる
        const result = resizeSE(2, 200);

        // Assert: dx = 200/2 = 100 → newWidth = 640 + 100 = 740
        assert.strictEqual(result.width, 740);
    });

    it('zoom=0.5 のとき rawDx が拡大されて width に加算される', (): void => {
        // Arrange / Act
        const result = resizeSE(0.5, 100);

        // Assert: dx = 100/0.5 = 200 → newWidth = 640 + 200 = 840
        assert.strictEqual(result.width, 840);
    });

    it('zoom=2 かつ dy 方向にも移動したとき width と height 両方に zoom 補正が適用される', (): void => {
        // Arrange / Act: rawDx=200, rawDy=100, zoom=2
        const result = resizeSE(2, 200, 100);

        // Assert: dx=200/2=100 → newWidth=740, dy=100/2=50 → newHeight=530
        assert.strictEqual(result.width, 740);
        assert.strictEqual(result.height, 530);
    });
});

describe('Manipulator operation lifecycle', (): void => {
    it('cancels once without registering an update', (): void => {
        withDragDocument((): void => {
            const manip = new Manipulator();
            const target = makeFakeElem({ width: '100.75', height: '80.25', worldX: '0', worldY: '0' });
            let updates = 0;
            let cancellations = 0;
            manip.init((): void => { updates++; });
            manip.setLifecycle({
                onStart: (): boolean => { return true; },
                onEnd: (): void => { assert.fail('must not complete a cancelled operation'); },
                onCancel: (): void => { cancellations++; },
            });
            manip.beginResize(target, 2, { button: 0, clientX: 0, clientY: 0 } as MouseEvent);
            manip.onMouseMove({ buttons: 1, clientX: 10, clientY: 0 } as MouseEvent);
            assert.equal(Number(target.dataset.width), 110.75);
            manip.cancel();
            manip.cancel();
            manip.onMouseUp();
            assert.equal(updates, 0);
            assert.equal(cancellations, 1);
            assert.equal(manip.targetElement, null);
            assert.equal(manip.isInteracting, false);
        });
    });

    it('completes an unchanged display resize without an update', (): void => {
        withDragDocument((): void => {
            const manip = new Manipulator();
            const target = makeFakeElem({ width: '100.75', height: '80.25', worldX: '0', worldY: '0' });
            let updates = 0;
            let completions = 0;
            manip.init((): void => { updates++; });
            manip.setLifecycle({
                onStart: (): boolean => { return true; },
                onEnd: (_target: HTMLElement, changed: boolean): void => { assert.equal(changed, false); completions++; },
                onCancel: (): void => { assert.fail('must not cancel'); },
            });
            manip.beginResize(target, 2, { button: 0, clientX: 0, clientY: 0 } as MouseEvent);
            manip.onMouseUp();
            manip.onMouseUp();
            assert.equal(updates, 0);
            assert.equal(completions, 1);
        });
    });
});
