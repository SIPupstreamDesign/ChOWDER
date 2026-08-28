/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import InputDialog from './input_dialog.js';
import PopupBackground from './popup_background.js';

// グループ設定用ポップアップメニュー.
    
"use strict";
    
function addMenuItems(container, items, itemClassName)
{
    for (let i = 0; i < items.length; ++i) {
        let info = items[i];
        if (info.dataKey) {
            let li = document.createElement('li');
            li.className = itemClassName;
            if (info.className) {
                li.classList.add(info.className);
            }
            li.setAttribute('data-key', info.dataKey);
            li.textContent = i18next.t(info.dataKey);
            container.appendChild(li);
            if (info.onclick) {
                li.onclick = info.onclick;
            }
            if (info.onmousedown) {
                li.onmousedown = info.onmousedown;
            }
            if (info.onmouseover) {
                li.onmouseover = info.onmouseover;
            }
            if (info.onmouseout) {
                li.onmouseout = info.onmouseout;
            }
        } else {
            let hr = document.createElement('hr');
            hr.className = 'context_menu_margin';
            container.appendChild(hr);
        }
    }
}

class GroupSettingMenu extends EventEmitter
{
    constructor() {
        super();

        this.dom = document.createElement('ul');
        this.dom.className = "group_setting_menu";
        this.dom.style.display = "none";

        let items = [
            // 名前変更
            {
                className : "group_setting_name",
                dataKey : "change_name"
            },
            // 色変更
            {
                className : "group_setting_color",
                dataKey : "change_color"
            },
            // -------
            {
                className : "context_menu_margin"
            },
            // 削除
            {
                className : "group_setting_delete",
                dataKey : "delete"
            }
        ];
        addMenuItems(this.dom, items, "group_setting_menu_item")
    }

    show(posX, posY, groupName, groupColor)
    {
        let background = new PopupBackground();
        let delete_button = this.dom.getElementsByClassName('group_setting_delete')[0];
        let name_button = this.dom.getElementsByClassName('group_setting_name')[0];
        let color_button = this.dom.getElementsByClassName('group_setting_color')[0];

        this.dom.style.display = "block";
        this.dom.style.top = posY + "px";
        this.dom.style.left = posX + "px";
        background.show();
        background.on('close', () => {
            this.dom.style.display = "none";
            this.emit(GroupSettingMenu.EVENT_CLOSE, null);//, this.TabIDtoID(tabID));
        });
        delete_button.onclick = () => {
            this.dom.style.display = "none";
            background.close();
            this.emit(GroupSettingMenu.EVENT_GROUP_DELETE, null);//, this.TabIDtoID(tabID));
        };
        name_button.onclick = () => {
            InputDialog.showTextInput({
                name: i18next.t('change_group_name'),
                initialValue: groupName,
                okButtonName: "OK",
            }, (value) => {
                this.emit(GroupSettingMenu.EVENT_GROUP_EDIT_NAME, null, value);
            });
            this.dom.style.display = "none";
            background.close();
        };
        color_button.onclick = () => {
            InputDialog.showColorInput({
                name: i18next.t('change_group_color'),
                initialValue: groupColor,
                okButtonName: "OK"
            }, (value) => {
                this.emit(GroupSettingMenu.EVENT_GROUP_EDIT_COLOR, null, value);
            });
            this.dom.style.display = "none";
            background.close();
        };
    }

    getDOM() {
        return this.dom;
    }
}

GroupSettingMenu.EVENT_CLOSE = "close";
GroupSettingMenu.EVENT_GROUP_DELETE = "group_delete";
GroupSettingMenu.EVENT_GROUP_EDIT_NAME = "group_edit_name";
GroupSettingMenu.EVENT_GROUP_EDIT_COLOR = "group_edit_color";

export default GroupSettingMenu;

