/**
 * コンテンツ座標計算ユーティリティ
 * VirtualDisplay 上の座標とウィンドウの関係を扱う純粋関数群
 */

export interface WindowMetaData {
    id: string;
    posx: number;
    posy: number;
    virtualWidth: number;
    virtualHeight: number;
    pixelWidth: number;
    pixelHeight: number;
    contentVisible: boolean;
}

export interface ContentMetadata {
    metadataId: string;
    binaryId: string;
    type: string;
    posx: number;
    posy: number;
    width: number;
    height: number;
    zindex?: number;
    createdAt?: string;
    visible?: boolean;
    mime?: string;
    url?: string;
    layerList?: string;
}

/**
 * コンテンツがウィンドウの表示範囲内か判定する
 * @returns コンテンツとウィンドウが少なくとも1ピクセル以上重なっていれば true
 */
export function isContentInWindow(
    content: ContentMetadata,
    windowMeta: WindowMetaData | null
): boolean {
    if (!windowMeta) return false;

    const { posx, posy, virtualWidth, virtualHeight } = windowMeta;
    const contentRight = content.posx + content.width;
    const contentBottom = content.posy + content.height;
    const windowRight = posx + virtualWidth;
    const windowBottom = posy + virtualHeight;

    // 完全に外側にある場合はfalse
    return !(
        contentRight <= posx ||
        content.posx >= windowRight ||
        contentBottom <= posy ||
        content.posy >= windowBottom
    );
}

/**
 * VirtualDisplay 座標をウィンドウのスクリーン座標に変換する
 * @returns スクリーン上のピクセル座標 { x, y, w, h }
 */
export function virtualToWindowCoordinates(
    vx: number,
    vy: number,
    vw: number,
    vh: number,
    windowMeta: WindowMetaData | null
): { x: number; y: number; w: number; h: number } {
    if (!windowMeta) {
        return { x: 0, y: 0, w: 0, h: 0 };
    }

    const { posx, posy, virtualWidth, virtualHeight, pixelWidth, pixelHeight } = windowMeta;

    // Window 相対座標に変換
    const relativeX = vx - posx;
    const relativeY = vy - posy;

    // スケール計算
    const scaleX = pixelWidth / virtualWidth;
    const scaleY = pixelHeight / virtualHeight;

    return {
        x: relativeX * scaleX,
        y: relativeY * scaleY,
        w: vw * scaleX,
        h: vh * scaleY,
    };
}

/**
 * itowns iframe への Resize コマンドで使う rect を計算する。
 * 旧実装の DisplayUtil.calcIFrameRect に相当。
 *
 * ピクセル空間で計算し、itowns 側では:
 *   setViewOffset(contentW, contentH, x, y, w, h)
 *   renderer.setSize(w, h)
 * と使用する。
 */
export function calcItownsResizeRect(
    meta: ContentMetadata,
    windowMeta: WindowMetaData
): { x: number; y: number; w: number; h: number; contentW: number; contentH: number } {
    const contentCoords = virtualToWindowCoordinates(
        meta.posx, meta.posy, meta.width, meta.height, windowMeta
    );
    return {
        x: Math.round(-contentCoords.x) || 0,        // コンテンツ内でのウィンドウ左上X（ピクセル）
        y: Math.round(-contentCoords.y) || 0,        // コンテンツ内でのウィンドウ左上Y（ピクセル）
        w: Math.round(windowMeta.pixelWidth),   // ウィンドウ実ピクセル幅
        h: Math.round(windowMeta.pixelHeight),  // ウィンドウ実ピクセル高さ
        contentW: Math.round(contentCoords.w),  // コンテンツ実ピクセル幅 = setViewOffset の fullW
        contentH: Math.round(contentCoords.h),  // コンテンツ実ピクセル高さ = setViewOffset の fullH
    };
}
