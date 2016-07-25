(function () {
	var message_id = 0;

	function init () {
		var capture_button = document.getElementById('capture_button'),
			setting_button = document.getElementById('setting_button'),
			autocapture_button = document.getElementById('autocapture_button');

		capture_button.onclick = function () {
			console.log("capture button clicked");
			chrome.runtime.sendMessage({
				jsonrpc: '2.0',
				type : 'utf8',
				id: ++message_id,
				method: "capture"
			}, function(response) {
				console.log("capture_button response", response);
			});
		};

		autocapture_button.onclick = function () {
			console.log("autocapture button clicked");
			chrome.runtime.sendMessage({
				jsonrpc: '2.0',
				type : 'utf8',
				id: ++message_id,
				method: "autocapture"
			}, function(response) {
				console.log("capture_button response", response);
			});
		};

		setting_button.onclick = function () {
			window.location.href = "setting.html";
		};

		chrome.runtime.sendMessage({
			jsonrpc: '2.0',
			type : 'utf8',
			id: ++message_id,
			method: "connect"
		}, function(response) {
			console.log("connect response", response);
		});
	}
	
	window.onload = init;
}());