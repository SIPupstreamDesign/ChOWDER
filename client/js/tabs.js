/*jslint devel:true*/
/*global Float32Array */
(function () {
	"use strict";
	var Tabs;

	Tabs = function (containerElem, setting) {
		EventEmitter.call(this);
		this.container = containerElem;
		this.setting = setting;
		this.tabIDs = [];
		this.init();
	};
	Tabs.prototype = Object.create(EventEmitter.prototype);

	/*
		<div class="left_tab_area" id="left_tab_area">
			<span id="display_tab_title" class="display_tab_title"><a href="#" class="active" id="display_tab_link">Display</a></span>
			<span id="content_tab_title" class="content_tab_title active"><a href="#" id="content_tab_link">Content</a></span>
		</div>
	*/
	Tabs.prototype.init = function () {
		var i,
			tabArea,
			boxArea,
			box,
			tabs,
			tabName,
			tabItem,
			elem;

		// tabArea
		tabArea = document.createElement('div');
		tabArea.className = "content_tab_area";
		this.container.appendChild(tabArea);
	
		// boxArea
		boxArea = document.createElement('div');
		boxArea.className = "content_box_area";
		this.container.appendChild(boxArea);

		if (this.setting.hasOwnProperty("tabs")) {
			tabs = this.setting["tabs"];
			elem = document.createElement('div');
			tabArea.appendChild(elem);
		
			for (i = 0; i < tabs.length; i = i + 1) {
				tabName = Object.keys(tabs[i])[0];
				tabItem = tabs[i][tabName];
				console.log("tabname", tabName);
				elem.appendChild(this.create_tab(tabName, tabItem, i === 0));
				this.tabIDs.push(tabItem.id);
					
				box = document.createElement('div');
				box.id = tabItem.id + "_box";
				box.style.width = "100%";
				box.style.height = "100%";
				box.style.overflow = "auto";
				if (tabItem.hasOwnProperty('active') && tabItem['active']) {
					box.style.display = "block";
				} else {
					box.style.display = "none";
				}
				boxArea.appendChild(box);
			}
		}
	};

	/*
		<span id="display_tab_title" class="display_tab_title"><a href="#" class="active" id="display_tab_link">Display</a></span>
		<span id="content_tab_title" class="content_tab_title active"><a href="#" id="content_tab_link">Content</a></span>
		..
	*/
	Tabs.prototype.create_tab = function (tabName, tabContent, is_active) {
		var elem,
			link;
		elem = document.createElement('span');
		elem.id = tabContent.id;
		elem.className = is_active ? tabContent.id + " active" : tabContent.id;
		elem.style.cursor = "pointer";
		link = document.createElement('a');
		link.href = "#";
		link.id = tabContent.id + "_link";
		link.innerHTML = tabName;
		if (tabContent.hasOwnProperty('func')) {
			elem.onclick = function () {
				var i,
					tabElem;

				this.emit(Tabs.EVENT_TAB_CHANGED_PRE, null);
				
				for (i = 0; i < this.tabIDs.length; i = i + 1) {
					document.getElementById(this.tabIDs[i] + "_box").style.display = "none";
					tabElem = document.getElementById(this.tabIDs[i]); 
					tabElem.className = tabElem.className.split(" active").join("");
				}
				tabElem = document.getElementById(tabContent.id); 
				tabElem.className = tabElem.className + " active";
				document.getElementById(tabContent.id + "_box").style.display = "block";
				tabContent.func();
				
				this.emit(Tabs.EVENT_TAB_CHANGED_POST, null);
			}.bind(this);
		}
		elem.appendChild(link);
		return elem;
	};
	
	Tabs.prototype.change_tab = function (tabID) {
		var elem = document.getElementById(tabID);
		if (elem) {
			elem.onclick();
		}
	};

	Tabs.prototype.is_active = function (tabID) {
		if (!tabID) return false;
 		var tab = document.getElementById(tabID);
		return tab && tab.className.indexOf('active') >= 0;
	}

	Tabs.EVENT_TAB_CHANGED_PRE = "tab_changed_pre";
	Tabs.EVENT_TAB_CHANGED_POST = "tab_changed_post";
	window.Tabs = Tabs;

}());
