/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

(()=>{
    "use strict";

    const path = require('path');
    const fs = require('fs');
    const ws_connector = require('../ws_connector.js');
    const OUTPUT_DIR = './log';
    const INCOMING_LOG = 'timestamp_incoming_log.csv';
    const OUTGOING_LOG = 'timestamp_outgoing_log.csv';

    class PerformanceLogger {
        constructor() {
            this.enableMeasureTime = false;
            this.incomingLog = null;
            this.outgoingLog = null;
        }

        release() {
            this.incomingLog.end();
            this.outgoingLog.end();
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
                fileName += "." + ('0000' + (num + 1)).slice(-3);
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
            this.incomingLog = this.prepareLogFile(INCOMING_LOG);
            this.incomingLog.write("method,time,id,tile_index\n");
            this.outgoingLog = this.prepareLogFile(OUTGOING_LOG);
            this.outgoingLog.write("method,time,id\n");
        }
        
        // ws_connector.onをすり替え
        prepareLog() {
            const originalOn = ws_connector.on;
            ws_connector.on = (method, callback) => {
                originalOn(method, (data, resultCallback, socketid) => {
                    try {
                        let metaData = null;
                        if (data.hasOwnProperty('metaData') && data.metaData) {
                            metaData = data.metaData;
    
                            // method, time, id, tile_index,
                            let row = method;
                            row += "," + new Date().toISOString();
                            row += "," + metaData.id;
                            if (metaData.hasOwnProperty('tile_index')) {
                                row += "," + metaData.tile_index;
                            }
                            row += "," + "\n";
    
                            this.incomingLog.write(row);
                        }
                    } catch(e) {
                    }
                    callback(data, resultCallback, socketid);
                });
            };
            const originalBroadcast = ws_connector.broadcast;
            ws_connector.broadcast = (ws, method, args, resultCallback) => {
                try {

                    if (args !== undefined && args && args.hasOwnProperty('id')) {
                        let row = method;
                        row += "," + new Date().toISOString();
                        row += "," + args.id;
                        row += "," + "\n";
                        this.outgoingLog.write(row);
                    }

                } catch(e) {
                    console.error(e)
                }
                originalBroadcast(ws, method, args, resultCallback);
            };

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
    };
    
    module.exports = new PerformanceLogger();
})();