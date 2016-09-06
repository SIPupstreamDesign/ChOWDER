/*jslint devel:true*/
(function (gui) {
	"use strict";
	
	var contentBorderColor = "rgba(0,0,0,0)";

	/**
	 * コンテンツタイプから適切なクラス名を取得する.
	 * @parma {String} contentType コンテンツタイプ
	 */
	function getClassName(contentType) {
		var classname;
		if (contentType === 'text') {
			classname = 'textcontent';
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
			tagName = 'pre';
		} else {
			tagName = 'img';
		}
		return tagName;
	}

	/**
	 * 受領したメタデータからプレビューツリーにコンテンツを反映する。
	 * doneGetContent時にコールされる。
	 * @method importContentToView
	 * @param {JSON} metaData メタデータ
	 * @param {BLOB} contentData コンテンツデータ
	 */
	function importContentToView(metaDataDict, metaData, contentData) {
		var previewArea = gui.get_content_preview_area(),
			id,
			contentElem,
			elem,
			tagName,
			blob,
			mime = "image/jpeg";
		
		console.log("importContentToView:" + JSON.stringify(metaData));
		tagName = getTagName(metaData.type);
		
		// メタデータはGetMetaDataで取得済のものを使う.
		// GetContent送信した後にさらにGetMetaDataしてる場合があるため.
		if (metaDataDict.hasOwnProperty(metaData.id)) {
			metaData = metaDataDict[metaData.id];
		}
		
		if (document.getElementById(metaData.id)) {
			contentElem = document.getElementById(metaData.id);
		}
		
		if (!contentElem) {
			contentElem = document.createElement(tagName);
			contentElem.id = metaData.id;
			contentElem.style.position = "absolute";
			if (window.content_view.on_setup_content) {
				window.content_view.on_setup_content(contentElem, metaData.id);
			}
			//setupContent(contentElem, metaData.id);
			
			if (window.content_view.on_insert_content) {
				window.content_view.on_insert_content(previewArea, contentElem);
			}
			//insertElementWithDictionarySort(previewArea, contentElem);

			//previewArea.appendChild(contentElem);
		}

		console.log("id=" + metaData.id);
		if (contentData) {
			if (metaData.type === 'text') {
				// contentData is text
				contentElem.innerHTML = contentData;
				contentElem.style.color = textColor;
				contentElem.style.overflow = "visible"; // Show all text
				vscreen_util.assignMetaData(contentElem, metaData, true);
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
						vscreen_util.assignMetaData(contentElem, metaData, true);
					};
				}
			}
			if (window.content_view.on_toggle_mark) {
				window.content_view.on_toggle_mark(contentElem, metaData);
			}
			//toggleMark(contentElem, metaData);
		}
		
		// 同じコンテンツを参照しているメタデータがあれば更新
		if (!contentData && contentElem) {
			if (window.content_view.on_copy_content) {
				window.content_view.on_copy_content(null, contentElem, metaData, false);
			}
		} else {
			if (window.content_view.on_copy_content) {
				window.content_view.on_copy_content(contentElem, null, metaData, false);
			}
		}
	}
	
	
	window.content_view = {};
	window.content_view.import_content = function (metaDataDict, metaData, contentData) {
		importContentToView(metaDataDict, metaData, contentData);
	};
	window.content_view.on_setup_content = null;
	window.content_view.on_copy_content = null;
	window.content_view.on_insert_content = null;
	window.content_view.on_toggle_mark = null;

}(window.controller_gui));