/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../../common/constants.js';
import Validator from '../../common/validator.js';
import vscreen_util from '../../common/vscreen_util.js';
import ContentUtil from '../content_util'
import ITownsCommand from '../../common/itowns_command.js';
import IFrameConnector from '../../common/iframe_connector.js';
import ITownsUtil from '../../common/itowns_util.js';

"use strict";

/**
 * コンテンツタイプから適切なタグ名を取得する.
 * @parma {String} contentType コンテンツタイプ
 */
function getTagName(contentType) {
	let tagName;
	if (contentType === 'text') {
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

function getWebGLIFrameID(metaData) {
	return 'webgl_content_' + metaData.id;
}

/**
 * コンテンツを追加できるメインビュー
 */
class ContentViewGUI extends EventEmitter {
	constructor(store, action) {
		super();

		this.store = store;
		this.action = action;
		this.webglQueue = [];
		this.isImportingWebGL = false; // webglコンテンツを1つでもロード中かどうか


		setInterval(() => {
			if (!this.isImportingWebGL) {
				if (this.webglQueue.length > 0) {
					const data = this.webglQueue.shift();
					this.importWebGLContentFromQueue(data);
				}
			}
		}, 500);
	}

	updateWebGLFrameSize(connector, metaData) {
		let iframe = document.getElementById(getWebGLIFrameID(metaData));
		let rect = iframe.getBoundingClientRect()
		ITownsUtil.resize(connector, {
			x: 0,
			y: 0,
			w: rect.right - rect.left,
			h: rect.bottom - rect.top
		}, false);
	}

	importWebGLContentFromQueue(data) {
		this.isImportingWebGL = true;
		let contentElem = data[0];
		let contentData = data[1];
		let metaData = data[2];
		//let groupDict = data[3];
		let iframe = document.getElementById(getWebGLIFrameID(metaData));

		// contentData is thubmail

		let url = metaData.url;
		iframe.onload = ((metaData) => {
			if(metaData.webglType && metaData.webglType === "qgis2three.js"){
				// qgis
				const connector = new IFrameConnector(iframe);
				connector.connect(() => {
					this.action.updateQgisMetadata(metaData);
					this.isImportingWebGL = false;
				});
			}else{
				let iframe = document.getElementById(getWebGLIFrameID(metaData));
				iframe.contentWindow.chowder_itowns_view_type = "controller";
				let connector = new IFrameConnector(iframe);
				this.action.addItownFunc({
					id: metaData.id,
					func: {
						chowder_itowns_update_camera: (metaData) => {
							ITownsUtil.updateCamera(connector, metaData, () => {
								this.updateWebGLFrameSize(connector, metaData);
							});
						},
						chowder_itowns_update_layer_list: (metaData) => {
							let preMetaData = this.store.getMetaData(metaData.id);
							ITownsUtil.updateLayerList(connector, metaData, preMetaData);
						},
						chowder_itowns_update_time: (metaData, time) => {
							ITownsUtil.updateTime(connector, metaData, time);
						},
						chowder_itowns_update_layer_url: () => {
							iframe.contentWindow.location.replace(url);
						}
					}
				});
	
				// IframeConnectorを通してiframeに接続
				try {
					connector.connect(() => {
						// 初回に一度実行.
						if (metaData.hasOwnProperty('cameraWorldMatrix') &&
							metaData.hasOwnProperty('cameraParams')) {
							connector.send(ITownsCommand.UpdateCamera, {
								mat: JSON.parse(metaData.cameraWorldMatrix),
								params: JSON.parse(metaData.cameraParams),
							});
							this.updateWebGLFrameSize(connector, metaData);
						}
						connector.send(ITownsCommand.InitLayers, JSON.parse(metaData.layerList), () => {
							let rect = {
								x: 0,
								y: 0,
								w: iframe.clientWidth,
								h: iframe.clientHeight
							}
							connector.send(ITownsCommand.Resize, rect);
						});
					});
					connector.once(ITownsCommand.LayersInitialized, (err, data) => {
	
						this.isImportingWebGL = false;
					});
					let timeOutID = null;
					timeOutID = setTimeout(() => {
						this.isImportingWebGL = false;
						clearTimeout(timeOutID);
					}, 15 * 1000)
				} catch (err) {
					console.error(err);
				}
			}
		}).bind(this, metaData);
		iframe.contentWindow.location.replace(url);

		/*
		blob = new Blob([contentData], { type: "image/png" });
		let imageElem = new Image();
		if (contentElem && blob) {
			URL.revokeObjectURL(imageElem.src);
			imageElem.src = URL.createObjectURL(blob);
			imageElem.onload = function () {
				if (metaData.width < 10) {
					// console.log("naturalWidth:" + imageElem.naturalWidth);
					metaData.width = imageElem.naturalWidth;
				}
				if (metaData.height < 10) {
					// console.log("naturalHeight:" + imageElem.naturalHeight);
					metaData.height = imageElem.naturalHeight;
				}
				vscreen_util.assignMetaData(contentElem, metaData, true, groupDict);
				imageElem.style.width = "100%";
				imageElem.style.height = "100%";
			};
		}
		contentElem.appendChild(imageElem);
		*/

		//vscreen_util.assignMetaData(contentElem, metaData, true, groupDict);
	}

	importWebGLContent(contentElem, contentData, metaData, groupDict) {
		if (document.getElementById(getWebGLIFrameID(metaData))) {
			return;
		}
		let iframe = document.createElement('iframe');
		iframe.style.width = "100%";
		iframe.style.height = "100%";
		iframe.style.pointerEvents = "none";
		iframe.id = getWebGLIFrameID(metaData);
		contentElem.innerHTML = "";
		contentElem.appendChild(iframe);
		contentElem.style.color = "white";
		contentElem.style.overflow = "visible"; // Show all text
		vscreen_util.assignMetaData(contentElem, metaData, true, groupDict);
		this.webglQueue.push([contentElem, contentData, metaData, groupDict]);
	}

	importPDFContent(contentElem, contentData, metaData, groupDict) {
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
							const originalSize = page.getViewport(1);
							let viewport = page.getViewport(width / originalSize.width);
							let orgAspect = metaData.orgWidth / metaData.orgHeight;
							let pageAspect = viewport.width / viewport.height;
							if ((viewport.width * viewport.height) > (7680 * 4320)) {
								if (viewport.width > viewport.height) {
									viewport.width = 7680;
									viewport.height = viewport.width / pageAspect;
								} else {
									viewport.height = 4320;
									viewport.width = viewport.height * pageAspect;
								}
								width = Math.round(viewport.width);
								viewport = page.getViewport(width / originalSize.width);
							}
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

	importVideoContent(contentElem, contentData, metaData, groupDict, videoPlayer) {
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

	importTextContent(contentElem, contentData, metaData, groupDict) {
		// contentData is text
		contentElem.innerHTML = contentData;
		contentElem.style.color = "white";
		contentElem.style.overflow = "visible"; // Show all text
		vscreen_util.assignMetaData(contentElem, metaData, true, groupDict);
	}

	importTileImageContent(contentElem, contentData, metaData, groupDict) {
		let mime = "image/jpeg";
		if (metaData.hasOwnProperty('mime')) {
			mime = metaData.mime;
		}
		let blob = new Blob([contentData], { type: mime });
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
						metaData: metaData
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

	importImageContent(contentElem, contentData, metaData, groupDict) {
		let mime = "image/jpeg";
		if (metaData.hasOwnProperty('mime')) {
			mime = metaData.mime;
		}
		// contentData is blob
		let blob = new Blob([contentData], { type: mime });
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
				element: contentElem,
				id: metaData.id
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
				element: videoDOM,
				id: metaData.id
			});
			ContentUtil.insertElementWithDictionarySort(previewArea, videoDOM);
		}
		// console.log("id=" + metaData.id);
		if (contentData) {
			if (metaData.type === Constants.TypeText) {
				this.importTextContent(contentElem, contentData, metaData, groupDict);
			}
			else if (metaData.type === Constants.TypeVideo) {
				this.importVideoContent(contentElem, contentData, metaData, groupDict, videoPlayer);
			}
			else if (metaData.type === Constants.TypePDF) {
				this.importPDFContent(contentElem, contentData, metaData, groupDict);
			}
			else if (metaData.type === Constants.TypeWebGL) {
				this.importWebGLContent(contentElem, contentData, metaData, groupDict);
			}
			else if (metaData.type === Constants.TypeTileImage) {
				this.importTileImageContent(contentElem, contentData, metaData, groupDict);
			}
			else {
				this.importImageContent(contentElem, contentData, metaData, groupDict);
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
