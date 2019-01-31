import Constants from "../../../common/constants";

/**
 * ディスプレイメニューアイテム
 */
function DisplayMenuSetting() {
    return [
        // ID表示
        {
            className : "show_id",
            dataKey : "show_id",
            onclick : (evt) => { this.action.showDisplayID(false) }
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
            className : "select_all_in_a_group",
            dataKey : "select_all_in_a_group",
            onclick : (evt) => { this.action.selectContent({ type : Constants.TypeWindow, onlyCurrentGroup : true}); }
        },
        // 非表示
        {
            className : "hide",
            dataKey : "hide",
            onclick : (evt) => { this.action.changeContentVisible({visible : false}); }
        },
        // -------
        {
            className : "hr"
        },
        // 削除
        {
            className : "delete",
            dataKey : "delete",
            onclick : (evt) => { this.action.deleteDisplay(); }
        }
    ];
}

export default DisplayMenuSetting;