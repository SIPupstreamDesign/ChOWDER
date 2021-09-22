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

    // diplay上のコンテンツ用
    static resize(iframeConnector, param) {
        iframeConnector.send(TileViewerCommand.Resize, {
            param: param
        });
    }
}

export default TileViewerUtil;