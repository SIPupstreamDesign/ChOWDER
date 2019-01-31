/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
import Action from '../action'
import Connector from '../../common/ws_connector.js';
import Constants from '../../common/constants'
import DisplayUtil from '../display_util';
import Vscreen from '../../common/vscreen';
import Validator from '../../common/validator';
import VscreenUtil  from '../../common/vscreen_util';

"use strict";

const random_id_for_webrtc = DisplayUtil.generateID();
const reconnectTimeout = 2000;

class Store extends EventEmitter
{
	constructor(action)
	{
		super();
		this.action = action;

        this.authority = null;
        this.windowData = null;
        this.metaDataDict = {};
        this.groupDict = {};
        this.webRTCDict = {};
        
        this.initEvents();

        //this.reciever = new Receiver(Connector, store, action);
            
        this.onGetWindowData = this.onGetWindowData.bind(this);
        this.onGetMetaData = this.onGetMetaData.bind(this);
        this.onRegisterWindow = this.onRegisterWindow.bind(this);
        this.onUpdateWindowMetaData = this.onUpdateWindowMetaData.bind(this);
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
        let isDisconnect = false;
        let client = Connector.connect(() => {
                this.emit(Store.EVENT_CONNECT_SUCCESS, null);
            }, (() => {
                return (ev) => {
                    this.emit(Store.EVENT_CONNECT_FAILED, null);

                    if (!isDisconnect) {
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
        Connector.send('Login', data, (err, reply) => {
            this.authority = reply.authority;
            this.emit(Store.EVENT_LOGIN_SUCCESS, null);
        });
    }

    _logout(data) {
		this.authority = null;
		Connector.send('Logout', {}, function () {
		});
    }

    updateGroupDict(groupList) {
        for (let i = 0; i < groupList.length; ++i) {
            this.groupDict[groupList[i].id] = groupList[i];
        }
    }

    _update(data) {
        let updateType = data.updateType;
        let targetID = data.targetID;

        if (updateType === 'all') {
            // console.log("update all");
            Connector.send('GetWindowMetaData', { id: this.getWindowID() }, (err, json) => {
                this.onGetWindowData(err, json);
                Connector.send('GetMetaData', { type: 'all', id: '' }, this.onGetMetaData);
            });
            Connector.send('GetGroupList', {}, (err, data) => {
                if (!err && data.hasOwnProperty("grouplist")) {
                    this.updateGroupDict(data.grouplist);
                }
            });
        } else if (updateType === 'window') {
            if (this.getWindowData() !== null) {
                // console.log("update winodow", this.getWindowData());
                Connector.send('GetWindowMetaData', { id : this.getWindowData().id }, this.onGetWindowData);
            }
        } else if (updateType === 'group') {
            Connector.send('GetGroupList', {}, (err, data) => {
                if (!err && data.hasOwnProperty("grouplist")) {
                    this.updateGroupDict(data.grouplist);
                }
            });
        } else {
            // console.log("update transform");
            if (targetID) {
                Connector.send('GetMetaData', { type: '', id: targetID}, this.onGetMetaData);
            } else {
                Connector.send('GetMetaData', { type: 'all', id: ''}, this.onGetMetaData);
            }
        }
    }

    _changeDisplayID(data) {
        let newId = data.id.replace(' ', '_');
        let metaData = this.getWindowData();
        let params = {id : newId};
        params.posx = metaData.posx;
        params.posy = metaData.posy;
        params.scale = parseFloat(metaData.orgWidth) / parseFloat(metaData.width);
    
        Connector.send('GetWindowMetaData', {id : newId}, (err, metaData) => {
            if (!err && metaData) {
                // 既にnewIdのdisplayが登録されていた場合は、そちらの位置サイズに合わせる
                params.posx = metaData.posx;
                params.posy = metaData.posy;
                params.scale = parseFloat(metaData.orgWidth) / parseFloat(metaData.width);
            }
            this._changeQueryParam(params);
            location.reload();
        });
        this.emit(Store.EVENT_DISPLAY_ID_CHANGED, null);
    }

    _resizeWindow(data) {
        let wh = data.size;
        let cx = wh.width / 2.0;
        let cy = wh.height / 2.0;
        let metaData = this.getWindowData();
        if (!metaData) { return; }
        metaData.width = metaData.width * (wh.width / parseFloat(metaData.orgWidth));
        metaData.height = metaData.height * (wh.height / parseFloat(metaData.orgHeight));
        metaData.orgWidth = wh.width;
        metaData.orgHeight = wh.height;
        Vscreen.assignWhole(wh.width, wh.height, cx, cy, 1.0);
        Connector.send('UpdateWindowMetaData', [metaData], this.onUpdateWindowMetaData);
    }

    _deleteAllElements(data) {
        let metaDataDict = this.getMetaDataDict();
        let idList = [];
        for (let id in metaDataDict) {
            idList.push(id);
            delete metaDataDict[id];
        }
        this.emit(Store.EVENT_DONE_DELETE_ALL_ELEMENTS, null, idList);
    }
    
    _changeQueryParam(data) {
        let query = this.mapToQueryString(data);
        history.replaceState(null, '', location.href.match(/^[^?]+/)[0] + query);
    }
    
    _registerWindow(data) {
        let wh = data.size;
        Vscreen.assignWhole(wh.width, wh.height, wh.width / 2.0, wh.height / 2.0, 1.0);
        let windowID = '';
        {
            let hash = location.hash.substring(1);
            if (hash !== '') {
                windowID = decodeURIComponent(hash);
            }
        }

        let query = this.getQueryParams(location.search) || {};
        windowID = query.id ? decodeURIComponent(query.id) : windowID;
        let groupId = undefined;

        let f = () => {
            if (windowID !== '') {
                Connector.send('GetWindowMetaData', {id : windowID}, (err, metaData) => {
                    if (!err && metaData) {
                        let scale = parseFloat(query.scale) || parseFloat(metaData.orgWidth) / parseFloat(metaData.width);
                        metaData.group = groupId || metaData.group,
                        metaData.width = wh.width / scale;
                        metaData.height = wh.height / scale;
                        metaData.orgWidth = wh.width;
                        metaData.orgHeight = wh.height;
                        metaData.posx = query.posx || metaData.posx;
                        metaData.posy = query.posy || metaData.posy;
                        Connector.send('AddWindowMetaData', metaData, this.onRegisterWindow);
                    } else {
                        let scale = parseFloat(query.scale) || 1.0;
                        Connector.send('AddWindowMetaData', {
                            id: windowID,
                            group: groupId,
                            posx: query.posx || 0,
                            posy: query.posy || 0,
                            width: wh.width / scale,
                            height: wh.height / scale,
                            orgWidth: wh.width,
                            orgHeight: wh.height,
                            visible: true
                        }, this.onRegisterWindow);
                    }
                });
            } else {
                let scale = parseFloat(query.scale) || 1.0;
                Connector.send('AddWindowMetaData', {
                    group: groupId,
                    posx: query.posx || 0,
                    posy: query.posy || 0,
                    width: wh.width / scale,
                    height: wh.height / scale,
                    orgWidth: wh.width,
                    orgHeight: wh.height,
                    visible: true
                }, this.onRegisterWindow);
            }
        };

        let groupName = decodeURIComponent(query.group || '');
        if (groupName) {
            Connector.send('GetGroupList', {}, (err, data) => {
                for (let i = 0; i < data.displaygrouplist.length; i ++) {
                    if (data.displaygrouplist[i].name === groupName) {
                        groupId = data.displaygrouplist[i].id;
                    }
                }
                f();
            });
        } else {
            f();
        }
    }

	/**
	 * コンテンツのZインデックスを一番手前にする
	 */
	_changeContentIndexToFront(data) {
        let targetid = data.targetID;
        let max = 0;
        let metaDataDict = this.getMetaDataDict();
        if (metaDataDict.hasOwnProperty(targetid)) {
            let metaData = metaDataDict[targetid];
            for (let i in metaDataDict) {
                if (metaDataDict.hasOwnProperty(i)) {
                    if (metaDataDict[i].id !== metaData.id && 
                        !Validator.isWindowType(metaDataDict[i]) &&
                        metaDataDict[i].hasOwnProperty("zIndex")) {
                        let index = parseInt(metaDataDict[i].zIndex, 10);
                        if (!isNaN(index)) {
                            max = Math.max(max, parseInt(metaDataDict[i].zIndex, 10));
                        }
                    }
                }
            }
            metaData.zIndex = max + 1;
            Connector.send('UpdateMetaData', [metaData], function (err, reply) {});
        }
	}

	/**
	 * コンテンツのTransformを変更
	 * @param {*} data 
	 */
	_changeContentTransform(data) {
        let targetid = data.targetID;
        let x = data.x;
        let y = data.y;
        let metaDataDict = this.getMetaDataDict();
        if (metaDataDict.hasOwnProperty(targetid)) {
            let metaData = metaDataDict[targetid];
            metaData.posx = x;
            metaData.posy = y;
            
            VscreenUtil.transPosInv(metaData);
            metaData.posx -= Vscreen.getWhole().x;
            metaData.posy -= Vscreen.getWhole().y;
            
            Connector.send('UpdateMetaData', [metaData], function (err, reply) {
            });
        }
    }
    
    onGetWindowData(err, json) {
        if (!err && json) {
            this.metaDataDict[json.id] = json;
            this.windowData = json;
            this.emit(Store.EVENT_DONE_GET_WINDOW_METADATA, null, json);
        } else {
            this._logout();
        }
    }

    onGetMetaData(err, json) {
        this.emit(Store.EVENT_DONE_GET_METADATA, null, json);
    }

    onRegisterWindow(err, json) {
        if (!err) {
            for (let i = 0; i < json.length; i = i + 1) {
                this.metaDataDict[json[i].id] = json[i];
                this.windowData = json[i];
            }
        }
        this.emit(Store.EVENT_DONE_REGISTER_WINDOW, err, json)
    }

    onUpdateWindowMetaData(err, json) {
        if (!err) {
            for (let i = 0; i < json.length; i = i + 1) {
                this.metaDataDict[json[i].id] = json[i];
                this.windowData = json[i];
            }
        }
        this.emit(Store.EVENT_DONE_UPDATE_WINDOW_METADATA, err, json)
    }

    /**
     * window idの取得.
     * @method getWindowID
     */
    getWindowID() {
        return this.getQueryParams().id;
    }
    
    /**
     * Parse `location.search` and return it as object.
     * @returns {Object} result
     */
    getQueryParams() {
        let re = /[?&]([^=]+)=([^&]*)/g;
        let ret = {};
        let match;
        while ((match = re.exec(location.search)) !== null) { // while `re` is not depleted
            ret[match[1]] = decodeURIComponent(match[2]);
        }
        return ret;
    }
    
    /**
     * Convert map into query params string.
     * @param {Object} map Map of parameters you want to convert into
     * @return {string} result
     */
    mapToQueryString(map) {
        let str = '?';
        for (let key in map) {
            if (map[key] !== undefined) {
                str += key + '=' + map[key] + '&';
            }
        }
        str = str.substring( 0, str.length - 1 ); // remove the last '&'
    
        return str;
    }

    setWindowData(windowData) {
        this.windowData = windowData;
    }

    getWindowData() {
        return this.windowData;
    }

    getAuthority() {
        return this.authority;
    }

    setAuthority(authority) {
        this.authority = authority;
    }

	/**
	 * メタデータごとにfuncを実行
	 * @param {*} func 
	 */
	for_each_metadata(func) {
		let i;
		for (i in this.metaDataDict) {
			if (this.metaDataDict.hasOwnProperty(i)) {
				if (func(i, this.metaDataDict[i]) === true) {
					break;
				}
			}
		}
	}

    getMetaDataDict() {
        return this.metaDataDict;
    }
    
    getGroupDict() {
        return this.groupDict;
    }

    getWebRTCDict() {
        return this.webRTCDict;
    }
    
    /**
     * 閲覧情報があるか返す
     */ 
    isViewable(group) {
        if (!this.getAuthority()) {
            return false;
        }
        if (group === undefined || group === "") {
            return true;
        }
        if (group === Constants.DefaultGroup) {
            return true;
        }
        let groupDict = this.getGroupDict();
        if (groupDict.hasOwnProperty(group)) {
            if (this.getAuthority().viewable === "all") {
                return true;
            }
            if (this.getAuthority().viewable.indexOf(group) >= 0) {
                return true;
            }
        }
        return false;
    }

    // このページのwebRTC用のキーを取得.
    // ディスプレイIDが同じでもページごとに異なるキーとなる.
    // (ページをリロードするたびに代わる)
    getRTCKey(metaData) {
        return metaData.id + "_" + this.getWindowData().id + "_" + random_id_for_webrtc;
    }
}

Store.EVENT_DISCONNECTED = "disconnected";
Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_CONNECT_FAILED = "connect_failed";
Store.EVENT_LOGIN_SUCCESS = "login_success";
Store.EVENT_DISPLAY_ID_CHANGED = "display_id_changed";
Store.EVENT_DONE_UPDATE_WINDOW_METADATA = "done_update_window_metadata";
Store.EVENT_DONE_DELETE_ALL_ELEMENTS = "done_delete_all_elements";
Store.EVENT_DONE_REGISTER_WINDOW = "done_register_window";
Store.EVENT_DONE_GET_WINDOW_METADATA= "done_get_window_metadata";
Store.EVENT_DONE_GET_METADATA= "done_get_metadata";
Store.EVENT_CONTENT_INDEX_CHANGED = "content_index_changed";
Store.EVENT_CONTENT_TRANSFORM_CHANGED = "content_transform_changed";

export default Store;