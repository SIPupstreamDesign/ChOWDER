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
import Button from '../components/button';
import InputDialog from '../components/input_dialog'
import PopupBackground from '../components/popup_background';

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
		// 一定間隔同じイベントが来なかったら実行するための関数
		let debounceChangeTime = (() => {
			const interval = 100;
			let timer;
			return (pTimeInfo) => {
				clearTimeout(timer);
				timer = setTimeout(() => {
                    this.action.changeTime({
                        time : new Date(pTimeInfo.currentTime)
                    });
				}, interval);
			};
		})();

        let date = new Date();
        $("#timeline").k2goTimeline(
            {
                startTime: new Date(date.getFullYear(), date.getMonth(), 1), // 左端の日時を今月の01日に設定
                endTime: new Date(date.getFullYear(), date.getMonth() + 1, 1), // 右端の日時を翌月の01日に設定
                currentTime: new Date(date.getFullYear(), date.getMonth(), 16), // 摘み（ポインタ）の日時を今月の16日に設定
                minTime: new Date(date.getFullYear(), 0, 1), // 過去方向への表示可能範囲を今年の1月1日に設定
                maxTime: new Date(date.getFullYear() + 1, 0, 1), // 未来方向への表示可能範囲を翌年の1月1日に設定
                timeChange: function (pTimeInfo) {
                    debounceChangeTime(pTimeInfo);
                    // pTimeInfo.  startTimeから左端の日時を取得
                    // pTimeInfo.    endTimeから右端の日時を取得
                    // pTimeInfo.currentTimeから摘み（ポインタ）の日時を取得
                },
                barMove : function (pTimeInfo) {
                    debounceChangeTime(pTimeInfo);
                },
                barMoveEnd : function (pTimeInfo) {
                    debounceChangeTime(pTimeInfo);
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
                this.action.updateCamera({
                    mat: params.mat,
                    params : params.params
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

        // レイヤーが追加された
        this.store.on(Store.EVENT_DONE_ADD_LAYER, (err, layerDataList) => {
            if (!err) {
                this.layerList.initLayerSelectList(layerDataList);
            }
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
        
        let timer;
        const interval = 5 * 1000;
        let background = null;
        this.store.on(Store.EVENT_UPDATE_MEASURE_PERFORMANCE, (err, id, displayID) => {
            // 一定間隔同じイベントが来なかったら実行
            clearTimeout(timer);
            timer = setTimeout((() => {
                return () => {
                    this.savePerformanceResult(id, displayID);
                    if (background) {
                        background.close();
                        background = null;
                    }
                }
            })(), interval);
            
            if (!background) {
                background = new PopupBackground()
                background.show();
                let backdom = document.getElementsByClassName('popup_background')[0]
                let text = document.createElement('div');
                text.style.color = "white"
                text.style.fontSize = "40px"
                text.style.position = "absolute"
                text.style.left = "100px"
                text.style.top = "100px"
                text.innerHTML = "Please wait for a few seconds.."
                backdom.appendChild(text);
            }
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

    addPresetContentSelect() {
        let wrapDom = document.createElement('div');
        wrapDom.innerHTML = "Content:"
        this.itownSelect = new Select();
        this.itownSelect.getDOM().className = "itown_select";
        // サンプルコンテンツの追加
        this.itownSelect.addOption(JSON.stringify({
            type : "preset",
            url : "itowns/gsi_planar.html"
        }), "Preset:地理院地図 2.5D");
        this.itownSelect.addOption(JSON.stringify({
            type : "preset",
            url : "itowns/gsi.html"
        }), "Preset:地理院地図 3D");
        this.itownSelect.addOption(JSON.stringify({
            type : "preset",
            url : "itowns/pointcloud_3d_map.html"
        }), "Preset:pointcloud_3d_map");
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
        this.itownSelect.addOption(JSON.stringify({
            type : "preset",
            url : "itowns/shp.html"
        }), "Preset:shp");
        /*
        this.itownSelect.addOption(JSON.stringify({
            type : "preset",
            url : "itowns/nict_tsukuba.html?name=mtTsukuba&px=-3952307.675547402&py=3304876.576466543&pz=3748873.8775102566&range=2737.9540096505734&xlookat=140.07961145092113&ylookat=36.20684848349528&zlookat=28.50089971907437&heading=140.65953519356157&tilt=17.701978694273777&c_vfov=37&c_pan=-140.66&c_tilt=-17.70098924418633&c_length=2839.4286268307546&p_tilt=-17.8&p_pan=-140.5&p_roll=0&p_hfov=49&p_vfov=30&p_opacity=0.7&p_auto=false&p_line=false&p_cube=false&demo=true"
        }), "Preset:nict_tsukuba");
        */
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

		let propInner = document.createElement('div');
		propInner.className = "itowns_property_inner";
        propElem.appendChild(propInner);
        
        // コンテンツIDタイトル
        let contentIDTitle = document.createElement('p');
        contentIDTitle.className = "title";
        contentIDTitle.innerHTML = "Content ID";
        propInner.appendChild(contentIDTitle);

        // コンテンツID
        this.contentID = document.createElement('p');
        this.contentID.className = "property_text";
        propInner.appendChild(this.contentID);

        // ベースコンテンツタイトル
        let contentTitle = document.createElement('p');
        contentTitle.className = "title";
        contentTitle.innerHTML = i18next.t('base_content');
        propInner.appendChild(contentTitle);

        // ベースコンテンツ名
        let contentName = document.createElement('p');
        contentName.className = "property_text";
        let selectValue = this.getSelectedValueOnMenuContents();
        contentName.innerHTML = selectValue.url;
        propInner.appendChild(contentName);

        propInner.appendChild(document.createElement('hr'));

        // レイヤーリストタイトル
        let layerTitle = document.createElement('p');
        layerTitle.className = "title";
        layerTitle.innerHTML = i18next.t('layer_list');
        propInner.appendChild(layerTitle);

        // レイヤーリスト
        this.layerList = new LayerList(this.store, this.action);
        this.layerList.setEnable(false);
        propInner.appendChild(this.layerList.getDOM());

        // レイヤープロパティタイトル
        let layerPropertyTitle = document.createElement('p');
        layerPropertyTitle.className = "title layer_property_title";
        layerPropertyTitle.innerHTML = i18next.t('layer_property');
        propInner.appendChild(layerPropertyTitle);

        // レイヤープロパティ
        this.layerProperty = new LayerProperty(this.store, this.action);
        propInner.appendChild(this.layerProperty.getDOM());

        this.layerList.on(LayerList.EVENT_LAYER_SELECT_CHANGED, (err, data) => {
            this.layerProperty.initFromLayer(data.value, this.store.getLayerData(data.value));
        });

        // 速度計測ボタン
        this.measureButton = new Button();
        this.measureButton.setDataKey("MeasurePerformance");
        this.measureButton.getDOM().className = "measure_button btn btn-primary";
        propElem.appendChild(this.measureButton.getDOM());
        this.measureButton.on('click', () => {
            this.action.measurePerformance();
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

            this.iframe.contentWindow.onmousedown = () => {
                this.iframe.contentWindow.focus();
            };
    
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
    
    /// パフォーマンス計測結果を表示
    savePerformanceResult(dataID, displayID) {
        let result = this.store.getPerformanceResult();
        let text = "";
        text += "DisplayID, ";
        text += "updateDuration, "
        text += "zoom0, zoom1, zoom2, zoom3, zoom4, zoom5, ";
        text += "zoom6, zoom7, zoom8, zoom9, zoom10, zoom11, zoom12, ";
        text += "zoom13, zoom14, zoom15, zoom16, zoom17, zoom18, zoom19, zoom20,";
        text += "displayed nodes, textures, geometries, ";
        text += "\n";

        for (let id in result) {
            let data = result[id];
            text += id + ", "; // DisplayID
            text += String(data.updateDuration) + ", "; // DisplayID
            let displayedNodes = 0;
            for (let k = 0; k <= 20; ++k) {
                if (data.nodeVisible.hasOwnProperty(String(k))) {
                    text += String(data.nodeVisible[k][1]) + ", ";
                    displayedNodes += data.nodeVisible[k][1];
                } else {
                    text += "0, ";
                }
            }
            text += String(displayedNodes) + ",";
            text += data.textureCount + ",";
            text += data.geometryCount + ",";
            text += "\n";
        }

        function save(text, filename) {
            let bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
            let blob = new Blob([bom, text], {type: 'text/csv'});
    
            let url = (window.URL || window.webkitURL);
            let blobUrl = url.createObjectURL(blob);
            let e = document.createEvent('MouseEvents');
            e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            let a = document.createElementNS("http://www.w3.org/1999/xhtml", "a");
            a.href = blobUrl;
            a.download = filename;
            a.dispatchEvent(e);
        }
        save(text, "performance_" + dataID + ".csv" )
    }

}

export default GUI;