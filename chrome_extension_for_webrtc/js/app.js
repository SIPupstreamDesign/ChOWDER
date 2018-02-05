(function () {

	window.onload = function () {
		const video = document.getElementById('screen-view');
		const start_button = document.getElementById('start_button');
		const stop_button = document.getElementById('stop_button');
		const request = { sources: ['screen', 'window', 'tab'] };
		
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
						}
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

		if (location.hostname.length === 32) {
			document.getElementById('extensionid_input').value = location.hostname;
		}
	};

}());