/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Store from './store';
import Action from '../action';
import Validator from '../../common/validator.js';
import Command from '../../common/command';
import VscreenUtil from '../../common/vscreen_util';
import manipulator from '../manipulator'

class ContentStore
{
	constructor(connector, state, store, action) {
		this.connector = connector;
        this.state = state;
        this.store = store;
		this.action = action;

		this.initEvents();
	}

	initEvents() {
		for (let i in Action) {
			if (i.indexOf('EVENT') >= 0) {
				this.action.on(Action[i], ((method) => {
					return (err, data) => {
						if (this[method]) {
							this[method](data);
						}
					};
				})('_' + Action[i]));
			}
		}
	};
    
	/**
	 * Content追加
	 * @method addContent
	 * @param {JSON} metaData コンテンツのメタデータ
	 * @param {BLOB} binary コンテンツのバイナリデータ
	 */
	addContent(metaData, binary, endCallback) {
		if (!metaData.hasOwnProperty("zIndex")) {
			metaData.zIndex = this.store.getZIndex(metaData, true);
		}
		if (!Validator.checkCapacity(binary.byteLength)) {
			return;
		}
		this.store.operation.addContent(metaData, binary);
	}

	/**
	 * 画像ファイルの入力
	 * @param {*} data 
	 */
	_inputImageFile(data) {
		let metaData = data.metaData;
		metaData.type = "image";
		metaData.group = this.store.getGroupStore().getCurrentGroupID();
		this.addContent(metaData, data.contentData);
    }
    
	/**
	 * PDFファイルの入力
	 * @param {*} data 
	 */
    _inputPDFFile(data) {
        let metaData = data.metaData;
        let contentData = data.contentData;

		let pdfjsLib = window['pdfjs-dist/build/pdf'];
		window.PDFJS.cMapUrl = './js/3rd/pdfjs/cmaps/';
		window.PDFJS.cMapPacked = true;
		pdfjsLib.getDocument(contentData).then((pdf) => {
			pdf.getPage(1).then((page) => {
				let viewport = page.getViewport(1);
				metaData.type = 'pdf';
				metaData.width = viewport.width;
				metaData.height = viewport.height;
				metaData.group = this.store.getGroupStore().getCurrentGroupID();
				metaData.pdfPage = 1;
				metaData.pdfNumPages = pdf.numPages;
				VscreenUtil.transPosInv(metaData);
				this.addContent(metaData, contentData);
			});
		});
    }

    /**
     * テキストファイル入力
     * @param {*} data 
     */
    _inputTextFile(data) {
		let metaData = data.metaData;
		metaData.type = "text";
		metaData.group = this.store.getGroupStore().getCurrentGroupID();
		this.addContent(metaData, data.contentData);
    }

    /**
     * URLを入力
     * @param {*} data 
     */
    _inputURL(data) {
        let value = data;
		value = value.split(' ').join('');
		if (value.indexOf("http") < 0) {
			console.error(value)
			return;
		}

		try {
            value = decodeURI(value);
			this.addContent({ type: "url", user_data_text: JSON.stringify({ text: value }) }, value);
		} catch (e) {
			console.error(e);
		}
    }
    
    /**
     * テキストを入力
     * @param {*} data 
     */
    _inputText(data) {
		let metaData = data.metaData;
		metaData.type = "text";
        metaData.group = this.store.getGroupStore().getCurrentGroupID();
        this.addContent(metaData, data.contentData);
    }

    /**
     * レイアウトを入力
     * @param {*} data 
     */
    _inputLayout(data) {
		let metaData = data.metaData;
		metaData.type = "layout";
        metaData.group = this.store.getGroupStore().getCurrentGroupID();
        this.addContent(metaData, data.contentData);
    }

	/**
	 * 画像の差し替えが要求された
	 * @param {Object} data { id : id, img : img, file : file }
	 */
	_updateImage(data) {
		let metaData = this.store.getMetaData(data.id);
		metaData.type = "image";
		metaData.width = data.img.naturalWidth;
		metaData.height = data.img.naturalHeight;
		delete metaData.orgWidth;
		delete metaData.orgHeight;
		this.store.operation.updateContent(metaData, data.file);
	}
	
    /**
     * レイアウトの上書きが要求された
     */
    _updateLayout(data) {
        let layout = { contents: {} };
        let layoutData;

        // コンテンツのメタデータを全部コピー
        this.store.for_each_metadata((id, metaData) => {
            if (Validator.isContentType(metaData)) {
                layout.contents[id] = metaData;
            }
        });
        layoutData = JSON.stringify(layout);

        this.store.getState().for_each_selected_id((i, id) => {
            if (this.store.hasMetadata(id)) {
                let metaData = this.store.getMetaData(id);
                if (Validator.isLayoutType(metaData)) {
					this.store.operation.updateContent(metaData, layoutData);
                }
            }
        });
	}

	/**
	 * コンテンツ取得.
	 */
	_getContent(data) {
		let callback = Store.extractCallback(data);
		this.store.operation.getContent(data.request, callback, data.preventDefaultEmit);
	}

	/**
	 * コンテンツ削除.
	 */
	_deleteContent(data) {
		let metaDataList = [];
		if (data) {
			// 引数のメタデータのコンテンツを削除
			metaDataList = data;
		} else {
			// 選択してるコンテンツを削除
			this.store.getState().for_each_selected_id((i, id) => {
				if (this.store.hasMetadata(id)) {
					let metaData = this.store.getMetaData(id);
					if (!this.store.getManagement().isEditable(metaData.group)) {
						// 編集不可コンテンツ
						return true;
					}
					metaData.visible = false;
					metaDataList.push(metaData);
				}
			});
		}
		if (metaDataList.length > 0) {
			this.store.operation.deleteContent(metaDataList);
		}
	}

	/**
	 * コンテンツを選択
	 * @param {*} data 
	 */
	_selectContent(data) {
		this.store.emit(Store.EVENT_SELECT_CONTENT, null, data);
	}
	
	/**
	 * コンテンツ選択解除
	 * @param {*} data 
	 */
	_unselectContent(data) {
		if (data.hasOwnProperty('id')) {
			this.store.emit(Store.EVENT_UNSELECT_CONTENT, null, data);
		} else {
			// 全て選択解除
			for (let i = this.store.getState().getSelectedIDList().length - 1; i >= 0; i = i - 1) {
				this._unselectContent({
					id : this.store.getState().getSelectedIDList()[i], 
					isUpdateMetaInfo : data.isUpdateMetaInfo
				});
			}
			this.store.getState().clearDragRect();
		}
	}

	/**
	 * コンテンツ復元
	 */
	_restoreContent(data) {
		let id = this.store.getState().getSelectedID();
		if (this.store.hasMetadata(id) && Validator.isContentType(this.store.getMetaData(id))) {
			let metaData = this.store.getMetaData(id);
			if (metaData.hasOwnProperty('backup_list') && metaData.backup_list.length >= data.restoreIndex) {
				metaData.restore_index = data.restoreIndex;
				this.store.operation.getContent(metaData, (err, reply) => {
					if (reply.hasOwnProperty('metaData')) {
						if (Validator.isTextType(reply.metaData)) {
							metaData.user_data_text = JSON.stringify({ text: reply.contentData });
						}
						reply.metaData.restore_index = data.restoreIndex;
						if (!data.isRestore) {
							reply.metaData.posx = metaData.posx;
							reply.metaData.posy = metaData.posy;
						}
						this.store.operation.updateMetadata(reply.metaData, (err, res) => {
							this.store.emit(Store.EVENT_DONE_RESTORE_CONTENT, err, reply);
						});
						manipulator.removeManipulator();
					}
				});
			}
		}
	}

	/**
	 * Historyコンテンツ復元
	 * @param {*} data 
	 */
	_restoreHistoryContent(data) {
		let restoreKey = data.restoreKey;
		let restoreValue = data.restoreValue;
		
		let id = this.store.getState().getSelectedID();
		if (this.store.hasMetadata(id) && Validator.isContentType(this.store.getMetaData(id))) {
			let metaData = this.store.getMetaData(id);
			if (metaData.hasOwnProperty('history_data')) {
				let historyData = JSON.parse(metaData.history_data);
				if (historyData && historyData.hasOwnProperty(restoreKey)) {
					metaData.restore_key = restoreKey;
					metaData.restore_value = restoreValue;
					this.store.operation.getContent(metaData, (err, reply) => {
						if (err) {
							console.error(err)
							return;
						}
						if (reply.hasOwnProperty('metaData')) {
							reply.metaData.restore_key = restoreKey;
							reply.metaData.restore_value = restoreValue;
							reply.metaData.posx = metaData.posx;
							reply.metaData.posy = metaData.posy;
							this.store.operation.updateMetadata(reply.metaData, (err, reply) => {
								this.store.emit(Store.EVENT_DONE_RESTORE_HISTORY_CONTENT, err, reply);
							});
							manipulator.removeManipulator();
						} else if (reply.hasOwnProperty('restore_key')) {
							reply.restore_key = restoreKey;
							reply.restore_value = restoreValue;
							reply.posx = metaData.posx;
							reply.posy = metaData.posy;
							this.store.operation.updateMetadata(reply, (err, reply) => {
								this.store.emit(Store.EVENT_DONE_RESTORE_HISTORY_CONTENT, err, reply);
							});
							manipulator.removeManipulator();
						}
					});
				}
			}
		}
	}

	/**
	 * コンテンツを非表示にする
	 */
	_changeContentVisible(data) {
		let metaDataList = [];

		manipulator.removeManipulator();

		this.store.getState().for_each_selected_id((i, id) => {
			if (this.store.hasMetadata(id)) {
				let metaData = this.store.getMetaData(id);
				if (!this.store.getManagement().isEditable(metaData.group)) {
					// 編集不可コンテンツ
					return;
				}
				metaData.visible = data.visible;
				metaDataList.push(metaData);
			}
		});
		if (metaDataList.length > 0) {
			this.store.operation.updateMetadataMulti(metaDataList);
		}
	}

	/**
	 * コンテンツのzindex変更が要求された
	 * @param {Object} data { toFront : 最前面に移動ならtrue, 最背面に移動ならfalse }
	 */
	_changeContentIndex(data) {
		let metaDataList = [];
		this.store.getState().for_each_selected_id((i, id) => {
			if (this.store.hasMetadata(id)) {
				let metaData = this.store.getMetaData(id);
				if (data.hasOwnProperty('toFront')) {
					metaData.zIndex = this.store.getZIndex(metaData, data.toFront);
				} else {
					metaData.zIndex = data.zIndex;
				}
				metaDataList.push(metaData);
			}
		});
		if (metaDataList.length > 0) {
			this.store.operation.updateMetadataMulti(metaDataList, () => {
				this.store.emit(Store.EVENT_CONTENT_INDEX_CHANGED, null, metaDataList)
			});
		}
	}

	/**
	 * コンテンツの位置、幅、高さの変更
	 * @param {*} data 
	 */
	_changeContentTransform(data) {
		let id = this.store.getState().getSelectedID();
		if (!id) return;
		let aspect = 1.0;

		let metaData = this.store.getMetaData(id);
		if (!this.store.getManagement().isEditable(metaData.group)) {
			// 編集不可コンテンツ
			return;
		}
		let isWidthChanged = (data.width > 10) && (Number(Math.floor(metaData.width)) !== Number(data.width));
		let isHeightChanged = (data.height > 10) && (Number(Math.floor(metaData.height)) !== Number(data.height));
		if (metaData) {
			metaData.posx = data.posx;
			metaData.posy = data.posy;
			metaData.width = data.width;
			metaData.height = data.height;

			aspect = data.aspect;
			if (metaData.orgHeight) {
				aspect = metaData.orgHeight / metaData.orgWidth;
			}
			
			if (isWidthChanged && data.width > 10) {
				metaData.width = data.width;
				metaData.height = data.width * aspect;
			}
			if (isHeightChanged && data.height > 10) {
				metaData.width = data.height / aspect;
				metaData.height = data.height;
			}
		}

		this.store.operation.updateMetadata(metaData);
		this.store.emit(Store.EVENT_CONTENT_TRANSFORM_CHANGED, null, metaData);
	}

	/**
	 * コンテンツのメモの変更
	 * @param {*} data 
	 */
	_changeContentMetaInfo(data) {
		let callback = Store.extractCallback(data);
		if (!data.metaData) {
			console.error("not found data.metadata on _changeContentMetaInfo")
			return;
		}

		let metaData = data.metaData;
	
		if (Validator.isTextType(metaData)) {
			metaData.restore_index = -1;

			this.store.operation.updateContent(metaData, text);
			this.store.emit(Store.EVENT_CONTENT_METAINFO_CHANGED, null, metaData);
		} else if (Validator.isLayoutType(metaData)) {
			// レイアウトのメモ変更.
			// レイアウトコンテンツを取得し直しリストを更新する.
			this.store.operation.updateMetadata(metaData, (err, reply) => {
				this.connector.send(Command.GetContent, metaData, (err, data) => {
					this.store.emit(Store.EVENT_CONTENT_METAINFO_CHANGED, null, metaData);
					//controller.doneGetContent(err, data, callback);
				});
			});
		} else {
			// その他コンテンツのメモ変更.
			// リストの更新は必要なし
			this.store.operation.updateMetadata(metaData, (err, reply) => {
				this.store.emit(Store.EVENT_CONTENT_METAINFO_CHANGED, null, metaData);
				if (callback) {
					callback(err, reply);
				}
			});
		}
	}
	
	/**
	 * 時系列データ同期
	 */
	_syncContent(data) {
		let isSync = data.isSync;
		let id = this.store.getState().getSelectedID();
		if (this.store.hasMetadata(id) && Validator.isContentType(this.store.getMetaData(id))) {
			let metaData = this.store.getMetaData(id);
			if (metaData.hasOwnProperty('history_data')) {
				metaData.history_sync = isSync;
				this.store.operation.updateMetadata(metaData);
			}
		}
	}

	/*
	 * コンテンツ用Elementのセットアップ（内部用）
	 */
	_setupContentElement(data) {
		this.store.emit(Store.EVENT_SETUP_CONTENT_ELEMENT, null, data);
	}

	/**
     * 強調表示のトグル
	 */
	_toggleContentMarkIcon(data) {
		this.store.emit(Store.EVENT_TOGGLE_CONTENT_MARK_ICON, null, data);
	}

    /**
     * レイアウトの適用
     */
	_applyContentLayout(data) {
		// レイアウトのコンテンツ(適用対象のメタデータが詰まっている)を取得する
		let request = { type: data.type, id: data.id };
		this._getContent({
			request : request,
			callback : (err, data) => {
				let meta;
				let metaDatas = [];
				if (!err) {
					try {
						let layoutDatas = JSON.parse(data.contentData);
						if (layoutDatas.hasOwnProperty('contents')) {
							for (meta in layoutDatas.contents) {
								let oldData = layoutDatas.contents[meta];
								if (this.store.getMetaData(oldData.id)) {
									if (oldData.hasOwnProperty('backup_list')) {
										// コンテンツは過去レイアウト作成時のものにする
										if (meta.resture_index > 0) {
											let oldContent = meta.backup_list[meta.resture_index];
											for (i = 0; i < this.store.getMetaData(meta.id).backup_list.length; i = i + 1) {
												if (this.store.getMetaData(meta.id).backup_list[i] === oldContent) {
													meta.restore_index = i;
												}
											}
										}
										// 履歴リストは最新にする.
										oldData.backup_list = this.store.getMetaData(oldData.id).backup_list;
									}
									// メモは最新にする.
									oldData.user_data_text = this.store.getMetaData(oldData.id).user_data_text;
								}
								metaDatas.push(oldData);
							}
							this.store.operation.updateMetadataMulti(metaDatas);
						}
					}
					catch (e) {
						console.error(e);
					}
				}
			}
		});
	}

    /**
     * アスペクト比の調整
	 */
	_correctContentAspect(data) {
		let callback = Store.extractCallback(data);
		let metaData = data.metaData;
		let isCorrect = true;
		if (metaData.hasOwnProperty('orgWidth') && metaData.hasOwnProperty('orgHeight')) {
			if (metaData.hasOwnProperty('width') && metaData.hasOwnProperty('height')) {
				let w = parseFloat(metaData.width);
				let h = parseFloat(metaData.height);
				let ow = parseFloat(metaData.orgWidth);
				let oh = parseFloat(metaData.orgHeight);
				let aspect = w / h;
				let orgAspect = ow / oh;
				if (orgAspect !== aspect) {
					if (aspect > 1) {
						metaData.height = w / orgAspect;
					} else {
						metaData.width = h * orgAspect;
					}
					isCorrect = false;
					this.store.operation.updateMetadata(metaData, (err, metaData) => {
						if (callback) {
							callback(err, metaData[0]);
						}
					});
				}
			}
		}
		if (isCorrect && callback) {
			callback(null, metaData);
		}
	}

	/**
	 * 
	 */
	_snapContentToScreen(data) {
		let metaData = data.metaData;
		let splitWhole = data.screen;

		let orgWidth = parseFloat(metaData.orgWidth);
		let orgHeight = parseFloat(metaData.orgHeight);
		let vaspect = splitWhole.w / splitWhole.h;
		let aspect = orgWidth / orgHeight;
		if (Validator.isWindowType(metaData)) {
			if (!this.store.getManagement().isDisplayEditable(metaData.group)) {
				// 編集不可コンテンツ
				return;
			}
		}
		else {
			if (!this.store.getManagement().isEditable(metaData.group)) {
				// 編集不可コンテンツ
				return;
			}
		}
		metaData.posx = splitWhole.x;
		metaData.posy = splitWhole.y;
		if (aspect > vaspect) {
			// content is wider than split area
			metaData.width = splitWhole.w;
			metaData.height = splitWhole.w / aspect;
		}
		else {
			// content is highter than split area
			metaData.height = splitWhole.h;
			metaData.width = splitWhole.h * aspect;
		}
		this.store.emit(Store.EVENT_DONE_SNAP_CONTENT_TO_SCREEN, null, data.element);
	}
}

export default ContentStore;