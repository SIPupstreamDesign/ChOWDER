/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

(function () {
	"use strict";

	console.log("this is background")

	let onMessageFunc = (message, sender, sendResponse) => {
	   const sources = message.sources;
	   const tab = sender.tab;
	   chrome.desktopCapture.chooseDesktopMedia(sources, tab, (streamId) => {
		   if (!streamId) {
			   sendResponse({
				   type: 'error',
				   message: 'Failed to get stream ID'
			   });
		   } else {
			   sendResponse({
				   type: 'success',
				   streamId: streamId
			   });
		   }
	   });
	   return true;
   	};

	chrome.runtime.onMessage.addListener(onMessageFunc);
	chrome.runtime.onMessageExternal.addListener(onMessageFunc);
	
	// for test
	/*
	chrome.browserAction.onClicked.addListener(function () {
		chrome.windows.create({
			url: "index.html",
			focused: true,
			type: "popup",
			width : 400,
			height : 100
		});
	});
	*/
}());
