/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	var Command = {
		// request command
		AddContent : "AddContent",
		AddMetaData : "AddMetaData",
		AddWindowMetaData : "AddWindowMetaData",
		AddGroup : "AddGroup",
		DeleteGroup : "DeleteGroup",
		GetContent : "GetContent",
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
		UpdateMouseCursor : "UpdateMouseCursor",
		
		SendMessage: "SendMessage",

		// to client
		Disconnect : "Disconnect",
		
		// DB管理コマンド
		NewDB : "NewDB",
		RenameDB : "RenameDB",
		DeleteDB : "DeleteDB",
		ChangeDB : "ChangeDB",
		GetDBList : "GetDBList",
		
		// 各種設定変更
		ChangeGlobalSetting : "ChangeGlobalSetting",
		GetGlobalSetting : "GetGlobalSetting",
		
		// ユーザー管理
		Login : "Login",
		Logout : "Logout",
		ChangePassword : "ChangePassword",
		ChangeAuthority : "ChangeAuthority",
		GetUserList :  "GetUserList"
	};
	
	window.command = Command;
}());
