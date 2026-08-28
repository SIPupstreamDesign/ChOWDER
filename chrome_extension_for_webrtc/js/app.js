/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

(function () {

	window.onload = function () {
		const video = document.getElementById('screen-view');
		const copy_button = document.getElementById('copy_button');
		/*
		const start_button = document.getElementById('start_button');
		const stop_button = document.getElementById('stop_button');
		const request = { sources: ['screen', 'window', 'tab', 'audio'] };

		let stream;
		start_button.addEventListener('click', function (evt) {
			const EXTENSION_ID = document.getElementById('extensionid_input').value;

			chrome.runtime.sendMessage(EXTENSION_ID, request, function (response) {
				if (response && response.type === 'success') {
					navigator.mediaDevices.getUserMedia({
						video: {
							mandatory: {
								chromeMediaSource: 'desktop',
								chromeMediaSourceId: response.streamId,
							}
						},
						audio: {
							mandatory: {
								chromeMediaSource: 'desktop',
								chromeMediaSourceId: streamId
							}
						},
					}).then(returnedStream => {
						stream = returnedStream;
						video.src = URL.createObjectURL(stream);
						start_button.style.display = "none";
						stop_button.style.display = "inline";
					}).catch(err => {
						console.error('Could not get stream: ', err);
					});
				} else {
					console.error('Could not get stream');
				}
			});
		});
		stop_button.addEventListener('click', function (evt) {
			stream.getTracks().forEach(function (track) {
				track.stop()
			});
			URL.revokeObjectURL(video.src);
			video.src = '';
			stop_button.style.display = "none";
			start_button.style.display = "inline";
		});
		*/

		if (location.hostname.length === 32) {
			document.getElementById('extensionid_input').value = location.hostname;
		}

		copy_button.onclick = function () {
			var input = document.getElementById('extensionid_input');
			input.disabled = false;
			input.select();
			document.execCommand('copy');
			input.disabled = true;
		}
	};

}());