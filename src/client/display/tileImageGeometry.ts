export interface TileImageRect {
    tileIndex: number;
    column: number;
    row: number;
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface TileImageContentBounds {
    posx: number;
    posy: number;
    width: number;
    height: number;
}

export interface TileImageViewport {
    posx: number;
    posy: number;
    virtualWidth: number;
    virtualHeight: number;
}

export function getTileRect(
    orgWidth: number,
    orgHeight: number,
    tileSize: number,
    tileIndex: number,
): TileImageRect | null {
    if (
        !Number.isInteger(orgWidth) || orgWidth <= 0
        || !Number.isInteger(orgHeight) || orgHeight <= 0
        || !Number.isInteger(tileSize) || tileSize <= 0
        || !Number.isInteger(tileIndex) || tileIndex < 0
    ) {
        return null;
    }

    const columns = Math.ceil(orgWidth / tileSize);
    const rows = Math.ceil(orgHeight / tileSize);
    if (tileIndex >= columns * rows) {
        return null;
    }

    const column = tileIndex % columns;
    const row = Math.floor(tileIndex / columns);
    const left = column * tileSize;
    const top = row * tileSize;

    return {
        tileIndex,
        column,
        row,
        left,
        top,
        width: Math.min(tileSize, orgWidth - left),
        height: Math.min(tileSize, orgHeight - top),
    };
}

export function getVisibleTileIndices(
    orgWidth: number,
    orgHeight: number,
    tileSize: number,
    content: TileImageContentBounds,
    viewport: TileImageViewport | null,
): number[] {
    if (viewport === null || getTileRect(orgWidth, orgHeight, tileSize, 0) === null) {
        return [];
    }

    const contentValues = [content.posx, content.posy, content.width, content.height];
    const viewportValues = [viewport.posx, viewport.posy, viewport.virtualWidth, viewport.virtualHeight];
    if (
        contentValues.some((value: number): boolean => { return !Number.isFinite(value); })
        || viewportValues.some((value: number): boolean => { return !Number.isFinite(value); })
        || content.width <= 0 || content.height <= 0
        || viewport.virtualWidth <= 0 || viewport.virtualHeight <= 0
    ) {
        return [];
    }

    const visibleLeft = Math.max(content.posx, viewport.posx);
    const visibleTop = Math.max(content.posy, viewport.posy);
    const visibleRight = Math.min(content.posx + content.width, viewport.posx + viewport.virtualWidth);
    const visibleBottom = Math.min(content.posy + content.height, viewport.posy + viewport.virtualHeight);
    if (visibleLeft >= visibleRight || visibleTop >= visibleBottom) {
        return [];
    }

    const sourceLeft = (visibleLeft - content.posx) * orgWidth / content.width;
    const sourceTop = (visibleTop - content.posy) * orgHeight / content.height;
    const sourceRight = (visibleRight - content.posx) * orgWidth / content.width;
    const sourceBottom = (visibleBottom - content.posy) * orgHeight / content.height;
    const columns = Math.ceil(orgWidth / tileSize);
    const rows = Math.ceil(orgHeight / tileSize);
    const firstColumn = Math.max(0, Math.floor(sourceLeft / tileSize));
    const lastColumn = Math.min(columns - 1, Math.ceil(sourceRight / tileSize) - 1);
    const firstRow = Math.max(0, Math.floor(sourceTop / tileSize));
    const lastRow = Math.min(rows - 1, Math.ceil(sourceBottom / tileSize) - 1);
    const tileIndices: number[] = [];

    for (let row = firstRow; row <= lastRow; row++) {
        for (let column = firstColumn; column <= lastColumn; column++) {
            tileIndices.push(row * columns + column);
        }
    }

    return tileIndices;
}

export function shouldUseReduction(
    contentWidthCssPixels: number,
    contentHeightCssPixels: number,
    reductionWidth: number,
    reductionHeight: number,
    devicePixelRatio: number,
): boolean {
    const values = [contentWidthCssPixels, contentHeightCssPixels, reductionWidth, reductionHeight, devicePixelRatio];
    if (values.some((value: number): boolean => { return !Number.isFinite(value) || value <= 0; })) {
        return false;
    }

    return contentWidthCssPixels * devicePixelRatio <= reductionWidth
        && contentHeightCssPixels * devicePixelRatio <= reductionHeight;
}