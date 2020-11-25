/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import Constants from './constants';
import ITownsCommand from './itowns_command.js';

// ChOWDERメタデータを元にiTownsビュー更新用のユーティリティ
class ITownsUtil {
    
    static updateCamera(iframeConnector, metaData, callback = null) {
        if (metaData.hasOwnProperty('cameraWorldMatrix') && metaData.hasOwnProperty('cameraParams')) {
            iframeConnector.send(ITownsCommand.UpdateCamera, {
                mat : JSON.parse(metaData.cameraWorldMatrix),
                params : JSON.parse(metaData.cameraParams),
            }, callback);
        }
    }

    static getIDList(layerList) {
        let IDList = [];
        for (let i = 0; i < layerList.length; ++i) {
            IDList.push(layerList[i].id);
        }
        return IDList;
    }

    static updateLayerList(iframeConnector, metaData, preMetaData, callback) {
        try {
            if (metaData.hasOwnProperty('layerList')) {
                let preLayerListStr =  preMetaData ? preMetaData.layerList : [];
                // レイヤー情報が以前のものと異なる場合に更新
                if (preLayerListStr !== metaData.layerList) {
                    let layerList = JSON.parse(metaData.layerList);
                    let preLayerList = JSON.parse(preLayerListStr);
                    // layer数の増減がないか調べる
                    if (layerList.length > preLayerList.length) {
                        // 増えてた
                        let layerIDs = ITownsUtil.getIDList(layerList);
                        let preLayerIDs = ITownsUtil.getIDList(preLayerList);
                        // 増えていたレイヤーを追加
                        for (let i = 0; i < layerIDs.length; ++i) {
                            if (preLayerIDs.indexOf(layerIDs[i]) < 0) {
                                //console.error("AddLayer", i)
                                iframeConnector.send(ITownsCommand.AddLayer, layerList[i]);
                            }
                        }
                    }
                    if (layerList.length < preLayerList.length) {
                        // 減っていた
                        let layerIDs = ITownsUtil.getIDList(layerList);
                        let preLayerIDs = ITownsUtil.getIDList(preLayerList);
                        // 減っていたレイヤーを削除
                        for (let i = 0; i < preLayerIDs.length; ++i) {
                            if (layerIDs.indexOf(preLayerIDs[i]) < 0) {
                                //console.error("DeleteLayer", i)
                                iframeConnector.send(ITownsCommand.DeleteLayer, preLayerList[i]);
                            }
                        }
                    }
                    for (let i = 0; i < layerList.length; ++i) {
                        let layer = layerList[i];
                        iframeConnector.send(ITownsCommand.ChangeLayerProperty, layer);
                    }
                    if (callback)
                    {
                        callback();
                    }
                }
            }
        }
        catch(e) {
            console.error(e);
        }
    }

    static updateTime(iframeConnector, metaData, time) {
        iframeConnector.send(ITownsCommand.UpdateTime, {
            time : time.toJSON()
        });
    }

    static resize(iframeConnector, rect, isSetOffset = true) {
        iframeConnector.send(ITownsCommand.Resize, {
            rect : rect,
            isSetOffset : isSetOffset
        });
    }

    static createCopyrightText(metaData) {
        let copyrightText = "";
        let layerList = JSON.parse(metaData.layerList);
        for (let i = 0; i < layerList.length; ++i)
        {
            if (layerList[i].hasOwnProperty(Constants.ItownsAttributionKey))
            {
                let attrib = layerList[i][Constants.ItownsAttributionKey];
                if (attrib.hasOwnProperty('name') && attrib.name.length > 0) {
                    copyrightText += attrib.name + "<br />"
                }
                if (attrib.hasOwnProperty('url') && attrib.url.length > 0) {
                    copyrightText += '<a href="' 
                    + attrib.url 
                    + '" class="copyright_link">' 
                    + attrib.url 
                    + "</a><br />";
                }
            }
        }
        return copyrightText;
    }

    // 指定のメタデータがタイムライン同期対象となっているか返す.
    static isTimelineSync(metaData, senderID = null, senderSync = null) {
        let isSync =  (!metaData.hasOwnProperty('sync')) // syncボタンが1回も押されていない
            || (metaData.hasOwnProperty('sync') && String(metaData.sync) === 'true');   // syncボタンが押されてsyncとなっている

        if (senderSync !== null) {
            // senderがsync=falseの状態であればfalseとする
            isSync = isSync &&  String(senderSync) === 'true'; 
        }
        if (senderID !== null) {
            // 送信元IDが引数にあった場合は、
            // 送信元IDとmetadataのIDが同じであれば
            // isSync = trueとする。
            // senderSyncがfalseの場合でも、同じIDであればtrueとする。
            isSync = isSync || (metaData.id === senderID); 
        }
        return isSync;
    }
}

export default ITownsUtil;