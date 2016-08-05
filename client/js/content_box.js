/*jslint devel:true*/
/*global Float32Array */
(function (gui) {
	"use strict";
	var ContentBox,
		content_box;

	ContentBox = function (containerElem, setting) {
		this.container = containerElem;
		this.setting = setting;
		this.tabIDs = [];
		this.init();
	};

	/*
		<div class="left_tab_area" id="left_tab_area">
			<span id="display_tab_title" class="display_tab_title"><a href="#" class="active" id="display_tab_link">Display</a></span>
			<span id="content_tab_title" class="content_tab_title active"><a href="#" id="content_tab_link">Content</a></span>
		</div>
	*/
	ContentBox.prototype.init = function () {
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
		tabArea.className = "tabArea";
		tabArea.style.width = "100%"
		tabArea.style.height = "30px";
		tabArea.style.position = "absolute";
		this.container.appendChild(tabArea);
	
		// boxArea
		boxArea = document.createElement('div');
		boxArea.className = "boxArea";
		boxArea.style.width = "100%";
		boxArea.style.height = "100%";
		boxArea.style.paddingTop = "30px";
		this.container.appendChild(boxArea);

		if (this.setting.hasOwnProperty("tabs")) {
			tabs = this.setting["tabs"];
			elem = document.createElement('div');
			tabArea.appendChild(elem);
		
			for (i = 0; i < tabs.length; i = i + 1) {
				tabName = Object.keys(tabs[i])[0];
				tabItem = tabs[i][tabName];
				console.log("tabname", tabName);
				elem.appendChild(this.createTab(tabName, tabItem));
				this.tabIDs.push(tabItem.id);
					
				box = document.createElement('div');
				box.id = tabItem.id + "_box";
				box.style.width = "100%";
				box.style.height = "100%";
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
	ContentBox.prototype.createTab = function (tabName, tabContent) {
		var elem,
			link;
		elem = document.createElement('span');
		elem.id = tabContent.id;
		elem.className = tabContent.id; 
		link = document.createElement('a');
		link.href = "#";
		link.id = tabContent.id + "_link";
		link.innerHTML = tabName;
		if (tabContent.hasOwnProperty('func')) {
			link.onclick = function () {
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
			}.bind(this);
		}
		elem.appendChild(link);
		return elem;
	};

	function init(containerElem) {
		var setting = {
			tabs : [{
					Display : {
						id : "display_tab",
						func : function () { document.getElementById('display_tab_title').click(); },
						active : true,
					},
				}, {
					Content : {
						id : "content_tab",
						func : function () { document.getElementById('content_tab_title').click(); }
					},
				}, {
					Search : {
						id : "search_tab",
						func : function () { /*document.getElementById('search_tab_title').click();*/ }
					}
				}]
		};
		content_box = new ContentBox(containerElem, setting);
	}

	window.content_box = {};
	window.content_box.init = init;

}(window.controller_gui));
