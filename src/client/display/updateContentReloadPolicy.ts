import type { ContentMetadata } from './contentCoordinates';

/**
 * UpdateContent / AddContent / NewContentAdded の再読み込み要否を判定する。
 * text と url は本文更新を確実に反映するため、UpdateContent では常に true を返す。
 */
export function shouldReloadRegularContentByPolicy(
    method: string,
    previous: ContentMetadata | undefined,
    incoming: ContentMetadata,
): boolean {
    if (method === 'AddContent' || method === 'NewContentAdded') {
        return true;
    }
    if (previous === undefined) {
        return true;
    }
    if (previous.type !== incoming.type) {
        return true;
    }
    if (method === 'UpdateContent' && (incoming.type === 'text' || incoming.type === 'url')) {
        return true;
    }
    if ((incoming as any).tileFinished === true && !(previous as any).tileFinished) {
        return true;
    }
    if (incoming.binaryId === undefined || incoming.binaryId === null || incoming.binaryId === '') {
        return false;
    }
    return previous.binaryId !== incoming.binaryId;
}
