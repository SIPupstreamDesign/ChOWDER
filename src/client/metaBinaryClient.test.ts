import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    createMetaBinary,
    parseMetaBinary,
    arrayBufferToBase64,
    base64ToArrayBuffer,
} from './metaBinaryClient';

describe('createMetaBinary / parseMetaBinary (ArrayBuffer版)', () => {
    it('メタデータとバイナリを作成してパースできる', () => {
        const meta = { method: 'AddContent', id: '42' };
        const src = new Uint8Array([0x01, 0x02, 0x03, 0x04]).buffer;
        const packed = createMetaBinary(meta, src);
        const { metadata, binary } = parseMetaBinary(packed);

        assert.deepStrictEqual(metadata, meta);
        assert.deepStrictEqual(
            new Uint8Array(binary),
            new Uint8Array([0x01, 0x02, 0x03, 0x04])
        );
    });

    it('バイナリが空でも動作する', () => {
        const meta = { method: 'Ping' };
        const src = new ArrayBuffer(0);
        const packed = createMetaBinary(meta, src);
        const { metadata, binary } = parseMetaBinary(packed);

        assert.deepStrictEqual(metadata, meta);
        assert.strictEqual(binary.byteLength, 0);
    });

    it('マルチバイト文字を含むメタデータが正しく復元される', () => {
        const meta = { name: '日本語テスト', value: 123 };
        const src = new Uint8Array([0xff]).buffer;
        const packed = createMetaBinary(meta, src);
        const { metadata } = parseMetaBinary(packed);

        assert.deepStrictEqual(metadata, meta);
    });

    it('バイナリデータの内容が劣化しない（全バイト値）', () => {
        const meta = { id: 'test' };
        const bytes = new Uint8Array(256);
        for (let i = 0; i < 256; i++) bytes[i] = i;
        const packed = createMetaBinary(meta, bytes.buffer);
        const { binary } = parseMetaBinary(packed);

        assert.deepStrictEqual(new Uint8Array(binary), bytes);
    });

    it('ヘッダーが不正な場合は例外が投げられる', () => {
        const invalid = new TextEncoder().encode('INVALID:' + '0'.repeat(20)).buffer;
        assert.throws(() => parseMetaBinary(invalid), /Invalid MetaBinary header/);
    });

    it('ネストしたオブジェクトのメタデータが復元される', () => {
        const meta = { params: { type: 'image', posx: 100, posy: 200 } };
        const src = new Uint8Array([0xde, 0xad]).buffer;
        const packed = createMetaBinary(meta, src);
        const { metadata } = parseMetaBinary(packed);

        assert.deepStrictEqual(metadata, meta);
    });
});

describe('arrayBufferToBase64 / base64ToArrayBuffer', () => {
    it('ArrayBuffer を Base64 に変換し元に戻せる', () => {
        const original = new Uint8Array([72, 101, 108, 108, 111]).buffer; // "Hello"
        const b64 = arrayBufferToBase64(original);
        assert.strictEqual(b64, 'SGVsbG8=');
        const restored = base64ToArrayBuffer(b64);
        assert.deepStrictEqual(new Uint8Array(restored), new Uint8Array(original));
    });

    it('空の ArrayBuffer は空文字列になる', () => {
        const b64 = arrayBufferToBase64(new ArrayBuffer(0));
        assert.strictEqual(b64, '');
        const restored = base64ToArrayBuffer(b64);
        assert.strictEqual(restored.byteLength, 0);
    });

    it('全バイト値のラウンドトリップ', () => {
        const bytes = new Uint8Array(256);
        for (let i = 0; i < 256; i++) bytes[i] = i;
        const b64 = arrayBufferToBase64(bytes.buffer);
        const restored = base64ToArrayBuffer(b64);
        assert.deepStrictEqual(new Uint8Array(restored), bytes);
    });
});
