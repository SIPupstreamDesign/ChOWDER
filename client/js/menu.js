/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */

/// menu
(function (gui) {
	"use strict";

	var Menu;

	// コンストラクタ
	Menu = function (containerElem, setting) {
		EventEmitter.call(this);
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
		var i,
			k,
			head,
			link,
			li,
			ul,
			menu;

		ul = document.createElement('ul');
		ul.className = "menu";
		containerElem.appendChild(ul);

		ul.onmouseover = function () {
			var elems = document.getElementsByClassName('menu_level1');
			/*
			for (k = 0; k < elems.length; k = k + 1) {
				elems[k].style.display = "block";
			}
			*/
		}

		function createMenu(setting, ul, n) {
			var i,
				ul2,
				key,
				value;

			for (i = 0; i < setting.length; i = i + 1) {
				head = setting[i];
				key = Object.keys(setting[i])[0];
				value = setting[i][key];
				
				link = document.createElement('a');
				link.href = "#";
				link.innerHTML = key;

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
						li.onclick = (function (ul) {
							return function () {
								if (ul.style.display.toLowerCase().indexOf("block") >= 0) {
									//ul.classList.remove("menu_hover")
									this.togglePopup(ul, false);
								} else {
									//ul.classList.add("menu_hover")
									this.togglePopup(ul, true);
								}
							}.bind(this)
						}(ul2));
					}
						
					li.appendChild(ul2);
					li = document.createElement('li');
					ul2.appendChild(li);

					var count = value.length;
					createMenu(value, ul2, n + 1);
				} else {
					// 末端.
					if (value.hasOwnProperty('url')) {
						link.href = value.url;
					}
					if (value.hasOwnProperty('func')) {
						link.onclick = (function (ul, value) {
							return function (evt) {
								var elems = document.getElementsByClassName('menu_level1');
								for (k = 0; k < elems.length; k = k + 1) {
									elems[k].style.display = "none";
								}
								value.func(evt);
							};
						}(ul, value));
					}
					link.className = "";
					li = document.createElement('li');
					li.className = "";
					li.appendChild(link);
					ul.appendChild(li);
				}
			}
		}
		createMenu(setting.menu, ul, 1);
	};
	Menu.prototype = Object.create(EventEmitter.prototype);

	Menu.prototype.toggle_popup = function () {
		var elem = document.getElementById('popup_background2');
		if (isShow) {
			elem.style.display = "block";
			ul.style.display = "block";
			ul.style.opacity = "1";
			ul.style.top = "30px";
		} else {
			elem.style.display = "none";
			ul.style.display = "none";
			ul.style.opacity = "0";
			ul.style.top = "30px";
		}
		elem.onclick = (function (ul, isShow) {
			return function () {
				togglePopup(ul, isShow);
			};
		}(ul, !isShow));
	};

	window.Menu = Menu;
	
}(window.controller_gui));