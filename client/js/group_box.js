/*jslint devel:true*/
/*global Float32Array */
(function () {
	"use strict";
	var GroupBox;

	GroupBox = function (authority, containerElem, setting, type) {
		EventEmitter.call(this);
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
	};
	GroupBox.prototype = Object.create(EventEmitter.prototype);

	GroupBox.prototype.IDtoTabID = function (id) {
		return this.container.id + "_" + id;
	};

	GroupBox.prototype.TabIDtoID = function (tabid) {
		return tabid.split(this.container.id + "_").join("");
	}

	// /**
	//  * チェックボックスを追加. 
	//  * @param {*} group_div 
	//  * @param {*} tabID 
	//  * @param {*} is_checked 
	//  */
	// GroupBox.prototype._add_checkbox = function (group_div, tabID, is_checked) {
	// 	var checkbox = document.createElement('input');
	// 	checkbox.id = 'display_check_' + tabID;
	// 	checkbox.className = "display_group_checkbox";
	// 	checkbox.type = 'checkbox';
	// 	group_div.appendChild(checkbox);
	// 	checkbox.onchange = function (tabID) {
	// 		this.emit(GroupBox.EVENT_GROUP_CHECK_CAHNGED, null, this.TabIDtoID(tabID), checkbox.checked);
	// 	}.bind(this, tabID);
		
	// 	checkbox.onclick = function (evt) { 
	// 		evt.stopPropagation();
	// 	};
	// 	checkbox.checked = is_checked;
	// }

	/**
	 * 設定ボタンの追加
	 * @param {*} parent 
	 * @param {*} tabID 
	 * @param {*} groupName 
	 * @param {*} groupColor 
	 */
	GroupBox.prototype._add_setting_button = function (parent, tabID, groupName, groupColor) {
		var span;
		var setting_button = document.createElement('div');
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
					this.emit(GroupBox.EVENT_GROUP_DELETE, null, this.TabIDtoID(tabID));
				}.bind(self);

				name_button.onclick = function () {
					window.input_dialog.text_input({
							name : i18next.t('change_group_name'),
							initialValue :  groupName,
							okButtonName : "OK",
						}, function (value) {
							this.emit(GroupBox.EVENT_GROUP_EDIT_NAME, null,  this.TabIDtoID(tabID), value);
						}.bind(this));
					menu.style.display = "none";
					background.close();
				}.bind(self);

				color_button.onclick = function () {
					window.input_dialog.color_input({
							name : i18next.t('change_group_color'),
							initialValue : groupColor,
							okButtonName : "OK"
						}, function (value) {
							this.emit(GroupBox.EVENT_GROUP_EDIT_COLOR, null,  this.TabIDtoID(tabID), value);
						}.bind(this));
					menu.style.display = "none";
					background.close();
				}.bind(self);

			};
		}(this, groupName));
		span = document.createElement('span');
		span.className = "group_tab_setting_label";
		setting_button.appendChild(span);
		parent.appendChild(setting_button);
		return setting_button;
	};

	/**
	 * ラベルの追加
	 * @param {*} parent 
	 * @param {*} tabID 
	 * @param {*} text 
	 */
	GroupBox.prototype._add_label = function (parent, tabID, text) {
		var label = document.createElement('span');
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
	GroupBox.prototype._add_tab = function (parent, tabID, tabItem) {
		var inner_group_div,
			elem,
			groupName = tabItem.name,
			groupColor = tabItem.hasOwnProperty('color') ? tabItem.color : null;

		inner_group_div = document.createElement('div');
		inner_group_div.className = "inner_group_div";

		elem = document.createElement('div');
		elem.appendChild(inner_group_div)
		elem.id = tabID;
		elem.className = tabItem.selected ? tabItem.className + " active" : tabItem.className;
		elem.style.cursor = "pointer";
		if (!groupColor) {
			if (this.type === GroupBox.TYPE_DISPLAY) {
				elem.style.backgroundColor = "#0080FF";
			} else {
				elem.style.backgroundColor = "rgb(54,187,68)";
			}
		}
		if (groupColor) {
			elem.style.backgroundColor = groupColor;
		}
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
			if (tabItem.hasOwnProperty('func')) {
				tabItem.func();
			}
			this.currentBoxArea = document.getElementById(tabID + "_box");
			this.currentGroupName = groupName;
			this.currentGroupID = this.TabIDtoID(tabID);
			this.emit(GroupBox.EVENT_GROUP_CHANGED, null, evt);
		}.bind(this);
		this.tabGroupToElems[this.TabIDtoID(tabID)].push(elem);
		this.groupIDToName[ this.TabIDtoID(tabID)] = groupName;

		// if (this.type === GroupBox.TYPE_DISPLAY) {
		// 	this._add_checkbox(inner_group_div, tabID, tabItem.checked);
		// }
		
		this._add_label(inner_group_div, tabID, groupName);

		if ( this.TabIDtoID(tabID) !== Constants.DefaultGroup && this.authority.isGroupManipulable()) {
			this._add_setting_button(inner_group_div, tabID, groupName, groupColor);
		}
		parent.appendChild(elem);
		return elem;
	};

	/**
	 * 上下移動ボタンの追加
	 * @param {*} parent 
	 * @param {*} direction "up" or "down"
	 */
	GroupBox.prototype._add_updown_button = function (parent, direction) {
		var elem = document.createElement('div');
		var span = document.createElement('span');
		span.className = "group_tab_" +direction+ "_label";
		elem.className = "group_tab_" +direction+ " " + "group_tab_" + direction + "_" + this.type;
		elem.setAttribute("title",  i18next.t("move_" + direction));
		elem.appendChild(span);
		elem.onclick = function () {
			if (direction === "up") {
				this.emit(GroupBox.EVENT_GROUP_UP, null, this.currentGroupID);
			} else {
				this.emit(GroupBox.EVENT_GROUP_DOWN, null, this.currentGroupID);
			}
		}.bind(this);
		parent.appendChild(elem);
	};

	/**
	 * 追加ボタンの追加
	 * @param {*} parent 
	 */
	GroupBox.prototype._add_append_button = function (parent) {
		var elem = document.createElement('div');
		var span = document.createElement('span');
		elem.className = "group_tab_append" + " " + "group_tab_down_" + this.type;
		span.className = "group_tab_append_label";
		span.innerHTML = "+";
		elem.setAttribute("title", i18next.t('add_new_group'));
		elem.appendChild(span);
		elem.onclick = function () {
			window.input_dialog.text_input({
					name : i18next.t('new_group'),
					initialValue :  "",
					okButtonName : "OK",
				}, function (value) {
					this.emit(GroupBox.EVENT_GROUP_APPEND, null, value);
				}.bind(this));
		}.bind(this);
		parent.appendChild(elem);
		return elem;
	};

	/**
	 * 
	 * @param {*} parent 
	 * @param {*} tabID 
	 * @param {*} tabItem 
	 */
	GroupBox.prototype._add_box = function (parent, tabID, tabItem) {
		var box = document.createElement('div');
		box.id = tabID + "_box";
		box.className = tabItem.className + "_box";
		box.style.width = "100%";
		box.style.height = "100%";
		box.style.overflow = "auto";
		if (tabItem.hasOwnProperty('selected') && tabItem['selected']) {
			box.style.display = "block";
		} else {
			box.style.display = "none";
		}
		
		parent.appendChild(box);
		return box;
	};
	
	/*
		<div class="left_tab_area" id="left_tab_area">
			<div id="display_tab_title" class="display_tab_title"><span class="active" id="display_tab_link">Display</span></div>
			<div id="content_tab_title" class="content_tab_title active"><span id="content_tab_link">Content</span></div>
		</div>
	*/
	GroupBox.prototype._init = function () {
		var i,
			tabArea,
			boxArea,
			box,
			tab,
			tabs,
			tabID,
			groupID,
			tabItem,
			tabWrap;

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
	};



	GroupBox.prototype.get_current_box_area = function () {
		return this.currentBoxArea;
	};

	GroupBox.prototype.get_tab = function (group) {
		var i,
			tab,
			tabItem;
		for (i = 0; i < this.setting.tabs.length; ++i) {
			tab = this.setting.tabs[i];
			if (Object.keys(tab)[0] === group) {
				tabItem = tab[Object.keys(tab)[0]]; 
				return document.getElementById(this.IDtoTabID(tabItem.id) + "_box");
			} 
		}
		return null;
	};

	GroupBox.prototype.get_current_group_id = function () {
		return this.currentGroupID;
	};

	GroupBox.prototype.get_group_ids = function () {
		return this.groupIDs;
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

	GroupBox.prototype.is_selected = function (tabID) {
		var tab = document.getElementById(tabID);
		return tab.className.indexOf('active') >= 0;
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

	window.GroupBox = GroupBox;
}());
