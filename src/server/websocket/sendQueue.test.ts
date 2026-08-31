import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SendQueue } from './sendQueue';
import { WebSocket } from 'ws';

/**
 * テスト用の WebSocket モック
 * ws.send(data, callback) を捕捉する。
 */
function createMockWs(opts: {
    /** send が呼ばれたとき、エラーを返すか否か */
    sendError?: Error;
    /**
     * send が呼ばれたとき callback を発火するタイミング。
     * 'sync'  : 同期的に即発火（デフォルト）
     * 'defer' : setImmediate で非同期発火
     * 'never' : callback を発火しない（フラッシュ中状態のテスト用）
     */
    callbackTiming?: 'sync' | 'defer' | 'never';
} = {}): { ws: WebSocket; sent: (string | Buffer)[] } {
    const sent: (string | Buffer)[] = [];
    const mock = {
        send(data: string | Buffer, cb?: (err?: Error) => void) {
            sent.push(data);
            const error = opts.sendError;
            const timing = opts.callbackTiming ?? 'sync';
            if (timing === 'sync') {
                cb?.(error);
            } else if (timing === 'defer') {
                setImmediate(() => cb?.(error));
            }
            // 'never' は cb を呼ばない
        },
    };
    return { ws: mock as unknown as WebSocket, sent };
}

describe('SendQueue', () => {
    it('通常メッセージが push した順番通りに送信される', (_, done) => {
        const { ws, sent } = createMockWs({ callbackTiming: 'defer' });
        const q = new SendQueue(ws);

        q.push('a');
        q.push('b');
        q.push('c');

        setImmediate(() => setImmediate(() => setImmediate(() => {
            assert.deepStrictEqual(sent, ['a', 'b', 'c']);
            done();
        })));
    });

    it('priority メッセージは normal メッセージより先に送信される', (_, done) => {
        const { ws, sent } = createMockWs({ callbackTiming: 'defer' });
        const q = new SendQueue(ws);

        // flush 開始前に両方積む
        q.push('normal1');
        q.push('prio1', true);
        q.push('normal2');
        q.push('prio2', true);

        // 全件 drain されるまで十分待つ
        setTimeout(() => {
            // prio1, prio2 が normal1, normal2 より先
            assert.strictEqual(sent[0], 'normal1'); // 最初の1件はすでに送信中
            assert.strictEqual(sent[1], 'prio1');
            assert.strictEqual(sent[2], 'prio2');
            assert.strictEqual(sent[3], 'normal2');
            done();
        }, 50);
    });

    it('フラッシュ中に push した priority メッセージが次の drain で優先される', (_, done) => {
        // 1件目の callback を手動制御し、その間に後続を積んで割り込みを検証する
        let pendingCallback: ((err?: Error) => void) | null = null;
        const sent: (string | Buffer)[] = [];
        const mock = {
            send(data: string | Buffer, cb?: (err?: Error) => void) {
                sent.push(data);
                pendingCallback = cb ?? null;
            },
        };
        const q = new SendQueue(mock as unknown as import('ws').WebSocket);

        q.push('normal_first'); // flush 開始 → pending

        // 1件目 callback 未発火の状態で後続を積む
        q.push('normal_second');
        q.push('prio_interrupt', true);

        // callback を手動発火して drain を進める
        // TypeScript はクロージャ経由の代入を追跡できないため型アサーションで narrowing をリセット
        (pendingCallback as ((err?: Error) => void) | null)?.();  // normal_first 完了 → 次は prio_interrupt のはず
        (pendingCallback as ((err?: Error) => void) | null)?.();  // prio_interrupt 完了
        (pendingCallback as ((err?: Error) => void) | null)?.();  // normal_second 完了

        assert.strictEqual(sent[0], 'normal_first');
        assert.strictEqual(sent[1], 'prio_interrupt'); // 割り込み
        assert.strictEqual(sent[2], 'normal_second');
        done();
    });

    it('clear() を呼ぶと未送信メッセージが破棄される', () => {
        const { ws, sent } = createMockWs({ callbackTiming: 'never' });
        const q = new SendQueue(ws);

        q.push('msg1'); // flush 開始（callback は来ない）
        q.push('msg2');
        q.push('msg3');

        q.clear();

        assert.strictEqual(q.queueLength, 0);
        assert.strictEqual(q.priorityQueueLength, 0);
        // msg1 はすでに send 済み、msg2/msg3 は破棄されているので sent.length === 1
        assert.strictEqual(sent.length, 1);
    });

    it('send エラー時にキューがクリアされてそれ以上 send が呼ばれない', (_, done) => {
        const { ws, sent } = createMockWs({
            callbackTiming: 'defer',
            sendError: new Error('connection closed'),
        });
        const q = new SendQueue(ws);

        q.push('msg1');
        q.push('msg2');
        q.push('msg3');

        setTimeout(() => {
            // エラー後はキューが空になり、send が1回のみ呼ばれている
            assert.strictEqual(sent.length, 1);
            assert.strictEqual(q.queueLength, 0);
            assert.strictEqual(q.priorityQueueLength, 0);
            done();
        }, 50);
    });

    it('空のキューに push すると flush が開始される', (_, done) => {
        const { ws, sent } = createMockWs({ callbackTiming: 'defer' });
        const q = new SendQueue(ws);

        // 最初は何も積まれていない
        assert.strictEqual(sent.length, 0);

        q.push('only_one');

        setImmediate(() => {
            assert.strictEqual(sent.length, 1);
            done();
        });
    });

    it('queueLength / priorityQueueLength が正しい値を返す', () => {
        const { ws } = createMockWs({ callbackTiming: 'never' });
        const q = new SendQueue(ws);

        q.push('n1');        // flush 開始（callback 来ない）
        q.push('n2');
        q.push('p1', true);
        q.push('n3');
        q.push('p2', true);

        // n1 は flushing 中（normalQueue から取り出し済み）
        assert.strictEqual(q.queueLength, 2);          // n2, n3
        assert.strictEqual(q.priorityQueueLength, 2);  // p1, p2
    });
});
