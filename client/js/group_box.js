/*jslint devel:true*/
/*global Float32Array */
(function (gui) {
	"use strict";
	var GroupBox,
		defaultGroup = "default";

	GroupBox = function (containerElem, setting) {
		this.container = containerElem;
		this.setting = setting;
		this.tabIDs = [];
		this.tabGroupToElems = {};
		this.currentTab = null;
		this.init();
	};

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
			groupName,
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
				elem.appendChild(this.create_tab(groupName, tabItem, i === 0));
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
			// 追加ボタン
			elem = document.createElement('div');
			elem.className = "group_tab_append";
			span = document.createElement('span');
			span.className = "group_tab_append_label";
			span.innerHTML = "+";
			elem.appendChild(span);
			elem.onclick = function (evt) {
				alert("not implemented");
			};
			tabArea.appendChild(elem);
            // search tab generate
            this.gen_search_tab_box();
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
	GroupBox.prototype.create_tab = function (groupName, tabContent, is_active) {
		var elem,
			link,
			close_button,
			span;
		elem = document.createElement('div');
		elem.id = tabContent.id;
		elem.className = is_active ? tabContent.className + " active" : tabContent.className;
		elem.style.cursor = "pointer";
		this.tabGroupToElems[groupName].push(elem);
		link = document.createElement('a');
		link.href = "#";
		link.id = tabContent.id + "_link";
		link.innerHTML = groupName;
		if (tabContent.hasOwnProperty('func')) {
			elem.onclick = function () {
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
				tabContent.func();
				if (window.group_box.on_tab_changed) {
					window.group_box.on_tab_changed();
				}
				this.currentTab = document.getElementById(tabContent.id + "_box");
				this.currentGroupName = groupName;
			}.bind(this);
		}
		elem.appendChild(link);
		
		if (groupName !== defaultGroup) {
			close_button = document.createElement('div');
			close_button.className = "group_tab_close";
			close_button.onclick = function (evt) {
				alert("not implemented");
			};
			span = document.createElement('span');
			span.innerHTML = "x";
			span.className = "group_tab_close_label";
			close_button.appendChild(span);
			elem.appendChild(close_button);
		}
		return elem;
	};

	GroupBox.prototype.delete_tab = function(groupName) {
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
						console.error("deleted", elem);
					}
					if(div.contains(elem)) {
						div.removeChild(elem);
						console.error("deleted", elem);
					}
				}
				this.currentTab = this.get_tab(defaultGroup);
				this.currentTab.style.display = "block";
			}
		}
	};

    GroupBox.prototype.gen_search_tab_box = function(){
        var e, f, g, h, i, j;
        var box = document.getElementById('search_tab_box');
        // タブの中の要素全体を包むラッパー
        e = document.createElement('div');
        e.style.display = 'flex';
        e.style.flexDirection = 'row';
        box.appendChild(e);
        // 検索窓とチェックボックスの入る左側のカラム
        f = document.createElement('div');
        f.style.width = '300px';
        f.style.height = '100%';
        f.style.display = 'flex';
        f.style.flexDirection = 'column';
        e.appendChild(f);
        // アイテムが並ぶ右側のカラム
        g = document.createElement('div');
        g.style.width = 'calc(100% - 300px)';
        g.style.height = '100%';
        e.appendChild(g);
        // 左カラム内、上段に検索ボックス
        h = document.createElement('input');
        h.type = 'text';
        h.style.display = 'block';
        h.style.width = '100%';
        f.appendChild(h);
        // 左カラム内、下段にチェックボックスが入るエリア
        h = document.createElement('div');
        h.style.display = 'block';
        h.style.width = '98%';
        h.style.padding = '1%';
        f.appendChild(h);

        // temp そのいち
        for(i = 0; i < 5; i++){
            j = document.createElement('div');
            e = document.createElement('input');
            e.id = 'check_temp_' + i;
            e.type = 'checkbox';
            e.style.display = 'inline-block';
            e.style.margin = '10px';
            j.appendChild(e);
            f = document.createElement('label');
            f.setAttribute('for', 'check_temp_' + i);
            f.textContent = 'check_temp_' + i;
            f.style.color = 'white';
            f.style.margin = '10px 5px';
            f.style.cursor = 'pointer';
            j.appendChild(f);
            h.appendChild(j);
        }

        // temp そのに
        for(i = 0; i < 3; i++){
            e = document.createElement('div');
            e.style.display = 'inline-block';
            e.style.margin = '20px';
            e.style.width = '150px';
            e.style.height = '150px';
            e.style.backgroundColor = 'skyblue';
            g.appendChild(e);
        }
    };

	function init(containerElem, setting) {
		return new GroupBox(containerElem, setting);
	}

	function is_active(tabID) {
		var tab = document.getElementById(tabID);
		return tab.className.indexOf('active') >= 0;
	}

	window.group_box = {};
	window.group_box.init = init;
	window.group_box.on_tab_changed = null;
	window.group_box.is_active = is_active;

}(window.controller_gui));
