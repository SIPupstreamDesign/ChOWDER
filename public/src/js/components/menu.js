/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import PopupBackground from './popup_background.js';

"use strict";

class Menu extends EventEmitter {
	constructor(type, setting) {
		super();

		/*
		<div class="head_menu" >
			<div class="head_mode_menu">
				<div class="head_mode_text stopselect">
					<a href="index.html" class="chowder_text">ChOWDER</a>
				</div>
			</div>
			..
		</div>
		*/

		this.dom = document.createElement('div');

		// タイトルdiv
		let headModeMenu = document.createElement('div');
		headModeMenu.className = "head_mode_menu";
		this.dom.appendChild(headModeMenu);

		// タイトル
		if (type === "controller") {
			// タイトル リンク有り
			let headModeText = document.createElement('div');
			headModeText.className = "head_mode_text stopselect";
			let headModeTextContent = document.createElement('a');
			headModeTextContent.href = "index.html";
			headModeTextContent.textContent = "ChOWDER";
			headModeTextContent.className = "chowder_text";
			headModeText.appendChild(headModeTextContent);
			headModeMenu.appendChild(headModeText);

			/*
			<div class="head_menu_hover">
				<span class="snap_text">Snap:</span>
				<select class="head_menu_hover_left">
					<option id="snap_free_option" value="free">free</option>
					<option id="snap_display_option" value="display" style="display:none">display</option>
					<option id="snap_grid_option" value="grid">grid</option>
				</select>
				<span id="user_label">User:</span>
				<span id="user_text"></span>
				<input id="logout_button" type="button" class="" value="Logout" />
				<div id="head_menu_hover_right"></div>
				<img style="display:none" src="../image/disconnect.png"/><!--←キャッシュ-->
				<span class="head_id_menu">
					<span id="change_id_text">Controller ID:</span>
					<input type="text" class="head_id_input" id="controller_id" />
				</span>
			</div>
			*/

			let headMenuHover = document.createElement('div');
			headMenuHover.className = "head_menu_hover";
			this.dom.appendChild(headMenuHover);

			let snapText = document.createElement('span');
			snapText.className = "snap_text";
			snapText.textContent = "Snap:";
			headMenuHover.appendChild(snapText);

			let select = document.createElement('select');
			select.className = "head_menu_hover_left";
			headMenuHover.appendChild(select);

			let snapFreeOption = document.createElement('option');
			snapFreeOption.className = "snap_free_option";
			snapFreeOption.value = "free";
			snapFreeOption.textContent = "free";
			select.appendChild(snapFreeOption);

			let snapDisplayOption = document.createElement('option');
			snapDisplayOption.className = "snap_display_option";
			snapDisplayOption.value = "display";
			snapDisplayOption.textContent = "display";
			snapDisplayOption.style.display = "none";
			select.appendChild(snapDisplayOption);

			let snapGridOption = document.createElement('option');
			snapGridOption.className = "snap_grid_option";
			snapGridOption.value = "grid";
			snapGridOption.textContent = "grid";
			select.appendChild(snapGridOption);

			let userLabel = document.createElement('span');
			userLabel.className = "user_label";
			headMenuHover.appendChild(userLabel);

			let userText = document.createElement('span');
			userText.className = "user_text";
			headMenuHover.appendChild(userText);

			let logoutButton = document.createElement('input');
			logoutButton.className = "logout_button";
			logoutButton.type = "button";
			logoutButton.value = "Logout";
			headMenuHover.appendChild(logoutButton);

			let hoverRight = document.createElement('div');
			hoverRight.className = "head_menu_hover_right";
			headMenuHover.appendChild(hoverRight);

			let img = document.createElement('img');
			img.style.display = "none";
			img.src = "src/image/disconnect.png";
			headMenuHover.appendChild(img);

			let headIDMenu = document.createElement('span');
			headIDMenu.className = "head_id_menu";
			headMenuHover.appendChild(headIDMenu);

			let changeIDText = document.createElement('span');
			changeIDText.className = "change_id_text";
			changeIDText.textContent = "Controller ID:";
			headIDMenu.appendChild(changeIDText);
			
			this.headIDInput = document.createElement('input');
			this.headIDInput.className = "head_id_input";
			headIDMenu.appendChild(this.headIDInput);
		}
		else if (type === "display") 
		{
			// タイトル リンク無し
			let headModeText = document.createElement('div');
			headModeText.className = "head_mode_text stopselect";
			let headModeTextContent = document.createElement('div');
			headModeTextContent.textContent = "ChOWDER";
			headModeTextContent.className = "chowder_text";
			headModeText.appendChild(headModeTextContent);
			headModeMenu.appendChild(headModeText);
			
			/*
				<span class="head_id_menu">
					<span id="change_id_text">Display ID:</span>
					<input type="text" class="head_id_input" id="input_id"></input>
				</span>
				*/
			let headIDMenu = document.createElement('span');
			headIDMenu.className = "head_id_menu";
			this.dom.appendChild(headIDMenu);

			let changeIDText = document.createElement('span');
			changeIDText.className = "change_id_text";
			changeIDText.textContent = "Display ID:";
			headIDMenu.appendChild(changeIDText);
			
			this.headIDInput = document.createElement('input');
			this.headIDInput.className = "head_id_input";
			headIDMenu.appendChild(this.headIDInput);
		}
		else
		{
			// タイトル リンク無し
			let headModeText = document.createElement('div');
			headModeText.className = "head_mode_text stopselect";
			let headModeTextContent = document.createElement('div');
			headModeTextContent.textContent = "ChOWDER Display Setting";
			headModeTextContent.className = "chowder_text";
			headModeText.appendChild(headModeTextContent);
			headModeMenu.appendChild(headModeText);
		}

		this.background = null;


		/*
				<ul class="menu">
					<li class="menu__multi">
						<a href="#" class="init-bottom">Menu multi level</a>
						<ul class="menu_level1">
							<li>
								<a href="#" class="menu_init-right">Child Menu</a>
								<ul class="menu_level2">
									<li>
										<a href="#" class="menu_init-right">Grandchild Menu</a>
										<ul class="menu_level3">
											<li><a href="#">Great-Grandchild Menu</a></li>
											<li><a href="#">Great-Grandchild Menu</a></li>
											<li><a href="#">Great-Grandchild Menu</a></li>
										</ul>
									</li>
									<li><a href="#">Grandchild Menu</a></li>
									<li><a href="#">Grandchild Menu</a></li>
								</ul>
							</li>
						</ul>
					</li>
					<!-- 他メニュー-->
				</ul>
		*/
		let link, li, ul;
		ul = document.createElement('ul');
		ul.className = 'menu';
		this.dom.appendChild(ul);
		let createMenu = (setting, ul, n) => {
			let i, ul2, key, value;
			for (i = 0; i < setting.length; i = i + 1) {
				key = Object.keys(setting[i])[0];
				value = setting[i][key];
				if (setting[i].hasOwnProperty('url')) {
					link = document.createElement('a');
					link.href = location.hash ? location.hash : "#";
				}
				else {
					link = document.createElement('div');
				}
				link.innerHTML = key;
				link.id = "_menu_" + key;
				link.setAttribute("data-key", key);
				if (value instanceof Array) {
					// 子有り.
					if (n === 1) {
						link.className = "menu_init-bottom";
					}
					else {
						link.className = "menu_init-right";
					}
					li = document.createElement('li');
					li.className = "menu__multi";
					li.appendChild(link);
					ul.appendChild(li);
					ul2 = document.createElement('ul');
					ul2.className = "menu_level" + n;
					if (n === 1) {
						li.onmousedown = function (evt) {
							evt.preventDefault();
						};
						li.onclick = (function (self, ul) {
							return function (evt) {
								if (this.background !== null) {
									if (evt.target.classList.contains("menu_init-bottom")) {
										this.close();
										this.show(ul);
									}
									else {
										this.close();
									}
								}
								else {
									this.show(ul);
								}
							}.bind(self);
						} (this, ul2));
					}
					li.appendChild(ul2);
					li = document.createElement('li');
					ul2.appendChild(li);
					createMenu(value, ul2, n + 1);
				}
				else {
					// 末端.
					if (value.hasOwnProperty('url')) {
						link.href = value.url;
					}
					if (value.hasOwnProperty('func')) {
						link.onmousedown = function (evt) {
							evt.preventDefault();
						};
						link.onclick = (function (value) {
							return (evt) => {
								value.func(evt, this);
							};
						}.bind(this, value)());
					}
					link.className = "";
					li = document.createElement('li');
					li.className = "";
					li.appendChild(link);
					ul.appendChild(li);
				}
			}
		};
		createMenu(setting, ul, 1);
	}
	setIDValue(value) {
		this.headIDInput.value = value;
	}
	getIDValue() {
		return this.headIDInput.value;
	}
	close() {
		if (this.background !== null) {
			this.background.close();
			this.background = null;
		}
		if (this.openMenuElem) {
			this.openMenuElem.style.display = "none";
			this.openMenuElem.style.opacity = "0";
			this.openMenuElem.style.top = "30px";
			this.openMenuElem = null;
		}
	}
	changeName(pre, post) {
		let elem = document.getElementById("_menu_" + pre);
		console.error(pre, elem);
		if (elem) {
			elem.id = "_menu_" + post;
			elem.innerHTML = post;
		}
	}
	show(ul) {
		if (this.background !== null) {
			this.close();
		}
		let background = new PopupBackground();
		background.show(0.0, 3);
		background.on('close', () => {
			this.close();
		});
		this.background = background;
		ul.style.display = "block";
		ul.style.opacity = "1";
		ul.style.top = "30px";
		this.openMenuElem = ul;
	}
	getDOM() {
		return this.dom;
	}
	getIDInput() {
		return this.headIDInput;
	}
}

export default Menu;
