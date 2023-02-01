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
    constructor(title, type) {
        super();

        this.type = type;
        this.TYPE_CONTROLLER = "Controller";

        this.dom = document.createElement('div');
        this.dom.style.width = "100%";
        this.dom.style.height = "100%";

        this.header = document.createElement('div');
        this.header.className = "head_menu";
        if (title)
        {
            let titleDiv = '<div class="head_mode_menu">';
            titleDiv += '<div class="head_mode_text stopselect">';
            titleDiv += '<a href="index.html" id="chowder_text">';
            titleDiv += title;
            titleDiv += '</a></div></div>';
            this.header.innerHTML = titleDiv;
        }
        else
        {
            this.header.innerHTML =  `
                <div class="head_mode_menu">
                    <div class="head_mode_text stopselect">
                        <a href="index.html" id="chowder_text">ChOWDER</a>
                    </div>
                </div>
                `
        }
        this.dom.appendChild(this.header);

        this.background = document.createElement('div');
        this.background.className = "loginmenu_background";
        this.dom.appendChild(this.background);

        this.loginMenu = document.createElement('div');
        this.loginMenu.className = "loginmenu";
        this.dom.appendChild(this.loginMenu);

        const loginFrame = document.createElement('div');
        loginFrame.className = "loginframe";
        this.loginMenu.appendChild(loginFrame);

        const useLabelWrap = document.createElement('div');
        useLabelWrap.className = "userlabel";
        loginFrame.appendChild(useLabelWrap);

        {
            const menuLabel = document.createElement('p');
            menuLabel.className = "loginmenu_label";
            menuLabel.setAttribute('data-key', 'user');
            useLabelWrap.appendChild(menuLabel);

            this.loginUserSelect = new Select();
            this.loginUserSelect.getDOM().classList.add("loginuser");
            useLabelWrap.appendChild(this.loginUserSelect.getDOM());
        }

        if(this.type === this.TYPE_CONTROLLER){
            const controlleridLabel = document.createElement('p');
            controlleridLabel.className = "loginmenu_label";
            controlleridLabel.setAttribute('data-key', 'User Name');
            useLabelWrap.appendChild(controlleridLabel);

            this.controlleridInput = new Input();
            this.controlleridInput.getDOM().classList.add("controllerid");
            useLabelWrap.appendChild(this.controlleridInput.getDOM());
        }

        {
            const passwardLabel = document.createElement('p');
            passwardLabel.className = "loginmenu_label";
            passwardLabel.setAttribute('data-key', 'password');
            useLabelWrap.appendChild(passwardLabel);

            this.passInput = new Input("password");
            this.passInput.getDOM().classList.add("loginpass");
            this.passInput.getDOM().setAttribute('autocomplete', "new-password")
            useLabelWrap.appendChild(this.passInput.getDOM());
            this.passInput.getDOM().onkeypress = (evt) => {
                if (evt.which == 13) {
                    this._runLogin();
                }
            };

            const loginButton = new Button();
            loginButton.getDOM().classList.add("loginbutton");
            loginButton.getDOM().classList.add("btn-primary");
            loginButton.setDataKey('login');
            useLabelWrap.appendChild(loginButton.getDOM());

            loginButton.on(Button.EVENT_CLICK, (err) => {
                this._runLogin(err);
            });
        }

        {
            this.invalidLogin = document.createElement('p');
            this.invalidLogin.className = "invalid_login";
            this.invalidLogin.setAttribute('data-key', 'invalid_login');
            loginFrame.appendChild(this.invalidLogin);
        }
    }

    _runLogin(err){
        if(this.type === this.TYPE_CONTROLLER){
            const inputControllerID = this.getControllerid();
            if(inputControllerID){
                location.hash = inputControllerID;
            }
        }
        this.emit(LoginMenu.EVENT_LOGIN, err);
    }

    getUserSelect() {
        return this.loginUserSelect;
    }

    getControllerid() {
        return this.controlleridInput.getValue();
    }

    getPassword() {
        return this.passInput.getValue();
    }

    show(isShow) {
		this.background.style.display = isShow ? "block" : "none";
        this.loginMenu.style.display = isShow ? "block" : "none";
        this.dom.style.display = isShow ? "block" : "none";
    }
    showInvalidLabel(isShow) {
        this.invalidLogin.style.display = isShow ? "block" : "none";
    }
    getDOM() {
        return this.dom;
    }
}

LoginMenu.EVENT_LOGIN = "login";

export default LoginMenu;

