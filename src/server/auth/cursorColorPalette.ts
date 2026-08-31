import type { CursorColorCandidate, CursorColorHex } from './cursorColorTypes';

const DEFAULT_SATURATION = 72;
const LIGHTNESS_LEVELS: number[] = [56, 46];

function clampChannel(value: number): number {
    if (value < 0) {
        return 0;
    }
    if (value > 255) {
        return 255;
    }
    return Math.round(value);
}

function channelToHex(channel: number): string {
    return clampChannel(channel).toString(16).padStart(2, '0');
}

function hslToHex(hue: number, saturationPercent: number, lightnessPercent: number): CursorColorHex {
    const saturation = saturationPercent / 100;
    const lightness = lightnessPercent / 100;
    const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
    const sector = hue / 60;
    const x = chroma * (1 - Math.abs((sector % 2) - 1));

    let red = 0;
    let green = 0;
    let blue = 0;

    if (sector >= 0 && sector < 1) {
        red = chroma;
        green = x;
    } else if (sector >= 1 && sector < 2) {
        red = x;
        green = chroma;
    } else if (sector >= 2 && sector < 3) {
        green = chroma;
        blue = x;
    } else if (sector >= 3 && sector < 4) {
        green = x;
        blue = chroma;
    } else if (sector >= 4 && sector < 5) {
        red = x;
        blue = chroma;
    } else {
        red = chroma;
        blue = x;
    }

    const match = lightness - (chroma / 2);
    const redChannel = (red + match) * 255;
    const greenChannel = (green + match) * 255;
    const blueChannel = (blue + match) * 255;

    return `#${channelToHex(redChannel)}${channelToHex(greenChannel)}${channelToHex(blueChannel)}` as CursorColorHex;
}

export function createCursorColorCandidates(): CursorColorCandidate[] {
    const candidates: CursorColorCandidate[] = [];

    for (let hue = 0; hue < 360; hue += 1) {
        for (const lightness of LIGHTNESS_LEVELS) {
            candidates.push({
                hue,
                color: hslToHex(hue, DEFAULT_SATURATION, lightness),
            });
        }
    }

    return candidates;
}
