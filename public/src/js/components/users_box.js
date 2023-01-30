/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Reuser Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

// ControllerのUserタブ（黄色のタブ）
"use strict";

class UsersBox extends EventEmitter {
    constructor(authority, containerElem, setting) {
        super();
        this.container = containerElem;
        this.setting = setting;
        this.item_area = null;
        this.groupid_to_elem = {};
        this.authority = authority;
        this.init();
        // チェックされているグループリスト
        //this.check_groups = [];
    }

    genUserTabBox() {
        // 既に該当 ID が存在する場合は一度 DOM を削除して再生成する
        let tabBoxWrapper = document.getElementById('users_tab_box_wrapper');
        if (tabBoxWrapper) {
            tabBoxWrapper.parentNode.removeChild(tabBoxWrapper);
            tabBoxWrapper = null;
        }
        // タブの中の要素全体を包むラッパー
        tabBoxWrapper = document.createElement('div');
        tabBoxWrapper.id = 'users_tab_box_wrapper';
        tabBoxWrapper.className = "users_tab_box_wrapper";
        this.container.appendChild(tabBoxWrapper);
/*
        // 検索窓とチェックボックスの入る左側のカラム
        let userArea = document.createElement('div');
        userArea.className = "user_area";
        tabBoxWrapper.appendChild(userArea);
*/
        // アイテムが並ぶ右側のカラム
        let itemWrapper = document.createElement('div');
        itemWrapper.className = "user_item_wrapper";
        tabBoxWrapper.appendChild(itemWrapper);
        
        // 左カラム内、上段に検索ボックス
        /*
        let textInputWrapper = document.createElement('div');
        textInputWrapper.className = "user_text_input_wrapper";
        let text_input = document.createElement('input');
        text_input.type = 'text';
        text_input.className = "user_text_input";
        text_input.setAttribute('placeholder', '🔍  user');
        text_input.oninput = (evt) => {
            this.emit(UsersBox.EVENT_INPUT_CHANGED, null, evt.target.value, this.check_groups);
        };
        text_input.onclick = (evt) => {
            this.emit(UsersBox.EVENT_INPUT_CHANGED, null, evt.target.value, this.check_groups);
        };
        textInputWrapper.appendChild(text_input);
        userArea.appendChild(textInputWrapper);

        // 全て選択チェックボックス
        ((text_input) => {
            let group_div = document.createElement('div');
            let all_checkbox = document.createElement('input');
            let label;
            let target;
            all_checkbox.id = 'all_check_';
            all_checkbox.className = "user_group_checkbox";
            all_checkbox.type = 'checkbox';
            label = document.createElement('label');
            //label.setAttribute('for', 'user_check_' + i);
            label.textContent = "All";
            label.className = "user_group_label";
            group_div.onclick = (evt) => {
                let checkbox = document.getElementById('all_check_');
                checkbox.checked = !checkbox.checked;
                for (let i = 0; i < this.setting.groups.length; i = i + 1) {
                    let groupID = this.setting.groups[i].id;
                    if (this.authority.isViewable(groupID)) {
                        target = document.getElementById('user_check_' + i);
                        target.checked = checkbox.checked;
                        checkFunction(target, i);
                    }
                }
                this.emit(UsersBox.EVENT_INPUT_CHANGED, null, text_input.value, this.check_groups);
            };
            all_checkbox.onclick = group_div.onclick;
            group_div.appendChild(all_checkbox);
            group_div.appendChild(label);
            group_div.className = "user_group_div";
            checkWrapper.appendChild(group_div);
        })(text_input);

        // 左カラム内、下段にチェックボックスが入るエリア
        let checkWrapper = document.createElement('div');
        checkWrapper.className = "user_check_wrapper";
        userArea.appendChild(checkWrapper);

        */

        let checkFunction = (target, i) => {
            if (target.checked) {
                if (this.check_groups.indexOf(this.setting.groups[i].id) < 0) {
                    this.check_groups.push(this.setting.groups[i].id);
                }
            }
            else if (!(this.check_groups.indexOf(this.setting.groups[i].id) < 0)) {
                this.check_groups.splice(this.check_groups.indexOf(this.setting.groups[i].id), 1);
            }
        };
  
        this.item_area = itemWrapper;
    }
    init() {
        // user tab generate
        this.genUserTabBox();
    }
    check(groupID, isChecked) {
        if (this.groupid_to_elem.hasOwnProperty(groupID)) {
            this.groupid_to_elem[groupID].onclick();
        }
    }
    setuserResult(result) {
        if (!this.item_area) {
            return;
        }
        this.item_area.innerHTML = "";
        for (let i = 0; i < result.length; ++i) {
            this.item_area.appendChild(result[i]);
        }
    }

    drawList(result){
        console.log(result.length);
        this.item_area.innerHTML = "";
        if(this.item_area){
            for(let i =0; i < result.length;  i++){
                let tgtspan = document.createElement('div');
                tgtspan.className = "users_tab_item";
                tgtspan.innerText = result[i].controllerID;
                this.item_area.appendChild(tgtspan);
            }
        }
    }
}

// 検索ボックスに入力されたときのイベント
UsersBox.EVENT_INPUT_CHANGED = "input_changed";

export default UsersBox;

