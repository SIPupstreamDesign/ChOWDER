/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import { WebSocket, RawData } from 'ws';
import { Command, CommandType } from './command';
import { loadMetaBinary, createMetaBinary, createMetaBinaryMulti } from './metaBinaryNode';
import { generateUUID8 } from './wsUtils';
import { SendQueue } from './sendQueue';

/**
 * 拡張WebSocket接続（ID付き）
 */
export interface ExtendedWebSocket extends WebSocket {
    id: string;
    isAlive: boolean;
    /** 2レーン送信キュー（priority / normal） */
    sendQueued(data: string | Buffer, priority?: boolean): void;
    _sendQueue?: SendQueue;
}

/**
 * JSON-RPCメッセージ
 */
interface JSONRPCMessage {
    jsonrpc: string;
    id?: string;
    method: string;
    params?: any;
    result?: any;
    error?: any;
    to?: string;
}

/**
 * 結果コールバック
 */
type ResultCallback = (err: any, res?: any, binary?: Buffer) => void;

/**
 * レシーバーコールバック
 */
type ReceiverCallback = (data: any, resultCallback: ResultCallback, socketId: string) => void;

/**
 * WebSocketコネクター
 */
export class WSConnector {
    private resultCallbacks: Map<string, ResultCallback> = new Map();
    private receivers: Map<string, ReceiverCallback> = new Map();
    private messageID: number = 1;

    /**
     * レスポンスを送信
     */
    private sendResponse(
        ws: ExtendedWebSocket,
        injson: JSONRPCMessage
    ): ResultCallback {
        return (err: any, res?: any, binary?: Buffer) => {
            let result: JSONRPCMessage;

            if (binary !== undefined && binary !== null) {
                if (Array.isArray(res)) {
                    // 複数のメタデータ+バイナリ
                    result = {
                        jsonrpc: '2.0',
                        id: injson.id,
                        method: injson.method,
                        result: res[0],
                    };
                    const metabin = createMetaBinaryMulti(result, res, [binary]);
                    if (metabin === null || metabin === undefined) {
                        result.error = 'Failed to create Metabinary';
                        console.error('Failed to create Metabinary');
                        ws.sendQueued(JSON.stringify(result), true);
                    } else {
                        ws.sendQueued(metabin, true);
                    }
                } else {
                    result = {
                        jsonrpc: '2.0',
                        id: injson.id,
                        method: injson.method,
                        result: res,
                    };
                    const metabin = createMetaBinary(result, binary);
                    if (metabin === null || metabin === undefined) {
                        result.error = 'Failed to create Metabinary';
                        console.error('Failed to create Metabinary');
                        ws.sendQueued(JSON.stringify(result), true);
                    } else {
                        ws.sendQueued(metabin, true);
                    }
                }
            } else {
                result = {
                    jsonrpc: '2.0',
                    id: injson.id,
                    method: injson.method,
                };
                if (err) {
                    result.error = err;
                }
                result.result = res;
                ws.sendQueued(JSON.stringify(result), true);
            }
        };
    }

    /**
     * テキストメッセージの処理
     */
    private eventTextMessage(ws: ExtendedWebSocket, metaData: JSONRPCMessage): void {
        console.log('[wsConnector] eventTextMessage:', JSON.stringify(metaData));
        if (metaData.to === 'client') {
            // masterからclientに送ったメッセージが返ってきた
            if (metaData.error) {
                const callback = this.resultCallbacks.get(metaData.id!);
                if (callback) {
                    callback(metaData.error, null);
                }
            } else if (metaData.hasOwnProperty('id') && metaData.hasOwnProperty('result')) {
                const callback = this.resultCallbacks.get(metaData.id!);
                if (callback) {
                    callback(null, metaData.result);
                }
            } else {
                console.error('[Error] ArgumentError in wsConnector');
                if (metaData.hasOwnProperty('id')) {
                    const callback = this.resultCallbacks.get(metaData.id!);
                    if (callback) {
                        callback('ArgumentError', null);
                    }
                }
            }
        } else {
            // clientからmasterにメッセージが来た
            const receiver = this.receivers.get(metaData.method);
            if (receiver) {
                receiver(metaData.params, this.sendResponse(ws, metaData), ws.id);
            } else {
                console.error(`[wsConnector] No receiver found for method: ${metaData.method}`);
                const errorResponse = this.sendResponse(ws, metaData);
                errorResponse(`Method not found: ${metaData.method}`, null);
            }
        }
    }

    /**
     * バイナリメッセージの処理
     */
    private eventBinaryMessage(
        ws: ExtendedWebSocket,
        metaData: JSONRPCMessage,
        contentData: Buffer | string
    ): void {
        const data = {
            metaData: metaData.params,
            contentData: contentData,
        };

        if (metaData.to === 'client') {
            // masterからclientに送ったメッセージが返ってきた
            if (metaData.error) {
                const callback = this.resultCallbacks.get(metaData.id!);
                if (callback) {
                    callback(metaData.error, null);
                }
            } else if (metaData.id && contentData) {
                const callback = this.resultCallbacks.get(metaData.id!);
                if (callback) {
                    callback(null, data);
                }
            } else {
                console.error('[Error] ArgumentError in wsConnector');
                if (metaData.id) {
                    const callback = this.resultCallbacks.get(metaData.id!);
                    if (callback) {
                        callback('ArgumentError', null);
                    }
                }
            }
        } else {
            // clientからmasterにメッセージが来た
            const receiver = this.receivers.get(metaData.method);
            if (receiver) {
                receiver(data, this.sendResponse(ws, metaData), ws.id);
            }
        }
    }

    /**
     * イベントの登録
     */
    registerEvent(ws: ExtendedWebSocket): void {
        // 送信キューを初期化
        const queue = new SendQueue(ws);
        ws._sendQueue = queue;
        ws.sendQueued = (data: string | Buffer, priority: boolean = false) => {
            queue.push(data, priority);
        };

        ws.on('message', (data: RawData) => {
            // Bufferの場合は一旦文字列に変換してみる
            let dataStr: string;
            if (data instanceof Buffer) {
                dataStr = data.toString('utf8');
            } else if (typeof data === 'string') {
                dataStr = data;
            } else {
                console.error('[wsConnector] Unsupported data type');
                return;
            }

            // MetaBinaryかどうかをチェック（ヘッダー文字列で判定）
            if (dataStr.startsWith('MetaBin:')) {
                // バイナリメッセージ
                loadMetaBinary(data as Buffer, (metaData: JSONRPCMessage, contentData: Buffer | string) => {
                    if (!metaData.hasOwnProperty('id')) {
                        metaData.id = generateUUID8();
                    }
                    this.eventBinaryMessage(ws, metaData, contentData);
                });
            } else {
                // テキストメッセージ（JSON）
                try {
                    const parsed: JSONRPCMessage = JSON.parse(dataStr);
                    if (!parsed.hasOwnProperty('id')) {
                        parsed.id = generateUUID8();
                    }
                    this.eventTextMessage(ws, parsed);
                } catch (e) {
                    console.error('failed to parse json:', e);
                }
            }
        });
    }

    /**
     * イベントリスナーの登録
     */
    on(method: string, callback: ReceiverCallback): void {
        this.receivers.set(method, callback);
    }

    /**
     * テキストメッセージをclientへ送信
     */
    send(
        ws: ExtendedWebSocket,
        method: string,
        args: any,
        resultCallback: ResultCallback
    ): void {
        const reqjson: JSONRPCMessage = {
            jsonrpc: '2.0',
            id: String(this.messageID),
            method: method,
            params: args,
            to: 'client',
        };

        this.messageID++;

        try {
            const data = JSON.stringify(reqjson);

            if (Command.hasOwnProperty(method)) {
                this.resultCallbacks.set(reqjson.id!, resultCallback);
                ws.sendQueued(data, true);
            } else {
                console.log('[Error] Not found the method in connector:', data);
            }
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * バイナリメッセージをclientへ送信
     */
    sendBinary(
        ws: ExtendedWebSocket,
        method: string,
        binary: Buffer,
        resultCallback: ResultCallback
    ): void {
        const data = {
            jsonrpc: '2.0',
            id: String(this.messageID),
            method: method,
            params: binary,
            to: 'client',
        };

        this.messageID++;

        try {
            if (Command.hasOwnProperty(method)) {
                this.resultCallbacks.set(data.id, resultCallback);
                ws.sendQueued(data.params, true);
            } else {
                console.log('[Error] Not found the method in connector:', method);
            }
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * ブロードキャスト
     */
    broadcast(
        wss: Set<ExtendedWebSocket>,
        method: string,
        args: any,
        resultCallback?: ResultCallback,
        excludeSocketId?: string
    ): void {
        const reqjson: JSONRPCMessage = {
            jsonrpc: '2.0',
            id: String(this.messageID),
            method: method,
            params: args,
            to: 'client',
        };

        this.messageID++;

        try {
            const data = JSON.stringify(reqjson);

            if (Command.hasOwnProperty(method)) {
                if (resultCallback) {
                    this.resultCallbacks.set(reqjson.id!, resultCallback);
                }
                wss.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN && client.id !== excludeSocketId) {
                        client.sendQueued(data);
                    }
                });
            } else {
                console.log('[Error] Not found the method in connector:', data);
            }
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * 特定のクライアントにブロードキャスト
     */
    broadcastToTargets(
        targetSocketIDList: string[],
        wss: Set<ExtendedWebSocket>,
        method: string,
        args: any,
        resultCallback?: ResultCallback
    ): void {
        const reqjson: JSONRPCMessage = {
            jsonrpc: '2.0',
            id: String(this.messageID),
            method: method,
            params: args,
            to: 'client',
        };

        this.messageID++;

        try {
            const data = JSON.stringify(reqjson);

            if (Command.hasOwnProperty(method)) {
                if (resultCallback) {
                    this.resultCallbacks.set(reqjson.id!, resultCallback);
                }
                const targetSet = new Set(targetSocketIDList);
                wss.forEach((client) => {
                    if (
                        targetSet.has(client.id) &&
                        client.readyState === WebSocket.OPEN
                    ) {
                        client.sendQueued(data);
                    }
                });
            } else {
                console.log('[Error] Not found the method in connector:', data);
            }
        } catch (e) {
            console.error(e);
        }
    }
}
