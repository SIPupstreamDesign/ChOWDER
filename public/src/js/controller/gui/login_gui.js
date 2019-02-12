/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */
import LoginMenu from '../../components/login_menu';
import Store from '../store/store';
import Translation from '../../common/translation';
import cookie from '../cookie';

"use strict";

class LoginGUI extends EventEmitter {
	constructor(store, action) {
		super();

		this.store = store;
		this.action = action;
		this.loginStore = store.getLoginStore();
		
		// ログイン成功
		this.store.on(Store.EVENT_LOGIN_SUCCESS, (err, data) => {
			this.loginMenu.showInvalidLabel(false);
			this.loginMenu.show(false);
		});
		
		// ログイン失敗
		this.store.on(Store.EVENT_LOGIN_FAILED, (err, data) => {
			this.loginMenu.showInvalidLabel(true);
		});

		// ユーザーリスト更新時
		this.store.on(Store.EVENT_USERLIST_RELOADED, () => {
			// Selectの中身をUserListで更新
			let userList = this.loginStore.getUserList();
			let select = this.loginMenu.getUserSelect();
			for (let i = 0; i < userList.length; i = i + 1) {
				if (userList[i].type !== "display" && userList[i].type !== "api") {
					select.addOption(userList[i].name, userList[i].name);
				}
			}
		});

	}

	initLoginMenu() {
		this.loginMenu = new LoginMenu();
		document.body.insertBefore(this.loginMenu.getDOM(), document.body.childNodes[0]);

		// ログインが実行された場合
		this.loginMenu.on(LoginMenu.EVENT_LOGIN, () => {
			let userList = this.loginStore.getUserList();
			let userSelect = this.loginMenu.getUserSelect();
			// ログイン実行
			this.action.login({
				userid : userList[userSelect.getSelectedIndex()].id,
				password : this.loginMenu.getPassword()
			});
		});
	}

	// 初期ログイン画面
	login() {
		// ログインメニュー表示
		if (!this.loginMenu) {
			this.initLoginMenu();
		}
		this.loginMenu.show(true);
		Translation.changeLanguage(this.loginStore.getLanguage());
		Translation.translate(function () {});
		
		// 最初にユーザーリスト取得
		this.action.reloadUserList({
			callback : () => {
				// 再ログインを試みる
				let loginkey = this.loginStore.getLoginKey(this.loginStore.getControllerID());
				if (loginkey.length > 0) {
					// リロード時などの再ログイン.
					this.action.login({
						userid : "",
						password : "",
						loginkey : loginkey
					});
				}
			}
		});
		
	}
}

export default LoginGUI;
