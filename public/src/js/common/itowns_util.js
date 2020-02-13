/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import ITownsCommand from './itowns_command.js';

// ChOWDERメタデータを元にiTownsビュー更新用のユーティリティ
class ITownsUtil {
    
    static updateCamera(iframeConnector, metaData) {
        if (metaData.hasOwnProperty('cameraWorldMatrix') && metaData.hasOwnProperty('cameraParams')) {
            iframeConnector.send(ITownsCommand.UpdateCamera, {
                mat : JSON.parse(metaData.cameraWorldMatrix),
                params : JSON.parse(metaData.cameraParams),
            });
        }
    }

    static getIDList(layerList) {
        let IDList = [];
        for (let i = 0; i < layerList.length; ++i) {
            IDList.push(layerList[i].id);
        }
        return IDList;
    }

    static updateLayerList(iframeConnector, metaData, preMetaData) {
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
                }
            }
        }
        catch(e) {
            console.error(e);
        }
    }

    static resize(iframeConnector, rect) {
        iframeConnector.send(ITownsCommand.Resize, rect);
    }
}

export default ITownsUtil;