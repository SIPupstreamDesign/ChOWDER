/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import Select from '../components/select';
import Store from './store.js';
import LoginMenu from '../components/login_menu.js';
import Translation from '../common/translation';
import Constants from '../common/constants';
import LayerProperty from './layer_property';
import LayerList from './layer_list';
import Menu from '../components/menu';
import ITownsCommand from '../common/itowns_command';

function serializeFunction(f) {
    return encodeURI(f.toString());
}

// canvasをArrayBufferに
function toArrayBuffer(base64) {
    // Base64からバイナリへ変換
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

        this.store = store;
        this.action = action;

    }

    init() {
        let date = new Date();
        $("#timeline").k2goTimeline(
            {
                startTime: new Date(date.getFullYear(), date.getMonth(), 1), // 左端の日時を今月の01日に設定
                endTime: new Date(date.getFullYear(), date.getMonth() + 1, 1), // 右端の日時を翌月の01日に設定
                currentTime: new Date(date.getFullYear(), date.getMonth(), 16), // 摘み（ポインタ）の日時を今月の16日に設定
                minTime: new Date(date.getFullYear(), 0, 1), // 過去方向への表示可能範囲を今年の1月1日に設定
                maxTime: new Date(date.getFullYear() + 1, 0, 1), // 未来方向への表示可能範囲を翌年の1月1日に設定
                timeChange: function (pTimeInfo) {
                    console.error("timeChanged")
                    // pTimeInfo.  startTimeから左端の日時を取得
                    // pTimeInfo.    endTimeから右端の日時を取得
                    // pTimeInfo.currentTimeから摘み（ポインタ）の日時を取得
                }
            });

        this.initWindow();
        this.initLoginMenu();
        this.loginMenu.show(true);
        this.addITwonSelect()
        Translation.translate(function () { });

        // ログイン成功
        this.store.on(Store.EVENT_LOGIN_SUCCESS, (err, data) => {
            document.body.removeChild(this.loginMenu.getDOM());
            this.initPropertyPanel();
            this.initMenu();
            this.showWebGL();
        });

        // ログイン失敗
        this.store.on(Store.EVENT_LOGIN_FAILED, (err, data) => {
            this.loginMenu.showInvalidLabel(true);
        });

        // ためしにレイヤー追加
        this.store.on(Store.EVENT_DONE_ADD_LAYER, (err, data) => {
            // iframe内のchowder injectionの初期化
            this.iframe.contentWindow.postMessage(JSON.stringify({
                jsonrpc: "2.0",
                method: ITownsCommand.AddLayer,
                params: data
            }));
        });

        // レイヤー削除
        this.store.on(Store.EVENT_DONE_DELETE_LAYER, (err, data) => {
        });

        // レイヤー順序変更
        this.store.on(Store.EVENT_DONE_CHANGE_LAYER_ORDER, (err, data) => {
        });

        // レイヤープロパティ変更
        this.store.on(Store.EVENT_DONE_CHANGE_LAYER_PROPERTY, (err, data) => {
        });

        this.store.on(Store.EVENT_DONE_IFRAME_CONNECT, (err, itownConnector) => {
                
            // iframe内のitownsのカメラが更新された
            itownConnector.on(ITownsCommand.UpdateCamera, (err, params) => {
                this.action.updateCameraWorldMatrix({
                    mat: params
                });
            });
            
            // iframe内のitownsのサムネイルが更新された
            itownConnector.on(ITownsCommand.UpdateThumbnail, (err, params) => {
                //this.addITownContent(toArrayBuffer(params));
            });

            // iframe内のitownsのレイヤーが更新された
            itownConnector.on(ITownsCommand.UpdateLayer, (err, params) => {
                this.layerList.initLayerSelectList(params);
            });

        })
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
                    size: this.getWindowSize()
                });
            }, 200);
        };
    }

    initLoginMenu() {
        this.loginMenu = new LoginMenu("ChOWDER iTowns Controller");
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

    initMenu() {
        // メニュー設定
        let menuSetting = [];
        /*
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
            }];*/
        
        this.headMenu = new Menu("", menuSetting, "ChOWDER iTowns Controller");
        document.getElementsByClassName('head_menu')[0].appendChild(this.headMenu.getDOM());

    }

    addITwonSelect() {
        let wrapDom = document.createElement('div');
        wrapDom.innerHTML = "Sample Content:"
        this.itownSelect = new Select();
        this.itownSelect.getDOM().className = "itown_select";
        this.itownSelect.addOption("itowns/view_3d_map.html", "view_3d_map");
        this.itownSelect.addOption("itowns/3dtiles_basic.html", "3dtiles_basic");
        this.itownSelect.addOption("itowns/vector_tile_raster_3d.html", "vector_tile_raster_3d");
        this.itownSelect.addOption("itowns/view_pointcloud_3d_map.html", "view_pointcloud_3d_map");
        this.itownSelect.getDOM().style.marginTop = "20px"
        wrapDom.appendChild(this.itownSelect.getDOM())
        document.getElementsByClassName('loginframe')[0].appendChild(wrapDom);
    }

    initPropertyPanel() {
        let propElem = document.getElementById('itowns_property');

        // コンテンツタイトル
        let contentTitle = document.createElement('p');
        contentTitle.className = "title";
        contentTitle.innerHTML = i18next.t('base_content');
        propElem.appendChild(contentTitle);

        // コンテンツ名
        let contentName = document.createElement('p');
        contentName.className = "property_text";
        contentName.innerHTML = this.itownSelect.getSelectedValue();
        propElem.appendChild(contentName);

        propElem.appendChild(document.createElement('hr'));

        // レイヤーリストタイトル
        let layerTitle = document.createElement('p');
        layerTitle.className = "title";
        layerTitle.innerHTML = i18next.t('layer_list');
        propElem.appendChild(layerTitle);

        // レイヤーリスト
        this.layerList = new LayerList(this.store, this.action);
        propElem.appendChild(this.layerList.getDOM());

        // レイヤープロパティタイトル
        let layerPropertyTitle = document.createElement('p');
        layerPropertyTitle.className = "title layer_property_title";
        layerPropertyTitle.innerHTML = i18next.t('layer_property');
        propElem.appendChild(layerPropertyTitle);

        // レイヤープロパティ
        this.layerProperty = new LayerProperty(this.store, this.action);
        propElem.appendChild(this.layerProperty.getDOM());

        this.layerList.on(LayerList.EVENT_LAYER_SELECT_CHANGED, (err, data) => {
            this.layerProperty.initFromLayer(data.value, {});
        });
    }

    /**
     * WebGLを表示
     * @param {*} elem 
     * @param {*} metaData 
     * @param {*} contentData 
     */
    showWebGL() {
        this.iframe = document.createElement('iframe');
        this.iframe.src = this.itownSelect.getSelectedValue();
        this.iframe.style.width = "100%";
        this.iframe.style.height = "100%";
        this.iframe.style.border = "none";

        this.iframe.onload = () => {
            this.iframe.contentWindow.chowder_itowns_view_type = "itowns";
            this.iframe.contentWindow.focus();

            this.action.connectIFrame(this.iframe);
        };

        document.getElementById('itowns').appendChild(this.iframe);
    }

    addITownContent(thumbnailBuffer) {
        let url = this.itownSelect.getSelectedValue();
        let metaData = {
            type: Constants.TypeWebGL,
            user_data_text: JSON.stringify({
                text: url
            }),
            posx: 0,
            posy: 0,
            width: this.getWindowSize().width,
            height: this.getWindowSize().height,
            orgWidth: this.getWindowSize().width,
            orgHeight: this.getWindowSize().height,
            visible: true,
            url: decodeURI(url)
        };
        let data = {
            metaData: metaData,
            contentData: thumbnailBuffer
        };
        this.action.addContent(data);
    }

    /**
     * クライアントサイズを取得する.
     * ただの `{width: window.innerWidth, height: window.innerHeight}`.
     * @method getWindowSize
     * @return {Object} クライアントサイズ
     */
    getWindowSize() {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }
}

export default GUI;