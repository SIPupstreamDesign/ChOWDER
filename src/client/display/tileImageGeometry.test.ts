import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTileRect, getVisibleTileIndices, shouldUseReduction } from './tileImageGeometry';

describe('getTileRect', () => {
    it('端部タイルを元画像上の有効寸法で返す', (): void => {
        const bottomRight = getTileRect(1000, 700, 256, 11);

        assert.deepStrictEqual(bottomRight, {
            tileIndex: 11,
            column: 3,
            row: 2,
            left: 768,
            top: 512,
            width: 232,
            height: 188,
        });
    });

    it('画像がtileSize未満の場合は画像全体を1タイルとして返す', (): void => {
        const tile = getTileRect(200, 100, 512, 0);

        assert.deepStrictEqual(tile, {
            tileIndex: 0,
            column: 0,
            row: 0,
            left: 0,
            top: 0,
            width: 200,
            height: 100,
        });
    });

    it('設定値512でも行優先のtileIndexから有効矩形を返す', (): void => {
        const tile = getTileRect(1100, 900, 512, 5);

        assert.deepStrictEqual(tile, {
            tileIndex: 5,
            column: 2,
            row: 1,
            left: 1024,
            top: 512,
            width: 76,
            height: 388,
        });
    });

    it('不正な寸法や範囲外のtileIndexを拒否する', (): void => {
        assert.strictEqual(getTileRect(0, 700, 256, 0), null);
        assert.strictEqual(getTileRect(1000, 700, 0, 0), null);
        assert.strictEqual(getTileRect(1000, 700, 256, 12), null);
        assert.strictEqual(getTileRect(1000, 700, 256, -1), null);
    });
});

describe('getVisibleTileIndices', () => {
    it('viewportに交差するタイルのみを行優先で返す', (): void => {
        const tileIndices = getVisibleTileIndices(
            1000,
            700,
            256,
            { posx: 100, posy: 50, width: 1000, height: 700 },
            { posx: 356, posy: 50, virtualWidth: 256, virtualHeight: 256 },
        );

        assert.deepStrictEqual(tileIndices, [1]);
    });

    it('完全に画面外ならタイルを返さない', (): void => {
        const tileIndices = getVisibleTileIndices(
            1000,
            700,
            256,
            { posx: 100, posy: 50, width: 1000, height: 700 },
            { posx: 2000, posy: 2000, virtualWidth: 256, virtualHeight: 256 },
        );

        assert.deepStrictEqual(tileIndices, []);
    });
});

describe('shouldUseReduction', () => {
    it('DPR適用後に両軸が縮小画像内なら縮小画像を使う', (): void => {
        assert.strictEqual(shouldUseReduction(960, 540, 1920, 1080, 2), true);
    });

    it('DPR適用後にいずれかの軸が不足すればタイルを使う', (): void => {
        assert.strictEqual(shouldUseReduction(961, 540, 1920, 1080, 2), false);
        assert.strictEqual(shouldUseReduction(960, 541, 1920, 1080, 2), false);
    });

    it('無効な寸法は縮小画像の選択に使わない', (): void => {
        assert.strictEqual(shouldUseReduction(0, 540, 1920, 1080, 1), false);
    });
});