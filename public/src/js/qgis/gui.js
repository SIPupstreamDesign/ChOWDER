/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import Store from './store.js';
import LoginMenu from '../components/login_menu.js';
import UploadMenu from '../components/upload_menu.js';
import ContentsSelect from '../components/contents_select.js';
import Translation from '../common/translation';
import Menu from '../components/menu';
import GUIProperty from './gui_property';
import Constants from '../common/constants';
import RadioButton from '../components/radio_button.js';


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
	const qgis_size = getCanvasSize();
	const width = qgis_size.width;
	const height = qgis_size.height;
	let canvas = document.createElement('canvas');
	let ctx = canvas.getContext('2d');
	canvas.width = 256;
	canvas.height = 256 * (height / width);
	ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, canvas.width, canvas.height);
	return toArrayBuffer(canvas.toDataURL("image/jpeg"));
}

const getCanvasSize = ()=>{
	const qgis = document.getElementById("qgis");
	return {width:qgis.clientWidth,height:qgis.clientHeight};
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
			this.initMenu();
			this.showWebGL();
		});

		// ログイン失敗
		this.store.on(Store.EVENT_LOGIN_FAILED, (err, data) => {
			this.loginMenu.showInvalidLabel(true);
		});

		this.store.on(Store.EVENT_DONE_CHANGE_PROPERTY, (err, data) => {
            this.iframe.contentWindow.Q3D.application.setLabelVisible(data.label);
            this.iframe.contentWindow.Q3D.application.setWireframeMode(data.wireframe);
		});

		this.store.on(Store.EVENT_DONE_IFRAME_CONNECT, (err, iframeConnector) => {
			console.log("[gui]:EVENT_DONE_IFRAME_CONNECT");
			if(this.store.getNewContent() === true){
				/* 新しくアップロードしたデータをaddする */
				this.addQgisContent();
			}else{
				/* redisからfetchしたコンテンツデータを使う */
				this.initPropertyPanel();
			}
		})

		this.store.on(Store.EVENT_DONE_ADD_CONTENT, (err, data) => {
			console.log("[gui]:EVENT_DONE_ADD_CONTENT");
			this.initPropertyPanel();
		})

        // ページアクセス直後に全コンテンツのメタデータを取得し(action.fetchContents)、
        // webglコンテンツであった場合のみコールバックが呼ばれる
        // 複数のwebglコンテンツがあった場合は, 複数回呼ばれる
        this.store.on(Store.EVENT_DONE_FETCH_CONTENTS, (err, metaData) => {
            this.contentsSelect.addOption(JSON.stringify({
				type: "user",
				url: metaData.url,
				meta: metaData
			}), "ContentID:" + metaData.id);
			this.action.updateSelectedContent(this.contentsSelect.getSelectedValue())
        });

	}

	/**
	 * @method addQgisContent
	 */
	addQgisContent(){
		const thumbnail = resizeToThumbnail(this.iframe.contentWindow.Q3D.application.renderer.domElement)
		const initCameraMatrix = JSON.stringify(this.iframe.contentWindow.Q3D.application.camera.matrixWorld.elements);

		let metaData = {
			type: Constants.TypeWebGL,
			webglType: "qgis2three.js",
			user_data_text: JSON.stringify({
				text: this.store.getSelectedContent().url
			}),
			initCameraMatrix:initCameraMatrix,
			posx: 0,
			posy: 0,
			width: getCanvasSize().width,
			height: getCanvasSize().height,
			orgWidth: getCanvasSize().width,
			orgHeight: getCanvasSize().height,
			visible: true,
			// layerList: JSON.stringify(param.layerList),
			url: decodeURI(this.store.getSelectedContent().url),
			displayProperty:JSON.stringify({
				wireframe : false,
				label : true	
			})
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

		this.radio = new RadioButton("contents");
		document.body.insertBefore(this.loginMenu.getDOM(), document.body.childNodes[0]);
		document.getElementsByClassName("loginframe")[0].appendChild(this.radio.getDOM());

		this.errorMessage = document.createElement("div");
        this.errorMessage.style.padding = "10px";
		document.body.insertBefore(this.errorMessage, document.body.childNodes[0]);
		document.getElementsByClassName("loginframe")[0].appendChild(this.errorMessage);
		this.store.on(Store.EVENT_ERROR_MESSAGE,(err)=>{
			let e = err;
			if(typeof e === Error){
				e = e.toString();
			}
			this.errorMessage.textContent = e;
		});

		this.contentsSelect = new ContentsSelect();
		this.radio.addRadio("redis_content",this.contentsSelect.getDOM());

		this.contentsSelect.on(ContentsSelect.EVENT_CHANGE,(err,event)=>{
			this.action.updateSelectedContent(this.contentsSelect.getSelectedValue())
		});

		this.uploadMenu = new UploadMenu();
		this.radio.addRadio("upload",this.uploadMenu.getDOM());

		const upload = () => {
			return new Promise((resolve,reject)=>{
				const fileinput = document.getElementById("uploadfile");
				const file = fileinput.files[0];
				console.log(file);
				if(!file){
					this.store.emit(Store.EVENT_ERROR_MESSAGE,new Error("no contents"));
					return;
				}

				this.store.on(Store.EVENT_UPLOAD_SUCCESS, (err) => {
					console.log("UPLOAD_SUCCESS");
					resolve("UPLOAD_SUCCESS");
				});

				this.store.on(Store.EVENT_UPLOAD_FAILED, (err) => {
					console.log("UPLOAD_FAILED");
					resolve("UPLOAD_FAILED");
				});

				const reader = new FileReader();
				reader.addEventListener('load', (event) => {
					console.log("load",event.target.result);
	
					this.action.upload({
						metaData: {filename:file.name},
						binary: event.target.result
					});

				});
				reader.readAsArrayBuffer(file);
			})
		}

		// ログインが実行された場合
		this.loginMenu.on(LoginMenu.EVENT_LOGIN, async()=>{
			const selected = this.radio.getSelected();
			let newContent = null;
			if(selected === "redis_content"){
				newContent = false;
				console.log(this.store.getSelectedContent())
				if(!this.store.getSelectedContent()){
					this.store.emit(Store.EVENT_ERROR_MESSAGE,new Error("no contents"));
					return;
				}	
			}else if(selected === "upload"){
				newContent = true;
				const result = await upload();
				if(result === "UPLOAD_FAILED"){
					return;
				}
			}else{
				return;
			}

			let userSelect = this.loginMenu.getUserSelect();
			// ログイン実行
			this.action.login({
				id: "APIUser",
				password: this.loginMenu.getPassword(),
				newContent:newContent
			});
			return;
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
		const metaData = this.store.getMetaData();
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
		this.contentID.innerText = metaData.id;
        propInner.appendChild(this.contentID);

        // ベースコンテンツタイトル
        let contentTitle = document.createElement('p');
        contentTitle.className = "title";
        contentTitle.innerHTML = i18next.t('base_content');
        propInner.appendChild(contentTitle);

        // ベースコンテンツ名
        let contentName = document.createElement('p');
        contentName.className = "property_text";
        contentName.innerHTML = metaData.url;
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
			this.guiProperty.initFromProps(this.store.getMetaData());
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
					size: getCanvasSize()
				});
			}, 200);
		};
	}

    addUserContentSelect(metaData) {
        this.itownSelect.addOption(JSON.stringify({
            type: "user",
            url: metaData.url,
            meta: metaData
        }), "ContentID:" + metaData.id);
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
		console.log(this.store.getSelectedContent())
		this.iframe.src = this.store.getSelectedContent().url;
		console.log(this.store.getSelectedContent().url)
		this.iframe.style.width = "100%";
		this.iframe.style.height = "100%";
		this.iframe.style.border = "none";
		this.iframe.style.backgroundColor = "white";

		this.iframe.onload = () => {
			this.iframe.contentWindow.focus();

			this.iframe.contentWindow.onmousedown = () => {
				this.iframe.contentWindow.focus();
			};
			this.iframe.contentWindow.Q3D.application.controls.addEventListener("change",()=>{
				const params = {
					mat:JSON.stringify(this.iframe.contentWindow.Q3D.application.camera.matrixWorld.elements),
					params:"nodata"
				}
				this.action.updateMetaDataCamera({
					mat: params.mat,
					params: params.params
				});
			});

			this.action.connectIFrame(this.iframe);
		};
		document.getElementById('qgis').appendChild(this.iframe);
	}
}

export default GUI;