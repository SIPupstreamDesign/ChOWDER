/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import Store from './store.js';
import LoginMenu from '../components/login_menu.js';
import Translation from '../common/translation';
import Menu from '../components/menu';
import GUIProperty from './gui_property';
import Constants from '../common/constants';


/**
 * canvasをArrayBufferに
 * @method toArrayBuffer
 * @param {string} base64
 * @return {ArrayBuffer}
 */
function toArrayBuffer(base64) {
    // Base64からバイナリへ変換
    let bin = atob(base64.replace(/^.*,/, ''));
    let buffer = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        buffer[i] = bin.charCodeAt(i);
    }
	return buffer.buffer;
}

function resizeToThumbnail(srcCanvas) {
	let width = document.body.clientWidth;
	let height = document.body.clientHeight;
	let canvas = document.createElement('canvas');
	let ctx = canvas.getContext('2d');
	canvas.width = 256;
	canvas.height = 256 * (height / width);
	ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, canvas.width, canvas.height);
	return toArrayBuffer(canvas.toDataURL("image/jpeg"));
}


class GUI extends EventEmitter {
	constructor(store, action) {
		super();
		console.log("[gui]:constructor")
		this.store = store;
		this.action = action;
	}

	// すべてのGUIの初期化
	init() {
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

		this.store.on(Store.EVENT_DONE_IFRAME_CONNECT, (err, iframeConnector) => {
			console.log("[gui]:EVENT_DONE_IFRAME_CONNECT");
			this.addQgisContent();
		})
		
	}

	/**
	 * @method addQgisContent
	 */
	addQgisContent(){
		const thumbnail = resizeToThumbnail(this.iframe.contentWindow.Q3D.application.renderer.domElement)

		let metaData = {
			type: Constants.TypeWebGL,
			user_data_text: JSON.stringify({
				text: this.store.getContentInfo().url
			}),
			posx: 0,
			posy: 0,
			width: this.getWindowSize().width,
			height: this.getWindowSize().height,
			orgWidth: this.getWindowSize().width,
			orgHeight: this.getWindowSize().height,
			visible: true,
			// layerList: JSON.stringify(param.layerList),
			url: decodeURI(this.store.getContentInfo().url)
		};
		let data = {
			metaData: metaData,
			contentData: thumbnail
		};
		console.log("[addQgisContent]: ",data);
		this.action.addContent(data);
	}

	initLoginMenu() {
		this.loginMenu = new LoginMenu("ChOWDER Qgis2Threejs App");
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

	// 上のバーの初期化
	initMenu() {
		// メニュー設定
		let menuSetting = [];
		this.headMenu = new Menu("", menuSetting, "ChOWDER Qgis2Threejs App");
		document.getElementsByClassName('head_menu')[0].appendChild(this.headMenu.getDOM());

	}

	// 右側のパネルの初期化
	initPropertyPanel() {
		const contentInfo = this.store.getContentInfo();

        let propElem = document.getElementById('qgis_property');

        let propInner = document.createElement('div');
        propInner.className = "qgis_property_inner";
        propElem.appendChild(propInner);

        // コンテンツIDタイトル
        let contentIDTitle = document.createElement('p');
        contentIDTitle.className = "title";
        contentIDTitle.innerHTML = "Content ID";
        propInner.appendChild(contentIDTitle);

        // コンテンツID
        this.contentID = document.createElement('p');
		this.contentID.className = "property_text";
		this.contentID.innerText = contentInfo.contentID;
        propInner.appendChild(this.contentID);

        // ベースコンテンツタイトル
        let contentTitle = document.createElement('p');
        contentTitle.className = "title";
        contentTitle.innerHTML = i18next.t('base_content');
        propInner.appendChild(contentTitle);

        // ベースコンテンツ名
        let contentName = document.createElement('p');
        contentName.className = "property_text";
        contentName.innerHTML = contentInfo.url;
        propInner.appendChild(contentName);

        propInner.appendChild(document.createElement('hr'));

        // プロパティタイトル
        let propertyTitle = document.createElement('p');
        propertyTitle.className = "title property_title";
        propertyTitle.innerHTML = i18next.t('property');
        propInner.appendChild(propertyTitle);

        // プロパティ
        this.guiProperty = new GUIProperty(this.store, this.action);
        propInner.appendChild(this.guiProperty.getDOM());

		// コンテンツ読み込み後とかに初期化する（仮
		// if (this.store.on(Store.IsContentLoaded)) 
		{
			this.guiProperty.initFromProps(this.store.getContentInfo());
		}
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

	/**
	 * WebGLを表示
	 * @param {*} elem 
	 * @param {*} metaData 
	 * @param {*} contentData 
	 */
	showWebGL() {
		this.iframe = document.createElement('iframe');
		this.iframe.src = this.store.getContentInfo().url;
		this.iframe.style.width = "100%";
		this.iframe.style.height = "100%";
		this.iframe.style.border = "none";
		this.iframe.style.backgroundColor = "white";

		this.iframe.onload = () => {
			this.iframe.contentWindow.focus();

			this.iframe.contentWindow.onmousedown = () => {
				this.iframe.contentWindow.focus();
			};

			this.action.connectIFrame(this.iframe);
		};
		document.getElementById('qgis').appendChild(this.iframe);
	}
}

export default GUI;