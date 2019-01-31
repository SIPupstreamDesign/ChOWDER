/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

// ControllerのSearchタブ（オレンジ色のタブ）
"use strict";

class SearchBox extends EventEmitter {
    constructor(authority, containerElem, setting) {
        super();
        this.container = containerElem;
        this.setting = setting;
        this.item_area = null;
        this.groupid_to_elem = {};
        this.authority = authority;
        this.init();
        // チェックされているグループリスト
        this.check_groups = [];
    }

    genSearchTabBox() {
        // 既に該当 ID が存在する場合は一度 DOM を削除して再生成する
        let tabBoxWrapper = document.getElementById('search_tab_box_wrapper');
        if (tabBoxWrapper) {
            tabBoxWrapper.parentNode.removeChild(tabBoxWrapper);
            tabBoxWrapper = null;
        }
        // タブの中の要素全体を包むラッパー
        tabBoxWrapper = document.createElement('div');
        tabBoxWrapper.id = 'search_tab_box_wrapper';
        tabBoxWrapper.className = "search_tab_box_wrapper";
        this.container.appendChild(tabBoxWrapper);

        // 検索窓とチェックボックスの入る左側のカラム
        let searchArea = document.createElement('div');
        searchArea.className = "search_area";
        tabBoxWrapper.appendChild(searchArea);

        // アイテムが並ぶ右側のカラム
        let itemWrapper = document.createElement('div');
        itemWrapper.className = "search_item_wrapper";
        tabBoxWrapper.appendChild(itemWrapper);
        
        // 左カラム内、上段に検索ボックス
        let textInputWrapper = document.createElement('div');
        textInputWrapper.className = "search_text_input_wrapper";
        let text_input = document.createElement('input');
        text_input.type = 'text';
        text_input.className = "search_text_input";
        text_input.setAttribute('placeholder', '🔍  search');
        text_input.oninput = (evt) => {
            this.emit(SearchBox.EVENT_INPUT_CHANGED, null, evt.target.value, this.check_groups);
        };
        text_input.onclick = (evt) => {
            this.emit(SearchBox.EVENT_INPUT_CHANGED, null, evt.target.value, this.check_groups);
        };
        textInputWrapper.appendChild(text_input);
        searchArea.appendChild(textInputWrapper);

        // 左カラム内、下段にチェックボックスが入るエリア
        let checkWrapper = document.createElement('div');
        checkWrapper.className = "search_check_wrapper";
        searchArea.appendChild(checkWrapper);

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
        // 全て選択チェックボックス
        ((text_input) => {
            let group_div = document.createElement('div');
            let all_checkbox = document.createElement('input');
            let label;
            let target;
            all_checkbox.id = 'all_check_';
            all_checkbox.className = "search_group_checkbox";
            all_checkbox.type = 'checkbox';
            label = document.createElement('label');
            //label.setAttribute('for', 'search_check_' + i);
            label.textContent = "All";
            label.className = "search_group_label";
            group_div.onclick = (evt) => {
                let checkbox = document.getElementById('all_check_');
                checkbox.checked = !checkbox.checked;
                for (let i = 0; i < this.setting.groups.length; i = i + 1) {
                    let groupID = this.setting.groups[i].id;
                    if (this.authority.isViewable(groupID)) {
                        target = document.getElementById('search_check_' + i);
                        target.checked = checkbox.checked;
                        checkFunction(target, i);
                    }
                }
                this.emit(SearchBox.EVENT_INPUT_CHANGED, null, text_input.value, this.check_groups);
            };
            all_checkbox.onclick = group_div.onclick;
            group_div.appendChild(all_checkbox);
            group_div.appendChild(label);
            group_div.className = "search_group_div";
            checkWrapper.appendChild(group_div);
        })(text_input);

        // group チェックボックス
        for (let i = 0; i < this.setting.groups.length; i++) {
            let groupID = this.setting.groups[i].id;
            let groupName = this.setting.groups[i].name;
            if (this.authority.isViewable(groupID)) {
                let group_div = document.createElement('div');
                let checkbox = document.createElement('input');
                checkbox.id = 'search_check_' + i;
                checkbox.className = "search_group_checkbox";
                checkbox.type = 'checkbox';
                group_div.appendChild(checkbox);
                group_div.onclick = ((text_input, i) => {
                    return (evt) => {
                        let checkbox = document.getElementById('search_check_' + i);
                        checkbox.checked = !checkbox.checked;
                        checkFunction(checkbox, i);
                        this.emit(SearchBox.EVENT_INPUT_CHANGED, null, text_input.value, this.check_groups);
                    };
                })(text_input, i);
                let groupLabel = document.createElement('label');
                groupLabel.setAttribute('for', 'search_check_' + i);
                groupLabel.textContent = groupName;
                groupLabel.className = "search_group_label";
                checkbox.onclick = group_div.onclick;
                groupLabel.onclick = group_div.onclick;
                this.groupid_to_elem[this.setting.groups[i].id] = groupLabel;
                group_div.appendChild(groupLabel);
                group_div.className = "search_group_div";
                if (this.setting.colors[i]) {
                    group_div.style.backgroundColor = this.setting.colors[i];
                }
                else {
                    group_div.style.backgroundColor = "rgb(54,187,68)";
                }
                checkWrapper.appendChild(group_div);
            }
        }
        this.item_area = itemWrapper;
    }
    init() {
        // search tab generate
        this.genSearchTabBox();
    }
    check(groupID, isChecked) {
        if (this.groupid_to_elem.hasOwnProperty(groupID)) {
            this.groupid_to_elem[groupID].onclick();
        }
    }
    setSearchResult(result) {
        if (!this.item_area) {
            return;
        }
        this.item_area.innerHTML = "";
        for (let i = 0; i < result.length; ++i) {
            this.item_area.appendChild(result[i]);
        }
    }
}

// 検索ボックスに入力されたときのイベント
SearchBox.EVENT_INPUT_CHANGED = "input_changed";

export default SearchBox;

