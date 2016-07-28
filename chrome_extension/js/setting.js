(function () {
	var message_id = 0;

	function init () {
		var apply_button = document.getElementById('apply_button'),
			cancel_button = document.getElementById('cancel_button');

		window.options.restore(function (items) {
			console.log("restored", items)
			var interval = document.getElementById('interval'),
				wsurl = document.getElementById('wsurl');

			interval.value = items.interval;
			wsurl.value = items.url;
		});

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