const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function hueFromRgb(red: number, green: number, blue: number): number {
    const r = red / 255;
    const g = green / 255;
    const b = blue / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    if (delta === 0) {
        return 0;
    }

    let hue = 0;
    if (max === r) {
        hue = ((g - b) / delta) % 6;
    } else if (max === g) {
        hue = ((b - r) / delta) + 2;
    } else {
        hue = ((r - g) / delta) + 4;
    }

    const degree = hue * 60;
    if (degree < 0) {
        return degree + 360;
    }

    return degree;
}

export function parseHexColor(color: string): string | null {
    if (HEX_COLOR_PATTERN.test(color) === false) {
        return null;
    }

    return color.toLowerCase();
}

export function hexColorToHue(color: string): number | null {
    const normalized = parseHexColor(color);
    if (normalized === null) {
        return null;
    }

    const red = Number.parseInt(normalized.slice(1, 3), 16);
    const green = Number.parseInt(normalized.slice(3, 5), 16);
    const blue = Number.parseInt(normalized.slice(5, 7), 16);

    return hueFromRgb(red, green, blue);
}

export function hueCircularDistance(hueA: number, hueB: number): number {
    const diff = Math.abs(hueA - hueB);
    return Math.min(diff, 360 - diff);
}

export function minHueDistanceToSet(hue: number, hues: number[]): number {
    if (hues.length === 0) {
        return 180;
    }

    let minDistance = Number.POSITIVE_INFINITY;

    for (const targetHue of hues) {
        const distance = hueCircularDistance(hue, targetHue);
        if (distance < minDistance) {
            minDistance = distance;
        }
    }

    return minDistance;
}
