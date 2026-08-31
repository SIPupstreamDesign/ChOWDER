export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 3.0;
const HEADER_HEIGHT = 80;

import { calcAnchorZoomViewportDelta } from '../../../common/viewportTransform';

/**
 * Viewport の純粋な状態とズーム・パン計算を担当するクラス。
 * DOM 操作を一切行わないため単体テスト可能。
 */
export class ViewportState {
    centerX: number;
    centerY: number;
    zoom: number;
    width: number;
    height: number;

    constructor(opts?: Partial<{ centerX: number; centerY: number; zoom: number; width: number; height: number }>) {
        this.centerX = opts?.centerX ?? 0;
        this.centerY = opts?.centerY ?? 0;
        this.zoom = opts?.zoom ?? 1.0;
        this.width = opts?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1920);
        this.height = opts?.height ?? (typeof window !== 'undefined' ? window.innerHeight - HEADER_HEIGHT : 1080);
    }

    /** パン移動: スクリーン座標差分を加算する */
    pan(dx: number, dy: number): void {
        this.centerX += dx;
        this.centerY += dy;
    }

    /** ズーム倍率を係数で変更する（MIN_ZOOM 〜 MAX_ZOOM でクランプ） */
    applyZoom(factor: number): void {
        this.zoom = this.clampZoom(this.zoom * factor);
    }

    /**
     * クライアント座標上の一点を固定したままズームする。
     *
     * `viewportLeft` / `viewportTop` には、ズーム前の view-area の
     * `getBoundingClientRect()` の left / top を渡すこと。
     */
    zoomAtClientPoint(
        factor: number,
        clientX: number,
        clientY: number,
        viewportLeft: number,
        viewportTop: number,
        transformOriginX = 0,
        transformOriginY = 0,
    ): void {
        const oldZoom = this.zoom;
        const newZoom = this.clampZoom(oldZoom * factor);
        if (newZoom === oldZoom) {
            return;
        }

        const delta = calcAnchorZoomViewportDelta({
            clientX,
            clientY,
            rectLeft: viewportLeft,
            rectTop: viewportTop,
            oldZoom,
            newZoom,
            originX: transformOriginX,
            originY: transformOriginY,
        });

        this.centerX += delta.x;
        this.centerY += delta.y;
        this.zoom = newZoom;
    }

    /** ウィンドウリサイズ時のサイズ更新 */
    resize(width: number, height: number): void {
        this.width = width;
        this.height = height;
    }

    /** ズーム値をクランプして返す（純粋関数） */
    clampZoom(raw: number): number {
        return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, raw));
    }
}
