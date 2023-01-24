/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

 "use strict";

const Command = {
	// request command
	AddContent : "AddContent",
	AddTileContent : "AddTileContent",
	AddHistoricalContent : "AddHistoricalContent",
	AddMetaData : "AddMetaData",
	AddWindowMetaData : "AddWindowMetaData",
	AddGroup : "AddGroup",
	DeleteGroup : "DeleteGroup",
	GetContent : "GetContent",
	GetTileContent : "GetTileContent",
	GetMetaData : "GetMetaData",
	GetWindowMetaData : "GetWindowMetaData",
	UpdateVirtualDisplay : "UpdateVirtualDisplay",
	GetVirtualDisplay : "GetVirtualDisplay",
	GetGroupList : "GetGroupList",

	// using both server and client
	Update : "Update",
	UpdateMetaData : "UpdateMetaData",
	UpdateContent : "UpdateContent",
	UpdateWindowMetaData : "UpdateWindowMetaData",
	UpdateGroup : "UpdateGroup",
	ChangeGroupIndex : "ChangeGroupIndex",
	DeleteContent : "DeleteContent",
	DeleteWindowMetaData : "DeleteWindowMetaData",
	ShowWindowID : "ShowWindowID",
	ReloadDisplay : "ReloadDisplay",
	UpdateMouseCursor : "UpdateMouseCursor",

	SendMessage: "SendMessage",

	// to client
	Disconnect : "Disconnect",

	// DB管理コマンド
	NewDB : "NewDB",
	InitDB : "InitDB",
	RenameDB : "RenameDB",
	DeleteDB : "DeleteDB",
	ChangeDB : "ChangeDB",
	GetDBList : "GetDBList",

	// 各種設定変更
	ChangeGlobalSetting : "ChangeGlobalSetting",
	GetGlobalSetting : "GetGlobalSetting",
	UpdateSetting : "UpdateSetting",

	// ユーザー管理
	Login : "Login",
	Logout : "Logout",
	ChangePassword : "ChangePassword",
	ChangeAuthority : "ChangeAuthority",
	GetUserList :  "GetUserList",
	GenerateControllerID : "GenerateControllerID",

	// コントローラデータ
	UpdateControllerData : "UpdateControllerData",
	GetControllerData : "GetControllerData",

	// WebRTC
	RTCRequest : "RTCRequest",
	RTCOffer : "RTCOffer",
	RTCAnswer : "RTCAnswer",
	RTCIceCandidate : "RTCIceCandidate",
	RTCClose : "RTCClose",

	// ディスプレイ配信許可設定
	AskDisplayPermission : "AskDisplayPermission", // ログイン時に、サーバが許可していいか聞く
	UpdateDisplayPermissionList : "UpdateDisplayPermissionList", // 許可設定の変更
	DeleteDisplayPermissionList : "DeleteDisplayPermissionList",

	GetDisplayPermissionList : "GetDisplayPermissionList", // コントローラが許可設定一覧をサーバに要求する

	Upload : "Upload",
};

export default Command;
