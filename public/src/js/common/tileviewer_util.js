/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Constants from './constants';
import TileViewerCommand from "./tileviewer_command";

class TileViewerUtil {

    // 
    static updateCamera(iframeConnector, metaData, callback = null) {
        if (metaData.hasOwnProperty('cameraParams')) {
            iframeConnector.send(TileViewerCommand.UpdateCamera, {
                params: metaData.cameraParams,
            }, callback);
        }
    }

    static updateViewerParam(iframeConnector, metaData, preMetaData = null) {
        if (preMetaData === null || preMetaData.zoomLabelVisible !== metaData.zoomLabelVisible) {
            iframeConnector.send(TileViewerCommand.UpdateViewerParam, {
                params: {
                    zoomLabelVisible : metaData.zoomLabelVisible
                },
            }, null);
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
                    } else if (layerList.length < preLayerList.length) {
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
                    } else {
                        // 順序変更あったか調べる
                        let isOrderChanged = false;
                        for (let i = 0; i < layerList.length; ++i) {
                            if (preLayerList[i].id !== layerList[i].id) {
                                isOrderChanged = true;
                                break;
                            }
                        }
                        if (isOrderChanged) {
                            iframeConnector.send(TileViewerCommand.InitLayers, layerList);
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

    static createCopyrightText(metaData) {
        let copyrightText = "";
        let layerList = JSON.parse(metaData.layerList);
        for (let i = 0; i < layerList.length; ++i) {
            if (layerList[i].hasOwnProperty(Constants.TileViewerAttributionKey)) {
                let attrib = layerList[i][Constants.TileViewerAttributionKey];
                if (attrib.hasOwnProperty('name') && attrib.name.length > 0) {
                    copyrightText += attrib.name + "<br />"
                }
                if (attrib.hasOwnProperty('url') && attrib.url.length > 0) {
                    copyrightText += '<a href="' +
                        attrib.url +
                        '" class="copyright_link">' +
                        attrib.url +
                        "</a><br />";
                }
            }
        }
        return copyrightText;
    }

    static updateTime(iframeConnector, metaData, time, range) {
        let timeData = {
            time: time.toJSON()
        };
        if (range.hasOwnProperty('rangeStartTime') && range.hasOwnProperty('rangeEndTime')) {
            timeData.rangeStartTime = range.rangeStartTime.toJSON();
            timeData.rangeEndTime = range.rangeEndTime.toJSON();
        }
        iframeConnector.send(TileViewerCommand.UpdateTime, timeData);
    }

    // 指定のメタデータがタイムライン同期対象となっているか返す.
    static isTimelineSync(metaData, senderID = null, senderSync = null) {
        let isSync = (!metaData.hasOwnProperty('sync')) // syncボタンが1回も押されていない
            ||
            (metaData.hasOwnProperty('sync') && String(metaData.sync) === 'true'); // syncボタンが押されてsyncとなっている

        if (senderSync !== null) {
            // senderがsync=falseの状態であればfalseとする
            isSync = isSync && String(senderSync) === 'true';
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

export default TileViewerUtil;