// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function setScreenshotUrl(url) {	
	document.getElementById('target').src = url;
/*
	var connector = window.io_connector;
	connector.connect();
	var img = document.createElement('img');
	img.onload = function (evt) {
		var metaData = {
			type : "image",
			posx : 0,
			posy : 0,
			width : img.naturalWidth,
			height: img.naturalHeight
		};
		console.log(evt);
		connector.sendBinary('AddContent', metaData, evt.result, function(err, reply) {
			console.log("doneAddContent", err, reply);
		});
	};
	img.src = url;
	*/
}
