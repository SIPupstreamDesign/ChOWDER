import assert from 'node:assert/strict';
import { it } from 'node:test';
import { IFrameConnector, isTrustedFrameEvent } from './IFrameConnector';

it('requires both the expected iframe window and origin', (): void => {
    const first = {} as Window;
    const second = {} as Window;
    assert.equal(isTrustedFrameEvent({ source: first, origin: 'https://example.test' }, first, 'https://example.test'), true);
    assert.equal(isTrustedFrameEvent({ source: second, origin: 'https://example.test' }, first, 'https://example.test'), false);
    assert.equal(isTrustedFrameEvent({ source: first, origin: 'https://other.test' }, first, 'https://example.test'), false);
});

interface ProbeMessage {
    id: number;
    method: string;
    connectionId: string;
}

function createHarness(): {
    connector: IFrameConnector;
    sent: ProbeMessage[];
    dispatch: (message: object, origin?: string) => void;
    cleanup: () => void;
} {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
    const listeners = new Set<(event: MessageEvent) => void>();
    const sent: ProbeMessage[] = [];
    const peer = { postMessage: (message: string): void => { sent.push(JSON.parse(message)); } };
    Object.defineProperty(globalThis, 'window', {
        configurable: true, value: {
            addEventListener: (_type: string, listener: (event: MessageEvent) => void): void => { listeners.add(listener); },
            removeEventListener: (_type: string, listener: (event: MessageEvent) => void): void => { listeners.delete(listener); },
        }
    });
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { href: 'https://test.example/parent' } });
    const connector = new IFrameConnector({ src: 'https://test.example/frame', contentWindow: peer } as unknown as HTMLIFrameElement);
    return {
        connector,
        sent,
        dispatch: (message: object, origin = 'https://test.example'): void => {
            for (const listener of listeners) {
                listener({ source: peer, origin, data: JSON.stringify(message) } as unknown as MessageEvent);
            }
        },
        cleanup: (): void => {
            connector.destroy();
            if (previousWindow !== undefined) {
                Object.defineProperty(globalThis, 'window', previousWindow);
            } else {
                Reflect.deleteProperty(globalThis, 'window');
            }
            if (previousLocation !== undefined) {
                Object.defineProperty(globalThis, 'location', previousLocation);
            } else {
                Reflect.deleteProperty(globalThis, 'location');
            }
        },
    };
}

it('waits for trusted readiness before opening and sending queued requests', { timeout: 5000 }, async (): Promise<void> => {
    const harness = createHarness();
    try {
        let opened = false;
        harness.connector.connect((): void => { opened = true; });
        harness.connector.send('Resize', {});
        const connect = harness.sent[0];
        assert.equal(opened, false);
        assert.equal(harness.sent.length, 1);
        harness.dispatch({ ...connect, method: '$Ready', to: 'parent' }, 'https://wrong.example');
        assert.equal(opened, false);
        harness.dispatch({ ...connect, method: '$Ready', to: 'parent' });
        await Promise.resolve();
        assert.equal(opened, true);
        assert.ok(harness.sent.some((message): boolean => { return message.method === 'Resize'; }));
    } finally {
        harness.cleanup();
    }
});

it('releases queued callbacks on destruction', { timeout: 5000 }, async (): Promise<void> => {
    const harness = createHarness();
    try {
        harness.connector.connect((): void => { });
        let canceled = false;
        harness.connector.send('Pending', {}, (error): void => { canceled = error instanceof Error; });
        harness.connector.destroy();
        assert.equal(canceled, true);
    } finally {
        harness.cleanup();
    }
});

it('keeps only the latest camera before readiness and completes superseded requests', { timeout: 5000 }, async (): Promise<void> => {
    const harness = createHarness();
    try {
        harness.connector.connect((): void => { });
        let superseded: unknown = null;
        harness.connector.send('UpdateCamera', { revision: 1 }, (_error, result): void => { superseded = result; });
        harness.connector.send('UpdateCamera', { revision: 2 });
        assert.deepEqual(superseded, { phase: 'superseded' });
        harness.dispatch({ ...harness.sent[0], method: '$Ready', to: 'parent' });
        await Promise.resolve();
        assert.equal(harness.sent.filter((message): boolean => { return message.method === 'UpdateCamera'; }).length, 1);
    } finally {
        harness.cleanup();
    }
});

it('accepts a reply only for the current connection and request', { timeout: 5000 }, async (): Promise<void> => {
    const harness = createHarness();
    try {
        harness.connector.connect((): void => { });
        harness.dispatch({ ...harness.sent[0], method: '$Ready', to: 'parent' });
        await Promise.resolve();
        let result: unknown = null;
        harness.connector.send('CaptureScreen', {}, (_error, value): void => { result = value; });
        const request = harness.sent[harness.sent.length - 1];
        harness.dispatch({ ...request, connectionId: 'old', to: 'parent', result: { ok: true } });
        assert.equal(result, null);
        harness.dispatch({ ...request, to: 'parent', result: { ok: true } });
        assert.deepEqual(result, { ok: true });
    } finally {
        harness.cleanup();
    }
});