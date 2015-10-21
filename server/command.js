/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	var Command = {
		RegisterEvent : "RegisterEvent",
		
		// request command
		AddContent : "AddContent",
		AddMetaData : "AddMetaData",
		AddWindowMetaData : "AddWindowMetaData",
		GetContent : "GetContent",
		GetMetaData : "GetMetaData",
		GetWindowMetaData : "GetWindowMetaData",
		UpdateVirtualDisplay : "UpdateVirtualDisplay",
		GetVirtualDisplay : "GetVirtualDisplay",
		
		// using both server and client
		Update : "Update",
		UpdateMetaData : "UpdateMetaData",
		UpdateContent : "UpdateContent",
		UpdateWindowMetaData : "UpdateWindowMetaData",
		DeleteContent : "DeleteContent",
		DeleteWindowMetaData : "DeleteWindowMetaData",
		ShowWindowID : "ShowWindowID"
	};
	
	module.exports = Command;
}());
