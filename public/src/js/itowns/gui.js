/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import Action from './action';
import Store from './store.js';
import LoginMenu from '../components/login_menu.js';
import Translation from '../common/translation';
import Constants from '../common/constants';

class GUI extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;

    }
    
    init() {
        this.initWindow();
        this.initLoginMenu();
        this.loginMenu.show(true);
        Translation.translate(function () { });

        // ログイン成功
        this.store.on(Store.EVENT_LOGIN_SUCCESS, (err, data) => {
            this.loginMenu.showInvalidLabel(false);
            this.loginMenu.show(false);

            this.showWebGL();
            ///this.addITownContent();
        });

        // ログイン失敗
        this.store.on(Store.EVENT_LOGIN_FAILED, (err, data) => {
            this.loginMenu.showInvalidLabel(true);
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
                password: this.loginMenu.getPassword()
            });
        });

        let select = this.loginMenu.getUserSelect();
        select.addOption("APIUser", "APIUser");
    }

    /**
     * WebGLを表示
     * @param {*} elem 
     * @param {*} metaData 
     * @param {*} contentData 
     */
    showWebGL() {
        let iframe = document.createElement('iframe');
        iframe.src = "itowns/view_3d_map.html";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.onload = () => {
            // iframe内のitownsからのコールバック
            iframe.contentWindow.chowder_itowns_update_camera = (mat) => {
                this.action.updateCameraWorldMatrix({
                    mat : mat
                });
            };
            iframe.contentWindow.chowder_itowns_update_thumbnail = (thumbnailBuffer) => {
                this.addITownContent(thumbnailBuffer);
            };
        }

        document.getElementById('itowns').appendChild(iframe);
    }

    addITownContent(thumbnailBuffer) {
        let url =  "itowns/view_3d_map_display.html";
        let metaData = {
            type: Constants.TypeWebGL,
            user_data_text: JSON.stringify({
                text: url
            }),
            posx : 0,
            posy : 0,
            width: this.getWindowSize().width,
            height: this.getWindowSize().height,
            orgWidth: this.getWindowSize().width,
            orgHeight: this.getWindowSize().height,
            visible : true,
            url : decodeURI(url)
        };
        let data = {
            metaData : metaData,
            contentData : thumbnailBuffer
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