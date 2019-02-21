/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Select from "./select";
import Input from "./input";
import Button from "./button";
import PopupBackground from "./popup_background";
import SelectList from "./select_list";
import Constants from "../common/constants";
import InputDialog from './input_dialog';
import CompareList from "./compare_list";

class ManagementDialog extends EventEmitter
{
    constructor() {
        super();
    }

    initAll() {
        this.dom = document.createElement('div');
        this.dom.className = "management";
        this.dom.style.display = "none";

        let title = document.createElement('h3');
        title.textContent = i18next.t("management");
        let title2 = document.createElement('h4');
        title2.textContent = i18next.t("db_management");
        this.dom.appendChild(title);
        this.dom.appendChild(title2);

        /*
            <div class="frame">
                <p>DB</p>
                <select id="db_select" class="db_select">
                    <option value="default">default</option>
                    <option value="testaa">testaa</option>
                </select>
                <input id="changedb_button" type="button" class="btn" style="color:black" data-key="change" value="" />
                <input id="newdb_button" type="button" class="btn" style="color:black" data-key="new" value="" />
                <input id="renamedb_button" type="button" class="btn" style="color:black" data-key="change_name" value="" />
                <input id="deletedb_button" type="button" class="btn" style="color:black" data-key="delete" value="" />
                <input id="initdb_button" type="button" class="btn" style="color:black" data-key="initialize" value="" />
            </div>
         */
        {
            let selectFrame = document.createElement('div');
            selectFrame.className = "frame";
            this.dom.appendChild(selectFrame);

            let selectFrameTitle = document.createElement('p');
            selectFrameTitle.textContent = "DB";
            selectFrame.appendChild(selectFrameTitle);

            this.dbSelect = new Select();
            this.dbSelect.getDOM().className = "db_select";
            selectFrame.appendChild(this.dbSelect.getDOM());

            this.changeDBButton = new Button();
            this.changeDBButton.getDOM().classList.add("management_dialog_db_button");
            this.changeDBButton.setDataKey("change");
            selectFrame.appendChild(this.changeDBButton.getDOM());

            this.newDBButton = new Button();
            this.newDBButton.setDataKey("new");
            this.newDBButton.getDOM().classList.add("management_dialog_db_button");
            selectFrame.appendChild(this.newDBButton.getDOM());

            this.renameDBButton = new Button();
            this.renameDBButton.setDataKey("change_name");
            this.renameDBButton.getDOM().classList.add("management_dialog_db_button");
            selectFrame.appendChild(this.renameDBButton.getDOM());

            this.deleteDBButton = new Button();
            this.deleteDBButton.setDataKey("delete");
            this.deleteDBButton.getDOM().classList.add("management_dialog_db_button");
            selectFrame.appendChild(this.deleteDBButton.getDOM());

            this.initDBButton = new Button();
            this.initDBButton.setDataKey("initialize");
            this.initDBButton.getDOM().classList.add("management_dialog_db_button");
            selectFrame.appendChild(this.initDBButton.getDOM());

            // 初期状態でrenameとdeleteはdisable
            this.renameDBButton.getDOM().disabled = true;
            this.deleteDBButton.getDOM().disabled = true;
        }


        /*
            <h4 data-key="history_management"></h4>
            <div class="frame">
                <p data-key="max_history"></p>
                <input id="history_number" class="history_number" type="number" min="0" style="color:black" value="10" />
                <input id="apply_history_number_button" type="button" class="btn" style="color:black" data-key="apply" value="" />
                <p id="apply_history_message" data-key="applied"></p>
            </div>
       */
        {
            let historyManagementTitle = document.createElement('h4');
            historyManagementTitle.textContent = i18next.t("history_management");
            this.dom.appendChild(historyManagementTitle);

            let historyFrame = document.createElement('div');
            historyFrame.className = "frame";
            this.dom.appendChild(historyFrame);

            this.historyFrameTitle = document.createElement('p');
            this.historyFrameTitle.textContent = i18next.t("max_history");
            historyFrame.appendChild(this.historyFrameTitle);

            this.historyNumberInput = new Input("number");
            this.historyNumberInput.getDOM().className = "history_number";
            this.historyNumberInput.setValue(10);
            historyFrame.appendChild(this.historyNumberInput.getDOM());

            this.historyNumberButton = new Button();
            this.historyNumberButton.setDataKey("apply");
            historyFrame.appendChild(this.historyNumberButton.getDOM());

            this.historyApplyMessage = document.createElement('p');
            this.historyApplyMessage.classList.add("apply_history_message");
            this.historyApplyMessage.textContent = i18next.t("applied");
            historyFrame.appendChild(this.historyApplyMessage);
        }

        /*
            <h4 data-key="authority_setting"></h4>
            <div class="frame">
                <p data-key="setting_target"></p>
                <select id="auth_select" class="auth_select">
                </select>
                <div>
                    <span class="auth_target_label" data-key="editable_content"></span>
                    <span class="auth_target_label" data-key="viewable_content"></span>
                    <span id="display_manipulate_label" data-key="editable_display"></span>
                </div>
                <div id="auth_target_frame">
                    <!-- 閲覧権限、編集権限、ディスプレイ編集権限のリスト -->
                </div>
                <div>
                    <input id="group_add_delete_check" type="checkbox" />
                    <span id="group_add_delete_label" data-key="allow_editting_group"></span>
                </div>
                <div class="apply_auth_frame">
                    <input id="apply_auth_button" type="button" class="btn management_apply_button" style="color:black" data-key="apply" value="" />
                    <span id="apply_auth_message" data-key="applied"></span>
                </div>
            </div>
        */
        {
            let authSettingTitle = document.createElement('h4');
            authSettingTitle.textContent = i18next.t("authority_setting");
            this.dom.appendChild(authSettingTitle);

            let authSettingFrame = document.createElement('div');
            authSettingFrame.className = "frame";
            this.dom.appendChild(authSettingFrame);

            let authSettingTarget = document.createElement('p');
            authSettingTarget.textContent = i18next.t("setting_target");
            authSettingFrame.appendChild(authSettingTarget);

            this.authSelect = new Select();
            this.authSelect.getDOM().classList.add("auth_select");
            authSettingFrame.appendChild(this.authSelect.getDOM());

            let authLabelWrap = document.createElement('div');
            {
                this.editableContentLabel = document.createElement('span');
                this.editableContentLabel.className = "auth_target_label";
                this.editableContentLabel.textContent = i18next.t("editable_content");
                authLabelWrap.appendChild(this.editableContentLabel);

                this.viewableContentLabel = document.createElement('span');
                this.viewableContentLabel.className = "auth_target_label";
                this.viewableContentLabel.textContent = i18next.t("viewable_content");
                authLabelWrap.appendChild(this.viewableContentLabel);

                this.editableDisplayLabel = document.createElement('span');
                this.editableDisplayLabel.className = "display_manipulate_label";
                this.editableDisplayLabel.textContent = i18next.t("editable_display");
                authLabelWrap.appendChild(this.editableDisplayLabel);
            }
            authSettingFrame.appendChild(authLabelWrap);

            this.authTargetFrame = document.createElement('div');
            this.authTargetFrame.className = "auth_target_frame";
            authSettingFrame.appendChild(this.authTargetFrame);

            let deleteCheckWrap = document.createElement('div');
            {
                this.deleteCheckBox = new Input('checkbox');
                deleteCheckWrap.appendChild(this.deleteCheckBox.getDOM());
                this.deleteLabel = document.createElement('span');
                this.deleteLabel.textContent = i18next.t("allow_editting_group");
                deleteCheckWrap.appendChild(this.deleteLabel);
            }
            authSettingFrame.appendChild(deleteCheckWrap);

            let applyAuthWrap = document.createElement('div');
            {
                this.authApplyButton = new Button();
                this.authApplyButton.getDOM().classList.add("management_apply_button");
                this.authApplyButton.setDataKey('apply')
                applyAuthWrap.appendChild(this.authApplyButton.getDOM());
                this.authMessage = document.createElement('span');
                this.authMessage.className = "apply_auth_message";
                this.authMessage.textContent = i18next.t("applied");
                applyAuthWrap.appendChild(this.authMessage);
            }
            authSettingFrame.appendChild(applyAuthWrap);
        }

       /*
        <h4 data-key="setting_password"></h4>
        <div class="frame">
            <div class="passinput_frame">
                <p data-key="setting_target"></p>
                <select id="auth_select_pass" class="auth_select"></select>
            </div>
            <div>
                <div class="passinput_frame">
                    <p data-key="old_password"></p>
                    <input class="passinput" id="old_password" type="password" style="color:black" value="" />
                </div>
                <div class="passinput_frame">
                    <p data-key="new_password"></p>
                    <input class="passinput" id="new_password" type="password" autocomplete="new-password" style="color:black" value="" />
                </div>
            </div>
            <div class="apply_pass_frame">
                <input id="apply_pass_button" type="button" class="btn management_apply_button" style="color:black" data-key="apply" value="" />
                <p id="apply_pass_message" data-key="password_changed"></p>
            </div>
        </div>
        */
        {
            let title = document.createElement('h4');
            title.textContent = i18next.t("setting_password");
            this.dom.appendChild(title);

            let passFrame = document.createElement('div');
            passFrame.className = "frame";
            this.dom.appendChild(passFrame);

            {
                let passInputFrame = document.createElement('div');
                passInputFrame.className = "passinput_frame";
                {
                    let settingTarget = document.createElement('p');
                    settingTarget.textContent = i18next.t("setting_target");
                    passInputFrame.appendChild(settingTarget);

                    this.authSelectPass = new Select();
                    this.authSelectPass.getDOM().classList.add("auth_select");
                    passInputFrame.appendChild(this.authSelectPass.getDOM());
                }
                passFrame.appendChild(passInputFrame);
            }

            let passInputWrap = document.createElement('div');
            {
                {
                    let passInputFrame = document.createElement('div');
                    passInputFrame.className = "passinput_frame";
                    let oldPassLabel = document.createElement('p');
                    oldPassLabel.textContent = i18next.t("old_password");
                    passInputFrame.appendChild(oldPassLabel);
                    this.oldPassInput = new Input('password');
                    this.oldPassInput.getDOM().classList.add("passinput");
                    passInputFrame.appendChild(this.oldPassInput.getDOM());
                    passInputWrap.appendChild(passInputFrame);
                }

                {
                    let passInputFrame = document.createElement('div');
                    passInputFrame.className = "passinput_frame";
                    let newPassLabel = document.createElement('p');
                    newPassLabel.textContent = i18next.t("new_password");
                    passInputFrame.appendChild(newPassLabel);
                    this.newPassInput = new Input('password');
                    this.newPassInput.getDOM().classList.add("passinput");
                    passInputFrame.appendChild(this.newPassInput.getDOM());
                    passInputWrap.appendChild(passInputFrame);
                }
            }
            passFrame.appendChild(passInputWrap);

            {
                let applyPassFrame = document.createElement('div');
                applyPassFrame.className = "apply_pass_frame";
                {
                    this.managementApplyButton = new Button();
                    this.managementApplyButton.getDOM().classList.add('management_apply_button');
                    this.managementApplyButton.setDataKey("apply");
                    applyPassFrame.appendChild(this.managementApplyButton.getDOM());

                    this.applyPassMessage = document.createElement('p');
                    this.applyPassMessage.textContent = i18next.t("password_changed");
                    this.applyPassMessage.className = "apply_pass_message";
                    applyPassFrame.appendChild(this.applyPassMessage);
                }
                passFrame.appendChild(applyPassFrame);
            }
        }

        { // Display許可設定
            let title = document.createElement('h4');
            title.textContent = "Display Settings";
            this.dom.appendChild(title);

            let displayPermissionFrame = document.createElement('div');
            displayPermissionFrame.className = "frame";
            this.dom.appendChild(displayPermissionFrame);

            let displayPermissionTitle = document.createElement('p');
            displayPermissionTitle.textContent = "Display Permission";
            displayPermissionFrame.appendChild(displayPermissionTitle);

            this.displaySelect = new CompareList("Accessible","Reject");

            displayPermissionFrame.appendChild(this.displaySelect.getDOM());
        }
    }

    /**
     * ユーザーの権限データを返す
     */
    getUser(id) {
        let i;
        for (i = 0; i < this.userList.length; i = i + 1) {
            if (this.userList[i].id === id) {
                return this.userList[i];
            }
        }
        return null;
    }

    /**
     *  DBの操作GUIの初期化
     */
    initDBGUI(contents, currentDB) {
        // DBリスト初期化
        let i = 0;
        for (let dbname in contents.dblist) {
            let dbid = contents.dblist[dbname];
            this.dbSelect.addOption(dbname, dbname);
            if (currentDB === dbid) {
                this.dbSelect.setSelectedIndex(i);
            }
            ++i;
        }
        this.dbSelect.on(Select.EVENT_CHANGE, (err) => {
            let options = this.dbSelect.getOptions();
            let selectedIndex = this.dbSelect.getSelectedIndex();
            if (options.length > selectedIndex) {
                let name = options[selectedIndex].value;
                let isDisableEdit = (name === "default");
                this.renameDBButton.getDOM().disabled = isDisableEdit;
                this.deleteDBButton.getDOM().disabled = isDisableEdit;
            }
        });

        //changeDisableFunc();

        // DB新規
        this.newDBButton.on(Button.EVENT_CLICK, (err, evt) => {
            InputDialog.showTextInput({
                name: i18next.t("save_name"),
                okButtonName: i18next.t("create"),
                opacity: 0.7,
                zIndex: 90000001,
                backgroundColor: "#888"
            }, (value) => {
                if (value.length > 0) {
                    this.emit(ManagementDialog.EVENT_NEW_DB, null, value);
                }
            });
        });

        // DB切り替え
        this.changeDBButton.on(Button.EVENT_CLICK, (err, evt) => {
            let options = this.dbSelect.getOptions();
            let selectedIndex = this.dbSelect.getSelectedIndex();
            if (options.length > selectedIndex) {
                let name = options[selectedIndex].value;
                this.emit(ManagementDialog.EVENT_CHANGE_DB, null, name);
            }
        });

        // DB名前変更
        this.renameDBButton.on(Button.EVENT_CLICK, (err, evt) => {
            let options = this.dbSelect.getOptions();
            let selectedIndex = this.dbSelect.getSelectedIndex();
            if (options.length > selectedIndex) {
                let name = options[selectedIndex].value;
                InputDialog.showTextInput({
                    name: i18next.t('change_saving_name'),
                    okButtonName: "OK",
                    initialValue: name,
                    opacity: 0.7,
                    zIndex: 90000001,
                    backgroundColor: "#888"
                }, (value) => {
                    let k;
                    if (name === value) {
                        InputDialog.showOKInput({
                            name: i18next.t("already_exists"),
                            opacity: 0.7,
                            zIndex: 90000001,
                            backgroundColor: "#888"
                        });
                        return;
                    }
                    else {
                        for (k = 0; k < options.length; k = k + 1) {
                            let option = options[k];
                            if (option.value === value) {
                                InputDialog.showOKInput({
                                    name: i18next.t("already_exists"),
                                    opacity: 0.7,
                                    zIndex: 90000001,
                                    backgroundColor: "#888"
                                });
                                return;
                            }
                        }
                    }
                    if (value.length === 0) {
                        InputDialog.showOKInput({
                            name: i18next.t("cannot_empty"),
                            opacity: 0.7,
                            zIndex: 90000001,
                            backgroundColor: "#888"
                        });
                    }
                    this.emit(ManagementDialog.EVENT_RENAME_DB, null, name, value);
                });
            }
        });
        // DB削除
        this.deleteDBButton.on(Button.EVENT_CLICK, (err, evt) => {
            let options = this.dbSelect.getOptions();
            let selectedIndex = this.dbSelect.getSelectedIndex();
            if (options.length > selectedIndex) {
                let name = options[selectedIndex].value;
                this.emit(ManagementDialog.EVENT_DELETE_DB, null, name);
            }
        });
        // DB初期化
        this.initDBButton.on(Button.EVENT_CLICK, (err, evt) => {
            let options = this.dbSelect.getOptions();
            let selectedIndex = this.dbSelect.getSelectedIndex();
            if (options.length > selectedIndex) {
                let name = options[selectedIndex].value;
                this.emit(ManagementDialog.EVENT_INIT_DB, null, name);
            }
        });
    }


    /**
     *  ディスプレイ配信許可設定の初期化
     */
    initDisplayPermission(contents,displayPermissionList) {
        // 最大履歴保存数の適用
        this.displaySelect.on(CompareList.EVENT_APPLY , (err,data) => {
            this.emit(ManagementDialog.EVENT_CHANGE_DISPLAY_PERMISSION_LIST, null, data, ()=>{});
        });
        this.displaySelect.setData(displayPermissionList);
    }

    /**
     *  履歴管理GUIの初期化
     */
    initHistoryGUI(contents, historyNum) {
        // 最大履歴保存数の適用
        this.historyNumberButton.on(Button.EVENT_CLICK, () => {
            this.emit(ManagementDialog.EVENT_CHANGE_HISTORY_NUM, null, this.historyNumberInput.getValue(), function () {
                let message = document.getElementsByClassName('apply_history_message')[0];
                message.style.visibility = "visible";
                setTimeout(function () {
                    message.style.visibility = "hidden";
                }, 2000);
            });
        });
        this.historyNumberInput.setValue(historyNum)
    }

    /**
     * 閲覧・編集権限GUIの初期化
     */
    initAuthorityGUI(contents) {
        // 閲覧・編集権限の設定のリスト
        let i;
        this.editableSelect = new SelectList();
        this.viewableSelect = new SelectList();
        this.displayEditableSelect = new SelectList();
        let allAccessText = i18next.t("all");
        // グループの追加削除を許可のチェック
        this.deleteLabel.onclick = () => {
            this.deleteCheckBox.getDOM().click();
        };
        // ユーザー名リストの設定
        if (this.userList) {
            this.authSelect.clear();
            for (i = 0; i < this.userList.length; i = i + 1) {
                let user = this.userList[i];
                if (user.type !== "admin" && user.type !== "api") {
                    this.authSelect.addOption(user.id, user.name);
                }
            }
        }
        // セレクト変更された
        this.authSelect.on(Select.EVENT_CHANGE, () => {
            // 編集可能、閲覧可能のリストを選択する.
            let id = this.authSelect.getSelectedValue();
            let user = this.getUser(id);
            this.viewableSelect.deselectAll();
            this.editableSelect.deselectAll();
            this.displayEditableSelect.deselectAll();
            if (user) {
                for (let i = 0; i < this.userList.length; i = i + 1) {
                    if (this.userList[i].type !== "admin" && this.userList[i].type !== "api") {
                        let listContentName = this.userList[i].id;
                        if (user.viewable && (user.viewable === "all" || user.viewable.indexOf(listContentName) >= 0)) {
                            this.viewableSelect.select(this.userList[i].name);
                        }
                        if (user.editable && (user.editable === "all" || user.editable.indexOf(listContentName) >= 0)) {
                            this.editableSelect.select(this.userList[i].name);
                        }
                    }
                }
                for (let i = 0; i < this.displayGroupList.length; i = i + 1) {
                    let listContentName = this.displayGroupList[i].id;
                    if (user.displayEditable && (user.displayEditable === "all" || user.displayEditable.indexOf(listContentName) >= 0)) {
                        this.displayEditableSelect.select(this.displayGroupList[i].name);
                    }
                }
                if (user.viewable && user.viewable === "all") {
                    this.viewableSelect.select(allAccessText);
                }
                if (user.viewable && user.editable === "all") {
                    this.editableSelect.select(allAccessText);
                }
                if (user.displayEditable && user.displayEditable === "all") {
                    this.displayEditableSelect.select(allAccessText);
                }
                if (user.hasOwnProperty('group_manipulatable')) {
                    this.deleteCheckBox.check(user.group_manipulatable);
                }
            }
        });

        this.editableSelect.on('change', (err, text, isSelected) => {
            // 全てが選択された場合
            if (text === allAccessText) {
                if (isSelected) {
                    this.editableSelect.selectAll();
                }
                else {
                    this.editableSelect.deselectAll();
                }
            }
            else {
                // 全てが選択された状態で全て以外が選択解除された. 全てを選択解除する.
                let editable = this.editableSelect.getSelectedValues();
                if (!isSelected && text !== allAccessText && editable.indexOf(allAccessText) >= 0) {
                    this.editableSelect.deselect(allAccessText);
                }
            }
            this.normalizeEditableViewableContent();
        });
        this.viewableSelect.on('change', (err, text, isSelected) => {
            // 全てが選択された場合
            if (text === allAccessText) {
                if (isSelected) {
                    this.viewableSelect.selectAll();
                }
                else {
                    this.viewableSelect.deselectAll();
                }
            }
            else {
                // 全てが選択された状態で全て以外が選択解除された. 全てを選択解除する.
                let viewable = this.viewableSelect.getSelectedValues();
                if (!isSelected && text !== allAccessText && viewable.indexOf(allAccessText) >= 0) {
                    this.viewableSelect.deselect(allAccessText);
                }
            }
            this.normalizeEditableViewableContent();
        });
        this.displayEditableSelect.on('change', (err, text, isSelected) => {
            if (text === allAccessText) {
                if (isSelected) {
                    this.displayEditableSelect.selectAll();
                }
                else {
                    this.displayEditableSelect.deselectAll();
                }
            }
            else {
                // 全てが選択された状態で全て以外が選択解除された. 全てを選択解除する.
                let displayEditable = this.displayEditableSelect.getSelectedValues();
                if (!isSelected && text !== allAccessText && displayEditable.indexOf(allAccessText) >= 0) {
                    this.displayEditableSelect.deselect(allAccessText);
                }
            }
        });
        this.authTargetFrame.innerHTML = "";
        this.editableSelect.add(allAccessText, allAccessText);
        this.viewableSelect.add(allAccessText, allAccessText);
        this.displayEditableSelect.add(allAccessText, allAccessText);
        for (i = 0; i < this.userList.length; i = i + 1) {
            if (this.userList[i].type !== "admin" &&
                this.userList[i].type !== "display" &&
                this.userList[i].type !== "guest" &&
                this.userList[i].type !== "api") {
                this.editableSelect.add(this.userList[i].name, this.userList[i].id);
                this.viewableSelect.add(this.userList[i].name, this.userList[i].id);
            }
        }
        for (i = 0; i < this.displayGroupList.length; ++i) {
            if (this.displayGroupList[i].id !== Constants.DefaultGroup) {
                this.displayEditableSelect.add(this.displayGroupList[i].name, this.displayGroupList[i].id);
            }
        }
        this.authTargetFrame.appendChild(this.editableSelect.getDOM());
        this.authTargetFrame.appendChild(this.viewableSelect.getDOM());
        this.authTargetFrame.appendChild(this.displayEditableSelect.getDOM());
        this.authApplyButton.on(Button.EVENT_CLICK, () => {
            let index = this.authSelect.getSelectedIndex();
            if (index >= 0 && this.authSelect.getOptions().length > index) {
                let id = this.authSelect.getSelectedValue();
                let editable = this.editableSelect.getSelectedValues();
                let viewable = this.viewableSelect.getSelectedValues();
                let displayEditable = this.displayEditableSelect.getSelectedValues();
                let group_manipulatable = this.deleteCheckBox.getChecked();
                if (editable.indexOf(allAccessText) >= 0) {
                    editable = "all";
                }
                if (viewable.indexOf(allAccessText) >= 0) {
                    viewable = "all";
                }
                if (displayEditable.indexOf(allAccessText) >= 0) {
                    displayEditable = "all";
                }
                this.emit(ManagementDialog.EVENT_CHANGE_AUTHORITY, id, editable, viewable, displayEditable, group_manipulatable, () => {
                    let message = this.authMessage;
                    message.style.visibility = "visible";
                    setTimeout(function () {
                        message.style.visibility = "hidden";
                    }, 2000);
                });
            }
        });
        // 初回の選択.
        this.authSelect.emit(Select.EVENT_CHANGE);
    }

    /**
     * 編集可能なコンテンツは閲覧可能
     * 閲覧不可なコンテンツは編集不可
     * とする
     */
    normalizeEditableViewableContent() {
        let editableSelectValues = this.editableSelect.getValues();
        let editable = this.editableSelect.getSelectedValues();
        for (let i = 0; i < editableSelectValues.length; ++i) {
            if (editable.indexOf(editableSelectValues[i]) >= 0) {
                // 編集可能なコンテンツは閲覧可能
                this.viewableSelect.selectValue(editableSelectValues[i]);
            }
        }
        let viewableSelectValues = this.viewableSelect.getValues();
        let viewable = this.viewableSelect.getSelectedValues();
        for (let i = 0; i < viewableSelectValues.length; ++i) {
            if (viewable.indexOf(viewableSelectValues[i]) < 0) {
                // 閲覧不可なコンテンツは編集不可
                this.editableSelect.deselectValue(viewableSelectValues[i]);
            }
        }
    }

    /**
     *  パスワード設定GUIの初期化
     */
    initPasswordGUI(contents) {
        // ユーザー名リストの設定
        if (this.userList) {
            this.authSelectPass.clear();
            for (let i = 0; i < this.userList.length; i = i + 1) {
                this.authSelectPass.addOption(this.userList[i].id, this.userList[i].name);
            }
        }
        this.authSelectPass.on(Select.EVENT_CHANGE, () => {
            this.oldPassInput.setValue("");
            this.newPassInput.setValue("");
            if (this.authSelectPass.getSelectedIndex() >= 0) {
                let index = -1;
                let id = this.authSelectPass.getSelectedValue();
                for (let i = 0; i < this.userList.length; i = i + 1) {
                    if (this.userList[i].id === id) {
                        index = i;
                        break;
                    }
                }
                if (index >= 0 && this.userList.length > index) {
                    let type = this.userList[index].type;
                    if (type === "admin") {
                        this.oldPassInput.setEnable(true);
                        this.newPassInput.setEnable(true);
                    }
                    else if (type === "group" || type === "api") {
                        this.oldPassInput.setEnable(false);
                        this.newPassInput.setEnable(true);
                    }
                    else {
                        this.oldPassInput.setEnable(false);
                        this.newPassInput.setEnable(false);
                    }
                }
            }
        });
        this.managementApplyButton.on(Button.EVENT_CLICK, () => {
            let index = this.authSelectPass.getSelectedIndex();
            if (index >= 0) {
                let id = this.userList[index].id;
                if (this.newPassInput.getValue() <= 0) {
                    if (id === "Display" || id === "Guest") {
                        InputDialog.showOKInput({
                            name: i18next.t('cannot_set_to_this_user'),
                            opacity: 0.7,
                            zIndex: 90000001,
                            backgroundColor: "#888"
                        }, function () {
                            return;
                        });
                    }
                    else {
                        InputDialog.showOKInput({
                            name: i18next.t('input_valid_password'),
                            opacity: 0.7,
                            zIndex: 90000001,
                            backgroundColor: "#888"
                        }, function () {
                            return;
                        });
                    }
                    return;
                }
                if (!this.newPassInput.getValue().match("^[a-zA-Z0-9 -/:-@\[-\`\{-\~]+$")) {
                    InputDialog.showOKInput({
                        name: i18next.t('input_valid_password'),
                        opacity: 0.7,
                        zIndex: 90000001,
                        backgroundColor: "#888"
                    }, function () {
                        return;
                    });
                    return;
                }
                this.emit(ManagementDialog.EVENT_CHANGE_PASSWORD, id,
                    this.oldPassInput.getValue(), this.newPassInput.getValue(), (err, reply) => {
                    if (err) {
                        console.error(err, reply);
                        InputDialog.showOKInput({
                            name: i18next.t('input_valid_password'),
                            opacity: 0.7,
                            zIndex: 90000001,
                            backgroundColor: "#888"
                        }, function () {
                            return;
                        });
                        return;
                    }
                    let message = this.applyPassMessage;
                    message.style.visibility = "visible";
                    setTimeout(function () {
                        message.style.visibility = "hidden";
                    }, 2000);
                });
            }
        });
    }

    /**
     * 管理GUIを表示する
     * @param contents.dblist dbリスト
     */
    show(userList, displayGroupList, contents, currentDB, maxHistoryNum, displayPermission) {
        this.initAll();
        this.userList = userList;
        this.displayGroupList = displayGroupList;
        this.contents = contents;
        this.background = new PopupBackground();
        this.background.show();
        this.background.on('close', () => {
            this.close();
            this.emit(ManagementDialog.EVENT_CLOSE, null);
        });
        this.dom.style.display = "block";
        // DBの操作GUIの初期化
        this.initDBGUI(contents, currentDB);
        // 履歴管理GUIの初期化
        this.initHistoryGUI(contents, maxHistoryNum);
        // 閲覧・編集権限GUIの初期化
        this.initAuthorityGUI(contents);
        // パスワード設定GUIの初期化
        this.initPasswordGUI(contents);
        // 権限情報をGUIに反映.

        this.initDisplayPermission(contents,displayPermission);

        document.body.appendChild(this.dom);
    }

    close() {
        if (this.background) {
            this.background.removeListener('close');
            this.background.close();
            this.background = null;
        }
        document.body.removeChild(this.dom);
    }

    isShow() {
        return (this.background != null);
    }

    getSelectedDBIndex() {
        let selectedIndex = this.dbSelect.getSelectedIndex();
        return selectedIndex;
    }

    setSelectedDBIndex(index) {
        this.dbSelect.setSelectedIndex(index);
    }
}

// 新規DB保存領域作成&切り替え
ManagementDialog.EVENT_NEW_DB = "newdb";
ManagementDialog.EVENT_CHANGE_DB = "changedb";
ManagementDialog.EVENT_RENAME_DB = "renamedb";
ManagementDialog.EVENT_DELETE_DB = "deletedb";
ManagementDialog.EVENT_INIT_DB = "initdb";

// パスワード変更
ManagementDialog.EVENT_CHANGE_PASSWORD = "change_password";

// 権限変更変更
ManagementDialog.EVENT_CHANGE_AUTHORITY = "change_authority";

// ダイアログ閉じた
ManagementDialog.EVENT_CLOSE = "close";

// 最大履歴保存数の適用
ManagementDialog.EVENT_CHANGE_HISTORY_NUM = "change_history_num";

// 最大履歴保存数の適用
ManagementDialog.EVENT_CHANGE_DISPLAY_PERMISSION_LIST = "change_display_permission_list";

export default ManagementDialog;
