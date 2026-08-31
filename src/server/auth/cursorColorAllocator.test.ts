import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allocateCursorColor } from './cursorColorAllocator';
import type { CursorColorCandidate } from './cursorColorTypes';

describe('allocateCursorColor', () => {
    it('未使用候補から色を割り当てること', (): void => {
        const color = allocateCursorColor({ usedColors: [] });

        assert.ok(/^#[0-9a-fA-F]{6}$/.test(color));
    });

    it('使用済み色とは重複しないこと', (): void => {
        const usedColors = ['#ea3939', '#e73ce7'];

        const color = allocateCursorColor({ usedColors });

        assert.notStrictEqual(color.toLowerCase(), usedColors[0]);
        assert.notStrictEqual(color.toLowerCase(), usedColors[1]);
    });

    it('hue最小距離が最大の候補を選ぶこと', (): void => {
        const candidates: CursorColorCandidate[] = [
            { hue: 0, color: '#ff0000' },
            { hue: 90, color: '#80ff00' },
            { hue: 180, color: '#00ffff' },
            { hue: 270, color: '#8000ff' },
        ];

        const color = allocateCursorColor({
            usedColors: ['#ff0000', '#80ff00'],
            candidates,
        });

        assert.strictEqual(color, '#00ffff');
    });

    it('候補が枯渇した場合はエラーになること', (): void => {
        const candidates: CursorColorCandidate[] = [
            { hue: 0, color: '#ff0000' },
        ];

        assert.throws((): string => {
            return allocateCursorColor({
                usedColors: ['#ff0000'],
                candidates,
            });
        });
    });
});
