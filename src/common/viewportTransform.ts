export interface ViewportTransformState {
    rectLeft: number;
    rectTop: number;
    zoom: number;
    originX: number;
    originY: number;
}

export interface Point2D {
    x: number;
    y: number;
}

export interface AnchorZoomDeltaInput {
    clientX: number;
    clientY: number;
    rectLeft: number;
    rectTop: number;
    oldZoom: number;
    newZoom: number;
    originX: number;
    originY: number;
}

/**
 * スクリーン座標を view-area ローカル（仮想）座標へ変換する。
 * transform-origin が top-left 以外でも成立するよう、
 * getBoundingClientRect() で得た左上位置を基準に計算する。
 */
export function screenToVirtualPoint(
    clientX: number,
    clientY: number,
    transform: ViewportTransformState,
): Point2D {
    return {
        x: (clientX - transform.rectLeft) / transform.zoom,
        y: (clientY - transform.rectTop) / transform.zoom,
    };
}

/**
 * view-area ローカル（仮想）座標をスクリーン座標へ変換する。
 */
export function virtualToScreenPoint(
    virtualX: number,
    virtualY: number,
    transform: ViewportTransformState,
): Point2D {
    return {
        x: transform.rectLeft + virtualX * transform.zoom,
        y: transform.rectTop + virtualY * transform.zoom,
    };
}

/**
 * transform-origin を考慮した、アンカー維持ズーム時の left/top 変位を求める。
 * 返却値を centerX/centerY に加算すると、client 座標下の仮想点を維持できる。
 */
export function calcAnchorZoomViewportDelta(input: AnchorZoomDeltaInput): Point2D {
    const virtualAnchor = screenToVirtualPoint(input.clientX, input.clientY, {
        rectLeft: input.rectLeft,
        rectTop: input.rectTop,
        zoom: input.oldZoom,
        originX: input.originX,
        originY: input.originY,
    });

    const zoomDiff = input.oldZoom - input.newZoom;
    return {
        x: zoomDiff * (virtualAnchor.x - input.originX),
        y: zoomDiff * (virtualAnchor.y - input.originY),
    };
}
