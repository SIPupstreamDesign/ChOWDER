/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict"

class ContextMenu
{
    constructor(type, items)
    {
        this.groupBox = null;
        this.management = null;
        this.displayBox = null;
        this.tabs = null;

        this.type = type;
        this.dom = null;

        this.dom = document.createElement('ul');
        this.dom.className = "context_menu context_menu_" + this.type;
        this.dom.style.display = "none";            
        this.addMenuItems(this.dom, items, 'context_menu_item');
    }

    update()
    {
        this.updateContextMenuAccess();
    }

    close()
    {
        this.dom.style.display = "none";
    }

    getDOM() {
        return this.dom;
    }

    addMenuItems(container, items, itemClassName)
    {
        let ul2 = [];
        for (let i = 0; i < items.length; ++i) {
            ul2[i] = null;

            let info = items[i];
            if (info.dataKey) {
                if (info.className === 'hr') {
                    hr = document.createElement('hr');
                    hr.className = "context_menu_margin";
                    container.appendChild(hr);
                    continue;
                }
                let li = document.createElement('li');
                if (itemClassName) {
                    li.className = itemClassName;
                }
                li.classList.add(info.className);
                li.setAttribute('data-key', info.dataKey);
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
                if (info.submenu) {
                    li.classList.add("context_menu_content_submenu");
                    ul2[i] = document.createElement('ul');
                    ul2[i].className = "context_menu_submenu context_menu_submenu_" + info.className;
                    this.addMenuItems(ul2[i], info.submenu, itemClassName)
                    
                    ul2[i].onLI = false;
                    ul2[i].onSubMenu = false;

                    li.onmouseover = (() => {
                        return (evt) => {
                            this.showSubMenu(ul2[i], true);

                            for(let p=0;p<ul2.length;p++){
                                if(ul2[i] === ul2[p]){
                                }else{
                                    if(ul2[p]){
                                        this.showSubMenu(ul2[p], false);
                                    }
                                }
                            }
                        };
                    })();
                    
                    this.dom.appendChild(ul2[i]);
                }else{
                    li.onmouseover = (() => {
                        return (evt) => {
                            for(let p=0;p<ul2.length;p++){
                                if(ul2[i] === ul2[p]){
                                }else{
                                    if(ul2[p]){
                                        this.showSubMenu(ul2[p], false);
                                    }
                                }
                            }
                        };
                    })();

                }
            }
        }
    }

    showSubMenu(container, isShow) {
        if (isShow) {
            container.style.display = "block";
        } else {
            container.style.display = "none";
        }
    }
    
    updateContextMenuAccess() {
        // コンテキストメニューのアクセス制限による表示非表示
        let i;
        let authority = this.management.getAuthorityObject();
        let editableMenus = [
            this.dom.getElementsByClassName('context_menu_add_content')[0],
            this.dom.getElementsByClassName("context_menu_move_front")[0],
            this.dom.getElementsByClassName("context_menu_move_back")[0],
            this.dom.getElementsByClassName('context_menu_change_group')[0],
            this.dom.getElementsByClassName('context_menu_change_image')[0]
        ];
        if (authority.isEditable(this.getCurrentGroupID())) {
            for (i = 0; i < editableMenus.length; i = i + 1) {
                editableMenus[i].style.display = "block";
            }
        } else {
            for (i = 0; i < editableMenus.length; i = i + 1) {
                editableMenus[i].style.display = "none";
            }
        }
    }
};

export default ContextMenu;
