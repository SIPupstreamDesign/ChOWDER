/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";

	var Login = function (connector, cookie) {
		this.connector = connector;
		this.cookie = cookie;
		this.login = this.login.bind(this);
		this.submitFunc = this.submitFunc.bind(this);
		this.loginUserID = "";
		EventEmitter.call(this);
	};
	Login.prototype = Object.create(EventEmitter.prototype);

	Login.prototype.submitFunc = function (userList, id, password, key, callback) {
		var loginmenuBackground = document.getElementById('loginmenu_background');
		var loginmenu = document.getElementById('loginmenu');
		var loginpass = document.getElementById('loginpass');
		var head_menu_hover = document.getElementById('head_menu_hover');
		var logoutButton = document.getElementById('logout_button');
		var user_text  = document.getElementById('user_text');
		var request = { id : id, password : password };
		if (key && key.length > 0) {
			request.loginkey = key;
		}
		this.connector.send('Login', request, function (err, reply) {
			var invalidLabel = document.getElementById('invalid_login');
			if (err || reply === "failed") {
				var loginkey = "";
				var management = new Management();
				management.setUserList(null);
				management.setAuthority(null);
				this.cookie.setLoginKey(loginkey);
				this.emit(Login.EVENT_LOGIN_FAILED, null, {
					loginkey : loginkey,
					management : management
				});
				invalidLabel.style.display = "block";
			} else {
				// ログイン成功
				this.loginUserID = reply.id;
				var loginkey = reply.loginkey;
				this.cookie.setLoginKey(loginkey);
				for (var i = 0; i < userList.length; i = i + 1) {
					if (userList[i].id === reply.id) {
						user_text.innerHTML = userList[i].name;
						break;
					}
				}
				invalidLabel.style.display = "none";
				loginmenuBackground.style.display = "none";
				loginmenu.style.display = "none";
				var management = new Management();
				management.setUserList(userList);
				management.setAuthority(reply.authority);
				// ログアウトボタンを設定.
				head_menu_hover.style.display = "block";
				logoutButton.onclick = function () {
					this.cookie.setLoginKey(reply.loginkey);
					this.emit('logout', null, {
						loginkey : reply.loginkey
					});
				}.bind(this);
				this.emit(Login.EVENT_LOGIN_SUCCESS, null,  {
					loginkey : loginkey,
					management : management
				});
			}
			if (callback) {
				callback(err, reply);
			}
		}.bind(this));
	};

	Login.prototype.relogin = function (userList, endCallback) {
		var loginkey = this.cookie.getLoginKey();
		if (loginkey.length > 0) {
			// リロード時などの再ログイン.
			this.submitFunc(userList, "", "", loginkey, function (err, reply) {
				endCallback(err, reply);
			});
			return;
		} else {
			if (endCallback) {
				endCallback(null, "failed");
			}
		}
	}
	
	Login.prototype.login = function () {
		var loginmenuBackground = document.getElementById('loginmenu_background');
		var loginmenu = document.getElementById('loginmenu');
		var loginpass = document.getElementById('loginpass');

		loginmenuBackground.style.display = "block";
		loginmenu.style.display = "block";

		// 最初に再ログインを試行する
		this.connector.send('GetUserList', {}, function (err, userList) {
			this.relogin(userList,  function (err, reply) {
				if (err || reply === "failed") {
					var i,
						userselect = document.getElementById('loginuser'),
						option;
					for (i = 0; i <  userList.length; i = i + 1) {
						if (userList[i].type !== Constants.DisplayTabType) {
							option = document.createElement('option');
							option.value = userList[i].name;
							option.innerHTML = userList[i].name;
							userselect.appendChild(option);
						}
					}
					document.getElementById('loginbutton').onclick = function () {
						var userselect = document.getElementById('loginuser');
						if (userselect.selectedIndex >= 0) {
							var userid = userList[userselect.selectedIndex].id,
								password = loginpass.value;
							this.submitFunc(userList, userid, password, "");
						}
					}.bind(this);
					loginpass.onkeypress = function (e) {
						if (e.which == 13) {
							var userselect = document.getElementById('loginuser');
							if (userselect.selectedIndex >= 0) {
								var userid = userList[userselect.selectedIndex].id,
									password = loginpass.value;
								this.submitFunc(userList, userid, password, "");
							}
						}
					}.bind(this);
				}
			}.bind(this));
		}.bind(this));
	};

	Login.prototype.getLoginKey = function () {
		return this.cookie.getLoginKey();
	};

	Login.prototype.getLoginUserID = function () {
		return this.loginUserID;
	};

	Login.EVENT_LOGIN_SUCCESS = "success";
	Login.EVENT_LOGIN_FAILED = "failed";
	Login.EVENT_LOGOUT = "logout";

	Login.getCookie = null;
	window.Login = Login;
}());