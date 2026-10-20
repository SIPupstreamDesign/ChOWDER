interface MirrorControls {
    dispose(): void;
    player?: { stop(): void };
}

interface MirrorRenderer {
    setPixelRatio(value: number): void;
    getContext(): WebGLRenderingContext | WebGL2RenderingContext;
    domElement: HTMLCanvasElement;
}

export interface MirrorView {
    controls?: MirrorControls;
    camera: { camera3D: unknown };
    resizeRenderingArea(width: number, height: number): void;
    notifyChange(camera?: unknown): void;
    mainLoop: { gfxEngine: { renderer: MirrorRenderer; label2dRenderer?: { domElement: HTMLElement } } };
}

export function stopMirrorControls(view: MirrorView, stopCamera: (view: MirrorView, camera: unknown) => void): void {
    view.controls?.player?.stop();
    view.controls?.dispose();
    stopCamera(view, view.camera.camera3D);
}

export function renderingBufferSize(width: number, height: number, limit: number): { width: number; height: number } | null {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !Number.isFinite(limit) || limit < 1) {
        return null;
    }
    const scale = Math.min(1, limit / width, limit / height, Math.sqrt(4194304 / (width * height)));
    return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export function resizeMirrorRendering(view: MirrorView, width: number, height: number): boolean {
    const renderer = view.mainLoop.gfxEngine.renderer;
    const context = renderer.getContext();
    const size = renderingBufferSize(width, height, Math.min(
        Number(context.getParameter(context.MAX_RENDERBUFFER_SIZE)),
        Number(context.getParameter(context.MAX_TEXTURE_SIZE)),
    ));
    if (size === null) {
        return false;
    }
    renderer.setPixelRatio(1);
    view.resizeRenderingArea(size.width, size.height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    const labels = view.mainLoop.gfxEngine.label2dRenderer?.domElement;
    if (labels !== undefined) {
        labels.style.transformOrigin = '0 0';
        labels.style.transform = `scale(${width / size.width}, ${height / size.height})`;
    }
    view.notifyChange(view.camera.camera3D);
    return true;
}