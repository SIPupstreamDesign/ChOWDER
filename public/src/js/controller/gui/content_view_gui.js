/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../../common/constants.js';
import Validator from '../../common/validator.js';
import vscreen_util from '../../common/vscreen_util.js';
import ContentUtil from '../content_util'

"use strict";

/**
 * コンテンツタイプから適切なタグ名を取得する.
 * @parma {String} contentType コンテンツタイプ
 */
function getTagName(contentType) {
	let tagName;
	if (contentType === 'text' ) {
		tagName = 'pre';
	} else if (contentType === 'video') {
		tagName = 'img'; // videoでvideoを保持してない場合用
	} else if (contentType === 'pdf') {
		tagName = 'canvas';
	} else if (contentType === 'tileimage') {
		tagName = 'div';
	} else if (contentType === 'webgl') {
		tagName = 'div';
	} else {
		tagName = 'img';
	}
	return tagName;
}

/**
 * コンテンツを追加できるメインビュー
 */
class ContentViewGUI extends EventEmitter {
	constructor(store, action) {
		super();

		this.store = store;
		this.action = action;
	}
	
	/**
	 * コンテンツをメインビューにインポートする。
	 * doneGetContent時にコールされる。
	 * @method importContentToView
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	importContent(previewArea, listElem, metaData, contentData, videoPlayer) {
		let metaDataDict = this.store.getMetaDataDict();
		let groupDict = this.store.getGroupDict();
		let contentElem;
		let tagName;
		let blob;
		let mime = "image/jpeg";
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
		if (!contentElem && !videoPlayer) {
			contentElem = document.createElement(tagName);
			contentElem.id = metaData.id;
			contentElem.style.position = "absolute";
			
			this.action.setupContentElement({
				element : contentElem,
				id : metaData.id
			});
			ContentUtil.insertElementWithDictionarySort(previewArea, contentElem);
		}
		if (videoPlayer) {
			let videoDOM = videoPlayer.getDOM();
			videoDOM.id = metaData.id;
			videoDOM.style.position = "absolute";
			
			let videoElem = videoPlayer.getVideo();
			if (Constants.IsFirefox) {
				videoElem.ondblclick = function () {
					videoElem.removeAttribute('controls');
					videoElem.setAttribute('controlslist', 'nodownload');
				};
				videoElem.onmouseleave = function () {
					videoElem.removeAttribute('controls');
					videoElem.removeAttribute('controlslist');
				};
			}
			else {
				videoElem.removeAttribute('controls');
				videoElem.setAttribute('controlslist', 'nodownload');
			}
			videoDOM.style.color = "white";
			
			this.action.setupContentElement({
				element : videoDOM,
				id : metaData.id
			});
			ContentUtil.insertElementWithDictionarySort(previewArea, videoDOM);
		}
		// console.log("id=" + metaData.id);
		if (contentData) {
			if (metaData.type === 'text') {
				// contentData is text
				contentElem.innerHTML = contentData;
				contentElem.style.color = "white";
				contentElem.style.overflow = "visible"; // Show all text
				vscreen_util.assignMetaData(contentElem, metaData, true, groupDict);
			}
			else if (metaData.type === 'video') {
				//contentElem.src = contentData;
				if (videoPlayer) {
					vscreen_util.assignMetaData(videoPlayer.getDOM(), metaData, true, groupDict);
				}
				else {
					contentElem.src = contentData;
					contentElem.onload = function () {
						if (metaData.width < 10) {
							// console.log("naturalWidth:" + contentElem.naturalWidth);
							metaData.width = contentElem.naturalWidth;
						}
						if (metaData.height < 10) {
							// console.log("naturalHeight:" + contentElem.naturalHeight);
							metaData.height = contentElem.naturalHeight;
						}
						vscreen_util.assignMetaData(contentElem, metaData, true, groupDict);
					};
				}
			}
			else if (metaData.type === 'pdf') {
				vscreen_util.assignMetaData(contentElem, metaData, true, groupDict);
				if (!contentElem.pdfSetupCompleted) {
					contentElem.pdfSetupCompleted = true;
					let context = contentElem.getContext('2d');
					let pdfjsLib = window['pdfjs-dist/build/pdf'];
					window.PDFJS.cMapUrl = './js/3rd/pdfjs/cmaps/';
					window.PDFJS.cMapPacked = true;
					pdfjsLib.getDocument(contentData).then(function (pdf) {
						metaData.pdfPage = parseInt(metaData.pdfPage) || 1;
						metaData.pdfNumPages = pdf.numPages;
						let lastTask = Promise.resolve();
						let lastDate = 0;
						let lastPage = 0;
						let lastWidth = 0;
						contentElem.loadPage = function (p, width) {
							let date = Date.now();
							lastDate = date;
							if (lastPage === p && lastWidth === width) {
								return;
							}
							setTimeout(function () {
								if (lastDate !== date) {
									return;
								}
								lastPage = p;
								lastWidth = width;
								pdf.getPage(p).then(function (page) {
									let viewport = page.getViewport(width / page.getViewport(1).width);
									let orgAspect = metaData.orgWidth / metaData.orgHeight;
									let pageAspect = viewport.width / viewport.height;
									contentElem.width = width;
									contentElem.height = width / orgAspect;
									let transform = [1, 0, 0, 1, 0, 0];
									if (orgAspect < pageAspect) {
										let margin = (1.0 / orgAspect - 1.0 / pageAspect) * width;
										transform[5] = margin / 2;
									}
									else {
										let margin = (orgAspect - pageAspect) * width;
										transform[4] = margin / 2;
										transform[0] = (width - margin) / width;
										transform[3] = transform[0];
									}
									lastTask = lastTask.then(function () {
										return page.render({
											canvasContext: context,
											viewport: viewport,
											transform: transform
										});
									});
								});
							}, lastPage === p ? 500 : 0);
						};
						contentElem.loadPage(parseInt(metaData.pdfPage), parseInt(metaData.width));
					});
				}
			}
			else if (metaData.type === 'webgl') {
				// contentData is text
				let iframe = document.createElement('iframe');
				iframe.src = contentData;
				iframe.style.width = "100%";
				iframe.style.height = "100%";
				iframe.style.pointerEvents = "none";
				iframe.onload = () => {
					iframe.contentWindow.isController = true;
					if (iframe.contentWindow.chowder_itowns_update_camera_callback) {
						this.action.addItownFunc({
							id : metaData.id,
							func : {
								chowder_itowns_update_camera_callback : iframe.contentWindow.chowder_itowns_update_camera_callback
							}
						});
					}
				};
				contentElem.innerHTML = "";
				contentElem.appendChild(iframe);
				
				contentElem.style.color = "white";
				contentElem.style.overflow = "visible"; // Show all text
				vscreen_util.assignMetaData(contentElem, metaData, true, groupDict);
			}
			else if (metaData.type === Constants.TypeTileImage) {
				if (metaData.hasOwnProperty('mime')) {
					mime = metaData.mime;
					// console.log("mime:" + mime);
				}
				blob = new Blob([contentData], { type: mime });
				if (contentElem && blob) {
					// アイコンを設置
					if (contentElem.getElementsByClassName('tileimage_icon').length === 0) {
						let icon = document.createElement('div');
						icon.className = 'tileimage_icon';
						contentElem.appendChild(icon);
						icon.title = "Tiled Image";
					}
					let image = contentElem.getElementsByClassName('tileimage_image')[0];
					if (image) {
						URL.revokeObjectURL(image.src);
					} else {
						image = document.createElement('img');
						contentElem.appendChild(image);
					}
					image.className = "tileimage_image";
					if (typeof (contentData) === "string") {
						image = document.createElement('div');
						image.className = "tileimage_image";
						image.innerHTML = "image removed by capacity limit";
						image.style.width = "100%";
						image.style.textAlign = "center";
						image.style.color = "gray";
						image.style.border = "1px solid gray";
					}
					image.src = URL.createObjectURL(blob);
					image.style.width = "100%";
					image.style.height = "100%";
					image.onload = () => {
						// 時系列タイル画像で、途中の画像の解像度が違う場合があるため、
						// width固定で、読み込んだ画像のaspectをheightに反映させる
						let imageAspect = Number(image.naturalHeight) / Number(image.naturalWidth);
						let currentAspect = Number(metaData.width) / Number(metaData.height)
						if (imageAspect !== currentAspect) {
							metaData.height = Number(metaData.width) * imageAspect;
							this.action.correctHistoricalContentAspect({
								metaData : metaData
							})
						} else {
							if (metaData.width < 10) {
								// console.log("naturalWidth:" + image.naturalWidth);
								metaData.width = image.naturalWidth;
							}
							if (metaData.height < 10) {
								// console.log("naturalHeight:" + image.naturalHeight);
								metaData.height = image.naturalHeight;
							}
							vscreen_util.assignMetaData(contentElem, metaData, true, groupDict);
						}
					};
				}
			}
			else {
				// contentData is blob
				if (metaData.hasOwnProperty('mime')) {
					mime = metaData.mime;
					// console.log("mime:" + mime);
				}
				blob = new Blob([contentData], { type: mime });
				if (contentElem && blob) {
					URL.revokeObjectURL(contentElem.src);
					contentElem.src = URL.createObjectURL(blob);
					contentElem.onload = function () {
						if (metaData.width < 10) {
							// console.log("naturalWidth:" + contentElem.naturalWidth);
							metaData.width = contentElem.naturalWidth;
						}
						if (metaData.height < 10) {
							// console.log("naturalHeight:" + contentElem.naturalHeight);
							metaData.height = contentElem.naturalHeight;
						}
						vscreen_util.assignMetaData(contentElem, metaData, true, groupDict);
					};
				}
			}
			this.toggleMark(contentElem, metaData);
		}
		// 同じコンテンツを参照しているメタデータがあれば更新
		if (!contentData && contentElem) {
			ContentUtil.copyContentData(this.store, null, contentElem, metaData, false);
		}
		else {
			ContentUtil.copyContentData(this.store, contentElem, null, metaData, false);
		}
	}

	/**
	 * マークによるコンテンツ強調表示のトグル
	 * @param {Element} elem 対象エレメント
	 * @param {JSON} metaData メタデータ
	 */
	toggleMark(elem, metaData) {
		let mark = "mark";
		if (elem && metaData.hasOwnProperty("id")) {
			if (metaData.hasOwnProperty(mark) && (metaData[mark] === 'true' || metaData[mark] === true)) {
				if (!elem.classList.contains(mark)) {
					elem.classList.add(mark);
				}
			} else {
				if (elem.classList.contains(mark)) {
					elem.classList.remove(mark);
				}
			}
		}
	}


}

export default ContentViewGUI;
