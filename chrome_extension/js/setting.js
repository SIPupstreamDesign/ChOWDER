/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

(function () {
	var message_id = 0,
		initial_wsurl = "ws://localhost:8082",
		initial_interval = 1.0;

	function init () {
		var apply_button = document.getElementById('apply_button'),
			cancel_button = document.getElementById('cancel_button'),
			reset_interval_button = document.getElementById('reset_interval'),
			reset_url_button = document.getElementById('reset_url'),
			interval = document.getElementById('interval'),
			wsurl = document.getElementById('wsurl');

		window.options.restore(function (items) {
			console.log("restored", items)
			interval.value = items.interval;
			wsurl.value = items.url;
		});

		reset_url_button.onclick = function () {
			wsurl.value = initial_wsurl;
		};
		wsurl.value = initial_wsurl;

		reset_interval_button.onclick = function () {
			interval.value = initial_interval;
		};
		interval.value = initial_interval;

		apply_button.onclick = function () {
			window.options.save(function() {
				chrome.runtime.sendMessage({
					jsonrpc: '2.0',
					type : 'utf8',
					id: ++message_id,
					method: "setting_updated"
				}, function(response) {
					console.log("setting_updated", response);
					window.location.href = "popup.html";
				});
			});
		};

		cancel_button.onclick = function () {
			window.location.href = "popup.html";
		};
	}
	
	window.onload = init;
}());