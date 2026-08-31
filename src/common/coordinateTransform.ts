/**
 * 座標変換ユーティリティ
 * VirtualDisplay座標系 ⇔ Window座標系の変換
 */

import { Rect } from '../server/display/displayTypes';

/**
 * VirtualDisplay座標からWindow座標に変換
 *
 * @param virtualX VirtualDisplay座標系のX
 * @param virtualY VirtualDisplay座標系のY
 * @param virtualWidth VirtualDisplay座標系の幅
 * @param virtualHeight VirtualDisplay座標系の高さ
 * @param windowPosX Windowの左上X座標（VirtualDisplay座標系）
 * @param windowPosY Windowの左上Y座標（VirtualDisplay座標系）
 * @param windowWidth Windowの幅（VirtualDisplay座標系）
 * @param windowHeight Windowの高さ（VirtualDisplay座標系）
 * @param windowOrgWidth Windowの実ピクセル幅
 * @param windowOrgHeight Windowの実ピクセル高さ
 * @returns Window座標系の矩形（ブラウザピクセル座標）
 */
export function virtualToWindowCoordinates(
    virtualX: number,
    virtualY: number,
    virtualWidth: number,
    virtualHeight: number,
    windowPosX: number,
    windowPosY: number,
    windowWidth: number,
    windowHeight: number,
    windowOrgWidth: number,
    windowOrgHeight: number
): Rect {
    // VirtualDisplay座標系でのWindowに対する相対座標
    const relativeX = virtualX - windowPosX;
    const relativeY = virtualY - windowPosY;

    // スケール計算（VirtualDisplay座標 → 実ピクセル）
    const scaleX = windowOrgWidth / windowWidth;
    const scaleY = windowOrgHeight / windowHeight;

    // 実ピクセル座標に変換
    return {
        x: relativeX * scaleX,
        y: relativeY * scaleY,
        w: virtualWidth * scaleX,
        h: virtualHeight * scaleY,
    };
}

/**
 * コンテンツがWindow内に表示されるか判定
 *
 * @param contentPosX コンテンツのX座標（VirtualDisplay座標系）
 * @param contentPosY コンテンツのY座標（VirtualDisplay座標系）
 * @param contentWidth コンテンツの幅
 * @param contentHeight コンテンツの高さ
 * @param windowPosX Windowの左上X座標（VirtualDisplay座標系）
 * @param windowPosY Windowの左上Y座標（VirtualDisplay座標系）
 * @param windowWidth Windowの幅
 * @param windowHeight Windowの高さ
 * @returns コンテンツがWindow内に表示される場合true
 */
export function isContentInWindow(
    contentPosX: number,
    contentPosY: number,
    contentWidth: number,
    contentHeight: number,
    windowPosX: number,
    windowPosY: number,
    windowWidth: number,
    windowHeight: number
): boolean {
    // コンテンツの右端
    const contentRight = contentPosX + contentWidth;
    // コンテンツの下端
    const contentBottom = contentPosY + contentHeight;
    // Windowの右端
    const windowRight = windowPosX + windowWidth;
    // Windowの下端
    const windowBottom = windowPosY + windowHeight;

    // 完全にWindowの外側にある場合はfalse
    if (
        contentRight <= windowPosX ||  // Windowの左側
        contentPosX >= windowRight ||   // Windowの右側
        contentBottom <= windowPosY ||  // Windowの上側
        contentPosY >= windowBottom     // Windowの下側
    ) {
        return false;
    }

    return true;
}

/**
 * 矩形を作成
 */
export function makeRect(x: number, y: number, w: number, h: number): Rect {
    return { x, y, w, h };
}
