/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Store from './store/store';
import Constants from '../common/constants.js';
import Validator from '../common/validator';
import Vscreen from '../common/vscreen.js';
import VscreenUtil from '../common/vscreen_util.js';
import Menu from '../components/menu.js';
import DisplayUtil from './display_util';
import MediaPlayer from '../common/mediaplayer.js';
import Connector from '../common/ws_connector.js'; // TODO 消す

class GUI extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;
        
        this.store.on(Store.EVENT_DONE_DELETE_ALL_ELEMENTS, (err, idList) => {
            console.error("EVENT_DONE_DELETE_ALL_ELEMENTS", idList)
            let previewArea = document.getElementById('preview_area');
            for (let i = 0; i < idList.length; ++i) {
                let id = idList[i];
                let elem = document.getElementById(id);
                if (elem) {
                    previewArea.removeChild(elem);
                }
            }
        });

        this.player = null;

        // 上部メニュー
        this.headMenu = null;
    }

    init() {
        this.initWindow();
        this.initMenu();
    }

    initWindow() {
        // ウィンドウリサイズ時の処理
        let timer;
        window.onresize = () => {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                this.action.resizeWindow({
                    size : this.getWindowSize()
                });
            }, 200);
        };

        if (DisplayUtil.getTargetEvent().mode === 'mouse') {
            window.document.addEventListener("mousedown", function () {
                let displayArea = document.getElementById('displayid_area');
                if (displayArea.style.display !== "none") {
                    displayArea.style.display = "none";
                }
            });
        } else {
            window.document.addEventListener("touchstart", function () {
                let displayArea = document.getElementById('displayid_area');
                if (displayArea.style.display !== "none") {
                    displayArea.style.display = "none";
                }
            });
        }
    }

    // 上部メニューの初期化.
    initMenu() {
        let registered = false;
        let onfocus = false;
        // 時間たったら隠す関数
        let hideMenuFunc = function () {
                // console.log("onfocus:", onfocus);
                if (!onfocus) {
                    // console.log("hideMenuFunc");
                    document.getElementById('head_menu').classList.add('hide');
                }
                registered = false;
            };

        window.addEventListener('mousemove', function (evt) {
            document.getElementById('head_menu').classList.remove('hide');
            if (!registered) {
                registered = true;
                setTimeout(hideMenuFunc, 3000);
            }
        });
        
        // メニュー設定
        let menuSetting = [
            {
                Display : [{
                        Controller : {
                            func : () => {
                                window.open("controller.html"); // TODO コントローラIDの設定どうするか
                            }
                        }
                    }],
                url : "display.html"
            },
            {
                Setting : [{
                    Fullscreen : {
                        func : function(evt, menu) { 
                            if (!DisplayUtil.isFullScreen()) {
                                menu.changeName("Fullscreen", "CancelFullscreen")
                            } else {
                                menu.changeName("CancelFullscreen", "Fullscreen")
                            }
                            DisplayUtil.toggleFullScreen();
                        }
                    }
                }]
	    	}];

        this.headMenu = new Menu("display", menuSetting);
        document.getElementsByClassName('head_menu')[0].appendChild(this.headMenu.getDOM());

        this.headMenu.getIDInput().onfocus = (ev) => {
            // console.log("onfocus");
            onfocus = true;
            document.getElementById('head_menu').classList.remove('hide');
            clearTimeout(hideMenuFunc);
        };
        this.headMenu.getIDInput().onblur = (ev) => {
            // console.log("onblur");
            onfocus = false;
            this.action.changeDisplayID({ id : this.headMenu.getIDValue()});
        };
        this.headMenu.getIDInput().onkeypress = (ev) => {
            // console.log(ev.keyCode);
            if (ev.keyCode === 13) { // enter
                this.action.changeDisplayID({ id : this.headMenu.getIDValue()});
            }
        };
    }

    getHeadMenu() {
        return this.headMenu;
    }

    /**
     * クライアントサイズを取得する.
     * ただの `{width: window.innerWidth, height: window.innerHeight}`.
     * @method getWindowSize
     * @return {Object} クライアントサイズ
     */
    getWindowSize() {
        return {
            width : window.innerWidth,
            height : window.innerHeight
        };
    }
    
    /**
     * リモートカーソルの自動リサイズ
     */
    autoResizeCursor(elems) {
        let ratio = Number(window.devicePixelRatio);
        /*
        let width = Number(screen.width);
        let height = Number(screen.height);
        let w = width;
        let h = height;
        let area = w * h;
        let mul = area / 100000.0 / 40.0;
        */
        let  mul = 1.0 / ratio * 2;

        for (let i = 0; i < elems.length; ++i) {
            elems[i].style.transform = "scale(" + mul + ")";
            elems[i].style.transformOrigin = "left top 0";
        }
        return mul;
    }
        
    /**
     * マークによるコンテンツ強調表示のトグル
     * @param {Element} elem 対象エレメント
     * @param {JSON} metaData メタデータ
     */
    toggleMark(elem, metaData) {
        let groupDict = this.store.getGroupDict();
        if (elem && metaData.hasOwnProperty("id")) {
            if (metaData.hasOwnProperty(Constants.MARK) && (metaData[Constants.MARK] === 'true' || metaData[Constants.MARK] === true)) {
                if (!elem.classList.contains(Constants.MARK)) {
                    elem.classList.add(Constants.MARK);
                    if (metaData.hasOwnProperty("group") && groupDict.hasOwnProperty(metaData.group)) {
                        elem.style.borderColor = groupDict[metaData.group].color;
                        elem.style.borderWidth = "6px";
                    }
                }
            } else {
                if (elem.classList.contains(Constants.MARK)) {
                    elem.classList.remove(Constants.MARK);
                    elem.style.borderWidth = "0px";
                }
            }
            let memo =  document.getElementById("memo:" + metaData.id);
            if (memo) {
                if (metaData.hasOwnProperty("group") && groupDict.hasOwnProperty(metaData.group)) {
                    memo.style.borderColor = "lightgray";
                    memo.style.backgroundColor = "lightgray"; 
                }
                if ( (metaData[Constants.MARK_MEMO] === 'true' || metaData[Constants.MARK_MEMO] === true) && 
                        (metaData["visible"] === 'true' || metaData["visible"] === true) )
                {
                    memo.style.display = "block";
                } else {
                    memo.style.display = "none";
                }
            }
        }
    }

    deleteMark(elem, metaData) {
        if (elem && metaData.hasOwnProperty("id")) {
            let memo =  document.getElementById("memo:" + metaData.id);
            if (memo) {
                memo.style.display = "none";
                if (memo.parentNode) {
                    memo.parentNode.removeChild(memo);
                }
            }
        }
    }
    
    /**
     * 表示非表示の更新.
     * @method updatePreviewAreaVisible
     * @param {JSON} json メタデータ
     */
    updatePreviewAreaVisible(json) {
        let groupDict = this.store.getGroupDict();
        let previewArea = document.getElementById("preview_area");
        let elem = document.getElementById(json.id);
        // console.log("updatePreviewAreaVisible", previewArea, elem);
        if (previewArea) {
            if (Validator.isVisible(json)) {
                VscreenUtil.assignMetaData(previewArea, json, false, groupDict);
                previewArea.style.display = "block";
            } else {
                previewArea.style.display = "none";
            }
        }
        if (elem) {
            if (Validator.isVisible(json)) {
                VscreenUtil.assignMetaData(elem, json, false, groupDict);
                elem.style.display = "block";
            } else {
                elem.style.display = "none";
            }
        }
    }
    
    /**
     * メモを表示.
     * elemにメモ用エレメントをappendChild
     * @param {*} elem 
     * @param {*} metaData 
     */
    showMemo(elem, metaData) {
        let groupDict = this.store.getGroupDict();
        let previewArea = document.getElementById('preview_area');
        let memo = document.getElementById("memo:" + metaData.id);
        if (elem && metaData.user_data_text) {
            if (memo) {
                memo.innerHTML = JSON.parse(metaData.user_data_text).text;
                let rect = elem.getBoundingClientRect();
                memo.style.width = (rect.right - rect.left) + "px";
                memo.style.left = rect.left + "px";
                memo.style.top =  rect.bottom + "px";
                memo.style.zIndex = elem.style.zIndex;
            } else {
                memo = document.createElement("pre");
                memo.id = "memo:" + metaData.id;
                memo.className = "memo";
                memo.innerHTML = JSON.parse(metaData.user_data_text).text;
                let rect = elem.getBoundingClientRect();
                memo.style.left = rect.left + "px";
                memo.style.top = rect.bottom + "px";
                memo.style.position = "absolute";
                memo.style.width = (rect.right - rect.left) + "px";
                memo.style.height = "auto";
                memo.style.whiteSpace = "pre-line";
                memo.style.zIndex = elem.style.zIndex;
                previewArea.appendChild(memo);
            }
            
            if (metaData.hasOwnProperty("group") && groupDict.hasOwnProperty(metaData.group)) {
                memo.style.borderColor = groupDict[metaData.group].color;
                memo.style.backgroundColor = groupDict[metaData.group].color; 
            }
        }
    }

    /**
     * PDFを表示
     * @param {*} elem 
     * @param {*} metaData 
     * @param {*} contentData 
     */
    showPDF(elem, metaData, contentData) {
        if (elem.pdfSetupCompleted) return;
        elem.pdfSetupCompleted = true;
        let context = elem.getContext('2d');

        let pdfjsLib = window['pdfjs-dist/build/pdf'];
        window.PDFJS.cMapUrl = '/3rd/js/pdfjs/cmaps/';
        window.PDFJS.cMapPacked = true;

        pdfjsLib.getDocument(contentData).then(function (pdf) {
            metaData.pdfNumPages = pdf.numPages;

            let lastTask = Promise.resolve();
            let lastDate = 0;
            let lastPage = 0;
            let lastWidth = 0;
            elem.loadPage = function (p, width) {
                let date = Date.now();
                lastDate = date;

                if (lastPage === p && lastWidth === width) { return; }

                setTimeout(function () {
                    if (lastDate !== date) { return; }
                    lastPage = p;
                    lastWidth = width;

                    pdf.getPage(p).then(function (page) {
                        let viewport = page.getViewport(width / page.getViewport(1).width);
                        let orgAspect = metaData.orgWidth / metaData.orgHeight;
                        let pageAspect = viewport.width / viewport.height;

                        elem.width = width;
                        elem.height = width / orgAspect;

                        let transform = [ 1, 0, 0, 1, 0, 0 ];
                        if ( orgAspect < pageAspect ) {
                            let margin = ( 1.0 / orgAspect - 1.0 / pageAspect ) * width;
                            transform[ 5 ] = margin / 2;
                        } else {
                            let margin = ( orgAspect - pageAspect ) * width;
                            transform[ 4 ] = margin / 2;
                            transform[ 0 ] = ( width - margin ) / width;
                            transform[ 3 ] = transform[ 0 ];
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
            elem.loadPage(parseInt(metaData.pdfPage), parseInt(metaData.width));
        });
    }

    playFragmentVideo(videoElem, data) {
        this.player.onVideoFrame(data);
    }

    /**
     * videoを表示
     * @param {*} elem 
     * @param {*} metaData 
     * @param {*} contentData 
     */
    showVideo(elem, metaData, contentData) {
        let webRTCDict = this.store.getWebRTCDict();
        let rtcKey = this.store.getRTCKey(metaData);
        elem.setAttribute("controls", "");
        elem.setAttribute('autoplay', '');
        console.error("showVideo", elem, metaData, contentData)
        //elem.setAttribute('preload', "metadata")
        if (!webRTCDict.hasOwnProperty(rtcKey)) {
            metaData.from = "view";
            Connector.sendBinary('RTCRequest', metaData, JSON.stringify({ key : rtcKey }), () => {
                let webRTC = new WebRTC();
                webRTCDict[rtcKey] = webRTC;
                webRTC.on('addstream', (evt) => {
                    /*
                    let stream = evt.stream ? evt.stream : evt.streams[0];
                    elem.srcObject = stream;

                    if (!webRTC.statusHandle) {
                        let t = 0;
                        webRTC.statusHandle = setInterval( function (rtcKey, webRTC) {
                            t += 1;
                            webRTC.getStatus(function (status) {
                                let bytes = 0;
                                if (status.video && status.video.bytesReceived) {
                                    bytes += status.video.bytesReceived;
                                }
                                if (status.audio && status.audio.bytesReceived) {
                                    bytes += status.audio.bytesReceived;
                                }
                                // console.log("webrtc key:"+ rtcKey + "  bitrate:" + Math.floor(bytes * 8 / this / 1000) + "kbps");
                            }.bind(t));
                        }.bind(this, rtcKey, webRTCDict[rtcKey]), 1000);
                    }
                    */
                    if (!this.player) {
                        this.player = new MediaPlayer(elem, 'video/mp4; codecs="avc1.640033"');
                        this.player.on('sourceOpen', () => {
                            this.player.setDuration(313.47);
                        })
                    }
                });

                webRTC.on('icecandidate', function (type, data) {
                    if (type === "tincle") {
                        metaData.from = "view";
                        Connector.sendBinary('RTCIceCandidate', metaData, JSON.stringify({
                            key : rtcKey,
                            candidate: data
                        }), function (err, reply) {});
                        delete metaData.from;
                    }
                });

                webRTC.on('datachannelmessage', function (err, message) {
                    this.playFragmentVideo(elem, message);
                });
                
                webRTC.on('closed', function () {
                    if (webRTCDict.hasOwnProperty(this)) {
                        if (webRTCDict[this].statusHandle) {
                            clearInterval(webRTCDict[this].statusHandle);
                            webRTCDict[this].statusHandle = null;
                        }
                        delete webRTCDict[this];
                    }
                }.bind(rtcKey));
            });
            delete metaData.from;
        }
    }

    /**
     * テキストを表示
     * @param {*} elem 
     * @param {*} metaData 
     * @param {*} contentData 
     */
    showText(elem, metaData, contentData) {
    	elem.innerHTML = contentData;
    }

    /**
     * 画像を表示
     * @param {*} elem 
     * @param {*} metaData 
     * @param {*} contentData 
     */
    showImage(elem, metaData, contentData) {
        let mime = "image/jpeg";
        if (metaData.hasOwnProperty('mime')) {
            mime = metaData.mime;
        }
        let blob = new Blob([contentData], {type: mime});
        if (elem && blob) {
            URL.revokeObjectURL(elem.src);
            elem.onload = function () {
                if (this.hasOwnProperty('timestamp')) {
                    console.debug(this.id,　"の登録から表示完了までの時間：",  (new Date() - new Date(this.timestamp)) / 1000 + "秒");
                }
            }.bind(metaData);
            elem.src = URL.createObjectURL(blob);
        }
    }

    /**
     * ディスプレイIDの表示.
     * @method showDisplayID
     * @param {string} id ディスプレイID
     */
    showDisplayID(id) {
        // console.log("showDisplayID:" + id);
        if (id && store.getWindowData().id === id) {
            document.getElementById('displayid_area').style.display = "block";
            setTimeout(function () {
                document.getElementById('displayid_area').style.display = "none";
            }, 8 * 1000);
        } else if (id === "") {
            document.getElementById('displayid_area').style.display = "block";
            setTimeout(function () {
                document.getElementById('displayid_area').style.display = "none";
            }, 8 * 1000);
        }
    }

    /**
     * コンテンツロード完了まで表示する枠を作る.
     * @method showBoundingBox
     * @param {JSON} metaData メタデータ
     */
    showBoundingBox(metaData) {
        // console.log("showBoundingBox", metaData);
        let previewArea = document.getElementById('preview_area');
        let tagName = 'div';
        let elem = document.createElement(tagName);

        elem.id = metaData.id;
        elem.style.position = "absolute";
        elem.className = Constants.TemporaryBoundClass;
        this.setupContent(elem, elem.id);
        DisplayUtil.insertElementWithDictionarySort(previewArea, elem);
    }

    /**
     * メタバイナリからコンテンツelementを作成してVirtualScreenに登録
     * @method assignContent
     * @param {JSON} metaData メタデータ
     * @param {Object} contentData コンテンツデータ(テキストまたはバイナリデータ)
     */
    assignContent(metaData, contentData) {
        let previewArea = document.getElementById('preview_area');
        let elem;
        let metaDataDict = this.store.getMetaDataDict();
        let groupDict = this.store.getGroupDict();
    
        // console.log("assignContent", "id=" + metaData.id);
        if (Validator.isWindowType(metaData) || 
            (metaData.hasOwnProperty('visible') && String(metaData.visible) === "true")) {
            let tagName = DisplayUtil.getTagName(metaData.type);
    
            // 既に読み込み済みのコンテンツかどうか
            if (document.getElementById(metaData.id)) {
                elem = document.getElementById(metaData.id);
                // 読み込み完了までテンポラリで枠を表示してる．枠であった場合は消す.
                if (elem.tagName.toLowerCase() !== tagName) {
                    previewArea.removeChild(elem);
                    elem = null;
                }
                // メタデータはGetMetaDataで取得済のものを使う.
                // GetContent送信した後にさらにGetMetaDataしてる場合があるため.
                if (metaDataDict.hasOwnProperty(metaData.id)) {
                    metaData = metaDataDict[metaData.id];
                }
            }
    
            if (!elem) {
                elem = document.createElement(tagName);
                elem.id = metaData.id;
                elem.style.position = "absolute";
                elem.style.color = "white";
                this.setupContent(elem, elem.id);
                DisplayUtil.insertElementWithDictionarySort(previewArea, elem);
                //previewArea.appendChild(elem);
            }
            if (metaData.type === 'video') {
                this.showVideo(elem, metaData, contentData);
            } else if (metaData.type === 'text') {
                // contentData is text
                this.showText(elem, metaData, conetntData);
            } else if (metaData.type === 'pdf') {
                this.showPDF(elem, metaData, contentData);
            } else if (metaData.type === 'tileimage') {
                console.error("Error : faild to handle tileimage");
            } else {
                // contentData is blob
                this.showImage(elem, metaData, contentData);
            }
            VscreenUtil.assignMetaData(elem, metaData, false, groupDict);
            
            // 同じコンテンツを参照しているメタデータがあれば更新
            if (elem) {
                DisplayUtil.copyContentData(this.store, elem, null, metaData, false);
            }
    
            this.showMemo(elem, metaData);
        }
    }
    
    /**
     * タイル画像の枠を全部再生成する。中身の画像(image.src)は作らない。
     * @param {*} elem 
     * @param {*} metaData 
     */
    regenerateTileElements(elem, metaData) {
        let tileIndex = 0;
        let previewArea = document.getElementById('preview_area');
        if (elem) {
            // 読み込み完了までテンポラリで枠を表示してる．枠であった場合は消す.
            if (elem.className === Constants.TemporaryBoundClass) {
                previewArea.removeChild(elem);
                elem = null;
            }
        }
        if (!elem) {
            elem = document.createElement(DisplayUtil.getTagName(metaData.type));
            elem.id = metaData.id;
            elem.style.position = "absolute";
            elem.style.color = "white";
            this.setupContent(elem, elem.id);
            DisplayUtil.insertElementWithDictionarySort(previewArea, elem);
        }
        elem.innerHTML = "";
        // reduction image用
        let image = new Image();
        image.style.position = "absolute";
        image.style.display = "inline";
        image.className = "reduction_image";
        elem.appendChild(image);

        // tile用
        for (let i = 0; i < Number(metaData.ysplit); ++i) {
            for (let k = 0; k < Number(metaData.xsplit); ++k) {
                image = new Image();
                image.style.position = "absolute";
                image.style.display = "inline";
                image.className = "tile_index_" + String(tileIndex);
                elem.appendChild(image);
                ++tileIndex;
            }
        }
    }


    /**
     * タイル画像はassignContentではなくこちらでコンテンツ生成を行う。
     * @param {*} metaData 
     * @param {*} isReload 全て再読み込みする場合はtrue, 読み込んでいない部分のみ読み込む場合はfalse
     */
    assignTileImage(metaData, contentData, isReload) {
        let elem = document.getElementById(metaData.id);
        let tileIndex = 0;
        let request = JSON.parse(JSON.stringify(metaData));

        // ウィンドウ枠内に入っているか判定用
        let whole = Vscreen.transformOrgInv(Vscreen.getWhole());
        whole.x = Vscreen.getWhole().x;
        whole.y = Vscreen.getWhole().y;

        let mime = "image/jpeg";
        let previousElem = null;
        let previousImage = null;
        let isInitial = true;

        for (let i = 0; i < Number(metaData.ysplit); ++i) {
            for (let k = 0; k < Number(metaData.xsplit); ++k) {
                request.tile_index = tileIndex; // サーバーでは通し番号でtile管理している
                let rect = VscreenUtil.getTileRect(metaData, k, i);
                let visible = !VscreenUtil.isOutsideWindow(rect, whole);
                let tileClassName = 'tile_index_' + String(tileIndex);

                if (visible) {
                    if (elem && elem.getElementsByClassName(tileClassName).length > 0) {
                        previousElem = elem.getElementsByClassName(tileClassName)[0]
                    }
                    if (previousElem) {
                        previousImage = previousElem.src.length > 0;
                    } else {
                        // 最初の1個が見つからない場合はimageエレメントを全部作り直す
                        this.regenerateTileElements(elem, metaData);
                        elem = document.getElementById(metaData.id);
                        VscreenUtil.resizeTileImages(elem, metaData);
                    }
                    
                    if (isInitial
                        && metaData.hasOwnProperty('reductionWidth')
                        && metaData.hasOwnProperty('reductionHeight')) {

                        let reductionElem = elem.getElementsByClassName('reduction_image')[0];
                    
                        // contentData(reduction data)を生成
                        // 解像度によらず生成する
                        if (reductionElem.src.length === 0 || isReload) {
                            if (!reductionElem.src.length === 0) {
                                URL.revokeObjectURL(reductionElem.src);	
                            }
                            let blob = new Blob([contentData], {type: mime});
                            reductionElem.src = URL.createObjectURL(blob);
                        }

                        // metadataの解像度がcontentData（縮小版画像）より小さいか調べる
                        if (Number(reductionElem.style.width.split("px").join("")) <= Number(metaData.reductionWidth)
                            && Number(reductionElem.style.height.split("px").join("")) <= Number(metaData.reductionHeight)) {

                            // reductionを表示、タイルを非表示に
                            reductionElem.style.display = "inline";
                            for (let n = 0; n < elem.children.length; ++n) {
                                if (elem.children[n].className !== "reduction_image") {
                                    elem.children[n].style.display = "none"
                                }
                            }
                            return;
                        } else {
                            // reductionを非表示、タイルを表示
                            reductionElem.style.display = "none";
                            for (let n = 0; n < elem.children.length; ++n) {
                                if (elem.children[n].className !== "reduction_image") {
                                    elem.children[n].style.display = "inline"
                                }
                            }
                        }
                    }
                    
                    if (!previousImage || isReload) {
                        Connector.send('GetTileContent', request, function (err, data) {
                            if (err) { console.error(err); return; }
                            let tileClassName = 'tile_index_' + String(data.metaData.tile_index);
                            let blob = new Blob([data.contentData], {type: mime});
                            let image = elem.getElementsByClassName(tileClassName)[0];
                            if (!previousImage) {
                                URL.revokeObjectURL(image.src);	
                            }
                            image.src = URL.createObjectURL(blob);
                        });
                    }

                    isInitial = false;
                }
                ++tileIndex;
            }
        }
    }

    /**
     * コンテンツの選択
     * TODO : storeへ
     * @param {String} targetid 対象コンテンツID
     */
    select(targetid) {
        let groupDict = this.store.getGroupDict();
        let metaData;
        let elem;
        if (this.store.getMetaDataDict().hasOwnProperty(targetid)) {
            metaData = this.store.getMetaDataDict()[targetid];
            elem = document.getElementById(targetid);
            elem.style.borderWidth = "1px";
            elem.style.border = "solid";
            elem.is_dragging = true;
            
            if (elem.classList.contains("mark")) {
                elem.style.borderWidth = "6px";
                if (metaData.hasOwnProperty("group") && groupDict.hasOwnProperty(metaData.group)) {
                    elem.style.borderColor = groupDict[metaData.group].color; 
                }
            }
        }
    }

    /**
     * 現在選択されているContentを非選択状態にする
     * TODO : storeへ
     */
    unselect() {
        for (let i in this.store.getMetaDataDict()) {
            if (this.store.getMetaDataDict().hasOwnProperty(i)) {
                let elem = document.getElementById(this.store.getMetaDataDict()[i].id);
                if (elem && elem.is_dragging) {
                    elem.is_dragging = false;
                    if (!elem.classList.contains("mark")) {
                        elem.style.borderWidth = "0px";
                    }
                }
            }
        }
    }

    /**
     * 現在選択されているContentのエレメントを返す. ない場合はnullが返る.
     * TODO : storeへ
     */
    getSelectedElem() {
        let metaDataDict = this.store.getMetaDataDict();
        for (let i in metaDataDict) {
            if (metaDataDict.hasOwnProperty(i)) {
                let elem = document.getElementById(metaDataDict[i].id);
                if (elem && elem.is_dragging) {
                    return elem;
                }
            }
        }
        return null;
    }

    /**
     * コンテンツにイベント等を設定.
     * @param elem コンテンツのelement
     * @param targetid コンテンツのid
     */
    setupContent(elem, targetid) {
        let d = DisplayUtil.getTargetEvent();
        if(d.mode === 'mouse'){
            elem.addEventListener(d.start, ((elem) => {
                return (evt) => {
                    let rect = elem.getBoundingClientRect();
                    this.unselect();
                    this.select(targetid);
                    elem.draggingOffsetLeft = evt.clientX - rect.left;
                    elem.draggingOffsetTop = evt.clientY - rect.top;
                    this.action.changeContentIndexToFront(targetid);
                    evt.preventDefault();
                };
            })(elem), false);
            window.onmouseup = () => {
                this.unselect();
            };
            window.onmousemove = (evt) => {
                let elem = this.getSelectedElem();
                if (elem && elem.is_dragging) {
                    this.action.changeContentTransform({
                        targetID : elem.id, 
                        x : evt.pageX - elem.draggingOffsetLeft, 
                        y : evt.pageY - elem.draggingOffsetTop
                    });
                }
                evt.preventDefault();
            };
        }else{
            elem.addEventListener(d.start, ((elem) => {
                return (evt) => {
                    let rect = elem.getBoundingClientRect();
                    this.unselect();
                    this.select(targetid);
                    elem.draggingOffsetLeft = evt.changedTouches[0].clientX - rect.left;
                    elem.draggingOffsetTop = evt.changedTouches[0].clientY - rect.top;
                    this.action.changeContentIndexToFront(targetid);
                    evt.preventDefault();
                };
            })(elem), false);
            window.ontouchend = function () {
                this.unselect();
            };
            window.ontouchmove = (evt) => {
                let elem = this.getSelectedElem();
                if (elem && elem.is_dragging) {
                    this.action.changeContentTransform({
                        targetID : elem.id,
                        x : evt.changedTouches[0].pageX - elem.draggingOffsetLeft, 
                        y : evt.changedTouches[0].pageY - elem.draggingOffsetTop
                    });
                }
                evt.preventDefault();
            };
        }
    };
    

    /**
     * windowDataをもとにビューポートを更新する.
     * サーバに保存されているdisplayデータは更新しない
     * @param {JSON} windowData ウィンドウメタデータ
     */
    updateViewport(windowData) {
        let cx = parseFloat(windowData.posx, 10);
        let cy = parseFloat(windowData.posy, 10);
        let w = parseFloat(windowData.width);
        let h = parseFloat(windowData.height);
        let orgW = parseFloat(Vscreen.getWhole().orgW);
        let scale = orgW / w;
        // scale
        Vscreen.setWholePos(0, 0);
        Vscreen.setWholeCenter(0, 0);
        Vscreen.setWholeScale(scale);
        // trans
        Vscreen.translateWhole(-cx, -cy);
        
        // 全コンテンツデータの座標をビューポートをもとに更新
        let metaDataDict = this.store.getMetaDataDict();
        let groupDict = this.store.getGroupDict();
        for (let id in metaDataDict) {
            if (metaDataDict.hasOwnProperty(id)) {
                if (document.getElementById(id)) {
                    VscreenUtil.assignMetaData(document.getElementById(id), metaDataDict[id], false, groupDict);
                }
            }
        }
    }

    setDisplayID(displayID) {
        window.parent.document.title = "Display ID:" + displayID;
        this.getHeadMenu().setIDValue(displayID);
        document.getElementById('displayid').innerHTML = "ID:" + displayID;
    }
}

export default GUI;