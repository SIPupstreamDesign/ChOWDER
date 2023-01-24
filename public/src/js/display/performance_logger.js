/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

const MethodToMeaning = {
    showImage : "コンテンツ表示完了",
    GetContent : "コンテンツ取得開始",
    GetTileContent : "タイル取得開始",
    finishShow : "表示完了"
}

class PerformanceLogger
{
    init(store) {
        this.store = store;
        this.logText = "";
    }

    log(method, metaData, writeTileIndex = true) {
        if (!this.store) return;
        if (MethodToMeaning.hasOwnProperty(method)) {
            let message = MethodToMeaning[method]
                + "," + method
                + "," +  this.store.fetchMeasureTime()
                + "," + metaData.id
                + ",";

            if (writeTileIndex && method.indexOf('Tile') >= 0 && metaData.hasOwnProperty('tile_index')) {
                message += metaData.tile_index + ",";
            }
            console.debug(message);
            this.logText += message + "\n";
        }
    }
    
    logByVals(title, method, timeString, id) {
        if (!this.store) return;
        let message = title
            + "," + method
            + "," + timeString
            + "," + id 
            + ",";
        console.debug(message);
        this.logText += message + "\n";
    }

    logFromRegisterToShow(method, metaData) {
        if (!this.store) return;
        let message = "登録から表示完了までの時間" 
            + "," + method
            + "," + (new Date() - new Date(metaData.time_register)) / 1000 + "秒" 
            + "," + metaData.id 
            + ",";
        console.debug(message);
        this.logText += message + "\n";
    }

    validate() {
        return (this.store) ? true : false;
    }

    save(filename) {
        let bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        let text = "label,method,time,id,tile_index,\n" + this.logText;
        let blob = new Blob([bom, text], {type: 'text/csv'});

        let url = (window.URL || window.webkitURL);
        let blobUrl = url.createObjectURL(blob);
        let e = document.createEvent('MouseEvents');
        e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        let a = document.createElementNS("http://www.w3.org/1999/xhtml", "a");
        a.href = blobUrl;
        a.download = filename;
        a.dispatchEvent(e);
    }
}

export default new PerformanceLogger();