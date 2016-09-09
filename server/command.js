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
		UpdateMetaDataMulti : "UpdateMetaDataMulti",
		UpdateContent : "UpdateContent",
		UpdateWindowMetaData : "UpdateWindowMetaData",
		UpdateWindowMetaDataMulti : "UpdateWindowMetaDataMulti",
		UpdateMouseCursor : "UpdateMouseCursor",
		UpdateGroup : "UpdateGroup",
		ChangeGroupIndex : "ChangeGroupIndex",
		DeleteContent : "DeleteContent",
		DeleteContentMulti : "DeleteContentMulti",
		DeleteWindowMetaData : "DeleteWindowMetaData",
		ShowWindowID : "ShowWindowID",
		
		// to client
		Disconnect : "Disconnect"
	};
	
	module.exports = Command;
}());
