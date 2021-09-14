/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

'use strict';

// chowder_itowns_injectionで1jsにeventemitterもまとめたいので、このファイルでは直接importする
import EventEmitter from '../../../3rd/js/eventemitter3/index.js'
import ITownsCommand from './itowns_command.js';
import TileViewerCommand from './tileviewer_command.js';

let messageID = 1;

class IFrameConnector extends EventEmitter {
    constructor(iframe_ = null) {
        super();
        this.iframe = iframe_;
        this.contentWindow = this.iframe ? this.iframe.contentWindow : null;
        this.resultCallbacks = {};

        this.messageCallback = (evt) => {
            try {
                let data = JSON.parse(evt.data);

                this.eventTextMessage(data);
            } catch (e) {
                console.error(e, evt);
            }
        };
    }

    /**
     * テキストメッセージの処理.
     * @method eventTextMessage
     * @param {JSON} metaData メタデータ
     */
    eventTextMessage(metaData) {
        if (this.iframe && metaData.to === "parent") {
            // parentで、iframeからメッセージがきたものを受け取る
            if (metaData.hasOwnProperty("error")) {
                // エラー返信メッセージ
                if (this.resultCallbacks[metaData.id]) {
                    this.resultCallbacks[metaData.id](metaData.error, null);
                    if (this.resultCallbacks.hasOwnProperty(metaData.id)) {
                        delete this.resultCallbacks[metaData.id];
                    }
                }
            } else if (metaData.hasOwnProperty('id') && metaData.hasOwnProperty('result')) {
                // 返信メッセージ
                if (this.resultCallbacks[metaData.id]) {
                    this.resultCallbacks[metaData.id](null, metaData.result);
                    if (this.resultCallbacks.hasOwnProperty(metaData.id)) {
                        delete this.resultCallbacks[metaData.id];
                    }
                }
            } else {
                if (metaData.hasOwnProperty('id') && metaData.hasOwnProperty('params')) {
                    // 通常メッセージ
                    this.emit(metaData.method, null, metaData.params, metaData);
                } else {
                    // エラー
                    console.error('[Error] ArgumentError in iframe_connector.js', metaData);
                    if (metaData.hasOwnProperty('id')) {
                        this.resultCallbacks[metaData.id]('ArgumentError', null);
                        if (this.resultCallbacks.hasOwnProperty(metaData.id)) {
                            delete this.resultCallbacks[metaData.id];
                        }
                    }
                }
            }
        } else if (!this.iframe && metaData.to === "iframe") {
            // iframeで、parentからメッセージがきたものを受け取る
            if (metaData.hasOwnProperty("error")) {
                // エラー返信メッセージ
                if (this.resultCallbacks[metaData.id]) {
                    this.resultCallbacks[metaData.id](metaData.error, null);
                    if (this.resultCallbacks.hasOwnProperty(metaData.id)) {
                        delete this.resultCallbacks[metaData.id];
                    }
                }
            } else if (metaData.hasOwnProperty('id') && metaData.hasOwnProperty('result')) {
                // 返信メッセージ
                if (this.resultCallbacks[metaData.id]) {
                    this.resultCallbacks[metaData.id](null, metaData.result);
                    if (this.resultCallbacks.hasOwnProperty(metaData.id)) {
                        delete this.resultCallbacks[metaData.id];
                    }
                } else {
                    console.error("[Error] not found :", metaData)
                }
            } else {
                if (metaData.hasOwnProperty('id') && metaData.hasOwnProperty('params')) {
                    // 通常メッセージ
                    this.emit(metaData.method, null, metaData.params, metaData);
                } else {
                    // エラー
                    console.error('[Error] ArgumentError in iframe_connector.js', metaData);
                    if (metaData.hasOwnProperty('id')) {
                        this.resultCallbacks[metaData.id]('ArgumentError', null);
                        if (this.resultCallbacks.hasOwnProperty(metaData.id)) {
                            delete this.resultCallbacks[metaData.id];
                        }
                    }
                }
            }
        } else {
            // エラー
            console.error('[Error] ArgumentError in iframe_connector.js', metaData);
            if (metaData.hasOwnProperty('id')) {
                this.resultCallbacks[metaData.id]('ArgumentError', null);
                if (this.resultCallbacks.hasOwnProperty(metaData.id)) {
                    delete this.resultCallbacks[metaData.id];
                }
            }
        }
    }

    sendWrapper(id, method, reqdata, resultCallback) {
        if (ITownsCommand.hasOwnProperty(method)) {
            if (resultCallback) {
                this.resultCallbacks[id] = resultCallback;
            }

            if (this.contentWindow) {
                this.contentWindow.postMessage(reqdata, location.href);
            } else {
                window.parent.postMessage(reqdata, location.href);
            }
        } else if (TileViewerCommand.hasOwnProperty(method)) {
            if (resultCallback) {
                this.resultCallbacks[id] = resultCallback;
            }

            if (this.contentWindow) {
                this.contentWindow.postMessage(reqdata, location.href);
            } else {
                window.parent.postMessage(reqdata, location.href);
            }
        } else {
            console.error('[Error] Not found the method: ', method);
        }
    }

    /**
     * テキストメッセージを送信する
     * @method send
     * @param {String} method メソッド JSONRPCメソッド
     * @param {JSON} args パラメータ
     * @param {Function} resultCallback 返信があった場合に呼ばれる. resultCallback(err, res)の形式.
     */
    send(method, args, resultCallback = null) {
        let reqjson = {
                jsonrpc: '2.0',
                type: 'utf8',
                id: messageID,
                method: method,
                params: args,
            },
            data;

        if (this.iframe) {
            reqjson.to = "iframe";
        } else {
            reqjson.to = "parent";
        }

        messageID = messageID + 1;
        try {
            data = JSON.stringify(reqjson);
            this.sendWrapper(reqjson.id, reqjson.method, data, resultCallback);
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * メッセージの返信を行う.
     * @param {*} request 
     * @param {*} args 
     */
    sendResponse(request, args = {}) {
        let resjson = {
            jsonrpc: "2.0",
            id: request.id,
            method: request.method,
            result: args
        };

        if (this.iframe) {
            resjson.to = "iframe";
        } else {
            resjson.to = "parent";
        }

        try {
            let data = JSON.stringify(resjson);
            if (this.contentWindow) {
                this.contentWindow.postMessage(data, location.href);
            } else {
                window.parent.postMessage(data, location.href);
            }
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * parent<=>iframe間で接続する.
     * @method connect
     * @param {Function} onopen 開始時コールバック
     * @param {Function} onclose クローズ時コールバック
     */
    connect(onopen, onclose) {
        // iframe内のchowder injectionの初期化
        if (this.iframe) {
            window.removeEventListener("message", this.messageCallback);
            window.addEventListener("message", this.messageCallback);

            // 親ページからiframeへの接続
            this.send(ITownsCommand.Init, {}, onopen());
        } else {
            window.removeEventListener("message", this.messageCallback);
            window.addEventListener("message", this.messageCallback);

            // iframeから親への接続
            onopen();
        }
    }
}

export default IFrameConnector;