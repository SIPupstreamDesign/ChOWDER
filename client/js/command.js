/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	var Command = {
		RegisterEvent : "RegisterEvent",
		
		// request command
		AddContent : "AddContent",
		AddMetaData : "AddMetaData",
		GetContent : "GetContent",
		GetMetaData : "GetMetaData",
		AddWindow : "AddWindow",
		DeleteWindow : "DeleteWindow",
		GetWindowMetaData : "GetWindowMetaData",
		UpdateVirtualDisplay : "UpdateVirtualDisplay",
		GetVirtualDisplay : "GetVirtualDisplay",
		
		// using both server and client
		Update : "Update",
		UpdateMetaData : "UpdateMetaData",
		UpdateContent : "UpdateContent",
		DeleteContent : "DeleteContent",
		UpdateWindow : "UpdateWindow",
		ShowWindowID : "ShowWindowID"
	};
	
	window.command = Command;
}());
