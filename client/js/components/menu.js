/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */

/// menu
(function (gui) {
	"use strict";

	var Menu;

	// コンストラクタ
	Menu = function (containerElem, setting) {
		EventEmitter.call(this);
		this.containerElem = containerElem;

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
		var link,
			li,
			ul;

		ul = document.createElement('ul');
		ul.className = 'menu';
		containerElem.appendChild(ul);

		var createMenu = function (setting, ul, n) {
			var i,
				ul2,
				key,
				value;

			for (i = 0; i < setting.length; i = i + 1) {
				key = Object.keys(setting[i])[0];
				value = setting[i][key];
				
				link = document.createElement('a');
				link.href = location.hash ? location.hash : "#";
				link.innerHTML = key;
				link.id = "_menu_" + key;
				link.setAttribute("data-key", key);

				if (value instanceof Array) {
					// 子有り.
					if (n === 1) {
						link.className = "menu_init-bottom";
					} else {
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
									} else {
										this.close();
									}
								} else {
									this.show(ul);
								}
							}.bind(self);
						}(this, ul2));
					}

					li.appendChild(ul2);
					li = document.createElement('li');
					ul2.appendChild(li);

					createMenu(value, ul2, n + 1);
				} else {
					// 末端.
					if (value.hasOwnProperty('url')) {
						link.href = value.url;
					}
					if (value.hasOwnProperty('func')) {
						link.onmousedown = function (evt) {
							evt.preventDefault();
						};
						link.onclick = (function (value) {
							return function (evt) {
								value.func(evt, this);
							}.bind(this);
						}.bind(this, value)());
					}
					link.className = "";
					li = document.createElement('li');
					li.className = "";
					li.appendChild(link);
					ul.appendChild(li);
				}
			}
		}.bind(this);

		createMenu(setting.menu, ul, 1);
	};
	Menu.prototype = Object.create(EventEmitter.prototype);


	Menu.prototype.close =  function () {
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
	};

	Menu.prototype.changeName =  function (pre, post) {
		var elem = document.getElementById("_menu_" + pre);
		console.error(pre, elem)
		if (elem) {
			elem.id = "_menu_" + post;
			elem.innerHTML = post;
		}
	};

	Menu.prototype.show = function (ul) {
		if (this.background !== null) {
			this.close();
		}
		var background = new PopupBackground();
		background.show(0.0, 3);
		background.on('close', function () {
			this.close();
		}.bind(this));
		this.background = background;
	
		ul.style.display = "block";
		ul.style.opacity = "1";
		ul.style.top = "30px";
		this.openMenuElem = ul;
	};

	window.Menu = Menu;
	
}(window.controller_gui));