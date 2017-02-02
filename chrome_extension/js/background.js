
(function (Command) {
	var reconnectTimeout = 1000,
		id = 100,
		autoUpdateHandles = {},
		captureTabs = {},
		currentIntervalHandle = null,
		currentTabID = null,
		isDisconnect = true, // 再接続しない切断状態の場合true
		wsclient = null,
		connector;

	function connect(callback) {
		if (!connector) {
			connector = window.ws_connector;
		}
		console.log("connect");
		wsclient = connector.connect(function () {
				console.log("websocket open");
				isDisconnect = false;
				if (callback) {
					callback();
				}
			}, (function () {
				return function (ev) {
					console.error('websocket closed', ev);
					stopInterval();
					if (!isDisconnect) {
						setTimeout(function () {
							console.error('websocket try connect');
							connect();
							resumeAutoCapture(currentTabID);
						}, reconnectTimeout);
					}
				};
			}()));
	}

	function setURL(url) {
		if (connector && connector.getURL() !== url) {
			isDisconnect = true;
			if (isDisconnect && wsclient) {
				wsclient.close();
				wsclient = null;
			}
			console.log("setURL", url);
			connector.setURL(url);
			connect();
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

	var canSend = true;
	function capture(option, tabId) {
		if (canSend && !isDisconnect) {
			chrome.tabs.captureVisibleTab({format : "jpeg"}, (function (tabId) {
				return function(screenshotUrl) {
					var img;
					img = document.createElement('img');
					img.onload = function (evt) {
						if (canSend && !isDisconnect) {
							var buffer = dataURLtoArrayBuffer(screenshotUrl),
								metaData = {
									id : "chrome_extension_" + tabId,
									content_id : "chrome_extension_" + tabId, 
									type : "image",
									orgWidth : img.width,
									orgHeight : img.height
								};

							console.log("capture", metaData);
							if (captureTabs.hasOwnProperty(tabId)) {
								canSend = false;
								connector.sendBinary(Command.AddContent, metaData, buffer, function(err, reply) {
									console.log("doneAddContent", err, reply);
									canSend = true;
								});
							}
						}
					};
					img.src = screenshotUrl;
				}
			}(tabId)));
		}
	}

	// キャプチャーを削除.
	function deleteCapture(tabId) {
		var connector = window.ws_connector;
		if (!canSend) {
			setTimeout( function () { deleteCapture(tabId); }, 100);
			return;
		}
		connector.send(Command.DeleteContent, [{
			id : "chrome_extension_" + tabId,
			content_id : "chrome_extension_" + tabId,
			visible : false
		}], function (err, reply) {
			console.log("delete capture", err, reply);
		});
	}

	// タブの自動更新を開始.
	function startAutoCapture(option, tabId) {
		console.log("startAutoCapture", option, option.hasOwnProperty("interval"));
		if (!option.hasOwnProperty("interval")) {
			return false;
		}

		currentIntervalHandle = setInterval(function () {
			console.log("autocapture!");
			capture(option, tabId);
		}, Number(option.interval) * 1000);
		autoUpdateHandles[tabId] = currentIntervalHandle;

		chrome.browserAction.setIcon({
			path : "../img/chowder2.png",
			tabId : tabId
		});
		return true;
	}

	function stopInterval() {
		console.log("stopInterval");
		if (currentIntervalHandle) {
			clearInterval(currentIntervalHandle);
			currentIntervalHandle = null;
		}
	}

	// タブの自動更新を停止.
	function stopAutoCapture(tabId) {
		console.log("stopAutoCapture");
		if (currentIntervalHandle === autoUpdateHandles[tabId]) {
			isDisconnect = true;
			canSend = true;
			stopInterval();
		}
		if (autoUpdateHandles.hasOwnProperty(tabId)) {
			delete autoUpdateHandles[tabId];
			
			chrome.browserAction.setIcon({
				path : "../img/chowder.png",
				tabId : tabId
			});
		}
	}

	// タブの自動更新を再起動.
	function resumeAutoCapture(tabId) {
		console.log("resumeAutoCapture", tabId)
		window.options.restore(function (items) {
			stopInterval();
			console.log("autoUpdateHandles", autoUpdateHandles, tabId)
			if (autoUpdateHandles.hasOwnProperty(tabId)) {
				startAutoCapture(items, tabId);
			}
		});
	}

	function getCurrentTabID(windowId, callback) {
		// 取得するタブの条件
		var queryInfo = {
			active: true,
			currentWindow: true
		};
		chrome.tabs.query(queryInfo, function (result) {
			// 配列の先頭に現在タブの情報が入っている
			if (result.length > 0) {
				console.log("getCurrentTabID", result[0].id)
				callback(result[0].id);
			}
		});
	}

	function sendAutoUpdateChanged(tabId) {
		var hasAutoUpdate = false;
		
		chrome.runtime.sendMessage({
			jsonrpc: '2.0',
			type : 'utf8',
			method: "is_autocapture",
			param : autoUpdateHandles.hasOwnProperty(tabId)
		}, function(response) {
		});
	}

	// フロントからのメッセージ
	chrome.runtime.onMessage.addListener(function (message, sender) {
		console.log(message);
		getCurrentTabID(sender.id, function (tabId) {
			if (currentTabID == null) {
				currentTabID = tabId;
			}
			if (isDisconnect) {
				console.log("connect");
				connect();
			}
			if (message.method === "connect") {
				console.error("connect")
				sendAutoUpdateChanged(tabId);
			}
			else if (message.method === "capture") {
				console.log("currentTabID", currentTabID, tabId);
				window.options.restore(function (items) {
					console.log("option", items);
					capture(items, tabId);
					captureTabs[tabId] = 1;
				});
			} else if (message.method === "start_autocapture") {
				console.log("autocapture")
				window.options.restore(function (items) {
					console.log("option", items);
					startAutoCapture(items, tabId);
					captureTabs[tabId] = 1;
					sendAutoUpdateChanged(tabId);
				});
			} else if (message.method === "stop_autocapture") {
				console.log("stop_autocapture")
				stopAutoCapture(tabId);
				sendAutoUpdateChanged(tabId);
			} else if (message.method === "setting_updated") {
				window.options.restore(function (items) {
					setURL(items.url);
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

	chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
		console.log("onUpdated", tabId);
		currentTabID = tabId;
		resumeAutoCapture(tabId);
	});

	// ウィンドウが変更された
	chrome.windows.onFocusChanged.addListener(function  (windowId) {
		if (windowId === chrome.windows.WINDOW_ID_NONE) {
			// フォーカスが外れた
			stopInterval();
			getCurrentTabID(windowId, function (tabId) {
				console.log("onFocusOut", windowId, tabId);
				currentTabID = tabId;
				resumeAutoCapture(tabId);
			});
		} else {
			getCurrentTabID(windowId, function (tabId) {
				console.log("onFocusChanged", windowId, tabId);
				currentTabID = tabId;
				resumeAutoCapture(tabId);
			});
		}
	});

	// ページを閉じた
	function closePage(tabId, removeInfo) {
		console.log("close tab id", tabId, currentTabID);
		if (isDisconnect) {
			connect(function () {
				closePage(tabId, removeInfo);
			});
			return;
		}
		// 閉じたタブが自動更新中だった場合、更新停止.
		stopAutoCapture(tabId);

		// 閉じたタブの画像が登録されていた場合、画像削除.
		if (captureTabs.hasOwnProperty(tabId)) {
			delete captureTabs[tabId];
			deleteCapture(tabId);
		}
		if (isDisconnect && wsclient) {
			wsclient.close();
			wsclient = null;
		}
	}

	// ページを閉じた
	chrome.tabs.onRemoved.addListener(closePage);

	//https://bugs.chromium.org/p/chromium/issues/detail?id=30885
	// 	No way to detect when the browser is closed
	
}(window.command));