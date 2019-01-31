/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import Button from "./button";
import Select from "./select";
import Input from "./input";

class LoginMenu extends EventEmitter
{
    constructor() {
        super();

        this.dom = document.createElement('div');

        this.background = document.createElement('div');
        this.background.className = "loginmenu_background";
        this.dom.appendChild(this.background);

        this.loginMenu = document.createElement('div');
        this.loginMenu.className = "loginmenu";
        this.dom.appendChild(this.loginMenu);

        let loginFrame = document.createElement('div');
        loginFrame.className = "loginframe";
        this.loginMenu.appendChild(loginFrame);

        let useLabelWrap = document.createElement('div');
        {
            let menuLabel = document.createElement('p');
            menuLabel.className = "loginmenu_label";
            menuLabel.setAttribute('data-key', 'user');
            useLabelWrap.appendChild(menuLabel);
            
            this.loginUserSelect = new Select();
            this.loginUserSelect.getDOM().classList.add("loginuser");
            useLabelWrap.appendChild(this.loginUserSelect.getDOM());
        }
        loginFrame.appendChild(useLabelWrap);

        let passwordWrap = document.createElement('div');
        {
            let menuLabel = document.createElement('p');
            menuLabel.className = "loginmenu_label";
            menuLabel.setAttribute('data-key', 'password');
            useLabelWrap.appendChild(menuLabel);

            this.passInput = new Input("password");
            this.passInput.getDOM().classList.add("loginpass");
            this.passInput.getDOM().setAttribute('autocomplete', "new-password")
            useLabelWrap.appendChild(this.passInput.getDOM());
            this.passInput.getDOM().onkeypress = (evt) => {
                if (evt.which == 13) {
                    this.emit(LoginMenu.EVENT_LOGIN, null);
                }
            };
            
            let loginButton = new Button();
            loginButton.getDOM().classList.add("loginbutton");
            loginButton.getDOM().classList.add("btn-primary");
            loginButton.setDataKey('login');
            useLabelWrap.appendChild(loginButton.getDOM());

            loginButton.on(Button.EVENT_CLICK, (err) => {
                this.emit(LoginMenu.EVENT_LOGIN, err);
            });
        }
        loginFrame.appendChild(passwordWrap);

        this.invalidLogin = document.createElement('p');
        this.invalidLogin.className = "invalid_login";
        this.invalidLogin.setAttribute('data-key', 'invalid_login');
        loginFrame.appendChild(this.invalidLogin);
    }

    getUserSelect() {
        return this.loginUserSelect;
    }

    getPassword() {
        return this.passInput.getValue();
    }

    show(isShow) {
		this.background.style.display = isShow ? "block" : "none";
		this.loginMenu.style.display = isShow ? "block" : "none";
    }
    showInvalidLabel(isShow) {
        this.invalidLogin.display = isShow ? "block" : "none";
    }
    getDOM() {
        return this.dom;
    }
}

LoginMenu.EVENT_LOGIN = "login";

export default LoginMenu;

