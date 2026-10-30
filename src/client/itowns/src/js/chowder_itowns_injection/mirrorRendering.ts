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

export interface RenderingBufferPlan {
    logical: { width: number; height: number };
    actual: { width: number; height: number };
    logicalScale: number;
    actualScale: number;
}

export interface RenderingAreaRequest {
    physicalWidth: number;
    physicalHeight: number;
    cssWidth: number;
    cssHeight: number;
}

export type RenderingAreaPlan = RenderingBufferPlan;

export interface DisplayViewOffset {
    fullWidth: number;
    fullHeight: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
}

export interface DisplayRenderRect {
    x: number;
    y: number;
    w: number;
    h: number;
    contentW: number;
    contentH: number;
}

export function removeViewResizeListener(
    listener: EventListener | undefined,
    removeEventListener: (type: 'resize', listener: EventListener) => void,
): boolean {
    if (listener === undefined) {
        return false;
    }
    removeEventListener('resize', listener);
    return true;
}

export function stopMirrorControls(view: MirrorView, stopCamera: (view: MirrorView, camera: unknown) => void): void {
    view.controls?.player?.stop();
    view.controls?.dispose();
    stopCamera(view, view.camera.camera3D);
}

export function renderingBufferSize(width: number, height: number, limit: number): { width: number; height: number } | null {
    const scale = renderingBufferScale(width, height, limit);
    if (scale === null) {
        return null;
    }
    return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

function renderingBufferScale(width: number, height: number, limit: number): number | null {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !Number.isFinite(limit) || limit < 1) {
        return null;
    }
    return Math.min(1, limit / width, limit / height, Math.sqrt(4194304 / (width * height)));
}

export function renderingBufferPlan(width: number, height: number, limit: number): RenderingBufferPlan | null {
    const logicalScale = renderingBufferScale(width, height, 4096);
    if (logicalScale === null) {
        return null;
    }
    const logical = renderingBufferSize(width, height, 4096);
    if (logical === null) {
        return null;
    }
    const actualScale = renderingBufferScale(logical.width, logical.height, limit);
    if (actualScale === null) {
        return null;
    }
    const actual = renderingBufferSize(logical.width, logical.height, limit);
    if (actual === null) {
        return null;
    }
    return { logical, actual, logicalScale, actualScale };
}

export function calculateDisplayViewOffset(
    rect: DisplayRenderRect,
    devicePixelRatio: number,
    renderingPlan: RenderingAreaPlan,
): DisplayViewOffset | null {
    const values = [
        rect.x,
        rect.y,
        rect.contentW,
        rect.contentH,
        devicePixelRatio,
        renderingPlan.logicalScale,
    ];
    if (!values.every((value: number): boolean => { return Number.isFinite(value); })
        || devicePixelRatio <= 0 || rect.contentW <= 0 || rect.contentH <= 0) {
        return null;
    }
    return {
        fullWidth: Math.max(1, Math.round(rect.contentW * devicePixelRatio * renderingPlan.logicalScale)),
        fullHeight: Math.max(1, Math.round(rect.contentH * devicePixelRatio * renderingPlan.logicalScale)),
        offsetX: Math.round(rect.x * devicePixelRatio * renderingPlan.logicalScale),
        offsetY: Math.round(rect.y * devicePixelRatio * renderingPlan.logicalScale),
        width: renderingPlan.logical.width,
        height: renderingPlan.logical.height,
    };
}

export function resizeMirrorRendering(view: MirrorView, request: RenderingAreaRequest): RenderingAreaPlan | null {
    const renderer = view.mainLoop.gfxEngine.renderer;
    const context = renderer.getContext();
    const plan = renderingBufferPlan(request.physicalWidth, request.physicalHeight, Math.min(
        Number(context.getParameter(context.MAX_RENDERBUFFER_SIZE)),
        Number(context.getParameter(context.MAX_TEXTURE_SIZE)),
    ));
    if (plan === null) {
        return null;
    }
    renderer.setPixelRatio(1);
    view.resizeRenderingArea(plan.actual.width, plan.actual.height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    const labels = view.mainLoop.gfxEngine.label2dRenderer?.domElement;
    if (labels !== undefined) {
        labels.style.transformOrigin = '0 0';
        labels.style.transform = `scale(${request.cssWidth / plan.actual.width}, ${request.cssHeight / plan.actual.height})`;
    }
    view.notifyChange(view.camera.camera3D);
    return plan;
}