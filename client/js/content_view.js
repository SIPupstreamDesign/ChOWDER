/*jslint devel:true*/
(function () {
	"use strict";
	/**
	 * コンテンツを追加できるメインビュー
	 */
	
	var ContentView;

	ContentView = function () {
		EventEmitter.call(this);
	};
	ContentView.prototype = Object.create(EventEmitter.prototype);

	/**
	 * コンテンツタイプから適切なタグ名を取得する.
	 * @parma {String} contentType コンテンツタイプ
	 */
	function getTagName(contentType) {
		var tagName;
		if (contentType === 'text') {
			tagName = 'pre';
		} else if (contentType === 'video') {
			tagName = 'img'; // videoでvideoを保持してない場合用
		} else if (contentType === 'pdf') {
			tagName = 'canvas';
		} else if (contentType === 'tileimage') {
		 	tagName = 'div';
		} else {
			tagName = 'img';
		}
		return tagName;
	}

	/**
	 * コンテンツをメインビューにインポートする。
	 * doneGetContent時にコールされる。
	 * @method importContentToView
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	ContentView.prototype.import_content = function (gui, metaDataDict, metaData, contentData, groupDict, videoElem) {
		var previewArea = gui.get_content_preview_area(),
			id,
			contentElem,
			elem,
			tagName,
			blob,
			mime = "image/jpeg";
		
		if (Validator.isLayoutType(metaData)) {
			return;
		}
		
		// サムネイルなどの複数バイナリが入っている場合
		// contentData[0]はmetaDataのリスト.
		// contentData[1]はbinaryDataのリスト.
		// contentData[n][0]がコンテンツ本体
		if (contentData instanceof Array) {
			metaData = contentData[0][0];
			contentData = contentData[1][0];
		}

		//console.log("importContentToView:" + JSON.stringify(metaData));
		tagName = getTagName(metaData.type);
		
		// メタデータはGetMetaDataで取得済のものを使う.
		// GetContent送信した後にさらにGetMetaDataしてる場合があるため.
		if (metaDataDict.hasOwnProperty(metaData.id)) {
			metaData = metaDataDict[metaData.id];
		}
		
		if (document.getElementById(metaData.id)) {
			contentElem = document.getElementById(metaData.id);
		}
		
		if (!contentElem && !videoElem) {
			contentElem = document.createElement(tagName);
			contentElem.id = metaData.id;
			contentElem.style.position = "absolute";

			this.emit(ContentView.EVENT_SETUP_CONTENT, null, contentElem, metaData.id);
			this.emit(ContentView.EVENT_INSERT_CONTENT, null, previewArea, contentElem);
		}
		if (videoElem) {
			videoElem.id = metaData.id;
			videoElem.style.position = "absolute";
			videoElem.setAttribute('autoplay', '')
			videoElem.setAttribute("controls", "");
			videoElem.setAttribute("controlslist", "nodownload")
			videoElem.style.color = "white";
			this.emit(ContentView.EVENT_SETUP_CONTENT, null, videoElem, metaData.id);
			this.emit(ContentView.EVENT_INSERT_CONTENT, null, previewArea, videoElem);
		}

		console.log("id=" + metaData.id);
		if (contentData) {
			if (metaData.type === 'text') {
				// contentData is text
				contentElem.innerHTML = contentData;
				contentElem.style.color = "white";
				contentElem.style.overflow = "visible"; // Show all text
				vscreen_util.assignMetaData(contentElem, metaData, true, groupDict);
			} else if (metaData.type === 'video') {
				//contentElem.src = contentData;
				if (videoElem) {
					vscreen_util.assignMetaData(videoElem, metaData, true, groupDict);
				} else {
					contentElem.src = contentData;
					contentElem.onload = function () {
						if (metaData.width < 10) {
							console.log("naturalWidth:" + contentElem.naturalWidth);
							metaData.width = contentElem.naturalWidth;
						}
						if (metaData.height < 10) {
							console.log("naturalHeight:" + contentElem.naturalHeight);
							metaData.height = contentElem.naturalHeight;
						}
						vscreen_util.assignMetaData(contentElem, metaData, true,groupDict);
					};
				}
			} else if (metaData.type === 'pdf') {
				vscreen_util.assignMetaData(contentElem, metaData, true, groupDict);

				if (!contentElem.pdfSetupCompleted) {
					contentElem.pdfSetupCompleted = true;
					var context = contentElem.getContext('2d');

					var pdfjsLib = window['pdfjs-dist/build/pdf'];

					pdfjsLib.getDocument(contentData).then(function (pdf) {
						metaData.pdfPage = parseInt(metaData.pdfPage) || 1;
						metaData.pdfNumPages = pdf.numPages;

						var lastTask = Promise.resolve();
						var lastDate = 0;
						var lastPage = 0;
						var lastWidth = 0;
						contentElem.loadPage = function (p, width) {
							var date = Date.now();
							lastDate = date;

							if (lastPage === p && lastWidth === width) { return; }

							setTimeout(function () {
								if (lastDate !== date) { return; }
								lastPage = p;
								lastWidth = width;

								pdf.getPage(p).then(function (page) {
									var viewport = page.getViewport(width / page.getViewport(1).width);
			
									contentElem.width = viewport.width;
									contentElem.height = viewport.height;

									lastTask = lastTask.then(function () {
										return page.render({
											canvasContext: context,
											viewport: viewport
										});
									});
								});
							}, lastPage === p ? 500 : 0);
						};
						contentElem.loadPage(parseInt(metaData.pdfPage), parseInt(metaData.width));
					});
				}
			} else if (metaData.type === Constants.TypeTileImage) {
				if (metaData.hasOwnProperty('mime')) {
					mime = metaData.mime;
					console.log("mime:" + mime);
				}
				blob = new Blob([contentData], {type: mime});
				if (contentElem && blob) {
					// アイコンを設置
					if (contentElem.getElementsByClassName('tileimage_icon').length === 0) {
						var icon = document.createElement('div');
						icon.className = 'tileimage_icon';
						contentElem.appendChild(icon);
						icon.title = "Tiled Image";
					}

					var img = contentElem.getElementsByTagName('img')[0];
					if (img) {
						URL.revokeObjectURL(img.src);
						contentElem.removeChild(img);
					}

					var image = document.createElement('img');
					contentElem.appendChild(image);
					
					image.src = URL.createObjectURL(blob);
					image.style.width = "100%";
					image.style.height = "100%";

					image.onload = function () {
						if (metaData.width < 10) {
							console.log("naturalWidth:" + image.naturalWidth);
							metaData.width = image.naturalWidth;
						}
						if (metaData.height < 10) {
							console.log("naturalHeight:" + image.naturalHeight);
							metaData.height = image.naturalHeight;
						}
						vscreen_util.assignMetaData(contentElem, metaData, true,groupDict);
					};
				}
			} else {
				// contentData is blob
				if (metaData.hasOwnProperty('mime')) {
					mime = metaData.mime;
					console.log("mime:" + mime);
				}
				blob = new Blob([contentData], {type: mime});
				if (contentElem && blob) {
					URL.revokeObjectURL(contentElem.src);
					contentElem.src = URL.createObjectURL(blob);

					contentElem.onload = function () {
						if (metaData.width < 10) {
							console.log("naturalWidth:" + contentElem.naturalWidth);
							metaData.width = contentElem.naturalWidth;
						}
						if (metaData.height < 10) {
							console.log("naturalHeight:" + contentElem.naturalHeight);
							metaData.height = contentElem.naturalHeight;
						}
						vscreen_util.assignMetaData(contentElem, metaData, true,groupDict);
					};
				}
			}

			this.emit(ContentView.EVENT_TOGGLE_MARK, null, contentElem, metaData);
		}
		
		// 同じコンテンツを参照しているメタデータがあれば更新
		if (!contentData && contentElem) {
			this.emit(ContentView.EVENT_COPY_CONTENT, null, null, contentElem, metaData, false);
		} else {
			this.emit(ContentView.EVENT_COPY_CONTENT, null, contentElem, null, metaData, false);
		}
	}

	ContentView.EVENT_SETUP_CONTENT = "setup_content";
	ContentView.EVENT_COPY_CONTENT = "copy_content";
	ContentView.EVENT_INSERT_CONTENT = "insert_content";
	ContentView.EVENT_TOGGLE_MARK = "toggle_mark";
	
	// singleton
	window.content_view = new ContentView();
}());