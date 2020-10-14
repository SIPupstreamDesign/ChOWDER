/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 */

"use strict";

const ITownsCommand = {
    // 通信開始命令
    Init : "Init",
    // コンテンツ追加命令(iframe->parent)
    AddContent : "AddContent",
    // レイヤーリストからレイヤーを初期化
    InitLayers : "InitLayers",
    // レイヤーが更新された(iframe->parent)
    UpdateLayer : "UpdateLayer",
    // カメラ更新命令(parent<->iframe)
    UpdateCamera : "UpdateCamera",
    // リサイズ命令(parent<->iframe)
    Resize : "Resize",
    // レイヤー追加命令
    AddLayer : "AddLayer",
    // レイヤー削除命令
    DeleteLayer : "DeleteLayer",
    // レイヤー順序変更命令
    ChangeLayerOrder : "ChangeLayerOrder",
    // レイヤープロパティ変更命令
    ChangeLayerProperty : "ChangeLayerProperty",
    // パフォーマンス計測
    MeasurePerformance : "MeasurePerformance",
    // 現在時刻の更新
    UpdateTime : "UpdateTime",
    // itowns側からのレイヤー初期化完了通知
    LayersInitialized : "LayersInitialized"
};

export default ITownsCommand;