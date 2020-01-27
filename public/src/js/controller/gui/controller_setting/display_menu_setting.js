/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Constants from "../../../common/constants";

/**
 * ディスプレイメニューアイテム
 * GUI(gui.js)にバインドして使用する
 */
function DisplayMenuSetting(isDebugMode = false) {
    let menuSetting = [
        // ID表示
        {
            className : "show_id",
            dataKey : "show_id",
            onmousedown : (evt) => { this.action.showDisplayID(false) }
        },
        // displayグループ変更
        {
            className : "change_group",
            dataKey : "change_displaygroup",
            submenu : true,
            submenuBottomPixel : "90px"
        },
        // グループ内全て選択
        {
            className : "select_all_in_a_site",
            dataKey : "select_all_in_a_site",
            onmousedown : (evt) => { this.action.selectContent({ type : Constants.TypeWindow, onlyCurrentGroup : true}); }
        },
        // 非表示
        {
            className : "hide",
            dataKey : "hide",
            onmousedown : (evt) => { this.action.changeContentVisible({visible : false}); }
        },
        // -------
        {
            className : "hr"
        },
        // 削除
        {
            className : "delete",
            dataKey : "delete",
            onmousedown : (evt) => { this.action.deleteDisplay(); }
        }
    ];
    if (isDebugMode)
    {
        // デバッグ用メニュー
        menuSetting.unshift(
            // 全ディスプレイリロード（デバッグ用）
            {
                className : "reload_all_display",
                dataKey : "reload_all_display",
                onmousedown : (evt) => { this.action.reloadDisplay() }
            });
    }
    
    return menuSetting;
}

export default DisplayMenuSetting;