(function () {
	var message_id = 0;

	function init () {
		var capture_button = document.getElementById('capture_button'),
			setting_button = document.getElementById('setting_button');

		capture_button.onclick = function () {
			console.log("capture button clicked");
			chrome.runtime.sendMessage({
				jsonrpc: '2.0',
				type : 'utf8',
				id: ++message_id,
				method: "capture",
				params: {}
			}, function(response) {
				console.log("capture_button response", response);
			});
		};

		setting_button.onclick = function () {
			chrome.runtime.sendMessage({
				jsonrpc: '2.0',
				type : 'utf8',
				id: ++message_id,
				method: "setting",
				params: {}
			}, function(response) {
				console.log("setting_button response", response);
			});
		};
	}
	
	window.onload = init;
}());