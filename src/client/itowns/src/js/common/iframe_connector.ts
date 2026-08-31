/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import { ITownsCommand } from './itowns_command';

type MessageHandler = (err: unknown, params: unknown, request: Record<string, unknown>) => void;
type ResultCallback = (err: unknown, result?: unknown) => void;

interface JsonRpcMessage {
    jsonrpc: string;
    id: number;
    method: string;
    to: string;
    params?: unknown;
    result?: unknown;
    error?: unknown;
}

const IDOffset = 100000;
let ConnectorCounter = 0;

export class IFrameConnector {
    private iframe: HTMLIFrameElement | null;
    private contentWindow: Window | null;
    private resultCallbacks: Record<number, ResultCallback>;
    private handlers: Map<string, MessageHandler>;
    private messageID: number;
    private messageCallback: (evt: MessageEvent) => void;

    constructor(iframe: HTMLIFrameElement | null = null) {
        this.iframe = iframe;
        this.contentWindow = this.iframe ? this.iframe.contentWindow : null;
        this.resultCallbacks = {};
        this.handlers = new Map();
        this.messageID = 1 + IDOffset * ConnectorCounter++;

        this.messageCallback = (evt: MessageEvent) => {
            try {
                const data = JSON.parse(evt.data) as JsonRpcMessage;
                this.eventTextMessage(data);
            } catch (e) {
                console.error(e, evt);
            }
        };
    }

    on(method: string, handler: MessageHandler): void {
        this.handlers.set(method, handler);
    }

    private handleResultCallback(metaData: JsonRpcMessage, err: unknown, result?: unknown): void {
        const cb = this.resultCallbacks[metaData.id];
        if (cb) {
            cb(err, result ?? null);
            delete this.resultCallbacks[metaData.id];
        }
    }

    private handleIncoming(metaData: JsonRpcMessage): void {
        if ('error' in metaData && metaData.error) {
            this.handleResultCallback(metaData, metaData.error, null);
        } else if ('result' in metaData) {
            this.handleResultCallback(metaData, null, metaData.result);
        } else if ('params' in metaData) {
            const handler = this.handlers.get(metaData.method);
            if (handler) {
                handler(null, metaData.params, metaData as unknown as Record<string, unknown>);
            }
        } else {
            console.error('[Error] ArgumentError in iframe_connector.ts', metaData);
            if ('id' in metaData) {
                this.handleResultCallback(metaData, 'ArgumentError', null);
            }
        }
    }

    private eventTextMessage(metaData: JsonRpcMessage): void {
        if (this.iframe && metaData.to === 'parent') {
            this.handleIncoming(metaData);
        } else if (!this.iframe && metaData.to === 'iframe') {
            this.handleIncoming(metaData);
        } else {
            console.error('[Error] ArgumentError in iframe_connector.ts', metaData);
            if ('id' in metaData) {
                this.handleResultCallback(metaData, 'ArgumentError', null);
            }
        }
    }

    private sendWrapper(id: number, method: string, reqdata: string, resultCallback: ResultCallback | null): void {
        const isKnown =
            Object.values(ITownsCommand).includes(method as any);
        if (!isKnown) {
            console.error('[Error] Not found the method: ', method);
            return;
        }
        if (resultCallback) {
            this.resultCallbacks[id] = resultCallback;
        }
        if (this.contentWindow) {
            this.contentWindow.postMessage(reqdata, location.href);
        } else {
            window.parent.postMessage(reqdata, location.href);
        }
    }

    send(method: string, args: unknown, resultCallback: ResultCallback | null = null): void {
        const reqjson: JsonRpcMessage = {
            jsonrpc: '2.0',
            id: this.messageID,
            method,
            params: args,
            to: this.iframe ? 'iframe' : 'parent',
        };
        this.messageID += 1;
        try {
            const data = JSON.stringify(reqjson);
            this.sendWrapper(reqjson.id, reqjson.method, data, resultCallback);
        } catch (e) {
            console.error(e);
        }
    }

    sendResponse(request: Record<string, unknown>, args: unknown = {}): void {
        const resjson = {
            jsonrpc: '2.0',
            id: request['id'],
            method: request['method'],
            result: args,
            to: this.iframe ? 'iframe' : 'parent',
        };
        try {
            const data = JSON.stringify(resjson);
            if (this.contentWindow) {
                this.contentWindow.postMessage(data, location.href);
            } else {
                window.parent.postMessage(data, location.href);
            }
        } catch (e) {
            console.error(e);
        }
    }

    connect(onopen: () => void, _onclose?: () => void): void {
        if (this.iframe) {
            window.removeEventListener('message', this.messageCallback);
            window.addEventListener('message', this.messageCallback);
            this.send('Init', {}, () => {});
            onopen();
        } else {
            window.removeEventListener('message', this.messageCallback);
            window.addEventListener('message', this.messageCallback);
            onopen();
        }
    }
}
