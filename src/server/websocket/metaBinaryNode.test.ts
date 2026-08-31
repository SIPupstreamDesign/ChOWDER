import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    createMetaBinary,
    createMetaBinaryMulti,
    loadMetaBinary,
} from './metaBinaryNode';

describe('createMetaBinary / loadMetaBinary (Node.js Buffer版)', () => {
    it('メタデータとバイナリを作成してロードできる', (_, done) => {
        const meta = { method: 'AddContent', id: '42' };
        const binary = Buffer.from([0x01, 0x02, 0x03, 0x04]);
        const result = createMetaBinary(meta, binary);

        loadMetaBinary(result, (metaData, content) => {
            assert.deepStrictEqual(metaData, meta);
            assert.ok(Buffer.isBuffer(content));
            assert.deepStrictEqual(content as Buffer, binary);
            done();
        });
    });

    it('バイナリが空でも動作する', (_, done) => {
        const meta = { method: 'Ping' };
        const binary = Buffer.alloc(0);
        const result = createMetaBinary(meta, binary);

        loadMetaBinary(result, (metaData, content) => {
            assert.deepStrictEqual(metaData, meta);
            assert.ok(Buffer.isBuffer(content));
            assert.strictEqual((content as Buffer).length, 0);
            done();
        });
    });

    it('type が text のとき content は string になる', (_, done) => {
        const meta = { params: { type: 'text' } };
        const binary = Buffer.from('hello world', 'utf8');
        const result = createMetaBinary(meta, binary);

        loadMetaBinary(result, (metaData, content) => {
            assert.strictEqual(typeof content, 'string');
            assert.strictEqual(content, 'hello world');
            done();
        });
    });

    it('type が url のとき content は string になる', (_, done) => {
        const meta = { params: { type: 'url' } };
        const binary = Buffer.from('https://example.com', 'utf8');
        const result = createMetaBinary(meta, binary);

        loadMetaBinary(result, (metaData, content) => {
            assert.strictEqual(typeof content, 'string');
            assert.strictEqual(content, 'https://example.com');
            done();
        });
    });

    it('ヘッダーが不正な場合は callback が呼ばれない', () => {
        const invalid = Buffer.from('INVALID:' + '0'.repeat(20), 'utf8');
        let called = false;
        loadMetaBinary(invalid, () => { called = true; });
        assert.strictEqual(called, false);
    });

    it('result フィールドから params を取得できる', (_, done) => {
        const meta = { result: { type: 'url' } };
        const binary = Buffer.from('https://example.com', 'utf8');
        const result = createMetaBinary(meta, binary);

        loadMetaBinary(result, (metaData, content) => {
            assert.strictEqual(typeof content, 'string');
            done();
        });
    });

    it('param フィールドから params を取得できる', (_, done) => {
        const meta = { param: { type: 'layout' } };
        const binary = Buffer.from('layout-data', 'utf8');
        const result = createMetaBinary(meta, binary);

        loadMetaBinary(result, (_metaData, content) => {
            assert.strictEqual(typeof content, 'string');
            done();
        });
    });

    it('マルチバイト文字を含むメタデータが正しく復元される', (_, done) => {
        const meta = { name: '日本語テスト', value: 123 };
        const binary = Buffer.from([0xff]);
        const result = createMetaBinary(meta, binary);

        loadMetaBinary(result, (metaData, _content) => {
            assert.deepStrictEqual(metaData, meta);
            done();
        });
    });
});

describe('createMetaBinaryMulti', () => {
    it('単一バイナリで作成でき、ヘッダーは MetaBin: で始まる', () => {
        const meta = { method: 'AddContent', id: '1' };
        const metaList = [{ id: '1', posx: 0 }];
        const binaryList = [Buffer.from([0x01, 0x02])];
        const result = createMetaBinaryMulti(meta, metaList, binaryList);

        assert.ok(result !== null);
        assert.strictEqual(result!.slice(0, 8).toString('ascii'), 'MetaBin:');
        // version は 2
        assert.strictEqual(result!.readUInt32LE(8), 2);
    });

    it('metaDataList が空のとき null を返す', () => {
        const result = createMetaBinaryMulti({}, [], [Buffer.from([0x01])]);
        assert.strictEqual(result, null);
    });

    it('binaryList が空のとき null を返す', () => {
        const result = createMetaBinaryMulti({}, [{ id: '1' }], []);
        assert.strictEqual(result, null);
    });

    it('metaDataList と binaryList の長さが異なるとき null を返す', () => {
        const result = createMetaBinaryMulti(
            {},
            [{ id: '1' }, { id: '2' }],
            [Buffer.from([0x01])]
        );
        assert.strictEqual(result, null);
    });
});
