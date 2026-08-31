/**
 * IFrameConnector - parent/iframe 間の postMessage ベース JSON-RPC
 * display.ts の実装と同一（controller 側でも webgl サムネイルに必要）
 */
export class IFrameConnector {
    private iframe: HTMLIFrameElement | null;
    private resultCallbacks: Map<number, (err: any, result?: any) => void> = new Map();
    private eventListeners: Map<string, (err: any, params: any, request: any) => void> = new Map();
    private messageID: number;
    private messageCallback: (evt: MessageEvent) => void;

    constructor(iframe: HTMLIFrameElement | null = null) {
        this.iframe = iframe;
        this.messageID = 1 + Math.floor(Math.random() * 100000);
        this.messageCallback = (evt: MessageEvent) => {
            if (typeof evt.data !== 'string') return;
            try {
                const data = JSON.parse(evt.data);
                this.eventTextMessage(data);
            } catch (_) { /* ignore non-JSON */ }
        };
    }

    private get contentWindow_(): Window | null {
        return this.iframe ? this.iframe.contentWindow : null;
    }

    private eventTextMessage(metaData: any): void {
        if (!this.iframe || metaData.to !== 'parent') return;
        if (metaData.hasOwnProperty('error') && !metaData.hasOwnProperty('params')) {
            const cb = this.resultCallbacks.get(metaData.id);
            if (cb) { cb(metaData.error, null); this.resultCallbacks.delete(metaData.id); }
        } else if (metaData.id != null && metaData.result != null) {
            const cb = this.resultCallbacks.get(metaData.id);
            if (cb) { cb(null, metaData.result); this.resultCallbacks.delete(metaData.id); }
        } else if (metaData.id != null && metaData.params != null) {
            const listener = this.eventListeners.get(metaData.method);
            if (listener) listener(null, metaData.params, metaData);
        }
    }

    on(method: string, callback: (err: any, params: any, request: any) => void): void {
        this.eventListeners.set(method, callback);
    }

    connect(callback: () => void): void {
        window.addEventListener('message', this.messageCallback);
        this.send('Init', {}, () => {});
        callback();
    }

    send(method: string, args: any, resultCallback?: (err: any, result?: any) => void): void {
        const id = this.messageID++;
        const reqjson = {
            jsonrpc: '2.0',
            type: 'utf8',
            id,
            method,
            params: args,
            to: 'iframe',
        };
        if (resultCallback) {
            this.resultCallbacks.set(id, resultCallback);
        }
        try {
            if (this.contentWindow_) {
                this.contentWindow_.postMessage(JSON.stringify(reqjson), location.href);
            }
        } catch (e) {
            console.error('[IFrameConnector] send error:', e);
        }
    }

    destroy(): void {
        window.removeEventListener('message', this.messageCallback);
        this.resultCallbacks.clear();
        this.eventListeners.clear();
    }
}
