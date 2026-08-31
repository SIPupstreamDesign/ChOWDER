export interface ContentOrderable {
    metadataId: string;
    createdAt?: string;
    zindex?: number | null;
}

export function normalizeContentZIndex(value: number | null | undefined): number {
    if (typeof value !== 'number') {
        return 0;
    }
    if (!Number.isFinite(value)) {
        return 0;
    }
    return value;
}

export function compareContentMetadataForDisplayOrder(
    left: ContentOrderable,
    right: ContentOrderable,
): number {
    const leftZIndex = normalizeContentZIndex(left.zindex);
    const rightZIndex = normalizeContentZIndex(right.zindex);
    if (leftZIndex !== rightZIndex) {
        return leftZIndex - rightZIndex;
    }

    const leftCreatedAt = typeof left.createdAt === 'string' ? left.createdAt : '';
    const rightCreatedAt = typeof right.createdAt === 'string' ? right.createdAt : '';
    const createdAtCompare = leftCreatedAt.localeCompare(rightCreatedAt);
    if (createdAtCompare !== 0) {
        return createdAtCompare;
    }

    return left.metadataId.localeCompare(right.metadataId);
}

/**
 * Compare順（zindex -> createdAt -> metadataId）を保ったまま、
 * DOM再挿入なしで適用できる一意な表示用 z-index を構築する。
 */
export function buildDisplayZIndexMapByOrder<T extends ContentOrderable>(
    metadataList: T[],
): Map<string, number> {
    const orderedMetadataList = [...metadataList].sort(compareContentMetadataForDisplayOrder);
    const zIndexMap = new Map<string, number>();
    let nextAvailableZIndex = Number.NEGATIVE_INFINITY;

    for (const metadata of orderedMetadataList) {
        const baseZIndex = normalizeContentZIndex(metadata.zindex);
        const projectedZIndex = Math.max(baseZIndex, nextAvailableZIndex);
        zIndexMap.set(metadata.metadataId, projectedZIndex);
        nextAvailableZIndex = projectedZIndex + 1;
    }

    return zIndexMap;
}
