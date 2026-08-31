/**
 * IFrame 通信クラス
 *
 * postMessage を使って parent <-> iframe 間で JSON-RPC 形式のメッセージをやり取りする。
 * iframe が null の場合は「iframe 内部（child）」として動作する。
 */

import { ITownsCommand } from '../commands/itownsCommands';

type IFrameCallback = (err: any, result?: any) => void;
type IFrameEventCallback = (err: any, params: any, rawMsg?: any) => void;

let connectorCounter = 0;
const ID_OFFSET = 100000;

export class IFrameConnector {
    private iframe: HTMLIFrameElement | null;
    private contentWindow: Window | null;
    private resultCallbacks: Record<number, IFrameCallback>;
    private eventListeners: Map<string, IFrameEventCallback[]>;
    private messageID: number;
    private messageCallback: (evt: MessageEvent) => void;

    constructor(iframe: HTMLIFrameElement | null = null) {
        this.iframe = iframe;
        this.contentWindow = iframe ? iframe.contentWindow : null;
        this.resultCallbacks = {};
        this.eventListeners = new Map();
        this.messageID = 1 + ID_OFFSET * connectorCounter++;

        this.messageCallback = (evt: MessageEvent) => {
            try {
                const data = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
                this.eventTextMessage(data);
            } catch (e) {
                console.error('[IFrameConnector]', e, evt);
            }
        };
    }

    on(event: string, listener: IFrameEventCallback): void {
        if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
        this.eventListeners.get(event)!.push(listener);
    }

    private emit(event: string, ...args: any[]): void {
        for (const fn of this.eventListeners.get(event) ?? []) {
            fn(args[0], args[1], args[2]);
        }
    }

    private eventTextMessage(meta: any): void {
        if (this.iframe && meta.to === 'parent') {
            // parent 側: iframe からのメッセージ
            this.handleIncoming(meta);
        } else if (!this.iframe && meta.to === 'iframe') {
            // iframe 側: parent からのメッセージ
            this.handleIncoming(meta);
        } else {
            console.error('[IFrameConnector] Unexpected to field', meta);
            if (meta.id != null) {
                this.resultCallbacks[meta.id]?.('ArgumentError', null);
                delete this.resultCallbacks[meta.id];
            }
        }
    }

    private handleIncoming(meta: any): void {
        if (meta.error) {
            this.resultCallbacks[meta.id]?.(meta.error, null);
            delete this.resultCallbacks[meta.id];
        } else if (meta.id != null && meta.result !== undefined) {
            this.resultCallbacks[meta.id]?.(null, meta.result);
            delete this.resultCallbacks[meta.id];
        } else if (meta.id != null && meta.params !== undefined) {
            this.emit(meta.method, null, meta.params, meta);
        } else {
            console.error('[IFrameConnector] ArgumentError', meta);
            if (meta.id != null) {
                this.resultCallbacks[meta.id]?.('ArgumentError', null);
                delete this.resultCallbacks[meta.id];
            }
        }
    }

    private sendWrapper(id: number, method: string, data: string, cb: IFrameCallback | null): void {
        const isItownsCmd = Object.values(ITownsCommand).includes(method as any);
        if (!isItownsCmd) {
            console.error('[IFrameConnector] Unknown method:', method);
            return;
        }
        if (cb) {
            this.resultCallbacks[id] = cb;
        }
        const target = this.contentWindow ?? window.parent;
        target.postMessage(data, location.href);
    }

    /** テキストメッセージを送信する */
    send(method: string, args: any, resultCallback: IFrameCallback | null = null): void {
        const req: any = {
            jsonrpc: '2.0',
            type: 'utf8',
            id: this.messageID,
            method,
            params: args,
            to: this.iframe ? 'iframe' : 'parent',
        };
        this.messageID++;
        try {
            this.sendWrapper(req.id, method, JSON.stringify(req), resultCallback);
        } catch (e) {
            console.error(e);
        }
    }

    /** メッセージへの返信を行う */
    sendResponse(request: any, args: any = {}): void {
        const res: any = {
            jsonrpc: '2.0',
            id: request.id,
            method: request.method,
            result: args,
            to: this.iframe ? 'iframe' : 'parent',
        };
        try {
            const target = this.contentWindow ?? window.parent;
            target.postMessage(JSON.stringify(res), location.href);
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * parent <-> iframe 間の通信を開始する
     */
    connect(onopen: () => void, _onclose?: () => void): void {
        window.removeEventListener('message', this.messageCallback);
        window.addEventListener('message', this.messageCallback);

        if (this.iframe) {
            // parent → iframe
            this.send(ITownsCommand.Init, {}, () => {});
            onopen();
        } else {
            // iframe → parent（受け身）
            onopen();
        }
    }

    disconnect(): void {
        window.removeEventListener('message', this.messageCallback);
    }
}
