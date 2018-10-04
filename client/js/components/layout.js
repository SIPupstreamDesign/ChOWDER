/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
(function () {
	"use strict";
	
	/**
	 *  画面分割レイアウト
	 */
	var Layout = function (setting) {
		this.panels = {};
		this.setting = setting;
		this.splitterSize = 2;
		this.layout(null, setting);
		this.resize();
		this.relocate();
		
		window.addEventListener('resize', function () {
			this.resize();
			this.relocate();
		}.bind(this));
	};

	function fitPosition(parent, setting, target) {
		var i,
			leftSum = 0,
			topSum = 0;
		if (setting.hasOwnProperty('position')) {
			target.style[setting.position] = "0px";
		} else {
			if (parent.direction === 'vertical') {
				for (i = 0; i < parent.contents.length; i = i + 1) {
					if (parent.contents[i].id === setting.id) {
						break;
					}
					leftSum = leftSum + parent.contents[i].currentSize;
				}
				target.style.left = leftSum + "px";
			} else {
				for (i = 0; i < parent.contents.length; i = i + 1) {
					if (parent.contents[i].id === setting.id) {
						break;
					}
					topSum = topSum + parent.contents[i].currentSize;
				}
				//console.log(target.id, topSum);
				target.style.top = topSum + "px";
			}
		}
	};

	Layout.prototype.relocate = function () {
		var panel,
			id,
			setting,
			parent,
			direction,
			size;

		for (id in this.panels) {
			panel = document.getElementById(id);
			setting = this.panels[id].setting;
			direction = this.panels[id].direction;
			parent = this.panels[id].parent;

			fitPosition(parent, setting, panel);
		}
	};

	function toNumber(s) {
		return Number(s.split("px").join(""));
	}

	Layout.prototype.resize = function () {
		var panel,
			id,
			setting,
			parent,
			direction,
			size;

		for (id in this.panels) {
			panel = document.getElementById(id);
			setting = this.panels[id].setting;
			direction = this.panels[id].direction;
			parent = this.panels[id].parent;
			if (setting.hasOwnProperty('zIndex')) {
				panel.style.zIndex = setting['zIndex'];
			}
			if (setting.hasOwnProperty('size')) {
				size = setting.size;
				if (direction === 'horizontal') {
					if (size.indexOf('px') > 0 && toNumber(size) < 0) {
						size = (window.innerHeight + toNumber(size)) + "px";
					}
					panel.style.height = size;
					setting.currentSize = toNumber(size);
					if (document.getElementById(parent.id).style.width) {
						panel.style.width = document.getElementById(parent.id).style.width;
					} else {
						panel.style.width = "100%";
					}
				} else {
					if (size.indexOf('px') > 0 && toNumber(size) < 0) {
						size = (window.innerWidth + toNumber(size)) + "px";
					}
					panel.style.width = size;
					setting.currentSize = toNumber(size);
					if (document.getElementById(parent.id).style.height) {
						panel.style.height = document.getElementById(parent.id).style.height;
					} else {
						panel.style.height = "100%";
					}
				}
			}
		}
	};

	Layout.prototype.setSplitBehavior = function (contents, splitter, i) {
		var prePos = 0,
			isLeftDown = false;

		splitter.addEventListener('mousedown', function (ev) {
			if (ev.button === 0) {
				isLeftDown = true;
			}
		});
		window.addEventListener('mousemove', function (ev) {
			var s,
				ca,
				cb,
				sa = null,
				sb = null,
				rect,
				mv;
			if (isLeftDown) {
				if (splitter.className === "ns_splitter") {
					rect = splitter.getBoundingClientRect();
					mv = ev.clientY - rect.top;
				} else {
					rect = splitter.getBoundingClientRect();
					mv = ev.clientX - rect.left;
				}
				ca = contents[i-1];
				cb = contents[i+1];
				if (ca.hasOwnProperty("size")) {
					s = toNumber(ca.size);
					sa = s + mv;
					if (ca.hasOwnProperty("minSize") && sa <= toNumber(ca.minSize)) {
						return;
					}
				}
				if (cb.hasOwnProperty("size")) {
					s = toNumber(cb.size);
					sb = s - mv;
					if (cb.hasOwnProperty("minSize") && sb <= toNumber(cb.minSize)) {
						return;
					}
				}
				if (sa !== null && sb !== null) {
					contents[i-1].size = String(sa) + "px";
					contents[i-1].currentSize = sa;
					contents[i+1].size = String(sb) + "px";
					contents[i+1].currentSize = sb;
					this.resize();
					this.relocate();
				}
			}
		}.bind(this));
		window.addEventListener('mouseup', function (ev) {
			isLeftDown = false;
		});
	}

	Layout.prototype.layout = function (parent, setting, i) {
		var i,
			k,
			contentElem,
			container,
			panel,
			splitter,
			size;

		if (parent) {
			container = document.getElementById(parent.id);
			if (setting.hasOwnProperty('id')) {
				panel = document.createElement('div');
				panel.id = setting.id + "_panel__";
				panel.style.position = "absolute";
				this.panels[setting.id + "_panel__"] = {
					direction : parent.direction,
					parent : parent,
					setting : setting
				};

				contentElem = document.getElementById(setting.id);
				contentElem.parentNode.removeChild(contentElem);
				panel.appendChild(contentElem);
				container.appendChild(panel);
			}
			if (setting.hasOwnProperty('splitter')) {
				splitter = document.createElement('div');
				splitter.id = parent.id + "_splitter__" + i;
				splitter.style.position = "absolute";
				splitter.style.backgroundColor = this.setting.color;
				if (parent.direction === 'horizontal') {
					splitter.style.width = "100%";
					splitter.style.height = setting.splitter;
					splitter.className = "ns_splitter";
				} else {
					splitter.style.width = setting.splitter;
					splitter.style.height = "100%";
					splitter.className = "ew_splitter";
				}
				this.setSplitBehavior(parent.contents, splitter, i);
				setting.id = splitter.id;
				this.panels[splitter.id] = {
					direction : parent.direction,
					parent : parent,
					setting : setting
				};
				container.appendChild(splitter);
			}
		}

		if (setting.hasOwnProperty('contents')) {
			for (i = 0; i < setting.contents.length; i = i + 1) {
				this.layout(setting, setting.contents[i], i);
			}
		}
	};

	window.Layout = Layout;
}());
