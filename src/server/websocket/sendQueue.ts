import { WebSocket } from 'ws';

const QUEUE_WARN_THRESHOLD = 100;

interface QueueItem {
    data: string | Buffer;
    kind: 'priority' | 'normal' | 'latest';
    key?: string;
}

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
    private latestQueue: Map<string, string | Buffer> = new Map();
    private latestOrder: string[] = [];
    private preferLatest = true;
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

    pushLatest(key: string, data: string | Buffer): void {
        if (!this.latestQueue.has(key)) {
            this.latestOrder.push(key);
        }
        this.latestQueue.set(key, data);

        if (!this.flushing) {
            this.flush();
        }
    }

    /**
     * キューを drain する。priority レーンを優先して 1 件ずつ送信し、
     * コールバック後に次を送る。
     */
    private flush(): void {
        const item = this.takeNext();
        if (item === undefined) {
            this.flushing = false;
            return;
        }

        this.flushing = true;
        this.ws.send(item.data, (err) => {
            if (err) {
                // 接続切断等のエラー：残キューを破棄して終了
                this.clear();
                return;
            }
            this.flush();
        });
    }

    private takeNext(): QueueItem | undefined {
        const priorityData = this.priorityQueue.shift();
        if (priorityData !== undefined) {
            return { data: priorityData, kind: 'priority' };
        }

        const hasLatest = this.latestOrder.length > 0;
        const hasNormal = this.normalQueue.length > 0;
        const shouldSendLatest = hasLatest && (!hasNormal || this.preferLatest);

        if (shouldSendLatest) {
            const key = this.latestOrder.shift()!;
            const data = this.latestQueue.get(key);
            this.latestQueue.delete(key);
            this.preferLatest = false;
            return data === undefined ? undefined : { data, kind: 'latest', key };
        }

        const normalData = this.normalQueue.shift();
        if (normalData !== undefined) {
            this.preferLatest = true;
        }
        return normalData === undefined ? undefined : { data: normalData, kind: 'normal' };
    }

    /**
     * 両キューを空にし、flushing フラグをリセットする。
     * 接続切断時に呼び出してメモリを解放する。
     */
    clear(): void {
        this.priorityQueue = [];
        this.normalQueue = [];
        this.latestQueue.clear();
        this.latestOrder = [];
        this.preferLatest = true;
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

    /** 最新値キューに登録されているコンテンツ数 */
    get latestQueueLength(): number {
        return this.latestOrder.length;
    }
}
