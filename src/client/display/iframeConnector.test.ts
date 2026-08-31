/**
 * IFrameConnector 単体テスト
 *
 * parent/iframe 間の postMessage ベース JSON-RPC プロトコルを検証する。
 *
 * モック方針（liveStreamManager.test.ts と同様の globalThis パッチ手法）:
 *   - globalThis.window: addEventListener / removeEventListener をスタブ化
 *   - globalThis.location: { href: 'https://test/' } を設定
 *   - モック iframe: { contentWindow: { postMessage: fn } } 形状
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { IFrameConnector } from './IFrameConnector';

// ============================================================
// グローバルスタブのセットアップ
// ============================================================

type MessageHandler = (evt: MessageEvent) => void;

let registeredHandlers: MessageHandler[] = [];
let removedHandlers: MessageHandler[] = [];

const mockWindow = {
    addEventListener: (_type: string, handler: MessageHandler) => {
        registeredHandlers.push(handler);
    },
    removeEventListener: (_type: string, handler: MessageHandler) => {
        removedHandlers.push(handler);
        registeredHandlers = registeredHandlers.filter(h => h !== handler);
    },
};

/**
 * 登録済みメッセージハンドラに対してメッセージを発火させるヘルパー
 */
function dispatchMessage(data: object): void {
    const evt = { data: JSON.stringify(data) } as MessageEvent;
    for (const handler of registeredHandlers) {
        handler(evt);
    }
}

beforeEach(() => {
    registeredHandlers = [];
    removedHandlers = [];
    (globalThis as any).window = mockWindow;
    (globalThis as any).location = { href: 'https://test/' };
});

afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).location;
});

// ============================================================
// テスト
// ============================================================

describe('IFrameConnector', () => {
    it('connect() が callback をすぐ呼ぶ', () => {
        const mockIframe = {
            contentWindow: { postMessage: () => {} },
        } as unknown as HTMLIFrameElement;

        const connector = new IFrameConnector(mockIframe);
        let called = false;
        connector.connect(() => { called = true; });
        assert.strictEqual(called, true);
    });

    it('connect() 後に window.addEventListener が呼ばれる', () => {
        const mockIframe = {
            contentWindow: { postMessage: () => {} },
        } as unknown as HTMLIFrameElement;

        const connector = new IFrameConnector(mockIframe);
        connector.connect(() => {});
        assert.strictEqual(registeredHandlers.length, 1);
    });

    it('send() が contentWindow.postMessage に { to: "iframe" } を含む JSON を渡す', () => {
        const messages: string[] = [];
        const mockIframe = {
            contentWindow: {
                postMessage: (msg: string) => { messages.push(msg); },
            },
        } as unknown as HTMLIFrameElement;

        const connector = new IFrameConnector(mockIframe);
        connector.connect(() => {});
        messages.length = 0; // connect 時の Init メッセージをリセット

        connector.send('TestMethod', { key: 'value' });

        assert.strictEqual(messages.length, 1);
        const parsed = JSON.parse(messages[0]);
        assert.strictEqual(parsed.to, 'iframe');
        assert.strictEqual(parsed.method, 'TestMethod');
        assert.deepStrictEqual(parsed.params, { key: 'value' });
    });

    it('result レスポンス受信時に resultCallback(null, result) が呼ばれる', () => {
        const mockIframe = {
            contentWindow: { postMessage: () => {} },
        } as unknown as HTMLIFrameElement;

        const connector = new IFrameConnector(mockIframe);
        connector.connect(() => {});

        let receivedErr: any = 'NOT_CALLED';
        let receivedResult: any = 'NOT_CALLED';

        // send でコールバックを登録し、送信した id を取得する
        let sentId: number | null = null;
        const origPostMessage = (mockIframe.contentWindow as any).postMessage;
        (mockIframe.contentWindow as any).postMessage = (msg: string) => {
            const parsed = JSON.parse(msg);
            if (parsed.method !== 'Init') sentId = parsed.id;
            origPostMessage?.(msg);
        };

        connector.send('GetData', {}, (err: any, result: any) => {
            receivedErr = err;
            receivedResult = result;
        });

        assert.notStrictEqual(sentId, null);

        // iframe から parent へのレスポンスを模擬
        dispatchMessage({ jsonrpc: '2.0', to: 'parent', id: sentId, result: { data: 'ok' } });

        assert.strictEqual(receivedErr, null);
        assert.deepStrictEqual(receivedResult, { data: 'ok' });
    });

    it('error レスポンス受信時に resultCallback(error, null) が呼ばれる', () => {
        const mockIframe = {
            contentWindow: { postMessage: () => {} },
        } as unknown as HTMLIFrameElement;

        const connector = new IFrameConnector(mockIframe);
        connector.connect(() => {});

        let receivedErr: any = 'NOT_CALLED';
        let sentId: number | null = null;

        const orig = (mockIframe.contentWindow as any).postMessage;
        (mockIframe.contentWindow as any).postMessage = (msg: string) => {
            const parsed = JSON.parse(msg);
            if (parsed.method !== 'Init') sentId = parsed.id;
            orig?.(msg);
        };

        connector.send('FailCmd', {}, (err: any, _result: any) => {
            receivedErr = err;
        });

        dispatchMessage({ jsonrpc: '2.0', to: 'parent', id: sentId, error: 'something went wrong' });

        assert.strictEqual(receivedErr, 'something went wrong');
    });

    it('on(method, cb) 登録後、一致する method のメッセージで cb が呼ばれる', () => {
        const mockIframe = {
            contentWindow: { postMessage: () => {} },
        } as unknown as HTMLIFrameElement;

        const connector = new IFrameConnector(mockIframe);
        connector.connect(() => {});

        let listenerParams: any = null;
        connector.on('UpdateCamera', (_err: any, params: any, _req: any) => {
            listenerParams = params;
        });

        dispatchMessage({
            jsonrpc: '2.0',
            to: 'parent',
            id: 99,
            method: 'UpdateCamera',
            params: { mat: [1, 0, 0] },
        });

        assert.deepStrictEqual(listenerParams, { mat: [1, 0, 0] });
    });

    it('destroy() 後に window.removeEventListener が呼ばれる', () => {
        const mockIframe = {
            contentWindow: { postMessage: () => {} },
        } as unknown as HTMLIFrameElement;

        const connector = new IFrameConnector(mockIframe);
        connector.connect(() => {});
        assert.strictEqual(registeredHandlers.length, 1);

        connector.destroy();

        assert.strictEqual(removedHandlers.length, 1);
        assert.strictEqual(registeredHandlers.length, 0);
    });

    it('iframe が null のとき send() を呼んでもエラーにならない', () => {
        const connector = new IFrameConnector(null);
        connector.connect(() => {});
        assert.doesNotThrow(() => {
            connector.send('TestMethod', {});
        });
    });

    it('非文字列メッセージは無視される', () => {
        const mockIframe = {
            contentWindow: { postMessage: () => {} },
        } as unknown as HTMLIFrameElement;

        const connector = new IFrameConnector(mockIframe);
        connector.connect(() => {});

        let listenerCalled = false;
        connector.on('SomeMethod', () => { listenerCalled = true; });

        // 非文字列メッセージを発火（スタブを直接呼ぶ）
        const evt = { data: 12345 } as unknown as MessageEvent;
        for (const handler of registeredHandlers) {
            handler(evt);
        }

        assert.strictEqual(listenerCalled, false);
    });
});
