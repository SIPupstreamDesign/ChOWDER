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
		UpdateContent : "UpdateContent",
		AddWindow : "AddWindow",
		DeleteWindow : "DeleteWindow",
		GetWindow : "GetWindow",
		UpdateVirtualDisplay : "UpdateVirtualDisplay",
		GetVirtualDisplay : "GetVirtualDisplay",
		
		// using both server and client
		Update : "Update",
		UpdateTransform : "UpdateTransform",
		UpdateWindow : "UpdateWindow",
		ShowWindowID : "ShowWindowID"
	};
	
	module.exports = Command;
}());
