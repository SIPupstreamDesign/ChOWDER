/*jslint devel:true*/
/*global Float32Array */
(function () {
	"use strict";
	var GroupBox,
		defaultGroup = "default";

	GroupBox = function (containerElem, setting) {
		EventEmitter.call(this);
		this.container = containerElem;
		this.setting = setting;
		this.tabIDs = [];
		this.tabGroupToElems = {};
		this.currentTab = null;
		this.init();
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
			id,
			groupName,
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
				groupName = Object.keys(tabs[i])[0];
				if (!this.tabGroupToElems.hasOwnProperty(groupName)) {
					this.tabGroupToElems[groupName] = [];
				}
				tabItem = tabs[i][groupName];
				if (tabItem.hasOwnProperty('color')) {
					groupColor = tabItem.color;
				}
				if (tabItem.hasOwnProperty('id')) {
					id = tabItem.id;
				}
				elem.appendChild(this.create_tab(id, groupName, groupColor, tabItem, i === 0));
				this.tabIDs.push(tabItem.id);

				box = document.createElement('div');
				box.id = tabItem.id + "_box";
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
				}
				
				this.tabGroupToElems[groupName].push(box);
			}
			// 上へボタン
			elem = document.createElement('div');
			elem.className = "group_tab_up";
			span = document.createElement('span');
			span.className = "group_tab_up_label";
			elem.setAttribute("title", "1つ上に移動");
			elem.appendChild(span);
			elem.onclick = function () {
				this.emit(GroupBox.EVENT_GROUP_UP, null, this.currentGroupName);
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
				this.emit(GroupBox.EVENT_GROUP_DOWN, null, this.currentGroupName);
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
				return document.getElementById(tabItem.id + "_box");
			} 
		}
		return null;
	};

	GroupBox.prototype.get_current_group_name = function () {
		return this.currentGroupName;
	};

	/*
		<div id="display_tab_title" class="display_tab_title"><a href="#" class="active" id="display_tab_link">Display</a></div>
		<div id="content_tab_title" class="content_tab_title active"><a href="#" id="content_tab_link">Content</a></div>
		..
	*/
	GroupBox.prototype.create_tab = function (groupID, groupName, groupColor, tabContent, is_active) {
		var elem,
			link,
			setting_button,
			span;
		elem = document.createElement('div');
		elem.id = tabContent.id;
		elem.className = is_active ? tabContent.className + " active" : tabContent.className;
		elem.style.cursor = "pointer";
		if (groupColor) {
			elem.style.backgroundColor = groupColor;
		}
		this.tabGroupToElems[groupName].push(elem);
		link = document.createElement('a');
		link.href = "#";
		link.id = tabContent.id + "_link";
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
			tabElem = document.getElementById(tabContent.id); 
			tabElem.className = tabElem.className + " active";
			document.getElementById(tabContent.id + "_box").style.display = "block";
			if (tabContent.hasOwnProperty('func')) {
				tabContent.func();
			}
			this.emit(GroupBox.EVENT_GROUP_CHANGED, null, evt);
			this.currentTab = document.getElementById(tabContent.id + "_box");
			this.currentGroupName = groupName;
		}.bind(this);
		elem.appendChild(link);
		
		if (groupName !== defaultGroup) {
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
						this.emit(GroupBox.EVENT_GROUP_DELETE, null, groupID);
					}.bind(self);

					name_button.onclick = function () {
						window.input_dialog.text_input({
								name : "グループ名変更",
								initialValue :  groupName,
								okButtonName : "OK",
							}, function (value) {
								this.emit(GroupBox.EVENT_GROUP_EDIT_NAME, null, groupID, value);
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
								this.emit(GroupBox.EVENT_GROUP_EDIT_COLOR, null, groupID, value);
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

	GroupBox.prototype.close_tab = function(groupName) {
		var i,
			div,
			elem,
			parent = null;
		
		if (groupName === defaultGroup) {
			return;
		}
		if (this.tabGroupToElems.hasOwnProperty(groupName)) {
			parent = this.container.getElementsByClassName("group_box_area")[0];
			div = this.container.getElementsByClassName("group_tab_div")[0];
			if (parent && div) {
				for (i = 0; i < this.tabGroupToElems[groupName].length; ++i) {
					elem = this.tabGroupToElems[groupName][i];
					if(parent.contains(elem)) {
						parent.removeChild(elem);
					}
					if(div.contains(elem)) {
						div.removeChild(elem);
					}
				}
				this.currentTab = this.get_tab(defaultGroup);
				this.currentTab.style.display = "block";
			}
		}
	};

	GroupBox.prototype.get_tabgroup_to_elems = function () {
		return this.tabGroupToElems;
	};

	GroupBox.prototype.get_active_tab_name = function () {
		var gname;
		for (gname in this.tabGroupToElems) {
			if (this.tabGroupToElems.hasOwnProperty(gname)) {
				if (this.tabGroupToElems[gname][0].className.indexOf('active') >= 0) {
					return gname;
				}
			}
		}
		return null;
	};

	GroupBox.prototype.select_tab = function (groupName) {
		var gname;
		if (this.tabGroupToElems.hasOwnProperty(groupName)) {
			this.tabGroupToElems[groupName][0].onclick();
		}
		return null;
	};

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
