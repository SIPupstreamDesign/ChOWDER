/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

(() => {
    "use strict";
    const ws_connector = require('./../ws_connector.js');
    const Command = require('./../command.js');
    const PerformanceLogger = require('./PerformanceLogger');

    class WebsocketInterface { // クライアントとやり取りするAPI部分
        constructor(commandOperator) {
            this.commandOperator = commandOperator;
        }

        log(method, resultCallback, socketid) {
            if (PerformanceLogger.isEnableMeasureTime()) {
                let orgCallback = resultCallback;
                let swapCallback = (err, res, binary) => {
                    PerformanceLogger.writeResponseLog(method, res, socketid);
                    return orgCallback(err, res, binary);
                };
                return swapCallback;
            }
            return resultCallback;
        }

        /**
         * websocketイベントの登録を行う.
         * register websockets events
         * @method registerWSEvent
         * @param {String} socketid ソケットID
         * @param {BLOB} ws_connection WebSocketコネクション
         * @param {BLOB} ws WebSocketオブジェクト
         */
        registerWSEvent(ws_connection, ws, ws_connections) {
            let methods = {};

            console.log("registerWSEvent");

            // 拒否設定のDisplayにbroadcastしないようにさせるために, broadcastを上書き.
            for (let i = 0; i < ws.length; ++i) {
                ws[i].broadcastUTF = (utfData) => {
                    const blockedDisplayCache = this.commandOperator.executer.blockedDisplayCache;
                    ws[i].connections.forEach((connection) => {
                        // 拒否設定のDisplayにbroadcastしない
                        if (blockedDisplayCache.hasOwnProperty(connection.id)) {
                            return;
                        }
                        connection.sendUTF(utfData);
                    });
                }
                ws[i].broadcastBytes = (binaryData) => {
                    const blockedDisplayCache = this.commandOperator.executer.blockedDisplayCache;
                    ws[i].connections.forEach((connection) => {
                        // 拒否設定のDisplayにbroadcastしない
                        if (blockedDisplayCache.hasOwnProperty(connection.id)) {
                            return;
                        }
                        connection.sendBytes(binaryData);
                    });
                }
            }

            ws_connector.on(Command.AddMetaData, (data, resultCallback) => {
                this.commandOperator.addMetaData(data, resultCallback);
            });

            ws_connector.on(Command.GetMetaData, (data, resultCallback, socketid) => {
                this.commandOperator.getMetaData(socketid, data, resultCallback);
            });

            ws_connector.on(Command.GetContent, (data, resultCallback, socketid) => {
                this.commandOperator.getContent(socketid, data, this.log(Command.GetContent, resultCallback, socketid));
            });

            ws_connector.on(Command.GetTileContent, (data, resultCallback, socketid) => {
                this.commandOperator.getTileContent(socketid, data, this.log(Command.GetTileContent, resultCallback, socketid));
            });

            ws_connector.on(Command.UpdateMetaData, (data, resultCallback, socketid) => {
                this.commandOperator.updateMetaData(socketid, data, this.post_updateMetaData(ws, resultCallback));
            });

            ws_connector.on(Command.AddWindowMetaData, (data, resultCallback, socketid) => {
                this.commandOperator.addWindowMetaData(socketid, data, this.post_updateWindowMetaData(ws, resultCallback), this.post_updateDisplayPermission(ws, null));
            });

            ws_connector.on(Command.GetWindowMetaData, (data, resultCallback, socketid) => {
                this.commandOperator.getWindowMetaData(socketid, data, resultCallback);
            });

            ws_connector.on(Command.UpdateWindowMetaData, (data, resultCallback, socketid) => {
                this.commandOperator.updateWindowMetaData(socketid, data, this.post_updateWindowMetaData(ws, resultCallback));
            });

            ws_connector.on(Command.DeleteWindowMetaData, (data, resultCallback, socketid) => {
                this.commandOperator.deleteWindowMetaData(socketid, data, this.post_deleteWindow(ws, ws_connections, resultCallback));
            });

            ws_connector.on(Command.UpdateMouseCursor, (data, resultCallback, socketid) => {
                this.commandOperator.updateMouseCursor(socketid, data, this.post_updateMouseCursor(ws, resultCallback));
            });

            ws_connector.on(Command.UpdateVirtualDisplay, (data, resultCallback, socketid) => {
                this.commandOperator.updateVirtualDisplay(socketid, data, this.post_updateVirtualDisplay(ws, resultCallback));
            });

            ws_connector.on(Command.GetVirtualDisplay, (data, resultCallback, socketid) => {
                this.commandOperator.getVirtualDisplay(socketid, data, resultCallback);
            });

            ws_connector.on(Command.GetGroupList, (data, resultCallback) => {
                this.commandOperator.getGroupList(resultCallback);
            });

            ws_connector.on(Command.AddGroup, (data, resultCallback, socketid) => {
                this.commandOperator.addGroup(socketid, data, this.post_updateGroup(ws, resultCallback));
            });

            ws_connector.on(Command.DeleteGroup, (data, resultCallback, socketid) => {
                this.commandOperator.deleteGroup(socketid, data, this.post_updateGroup(ws, resultCallback));
            });

            ws_connector.on(Command.UpdateGroup, (data, resultCallback, socketid) => {
                this.commandOperator.updateGroup(socketid, data, this.post_updateGroup(ws, resultCallback));
            });

            ws_connector.on(Command.ChangeGroupIndex, (data, resultCallback, socketid) => {
                this.commandOperator.changeGroupIndex(socketid, data, this.post_updateGroup(ws, resultCallback));
            });

            ws_connector.on(Command.ShowWindowID, (data, resultCallback) => {
                ws_connector.broadcast(ws, Command.ShowWindowID, data);
                if (resultCallback) {
                    resultCallback();
                }
            });

            ws_connector.on(Command.ReloadDisplay, (data, resultCallback) => {
                console.log("ReloadDisplay")
                ws_connector.broadcast(ws, Command.ReloadDisplay, data);
                if (resultCallback) {
                    resultCallback();
                }
            });

            ws_connector.on(Command.SendMessage, (data, resultCallback) => {
                console.log('SendMessage');
                ws_connector.broadcast(ws, Command.SendMessage, data);
                if (resultCallback) {
                    resultCallback();
                }
            });

            ws_connector.on(Command.AddContent, (data, resultCallback, socketid) => {
                let metaData = data.metaData,
                    binaryData = data.contentData;
                this.commandOperator.addContent(socketid, metaData, binaryData, this.post_update(ws, resultCallback), this.post_updateContent(ws, resultCallback));
            });

            ws_connector.on(Command.AddTileContent, (data, resultCallback, socketid) => {
                let metaData = data.metaData,
                    binaryData = data.contentData;
                this.commandOperator.addTileContent(socketid, metaData, binaryData, this.post_addTileContent(ws, resultCallback), this.post_updateContent(ws, resultCallback));
            });

            ws_connector.on(Command.AddHistoricalContent, (data, resultCallback, socketid) => {
                let metaData = data.metaData,
                    binaryData = data.contentData;
                this.commandOperator.addHistoricalContent(socketid, metaData, binaryData, this.post_update(ws, resultCallback));
            });

            ws_connector.on(Command.DeleteContent, (data, resultCallback, socketid) => {
                this.commandOperator.deleteContent(socketid, data, this.post_deleteContent(ws, resultCallback));
            });

            ws_connector.on(Command.UpdateContent, (data, resultCallback, socketid) => {
                let metaData = data.metaData,
                    binaryData = data.contentData;
                this.commandOperator.updateContent(socketid, metaData, binaryData, this.post_updateContent(ws, resultCallback));
            });

            ws_connector.on(Command.NewDB, (data, resultCallback, socketid) => {
                this.commandOperator.newDB(socketid, data, this.post_db_change(ws, resultCallback));
            });
            ws_connector.on(Command.RenameDB, (data, resultCallback, socketid) => {
                this.commandOperator.renameDB(socketid, data, this.post_updateSetting(ws, resultCallback));
            });
            ws_connector.on(Command.ChangeDB, (data, resultCallback, socketid) => {
                this.commandOperator.changeDB(socketid, data, this.post_db_change(ws, resultCallback));
            });
            ws_connector.on(Command.DeleteDB, (data, resultCallback, socketid) => {
                this.commandOperator.deleteDB(socketid, data, this.post_db_change(ws, resultCallback));
            });
            ws_connector.on(Command.InitDB, (data, resultCallback, socketid) => {
                this.commandOperator.initDB(socketid, data, this.post_db_change(ws, resultCallback));
            });
            ws_connector.on(Command.GetDBList, (data, resultCallback, socketid) => {
                this.commandOperator.getDBList(socketid, resultCallback);
            });

            ws_connector.on(Command.Logout, (data, resultCallback, socketid) => {
                this.commandOperator.logout(data, socketid, resultCallback);
            });
            ws_connector.on(Command.Login, (data, resultCallback, socketid) => {
                this.commandOperator.login(data, socketid, resultCallback, this.post_askDisplayPermission(ws));
            });

            ws_connector.on(Command.GetDisplayPermissionList, (data, resultCallback, socketid) => {
                this.commandOperator.getDisplayPermissionList(resultCallback);
            });

            ws_connector.on(Command.UpdateDisplayPermissionList, (data, resultCallback, socketid) => {
                this.commandOperator.updateDisplayPermissionList(data, this.post_updateDisplayPermission(ws, resultCallback));
            });

            ws_connector.on(Command.DeleteDisplayPermission, (data, resultCallback, socketid) => {
                this.commandOperator.deleteDisplayPermissionList(data, resultCallback);
            });

            ws_connector.on(Command.ChangePassword, (data, resultCallback, socketid) => {
                this.commandOperator.changePassword(socketid, data, resultCallback);
            });
            ws_connector.on(Command.ChangeAuthority, (data, resultCallback, socketid) => {
                this.commandOperator.changeAuthority(socketid, data, this.post_updateAuthority(ws, resultCallback));
            });
            ws_connector.on(Command.GetUserList, (data, resultCallback) => {
                this.commandOperator.getUserList(resultCallback);
            });
            ws_connector.on(Command.GenerateControllerID, (data, resultCallback) => {
                this.commandOperator.generateControllerID(resultCallback);
            });
            ws_connector.on(Command.UpdateControllerData, (data, resultCallback, socketid) => {
                this.commandOperator.updateControllerData(socketid, data, resultCallback);
            });
            ws_connector.on(Command.GetControllerData, (data, resultCallback, socketid) => {
                this.commandOperator.getControllerData(socketid, data, resultCallback);
            });
            ws_connector.on(Command.ChangeGlobalSetting, (data, resultCallback, socketid) => {
                this.commandOperator.changeGlobalSetting(socketid, data, this.post_updateSetting(ws, resultCallback));
            });
            ws_connector.on(Command.GetGlobalSetting, (data, resultCallback) => {
                this.commandOperator.getGlobalSetting(data, resultCallback);
            });
            ws_connector.on(Command.RTCOffer, (data, resultCallback) => {
                ws_connector.broadcast(ws, Command.RTCOffer, data);
                if (resultCallback) {
                    resultCallback();
                }
            });
            ws_connector.on(Command.RTCRequest, (data, resultCallback) => {
                ws_connector.broadcast(ws, Command.RTCRequest, data);
                if (resultCallback) {
                    resultCallback();
                }
            });
            ws_connector.on(Command.RTCAnswer, (data, resultCallback) => {
                ws_connector.broadcast(ws, Command.RTCAnswer, data);
                if (resultCallback) {
                    resultCallback();
                }
            });
            ws_connector.on(Command.RTCIceCandidate, (data, resultCallback) => {
                ws_connector.broadcast(ws, Command.RTCIceCandidate, data);
                if (resultCallback) {
                    resultCallback();
                }
            });
            ws_connector.on(Command.RTCClose, (data, resultCallback) => {
                ws_connector.broadcast(ws, Command.RTCClose, data);
                if (resultCallback) {
                    resultCallback();
                }
            });

            ws_connector.on(Command.Upload, (data, resultCallback) => {
                console.log("[WebsocketInterface]upload")
                let metaData = data.metaData,
                    binaryData = data.contentData;
                this.commandOperator.upload(metaData, binaryData, resultCallback);
            });

            ws_connector.registerEvent(ws, ws_connection);


            console.log("registerWSEvent End");
        }

        /**
         * update処理実行後のブロードキャスト用ラッパー.
         * @method post_update
         */
        post_update(ws, resultCallback) {
            return (err, reply) => {
                ws_connector.broadcast(ws, Command.Update, reply);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * tile登録アプリからタイルが登録された時の終了コールバック.
         * addTileContent1回につき1回呼ばれる
         * @param {*} ws
         * @param {*} resultCallback
         */
        post_addTileContent(ws, resultCallback) {
            return (err, reply) => {
                // broadcastしない.
                // ws_connector.broadcast(ws, Command.Update);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * updateMetaData処理実行後のブロードキャスト用ラッパー.
         * @method post_updateMetaData
         */
        post_updateMetaData(ws, resultCallback) {
            return (err, reply) => {
                ws_connector.broadcast(ws, Command.UpdateMetaData, reply);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * updateGroup処理実行後のブロードキャスト用ラッパー.
         * @method post_updateGroup
         */
        post_updateGroup(ws, resultCallback) {
            return (err, reply) => {
                ws_connector.broadcast(ws, Command.UpdateGroup, reply);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * updateContent処理実行後のブロードキャスト用ラッパー.
         * @method post_updateContent
         */
        post_updateContent(ws, resultCallback) {
            return (err, reply) => {
                ws_connector.broadcast(ws, Command.UpdateContent, reply);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * updateDB処理実行後のブロードキャスト用ラッパー.
         * @method post_updateDB
         */
        post_updateDB(ws, resultCallback) {
            return (err, reply) => {
                ws_connector.broadcast(ws, Command.UpdateContent, reply);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * deletecontent処理実行後のブロードキャスト用ラッパー.
         * @method post_deleteContent
         */
        post_deleteContent(ws, resultCallback) {
            return (err, reply) => {
                ws_connector.broadcast(ws, Command.DeleteContent, reply);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * deleteWindow処理実行後のブロードキャスト用ラッパー.
         * @method post_deleteWindow
         */
        post_deleteWindow(ws, ws_connections, resultCallback) {
            return (err, reply) => {
                let socketid,
                    id,
                    i;
                ws_connector.broadcast(ws, Command.DeleteWindowMetaData, reply);

                for (socketid in this.commandOperator.executer.socketidToHash) {
                    if (this.commandOperator.executer.socketidToHash.hasOwnProperty(socketid)) {
                        id = this.commandOperator.executer.socketidToHash[socketid];
                        for (i = 0; i < reply.length; i = i + 1) {
                            if (reply[i].id === id) {
                                if (ws_connections.hasOwnProperty(socketid)) {
                                    ws_connector.send(ws_connections[socketid], Command.Disconnect);
                                }
                            }
                        }
                        delete this.commandOperator.executer.socketidToHash[socketid];
                    }
                }
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * updateWindowMetaData処理実行後のブロードキャスト用ラッパー.
         * @method post_updateWindowMetaData
         */
        post_updateWindowMetaData(ws, resultCallback) {
            return (err, reply) => {
                ws_connector.broadcast(ws, Command.UpdateWindowMetaData, reply);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        };

        /**
         * updateVirtualDisplay処理実行後のブロードキャスト用ラッパー.
         * @method post_updateVirtualDisplay
         */
        post_updateVirtualDisplay(ws, resultCallback) {
            return (err, reply) => {
                ws_connector.broadcast(ws, Command.UpdateVirtualDisplay, reply);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * updateMouseCursor処理実行後のブロードキャスト用ラッパー.
         * @method post_updateMouseCursor
         */
        post_updateMouseCursor(ws, resultCallback) {
            return (err, reply) => {
                ws_connector.broadcast(ws, Command.UpdateMouseCursor, reply);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * 設定変更処理終了後のブロードキャスト用ラッパー.
         * カレントDBが変更された場合も設定変更であるので通知される.
         * @method post_updateSetting
         */
        post_updateSetting(ws, resultCallback) {
            return (err, reply) => {
                ws_connector.broadcast(ws, Command.UpdateSetting, reply);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * DBが変更されたことを通知する
         * @method post_db_change
         */
        post_db_change(ws, resultCallback) {
            return (err, reply) => {
                ws_connector.broadcast(ws, Command.ChangeDB, reply);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * 権限が変更されたことを通知する
         * @method post_updateAuthority
         */
        post_updateAuthority(ws, resultCallback) {
            return (err, reply) => {
                ws_connector.broadcast(ws, Command.ChangeAuthority, reply);
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            };
        }

        /**
         * 知らないDisplayIDがログインを試みたときに、許可設定を聞く
         * @method post_askDisplayPermission
         */
        post_askDisplayPermission(ws) {
            return (err, data) => {
                ws_connector.broadcast(ws, Command.AskDisplayPermission, data);
            }
        }

        post_updateDisplayPermission(ws, resultCallback) {
            return (err, reply) => {
                // 拒否設定されたDisplayにはbraodcastできないようにしているので、個別で、変更されたDisplayのみに送る
                // ws_connector.broadcast(ws, Command.UpdateDisplayPermissionList, reply);
                const allDisplayCache = this.commandOperator.executer.allDisplayCache;
                let targetSocketIDList = [];
                for (let i = 0; i < reply.length; ++i) {
                    const id = reply[i];
                    for (let cacheSocketID in allDisplayCache) {
                        const cacheDisplayID = allDisplayCache[cacheSocketID]
                        if (cacheDisplayID === id) {
                            targetSocketIDList.push(cacheSocketID);
                        }
                    }
                }
                // 全コントローラにも送る
                for (let i = 0; i < ws.length; ++i) {
                    ws[i].connections.forEach((connection) => {
                        if (!allDisplayCache.hasOwnProperty(connection.id)) {
                            targetSocketIDList.push(connection.id);
                        }
                    });
                }
                ws_connector.broadcastToTargets(targetSocketIDList, ws, Command.UpdateDisplayPermissionList, {});
                if (resultCallback) {
                    resultCallback(err, reply);
                }
            }
        }

    }

    module.exports = WebsocketInterface;
})();
