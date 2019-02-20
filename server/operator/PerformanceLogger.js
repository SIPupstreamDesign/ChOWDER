/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

(()=>{
    "use strict";

    const fs = require('fs');
    const ws_connector = require('../ws_connector.js');

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
        prepareWriting() {
            this.incomingLog = fs.createWriteStream('./timestamp_incoming_log.csv');
            this.outgoingLog = fs.createWriteStream('./timestamp_outgoing_log.csv');
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
                            
                            if (metaData && metaData.hasOwnProperty('id')) {
                                row += "," + metaData.id;
                            }
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