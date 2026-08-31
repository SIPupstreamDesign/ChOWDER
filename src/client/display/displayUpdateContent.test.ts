import { describe, it } from 'node:test';
import assert from 'node:assert';
import { shouldReloadRegularContentByPolicy } from './updateContentReloadPolicy';
import type { ContentMetadata } from './contentCoordinates';

function makeMeta(overrides: Partial<ContentMetadata> = {}): ContentMetadata {
    return {
        metadataId: 'meta-001',
        binaryId: 'bin-001',
        type: 'image',
        posx: 0,
        posy: 0,
        width: 100,
        height: 100,
        zindex: 0,
        ...overrides,
    };
}

describe('shouldReloadRegularContentByPolicy', () => {
    it('AddContent は常に再読み込みする', () => {
        const previous = makeMeta();
        const incoming = makeMeta();
        const shouldReload = shouldReloadRegularContentByPolicy('AddContent', previous, incoming);
        assert.strictEqual(shouldReload, true);
    });

    it('previous が未定義の場合は再読み込みする', () => {
        const incoming = makeMeta();
        const shouldReload = shouldReloadRegularContentByPolicy('UpdateContent', undefined, incoming);
        assert.strictEqual(shouldReload, true);
    });

    it('text の UpdateContent は binaryId が同じでも再読み込みする', () => {
        const previous = makeMeta({ type: 'text', binaryId: 'same-bin' });
        const incoming = makeMeta({ type: 'text', binaryId: 'same-bin' });
        const shouldReload = shouldReloadRegularContentByPolicy('UpdateContent', previous, incoming);
        assert.strictEqual(shouldReload, true);
    });

    it('url の UpdateContent は binaryId が同じでも再読み込みする', () => {
        const previous = makeMeta({ type: 'url', binaryId: 'same-bin' });
        const incoming = makeMeta({ type: 'url', binaryId: 'same-bin' });
        const shouldReload = shouldReloadRegularContentByPolicy('UpdateContent', previous, incoming);
        assert.strictEqual(shouldReload, true);
    });

    it('image の UpdateContent は binaryId が同じなら再読み込みしない', () => {
        const previous = makeMeta({ type: 'image', binaryId: 'same-bin' });
        const incoming = makeMeta({ type: 'image', binaryId: 'same-bin' });
        const shouldReload = shouldReloadRegularContentByPolicy('UpdateContent', previous, incoming);
        assert.strictEqual(shouldReload, false);
    });

    it('image の UpdateContent は binaryId が変わったら再読み込みする', () => {
        const previous = makeMeta({ type: 'image', binaryId: 'old-bin' });
        const incoming = makeMeta({ type: 'image', binaryId: 'new-bin' });
        const shouldReload = shouldReloadRegularContentByPolicy('UpdateContent', previous, incoming);
        assert.strictEqual(shouldReload, true);
    });
});
