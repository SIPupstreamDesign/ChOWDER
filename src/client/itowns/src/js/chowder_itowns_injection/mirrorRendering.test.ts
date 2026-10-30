import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
    calculateDisplayViewOffset,
    removeViewResizeListener,
    renderingBufferPlan,
    renderingBufferSize,
    resizeMirrorRendering,
    stopMirrorControls,
    type MirrorView,
} from './mirrorRendering';

it('limits buffers without changing the full-content CSS geometry', (): void => {
    assert.deepEqual(renderingBufferSize(1600, 900, 4096), { width: 1600, height: 900 });
    assert.deepEqual(renderingBufferSize(16000, 9000, 4096), { width: 2730, height: 1536 });
    assert.equal(renderingBufferSize(0, 900, 4096), null);
    assert.equal(renderingBufferSize(Infinity, 900, 4096), null);
});

it('keeps the logical LOD budget common while applying a lower GPU buffer limit', (): void => {
    assert.deepEqual(renderingBufferPlan(3840, 2160, 4096), {
        logical: { width: 2730, height: 1536 },
        actual: { width: 2730, height: 1536 },
        logicalScale: Math.sqrt(4194304 / (3840 * 2160)),
        actualScale: 1,
    });
    assert.deepEqual(renderingBufferPlan(3840, 2160, 2048), {
        logical: { width: 2730, height: 1536 },
        actual: { width: 2048, height: 1152 },
        logicalScale: Math.sqrt(4194304 / (3840 * 2160)),
        actualScale: 2048 / 2730,
    });
    assert.equal(renderingBufferPlan(0, 2160, 4096), null);
});

it('maps mixed-resolution display rectangles to the same virtual boundary', (): void => {
    const leftRect = { x: -1, y: -1, w: 3841, h: 2161, contentW: 7680, contentH: 4320 };
    const rightRect = { x: 2559, y: -1, w: 2561, h: 1441, contentW: 5120, contentH: 2880 };
    const leftBuffer = renderingBufferPlan(leftRect.w, leftRect.h, 4096);
    const rightBuffer = renderingBufferPlan(rightRect.w, rightRect.h, 4096);
    assert.ok(leftBuffer !== null);
    assert.ok(rightBuffer !== null);

    const leftOffset = calculateDisplayViewOffset(leftRect, 1, leftBuffer);
    const rightOffset = calculateDisplayViewOffset(rightRect, 1, rightBuffer);
    assert.ok(leftOffset !== null);
    assert.ok(rightOffset !== null);

    const leftVirtualBoundary = (leftOffset.offsetX + leftBuffer.logicalScale) / leftOffset.fullWidth;
    const rightVirtualBoundary = (rightOffset.offsetX + rightBuffer.logicalScale) / rightOffset.fullWidth;
    assert.ok(Math.abs(leftVirtualBoundary) < 0.001);
    assert.ok(Math.abs(rightVirtualBoundary - 0.5) < 0.001);
});

it('stops controls, inertia and terrain tracking while retaining the controls reference', (): void => {
    const calls: string[] = [];
    const controls = { dispose: (): void => { calls.push('dispose'); }, player: { stop: (): void => { calls.push('player'); } } };
    const view = { controls, camera: { camera3D: {} } } as MirrorView;
    stopMirrorControls(view, (): void => { calls.push('terrain'); });
    assert.deepEqual(calls, ['player', 'dispose', 'terrain']);
    assert.equal(view.controls, controls);
});

it('removes the registered native View resize listener for mirror modes', (): void => {
    const calls: Array<{ type: string; listener: EventListener }> = [];
    const listener: EventListener = (): void => { };

    const removed = removeViewResizeListener(listener, (type, registeredListener): void => {
        calls.push({ type, listener: registeredListener });
    });

    assert.equal(removed, true);
    assert.deepEqual(calls, [{ type: 'resize', listener }]);
});

it('does not unregister a View resize listener that is unavailable', (): void => {
    let removeCalled = false;
    const removed = removeViewResizeListener(undefined, (): void => { removeCalled = true; });

    assert.equal(removed, false);
    assert.equal(removeCalled, false);
});

it('updates only rendering resources and keeps the camera object untouched', (): void => {
    const camera = Object.freeze({ fov: 30, aspect: 16 / 9 });
    const calls: number[][] = [];
    const canvas = { style: {} } as HTMLCanvasElement;
    const labelElement = { style: {} } as HTMLElement;
    const view: MirrorView = {
        camera: { camera3D: camera },
        resizeRenderingArea: (width: number, height: number): void => { calls.push([width, height]); },
        notifyChange: (): void => { },
        mainLoop: {
            gfxEngine: {
                renderer: {
                    setPixelRatio: (): void => { },
                    getContext: (): WebGLRenderingContext => { return { MAX_RENDERBUFFER_SIZE: 1, MAX_TEXTURE_SIZE: 2, getParameter: (): number => { return 4096; } } as unknown as WebGLRenderingContext; },
                    domElement: canvas,
                },
                label2dRenderer: { domElement: labelElement },
            }
        },
    };
    const plan = resizeMirrorRendering(view, {
        physicalWidth: 3840,
        physicalHeight: 2160,
        cssWidth: 2560,
        cssHeight: 1440,
    });
    assert.deepEqual(plan, {
        logical: { width: 2730, height: 1536 },
        actual: { width: 2730, height: 1536 },
        logicalScale: Math.sqrt(4194304 / (3840 * 2160)),
        actualScale: 1,
    });
    assert.deepEqual(calls, [[2730, 1536]]);
    assert.equal(view.camera.camera3D, camera);
    assert.equal(canvas.style.width, '100%');
    assert.equal(labelElement.style.transform, 'scale(0.9377289377289377, 0.9375)');
});