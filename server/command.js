/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	var Command = {
		reqRegisterEvent : "reqRegisterEvent",
		
		// request command
		AddContent : "AddContent",
		GetContent : "GetContent",
		GetMetaData : "GetMetaData",
		DeleteContent : "DeleteContent",
		UpdateContent : "UpdateContent",
		UpdateTransform : "UpdateTransform",
		reqAddWindow : "reqAddWindow",
		DeleteWindow : "DeleteWindow",
		GetWindow : "GetWindow",
		UpdateWindow : "UpdateWindow",
		UpdateVirtualDisplay : "UpdateVirtualDisplay",
		GetVirtualDisplay : "GetVirtualDisplay",
		ShowWindowID : "ShowWindowID",
		
		// result command
		doneAddContent : "doneAddContent",
		doneGetContent : "doneGetContent",
		doneGetMetaData : "doneGetMetaData",
		doneDeleteContent : "doneDeleteContent",
		doneUpdateContent : "doneUpdateContent",
		doneUpdateTransform : "doneUpdateTransform",
		doneAddWindow : "doneAddWindow",
		doneDeleteWindow : "doneDeleteWindow",
		doneGetWindow : "doneGetWindow",
		doneUpdateWindow : "doneUpdateWindow",
		doneUpdateVirtualDisplay : "doneUpdateVirtualDisplay",
		doneGetVirtualDisplay : "doneGetVirtualDisplay",
		doneShowWindowID : "doneShowWindowID",
		
		// update request from server
		update : "update",
		updateTransform : "updateTransform",
		updateWindow : "updateWindow",
		showWindowID : "showWindowID"
	};
	
	module.exports = Command;
}());
