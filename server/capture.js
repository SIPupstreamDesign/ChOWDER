/*jslint devel:true*/
/*global require, phantom */

(function () {
	"use strict";

	var page = require('webpage').create(),
		system = require('system'),
		url,
		w,
		h,
		output;

	if (system.args.length >= 3) {
		output = system.args[1];
		url = system.args[2];
		if (system.args.length >= 4) {
			w = parseInt(system.args[3], 10);
			h = parseInt(system.args[4], 10);
			page.clipRect = {
				left : 0,
				top : 0,
				width : w,
				height : h
			};
			if (h > 4000) {
				page.clipRect.top = h - 4000;
			}
		}

		page.open(url, function (status) {
			if (status !== 'success') {
				console.log('Unable to load the address!');
			} else {
				page.render(output);
			}
			phantom.exit();
		});
	}
}());
