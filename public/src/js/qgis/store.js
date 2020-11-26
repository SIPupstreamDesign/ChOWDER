/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import Action from './action'
import Constants from '../common/constants'
import Command from '../common/command';
import Connector from '../common/ws_connector.js';
import Operation from './operation'
import IFrameConnector from '../common/iframe_connector';

const reconnectTimeout = 2000;

class Store extends EventEmitter {
	constructor(action) {
		super();
		this.action = action;
		this.operation = new Operation(Connector, this); // 各種storeからのみ限定的に使う
		this.isInitialized_ = false;

		// 1ウィンドウ1webglコンテンツなのでメタデータは1つ
        this.metaData = null;
        
        // カメラリセット時に使うカメラ行列
        this.initCameraMatrix = null;

        this.selectedContent = null;

        this.newContent = null;

        // websocket接続が確立された.
        // ログインする.
        this.on(Store.EVENT_CONNECT_SUCCESS, (err) => {
            console.log("websocket connected")
            //let loginOption = { id: "APIUser", password: "" }
            //this.action.login(loginOption);
            this._fetchContents();
        });
        
        // コンテンツ追加完了した.
        this.on(Store.EVENT_DONE_ADD_CONTENT, (err, reply) => {
            let isInitialContent = (!this.metaData);

            this.metaData = reply;
            if (isInitialContent) {
                // 初回追加だった
                // カメラ更新
                if (this.initialMatrix) {
                    this._updateCamera({
                        mat: this.initialMatrix,
                        params: this.initialCameraParams,
                    })
                }
            }
        });

        /// メタデータが更新された
        Connector.on(Command.UpdateMetaData, (data) => {
            let hasUpdateData = false;
            for (let i = 0; i < data.length; ++i) {
                let metaData = data[i];
                if (metaData.type === Constants.TypeWebGL && this.metaData && metaData.id === this.metaData.id) {
                    this.metaData = metaData;
                    hasUpdateData = true;
                    break;
                }
            }

            // if (hasUpdateData) {
            //     this.__changeLayerProeprty();
            // }
        });


		this.initEvents();
	}

	release() { }

	emit() {
		if (arguments.length > 0) {
			if (!arguments[0]) {
				console.error("Not found EVENT NAME!")
			}
		}
		super.emit(...arguments);
	}

	initEvents() {
		for (let i in Action) {
			if (i.indexOf('EVENT') >= 0) {
				this.action.on(Action[i], ((method) => {
					return (err, data) => {
						if (this[method]) {
							this[method](data);
						}
					};
				})('_' + Action[i]));
			}
		}
	};

	_connect() {
		this.isDisconnect = false;
		let client = Connector.connect(() => {
			if (!this.isInitialized_) {
				//this.initOtherStores(() => {
				this.emit(Store.EVENT_CONNECT_SUCCESS, null);
				//});
			} else {
				this.emit(Store.EVENT_CONNECT_SUCCESS, null);
			}
		}, (() => {
			return (ev) => {
				this.emit(Store.EVENT_CONNECT_FAILED, null);

				if (!this.isDisconnect) {
					setTimeout(() => {
						this._connect();
					}, reconnectTimeout);
				}
			};
		})());

		Connector.on("Disconnect", ((client) => {
			return () => {
				isDisconnect = true;
				client.close();
				this.emit(Store.EVENT_DISCONNECTED, null);
			};
		})(client));
	}

	_login(data) {
        this.newContent = data.newContent;
		Connector.send(Command.Login, data, (err, reply) => {
			if (err || reply === null) {
				console.log(err);
				this.emit(Store.EVENT_LOGIN_FAILED, err, data);
			} else {
				// console.log("loginSuccess", reply);
				this.authority = reply.authority;
				this.emit(Store.EVENT_LOGIN_SUCCESS, null);
			}
		});
	}

    _logout(data) {
        this.authority = null;
        Connector.send(Command.Logout, {}, function () {
        });
	}

    _upload(data) {
        console.log(data);
        data.metaData.filename
        if(!data.metaData.filename.match(/.zip$/)){
            console.log("not zip file");
            this.emit(Store.EVENT_ERROR_MESSAGE,new Error("Only zip file can be uploaded."));
            return;
        }

        const JSONRPC_param = {
            filename : data.metaData.filename,
            type : "qgis2three.js"
        };

        Connector.sendBinary(Command.Upload, JSONRPC_param, data.binary, (err, reply) => {
            if (err || reply === null) {
                console.log(err);
                this.emit(Store.EVENT_UPLOAD_FAILED, err);
                this.emit(Store.EVENT_ERROR_MESSAGE,err);
            } else {
                console.log("uploadSuccess", reply);
                const uploadedContent = {
                    url:reply.dirname
                };
                this.selectedContent = uploadedContent;
                // this.authority = reply.authority;
                this.emit(Store.EVENT_UPLOAD_SUCCESS, null, reply);
            }
        });
    }
    
    // サーバから現在登録されているwebglコンテンツのメタデータを取得してくる
    _fetchContents(data) {
        let metaDataDict = {}; // id, metaData
        Connector.send(Command.GetMetaData, { type: "all", id: '' }, (err, metaData) => {
            if (!err && metaData && metaData.type === Constants.TypeWebGL && metaData.webglType === "qgis2three.js") {
                if (!metaDataDict.hasOwnProperty(metaData.id)) {
                    metaDataDict[metaData.id] = metaData;
                    this.emit(Store.EVENT_DONE_FETCH_CONTENTS, null, metaData);
                }
            }
        });
    }
    
    
	_connectIFrame(data) {
        let iframe = data;
        this.iframeConnector = new IFrameConnector(iframe);
        this.iframeConnector.connect(() => {
            this.emit(Store.EVENT_DONE_IFRAME_CONNECT, null, this.iframeConnector);
        });
    }

    _addContent(data) {
		console.log("[store]addContent");
        let metaData = data.metaData;
        let contentData = data.contentData;
        this.operation.addContent(metaData, contentData);
    }

    _resizeWindow(data) {
        let wh = data.size;
        let cx = wh.width / 2.0;
        let cy = wh.height / 2.0;
        let metaData = this.metaData;
        if (!metaData) { return; }
        metaData.width = metaData.width * (wh.width / parseFloat(metaData.orgWidth));
        metaData.height = metaData.height * (wh.height / parseFloat(metaData.orgHeight));
        metaData.orgWidth = wh.width;
        metaData.orgHeight = wh.height;
        this.operation.updateMetadata(metaData, (err, res) => {
        });
    }

    
    /**
     * カメラメタデータの更新
     * UI操作などで既にqgisアプリの絵は更新されているので、メタデータだけを更新する
     */
    _updateMetaDataCamera(data) {
        if (this.metaData) {
            this.metaData.cameraWorldMatrix = data.mat;
            this.metaData.cameraParams = data.params;
			let updateData = JSON.parse(JSON.stringify(this.metaData));

            // 幅高さは更新しない
            delete updateData.width;
            delete updateData.height;
            this.operation.updateMetadata(updateData, (err, res) => {
            });
        } else {
            // コンテンツ追加完了前だった。完了後にカメラを更新するため、matrixをキャッシュしておく。
            this.initialMatrix = data.mat;
            this.initialCameraParams = data.params;
        }
    }

    getIFrameDOM(){
        const qgis = document.getElementById("qgis");
		if(!qgis){
			return null;
		}
		// console.log("[store:_updateQgisMetadata]",dom,metaData.id);
        const iframe = qgis.childNodes[0];
		if(!iframe || !iframe.contentWindow || !iframe.contentWindow.Q3D){
			//iframe読み込みがまだ終わっていない
			return null;
        }
        return iframe;
    }

	/**
	 * カメラの更新
	 * qgisアプリの絵の更新と、メタデータの更新を行う
	 */
    _updateRenderCamera(data){
        const iframe = this.getIFrameDOM();
        if(!iframe){
            return;
        }

        iframe.contentWindow.Q3D.application.camera.matrixAutoUpdate = false;
        iframe.contentWindow.Q3D.application.camera.matrixWorld.elements = JSON.parse(data.mat);
        let d = new iframe.contentWindow.THREE.Vector3();
        let q = new iframe.contentWindow.THREE.Quaternion();
        let s = new iframe.contentWindow.THREE.Vector3();
        iframe.contentWindow.Q3D.application.camera.matrixWorld.decompose(d,q,s);
        iframe.contentWindow.Q3D.application.camera.position.copy( d );
        iframe.contentWindow.Q3D.application.camera.quaternion.copy( q );
        iframe.contentWindow.Q3D.application.camera.scale.copy( s );
        iframe.contentWindow.Q3D.application.camera.matrixAutoUpdate = true;
        iframe.contentWindow.Q3D.application.scene.requestRender();
        
        this._updateMetaDataCamera(data);
    }

    _changeProperty(data){
        if (this.metaData) {

            let displayProperty = JSON.parse(this.metaData.displayProperty);
            if(data.hasOwnProperty("label")){
                displayProperty.label = data.label;
            }
            if(data.hasOwnProperty("wireframe")){
                displayProperty.wireframe = data.wireframe;
            }

            // this.iframe.contentWindow.Q3D.application.setLabelVisible(displayProperty.label);
            // this.iframe.contentWindow.Q3D.application.setWireframeMode(displayProperty.wireframe);

            this.metaData.displayProperty = JSON.stringify(displayProperty);


            let updateData = JSON.parse(JSON.stringify(this.metaData));

            // 幅高さは更新しない
            delete updateData.width;
            delete updateData.height;

            this.operation.updateMetadata(updateData, (err, res) => {
                this.emit(Store.EVENT_DONE_CHANGE_PROPERTY, null, displayProperty);
            });
        }else{

        }

    }

    _updateSelectedContent(data){
        const selectedValue = JSON.parse(data);
        this.metaData = selectedValue.meta;
        this.selectedContent = selectedValue;
    }

    getMetaData(){
        return this.metaData;
    }

    getSelectedContent() {
        if(!this.selectedContent){
            return null;
        }
        return this.selectedContent;
    }

    getNewContent(){
        return this.newContent;
    }
}

Store.EVENT_DISCONNECTED = "disconnected";
Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_CONNECT_FAILED = "connect_failed";
Store.EVENT_LOGIN_SUCCESS = "login_success";
Store.EVENT_LOGIN_FAILED = "login_failed";
Store.EVENT_DONE_IFRAME_CONNECT = "done_iframe_connect"
Store.EVENT_DONE_ADD_CONTENT = "done_add_content";
Store.EVENT_UPLOAD_FAILED = "upload_failed";
Store.EVENT_UPLOAD_SUCCESS = "upload_success";
Store.EVENT_DONE_UPDATE_METADATA = "done_update_metadata";
Store.EVENT_DONE_CHANGE_PROPERTY = "done_change_property";
Store.EVENT_DONE_FETCH_CONTENTS = "done_fetch_contents";
Store.EVENT_ERROR_MESSAGE = "error_message";

export default Store;