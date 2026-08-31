import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildDisplayZIndexMapByOrder,
    compareContentMetadataForDisplayOrder,
} from './contentOrder';

describe('contentOrder', () => {
    it('zindex 同値時は createdAt と metadataId で順序が決まる', () => {
        const metadataList = [
            { metadataId: 'b', zindex: 0, createdAt: '2024-01-01T00:00:00.000Z' },
            { metadataId: 'a', zindex: 0, createdAt: '2024-01-01T00:00:00.000Z' },
            { metadataId: 'c', zindex: 0, createdAt: '2023-12-31T23:59:59.000Z' },
        ];

        const sortedIds = [...metadataList]
            .sort(compareContentMetadataForDisplayOrder)
            .map((item) => item.metadataId);

        assert.deepStrictEqual(sortedIds, ['c', 'a', 'b']);

        const zIndexMap = buildDisplayZIndexMapByOrder(metadataList);
        assert.strictEqual(zIndexMap.get('c'), 0);
        assert.strictEqual(zIndexMap.get('a'), 1);
        assert.strictEqual(zIndexMap.get('b'), 2);
    });

    it('zindex のギャップがある場合は可能な限り元の zindex を維持する', () => {
        const metadataList = [
            { metadataId: 'a', zindex: 0, createdAt: '2024-01-01T00:00:00.000Z' },
            { metadataId: 'b', zindex: 5, createdAt: '2024-01-01T00:00:01.000Z' },
            { metadataId: 'c', zindex: 5, createdAt: '2024-01-01T00:00:02.000Z' },
            { metadataId: 'd', zindex: 10, createdAt: '2024-01-01T00:00:03.000Z' },
        ];

        const zIndexMap = buildDisplayZIndexMapByOrder(metadataList);

        assert.strictEqual(zIndexMap.get('a'), 0);
        assert.strictEqual(zIndexMap.get('b'), 5);
        assert.strictEqual(zIndexMap.get('c'), 6);
        assert.strictEqual(zIndexMap.get('d'), 10);
    });
});
