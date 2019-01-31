/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../../common/constants.js';
import Validator from '../../common/validator.js';
import ContentUtil from '../content_util';

 "use strict";

/**
 * コンテンツタイプから適切なクラス名を取得する.
 * @parma {String} contentType コンテンツタイプ
 */
function getClassName(contentType) {
	let classname;
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
	let tagName;
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
	let h;
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

/**
 * コンテンツリストビュー
 */
class ContentListGUI extends EventEmitter
{
	constructor(store, action) {
		super();

		this.store = store;
		this.action = action;
	}

	createMicCameraButton(divElem, metaData) {
		let cameraButton = document.createElement('div');
		let micButton  = document.createElement('div');
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
		cameraButton.onclick = () => {
			let preCameraIsOff = cameraButton.classList.contains("video_camera_button_off");
			if (preCameraIsOff) {
				cameraButton.classList.remove("video_camera_button_off"); // onにする
			} else {
				cameraButton.classList.add("video_camera_button_off");  // offにする
			}
			if (metaData.hasOwnProperty("subtype")) {
				this.action.changeCameraMicEnable({
					id : metaData.id,
					isCameraOn : this.isCameraOn(metaData.id),
					isMicOn : this.isMicOn(metaData.id)
				});
			} else {
				console.error("Error : invalid metadata", metaData);
			}
		};
		micButton.onclick = () => {
			let preMicIsOff = micButton.classList.contains("video_mic_button_off");
			if (preMicIsOff) {
				micButton.classList.remove("video_mic_button_off"); // onにする
			} else {
				micButton.classList.add("video_mic_button_off");  // offにする
			}
			if (metaData.hasOwnProperty("subtype")) {
				this.action.changeCameraMicEnable({
					id : metaData.id,
					isCameraOn : this.isCameraOn(metaData.id),
					isMicOn : this.isMicOn(metaData.id)
				});
			} else {
				console.error("Error : invalid metadata", metaData);
			}
		};
	}

	/**
	 * コンテンツをリストビューにインポートする。
	 * doneGetContent時にコールされる。
	 * @method importContentToList
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	importContent(contentArea, listElem, metaData, contentData, videoElem) {
		let metaDataDict = this.store.getMetaDataDict();
		let contentElem;
		let divElem = listElem;
		let aspect;
		let tagName;
		let classname;
		let blob;
		let mime = "image/jpeg";
		const onlistID = "onlist:" + metaData.id;
		let thumbnail;

		if (Validator.isLayoutType(metaData)) {
			return;
		}

		// サムネイルなどの複数バイナリが入っている場合
		// contentData[0]はmetaDataのリスト.
		// contentData[1]はbinaryDataのリスト.
		// contentData[n][0]がコンテンツ本体
		if (contentData instanceof Array) {
			for (let i = 0; i < contentData[0].length; ++i) {
				if (metaData.hasOwnProperty('restore_index')) {
					// 差し替え履歴ありの場合はサムネイルは動的に生成
					continue;
				}
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

		tagName = getTagName(metaData.type);
		classname = getClassName(metaData.type);
		
		if (divElem) {
			contentElem = divElem.childNodes[0];
		}
		
		if (!divElem) {
			contentElem = document.createElement(tagName);
			divElem = document.createElement('div');
			divElem.id = onlistID;

			this.action.setupContentElement({
				element : divElem,
				id : onlistID
			});

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
				let w = 150 * aspect;
				divElem.style.width = w + "px";

				contentElem.src = contentData;
				fixDivSize(divElem, w, aspect);
				if (videoElem && metaData.hasOwnProperty("subtype")) {
					// マイク、カメラボタン
					this.createMicCameraButton(divElem, metaData);
				}
			} else if (metaData.type === 'pdf') {
				let canvas = document.createElement('canvas');
				canvas.width = contentElem.clientWidth;
				canvas.height = contentElem.clientHeight;

				let context = canvas.getContext('2d');

				let pdfjsLib = window['pdfjs-dist/build/pdf'];
				window.PDFJS.cMapUrl = './js/3rd/pdfjs/cmaps/';
				window.PDFJS.cMapPacked = true;

				pdfjsLib.getDocument(contentData).then(function (pdf) {
					pdf.getPage(1).then(function (page) {
						let viewport = page.getViewport(1);

						canvas.width = viewport.width;
						canvas.height = viewport.height;

						return page.render({
							canvasContext: context,
							viewport: viewport
						}).then(function () {
							divElem.style.height = '150px';
							let aspect = viewport.width / viewport.height;
							let w = 150.0 * aspect;
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
				let w = 150 * aspect;
				divElem.style.width = w + "px";

				if (metaData.type === Constants.TypeTileImage) {
					// アイコンを設置
					if (divElem.getElementsByClassName('tileimage_icon_for_list').length === 0) {
						let icon = document.createElement('div');
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
			ContentUtil.copyContentData(this.store, null, contentElem, metaData, true);
			divElem.style.width = "200px";
			if (contentElem.offsetHeight > 200) {
				aspect = metaDataDict[id].width / metaDataDict[id].height;
				divElem.style.height = "100px";
				divElem.style.width = 100 * aspect;
			}
		} else {
			ContentUtil.copyContentData(this.store, contentElem, null, metaData, true);
		}
	}

	isCameraOn(metadataID) {
		const onlistID = "onlist:" + metadataID;
		let listElem = document.getElementById(onlistID);
		if (listElem) {
			let buttons = listElem.getElementsByClassName('video_camera_button');
			if (buttons.length > 0) {
				return !buttons[0].classList.contains('video_camera_button_off');
			}
		}
		return false;
	}
	
	isMicOn(metadataID) {
		const onlistID = "onlist:" + metadataID;
		let listElem = document.getElementById(onlistID);
		if (listElem) {
			let buttons = listElem.getElementsByClassName('video_mic_button');
			if (buttons.length > 0) {
				return !buttons[0].classList.contains('video_mic_button_off');
			}
		}
		return false;
	}
};

// singleton
export default ContentListGUI;
