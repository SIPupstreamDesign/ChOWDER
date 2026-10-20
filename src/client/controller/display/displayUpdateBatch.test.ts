import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { coalesceDisplayUpdateData, DisplayUpdateQueue } from './displayUpdateBatch';
import type { DisplayUpdateData } from '../types';

describe('coalesceDisplayUpdateData', () => {
    it('merges position and visibility patches for the same window', (): void => {
        const result = coalesceDisplayUpdateData([
            { type: 'display', windowId: 'window-1', posx: 100 },
            { type: 'display', windowId: 'window-1', posy: 200 },
            { type: 'display', windowId: 'window-1', contentVisible: false },
        ]);

        assert.deepStrictEqual(result, [{
            type: 'display',
            windowId: 'window-1',
            posx: 100,
            posy: 200,
            contentVisible: false,
        }]);
    });

    it('keeps only the most recently changed dimension as the resize anchor', (): void => {
        const result = coalesceDisplayUpdateData([
            { type: 'display', windowId: 'window-1', virtualWidth: 1200 },
            { type: 'display', windowId: 'window-1', virtualHeight: 700 },
        ]);

        assert.deepStrictEqual(result, [{
            type: 'display',
            windowId: 'window-1',
            virtualHeight: 700,
        }]);
    });

    it('keeps updates for different windows independent', (): void => {
        const result = coalesceDisplayUpdateData([
            { type: 'display', windowId: 'window-1', posx: 100 },
            { type: 'display', windowId: 'window-2', virtualWidth: 960 },
        ]);

        assert.deepStrictEqual(result, [
            { type: 'display', windowId: 'window-1', posx: 100 },
            { type: 'display', windowId: 'window-2', virtualWidth: 960 },
        ]);
    });
});

describe('DisplayUpdateQueue', (): void => {
    it('checks cancellation again immediately before sending', { timeout: 5000 }, async (): Promise<void> => {
        const sent: DisplayUpdateData[] = [];
        const queue = new DisplayUpdateQueue(async (data): Promise<void> => { sent.push(data); });
        const operation = { cancelled: false };
        const pending = queue.enqueue({ type: 'display', windowId: 'a', posx: 15 }, operation);
        queue.flush();
        queue.cancel(operation);
        await pending;
        await queue.whenIdle('a');
        assert.equal(sent.length, 0);
    });
    it('cancels only the operation contribution before coalescing', { timeout: 5000 }, async (): Promise<void> => {
        const sent: DisplayUpdateData[] = [];
        const queue = new DisplayUpdateQueue(async (data): Promise<void> => { sent.push(data); });
        const operation = { cancelled: false };
        const drag = queue.enqueue({ type: 'display', windowId: 'a', posx: 15 }, operation);
        const property = queue.enqueue({ type: 'display', windowId: 'a', contentVisible: false });
        queue.cancel(operation);
        queue.flush();
        await Promise.all([drag, property]);
        assert.deepEqual(sent, [{ type: 'display', windowId: 'a', contentVisible: false }]);
    });

    it('serializes one window without blocking another and waits for in-flight saves', { timeout: 5000 }, async (): Promise<void> => {
        const sent: DisplayUpdateData[] = [];
        let release: () => void = (): void => { };
        const firstSave = new Promise<void>((resolve): void => { release = resolve; });
        const queue = new DisplayUpdateQueue(async (data): Promise<void> => {
            sent.push(data);
            if (data.windowId === 'a' && data.posx === 1) { await firstSave; }
        });
        const first = queue.enqueue({ type: 'display', windowId: 'a', posx: 1 });
        queue.flush();
        await Promise.resolve();
        const operation = { cancelled: false };
        const second = queue.enqueue({ type: 'display', windowId: 'a', posx: 2 }, operation);
        const other = queue.enqueue({ type: 'display', windowId: 'b', posx: 3 });
        queue.flush();
        await other;
        let idle = false;
        const wait = queue.whenIdle('a').then((): void => { idle = true; });
        assert.equal(idle, false);
        queue.cancel(operation);
        release();
        await Promise.all([first, second, wait]);
        assert.equal(idle, true);
        assert.deepEqual(sent.map((data): number | undefined => { return data.posx; }), [1, 3]);
    });
});