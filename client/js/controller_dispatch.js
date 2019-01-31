
/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

(function (content_property, vscreen, vscreen_util, manipulator, connector) {

	/**
	 * エレメント間でコンテントデータをコピーする.
	 */
	function copyContentData(store, fromElem, toElem, metaData, isListContent) {
		store.for_each_metadata(function (id, meta) {
			var elem;
			if (id !== metaData.id) {
				if (meta.content_id === metaData.content_id) {
					if (isListContent) {
						elem = gui.get_list_elem(id);
						if (elem) {
							elem = elem.childNodes[0];
						}
					} else {
						elem = document.getElementById(id);
					}
					if (elem && toElem) {
						if (metaData.type === 'text' || metaData.type === 'layout') {
							if (elem.innerHTML !== "") {
								toElem.innerHTML = elem.innerHTML;
							}
						} else if (elem.src) {
							toElem.src = elem.src;
						}
						if (!isListContent) {
							vscreen_util.assignMetaData(toElem, metaData, true, store.get_group_dict());
						}
					}
					if (elem && fromElem) {
						if (metaData.type === 'text' || metaData.type === 'layout') {
							elem.innerHTML = fromElem.innerHTML;
						} else {
							elem.src = fromElem.src;
						}
					}
				}
			}
		});
	}

	function initGUIEvents(controller, gui, store, state, management, login) {

		/**
		 * マウスイベントの登録
		 */
		gui.on('mousemove', controller.onMouseMove);
		gui.on('mouseup', controller.onMouseUp);

		/**
		 * Displayを削除するボタンが押された.
		 * @method on_deletedisplay_clicked
		 */
		gui.on("deletedisplay_clicked", function (err) {
			var metaDataList = [];

			state.for_each_selected_id(function (i, id) {
				if (store.has_metadata(id)) {
					metaDataList.push(store.get_metadata(id));
				}
			});
			if (metaDataList.length > 0) {
				connector.send('DeleteWindowMetaData', metaDataList, function () { });
			}
		});

		/**
		 * Layoutを削除するボタンが押された.
		 * @method on_deletedisplay_clicked
		 */
		gui.on("deletelayout_clicked", function (err) {
			var metaDataList = [];
			state.for_each_selected_id(function (i, id) {
				if (store.has_metadata(id)) {
					metaDataList.push(store.get_metadata(id));
				}
			});
			if (metaDataList.length > 0) {
				connector.send('DeleteContent', metaDataList, controller.doneDeleteContent);
			}
		});

		/**
		 * Group内のコンテンツ全て削除.
		 */
		gui.on("deleteallcontent_clicked", function (err) {
			var selectedGroup = gui.get_current_group_id(),
				targetList = [];

			if (selectedGroup) {
				store.for_each_metadata(function (i, metaData) {
					if (Validator.isContentType(metaData)) {
						if (metaData.group === selectedGroup) {
							targetList.push(metaData);
						}
					}
				});
			}
			if (targetList.length > 0) {
				connector.send('DeleteContent', targetList, controller.doneDeleteContent);
			}
		});

		/**
		 * Show Display ID ボタンが押された.
		 * @method on_showidbutton_clicked
		 */
		gui.on("showidbutton_clicked", function (err, isAll) {
			var targetIDList = [];

			state.for_each_selected_id(function (i, id) {
				if (store.has_metadata(id) && Validator.isWindowType(store.get_metadata(id))) {
					targetIDList.push({ id: id });
				}
			});
			if (targetIDList.length > 0) {
				connector.send('ShowWindowID', targetIDList);
			}
		});

		/**
		 * VirualDisplay分割数変更
		 * @method on_change_whole_split
		 * @param {String} x x軸分割数
		 * @param {String} y y軸分割数
		 * @param {bool} withoutUpdate 設定後各Displayの更新をするかのフラグ
		 */
		content_property.on("change_whole_split", function (err, x, y, withoutUpdate) {
			var ix = parseInt(x, 10),
				iy = parseInt(y, 10),
				splitWholes,
				elem,
				i,
				wholes = vscreen.getSplitWholes(),
				previewArea = gui.get_display_preview_area();

			if (isNaN(ix) || isNaN(iy)) {
				return;
			}

			for (i in wholes) {
				if (wholes.hasOwnProperty(i)) {
					elem = document.getElementById(i);
					if (elem) {
						console.log("removeChildaa");
						previewArea.removeChild(elem);
					}
				}
			}

			vscreen.clearSplitWholes();
			vscreen.splitWhole(ix, iy);
			controller.setupSplit(vscreen.getSplitWholes());
			if (!withoutUpdate) {
				controller.updateScreen();
				controller.update_window_data();
			}
		});

		/**
		 * テキスト送信ボタンが押された.
		 * @param {Object} evt ボタンイベント.
		 */
		gui.on("textsendbutton_clicked", function (err, value, posx, posy, width, height) {
			var text = value;
			if (posx === 0 && posy === 0) {
				// メニューから追加したときなど. wholescreenの左上端に置く.
				posx = vscreen.getWhole().x;
				posy = vscreen.getWhole().y;
			}
			controller.send_text(text, { posx: posx, posy: posy, visible: true }, width, height);
		});

		/**
		 * URLデータ送信ボタンが押された.
		 * @method on_sendbuton_clicked
		 */
		gui.on("urlsendbuton_clicked", function (err, value) {
			console.log("sendurl");
			var previewArea = gui.get_content_preview_area();

			value = value.split(' ').join('');
			if (value.indexOf("http") < 0) {
				console.error(value)
				return;
			}

			try {
				value = decodeURI(value);
				controller.add_content({ type: "url", user_data_text: JSON.stringify({ text: value }) }, value);
			} catch (e) {
				console.error(e);
			}
		});

		/**
		 * 画像ファイルFileOpenハンドラ
		 * @method on_imagefileinput_changed
		 * @param {Object} evt FileOpenイベント
		 */
		gui.on("imagefileinput_changed", function (err, evt, posx, posy) {
			var files = evt.target.files,
				file,
				i,
				fileReader = new FileReader();

			var time = new Date().toISOString();
	
			if (posx === 0 && posy === 0) {
				// メニューから追加したときなど. wholescreenの左上端に置く.
				posx = vscreen.getWhole().x;
				posy = vscreen.getWhole().y;
			}

			fileReader.onload = (function (name) {
				return function (e) {
					var data = e.target.result,
						img;
					if (data && data instanceof ArrayBuffer) {
						controller.send_image(data, {
							posx: posx, posy: posy, visible: true,
							timestamp : time,
							user_data_text: JSON.stringify({ text: name })
						});
					}
				};
			}(files[0].name));
			for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
				if (file.type.match('image.*')) {
					fileReader.readAsArrayBuffer(file);
				}
			}
		});

		gui.on("videofileinput_changed", function (err, evt, posx, posy) {
			var files = evt.target.files,
				file,
				i,
				fileReader = new FileReader();

			if (posx === 0 && posy === 0) {
				// メニューから追加したときなど. wholescreenの左上端に置く.
				posx = vscreen.getWhole().x;
				posy = vscreen.getWhole().y;
			}

			fileReader.onload = (function (name) {
				return function (e) {
					var data = e.target.result,
						img;
					if (data && data instanceof ArrayBuffer) {
						var blob = new Blob([data], { type: "video/mp4" });
						controller.send_movie("file", blob, {
							group: gui.get_current_group_id(),
							posx: posx, posy: posy, visible: true,
							user_data_text: JSON.stringify({ text: name })
						});
					}
				};
			}(files[0].name));
			for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
				if (file.type.match('video.*')) {
					fileReader.readAsArrayBuffer(file);
				}
			}
		});

		gui.on("add_layout", function (err) {
			window.input_dialog.init_multi_text_input({
				name: i18next.t('add_layout_memo'),
				okButtonName: "OK"
			}, function (memo) {
				var id,
					metaData,
					layout = {
						contents: {}
					};

				// コンテンツのメタデータを全部コピー
				store.for_each_metadata(function (id, metaData) {
					if (Validator.isContentType(metaData)) {
						layout.contents[id] = metaData;
					}
				});

				layout = JSON.stringify(layout);
				controller.add_content({
					type: Constants.TypeLayout,
					user_data_text: JSON.stringify({ text: memo }),
					visible: false,
					group: gui.get_current_group_id()
				}, layout);
			});
		});

		gui.on("add_screenshare", function (err) {
			var request = { sources: ['screen', 'window', 'tab', 'audio'] };
			var userAgent = window.navigator.userAgent.toLowerCase();
			if (userAgent.indexOf('chrome') != -1) {
				// chrome
				window.input_dialog.text_input({
					name: i18next.t('input_extension_id'),
					okButtonName: "OK"
				}, function (extensionID) {
					console.log(extensionID);
					chrome.runtime.sendMessage(extensionID, request, function (response) {
						var target = {
							video: {
								mandatory: {
									chromeMediaSource: 'desktop',
									chromeMediaSourceId: response.streamId,
								}
							},
							audio: {
								mandatory: {
									chromeMediaSource: 'desktop',
									chromeMediaSourceId: response.streamId,
								}
							}
						};
						if (response && response.type === 'success') {
							navigator.getUserMedia(target, function (stream) {
								controller.send_movie("screen", stream, {
									group: gui.get_current_group_id(),
									posx: vscreen.getWhole().x, posy: vscreen.getWhole().y, visible: true
								});
							}, function (err) {
								console.error('Could not get stream: ', err);
							});
						} else {
							console.error('Could not get stream');
						}
					});
				});
			} else {
				var mediaConstraints = {
					video: {
						mediaSource: "screen"
					},
				};
				navigator.mediaDevices.getUserMedia(mediaConstraints).then(function (stream) {
					controller.send_movie("screen", stream, {
						group: gui.get_current_group_id(),
						posx: vscreen.getWhole().x, posy: vscreen.getWhole().y, visible: true
					});
				}).catch(function (err) {
					console.error('Could not get stream: ', err);
				});
			}
		});

		gui.on("add_camerashare", function (err) {
			var constraints = {video: true, audio: true};
			navigator.mediaDevices.getUserMedia(constraints).then(
				function (stream) {
					controller.send_movie("camera", stream, {
						group: gui.get_current_group_id(),
						posx: vscreen.getWhole().x, posy: vscreen.getWhole().y, visible: true
					});
				},
				function (err) {
					console.error('Could not get stream: ', err);
				});
		});

		gui.on("overwrite_layout", function (err) {
			var metaData,
				isLayoutSelected = false;

			state.for_each_selected_id(function (i, id) {
				if (store.has_metadata(id)) {
					metaData = store.get_metadata(id);
					if (Validator.isLayoutType(metaData)) {
						isLayoutSelected = true;
						return true;
					}
				}
			});
			if (!isLayoutSelected) {
				window.input_dialog.ok_input({
					name: i18next.t('select_target_layout')
				}, function () { });
				return;
			}
			window.input_dialog.okcancel_input({
				name: i18next.t('layout_overwrite_is_ok'),
				okButtonName: "OK"
			}, function (isOK) {
				if (isOK) {
					var metaDataList = [],
						layout = {
							contents: {}
						},
						layoutData;

					// コンテンツのメタデータを全部コピー
					store.for_each_metadata(function (id, metaData) {
						if (Validator.isContentType(metaData)) {
							layout.contents[id] = metaData;
						}
					});
					layoutData = JSON.stringify(layout);

					state.for_each_selected_id(function (i, id) {
						if (store.has_metadata(id)) {
							metaData = store.get_metadata(id);
							if (Validator.isLayoutType(metaData)) {
								controller.update_content(metaData, layoutData);
							}
						}
					});
				}
			});
		});

		function offsetX(eve) {
			return eve.offsetX || eve.pageX - eve.target.getBoundingClientRect().left;
		}
		function offsetY(eve) {
			return eve.offsetY || eve.pageY - eve.target.getBoundingClientRect().top;
		}

		/**
		 *  ファイルドロップハンドラ
		 * @param {Object} evt FileDropイベント
		 */
		gui.on('file_dropped', function (err, evt) {
			var rect = evt.target.getBoundingClientRect();
			var px = rect.left + offsetX(evt);
			var py = rect.top + offsetY(evt);

			var time = new Date().toISOString();

			var files = evt.dataTransfer.files;
			for (var i = 0; i < files.length; i ++) {
				(function () {
					var file = files[i];
					var reader = new FileReader();

					if (file.type.match('image.*')) {
						reader.onloadend = function (evt) {
							var data = evt.target.result;
							controller.send_image(data, { posx: px, posy: py, visible: true, timestamp : time});
						};
						reader.readAsArrayBuffer(file);

					} else if (file.type.match('text.*')) {
						reader.onloadend = function (evt) {
							var data = evt.target.result;
							controller.send_text(data, { posx: px, posy: py, visible: true });
						};
						reader.readAsText(file);

					} else if (file.type.match('video.*')) {
						reader.onloadend = function (evt) {
							var data = evt.target.result;
							//var blob = new Blob([data], { type: 'video/mp4' });
							controller.send_movie('file', data, {
								group: gui.get_current_group_id(),
								posx: px,
								posy: py,
								visible: true,
								user_data_text: JSON.stringify({ text:  file.name })
							});
						};
						reader.readAsArrayBuffer(file);
					} else if (file.type.match('application/pdf')) {
						reader.onloadend = function (evt) {
							var data = evt.target.result;
							controller.send_pdf(data, { posx: px, posy: py, visible: true });
						};
						reader.readAsArrayBuffer(file);
					}
				})();
			}
		});

		/**
		 * テキストファイルFileOpenハンドラ
		 * @method openText
		 * @param {Object} evt FileOpenイベント
		 */
		gui.on("textfileinput_changed", function (err, evt, posx, posy) {
			var files = evt.target.files,
				file,
				i,
				fileReader = new FileReader();

			if (posx === 0 && posy === 0) {
				// メニューから追加したときなど. wholescreenの左上端に置く.
				posx = vscreen.getWhole().x;
				posy = vscreen.getWhole().y;
			}

			fileReader.onloadend = function (e) {
				var data = e.target.result;
				if (data) {
					controller.send_text(data, { posx: posx, posy: posy, visible: true });
				}
			};
			for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
				if (file.type.match('text.*')) {
					fileReader.readAsText(file);
				}
			}
		});

		/**
		 * PDFファイルOpenハンドラ
		 */
		gui.on("pdffileinput_changed", function (err, evt, posx, posy) {
			var files = evt.target.files,
				file,
				i,
				fileReader = new FileReader();

			if (posx === 0 && posy === 0) {
				// メニューから追加したときなど. wholescreenの左上端に置く.
				posx = vscreen.getWhole().x;
				posy = vscreen.getWhole().y;
			}

			fileReader.onloadend = function (e) {
				var data = e.target.result;
				if (data) {
					controller.send_pdf(data, { posx: posx, posy: posy, visible: true });
				}
			};
			for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
				if (file.type.match('application/pdf')) {
					fileReader.readAsArrayBuffer(file);
				}
			}
		});

		/**
		 * 画像イメージ差し替えFileOpenハンドラ
		 * @method on_updateimageinput_changed
		 * @param {Object} evt FileOpenイベント
		 */
		gui.on("updateimageinput_changed", function (err, evt) {
			var files = evt.target.files,
				file,
				i,
				fileReader = new FileReader(),
				id = gui.get_update_content_id(),
				previewArea = gui.get_content_preview_area(),
				elem,
				metaData;

			fileReader.onloadend = function (e) {
				var buffer, blob, img;
				if (e.target.result) {
					if (!controller.checkCapacity(e.target.result.byteLength)) {
						return;
					}
			
					console.log("update_content_id", id);
					elem = document.getElementById(id);
					if (elem) {
						previewArea.removeChild(elem);
					}
					if (store.has_metadata(id)) {
						metaData = store.get_metadata(id);

						buffer = new Uint8Array(e.target.result);
						blob = new Blob([buffer], { type: "image/jpeg" });
						img = document.createElement('img');
						img.src = URL.createObjectURL(blob);
						img.className = "image_content";
						img.onload = (function (metaData) {
							return function () {
								metaData.type = "image";
								metaData.width = img.naturalWidth;
								metaData.height = img.naturalHeight;
								delete metaData.orgWidth;
								delete metaData.orgHeight;
								controller.update_content(metaData, e.target.result);
								URL.revokeObjectURL(img.src);
							};
						}(metaData));
					}
				}
			};
			for (i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
				if (file.type.match('image.*')) {
					fileReader.readAsArrayBuffer(file);
				}
			}
		});

		/**
		 * ディスプレイスケールが変更された.
		 */
		gui.on("display_scale_changed", function (err, displayScale) {
			manipulator.removeManipulator();
			vscreen.setWholeScale(displayScale, true);
			controller.getControllerData().setDisplayScale(displayScale);
			controller.updateScreen();
		});

		/**
		 * ディスプレイスケールが変更中（確定前）
		 */
		gui.on("display_scale_changing", function (err, displayScale) {
			manipulator.removeManipulator();
			vscreen.setWholeScale(displayScale, true);
			controller.updateScreen();
		});

		/**
		 * ディスプレイトランスが変更された.
		 */
		gui.on("display_trans_changed", function (err, dx, dy) {
			manipulator.removeManipulator();
			var center = vscreen.getCenter();
			var whole = vscreen.getWhole();

			vscreen.assignWhole(whole.orgW, whole.orgH, center.x + dx, center.y + dy, vscreen.getWholeScale());
			controller.updateScreen();
		});

		/**
		 * コンテンツの削除ボタンが押された.
		 * @method on_contentdeletebutton_clicked
		 */
		gui.on("contentdeletebutton_clicked", function (err, evt) {
			var metaData,
				metaDataList = [];

			state.for_each_selected_id(function (i, id) {
				if (store.has_metadata(id)) {
					metaData = store.get_metadata(id);
					if (!management.isEditable(metaData.group)) {
						// 編集不可コンテンツ
						return true;
					}
					metaData.visible = false;
					metaDataList.push(metaData);
				}
			});
			if (metaDataList.length > 0) {
				connector.send('DeleteContent', metaDataList, controller.doneDeleteContent);
			}
		});

		/**
		 * コンテンツのzindex変更が要求された
		 * @param {boolean} isFront 最前面に移動ならtrue, 最背面に移動ならfalse
		 */
		gui.on("content_index_changed", function (err, isFront) {
			var metaData,
				metaDataList = [];

			state.for_each_selected_id(function (i, id) {
				if (store.has_metadata(id)) {
					metaData = store.get_metadata(id);
					metaData.zIndex = store.get_zindex(metaData, isFront);
					metaDataList.push(metaData);
				}
			});
			if (metaDataList.length > 0) {
				controller.update_metadata_multi(metaDataList);
			}
		});

		/**
		 * コンテンツリストでセットアップコンテンツが呼ばれた
		 */
		content_list.on("setup_content", function (err, elem, uid) {
			controller.setupContent(elem, uid);
		});

		/**
		 * コンテンツリストでコピーコンテンツが呼ばれた
		 */
		content_list.on("copy_content", function (err, fromElem, toElem, metaData, isListContent) {
			copyContentData(store, fromElem, toElem, metaData, isListContent);
		});

		/**
		 * コンテンツリストでカメラ有効状態が変わった
		 */
		content_list.on("camera_onoff_changed", function (err, metaData) {
			if (metaData.hasOwnProperty("subtype")) {
				var isCameraOn = content_list.is_camera_on(metaData.id);
				var isMicOn = content_list.is_mic_on(metaData.id);
				controller.set_enable_video(metaData.id, isCameraOn, isMicOn);
			}
		});

		/**
		 * コンテンツリストでマイク有効状態が変わった
		 */
		content_list.on("mic_onoff_changed", function (err, metaData) {
			if (metaData.hasOwnProperty("subtype")) {
				var isCameraOn = content_list.is_camera_on(metaData.id);
				var isMicOn = content_list.is_mic_on(metaData.id);
				controller.set_enable_video(metaData.id, isCameraOn, isMicOn);
			}
		});

		/**
		 * レイアウトリストでセットアップコンテンツが呼ばれた
		 */
		layout_list.on("setup_layout", function (err, elem, uid) {
			controller.setupContent(elem, uid);
		});

		/**
		 * レイアウトリストでコピーコンテンツが呼ばれた
		 */
		layout_list.on("copy_layout", function (err, fromElem, toElem, metaData, isListContent) {
			copyContentData(store, fromElem, toElem, metaData, isListContent);
		});

		/**
		 * コンテンツビューでセットアップコンテンツが呼ばれた
		 */
		content_view.on("setup_content", function (err, elem, uid) {
			controller.setupContent(elem, uid);
		});

		/**
		 * コンテンツビューでコピーコンテンツが呼ばれた
		 */
		content_view.on("copy_content", function (err, fromElem, toElem, metaData, isListContent) {
			copyContentData(store, fromElem, toElem, metaData, isListContent);
		});

		/**
		 * コンテンツビューでinsertコンテンツが呼ばれた
		 */
		content_view.on("insert_content", function (err, area, elem) {
			controller.insertElementWithDictionarySort(area, elem);
		});

		/**
		 * コンテンツビューで強調トグルが必要になった
		 */
		content_view.on("toggle_mark", function (err, contentElem, metaData) {
			gui.toggle_mark(contentElem, metaData);
		});

		/**
		 * ウィンドウリストでセットアップコンテンツが呼ばれた
		 */
		window_list.on("setup_content", function (err, elem, uid) {
			controller.setupContent(elem, uid);
		});

		/**
		 * ウィンドウリストでスクリーン更新が呼ばれた
		 */
		window_view.on("update_screen", function (err, windowData) {
			controller.updateScreen(windowData);
		});

		/**
		 * PropertyのDisplayパラメータ更新ハンドル
		 * @method on_display_value_changed
		 */
		content_property.on("display_value_changed", function (err) {
			var whole = vscreen.getWhole(),
				wholeWidth = document.getElementById('whole_width'),
				wholeHeight = document.getElementById('whole_height'),
				wholeSplitX = document.getElementById('whole_split_x'),
				wholeSplitY = document.getElementById('whole_split_y'),
				w,
				h,
				s = Number(vscreen.getWholeScale()),
				ix = parseInt(wholeSplitX.value, 10),
				iy = parseInt(wholeSplitY.value, 10),
				cx = window.innerWidth / 2,
				cy = window.innerHeight / 2;

			if (!wholeWidth || !whole.hasOwnProperty('w')) {
				w = Constants.InitialWholeWidth;
			} else {
				w = parseInt(wholeWidth.value, 10);
				if (w <= 1) {
					wholeWidth.value = 100;
					w = 100;
				}
			}
			if (!wholeHeight || !whole.hasOwnProperty('h')) {
				h = Constants.InitialWholeHeight;
			} else {
				h = parseInt(wholeHeight.value, 10);
				if (h <= 1) {
					wholeHeight.value = 100;
					h = 100;
				}
			}

			console.log("changeDisplayValue", w, h, s);
			if (w && h && s) {
				vscreen.assignWhole(w, h, cx, cy, s);
			}
			if (ix && iy) {
				vscreen.splitWhole(ix, iy);
			}
			controller.update_window_data();
			controller.updateScreen();
			content_property.update_whole_split(ix, iy, true);
		});

		/**
		 *  ディスプレイ枠色変更
		 */
		content_property.on("display_color_changed", function (err, colorvalue) {
			var id = state.get_selected_id(),
				metaData;
			if (store.has_metadata(id) && Validator.isWindowType(store.get_metadata(id))) {
				metaData = store.get_metadata(id);
				metaData.color = colorvalue;
				controller.update_metadata(metaData, function (err, reply) { });
			}
		});

		/**
		 * コンテンツ復元
		 */
		content_property.on("restore_content", function (err, restoreIndex) {
			window.input_dialog.yesnocancel_input({
				name: i18next.t('restore_content'),
				yesButtonName: i18next.t('restore'),
				noButtonName: i18next.t('restore_here'),
				cancelButtonName: "Cancel",
			}, function (res) {
				if (res === "yes" || res === "no") {
					var id = state.get_selected_id(),
						metaData;
					if (store.has_metadata(id) && Validator.isContentType(store.get_metadata(id))) {
						metaData = store.get_metadata(id);
						if (metaData.hasOwnProperty('backup_list') && metaData.backup_list.length >= restoreIndex) {
							metaData.restore_index = restoreIndex;
							connector.send('GetContent', metaData, function (err, reply) {
								if (reply.hasOwnProperty('metaData')) {
									if (Validator.isTextType(reply.metaData)) {
										metaData.user_data_text = JSON.stringify({ text: reply.contentData });
									}
									reply.metaData.restore_index = restoreIndex;
									if (res === "no") {
										reply.metaData.posx = metaData.posx;
										reply.metaData.posy = metaData.posy;
									}
									controller.update_metadata(reply.metaData);
									manipulator.removeManipulator();
								}
							});
						}
					}
				}
			});
		});

		/**
		 * 時系列データ復元
		 */
		content_property.on("restore_history_content", function (err, restoreKey, restoreValue) {
			var id = state.get_selected_id(),
				metaData;
			if (store.has_metadata(id) && Validator.isContentType(store.get_metadata(id))) {
				metaData = store.get_metadata(id);
				if (metaData.hasOwnProperty('history_data')) {
					var history_data = JSON.parse(metaData.history_data);
					if (history_data && history_data.hasOwnProperty(restoreKey)) {
						metaData.restore_key = restoreKey;
						metaData.restore_value = restoreValue;
						connector.send('GetContent', metaData, function (err, reply) {
							if (err) {
								console.error(err)
								return;
							}
							if (reply.hasOwnProperty('metaData')) {
								reply.metaData.restore_key = restoreKey;
								reply.metaData.restore_value = restoreValue;
								reply.metaData.posx = metaData.posx;
								reply.metaData.posy = metaData.posy;
								
								controller.update_metadata(reply.metaData);
								manipulator.removeManipulator();
							} else if (reply.hasOwnProperty('restore_key')) {
								reply.restore_key = restoreKey;
								reply.restore_value = restoreValue;
								reply.posx = metaData.posx;
								reply.posy = metaData.posy;
								controller.update_metadata(reply);
								manipulator.removeManipulator();
							}
						});
					}
				}
			}
		});

		/**
		 * 時系列データ同期
		 */
		content_property.on("sync_content", function (err, isSync) {
			var id = state.get_selected_id(),
				metaData;
			if (store.has_metadata(id) && Validator.isContentType(store.get_metadata(id))) {
				metaData = store.get_metadata(id);
				if (metaData.hasOwnProperty('history_data')) {
					metaData.history_sync = isSync;
					controller.update_metadata(metaData);
				}
			}
		});

		/**
		 * Virtual Dsiplay Settingボタンがクリックされた.
		 * @method on_virtualdisplaysetting_clicked
		 */
		gui.on("virtualdisplaysetting_clicked", function () {
			controller.unselect_all(true);
			controller.select(Constants.WholeWindowListID);
		});

		/**
		 * Group追加ボタンがクリックされた
		 */
		gui.on("group_append_clicked", function (err, groupName) {
			var groupColor = "rgb(" + Math.floor(Math.random() * 128 + 127) + ","
				+ Math.floor(Math.random() * 128 + 127) + ","
				+ Math.floor(Math.random() * 128 + 127) + ")";
			var metaData = { name: groupName, color: groupColor };

			// Displayタブの追加ボタン押したときはDisplayグループとして追加する
			if (Validator.isDisplayTabSelected()) {
				metaData.type = "display";
			} else {
				// それ以外のタブではContentグループ.
				metaData.type = "content";
			}

			connector.send('AddGroup', metaData, function (err, groupID) {
				// UserList再取得
				connector.send('GetUserList', {}, function (err, userList) {
					management.setUserList(userList);
				});
			});
		});

		/**
		 * Group削除ボタンがクリックされた
		 */
		gui.on("group_delete_clicked", function (err, groupID) {
			store.for_each_group(function (i, group) {
				if (group.id === groupID) {
					connector.send('DeleteGroup', group, function (err, reply) {
						console.log("DeleteGroup done", err, reply);
						var deleteList = [],
							id,
							metaData;
						console.log("UpdateGroup done", err, reply);
						if (!err) {
							// コンテンツも削除
							store.for_each_metadata(function (id, metaData) {
								if (Validator.isContentType(metaData) || Validator.isLayoutType(metaData)) {
									if (metaData.group === groupID) {
										deleteList.push(metaData);
									}
								}
							});
							if (deleteList.length > 0) {
								connector.send('DeleteContent', deleteList, controller.doneDeleteContent);
							}
						}
						// UserList再取得
						connector.send('GetUserList', {}, function (err, userList) {
							management.setUserList(userList);
						});
					});
					return true; // break
				}
			});
		});

		/**
		 * Group変更がクリックされた
		 * @param {String} groupID 変更先のグループID
		 */
		gui.on("group_change_clicked", function (err, groupID) {
			var targetMetaDataList = [],
				group,
				metaData;

			state.for_each_selected_id(function (i, id) {
				if (store.has_metadata(id)) {
					metaData = store.get_metadata(id);
					metaData.group = groupID;

					store.for_each_group(function (k, group_) {
						if (group_.id === groupID) {
							targetMetaDataList.push(metaData);
							group = group_;
							return true; // break
						}
					});
				}
			});

			if (targetMetaDataList.length > 0) {
				controller.update_metadata_multi(targetMetaDataList, (function (group) {
					return function (err, data) {
						connector.send('UpdateGroup', group, function (err, reply) {
						});
					};
				}(group)));
			}
		});

		gui.on('control_videos_clicked', function (err) {
			document.getElementById( 'video_controller' ).style.display = 'block';
		});

		gui.on('video_controller_rewind_clicked', function (err) {
			var groupID = gui.get_current_group_id();
			var sendIds = [];
			store.for_each_metadata(function (id, metaData) {
				if (Validator.isContentType(metaData) || Validator.isLayoutType(metaData)) {
					if (
						(metaData.group === groupID) &&
						(metaData.type === 'video')
					) {
						sendIds.push(metaData.id);
					}
				}
			});

			if (sendIds.length !== 0) {
				connector.send('SendMessage', {ids: sendIds, command: 'rewindVideo'}, function (err, reply) {
					// do nothing
				}.bind(this));
			}
		});

		gui.on('video_controller_play_clicked', function (err, play) {
			var groupID = gui.get_current_group_id();
			var sendIds = [];
			store.for_each_metadata(function (id, metaData) {
				if (Validator.isContentType(metaData) || Validator.isLayoutType(metaData)) {
					if (
						(metaData.group === groupID) &&
						(metaData.type === 'video')
					) {
						sendIds.push(metaData.id);
					}
				}
			});

			if (sendIds.length !== 0) {
				connector.send('SendMessage', {ids: sendIds, command: 'playVideo', play: play}, function (err, reply) {
					// do nothing
				}.bind(this));
			}
		});

		gui.on("select_contents_clicked", function (err, onlyCurrentGroup) {
			var currentGroup = gui.get_current_group_id();

			controller.unselect_all(true);
			store.for_each_metadata(function (id, meta) {
				if (Validator.isContentType(meta)) {
					if (onlyCurrentGroup) {
						if (meta.group === currentGroup) {
							controller.select(id, true);
						}
					} else {
						controller.select(id, true);
					}
				}
			});
		});

		gui.on("select_display_clicked", function (err, onlyCurrentGroup) {
			var currentGroup = gui.get_current_display_group_id();
			var i,
				id;
			controller.unselect_all(true);
			store.for_each_metadata(function (id, meta) {
				if (Validator.isWindowType(meta)) {
					if (onlyCurrentGroup) {
						if (Validator.isVisibleWindow(meta)) {
							controller.select("onlist:" + id, true);
						}
					} else {
						controller.select("onlist:" + id, true);
					}
				}
			});
		});

		gui.on('select_layout_clicked', function (err, onlyCurrentGroup) {
			var currentGroup = gui.get_current_group_id();
			var i,
				id;
			controller.unselect_all(true);
			store.for_each_metadata(function (id, meta) {
				if (Validator.isLayoutType(meta)) {
					if (onlyCurrentGroup) {
						if (Validator.isVisibleWindow(meta)) {
							controller.select("onlist:" + id, true);
						}
					} else {
						controller.select("onlist:" + id, true);
					}
				}
			});
		});

		/**
		 * Groupの選択が変更された
		 */
		gui.on("group_select_changed", function (err, groupID) {
			if (gui.is_active_tab(Constants.TabIDDisplay)) {
				connector.send('GetVirtualDisplay', {group : groupID}, function (err, data) {
					state.set_display_selected_group(groupID);
					controller.removeVirtualDisplay();
					controller.doneGetVirtualDisplay(err, data);
					controller.unselect_all();
					controller.select('whole_window_' + groupID, true)
				});
			}
		});

		// /**
		//  * Groupのチェックが変更された
		//  */
		// gui.on("group_check_changed", function (err, groupID, checked) {
		// 	if (gui.is_active_tab(Constants.TabIDDisplay)) {
		// 		controller.getControllerData().setGroupCheck(groupID, checked);
		// 		controller.updateScreen();
		// 	}
		// });

		/**
		 * Groupを１つ下に
		 * @param {String} groupID 変更先のグループID
		 */
		gui.on("group_down", function (err, groupID) {
			var iterateGroupFunc = store.for_each_content_group.bind(store),
				targetGroupList = store.get_content_group_list();
			if (Validator.isDisplayTabSelected()) {
				iterateGroupFunc = store.for_each_display_group.bind(store);
				targetGroupList = store.get_display_group_list();
			}
			iterateGroupFunc(function (i, group) {
				var target;
				if (group.id === groupID && groupID !== Constants.DefaultGroup) {
					if (i > 0 && i < (targetGroupList.length - 1)) {
						target = {
							id: group.id,
							index: i + 2
						};
						connector.send('ChangeGroupIndex', target, function (err, reply) {
							if (err) { console.error(err); }
							console.log("ChangeGroupIndex done", err, reply);
						});
						return true;
					}
				}
			});
		});

		/**
		 * Groupを１つ上に
		 * @param {String} groupID 変更先のグループID
		 */
		gui.on("group_up", function (err, groupID) {
			var iterateGroupFunc = store.for_each_content_group.bind(store),
				targetGroupList = store.get_content_group_list();
			if (Validator.isDisplayTabSelected()) {
				iterateGroupFunc = store.for_each_display_group.bind(store);
				targetGroupList = store.get_display_group_list();
			}
			iterateGroupFunc(function (i, group) {
				var target;
				if (group.id === groupID && groupID !== Constants.DefaultGroup) {
					if (i > 1 && i <= (targetGroupList.length - 1)) {
						target = {
							id: group.id,
							index: i - 1
						};
						connector.send('ChangeGroupIndex', target, function (err, reply) {
							if (err) { console.error(err); }
							console.log("ChangeGroupIndex done", err, reply);
						});
						return true;
					}
				}
			});
		});

		/**
		 * Group名変更
		 */
		gui.on("group_edit_name", function (err, groupID, groupName) {
			store.for_each_group(function (i, group) {
				var oldName;
				if (group.id === groupID) {
					oldName = group.name;
					group.name = groupName;
					connector.send('UpdateGroup', group, (function (oldName, newName) {
						return function (err, reply) {
							var id,
								metaData;
							console.log("UpdateGroup done", err, reply);
							if (!err) {
								// グループリスト更新
								connector.send('GetUserList', {}, function (err, userList) {
									management.setUserList(userList);
								});
							}
						};
					}(oldName, groupName)));
				}
			});
		});

		/**
		 * Group色変更
		 */
		gui.on("group_edit_color", function (err, groupID, color) {
			store.for_each_group(function (i, group) {
				if (group.id === groupID) {
					group.color = color;
					connector.send('UpdateGroup', group, function (err, reply) {
					});
					return true;
				}
			});
		});

		/**
		 * Searchテキストが入力された
		 */
		gui.on("search_input_changed", function (err, text, groups) {
			var i,
				foundContents = [],
				groupDict = {},
				elem,
				copy,
				child;

			store.for_each_group(function (i, group) {
				groupDict[group.id] = group;
			});

			store.for_each_metadata(function (id, metaData) {
				if (Validator.isContentType(metaData)) {
					if (groups.indexOf(metaData.group) >= 0) {
						if (text === "" || JSON.stringify(metaData).indexOf(text) >= 0) {
							elem = document.getElementById("onlist:" + metaData.id);
							if (elem) {
								copy = elem.cloneNode();
								copy.id = "onsearch:" + metaData.id;
								child = elem.childNodes[0].cloneNode();
								child.innerHTML = elem.childNodes[0].innerHTML;
								copy.appendChild(child);
								controller.setupContent(copy, metaData.id);
								foundContents.push(copy);
							}
						}
					}
					else if (groups.indexOf(Constants.DefaultGroup) >= 0 && !groupDict.hasOwnProperty(metaData.group)) {
						elem = document.getElementById("onlist:" + metaData.id);
						if (elem) {
							copy = elem.cloneNode();
							copy.id = "onsearch:" + metaData.id;
							child = elem.childNodes[0].cloneNode();
							child.innerHTML = elem.childNodes[0].innerHTML;
							copy.appendChild(child);
							controller.setupContent(copy, metaData.id);
							foundContents.push(copy);
						}
					}
				}
			});
			gui.set_search_result(foundContents);
		});

		/**
		 * 選択中のコンテンツのzIndexを変更する
		 * @method on_change_zindex
		 * @param {String} index 設定するzIndex
		 */
		content_property.on("change_zindex", function (err, index) {
			var elem,
				metaData;

			state.for_each_selected_id(function (i, id) {
				metaData = store.get_metadata(id);
				elem = document.getElementById(id);
				if (metaData && elem) {
					elem.style.zIndex = index;
					metaData.zIndex = index;
					controller.update_metadata(metaData);
					console.log("change zindex:" + index, id);
				}
			});
		});

		/**
		 * タブが切り替えられた.
		 */
		gui.on("tab_changed_pre", function () {
			manipulator.removeManipulator();
			controller.unselect_all(true);
		});

		gui.on("tab_changed_post", function () {
			var id;
			if (Validator.isDisplayTabSelected()) {
				gui.init_content_property("", null, "", Constants.PropertyTypeDisplay);
			} else if (Validator.isLayoutTabSelected()) {
				gui.init_content_property("", null, "", Constants.PropertyTypeLayout);
			} else {
				gui.init_content_property("", null, "", Constants.PropertyTypeContent);
			}
			if (Validator.isDisplayTabSelected()) {
				id = state.get_last_select_window_id();
				if (!id) {
					id = Constants.WholeWindowListID;
				}
				// スナップのdisplayを無効にする
				document.getElementById('snap_display_option').style.display = "none";
				
				gui.set_snap_type(controller.getControllerData().getSnapType(true));
			} else {
				id = state.get_last_select_content_id();
				// スナップのdisplayを有効にする
				document.getElementById('snap_display_option').style.display = "block";
				
				gui.set_snap_type(controller.getControllerData().getSnapType(false));
			}

			state.set_selected_id_list([]);
			// 以前選択していたものを再選択する.
			if (id) {
				controller.select(id, false);
			}
			state.set_dragging_id_list([]);
		});

		manipulator.on("mouse_down", function (err, evt) {
			var i,
				id,
				elem,
				rect = evt.target.getBoundingClientRect(),
				clientX = evt.clientX,
				clientY = evt.clientY;

			if (evt.changedTouches) {
				rect = evt.changedTouches[0].target.getBoundingClientRect();
				clientX = evt.changedTouches[0].clientX;
				clientY = evt.changedTouches[0].clientY;
			} else {
				rect = evt.target.getBoundingClientRect();
				clientX = evt.clientX;
				clientY = evt.clientY;
			}
			state.set_mousedown_pos([
				clientX,
				clientY
				]);

			for (i = 0; i < state.get_selected_id_list().length; ++i) {
				id = state.get_selected_id_list()[i];
				elem = document.getElementById(id);
				rect = elem.getBoundingClientRect();
				state.set_drag_rect(id, rect);
			}
			state.set_dragging_id_list([]);
		});

		/**
		 * マニピュレータの星がトグルされた
		 */
		manipulator.on("toggle_star", function (err, is_active) {
			var id = state.get_selected_id(),
				metaData;
			if (store.has_metadata(id)) {
				metaData = store.get_metadata(id);
				metaData.mark = is_active;
				controller.update_metadata(metaData);
			}
		});

		/**
		 * マニピュレータのmemoがトグルされた
		 */
		manipulator.on("toggle_memo", function (err, is_active) {
			var id = state.get_selected_id(),
				metaData;
			if (store.has_metadata(id)) {
				metaData = store.get_metadata(id);
				if (Validator.isWindowType(metaData)) {
					gui.toggle_display_id_show(false);
				} else {
					metaData.mark_memo = is_active;
					controller.update_metadata(metaData);
				}
			}
		});

		/**
		 * マニピュレータ: pdfページ送り
		 */
		manipulator.on('move_pdf_page', function (err, id, delta, func) {
			var metaData = store.get_metadata(id);
			var page = metaData.pdfPage ? parseInt(metaData.pdfPage) : 1;
			page = Math.min(Math.max(page + delta, 1), parseInt(metaData.pdfNumPages));
			metaData.pdfPage = page;
			controller.update_metadata(metaData);
			if (func) { func(page); }
		});

		/**
		 * マニピュレータ: pdfページ送り
		 */
		manipulator.on('play_video', function (err, id, play) {
			connector.send('SendMessage', {ids: [id], command: 'playVideo', play: play}, function (err, reply) {
				// do nothing
			});
		});

		/**
		 * orgWidth,orgHeightを元にアスペクト比を調整
		 * @method correctAspect
		 * @param {JSON} metaData メタデータ
		 * @param {Function} endCallback 終了時コールバック
		 */
		function correctAspect(metaData, endCallback) {
			var w, h, ow, oh,
				aspect, orgAspect,
				isCorrect = true;
			if (metaData.hasOwnProperty('orgWidth') && metaData.hasOwnProperty('orgHeight')) {
				if (metaData.hasOwnProperty('width') && metaData.hasOwnProperty('height')) {
					w = parseFloat(metaData.width);
					h = parseFloat(metaData.height);
					ow = parseFloat(metaData.orgWidth);
					oh = parseFloat(metaData.orgHeight);
					aspect = w / h;
					orgAspect = ow / oh;
					if (orgAspect !== aspect) {
						if (aspect > 1) {
							metaData.height = w / orgAspect;
						} else {
							metaData.width = h * orgAspect;
						}
						isCorrect = false;
						controller.update_metadata(metaData, function (err, metaData) {
							if (endCallback) {
								endCallback(err, metaData[0]);
							}
						});
					}
				}
			}
			if (isCorrect && endCallback) {
				endCallback(null, metaData);
			}
		}

		/** */
		///-------------------------------------------------------------------------------------------------------
		// メタデータが更新されたときにブロードキャストされてくる.
		connector.on("UpdateMetaData", function (data) {
			var i,
				elem,
				id,
				metaData;

			for (i = 0; i < data.length; ++i) {
				metaData = data[i];
				id = metaData.id;
				if (management.isViewable(metaData.group)) {
					if (id) {
						controller.doneGetMetaData(null, metaData);
						if (state.get_selected_id()) {
							elem = document.getElementById(state.get_selected_id());
							if (elem) {
								if (!state.is_selection_rect_shown()) {
									manipulator.moveManipulator(elem);
								}
							}
						}
					}
				}
			}
			if (state.is_selection_rect_shown() && data.length > 0) {
				controller.updateSelectionRect();
			}
		});

		// コンテンツが差し替えられたときにブロードキャストされてくる.
		connector.on('UpdateContent', function (metaData) {
			console.log('UpdateContent', metaData);
			var id = metaData.id;
			if (id) {
				connector.send('GetContent', metaData, function (err, reply) {
					if (reply.hasOwnProperty('metaData')) {
						if (store.has_metadata(metaData.id)) {
							correctAspect(reply.metaData, function (err, meta) {
								reply.metaData = meta;
								controller.doneGetContent(err, reply);
								controller.doneGetMetaData(err, meta);
							});
						}
					}
				});
			}
		});

		// windowが更新されたときにブロードキャストされてくる.
		connector.on("UpdateWindowMetaData", function (data) {
			console.log("onUpdateWindowMetaData", data);
			var i,
				elem,
				metaData;

			if (data instanceof Array) {
				for (i = 0; i < data.length; ++i) {
					metaData = data[i];
					controller.doneGetWindowMetaData(null, metaData);
					gui.change_window_border_color(metaData);
					if (state.get_selected_id()) {
						if (!state.is_selection_rect_shown()) {
							elem = document.getElementById(state.get_selected_id());
							manipulator.moveManipulator(elem);
						}
					}
				}
				if (state.is_selection_rect_shown() && data.length > 0) {
					controller.updateSelectionRect();
				}
			} else {
				metaData = data;
				controller.doneGetWindowMetaData(null, metaData);
				gui.change_window_border_color(metaData);
				if (state.get_selected_id()) {
					elem = document.getElementById(state.get_selected_id());
					manipulator.moveManipulator(elem);
				}
			}
		});

		// virtual displayが更新されたときにブロードキャストされてくる.
		connector.on("UpdateVirtualDisplay", function (data) {
			controller.removeVirtualDisplay();
			controller.doneGetVirtualDisplay(null, data);
		});

		// グループが更新されたときにブロードキャストされてくる.
		connector.on('UpdateGroup', function (metaData) {
			console.log("onUpdateGroup")
			controller.onUpdateAuthority(function () {
				controller.update_group_list();
			});
		});

		// すべての更新が必要なときにブロードキャストされてくる.
		connector.on('Update', function () {
			if (!store.is_initialized()) { return; }
			controller.reload_all();
		});

		// windowが更新されたときにブロードキャストされてくる.
		connector.on('UpdateMouseCursor', function (metaData) { });

		// コンテンツが削除されたときにブロードキャストされてくる.
		connector.on("DeleteContent", function (data) {
			console.log("onDeleteContent", data);
			var i;
			controller.doneDeleteContent(null, data);
		});

		// ウィンドウが削除されたときにブロードキャストされてくる.
		connector.on("DeleteWindowMetaData", function (metaDataList) {
			console.log("DeleteWindowMetaData", metaDataList);
			var i;
			for (i = 0; i < metaDataList.length; i = i + 1) {
				controller.doneDeleteWindowMetaData(null, metaDataList[i]);
			}
		});

		// Video Controllerで使う.
		connector.on('SendMessage', function (data) {
			if (data.command === 'playVideo') {
				data.ids.forEach(function (id) {
					var el = document.getElementById(id);
					if (el && el.play) {
						data.play ? el.play() : el.pause();

						var metaData = store.get_metadata(id);
						metaData.isPlaying = data.play;
						controller.update_metadata(metaData, function(err, reply) {
							// do nothing
						});
					}
				});
			}

			if (data.command === 'rewindVideo') {
				data.ids.forEach(function (id) {
					var el = document.getElementById(id);
					if (el && el.play) {
						el.currentTime = 0.0;
					}
				});
			}
		});

		// DB切り替え時にブロードキャストされてくる
		connector.on("ChangeDB", function () {
			if (!store.is_initialized()) { return; }
			window.location.reload(true);
		});

		// 権限変更時に送られてくる
		connector.on("ChangeAuthority", function (userID) {
			if (!store.is_initialized()) { return; }
			if (login.getLoginUserID() === userID) {
				window.location.reload(true);
			}
		});

		// 管理ページでの設定変更時にブロードキャストされてくる
		connector.on("UpdateSetting", function () {
			if (!store.is_initialized()) { return; }
			// ユーザーリスト再取得
			connector.send('GetUserList', {}, function (err, userList) {
				management.setUserList(userList);
			});
			connector.send('GetGlobalSetting', {}, function (err, reply) {
				if (reply && reply.hasOwnProperty('max_history_num')) {
					management.setMaxHistoryNum(reply.max_history_num);
					management.setCurrentDB(reply.current_db);
				}
			});
			connector.send('GetDBList', {}, function (err, reply) {
				if (!err) {
					gui.setDBList(reply);
					// 開きなおす
					management.close();
					management.removeListener('close');
					gui.openManagement();
				}
			});
		});

		// WebRTC接続要求が来た
		connector.on('RTCRequest', function (data) {
			var metaData = data.metaData;
			if (metaData.from === "controller") { return; }
			var key = null;
			try {
				keyStr = StringUtil.arrayBufferToString(data.contentData.data);
				key = JSON.parse(keyStr).key;
			}  catch (e) {
				console.error(e);
				return;
			}
			if (key) {
				// このコントローラが動画データを持っているか判別
				if (store.has_video_data(metaData.id)) {
					// webrtc接続開始
					controller.connect_webrtc(metaData, key);
				}
			}
		});

		// WebRTC切断要求が来た
		connector.on('RTCClose', function (data) {
			var metaData = data.metaData;
			if (metaData.from === "controller") { return; }
			var key = null;
			try {
				keyStr = StringUtil.arrayBufferToString(data.contentData.data);
				key = JSON.parse(keyStr).key;
			}  catch (e) {
				console.error(e);
				return;
			}
			if (key) {
				// このコントローラが接続を持っているか判別
				if (controller.webRTC && controller.webRTC.hasOwnProperty(key)) {
					controller.webRTC[key].close(true);
				}
			}
		});

		// WebRTCのAnswerが返ってきた
		connector.on("RTCAnswer", function (data) {
			var parsed = null;
			var answer = null;
			var key = null;
			try {
				var sdpStr = StringUtil.arrayBufferToString(data.contentData.data);
				parsed = JSON.parse(sdpStr);
				key = parsed.key;
				answer = parsed.sdp;
			} catch (e) {
				console.error(e);
				return;
			}
			if (controller.webRTC && controller.webRTC.hasOwnProperty(key)) {
				controller.webRTC[key].setAnswer(answer, function (e) {
					if (e) {
						console.error(e);
					}
				});
			}
		});

		connector.on("RTCIceCandidate", function (data) {
			var metaData = data.metaData;
			if (metaData.from == "controller") { return; }
			var contentData = data.contentData;
			var parsed = null;
			var candidate = null;
			var key = null;
			try {
				var dataStr = StringUtil.arrayBufferToString(contentData.data);
				parsed = JSON.parse(dataStr);
				key = parsed.key;
				candidate = parsed.candidate;
			} catch (e) {
				console.error(e);
				return;
			}
			if (controller.webRTC && controller.webRTC.hasOwnProperty(key)) {
				if (candidate) {
					controller.webRTC[key].addIceCandidate(candidate);
				}
			}
		});

		// プロパティの座標変更
		content_property.on("rect_changed", function (err, id, value) {
			console.log('on_rect_changed');
			controller.onChangeRect(id, parseInt(value, 10));
		});

		// メタ情報(メモ)変更.
		content_property.on("metainfo_changed", function (err, text, endCallback) {
			var id = state.get_selected_id(),
				newData,
				metaData;

			if (id && store.has_metadata(id)) {
				metaData = store.get_metadata(id);
				newData = JSON.stringify({ text: text });
				if (newData !== metaData.user_data_text) {
					metaData.user_data_text = newData;
					if (Validator.isTextType(metaData)) {
						// テキストのメモ変更.
						// テキストはコンテンツ部分にも同じテキストがあるので更新.
						var previewArea = gui.get_content_preview_area(),
							elem = document.createElement('pre');
						elem.className = "text_content";
						elem.innerHTML = text;
						previewArea.appendChild(elem);
						metaData.orgWidth = elem.offsetWidth / vscreen.getWholeScale();
						metaData.orgHeight = elem.offsetHeight / vscreen.getWholeScale();
						correctAspect(metaData, function () {
							//console.error("metaData", metaData)
							metaData.restore_index = -1;
							controller.update_content(metaData, text);
						})
						previewArea.removeChild(elem);
					} else if (Validator.isLayoutType(metaData)) {
						// レイアウトのメモ変更.
						// レイアウトコンテンツを取得し直しリストを更新する.
						controller.update_metadata(metaData, function (err, reply) {
							connector.send('GetContent', metaData, function (err, data) {
								controller.doneGetContent(err, data, endCallback);
							});
						});
					} else {
						// その他コンテンツのメモ変更.
						// リストの更新は必要なし
						controller.update_metadata(metaData, function (err, reply) {
							if (endCallback) {
								endCallback(null);
							}
						});
					}
				}
			} else {
				if (endCallback) {
					endCallback(null);
				}
			}
		});

		function restart_camera(metadataID) {
			var isCameraOn = content_list.is_camera_on(metadataID);
			var isMicOn = content_list.is_mic_on(metadataID);
			var audioDeviceID = content_property.get_audio_device_id();
			var videoDeviceID = content_property.get_video_device_id();
			var constraints = {};
			var saveDeviceID = {
				video_device : videoDeviceID,
				audio_device : audioDeviceID
			}
			if (videoDeviceID) {
				constraints.video = { deviceId : videoDeviceID }
			} else {
				constraints.video = true;
				saveDeviceID.video_device = true;
			}
			if (audioDeviceID) {
				constraints.audio = { deviceId : audioDeviceID }
			} else {
				constraints.audio = true;
				saveDeviceID.audio_device = true;
			}
			
			if (!constraints.video && !constraints.audio) {
				// どちらか有効にしないといけない
				constraints.audio = true;
				saveDeviceID.audio_device = audioDeviceID;
			}

			navigator.mediaDevices.getUserMedia(constraints).then(
				function (stream) {
					if (store.has_metadata(metadataID)) {
						// カメラマイク有効情報を保存
						var meta = store.get_metadata(metadataID)
						meta.video_device = this.video_device,
						meta.audio_device = this.audio_device,
						meta.is_video_on = isCameraOn,
						meta.is_audio_on = isMicOn,
						store.set_metadata(metadataID, meta)
					}
					controller.send_movie("camera", stream, {
						id : metadataID,
						group: gui.get_current_group_id(),
						posx: vscreen.getWhole().x, posy: vscreen.getWhole().y, visible: true
					}, function () {
					});
				}.bind(saveDeviceID),
				function (err) {
					console.error('Could not get stream: ', err);
				});
		}

		content_property.on("videodevice_changed", function (err, metadataID, deviceID) {
			if (store.has_video_elem(metadataID)) {
				restart_camera(metadataID);
			}
		});

		content_property.on("audiodevice_changed", function (err, metadataID, deviceID) {
			if (store.has_video_elem(metadataID)) {
				restart_camera(metadataID);
			}
		});

		content_property.on("videoquality_changed", function (err, metadataID, deviceID) {
			var k;
			if (store.has_video_elem(metadataID)) {
				var quality = {
					video_quality_enable : content_property.is_video_quality_enable(),
					audio_quality_enable : content_property.is_audio_quality_enable(),
					screen : content_property.get_video_quality(metadataID).min,
					video : content_property.get_video_quality(metadataID).min,
					audio : content_property.get_audio_quality(metadataID).min,
					video_max : content_property.get_video_quality(metadataID).max,
					audio_max : content_property.get_audio_quality(metadataID).max
				};
				if (quality.video_max < quality.video) {
					quality.video_max = quality.video;
				}
				if (quality.audio_max < quality.audio) {
					quality.audio_max = quality.audio;
				}
				if (!quality.video_quality_enable) {
					delete quality["screen"];
					delete quality["video"];
					delete quality["video_max"];
				}
				if (!quality.audio_quality_enable) {
					delete quality["audio"];
					delete quality["audio_max"];
				}
				if (Object.keys(quality).length === 0) {
					quality = null;
				}
				if (store.has_metadata(metadataID)) {
					var meta = store.get_metadata(metadataID);
					meta.quality = JSON.stringify(quality);
					controller.update_metadata(meta);
				}
			}
		});

		gui.on('update_cursor_enable', function (err, value) {
			controller.update_remote_cursor_enable(value);
		});
		
		gui.on('update_cursor_color', function (err, value) {
			controller.update_remote_cursor_color(value);
		});

		gui.on("mousedown_content_preview_area", function () {
			if (!manipulator.getDraggingManip()) {
				controller.unselect_all(true);
			}
		});

		gui.on("mousedown_display_preview_area", function () {
			if (!manipulator.getDraggingManip()) {
				controller.unselect_all(true);
			}
		});

		gui.on("close_item", function () {
			var metaData,
				elem,
				metaDataList = [];

			manipulator.removeManipulator();

			state.for_each_selected_id(function (i, id) {
				if (store.has_metadata(id)) {
					metaData = store.get_metadata(id);
					if (!management.isEditable(metaData.group)) {
						// 編集不可コンテンツ
						return;
					}
					metaData.visible = false;
					metaDataList.push(metaData);
				}
			});
			if (metaDataList.length > 0) {
				controller.update_metadata_multi(metaDataList);
			}
		});

		gui.on("controller_id_changed", function (err, id) {
			if (err || !id) {
				console.error(err, id);
				return;
			}
			login.changeControllerID(id);
		});
	}

	/**
	 * GUI/Dispacher/controller初期化
	 * @method init
	 */
	function init(controller, gui, store, state, management, login) {
		var timer = null,
			display_scale,
			snap,
			controllerData = controller.getControllerData();

		Management.initManagementEvents(connector, login, management);

		gui.init(management, controllerData);
		gui.set_controller_id(login.getControllerID());

		connector.send('GetDBList', {}, function (err, reply) {
			if (!err) {
				gui.setDBList(reply);
			}
		});

		display_scale = controllerData.getDisplayScale();
		snap = controllerData.getSnapType(Validator.isDisplayTabSelected());

		vscreen.setWholeScale(display_scale, true);
		gui.set_display_scale(display_scale);

		if (snap) {
			gui.set_snap_type(snap);
			//controllerData.setSnapType(Validator.isDisplayTabSelected(), snap);
		}
		document.getElementById('head_menu_hover_left').addEventListener('change', function (eve) {
			var f = eve.currentTarget.value;
			gui.set_snap_type(f);
			controllerData.setSnapType(Validator.isDisplayTabSelected(), f);
		}, false);

		// リモートカーソルの有効状態を更新
		controller.update_remote_cursor_enable(controllerData.isUpdateCursorEnable());

		gui.get_whole_scale = function () {
			return vscreen.getWholeScale();
		};

		window_view.init(vscreen);
		connector = window.ws_connector;
		manipulator.setCloseFunc(controller.onCloseContent);

		// gui events etc
		initGUIEvents(controller,  gui,store, state, management, login);

		// resize event
		window.onresize = function () {
			if (timer) {
				clearTimeout(timer);
			}
			timer = setTimeout(function () {
				var panel = document.getElementById('preview_area_panel__'),
					cx = (panel.getBoundingClientRect().right - panel.getBoundingClientRect().left) / 2,
					cy = (panel.getBoundingClientRect().bottom - panel.getBoundingClientRect().top) / 2 + 28,
					whole = vscreen.getWhole();

				vscreen.assignWhole(whole.orgW, whole.orgH, cx, cy, vscreen.getWholeScale());
				manipulator.removeManipulator();
				controller.updateScreen();
			}, 200);
		};

		controller.updateScreen();
		vscreen.dump();
		store.init();
	}

	window.ControllerDispatch = {
		init : init
	};
	///-------------------------------------------------------------------------------------------------------

}(content_property, window.vscreen, window.vscreen_util, window.manipulator, window.ws_connector));
