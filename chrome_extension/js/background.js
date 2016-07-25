
(function (Command) {
	var id = 100,
		autoUpdateHandles = {},
		currentIntervalHandle = null,
		currentTabID = null,
		connector;

	function connect() {
		connector = window.ws_connector;
		if (!connector.isConnected()) {
			connector.connect(function () {
				console.log("connector connected");
			}, function () {
				console.log("connector closed");
			});
		}
	}
	
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

	function capture(option) {
		chrome.tabs.captureVisibleTab({format : "jpeg"}, function(screenshotUrl) {
			var img;
			
			img = document.createElement('img');
			img.onload = function (evt) {
				var buffer = dataURLtoArrayBuffer(screenshotUrl),
					metaData = {
						id : currentTabID,
						type : "image",
						posx : 0,
						posy : 0,
						width : img.naturalWidth,
						height: img.naturalHeight
					};

					console.log("tabIDaaa", metaData)

				connect();
				connector.sendBinary(Command.AddContent, metaData, buffer, function(err, reply) {
					console.log("doneAddContent", err, reply);
				});
			};
			img.src = screenshotUrl;
		});
	}

	// キャプチャーを削除.
	function deleteCapture(tabId) {
		var connector = window.ws_connector;
		connect();
		connector.send(Command.DeleteContent, {
			id : tabId,
			visible : false
		}, function (err, reply) {
			console.log("delete capture", err, reply);
		});
	}

	// タブの自動更新を開始.
	function startAutoCapture(option, tabId) {
			console.log("autocapture!a", option, option.hasOwnProperty("interval"));
		if (!option.hasOwnProperty("interval")) {
			return false;
		}

		currentIntervalHandle = setInterval(function () {
			console.log("autocapture!");
			capture(option);
		}, Number(option.interval) * 1000);

		return true;
	}

	// タブの自動更新を停止.
	function stopAutoCapture() {
		if (currentIntervalHandle) {
			clearInterval(currentIntervalHandle);
		}
	}

	// タブの自動更新を再起動.
	function resumeAutoCapture(tabId) {
		window.options.restore(function (items) {
			stopAutoCapture();
			if (autoUpdateHandles.hasOwnProperty(tabId)) {
				startAutoCapture(option, tabId);
			}
		});
	}

	function getCurrentTabID(windowId, callback) {
		// 取得するタブの条件
		var queryInfo = {
			active: true,
			windowId: chrome.windows.WINDOW_ID_CURRENT
		};
		chrome.tabs.query(queryInfo, function (result) {
			// 配列の先頭に現在タブの情報が入っている
			if (result.length > 0) {
				callback(result[0].id);
			}
		});
	}

	// フロントからのメッセージ
	chrome.runtime.onMessage.addListener(function (message, sender) {
		console.log(message);
		getCurrentTabID(sender.id, function (tabId) {
			if (currentTabID == null) {
				currentTabID = tabId;
			}
			if (message.method === "connect") {
				console.log("connect");
				connect();
			} else if (message.method === "capture") {
				console.log("currentTabID", currentTabID, tabId);
				window.options.restore(function (items) {
					console.log("option", items);
					capture(items);
				});
			} else if (message.method === "autocapture") {
				console.log("autocapture")
				window.options.restore(function (items) {
					console.log("option", items);
					startAutoCapture(items, tabId);
				});
			} else if (message.method === "setting_updated") {
				window.options.restore(function (items) {
					resumeAutoCapture(tabId);
				});
			}
		});
	});

	// タブが変更された
	chrome.tabs.onActivated.addListener(function (activeInfo) {
		console.log("onactivated", activeInfo);
		currentTabID = activeInfo.tabId;
		resumeAutoCapture(activeInfo.tabId);
	});

	// ウィンドウが変更された
	chrome.windows.onFocusChanged.addListener(function  (windowId) {
		if (windowId >= 0) {
			console.log("onFocusChanged", windowId);
			getCurrentTabID(windowId, function (tabId) {
				currentTabID = tabId;
				resumeAutoCapture(tabId);
			});
		}
	});

	// ページを閉じた
	chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
		console.log("close tab id", tabId);
		if (tabId === currentTabID) {
			stopAutoCapture();
		}
		if (autoUpdateHandles.hasOwnProperty(tabId)) {
			delete autoUpdateHandles[tabId];
		}
		deleteCapture(tabId);
	});

	//https://bugs.chromium.org/p/chromium/issues/detail?id=30885
	// 	No way to detect when the browser is closed
	
}(window.command));