import assert from 'node:assert/strict';
import { it } from 'node:test';
import { renderingBufferSize, resizeMirrorRendering, stopMirrorControls, type MirrorView } from './mirrorRendering';

it('limits buffers without changing the full-content CSS geometry', (): void => {
    assert.deepEqual(renderingBufferSize(1600, 900, 4096), { width: 1600, height: 900 });
    assert.deepEqual(renderingBufferSize(16000, 9000, 4096), { width: 2730, height: 1536 });
    assert.equal(renderingBufferSize(0, 900, 4096), null);
    assert.equal(renderingBufferSize(Infinity, 900, 4096), null);
});

it('stops controls, inertia and terrain tracking while retaining the controls reference', (): void => {
    const calls: string[] = [];
    const controls = { dispose: (): void => { calls.push('dispose'); }, player: { stop: (): void => { calls.push('player'); } } };
    const view = { controls, camera: { camera3D: {} } } as MirrorView;
    stopMirrorControls(view, (): void => { calls.push('terrain'); });
    assert.deepEqual(calls, ['player', 'dispose', 'terrain']);
    assert.equal(view.controls, controls);
});

it('updates only rendering resources and keeps the camera object untouched', (): void => {
    const camera = Object.freeze({ fov: 30, aspect: 16 / 9 });
    const calls: number[][] = [];
    const canvas = { style: {} } as HTMLCanvasElement;
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
                }
            }
        },
    };
    assert.equal(resizeMirrorRendering(view, 800, 450), true);
    assert.deepEqual(calls, [[800, 450]]);
    assert.equal(view.camera.camera3D, camera);
    assert.equal(canvas.style.width, '100%');
});