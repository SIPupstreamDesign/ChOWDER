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
        Translation.translate(function () { });

        // ログイン成功
        this.store.on(Store.EVENT_LOGIN_SUCCESS, (err, data) => {
            // ログインメニューを削除
            document.body.removeChild(this.loginMenu.getDOM());
            this.initPropertyPanel();
            this.initMenu();
            this.showWebGL();
        });

        // ログイン失敗
        this.store.on(Store.EVENT_LOGIN_FAILED, (err, data) => {
            this.loginMenu.showInvalidLabel(true);
        });

        this.store.on(Store.EVENT_DONE_IFRAME_CONNECT, (err, itownConnector) => {

            // iframe内のitownsのカメラが更新された
            itownConnector.on(ITownsCommand.UpdateCamera, (err, params) => {
                this.action.updateCameraWorldMatrix({
                    mat: params
                });
            });

            // iframe内からコンテンツ追加命令がきた
            itownConnector.on(ITownsCommand.AddContent, (err, params) => {
                this.addITownContent(params, toArrayBuffer(params.thumbnail));
            });

            // iframe内のitownsのレイヤーが更新された
            itownConnector.on(ITownsCommand.UpdateLayer, (err, params) => {
                this.layerList.initLayerSelectList(params);
            });
        })
        
        // サンプルコンテンツの追加
        this.addPresetContentSelect();

        this.store.on(Store.EVENT_CONNECT_SUCCESS, (err, data) => {
            this.action.fetchContents();
        });

        // ページアクセス直後に全コンテンツのメタデータを取得し(action.fetchContents)、
        // webglコンテンツであった場合のみコールバックが呼ばれる
        // 複数のwebglコンテンツがあった場合は, 複数回呼ばれる
        this.store.on(Store.EVENT_DONE_FETCH_CONTENTS, (err, metaData) => {
            this.addUserContentSelect(metaData);
        });

        // コンテンツ追加後にMetaDataが更新されたタイミングでレイヤーリストをEnableにする
        this.store.on(Store.EVENT_DONE_UPDATE_METADATA, (err, meta) => {
            if (!err && meta.hasOwnProperty('id')) {
                this.contentID.innerText = meta.id;
                this.layerList.setEnable(true);
            }
        });

        this.store.on(Store.EVENT_DONE_ADD_CONTENT, (err, meta) => {
            if (!err && meta.hasOwnProperty('id')) {
                this.contentID.innerText = meta.id;
                this.layerList.setEnable(true);
            }
        });
        
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
                password: "123456",//this.loginMenu.getPassword()
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

    addPresetContentSelect() {
        let wrapDom = document.createElement('div');
        wrapDom.innerHTML = "Content:"
        this.itownSelect = new Select();
        this.itownSelect.getDOM().className = "itown_select";
        // サンプルコンテンツの追加
        this.itownSelect.addOption(JSON.stringify({
            type : "preset",
            url : "itowns/view_pointcloud_3d_map.html"
        }), "Preset:view_pointcloud_3d_map");
        this.itownSelect.addOption(JSON.stringify({
            type : "preset",
            url : "itowns/view_3d_map.html"
        }), "Preset:view_3d_map");
        this.itownSelect.addOption(JSON.stringify({
            type : "preset",
            url : "itowns/3dtiles_basic.html"
        }), "Preset:3dtiles_basic");
        this.itownSelect.addOption(JSON.stringify({
            type : "preset",
            url : "itowns/vector_tile_raster_3d.html"
        }), "Preset:vector_tile_raster_3d");
        this.itownSelect.getDOM().style.marginTop = "20px"
        wrapDom.appendChild(this.itownSelect.getDOM())
        document.getElementsByClassName('loginframe')[0].appendChild(wrapDom);
    }

    addUserContentSelect(metaData) {
        this.itownSelect.addOption(JSON.stringify({
            type : "user", 
            url : metaData.url,
            meta : metaData
        }), "ContentID:" + metaData.id);
    }

    initPropertyPanel() {
        let propElem = document.getElementById('itowns_property');

        // コンテンツIDタイトル
        let contentIDTitle = document.createElement('p');
        contentIDTitle.className = "title";
        contentIDTitle.innerHTML = "Content ID";
        propElem.appendChild(contentIDTitle);

        // コンテンツID
        this.contentID = document.createElement('p');
        this.contentID.className = "property_text";
        propElem.appendChild(this.contentID);

        // ベースコンテンツタイトル
        let contentTitle = document.createElement('p');
        contentTitle.className = "title";
        contentTitle.innerHTML = i18next.t('base_content');
        propElem.appendChild(contentTitle);

        // ベースコンテンツ名
        let contentName = document.createElement('p');
        contentName.className = "property_text";
        let selectValue = this.getSelectedValueOnMenuContents();
        contentName.innerHTML = selectValue.url;
        propElem.appendChild(contentName);

        propElem.appendChild(document.createElement('hr'));

        // レイヤーリストタイトル
        let layerTitle = document.createElement('p');
        layerTitle.className = "title";
        layerTitle.innerHTML = i18next.t('layer_list');
        propElem.appendChild(layerTitle);

        // レイヤーリスト
        this.layerList = new LayerList(this.store, this.action);
        this.layerList.setEnable(false);
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
            this.layerProperty.initFromLayer(data.value, this.store.getLayerData(data.value));
        });
    }

    getSelectedValueOnMenuContents() {
        let selectValue = { type : "error", url : "" };
        try {
            selectValue = JSON.parse(this.itownSelect.getSelectedValue());
        } catch(ex) {
            console.error(ex);
        }
        return selectValue;
    }

    /**
     * WebGLを表示
     * @param {*} elem 
     * @param {*} metaData 
     * @param {*} contentData 
     */
    showWebGL() {
        this.iframe = document.createElement('iframe');
        let selectValue = this.getSelectedValueOnMenuContents();
        this.iframe.src = selectValue.url;
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

    addITownContent(param, thumbnailBuffer) {
        let selectValue = this.getSelectedValueOnMenuContents();
        if (selectValue.type === "user") {
            let metaData = selectValue.meta;
            this.action.loadUserData(metaData);
        } else {
            let metaData = {
                type: Constants.TypeWebGL,
                user_data_text: JSON.stringify({
                    text: selectValue.url
                }),
                posx: 0,
                posy: 0,
                width: this.getWindowSize().width,
                height: this.getWindowSize().height,
                orgWidth: this.getWindowSize().width,
                orgHeight: this.getWindowSize().height,
                visible: true,
                layerList : JSON.stringify(param.layerList),
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