/**
 * WebSocketClient 単体テスト
 *
 * sendCommand() の解決・拒否挙動と handleMessage の callback ルーティングを検証する。
 * WebSocket は globalThis.WebSocket をパッチして差し替える。
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { WebSocketClient } from './WebSocketClient';

// ============================================================
// モック WebSocket
// ============================================================

interface MockWebSocket {
    sentMessages: string[];
    onopen: (() => void) | null;
    onclose: (() => void) | null;
    onerror: ((e: any) => void) | null;
    onmessage: ((event: { data: string }) => void) | null;
    send(data: string): void;
    close(): void;
    triggerOpen(): void;
    triggerMessage(data: string): void;
    triggerClose(): void;
}

function createMockWebSocket(): MockWebSocket {
    const ws: MockWebSocket = {
        sentMessages: [],
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
        send(data: string) { this.sentMessages.push(data); },
        close() {},
        triggerOpen() { this.onopen?.(); },
        triggerMessage(data: string) { this.onmessage?.({ data }); },
        triggerClose() { this.onclose?.(); },
    };
    return ws;
}

// ============================================================
// テスト
// ============================================================

describe('WebSocketClient', () => {
    let mock: MockWebSocket;
    let originalWebSocket: any;

    beforeEach(() => {
        mock = createMockWebSocket();
        originalWebSocket = (globalThis as any).WebSocket;

        // window.location をモック
        if (!(globalThis as any).window) {
            (globalThis as any).window = {
                location: { protocol: 'http:', host: 'localhost:8080' },
            };
        }

        (globalThis as any).WebSocket = function (_url: string) {
            // プロパティをモックに委譲
            mock.onopen = null;
            mock.onclose = null;
            mock.onerror = null;
            mock.onmessage = null;
            Object.defineProperty(this, 'onopen', {
                get: () => mock.onopen,
                set: (v) => { mock.onopen = v; },
                configurable: true,
            });
            Object.defineProperty(this, 'onclose', {
                get: () => mock.onclose,
                set: (v) => { mock.onclose = v; },
                configurable: true,
            });
            Object.defineProperty(this, 'onerror', {
                get: () => mock.onerror,
                set: (v) => { mock.onerror = v; },
                configurable: true,
            });
            Object.defineProperty(this, 'onmessage', {
                get: () => mock.onmessage,
                set: (v) => { mock.onmessage = v; },
                configurable: true,
            });
            this.send = (data: string) => mock.sentMessages.push(data);
            this.close = () => {};
        };
    });

    afterEach(() => {
        (globalThis as any).WebSocket = originalWebSocket;
        delete (globalThis as any).window;
    });

    it('接続前に sendCommand() を呼ぶと拒否される', async () => {
        const broadcasts: any[] = [];
        const client = new WebSocketClient(
            (msg) => broadcasts.push(msg),
            () => {},
            () => {},
            () => {},
        );
        await assert.rejects(
            () => client.sendCommand('Ping', {}),
            /Not connected/,
        );
    });

    it('接続後に sendCommand() を呼ぶと JSON-RPC メッセージを送信する', async () => {
        const client = new WebSocketClient(
            () => {},
            () => {},
            () => {},
            () => {},
        );
        client.connect();
        mock.triggerOpen();

        assert.strictEqual(client.isConnected, true);

        const promise = client.sendCommand('GetMetaData', {});

        assert.strictEqual(mock.sentMessages.length, 1);
        const sent = JSON.parse(mock.sentMessages[0]);
        assert.strictEqual(sent.method, 'GetMetaData');
        assert.strictEqual(sent.jsonrpc, '2.0');
        assert.ok(sent.id);

        // レスポンスを返す
        mock.triggerMessage(JSON.stringify({ jsonrpc: '2.0', id: sent.id, result: { metadataList: [] } }));
        const result = await promise;
        assert.deepStrictEqual(result, { metadataList: [] });
    });

    it('エラーレスポンスが来た場合 sendCommand() は拒否される', async () => {
        const client = new WebSocketClient(
            () => {},
            () => {},
            () => {},
            () => {},
        );
        client.connect();
        mock.triggerOpen();

        const promise = client.sendCommand('Fail', {});
        const sent = JSON.parse(mock.sentMessages[0]);
        mock.triggerMessage(JSON.stringify({ jsonrpc: '2.0', id: sent.id, error: { message: 'something went wrong' } }));

        await assert.rejects(() => promise);
    });

    it('method フィールドがあるメッセージは onBroadcast へ渡される', async () => {
        const broadcasts: any[] = [];
        const client = new WebSocketClient(
            (msg) => broadcasts.push(msg),
            () => {},
            () => {},
            () => {},
        );
        client.connect();
        mock.triggerOpen();

        mock.triggerMessage(JSON.stringify({ jsonrpc: '2.0', method: 'SomeEvent', params: { data: 42 } }));

        // handleMessage は async なので少し待つ
        await new Promise((r) => setTimeout(r, 10));

        assert.strictEqual(broadcasts.length, 1);
        assert.strictEqual(broadcasts[0].method, 'SomeEvent');
        assert.deepStrictEqual(broadcasts[0].params, { data: 42 });
    });

    it('registerBroadcastHandler で登録したハンドラを getRegisteredBroadcastHandler で取得できる', () => {
        const client = new WebSocketClient(() => {}, () => {}, () => {}, () => {});
        const handler = (_params: any) => {};
        client.registerBroadcastHandler('MyEvent', handler);
        assert.strictEqual(client.getRegisteredBroadcastHandler('MyEvent'), handler);
    });

    it('isConnected は接続前は false である', () => {
        const client = new WebSocketClient(() => {}, () => {}, () => {}, () => {});
        assert.strictEqual(client.isConnected, false);
    });

    it('stopReconnect() を呼ぶと再接続が無効になる', () => {
        const client = new WebSocketClient(() => {}, () => {}, () => {}, () => {});
        assert.strictEqual(client.isReconnectEnabled(), true);
        client.stopReconnect();
        assert.strictEqual(client.isReconnectEnabled(), false);
    });

    it('再接続無効時は close しても再接続タイマーを登録しない', () => {
        const originalSetTimeout = globalThis.setTimeout;
        let setTimeoutCallCount = 0;
        (globalThis as any).setTimeout = () => {
            setTimeoutCallCount += 1;
            return 0;
        };
        try {
            const client = new WebSocketClient(() => {}, () => {}, () => {}, () => {});
            client.connect();
            mock.triggerOpen();
            client.stopReconnect();

            mock.triggerClose();

            assert.strictEqual(setTimeoutCallCount, 0);
        } finally {
            (globalThis as any).setTimeout = originalSetTimeout;
        }
    });
});
