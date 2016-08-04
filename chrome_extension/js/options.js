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
			url : "ws://localhost:8082"
		}, callback);
	}

	window.options = {
		restore : restore_options,
		save : save_options
	};
}());
