/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */

/// burger_menu
(function (gui) {
	"use strict";

	var BurgerMenu;

	// コンストラクタ
	BurgerMenu = function (containerElem, setting) {
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

		label_icon.onclick = label_click_func;

		function createBurgerMenu(setting, ul, n) {
			var i,
				ul2,
				key,
				value;

			for (i = 0; i < setting.length; i = i + 1) {
				head = setting[i];
				key = Object.keys(setting[i])[0];
				value = setting[i][key];
				
				li = document.createElement('li');
				li.className = "burger_menu_content";
				li.innerHTML = key;
				if (value.hasOwnProperty('func')) {
					li.onclick = function (evt) {
						value.func(evt);
						label_click_func(evt);
					};
				}
				ul.appendChild(li);
			}
		}
		createBurgerMenu(setting.menu, ul, 1);
	};

	// 初期化
	function init(containerElem) {
		var menuSetting = {
				menu : [{
					Delete : {
							func : function () { alert('not implement'); }
						}
					},
					{
					DeleteAll : {
							func : function () { alert('not implement'); }
						}
					}]
				};
		var menu = new BurgerMenu(containerElem, menuSetting);
	}

	window.burger_menu = {};
	window.burger_menu.init = init;
}(window.controller_gui));