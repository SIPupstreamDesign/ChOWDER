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
        for (let i = 0; i < items.length; ++i) {
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
                    let ul2 = document.createElement('ul');
                    ul2.className = "context_menu_submenu context_menu_submenu_" + info.className;
                    this.addMenuItems(ul2, info.submenu, itemClassName)
                    
                    ul2.onLI = false;
                    ul2.onSubMenu = false;

                    li.onmouseover = ((ul2) => {
                        return (evt) => {
                            this.showSubMenu(ul2, true);
                            ul2.onLI = true;
                        };
                    })(ul2);
                    
                    li.onmouseout = ((ul2) => {
                        return (evt) => {
                            ul2.onLI = false;
                        };
                    })(ul2);
                    
                    ul2.onmouseover = ((ul2) => {
                        return (evt) => {
                            ul2.onSubMenu = true;
                        };
                    })(ul2);
                    
                    ul2.onmouseout = ((ul2) => {
                        return (evt) => {
                            ul2.onSubMenu = false;
                        };
                    })(ul2);

                    this.dom.addEventListener('mousemove', ((ul2) => {
                        return (evt) => {
                            if (!ul2.onSubMenu && !ul2.onLI) {
                                this.showSubMenu(ul2, false);
                            }
                        };
                    })(ul2));
                    this.dom.appendChild(ul2);
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
