/**
 * This software was developed by the Tokyo University of Science - Space Education Program (T-SEP), which was funded by the 
 * Aerospace Science and Technology Promotion Program of the Ministry of Education, Culture, Sports, Science, and Technology (MEXT).
 */

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
		GetUserList :  "GetUserList"
	};
	
	window.command = Command;
}());
