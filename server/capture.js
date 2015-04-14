/*jslint devel:true*/
/*global require, phantom */

(function () {
	"use strict";

	var page = require('webpage').create(),
		system = require('system'),
		url,
		output;

	if (system.args.length === 3) {
		output = system.args[1];
		url = system.args[2];
		
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
