/**
 * calcWindowFrameStyleUpdate のユニットテスト
 *
 * 旧実装のバグ再発を防ぐ:
 *   1. frame.style.height に { width, height } オブジェクトを渡す → "[object Object]px"
 *   2. アスペクト比計算で virtualWidth を 2 回使い virtualHeight が無視される
 *
 * calcWindowFrameStyleUpdate は DOM 非依存の純粋関数なので tsx --test で直接実行可能。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { calcWindowFrameStyleUpdate, DisplayManager } from './DisplayManager';

// ============================================================
// style.width / style.height
// ============================================================

describe('calcWindowFrameStyleUpdate — width / height', () => {
    it('virtualWidth/Height がそのまま width/height に返る', () => {
        const result = calcWindowFrameStyleUpdate({
            virtualWidth: 960,
            virtualHeight: 540,
        });
        assert.equal(result.width,  960);
        assert.equal(result.height, 540);
    });

    it('virtualWidth と virtualHeight が異なる場合でも height は virtualHeight を使う', () => {
        // 旧バグ: newHeight = virtualWidth * (virtualWidth / pixelWidth) で virtualHeight を無視していた
        const result = calcWindowFrameStyleUpdate({
            virtualWidth: 1920,
            virtualHeight: 800,   // ← 16:9 ではない意図的な高さ
            pixelWidth:  3840,
            pixelHeight: 1600,
        });
        assert.equal(result.height, 800, 'height は virtualHeight そのまま');
    });

    it('width/height は number 型である（文字列やオブジェクトでない）', () => {
        // 旧バグ: `${newWH}` → "[object Object]" になっていた
        const result = calcWindowFrameStyleUpdate({
            virtualWidth: 1920,
            virtualHeight: 1080,
            pixelWidth: 3840,
            pixelHeight: 2160,
        });
        assert.equal(typeof result.width,  'number');
        assert.equal(typeof result.height, 'number');
    });

    it('virtualWidth/Height が未指定なら width/height は null', () => {
        const result = calcWindowFrameStyleUpdate({
            pixelWidth: 1920,
            pixelHeight: 1080,
        });
        assert.equal(result.width,  null);
        assert.equal(result.height, null);
    });

    it('virtualWidth のみ（virtualHeight なし）なら width/height どちらも null', () => {
        const result = calcWindowFrameStyleUpdate({
            virtualWidth: 1920,
        });
        assert.equal(result.width,  null);
        assert.equal(result.height, null);
    });
});

// ============================================================
// dataset.pixelWidth / pixelHeight / dataWidth / dataHeight
// ============================================================

describe('calcWindowFrameStyleUpdate — pixelWidth / pixelHeight', () => {
    it('pixelWidth/Height が dataWidth/dataHeight と pixelWidth/pixelHeight に返る', () => {
        const result = calcWindowFrameStyleUpdate({
            pixelWidth: 3840,
            pixelHeight: 2160,
        });
        assert.equal(result.dataWidth,   3840);
        assert.equal(result.dataHeight,  2160);
        assert.equal(result.pixelWidth,  3840);
        assert.equal(result.pixelHeight, 2160);
    });

    it('pixelWidth/Height が未指定なら null', () => {
        const result = calcWindowFrameStyleUpdate({ virtualWidth: 960, virtualHeight: 540 });
        assert.equal(result.dataWidth,   null);
        assert.equal(result.dataHeight,  null);
        assert.equal(result.pixelWidth,  null);
        assert.equal(result.pixelHeight, null);
    });
});

// ============================================================
// style.left / style.top / dataset.worldX / worldY
// ============================================================

describe('calcWindowFrameStyleUpdate — position', () => {
    it('posx/posy が left/top/worldX/worldY に返る', () => {
        const result = calcWindowFrameStyleUpdate({ posx: 100, posy: 200 });
        assert.equal(result.left,   100);
        assert.equal(result.top,    200);
        assert.equal(result.worldX, 100);
        assert.equal(result.worldY, 200);
    });

    it('posx のみ（posy なし）なら left/top は null', () => {
        const result = calcWindowFrameStyleUpdate({ posx: 100 });
        assert.equal(result.left, null);
        assert.equal(result.top,  null);
    });

    it('posx/posy が 0 のときも正しく返る（falsy 値の誤判定がない）', () => {
        const result = calcWindowFrameStyleUpdate({ posx: 0, posy: 0 });
        assert.equal(result.left,   0);
        assert.equal(result.top,    0);
        assert.equal(result.worldX, 0);
        assert.equal(result.worldY, 0);
    });
});

// ============================================================
// 複合ケース（典型的な UpdateWindowMetaData ペイロード）
// ============================================================

describe('calcWindowFrameStyleUpdate — 複合ケース', () => {
    it('全フィールドが揃っている場合に全値が返る', () => {
        const result = calcWindowFrameStyleUpdate({
            posx: 960,
            posy: 0,
            virtualWidth: 960,
            virtualHeight: 540,
            pixelWidth: 1920,
            pixelHeight: 1080,
        });
        assert.equal(result.left,        960);
        assert.equal(result.top,         0);
        assert.equal(result.width,       960);
        assert.equal(result.height,      540);
        assert.equal(result.dataWidth,   1920);
        assert.equal(result.dataHeight,  1080);
        assert.equal(result.pixelWidth,  1920);
        assert.equal(result.pixelHeight, 1080);
    });

    it('ディスプレイを横に2面並べた右側ウィンドウ: y=0 のまま維持される', () => {
        // 旧バグでは style.height が "[object Object]px" になり
        // コントローラ上の矩形高さが崩れて y 座標ズレに見えた
        const result = calcWindowFrameStyleUpdate({
            posx: 1920,
            posy: 0,
            virtualWidth: 1920,
            virtualHeight: 1080,
            pixelWidth: 1920,
            pixelHeight: 1080,
        });
        assert.equal(result.height, 1080, 'height は virtualHeight = 1080 であること');
        assert.equal(result.top,    0,    'top は posy = 0 であること');
    });
});

// ============================================================
// deleteSelectedDisplay
// ============================================================

describe('DisplayManager.deleteSelectedDisplay', () => {
    const originalConfirm = globalThis.confirm;

    const createManager = (): DisplayManager => {
        const elements = {
            approvedDisplays: null,
            previewDisplay: null,
            siteInDisplayList: null,
            viewArea: null,
            waitApprovalWap: { style: { display: '' } },
            toggleDisplayVisible: { checked: true, dataset: { checked: 'true' } },
        };

        return new DisplayManager({
            elements,
            sendCmd: async (): Promise<any> => {
                return {};
            },
            logFn: (): void => {},
            adminPendingBadge: null,
            manipulator: null,
            getSites: (): any[] => {
                return [];
            },
            getZoom: (): number => {
                return 1;
            },
            pushUpdateStock: (): void => {},
            getSelectedMetadataId: (): string | null => {
                return null;
            },
            setVisiblePendingList: (): void => {},
            buildSiteSelect: (): HTMLSelectElement => {
                return {} as HTMLSelectElement;
            },
            displayWindowFrames: async (): Promise<void> => {},
            renderSiteGrid: (): void => {},
            getCurrentSiteId: (): string | null => {
                return null;
            },
            getEditMode: (): number => {
                return 1;
            },
            contentCreateUpdateStock: (): void => {},
            getSelectedDisplayId: (): string => {
                return '';
            },
            renderAllSiteGrid: (): void => {},
            getIsAdmin: (): boolean => {
                return true;
            },
        });
    };

    it('未選択時は削除処理を実行しない', async (): Promise<void> => {
        const manager = createManager();
        const confirmSpy = mock.fn((): boolean => {
            return true;
        });
        globalThis.confirm = confirmSpy as unknown as typeof globalThis.confirm;
        const deleteSpy = mock.fn(async (): Promise<void> => {});
        (manager as any).deleteDisplay = deleteSpy;

        await manager.deleteSelectedDisplay();

        assert.strictEqual(confirmSpy.mock.calls.length, 0);
        assert.strictEqual(deleteSpy.mock.calls.length, 0);
    });

    it('確認OK時は deleteDisplay 実行後に選択解除する', async (): Promise<void> => {
        const manager = createManager();
        (manager as any)._selectedDisplayId = 'display-1';
        (manager as any)._allApprovedDisplays = [
            { displayId: 'display-1', displayName: 'Display One' },
        ];

        const confirmSpy = mock.fn((): boolean => {
            return true;
        });
        globalThis.confirm = confirmSpy as unknown as typeof globalThis.confirm;

        const deleteSpy = mock.fn(async (): Promise<void> => {});
        (manager as any).deleteDisplay = deleteSpy;

        await manager.deleteSelectedDisplay();

        assert.strictEqual(confirmSpy.mock.calls.length, 1);
        assert.strictEqual(deleteSpy.mock.calls.length, 1);
        assert.strictEqual((manager as any)._selectedDisplayId, null);
    });

    it('確認キャンセル時は削除処理を実行しない', async (): Promise<void> => {
        const manager = createManager();
        (manager as any)._selectedDisplayId = 'display-2';
        (manager as any)._allApprovedDisplays = [
            { displayId: 'display-2', displayName: 'Display Two' },
        ];

        const confirmSpy = mock.fn((): boolean => {
            return false;
        });
        globalThis.confirm = confirmSpy as unknown as typeof globalThis.confirm;

        const deleteSpy = mock.fn(async (): Promise<void> => {});
        (manager as any).deleteDisplay = deleteSpy;

        await manager.deleteSelectedDisplay();

        assert.strictEqual(confirmSpy.mock.calls.length, 1);
        assert.strictEqual(deleteSpy.mock.calls.length, 0);
        assert.strictEqual((manager as any)._selectedDisplayId, 'display-2');
    });

    it('確認文言には displayName を優先し、なければ displayId を使う', async (): Promise<void> => {
        const manager = createManager();
        (manager as any)._selectedDisplayId = 'display-3';
        (manager as any)._allApprovedDisplays = [
            { displayId: 'display-3', displayName: '' },
        ];

        const confirmSpy = mock.fn((message?: string): boolean => {
            assert.ok((message || '').includes('display-3'));
            return false;
        });
        globalThis.confirm = confirmSpy as unknown as typeof globalThis.confirm;

        const deleteSpy = mock.fn(async (): Promise<void> => {});
        (manager as any).deleteDisplay = deleteSpy;

        await manager.deleteSelectedDisplay();

        assert.strictEqual(confirmSpy.mock.calls.length, 1);
        assert.strictEqual(deleteSpy.mock.calls.length, 0);
    });

    it('deleteDisplay が例外の場合は例外を伝播する', async (): Promise<void> => {
        const manager = createManager();
        (manager as any)._selectedDisplayId = 'display-4';
        (manager as any)._allApprovedDisplays = [
            { displayId: 'display-4', displayName: 'Display Four' },
        ];

        const confirmSpy = mock.fn((): boolean => {
            return true;
        });
        globalThis.confirm = confirmSpy as unknown as typeof globalThis.confirm;
        (manager as any).deleteDisplay = async (): Promise<void> => {
            throw new Error('delete failed');
        };

        await assert.rejects(
            async (): Promise<void> => {
                await manager.deleteSelectedDisplay();
            },
            (error: Error): boolean => {
                return error.message === 'delete failed';
            },
        );
    });

    it('confirm 差し替えを元に戻す', (): void => {
        globalThis.confirm = originalConfirm;
        assert.ok(true);
    });
});
