/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

(()=>{
    "use strict";

    const InCommingMethodToMeaning = {
        AddHistoricalContent : "時系列画像を追加開始",
        AddTileContent : "タイルを追加",
        GetContent : "コンテンツを取得",
        GetTileContent : "タイルを取得"
    };

    const ResponseMethodToMeaning = {
        GetContent : "コンテンツを送信",
        GetTileContent : "タイルを送信"
    };
    
    const BroadcastMethodToMeaning = {
        UpdateContent : "新規コンテンツ通知"
    };
    
    const path = require('path');
    const fs = require('fs');
    const ws_connector = require('../ws_connector.js');
    const OUTPUT_DIR = './log';
    const ALL_LOG = 'timestamp_log.csv';
    /*
    const INCOMING_LOG = 'timestamp_incoming.csv';
    const RESPONSE_LOG = 'timestamp_response.csv';
    const BROADCAST_LOG = 'timestamp_broadcast.csv';
    */
    class PerformanceLogger {
        constructor() {
            this.enableMeasureTime = false;
            this.logStream = null;
            //this.broadcastLog = null;
        }

        release() {
            this.logStream.end();
            //this.responseLog.end();
            //this.broadcastLog.end();
        }

        // 書き込みファイル準備
        prepareLogFile(fullFileName) {
            let filePath = path.join(OUTPUT_DIR, fullFileName);
            if (!fs.existsSync(filePath)) {
                return fs.createWriteStream(filePath);
            }
            let splits = fullFileName.split('.csv');
            let dotSplits = splits[0].split(".");
            let fileName = dotSplits[0];
            if (dotSplits.length > 1) {
                let num = Number(dotSplits[1]);
                fileName += "." + ('0000' + (num + 1)).slice(-4);
            } else {
                fileName += ".0001";
            }
            return this.prepareLogFile(fileName + ".csv");
        }
        
        // 書き込み準備
        prepareWriting() {
            if (!fs.existsSync(OUTPUT_DIR)) {
                fs.mkdirSync(OUTPUT_DIR);
            }
            this.logStream = this.prepareLogFile(ALL_LOG);
            this.logStream.write('\uFEFF');
            this.logStream.write("type,label,method,time,id,tile_index,client_id,\n");
            /*
            this.responseLog = this.prepareLogFile(RESPONSE_LOG);
            this.responseLog.write('\uFEFF');
            this.responseLog.write("label,method,time,id,tile_index,\n");
            this.broadcastLog = this.prepareLogFile(BROADCAST_LOG);
            this.broadcastLog.write('\uFEFF');
            this.broadcastLog.write("label,method,time,id,\n");
            */
        }
        
        prepareLog() {
            // ws_connector.onをすり替え
            const originalOn = ws_connector.on;
            ws_connector.on = (method, callback) => {
                originalOn(method, (data, resultCallback, socketid) => {
                    try {
                        let metaData = null;
                        if (data.hasOwnProperty('metaData') && data.metaData) {
                            metaData = data.metaData;
                        }
                        if (data.hasOwnProperty('id')) {
                            metaData = data;
                        }
                        if (metaData) {
                            if (InCommingMethodToMeaning.hasOwnProperty(method)) {
                                let label = InCommingMethodToMeaning[method];

                                // type, label, method, time, id, tile_index, client_id
                                let row = "request";
                                row += "," + label;
                                row += "," + method;
                                row += "," + new Date().toISOString();
                                row += "," + metaData.id;
                                if (metaData.hasOwnProperty('tile_index')) {
                                    row += "," + metaData.tile_index;
                                } else {
                                    row += ",";
                                }
                                if (this.executer.socketidToUserID.hasOwnProperty(socketid)) {
                                    row += "," + this.executer.socketidToUserID[socketid];
                                } else {
                                    row += ",";
                                }
                                row += "\n";
        
                                this.logStream.write(row);
                            }
                        }
                    } catch(e) {
                    }
                    callback(data, resultCallback, socketid);
                });
            };

            // ws_connector.broadcastをすり替え
            const originalBroadcast = ws_connector.broadcast;
            ws_connector.broadcast = (ws, method, args, resultCallback) => {
                try {

                    if (args !== undefined && args && args.hasOwnProperty('id')) {
                        
                        if (BroadcastMethodToMeaning.hasOwnProperty(method)) {
                            let label = BroadcastMethodToMeaning[method];

                            // label, method, time, id, tile_index,
                            let row = "broadcast";
                            row += "," + label;
                            row += "," + method;
                            row += "," + new Date().toISOString();
                            row += "," + args.id;
                            row += ",";
                            row += "," + "\n";
                            this.logStream.write(row);
                        }
                    }

                } catch(e) {
                    console.error(e)
                }
                originalBroadcast(ws, method, args, resultCallback);
            };
        }

        writeResponseLog(method, res, socketid) {
            if (res && ResponseMethodToMeaning.hasOwnProperty(method)) {
                let metaData = null;
                if (res instanceof Array) {
                    metaData = res[0];
                } else {
                    metaData = res;
                }
                if (metaData.hasOwnProperty('id')) {
                    let label = ResponseMethodToMeaning[method];
                    let row = "response";
                    row += "," + label;
                    row += "," + method;
                    row += "," + new Date().toISOString();
                    row += "," + metaData.id;
                    if (metaData.hasOwnProperty('tile_index')) {
                        row += "," + metaData.tile_index;
                    } else {
                        row += ",";
                    }
                    if (this.executer.socketidToUserID.hasOwnProperty(socketid)) {
                        row += "," + this.executer.socketidToUserID[socketid];
                    } else {
                        row += ",";
                    }
                    row += "\n";
                    this.logStream.write(row);
                }
            }
        }
        
        /**
         * パフォーマンス計測用フラグの設定
         * @param {*} enableMeasureTime 
         */
        setEnableMeasureTime(enableMeasureTime) {
            this.enableMeasureTime = enableMeasureTime;
            if (this.enableMeasureTime) {
                // ファイル準備
                this.prepareWriting();

                // ws_connector.onをすり替え
                this.prepareLog();
            }
        }
        
        isEnableMeasureTime() {
            return this.enableMeasureTime;
        }

        /**
         * executerの参照を設定
         */
        setExecuter(executer) {
            this.executer = executer;
        }
    };
    
    module.exports = new PerformanceLogger();
})();