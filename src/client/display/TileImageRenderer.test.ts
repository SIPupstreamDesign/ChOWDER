import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TileImageRenderer, type TileImageMetadata } from './TileImageRenderer';
import type { WindowMetaData } from './contentCoordinates';

class FakeElement {
    className = '';
    src = '';
    style = {
        cssText: '',
        display: '',
        position: '',
        width: '',
        height: '',
    };
    children: FakeElement[] = [];
    parentElement: FakeElement | null = null;

    appendChild(child: FakeElement): FakeElement {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    replaceChildren(...children: FakeElement[]): void {
        for (const child of this.children) {
            child.parentElement = null;
        }
        this.children = [];
        for (const child of children) {
            this.appendChild(child);
        }
    }

    remove(): void {
        if (this.parentElement !== null) {
            const index = this.parentElement.children.indexOf(this);
            if (index >= 0) {
                this.parentElement.children.splice(index, 1);
            }
            this.parentElement = null;
        }
    }
}

class FakeImage {
    src = '';

    async decode(): Promise<void> { }
}

function installFakeBrowser(): () => void {
    const names = ['document', 'window', 'Image'];
    const descriptors = new Map<string, PropertyDescriptor | undefined>();
    for (const name of names) {
        descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    }

    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            createElement: (): FakeElement => { return new FakeElement(); },
        },
    });
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { devicePixelRatio: 1 },
    });
    Object.defineProperty(globalThis, 'Image', {
        configurable: true,
        value: FakeImage,
    });

    return (): void => {
        for (const [name, descriptor] of descriptors.entries()) {
            if (descriptor === undefined) {
                delete (globalThis as Record<string, unknown>)[name];
            } else {
                Object.defineProperty(globalThis, name, descriptor);
            }
        }
    };
}

function createMetadata(): TileImageMetadata {
    return {
        metadataId: 'tile-image-1',
        binaryId: 'binary-1',
        type: 'tileimage',
        xsplit: 4,
        ysplit: 3,
        tileSize: 256,
        orgWidth: 1000,
        orgHeight: 700,
        reductionWidth: 100,
        reductionHeight: 70,
        tileFinished: true,
        posx: 0,
        posy: 0,
        width: 1000,
        height: 700,
    };
}

function createWindowMetaData(
    posx: number,
    posy: number,
    virtualWidth: number = 256,
    virtualHeight: number = 256,
): WindowMetaData {
    return {
        id: 'display-1',
        posx,
        posy,
        virtualWidth,
        virtualHeight,
        pixelWidth: virtualWidth,
        pixelHeight: virtualHeight,
        contentVisible: true,
    };
}

describe('TileImageRenderer', () => {
    it('元画像座標に配置し、移動後に可視化したタイルだけ追加取得する', { timeout: 5000 }, async (): Promise<void> => {
        const restoreBrowser = installFakeBrowser();
        const calls: Array<{ method: string; params: any }> = [];
        let windowMeta = createWindowMetaData(256, 0);
        const renderer = new TileImageRenderer(
            async (method: string, params: any): Promise<any> => {
                calls.push({ method, params });
                return { binary: new Uint8Array([1, 2, 3]).buffer };
            },
            (): WindowMetaData => { return windowMeta; },
        );
        const contentElement = new FakeElement();

        try {
            await renderer.update(contentElement as unknown as HTMLElement, createMetadata());

            const tileLayer = contentElement.children[0].children[1];
            assert.strictEqual(tileLayer.children.length, 1);
            assert.match(tileLayer.children[0].style.cssText, /left:25\.6%/);
            assert.deepStrictEqual(
                calls.filter((call): boolean => { return call.method === 'GetTileContent'; })
                    .map((call): number => { return call.params.tileIndex; }),
                [1],
            );

            windowMeta = createWindowMetaData(512, 0);
            await renderer.update(contentElement as unknown as HTMLElement, createMetadata());
            windowMeta = createWindowMetaData(256, 0);
            await renderer.update(contentElement as unknown as HTMLElement, createMetadata());

            const requestedTiles = calls
                .filter((call): boolean => { return call.method === 'GetTileContent'; })
                .map((call): number => { return call.params.tileIndex; });
            assert.deepStrictEqual(requestedTiles, [1, 2]);
            assert.strictEqual(contentElement.children[0].children[1].children.length, 1);
        } finally {
            renderer.destroyAll();
            restoreBrowser();
        }
    });

    it('縮小表示から拡大したmetadata更新でタイル取得へ切り替える', { timeout: 5000 }, async (): Promise<void> => {
        const restoreBrowser = installFakeBrowser();
        const calls: string[] = [];
        const renderer = new TileImageRenderer(
            async (method: string): Promise<any> => {
                calls.push(method);
                return { binary: new Uint8Array([1, 2, 3]).buffer };
            },
            (): WindowMetaData => { return createWindowMetaData(0, 0, 1000, 700); },
        );
        const contentElement = new FakeElement();

        try {
            const metadata = createMetadata();
            metadata.reductionWidth = 1200;
            metadata.reductionHeight = 800;
            await renderer.update(contentElement as unknown as HTMLElement, metadata);
            assert.strictEqual(calls.includes('GetTileContent'), false);

            metadata.width = 2000;
            metadata.height = 1400;
            await renderer.update(contentElement as unknown as HTMLElement, metadata);

            assert.strictEqual(calls.includes('GetTileContent'), true);
            assert.strictEqual(contentElement.children[0].children[1].style.display, 'block');
        } finally {
            renderer.destroyAll();
            restoreBrowser();
        }
    });

    it('画像要求の同時実行を8件以下に保つ', { timeout: 5000 }, async (): Promise<void> => {
        const restoreBrowser = installFakeBrowser();
        let activeRequests = 0;
        let maxActiveRequests = 0;
        const renderer = new TileImageRenderer(
            async (_method: string): Promise<any> => {
                activeRequests += 1;
                maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
                await new Promise<void>((resolve): void => {
                    setTimeout(resolve, 5);
                });
                activeRequests -= 1;
                return { binary: new Uint8Array([1, 2, 3]).buffer };
            },
            (): WindowMetaData => {
                return {
                    ...createWindowMetaData(0, 0),
                    virtualWidth: 5000,
                    virtualHeight: 256,
                    pixelWidth: 5000,
                    pixelHeight: 256,
                };
            },
        );
        const contentElement = new FakeElement();

        try {
            const metadata = createMetadata();
            metadata.orgWidth = 5000;
            metadata.orgHeight = 256;
            metadata.xsplit = 20;
            metadata.ysplit = 1;
            metadata.width = 5000;
            metadata.height = 256;
            metadata.reductionWidth = 1;
            metadata.reductionHeight = 1;
            await renderer.update(contentElement as unknown as HTMLElement, metadata);

            assert.strictEqual(maxActiveRequests <= 8, true);
            assert.strictEqual(contentElement.children[0].children[1].children.length, 20);
        } finally {
            renderer.destroyAll();
            restoreBrowser();
        }
    });
});