import { WebSocket } from 'ws';

const QUEUE_WARN_THRESHOLD = 100;

/**
 * 2レーン送信キュー（priority / normal）
 *
 * WebSocket 送信をシリアル化し、バックプレッシャーを制御する。
 * ws.send(data, callback) のコールバック到着後に次のメッセージを送ることで、
 * Node.js ユーザー空間バッファへの無制限な積み上がりを防ぐ。
 *
 * レーン:
 *   priority - RPC レスポンス・軽量 JSON broadcast。常に normal より先に drain される。
 *   normal   - MetaBinary (画像・バイナリ) など大きなデータ。将来のチャンク送信もここ。
 */
export class SendQueue {
    private priorityQueue: (string | Buffer)[] = [];
    private normalQueue: (string | Buffer)[] = [];
    private flushing: boolean = false;
    private ws: WebSocket;

    constructor(ws: WebSocket) {
        this.ws = ws;
    }

    /**
     * メッセージをキューに積む。
     * @param data 送信データ
     * @param priority true なら priority レーン、false なら normal レーン（デフォルト: false）
     */
    push(data: string | Buffer, priority: boolean = false): void {
        if (priority) {
            this.priorityQueue.push(data);
            if (this.priorityQueue.length > QUEUE_WARN_THRESHOLD) {
                console.warn(`[SendQueue] priority queue length exceeded ${QUEUE_WARN_THRESHOLD}: ${this.priorityQueue.length}`);
            }
        } else {
            this.normalQueue.push(data);
            if (this.normalQueue.length > QUEUE_WARN_THRESHOLD) {
                console.warn(`[SendQueue] normal queue length exceeded ${QUEUE_WARN_THRESHOLD}: ${this.normalQueue.length}`);
            }
        }

        if (!this.flushing) {
            this.flush();
        }
    }

    /**
     * キューを drain する。priority レーンを優先して 1 件ずつ送信し、
     * コールバック後に次を送る。
     */
    private flush(): void {
        const data = this.priorityQueue.shift() ?? this.normalQueue.shift();
        if (data === undefined) {
            this.flushing = false;
            return;
        }

        this.flushing = true;
        this.ws.send(data, (err) => {
            if (err) {
                // 接続切断等のエラー：残キューを破棄して終了
                this.clear();
                return;
            }
            this.flush();
        });
    }

    /**
     * 両キューを空にし、flushing フラグをリセットする。
     * 接続切断時に呼び出してメモリを解放する。
     */
    clear(): void {
        this.priorityQueue = [];
        this.normalQueue = [];
        this.flushing = false;
    }

    /** normal キューの現在の長さ */
    get queueLength(): number {
        return this.normalQueue.length;
    }

    /** priority キューの現在の長さ */
    get priorityQueueLength(): number {
        return this.priorityQueue.length;
    }
}
