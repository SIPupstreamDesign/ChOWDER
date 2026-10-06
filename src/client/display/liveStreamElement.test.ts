import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ensureLiveStreamElement } from './liveStreamElement';

class FakeElement {
    id: string = '';
    className: string = '';
    style: Record<string, string> = {};
    children: FakeElement[] = [];

    appendChild(child: FakeElement): FakeElement {
        this.children.push(child);
        return child;
    }
}

describe('ensureLiveStreamElement', () => {
    it('表示範囲に関係なくコンテナを作成し、同じmetadataでは再利用する', (): void => {
        const elementsById = new Map<string, FakeElement>();
        const originalDocument = globalThis.document;
        (globalThis as any).document = {
            createElement(_tagName: string): FakeElement {
                return new FakeElement();
            },
            getElementById(elementId: string): FakeElement | null {
                return elementsById.get(elementId) ?? null;
            },
        };

        const contentArea = new FakeElement();
        contentArea.appendChild = (child: FakeElement): FakeElement => {
            contentArea.children.push(child);
            elementsById.set(child.id, child);
            return child;
        };

        try {
            const firstElement = ensureLiveStreamElement(
                contentArea as unknown as HTMLElement,
                'stream-meta-1',
            );
            const secondElement = ensureLiveStreamElement(
                contentArea as unknown as HTMLElement,
                'stream-meta-1',
            );

            assert.strictEqual(firstElement.id, 'content-stream-meta-1');
            assert.strictEqual(firstElement.className, 'content-item');
            assert.strictEqual(secondElement, firstElement);
            assert.strictEqual(contentArea.children.length, 1);
        } finally {
            (globalThis as any).document = originalDocument;
        }
    });
});