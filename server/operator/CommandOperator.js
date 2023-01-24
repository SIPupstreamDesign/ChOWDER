/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

(() => {
    "use strict";
    const Executer = require("./Executer.js");
    const Util = require('./../util.js');

    class CommandOperator { // 通信APIと実際に中身をいじる部分の中間層 兼 サーバ内部向け関数提供クラス
        constructor() {
            this.executer = new Executer();

            this.connectionId = {};
            this.connectionCount = 0;
        }

        /**
         * コンテンツの追加を行うコマンドを実行する.
         * @method AddContent
         * @param {Object} metaData メタデータ
         * @param {BLOB} binaryData バイナリデータ
         * @param {Function} endCallback コンテンツ新規追加した場合に終了時に呼ばれるコールバック
         * @param {Function} updateEndCallback コンテンツ差し替えした場合に終了時に呼ばれるコールバック
         */
        addContent(socketid, metaData, binaryData, endCallback, updateEndCallback) {
            //console.log("AddContent", metaData);

            if (this.executer.isEditable(socketid, metaData.group)) {
                if (metaData.hasOwnProperty('id') && metaData.id !== "") {
                    this.executer.textClient.exists(this.executer.metadataPrefix + metaData.id, (err, doesExists) => {
                        if (!err && doesExists === 1) {
                            this.executer.getMetaData(socketid, '', metaData.id, (err, meta) => {
                                if (err) {
                                    endCallback(err);
                                    return;
                                }
                                let oldContentID,
                                    newContentID;
                                if (metaData.hasOwnProperty('content_id')) {
                                    oldContentID = metaData.content_id;
                                }
                                if (meta.hasOwnProperty('content_id')) {
                                    newContentID = meta.content_id;
                                }

                                // 既に存在するコンテンツの上書き
                                if (newContentID !== '' && oldContentID === newContentID) {
                                    this.executer.updateContent(socketid, metaData, binaryData, (reply) => {
                                        if (updateEndCallback) {
                                            updateEndCallback(null, reply);
                                        }
                                    });
                                } else {
                                    this.executer.addContentCore(meta, binaryData, endCallback);
                                }
                            });
                        } else {
                            this.executer.addContentCore(metaData, binaryData, endCallback);
                        }
                    });
                } else {
                    this.executer.addContentCore(metaData, binaryData, endCallback);
                }
            } else {
                if (endCallback) {
                    endCallback("access denied");
                }
            }
        }

        reloadLatestTile(socketid, metaData, endCallback) {
            if (metaData.hasOwnProperty('reload_latest') && String(metaData.reload_latest) === "true") {
                try {
                    if (metaData.hasOwnProperty('keyvalue')) {
                        let keyValue = JSON.parse(metaData.keyvalue);
                        let key = Object.keys(keyValue)[0];
                        // 最新の時系列データ表示
                        let historyData = Util.extractHistoryData(metaData);
                        if (historyData) {
                            let values = Object.values(historyData[key]);
                            if (values.length > 1) {
                                let sorted = Util.sortHistory(values);
                                metaData.restore_key = key;
                                metaData.restore_value = sorted[sorted.length - 1];
                                this.updateMetaData(socketid, [metaData], (err, meta) => {
                                    if (endCallback) {
                                        endCallback(err, meta[0]);
                                    }
                                });
                                return;
                            }
                        }
                    } else {
                        endCallback(e, metaData);
                    }
                } catch(e) {
                    endCallback(e, metaData);
                    return;
                }
            }
            endCallback(null, metaData);
        }

        /**
         * タイルコンテンツの追加を行うコマンドを実行する.
         * @method AddTileContent
         * @param {Object} metaData メタデータ
         * @param {BLOB} binaryData バイナリデータ
         * @param {Function} endCallback 1回のaddTileContent終了時に呼ばれるコールバック
         * @param {Function} finishCallback 全タイル追加終了時に呼ばれるコールバック
         */
        addTileContent(socketid, metaData, binaryData, endCallback, finishCallback) {
            //console.log("AddTileContent", metaData);

            if (this.executer.isEditable(socketid, metaData.group)) {
                if (metaData.hasOwnProperty('id') && metaData.id !== "") {
                    // タイル用のコンテンツが登録されている必要がある
                    this.executer.textClient.exists(this.executer.metadataPrefix + metaData.id, (err, doesExists) => {
                        if (!err && doesExists === 1) {
                            this.executer.getMetaData(socketid, '', metaData.id, (err, meta) => {
                                if (err) {
                                    endCallback(err);
                                    return;
                                }
                                meta.tile_index = metaData.tile_index;
                                meta.history_id = metaData.history_id;
                                let tileCount = -1; // 合計タイル数
                                if (meta.hasOwnProperty("xsplit") && meta.hasOwnProperty("ysplit")) {
                                    tileCount = Number(meta.xsplit) * Number(meta.ysplit);
                                }
                                this.executer.addTileContent(meta, binaryData, tileCount, endCallback, () => {
                                    // タイル画像が全て登録された.
                                    // 最新画像表示を行いつつ終了コールバック
                                    this.reloadLatestTile(socketid, meta, (err, meta) => {
                                        finishCallback(err, meta);
                                    });
                                });
                            });
                        } else {
                            if (endCallback) {
                                endCallback("not found content");
                            }
                        }
                    });
                } else {
                    if (endCallback) {
                        endCallback("not found content");
                    }
                }
            } else {
                if (endCallback) {
                    endCallback("access denied");
                }
            }
        }

        /**
         * historicalコンテンツの追加を行うコマンドを実行する.
         * @param {Object} metaData メタデータ
         * @param {BLOB} binaryData バイナリデータ
         * @param {Function} endCallback コンテンツ新規追加した場合に終了時に呼ばれるコールバック
         */
        addHistoricalContent(socketid, metaData, binaryData, endCallback, updateEndCallback) {
            console.log("AddHistoricalContent", metaData);

            if (this.executer.isEditable(socketid, metaData.group)) {
                // タイル用のコンテンツが登録されている必要がある
                this.executer.textClient.exists(this.executer.metadataPrefix + metaData.id, (err, doesExists) => {
                    if (!err && doesExists === 1) {
                        this.executer.getMetaData(socketid, '', metaData.id, (err, meta) => {
                            if (err) {
                                endCallback(err);
                                return;
                            }
                            this.executer.addHistoricalContent(socketid, metaData, binaryData, endCallback);
                        });
                    } else {
                        this.executer.addHistoricalContent(socketid, metaData, binaryData, endCallback);
                    }
                });
            } else {
                if (endCallback) {
                    endCallback("access denied");
                }
            }
        }

        /**
         * コンテンツの取得を行うコマンドを実行する.
         * @method GetContent
         * @param {JSON} json contentメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        getContent(socketid, json, endCallback) {
            console.log("GetContent:" + json.id);
            if (!this.executer.isViewable(socketid, json.group)) {
                endCallback("access denied");
                return;
            }
            // 取得しようとしているコンテンツのgroupが、
            // socketidに紐づくDisplayが所属するSiteで表示可能か調べる
            // socketidに紐づくものがControllerだった場合は表示可能とする
            this.executer.isViewableSite(socketid, json.group, (err, isViewable) => {
                if (err || !isViewable) {
                    endCallback(err);
                    return;
                }
                this.executer.getMetaData(socketid, json.type, json.id, (err, meta) => {
                    if (err) {
                        endCallback(err);
                        return;
                    }
                    if (meta && meta.hasOwnProperty('content_id') && meta.content_id !== '') {
                        // Historyから復元して取得
                        if (meta.hasOwnProperty('history_id')) {
    
                            // Historyの場合は全タイル登録済かどうかのフラグを返す
                            this.executer.client.hmget(this.executer.contentHistoryDataPrefix + meta.history_id, "tile_finished", (err, tile_finished) => {
                                if (!err && tile_finished[0]) {
                                    meta.tile_finished = String(tile_finished[0]) === "true";
                                }
                                // Historyの場合はpreview画像をバイナリに入れて返す.
                                // サムネイル画像がある場合はリストに入れて返す
                                // その後タイル画像リクエストが複数回client→serverにくる.
                                this.executer.client.hmget(this.executer.contentHistoryDataPrefix + meta.history_id, "thumbnail", (err, thumbnail) => {
                                    let metaList = [];
                                    let binaryList = [];
                                    if (!err && thumbnail[0]) {
                                        metaList.push({
                                            type: "thumbnail"
                                        });
                                        binaryList.push(thumbnail[0]);
                                    }
                                    this.executer.client.hmget(this.executer.contentHistoryDataPrefix + meta.history_id, "preview", (err, preview) => {
                                        if (binaryList.length > 0) {
                                            if (!err && preview[0]) {
                                                metaList.unshift(meta);
                                                binaryList.unshift(preview[0]);
                                            }
                                            endCallback(err, metaList, binaryList);
                                        } else {
                                            endCallback(err, meta, preview[0]);
                                        }
                                    });
                                });
                                return;
                            });
                        }
    
                        // コンテンツの返却.
                        // サムネイルやプレビュー用画像がある場合はリストに入れて返す
                        this.executer.client.hgetall(this.executer.contentThumbnailPrefix + meta.content_id, (err, thumbnailData) => {
                            let metaList = [];
                            let binaryList = [];
                            if (!err && thumbnailData) {
                                if (thumbnailData.hasOwnProperty('thumbnail')) {
                                    metaList.push({
                                        type: "thumbnail"
                                    });
                                    binaryList.push(thumbnailData.thumbnail);
                                }
                                if (thumbnailData.hasOwnProperty('preview')) {
                                    metaList.push({
                                        type: "preview"
                                    });
                                    binaryList.push(thumbnailData.preview);
                                }
                            }
    
                            // 履歴から復元して取得
                            if (json.hasOwnProperty('restore_index') && meta.hasOwnProperty('backup_list')) {
                                let backupList = this.executer.sortBackupList(JSON.parse(meta.backup_list));
                                let restore_index = Number(json.restore_index);
                                if (restore_index >= 0 && backupList.length > restore_index) {
                                    let backup_date = backupList[restore_index];
                                    this.executer.textClient.hmget(this.executer.metadataBackupPrefix + meta.id, backup_date, (err, metaData) => {
                                        this.executer.client.hmget(this.executer.contentBackupPrefix + meta.content_id, backup_date, (err, reply) => {
                                            if (binaryList.length > 0) {
                                                metaList.unshift(JSON.parse(metaData));
                                                binaryList.unshift(reply[0]);
                                                endCallback(err, metaList, binaryList);
                                            } else {
                                                endCallback(err, JSON.parse(metaData), reply[0]);
                                            }
                                        });
                                    })
                                    return;
                                }
                            }
    
                            // 通常の取得
                            this.executer.getContent(meta.type, meta.content_id, (reply) => {
                                if (reply === null) {
                                    reply = "";
                                }
                                if (binaryList.length > 0) {
                                    metaList.unshift(meta);
                                    binaryList.unshift(reply);
                                    endCallback(null, metaList, binaryList);
                                } else {
                                    endCallback(null, meta, reply);
                                }
                            });
                        });
                    }
                });
            });
        }

        /**
         * タイルコンテンツの取得を行うコマンドを実行する.
         * @method GetTileContent
         * @param {JSON} json contentメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        getTileContent(socketid, json, endCallback) {
            //console.log("GetTileContent:" + json.id);
            if (!this.executer.isViewable(socketid, json.group)) {
                endCallback("access denied");
                return;
            }
            this.executer.getMetaData(socketid, "tileimage", json.id, (err, meta) => {
                if (err) {
                    endCallback(err);
                    return;
                }
                if (meta && meta.hasOwnProperty('content_id') && meta.content_id !== ''
                    && json.hasOwnProperty('tile_index') && json.hasOwnProperty("history_id")) {

                    meta.tile_index = json.tile_index;
                    meta.history_id = json.history_id;
                    this.executer.client.hmget(this.executer.contentHistoryDataPrefix + meta.history_id, meta.tile_index, (err, reply) => {
                        if (!err) {
                            if (endCallback) {
                                if (reply[0]) {
                                    endCallback(null, meta, reply[0]);
                                } else {
                                    endCallback("Error : not found tileindex " + meta.tile_index);
                                }
                            }
                        } else {
                            console.error(err);
                        }

                    });
                }
            });
        }

        /**
         * メタデータの追加を行うコマンドを実行する.
         * @method AddMetaData
         * @param {JSON} json contentメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        addMetaData(json, endCallback) {
            console.log("AddMetaData:", json);
            this.executer.addMetaData(json, (metaData) => {
                if (endCallback) {
                    endCallback(null, metaData);
                }
            });
        }

        /**
         * メタデータの取得を行うコマンドを実行する.
         * @method GetMetaData
         * @param {JSON} json contentメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        getMetaData(socketid, json, endCallback) {
            console.log("GetMetaData:" + json.type + "/" + json.id);
            this.executer.getMetaData(socketid, json.type, json.id, (err, metaData) => {
                if (endCallback) {
                    // Historyの場合は全タイル登録済かどうかのフラグを返す
                    if (metaData && metaData.hasOwnProperty('history_id')) {
                        this.executer.client.hmget(this.executer.contentHistoryDataPrefix + metaData.history_id, "tile_finished", (err, tile_finished) => {
                            if (!err && tile_finished[0]) {
                                metaData.tile_finished = String(tile_finished[0]) === "true";
                            }
                            endCallback(err, metaData);
                        });
                    } else {
                        endCallback(err, metaData);
                    }
                }
            });
        }

        /**
         * コンテンツの削除を行うコマンドを実行する.
         * @method DeleteContent
         * @param {JSON} json メタデータリスト
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        deleteContent(socketid, json, endCallback) {
            console.log("DeleteContent:", json.length);
            let i,
                metaData,
                results = [],
                all_done = json.length;
            let syncDelete = (results, all_done) => {
                if (all_done <= 0) {
                    if (endCallback) {
                        endCallback(null, results);
                        return;
                    }
                } else {
                    let metaData = json[all_done - 1];
                    if (this.executer.isEditable(socketid, metaData.group)) {
                        if (metaData && metaData.hasOwnProperty('type') && metaData.type === 'all') {
                            this.executer.textClient.keys(this.executer.metadataPrefix + '*', (err, replies) => {
                                replies.forEach((id, index) => {
                                    console.log(id);
                                    this.executer.textClient.hgetall(id, (err, data) => {
                                        if (!err && data) {
                                            this.executer.deleteContent(data, (meta) => {
                                                if (endCallback) {
                                                    endCallback(null, meta);
                                                }
                                            });
                                        }
                                    });
                                });
                            });
                            all_done = 0;
                            if (endCallback) {
                                endCallback(null, results);
                                return;
                            }
                        } else {
                            this.executer.deleteContent(metaData, (meta) => {
                                results.push(meta);
                                syncDelete(results, all_done - 1);
                            });
                        }
                    } else {
                        syncDelete(results, all_done - 1);
                    }
                }
            };

            syncDelete(results, all_done);
        }

        /**
         * コンテンツの更新を行うコマンドを実行する.
         * @method UpdateContent
         * @param {Object} metaData contentメタデータ
         * @param {BLOB} binaryData loadMetaBinaryから受領したバイナリデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        updateContent(socketid, metaData, binaryData, endCallback) {
            //console.log("UpdateContent");
            if (this.executer.isEditable(socketid, metaData.group)) {
                this.executer.updateContent(socketid, metaData, binaryData, (meta) => {
                    // socket.emit(Command.doneUpdateContent, JSON.stringify({"id" : id}));
                    if (endCallback) {
                        endCallback(null, meta);
                    }
                });
            } else {
                endCallback("access denied");
            }
        }

        /**
         * メタデータの更新を行うコマンドを実行する.
         * @method UpdateMetaData
         * @param {JSON} json windowメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        updateMetaData(socketid, json, endCallback) {
            console.log("UpdateMetaData");
            let i,
                metaData,
                results = [],
                all_done = json.length

            let registerFunc = (metaData, endCallback) => {
                // バックアップ有りの場合は、バックアップメタデータと通常メタデータ両方更新する
                if (metaData.hasOwnProperty('restore_index')) {
                    let restore_index = Number(metaData.restore_index);
                    if (restore_index >= 0) {
                        let backupMetaData = {};
                        backupMetaData[metaData.date] = JSON.stringify(metaData);
                        this.executer.client.hmset(this.executer.metadataBackupPrefix + metaData.id, backupMetaData, (err) => { });
                    }
                }

                this.executer.setMetaData(metaData.type, metaData.id, metaData, (meta) => {
                    this.executer.getMetaData(socketid, meta.type, meta.id, (err, meta) => {
                        --all_done;
                        if (!err) {
                            results.push(meta);
                        }
                        if (all_done <= 0) {
                            endCallback(null, results);
                            return;
                        }
                    });
                });
            };

            let updateByHistoryFunc = (metaData, endCallback) => {
                // historyメタデータを取得し、通常のメタデータに上書きする
                this.executer.textClient.hmget(this.executer.metadataHistoryPrefix + metaData.id + ":" + metaData.restore_key, metaData.restore_value, (err, meta) => {

                    if (!err && meta.length > 0 && meta[0]) {
                        let hmeta = JSON.parse(meta[0]);
                        // 現在のメタデータに対して、切り替えに必要な部分のみ上書きする
                        metaData.keyvalue = hmeta.keyvalue;
                        metaData.history_id = hmeta.history_id;
                        metaData.id = hmeta.id;
                        metaData.content_id = hmeta.content_id;
                        metaData.date = hmeta.date;
                        metaData.mime = hmeta.mime;
                        endCallback(null, metaData);
                    } else {
                        // 見つからなかった場合は通常処理
                        endCallback(null, metaData);
                    }
                });
            }

            let syncFunc = (metaData, endCallback) => {
                // 同じgroupのsync付きのメタデータリストを取得.
                if (metaData.hasOwnProperty('history_sync') && String(metaData.history_sync) === "true") {
                    let group = metaData.group;
                    this.executer.textClient.keys(this.executer.metadataPrefix + '*', (err, replies) => {
                        let all_done = replies.length;
                        if (err || replies.length === 0) {
                            endCallback("Error not found metadata");
                            return;
                        }
                        replies.forEach((id, index) => {
                            this.executer.textClient.hgetall(id, (err, data) => {
                                if (data.type === "tileimage" &&
                                    data.hasOwnProperty('history_sync') && String(data.history_sync) === "true" &&
                                    data.hasOwnProperty('group') && data.group === group) {
                                    // 同期対象メタデータを発見. 同期させる
                                    data.restore_key = metaData.restore_key;
                                    data.restore_value = metaData.restore_value;
                                    updateByHistoryFunc(data, (err, metaData) => {
                                        registerFunc(metaData, endCallback);
                                    });
                                }
                            });
                        });
                    });
                }
            }

            for (i = 0; i < json.length; i = i + 1) {
                metaData = json[i];
                if (this.executer.isEditable(socketid, metaData.group)) {
                    this.executer.textClient.exists(this.executer.metadataPrefix + json[i].id, ((metaData) => {
                        return (err, doesExists) => {
                            if (!err && doesExists === 1) {

                                if (!metaData.hasOwnProperty('orgWidth') || !metaData.hasOwnProperty('orgHeight')) {
                                    // 初期幅高さが入ってないのが来た. 入れておく.
                                    this.executer.getContent(metaData.type, metaData.content_id, (reply) => {
                                        this.executer.initialOrgWidthHeight(metaData, reply);
                                        registerFunc(metaData, endCallback);
                                    });
                                } else if (metaData.hasOwnProperty('restore_key') && metaData.hasOwnProperty('restore_value')) {
                                    // historyデータが指定されているのが来た.
                                    // historyによるmetadataの更新.
                                    updateByHistoryFunc(metaData, (err, metaData) => {
                                        // 更新したメタデータの登録.
                                        registerFunc(metaData, endCallback);
                                        // 同期させる. endCallback(metadataの更新broadcast)が複数回呼ばれる.
                                        syncFunc(metaData, endCallback);
                                    });
                                } else {
                                    registerFunc(metaData, endCallback);
                                }
                            }
                        };
                    })(metaData));
                } else {
                    --all_done;
                }
            }
        }

        /**
         * ウィンドウの追加を行うコマンドを実行する.
         * @method AddWindowMetaData
         * @param {String} socketid ソケットID
         * @param {JSON} json windowメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        addWindowMetaData(socketid, json, endCallback, permissionChangeCallback) {
            console.log("AddWindowMetaData : " + JSON.stringify(json));
            this.executer.addWindow(socketid, json, (windowData) => {
                if (endCallback) {
                    endCallback(null, [windowData]);
                }
            }, permissionChangeCallback);
        }

        /**
         * ウィンドウの削除行うコマンドを実行する.
         * @method DeleteWindowMetaData
         * @param {String} socketid ソケットID
         * @param {JSON} json windowメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        deleteWindowMetaData(socketid, json, endCallback) {
            console.log("DeleteWindowMetaData");
            let deleteWindowFunc = (isAdmin) => {
                let i,
                    meta,
                    results = [],
                    all_done = json.length;
                for (i = 0; i < json.length; i = i + 1) {
                    meta = json[i];
                    if (isAdmin || this.executer.isDisplayEditable(socketid, meta.group)) {
                        this.executer.getWindowMetaData(meta, (metaData) => {
                            if (metaData) {
                                this.executer.deleteWindow(metaData, (meta) => {
                                    --all_done;
                                    results.push(meta);
                                    if (all_done <= 0) {
                                        if (endCallback) {
                                            endCallback(null, results);
                                            return;
                                        }
                                    }
                                });
                            } else {
                                if (endCallback) {
                                    endCallback("not exists window metadata", null);
                                }
                            }
                        });
                    } else {
                        if (endCallback) {
                            endCallback("the authority is not enough", null);
                        }
                    }
                }
            };

            this.executer.isAdmin(socketid, (err, isAdmin) => {
                if (!err && isAdmin) {
                    deleteWindowFunc(isAdmin);
                } else {
                    deleteWindowFunc(false);
                }
            });
        }

        /**
         * VirtualDisplayの更新を行うコマンドを実行する.
         * @method UpdateVirtualDisplay
         * @param {String} socketid ソケットID
         * @param {JSON} json socket.io.on:XXXXXXXXX時JSONデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        updateVirtualDisplay(socketid, json, endCallback) {
            if (json) {
                this.executer.setVirtualDisplay(json, (data) => {
                    if (endCallback) {
                        endCallback(null, data);
                    }
                });
            }
        }

        /**
         * VirtualDisplayの取得を行うコマンドを実行する.
         * @method GetVirtualDisplay
         * @param {String} socketid ソケットID
         * @param {JSON} json socket.io.on:XXXXXXXXX時JSONデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        getVirtualDisplay(socketid, json, endCallback) {
            this.executer.getVirtualDisplay(json, (data) => {
                console.log("GetVirtualDisplay");//, data);
                if (endCallback) {
                    endCallback(null, data);
                }
            });
        }

        /**
         *  グループリストを取得する.
         * @method GetGroupList
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        getGroupList(endCallback) {
            this.executer.getGroupList(endCallback);
        }

        /**
         *  グループを追加する.
         * @method AddGroup
         * @param {JSON} json 対象のname, typeを含むjson
         *                    typeは"content"か"display"で、ない場合は"content"のグループとなる
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        addGroup(socketid, json, endCallback) {
            let groupColor = "";
            let type = "content";
            if (json.hasOwnProperty("name") && json.name !== "") {
                if (this.executer.socketidToLoginKey.hasOwnProperty(socketid)) {
                    socketid = this.executer.socketidToLoginKey[socketid];
                }
                let userid = this.executer.socketidToUserID[socketid];
                this.executer.isGroupManipulatable(socketid, userid, (isManipulatable) => {
                    if (isManipulatable) {
                        if (json.hasOwnProperty("color")) {
                            groupColor = json.color;
                        }
                        if (json.hasOwnProperty("type")) {
                            type = json.type;
                        }
                        console.log("TYPE--------", type)
                        if (type === "content") {
                            this.executer.addGroup(socketid, null, json.name, groupColor, (err, groupID) => {
                                // グループユーザーの権限情報に、グループを追加する.
                                if (!err) {
                                    this.executer.getGroupUserSetting((err, setting) => {
                                        if (setting.hasOwnProperty(userid)) {
                                            if (setting[userid].viewable !== "all") {
                                                setting[userid].viewable.push(groupID);
                                            }
                                            if (setting[userid].editable !== "all") {
                                                setting[userid].editable.push(groupID);
                                            }
                                            if (!setting[userid].hasOwnProperty('viewableSite')) {
                                                setting[userid].viewableSite = "all";
                                            }
                                            if (setting[userid].viewableSite !== "all") {
                                                setting[userid].viewableSite.push(groupID);
                                            }
                                            // defaultグループは特殊扱いでユーザー無し
                                            if (userid !== "group_default") {
                                                this.executer.changeGroupUserSetting(socketid, userid, setting[userid], () => {
                                                    if (endCallback) {
                                                        endCallback(err, groupID);
                                                    }
                                                });
                                            }
                                        } else {
                                            if (endCallback) {
                                                endCallback(err, groupID);
                                            }
                                        }
                                    });
                                } else {
                                    endCallback("faild to add group");
                                }
                            });
                        } else if (type === "display") {
                            this.executer.addDisplayGroup(socketid, null, json.name, groupColor, (err, groupID) => {
                                // グループユーザーの権限情報に、グループを追加する.
                                if (!err) {
                                    this.executer.getGroupUserSetting((err, setting) => {
                                        if (setting.hasOwnProperty(userid)) {
                                            if (!setting[userid].hasOwnProperty('displayEditable')) {
                                                setting[userid].displayEditable = [];
                                            }
                                            if (setting[userid].displayEditable !== "all") {
                                                setting[userid].displayEditable.push(groupID);
                                            }
                                            if (userid !== "group_default") {
                                                this.executer.changeGroupUserSetting(socketid, userid, setting[userid], () => {
                                                    if (endCallback) {
                                                        endCallback(err, groupID);
                                                    }
                                                });
                                            }
                                        } else {
                                            if (endCallback) {
                                                endCallback(err, groupID);
                                            }
                                        }
                                    });
                                } else {
                                    endCallback("faild to add group");
                                }
                            });
                        }
                    } else {
                        endCallback("access denied");
                    }
                });
            } else {
                endCallback("faild to add group : invalid parameter");
            }
        }

        /**
         *  グループを削除する.
         * @method DeleteGroup
         * @param {JSON} json 対象のid, nameを含むjson
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        deleteGroup(socketid, json, endCallback) {
            if (json.hasOwnProperty("id") && json.hasOwnProperty("name") && json.name !== "") {
                this.executer.deleteGroup(socketid, json.id, json.name, endCallback);
            }
        }

        /**
         * グループを更新する
         * @method UpdateGroup
         * @param {JSON} json 対象のid, nameを含むjson
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        updateGroup(socketid, json, endCallback) {
            if (json.hasOwnProperty("id")) {
                this.executer.updateGroup(socketid, json.id, json, endCallback);
            }
        }

        /**
         * グループインデックスを変更する.
         * @method ChangeGroupIndex
         * @param {JSON} json 対象のid, indexを含むjson
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        changeGroupIndex(socketid, json, endCallback) {
            if (json.hasOwnProperty("id") && json.hasOwnProperty("index")) {
                this.executer.changeGroupIndex(socketid, json.id, json.index, endCallback);
            }
        }

        /**
         * 新しい保存領域を作成
         * @method ChangeGroupIndex
         * @param {JSON} json 対象のnameを含むjson
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        newDB(socketid, json, endCallback) {
            if (json.hasOwnProperty("name")) {
                this.executer.newDB(socketid, json.name, endCallback);
            } else {
                endCallback("faild to newdb : invalid parameter");
            }
        }

        /**
         * 保存領域の名前を変更
         * @method RenameDB
         * @param {JSON} json 対象のname, new_nameを含むjson
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        renameDB(socketid, json, endCallback) {
            if (json.hasOwnProperty('name') && json.hasOwnProperty('new_name')) {
                this.executer.renameDB(socketid, json.name, json.new_name, endCallback);
            } else {
                endCallback("faild to renamedb : invalid parameter");
            }
        }

        /**
         * DBの参照先保存領域の変更
         * @method ChangeDB
         * @param {JSON} json 対象のnameを含むjson
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        changeDB(socketid, json, endCallback) {
            if (json.hasOwnProperty("name")) {
                this.executer.changeDB(socketid, json.name, endCallback);
            } else {
                endCallback("faild to changedb : invalid parameter");
            }
        }

        /**
         * DBの保存領域の削除
         * @method DeleteDB
         * @param {JSON} json 対象のnameを含むjson
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        deleteDB(socketid, json, endCallback) {
            if (json.hasOwnProperty("name")) {
                if (json.name === "default") {
                    endCallback("Unauthorized name for deleting")
                } else {
                    this.executer.deleteDB(socketid, json.name, endCallback);
                }
            } else {
                endCallback("faild to deletedb : invalid parameter");
            }
        }

        /**
         * DBの保存領域の初期化
         * @method InitDB
         * @param {JSON} json 対象のnameを含むjson
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        initDB(socketid, json, endCallback) {
            if (json.hasOwnProperty("name")) {
                this.executer.initDB(socketid, json.name, endCallback);
            } else {
                endCallback("faild to initdb : invalid parameter");
            }
        }

        /**
         * DBの保存領域のリストを取得
         * @method GetDBList
         * @param {Function} resultCallback 終了時に呼ばれるコールバック
         */
        getDBList(socketid, resultCallback) {
            this.executer.isAdmin(socketid, (err, isAdmin) => {
                if (!err && isAdmin) {
                    this.executer.textClient.hgetall(this.executer.frontPrefix + 'dblist', resultCallback);
                } else {
                    resultCallback("access denied");
                }
            });
        }

        /**
         * 各種設定の変更
         * @method ChangeGlobalSetting
         * TODO
         */
        changeGlobalSetting(socketid, json, endCallback) {
            this.executer.changeGlobalSetting(socketid, json, endCallback);
        }

        /**
         * 各種設定の取得
         */
        getGlobalSetting(json, endCallback) {
            this.executer.getGlobalSetting(endCallback);
        }

        /**
         * ウィンドウの取得を行うコマンドを実行する.
         * @method GetWindowMetaData
         * @param {String} socketid ソケットID
         * @param {JSON} json 対象のid, typeを含むjson
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        getWindowMetaData(socketid, json, endCallback) {
            let isAllType = json.hasOwnProperty('type') && json.type === 'all',
                isIdentityType = json.hasOwnProperty('id') && json.id !== undefined && json.id !== "undefined" && json.id !== "";
            if (isAllType || isIdentityType) {
                this.executer.getWindowMetaData(json, (windowData) => {
                    if (windowData) {
                        //console.log("doneGetWindow:", windowData);
                        if (endCallback) {
                            endCallback(null, windowData);
                        }
                    } else {
                        endCallback("not found window metadata", null);
                    }
                });
            }
        }

        /**
         * ウィンドウの更新を行うコマンドを実行する.
         * @method UpdateWindowMetaData
         * @param {String} socketid ソケットID
         * @param {JSON} json 対象のjson
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        updateWindowMetaData(socketid, json, endCallback) {
            console.log("UpdateWindowMetaData:", json.length);
            let updateWindowFunc = (isAdmin) => {
                let i,
                    metaData,
                    results = [],
                    all_done = json.length;

                for (i = 0; i < json.length; i = i + 1) {
                    metaData = json[i];
                    if (isAdmin || this.executer.isDisplayEditable(socketid, metaData.group)) {
                        this.executer.updateWindowMetaData(socketid, metaData, (meta) => {
                            --all_done;
                            results.push(meta);
                            if (all_done <= 0) {
                                if (endCallback) {
                                    endCallback(null, results);
                                    return;
                                }
                            }
                        });
                    } else {
                        --all_done;
                    }
                }
            };

            this.executer.isAdmin(socketid, (err, isAdmin) => {
                if (!err && isAdmin) {
                    updateWindowFunc(isAdmin);
                } else {
                    updateWindowFunc(false);
                }
            });
        }

        /**
         * mouseコマンドを実行する.
         * @method UpdateMouseCursor
         * @param {String} socketid ソケットID
         * @param {JSON} json mouse情報を含んだjson
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        updateMouseCursor(socketid, json, endCallback) {
            let c, i, j;
            if (!this.connectionId.hasOwnProperty(socketid)) {
                this.connectionId[socketid] = this.connectionCount;
                ++this.connectionCount;
            }
            json.connectionCount = this.connectionId[socketid];

            this.executer.updateMouseCursor(socketid, json, (windowData) => {
                endCallback(null, windowData);
            });
        }

        /**
         * グループユーザー設定変更コマンドを実行する
         * @method ChangeGroupUserSetting
         * @param {JSON} data 対象のnameを含むjson
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        changeGroupUserSetting(socketid, data, endCallback) {
            let setting,
                name;
            if (data.hasOwnProperty('name')) {
                name = data.name;
                delete data.name;
                this.executer.getGroupID(data.name, (id) => {
                    this.executer.changeGroupUserSetting(socketid, id, data, endCallback);
                });
            }
        }

        /**
         * ユーザーリスト取得コマンドを実行する
         * @method GetUserList
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        getUserList(endCallback) {
            this.executer.getUserList(endCallback);
        }

        /**
         * ユニークなコントローラIDを生成して返す
         * @method GenerateCOntrollerID
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        generateControllerID(endCallback) {
            this.executer.generateControllerID(endCallback);
        }

        /**
         * ログインコマンドを実行する
         * @method Login
         * @param {JSON} data 対象のid, passwordを含むjson
         *               再ログインする場合はコールバックで返ってくる値を loginkey としてjsonに入れる.
         * @param {String} socketid ソケットID
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         * @param {Function} suspendCallback ログインを試みているdisplayを許可するかcontrollerに聞きに行く
         *                              (string err, string displayid)=>{}
         */
        login(data, socketid, endCallback, suspendCallback) {
            const execLogin = (data, socketid, endCallback) => {
                //console.log("----------------------------", socketid, "----------------------------")
                if (data.hasOwnProperty('id') && data.hasOwnProperty('password')) {
                    // 再ログイン用のsocketidがloginkeyに入っていたらそちらを使う.
                    if (data.hasOwnProperty('loginkey')) {
                        if (this.executer.socketidToAccessAuthority.hasOwnProperty(data.loginkey)) {
                            // 対応関係を保存
                            this.executer.socketidToLoginKey[socketid] = data.loginkey;
                            socketid = data.loginkey;
                            let result = {
                                id: this.executer.socketidToUserID[socketid],
                                loginkey: socketid,
                                authority: this.executer.socketidToAccessAuthority[socketid]
                            }
                            this.executer.getControllerData(data.controllerID, ((result) => {
                                return (err, controllerData) => {
                                    result.controllerData = controllerData;
                                    endCallback(null, result);
                                };
                            })(result));
                            return;
                        } else {
                            endCallback("Invalid Login", false);
                            return;
                        }
                    }
                    this.executer.login(data.id, data.password, socketid, data.controllerID, endCallback);
                } else {
                    endCallback("Invalid UserName or Password");
                }
            }
            //console.log("-----------login",data);
            if (data.id === "ElectronDisplay") {
                execLogin(data, socketid, (err, loginResult) => {
                    if (err || loginResult.authority === null) {
                        /* ElectronDisplayとしてパスワードでログインに失敗したので、普通のdisplayとして処理する */
                        let logindata = data;
                        logindata.id = "Display";
                        this.login(logindata, socketid, endCallback, suspendCallback);
                        return;
                    } else { //パスワードOK
                        endCallback(err, loginResult);
                        return;
                    }
                });
            } else if (data.id === "Display") {
                // DisplayID無しのリクエストが来た場合
                if (!data.hasOwnProperty('displayid') || !data.displayid) {
                    endCallback("Not found displayid");
                    return;
                }
                // ディスプレイは配信許可設定が必要
                this.executer.existsDisplayPermission(socketid, data.displayid, (err, exists) => {
                    if (err) {
                        endCallback(err);
                    } else if (exists) {
                        this.executer.getDisplayPermission(socketid, data.displayid, (err, permission) => {
                            if (err) {
                                console.log(err);
                            } else if (permission === "true") {
                                // 配信許可済
                                execLogin(data, socketid, endCallback);
                                return;
                            } else {
                                // 配信拒否済
                                endCallback("Rejected for Permission");
                                return;
                            }
                        });
                    } else {
                        // 許可設定がないのでコントローラに聞きに行く
                        suspendCallback(err, data);
                        return;
                    }
                });
            } else {
                execLogin(data, socketid, endCallback);
                return;
            }
        }

        getDisplayPermissionList(endCallback) {
            this.executer.getDisplayPermissionList((err, permissions) => {
                endCallback(err, permissions);
            });
        }

        updateDisplayPermissionList(displayPermissionList, endCallback) {
            this.executer.updateDisplayPermissionList(displayPermissionList, (err, permissions) => {
                endCallback(err, permissions);
            });
        }

        deleteDisplayPermissionList(displayIDList, endCallback) {
            this.executer.deleteDisplayPermissionList(displayIDList, (err, permissions) => {
                endCallback(err, permissions);
            });
        }

        /**
         * パスワードを変更する
         * @method ChangePassword
         */
        changePassword(socketid, data, endCallback) {
            let authority;
            if (this.executer.socketidToLoginKey.hasOwnProperty(socketid)) {
                socketid = this.executer.socketidToLoginKey[socketid];
            }
            if (!this.executer.socketidToAccessAuthority.hasOwnProperty(socketid)) {
                endCallback("failed to change password (1)");
                return;
            }
            authority = this.executer.socketidToAccessAuthority[socketid];
            if (authority.editable !== 'all') {
                endCallback("failed to change password (2)");
                return;
            }
            if (data.hasOwnProperty('id') && data.hasOwnProperty('pre_password') && data.hasOwnProperty('password')) {
                this.executer.getUserList((err, userList) => {
                    let i;
                    for (i = 0; i < userList.length; i = i + 1) {
                        if (userList[i].id === data.id) {
                            if (userList[i].type === "admin") {
                                this.executer.changeAdminUserSetting(socketid, userList[i].id, {
                                    pre_password: data.pre_password,
                                    password: data.password
                                }, endCallback);
                            } else if (userList[i].type === "group") {
                                this.executer.changeGroupUserSetting(socketid, userList[i].id, {
                                    password: data.password
                                }, endCallback);
                            } else if (userList[i].type === "api") {
                                this.executer.changeGroupUserSetting(socketid, userList[i].id, {
                                    password: data.password
                                }, endCallback);
                            } else if (userList[i].type === "electron") {
                                this.executer.changeGroupUserSetting(socketid, userList[i].id, {
                                    password: data.password
                                }, endCallback);
                            } else {
                                endCallback("failed to change password (3)");
                            }
                            break;
                        }
                    }
                });
            }
        }

        /**
         * コントローラデータを更新する
         * @param {*} socketid
         * @param {*} data
         * @param {*} endCallback
         */
        updateControllerData(socketid, data, endCallback) {
            if (data.hasOwnProperty('controllerID') && data.hasOwnProperty('controllerData')) {
                this.executer.updateControllerData(data.controllerID, data.controllerData, endCallback);
            } else {
                endCallback("failed");
            }
        }

        /**
         * コントローラデータを取得する.
         * @param {*} socketid
         * @param {*} data
         * @param {*} resultCallback
         */
        getControllerData(socketid, data, resultCallback) {
            if (data.hasOwnProperty('controllerID')) {
                this.executer.getControllerData(data.controllerID, endCallback);
            } else {
                endCallback("failed");
            }

        }

        /**
         * 権限情報を変更する
         */
        changeAuthority(socketid, data, endCallback) {
            let authority;
            if (this.executer.socketidToLoginKey.hasOwnProperty(socketid)) {
                socketid = this.executer.socketidToLoginKey[socketid];
            }
            if (!this.executer.socketidToAccessAuthority.hasOwnProperty(socketid)) {
                endCallback("failed to change authority (1)");
                return;
            }
            authority = this.executer.socketidToAccessAuthority[socketid];
            if (authority.editable !== 'all') {
                endCallback("failed to change authority (2)");
                return;
            }
            if (data.hasOwnProperty('id')
                && data.hasOwnProperty('editable')
                && data.hasOwnProperty('viewable')
                && data.hasOwnProperty('group_manipulatable')) {
                this.executer.getUserList((err, userList) => {
                    let i;
                    this.executer.getGroupList((err, groupList) => {
                        for (i = 0; i < userList.length; i = i + 1) {
                            if (userList[i].id === data.id) {
                                if (userList[i].type === "group" || userList[i].type === "guest" || userList[i].type === "display") {
                                    let setting = {
                                        viewable: data.viewable,
                                        editable: data.editable,
                                        group_manipulatable: data.group_manipulatable
                                    };
                                    if (data.hasOwnProperty('displayEditable')) {
                                        setting.displayEditable = data.displayEditable
                                    };
                                    if (data.hasOwnProperty('viewableSite')) {
                                        setting.viewableSite = data.viewableSite
                                    };
                                    this.executer.changeGroupUserSetting(socketid, userList[i].id, setting, (err, reply) => {
                                        if (!err) {
                                            endCallback(err, userList[i].id);
                                        } else {
                                            endCallback(err);
                                        }
                                    });
                                }
                                break;
                            }
                        }
                    });
                });
            } else {
                endCallback("failed to change authority (3)");
            }
        }

        /**
         * ログアウトコマンドを実行する
         */
        logout(data, socketid, endCallback) {
            if (data.hasOwnProperty('loginkey')) {
                console.log("Logout", data.loginkey)
                this.executer.removeAuthority(data.loginkey);
                endCallback(null, data.loginkey);
            } else {
                console.log("Logout", socketid)
                this.executer.removeAuthority(socketid);
                endCallback(null, socketid);
            }
        }

        upload(param, binaryData, endCallback){
            this.executer.upload(param,binaryData,endCallback);
        }

        updateQgisContentsList(endCallback){
            this.executer.updateQgisContentsList(endCallback);
        }
    }

    module.exports = CommandOperator;
})();
