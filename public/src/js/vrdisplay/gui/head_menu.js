/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Menu from '../../components/menu.js';

class HeadMenu extends EventEmitter {
	constructor(store, action) {
		super();

		this.store = store;
		this.action = action;

		this.headMenu = null;

		this.init();
	}

	// 上部メニューの初期化.
	init() {
		let registered = false;
		let onfocus = false;
		// 時間たったら隠す関数
		let hideMenuFunc = function () {
			// console.log("onfocus:", onfocus);
			if (!onfocus) {
				// console.log("hideMenuFunc");
				document.getElementById('head_menu').classList.add('hide');
			}
			registered = false;
		};

		window.addEventListener('mousemove', function (evt) {
			document.getElementById('head_menu').classList.remove('hide');
			if (!registered) {
				registered = true;
				setTimeout(hideMenuFunc, 3000);
			}
		});

		setTimeout(() => {
			if (!document.getElementById('head_menu').classList.contains('hide')) {
				if (!registered) {
					registered = true;
					setTimeout(hideMenuFunc, 2000);
				}
			}
		}, 1000);

		// メニュー設定
		let menuSetting = null;
		/*
		if (window.isElectron()) {
			menuSetting = [
				{
					Setting : [{
						Fullscreen : {
							func : function(evt, menu) { 
								if (!DisplayUtil.isFullScreen()) {
									menu.changeName("Fullscreen", "CancelFullscreen")
								} else {
									menu.changeName("CancelFullscreen", "Fullscreen")
								}
								DisplayUtil.toggleFullScreen();
							}
						}
					}]
				}];
		} else {
			*/
		menuSetting = [
			{
				Display: [{
					Controller: {
						func: () => {
							window.open("controller.html"); // TODO コントローラIDの設定どうするか
						}
					}
				}],
				url: "display.html"
			},
			{
				Setting: [{
					Fullscreen: {
						func: function (evt, menu) {
							if (!DisplayUtil.isFullScreen()) {
								menu.changeName("Fullscreen", "CancelFullscreen")
							} else {
								menu.changeName("CancelFullscreen", "Fullscreen")
							}
							DisplayUtil.toggleFullScreen();
						}
					}
				}]
			}];
		//}

		this.headMenu = new Menu("display", menuSetting);
		document.getElementsByClassName('head_menu')[0].appendChild(this.headMenu.getDOM());

		this.headMenu.getIDInput().onfocus = (ev) => {
			// console.log("onfocus");
			onfocus = true;
			document.getElementById('head_menu').classList.remove('hide');
			clearTimeout(hideMenuFunc);
		};
		this.headMenu.getIDInput().onblur = (ev) => {
			// console.log("onblur");
			onfocus = false;
			this.action.changeDisplayID({ id: this.headMenu.getIDValue() });
		};
		this.headMenu.getIDInput().onkeypress = (ev) => {
			// console.log(ev.keyCode);
			if (ev.keyCode === 13) { // enter
				this.action.changeDisplayID({ id: this.headMenu.getIDValue() });
			}
		};
	}

	setIDValue(id) {
		this.headMenu.setIDValue(id);
	}
}
export default HeadMenu;