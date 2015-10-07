/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	var Command = {
		RegisterEvent : "RegisterEvent",
		
		// request command
		AddContent : "AddContent",
		GetContent : "GetContent",
		GetMetaData : "GetMetaData",
		DeleteContent : "DeleteContent",
		AddWindow : "AddWindow",
		DeleteWindow : "DeleteWindow",
		GetWindow : "GetWindow",
		UpdateVirtualDisplay : "UpdateVirtualDisplay",
		GetVirtualDisplay : "GetVirtualDisplay",
		
		// using both server and client
		Update : "Update",
		UpdateMetaData : "UpdateMetaData",
		UpdateContent : "UpdateContent",
		UpdateWindow : "UpdateWindow",
		ShowWindowID : "ShowWindowID"
	};
	
	window.command = Command;
}());
