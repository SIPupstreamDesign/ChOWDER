/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

function calcMinSize(rect, content) {
	let minSize = toNumber(content.minSize);
	if (minSize < 0) {
		minSize = (rect.right-rect.left) + minSize;
	}
	return minSize;
}

function toNumber(s) {
	return Number(s.split("px").join(""));
}

function fitPosition(parent, setting, target) {
	let i,
		leftSum = 0,
		topSum = 0;
	if (setting.hasOwnProperty('position')) {
		target.style[setting.position] = "0px";
	} else {
		if (parent.direction === 'vertical') {
			for (i = 0; i < parent.contents.length; i = i + 1) {
				if (parent.contents[i].className === setting.className) {
					break;
				}
				leftSum = leftSum + parent.contents[i].currentSize;
			}
			target.style.left = leftSum + "px";
		} else {
			for (i = 0; i < parent.contents.length; i = i + 1) {
				if (parent.contents[i].className === setting.className) {
					break;
				}
				topSum = topSum + parent.contents[i].currentSize;
			}
			target.style.top = topSum + "px";
		}
	}
}

class Layout extends EventEmitter
{
	constructor(setting) {
		super();
		
		this.mouseUpFunc = this.mouseUpFunc();
		this.mouseDownFunc = this.mouseDownFunc();

		this.setting = setting;
		this.splitterSize = 2;
		this.panels = {};
		this.layout( null, setting, 0, 0);
		this.resize();
		this.relocate();
		this.isLeftDownDOM = null;

		this.resizeFunc = () => {
			this.resize();
			this.relocate();
		};
		
		window.addEventListener('resize', this.resizeFunc);
		window.addEventListener('pointerup', this.mouseUpFunc);
	}
		
	release() {
		for (let i in this.panels) {
			if (i.indexOf("splitter__") >= 0 && this.panels[i].elem) {
				window.removeEventListener('pointermove', this.panels[i].elem.mouseMoveFunc);
				this.panels[i].elem.mouseMoveFunc = null;
				this.panels[i].elem.removeEventListener('pointerdown', this.mouseDownFunc);
			}
		}
		window.removeEventListener('resize', this.resizeFunc);
		window.removeEventListener('pointerup', this.mouseUpFunc);
		this.resizeFunc = null;
	}

	mouseMoveFunc(parent, contents, splitter, i) {
		return (ev) => {
			let s,
				ca,
				cb,
				sa = null,
				sb = null,
				container,
				rect,
				mv;
			if (this.isLeftDownDOM == splitter) {
				if (splitter.classList.contains("layout_ns_splitter")) {
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
					if (ca.hasOwnProperty("minSize")) {
						container = document.getElementsByClassName(parent.className)[0];
						rect = container.getBoundingClientRect();
						let minSize = calcMinSize(rect, ca);

						if (toNumber(ca.size) < 0) {
							if (container) {
								let pos = (rect.right-rect.left) + sa;
								if (pos <= minSize) {
									return;
								}
							}
						} else if (sa <= minSize) {
							return;
						}
					}
				}
				if (cb.hasOwnProperty("size")) {
					s = toNumber(cb.size);
					sb = s - mv;
					if (cb.hasOwnProperty("minSize")) {
						container = document.getElementsByClassName(parent.className)[0];
						rect = container.getBoundingClientRect();
						let minSize = calcMinSize(rect, cb);

						if (toNumber(cb.size) < 0) {
							if (container) {
								let pos = (rect.right-rect.left) + sb;
								if (pos <= minSize) {
									return;
								}
							}
						} else if (sb <= minSize) {
							return;
						}
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
		};
	}
	
	mouseUpFunc() {
		return (ev) => {
			this.isLeftDownDOM = null;
		};
	}

	mouseDownFunc() {
		return (ev) => {
			if (ev.button === 0) {
				this.isLeftDownDOM = ev.target;
			}
		};
	}

	setSplitBehavior(parent, contents, splitter, i) {
		let prePos = 0;

		splitter.mouseMoveFunc = this.mouseMoveFunc(parent, contents, splitter, i);
		splitter.addEventListener('pointerdown', this.mouseDownFunc);
		window.addEventListener('pointermove', splitter.mouseMoveFunc);
	}

	layout(parent, setting, classKey, index) {
		let k,
			contentElem,
			container,
			panel,
			splitter,
			size;

		if (parent) {
			container = document.getElementsByClassName(parent.className)[0];
			if (setting.hasOwnProperty('className')) {
				panel = document.createElement('div');
				panel.setAttribute("touch-action", "none");
				let panelClass = setting.className + "_panel__";
				if (!panel.classList.contains(panelClass)) {
					panel.classList.add(panelClass);
				}
				panel.style.position = "absolute";
				this.panels[setting.className  + "_panel__"] = {
					direction : parent.direction,
					parent : parent,
					setting : setting,
					elem : panel
				};

				contentElem = document.getElementsByClassName(setting.className)[0];
				contentElem.parentNode.removeChild(contentElem);
				panel.appendChild(contentElem);
				container.appendChild(panel);
			}
			if (setting.hasOwnProperty('splitter')) {
				splitter = document.createElement('div');
				splitter.setAttribute("touch-action", "none");
				let splitterClass = "splitter__" + classKey;
				if (!splitter.classList.contains(splitterClass)) {
					splitter.classList.add(splitterClass);
				}
				splitter.style.position = "absolute";
				splitter.style.backgroundColor = this.setting.color;
				if (parent.direction === 'horizontal') {
					splitter.style.width = "100%";
					splitter.style.height = setting.splitter;
					splitter.classList.add("layout_ns_splitter");
				} else {
					splitter.style.width = setting.splitter;
					splitter.style.height = "100%";
					splitter.classList.add("layout_ew_splitter");
				}
				this.setSplitBehavior(parent, parent.contents, splitter, index);
				setting.className = splitterClass;
				this.panels[splitterClass] = {
					direction : parent.direction,
					parent : parent,
					setting : setting,
					elem : splitter
				};
				container.appendChild(splitter);
			}
		}

		if (setting.hasOwnProperty('contents')) {
			for (let i = 0; i < setting.contents.length; i = i + 1) {
				this.layout(setting, setting.contents[i], classKey + "_" + i, i);
			}
		}
	}

	setSetting(setting) {
		this.setting = setting;
		for (let i in this.panels) {
			let elem = this.panels[i].elem;
			if (i.indexOf("splitter__") >= 0 && this.panels[i].elem) {
				this.panels[i].elem.removeEventListener('pointerdown', this.mouseDownFunc);
			}
			elem.parentNode.removeChild(elem);
		}
		this.panels = {};
		this.layout(this, null, setting, 0, 0);
		this.resize();
		this.relocate();
	}

	relocate() {
		let panel,
			className,
			setting,
			parent,
			direction,
			size;

		for (className in this.panels) {
			panel = document.getElementsByClassName(className)[0];
			setting = this.panels[className].setting;
			direction = this.panels[className].direction;
			parent = this.panels[className].parent;

			fitPosition(parent, setting, panel);
		}
	}

	resize() {
		let panel,
			className,
			setting,
			parent,
			direction,
			size;

		for (className in this.panels) {
			panel = document.getElementsByClassName(className)[0];
			setting = this.panels[className].setting;
			direction = this.panels[className].direction;
			parent = this.panels[className].parent;
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
					if (document.getElementsByClassName(parent.className)[0].style.width) {
						panel.style.width = document.getElementsByClassName(parent.className)[0].style.width;
					} else {
						panel.style.width = "100%";
					}
				} else {
					if (size.indexOf('px') > 0 && toNumber(size) < 0) {
						size = (window.innerWidth + toNumber(size)) + "px";
					}
					panel.style.width = size;
					setting.currentSize = toNumber(size);
					if (document.getElementsByClassName(parent.className)[0].style.height) {
						panel.style.height = document.getElementsByClassName(parent.className)[0].style.height;
					} else {
						panel.style.height = "100%";
					}
				}
			}
		}
		this.emit(Layout.EVENT_RESIZE, null);
	};
}


/**
 * example
 * 
	let bigZIndex = 10000;
	let setting = {
		className : 'layout',
		direction : 'horizontal',
		color : 'rgb(112, 180, 239)',
		contents : [
			{
				className : 'head_menu',
				position : 'top',
				size : "30px",
				minSize : "30px",
				zIndex : 1000000
			},
			{
				className : 'layout2',
				size : "-253px",
				direction : 'vertical',
				contents : [
					{
						className : 'preview_area',
						size : "-263px"
					},
					{
						size : "3px",
						splitter : "3px",
						zIndex : bigZIndex
					},
					{
						className : 'rightArea',
						position : 'right',
						size : "260px",
						minSize : "150px"
					}
				]
			},
			{
				size : "3px",
				splitter : "3px",
				zIndex : bigZIndex
			},
			{
				className : 'bottom_area',
				size : "220px",
				minSize : "100px"
			}]
		};

	new Layout(setting);
}
*/
Layout.EVENT_RESIZE = "resize";

export default Layout;

