/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

(function () {

	function save_options(callback) {
		var interval = document.getElementById('interval'),
			wsurl = document.getElementById('wsurl');

			console.log("wsurl.value", wsurl.value)
		chrome.storage.sync.set({
			interval: interval.value,
			url : wsurl.value
		}, callback);
	}

	function restore_options(callback) {
		chrome.storage.sync.get({
			interval: 1,
			url : "ws://localhost:8081"
		}, callback);
	}

	window.options = {
		restore : restore_options,
		save : save_options
	};
}());
