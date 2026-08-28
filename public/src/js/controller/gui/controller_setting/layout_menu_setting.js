/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

 import Constants from '../../../common/constants';

/**
 * レイアウトメニューアイテム
 * GUI(gui.js)にバインドして使用する
 */
function LayoutMenuSetting() {
    return [
        // レイアウト追加
        {
            className : "add_layout",
            dataKey : "add_layout",
            onmousedown : (evt) => { this.contentInputGUI.inputLayout(); }
        },
        // レイアウト上書き
        {
            className : "overwrite_layout",
            dataKey : "overwrite_layout",
            onmousedown : (evt) => { this.contentInputGUI.updateLayout(); }
        },
        // グループ変更
        {
            className : "change_group",
            dataKey : "change_group",
            submenu : true,
            submenuBottomPixel : "90px"
        },
        // グループ内全選択
        {
            className : "select_all_in_a_group",
            dataKey : "select_all_in_a_group",
            onmousedown : (evt) => { this.action.selectContent({ type : Constants.TypeLayout, onlyCurrentGroup : true}); }
        },
        // 全選択
        {
            className : "select_all",
            dataKey : "select_all",
            onmousedown : (evt) => { this.action.selectContent({ type : Constants.TypeLayout, onlyCurrentGroup : false }); }
        },
        // -------
        {
            className : "hr"
        },
        // 削除
        {
            className : "delete",
            dataKey : "delete",
            onmousedown : (evt) => { this.action.deleteContent(); }
        },
    ];
}

export default LayoutMenuSetting;