/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import TileViewerCommand from "./tileviewer_command";

class TileViewerUtil {

    // 
    static updateCamera(iframeConnector, metaData, callback = null) {
        if (metaData.hasOwnProperty('cameraParams')) {
            iframeConnector.send(TileViewerCommand.UpdateCamera, {
                params: JSON.parse(metaData.cameraParams),
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

    // diplay上のコンテンツ用
    static resize(iframeConnector, param) {
        iframeConnector.send(TileViewerCommand.Resize, {
            param: param
        });
    }

    // レイヤープロパティの更新
    static updateLayerList(iframeConnector, metaData, preMetaData, callback) {
        try {
            if (metaData.hasOwnProperty('layerList')) {
                let preLayerListStr = preMetaData ? preMetaData.layerList : [];
                // レイヤー情報が以前のものと異なる場合に更新
                if (preLayerListStr !== metaData.layerList) {
                    let layerList = JSON.parse(metaData.layerList);
                    let preLayerList = JSON.parse(preLayerListStr);
                    // layer数の増減がないか調べる
                    if (layerList.length > preLayerList.length) {
                        // 増えてた
                        let layerIDs = TileViewerUtil.getIDList(layerList);
                        let preLayerIDs = TileViewerUtil.getIDList(preLayerList);
                        // 増えていたレイヤーを追加
                        for (let i = 0; i < layerIDs.length; ++i) {
                            if (preLayerIDs.indexOf(layerIDs[i]) < 0) {
                                //console.error("AddLayer", i)
                                iframeConnector.send(TileViewerCommand.AddLayer, layerList[i]);
                            }
                        }
                    }
                    if (layerList.length < preLayerList.length) {
                        // 減っていた
                        let layerIDs = TileViewerUtil.getIDList(layerList);
                        let preLayerIDs = TileViewerUtil.getIDList(preLayerList);
                        // 減っていたレイヤーを削除
                        for (let i = 0; i < preLayerIDs.length; ++i) {
                            if (layerIDs.indexOf(preLayerIDs[i]) < 0) {
                                //console.error("DeleteLayer", i)
                                iframeConnector.send(TileViewerCommand.DeleteLayer, preLayerList[i]);
                            }
                        }
                    }
                    for (let i = 0; i < layerList.length; ++i) {
                        let layer = layerList[i];
                        iframeConnector.send(TileViewerCommand.ChangeLayerProperty, layer);
                    }
                    if (callback) {
                        callback();
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
}

export default TileViewerUtil;