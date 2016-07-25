
(function (Command) {
	var id = 100;

	function dataURLtoArrayBuffer(dataURL) {
		var byteString = atob(dataURL.replace(/^.*,/, '')),
			mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];

		var ab = new ArrayBuffer(byteString.length);
		var ia = new Uint8Array(ab);
		for (var i = 0; i < byteString.length; i++) {
			ia[i] = byteString.charCodeAt(i);
		}
		return ab;
	}

	// Listen for a click on the camera icon. On that click, take a screenshot.
	chrome.browserAction.onClicked.addListener(function() {

		chrome.tabs.captureVisibleTab({format : "jpeg"}, function(screenshotUrl) {
			var connector = window.ws_connector,
				img;
			connector.connect(function () {
				console.log("connector connected");
			}, function () {
				console.log("connector closed");
			});
			
			img = document.createElement('img');
			img.onload = function (evt) {
				var buffer = dataURLtoArrayBuffer(screenshotUrl),
					metaData = {
						type : "image",
						posx : 0,
						posy : 0,
						width : img.naturalWidth,
						height: img.naturalHeight
					};

				connector.sendBinary(Command.AddContent, metaData, buffer, function(err, reply) {
					console.log("doneAddContent", err, reply);
					connector.close();
				});
			};
			img.src = screenshotUrl;
		});
	});
}(window.command));