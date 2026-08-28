/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import VscreenUtil from '../common/vscreen_util'
import Validator from '../common/validator'

class ContentUtil
{    
    /**
     * エレメント間でコンテントデータをコピーする.
     */
    static copyContentData(store, fromElem, toElem, metaData, isListContent) {
        store.for_each_metadata(function (id, meta) {
            let elem;
            if (id !== metaData.id) {
                if (meta.content_id === metaData.content_id) {
                    if (isListContent) {
                        elem = gui.getListElem(id);
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
                            VscreenUtil.assignMetaData(toElem, metaData, true, store.getGroupDict());
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
    
	/**
	 * 辞書順でElementをareaに挿入.
	 * @method insertElementWithDictionarySort
	 * @param {Element} area  挿入先エリアのelement
	 * @param {Element} elem  挿入するelement
	 */
	static insertElementWithDictionarySort(area, elem) {
		let isFoundIDNode = false;
		if (!area.childNodes || area.childNodes.lendth === 0) {
			area.appendChild(elem);
			return;
		}
		for (let i = 0; i < area.childNodes.length; i = i + 1) {
			let child = area.childNodes[i];
			if (child.hasOwnProperty('id') && child.id.indexOf('_manip') < 0) {
				if (elem.id < child.id) {
					isFoundIDNode = true;
					area.insertBefore(elem, child);
					break;
				}
			}
		}
		if (!isFoundIDNode) {
			area.appendChild(elem);
			return;
		}
    }
    
	static getTotalSelectionRect(store) {
		let totalRect = {
			left: Number.MAX_VALUE, top: Number.MAX_VALUE,
			right: -Number.MIN_VALUE, bottom: -Number.MIN_VALUE
		};
		for (let i = 0; i < store.getState().getSelectedIDList().length; ++i) {
			let id = store.getState().getSelectedIDList()[i];
			let elem = document.getElementById(id);
			if (elem) {
				let metaData = store.getMetaData(elem.id);
				if (Validator.isContentType(metaData) && !Validator.isVisible(metaData)) {
					// 非表示コンテンツ
					continue;
				}
				if (!store.getManagement().isEditable(metaData.group) &&
					!store.getManagement().isDisplayEditable(metaData.group)) {
					// 編集不可コンテンツ
					continue;
				}
				VscreenUtil.trans(metaData);
				totalRect.left = Math.min(totalRect.left, store.getState().getDragRect(id).left);
				totalRect.top = Math.min(totalRect.top, store.getState().getDragRect(id).top);
				totalRect.right = Math.max(totalRect.right, store.getState().getDragRect(id).right);
				totalRect.bottom = Math.max(totalRect.bottom, store.getState().getDragRect(id).bottom);
			}
		}
		return totalRect;
    }
    
    /**
     * 指定された座標がelementの内部に存在するかを判定する
     * @method isInsideElement
     * @param {Element} element
     * @param {String} x x座標値
     * @param {String} y y座標値
     */
    static isInsideElement(elem, x, y) {
        let posx = parseInt(elem.style.left.split("px").join(''), 10),
            posy = parseInt(elem.style.top.split("px").join(''), 10),
            width = parseInt(elem.style.width.split("px").join(''), 10),
            height = parseInt(elem.style.height.split("px").join(''), 10);
        
        if (store.hasMetadata(elem.id)) {
            return (posx <= x && posy <= y &&
                    (posx + width) > x &&
                    (posy + height) > y);
        }
        return false;
    }
    
    static isNumber(x){ 
        if( typeof(x) != 'number' && typeof(x) != 'string' )
            return false;
        else 
            return (x == parseFloat(x) && isFinite(x));
    }

    static sortHistory(values) {
        try {
            values.sort(function (a, b) {
                if (ContentUtil.isNumber(a)) {
                    a = Number(a);
                } else {
                    a = a.toString().toLowerCase();
                }
                if (ContentUtil.isNumber(b)) {
                    b = Number(b);
                } else {
                    b = b.toString().toLowerCase();
                }
                if (a < b){
                    return -1;
                }else if (a > b){
                    return 1;
                }
                return 0;
            });
        } catch (e) {

        }
        return values;
    }

    static extractHistoryData(metaData) {
        let historyData;
        try {
            historyData = JSON.parse(metaData.history_data);
            return historyData;
        }
        catch (e) {
        }
        return null;
    }

    /**
     * random ID (8 chars)
     */
    static generateID() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000000).toString(16);
        }
        return s4();
    }


	static toBlob(canvas) {
        const mime = "image/png";
		let base64 = canvas.toDataURL(mime);
		// Base64からバイナリへ変換
		let bin = atob(base64.replace(/^.*,/, ''));
		let buffer = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) {
			buffer[i] = bin.charCodeAt(i);
		}
		// Blobを作成
		let blob = new Blob([buffer.buffer], {
			type: mime
		});
		return blob;
	}
}

export default ContentUtil;