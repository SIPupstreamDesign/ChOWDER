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
import VideoPlayer from '../components/video_player';
import PerformanceLogger from './performance_logger';
import Button from '../components/button';
import ITownsCommand from '../common/itowns_command';
import IFrameConnector from '../common/iframe_connector';
import ITownsUtil from '../common/itowns_util';

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

        this.store.on(Store.EVENT_REQUEST_SHOW_DISPLAY_ID, (err, data) => {
            for (let i = 0; i < data.length; i = i + 1) {
                this.showDisplayID(data[i].id);
            }
        });

        this.store.on(Store.EVENT_LOGIN_SUCCESS, () => {
            // ログありのときはSettingMenuに保存ボタン付ける
            let blockedText = document.getElementsByClassName('blocked_text')[0];
            blockedText.style.display = "none";
            if (this.store.isMeasureTimeEnable()) {
                let menu = document.getElementsByClassName('head_mode_text')[0];
                let oldElems = menu.getElementsByClassName('performance_log_button');
                if (!oldElems || oldElems.length === 0) {
                    let button = new Button();
                    button.getDOM().classList.add("performance_log_button");
                    button.getDOM().value = "PerformanceLog"
                    button.on(Button.EVENT_CLICK, () => {
                        PerformanceLogger.save("performance_log_" + this.store.getWindowID() + ".csv");
                    })
                    button.getDOM().style.marginLeft = "50px";
                    menu.appendChild(button.getDOM());
                }
            }
        })

        this.store.on(Store.EVENT_UPDATE_TIME, (err, data) => {
            // 全コンテンツデータの時刻をビューポートをもとに更新
            const metaDataDict = this.store.getMetaDataDict();
            const funcDict = this.store.getITownFuncDict();
			const time = new Date(data.time);
            let range = {}
			if (data.hasOwnProperty('rangeStartTime') && data.hasOwnProperty('rangeEndTime') && 
				data.rangeStartTime.length > 0 && data.rangeEndTime.length > 0) {
                range = {
                    rangeStartTime : new Date(data.rangeStartTime),
                    rangeEndTime : new Date(data.rangeEndTime)
                }
            }
            for (let id in metaDataDict) {
                if (metaDataDict.hasOwnProperty(id)) {
                    let metaData = metaDataDict[id];
                    if (metaData.type === Constants.TypeWebGL) {
                        if (ITownsUtil.isTimelineSync(metaData, data.id, data.senderSync))
                        {
                            let elem = document.getElementById(id);
                            this.showTime(elem, metaData);
                            // timeが変更された場合は、copyrightの位置が変更される
                            this.showCopyrights(elem, metaData);
                            
                            if (funcDict && funcDict.hasOwnProperty(metaData.id)) {
                                funcDict[metaData.id].chowder_itowns_update_time(metaData, time, range);
                            }
                        }
                    }
                }
            }
        })

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
        
        setTimeout( () => {
            if (!document.getElementById('head_menu').classList.contains('hide'))
            {
                if (!registered) {
                    registered = true;
                    setTimeout(hideMenuFunc, 2000);
                }
            }
        }, 1000);

        // メニュー設定
        let menuSetting = null;
        if (window.isElectron()) {
            menuSetting = [
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
        } else {
            menuSetting = [
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
        }

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
                }
                if (metaData.hasOwnProperty("group") && groupDict.hasOwnProperty(metaData.group)) {
                    elem.style.borderColor = groupDict[metaData.group].color;
                }
                elem.style.borderWidth = "6px";
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
                if (String(metaData[Constants.MARK_MEMO]) === 'true' && String(metaData.visible) === 'true')
                {
                    memo.style.display = "block";
                } else {
                    memo.style.display = "none";
                }
            }
            let time =  document.getElementById("time:" + metaData.id);
            if (time) {
                if (metaData.hasOwnProperty("group") && groupDict.hasOwnProperty(metaData.group)) {
                    time.style.borderColor = groupDict[metaData.group].color;
                }
                if (String(metaData.display_time) === 'true')
                {
                    time.style.display = "block";
                } else {
                    time.style.display = "none";
                }
            }
        }
    }

    deleteMark(elem, id) {
        if (elem) {
            let memo =  document.getElementById("memo:" + id);
            if (memo) {
                memo.style.display = "none";
                if (memo.parentNode) {
                    memo.parentNode.removeChild(memo);
                }
            }
        }
    }
    
    deleteTime(elem, id) {
        if (elem) {
            let time =  document.getElementById("time:" + id);
            if (time) {
                time.style.display = "none";
                if (time.parentNode) {
                    time.parentNode.removeChild(time);
                }
            }
        }
    }
    
    deleteCopyright(elem, id) {
        if (elem) {
            let copyright =  document.getElementById("copyright:" + id);
            if (copyright) {
                copyright.style.display = "none";
                if (copyright.parentNode) {
                    copyright.parentNode.removeChild(copyright);
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
        if (elem && metaData.user_data_text) {
            let groupDict = this.store.getGroupDict();
            let previewArea = document.getElementById('preview_area');
            let memo = document.getElementById("memo:" + metaData.id);
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
     * 時刻を表示.
     * elemに時刻用エレメントをappendChild
     * @param {*} elem 
     * @param {*} metaData 
     */
    showTime(elem, metaData) {
        if (elem && metaData.hasOwnProperty('display_time') && String(metaData.display_time) === "true") {
            let previewArea = document.getElementById('preview_area');
            let timeElem = document.getElementById("time:" + metaData.id);
            let previewRect = previewArea.getBoundingClientRect();
            let time = "Time not received";
            if (this.store.getTime(metaData.id)) {
                let date = this.store.getTime(metaData.id);
                const y = date.getFullYear();
                const m = ("00" + (date.getMonth()+1)).slice(-2);
                const d = ("00" + date.getDate()).slice(-2);
                const hh = ("00" + date.getHours()).slice(-2);
                const mm = ("00" + date.getMinutes()).slice(-2);
                const ss = ("00" + date.getSeconds()).slice(-2);
                time = y + "/" + m + "/" + d + " " + hh + ":" + mm + ":" + ss;
            }
            if (timeElem) {
                timeElem.innerHTML = time;
                let rect = elem.getBoundingClientRect();
                timeElem.style.right = (previewRect.right - rect.right) + "px";
                timeElem.style.top =  rect.top + "px";
                timeElem.style.zIndex = elem.style.zIndex;
            } else {
                timeElem = document.createElement("pre");
                timeElem.id = "time:" + metaData.id;
                timeElem.className = "time";
                timeElem.innerHTML = time;
                let rect = elem.getBoundingClientRect();
                timeElem.style.right = (previewRect.right - rect.right) + "px";
                timeElem.style.top = rect.top + "px";
                timeElem.style.position = "absolute";
                timeElem.style.height = "auto";
                timeElem.style.whiteSpace = "pre-line";
                timeElem.style.zIndex = elem.style.zIndex;
                previewArea.appendChild(timeElem);
            }
        }
    }

    /**
     * Copyrightを表示.
     * elemにCopyright用エレメントをappendChild
     * @param {*} elem 
     * @param {*} metaData 
     */
    showCopyrights(elem, metaData) {
        if (elem 
            && metaData.type === Constants.TypeWebGL
            && metaData.hasOwnProperty('layerList')) 
            {

            let copyrightText = ITownsUtil.createCopyrightText(metaData);
            if (copyrightText.length === 0) return;

            let previewArea = document.getElementById('preview_area');
            let copyrightElem = document.getElementById("copyright:" + metaData.id);
            let previewRect = previewArea.getBoundingClientRect();
            if (copyrightElem) {
                copyrightElem.innerHTML = copyrightText;
                let rect = elem.getBoundingClientRect();
                copyrightElem.style.right = (previewRect.right - rect.right) + "px";
                if (metaData.display_time && String(metaData.display_time) === "true") {
                    copyrightElem.style.top =  (rect.top + 50) + "px";
                } else {
                    copyrightElem.style.top =  rect.top + "px";
                }
                copyrightElem.style.zIndex = elem.style.zIndex;
            } else {
                copyrightElem = document.createElement("pre");
                copyrightElem.id = "copyright:" + metaData.id;
                copyrightElem.className = "copyright";
                copyrightElem.innerHTML = copyrightText;
                let rect = elem.getBoundingClientRect();
                copyrightElem.style.right = (previewRect.right - rect.right) + "px";
                if (metaData.display_time && String(metaData.display_time) === "true") {
                    copyrightElem.style.top =  (rect.top + 50) + "px";
                } else {
                    copyrightElem.style.top =  rect.top + "px";
                }
                copyrightElem.style.position = "absolute";
                copyrightElem.style.height = "auto";
                copyrightElem.style.whiteSpace = "pre-line";
                copyrightElem.style.zIndex = elem.style.zIndex;
                previewArea.appendChild(copyrightElem);
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
                        const originalSize = page.getViewport(1);
                        let viewport = page.getViewport(width / originalSize.width);
                        let orgAspect = metaData.orgWidth / metaData.orgHeight;
                        let pageAspect = viewport.width / viewport.height;

                        if ((viewport.width * viewport.height) > (7680*4320)) {
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

    /**
     * WebGLを表示
     * @param {*} elem 
     * @param {*} metaData 
     * @param {*} contentData 
     */
    showWebGL(elem, metaData, contentData) {
        let iframe = document.createElement('iframe');
        iframe.src = metaData.url;

        //console.error(orgRect, orgWin, rect)

        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.pointerEvents = "none";
        iframe.style.border = "none"
        iframe.onload = () => {
            if(metaData.webglType && metaData.webglType === "qgis2three.js"){
                // qgis
                const connector = new IFrameConnector(iframe);
                connector.connect(() => {
                    this.action.updateQgisMetadata(metaData);
                });

            }else{
                // itowns
    
                iframe.contentWindow.chowder_itowns_view_type = "display";
                // iframe内のitownsからのコールバック
                /*
                iframe.contentWindow.chowder_itowns_measure_time = (timeString) => {
                    PerformanceLogger.logByVals("iTowns表示完了までの時間", "chowder_itowns_measure_time", timeString, metaData.id);
                    if (PerformanceLogger.validate()) {
                        this.showDebugMessage(timeString);
                    }
                };
                */

                let connector = new IFrameConnector(iframe);

                try {
                    connector.connect(() => {
                    // 初回に一度実行
                    if (metaData.hasOwnProperty('cameraWorldMatrix')) {
                        connector.send(ITownsCommand.UpdateCamera, {
                            mat: JSON.parse(metaData.cameraWorldMatrix),
                            params: JSON.parse(metaData.cameraParams),
                        }, () => {
                            connector.send(ITownsCommand.InitLayers, JSON.parse(metaData.layerList), () => {
                                let rect = DisplayUtil.calcWebGLFrameRect(this.store, metaData);
                                connector.send(ITownsCommand.Resize, rect);
                            });
                        });
                    } else {
                        connector.send(ITownsCommand.InitLayers, JSON.parse(metaData.layerList), () => {
                            let rect = DisplayUtil.calcWebGLFrameRect(this.store, metaData);
                            connector.send(ITownsCommand.Resize, rect);
                        });
                    }
                });
                } catch (err) {
                    console.error(err, metaData);
                }

                // chowderサーバから受信したカメラ情報などを、displayのiframe内に随時送るためのコールバックイベントを登録
                this.action.addItownFunc({
                    id: metaData.id,
                    func: {
                        chowder_itowns_update_camera: (metaData) => {
                            ITownsUtil.updateCamera(connector, metaData);
                        },
                        chowder_itowns_update_time: (metaDatam, time, range) => {
                            ITownsUtil.updateTime(connector, metaData, time, range);
                        },
                        chowder_itowns_resize: (rect) => {
                            ITownsUtil.resize(connector, rect)
                        },
                        chowder_itowns_update_layer_list: (metaData, callback) => {
                            let preMetaData = this.store.getMetaData(metaData.id);
                            ITownsUtil.updateLayerList(connector, metaData, preMetaData, callback);
                        },
                        chowder_itowns_measure_time: (callback) => {
                            connector.send(ITownsCommand.MeasurePerformance, {}, callback);
                        }
                    }
                });
            }
            elem.innerHTML = "";
            elem.appendChild(iframe);
        }
    }

    /**
     * videoを表示
     * @param {*} videpPlayer 
     * @param {*} metaData 
     * @param {*} contentData 
     */
    showVideo(videpPlayer, metaData) {
        let webRTCDict = this.store.getVideoStore().getWebRTCDict();
        let rtcKey = this.store.getVideoStore().getRTCKey(metaData);
        
        if (!webRTCDict.hasOwnProperty(rtcKey)) {
            metaData.from = "view";
            this.action.requestWebRTC({
                metaData : metaData,
                player: videpPlayer,
                request : JSON.stringify({ key : rtcKey })
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
            elem.onload = () => {
                if (this.store.isMeasureTimeEnable()) {
                    if (metaData.hasOwnProperty('time_register')) {
                        PerformanceLogger.log("showImage", metaData);
                        PerformanceLogger.logFromRegisterToShow("showImage", metaData);
                    }
                }
            };
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
        if (id && this.store.getWindowData().id === id) {
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
     * デバッグメッセージの表示
     * @param {*} metaData 
     */
    showDebugMessage(message) {
        document.getElementById('debug_message_area').innerHTML = message;
        if (message) {
            document.getElementById('debug_message_area').style.display = "block";
            setTimeout(function () {
                document.getElementById('debug_message_area').style.display = "none";
            }, 8 * 1000);
        } else if (message === "") {
            document.getElementById('debug_message_area').style.display = "block";
            setTimeout(function () {
                document.getElementById('debug_message_area').style.display = "none";
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
        let videoPlayer = null;
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
                if (metaData.type === 'video') {
                    videoPlayer = new VideoPlayer(true);
                    elem = videoPlayer.getDOM();
                } else {
                    elem = document.createElement(tagName);
                }
                elem.id = metaData.id;
                elem.style.position = "absolute";
                elem.style.color = "white";
                this.setupContent(elem, elem.id);
                DisplayUtil.insertElementWithDictionarySort(previewArea, elem);
                //previewArea.appendChild(elem);
            }
            if (metaData.type === 'video') {
                videoPlayer.on(VideoPlayer.EVENT_READY, () => {
                    this.showVideo(videoPlayer, metaData);
                });
            } else if (metaData.type === 'text') {
                // contentData is text
                this.showText(elem, metaData, contentData);
            } else if (metaData.type === 'pdf') {
                this.showPDF(elem, metaData, contentData);
            } else if (metaData.type === 'webgl') {
                this.showWebGL(elem, metaData, contentData);
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
            this.showTime(elem, metaData);
            this.showCopyrights(elem, metaData);
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

    assignTileReductionImage(metaData, contentData) {
        if (metaData.hasOwnProperty('reductionWidth')
            && metaData.hasOwnProperty('reductionHeight')) {

            let mime = "image/jpeg";
            let elem = document.getElementById(metaData.id);
            if (!elem) {
                this.regenerateTileElements(elem, metaData);
                elem = document.getElementById(metaData.id);
            }
            let reductionElem = elem.getElementsByClassName('reduction_image')[0];
        
            // contentData(reduction data)を生成
            // 解像度によらず生成する
            if (!reductionElem.src.length === 0) {
                URL.revokeObjectURL(reductionElem.src);	
            }
            let blob = new Blob([contentData], {type: mime});
            reductionElem.src = URL.createObjectURL(blob);
        }
    }

    /**
     * タイル画像はassignContentではなくこちらでコンテンツ生成を行う。
     * @param {*} metaData 
     * @param {*} isReload 全て再読み込みする場合はtrue, 読み込んでいない部分のみ読み込む場合はfalse
     */
    assignTileImage(metaData, isReload, callback) {
        let elem = document.getElementById(metaData.id);
        let tileIndex = 0;
        let request = JSON.parse(JSON.stringify(metaData));

        // ウィンドウ枠内に入っているか判定用
        const whole = JSON.parse(JSON.stringify(Vscreen.getWhole()));

        let mime = "image/jpeg";
        let previousImage = null;
        let isInitial = true;
		const orgRect = Vscreen.transformOrg(VscreenUtil.toIntRect(metaData));
		const ow = Number(metaData.orgWidth);
        const oh = Number(metaData.orgHeight);
        
        let win = this.getWindowSize();

        let loadedTiles = [];
        for (let i = 0; i < Number(metaData.ysplit); ++i) {
            for (let k = 0; k < Number(metaData.xsplit); ++k) {
                request.tile_index = tileIndex; // サーバーでは通し番号でtile管理している
                const tileClassName = 'tile_index_' + String(tileIndex);
                let rect = VscreenUtil.getTileRect(metaData, k, i);
                // let frect = Vscreen.transformOrg(VscreenUtil.toFloatRect(rect));
                let frect = Vscreen.transform(VscreenUtil.toFloatRect(rect));
                frect.w =  Math.round(rect.width / ow * orgRect.w);
                frect.h = Math.round(rect.height / oh * orgRect.h);

                /*
                let test = document.createElement('div')
                test.style.border = "3px solid red";
                test.style.position = "absolute";
                test.style.left = frect.x + "px";
                test.style.top = frect.y + "px";;
                test.style.width = frect.w + "px";
                test.style.height = frect.h + "px";
                document.body.appendChild(test)
                */

                if (frect.w === 0 || frect.h === 0) { continue; }
                // windowの中にあるか外にあるかで可視不可視判定
                let visible = !VscreenUtil.isOutsideWindow({
                    posx: frect.x, 
                    posy : frect.y,
                    width : frect.w,
                    height : frect.h
                }, { x : 0, y: 0, w : win.width, h: win.height});
                let previousElem = null;
                // windowの中にあるか外にあるかで可視不可視判定
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
                                
                    // 全タイル読み込み済じゃなかったら返る
                    if (String(metaData.tile_finished) !== "true") {
                        ++tileIndex;
                        continue;
                    }

                    // metadataの解像度がcontentData（縮小版画像）より小さいか調べる
                    // aspectがreduction~と違う場合は、初期画像とは別解像度の画像に切り替わったと判断し、強制タイル表示
                    if (isInitial
                        && metaData.hasOwnProperty('reductionWidth')
                        && metaData.hasOwnProperty('reductionHeight')) {

                        let reductionElem = elem.getElementsByClassName('reduction_image')[0];
                        // ディスプレイ座標系での画像全体の解像度（画面外にはみ出ているものを含む）
                        const ew = Number(reductionElem.style.width.split("px").join(""));
                        const eh = Number(reductionElem.style.height.split("px").join(""));
                        // 縮小画像の解像度
                        const rw = Number(metaData.reductionWidth);
                        const rh = Number(metaData.reductionHeight);
                        // メタデータの解像度
                        const mw = Number(metaData.width);
                        const mh = Number(metaData.height);
                        let reductionAspect = rw / rh;
                        let aspect = mw / mh;
                        let isSameImage = Math.abs(reductionAspect-aspect) < 0.2;
                        if (isSameImage && ew <= rw && eh <= rh) {
                            // ディスプレイ内のreduction divの解像度 < オリジナルの縮小版画像の解像度
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

                    // 全タイル読み込み完了時にログを出すため
                    loadedTiles.push(false);
                    
                    if (!previousImage || isReload) {
                        let image = elem.getElementsByClassName(tileClassName)[0];
                        // assignTileImageを複数回呼ばれたときに、
                        // 既に読み込み済だった場合は読まないようにする
                        if (image.src.length > 0 && image.keyvalue && image.keyvalue === metaData.keyvalue) {
                            return;
                        } else {
                            image.keyvalue = metaData.keyvalue;
                        }

                        this.action.getTileContent({
                            request : request,
                            callback :  ((index, image) => {
                                return (err, data) => {
                                    if (err) {
                                        console.error(err);
                                        return;
                                    }
                                    if (previousImage) {
                                        URL.revokeObjectURL(image.src);	
                                    }
                                    if (this.store.isMeasureTimeEnable()) {
                                        image.onload = () => {
                                            if (!loadedTiles) { 
                                                return;
                                            }
                                            loadedTiles[index] = true;
                                            let loaded = true;
                                            for (let n = 0; n < loadedTiles.length; ++n) {
                                                if (!loadedTiles[n]) {
                                                    loaded = false;
                                                    return;
                                                }
                                            }
                                            // 全タイル読み込み完了時にログを出す
                                            if (loaded) {
                                                loadedTiles = null;
                                                PerformanceLogger.log("finishShow", metaData, false)
                                                PerformanceLogger.logFromRegisterToShow("showTileImage", metaData);
                                                if (callback) {
                                                    callback();
                                                }
                                            }
                                        }
                                    }
                                    let blob = new Blob([data.contentData], {type: mime});
                                    image.src = URL.createObjectURL(blob);
                                }
                            })(loadedTiles ? loadedTiles.length-1 : 0, image)
                        })
                    }

                    isInitial = false;
                }
                ++tileIndex;
            }
        }
    }

    /**
     * コンテンツの選択
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
                    this.action.changeContentIndexToFront({
                        targetID : targetid
                    });
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
                    this.action.changeContentIndexToFront({
                        targetID : targetid
                    });
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
                let elem = document.getElementById(id);
                let metaData = metaDataDict[id];
                if (elem) {
                    VscreenUtil.assignMetaData(document.getElementById(id), metaData, false, groupDict);
                    // メモ/timeの座標も更新する
                    this.showMemo(elem, metaData);
                    this.showTime(elem, metaData);
                    this.showCopyrights(elem, metaData);
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