/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Constants from '../../common/constants'
import GroupBox from '../../components/group_box'
import SearchBox from '../../components/search_box.js';
import UsersBox from '../../components/users_box.js';
import NoticeBox from '../../components/notice_box.js';
import Tabs from '../../components/tabs'
import Store from '../store/store'
import Validator from '../../common/validator'
import InputDialog from '../../components/input_dialog'

class GroupGUI
{
    constructor(store, action, tabSetting) {
        this.store = store;
        this.action = action;

		// 下部タブの初期化.
		this.tabs = new Tabs(tabSetting);
		document.getElementById('bottom_area').appendChild(this.tabs.getDOM());
		this.tabs.on('tab_changed_pre', (err, data) => {
            this.action.changeTab({
                isBefore : true,
                data : data
            })
		});
		this.tabs.on('tab_changed_post', (err, data) => {
            this.action.changeTab({
                isBefore : false,
                data : data
            })
		});

		// Displayボックスにグループボックスを埋め込み.
		this.displayBox = new GroupBox(this.store.getManagement().getAuthorityObject(), document.getElementById('display_tab_box'),
			{
				tabs : [{
						"group_default" : {
							id : Constants.DefaultGroup,
							name : "default",
							className : "display",
							func : function () {},
							active : true
						}
					}]
			}, GroupBox.TYPE_DISPLAY);
		this.initGroupBoxEvents(this.displayBox);

		// コンテンツボックスにグループボックスを埋め込み.
		this.groupBox = new GroupBox(this.store.getManagement().getAuthorityObject(), document.getElementById('content_tab_box'),
			{
				tabs : [{
						"group_default" : {
							id : Constants.DefaultGroup,
							name : "default",
							className : Constants.TabIDContent,
							func : function () {},
							active : true
						}
					}]
			}, GroupBox.TYPE_CONTENT);
		this.initGroupBoxEvents(this.groupBox);

		// Searchエリアの中身を作成
		this.searchBox = new SearchBox(this.store.getManagement().getAuthorityObject(), document.getElementById('search_tab_box'),
			{
				groups : [{
					id : Constants.DefaultGroup,
					name : "default"
				}],
				colors : ["rgb(54,187,68)"]
			}, GroupBox.TYPE_CONTENT);
		this.initSearchBoxEvents(this.searchBox);

		// レイアウトボックスにグループボックスを埋め込み.
		this.layoutBox = new GroupBox(this.store.getManagement().getAuthorityObject(), document.getElementById('layout_tab_box'),
			{
				tabs : [{
						"group_default" : {
							id : Constants.DefaultGroup,
							name : "default",
							className : Constants.TabIDLayout,
							func : function () {},
							active : false
						}
					}]
			}, GroupBox.TYPE_CONTENT);
        this.initGroupBoxEvents(this.layoutBox);

		// userエリアの中身を作成
		this.usersBox = new UsersBox(this.store.getManagement().getAuthorityObject(), document.getElementById('users_tab_box'),
			{
				groups : [{
					id : Constants.DefaultGroup,
					name : "default"
				}],
				colors : ["rgb(54,187,68)"]
			}, GroupBox.TYPE_CONTENT);
		this.initUsersBoxEvents(this.usersBox, this.tabs);

        // Searchテキストが入力された
        this.store.on(Store.EVENT_SEARCH_INPUT_CHANGED, (err, text, groups) => {
            let foundContents = [];
            let groupDict = {};
            this.store.getGroupStore().for_each_group((i, group) => {
                groupDict[group.id] = group;
            });

            this.store.for_each_metadata((id, metaData) => {
                if (Validator.isContentType(metaData)) {
                    if (groups.indexOf(metaData.group) >= 0) {
                        if (text === "" || JSON.stringify(metaData).indexOf(text) >= 0) {
                            let elem = document.getElementById("onlist:" + metaData.id);
                            if (elem) {
                                let copy = elem.cloneNode();
                                copy.id = "onsearch:" + metaData.id;
                                let child = elem.childNodes[0].cloneNode();
                                child.innerHTML = elem.childNodes[0].innerHTML;
                                copy.appendChild(child);
                                this.action.setupContentElement({
                                    element : copy,
                                    id : metaData.id
                                });
                                foundContents.push(copy);
                            }
                        }
                    }
                    else if (groups.indexOf(Constants.DefaultGroup) >= 0 && !groupDict.hasOwnProperty(metaData.group)) {
                        let elem = document.getElementById("onlist:" + metaData.id);
                        if (elem) {
                            let copy = elem.cloneNode();
                            copy.id = "onsearch:" + metaData.id;
                            let child = elem.childNodes[0].cloneNode();
                            child.innerHTML = elem.childNodes[0].innerHTML;
                            copy.appendChild(child);
                            this.action.setupContentElement({
                                element : copy,
                                id : metaData.id
                            });
                            foundContents.push(copy);
                        }
                    }
                }
            });
            this.searchBox.setSearchResult(foundContents);
            // TODO
        });


        this.noticeBox = new NoticeBox();
        // DisplayBoxの中にNoticeBoxを突っ込む
        let displayBox = document.getElementById('display_tab_box');
        displayBox.appendChild(this.noticeBox.getDOM());
        this.initNoticeEvents(this.noticeBox);

        // Displayから接続要求が飛んできた
        this.store.on(Store.EVENT_ASK_DISPLAY_PERMISSION, (err, logindata)=>{
            this.noticeBox.addDisplayPermissionLeaf([logindata.displayid]);
        });
        this.store.on(Store.EVENT_DISPLAY_PREMISSION_LIST_RELOADED, (err)=>{
            let permissionList = this.store.getDisplayPermissionList();
            let displayIDList = [];
            for (let i = 0; i < permissionList.length; ++i) {
                displayIDList.push(Object.keys(permissionList[i])[0]);
            }
            this.noticeBox.deleteDisplayPermissionLeaf(displayIDList);
        });
    }

	/**
	 * グループのタブに対するイベントを設定.
	 */
	initGroupBoxEvents(groupBox) {
		groupBox.on("group_delete", (err, groupID) => {
			InputDialog.showOKCancelInput({
					name : i18next.t('delete_content_in_group_is_ok')
				}, ((groupID) => {
					return (value) => {
						if (value) {
							this.action.deleteGroup({ groupID : groupID });
						}
					};
				})(groupID));
		});

		groupBox.on("group_append", (err, groupName) => {
			this.action.addGroup({ groupName: groupName });
		});

		groupBox.on("group_up", (err, groupID) =>  {
            this.action.moveUpGroup({
                groupID : groupID
            });
		});

		groupBox.on("group_down", (err, groupID) => {
            this.action.moveDownGroup({
                groupID : groupID
            });
		});

		groupBox.on("group_edit_name", (err, groupID, groupName) =>  {
            this.action.changeGroupName({
                groupID : groupID,
                groupName : groupName
            });
		});

		groupBox.on("group_edit_color", (err, groupID, color) => {
            this.action.changeGroupColor({
                groupID : groupID,
                color : color
            });
		});

		groupBox.on('group_changed', (err) => {
			if (this.isActiveTab(Constants.TabIDDisplay)) {
				let id = groupBox.getCurrentGroupID();
                this.action.changeDisplayGroupSelect({ groupID : id });
			} else {
                let id = groupBox.getCurrentGroupID();
				this.action.changeGroupSelect({ groupID : id });
            }
		});
	}

    initNoticeEvents(noticeBox) {
        noticeBox.on(NoticeBox.EVENT_NOTICE_ACCEPT,(err, displayPermissionList)=>{
            this.action.changeDisplayPermissionList({
                permissionList : displayPermissionList
            });
        });
        noticeBox.on(NoticeBox.EVENT_NOTICE_REJECT,(err, displayPermissionList)=>{
            this.action.changeDisplayPermissionList({
                permissionList : displayPermissionList
            });
        });
    }

	/**
	 * Searchのタブに対するイベントを設定.
	 */
	initSearchBoxEvents(searchBox) {
		searchBox.on(SearchBox.EVENT_INPUT_CHANGED, (err, value, groups) => {
            this.action.changeSearchInput({
                text :  value,
                groups : groups
            })
        });
    }

	/**
	 * userのタブに対するイベントを設定.
	 */
	initUsersBoxEvents(usersBox, _tabs) {7
        usersBox.tabs = _tabs;
		usersBox.on(UsersBox.EVENT_INPUT_CHANGED, (err, value, groups) => {
            this.action.changeUserSerchInput({
                text :  value,
                groups : groups
            })
        });
    }


    update(contentSetting, displaySetting, searchSetting, layoutSetting, userSetting) {
        document.getElementById('display_tab_box').innerHTML = "";
        this.displayBox = new GroupBox(this.store.getManagement().getAuthorityObject(), document.getElementById('display_tab_box'), displaySetting, GroupBox.TYPE_DISPLAY);
        this.initGroupBoxEvents(this.displayBox);

        document.getElementById('content_tab_box').innerHTML = "";
        this.groupBox = new GroupBox(this.store.getManagement().getAuthorityObject(), document.getElementById('content_tab_box'), contentSetting, GroupBox.TYPE_CONTENT);
        this.initGroupBoxEvents(this.groupBox);

        this.searchBox = new SearchBox(this.store.getManagement().getAuthorityObject(), document.getElementById('search_tab_box'), searchSetting, GroupBox.TYPE_CONTENT);
        this.initSearchBoxEvents(this.searchBox);

        document.getElementById('layout_tab_box').innerHTML = "";
        this.layoutBox = new GroupBox(this.store.getManagement().getAuthorityObject(), document.getElementById('layout_tab_box'), layoutSetting, GroupBox.TYPE_CONTENT);
        this.initGroupBoxEvents(this.layoutBox);

        //if(userSetting != undefined){
            //document.getElementById('users_tab_box').innerHTML = "";
            //this.usersBox = new UsersBox(this.store.getManagement().getAuthorityObject(), document.getElementById('users_tab_box'), userSetting, GroupBox.TYPE_CONTENT);
            //this.initGroupBoxEvents(this.usersBox);
        //}

        // DisplayBoxの中にNoticeBoxを突っ込む
        this.noticeBox = new NoticeBox();
        let displayBox = document.getElementById('display_tab_box');
        displayBox.appendChild(this.noticeBox.getDOM());
        this.initNoticeEvents(this.noticeBox);

        const groupID = this.store.managementStore.userStatus.groupID;
        if(groupID != "Moderator" && !this.store.managementStore.getAuthorityObject().isAdmin()){
            document.getElementById('users_tab').style.display = "none";
        }
    }


    isActiveTab(tabid) {
		return this.getTabs().isActive(tabid);
    }

    changeTab(tabid) {
        this.getTabs().changeTab(tabid)
    }

	selectGroup(group_id) {
        if (this.isActiveTab(Constants.TabIDDisplay))
        {
            this.getDisplayBox().selectTab(group_id);
        }
        else
        {
            this.getContentBox().selectTab(group_id);
            this.getLayoutBox().selectTab(group_id);
        }
    }

    getDisplayBox() {
        return this.displayBox;
    }

    getContentBox() {
        return this.groupBox;
    }

    getSearchBox() {
        return this.searchBox;
    }

    getLayoutBox() {
        return this.layoutBox;
    }

    getUsersBox() {
        return this.usersBox;
    }

    getTabs() {
        return this.tabs;
    }
}

export default GroupGUI;