import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TileImageProgressBroadcaster } from './tileImageProgressBroadcaster';

describe('TileImageProgressBroadcaster', () => {
    it('250ms内のprogressを最新値にまとめ、最終値を即時送信する', (): void => {
        let now = 0;
        const scheduledCallbacks: Array<() => void> = [];
        let cancelScheduled = false;
        const sent: Array<{ completed: number; total: number }> = [];
        const broadcaster = new TileImageProgressBroadcaster(
            (completed: number, total: number): void => { sent.push({ completed, total }); },
            250,
            (): number => { return now; },
            (callback: () => void, _delayMs: number): (() => void) => {
                scheduledCallbacks.push(callback);
                cancelScheduled = false;
                return (): void => { cancelScheduled = true; };
            },
        );

        broadcaster.publish(1, 100);
        now = 50;
        broadcaster.publish(2, 100);
        now = 100;
        broadcaster.publish(3, 100);
        assert.deepStrictEqual(sent, [{ completed: 1, total: 100 }]);

        now = 250;
        const flush = scheduledCallbacks.shift();
        assert.notStrictEqual(flush, undefined);
        if (flush !== undefined && !cancelScheduled) {
            flush();
        }
        assert.deepStrictEqual(sent, [
            { completed: 1, total: 100 },
            { completed: 3, total: 100 },
        ]);

        now = 260;
        broadcaster.publish(100, 100);
        assert.deepStrictEqual(sent[2], { completed: 100, total: 100 });
        broadcaster.dispose();
    });

    it('dispose後はpending progressを送らない', (): void => {
        const scheduledCallbacks: Array<() => void> = [];
        const sent: Array<{ completed: number; total: number }> = [];
        const broadcaster = new TileImageProgressBroadcaster(
            (completed: number, total: number): void => { sent.push({ completed, total }); },
            250,
            (): number => { return 0; },
            (callback: () => void): (() => void) => {
                scheduledCallbacks.push(callback);
                return (): void => { };
            },
        );

        broadcaster.publish(1, 10);
        broadcaster.publish(2, 10);
        broadcaster.dispose();
        const pendingCallback = scheduledCallbacks.shift();
        pendingCallback?.();

        assert.deepStrictEqual(sent, [{ completed: 1, total: 10 }]);
    });
});