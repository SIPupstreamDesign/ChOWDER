import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    adjustContentLayoutDimensions,
    parseContentLayoutValues,
    resolveContentAspectRatio,
} from './contentLayoutValues';

describe('parseContentLayoutValues', () => {
    it('allows negative positions and fractional dimensions', (): void => {
        const result = parseContentLayoutValues({
            posX: '-12.5',
            posY: '0.25',
            width: '100.5',
            height: '80.25',
        });

        assert.deepStrictEqual(result, {
            posx: -12.5,
            posy: 0.25,
            width: 100.5,
            height: 80.25,
        });
    });

    it('rejects empty values instead of converting them to zero', (): void => {
        const result = parseContentLayoutValues({
            posX: '',
            posY: '20',
            width: '100',
            height: '80',
        });

        assert.strictEqual(result, null);
    });

    it('rejects non-finite positions and non-positive dimensions', (): void => {
        const nonFinitePosition = parseContentLayoutValues({
            posX: 'Infinity',
            posY: '20',
            width: '100',
            height: '80',
        });
        const zeroWidth = parseContentLayoutValues({
            posX: '10',
            posY: '20',
            width: '0',
            height: '80',
        });

        assert.strictEqual(nonFinitePosition, null);
        assert.strictEqual(zeroWidth, null);
    });
});

describe('resolveContentAspectRatio', () => {
    it('prefers a valid iTowns viewport ratio over content dimensions', (): void => {
        const result = resolveContentAspectRatio({
            itownsAspect: '0.75',
            contentAspect: '0.5',
        });

        assert.strictEqual(result, 0.75);
    });

    it('falls back to a valid content ratio when the iTowns ratio is invalid', (): void => {
        const result = resolveContentAspectRatio({
            itownsAspect: 'Infinity',
            contentAspect: '0.5',
        });

        assert.strictEqual(result, 0.5);
    });

    it('returns null when no valid intrinsic ratio is available', (): void => {
        const result = resolveContentAspectRatio({
            itownsAspect: '0',
            contentAspect: '',
        });

        assert.strictEqual(result, null);
    });
});

describe('adjustContentLayoutDimensions', () => {
    it('preserves the edited width and derives a fractional height', (): void => {
        const result = adjustContentLayoutDimensions(
            { width: 333, height: 180 },
            'width',
            0.5,
        );

        assert.deepStrictEqual(result, { width: 333, height: 166.5 });
    });

    it('preserves the edited height and derives a fractional width', (): void => {
        const result = adjustContentLayoutDimensions(
            { width: 320, height: 181 },
            'height',
            0.5625,
        );

        assert.deepStrictEqual(result, { width: 181 / 0.5625, height: 181 });
    });

    it('uses the latest width when a live video ratio arrives later', (): void => {
        const latestWidth = 853;
        const result = adjustContentLayoutDimensions(
            { width: latestWidth, height: 300 },
            'width',
            9 / 16,
        );

        assert.deepStrictEqual(result, {
            width: latestWidth,
            height: latestWidth * (9 / 16),
        });
    });

    it('rejects non-finite dimensions produced by ratio adjustment', (): void => {
        const result = adjustContentLayoutDimensions(
            { width: Number.MAX_VALUE, height: 1 },
            'width',
            Number.MAX_VALUE,
        );

        assert.strictEqual(result, null);
    });
});