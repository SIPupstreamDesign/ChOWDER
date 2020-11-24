/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Vscreen from '../common/vscreen';
import VscreenUtil from '../common/vscreen_util';

class DisplayUtil
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

    static isFullScreen() {
        return !(!document.fullscreenElement &&    // alternative standard method
            !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement );
    }

    static toggleFullScreen() {
        if (!DisplayUtil.isFullScreen()) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            } else if (document.documentElement.msRequestFullscreen) {
                document.documentElement.msRequestFullscreen();
            } else if (document.documentElement.mozRequestFullScreen) {
                document.documentElement.mozRequestFullScreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    }

    static getTargetEvent(){
        if(window.ontouchstart !== undefined){
            return {
                mode: 'touch',
                start: 'touchstart',
                move: 'touchmove',
                end: 'touchend'
            };
        }else{
            return {
                mode: 'mouse',
                start: 'mousedown',
                move: 'mousemove',
                end: 'mouseup'
            };
        }
    }

    /**
     * コンテンツタイプから適切なタグ名を取得する.
     * @method getTagName
     * @param {String} contentType コンテンツタイプ.
     */
    static getTagName(contentType) {
        let tagName;
        if (contentType === 'text') {
            tagName = 'pre';
        } else if (contentType === 'video') {
            tagName = 'video';
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
     * random ID (8 chars)
     */
    static generateID() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000000).toString(16).substring(1);
        }
        return s4() + s4();
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
            if (child.id && child.id.indexOf('_manip') < 0) {
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
    
    /**
     * webGLのiframeのサイズを計算して返す
     * @param {*} metaData
     */
    static calcWebGLFrameRect(store, metaData) {

        let win = store.getWindowData();
        
		let winR = Vscreen.makeRect(
			win.posx,
			win.posy,
			win.width,
			win.height
        );
        
		let metaR = Vscreen.makeRect(
			metaData.posx,
			metaData.posy,
			metaData.width,
			metaData.height
        );
        
        // 左上0,0で、実ピクセルサイズ
        const orgWin =  Vscreen.transform(winR);
        // orgWinと同様の座標系でのコンテンツrect
        const orgRect = Vscreen.transform(metaR);
        // コンテンツ左上を(0,0)とした座標系での、windowのrectを求める。
        
        // 結果用rect
        let rect = {
            x : Math.floor(orgWin.x - orgRect.x - 0.5),
            y : Math.floor(orgWin.y - orgRect.y - 0.5),
            w : Math.ceil(orgWin.w + 1.0),
            h : Math.ceil(orgWin.h + 1.0)
        }

        return rect;
    }
}

export default DisplayUtil;