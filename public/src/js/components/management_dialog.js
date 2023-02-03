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

class ManagementDialog extends EventEmitter {
    constructor() {
        super();
    }

    initAll() {
        this.dom = document.createElement('div');
        this.dom.className = "management";
        this.dom.style.display = "none";


        let title = document.createElement('h2');
        title.textContent = i18next.t("management");

        this.dom.appendChild(title);

        let title3 = document.createElement('h4');
        title3.textContent = i18next.t("global_settings");
        this.dom.appendChild(title3);

        let dbFrameBackground = document.createElement('div');
        dbFrameBackground.className = "management_db_frame_bg"
        this.dom.appendChild(dbFrameBackground)

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
            let title2 = document.createElement('h4');
            title2.textContent = i18next.t("db_management");
            dbFrameBackground.appendChild(title2);

            let selectFrame = document.createElement('div');
            selectFrame.className = "frame management_db_frame";
            dbFrameBackground.appendChild(selectFrame);

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
            dbFrameBackground.appendChild(historyManagementTitle);

            let historyFrame = document.createElement('div');
            historyFrame.className = "frame";
            dbFrameBackground.appendChild(historyFrame);

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

        {
            this.adminSetting = document.createElement("div");
            dbFrameBackground.appendChild(this.adminSetting);

            let title = document.createElement('h4');
            title.textContent = i18next.t("admin_setting_password");
            this.adminSetting.appendChild(title);

            let passFrame = document.createElement('div');
            passFrame.className = "frame";
            this.adminSetting.appendChild(passFrame);

            {
                let passInputFrame = document.createElement('div');
                passInputFrame.className = "passinput_frame";
                {
                    let settingTarget = document.createElement('p');
                    settingTarget.textContent = i18next.t("setting_target");
                    passInputFrame.appendChild(settingTarget);

                    this.adminAuthSelectPass = new Select();
                    this.adminAuthSelectPass.getDOM().classList.add("auth_select");
                    passInputFrame.appendChild(this.adminAuthSelectPass.getDOM());
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
                    this.adminOldPassInput = new Input('password');
                    this.adminOldPassInput.getDOM().classList.add("passinput");
                    passInputFrame.appendChild(this.adminOldPassInput.getDOM());
                    passInputWrap.appendChild(passInputFrame);
                }

                {
                    let passInputFrame = document.createElement('div');
                    passInputFrame.className = "passinput_frame";
                    let newPassLabel = document.createElement('p');
                    newPassLabel.textContent = i18next.t("new_password");
                    passInputFrame.appendChild(newPassLabel);
                    this.adminNewPassInput = new Input('password');
                    this.adminNewPassInput.getDOM().classList.add("passinput");
                    passInputFrame.appendChild(this.adminNewPassInput.getDOM());
                    passInputWrap.appendChild(passInputFrame);
                }
            }
            passFrame.appendChild(passInputWrap);

            {
                let applyPassFrame = document.createElement('div');
                applyPassFrame.className = "apply_pass_frame";
                {
                    this.authManagementApplyButton = new Button();
                    this.authManagementApplyButton.getDOM().classList.add('management_apply_button');
                    this.authManagementApplyButton.setDataKey("apply");
                    applyPassFrame.appendChild(this.authManagementApplyButton.getDOM());

                    this.authApplyPassMessage = document.createElement('p');
                    this.authApplyPassMessage.textContent = i18next.t("password_changed");
                    this.authApplyPassMessage.className = "apply_pass_message";
                    applyPassFrame.appendChild(this.authApplyPassMessage);
                }
                passFrame.appendChild(applyPassFrame);
            }
        }


        let title4 = document.createElement('h4');
        title4.textContent = i18next.t("per_db_settings");
        this.dom.appendChild(title4);

        let perDBBackground = document.createElement('div');
        perDBBackground.className = "management_db_frame_bg"
        this.dom.appendChild(perDBBackground)

        /*
            <h4 data-key="authority_setting"></h4>
            <div class="frame">
                <p data-key="setting_target"></p>
                <select id="auth_select" class="auth_select">
                </select>
                <div>
                    <span class="auth_target_label" data-key="editable_content"></span>
                    <span class="auth_target_label" data-key="viewable_content"></span>
                    <span id="display_manipulate_label" data-key="editable_site"></span>
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
            perDBBackground.appendChild(authSettingTitle);

            let authSettingFrame = document.createElement('div');
            authSettingFrame.className = "frame";
            perDBBackground.appendChild(authSettingFrame);

            let authSettingTarget = document.createElement('p');
            authSettingTarget.textContent = i18next.t("setting_target");
            authSettingFrame.appendChild(authSettingTarget);

            this.authSelect = new Select();
            this.authSelect.getDOM().classList.add("auth_select");
            authSettingFrame.appendChild(this.authSelect.getDOM());

            let authTargetAllWrap = document.createElement('div');
            authTargetAllWrap.style.width = "100%";

            {
                let authTargetWrap1 = document.createElement('div');
                authTargetWrap1.style.width = "380px";
                authTargetWrap1.style.display = "inline-block"
                authTargetAllWrap.appendChild(authTargetWrap1);

                // ラベル
                let authLabelWrap1 = document.createElement('div');
                {
                    // 編集可能コンテンツ
                    this.editableContentLabel = document.createElement('span');
                    this.editableContentLabel.className = "auth_target_label";
                    this.editableContentLabel.textContent = i18next.t("editable_content");
                    authLabelWrap1.appendChild(this.editableContentLabel);

                    // 閲覧可能コンテンツ
                    this.viewableContentLabel = document.createElement('span');
                    this.viewableContentLabel.className = "auth_target_label";
                    this.viewableContentLabel.textContent = i18next.t("viewable_content");
                    authLabelWrap1.appendChild(this.viewableContentLabel);
                }
                authTargetWrap1.appendChild(authLabelWrap1);

                // Selectを入れるdiv
                this.authTargetFrame1 = document.createElement('div');
                this.authTargetFrame1.className = "auth_target_frame";
                authTargetWrap1.appendChild(this.authTargetFrame1);

            }

            {
                let authTargetWrap2 = document.createElement('div');
                authTargetWrap2.style.width = "380px";
                authTargetWrap2.style.display = "inline-block"
                authTargetAllWrap.appendChild(authTargetWrap2);

                // ラベル
                let authLabelWrap2 = document.createElement('div');
                {
                    // 編集可能サイト
                    this.editableDisplayLabel = document.createElement('span');
                    this.editableDisplayLabel.className = "auth_target_label";
                    this.editableDisplayLabel.textContent = i18next.t("editable_site");
                    authLabelWrap2.appendChild(this.editableDisplayLabel);

                    // 表示許可サイト
                    this.viewableSiteLabel = document.createElement('span');
                    this.viewableSiteLabel.className = "auth_target_label";
                    this.viewableSiteLabel.textContent = i18next.t("viewable_site");
                    authLabelWrap2.appendChild(this.viewableSiteLabel);
                }
                authTargetWrap2.appendChild(authLabelWrap2);

                // Selectを入れるdiv
                this.authTargetFrame2 = document.createElement('div');
                this.authTargetFrame2.className = "auth_target_frame";
                authTargetWrap2.appendChild(this.authTargetFrame2);
            }
            authSettingFrame.appendChild(authTargetAllWrap);

            // グループの編集を許可
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
            perDBBackground.appendChild(title);

            let passFrame = document.createElement('div');
            passFrame.className = "frame";
            perDBBackground.appendChild(passFrame);

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
            passInputWrap.style.display = "inline-block"
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
                    //passInputWrap.appendChild(passInputFrame);
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
            title.textContent = i18next.t("display_settings");
            perDBBackground.appendChild(title);

            let displayPermissionFrame = document.createElement('div');
            displayPermissionFrame.className = "frame";
            perDBBackground.appendChild(displayPermissionFrame);

            let displayPermissionTitle = document.createElement('p');
            displayPermissionTitle.textContent = i18next.t("display_permission");
            displayPermissionFrame.appendChild(displayPermissionTitle);

            this.displaySelect = new CompareList(i18next.t("allowed"), i18next.t("blocked"));

            displayPermissionFrame.appendChild(this.displaySelect.getDOM());

            this.applyDisplaySettingMessage = document.createElement('p');
            this.applyDisplaySettingMessage.textContent = i18next.t("display_setting_changed");
            this.applyDisplaySettingMessage.className = "apply_display_setting_message";
            displayPermissionFrame.appendChild(this.applyDisplaySettingMessage);
        }


        let title5 = document.createElement('h4');
        title5.textContent = i18next.t("application_control");
        this.dom.appendChild(title5);

        let displayControlBackground = document.createElement('div');
        displayControlBackground.className = "management_db_frame_bg"
        this.dom.appendChild(displayControlBackground)

        {
            let reloadAllDisplayFrame = document.createElement('div');
            reloadAllDisplayFrame.className = "apply_pass_frame";
            {
                this.reloadAllDisplayButton = new Button();
                this.reloadAllDisplayButton.getDOM().classList.add('management_reload_all_display_button');
                this.reloadAllDisplayButton.setDataKey("reload_all_display");
                reloadAllDisplayFrame.appendChild(this.reloadAllDisplayButton.getDOM());
            }
            displayControlBackground.appendChild(reloadAllDisplayFrame);
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

        let isDisableEdit = (currentDB === "default");
        this.renameDBButton.getDOM().disabled = isDisableEdit;
        this.deleteDBButton.getDOM().disabled = isDisableEdit;

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
    initDisplayPermission(contents, displayPermissionList) {
        this.displaySelect.on(CompareList.EVENT_APPLY, (err, data) => {
            this.emit(ManagementDialog.EVENT_CHANGE_DISPLAY_PERMISSION_LIST, null, data, (err, data) => {
                let message = this.applyDisplaySettingMessage;
                message.style.visibility = "visible";
                setTimeout(function () {
                    message.style.visibility = "hidden";
                }, 2000);
            });
        });
        this.displaySelect.setData(displayPermissionList);
    }

    /**
     *  Application Control設定の初期化
     */
    initApplicationControlGUI()
    {
        this.reloadAllDisplayButton.on('click', () => {
            this.emit(ManagementDialog.EVENT_RELOAD_ALL_DISPLAY, null);
        });
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

        // 編集可能コンテンツ
        this.editableSelect = new SelectList();
        // 閲覧可能コンテンツ
        this.viewableSelect = new SelectList();
        // 編集可能サイト
        this.displayEditableSelect = new SelectList();
        // 表示許可サイト
        this.viewableSiteSelect = new SelectList();


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
                if (user.type !== "admin" && user.type !== "api" && user.type !== "electron") {
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
            this.viewableSiteSelect.deselectAll();

            if (user) {
                if (user.type === "group")
                {
                    this.viewableSiteLabel.style.display = "inline-block"
                    this.viewableSiteSelect.getDOM().style.display = "inline-block"
                }
                else
                {
                    this.viewableSiteLabel.style.display = "none"
                    this.viewableSiteSelect.getDOM().style.display = "none"
                }

                if (user.type === "display")
                {
                    this.editableDisplayLabel.style.display = "none"
                    this.displayEditableSelect.getDOM().style.display = "none"
                }
                else
                {
                    this.editableDisplayLabel.style.display = "inline-block"
                    this.displayEditableSelect.getDOM().style.display = "inline-block"
                }

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
                    if (user.viewableSite && (user.viewableSite === "all" || user.viewableSite.indexOf(listContentName) >= 0)) {
                        this.viewableSiteSelect.select(this.displayGroupList[i].name);
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
                if (user.viewableSite && user.viewableSite === "all") {
                    this.viewableSiteSelect.select(allAccessText);
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
        this.viewableSiteSelect.on('change', (err, text, isSelected) => {
            if (text === allAccessText) {
                if (isSelected) {
                    this.viewableSiteSelect.selectAll();
                }
                else {
                    this.viewableSiteSelect.deselectAll();
                }
            }
            else {
                // 全てが選択された状態で全て以外が選択解除された. 全てを選択解除する.
                let viewableSite = this.viewableSiteSelect.getSelectedValues();
                if (!isSelected && text !== allAccessText && viewableSite.indexOf(allAccessText) >= 0) {
                    this.viewableSiteSelect.deselect(allAccessText);
                }
            }
        });

        this.authTargetFrame1.innerHTML = "";
        this.authTargetFrame2.innerHTML = "";
        this.editableSelect.add(allAccessText, allAccessText);
        this.viewableSelect.add(allAccessText, allAccessText);
        this.displayEditableSelect.add(allAccessText, allAccessText);
        this.viewableSiteSelect.add(allAccessText, allAccessText);
        for (i = 0; i < this.userList.length; i = i + 1) {
            if (this.userList[i].type !== "admin" &&
                this.userList[i].type !== "display" &&
                this.userList[i].type !== "guest" &&
                this.userList[i].type !== "api" &&
                this.userList[i].type !== "electron") {
                this.editableSelect.add(this.userList[i].name, this.userList[i].id);
                this.viewableSelect.add(this.userList[i].name, this.userList[i].id);
            }
        }
        for (i = 0; i < this.displayGroupList.length; ++i) {
            if (this.displayGroupList[i].id !== Constants.DefaultGroup) {
                this.displayEditableSelect.add(this.displayGroupList[i].name, this.displayGroupList[i].id);
                this.viewableSiteSelect.add(this.displayGroupList[i].name, this.displayGroupList[i].id);
            }
        }
        this.authTargetFrame1.appendChild(this.editableSelect.getDOM());
        this.authTargetFrame1.appendChild(this.viewableSelect.getDOM());
        this.authTargetFrame2.appendChild(this.displayEditableSelect.getDOM());
        this.authTargetFrame2.appendChild(this.viewableSiteSelect.getDOM());
        this.authApplyButton.on(Button.EVENT_CLICK, () => {
            let index = this.authSelect.getSelectedIndex();
            if (index >= 0 && this.authSelect.getOptions().length > index) {
                let id = this.authSelect.getSelectedValue();
                let editable = this.editableSelect.getSelectedValues();
                let viewable = this.viewableSelect.getSelectedValues();
                let displayEditable = this.displayEditableSelect.getSelectedValues();
                let viewableSite = this.viewableSiteSelect.getSelectedValues();
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
                if (viewableSite.indexOf(allAccessText) >= 0) {
                    viewableSite = "all";
                }
                this.emit(ManagementDialog.EVENT_CHANGE_AUTHORITY, id, editable, viewable, displayEditable, viewableSite, group_manipulatable, () => {
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
            this.adminAuthSelectPass.clear();
            for (let i = 0; i < this.userList.length; i = i + 1) {
                const type = this.userList[i].type;
                if (type === "admin") {
                    this.adminAuthSelectPass.addOption(this.userList[i].id, this.userList[i].name);
                }
                if (type !== "admin" && type !== "guest" && type !== "display" && type !== "electronDisplay") {
                    this.authSelectPass.addOption(this.userList[i].id, this.userList[i].name);
                }
            }
        }
        let AuthSelectChangeFunc = (select, oldInput, newInput) => {
            return () => {
                oldInput.setValue("");
                newInput.setValue("");
                if (select.getSelectedIndex() >= 0) {
                    let index = -1;
                    let id = select.getSelectedValue();
                    for (let i = 0; i < this.userList.length; i = i + 1) {
                        if (this.userList[i].id === id) {
                            index = i;
                            break;
                        }
                    }
                    if (index >= 0 && this.userList.length > index) {
                        let type = this.userList[index].type;
                        if (type === "admin") {
                            oldInput.setEnable(true);
                            newInput.setEnable(true);
                        }
                        else if (type === "group" || type === "api" || type === "electron" || type === "moderator" || type === "attendee") {
                            oldInput.setEnable(false);
                            newInput.setEnable(true);
                        }
                        else {
                            oldInput.setEnable(false);
                            newInput.setEnable(false);
                        }
                    }
                }
            };
        };
        this.authSelectPass.on(Select.EVENT_CHANGE, AuthSelectChangeFunc(this.authSelectPass, this.oldPassInput, this.newPassInput));
        this.adminAuthSelectPass.on(Select.EVENT_CHANGE, AuthSelectChangeFunc(this.adminAuthSelectPass, this.adminOldPassInput, this.adminNewPassInput));
        this.authSelectPass.emit(Select.EVENT_CHANGE);
        this.adminAuthSelectPass.emit(Select.EVENT_CHANGE);

        let PasswordApplyFunc = (select, oldInput, newInput, message) => {
            return () => {
                let id = select.getSelectedValue();
                let index = -1;
                for (let i = 0; i < this.userList.length; i = i + 1) {
                    if (this.userList[i].id === id) {
                        index = i;
                        break;
                    }
                }
                if (index >= 0) {
                    let id = this.userList[index].id;
                    if (newInput.getValue() <= 0) {
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
                    if (!newInput.getValue().match("^[a-zA-Z0-9 -/:-@\[-\`\{-\~]+$")) {
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
                        oldInput.getValue(), newInput.getValue(), (err, reply) => {
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
                            message.style.visibility = "visible";
                            setTimeout(function () {
                                message.style.visibility = "hidden";
                            }, 2000);
                        });
                }
            }
        };
        this.managementApplyButton.on(Button.EVENT_CLICK, PasswordApplyFunc(this.authSelectPass, this.oldPassInput, this.newPassInput, this.applyPassMessage));
        this.authManagementApplyButton.on(Button.EVENT_CLICK, PasswordApplyFunc(this.adminAuthSelectPass, this.adminOldPassInput, this.adminNewPassInput, this.authApplyPassMessage));

    }

    /**
     * 管理GUIを表示する
     * @param contents.dblist dbリスト
     */
    show(userList, displayGroupList, contents, currentDB, maxHistoryNum, displayPermissionList, isAdmin) {
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

        this.initDisplayPermission(contents, displayPermissionList);

        this.initApplicationControlGUI();

        console.log("🐔management_dialog.show");
        if(isAdmin === true){
            this.adminSetting.style.display = "block";
        }else{
            this.adminSetting.style.display = "none";
        }

        document.body.appendChild(this.dom);
    }

    close() {
        if (this.background) {
            this.background.removeListener('close');
            this.background.close();
            this.background = null;
        }
        if (this.dom)
        {
            document.body.removeChild(this.dom);
            this.dom = null;
        }
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

// 全Displayリロード
ManagementDialog.EVENT_RELOAD_ALL_DISPLAY = "reload_all_display";

export default ManagementDialog;
