import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ContentRenderer } from './ContentRenderer';

class FakePreElement {
    public innerHTML = 'single line';
    public style: Record<string, string> = {};
}

class FakeContainerElement {
    public style: Record<string, string> = {};
    public clientHeight = 0;

    constructor(private readonly preElement: FakePreElement | null) { }

    querySelector(selector: string): FakePreElement | null {
        if (selector !== 'pre') {
            return null;
        }
        return this.preElement;
    }
}

function createRenderer(): ContentRenderer {
    return new ContentRenderer(
        async (): Promise<void> => { },
        (): null => {
            return null;
        },
    );
}

describe('ContentRenderer.resizeTextContent', () => {
    it('既存のpre要素を現在の高さに合わせて再計算する', (): void => {
        const preElement = new FakePreElement();
        const container = new FakeContainerElement(preElement);
        const renderer = createRenderer();

        container.clientHeight = 80;
        renderer.resizeTextContent(container as unknown as HTMLElement);
        assert.strictEqual(preElement.style.fontSize, '79px');

        container.clientHeight = 160;
        renderer.resizeTextContent(container as unknown as HTMLElement);
        assert.strictEqual(preElement.style.fontSize, '159px');
    });

    it('高さが未確定の場合はfont-sizeを変更しない', (): void => {
        const preElement = new FakePreElement();
        preElement.style.fontSize = '12px';
        const container = new FakeContainerElement(preElement);
        const renderer = createRenderer();

        renderer.resizeTextContent(container as unknown as HTMLElement);

        assert.strictEqual(preElement.style.fontSize, '12px');
    });

    it('pre要素がない場合は何もしない', (): void => {
        const renderer = createRenderer();
        const container = new FakeContainerElement(null);

        assert.doesNotThrow(() => {
            renderer.resizeTextContent(container as unknown as HTMLElement);
        });
    });
});