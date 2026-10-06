import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const requireModule = createRequire(import.meta.url);
const transform = requireModule('./itownsRenderingAreaLoader.cjs') as (source: string) => string;

const fixture = `class View {
    #fullSizeDepthBuffer;
    constructor() {
        this.domElement = { clientWidth: 800, clientHeight: 450 };
        this.camera = { resizeCalls: 0, resize() { this.resizeCalls += 1; } };
        this.mainLoop = { gfxEngine: { width: 0, height: 0, onWindowResize(width, height) { this.width = width; this.height = height; } } };
    }
    notifyChange() {}
    bufferState() { return { length: this.#fullSizeDepthBuffer.length, needsUpdate: this.#fullSizeDepthBuffer.needsUpdate }; }
    resize(width, height) {
        if (width < 0 || height < 0) { return; }
        if (width == undefined) { width = this.domElement.clientWidth; }
        if (height == undefined) { height = this.domElement.clientHeight; }
        this.#fullSizeDepthBuffer = new Uint8Array(4 * width * height);
        this.mainLoop.gfxEngine.onWindowResize(width, height);
        if (width !== 0 && height !== 0) { this.camera.resize(width, height); this.notifyChange(this.camera3D); }
    }
}`;

interface ProbeView {
    resize(width?: number, height?: number): void;
    resizeRenderingArea(width?: number, height?: number): void;
    bufferState(): { length: number; needsUpdate: boolean };
    camera: { resizeCalls: number };
    mainLoop: { gfxEngine: { width: number; height: number } };
}

function createProbe(): ProbeView {
    const Constructor = new Function(`${transform(fixture)}; return View;`)() as new () => ProbeView;
    return new Constructor();
}

describe('iTowns rendering-area build transformation', (): void => {
    it('resizes rendering and depth buffers without touching the camera', (): void => {
        const view = createProbe();
        view.resizeRenderingArea(600, 300);
        assert.equal(view.camera.resizeCalls, 0);
        assert.equal(view.mainLoop.gfxEngine.width, 600);
        assert.equal(view.mainLoop.gfxEngine.height, 300);
        assert.deepEqual(view.bufferState(), { length: 720000, needsUpdate: true });
    });

    it('keeps normal View.resize camera behavior and default dimensions', (): void => {
        const view = createProbe();
        view.resize();
        assert.equal(view.camera.resizeCalls, 1);
        assert.equal(view.mainLoop.gfxEngine.width, 800);
        assert.equal(view.bufferState().length, 1440000);
    });

    it('rejects an unsupported library source rather than silently skipping the API', (): void => {
        assert.throws((): void => { transform('class View { resize() {} }'); }, /transformation failed/);
    });
});