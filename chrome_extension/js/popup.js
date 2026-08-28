/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

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

		//backgroundからのメッセージ
		chrome.runtime.onMessage.addListener(function (message, sender) {
			if (message.method === "is_autocapture") {
				console.log("hogehoge", message.param )
				if (message.param === true) {
					autocapture_button.innerText = "StopCapture";
					autocapture_button.className = "btn btn-danger";
				} else {
					autocapture_button.innerText = "AutoCapture";
					autocapture_button.className = "btn btn-primary";
				}
			}
		});

		autocapture_button.onclick = function () {
			console.log("autocapture button clicked");
			if (autocapture_button.innerText === "AutoCapture") {
				chrome.runtime.sendMessage({
					jsonrpc: '2.0',
					type : 'utf8',
					id: ++message_id,
					method: "start_autocapture"
				}, function(response) {
					console.log("capture_button response", response);
				});
			} else {
				chrome.runtime.sendMessage({
					jsonrpc: '2.0',
					type : 'utf8',
					id: ++message_id,
					method: "stop_autocapture"
				}, function(response) {
					console.log("capture_button response", response);
				});
			}
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