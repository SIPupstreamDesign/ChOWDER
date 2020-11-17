/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

(() => {
    "use strict";

    const fs = require('fs');
    const path = require('path');
    const nodeZip = require("node-zip");

    let phantom = null;
    try {
        phantom = require('phantom');
    } catch (e) {
        console.log("not found phantom");
    }
    const redis = require("redis");

    const image_size = require('image-size');
    let Thumbnail = { 
        create : (meta, binary, func) => { func(null, null, null); },
        setPreviewWH : () => {}
    }
    try {
        Thumbnail = require('./../thumbnail.js');
    } catch (e) {
        console.log("thumbnail require faild");
    }

    const util = require('./../util.js');

    const userSettingKeys = [
        "viewable",
        "editable",
        "displayEditable",
        "viewableSite",
        "group_manipulatable"
    ];
    const expireTime = 60 * 60 * 24 * 365 * 100; // 100years

    class Executer {
        constructor() {
            this.client = redis.createClient(6379, '127.0.0.1', { 'return_buffers': true });
            this.textClient = redis.createClient(6379, '127.0.0.1', { 'return_buffers': false });


            this.virtualDisplayIDStr = "virtual_display";
            this.metadataPrefix = "metadata:";
            this.metadataBackupPrefix = "metadata_backup:";
            this.metadataHistoryPrefix = "metadata_history:";
            this.contentPrefix = "content:";
            this.contentBackupPrefix = "content_backup:";
            this.contentHistoryPrefix = "content_history:";
            this.contentHistoryDataPrefix = "content_history_data:";
            this.contentThumbnailPrefix = "content_thumbnail:";
            this.contentRefPrefix = "contentref:";
            this.windowContentRefPrefix = "window_contentref:";
            this.windowMetaDataPrefix = "window_metadata:";
            this.windowContentPrefix = "window_content:";
            this.groupListPrefix = "grouplist";
            this.adminListPrefix = "adminlist";
            this.controllerDataPrefix = "controller_data";
            this.globalSettingPrefix = "global_setting";
            this.groupUserPrefix = "group_user";
            this.adminUserPrefix = "admin_user";
            this.frontPrefix = "tiled_server:t:";
            this.uuidPrefix = "invalid:";

            this.socketidToHash = {};
            this.socketidToAccessAuthority = {};
            this.socketidToUserID = {};
            this.socketidToLoginKey = {};
            
            // 拒否設定のDisplayのsocketidのキャッシュ.
            // 拒否設定のDisplayに対するbroadcast防止用.
            // { socketidA : displayIDa,  socketidB : displayIDb, .. }
            // 1つのdisplayIDに対して複数のsocketidがある場合があるので、逆の辞書は作ってはいけない
            this.blockedDisplayCache = {};

            // 拒否を含む全接続済Displayのsocketidのキャッシュ
            // { socketidA : displayIDa,  socketidB : displayIDb, .. }
            // 1つのdisplayIDに対して複数のsocketidがある場合があるので、逆の辞書は作ってはいけない
            this.allDisplayCache = {};

            // タイル追加時に連続して完了通知を呼ばないためのIDキャッシュ
            this.tileFinishCache = {};

            this.client.on('error', (err) => {
                console.log('Error ' + err);
            });
        }

        /**
         * 指定されたURLをレンダリングする
         * @method renderURL
         * @param {String} url URL文字列
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        renderURL(url, endCallback) {
            phantom.create().then(function (instance) { //  Arrow functions such as () => {} are not supported in PhantomJS.
                instance.createPage().then(function (page) {
                    page.property('viewportSize', { width: 1024, height: 600 }).then(function () {
                        page.open(url).then(function (status) {
                            if (status !== 'success') {
                                console.error('renderURL: Page open failed: ' + status);
                                return;
                            }

                            page.evaluate(function () {
                                return { /* eslint-disable */
                                    width: document.body.scrollWidth,
                                    height: document.body.scrollHeight,
                                    deviceScaleFactor: window.devicePixelRatio
                                }; /* eslint-enable */
                            }).then(function (dim) {
                                page.property('viewportSize', { width: dim.width, height: dim.height }).then(() => {
                                    const filename = path.resolve('/tmp', Date.now().toString() + '.png');
                                    page.render(filename).then(function () {
                                        fs.readFile(filename, function (err, data) {
                                            if (err) {
                                                console.error(err);
                                                return;
                                            }
                                            endCallback(data, image_size(data));
                                            instance.exit();
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }

        generateID(prefix, endCallback) {
            const id = util.generateUUID8();
            console.log("newid: " + id);
            this.textClient.exists(prefix + id, (err, doesExist) => {
                if (err) {
                    console.log(err);
                    return;
                }
                if (doesExist === 1) {
                    this.generateID(prefix, endCallback);
                } else if (endCallback) {
                    endCallback(id);
                }
            });
        }

        /**
         * ContentID生成。generateUUID8を用いる。
         * @method generateContentID
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        generateContentID(endCallback) {
            this.generateID(this.contentPrefix, endCallback);
        }

        /**
         * MetaDataID生成
         * @method generateMetaDataID
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        generateMetaDataID(endCallback) {
            this.generateID(this.metadataPrefix, endCallback);
        }

        /**
         * WindowID生成。generateUUID8を用いる。
         * @method generateWindowMetaDataID
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        generateWindowMetaDataID(endCallback) {
            this.generateID(this.windowMetaDataPrefix, endCallback);
        }

        /**
         * WindowID生成。generateUUID8を用いる。
         * @method generateWindowContentID
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        generateWindowContentID(endCallback) {
            this.generateID(this.windowContentPrefix, endCallback);
        }

        getInitialVirtualDisplayData() {
            return {
                orgWidth: 1000,
                orgHeight: 1000,
                splitX: 1,
                splitY: 1,
                scale: 1.0,
                type: "virtual_display"
            };
        }

        /**
         * グループリストの取得. ない場合は空がendcallbackにわたる.
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        getGroupList(endCallback) {
            this.textClient.exists(this.groupListPrefix, (err, doesExists) => {
                if (!err && doesExists !== 0) {
                    this.textClient.get(this.groupListPrefix, (err, reply) => {
                        let data = reply;
                        if (!reply) {
                            data = { "grouplist": [], "displaygrouplist": [] };
                            endCallback(err, data);
                            return;
                        }
                        try {
                            data = JSON.parse(data);
                        } catch (e) {
                            return false;
                        }
                        endCallback(err, data);
                    });
                } else {
                    let data = { "grouplist": [], "displaygrouplist": [] };
                    endCallback(null, data);
                }
            });
        }

        getAdminList(endCallback) {
            this.textClient.exists(this.adminListPrefix, (err, doesExists) => {
                if (!err && doesExists !== 0) {
                    this.textClient.get(this.adminListPrefix, (err, reply) => {
                        let data = reply;
                        if (!reply) {
                            data = { "adminlist": [] };
                            endCallback(err, data);
                            return;
                        }
                        try {
                            data = JSON.parse(data);
                        } catch (e) {
                            return false;
                        }
                        endCallback(err, data);
                    });
                } else {
                    let data = { "adminlist": [] };
                    endCallback(null, data);
                }
            });
        }

        getGroupIndex(groupList, id) {
            let i;
            for (i = 0; i < groupList.length; i = i + 1) {
                if (groupList[i].id === id) {
                    return i;
                }
            }
            return -1;
        }

        getGroupIndexByName(groupList, name) {
            let i;
            if (!groupList) {
                return -1;
            }
            for (i = 0; i < groupList.length; i = i + 1) {
                if (groupList[i].name === name) {
                    return i;
                }
            }
            return -1;
        }

        /**
         * グループリストにgroupを追加
         * @param {String} id グループid. nullの場合自動割り当て.
         * @param {String} groupName グループ名.
         * @param {String} color グループ色.
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        addGroup(socketid, groupID, groupName, color, endCallback) {
            this.getGroupList((err, data) => {
                let index = this.getGroupIndexByName(data.grouplist, groupName);
                if (index >= 0) {
                    if (endCallback) {
                        endCallback("Detect same group name");
                    }
                    return;
                }
                let groupData;
                if (groupID) {
                    groupData = { name: groupName, id: groupID }
                    if (color) { groupData.color = color; }
                    data.grouplist.push(groupData);
                } else {
                    groupData = { name: groupName, id: util.generateUUID8() }
                    if (color) { groupData.color = color; }
                    data.grouplist.push(groupData);
                }
                this.textClient.set(this.groupListPrefix, JSON.stringify(data), () => {
                    this.getGroupID(groupName, (id) => {
                        // グループ設定を追加する.
                        this.changeGroupUserSetting(socketid, id, {
                            viewable: [id],
                            editable: [id],
                            viewableSite: "all",
                            group_manipulatable: false
                        }, (err, reply) => {
                            if (endCallback) {
                                endCallback(err, id);
                            }
                        });
                    })
                });
            });
        }

        /**
         * ディスプレイグループリストにgroupを追加
         * @param {String} id グループid. nullの場合自動割り当て.
         * @param {String} groupName グループ名.
         * @param {String} color グループ色.
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        addDisplayGroup(socketid, groupID, groupName, color, endCallback) {
            this.getGroupList((err, data) => {
                if (!data.displaygrouplist) {
                    data.displaygrouplist = [];
                }
                let index = this.getGroupIndexByName(data.displaygrouplist, groupName);
                if (index >= 0) {
                    if (endCallback) {
                        endCallback("Detect same group name");
                    }
                    return;
                }
                let groupData;
                if (groupID) {
                    groupData = { name: groupName, id: groupID }
                    if (color) { groupData.color = color; }
                    data.displaygrouplist.push(groupData);
                } else {
                    groupData = { name: groupName, id: util.generateUUID8() }
                    if (color) { groupData.color = color; }
                    data.displaygrouplist.push(groupData);
                }
                this.textClient.set(this.groupListPrefix, JSON.stringify(data), () => {
                    this.getGroupID(groupName, (id) => {
                        if (id === "group_default") {
                            if (endCallback) {
                                endCallback(err, id);
                            }
                        } else {
                            // Virtual Displayの追加
                            let vdisplay = this.getInitialVirtualDisplayData();
                            vdisplay.group = id;
                            this.setVirtualDisplay(vdisplay, (data) => {
                                if (endCallback) {
                                    endCallback(err, id);
                                }
                            });
                        }
                    })
                });
            });
        }

        /**
         * 管理者リストにadminを追加
         * @param {String} id 管理id. nullの場合自動割り当て.
         * @param {String} adminName 管理者名.
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        addAdmin(socketid, adminID, adminName, password, endCallback) {
            this.isAdmin(socketid, (err, isAdmin) => {
                if (!err && isAdmin) {
                    this.getAdminList((err, data) => {
                        let i,
                            isSameNameFound = false;
                        for (i = 0; i < data.adminlist.length; i = i + 1) {
                            if (data.adminlist[i].name === adminName) {
                                adminID = data.adminlist[i].id;
                                isSameNameFound = true;
                                this.changeAdminUserSetting(socketid, adminID, {
                                    password: password
                                }, endCallback);
                                return;
                            }
                        }
                        if (!isSameNameFound) {
                            if (adminID) {
                                data.adminlist.push({ name: adminName, id: adminID });
                            } else {
                                data.adminlist.push({ name: adminName, id: util.generateUUID8() });
                            }
                        }
                        this.textClient.set(this.adminListPrefix, JSON.stringify(data), () => {
                            this.changeAdminUserSetting(socketid, adminID, {
                                pre_password: password,
                                password: password
                            }, endCallback);
                        });
                    });
                } else {
                    endCallback("access denied");
                }
            });
        }

        deleteAdmin(socketid, adminName, endCallback) {
            this.isAdmin(socketid, (err, isAdmin) => {
                if (!err && isAdmin) {
                    this.getAdminList((err, data) => {
                        let i;

                        if (!data.hasOwnProperty('adminlist')) {
                            endCallback("not found adminlist");
                            return;
                        }
                        for (i = 0; i < data.adminlist.length; i = i + 1) {
                            if (data.adminlist[i].name === adminName) {
                                let id = data.adminlist[i].id;
                                data.adminlist.splice(i, 1);
                                this.textClient.set(this.adminListPrefix, JSON.stringify(data), endCallback);

                                this.getAdminUserSetting(((adminid) => {
                                    return (err, adminSetting) => {
                                        if (adminSetting && adminSetting.hasOwnProperty(adminid)) {
                                            delete adminSetting[adminid];
                                            this.textClient.set(this.adminUserPrefix, JSON.stringify(adminSetting), (err, reply) => {
                                                this.updateAuthority(adminSetting, null);
                                                if (endCallback) {
                                                    endCallback(err, reply)
                                                }
                                            });
                                        }
                                    };
                                })(id));
                                return;
                            }
                        }
                    });
                }
            });
        }


        /**
         *  コントローラデータを上書き
         * @param {String} controllerID Session ID. nullの場合自動割り当て.
         * @param {String} controllerData コントローラデータ.
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        updateControllerData(controllerID, controllerData, endCallback) {
            this.textClient.set(this.controllerDataPrefix + ":" + controllerID, JSON.stringify(controllerData), (err, data) => {
                if (err) {
                    console.error(err);
                } else if (endCallback) {
                    endCallback("success");
                }
            });
        }

        /**
         * コントローラデータを取得
         * @param {*} controllerID
         * @param {*} endCallback (err, data)の形式. なかったらdataはnullとなる.
         */
        getControllerData(controllerID, endCallback) {
            let parsed = null;
            if (controllerID !== undefined && controllerID.length > 0) {
                this.textClient.get(this.controllerDataPrefix + ":" + controllerID, (err, data) => {
                    if (err) {
                        console.error(err);
                        endCallback(null, null);
                    } else if (endCallback) {
                        try {
                            parsed = JSON.parse(data);
                        } catch (e) {
                        }
                        endCallback(null, parsed);
                    }
                });
            } else {
                endCallback(null, null);
            }
        }

        // コンテンツメタデータ中のグループ名の変更
        changeContentGroupName(socketid, oldID, newID) {
            this.getMetaData(socketid, 'all', null, (err, metaData) => {
                if (err) {
                    return;
                }
                if (metaData && metaData.group === oldID) {
                    this.getGroupID(newID, (id) => {
                        metaData.group = id;
                        this.setMetaData(metaData.type, metaData.id, metaData, (meta) => { });
                    });
                }
            });
        }

        // Windowメタデータ中のディスプレイグループ名の変更
        changeDisplayGroupName(socketid, oldID, newID) {
            this.getWindowMetaData({ type: 'all' },
                (err, metaData) => {
                    if (err) {
                        return;
                    }
                    if (metaData && metaData.group === oldID) {
                        this.getGroupID(newID, (id) => {
                            metaData.group = id;
                            this.textClient.hmset(this.windowMetaDataPrefix + metaData.id, metaData, (meta) => { });
                        });
                    }
                }
            );
        }

        /**
         * グループリストからgroupの削除
         * @param {String} id グループid.
         * @param {String} groupName グループ名.
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        deleteGroup(socketid, id, groupName, endCallback) {
            this.isGroupManipulatable(socketid, id, (isManipulatable) => {
                if (isManipulatable) {
                    this.getGroupList((err, data) => {
                        let index = this.getGroupIndex(data.grouplist, id);
                        if (index >= 0) {
                            data.grouplist.splice(index, 1);
                            this.textClient.set(this.groupListPrefix, JSON.stringify(data), endCallback);

                            this.getGroupUserSetting((err, data) => {
                                if (!err && data) {
                                    if (data.hasOwnProperty(id)) {
                                        delete data[id];
                                        this.textClient.set(this.groupUserPrefix, JSON.stringify(data), ((data) => {
                                            return (err, reply) => {
                                                this.updateAuthority(null, data);
                                            }
                                        })(data));
                                    }
                                }
                            });
                            return true;
                        } else {
                            index = this.getGroupIndex(data.displaygrouplist, id);
                            if (index >= 0) {
                                data.displaygrouplist.splice(index, 1);
                                this.textClient.set(this.groupListPrefix, JSON.stringify(data), endCallback);
                                if (id !== "group_default") {
                                    this.textClient.del(this.virtualDisplayIDStr + ":" + id);
                                }
                                return true;
                            } else {
                                endCallback("not found");
                                return false;
                            }
                        }
                    });
                } else {
                    endCallback("access denied");
                }
            });
        }

        /**
         * グループ更新
         * @param {String} id グループid.
         * @param {String} json グループメタデータ.
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        updateGroup(socketid, id, json, endCallback) {
            this.isGroupManipulatable(socketid, id, (isManipulatable) => {
                if (isManipulatable) {
                    this.getGroupList((err, data) => {
                        let index = this.getGroupIndex(data.grouplist, id);
                        if (index >= 0) {
                            let group = data.grouplist[index];
                            if (group.name !== json.name) {
                                // グループ名が変更された.
                                // 全てのコンテンツのメタデータのグループ名も変更する
                                this.changeContentGroupName(socketid, group.id, json.id);
                            }
                            data.grouplist[index] = json;
                            this.textClient.set(this.groupListPrefix, JSON.stringify(data), () => {
                                endCallback(null, json);
                            });
                            return true;
                        } else {
                            index = this.getGroupIndex(data.displaygrouplist, id);
                            if (index >= 0) {
                                let group = data.displaygrouplist[index];
                                if (group.name !== json.name) {
                                    // グループ名が変更された.
                                    // 全てのコンテンツのメタデータのグループ名も変更する
                                    this.changeDisplayGroupName(socketid, group.id, json.id);
                                }
                                data.displaygrouplist[index] = json;
                                this.textClient.set(this.groupListPrefix, JSON.stringify(data), () => {
                                    endCallback(null, json);
                                });
                                return true;
                            } else {
                                if (endCallback) {
                                    endCallback("Not Found Group:" + id + ":" + groupName);
                                    return false;
                                }
                            }
                        }
                    });
                } else {
                    endCallback("access denied");
                }
            });
        }

        /**
         * グループリストのgroupのインデックスを変更する
         * @param {String} id グループid.
         * @param {Integer} insertIndex 新規に割り当てるインデックス.
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        changeGroupIndex(socketid, id, insertIndex, endCallback) {
            if (id === "group_default") {
                endCallback("default can not allow changing index");
                return;
            }
            this.isGroupManipulatable(socketid, id, (isManipulatable) => {
                if (isManipulatable) {
                    this.getGroupList((err, data) => {
                        let index = this.getGroupIndex(data.grouplist, id),
                            item;
                        if (index >= 0) {
                            item = data.grouplist[index];
                            data.grouplist.splice(index, 1);
                            if (insertIndex > 0 && insertIndex >= index) {
                                insertIndex -= 1;
                            }
                            data.grouplist.splice(insertIndex, 0, item);
                            this.textClient.set(this.groupListPrefix, JSON.stringify(data), endCallback);
                            return true;
                        } else {
                            index = this.getGroupIndex(data.displaygrouplist, id),
                                item;
                            if (index >= 0) {
                                item = data.displaygrouplist[index];
                                data.displaygrouplist.splice(index, 1);
                                if (insertIndex > 0 && insertIndex >= index) {
                                    insertIndex -= 1;
                                }
                                data.displaygrouplist.splice(insertIndex, 0, item);
                                this.textClient.set(this.groupListPrefix, JSON.stringify(data), endCallback);
                                return true;
                            } else {
                                endCallback("not found");
                                return false;
                            }
                        }
                    });
                } else {
                    endCallback("access denied");
                }
            });
        }

        changeUUIDPrefix(socketid, dbname, endCallback) {
            this.isAdmin(socketid, (err, isAdmin) => {
                if (!err && isAdmin) {
                    this.textClient.hget(this.frontPrefix + 'dblist', dbname, (err, reply) => {
                        if (!err) {
                            this.getGlobalSetting((err, setting) => {
                                setting.current_db = reply;
                                this.changeGlobalSetting(socketid, setting, () => {
                                    let id = setting.current_db;
                                    console.log("DB ID:", setting.current_db);
                                    this.uuidPrefix = id + ":";
                                    this.contentPrefix = this.frontPrefix + this.uuidPrefix + "content:";
                                    this.contentRefPrefix = this.frontPrefix + this.uuidPrefix + "contentref:";
                                    this.contentBackupPrefix = this.frontPrefix + this.uuidPrefix + "content_backup:";
                                    this.contentHistoryPrefix = this.frontPrefix + this.uuidPrefix + "content_history:";
                                    this.contentHistoryDataPrefix = this.frontPrefix + this.uuidPrefix + "content_history_data:";
                                    this.contentThumbnailPrefix = this.frontPrefix + this.uuidPrefix + "content_thumbnail:";
                                    this.metadataPrefix = this.frontPrefix + this.uuidPrefix + "metadata:";
                                    this.metadataBackupPrefix = this.frontPrefix + this.uuidPrefix + "metadata_backup:";
                                    this.metadataHistoryPrefix = this.frontPrefix + this.uuidPrefix + "metadata_history:";
                                    this.windowMetaDataPrefix = this.frontPrefix + this.uuidPrefix + "window_metadata:";
                                    this.windowContentPrefix = this.frontPrefix + this.uuidPrefix + "window_content:";
                                    this.windowContentRefPrefix = this.frontPrefix + this.uuidPrefix + "window_contentref:";
                                    this.virtualDisplayIDStr = this.frontPrefix + this.uuidPrefix + "virtual_display";
                                    this.groupListPrefix = this.frontPrefix + this.uuidPrefix + "grouplist";
                                    this.groupUserPrefix = this.frontPrefix + this.uuidPrefix + "group_user"; // グループユーザー設定
                                    endCallback(null);
                                });
                            });
                        } else {
                            endCallback("failed to get dblist");
                        }
                    });
                } else {
                    endCallback("access denied");
                }
            });
        }

        groupInitialSettting() {
            this.textClient.exists(this.groupUserPrefix, (err, doesExists) => {
                if (doesExists !== 1) {
                    // group設定の初期登録
                    this.changeGroupUserSetting("master", "Guest", {
                        viewable: [],
                        editable: [],
                        displayEditable: [],
                        viewableSite: [],
                        group_manipulatable: false
                    }, () => {
                        // Display設定の初期登録
                        this.changeGroupUserSetting("master", "Display", {
                            viewable: "all",
                            editable: "all",
                            displayEditable: "all",
                            viewableSite: "all",
                            group_manipulatable: false
                        }, () => {
                            // APIUser設定の初期登録
                            this.changeGroupUserSetting("master", "APIUser", {
                                viewable: "all",
                                editable: "all",
                                displayEditable: "all",
                                viewableSite: "all",
                                group_manipulatable: false
                            });
                        }, () => {
                            // ElectronDisplay設定の初期登録
                            this.changeGroupUserSetting("master", "ElectronDisplay", {
                                viewable: "all",
                                editable: "all",
                                displayEditable: "all",
                                viewableSite: "all",
                                group_manipulatable: false
                            });
                        });
                    });
                }
                this.addGroup("master", "group_default", "default", null, (err, reply) => {
                    this.addDisplayGroup("master", "group_default", "default", null, (err, reply) => { });
                });
            });
            this.textClient.exists(this.globalSettingPrefix, (err, doesExists) => {
                if (doesExists !== 1) {
                    // global設定の初期登録
                    this.changeGlobalSetting("master", {
                        max_history_num: 10
                    });
                }
            });
            // virtualdisplayの初期設定
            this.textClient.exists(this.virtualDisplayIDStr, (err, doesExists) => {
                if (doesExists !== 1) {
                    this.setVirtualDisplay(this.getInitialVirtualDisplayData());
                }
            });
        }

        /**
         * 新規保存領域の作成
         * @param name 保存領域の名前
         * @param endCallback 終了コールバック
         */
        newDB(socketid, name, endCallback) {
            this.isAdmin(socketid, (err, isAdmin) => {
                if (!err && isAdmin) {
                    if (name.length > 0) {
                        this.textClient.hexists(this.frontPrefix + 'dblist', name, (err, doesExists) => {
                            if (!err && doesExists !== 1) {
                                // 存在しない場合のみ作って切り替え
                                let id = util.generateUUID8();
                                if (name === "default") {
                                    id = "default";
                                }
                                this.textClient.hset(this.frontPrefix + 'dblist', name, id, (err, reply) => {
                                    if (!err) {
                                        this.changeUUIDPrefix(socketid, name, (err, reply) => {
                                            this.groupInitialSettting();
                                            endCallback(err);
                                        });
                                    } else {
                                        endCallback("failed to create new db");
                                    }
                                });
                            } else {
                                endCallback("already exists");
                            }
                        });
                    } else {
                        endCallback("invalid db name");
                    }
                } else {
                    endCallback("Failed newDB - access denied");
                }
            });
        }

        /**
         * 新規保存領域の作成
         * @param name 保存領域の名前
         * @param endCallback 終了コールバック
         */
        renameDB(socketid, name, newName, endCallback) {
            this.isAdmin(socketid, (err, isAdmin) => {
                if (!err && isAdmin) {
                    if (name.length > 0 && newName.length > 0) {
                        if (name === "default" || newName === "default") {
                            endCallback("cannot change default db name");
                            return;
                        }
                        this.textClient.hexists(this.frontPrefix + 'dblist', name, (err, doesExists) => {
                            if (!err && doesExists === 1) {
                                this.textClient.hget(this.frontPrefix + 'dblist', name, (err, reply) => {
                                    if (!err) {
                                        this.textClient.hdel(this.frontPrefix + 'dblist', name);
                                        this.textClient.hset(this.frontPrefix + 'dblist', newName, reply);
                                        endCallback(null, {});
                                    } else {
                                        endCallback("failed to rename db");
                                    }
                                });
                            } else {
                                endCallback("failed to rename db - invalid db name");
                            }
                        });
                    } else {
                        endCallback("failed to rename db - invalid db name");
                    }
                } else {
                    endCallback("Failed renameDB - access denied");
                }
            });
        }

        /**
         * DBの参照先の変更
         * @param name 保存領域の名前
         * @param endCallback 終了コールバック
         */
        changeDB(socketid, name, endCallback) {
            if (name.length > 0) {
                this.textClient.hget(this.frontPrefix + 'dblist', name, (err, reply) => {
                    if (!err) {
                        let id = reply;
                        this.textClient.exists(this.frontPrefix + id + ":grouplist", (err, doesExists) => {
                            if (doesExists !== 1) {
                                // 存在しないdbnameが指定された
                                endCallback("Failed to change db: not exists db name");
                                return;
                            }
                            this.changeUUIDPrefix(socketid, name, endCallback);
                        });
                    } else {
                        // 存在しないdbnameが指定された
                        endCallback("Failed to change db: not exists db name");
                    }
                });
            }
        }

        /**
         * DBの指定したデータ保存領域を削除
         * @param name 保存領域の名前
         * @param endCallback 終了コールバック
         */
        deleteDB(socketid, name, endCallback) {
            if (name.length > 0) {
                this.textClient.hget(this.frontPrefix + 'dblist', name, (err, reply) => {
                    if (!err) {
                        let id = reply;
                        this.textClient.hdel(this.frontPrefix + 'dblist', name);
                        this.textClient.exists(this.frontPrefix + id + ":grouplist", (err, doesExists) => {
                            if (!err && doesExists == 1) {
                                this.textClient.keys(this.frontPrefix + id + "*", (err, replies) => {
                                    let i;
                                    console.log("deletedb : ", name);
                                    if (!err) {
                                        for (i = 0; i < replies.length; i = i + 1) {
                                            console.log("delete : ", replies[i]);
                                            this.textClient.del(replies[i]);
                                        }

                                        if (this.uuidPrefix === (id + ":") && name !== "default") {
                                            // 現在使用中のDBが消去された.
                                            // defaultに戻す.
                                            this.changeDB(socketid, "default", endCallback);
                                        } else {
                                            endCallback(null);
                                        }
                                    } else {
                                        endCallback("Failed deleteDB:" + err)
                                    }
                                });
                            } else {
                                endCallback("Failed deleteDB: not exists db name")
                            }
                        });
                    } else {
                        endCallback("Failed deleteDB: not exists db name")
                    }
                });
            } else {
                endCallback("Failed deleteDB: invalid parameter")
            }
        }

        /**
         * DBの指定したデータ保存領域を初期化
         * @param name 保存領域の名前
         * @param endCallback 終了コールバック
         */
        initDB(socketid, name, endCallback) {
            if (name.length > 0) {
                this.deleteDB(socketid, name, (err, reply) => {
                    if (!err) {
                        this.newDB(socketid, name, (err, reply) => {
                            if (endCallback) {
                                endCallback(err, reply)
                            }
                        });
                    } else {
                        endCallback("Failed initDB");
                    }
                });
            } else {
                endCallback("Failed initDB: invalid parameter");
            }
        }

        /**
         * グローバル設定の変更
         */
        changeGlobalSetting(socketid, json, endCallback) {
            this.isAdmin(socketid, (err, isAdmin) => {
                if (!err && isAdmin) {
                    this.textClient.hmset(this.globalSettingPrefix, json, (err) => {
                        if (err) {
                            console.error(err);
                        } else if (endCallback) {
                            endCallback(json);
                        }
                    });
                } else {
                    endCallback("access denied");
                }
            });
        }

        /**
         * グローバル設定の取得
         */
        getGlobalSetting(endCallback) {
            this.textClient.hgetall(this.globalSettingPrefix, endCallback);
        }

        /**
         * グループユーザー設定情報の取得.
         */
        getGroupUserSetting(endCallback) {
            this.textClient.exists(this.groupUserPrefix, (err, doesExists) => {
                if (!err && doesExists === 1) {
                    this.textClient.get(this.groupUserPrefix, (err, reply) => {
                        let data = reply;
                        if (!reply) {
                            data = {};
                        } else {
                            try {
                                data = JSON.parse(data);
                            } catch (e) {
                                return false;
                            }
                        }
                        endCallback(err, data);
                    });
                } else {
                    endCallback("getGroupUserSetting failed");
                }
            });
        }

        /**
         * グループユーザー設定の変更.
         */
        changeGroupUserSetting(socketid, groupID, setting, endCallback) {
            console.log("changeGroupUserSetting", groupID)
            this.getGroupUserSetting((err, data) => {
                let groupSetting;
                if (!data) {
                    // 新規.
                    data = {};
                }
                if (!data.hasOwnProperty(groupID)) {
                    data[groupID] = {};
                }
                if (setting.hasOwnProperty('password')) {
                    data[groupID].password = util.encrypt(setting.password);
                }
                for (let i = 0; i < userSettingKeys.length; i = i + 1) {
                    let key = userSettingKeys[i];
                    if (setting.hasOwnProperty(key)) {
                        data[groupID][key] = setting[key];
                    }
                }
                this.textClient.set(this.groupUserPrefix, JSON.stringify(data), ((data) => {
                    return (err, reply) => {
                        this.updateAuthority(null, data);
                        if (endCallback) {
                            endCallback(err, data)
                        }
                    };
                })(data));
            });
        }

        /**
         * 管理ユーザー設定情報の取得.
         */
        getAdminUserSetting(endCallback) {
            this.textClient.get(this.adminUserPrefix, (err, reply) => {
                let data = reply;
                if (!reply) {
                    data = "{}";
                }
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    endCallback("getAdminUserSetting failed");
                    return;
                }
                endCallback(err, data);
            });
        }

        /**
         * 管理ユーザー設定の変更.
         */
        changeAdminUserSetting(socketid, id, setting, endCallback) {
            this.getAdminUserSetting((err, data) => {
                if (!err) {
                    if (setting.hasOwnProperty('password')) {
                        let prePass;
                        if (!data.hasOwnProperty(id)) {
                            data[id] = {};
                        }
                        if (data[id].hasOwnProperty('pre_password') && setting.hasOwnProperty('pre_password')) {
                            prePass = util.encrypt(setting.pre_password);
                        } else {
                            // 初回追加時.またはjsonから追加時.
                            let pass = util.encrypt(setting.password);
                            data[id].pre_password = pass;
                            prePass = pass;
                        }
                        if (data[id].pre_password === prePass || socketid === "master") {
                            data[id].password = util.encrypt(setting.password);
                            data[id].pre_password = data[id].password;
                            this.textClient.set(this.adminUserPrefix, JSON.stringify(data), (err, reply) => {
                                this.updateAuthority(data, null);
                                if (endCallback) {
                                    endCallback(err, reply)
                                }
                            });
                            return;
                        } else {
                            if (endCallback) {
                                endCallback("invalid password");
                                return;
                            }
                        }
                    }

                    if (endCallback) {
                        endCallback("invalid admin setting");
                    }
                } else {
                    if (endCallback) {
                        endCallback(err);
                    }
                }
            });
        }

        /**
         * ユーザーリストの取得
         * 全グループ名と、guest, display, 全管理者名が返る.
         */
        getUserList(endCallback) {
            this.getAdminList((err, data) => {
                let i,
                    userList = [];

                // 管理ユーザー
                for (i = 0; i < data.adminlist.length; i = i + 1) {
                    userList.push({ name: data.adminlist[i].name, id: data.adminlist[i].id, type: "admin" });;
                }
                this.getGroupUserSetting((err, setting) => {
                    if (!setting) {
                        endCallback(null, userList);
                        return;
                    }
                    this.getGroupList((err, groupData) => {
                        let isFoundGuest = false;

                        // Guestユーザー
                        let guestUserData = { name: "Guest", id: "Guest", type: "guest" };
                        if (setting.hasOwnProperty("Guest")) {
                            for (let k = 0; k < userSettingKeys.length; k = k + 1) {
                                let key = userSettingKeys[k];
                                if (setting.Guest.hasOwnProperty(key)) {
                                    guestUserData[key] = setting.Guest[key];
                                }
                            }
                        }
                        userList.push(guestUserData);

                        // 通常のグループユーザー
                        if (groupData.hasOwnProperty("grouplist")) {
                            let i,
                                name,
                                userListData,
                                groupSetting,
                                id;
                            for (i = 0; i < groupData.grouplist.length; i = i + 1) {
                                groupSetting = {};
                                name = groupData.grouplist[i].name;
                                id = groupData.grouplist[i].id;
                                // defaultグループは特殊扱いでユーザー無し
                                if (id !== "group_default") {
                                    userListData = { name: name, id: id, type: "group" };
                                    if (setting.hasOwnProperty(id)) {
                                        groupSetting = setting[id];
                                    }
                                    for (let k = 0; k < userSettingKeys.length; k = k + 1) {
                                        let key = userSettingKeys[k];
                                        if (groupSetting.hasOwnProperty(key)) {
                                            userListData[key] = groupSetting[key];
                                        }
                                    }
                                    userList.push(userListData);
                                }
                            }
                        }
                        // Displayユーザー
                        let displayUserData = { name: "Display", id: "Display", type: "display" };
                        if (setting.hasOwnProperty("Display")) {
                            for (let k = 0; k < userSettingKeys.length; k = k + 1) {
                                let key = userSettingKeys[k];
                                if (setting.Display.hasOwnProperty(key)) {
                                    displayUserData[key] = setting.Display[key];
                                }
                            }
                        }
                        userList.push(displayUserData);

                        // APIUser
                        let apiUserData = { name: "APIUser", id: "APIUser", type: "api" };
                        if (setting.hasOwnProperty("APIUser")) {
                            for (let k = 0; k < userSettingKeys.length; k = k + 1) {
                                let key = userSettingKeys[k];
                                if (setting.APIUser.hasOwnProperty(key)) {
                                    apiUserData[key] = setting.APIUser[key];
                                }
                            }
                        }
                        userList.push(apiUserData);

                        // ElectronDisplay
                        let electronDisplayData = { name: "ElectronDisplay", id: "ElectronDisplay", type: "electron" };
                        if (setting.hasOwnProperty("ElectronDisplay")) {
                            for (let k = 0; k < userSettingKeys.length; k = k + 1) {
                                let key = userSettingKeys[k];
                                if (setting.ElectronDisplay.hasOwnProperty(key)) {
                                    electronDisplayData[key] = setting.ElectronDisplay[key];
                                }
                            }
                        }
                        userList.push(electronDisplayData);

                        if (endCallback) {
                            endCallback(null, userList);
                        }
                    });
                });
            });
        }

        generateControllerID(endCallback) {
            this.textClient.keys(this.controllerDataPrefix + "*", (err, replies) => {
                let i;
                let prefix = "user";
                let number = 1;
                let splits;
                let existsIDDict = {};
                for (i = 0; i < replies.length; ++i) {
                    splits = replies[i].split(":");
                    existsIDDict[splits[splits.length - 1]] = i;
                }
                while (existsIDDict.hasOwnProperty(prefix + number)) {
                    number += 1;
                }
                endCallback(null, String(prefix + number));
            });
        }

        validatePassword(master, pass) {
            return master === util.encrypt(pass);
        }

    	/**
         * socketidごとの権限情報キャッシュを全て更新する
         */
        updateAuthority(adminSetting, groupSetting) {
            let i,
                socketid,
                authority;

            for (socketid in this.socketidToAccessAuthority) {
                authority = this.socketidToAccessAuthority[socketid];
                if (this.socketidToUserID.hasOwnProperty(socketid)) {
                    let id = this.socketidToUserID[socketid];
                    if (adminSetting) {
                        if (adminSetting.hasOwnProperty(id)) {
                            authority.id = id;
                            authority.viewable = "all";
                            authority.editable = "all";
                            authority.displayEditable = [];
                            authority.viewableSite = "all";
                            authority.group_manipulatable = true;
                            authority.is_admin = true;
                            this.socketidToAccessAuthority[socketid] = authority;
                        }
                    }
                    if (groupSetting) {
                        if (groupSetting.hasOwnProperty(id)) {
                            authority.id = id;
                            for (let k = 0; k < userSettingKeys.length; k = k + 1) {
                                let key = userSettingKeys[k];
                                if (groupSetting[id].hasOwnProperty(key)) {
                                    authority[key] = groupSetting[id][key];
                                }
                            }
                            this.socketidToAccessAuthority[socketid] = authority;
                        }
                    }
                }
            }
            console.log("-----updateAuthority------")
            //console.log(this.socketidToAccessAuthority)
        }

        /**
         * socketidの権限情報キャッシュを削除する
         */
        removeAuthority(socketid) {
            if (this.socketidToLoginKey.hasOwnProperty(socketid)) {
                socketid = this.socketidToLoginKey[socketid];
                delete this.socketidToLoginKey[socketid];
            }
            if (this.socketidToAccessAuthority.hasOwnProperty(socketid)) {
                delete this.socketidToAccessAuthority[socketid];
            }
            if (this.socketidToUserID.hasOwnProperty(socketid)) {
                delete this.socketidToUserID[socketid];
            }
        }

        /**
         * ログイン情報の一時的な保存. ログイン成功した場合に必ず呼ぶ.
         */
        saveLoginInfo(socketid, id, adminSetting, groupSetting) {
            if (!this.socketidToUserID.hasOwnProperty(socketid)) {
                this.socketidToUserID[socketid] = id;
            }
            if (!this.socketidToAccessAuthority.hasOwnProperty(socketid)) {
                this.socketidToAccessAuthority[socketid] = {};
                // socketidごとの権限情報キャッシュを全て更新する
                this.updateAuthority(adminSetting, groupSetting);
            }
        }


        /**
         * ログインする
         * @method login
         * @param {String} id グループID
         * @param {String} password パスワード
         * @param {String} socketid socketID
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        login(id, password, socketid, controllerid, endCallback) {
            let getLoginResult = (controllerData) => {
                if (this.socketidToAccessAuthority.hasOwnProperty(socketid)) {
                    return {
                        id: id,
                        loginkey: socketid,
                        authority: this.socketidToAccessAuthority[socketid],
                        controllerData: controllerData
                    };
                } else {
                    return {
                        id: id,
                        loginkey: socketid,
                        authority: null,
                        controllerData: controllerData
                    };
                }
            };
            this.getControllerData(controllerid, (err, controllerData) => {
                this.getAdminUserSetting((err, data) => {
                    if (data.hasOwnProperty(id)) {
                        // 管理ユーザー
                        let isValid = this.validatePassword(data[id].password, password);
                        if (isValid) {
                            this.saveLoginInfo(socketid, id, data);
                            // 成功したらsocketidを返す
                            endCallback(null, getLoginResult(controllerData));
                        } else {
                            endCallback("failed to login");
                        }
                    } else {
                        this.getGroupUserSetting((err, setting) => {
                            if (!err) {
                                if (setting.hasOwnProperty(id)) {
                                    // グループユーザー設定登録済グループユーザー
                                    let isValid = this.validatePassword(setting[id].password, password);
                                    if (id === "Guest" || id === "Display") {
                                        isValid = true;
                                    }
                                    if (isValid) {
                                        this.saveLoginInfo(socketid, id, null, setting);
                                        endCallback(null, getLoginResult(controllerData));
                                    } else {
                                        endCallback("failed to login");
                                    }
                                } else {
                                    // グループユーザー設定に登録されていないグループ
                                    endCallback(null, getLoginResult(controllerData));
                                }
                            } else {
                                endCallback("failed to login");
                            }
                        });
                    }
                });
            });
        }

        /**
         * 指定されたタイプ、idのメタデータ設定
         * @method setMetaData
         * @param {String} type メタデータタイプ
         * @param {String} id ContentsID
         * @param {JSON} data メタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        setMetaData(type, id, data, endCallback) {
            let metaData = data;

            //console.log("setMetaData:" + JSON.stringify(data));
            if (!metaData) {
                metaData = {
                    "id": id,
                    "type": type,
                    "posx": "0",
                    "posy": "0",
                    "width": "0",
                    "height": "0"
                };
            }
            if (metaData.type === "window") {
                console.error("invalid matadata.");
                return;
            }
            if (metaData.hasOwnProperty('command')) {
                delete metaData.command;
            }

            this.textClient.hmset(this.metadataPrefix + id, metaData, (err) => {
                if (err) {
                    console.error(err);
                } else if (endCallback) {
                    endCallback(metaData);
                }
            });
        }

        sortBackupList(backupList) {
            backupList.sort((a, b) => {
                return new Date(b) - new Date(a);
            });
            return backupList;
        }

        /**
         * 指定されたタイプ、idのメタデータ取得
         * @method getMetaData
         * @param {String} type メタデータタイプ
         * @param {String} id ContentsID
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        getMetaData(socketid, type, id, endCallback) {
            if (type === 'all') {
                this.textClient.keys(this.metadataPrefix + '*', (err, replies) => {
                    let all_done = replies.length;
                    if (err || replies.length === 0) {
                        if (endCallback) {
                            endCallback("Error not found metadata");
                        }
                        return;
                    }
                    replies.forEach((id, index) => {
                        this.textClient.hgetall(id, (err, data) => {
                            // バックアップデータをチェック
                            this.textClient.exists(this.metadataBackupPrefix + data.id, ((metaData) => {
                                return (err, doesExists) => {
                                    if (!this.isViewable(socketid, data.group)) {
                                        endCallback("access denied", {});
                                        return;
                                    }
                                    if (doesExists) {
                                        // バックアップがあった. バックアップのキーリストをmetadataに追加しておく.
                                        this.textClient.hkeys(this.metadataBackupPrefix + metaData.id, (err, reply) => {
                                            metaData.backup_list = JSON.stringify(this.sortBackupList(reply));
                                            if (endCallback) {
                                                endCallback(null, metaData);
                                            }
                                        });
                                        return;
                                    }
                                    // historyデデータがあった. キーリストをmetadataに追加しておく.
                                    this.textClient.keys(this.metadataHistoryPrefix + metaData.id + ":*", (err, keys) => {
                                        if (keys.length > 0) {
                                            metaData.history_data = {};
                                            keys.forEach((id, index) => {
                                                let splits = id.split(':');
                                                let key = splits[splits.length - 1];
                                                this.textClient.hkeys(id, (err, reply) => {
                                                    metaData.history_data[key] = reply;
                                                    if (index === keys.length - 1) {
                                                        if (endCallback) {
                                                            metaData.history_data = JSON.stringify(metaData.history_data);
                                                            endCallback(null, metaData);
                                                        }
                                                    }
                                                });
                                            });
                                        } else {
                                            if (endCallback) {
                                                endCallback(null, metaData);
                                            }
                                        }
                                    });
                                };
                            })(data));
                        });
                    });
                });
            } else {
                this.textClient.hgetall(this.metadataPrefix + id, (err, data) => {
                    if (data) {
                        // バックアップデータをチェック
                        this.textClient.exists(this.metadataBackupPrefix + data.id, ((metaData) => {
                            return (err, doesExists) => {
                                if (!this.isViewable(socketid, metaData.group)) {
                                    endCallback("access denied", {});
                                    console.log("access denied2")
                                    return;
                                }
                                if (doesExists) {
                                    // バックアップがあった. バックアップのキーリストをmetadataに追加しておく.
                                    this.textClient.hkeys(this.metadataBackupPrefix + metaData.id, (err, reply) => {
                                        metaData.backup_list = JSON.stringify(this.sortBackupList(reply));
                                        if (endCallback) {
                                            endCallback(null, metaData);
                                        }
                                    });
                                    return;
                                }
                                // historyデデータがあった. キーリストをmetadataに追加しておく.
                                this.textClient.keys(this.metadataHistoryPrefix + metaData.id + ":*", (err, keys) => {
                                    if (keys.length > 0) {
                                        metaData.history_data = {};
                                        keys.forEach((id, index) => {
                                            let splits = id.split(':');
                                            let key = splits[splits.length - 1];
                                            this.textClient.hkeys(id, (err, reply) => {
                                                metaData.history_data[key] = reply;
                                                if (index === keys.length - 1) {
                                                    if (endCallback) {
                                                        metaData.history_data = JSON.stringify(metaData.history_data);
                                                        endCallback(null, metaData);
                                                    }
                                                }
                                            });
                                        });
                                    } else {
                                        if (endCallback) {
                                            endCallback(null, metaData);
                                        }
                                    }
                                });
                            };
                        })(data));
                    } else {
                        if (endCallback) {
                            endCallback("Error not found metadata");
                        }
                        return;
                    }
                });
            }
        }

        isInvalidImageSize(metaData) {
            if (!metaData.hasOwnProperty('width') || isNaN(metaData.width)) {
                return true;
            }
            if (!metaData.hasOwnProperty('height') || isNaN(metaData.height)) {
                return true;
            }
            if (metaData.width <= 0 || metaData.height <= 0) {
                return true;
            }
            return false;
        }

        /**
         * 指定されたデータタイプ、idのコンテンツ取得
         * @method getContent
         * @param {String} type データタイプ
         * @param {String} id ContentsID
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        getContent(type, id, endCallback) {
            if (type === 'all') {
                this.client.keys(this.contentPrefix + '*', (err, replies) => {
                    replies.forEach((id, index) => {
                        this.client.type(id, (err, reply) => {
                            if (reply === "set") {
                                this.client.get(id, (err, reply) => {
                                    if (!err) {
                                        if (endCallback) {
                                            endCallback(reply);
                                        }
                                    } else {
                                        console.error(err);
                                    }
                                });
                            }
                        });
                    });
                });
            } else {
                this.client.get(this.contentPrefix + id, (err, reply) => {
                    if (!err) {
                        if (endCallback) {
                            endCallback(reply);
                        }
                    } else {
                        console.error(err);
                    }
                });
            }
        }

        /**
         * 適切なサポート済Mimeを返す
         * @param {*} metaData 
         * @param {*} contentData 
         */
        getMime(metaData, contentData) {
            if (metaData.type === "video") {
                return "video/mp4";
            } else if (metaData.type === 'text' || metaData.type === 'layout') {
                return "text/plain";
            } else if (metaData.type === 'pdf') {
                return "application/pdf";
            } else if (metaData.type === 'image') {
                return util.detectImageType(contentData);
            } else if (metaData.type === 'url') {
                return util.detectImageType(contentData);
            } else if (metaData.type === "tileimage" && contentData instanceof Buffer) {
                return util.detectImageType(contentData);
            } else if (metaData.type === 'webgl') {
                return "application/webgl";
            } else {
                console.error("Error undefined type:" + metaData.type);
                return null;
            }
        }


        /**
         * メタデータをコンテンツバイナリから初期設定する.
         * @method initialMetaDataSetting
         * @param {JSON} metaData contentメタデータ
         * @param {BLOB} contentData バイナリデータ
         */
        initialMetaDataSetting(metaData, contentData) {
            let dimensions;
            if (metaData.hasOwnProperty('orgWidth')) {
                metaData.width = metaData.orgWidth;
            } else if (metaData.hasOwnProperty('width')) {
                metaData.orgWidth = metaData.width;
            }
            if (metaData.hasOwnProperty('orgHeight')) {
                metaData.height = metaData.orgHeight;
            } else if (metaData.hasOwnProperty('height')) {
                metaData.orgHeight = metaData.height;
            }

            const mime = this.getMime(metaData, contentData);
            if (mime) {
                metaData.mime = mime;
            }

            if (metaData.type === 'image') {
                if (this.isInvalidImageSize(metaData)) {
                    dimensions = image_size(contentData);
                    if (!metaData.hasOwnProperty('orgWidth')) {
                        metaData.width = dimensions.width;
                        metaData.orgWidth = metaData.width;
                    }
                    if (!metaData.hasOwnProperty('orgHeight')) {
                        metaData.height = dimensions.height;
                        metaData.orgHeight = metaData.height;
                    }
                }
            }
        }

        initialOrgWidthHeight(metaData, contentData) {
            let dimensions;
            if (metaData.hasOwnProperty('width')) {
                metaData.orgWidth = metaData.width;
            }
            if (metaData.hasOwnProperty('height')) {
                metaData.orgHeight = metaData.height;
            }
            if (metaData.type === "tileimage") {
                // タイルイメージの場合は画像バイナリからサイズを求めない.
                return;
            }
            
            const mime = this.getMime(metaData, contentData);
            if (mime) {
                metaData.mime = mime;
            }

            if (metaData.type === 'image') {
                if (this.isInvalidImageSize(metaData)) {
                    dimensions = image_size(contentData);
                    if (!metaData.hasOwnProperty('orgWidth')) {
                        metaData.orgWidth = dimensions.width;
                    }
                    if (!metaData.hasOwnProperty('orgHeight')) {
                        metaData.orgHeight = dimensions.height;
                    }
                }
            }
        }

        /**
         * メタデータ追加
         * @method addMetaData
         * @param {JSON} metaData contentメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        addMetaData(metaData, endCallback) {
            this.generateMetaDataID((id) => {
                if (metaData.hasOwnProperty('id') && metaData.id !== "") {
                    id = metaData.id;
                }
                metaData.id = id;
                if (metaData.hasOwnProperty('content_id') && metaData.content_id !== "") {
                    this.textClient.exists(this.contentPrefix + metaData.content_id, (err, doesExists) => {
                        if (!err && doesExists === 1) {
                            this.getContent('', metaData.content_id, (contentData) => {
                                // 参照カウント.
                                this.textClient.setnx(this.contentRefPrefix + metaData.content_id, 0);
                                this.textClient.incr(this.contentRefPrefix + metaData.content_id);

                                // メタデータを初回設定.
                                this.initialMetaDataSetting(metaData, contentData);
                                this.setMetaData(metaData.type, id, metaData, (metaData) => {
                                    if (endCallback) {
                                        endCallback(metaData);
                                    }
                                });
                            });
                        } else {
                            this.setMetaData(metaData.type, id, metaData, (metaData) => {
                                if (endCallback) {
                                    endCallback(metaData);
                                }
                            });
                        }
                    });
                } else {
                    this.setMetaData(metaData.type, id, metaData, (metaData) => {
                        if (endCallback) {
                            endCallback(metaData);
                        }
                    });
                }
            });
        }

        /**
         * コンテンツ追加
         * @method addContent
         * @param {JSON} metaData contentメタデータ
         * @param {BLOB} data バイナリデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        addContent(metaData, data, endCallback) {
            let contentData = data;
            
            const mime = this.getMime(metaData, contentData);
            if (mime) {
                metaData.mime = mime;
            }

            console.log("mime:" + metaData.mime);

            this.addMetaData(metaData, (metaData) => {
                this.generateContentID((content_id) => {
                    if (metaData.hasOwnProperty('content_id') && metaData.content_id !== "") {
                        content_id = metaData.content_id;
                    }
                    metaData.content_id = content_id;
                    metaData.date = new Date().toISOString();

                    if (metaData.type === "tileimage") {
                        this.client.set(this.contentPrefix + content_id, "tileimage", (err, reply) => {
                            if (err) {
                                console.error("Error on addContent:" + err);
                            } else {
                                // 参照カウント.
                                this.textClient.setnx(this.contentRefPrefix + content_id, 0);
                                this.textClient.incr(this.contentRefPrefix + content_id);

                                // メタデータを初回設定.
                                this.initialMetaDataSetting(metaData, contentData);
                                this.setMetaData(metaData.type, metaData.id, metaData, (metaData) => {
                                    if (endCallback) {
                                        endCallback(metaData, contentData);
                                    }
                                });
                            }
                        });
                    } else {
                        this.textClient.set(this.contentPrefix + content_id, contentData, (err, reply) => {
                            if (err) {
                                console.error("Error on addContent:" + err);
                            } else {
                                // 参照カウント.
                                this.textClient.setnx(this.contentRefPrefix + content_id, 0);
                                this.textClient.incr(this.contentRefPrefix + content_id);

                                // メタデータを初回設定.
                                this.initialMetaDataSetting(metaData, contentData);
                                this.setMetaData(metaData.type, metaData.id, metaData, (metaData) => {
                                    if (endCallback) {
                                        endCallback(metaData, contentData);
                                    }
                                });
                            }
                        });
                    }
                });
            });
        }

        /**
         * タイルコンテンツ追加
         * @method addContent
         * @param {JSON} metaData contentメタデータ
         * @param {BLOB} data バイナリデータ
         * @param {Number} totalTileCount 合計タイル数
         * @param {Function} endCallback 1回のaddTileContent終了時に呼ばれるコールバック
         * @param {Function} finishCallback 全タイル追加終了時に呼ばれるコールバック
         */
        addTileContent(metaData, data, totalTileCount, endCallback, finishCallback) {
            console.log("addTileContent", metaData.id + ":" + metaData.content_id);
            let contentData = data;
            if (!metaData.hasOwnProperty('history_id')) {
                if (endCallback) {
                    endCallback("Error not found history_id in metadata");
                }
                return;
            }
            let content_id = metaData.content_id;
            let history_id = metaData.history_id;

            let kv = {}
            kv[String(metaData.tile_index)] = contentData;

            this.textClient.hkeys(this.contentHistoryPrefix + content_id, (err, keys) => {
                if (keys.length > 0 && keys.indexOf(history_id) >= 0) {
                    this.client.hmset(this.contentHistoryDataPrefix + history_id, kv, (err, reply) => {
                        if (err) {
                            console.error("Error on addContent:" + err);
                        } else {
                            // history idのkeyをすべて取得
                            this.client.hkeys(this.contentHistoryDataPrefix + history_id, (err, reply) => {
                                if (err) {
                                    console.error("Error on addContent:" + err);
                                } else {
                                    this.client.expire(this.contentHistoryDataPrefix + history_id, expireTime, () => {
                                        let tileCount = 0;
                                        for (let i = 0; i < reply.length; ++i) {
                                            let key = String(reply[i]);
                                            if (key !== "preview" && key !== "thumbnail" && key !== "tile_finished") {
                                                ++tileCount;
                                            }
                                        }
                                        if (totalTileCount >= 0 && tileCount === totalTileCount) {
                                            // 時系列データのある時刻に対する全タイルの登録が終わった.
                                            // 最新のタイルを選択してから
                                            // クライアントサイドに通知を送る
                                            if (finishCallback) {
                                                let kv = { tile_finished: true }
                                                this.client.hmset(this.contentHistoryDataPrefix + history_id, kv, () => {
                                                    if (!this.tileFinishCache.hasOwnProperty(content_id + "_" + history_id))
                                                    {
                                                        this.tileFinishCache[content_id + "_" + history_id] = true;
                                                        finishCallback(err, metaData, contentData);
                                                    }
                                                });
                                            }
                                        }
                                        if (endCallback) {
                                            endCallback(err, metaData);
                                        }
                                    });
                                }
                            });
                        }
                    });
                } else {
                    if (endCallback) {
                        endCallback("Error not found history_id content");
                    }
                    return;
                }
            });
        }

        deleteMetaData(metaData, endCallback) {
            this.textClient.exists(this.metadataPrefix + metaData.id, (err, doesExist) => {
                if (!err && doesExist === 1) {
                    this.textClient.del(this.metadataPrefix + metaData.id, (err) => {
                        console.log("deleteMetadata", metaData.id);
                        if (endCallback) {
                            endCallback(err, metaData);
                        }
                    });
                } else {
                    console.error(err);
                }
            });
        }

        /**
         * 指定されたidのコンテンツ削除
         * @method deleteContent
         * @param {JSON} metaData contentメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        deleteContent(metaData, endCallback) {
            this.deleteMetaData(metaData, (err, metaData) => {
                if (!err) {
                    console.log("deleteContent", metaData.id);
                    if (metaData.hasOwnProperty('content_id') && metaData.content_id !== '') {
                        this.textClient.exists(this.contentPrefix + metaData.content_id, (err, doesExist) => {
                            if (!err && doesExist === 1) {
                                // 参照カウントを減らす.
                                this.textClient.decr(this.contentRefPrefix + metaData.content_id, (err, value) => {
                                    if (value <= 0) {
                                        console.log("reference count zero. delete content");
                                        this.textClient.del(this.contentPrefix + metaData.content_id, (err) => {
                                            if (!err) {
                                                this.textClient.del(this.metadataBackupPrefix + metaData.id);
                                                this.textClient.del(this.contentBackupPrefix + metaData.content_id);
                                                this.textClient.del(this.contentThumbnailPrefix + metaData.content_id);
                                                this.textClient.del(this.contentRefPrefix + metaData.content_id);
                                                this.textClient.hkeys(this.contentHistoryPrefix + metaData.content_id, (err, replies) => {
                                                    replies.forEach((key, index) => {
                                                        let history_id = key.split(":");
                                                        history_id = history_id[history_id.length - 1];
                                                        this.textClient.del(this.contentHistoryDataPrefix + history_id);
                                                        if (index == replies.length - 1) {
                                                            this.textClient.del(this.contentHistoryPrefix + metaData.content_id);
                                                        }
                                                    });
                                                });
                                                this.textClient.keys(this.metadataHistoryPrefix + metaData.id + ':*', (err, replies) => {
                                                    replies.forEach((key, index) => {
                                                        this.textClient.del(key);
                                                    });
                                                });
                                                if (endCallback) {
                                                    endCallback(metaData);
                                                }
                                            } else {
                                                console.error(err);
                                            }
                                        });
                                    } else {
                                        if (endCallback) {
                                            endCallback(metaData);
                                        }
                                    }
                                });
                            }
                        });
                    }
                } else {
                    console.error(err);
                }
            });
        }

        /**
         * 古いバックアップをnum個削除
         */
        removeOldBackup(metaData, num, endCallback) {
            this.textClient.hkeys(this.metadataBackupPrefix + metaData.id, (err, keys) => {
                let i;
                let backupList = this.sortBackupList(keys);
                if (backupList.length > num) {
                    for (i = 0; i < num; i = i + 1) {
                        let last = backupList[backupList.length - i - 1];
                        this.textClient.hdel(this.metadataBackupPrefix + metaData.id, last);
                        this.client.hdel(this.contentBackupPrefix + metaData.content_id, last);
                        console.log("removeOldBackup", last);
                    }
                }
                if (endCallback) {
                    endCallback();
                }
            });
        }

        /**
         * コンテンツとメタデータのバックアップ(元データは移動される)
         */
        backupContent(socketid, metaData, endCallback) {
            let backupFunc = () => {
                let backupMetaData = {};
                backupMetaData[metaData.date] = JSON.stringify(metaData);
                this.client.hmset(this.metadataBackupPrefix + metaData.id, backupMetaData, (err) => {
                    this.getContent(metaData.type, metaData.content_id, (reply) => {
                        if (reply) {
                            let backupContentData = {};
                            backupContentData[metaData.date] = reply;
                            this.client.hmset(this.contentBackupPrefix + metaData.content_id, backupContentData, (err, reply) => {
                                if (endCallback) {
                                    endCallback(err, reply);
                                }
                            });
                        }
                    });
                });
            };
            this.getMetaData(socketid, metaData.type, metaData.id, (err, meta) => {
                if (err) {
                    endCallback(err);
                    return;
                }
                this.getGlobalSetting((err, setting) => {
                    if (!err && setting) {
                        let maxHistorySetting = 0;
                        if (setting.hasOwnProperty('max_history_num')) {
                            maxHistorySetting = setting.max_history_num;
                        }
                        this.client.hlen(this.metadataBackupPrefix + metaData.id, (err, num) => {
                            if (!err) {
                                if (maxHistorySetting !== 0 && num > maxHistorySetting) {
                                    // 履歴保存数を超えたので、古いものを削除
                                    this.removeOldBackup(metaData, num - maxHistorySetting, backupFunc);
                                } else {
                                    backupFunc();
                                }
                            }
                        });
                    } else {
                        endCallback(null);
                    }
                });
            });
        }

        /**
         * 時系列データの保存(元データは移動される)
         */
        storeHistoricalData(socketid, metaData, keyvalue, endCallback) {
            let kvLen = Object.keys(keyvalue).length;
            
            if (!metaData.hasOwnProperty('history_id')) {
                metaData.history_id = util.generateUUID8();
            }

            let historyIDtoID = {};
            historyIDtoID[metaData.history_id] = metaData.id;
            this.textClient.exists(this.contentHistoryPrefix + metaData.content_id, (err, doesExist) => {
                if (err) {
                    console.error("Error:", err)
                    return;
                }
                if (doesExist) {
                    // contentHistoryPrefixに登録済項目が存在する場合は中身に既にhistory_idが無いか調べる
                    this.textClient.hkeys(this.contentHistoryPrefix + metaData.content_id, (err, keys) => {
                        if (keyvalue && kvLen > 0) {
                            if (keys.length <= 0 || (keys.length > 0 && keys.indexOf(metaData.history_id) < 0)) {
                                this.client.hmset(this.contentHistoryPrefix + metaData.content_id, historyIDtoID, (err, reply) => {
                                    let key;
                                    let historyMetaData = {};
                                    let count = 0;
                                        for (key in keyvalue) {
                                            let value = keyvalue[key];
                                            historyMetaData = {};
                                            historyMetaData[value] = JSON.stringify(metaData);
                                            this.client.hmset(this.metadataHistoryPrefix + metaData.id + ":" + key, historyMetaData, (err) => {
                                                ++count;
                                                if (count >= kvLen) {
                                                    if (endCallback) {
                                                        endCallback(err, reply, metaData.history_id);
                                                    }
                                                }
                                            });
                                        }
                                    });
                            } else {
                                endCallback(err, null, metaData.history_id);
                            }
                        } else {
                            endCallback(err, null, metaData.history_id);
                        }
                    });
                } else {
                    // contentHistoryPrefixに登録済項目が存在しなかった
                    this.client.hmset(this.contentHistoryPrefix + metaData.content_id, historyIDtoID, (err, reply) => {
                        let key;
                        let historyMetaData = {};
                        let count = 0;
                        if (keyvalue && kvLen > 0) {
                            for (key in keyvalue) {
                                let value = keyvalue[key];
                                historyMetaData = {};
                                historyMetaData[value] = JSON.stringify(metaData);
                                this.client.hmset(this.metadataHistoryPrefix + metaData.id + ":" + key, historyMetaData, (err) => {
                                    ++count;
                                    if (count >= kvLen) {
                                        if (endCallback) {
                                            endCallback(err, reply, metaData.history_id);
                                        }
                                    }
                                });
                            }
                        } else {
                            endCallback(err, reply, metaData.history_id);
                        }
                    });
                }
            });
        }

        /**
         * コンテンツ更新
         * @method updateContent
         * @param {JSON} metaData メタデータ
         * @param {BLOB} data     バイナリデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        updateContent(socketid, metaData, data, endCallback) {
            let contentData = data;
            console.log("updateContent:" + metaData.id + ":" + metaData.content_id);

            if (metaData.type === 'tileimage') {
                console.error("Error not supported updating:" + metaData.type);
                return;
            }
            const mime = this.getMime(metaData, contentData);
            if (mime) {
                metaData.mime = mime;
            }
            
            this.textClient.exists(this.contentPrefix + metaData.content_id, (err, doesExist) => {
                if (!err && doesExist === 1) {
                    let backupList = [];
                    if (metaData.hasOwnProperty('backup_list')) {
                        try {
                            backupList = JSON.parse(metaData.backup_list);
                        } catch (e) {

                        }
                    }
                    // 復元時に初回復元の場合、バックアップリストに更新前コンテンツと更新後コンテンツを両方格納する.
                    if (backupList.length === 0) {
                        // 更新前コンテンツ
                        // メタデータ初期設定.
                        this.getMetaData(socketid, metaData.type, metaData.id, (err, oldMeta) => {
                            if (err) {
                                endCallback(err);
                                return;
                            }
                            this.backupContent(socketid, oldMeta, (err, reply) => {
                                if (!metaData.hasOwnProperty('orgWidth') || !metaData.hasOwnProperty('orgHeight')) {
                                    this.initialOrgWidthHeight(metaData, contentData);
                                }
                                metaData.date = new Date().toISOString();
                                metaData.restore_index = -1;
                                this.setMetaData(metaData.type, metaData.id, metaData, (meta) => {
                                    this.textClient.set(this.contentPrefix + meta.content_id, contentData, (err, reply) => {
                                        if (err) {
                                            console.error("Error on updateContent:" + err);
                                        } else {
                                            // 更新後コンテンツ
                                            this.backupContent(socketid, meta, (err, reply) => {
                                                if (endCallback) {
                                                    endCallback(meta);
                                                }
                                            });
                                        }
                                    });
                                });
                            });
                        });
                    } else {
                        // 現在のコンテンツより新しいものを削除する.
                        if (Number(metaData.restore_index) > 0 && metaData.hasOwnProperty('backup_list')) {
                            let backupList = this.sortBackupList(JSON.parse(metaData.backup_list));
                            for (let i = 0; i < Number(metaData.restore_index); i = i + 1) {
                                let date = backupList[i];
                                this.textClient.hdel(this.metadataBackupPrefix + metaData.id, date);
                                this.textClient.hdel(this.contentBackupPrefix + metaData.content_id, date);
                            }
                        }

                        // 更新後コンテンツのみバックアップ
                        metaData.date = new Date().toISOString();
                        metaData.restore_index = -1;
                        // メタデータ初期設定.
                        if (!metaData.hasOwnProperty('orgWidth') || !metaData.hasOwnProperty('orgHeight')) {
                            this.initialOrgWidthHeight(metaData, contentData);
                        }
                        this.setMetaData(metaData.type, metaData.id, metaData, (meta) => {
                            this.textClient.set(this.contentPrefix + meta.content_id, contentData, (err, reply) => {
                                if (err) {
                                    console.error("Error on updateContent:" + err);
                                } else {
                                    // 更新後コンテンツ
                                    this.backupContent(socketid, meta, (err, reply) => {
                                        if (endCallback) {
                                            endCallback(meta);
                                        }
                                    });
                                }
                            });
                        });
                    }
                }
            });
        }

        getHistoryID(keyvalue, metaData, callback) {
            // keyvalueの時系列データが既に登録されていないか調査
            this.textClient.keys(this.metadataHistoryPrefix + metaData.id + ":*", (err, oldkeys) => {
                const keys = Object.keys(keyvalue);
                // 登録されている時系列データがあった
                if (keys.length > 0 && oldkeys.length > 0) {
                    let found = false;
                    for (let i = 0; i < keys.length; ++i) {
                        const key = keys[i];
                        if (oldkeys.indexOf(this.metadataHistoryPrefix + metaData.id + ":" + key) >= 0) {
                            found = true;
                            const value = keyvalue[key];
                            this.textClient.keys(this.metadataHistoryPrefix + metaData.id + ":" + key, (err, oldValues) => {
                                if (oldValues.indexOf(value) >= 0) {
                                    // keyvalueの時系列データが既に登録されていた
                                    // keyvalueのメタデータを取得
                                    // history_idを返す
                                    console.log(this.metadataHistoryPrefix + metaData.id + ":" + key, value)
                                    this.textClient.hmget(this.metadataHistoryPrefix + metaData.id + ":" + key, value, (err, reply) => {
                                        let meta = JSON.parse(String(reply));
                                        callback(err, true, meta.history_id);
                                    });
                                } else {
                                    callback(null, false);
                                }
                            });
                        }
                    }
                    if (!found) {
                        callback(null, false);
                    }
                } else {
                    // 登録されている時系列データが無かった. 時系列データなしで登録されている場合がある
                    this.textClient.hkeys(this.contentHistoryPrefix + metaData.content_id, (err, keys) => {
                        if (keys.length > 0) {
                            callback(err, true, keys[0]);
                        } else {
                            callback(err, false);
                        }
                    });
                }
            });
        }

        addHistoricalContentSecond(socketid, metaData, contentData, keyvalue, endCallback) {
            // メタデータ初期設定.
            if (!metaData.hasOwnProperty('orgWidth') || !metaData.hasOwnProperty('orgHeight')) {
                this.initialOrgWidthHeight(metaData, contentData);
            }
            // 追加historyコンテンツ
            this.storeHistoricalData(socketid, metaData, keyvalue, (err, reply, history_id) => {
                if (!err && reply) {
                    Thumbnail.createThumbnail(metaData, contentData, (err, thumbnail) => {
                        let kv = {
                            preview: contentData,
                            tile_finished: false, // 全タイル登録済かどうかのフラグ
                        }
                        if (!err && thumbnail) {
                            kv.thumbnail = thumbnail
                        }
                        this.client.hmset(this.contentHistoryDataPrefix + history_id, kv, (err, reply) => {
                            metaData.history_id = history_id;
                            if (endCallback) {
                                endCallback(err, metaData);
                            }
                        });
                    });
                } else {
                    endCallback(err, metaData);
                }
            });
        }

        /**
         * 時系列データの追加
         * @method addHistoricalContent
         * @param {JSON} metaData メタデータ
         *    content_idとして追加先コンテンツのIDを入れる.
         * @param {BLOB} data  バイナリデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        addHistoricalContent(socketid, metaData, data, endCallback) {
            let contentData = data;
            console.log("addHistoricalContent:" + metaData.id + ":" + metaData.content_id);
            
            const mime = this.getMime(metaData, contentData);
            if (mime) {
                metaData.mime = mime;
            }

            if (!metaData.hasOwnProperty('keyvalue')) {
                console.error("Warn : not found metadata of HistoricalData")
            }
            let keyvalue = {};
            if (metaData.hasOwnProperty('keyvalue')) {
                try {
                    keyvalue = JSON.parse(metaData.keyvalue);
                } catch (e) {
                    console.error("Error : keyvalue parse failed")
                    return false;
                }
            }

            this.textClient.exists(this.contentPrefix + metaData.content_id, (err, doesExist) => {
                if (!err) {
                    if (doesExist <= 0) {
                        // 最初のコンテンツ
                        metaData.history_id = util.generateUUID8();

                        // finishキャッシュを空にする
                        this.tileFinishCache = {};
                        
                        if (!metaData.hasOwnProperty('reductionWidth')) {
                            let dimensions = image_size(contentData);
                            metaData.reductionWidth = dimensions.width;
                            metaData.reductionHeight = dimensions.height;
                        }
                        this.addContent(metaData, contentData, (err, reply) => {
                            metaData.date = new Date().toISOString(); //登録時間を保存
                            // メタデータ初期設定.
                            if (!metaData.hasOwnProperty('orgWidth') || !metaData.hasOwnProperty('orgHeight')) {
                                this.initialOrgWidthHeight(metaData, contentData);
                            }
                            // 追加historyコンテンツ
                            this.storeHistoricalData(socketid, metaData, keyvalue, (err, reply, history_id) => {
                                if (!err && reply) {
                                    Thumbnail.createThumbnail(metaData, contentData, (err, thumbnail) => {
                                        let kv = {
                                            preview: contentData,
                                            tile_finished: false, // 全タイル登録済かどうかのフラグ
                                        }
                                        if (!err && thumbnail) {
                                            kv.thumbnail = thumbnail
                                        }
                                        this.client.hmset(this.contentHistoryDataPrefix + history_id, kv, (err, reply) => {
                                            metaData.history_id = history_id;
                                            if (endCallback) {
                                                endCallback(err, metaData);
                                            }
                                        });
                                    });
                                } else {
                                    endCallback(err, metaData);
                                }
                            });
                        });
                    } else {
                        // keyvalueがすでに登録されていた場合は、history_idを取得して上書きするようにする
                        this.getHistoryID(keyvalue, metaData, (err, isFound, history_id) => {
                            // 2つめ以降追加のコンテンツ
                            metaData.date = new Date().toISOString(); //登録時間を保存
                            if (!metaData.hasOwnProperty('reductionWidth')) {
                                let dimensions = image_size(contentData);
                                metaData.reductionWidth = dimensions.width;
                                metaData.reductionHeight = dimensions.height;
                            }

                            if (!err && isFound) {
                                metaData.history_id = history_id;
                                this.textClient.hkeys(this.contentHistoryPrefix + metaData.content_id, (err, replies) => {
                                    replies.forEach((key, index) => {
                                        let history_id = key.split(":");
                                        history_id = history_id[history_id.length - 1];
                                        this.textClient.del(this.contentHistoryDataPrefix + history_id);
                                        if (index == replies.length - 1) {
                                            this.textClient.del(this.contentHistoryPrefix + metaData.content_id);
                                        }
                                    });
                                    this.setMetaData(metaData.type, metaData.id, metaData, (metaData) => {
                                        this.addHistoricalContentSecond(socketid, metaData, contentData, keyvalue, endCallback);
                                    });
                                });
                            } else {
                                this.addHistoricalContentSecond(socketid, metaData, contentData, keyvalue, endCallback);
                            }
                        });
                    }
                }
            });
        }

        addWindowMetaData(socketid, windowData, endCallback) {
            this.generateWindowMetaDataID((id) => {
                if (windowData.hasOwnProperty('id') && windowData.id !== "") {
                    id = windowData.id;
                }
                windowData.id = id;
                this.socketidToHash[socketid] = id;
                console.log("registerWindow: " + id);
                this.textClient.hexists(this.windowMetaDataPrefix + id, (err, reply) => {
                    if (reply === 1) {
                        windowData.type = "window";
                        this.textClient.hmset(this.windowMetaDataPrefix + id, windowData, ((textClient, id) => {
                            return (err, reply) => {
                                textClient.hgetall(this.windowMetaDataPrefix + id, (err, reply) => {
                                    if (endCallback) {
                                        endCallback(reply);
                                    }
                                });
                            };
                        })(this.textClient, id));
                    } else {
                        if (!windowData.hasOwnProperty('orgWidth')) {
                            windowData.orgWidth = windowData.width;
                        }
                        if (!windowData.hasOwnProperty('orgHeight')) {
                            windowData.orgHeight = windowData.height;
                        }

                        windowData.type = "window";
                        this.textClient.hmset(this.windowMetaDataPrefix + id, windowData, ((textClient, id) => {
                            return (err, reply) => {
                                textClient.hgetall(this.windowMetaDataPrefix + id, (err, reply) => {
                                    if (endCallback) {
                                        endCallback(reply);
                                    }
                                });
                            };
                        })(this.textClient, id));
                    }
                });
            });
        }

        /**
         * Window追加
         * @method addWindow
         * @param {BLOB} socket socket id
         * @param {JSON} windowData windowメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        addWindow(socketid, windowData, endCallback, permissionChangeCallback) {
            console.log("add window");
            this.addWindowMetaData(socketid, windowData, (metaData) => {
                this.generateWindowContentID((content_id) => {
                    if (metaData.hasOwnProperty('content_id') && metaData.content_id !== "") {
                        content_id = metaData.content_id;
                    }
                    metaData.content_id = content_id;
                    console.log("add window content id:", content_id);

                    this.textClient.hmset(this.windowContentPrefix + content_id, metaData, (err, reply) => {
                        if (err) {
                            console.error("Error on addWindow:" + err);
                        } else {

                            // 参照カウント.
                            this.textClient.setnx(this.windowContentRefPrefix + content_id, 0);
                            this.textClient.incr(this.windowContentRefPrefix + content_id, (err, value) => {
                                metaData.reference_count = value;
                                this.textClient.hmset(this.windowMetaDataPrefix + metaData.id, metaData, (err, reply) => {
                                    if (endCallback) {

                                        // ElectronDisplay だった場合, 即時許可する
                                        if (this.socketidToUserID.hasOwnProperty(socketid)) {
                                            const userID = this.socketidToUserID[socketid];
                                            if (userID === "ElectronDisplay") {
                                                let perm = {};
                                                perm[windowData.id] = "true";
                                                let data = { permissionList : [perm] };
                                                this.allDisplayCache[socketid] = windowData.id;
                                                this.updateDisplayPermissionList(data, (err, changeList) => {
                                                    if (permissionChangeCallback) {
                                                        permissionChangeCallback(err, changeList);
                                                    }
                                                })
                                            }
                                        }
                                        endCallback(metaData);
                                    }
                                });
                            });
                        }
                    });
                });
            });
        }

        /**
         * VirtualDisplay設定
         * @method setVirtualDisplay
         * @param {JSON} windowData VirtualDisplayのWindowデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        setVirtualDisplay(windowData, endCallback) {
            if (windowData) {
                if (windowData.hasOwnProperty('group') && windowData.group !== "group_default") {
                    this.textClient.hmset(this.virtualDisplayIDStr + ":" + windowData.group, windowData, (err, reply) => {
                        if (endCallback) {
                            endCallback(windowData);
                        }
                    });
                } else {
                    this.textClient.hmset(this.virtualDisplayIDStr, windowData, (err, reply) => {
                        if (endCallback) {
                            endCallback(windowData);
                        }
                    });
                }
            }
        }

        /**
         * VirtualDisplay取得
         * @method getVirtualDisplay
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        getVirtualDisplay(json, endCallback) {
            if (json && json.hasOwnProperty('group') && json.group !== "group_default") {
                this.textClient.hgetall(this.virtualDisplayIDStr + ":" + json.group, (err, data) => {
                    if (endCallback) {
                        if (data) {
                            endCallback(data);
                        } else {
                            endCallback({});
                        }
                    }
                });
            } else {
                this.textClient.hgetall(this.virtualDisplayIDStr, (err, data) => {
                    if (!err && !data.hasOwnProperty('type')) {
                        data.type = "virtual_display";
                        this.setVirtualDisplay(data);
                    }
                    if (endCallback) {
                        if (data) {
                            endCallback(data);
                        } else {
                            endCallback({});
                        }
                    }
                });
            }
        }

        /**
         * Window取得
         * @method getWindow
         * @param {JSON} windowData windowメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        getWindowMetaData(windowData, endCallback) {
            if (windowData.hasOwnProperty('type') && windowData.type === 'all') {
                //console.log("getWindowAll");
                this.textClient.keys(this.windowMetaDataPrefix + '*', (err, replies) => {
                    replies.forEach((id, index) => {
                        //console.log("getWindowAllID:" + id);
                        this.textClient.hgetall(id, (err, reply) => {
                            if (err) {
                                console.error(err);
                            } else {
                                if (endCallback && reply) {
                                    endCallback(reply);
                                }
                            }
                        });
                    });
                });
            } else {
                this.textClient.exists(this.windowMetaDataPrefix + windowData.id, (err, doesExist) => {
                    if (!err && doesExist === 1) {
                        this.textClient.hgetall(this.windowMetaDataPrefix + windowData.id, (err, data) => {
                            if (err) {
                                console.error(err);
                            } else {
                                if (endCallback) {
                                    endCallback(data);
                                }
                            }
                        });
                    } else {
                        if (endCallback) {
                            endCallback(null);
                        }
                    }
                });
            }
        }

        /**
         * Window削除
         * @method deleteWindowMetaData
         * @param {JSON} metaData windowメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        deleteWindowMetaData(metaData, endCallback) {
            this.textClient.del(this.windowMetaDataPrefix + metaData.id, (err) => {
                if (!err) {
                    console.log("unregister window id:" + metaData.id);
                }
                if (endCallback) {
                    endCallback(err, metaData);
                }
            });
        }

        /**
         * Window削除
         * @method deleteWindow
         * @param {JSON} windowData windowメタデータJSON
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        deleteWindow(metaData, endCallback) {
            this.deleteWindowMetaData(metaData, (err, meta) => {
                if (meta.hasOwnProperty('content_id') && meta.content_id !== '') {
                    this.textClient.exists(this.windowContentPrefix + meta.content_id, (err, doesExist) => {
                        if (!err && doesExist === 1) {
                            this.textClient.del(this.windowContentPrefix + meta.content_id, (err) => {
                                if (!err) {
                                    this.deleteDisplayPermissionList({ displayIDList : [meta.id] }, (err, reply) => {
                                        if (!err) {
                                            this.textClient.del(this.windowContentRefPrefix + meta.content_id);
                                            if (meta.hasOwnProperty('reference_count')) {
                                                delete meta.reference_count;
                                            }
                                            if (endCallback) {
                                                endCallback(meta);
                                            }
                                        } else {
                                            console.error(err);
                                        }
                                    });
                                } else {
                                    console.error(err);
                                }
                            });
                        }
                    });
                } else {
                    console.error(err);
                }
            });
        }

        /**
         * SocketIDで指定されたWindowの参照カウントをsocketidをもとに減らす
         * @method decrWindowReferenceCount
         * @param {string} socketid socket id
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        decrWindowReferenceCount(socketid, endCallback) {
            let id;
            if (this.socketidToHash.hasOwnProperty(socketid)) {
                id = this.socketidToHash[socketid];

                this.textClient.exists(this.windowMetaDataPrefix + id, (err, doesExist) => {
                    if (!err && doesExist === 1) {
                        this.textClient.hgetall(this.windowMetaDataPrefix + id, (err, data) => {
                            if (!err && data) {
                                // 参照カウントのみを減らす
                                this.textClient.decr(this.windowContentRefPrefix + data.content_id, (err, value) => {
                                    data.reference_count = value;
                                    this.textClient.hmset(this.windowMetaDataPrefix + id, data, (err, result) => {
                                        if (endCallback) {
                                            endCallback(null, data);
                                        }
                                    });
                                });
                            }
                        });
                    }
                });
            }
        }

        /**
         * Window更新
         * @method updateWindowMetaData
         * @param {BLOB} socketid socket id
         * @param {JSON} windowData windowメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        updateWindowMetaData(socketid, windowData, endCallback) {
            if (!windowData.hasOwnProperty("id")) { return; }
            this.textClient.hmset(this.windowMetaDataPrefix + windowData.id, windowData, (err, reply) => {
                if (endCallback) {
                    endCallback(windowData);
                }
            });
        }

        /**
         * cursor更新
         * @method updateMouseCursor
         * @param {BLOB} socketid socket id
         * @param {JSON} mouseData mouseメタデータ
         * @param {Function} endCallback 終了時に呼ばれるコールバック
         */
        updateMouseCursor(socketid, mouseData, endCallback) {
            let obj = { data: mouseData, id: socketid };
            if (endCallback) {
                endCallback(obj);
            }
        }

        addContentCore(metaData, binaryData, endCallback) {
            if (metaData.type === 'url') {
                this.renderURL(binaryData, (image, dimension) => {
                    if (image) {
                        metaData.posx = 0;
                        metaData.posy = 0;
                        metaData.width = dimension.width;
                        metaData.height = dimension.height;
                        metaData.orgWidth = dimension.width;
                        metaData.orgHeight = dimension.height;
                        this.addContent(metaData, image, (metaData, contentData) => {
                            if (endCallback) {
                                endCallback(null, metaData);
                            }
                        });
                    }
                });
            } else {
                if (metaData.type === "image") {
                    // サムネイルを作成
                    this.addContent(metaData, binaryData, (metaData, contentData) => {
                        Thumbnail.create(metaData, binaryData, (err, thumbnail, preview) => {
                            // 作成したサムネイルを登録
                            let kv = {}
                            if (thumbnail) {
                                kv.thumbnail = thumbnail;
                            }
                            if (preview) {
                                kv.preview = preview;
                            }
                            if (thumbnail || preview) {
                                this.client.hmset(this.contentThumbnailPrefix + metaData.content_id, kv, (err, reply) => {
                                    if (endCallback) {
                                        endCallback(null, metaData);
                                    }
                                });
                            } else {
                                // サムネイルなし
                                if (endCallback) {
                                    endCallback(null, metaData);
                                }
                            }
                        });
                    });
                } else {
                    this.addContent(metaData, binaryData, (metaData, contentData) => {
                        if (endCallback) {
                            endCallback(null, metaData);
                        }
                    });
                }
            }
        }

        /**
         * socketidユーザーがgroupを閲覧可能かどうか返す
         * @method isEditable
         * @param {String} socketid socketid
         * @param {String} group group
         */
        isViewable(socketid, groupID) {
            if (groupID === "group_default") {
                return true;
            }
            if (groupID === undefined || groupID === "") {
                return true;
            }
            // ここでDisplayならsocketid=Displayとなる
            if (this.socketidToLoginKey.hasOwnProperty(socketid)) {
                socketid = this.socketidToLoginKey[socketid];
            }
            let authority;
            if (this.socketidToAccessAuthority.hasOwnProperty(socketid)) {
                authority = this.socketidToAccessAuthority[socketid];
                if (authority.viewable === "all") {
                    return true;
                }
                if (authority.viewable.indexOf(groupID) >= 0) {
                    return true;
                }
            }
            return false;
        }

        /**
         * socketidユーザーがgroupを編集可能かどうか返す
         * @method isEditable
         * @param {String} socketid socketid
         * @param {String} group group
         */
        isEditable(socketid, groupID) {
            if (groupID === "group_default") {
                return true;
            }
            if (groupID === undefined || groupID === "") {
                return true;
            }
            if (this.socketidToLoginKey.hasOwnProperty(socketid)) {
                socketid = this.socketidToLoginKey[socketid];
            }
            let authority;
            if (this.socketidToAccessAuthority.hasOwnProperty(socketid)) {
                authority = this.socketidToAccessAuthority[socketid];
                if (authority.editable === "all") {
                    return true;
                }
                if (authority.editable.indexOf(groupID) >= 0) {
                    return true;
                }
            }
            return false;
        }

        /**
         * socketidユーザーがdisplaygroupを編集可能かどうか返す
         * @method isDisplayEditable
         * @param {String} socketid socketid
         * @param {String} group group
         */
        isDisplayEditable(socketid, groupID) {
            if (groupID === "group_default") {
                return true;
            }
            if (groupID === undefined || groupID === "") {
                return true;
            }
            if (this.socketidToLoginKey.hasOwnProperty(socketid)) {
                socketid = this.socketidToLoginKey[socketid];
            }
            let authority;
            if (this.socketidToAccessAuthority.hasOwnProperty(socketid)) {
                authority = this.socketidToAccessAuthority[socketid];
                if (authority.hasOwnProperty('displayEditable')) {
                    if (authority.displayEditable === "all") {
                        return true;
                    }
                    if (authority.displayEditable.indexOf(groupID) >= 0) {
                        return true;
                    }
                }
            }
            return false;
        }

        /**
         * socketidユーザーがdisplaygroupを表示可能かどうか返す
         * @method isViewableDisplay
         * @param {String} socketid socketid
         * @param {String} group group
         */
        isViewableSite(socketid, groupID, endCallback) {
            if (groupID === "group_default") {
                endCallback(null, true);
                return;
            }
            if (groupID === undefined || groupID === "") {
                endCallback(null, true);
                return;
            }
            if (this.allDisplayCache.hasOwnProperty(socketid)) {
                // displayからのアクセスだった
                const displayID = this.allDisplayCache[socketid];
                this.getWindowMetaData({ id : displayID },  (windowMeta) => {
                    this.getGroupUserSetting((err, data) => {
                        if (!err && data) {
                            if (data.hasOwnProperty(groupID)) {
                                const authority = data[groupID];
                                if (authority.hasOwnProperty('viewableSite')) {
                                    if (authority.viewableSite !== "all") {
                                        endCallback(null, authority.viewableSite.indexOf(windowMeta.group) >= 0);
                                        return;
                                    }
                                }
                                // viewableSiteの設定が無い、または"all"
                                endCallback(null, true);
                                return;
                            }
                        }
                        endCallback(err, false);
                    });
                });
            } else {
                // controllerからのアクセスだった
                endCallback(null, true);
            }
        }

        isGroupManipulatable(socketid, groupID, endCallback) {
            this.getGroupList((err, data) => {
                if (groupID === "group_default") {
                    endCallback(true);
                    return;
                }
                if (groupID === undefined || groupID === "") {
                    endCallback(true);
                    return;
                }
                if (this.socketidToLoginKey.hasOwnProperty(socketid)) {
                    socketid = this.socketidToLoginKey[socketid];
                }
                let authority;
                if (this.socketidToAccessAuthority.hasOwnProperty(socketid)) {
                    authority = this.socketidToAccessAuthority[socketid];
                    endCallback(authority.group_manipulatable);
                    return;
                }
                endCallback(false);
                return;
            });
        }

        isAdmin(socketid, endCallback) {
            let userid;
            if (this.socketidToLoginKey.hasOwnProperty(socketid)) {
                socketid = this.socketidToLoginKey[socketid];
            }
            if (this.socketidToUserID.hasOwnProperty(socketid)) {
                userid = this.socketidToUserID[socketid];
            }
            this.getAdminUserSetting((err, adminSetting) => {
                if (adminSetting && adminSetting.hasOwnProperty(userid) || socketid === "master") {
                    endCallback(null, true);
                } else {
                    endCallback(null, false);
                }
            });
        }

        getGroupID(groupName, endCallback) {
            this.getGroupList((err, groupList) => {
                let k;
                for (k = 0; k < groupList.grouplist.length; k = k + 1) {
                    if (groupList.grouplist[k].name === groupName) {
                        endCallback(groupList.grouplist[k].id);
                        return;
                    }
                }
                for (k = 0; k < groupList.displaygrouplist.length; k = k + 1) {
                    if (groupList.displaygrouplist[k].name === groupName) {
                        endCallback(groupList.displaygrouplist[k].id);
                        return;
                    }
                }
            });
        }

        getAdminID(adminName, endCallback) {
            this.getAdminList((err, adminList) => {
                let k;
                for (k = 0; k < adminList.adminlist.length; k = k + 1) {
                    if (adminList.adminlist[k].name === groupName) {
                        endCallback(adminList.adminlist[k].id);
                    }
                }
            });
        }

        /**
         * UUIDを登録する.
         * @method registerUUID
         * @param {String} id UUID
         */
        registerUUID(id) {
            this.uuidPrefix = id + ":";
            this.textClient.hset(this.frontPrefix + 'dblist', "default", id);
            this.contentPrefix = this.frontPrefix + this.uuidPrefix + this.contentPrefix;
            this.contentRefPrefix = this.frontPrefix + this.uuidPrefix + this.contentRefPrefix;
            this.contentBackupPrefix = this.frontPrefix + this.uuidPrefix + this.contentBackupPrefix;
            this.contentHistoryPrefix = this.frontPrefix + this.uuidPrefix + this.contentHistoryPrefix;
            this.contentHistoryDataPrefix = this.frontPrefix + this.uuidPrefix + this.contentHistoryDataPrefix;
            this.contentThumbnailPrefix = this.frontPrefix + this.uuidPrefix + this.contentThumbnailPrefix;
            this.metadataPrefix = this.frontPrefix + this.uuidPrefix + this.metadataPrefix;
            this.metadataHistoryPrefix = this.frontPrefix + this.uuidPrefix + this.metadataHistoryPrefix;
            this.metadataBackupPrefix = this.frontPrefix + this.uuidPrefix + this.metadataBackupPrefix;
            this.windowMetaDataPrefix = this.frontPrefix + this.uuidPrefix + this.windowMetaDataPrefix;
            this.windowContentPrefix = this.frontPrefix + this.uuidPrefix + this.windowContentPrefix;
            this.windowContentRefPrefix = this.frontPrefix + this.uuidPrefix + this.windowContentRefPrefix;
            this.virtualDisplayIDStr = this.frontPrefix + this.uuidPrefix + this.virtualDisplayIDStr;
            this.groupListPrefix = this.frontPrefix + this.uuidPrefix + this.groupListPrefix;
            this.adminListPrefix = this.frontPrefix + this.adminListPrefix;
            this.controllerDataPrefix = this.frontPrefix + this.controllerDataPrefix;
            this.globalSettingPrefix = this.frontPrefix + this.globalSettingPrefix;
            this.adminUserPrefix = this.frontPrefix + this.adminUserPrefix; // 管理ユーザー設定
            this.groupUserPrefix = this.frontPrefix + this.uuidPrefix + this.groupUserPrefix; // グループユーザー設定
            console.log("idstr:" + this.contentPrefix);
            console.log("idstr:" + this.contentRefPrefix);
            console.log("idstr:" + this.metadataPrefix);
            console.log("idstr:" + this.windowMetaDataPrefix);
            console.log("idstr:" + this.windowContentPrefix);
            console.log("idstr:" + this.windowContentRefPrefix);
            console.log("idstr:" + this.groupListPrefix);
            console.log("idstr:" + this.contentBackupPrefix);
            console.log("idstr:" + this.contentHistoryPrefix);
            console.log("idstr:" + this.contentHistoryDataPrefix);
            console.log("idstr:" + this.contentThumbnailPrefix);
            console.log("idstr:" + this.metadataBackupPrefix);
            console.log("idstr:" + this.metadataHistoryPrefix);
            this.client.CONFIG('SET', 'maxmemory-policy', 'volatile-ttl');

            /// 管理者の初期登録

            this.textClient.exists(this.adminUserPrefix, (err, doesExists) => {
                if (doesExists !== 1) {
                    this.addAdmin("master", util.generateUUID8(), "Admin", "admin", (err, reply) => { });
                }
                // jsonから追加.
                fs.readFile("../admin.json", (err, reply) => {
                    let name, data;
                    if (!err) {
                        try {
                            let admins = JSON.parse(reply);
                            for (name in admins) {
                                data = admins[name];
                                if (data.hasOwnProperty('command') && data.command === "add") {
                                    if (data.hasOwnProperty('password') && data.password.length > 0) {
                                        this.addAdmin("master", util.generateUUID8(), name, admins[name].password, ((name) => {
                                            return (err, reply) => {
                                                if (!err) {
                                                    console.log(name, "overwritten");
                                                }
                                            };
                                        })(name));
                                    }
                                }
                                else if (data.hasOwnProperty('command') && data.command === "delete") {
                                    this.deleteAdmin("master", name, ((name) => {
                                        return (err, reply) => {
                                            if (!err) {
                                                console.log(name, "deleted");
                                            }
                                        };
                                    })(name));
                                }
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }
                });
            });
            this.groupInitialSettting();

            this.getGlobalSetting((err, setting) => {
                if (!err && setting && setting.current_db) {
                    this.textClient.hgetall(this.frontPrefix + 'dblist', (err, dblist) => {
                        let name;
                        for (name in dblist) {
                            if (dblist[name] === setting.current_db) {
                                this.changeDB("master", name, () => { });
                            }
                        }
                    });
                }
            });
        }

        setSettingJSON(json) {
            // 毎回上書きするglobal設定
            this.changeGlobalSetting("master", json);
            Thumbnail.setPreviewWH(Number(json.reductionResolution));
        };

        /**
         * Display配信許可設定を取得する.
         * @method getDisplayPermission
         * @param {String} displayid displayID
         * @param {Function} callback (string err, bool permission)=>{}
         */
        getDisplayPermission(socketid, displayid, callback) {
            this.existsDisplayPermission(socketid, displayid, (err, exists) => {
                if (err) {
                    callback(err, null);
                } else if (exists) {
                    this.textClient.hget(this.frontPrefix + this.uuidPrefix + "permission_login_displayid", displayid, (err, reply) => {
                        // console.log("getdisplaypermission : does exist",this.displayPermission, displayid, reply);
                        if (reply === "false") {
                            this.blockedDisplayCache[socketid] = displayid;
                        }
                        this.allDisplayCache[socketid] = displayid;
                        callback(err, reply);
                    });
                }
            });
        }

        getDisplayPermissionList(callback) {
            this.textClient.hgetall(this.frontPrefix + this.uuidPrefix + "permission_login_displayid", (err, replies) => {
                if (err) {
                    callback(err);
                } else {
                    let data = { "permissionList": [] }
                    for (let displayID in replies) {
                        let permission = {};
                        permission[displayID] = replies[displayID];
                        data.permissionList.push(permission);
                    }
                    callback(err, data);
                }
            });
        }

        /*
        * @param {Function} callback (string, displayIDList)  
        *                   displayIDListはこの関数によって設定変更されたdisplayのdisplayidのリスト
        */
        updateDisplayPermissionList(data, callback) {
            if (!data.hasOwnProperty('permissionList')) {
                callback("not found permissionList");
                return;
            }
            let permissionList = data.permissionList;
            let count = 0;
            let changeList = []; // 設定が変更されたdisplay idのリスト
            this.textClient.hgetall(this.frontPrefix + this.uuidPrefix + "permission_login_displayid", (err, permissionDict) => {
                for (let i = 0; i < permissionList.length; ++i) {
                    let key = Object.keys(permissionList[i])[0];
                    let value = String(permissionList[i][key]);
                    
                    //  設定が変更されたdisplay idを詰める
                    if (permissionDict && permissionDict.hasOwnProperty(key)) {
                        if (permissionDict[key] !== value) {
                            changeList.push(key);
                        }
                    } else {
                        // 存在しなかった新規の場合も詰める
                        changeList.push(key);
                    }

                    this.textClient.hset(this.frontPrefix + this.uuidPrefix + "permission_login_displayid", key, value, (err, reply) => {
                        count += 1;
                        if (count >= permissionList.length) {
                            // 全部セットし終わった
                            callback(err, changeList);
                        }
                    });
                }
            });
        }

        deleteDisplayPermissionList(data, callback) {
            if (!data.hasOwnProperty('displayIDList')) {
                callback("not found displayIDList");
                return;
            }
            let displayIDList = data.displayIDList;
            let count = 0;
            for (let i = 0; i < displayIDList.length; ++i) {
                this.textClient.hdel(this.frontPrefix + this.uuidPrefix + "permission_login_displayid", displayIDList[i], (err, reply) => {
                    count += 1;
                    if (count >= displayIDList.length) {
                        callback(err, displayIDList);
                    }
                    // blockedDisplayCacheも消す
                    for (let k in this.blockedDisplayCache) {
                        if (this.blockedDisplayCache[k] === displayIDList[i]) {
                            delete this.blockedDisplayCache[k];
                            break;
                        }
                    }
                    // allDisplayCacheも消す
                    for (let k in this.allDisplayCache) {
                        if (this.allDisplayCache[k] === displayIDList[i]) {
                            delete this.allDisplayCache[k];
                            break;
                        }
                    }
                });
            }
        }

        /**
         * Display配信許可設定が存在するか確認する.
         * @method existsDisplayPermission
         * @param {String} socketid socketid
         * @param {String} displayid displayID
         * @param {Function} callback (string err, bool exists)=>{}
         */
        existsDisplayPermission(socketid, displayid, callback) {
            this.textClient.hexists(this.frontPrefix + this.uuidPrefix + "permission_login_displayid", displayid, (err, doesExists) => {
                if (err) {
                    this.blockedDisplayCache[socketid] = displayid;
                    this.allDisplayCache[socketid] = displayid;
                    callback(err);
                } else if (doesExists !== 1) {//存在しない
                    this.blockedDisplayCache[socketid] = displayid;
                    this.allDisplayCache[socketid] = displayid;
                    callback(err, false);
                } else {
                    this.allDisplayCache[socketid] = displayid;
                    if (this.blockedDisplayCache.hasOwnProperty(socketid)) {
                        delete this.blockedDisplayCache[socketid]
                    }
                    callback(err, true);
                }
            });
        }

        
        /**
         * upload
         * @method upload
         * @param {BLOB} binaryData binaryData
         * @param {Function} callback (string err)=>{}
         */
        upload(binaryData, callback){
            const zip = new nodeZip(binaryData, {base64: false, checkCRC32: true});

            /* 既にこのファイルがアップロードされてたら何もしない */
            let fileAlreadyExist = false;
            for(let i in zip.files){
                if(fs.existsSync("../public/qgis/"+zip.files[i].name)){
                    fileAlreadyExist = true;
                }
            }
            if(fileAlreadyExist === true){
                console.log("[upload]this file already exists");
                callback("this file already exists");
                return;
            }

            /* ファイルを解凍する */
            (async()=>{
                let resultList = [];
                for(let i in zip.files){
                    const r = await this._promiseExtract(zip,i);
                    resultList.push(r);
                }
                this.updateQgisContentsList();
                console.log("upload:result",resultList);
                
                for(let result of resultList){
                    if(result !== null){
                        callback(result);//最初に起きたエラー
                    }
                }
                callback(null);//エラーはなかった
            })();
        }

        /**
         * _promiseExtract
         * nodezipの解凍をファイル/フォルダごとにpromise実行する。
         * @method _promiseExtract
         * @return {Promise}
         */
        _promiseExtract(zip,file){
            return new Promise((resolve,reject)=>{
                if(zip.files[file].options.dir === true){
                    if(!fs.existsSync("../public/qgis/"+zip.files[file].name)){
                        console.log("[mkdir] : ","../public/qgis/"+zip.files[file].name);
                        fs.mkdir("../public/qgis/"+zip.files[file].name, { recursive: true },(err)=>{
                            if(err){
                                console.log(err)
                                reject(err);
                            };
                            resolve(null);
                        });
                    }else{
                        reject("this filename already exist");
                    }
                }else{
                    fs.writeFile("../public/qgis/"+zip.files[file].name,zip.files[file]._data,"binary",(err)=>{
                        console.log("[writeFile] : ","../public/qgis/"+zip.files[file].name);
                        if(err){
                            console.log(err)
                            reject(err);
                        };
                        resolve(null);
                    });
                }
            });
        }

        updateQgisContentsList(){
            console.log("updateQgisContentsList");
            fs.readdir("../public/qgis/",(err,files)=>{
                let list = [];
                for(let file of files){
                    if(file !== "contentsList.json")
                    list.push(file);
                }

                fs.writeFile("../public/qgis/contentsList.json",JSON.stringify(list),"utf8",(err)=>{
                    console.log("[contentslist]done");
                });
            });
        }
    }

    module.exports = Executer;
})();
