/*jslint devel:true*/
(function () {
	"use strict";
	/**
	 * コンテンツリストビュー
	 */

	var ContentList;

	ContentList = function () {
		EventEmitter.call(this);
	};
	ContentList.prototype = Object.create(EventEmitter.prototype);

	/**
	 * コンテンツタイプから適切なクラス名を取得する.
	 * @parma {String} contentType コンテンツタイプ
	 */
	function getClassName(contentType) {
		var classname;
		if (contentType === 'text') {
			classname = 'textcontent';
		} else if (contentType === 'video') {
			classname = 'videocontent';
		} else if (contentType === 'pdf') {
			classname = 'pdfcontent';
		} else {
			classname = 'imagecontent';
		}
		return classname;
	}

	/**
	 * コンテンツタイプから適切なタグ名を取得する.
	 * @parma {String} contentType コンテンツタイプ
	 */
	function getTagName(contentType) {
		var tagName;
		if (contentType === 'text') {
			tagName = 'div';
		} else if (contentType === "video") {
			tagName = 'img';
		} else {
			tagName = 'img';
		}
		return tagName;
	}

	function fixDivSize(divElem, w, aspect) {
		// console.log( w, aspect );
		// console.log( divElem );
		var h;
		if (w > 200) {
			divElem.style.width = '200px';
			h = 200 / aspect;
			divElem.style.paddingBottom = (150 - h) + 'px'; 
			if (150 - h > 140.0) {
				divElem.style.paddingBottom = '140px';
			}
		} else if (w < 50) {
			divElem.style.width = '50px';
			divElem.style.paddingRight = (50 - w) + 'px';
			if (50 - w > 40.0) {
				divElem.style.paddingRight = '40px';
			}
		}
	}
	
	ContentList.prototype.createMicCameraButton = function (divElem, metaData) {
		var cameraButton = document.createElement('div');
		var micButton  = document.createElement('div');
		cameraButton.className = "video_camera_button";
		micButton.className = "video_mic_button";
		if (metaData.hasOwnProperty('is_video_on') && String(metaData.is_video_on) === "false") {
			cameraButton.classList.add("video_camera_button_off");  // offにする
		}
		if (metaData.hasOwnProperty('is_audio_on') && String(metaData.is_audio_on) === "false") {
			micButton.classList.add("video_mic_button_off");  // offにする
		}
		divElem.appendChild(cameraButton);
		divElem.appendChild(micButton);
		cameraButton.onclick = function () {
			var preCameraIsOff = cameraButton.classList.contains("video_camera_button_off");
			var nowCameraIsOn = preCameraIsOff;
			if (preCameraIsOff) {
				cameraButton.classList.remove("video_camera_button_off"); // onにする
			} else {
				cameraButton.classList.add("video_camera_button_off");  // offにする
			}
			this.emit(ContentList.EVENT_CAMERA_ONOFF_CHANGED, null, metaData, nowCameraIsOn);
		}.bind(this);
		micButton.onclick = function () {
			var preMicIsOff = micButton.classList.contains("video_mic_button_off");
			var nowMicIsOn = preMicIsOff;
			if (preMicIsOff) {
				micButton.classList.remove("video_mic_button_off"); // onにする
			} else {
				micButton.classList.add("video_mic_button_off");  // offにする
			}
			this.emit(ContentList.EVENT_MIC_ONOFF_CHANGED, null, metaData, nowMicIsOn);
		}.bind(this);
	}

	/**
	 * コンテンツをリストビューにインポートする。
	 * doneGetContent時にコールされる。
	 * @method importContentToList
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	ContentList.prototype.import_content = function (gui, metaDataDict, metaData, contentData, groupDict, videoElem) {
		var contentArea = null,
			contentElem,
			id,
			elem,
			w,
			h,
			sourceElem,
			divElem,
			aspect,
			tagName,
			classname,
			blob,
			mime = "image/jpeg",
			onlistID = "onlist:" + metaData.id,
			thumbnail;

		if (Validator.isLayoutType(metaData)) {
			return;
		}

		// サムネイルなどの複数バイナリが入っている場合
		// contentData[0]はmetaDataのリスト.
		// contentData[1]はbinaryDataのリスト.
		// contentData[n][0]がコンテンツ本体
		if (contentData instanceof Array) {
			for (var i = 0; i < contentData[0].length; ++i) {
				if (contentData[0][i].type === "thumbnail") {
					thumbnail = contentData[1][i];
					//console.error(thumbnail)
					break;
				}
			}
			metaData = contentData[0][0];
			contentData = contentData[1][0];
		}

		// メタデータはGetMetaDataで取得済のものを使う.
		// GetContent送信した後にさらにGetMetaDataしてる場合があるため.
		if (metaDataDict.hasOwnProperty(metaData.id)) {
			metaData = metaDataDict[metaData.id];
		}

		if (metaData.hasOwnProperty('group')) {
			contentArea = gui.get_content_area_by_group(metaData.group);
		}
		if (!contentArea) {
			contentArea = gui.get_content_area_by_group(Constants.DefaultGroup);
		}

		tagName = getTagName(metaData.type);
		classname = getClassName(metaData.type);
		
		if (gui.get_list_elem(metaData.id)) {
			divElem = gui.get_list_elem(metaData.id);
			contentElem = divElem.childNodes[0];
		}
		
		if (!divElem) {
			contentElem = document.createElement(tagName);
			divElem = document.createElement('div');
			divElem.id = onlistID;

			this.emit(ContentList.EVENT_SETUP_CONTENT, null, divElem, onlistID);

			//setupContent(divElem, onlistID);
			divElem.appendChild(contentElem);
			contentArea.appendChild(divElem);
		}
		contentElem.classList.add(classname);

		//console.log("id=" + metaData.id);
		if (contentData) {
			if (metaData.type === 'text') {
				// contentData is text
				contentElem.innerHTML = contentData;
				divElem.style.width = "150px";
				divElem.style.height = "150px";
				divElem.style.color = "white";
			} else if (metaData.type === 'video') {
				divElem.innerHTML = "";
				divElem.appendChild(contentElem);

				divElem.style.height = "150px";
				aspect = metaData.orgWidth / metaData.orgHeight;
				w = 150 * aspect;
				divElem.style.width = w + "px";

				contentElem.src = contentData;
				fixDivSize(divElem, w, aspect);
				if (videoElem && metaData.hasOwnProperty("subtype")) {
					// マイク、カメラボタン
					this.createMicCameraButton(divElem, metaData);
				}
			} else if (metaData.type === 'pdf') {
				var canvas = document.createElement('canvas');
				canvas.width = contentElem.clientWidth;
				canvas.height = contentElem.clientHeight;

				var context = canvas.getContext('2d');

				var pdfjsLib = window['pdfjs-dist/build/pdf'];
				window.PDFJS.cMapUrl = './js/3rd/pdfjs/cmaps/';
				window.PDFJS.cMapPacked = true;

				pdfjsLib.getDocument(contentData).then(function (pdf) {
					pdf.getPage(1).then(function (page) {
						var viewport = page.getViewport(1);

						canvas.width = viewport.width;
						canvas.height = viewport.height;

						return page.render({
							canvasContext: context,
							viewport: viewport
						}).then(function () {
							divElem.style.height = '150px';
							var aspect = viewport.width / viewport.height;
							w = 150.0 * aspect;
							divElem.style.width = w + 'px';

							canvas.toBlob(function (blob) {
								URL.revokeObjectURL(contentElem.src);
								contentElem.src = URL.createObjectURL(blob);
								fixDivSize(divElem, w, aspect);
							});
						});
					});
				});
			} else {
				// contentData is blob
				if (metaData.hasOwnProperty('mime')) {
					mime = metaData.mime;
					//console.log("mime:" + mime);
				}

				divElem.style.height = "150px";
				aspect = metaData.orgWidth / metaData.orgHeight;
				w = 150 * aspect;
				divElem.style.width = w + "px";

				if (metaData.type === Constants.TypeTileImage) {
					// アイコンを設置
					if (divElem.getElementsByClassName('tileimage_icon_for_list').length === 0) {
						var icon = document.createElement('div');
						icon.className = 'tileimage_icon_for_list';
						divElem.appendChild(icon);
						icon.title = "Tiled Image";
					}
				}

				if (thumbnail !== undefined && thumbnail) {
					blob = new Blob([thumbnail], {type: "image/jpeg"});
					// 縮小サムネイルデータがあった場合
					if (contentElem) {
						URL.revokeObjectURL(contentElem.src);
						contentElem.src = URL.createObjectURL(blob);
						fixDivSize(divElem, w, aspect);
					}
				} else {
					blob = new Blob([contentData], {type: mime});
					if (contentElem && blob) {
						URL.revokeObjectURL(contentElem.src);
						contentElem.src = URL.createObjectURL(blob);
						fixDivSize(divElem, w, aspect);
					}
				}
			}
		}
		contentElem.style.width = "100%";
		contentElem.style.height = "100%";
		divElem.style.position = "relative";
		divElem.style.top = "5px";
		divElem.style.left = "20px";
		divElem.style.border = "solid";
		divElem.style.borderColor = "rgba(0,0,0,0)";
		divElem.style.margin = "5px";
		divElem.style.color = "white";
		divElem.style.float = "left";
		
		// 同じコンテンツを参照しているメタデータがあれば更新
		if (!contentData && contentElem) {
			this.emit(ContentList.EVENT_COPY_CONTENT, null, null, contentElem, metaData, true);
			//copyContentData(null, contentElem, metaData, true);
			divElem.style.width = "200px";
			if (contentElem.offsetHeight > 200) {
				aspect = metaDataDict[id].width / metaDataDict[id].height;
				divElem.style.height = "100px";
				divElem.style.width = 100 * aspect;
			}
		} else {
			this.emit(ContentList.EVENT_COPY_CONTENT, null, contentElem, null, metaData, true);
			//copyContentData(contentElem, null, metaData, true);
		}
	}

	ContentList.prototype.is_camera_on = function (metadataID) {
		var onlistID = "onlist:" + metadataID;
		var listElem = document.getElementById(onlistID);
		if (listElem) {
			var buttons = listElem.getElementsByClassName('video_camera_button');
			if (buttons.length > 0) {
				return !buttons[0].classList.contains('video_camera_button_off');
			}
		}
		return false;
	}
	
	ContentList.prototype.is_mic_on = function (metadataID) {
		var onlistID = "onlist:" + metadataID;
		var listElem = document.getElementById(onlistID);
		if (listElem) {
			var buttons = listElem.getElementsByClassName('video_mic_button');
			if (buttons.length > 0) {
				return !buttons[0].classList.contains('video_mic_button_off');
			}
		}
		return false;
	}

	ContentList.EVENT_CAMERA_ONOFF_CHANGED = "camera_onoff_changed";
	ContentList.EVENT_MIC_ONOFF_CHANGED = "mic_onoff_changed";
	ContentList.EVENT_SETUP_CONTENT = "setup_content";
	ContentList.EVENT_COPY_CONTENT = "copy_content";

	// singleton
	window.content_list = new ContentList();

}());