import { describe, it } from 'node:test'; // Node.js標準のテストランナー
import assert from 'node:assert';         // Node.js標準のアサーション（検証用）
import { add } from './utils';

// describe: テストのグループ分け
describe('Server Utilities', () => {

    // it: 個別のテストケース
    it('add関数が正しく計算できること', () => {
        const result = add(2, 3);
        // assert.strictEqual(実際の値, 期待する値)
        assert.strictEqual(result, 5);
    });
});

