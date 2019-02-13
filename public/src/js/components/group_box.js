/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../common/constants.js';
import GroupSettingMenu from './group_setting_menu.js';
import InputDialog from './input_dialog.js';

 "use strict";

class GroupBox extends EventEmitter {
	constructor(authority, containerElem, setting, type) {
		super();
		this.container = containerElem;
		this.setting = setting;
		this.groupIDs = [];
		this.tabIDs = [];
		this.tabGroupToElems = {};
		this.groupIDToName = {};
		this.currentBoxArea = null;
		this.authority = authority;
		this.type = type;
		this._init();
		this.currentGroupName = "";
	}
	IDtoTabID(id) {
		return this.container.id + "_" + id;
	}
	TabIDtoID(tabid) {
		return tabid.split(this.container.id + "_").join("");
	}
	
	/**
	 * 設定ボタンの追加
	 * @param {*} parent
	 * @param {*} tabID
	 * @param {*} groupName
	 * @param {*} groupColor
	 */
	_add_setting_button(parent, tabID, groupName, groupColor) {
		let span;
		let setting_button = document.createElement('div');
		setting_button.className = "group_tab_setting";
		setting_button.onclick = ((groupName) => {
			return (evt) => {
				// group_setting_menu を使う
				let groupSetting = new GroupSettingMenu();
				groupSetting.on(GroupSettingMenu.EVENT_GROUP_DELETE, (err) => {
					this.emit(GroupBox.EVENT_GROUP_DELETE, err, this.TabIDtoID(tabID));
				});
				groupSetting.on(GroupSettingMenu.EVENT_GROUP_EDIT_NAME, (err, value) => {
					this.emit(GroupBox.EVENT_GROUP_EDIT_NAME, err, this.TabIDtoID(tabID), value);
				});
				groupSetting.on(GroupSettingMenu.EVENT_GROUP_EDIT_COLOR, (err, value) => {
					this.emit(GroupBox.EVENT_GROUP_EDIT_COLOR, err, this.TabIDtoID(tabID), value);
				});
				groupSetting.show(evt.clientX, evt.clientY, groupName, groupColor);
				document.body.appendChild(groupSetting.getDOM());
				groupSetting.on(GroupSettingMenu.EVENT_CLOSE, (err) => {
					document.body.removeChild(groupSetting.getDOM());
					groupSetting = null;
				});
			};
		})(groupName);
		span = document.createElement('span');
		span.className = "group_tab_setting_label";
		setting_button.appendChild(span);
		parent.appendChild(setting_button);
		return setting_button;
	}
	/**
	 * ラベルの追加
	 * @param {*} parent
	 * @param {*} tabID
	 * @param {*} text
	 */
	_add_label(parent, tabID, text) {
		let label = document.createElement('span');
		label.id = tabID + "_link";
		label.className = "group_tab_link" + " " + "group_tab_link_" + this.type;
		label.innerHTML = text;
		parent.appendChild(label);
	}
	/**
	 * タブの追加
	 *	<div id="display_tab_title" class="display_tab_title"><span class="active" id="display_tab_link">Display</span></div>
		*	<div id="content_tab_title" class="content_tab_title active"><span id="content_tab_link">Content</span></div>
		*	..
		*/
	_add_tab(parent, tabID, tabItem) {
		let groupName = tabItem.name;
		let groupColor = tabItem.hasOwnProperty('color') ? tabItem.color : null;

		let inner_group_div = document.createElement('div');
		inner_group_div.className = "inner_group_div";
		let elem = document.createElement('div');
		elem.appendChild(inner_group_div);
		elem.id = tabID;
		elem.className = tabItem.selected ? tabItem.className + " active" : tabItem.className;
		elem.style.cursor = "pointer";
		if (!groupColor) {
			if (this.type === GroupBox.TYPE_DISPLAY) {
				elem.style.backgroundColor = "#0080FF";
			}
			else {
				elem.style.backgroundColor = "rgb(54,187,68)";
			}
		}
		if (groupColor) {
			elem.style.backgroundColor = groupColor;
		}
		elem.onclick = (evt) => {
			let i, tabElem;
			for (i = 0; i < this.tabIDs.length; i = i + 1) {
				document.getElementById(this.tabIDs[i] + "_box").style.display = "none";
				tabElem = document.getElementById(this.tabIDs[i]);
				tabElem.className = tabElem.className.split(" active").join("");
			}
			tabElem = document.getElementById(tabID);
			tabElem.className = tabElem.className + " active";
			document.getElementById(tabID + "_box").style.display = "block";
			if (tabItem.hasOwnProperty('func')) {
				tabItem.func();
			}
			this.currentBoxArea = document.getElementById(tabID + "_box");
			this.currentGroupName = groupName;
			this.currentGroupID = this.TabIDtoID(tabID);
			this.emit(GroupBox.EVENT_GROUP_CHANGED, null, evt);
		};
		this.tabGroupToElems[this.TabIDtoID(tabID)].push(elem);
		this.groupIDToName[this.TabIDtoID(tabID)] = groupName;
		// if (this.type === GroupBox.TYPE_DISPLAY) {
		// 	this._add_checkbox(inner_group_div, tabID, tabItem.checked);
		// }
		this._add_label(inner_group_div, tabID, groupName);
		if (this.TabIDtoID(tabID) !== Constants.DefaultGroup && this.authority.isGroupManipulable()) {
			this._add_setting_button(inner_group_div, tabID, groupName, groupColor);
		}
		parent.appendChild(elem);
		return elem;
	}
	/**
	 * 上下移動ボタンの追加
	 * @param {*} parent
	 * @param {*} direction "up" or "down"
	 */
	_add_updown_button(parent, direction) {
		let elem = document.createElement('div');
		let span = document.createElement('span');
		span.className = "group_tab_" + direction + "_label";
		elem.className = "group_tab_" + direction + " " + "group_tab_" + direction + "_" + this.type;
		elem.setAttribute("title", i18next.t("move_" + direction));
		elem.appendChild(span);
		elem.onclick = () => {
			if (direction === "up") {
				this.emit(GroupBox.EVENT_GROUP_UP, null, this.currentGroupID);
			}
			else {
				this.emit(GroupBox.EVENT_GROUP_DOWN, null, this.currentGroupID);
			}
		};
		parent.appendChild(elem);
	}
	/**
	 * 追加ボタンの追加
	 * @param {*} parent
	 */
	_add_append_button(parent) {
		let elem = document.createElement('div');
		let span = document.createElement('span');
		elem.className = "group_tab_append" + " " + "group_tab_down_" + this.type;
		span.className = "group_tab_append_label";
		span.innerHTML = "+";
		if (this.type === GroupBox.TYPE_DISPLAY) {
			elem.setAttribute("title", i18next.t('add_new_site'));
		} else {
			elem.setAttribute("title", i18next.t('add_new_group'));
		}
		elem.appendChild(span);
		if (this.type === GroupBox.TYPE_DISPLAY) {
			elem.onclick = () => {
				InputDialog.showTextInput({
					name: i18next.t('new_site'),
					initialValue: "",
					okButtonName: "OK",
				}, (value) => {
					this.emit(GroupBox.EVENT_GROUP_APPEND, null, value);
				});
			};
		} else {
			elem.onclick = () => {
				InputDialog.showTextInput({
					name: i18next.t('new_group'),
					initialValue: "",
					okButtonName: "OK",
				}, (value) => {
					this.emit(GroupBox.EVENT_GROUP_APPEND, null, value);
				});
			};
		}
		parent.appendChild(elem);
		return elem;
	}
	/**
	 *
	 * @param {*} parent
	 * @param {*} tabID
	 * @param {*} tabItem
	 */
	_add_box(parent, tabID, tabItem) {
		let box = document.createElement('div');
		box.id = tabID + "_box";
		box.className = tabItem.className + "_box";
		box.style.width = "100%";
		box.style.height = "100%";
		box.style.overflow = "auto";
		if (tabItem.hasOwnProperty('selected') && tabItem['selected']) {
			box.style.display = "block";
		}
		else {
			box.style.display = "none";
		}
		parent.appendChild(box);
		return box;
	}
	/*
			<div class="left_tab_area" id="left_tab_area">
				<div id="display_tab_title" class="display_tab_title"><span class="active" id="display_tab_link">Display</span></div>
				<div id="content_tab_title" class="content_tab_title active"><span id="content_tab_link">Content</span></div>
			</div>
		*/
	_init() {
		let i, tabArea, boxArea, box, tab, tabs, tabID, groupID, tabItem, tabWrap;
		// tabArea
		tabArea = document.createElement('div');
		tabArea.className = "group_tab_area";
		this.container.appendChild(tabArea);
		// boxArea
		boxArea = document.createElement('div');
		boxArea.className = "group_box_area";
		this.container.appendChild(boxArea);
		if (this.setting.hasOwnProperty("tabs")) {
			tabs = this.setting["tabs"];
			tabWrap = document.createElement('div');
			tabWrap.className = "group_tab_div";
			tabArea.appendChild(tabWrap);
			for (i = 0; i < tabs.length; i = i + 1) {
				groupID = Object.keys(tabs[i])[0];
				if (this.authority.isViewable(groupID) || this.type === GroupBox.TYPE_DISPLAY) {
					if (!this.tabGroupToElems.hasOwnProperty(groupID)) {
						this.tabGroupToElems[groupID] = [];
					}
					tabItem = tabs[i][groupID];
					if (tabItem.hasOwnProperty('id')) {
						tabID = this.IDtoTabID(groupID);
					}
					this._add_tab(tabWrap, tabID, tabItem);
					this.tabIDs.push(tabID);
					this.groupIDs.push(groupID);
					box = this._add_box(boxArea, tabID, tabItem);
					this.tabGroupToElems[groupID].push(box);
					if (this.currentBoxArea === null) {
						this.currentBoxArea = box;
						this.currentGroupName = tabItem.name;
						this.groupIDToName[groupID] = tabItem.name;
					}
					if (tabItem.selected) {
						this.currentGroupID = groupID;
					}
				}
			}
			if (this.authority.isGroupManipulable()) {
				// 上へボタン
				this._add_updown_button(tabArea, "up");
				// 下へボタン
				this._add_updown_button(tabArea, "down");
				// 追加ボタン
				this._add_append_button(tabArea);
			}
		}
	}
	getCurrentBoxArea() {
		return this.currentBoxArea;
	}
	getTab(group) {
		let i, tab, tabItem;
		for (i = 0; i < this.setting.tabs.length; ++i) {
			tab = this.setting.tabs[i];
			if (Object.keys(tab)[0] === group) {
				tabItem = tab[Object.keys(tab)[0]];
				return document.getElementById(this.IDtoTabID(tabItem.id) + "_box");
			}
		}
		return null;
	}
	getCurrentGroupID() {
		return this.currentGroupID;
	}
	getGroupIDs() {
		return this.groupIDs;
	}
	getTabgroupToElems() {
		return this.tabGroupToElems;
	}
	selectTab(groupID) {
		let gname;
		if (this.tabGroupToElems.hasOwnProperty(groupID)) {
			this.tabGroupToElems[groupID][0].onclick();
		}
		return null;
	}
	getGroupName(groupID) {
		return this.groupIDToName[groupID];
	}
	isSelected(tabID) {
		let tab = document.getElementById(tabID);
		return tab.className.indexOf('active') >= 0;
	}
}

// グループ選択が切り替わった時呼ばれるイベント
GroupBox.EVENT_GROUP_CHANGED = "group_changed";
// グループのチェックの変更
//GroupBox.EVENT_GROUP_CHECK_CAHNGED = "group_check_changed";
// グループ削除イベント
GroupBox.EVENT_GROUP_DELETE = "group_delete";
// グループ追加イベント
GroupBox.EVENT_GROUP_APPEND = "group_append";
// グループを1つ上に移動
GroupBox.EVENT_GROUP_UP = "group_up";
// グループを1つ下に移動
GroupBox.EVENT_GROUP_DOWN = "group_down";
// グループ色変更
GroupBox.EVENT_GROUP_EDIT_COLOR = "group_edit_color";
// グループ名変更
GroupBox.EVENT_GROUP_EDIT_NAME = "group_edit_name";

GroupBox.TYPE_CONTENT = "content";
GroupBox.TYPE_DISPLAY = "display";

export default GroupBox;

