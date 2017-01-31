/*jslint devel:true*/
/*global Float32Array */
(function () {
	"use strict";
	var GroupBox,
		defaultGroup = "group_default";

	GroupBox = function (authority, containerElem, setting) {
		EventEmitter.call(this);
		this.container = containerElem;
		this.setting = setting;
		this.tabIDs = [];
		this.tabGroupToElems = {};
		this.groupIDToName = {};
		this.currentTab = null;
		this.authority = authority;
		this.init();
		this.currentGroupName = "";
	};
	GroupBox.prototype = Object.create(EventEmitter.prototype);

	/*
		<div class="left_tab_area" id="left_tab_area">
			<div id="display_tab_title" class="display_tab_title"><a href="#" class="active" id="display_tab_link">Display</a></div>
			<div id="content_tab_title" class="content_tab_title active"><a href="#" id="content_tab_link">Content</a></div>
		</div>
	*/
	GroupBox.prototype.init = function () {
		var i,
			tabArea,
			boxArea,
			box,
			tabs,
			tabID,
			groupName,
			groupID,
			groupColor = null,
			tabItem,
			elem,
			span;

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
			elem = document.createElement('div');
			elem.className = "group_tab_div";
			tabArea.appendChild(elem);
		
			for (i = 0; i < tabs.length; i = i + 1) {
				groupID = Object.keys(tabs[i])[0];
				if (this.authority.isViewable(groupID)) {
					if (!this.tabGroupToElems.hasOwnProperty(groupID)) {
						this.tabGroupToElems[groupID] = [];
					}
					tabItem = tabs[i][groupID];
					groupName = tabItem.name;
					if (tabItem.hasOwnProperty('color')) {
						groupColor = tabItem.color;
					}
					if (tabItem.hasOwnProperty('id')) {
						tabID = this.tabID(groupID);
					}
					elem.appendChild(this.create_tab(tabID, groupName, groupColor, tabItem, i === 0));
					this.tabIDs.push(tabID);

					box = document.createElement('div');
					box.id = tabID + "_box";
					box.className = tabItem.className + "_box";
					box.style.width = "100%";
					box.style.height = "100%";
					box.style.overflow = "auto";
					if (tabItem.hasOwnProperty('active') && tabItem['active']) {
						box.style.display = "block";
					} else {
						box.style.display = "none";
					}
					boxArea.appendChild(box);
					if (this.currentTab === null) {
						this.currentTab = box;
						this.currentGroupName = groupName;
						this.currentGroupID = groupID;
						this.groupIDToName[groupID] = groupName;
					}
					this.tabGroupToElems[groupID].push(box);
				}
			}
			if (this.authority.isGroupManipulable()) {
				// 上へボタン
				elem = document.createElement('div');
				elem.className = "group_tab_up";
				span = document.createElement('span');
				span.className = "group_tab_up_label";
				elem.setAttribute("title", "1つ上に移動");
				elem.appendChild(span);
				elem.onclick = function () {
					this.emit(GroupBox.EVENT_GROUP_UP, null, this.currentGroupID);
				}.bind(this);
				tabArea.appendChild(elem);

				// 下へボタン
				elem = document.createElement('div');
				elem.className = "group_tab_down";
				span = document.createElement('span');
				span.className = "group_tab_down_label";
				elem.setAttribute("title", "1つ下に移動");
				elem.appendChild(span);
				elem.onclick = function () {
					this.emit(GroupBox.EVENT_GROUP_DOWN, null, this.currentGroupID);
				}.bind(this);
				tabArea.appendChild(elem);

				// 追加ボタン
				elem = document.createElement('div');
				elem.className = "group_tab_append";
				span = document.createElement('span');
				span.className = "group_tab_append_label";
				span.innerHTML = "+";
				elem.setAttribute("title", "新規グループの追加");
				elem.appendChild(span);
				elem.onclick = function () {
					window.input_dialog.text_input({
							name : "新規グループ",
							initialValue :  "",
							okButtonName : "OK",
						}, function (value) {
							this.emit(GroupBox.EVENT_GROUP_APPEND, null, value);
						}.bind(this));
				}.bind(this);
				tabArea.appendChild(elem);
			}
		}
	};

	GroupBox.prototype.get_current_tab = function () {
		return this.currentTab;
	};

	GroupBox.prototype.get_tab = function (group) {
		var i,
			tab,
			tabItem;
		for (i = 0; i < this.setting.tabs.length; ++i) {
			tab = this.setting.tabs[i];
			if (Object.keys(tab)[0] === group) {
				tabItem = tab[Object.keys(tab)[0]]; 
				return document.getElementById(this.tabID(tabItem.id) + "_box");
			} 
		}
		return null;
	};

	GroupBox.prototype.get_current_group_id = function () {
		return this.currentGroupID;
	};

	GroupBox.prototype.tabID = function (id) {
		return this.container.id + "_" + id;
	};

	GroupBox.prototype.fromTabID = function (tabid) {
		return tabid.split(this.container.id + "_").join("");
	}

	/*
		<div id="display_tab_title" class="display_tab_title"><a href="#" class="active" id="display_tab_link">Display</a></div>
		<div id="content_tab_title" class="content_tab_title active"><a href="#" id="content_tab_link">Content</a></div>
		..
	*/
	GroupBox.prototype.create_tab = function (tabID, groupName, groupColor, tabContent, is_active) {
		var elem,
			link,
			setting_button,
			span;
		elem = document.createElement('div');
		elem.id = tabID;
		elem.className = is_active ? tabContent.className + " active" : tabContent.className;
		elem.style.cursor = "pointer";
		if (groupColor) {
			elem.style.backgroundColor = groupColor;
		}
		this.tabGroupToElems[this.fromTabID(tabID)].push(elem);
		this.groupIDToName[ this.fromTabID(tabID)] = groupName;
		link = document.createElement('a');
		link.href = "#";
		link.id = tabID + "_link";
		link.className = "group_tab_link";
		link.innerHTML = groupName;
		elem.onclick = function (evt) {
			var i,
				tabElem;
			for (i = 0; i < this.tabIDs.length; i = i + 1) {
				document.getElementById(this.tabIDs[i] + "_box").style.display = "none";
				tabElem = document.getElementById(this.tabIDs[i]);
				tabElem.className = tabElem.className.split(" active").join("");
			}
			tabElem = document.getElementById(tabID); 
			tabElem.className = tabElem.className + " active";
			document.getElementById(tabID + "_box").style.display = "block";
			if (tabContent.hasOwnProperty('func')) {
				tabContent.func();
			}
			this.emit(GroupBox.EVENT_GROUP_CHANGED, null, evt);
			this.currentTab = document.getElementById(tabID + "_box");
			this.currentGroupName = groupName;
			this.currentGroupID = this.fromTabID(tabID);
		}.bind(this);
		elem.appendChild(link);
		
		if ( this.fromTabID(tabID) !== defaultGroup && this.authority.isGroupManipulable()) {
			setting_button = document.createElement('div');
			setting_button.className = "group_tab_setting";
			setting_button.onclick = (function (self, groupName) {
				return function (evt) {
					var menu = document.getElementById('group_setting_menu'),
						background = new window.PopupBackground(),
						delete_button = document.getElementById('group_setting_delete'),
						name_button = document.getElementById('group_setting_name'),
						color_button = document.getElementById('group_setting_color');

					menu.style.display = "block";
					menu.style.top = evt.clientY + "px";
					menu.style.left = evt.clientX + "px";
					background.show();
					
					background.on('close', (function (menu) {
						return function () {
							menu.style.display = "none";
						}
					}(menu)));

					delete_button.onclick = function () {
						menu.style.display = "none";
						background.close();
						this.emit(GroupBox.EVENT_GROUP_DELETE, null, this.fromTabID(tabID));
					}.bind(self);

					name_button.onclick = function () {
						window.input_dialog.text_input({
								name : "グループ名変更",
								initialValue :  groupName,
								okButtonName : "OK",
							}, function (value) {
								this.emit(GroupBox.EVENT_GROUP_EDIT_NAME, null,  this.fromTabID(tabID), value);
							}.bind(this));
						menu.style.display = "none";
						background.close();
					}.bind(self);

					color_button.onclick = function () {
						window.input_dialog.color_input({
								name : "グループ色変更",
								initialValue : groupColor,
								okButtonName : "OK"
							}, function (value) {
								this.emit(GroupBox.EVENT_GROUP_EDIT_COLOR, null,  this.fromTabID(tabID), value);
							}.bind(this));
						menu.style.display = "none";
						background.close();
					}.bind(self);

				};
			}(this, groupName));
			span = document.createElement('span');
			span.className = "group_tab_setting_label";
			setting_button.appendChild(span);
			elem.appendChild(setting_button);
		}
		return elem;
	};

	GroupBox.prototype.get_tabgroup_to_elems = function () {
		return this.tabGroupToElems;
	};

	GroupBox.prototype.select_tab = function (groupID) {
		var gname;
		if (this.tabGroupToElems.hasOwnProperty(groupID)) {
			this.tabGroupToElems[groupID][0].onclick();
		}
		return null;
	};

	GroupBox.prototype.get_group_name = function (groupID) {
		return this.groupIDToName[groupID];
	}

	GroupBox.prototype.is_active = function (tabID) {
		var tab = document.getElementById(tabID);
		return tab.className.indexOf('active') >= 0;
	}

	// タブが切り替わった時呼ばれるイベント
	GroupBox.EVENT_GROUP_CHANGED = "group_changed";
	// タブのxを押したときに呼ばれるイベント
	GroupBox.EVENT_GROUP_DELETE = "group_delete";
	// タブの+を押したときに呼ばれるイベント
	GroupBox.EVENT_GROUP_APPEND = "group_append";
	//タブを1つ上に移動
	GroupBox.EVENT_GROUP_UP = "group_up";
	// タブを1つ下に移動
	GroupBox.EVENT_GROUP_DOWN = "group_down";
	// グループ色変更
	GroupBox.EVENT_GROUP_EDIT_COLOR = "group_edit_color";
	// グループ名変更
	GroupBox.EVENT_GROUP_EDIT_NAME = "group_edit_name";

	window.GroupBox = GroupBox;
}());
