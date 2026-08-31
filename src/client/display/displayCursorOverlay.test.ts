import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DisplayCursorOverlay, type RemoteMouseCursorParams } from './displayCursorOverlay';
import type { WindowMetaData } from './contentCoordinates';

class FakeElement {
    public style: Record<string, string> = {};
    public dataset: Record<string, string> = {};
    public className = '';
    public textContent = '';
    public children: FakeElement[] = [];
    public parent: FakeElement | null = null;

    appendChild(child: FakeElement): FakeElement {
        child.parent = this;
        this.children.push(child);
        return child;
    }

    remove(): void {
        if (!this.parent) {
            return;
        }
        this.parent.children = this.parent.children.filter((child) => {
            return child !== this;
        });
        this.parent = null;
    }

    querySelector(selector: string): FakeElement | null {
        if (selector.startsWith('.')) {
            const className = selector.slice(1);
            for (const child of this.children) {
                if (child.className.split(' ').includes(className)) {
                    return child;
                }
            }
        }
        return null;
    }
}

function createOverlayAndClient(
    windowMeta: WindowMetaData | null
): { overlay: FakeElement; client: DisplayCursorOverlay } {
    const overlay = new FakeElement();
    (globalThis as any).document = {
        createElement: (_tag: string): FakeElement => {
            return new FakeElement();
        },
    };

    const client = new DisplayCursorOverlay({
        overlayElement: overlay as unknown as HTMLElement,
        getWindowMetaData: (): WindowMetaData | null => {
            return windowMeta;
        },
    });

    return { overlay, client };
}

function makeParams(x: number, y: number): RemoteMouseCursorParams {
    return {
        socketId: 'abc123',
        userId: 'alice',
        color: '#3366cc',
        data: { x, y },
    };
}

describe('DisplayCursorOverlay', () => {
    beforeEach((): void => {
        delete (globalThis as any).document;
    });

    it('表示領域内のカーソルを作成して表示する', (): void => {
        const windowMeta: WindowMetaData = {
            id: 'window_1',
            posx: 100,
            posy: 50,
            virtualWidth: 1000,
            virtualHeight: 500,
            pixelWidth: 2000,
            pixelHeight: 1000,
            contentVisible: true,
        };
        const { overlay, client } = createOverlayAndClient(windowMeta);

        client.updateCursor(makeParams(600, 300));

        assert.strictEqual(overlay.children.length, 1);
        const cursor = overlay.children[0];
        assert.strictEqual(cursor.style.display, 'block');
        assert.strictEqual(cursor.style.left, '1000px');
        assert.strictEqual(cursor.style.top, '500px');
    });

    it('表示領域外のカーソルは非表示になる', (): void => {
        const windowMeta: WindowMetaData = {
            id: 'window_1',
            posx: 0,
            posy: 0,
            virtualWidth: 500,
            virtualHeight: 500,
            pixelWidth: 500,
            pixelHeight: 500,
            contentVisible: true,
        };
        const { overlay, client } = createOverlayAndClient(windowMeta);

        client.updateCursor(makeParams(100, 100));
        client.updateCursor(makeParams(900, 100));

        assert.strictEqual(overlay.children.length, 1);
        const cursor = overlay.children[0];
        assert.strictEqual(cursor.style.display, 'none');
    });

    it('ControllerDisconnected相当の removeCursor で要素が削除される', (): void => {
        const windowMeta: WindowMetaData = {
            id: 'window_1',
            posx: 0,
            posy: 0,
            virtualWidth: 500,
            virtualHeight: 500,
            pixelWidth: 500,
            pixelHeight: 500,
            contentVisible: true,
        };
        const { overlay, client } = createOverlayAndClient(windowMeta);

        client.updateCursor(makeParams(100, 100));
        assert.strictEqual(overlay.children.length, 1);

        client.removeCursor('abc123');
        assert.strictEqual(overlay.children.length, 0);
    });

    it('colorが無いカーソルは描画しない', (): void => {
        const windowMeta: WindowMetaData = {
            id: 'window_1',
            posx: 0,
            posy: 0,
            virtualWidth: 500,
            virtualHeight: 500,
            pixelWidth: 500,
            pixelHeight: 500,
            contentVisible: true,
        };
        const { overlay, client } = createOverlayAndClient(windowMeta);

        const invalidParams = {
            socketId: 'abc123',
            userId: 'alice',
            data: { x: 100, y: 120 },
        } as unknown as RemoteMouseCursorParams;

        client.updateCursor(invalidParams);

        assert.strictEqual(overlay.children.length, 0);
    });
});
