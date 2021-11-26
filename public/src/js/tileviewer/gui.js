/**
 * Copyright (c) 2021 National Institute of Information and Communications Technology (NICT). All rights reserved.
 */

import Store from './store.js';
import LoginMenu from '../components/login_menu.js';
import Select from '../components/select';
import Translation from '../common/translation';
import Constants from '../common/constants';
import TileViewerCommand from '../common/tileviewer_command'
import TileViewerUtil from '../common/tileviewer_util'
import LayerProperty from './layer_property'
import LayerList from './layer_list'
import ZoomControl from '../components/zoom_control'
import GUIUtil from "./gui_util"
import TimelineTemplateMain from "./timeline_template_main"
import Button from '../components/button'
import Input from '../components/input.js';

// Base64からバイナリへ変換
function toArrayBuffer(base64) {
    var bin = atob(base64.replace(/^.*,/, ''));
    var buffer = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) {
        buffer[i] = bin.charCodeAt(i);
    }
    return buffer.buffer;
}

const pressedClassName = 'timeline_sync_button_pressed';

class GUI extends EventEmitter {
    constructor(store, action) {
        super();
        console.log("[gui]:constructor")
        this.store = store;
        this.action = action;

        this.isShowRemoteCursor = false;
    }

    /**
     * すべてのGUIの初期化
     */
    init() {
        // TimelineTemplateのViewURLを非表示とする
        let viewURLElem = document.getElementById('button_view_url');
        if (viewURLElem) {
            viewURLElem.style.display = "none";
        }
        // HELPボタン
        const helpButton = document.getElementById('button_help');
        if (helpButton) {
            helpButton.href = "https://github.com/SIPupstreamDesign/ChOWDER/blob/master/UserGuide/jp/UserGuide.md";
            helpButton.target = "_blank";
        }

        // Cursor
	    let cursorCheck = new Input("checkbox");
        let leftMenu = document.querySelector("#function_bar > .left");
        cursorCheck.getDOM().style.width = "14px"
        cursorCheck.getDOM().style.height = "14px"
        cursorCheck.getDOM().style.position = "relative"
        cursorCheck.getDOM().style.top = "3px"
        cursorCheck.getDOM().style.cursor = "pointer";
        leftMenu.appendChild(cursorCheck.getDOM());
        cursorCheck.on('change', () => {
            this.action.updateRemoteCursor({ isEnable : false });
            this.isShowRemoteCursor = !this.isShowRemoteCursor;
        });
        
	    let cursorLabel = document.createElement('a');
        cursorLabel.className = "cursor_label";
        cursorLabel.innerText = "Cursor";
        cursorLabel.style.cursor = "pointer";
        cursorLabel.style.paddingLeft = "5px";
        leftMenu.appendChild(cursorLabel);
        cursorLabel.addEventListener('click', () => {
            cursorCheck.getDOM().click();
        });

	    let cursorColor = document.createElement('a');
        cursorColor.innerText = 'ChangeCursorColor';
        cursorColor.className = "change_cursor_color";
        cursorColor.style.backgroundColor = "rgba(27, 30, 43, 0.8)";
        cursorColor.addEventListener('click', () => {
            this.action.changeRemoteCursorColor();
        });
        leftMenu.appendChild(cursorColor);

        //this.initWindowEvents();
        this.initLoginMenu();
        this.loginMenu.show(true);
        Translation.translate(function() {});

        // サンプルコンテンツの追加
        this.addPresetContentSelect();
        this.store.on(Store.EVENT_CONNECT_SUCCESS, (err, data) => {
            this.action.fetchContents();
        });

        // ページアクセス直後に全コンテンツのメタデータを取得し(action.fetchContents)、
        // tileviewerコンテンツであった場合のみコールバックが呼ばれる
        // 複数のtileviewerコンテンツがあった場合は, 複数回呼ばれる
        this.store.on(Store.EVENT_DONE_FETCH_CONTENTS, (err, metaData) => {
            this.addUserContentSelect(metaData);
        });

        // ログイン成功
        this.store.on(Store.EVENT_LOGIN_SUCCESS, (err, data) => {
            // ログインメニューを削除
            document.body.removeChild(this.loginMenu.getDOM());
            // this.initPropertyPanel();
            // this.initMenu();
            this.showTileViewer();
            this.initTemplateGUI();
            this.initTimeline();
        });

        this.store.on(Store.EVENT_DONE_CHANGE_TIMELINE_RANGE, () => {
            // Time更新
            this.showTime(document.getElementById('content'), this.store.getMetaData())
        });

        // ログイン失敗
        this.store.on(Store.EVENT_LOGIN_FAILED, (err, data) => {
            this.loginMenu.showInvalidLabel(true);
        });

        // iframe接続完了
        this.store.on(Store.EVENT_DONE_IFRAME_CONNECT, (err, iframeConnector) => {
            // iframe内のカメラが更新された
            iframeConnector.on(TileViewerCommand.UpdateCamera, (err, params) => {
                this.action.updateCamera({
                    params: params.params
                });
            });

            // iframe内からコンテンツ追加命令がきた
            iframeConnector.on(TileViewerCommand.AddContent, (err, params, req) => {
                this.addTileViewerContent(params, toArrayBuffer(params.thumbnail));
                iframeConnector.sendResponse(req)
            });

            // iframe内のレイヤーが更新された
            iframeConnector.on(TileViewerCommand.UpdateLayer, (err, params) => {
                this.layerList.initLayerSelectList(params);
            });

            // iframe内でリサイズが起きた
            iframeConnector.on(TileViewerCommand.Resize, (err, params) => {
                this.action.resizeContent({
                    size: params.size
                });
            });
        });

        // レイヤーが追加された
        this.store.on(Store.EVENT_DONE_ADD_LAYER, (err, layerDataList) => {
            if (!err) {
                console.log("EVENT_DONE_ADD_LAYER", layerDataList)
                this.layerList.initLayerSelectList(layerDataList);
                if (this.propOuterVisible) {
                    this.layerList.setSelectedIndex(layerDataList.length - 1);
                }
            }
        })

        this.store.on(Store.EVENT_DONE_DELETE_LAYER, (err, layerDataList) => {
            if (!err) {
                if (this.propOuterVisible) {
                    if (layerDataList.length <= 0) {
                        this.layerProperty.init(null, null);
                    }
                    this.layerList.setSelectedIndex(layerDataList.length - 1);
                }
            }
        });

        this.store.on(Store.EVENT_DONE_CHANGE_LAYER_ORDER, (err, data) => {
            if (this.propOuterVisible) {
                this.layerList.setSelectedID(data.id);
            }
        });

        // コンテンツ追加後に
        // MetaDataが更新されたタイミングでレイヤーリストをEnableにする
        // syncボタンの状態を更新
        this.store.on(Store.EVENT_DONE_UPDATE_METADATA, (err, metaData) => {
            let meta = metaData;
            if (metaData.length === 1) {
                meta = metaData[0];
            }
            if (!err && meta.hasOwnProperty('id')) {
                this.contentID.innerText = meta.id;
                this.layerList.setEnable(true);

                this.updateZoomControl(this.zoomControlWrap, meta);

                // Time更新
                this.showTime(document.getElementById('content'), meta)
                // copyright更新
                this.showCopyrights(document.getElementById('content'), meta)
            }
            // syncの更新
            if (!err) {
                const isSync = TileViewerUtil.isTimelineSync(meta);
                const dom = this.timelineSyncButton.getDOM();
                if (isSync) {
                    if (!dom.classList.contains(pressedClassName)) {
                        dom.classList.add(pressedClassName);
                    }
                } else {
                    if (dom.classList.contains(pressedClassName)) {
                        dom.classList.remove(pressedClassName);
                    }
                }
            }
        });

        this.store.on(Store.EVENT_DONE_ADD_CONTENT, (err, meta) => {
            if (!err && meta.hasOwnProperty('id')) {
                this.contentID.innerText = meta.id;
                this.layerList.setEnable(true);

                this.updateZoomControl(this.zoomControlWrap, meta);

                // Time更新
                this.showTime(document.getElementById('content'), meta)
                // copyright更新
                this.showCopyrights(document.getElementById('content'), meta)
            }
        });

        // iframe内にwindowのmousemoveを伝える用
        this.onMouseMove = this._onMouseMove.bind(this);
        // iframe内にwindowのmouseupを伝える用
        this.onMouseUp = this._onMouseUp.bind(this);
    }

    _onMouseUp(event) {
        const evt = new CustomEvent('mouseup', { bubbles: true, cancelable: false });
        const clRect = this.iframe.getBoundingClientRect();
        evt.clientX = event.clientX - clRect.left;
        evt.clientY = event.clientY - clRect.top;
        this.iframe.contentWindow.dispatchEvent(evt);
        this.iframe.contentWindow.document.documentElement.dispatchEvent(evt);
    }

    _onMouseMove(event) {
        const clRect = this.iframe.getBoundingClientRect();
        const evt = new CustomEvent('mousemove', { bubbles: true, cancelable: false });
        Object.defineProperty(evt, 'target', { writable: false, value: this.iframe.contentDocument.body });
        evt.clientX = event.clientX + clRect.left;
        evt.clientY = event.clientY + clRect.top;
        evt.offsetX = event.clientX;
        evt.offsetY = event.clientY;
        this.iframe.contentWindow.dispatchEvent(evt);
        this.iframe.contentWindow.document.documentElement.dispatchEvent(evt);
    }

    addUserContentSelect(metaData) {
        this.contentSelect.addOption(JSON.stringify({
            type: "user",
            url: metaData.url,
            meta: metaData
        }), "ContentID:" + metaData.id);
    }

    /**
     * ログインメニューの初期化
     */
    initLoginMenu() {
        this.loginMenu = new LoginMenu("ChOWDER TileViewer App");
        document.body.insertBefore(this.loginMenu.getDOM(), document.body.childNodes[0]);

        // ログインが実行された場合
        this.loginMenu.on(LoginMenu.EVENT_LOGIN, () => {
            let userSelect = this.loginMenu.getUserSelect();
            // ログイン実行
            this.action.login({
                id: "APIUser",
                password: this.loginMenu.getPassword()
            });
        });

        let select = this.loginMenu.getUserSelect();
        select.addOption("APIUser", "APIUser");
    }

    /**
     * TimelineTemplateの各種GUI部品の初期化
     * イベント登録等を行う
     */
    initTemplateGUI() {
        let contentDOM = document.getElementById('content');

        this.propOuterVisible = false;
        this.propOuter = document.createElement('div');
        this.propOuter.className = "tileviewer_property_outer";
        this.propInner = document.createElement('div');
        this.propInner.className = "tileviewer_property_inner";
        this.propOuter.appendChild(this.propInner);
        contentDOM.appendChild(this.propOuter);

        // コンテンツIDタイトル
        let contentIDTitle = document.createElement('p');
        contentIDTitle.className = "tileviewer_property_title";
        contentIDTitle.innerHTML = "Content ID";
        this.propInner.appendChild(contentIDTitle);

        // コンテンツID
        this.contentID = document.createElement('p');
        this.contentID.className = "tileviewer_property_text";
        this.propInner.appendChild(this.contentID);

        // ベースコンテンツタイトル
        let contentTitle = document.createElement('p');
        contentTitle.className = "tileviewer_property_title";
        contentTitle.innerHTML = i18next.t('base_content');
        this.propInner.appendChild(contentTitle);

        // ベースコンテンツ名
        let contentName = document.createElement('p');
        contentName.className = "tileviewer_property_text";
        let selectValue = this.getSelectedValueOnMenuContents();
        contentName.innerHTML = selectValue.url;
        this.propInner.appendChild(contentName);

        this.propInner.appendChild(document.createElement('hr'));

        // レイヤーリストタイトル
        let layerTitle = document.createElement('p');
        layerTitle.className = "tileviewer_property_title";
        layerTitle.innerHTML = i18next.t('layer_list');
        this.propInner.appendChild(layerTitle);

        // レイヤーリスト
        this.layerList = new LayerList(this.store, this.action);
        this.layerList.setEnable(false);
        this.propInner.appendChild(this.layerList.getDOM());

        // レイヤープロパティ
        this.layerProperty = new LayerProperty(this.store, this.action);
        this.propInner.appendChild(this.layerProperty.getDOM());

        const initLayerProperty = (data) => {
            if (data.value !== undefined && data.value) {
                let layerData = this.store.getLayerData(data.value);
                //console.error('layerData', layerData)
                this.layerProperty.init(data.value, layerData);
            }
        };

        this.layerList.on(LayerList.EVENT_LAYER_SELECT_CHANGED, (err, data) => {
            initLayerProperty(data);
        });

        // Select Data ボタン
        const selectDataButton = document.getElementById('button_select_data');
        selectDataButton.onclick = () => {
            // セレクトダイアログを表示
            if (this.propOuterVisible) {
                this.propOuter.style.display = "none";
                this.propOuterVisible = false;
            } else {
                this.propOuter.style.display = "block";
                this.propOuterVisible = true;
            }
        };

        this.zoomControlWrap = document.createElement('div');
        this.zoomControlWrap.style.backgroundColor = "rgba(27, 30, 43, 0.9)";
        this.zoomControlWrap.style.height = "170px";
        this.zoomControlWrap.style.position = "absolute";
        this.zoomControlWrap.style.bottom = "0px";
        this.zoomControlWrap.style.borderTop = "solid 1px rgba(0, 0, 0, 0.8)";
        this.propOuter.appendChild(this.zoomControlWrap);
    }

    // TimelineTemplateに対するイベント処理などの初期化
    initTimeline() {
        // 一定間隔同じイベントが来なかったら実行するための関数
        let debounceChangeTime = (() => {
            let interval_ = 100;
            let timer;
            return (timeInfo, interval = null, func = null) => {
                if (this.store.getGlobalSetting() && this.store.getGlobalSetting().hasOwnProperty('reduceInterval')) {
                    interval_ = Number(this.store.getGlobalSetting().reduceInterval)
                }
                if (interval !== null) {
                    interval_ = interval;
                }
                clearTimeout(timer);
                timer = setTimeout(() => {
                    this.action.changeTimeByTimeline({
                        currentTime: new Date(timeInfo.currentTime),
                        startTime: new Date(timeInfo.startTime),
                        endTime: new Date(timeInfo.endTime)
                    });
                    // Time更新
                    this.showTime(document.getElementById('content'), this.store.getMetaData())
                    if (func) {
                        func();
                    }
                }, interval_);
            };
        })();

        TimelineTemplateMain.initTimelineTemplate({
            startTime: this.store.getTimelineStartTime(), // 左端の日時
            endTime: this.store.getTimelineEndTime(), // 右端の日時
            currentTime: this.store.getTimelineCurrentTime(), // 摘み（ポインタ）の日時
            // 以下を設定してもウィンドウサイズ変えると勝手に表示可能範囲が変わる上、
            // ホイールスクロールの時にズームインできるけどズームアウトできなくなる。
            //minTime: this.store.getTimelineStartTime(), // 過去方向への表示可能範囲
            //maxTime: this.store.getTimelineEndTime(), // 未来方向への表示可能範囲
            timeChange: (timeInfo) => {
                debounceChangeTime(timeInfo, 100, () => {});

                // timeInfo.  startTimeから左端の日時を取得
                // timeInfo.    endTimeから右端の日時を取得
                // timeInfo.currentTimeから摘み（ポインタ）の日時を取得
            },
            barMove: (timeInfo) => {
                debounceChangeTime(timeInfo, null, () => {
                    // console.error("barMove", this.store.getTimelineCurrentTimeString());
                });
            },
            barMoveEnd: (timeInfo) => {
                debounceChangeTime(timeInfo, null, () => {
                    // console.error("barMoveEnd", this.store.getTimelineCurrentTimeString());
                });
            },
            rangeMoveEnd: (timeInfo) => {
                this.action.changeTimelineRangeBar(timeInfo);
            },
        });
        TimelineTemplateMain.initTimelineTemplateEvents({
            wait : () => {
                return this.store.isLoadingTiles(); // 読み込み中ならtrue(= waiting)
            }
        });
        
        // Syncボタン
        this.timelineSyncButton = new Button();
        document.getElementById('timeline').appendChild(this.timelineSyncButton.getDOM());
        this.timelineSyncButton.getDOM().className = 'timeline_sync_button timeline_sync_button_pressed';
        this.timelineSyncButton.setDataKey('Sync');
        document.body.appendChild(this.timelineSyncButton.getDOM());
        this.timelineSyncButton.on('click', (evt) => {
            const dom = this.timelineSyncButton.getDOM();
            if (dom.classList.contains(pressedClassName)) {
                dom.classList.remove(pressedClassName);
                this.action.changeTimelineSync({ sync: false });
            } else {
                dom.classList.add(pressedClassName);
                this.action.changeTimelineSync({ sync: true });
            }
        });

    }

    /**
     * metaData.display_timeを設定するためのGUIを追加する。
     * @param {*} parentElem 
     * @param {*} metaData 
     */
     addDisplayTimeLabelVisible(parentElem, metaData) {
        if (metaData && metaData.hasOwnProperty('display_time')) {
            GUIUtil.addCheckProperty(parentElem, metaData, "display_time", "show time label", String(metaData.display_time) === "true", (err, data) => {
                this.action.changeDisplayTimeVisible({
                    params: data
                })
            });
        } else {
            GUIUtil.addCheckProperty(parentElem, metaData, "display_time", "show time label", true, (err, data) => {
                this.action.changeDisplayTimeVisible({
                    params: data
                })
            });
        }
    }

    /**
     * metaData.zoomLabelVisibleを設定するためのGUIを追加する。
     * @param {*} parentElem 
     * @param {*} metaData 
     */
     addZoomLabelVisible(parentElem, metaData) {
        if (metaData && metaData.hasOwnProperty('zoomLabelVisible')) {
            GUIUtil.addCheckProperty(parentElem, metaData, "zoomLabelVisible", "show zoom label", String(metaData.zoomLabelVisible) === "true", (err, data) => {
                this.action.changeZoomLabelVisible({
                    params: data
                })
            });
        } else {
            GUIUtil.addCheckProperty(parentElem, metaData, "zoomLabelVisible", "show zoom label", true, (err, data) => {
                this.action.changeZoomLabelVisible({
                    params: data
                })
            });
        }
    }

    /**
     * metaData.cameraParams.zoomLevel、または
     * metaData.cameraParams.scaleIndex　を固定するためのGUIを追加する。
     * 両方存在した場合は、metaData.cameraParams.zoomLevelが優先される。
     * @param {*} parentElem 
     * @param {*} metaData 
     */
    addFixedZoomLevel(parentElem, metaData) {
        let cameraParams = metaData.cameraParams;

        if (cameraParams && cameraParams.hasOwnProperty('fixedZoomLevel')) {
            GUIUtil.addCheckProperty(parentElem, cameraParams, "fixedZoomLevel", "enable fixed zoom", cameraParams.fixedZoomLevel, (err, data) => {
                let cameraParams = JSON.parse(this.store.getMetaData().cameraParams);
                this.zoomControl.setEnable(data);
                cameraParams.fixedZoomLevel = data;
                this.action.changeCameraParams({
                    params: cameraParams
                })
            });
        } else {
            GUIUtil.addCheckProperty(parentElem, cameraParams, "fixedZoomLevel", "enable fixed zoom", false, (err, data) => {
                let cameraParams = JSON.parse(this.store.getMetaData().cameraParams);
                this.zoomControl.setEnable(data);
                cameraParams.fixedZoomLevel = data;
                this.action.changeCameraParams({
                    params: cameraParams
                })
            });
        }
    }

    /**
     * metaData.cameraParams.zoomLevel、または
     * metaData.cameraParams.scaleIndex　をコントロールするためのGUIを追加する。
     * 両方存在した場合は、metaData.cameraParams.zoomLevelが優先される。
     * @param {*} parentElem 
     * @param {*} metaData 
     */
    addZoomLevel(parentElem, metaData) {
        let cameraParams = JSON.parse(metaData.cameraParams);

        if (cameraParams && cameraParams.hasOwnProperty('zoomLevel')) {
            this.zoomControl = new ZoomControl("zoom level", Number(cameraParams.zoomLevel), 0, 100);
        } else if (cameraParams && cameraParams.hasOwnProperty('scaleIndex')) {
            this.zoomControl = new ZoomControl("zoom level", Number(cameraParams.scaleIndex), 0, 100);
        } else {
            this.zoomControl = new ZoomControl("zoom level", 0, 0, 100);
        }
        this.zoomControl.setEnable(cameraParams.fixedZoomLevel);
        this.zoomControl.on(ZoomControl.EVENT_CHANGE, (err, data) => {
            let cameraParams = JSON.parse(this.store.getMetaData().cameraParams);
            if (cameraParams.hasOwnProperty('zoomLevel')) {
                cameraParams.zoomLevel = Number(data.value);
            } else {
                cameraParams.scaleIndex = Number(data.value);
            }
            this.action.changeCameraParams({
                params: cameraParams
            });
        });
        parentElem.appendChild(this.zoomControl.getDOM());
    }

    updateZoomControl(parentElem, metaData) {
        if (!metaData) return;
        if (!metaData.hasOwnProperty('cameraParams')) return;
        if (!this.zoomControl) {
            this.addDisplayTimeLabelVisible(parentElem, metaData);
            this.addZoomLabelVisible(parentElem, metaData);
            this.addFixedZoomLevel(parentElem, metaData);
            this.addZoomLevel(parentElem, metaData);
        }
        const cameraParams = JSON.parse(metaData.cameraParams);
        if (cameraParams.hasOwnProperty('zoomLevel')) {
            this.zoomControl.setValue(cameraParams.zoomLevel);
        } else {
            this.zoomControl.setValue(cameraParams.scaleIndex);
        }
        const fixedZoomElems = this.propInner.getElementsByClassName('fixedZoomLevel');
        if (fixedZoomElems.length > 0) {
            fixedZoomElems[0].checked = cameraParams.fixedZoomLevel;
        }
    }

    addPresetContentSelect() {
        let wrapDom = document.createElement('div');
        wrapDom.innerHTML = "Content:"
        wrapDom.style.fontSize = "16px";
        this.contentSelect = new Select();
        this.contentSelect.getDOM().className = "itown_select";
        // サンプルコンテンツの追加
        {
            let xhr = new XMLHttpRequest();
            xhr.onload = () => {
                if (xhr.status == 200) {
                    try {
                        const json = JSON.parse(xhr.response);
                        if (!json.hasOwnProperty('preset_list')) {
                            throw "Error: invalid preset_list.json";
                        }
                        for (let i = 0; i < json.preset_list.length; ++i) {
                            const preset = json.preset_list[i];
                            if (!preset.hasOwnProperty('name') || !preset.hasOwnProperty('url')) {
                                throw "Error: invalid preset_list.json";
                            }
                            this.contentSelect.addOption(JSON.stringify({
                                type: "preset",
                                url: preset.url
                            }), "Preset:" + preset.name);
                        }
                    } catch (err) {
                        window.alert(err);
                        console.error(err)
                    }
                }
            }
            xhr.open("GET", "sample_data/tileviewer/preset_list.json");
            xhr.send("null");
        }

        this.contentSelect.getDOM().style.marginTop = "20px"
        wrapDom.appendChild(this.contentSelect.getDOM())
        document.getElementsByClassName('loginframe')[0].appendChild(wrapDom);
    }

    /**
     * 時刻を表示.
     * elemに時刻用エレメントをappendChild
     * @param {*} elem 
     * @param {*} metaData 
     */
     showTime(elem, metaData) {
        if (elem && metaData && metaData.hasOwnProperty('display_time')) {
            let timeElem = document.getElementById("time:" + metaData.id);
            let time = "Time not received";
            if (this.store.getTimelineCurrentTime()) {
                let date = this.store.getTimelineCurrentTime();
                const y = date.getFullYear();
                const m = ("00" + (date.getMonth() + 1)).slice(-2);
                const d = ("00" + date.getDate()).slice(-2);
                const hh = ("00" + date.getHours()).slice(-2);
                const mm = ("00" + date.getMinutes()).slice(-2);
                const ss = ("00" + date.getSeconds()).slice(-2);
                time = y + "/" + m + "/" + d + " " + hh + ":" + mm + ":" + ss;
            }
            if (timeElem) {
                timeElem.innerHTML = time;
                let rect = elem.getBoundingClientRect();
                timeElem.style.right ="0px";
                timeElem.style.top ="0px";
                timeElem.style.zIndex = elem.style.zIndex;
                timeElem.style.display = String(metaData.display_time) === "true" ? "inline" : "none";
            } else {
                timeElem = document.createElement("pre");
                timeElem.id = "time:" + metaData.id;
                timeElem.className = "time";
                timeElem.innerHTML = time;
                let rect = elem.getBoundingClientRect();
                timeElem.style.right = "0px";
                timeElem.style.top = "0px";
                timeElem.style.position = "absolute";
                timeElem.style.height = "auto";
                timeElem.style.whiteSpace = "pre-line";
                timeElem.style.zIndex = elem.style.zIndex;
                timeElem.style.display = String(metaData.display_time) === "true" ? "inline" : "none";
                elem.appendChild(timeElem);
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
        if (elem &&
            metaData.type === Constants.TypeTileViewer &&
            metaData.hasOwnProperty('layerList')) {

            let copyrightText = TileViewerUtil.createCopyrightText(metaData);
            if (copyrightText.length === 0) {
                let copyrightElem = document.getElementById("copyright:" + metaData.id);
                if (copyrightElem) {
                    copyrightElem.style.display = "none";
                }
                return;
            }

            let copyrightElem = document.getElementById("copyright:" + metaData.id);
            if (copyrightElem) {
                copyrightElem.innerHTML = copyrightText;
                copyrightElem.style.right = "0px";
                if (metaData.display_time && String(metaData.display_time) === "true") {
                    copyrightElem.style.top = "50px";
                } else {
                    copyrightElem.style.top = "0px";
                }
                copyrightElem.style.zIndex = elem.style.zIndex;
                copyrightElem.style.display = "inline";
            } else {
                copyrightElem = document.createElement("pre");
                copyrightElem.style.display = "inline";
                copyrightElem.id = "copyright:" + metaData.id;
                copyrightElem.className = "copyright";
                copyrightElem.innerHTML = copyrightText;
                copyrightElem.style.right = "0px";
                if (metaData.display_time && String(metaData.display_time) === "true") {
                    copyrightElem.style.top = "50px";
                } else {
                    copyrightElem.style.top = "0px";
                }
                copyrightElem.style.position = "absolute";
                copyrightElem.style.height = "auto";
                copyrightElem.style.whiteSpace = "pre-line";
                copyrightElem.style.zIndex = elem.style.zIndex;
                elem.appendChild(copyrightElem);
            }
        }
    }

    /**
     * クライアントサイズを取得する.
     * @method getWindowSize
     * @return {Object} クライアントサイズ `{width: window.innerWidth, height: window.innerHeight}`.
     */
    getWindowSize() {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }

    /**
     * 
     * @returns ビューワサイズ
     */
    getViewerSize() {
        const viewer = document.getElementById('content');
        const rect = viewer.getBoundingClientRect();
        return {
            width : rect.right - rect.left,
            height: rect.bottom - rect.top
        };
    }

    /**
     * 
     * @returns メニューにて選択されたコンテンツの値(コンテンツURL)を返す.
     */
    getSelectedValueOnMenuContents() {
        let selectValue = { type: "error", url: "" };
        try {
            selectValue = JSON.parse(this.contentSelect.getSelectedValue());
        } catch (ex) {
            console.error(ex);
        }
        return selectValue;
    }

    /**
     * タイルビューワコンテンツをChOWDERに追加する
     * @param {*} param 
     * @param {*} thumbnailBuffer 
     */
    addTileViewerContent(param, thumbnailBuffer) {
        let selectValue = this.getSelectedValueOnMenuContents();
        if (selectValue.type === "user") {
            let metaData = selectValue.meta;
            this.action.loadUserData(metaData);
            this.action.resizeContent({
                size : {
                    width :  this.getViewerSize().width,
                    height :  this.getViewerSize().height,
                }
            })
        } else {
            let metaData = {
                type: Constants.TypeTileViewer,
                user_data_text: JSON.stringify({
                    text: selectValue.url
                }),
                posx: 0,
                posy: 0,
                width: param.width,
                height: param.height,
                orgWidth: param.width,
                orgHeight: param.height,
                cameraParams: param.cameraParams,
                group: Constants.DefaultGroup,
                visible: true,
                display_time: true,
                zoomLabelVisible : true,
                layerList: JSON.stringify(param.layerList),
                url: decodeURI(selectValue.url)
            };
            if (param.hasOwnProperty('id')) {
                metaData.id = param.id;
            }
            let data = {
                metaData: metaData,
                contentData: thumbnailBuffer
            };
            this.action.addContent(data);
        }
    }

    /**
     * 選択されたコンテンツURLを元に、TileViewerを表示する
     * @param {*} elem 
     * @param {*} metaData 
     * @param {*} contentData 
     */
    showTileViewer() {
        this.iframe = document.createElement('iframe');
        let selectValue = this.getSelectedValueOnMenuContents();
        this.iframe.src = selectValue.url;
        this.iframe.style.width = "100%";
        this.iframe.style.height = "100%";
        this.iframe.style.border = "none";

        this.iframe.onload = () => {
            this.iframe.contentWindow.chowder_view_type = "control";
            this.iframe.contentWindow.focus();

            this.iframe.contentWindow.onmousedown = () => {
                this.iframe.contentWindow.focus();
            };

            this.iframe.contentWindow.addEventListener('mousemove', (ev) => {
                if (this.isShowRemoteCursor)
                {
                    const clRect = this.iframe.getBoundingClientRect();
                    if (ev.pageX !== undefined && ev.pageY !== undefined ) {
                        // x, yには幅高さに対する割合を入れることとする
                        this.action.updateRemoteCursor({
                            id : this.store.getMetaData().id,
                            x : ev.clientX / (clRect.right - clRect.left),
                            y : ev.clientY / (clRect.bottom - clRect.top),
                            isEnable : true,
                        });
                    }
                }
            });

            // iframe外のmouseupを拾ってiframeに投げる
            window.addEventListener('mouseup', this.onMouseUp);
            // iframe外のmousemoveを拾ってiframeに投げる
            window.addEventListener('mousemove', this.onMouseMove);

            this.action.connectIFrame(this.iframe);

        };
        this.iframe.onunload = () => {
            window.removeEventListener('mouseup', this.onMouseUp);
            window.removeEventListener('mousemove', this.onMouseMove);
        };
        document.getElementById('content').appendChild(this.iframe);
    }
}

export default GUI;