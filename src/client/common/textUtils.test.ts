/**
 * textUtils 単体テスト
 *
 * Node.js 組み込みテストランナー（tsx --test）で実行する。
 * DOM API 非依存の純粋関数 calcTextFontSize のみテストする。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calcTextFontSize } from './textUtils';

describe('calcTextFontSize', () => {
    it('1行・高さ200 → 199px', () => {
        assert.strictEqual(calcTextFontSize(200, 1), 199);
    });

    it('2行・高さ100 → 49px（floor((100-1)/2)）', () => {
        assert.strictEqual(calcTextFontSize(100, 2), 49);
    });

    it('3行・高さ100 → 33px（floor((100-1)/3)）', () => {
        assert.strictEqual(calcTextFontSize(100, 3), 33);
    });

    it('高さが小さすぎる場合は最小値 9px を返す', () => {
        assert.strictEqual(calcTextFontSize(10, 5), 9);  // floor(9/5)=1 → clamp to 9
    });

    it('高さ 0 の場合は 9px', () => {
        assert.strictEqual(calcTextFontSize(0, 1), 9);   // floor(-1/1)=-1 → clamp to 9
    });

    it('lineCount が 0 の場合は 1 行扱いで計算する', () => {
        assert.strictEqual(calcTextFontSize(200, 0), 199);
    });

    it('lineCount が負の場合は 1 行扱いで計算する', () => {
        assert.strictEqual(calcTextFontSize(200, -5), 199);
    });

    it('高さ 1 の場合は 9px（floor(0/1)=0 → clamp）', () => {
        assert.strictEqual(calcTextFontSize(1, 1), 9);
    });

    it('高さ 100・1行 → 99px', () => {
        assert.strictEqual(calcTextFontSize(100, 1), 99);
    });

    it('大きな行数でも 9px 未満にならない', () => {
        const result = calcTextFontSize(50, 100);
        assert.ok(result >= 9, `Expected >= 9, got ${result}`);
    });
});
