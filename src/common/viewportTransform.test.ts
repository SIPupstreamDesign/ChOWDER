import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    screenToVirtualPoint,
    virtualToScreenPoint,
    calcAnchorZoomViewportDelta,
} from './viewportTransform';

describe('viewportTransform', () => {
    it('screenToVirtualPoint と virtualToScreenPoint は往復で一致する', (): void => {
        const transform = {
            rectLeft: 160,
            rectTop: 90,
            zoom: 1.75,
            originX: 400,
            originY: 260,
        };

        const screen = { x: 500, y: 300 };
        const virtual = screenToVirtualPoint(screen.x, screen.y, transform);
        const screenRoundTrip = virtualToScreenPoint(virtual.x, virtual.y, transform);

        assert.ok(Math.abs(screenRoundTrip.x - screen.x) < 1e-9);
        assert.ok(Math.abs(screenRoundTrip.y - screen.y) < 1e-9);
    });

    it('calcAnchorZoomViewportDelta は transform-origin が中央でもアンカーを維持する', (): void => {
        const rectLeft = 220;
        const rectTop = 140;
        const oldZoom = 1.2;
        const newZoom = 1.8;
        const originX = 500;
        const originY = 300;
        const clientX = 460;
        const clientY = 280;

        const anchorBeforeX = (clientX - rectLeft) / oldZoom;
        const anchorBeforeY = (clientY - rectTop) / oldZoom;

        const delta = calcAnchorZoomViewportDelta({
            clientX,
            clientY,
            rectLeft,
            rectTop,
            oldZoom,
            newZoom,
            originX,
            originY,
        });

        const rectLeftAfter = rectLeft + delta.x + originX * (oldZoom - newZoom);
        const rectTopAfter = rectTop + delta.y + originY * (oldZoom - newZoom);
        const anchorAfterX = (clientX - rectLeftAfter) / newZoom;
        const anchorAfterY = (clientY - rectTopAfter) / newZoom;

        assert.ok(Math.abs(anchorAfterX - anchorBeforeX) < 1e-9);
        assert.ok(Math.abs(anchorAfterY - anchorBeforeY) < 1e-9);
    });
});
