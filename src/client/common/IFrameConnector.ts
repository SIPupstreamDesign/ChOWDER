export type FrameRole = 'controller' | 'display' | 'itowns';

export interface FrameRequest {
    id: number;
    method: string;
    connectionId: string;
    params?: unknown;
}

interface FrameMessage extends FrameRequest {
    to: 'parent' | 'iframe';
    result?: unknown;
    error?: unknown;
}

type ReadyHandler = (role: FrameRole) => void | Promise<void>;
type MessageHandler = (params: unknown, request: FrameRequest) => void;

interface PendingReply {
    complete: (error: unknown, result?: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
}

export function isTrustedFrameEvent(event: Pick<MessageEvent, 'source' | 'origin'>, peer: Window, origin: string): boolean {
    return event.source === peer && event.origin === origin;
}

function isMessage(value: unknown): value is FrameMessage {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    return 'id' in value && typeof value.id === 'number'
        && 'method' in value && typeof value.method === 'string'
        && 'connectionId' in value && typeof value.connectionId === 'string'
        && 'to' in value && (value.to === 'parent' || value.to === 'iframe');
}

function createConnectionId(): string {
    return Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
}

export class IFrameConnector {
    private readonly peer: Window;
    private readonly origin: string;
    private connectionId: string;
    private nextId = 1;
    private ready = false;
    private destroyed = false;
    private preparing = false;
    private readyHandler: ReadyHandler | null = null;
    private closeHandler: (() => void) | null = null;
    private readonly replies = new Map<number, PendingReply>();
    private readonly handlers = new Map<string, MessageHandler[]>();
    private queued: Array<{ method: string; send: () => void; cancel: () => void; supersede: () => void }> = [];
    private readyTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly iframe: HTMLIFrameElement | null = null, private readonly role: FrameRole = 'controller') {
        this.peer = iframe?.contentWindow ?? window.parent;
        this.origin = new URL(iframe?.src ?? (document.referrer || location.href), location.href).origin;
        this.connectionId = iframe === null ? '' : createConnectionId();
    }

    on<Params>(method: string, handler: (error: unknown, params: Params, request: FrameRequest) => void): void {
        const handlers = this.handlers.get(method) ?? [];
        handlers.push((params: unknown, request: FrameRequest): void => {
            handler(null, params as Params, request);
        });
        this.handlers.set(method, handlers);
    }

    connect(onReady: ReadyHandler, onClose?: () => void): void {
        this.readyHandler = onReady;
        this.closeHandler = onClose ?? null;
        window.addEventListener('message', this.receive);
        if (this.iframe !== null) {
            this.readyTimer = setTimeout((): void => { this.destroy(); }, 15000);
            this.post({ id: 0, method: '$Connect', connectionId: this.connectionId, to: 'iframe', params: { role: this.role } });
        }
    }

    send<Result = unknown>(method: string, params: unknown, callback: ((error: unknown, result?: Result) => void) | null = null): void {
        if (this.destroyed) {
            callback?.(new Error('Frame connection destroyed'));
            return;
        }
        const send = (): void => {
            const id = this.nextId++;
            if (callback !== null) {
                const timer = setTimeout((): void => {
                    this.replies.delete(id);
                    callback(new Error(`Frame request timed out: ${method}`));
                }, 10000);
                this.replies.set(id, {
                    timer,
                    complete: (error: unknown, result?: unknown): void => { callback(error, result as Result); },
                });
            }
            this.post({ id, method, params, connectionId: this.connectionId, to: this.iframe === null ? 'parent' : 'iframe' });
        };
        if (this.ready) {
            send();
        } else {
            if (method === 'UpdateCamera' || method === 'Resize' || method === 'UpdateTime') {
                const previous = this.queued.find((request): boolean => { return request.method === method; });
                previous?.supersede();
                this.queued = this.queued.filter((request): boolean => { return request.method !== method; });
            }
            this.queued.push({
                method,
                send,
                cancel: (): void => { callback?.(new Error('Frame connection destroyed')); },
                supersede: (): void => { callback?.(null, { phase: 'superseded' } as Result); },
            });
        }
    }

    sendResponse(request: FrameRequest, result: unknown = {}): void {
        if (request.connectionId !== this.connectionId || this.destroyed) {
            return;
        }
        this.post({ ...request, params: undefined, result, to: this.iframe === null ? 'parent' : 'iframe' });
    }

    destroy(): void {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        window.removeEventListener('message', this.receive);
        if (this.readyTimer !== null) {
            clearTimeout(this.readyTimer);
        }
        for (const reply of this.replies.values()) {
            clearTimeout(reply.timer);
            reply.complete(new Error('Frame connection destroyed'));
        }
        for (const queued of this.queued) {
            queued.cancel();
        }
        this.replies.clear();
        this.handlers.clear();
        this.queued = [];
        this.closeHandler?.();
    }

    disconnect(): void {
        this.destroy();
    }

    private post(message: FrameMessage): void {
        if (!this.destroyed) {
            this.peer.postMessage(JSON.stringify(message), this.origin);
        }
    }

    private readonly receive = (event: MessageEvent): void => {
        if (this.destroyed || !isTrustedFrameEvent(event, this.peer, this.origin) || typeof event.data !== 'string') {
            return;
        }
        let message: unknown;
        try {
            message = JSON.parse(event.data);
        } catch {
            return;
        }
        if (!isMessage(message) || message.to !== (this.iframe === null ? 'iframe' : 'parent')) {
            return;
        }
        if (message.method === '$Connect' && this.iframe === null) {
            if (this.preparing || this.ready) {
                return;
            }
            const params = message.params;
            if (typeof params !== 'object' || params === null || !('role' in params)
                || (params.role !== 'controller' && params.role !== 'display' && params.role !== 'itowns')) {
                return;
            }
            this.preparing = true;
            this.connectionId = message.connectionId;
            void Promise.resolve(this.readyHandler?.(params.role)).then((): void => {
                if (this.destroyed) {
                    return;
                }
                this.ready = true;
                this.post({ id: 0, method: '$Ready', connectionId: this.connectionId, to: 'parent' });
                this.flush();
            }).catch((error: unknown): void => {
                console.error('[IFrameConnector] Frame preparation failed', error);
                this.post({ id: 0, method: '$Failed', connectionId: this.connectionId, to: 'parent', error: error instanceof Error ? error.message : 'Preparation failed' });
                this.destroy();
            });
            return;
        }
        if (message.connectionId !== this.connectionId) {
            return;
        }
        if (message.method === '$Failed') {
            console.error('[IFrameConnector] Frame rejected initialization', message.error);
            this.destroy();
            return;
        }
        if (message.method === '$Ready' && this.iframe !== null && !this.ready) {
            this.ready = true;
            if (this.readyTimer !== null) {
                clearTimeout(this.readyTimer);
            }
            void Promise.resolve(this.readyHandler?.(this.role)).then((): void => {
                this.flush();
                this.send('Init', {});
            }).catch((): void => { this.destroy(); });
            return;
        }
        if ('result' in message || 'error' in message) {
            const reply = this.replies.get(message.id);
            if (reply !== undefined) {
                this.replies.delete(message.id);
                clearTimeout(reply.timer);
                reply.complete(message.error ?? null, message.result);
            }
            return;
        }
        for (const handler of this.handlers.get(message.method) ?? []) {
            handler(message.params, message);
        }
    };

    private flush(): void {
        const queued = this.queued;
        this.queued = [];
        for (const queuedRequest of queued) {
            if (!this.destroyed) {
                queuedRequest.send();
            }
        }
    }
}