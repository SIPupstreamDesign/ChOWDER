export interface ContentLayoutInputValues {
    posX: string;
    posY: string;
    width: string;
    height: string;
}

export interface ContentLayoutValues {
    posx: number;
    posy: number;
    width: number;
    height: number;
}

export interface ContentLayoutDimensions {
    width: number;
    height: number;
}

export interface ContentAspectData {
    itownsAspect?: string;
    contentAspect?: string;
}

export type ContentLayoutDimension = 'width' | 'height';

/** Parse layout values without coercing empty input to zero. */
export function parseContentLayoutValues(input: ContentLayoutInputValues): ContentLayoutValues | null {
    if (
        input.posX.trim() === '' ||
        input.posY.trim() === '' ||
        input.width.trim() === '' ||
        input.height.trim() === ''
    ) {
        return null;
    }

    const posx = Number(input.posX);
    const posy = Number(input.posY);
    const width = Number(input.width);
    const height = Number(input.height);

    if (
        !Number.isFinite(posx) ||
        !Number.isFinite(posy) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
    ) {
        return null;
    }

    return { posx, posy, width, height };
}

export function resolveContentAspectRatio(aspectData: ContentAspectData): number | null {
    const itownsAspect = parsePositiveFiniteNumber(aspectData.itownsAspect);
    if (itownsAspect !== null) {
        return itownsAspect;
    }

    return parsePositiveFiniteNumber(aspectData.contentAspect);
}

export function adjustContentLayoutDimensions(
    dimensions: ContentLayoutDimensions,
    changedDimension: ContentLayoutDimension,
    aspectRatio: number,
): ContentLayoutDimensions | null {
    if (
        !Number.isFinite(aspectRatio) ||
        aspectRatio <= 0 ||
        !Number.isFinite(dimensions.width) ||
        !Number.isFinite(dimensions.height) ||
        dimensions.width <= 0 ||
        dimensions.height <= 0
    ) {
        return null;
    }

    const adjustedDimensions = changedDimension === 'width'
        ? { width: dimensions.width, height: dimensions.width * aspectRatio }
        : { width: dimensions.height / aspectRatio, height: dimensions.height };

    if (
        !Number.isFinite(adjustedDimensions.width) ||
        !Number.isFinite(adjustedDimensions.height) ||
        adjustedDimensions.width <= 0 ||
        adjustedDimensions.height <= 0
    ) {
        return null;
    }

    return adjustedDimensions;
}

function parsePositiveFiniteNumber(value: string | undefined): number | null {
    if (value === undefined || value.trim() === '') {
        return null;
    }

    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return null;
    }

    return parsedValue;
}