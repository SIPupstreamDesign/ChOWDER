/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

/**
 * コマンド定数
 */
export const Command = {
    // request command
    AddContent: "AddContent",
    AddTileContent: "AddTileContent",
    AddTileContentCount: "AddTileContentCount",
    AddHistoricalContent: "AddHistoricalContent",
    AddMetaData: "AddMetaData",
    AddWindowMetaData: "AddWindowMetaData",
    GetContent: "GetContent",
    GetTileContent: "GetTileContent",
    GetMetaData: "GetMetaData",
    GetWindowMetaData: "GetWindowMetaData",
    GetDisplaySpace: "GetDisplaySpace",
    UploadTileimage: "UploadTileimage",
    GetLoginUserList: "GetLoginUserList",
    GetSelfStatus: "GetSelfStatus",
    UpdateLoginUserControllerID: "UpdateLoginUserControllerID",

    // Display Session Management
    RegisterDisplay: "RegisterDisplay",
    GetPendingDisplays: "GetPendingDisplays",
    GetApprovedDisplays: "GetApprovedDisplays",
    ApproveDisplay: "ApproveDisplay",
    RejectDisplay: "RejectDisplay",
    DeleteDisplay: "DeleteDisplay",
    DisplayApproved: "DisplayApproved",
    ChangeDisplayName: "ChangeDisplayName",
    // using both server and client
    Update: "Update",
    UpdateContent: "UpdateContent",
    UpdateMetaData: "UpdateMetaData",
    UpdateDisplaySpace: "UpdateDisplaySpace",
    UpdateWindowMetaData: "UpdateWindowMetaData",
    UpdateMouseCursor: "UpdateMouseCursor",
    DeleteContent: "DeleteContent",
    DeleteWindowMetaData: "DeleteWindowMetaData",
    ShowWindowID: "ShowWindowID",
    ReloadDisplay: "ReloadDisplay",
    MeasureDisplay: "MeasureDisplay",
    SendMessage: "SendMessage",

    // to client
    Disconnect: "Disconnect",
    SessionRevoked: "SessionRevoked",

    // DB管理コマンド
    NewDB: "NewDB",
    InitDB: "InitDB",
    DeleteDB: "DeleteDB",
    RenameDB: "RenameDB",
    ChangeDB: "ChangeDB",
    GetDBList: "GetDBList",

    // 各種設定変更
    ChangeGlobalSetting: "ChangeGlobalSetting",
    GetGlobalSetting: "GetGlobalSetting",
    UpdateSetting: "UpdateSetting",

    // ユーザー管理
    Login: "Login",
    Logout: "Logout",
    CreateUser: "CreateUser",
    DeleteUser: "DeleteUser",
    ChangePassword: "ChangePassword",
    ChangeOwnPassword: "ChangeOwnPassword",
    ChangeAuthority: "ChangeAuthority",
    GetUserList: "GetUserList",
    GenerateControllerID: "GenerateControllerID",

    // コントローラデータ
    UpdateControllerData: "UpdateControllerData",
    GetControllerData: "GetControllerData",

    // WebRTC
    RTCRequest: "RTCRequest",
    RTCOffer: "RTCOffer",
    RTCAnswer: "RTCAnswer",
    RTCIceCandidate: "RTCIceCandidate",
    RTCClose: "RTCClose",

    // Mediasoup handshake
    MediasoupProducerRTPCapabilities: "MediasoupProducerRTPCapabilities",
    MediasoupCreateProducerTransport: "MediasoupCreateProducerTransport",
    MediasoupConnectProducerTransport: "MediasoupConnectProducerTransport",
    MediasoupProduceStream: "MediasoupProduceStream",
    MediasoupNewProducerBroadcast: "MediasoupNewProducerBroadcast",

    MediasoupConsumerRTPCapabilities: "MediasoupConsumerRTPCapabilities",
    MediasoupCreateConsumerTransport: "MediasoupCreateConsumerTransport",
    MediasoupConnectConsumerTransport: "MediasoupConnectConsumerTransport",
    MediasoupConsumeStream: "MediasoupConsumeStream",

    // mediasoup v2 (新設計)
    GetRouterRtpCapabilities: "GetRouterRtpCapabilities",
    CreateWebRtcTransport: "CreateWebRtcTransport",
    ConnectWebRtcTransport: "ConnectWebRtcTransport",
    Produce: "Produce",
    CloseProducer: "CloseProducer",
    Consume: "Consume",
    ResumeConsumer: "ResumeConsumer",
    GetActiveProducers: "GetActiveProducers",

    // ディスプレイ配信許可設定
    AskDisplayPermission: "AskDisplayPermission",
    UpdateDisplayPermissionList: "UpdateDisplayPermissionList",
    DeleteDisplayPermissionList: "DeleteDisplayPermissionList",
    GetDisplayPermissionList: "GetDisplayPermissionList",

    // Site管理
    CreateSite: "CreateSite",
    UpdateSite: "UpdateSite",
    DeleteSite: "DeleteSite",
    GetSite: "GetSite",
    GetSiteList: "GetSiteList",
    GetDisplaysBySite: "GetDisplaysBySite",

    // ContentsLayout
    SaveContentsLayout: "SaveContentsLayout",
    GetContentsLayoutList: "GetContentsLayoutList",
    GetContentsLayout: "GetContentsLayout",
    RestoreContentsLayout: "RestoreContentsLayout",
    DeleteContentsLayout: "DeleteContentsLayout",
    BulkUpdateMetaData: "BulkUpdateMetaData",

    Upload: "Upload",

    // タイルイメージアップロード進捗
    TileimageProgress: "TileimageProgress",
    TileimageUploadFailed: "TileimageUploadFailed",

    // itowns 自動ログイン用OTP
    RequestOTP: "RequestOTP",
    LoginWithOTP: "LoginWithOTP",

    // iTowns カメラ更新（content:camera キーのみ指定）
    UpdateCameraMatrix: "UpdateCameraMatrix",

    // サムネイル
    GetThumbnail: "GetThumbnail",         // クライアント → サーバー: サムネイル取得
    UpdateThumbnail: "UpdateThumbnail",   // クライアント → サーバー: サムネイル送信（PNG Binary）
    ThumbnailUpdated: "ThumbnailUpdated", // サーバー → 全クライアント: 更新通知（broadcast）

    // WebGL(iTowns) キャプチャ
    CaptureScreen: "CaptureScreen",       // コントローラ → iframe(iTowns): 画面キャプチャ要求

    // ディスプレイコンテンツ再ロード
    RefreshDisplayContent: "RefreshDisplayContent", // コントローラ → サーバー → 承認済み全ディスプレイ

    // サーバー設定取得
    GetServerConfig: "GetServerConfig",

    // バイナリ内容判別
    InspectContentData: "InspectContentData",
} as const;

export type CommandType = typeof Command[keyof typeof Command];
