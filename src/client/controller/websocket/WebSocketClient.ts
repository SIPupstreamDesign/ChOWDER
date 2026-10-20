import { parseMetaBinary, createMetaBinary } from '../../metaBinaryClient';
import type { JSONRPCMessage } from '../types';

export type LogFn = (msg: string, type?: 'info' | 'error' | 'success') => void;
export type SendCommandFn = (method: string, params?: any) => Promise<any>;
export type SendBinaryCommandFn = (method: string, params: any, binary: ArrayBuffer) => Promise<any>;

const TIMED_DISPLAY_COMMANDS = new Set([
    'GetApprovedDisplays', 'GetWindowMetaData', 'GetPendingDisplays', 'GetDisplaysBySite', 'UpdateWindowMetaData',
]);

interface PendingRequest {
    complete: (error: unknown, result?: unknown) => void;
    timer?: ReturnType<typeof setTimeout>;
}

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private _isConnected = false;
    private reconnectEnabled = true;
    private messageId = 1;
    private callbacks = new Map<string, PendingRequest>();
    private broadcastHandlers = new Map<string, (params: any) => void>();

    constructor(
        private readonly onBroadcast: (message: JSONRPCMessage) => void,
        private readonly onConnected: () => void,
        private readonly onDisconnected: () => void,
        private readonly logFn: LogFn,
    ) { }

    get isConnected(): boolean { return this._isConnected; }
    isReconnectEnabled(): boolean { return this.reconnectEnabled; }

    stopReconnect(): void {
        this.reconnectEnabled = false;
    }

    connect(): void {
        if (this._isConnected) {
            this.logFn('Already connected', 'info');
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}`;

        this.logFn(`Connecting to ${url}...`, 'info');
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this._isConnected = true;
            this.onConnected();
        };

        this.ws.onclose = () => {
            this._isConnected = false;
            for (const id of this.callbacks.keys()) {
                this.completeRequest(id, new Error('Connection closed'));
            }
            this.onDisconnected();
            if (this.reconnectEnabled) {
                setTimeout(() => this.connect(), 5000);
            }
        };

        this.ws.onerror = (error) => {
            this.logFn('WebSocket error occurred', 'error');
            console.error('WebSocket error:', error);
        };

        this.ws.onmessage = async (event) => {
            await this.handleMessage(event.data);
        };
    }

    private async handleMessage(data: string | Blob | ArrayBuffer): Promise<void> {
        try {
            let message: JSONRPCMessage;
            let binary: ArrayBuffer | null = null;

            if (data instanceof Blob) {
                const arrayBuffer = await data.arrayBuffer();
                const result = parseMetaBinary(arrayBuffer);
                message = result.metadata as JSONRPCMessage;
                binary = result.binary;
            } else if (data instanceof ArrayBuffer) {
                const result = parseMetaBinary(data);
                message = result.metadata as JSONRPCMessage;
                binary = result.binary;
            } else {
                message = JSON.parse(data);
            }

            if (message.method === 'UpdateMouseCursor') {

            } else {
                this.logFn(`📨 Received: ${message.method || 'response'}`, 'info');
            }

            if (message.id && this.callbacks.has(message.id)) {
                if (message.error) {
                    this.logFn(`Error: ${JSON.stringify(message.error)}`, 'error');
                    this.completeRequest(message.id, message.error);
                } else {
                    this.completeRequest(message.id, null, binary ? { ...message.result, binary } : message.result);
                }
            } else if (message.method) {
                this.onBroadcast(message);
            }
        } catch (error) {
            this.logFn(`Failed to parse message: ${error}`, 'error');
        }
    }

    sendCommand(method: string, params: any = {}): Promise<any> {
        return this.request(method, (socket, id): void => {
            socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
        });
    }

    sendBinaryCommand(method: string, params: any, binary: ArrayBuffer): Promise<any> {
        return this.request(method, (socket, id): void => {
            socket.send(createMetaBinary({ jsonrpc: '2.0', id, method, params }, binary));
        });
    }

    private completeRequest(id: string, error: unknown, result?: unknown): void {
        const request = this.callbacks.get(id);
        if (request === undefined) { return; }
        this.callbacks.delete(id);
        if (request.timer !== undefined) { clearTimeout(request.timer); }
        request.complete(error, result);
    }

    private request(method: string, send: (socket: WebSocket, id: string) => void): Promise<unknown> {
        return new Promise<unknown>((resolve, reject): void => {
            const socket = this.ws;
            if (!this._isConnected || socket === null) { reject(new Error('Not connected')); return; }
            const id = String(this.messageId++);
            const request: PendingRequest = {
                complete: (error, result): void => {
                    if (error !== null && error !== undefined) { reject(error); }
                    else { resolve(result); }
                },
            };
            if (TIMED_DISPLAY_COMMANDS.has(method)) {
                request.timer = setTimeout((): void => {
                    this.completeRequest(id, new Error(`${method} timed out after 10000ms; save outcome may be unknown`));
                }, 10000);
            }
            this.callbacks.set(id, request);
            try {
                if (method !== 'UpdateMouseCursor') { this.logFn(`Sending: ${method}`, 'info'); }
                send(socket, id);
            } catch (error: unknown) {
                this.completeRequest(id, error);
            }
        });
    }

    /** ブロードキャストハンドラを登録（TileImageUploader 等から利用） */
    registerBroadcastHandler(method: string, handler: (params: any) => void): void {
        this.broadcastHandlers.set(method, handler);
    }

    getRegisteredBroadcastHandler(method: string): ((params: any) => void) | undefined {
        return this.broadcastHandlers.get(method);
    }
}
