import type { WindowMetaData } from './contentCoordinates';

interface CursorPoint {
    x: number;
    y: number;
}

export interface RemoteMouseCursorParams {
    socketId: string;
    userId?: string;
    color: string;
    data: CursorPoint;
}

interface CursorState {
    element: HTMLElement;
    userId: string;
    color: string;
    point: CursorPoint;
}

interface DisplayCursorOverlayDeps {
    overlayElement: HTMLElement;
    getWindowMetaData: () => WindowMetaData | null;
}

export class DisplayCursorOverlay {
    private readonly overlayElement: HTMLElement;
    private readonly getWindowMetaData: () => WindowMetaData | null;
    private readonly cursors: Map<string, CursorState> = new Map<string, CursorState>();

    constructor(deps: DisplayCursorOverlayDeps) {
        this.overlayElement = deps.overlayElement;
        this.getWindowMetaData = deps.getWindowMetaData;
    }

    updateCursor(params: RemoteMouseCursorParams): void {
        if (!this.isValidCursorParams(params)) {
            return;
        }

        let state = this.cursors.get(params.socketId);
        if (!state) {
            state = {
                element: this.createCursorElement(params.socketId, params.userId, params.color),
                userId: this.resolveUserId(params),
                color: params.color,
                point: { x: params.data.x, y: params.data.y },
            };
            this.cursors.set(params.socketId, state);
            this.overlayElement.appendChild(state.element);
        }

        state.point = { x: params.data.x, y: params.data.y };
        state.userId = this.resolveUserId(params);
        state.color = params.color;
        this.renderOne(params.socketId);
    }

    removeCursor(socketId: string): void {
        const state = this.cursors.get(socketId);
        if (!state) {
            return;
        }
        state.element.remove();
        this.cursors.delete(socketId);
    }

    clear(): void {
        for (const socketId of this.cursors.keys()) {
            this.removeCursor(socketId);
        }
    }

    reflowAllCursors(): void {
        for (const socketId of this.cursors.keys()) {
            this.renderOne(socketId);
        }
    }

    private renderOne(socketId: string): void {
        const state = this.cursors.get(socketId);
        if (!state) {
            return;
        }

        const windowMeta = this.getWindowMetaData();
        if (!windowMeta) {
            state.element.style.display = 'none';
            return;
        }

        if (!this.isPointInWindow(state.point, windowMeta)) {
            state.element.style.display = 'none';
            return;
        }

        const scaleX = windowMeta.pixelWidth / windowMeta.virtualWidth;
        const scaleY = windowMeta.pixelHeight / windowMeta.virtualHeight;
        const left = (state.point.x - windowMeta.posx) * scaleX;
        const top = (state.point.y - windowMeta.posy) * scaleY;

        state.element.style.left = `${left}px`;
        state.element.style.top = `${top}px`;
        state.element.style.display = 'block';

        const label = state.element.querySelector('.display-cursor-label') as HTMLElement | null;
        if (label) {
            label.textContent = state.userId;
            label.style.backgroundColor = state.color;
        }
    }

    private createCursorElement(socketId: string, userId: string | undefined, color: string): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'display-cursor-item';
        wrapper.dataset.socketId = socketId;
        wrapper.style.display = 'none';

        const arrow = document.createElement('div');
        arrow.className = 'display-cursor-arrow';
        arrow.textContent = '↖';

        const label = document.createElement('div');
        label.className = 'display-cursor-label';
        label.textContent = userId && userId !== '' ? userId : socketId;
        label.style.backgroundColor = color;

        wrapper.appendChild(arrow);
        wrapper.appendChild(label);

        return wrapper;
    }

    private isPointInWindow(point: CursorPoint, windowMeta: WindowMetaData): boolean {
        const right = windowMeta.posx + windowMeta.virtualWidth;
        const bottom = windowMeta.posy + windowMeta.virtualHeight;

        return (
            point.x >= windowMeta.posx &&
            point.x < right &&
            point.y >= windowMeta.posy &&
            point.y < bottom
        );
    }

    private resolveUserId(params: RemoteMouseCursorParams): string {
        if (typeof params.userId === 'string' && params.userId !== '') {
            return params.userId;
        }
        return params.socketId;
    }

    private isValidCursorParams(params: RemoteMouseCursorParams): boolean {
        if (!params) {
            return false;
        }
        if (typeof params.socketId !== 'string' || params.socketId === '') {
            return false;
        }
        if (!params.data) {
            return false;
        }
        if (typeof params.data.x !== 'number' || typeof params.data.y !== 'number') {
            return false;
        }
        if (typeof params.color !== 'string') {
            return false;
        }
        if (!/^#[0-9a-fA-F]{6}$/.test(params.color)) {
            return false;
        }
        return true;
    }
}
