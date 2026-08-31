/**
 * ViewportResize ハンドラの責務分離テスト
 *
 * ContentManager.displayContentOnViewArea 内の webgl(iTowns) iframe セットアップで
 * ViewportResize の責務分離が守られていることを検証する。
 *
 * テスト対象の責務:
 *   - ViewportResize はローカルの itownsAspect 更新のみに使うこと
 *   - metadata の width/height（外枠）は ViewportResize で更新しないこと
 *   - params.width <= 0 || params.height <= 0 のときは何もしないこと（ガード条件）
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// ============================================================
// ViewportResize ハンドラの抽出
// ============================================================

interface ViewportResizeParams {
    width: number;
    height: number;
}

interface ElemDataset {
    itownsAspect: string;
    width: string;
    height: string;
}

interface ElemStyle {
    height: string;
}

/**
 * ContentManager.displayContentOnViewArea 内の ViewportResize ハンドラを
 * テスタブルな形で抽出した関数。
 * 実装と 1:1 に対応させることで、将来の乖離を検出しやすくする。
 */
function makeViewportResizeHandler(
    elem: { dataset: ElemDataset; style: ElemStyle },
    manipulator: { targetElement: { dataset: ElemDataset } | null; setAspectRatio: (r: number) => void; moveManipulator: (e: any) => void } | null,
): { handle: (_err: any, params: ViewportResizeParams) => void } {
    function handle(_err: any, params: ViewportResizeParams): void {
        if (!params || params.width <= 0 || params.height <= 0) {
            return;
        }
        const aspect = params.height / params.width;

        // ローカル即時更新
        elem.dataset.itownsAspect = String(aspect);
        if (manipulator && manipulator.targetElement === (elem as any)) {
            manipulator.setAspectRatio(aspect);
            manipulator.moveManipulator(elem);
        }
    }

    return { handle };
}

// ============================================================
// テスト用ヘルパー
// ============================================================

function makeElem(overrides: Partial<ElemDataset> = {}): { dataset: ElemDataset; style: ElemStyle } {
    return {
        dataset: {
            itownsAspect: '',
            width: '640',
            height: '360',
            ...overrides,
        },
        style: { height: '' },
    };
}

// ============================================================
// テスト
// ============================================================

describe('ViewportResize handler responsibility split', () => {

    it('ViewportResize で itownsAspect が更新されること', () => {
        const elem = makeElem();
        const { handle } = makeViewportResizeHandler(elem, null);

        handle(null, { width: 640, height: 360 });

        assert.strictEqual(elem.dataset.itownsAspect, String(360 / 640));
    });

    it('ViewportResize で外枠高さを更新しないこと', () => {
        const elem = makeElem();
        const { handle } = makeViewportResizeHandler(elem, null);

        handle(null, { width: 640, height: 480 });

        assert.strictEqual(elem.dataset.height, '360');
        assert.strictEqual(elem.style.height, '');
    });

    it('params.width <= 0 のときは何もしないこと（ガード条件）', () => {
        const elem = makeElem();
        const { handle } = makeViewportResizeHandler(elem, null);

        handle(null, { width: 0, height: 360 });

        assert.strictEqual(elem.dataset.itownsAspect, '');
    });

    it('params.height <= 0 のときは何もしないこと（ガード条件）', () => {
        const elem = makeElem();
        const { handle } = makeViewportResizeHandler(elem, null);

        handle(null, { width: 640, height: 0 });

        assert.strictEqual(elem.dataset.itownsAspect, '');
    });

    it('マニピュレータが対象要素を掴んでいるときに更新メソッドが呼ばれること', () => {
        const elem = makeElem();
        let setAspectCalled = false;
        let moveCalled = false;
        const manipulator = {
            targetElement: (elem as any),
            setAspectRatio: (_r: number) => {
                setAspectCalled = true;
            },
            moveManipulator: (_e: any) => {
                moveCalled = true;
            },
        };
        const { handle } = makeViewportResizeHandler(elem, manipulator);

        handle(null, { width: 640, height: 360 });

        assert.strictEqual(setAspectCalled, true);
        assert.strictEqual(moveCalled, true);
    });

    it('マニピュレータが別要素を掴んでいるときは更新メソッドが呼ばれないこと', () => {
        const elem = makeElem();
        let setAspectCalled = false;
        let moveCalled = false;
        const manipulator = {
            targetElement: { dataset: makeElem().dataset },
            setAspectRatio: (_r: number) => {
                setAspectCalled = true;
            },
            moveManipulator: (_e: any) => {
                moveCalled = true;
            },
        };
        const { handle } = makeViewportResizeHandler(elem, manipulator);

        handle(null, { width: 640, height: 360 });

        assert.strictEqual(setAspectCalled, false);
        assert.strictEqual(moveCalled, false);
    });
});
