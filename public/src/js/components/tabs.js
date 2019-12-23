/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */


"use strict";

class Tabs extends EventEmitter {
	constructor(setting) {
		super();
		this.dom = document.createElement('span');
		this.setting = setting;
		this.tabIDs = [];
		this.init();
	}

	/*
		<div class="left_tab_area" id="left_tab_area">
			<span id="display_tab_title" class="display_tab_title"><span class="active" id="display_tab_link">Display</span></span>
			<span id="content_tab_title" class="content_tab_title active"><span id="content_tab_link">Content</span></span>
		</div>
	*/
	init() {
		// tabArea
		let tabArea = document.createElement('div');
		tabArea.className = "content_tab_area";
		this.dom.appendChild(tabArea);
		// boxArea
		let boxArea = document.createElement('div');
		boxArea.className = "content_box_area";
		this.dom.appendChild(boxArea);

		let elem = document.createElement('div');
		tabArea.appendChild(elem);
		for (let i = 0; i < this.setting.length; i = i + 1) {
			let tabItem = this.setting[i]
			let tabName = this.setting[i].name;
			elem.appendChild(this.createTab(tabName, tabItem, i === 0));
			this.tabIDs.push(tabItem.id);
			let box = document.createElement('div');
			box.id = tabItem.id + "_box";
			box.className = "tabs_tab_box";
			if (tabItem.hasOwnProperty('active') && tabItem['active']) {
				box.style.display = "block";
			}
			else {
				box.style.display = "none";
			}
			boxArea.appendChild(box);
		}
	}
	/*
		<span id="display_tab_title" class="display_tab_title"><span class="active" id="display_tab_link">Display</span></span>
		<span id="content_tab_title" class="content_tab_title active"><span id="content_tab_link">Content</span></span>
		..
	*/
	createTab(tabName, tabContent, isActive) {
		let elem, link;
		elem = document.createElement('span');
		elem.id = tabContent.id;
		elem.className = isActive ? tabContent.id + " active" : tabContent.id;
		elem.style.cursor = "pointer";
		link = document.createElement('span');
		link.className = "tab_title";
		link.id = tabContent.id + "_link";
		link.innerHTML = tabName;
		if (tabContent.hasOwnProperty('onclick')) {
			elem.onclick = () => {
				let i, tabElem;
				this.emit(Tabs.EVENT_TAB_CHANGED_PRE, null);
				for (i = 0; i < this.tabIDs.length; i = i + 1) {
					document.getElementById(this.tabIDs[i] + "_box").style.display = "none";
					tabElem = document.getElementById(this.tabIDs[i]);
					tabElem.className = tabElem.className.split(" active").join("");
				}
				tabElem = document.getElementById(tabContent.id);
				tabElem.className = tabElem.className + " active";
				document.getElementById(tabContent.id + "_box").style.display = "block";
				tabContent.onclick();
				this.emit(Tabs.EVENT_TAB_CHANGED_POST, null);
			};
		}
		elem.appendChild(link);
		return elem;
	}
	changeTab(tabID) {
		let elem = document.getElementById(tabID);
		if (elem) {
			elem.onclick();
		}
	}
	isActive(tabID) {
		if (!tabID)
			return false;
		let tab = document.getElementById(tabID);
		return tab && tab.className.indexOf('active') >= 0;
	}

	getDOM() {
		return this.dom;
	}
}

Tabs.EVENT_TAB_CHANGED_PRE = "tab_changed_pre";
Tabs.EVENT_TAB_CHANGED_POST = "tab_changed_post";
export default Tabs;
