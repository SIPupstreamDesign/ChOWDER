/**
 * ViewportState 単体テスト
 *
 * DOM 依存のない純粋なズーム・パン計算を検証する。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ViewportState, MIN_ZOOM, MAX_ZOOM } from './ViewportState';

describe('ViewportState', () => {
    it('デフォルトのズームは 1.0 である', () => {
        const vp = new ViewportState();
        assert.strictEqual(vp.zoom, 1.0);
    });

    it('デフォルトの中心座標は (0, 0) である', () => {
        const vp = new ViewportState();
        assert.strictEqual(vp.centerX, 0);
        assert.strictEqual(vp.centerY, 0);
    });

    it('初期値を指定して構築できる', () => {
        const vp = new ViewportState({ centerX: 100, centerY: 200, zoom: 2.0, width: 1920, height: 1080 });
        assert.strictEqual(vp.centerX, 100);
        assert.strictEqual(vp.centerY, 200);
        assert.strictEqual(vp.zoom, 2.0);
        assert.strictEqual(vp.width, 1920);
        assert.strictEqual(vp.height, 1080);
    });

    it('pan() で中心座標が移動する', () => {
        const vp = new ViewportState({ centerX: 10, centerY: 20 });
        vp.pan(5, -3);
        assert.strictEqual(vp.centerX, 15);
        assert.strictEqual(vp.centerY, 17);
    });

    it('applyZoom() でズームが変化する', () => {
        const vp = new ViewportState({ zoom: 1.0 });
        vp.applyZoom(2.0);
        assert.strictEqual(vp.zoom, 2.0);
    });

    it('applyZoom() は MAX_ZOOM を超えない', () => {
        const vp = new ViewportState({ zoom: 4.0 });
        vp.applyZoom(10.0);
        assert.strictEqual(vp.zoom, MAX_ZOOM);
    });

    it('applyZoom() は MIN_ZOOM を下回らない', () => {
        const vp = new ViewportState({ zoom: 0.2 });
        vp.applyZoom(0.001);
        assert.strictEqual(vp.zoom, MIN_ZOOM);
    });

    it('clampZoom() は MIN_ZOOM 〜 MAX_ZOOM に収める', () => {
        const vp = new ViewportState();
        assert.strictEqual(vp.clampZoom(0), MIN_ZOOM);
        assert.strictEqual(vp.clampZoom(100), MAX_ZOOM);
        assert.strictEqual(vp.clampZoom(1.5), 1.5);
    });

    it('resize() でサイズが更新される', () => {
        const vp = new ViewportState({ width: 800, height: 600 });
        vp.resize(1920, 1080);
        assert.strictEqual(vp.width, 1920);
        assert.strictEqual(vp.height, 1080);
    });

    it('zoomAtClientPoint() は transform-origin が 0,0 のときカーソル下の仮想座標を維持する', (): void => {
        const vp = new ViewportState({ centerX: 50, centerY: 30, zoom: 1.0 });
        const oldCenterX = vp.centerX;
        const oldCenterY = vp.centerY;
        const baseLeft = 100;
        const baseTop = 80;
        const viewportLeft = baseLeft + oldCenterX;
        const viewportTop = baseTop + oldCenterY;
        const clientX = 450;
        const clientY = 260;

        const anchorBeforeX = (clientX - viewportLeft) / vp.zoom;
        const anchorBeforeY = (clientY - viewportTop) / vp.zoom;

        vp.zoomAtClientPoint(2.0, clientX, clientY, viewportLeft, viewportTop, 0, 0);

        const newViewportLeft = baseLeft + vp.centerX;
        const newViewportTop = baseTop + vp.centerY;
        const anchorAfterX = (clientX - newViewportLeft) / vp.zoom;
        const anchorAfterY = (clientY - newViewportTop) / vp.zoom;

        assert.strictEqual(vp.zoom, 2.0);
        assert.ok(Math.abs(anchorAfterX - anchorBeforeX) < 1e-9);
        assert.ok(Math.abs(anchorAfterY - anchorBeforeY) < 1e-9);
    });

    it('zoomAtClientPoint() はクランプ後のズームでもアンカーを維持する', (): void => {
        const vp = new ViewportState({ centerX: 20, centerY: -10, zoom: 2.9 });
        const oldCenterX = vp.centerX;
        const oldCenterY = vp.centerY;
        const baseLeft = 140;
        const baseTop = 64;
        const viewportLeft = baseLeft + oldCenterX;
        const viewportTop = baseTop + oldCenterY;
        const clientX = 420;
        const clientY = 300;

        const anchorBeforeX = (clientX - viewportLeft) / vp.zoom;
        const anchorBeforeY = (clientY - viewportTop) / vp.zoom;

        vp.zoomAtClientPoint(2.0, clientX, clientY, viewportLeft, viewportTop, 0, 0);

        const newViewportLeft = baseLeft + vp.centerX;
        const newViewportTop = baseTop + vp.centerY;
        const anchorAfterX = (clientX - newViewportLeft) / vp.zoom;
        const anchorAfterY = (clientY - newViewportTop) / vp.zoom;

        assert.strictEqual(vp.zoom, MAX_ZOOM);
        assert.ok(Math.abs(anchorAfterX - anchorBeforeX) < 1e-9);
        assert.ok(Math.abs(anchorAfterY - anchorBeforeY) < 1e-9);
    });

    it('zoomAtClientPoint() は transform-origin が中央でもカーソル下の仮想座標を維持する', (): void => {
        const vp = new ViewportState({ centerX: 10, centerY: 15, zoom: 1.2 });
        const oldCenterX = vp.centerX;
        const oldCenterY = vp.centerY;
        const baseLeft = 80;
        const baseTop = 100;
        const originX = 500;
        const originY = 300;
        const viewportLeft = baseLeft + oldCenterX + originX * (1 - vp.zoom);
        const viewportTop = baseTop + oldCenterY + originY * (1 - vp.zoom);
        const clientX = 350;
        const clientY = 260;

        const anchorBeforeX = (clientX - viewportLeft) / vp.zoom;
        const anchorBeforeY = (clientY - viewportTop) / vp.zoom;

        vp.zoomAtClientPoint(1.35, clientX, clientY, viewportLeft, viewportTop, originX, originY);

        const newViewportLeft = baseLeft + vp.centerX + originX * (1 - vp.zoom);
        const newViewportTop = baseTop + vp.centerY + originY * (1 - vp.zoom);
        const anchorAfterX = (clientX - newViewportLeft) / vp.zoom;
        const anchorAfterY = (clientY - newViewportTop) / vp.zoom;

        assert.ok(Math.abs(anchorAfterX - anchorBeforeX) < 1e-9);
        assert.ok(Math.abs(anchorAfterY - anchorBeforeY) < 1e-9);
    });

    it('zoomAtClientPoint() はクランプでズーム不変なら中心座標を変更しない', (): void => {
        const vp = new ViewportState({ centerX: 77, centerY: -33, zoom: MAX_ZOOM });
        const beforeCenterX = vp.centerX;
        const beforeCenterY = vp.centerY;

        vp.zoomAtClientPoint(1.1, 320, 240, 200, 120, 500, 300);

        assert.strictEqual(vp.zoom, MAX_ZOOM);
        assert.strictEqual(vp.centerX, beforeCenterX);
        assert.strictEqual(vp.centerY, beforeCenterY);
    });

    it('複数回の pan() が累積される', () => {
        const vp = new ViewportState({ centerX: 0, centerY: 0 });
        vp.pan(10, 5);
        vp.pan(-3, 2);
        assert.strictEqual(vp.centerX, 7);
        assert.strictEqual(vp.centerY, 7);
    });
});
