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

        // ログイン成功
        this.store.on(Store.EVENT_LOGIN_SUCCESS, (err, data) => {
            // ログインメニューを削除
            document.body.removeChild(this.loginMenu.getDOM());
            // this.initPropertyPanel();
            // this.initMenu();
            this.showTileViewer();
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