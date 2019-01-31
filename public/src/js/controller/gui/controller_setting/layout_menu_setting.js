import GUI from '../gui'
import Constants from '../../../common/constants';

/**
 * レイアウトメニューアイテム
 */
function LayoutMenuSetting() {
    return [
        // レイアウト追加
        {
            className : "add_layout",
            dataKey : "add_layout",
            onclick : (evt) => { this.contentInputGUI.inputLayout(); }
        },
        // レイアウト上書き
        {
            className : "overwrite_layout",
            dataKey : "overwrite_layout",
            onclick : (evt) => { this.contentInputGUI.updateLayout(); }
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
            onclick : (evt) => { this.action.selectContent({ type : Constants.TypeLayout, onlyCurrentGroup : true}); }
        },
        // 全選択
        {
            className : "select_all",
            dataKey : "select_all",
            onclick : (evt) => { this.action.selectContent({ type : Constants.TypeLayout, onlyCurrentGroup : false }); }
        },
        // -------
        {
            className : "hr"
        },
        // 削除
        {
            className : "delete",
            dataKey : "delete",
            onclick : (evt) => { this.action.deleteContent(); }
        },
    ];
}

export default LayoutMenuSetting;