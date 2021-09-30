/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Store from './store.js';
import LoginMenu from '../components/login_menu.js';
import Select from '../components/select';
import ContentsSelect from '../components/contents_select.js';
import Translation from '../common/translation';
import Menu from '../components/menu';
import Constants from '../common/constants';
import TileViewerCommand from '../common/tileviewer_command'
import TileViewerUtil from '../common/tileviewer_util'
import LayerProperty from './layer_property'
import LayerList from './layer_list'

// Base64からバイナリへ変換
function toArrayBuffer(base64) {
    var bin = atob(base64.replace(/^.*,/, ''));
    var buffer = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) {
        buffer[i] = bin.charCodeAt(i);
    }
    return buffer.buffer;
}

class GUI extends EventEmitter {
    constructor(store, action) {
        super();
        console.log("[gui]:constructor")
        this.store = store;
        this.action = action;
    }

    /**
     * すべてのGUIの初期化
     */
    init() {
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
            }
        })


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

                // copyright更新
                this.showCopyrights(document.getElementById('content'), meta)
            }
            // syncの更新
            /*
            if (!err) {
                const isSync = ITownsUtil.isTimelineSync(meta);
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
            */
        });

        this.store.on(Store.EVENT_DONE_ADD_CONTENT, (err, meta) => {
            if (!err && meta.hasOwnProperty('id')) {
                this.contentID.innerText = meta.id;
                this.layerList.setEnable(true);

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

        this.propInnerVisible = false;
        this.propInner = document.createElement('div');
        this.propInner.className = "tileviewer_property_inner";
        contentDOM.appendChild(this.propInner);

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
            let layerData = this.store.getLayerData(data.value);
            this.layerProperty.init(data.value, layerData);
        };

        this.layerList.on(LayerList.EVENT_LAYER_SELECT_CHANGED, (err, data) => {
            initLayerProperty(data);
        });
        this.layerProperty.on(LayerProperty.EVENT_LAYER_PROPERTY_NEED_UPDATE_GUI, (err, data) => {
            const scrollTop = propInner.scrollTop;
            initLayerProperty(data);
            propInner.scrollTop = scrollTop;
        });

        // Select Data ボタン
        const selectDataButton = document.getElementById('button_select_data');
        selectDataButton.onclick = () => {
            // セレクトダイアログを表示
            if (this.propInnerVisible) {
                this.propInner.style.display = "none";
                this.propInnerVisible = false;
            } else {
                this.propInner.style.display = "block";
                this.propInnerVisible = true;
            }
        };
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
                copyrightElem.style.top = "0px";
                copyrightElem.style.zIndex = elem.style.zIndex;
                copyrightElem.style.display = "inline";
            } else {
                copyrightElem = document.createElement("pre");
                copyrightElem.style.display = "inline";
                copyrightElem.id = "copyright:" + metaData.id;
                copyrightElem.className = "copyright";
                copyrightElem.innerHTML = copyrightText;
                copyrightElem.style.right = "0px";
                copyrightElem.style.top = "0px";
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
                layerList: JSON.stringify(param.layerList),
                url: decodeURI(selectValue.url)
            };
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