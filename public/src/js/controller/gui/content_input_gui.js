/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import ContentsInput from '../../components/contents_input'
import InputDialog from '../../components/input_dialog'
import Vscreen from '../../common/vscreen';
import VscreenUtil from '../../common/vscreen_util'
import Validator from '../../common/validator'
import Constants from '../../common/constants'

	
function offsetX(eve) {
	return eve.offsetX || eve.pageX - eve.target.getBoundingClientRect().left;
}
function offsetY(eve) {
	return eve.offsetY || eve.pageY - eve.target.getBoundingClientRect().top;
}

/**
 * コンテンツ追加用のInput。
 * display noneとしていて、ボタン押された時などに非表示のinputをクリックしている
 */
class ContentInputGUI
{
    constructor(store, action, previewArea) {
        this.store = store;
		this.action = action;
        this.previewArea = previewArea;

		this.contentsInput = new ContentsInput();
		this.dom = this.contentsInput.getDOM();

		// コンテンツ入力の初期化
		this.initContentsInput();
    }

	/**
	 * コンテンツ入力の初期化
	 */
	initContentsInput() {
		this.contentsInput.on(ContentsInput.EVENT_IMAGEFILEINPUT_CHANGE, (err, evt, x, y) => {
			this.onInputImageFile(evt, x, y);
		});
		this.contentsInput.on(ContentsInput.EVENT_TEXTFILEINPUT_CHANGE, (err, evt, x, y) => {
			this.onInputTextFile(evt, x, y);
		});
		this.contentsInput.on(ContentsInput.EVENT_PDFFILEINPUT_CHANGE, (err, evt, x, y) => {
			this.onInputPDFFile(evt, x, y);
		});
		this.contentsInput.on(ContentsInput.EVENT_UPDATEIMAGEINPUT_CHANGE, (err, evt, x, y) => {
			this.onUpdateImage(evt);
		});
		this.contentsInput.on(ContentsInput.EVENT_VIDEOFILEINPUT_CHANGE, (err, evt, x, y) => {
			this.onInputVideoFile(evt, x, y);
		});
	}

	/**
	 * 画像ファイルFileOpenハンドラ
	 * @param {Object} evt FileOpenイベント
	 */
	onInputImageFile(evt, x, y) {
		let files = evt.target.files;
		let fileReader = new FileReader();
		let time = new Date().toISOString();

		let posx = x;
		let posy = y;
		if (!posx && !posy) {
			// メニューから追加したときなど. wholescreenの左上端に置く.
			posx = Vscreen.getWhole().x;
			posy = Vscreen.getWhole().y;
		}

		fileReader.onload = ((name) =>{
			return (e) => {
				let data = e.target.result;
				if (data && data instanceof ArrayBuffer) {
					let img = document.createElement('img');
					let buffer = new Uint8Array(data);
					let blob = new Blob([buffer], { type: "image/jpeg" });
					img.src = URL.createObjectURL(blob);
					img.className = "image_content";
					img.onload = () => {
						let metaData = {
							posx: posx,
							posy: posy,
							width : img.naturalWidth,
							height : img.naturalHeight,
							visible: true,
							timestamp : time,
							user_data_text: JSON.stringify({ text: name })
						}
						VscreenUtil.transPosInv(metaData);
						this.action.inputImageFile({
							contentData : data,
							metaData : metaData
						});
						URL.revokeObjectURL(img.src);
					};
				}
			};
		})(files[0].name);
		for (let i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('image.*')) {
				fileReader.readAsArrayBuffer(file);
			}
		}
	}

	/**
	 * テキストファイルFileOpenハンドラ
	 * @param {Object} evt FileOpenイベント
	 */
	onInputTextFile(evt, x, y) {
		let files = evt.target.files;
		let fileReader = new FileReader();
		let posx = x;
		let posy = y;

		if (!posx && !posy) {
			// メニューから追加したときなど. wholescreenの左上端に置く.
			posx = Vscreen.getWhole().x;
			posy = Vscreen.getWhole().y;
		}

		fileReader.onloadend = (e) => {
			let text = e.target.result;
			if (text) {
				let elem = document.createElement('pre');
				if (!text) {
					text = "";
				}
				elem.className = "text_content";
				elem.innerHTML = text;
				this.previewArea.appendChild(elem);
				let width = elem.offsetWidth / Vscreen.getWholeScale();
				let height = elem.offsetHeight / Vscreen.getWholeScale();
				this.previewArea.removeChild(elem);
				
				let metaData = {
					posx: posx,
					posy: posy,
					width : width,
					height : height,
					visible: true,
					user_data_text : JSON.stringify({ text: text })
				}
				VscreenUtil.transPosInv(metaData);
				this.action.inputText({
					contentData : text,
					metaData : metaData
				});
			}
		};
		for (let i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('text.*')) {
				fileReader.readAsText(file);
			}
		}
	}
	
	/**
	 * 動画ファイルFileOpenハンドラ
	 * @param {*} evt 
	 * @param {*} x 
	 * @param {*} y 
	 */
	onInputVideoFile(evt, x, y) {
		let files = evt.target.files;
		let fileReader = new FileReader();
		let posx = x;
		let posy = y;

		if (!posx && !posy) {
			// メニューから追加したときなど. wholescreenの左上端に置く.
			posx = Vscreen.getWhole().x;
			posy = Vscreen.getWhole().y;
		}

		fileReader.onload = ((name) => {
			return (e) => {
				let data = e.target.result;
				
				if (data && data instanceof ArrayBuffer) {
					let blob = new Blob([data], { type: "video/mp4" });
					let metaData = {
						posx: posx,
						posy: posy,
						visible: true,
						user_data_text: JSON.stringify({ text: name })
					}
					this.action.inputVideoFile({
						contentData : data,
						metaData : metaData,
						subtype : "file"
					});
				}
			};
		})(files[0].name);
		for (let i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('video.*')) {
				fileReader.readAsArrayBuffer(file);
			}
		}
	}

	/**
	 * PDFファイルOpenハンドラ
	 */
	onInputPDFFile(evt, x, y) {
		let files = evt.target.files;
		let fileReader = new FileReader();
		let posx = x;
		let posy = y;

		if (!posx && !posy) {
			// メニューから追加したときなど. wholescreenの左上端に置く.
			posx = Vscreen.getWhole().x;
			posy = Vscreen.getWhole().y;
		}

		fileReader.onloadend = (e) => {
			let data = e.target.result;
			if (data) {
				let metaData = {
					posx: posx,
					posy: posy,
					visible: true
				}
				this.action.inputPDFFile({
					contentData : data,
					metaData : metaData
				});
			}
		};
		for (let i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('application/pdf')) {
				fileReader.readAsArrayBuffer(file);
			}
		}
	}

	/**
	 * 画像差し替え
	 * @param {*} evt 
	 */
	onUpdateImage(evt) {
		// ユーザー入力画像をファイルから読み込んだ後、actionを発火
		let id = this.getUpdateImageID();
		let fileReader = new FileReader();
		fileReader.onloadend = (e) => {
			if (e.target.result) {
				if (!Validator.checkCapacity(e.target.result.byteLength)) {
					return;
				}
				let elem = document.getElementById(id);
				if (elem) {
                    this.previewArea.removeChild(elem);
				}
				if (this.store.hasMetadata(id)) {
					let buffer = new Uint8Array(e.target.result);
					let blob = new Blob([buffer], { type: "image/jpeg" });
					let img = document.createElement('img');
					img.src = URL.createObjectURL(blob);
					img.className = "image_content";
					img.onload = () => {
						this.action.updateImage({ id : id, img : img, file : e.target.result });
						URL.revokeObjectURL(img.src);
					};
				}
			}
		};
		let files = evt.target.files;
		for (let i = 0, file = files[i]; file; i = i + 1, file = files[i]) {
			if (file.type.match('image.*')) {
				fileReader.readAsArrayBuffer(file);
			}
		}
    }

	/**
	 * URL入力
	 */
	inputURL() {
		InputDialog.showTextInput({
				name : i18next.t('add_url'),
				initialName :  "",
				okButtonName : "Send",
			}, (value) => {
				this.action.inputURL(value);
				//this.emit(GUI.EVENT_URLSENDBUTTON_CLICKED, null, value);
			});
	}

	/**
	 * テキスト入力
	 */
	onInputText(value, w, h) {
		let elem = document.createElement('pre');
		let text = value;
		if (!text) {
			text = "";
		}
		elem.className = "text_content";
		elem.innerHTML = text;

		let posx = this.store.getState().getContextPos().x;
		let posy = this.store.getState().getContextPos().y;
		if (!posx && !posy) {
			// メニューから追加したときなど. wholescreenの左上端に置く.
			posx = Vscreen.getWhole().x;
			posy = Vscreen.getWhole().y;
		}

		this.previewArea.appendChild(elem);
		let metaData = {};
		VscreenUtil.transPosInv(metaData);
		metaData.posx = posx;
		metaData.posy = posy;
		metaData.width = elem.offsetWidth / Vscreen.getWholeScale();
		metaData.height = elem.offsetHeight / Vscreen.getWholeScale();
		metaData.visible = true;
		this.previewArea.removeChild(elem);
		// テキストのときはメタデータにもテキストをつっこむ
		metaData.user_data_text = JSON.stringify({ text: text });

		this.action.inputText({
			contentData : text,
			metaData : metaData
		})
	}

	/**
	 * レイアウト入力
	 */
	onInputLayout(memo) {
		let layout = {
			contents: {}
		};

		// コンテンツのメタデータを全部コピー
		this.store.for_each_metadata((id, metaData) => {
			if (Validator.isContentType(metaData)) {
				layout.contents[id] = metaData;
			}
		});

		layout = JSON.stringify(layout);
		this.action.inputLayout( {
			contentData : layout,
			metaData : {
				type: Constants.TypeLayout,
				user_data_text: JSON.stringify({ text: memo }),
				visible: false
			}
		})
	}

	/**
	 *  ファイルドロップハンドラ
	 * @param {Object} evt FileDropイベント
	 */
	dropFile(evt) {
		let rect = evt.target.getBoundingClientRect();
		let px = rect.left + offsetX(evt);
		let py = rect.top + offsetY(evt);
		let time = new Date().toISOString();
		let files = evt.dataTransfer.files;
		for (let i = 0; i < files.length; i ++) {
			(() => {
				let file = files[i];
				let reader = new FileReader();

				if (file.type.match('image.*')) {
					reader.onloadend = (evt) => {
						let data = evt.target.result;
						this.action.inputImageFile({
							contentData : data,
							metaData : { posx: px, posy: py, visible: true, timestamp : time}
						});
					};
					reader.readAsArrayBuffer(file);

				} else if (file.type.match('text.*')) {
					reader.onloadend = (evt) => {
						let data = evt.target.result;
						this.action.inputTextFile({
							contentData : data,
							metaData : { posx: px, posy: py, visible: true }
						});
					};
					reader.readAsText(file);

				} else if (file.type.match('video.*')) {
					reader.onloadend = (evt) => {
						let data = evt.target.result;
						this.action.inputVideoFile({
							contentData : data,
							metaData : {
								posx: px,
								posy: py,
								visible: true,
								user_data_text: JSON.stringify({ text:  file.name }),
								subtype : "file"
							}
						});
					};
					reader.readAsArrayBuffer(file);
				} else if (file.type.match('application/pdf')) {
					reader.onloadend = (evt) => {
						let data = evt.target.result;
						this.action.inputPDFFile({
							contentData : data,
							metaData : { posx: px, posy: py, visible: true }
						});
					};
					reader.readAsArrayBuffer(file);
				}
			})();
		}
	}

	/**
	 * 更新画像ファイル設定
	 */
    setUpdateImageID(id) {
		this.contentsInput.setUpdateImageID(id);
    }
    
	/**
	 * 更新画像ファイルID取得
	 */
    getUpdateImageID() {
        return this.contentsInput.getUpdateImageID();
	}
	
	/**
	 * 画像ファイル入力
	 */
    inputImageFile() {
        this.contentsInput.inputImageFile();
	}
	
	/**
	 * 更新画像ファイル入力
	 */
    inputUpdateImageFile() {
        this.contentsInput.inputUpdateImageFile();
    }

	/**
	 * テキストファイル入力
	 */
    inputTextFile() {
        this.contentsInput.inputTextFile();
    }

	/**
	 * PDFファイル入力
	 */
    inputPDFFile() {
        this.contentsInput.inputPDFFile();
    }

	/**
	 * 動画ファイル入力
	 */
    inputVideoFile() {
        this.contentsInput.inputVideoFile();
	}
	
	/**
	 * テキスト入力
	 */
	inputText() {	
		InputDialog.showMultiTextInput({
				name : i18next.t('add_text'),
				okButtonName : "Send"
			}, (value, w, h) => {
				this.onInputText(value, w, h);
			}
		);
	}

	/**
	 * レイアウト入力
	 */
	inputLayout() {
		InputDialog.showMultiTextInput({
			name: i18next.t('add_layout_memo'),
			okButtonName: "OK"
		}, (memo) => {
			this.onInputLayout(memo);
		});
	}

	/**
	 * スクリーンシェア入力
	 */
	inputScreenShare() {
		let request = { sources: ['screen', 'window', 'tab', 'audio'] };
		let userAgent = window.navigator.userAgent.toLowerCase();
		if (userAgent.indexOf('chrome') != -1) {
			// chrome
			InputDialog.showTextInput({
				name: i18next.t('input_extension_id'),
				okButtonName: "OK"
			}, (extensionID) => {
				chrome.runtime.sendMessage(extensionID, request, (response) => {
					let target = {
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
						navigator.getUserMedia(target, (stream) => {
							this.action.inputVideoStream({
								contentData : stream,
								metaData : {
									posx: Vscreen.getWhole().x, 
									posy: Vscreen.getWhole().y, 
									visible: true,
									subtype : "screen"
								}
							})
						}, function (err) {
							console.error('Could not get stream: ', err);
						});
					} else {
						console.error('Could not get stream');
					}
				});
			});
		} else {
			let mediaConstraints = {
				video: {
					mediaSource: "screen"
				},
			};
			navigator.mediaDevices.getUserMedia(mediaConstraints).then((stream) => {
				this.action.inputVideoStream({
					contentData : stream,
					metaData : {
						group: gui.getCurrentGroupID(),
						posx: Vscreen.getWhole().x,
						posy: Vscreen.getWhole().y,
						visible: true,
						subtype : "screen"
					}
				})
			}).catch(function (err) {
				console.error('Could not get stream: ', err);
			});
		}
	}

	inputCameraShare() {
		let constraints = {video: true, audio: true};
		navigator.mediaDevices.getUserMedia(constraints).then(
			(stream) => {
				this.action.inputVideoStream({
					contentData : stream,
					metaData : {
						posx: Vscreen.getWhole().x,
						posy: Vscreen.getWhole().y,
						visible: true,
						subtype : "camera"
					}
				})
			},
			(err) => {
				console.error('Could not get stream: ', err);
			});
	}

	updateLayout() {
		let metaData;
		let isLayoutSelected = false;
	
		this.store.getState().for_each_selected_id((i, id) => {
			if (this.store.hasMetadata(id)) {
				metaData = this.store.getMetaData(id);
				if (Validator.isLayoutType(metaData)) {
					isLayoutSelected = true;
					return true;
				}
			}
		});
		if (!isLayoutSelected) {
			InputDialog.showOKInput({
				name: i18next.t('select_target_layout')
			}, function () { });
			return;
		}
		InputDialog.showOKCancelInput({
			name: i18next.t('layout_overwrite_is_ok'),
			okButtonName: "OK"
		}, (isOK) => {
			if (isOK) {
				this.action.updateLayout(metaData);
			}
		});
	}

    setUpdateImageID(id) {
        this.contentsInput.setUpdateImageID(id);
    }
    
	getDOM() {
		return this.dom;
	}
}

export default ContentInputGUI;