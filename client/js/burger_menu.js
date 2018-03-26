/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */

/// burger_menu
(function () {
	"use strict";

	var BurgerMenu;

	// コンストラクタ
	BurgerMenu = function (containerElem, setting) {
		EventEmitter.call(this);
/*
	<div id="burger_menu">
		<label id="burger_menu_icon" class="burger_menu_icon" for="burger_menu_checkbox">≡</label>
		<label id="burger_menu_background" class="burger_menu_background" for="burger_menu_checkbox"></label>
		<div id="burger_menu_contents" class="burger_menu_contents">
			<ul>
				<li>メニュー1</li>
				<li>メニュー2</li>
				<li>メニュー3</li>
			</ul>
		</div>
	</div>
*/
		var i,
			head,
			link,
			li,
			ul,
			input,
			label_icon,
			label_background,
			div;

		label_icon = document.createElement("label");
		label_icon.className = "burger_menu_icon";
		label_icon.id = containerElem.id + "_icon";
		label_icon.innerHTML = "≡";

		label_background = document.createElement("label");
		label_background.className = "burger_menu_background";
		label_background.id = containerElem.id + "_background";

		div = document.createElement("div");
		div.className = "burger_menu_contents";
		div.id = containerElem.id + "_contents";

		containerElem.appendChild(label_icon);
		containerElem.appendChild(label_background);
		containerElem.appendChild(div);

		ul = document.createElement('ul');
		div.appendChild(ul);

		function label_click_func(evt) {
				var visible = (div.style.display === "none" || div.style.display === "");
				div.style.display = visible ? "block" : "none";
				
				if (visible) {
					console.log("visible")
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

		function createBurgerMenu(setting, ul, n) {
			var i,
				ul2,
				key,
				value,
				hr;

			for (i = 0; i < setting.length; i = i + 1) {
				head = setting[i];
				key = Object.keys(setting[i])[0];
				value = setting[i][key];
				if (key === 'hr') {
					hr = document.createElement('hr');
					hr.className = "context_menu_margin";
					ul.appendChild(hr);
					continue;
				}
				
				li = document.createElement('li');
				li.className = "burger_menu_content";
				li.innerHTML = key;
				if (value.hasOwnProperty('func')) {
					li.onclick = (function (value) {
						return function (evt) {
							var result = value.func(evt);
							if (result === undefined) {
								label_click_func(evt);
							}
						};
					}(value));
				}
				if (value.hasOwnProperty('submenu')) {
					if (value.submenu) {
						li.classList.add("burger_menu_content_submenu");
					}
				}
				if (value.hasOwnProperty('mouseoverfunc')) {
					li.onmouseover = (function (value) {
						return function (evt) {
							value.mouseoverfunc(evt);
						};
					}(value));
				}
				if (value.hasOwnProperty('mouseoutfunc')) {
					li.onmouseout = (function (value) {
						return function (evt) {
							value.mouseoutfunc(evt);
						};
					}(value));
				}
				
				ul.appendChild(li);
			}
		}
		createBurgerMenu(setting.menu, ul, 1);
	};
	BurgerMenu.prototype = Object.create(EventEmitter.prototype);

	window.BurgerMenu = BurgerMenu;
	
}());