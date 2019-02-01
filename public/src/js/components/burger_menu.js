/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

class BurgerMenu extends EventEmitter 
{
	constructor(setting)
	{
		super();
		
		this.dom = document.createElement('div');
		this.dom.className = "burger_menu";

		/*
			<div class="burger_menu">
				<label class="burger_menu_icon" for="burger_menu_checkbox">≡</label>
				<label class="burger_menu_background" for="burger_menu_checkbox"></label>
				<div class="burger_menu_contents">
					<ul>
						<li>メニュー1</li>
						<li>メニュー2</li>
						<li>メニュー3</li>
					</ul>
				</div>
			</div>
		*/
		let i,
			ul,
			label_icon,
			label_background,
			div;

		label_icon = document.createElement("label");
		label_icon.innerHTML = "≡";
		label_icon.className = "burger_menu_icon";

		label_background = document.createElement("label");
		label_background.className = "burger_menu_background";

		div = document.createElement("div");
		div.className = "burger_menu_contents";

		this.dom.appendChild(label_icon);
		this.dom.appendChild(label_background);
		this.dom.appendChild(div);

		ul = document.createElement('ul');
		div.appendChild(ul);

		function label_click_func(evt) {
			let visible = (div.style.display === "none" || div.style.display === "");
			div.style.display = visible ? "block" : "none";
			
			if (visible) {
				label_background.style.opacity = 0.5;
				label_background.style.zIndex = 1000000;
			} else {
				label_background.style.opacity = 0.0;
				label_background.style.zIndex = -1;
			}
			label_background.onclick = label_icon.onclick;
		}
		this.toggle = label_click_func;
		label_icon.onclick = label_click_func;

		let createBurgerMenu = (setting, ul) => {
			let hr;

			for (let i = 0; i < setting.length; i = i + 1) 
			{
				let className = setting[i].className;
				if (className === 'hr') {
					hr = document.createElement('hr');
					hr.className = "burger_menu_margin";
					ul.appendChild(hr);
					continue;
				}
				let li = document.createElement('li');
				li.className = "burger_menu_content";
				li.classList.add(className);
				li.setAttribute('data-key', className);
				if (setting[i].hasOwnProperty('dataKey')) {
					li.setAttribute('data-key', setting[i].dataKey);
				}
				if (setting[i].onclick) {
					li.onclick = (function (func) {
						return function (evt) {
							let result = func(evt);
							if (result === undefined) {
								label_click_func(evt);
							}
						};
					}(setting[i].onclick));
				}
				if (setting[i].onmousedown) {
					li.onmousedown = (function (func) {
						return function (evt) {
							let result = func(evt);
							if (result === undefined) {
								label_click_func(evt);
							}
						};
					}(setting[i].onmousedown));
				}
				if (setting[i].onmouseover) {
					li.onmouseover = (function (func) {
						return function (evt) {
							func(evt);
						};
					}(setting[i].onmouseover));
				}
				if (setting[i].onmouseout) {
					li.onmouseout = (function (func) {
						return function (evt) {
							func(evt);
						};
					}(setting[i].onmouseout));
				}
				if (setting[i].submenu) {
					li.classList.add("burger_menu_content_submenu");
					let ul2 = document.createElement('ul');
					ul2.className = "burger_menu_submenu burger_menu_submenu_" + className;
					createBurgerMenu(setting[i].submenu, ul2);
					
					ul2.onLI = false;
					ul2.onSubMenu = false;

					li.onmouseover = ((ul2, bottomPixel) => {
						return (evt) => {
							this.showSubMenu(ul2, true, bottomPixel);
							ul2.onLI = true;
						};
					})(ul2, setting[i].submenuBottomPixel);
					
					li.onmouseout = ((ul2) => {
						return (evt) => {
							ul2.onLI = false;
						};
					})(ul2);
					
					ul2.onmouseover = ((ul2) => {
						return (evt) => {
							ul2.onSubMenu = true;
						};
					})(ul2);
					
					ul2.onmouseout = ((ul2) => {
						return (evt) => {
							ul2.onSubMenu = false;
						};
					})(ul2);

					this.dom.addEventListener('mousemove', ((ul2) => {
						return (evt) => {
							if (!ul2.onSubMenu && !ul2.onLI) {
								this.showSubMenu(ul2, false);
							}
						};
					})(ul2));
					div.appendChild(ul2);
				}
				ul.appendChild(li);
			}
		};
		createBurgerMenu(setting, ul);
	}

	getDOM() {
		return this.dom;
	}

	show(isShow) {
		if (isShow) {
			this.dom.style.display = "block";
		} else {
			this.dom.style.display = "none";
		} 
	}

	showSubMenu(container, isShow, bottomPixels) {
		if (isShow) {
			//this.initContextPos();
			container.style.display = "block";
			container.style.bottom = bottomPixels;
		} else {
			container.style.display = "none";
		}
	}
};

export default BurgerMenu;
