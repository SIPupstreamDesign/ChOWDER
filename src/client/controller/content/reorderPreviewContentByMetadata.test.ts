import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ContentManager } from './ContentManager';

interface FakeElement {
    id: string;
    style: { zIndex: string };
    parentElement: FakePreviewContent | null;
}

interface FakePreviewContent {
    children: FakeElement[];
    appendCallCount: number;
    appendChild: (child: FakeElement) => FakeElement;
}

function createPreviewContent(children: FakeElement[]): FakePreviewContent {
    const previewContent: FakePreviewContent = {
        children: [],
        appendCallCount: 0,
        appendChild(child: FakeElement): FakeElement {
            this.appendCallCount += 1;
            const currentIndex = this.children.indexOf(child);
            if (currentIndex >= 0) {
                this.children.splice(currentIndex, 1);
            }
            this.children.push(child);
            child.parentElement = this;
            return child;
        },
    };

    for (const child of children) {
        child.parentElement = previewContent;
        previewContent.children.push(child);
    }

    return previewContent;
}

function createElement(id: string): FakeElement {
    return {
        id,
        style: { zIndex: '0' },
        parentElement: null,
    };
}

function createDeps(previewContent: FakePreviewContent): any {
    return {
        elements: {
            previewContent,
            viewArea: { innerHTML: '' },
            tileUploadOverlay: { addEventListener() {} },
        },
        sendCmd: async (): Promise<any> => {
            return {};
        },
        sendBinaryCmd: async (): Promise<any> => {
            return {};
        },
        logFn: (): void => {},
        manipulator: null,
        getZoom: (): number => {
            return 1;
        },
        pushUpdateStock: (): void => {},
        getSocketId: (): string => {
            return 'socket';
        },
        getCurrentUser: (): string => {
            return 'user';
        },
        getLiveStreamManager: (): null => {
            return null;
        },
        tileUploader: {} as any,
        registerBroadcast: (): void => {},
        consumePendingProducer: (): null => {
            return null;
        },
        handleNewProducer: async (): Promise<void> => {},
        getEditMode: (): number => {
            return 1;
        },
        showRightClickMenu: (): void => {},
        stopVideoFileByMetadata: async (): Promise<boolean> => {
            return false;
        },
        stopLiveStreamByProducerId: async (): Promise<boolean> => {
            return false;
        },
        addVideoFile: async (): Promise<void> => {},
    };
}

let savedDocument: unknown;

function setupDocument(getById: (id: string) => FakeElement | null): void {
    savedDocument = (globalThis as any).document;
    (globalThis as any).document = {
        getElementById(id: string): FakeElement | null {
            return getById(id);
        },
    };
}

function teardownDocument(): void {
    (globalThis as any).document = savedDocument;
}

describe('ContentManager.reorderPreviewContentByMetadata', () => {
    beforeEach((): void => {
        savedDocument = (globalThis as any).document;
    });

    afterEach((): void => {
        teardownDocument();
    });

    it('順序が変わらない場合は appendChild しない', (): void => {
        const first = createElement('view-a');
        const second = createElement('view-b');
        const previewContent = createPreviewContent([first, second]);

        setupDocument((id: string): FakeElement | null => {
            if (id === 'view-a') {
                return first;
            }
            if (id === 'view-b') {
                return second;
            }
            return null;
        });

        const manager = new ContentManager(createDeps(previewContent));
        (manager as any)._metadataList = [
            { metadataId: 'a', zindex: 0 },
            { metadataId: 'b', zindex: 1 },
        ];

        manager.reorderPreviewContentByMetadata();

        assert.strictEqual(previewContent.appendCallCount, 0);
        assert.deepStrictEqual(previewContent.children.map((child) => child.id), ['view-a', 'view-b']);
    });

    it('順序が異なる場合でも appendChild せず zIndex のみ更新する', (): void => {
        const first = createElement('view-a');
        const second = createElement('view-b');
        const previewContent = createPreviewContent([second, first]);

        setupDocument((id: string): FakeElement | null => {
            if (id === 'view-a') {
                return first;
            }
            if (id === 'view-b') {
                return second;
            }
            return null;
        });

        const manager = new ContentManager(createDeps(previewContent));
        (manager as any)._metadataList = [
            { metadataId: 'a', zindex: 0 },
            { metadataId: 'b', zindex: 1 },
        ];

        manager.reorderPreviewContentByMetadata();

        assert.strictEqual(previewContent.appendCallCount, 0);
        assert.deepStrictEqual(previewContent.children.map((child) => child.id), ['view-b', 'view-a']);
        assert.strictEqual(first.style.zIndex, '0');
        assert.strictEqual(second.style.zIndex, '1');
    });

    it('同一 zindex は createdAt で順序を決めて zIndex を更新する', (): void => {
        const first = createElement('view-a');
        const second = createElement('view-b');
        const previewContent = createPreviewContent([second, first]);

        setupDocument((id: string): FakeElement | null => {
            if (id === 'view-a') {
                return first;
            }
            if (id === 'view-b') {
                return second;
            }
            return null;
        });

        const manager = new ContentManager(createDeps(previewContent));
        (manager as any)._metadataList = [
            { metadataId: 'a', zindex: 5, createdAt: '2024-01-01T00:00:00.000Z' },
            { metadataId: 'b', zindex: 5, createdAt: '2024-01-01T00:00:01.000Z' },
        ];

        manager.reorderPreviewContentByMetadata();

        assert.strictEqual(previewContent.appendCallCount, 0);
        assert.strictEqual(first.style.zIndex, '5');
        assert.strictEqual(second.style.zIndex, '6');
    });
});
