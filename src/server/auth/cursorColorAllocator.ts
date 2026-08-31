import { createCursorColorCandidates } from './cursorColorPalette';
import { hexColorToHue, minHueDistanceToSet, parseHexColor } from './cursorColorDistance';
import type { CursorColorAllocationInput, CursorColorCandidate, CursorColorHex } from './cursorColorTypes';

function normalizeUsedColors(colors: string[]): Set<string> {
    const usedSet = new Set<string>();

    for (const color of colors) {
        const normalized = parseHexColor(color);
        if (normalized !== null) {
            usedSet.add(normalized);
        }
    }

    return usedSet;
}

function collectUsedHues(colors: Set<string>): number[] {
    const hues: number[] = [];

    for (const color of colors) {
        const hue = hexColorToHue(color);
        if (hue !== null) {
            hues.push(hue);
        }
    }

    return hues;
}

function selectFarthestCandidate(
    freeCandidates: CursorColorCandidate[],
    usedHues: number[]
): CursorColorCandidate {
    let selected = freeCandidates[0];
    let selectedScore = minHueDistanceToSet(selected.hue, usedHues);

    for (let i = 1; i < freeCandidates.length; i += 1) {
        const candidate = freeCandidates[i];
        const score = minHueDistanceToSet(candidate.hue, usedHues);

        if (score > selectedScore) {
            selected = candidate;
            selectedScore = score;
            continue;
        }

        if (score === selectedScore && candidate.hue < selected.hue) {
            selected = candidate;
            selectedScore = score;
        }
    }

    return selected;
}

export function allocateCursorColor(input: CursorColorAllocationInput): CursorColorHex {
    const candidates = input.candidates ?? createCursorColorCandidates();
    const usedColorSet = normalizeUsedColors(input.usedColors);

    const freeCandidates = candidates.filter((candidate) => {
        return usedColorSet.has(candidate.color.toLowerCase()) === false;
    });

    if (freeCandidates.length === 0) {
        throw new Error('[CursorColorAllocator] No available cursor color candidate');
    }

    const usedHues = collectUsedHues(usedColorSet);
    const selected = selectFarthestCandidate(freeCandidates, usedHues);

    return selected.color;
}
