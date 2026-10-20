import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KeyedSerialExecutor } from './keyedSerialExecutor';

describe('KeyedSerialExecutor', () => {
    it('serializes a key while allowing unrelated keys to proceed', { timeout: 5000 }, async (): Promise<void> => {
        const executor = new KeyedSerialExecutor();
        const events: string[] = [];
        const firstGateResolver: { release: () => void } = {
            release: (): void => { },
        };
        const firstGate = new Promise<void>((resolve) => {
            firstGateResolver.release = resolve;
        });

        const first = executor.run('content-a', async (): Promise<void> => {
            events.push('first:start');
            await firstGate;
            events.push('first:finish');
        });
        const second = executor.run('content-a', async (): Promise<void> => {
            events.push('second');
        });
        const unrelated = executor.run('content-b', async (): Promise<void> => {
            events.push('unrelated');
        });

        await unrelated;
        assert.deepStrictEqual(events, ['first:start', 'unrelated']);

        firstGateResolver.release();
        await Promise.all([first, second]);

        assert.deepStrictEqual(events, ['first:start', 'unrelated', 'first:finish', 'second']);
    });

    it('continues a key queue after an operation rejects', { timeout: 5000 }, async (): Promise<void> => {
        const executor = new KeyedSerialExecutor();

        await assert.rejects(
            executor.run('content-a', async (): Promise<string> => {
                throw new Error('update failed');
            }),
            /update failed/,
        );

        const result = await executor.run('content-a', async (): Promise<string> => {
            return 'completed';
        });

        assert.strictEqual(result, 'completed');
    });
});