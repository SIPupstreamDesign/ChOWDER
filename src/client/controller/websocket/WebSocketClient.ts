import { parseMetaBinary, createMetaBinary } from '../../metaBinaryClient';
import type { JSONRPCMessage } from '../types';

export type LogFn = (msg: string, type?: 'info' | 'error' | 'success') => void;
export type SendCommandFn = (method: string, params?: any) => Promise<any>;
export type SendBinaryCommandFn = (method: string, params: any, binary: ArrayBuffer) => Promise<any>;

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private _isConnected = false;
    private reconnectEnabled = true;
    private messageId = 1;
    private callbacks = new Map<string, (error: any, result?: any) => void>();
    private broadcastHandlers = new Map<string, (params: any) => void>();

    constructor(
        private readonly onBroadcast: (message: JSONRPCMessage) => void,
        private readonly onConnected: () => void,
        private readonly onDisconnected: () => void,
        private readonly logFn: LogFn,
    ) {}

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

            if(message.method === 'UpdateMouseCursor') {

            }else{
                this.logFn(`📨 Received: ${message.method || 'response'}`, 'info');
            }
            
            if (message.id && this.callbacks.has(message.id)) {
                const callback = this.callbacks.get(message.id)!;
                this.callbacks.delete(message.id);

                if (message.error) {
                    this.logFn(`Error: ${JSON.stringify(message.error)}`, 'error');
                    callback(message.error, null);
                } else {
                    callback(null, binary ? { ...message.result, binary } : message.result);
                }
            } else if (message.method) {
                this.onBroadcast(message);
            }
        } catch (error) {
            this.logFn(`Failed to parse message: ${error}`, 'error');
        }
    }

    sendCommand(method: string, params: any = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this._isConnected || !this.ws) {
                reject(new Error('Not connected'));
                return;
            }

            const id = String(this.messageId++);
            const message: JSONRPCMessage = { jsonrpc: '2.0', id, method, params };

            this.callbacks.set(id, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });

            if(method === 'UpdateMouseCursor') {
            }else {
                this.logFn(`📤 Sending: ${method}`, 'info');
            }
            this.ws!.send(JSON.stringify(message));
        });
    }

    sendBinaryCommand(method: string, params: any, binary: ArrayBuffer): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this._isConnected || !this.ws) {
                reject(new Error('Not connected'));
                return;
            }

            const id = String(this.messageId++);
            const message: JSONRPCMessage = { jsonrpc: '2.0', id, method, params };

            this.callbacks.set(id, (error, result) => {
                if (error) reject(error);
                else resolve(result);
                this.callbacks.delete(id);
            });

            const metaBinary = createMetaBinary(message, binary);
            this.ws!.send(metaBinary);
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
