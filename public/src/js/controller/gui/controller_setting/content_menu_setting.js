import GUI from '../gui'
import Constants from '../../../common/constants'

/**
 * コンテンツメニューアイテム
 */
function ContentMenuSetting() 
{
    let subItems = [
        // 画像ファイル
        {
            className : "add_image",
            dataKey : "image_file",
            onmousedown : (evt)  => { this.contentInputGUI.inputImageFile(); }
        },
        // テキスト
        {
            className : "add_text",
            dataKey : "text",
            onmousedown : (evt) => { this.contentInputGUI.inputText(); }
        },
        // テキストファイル
        {
            className : "add_text_file",
            dataKey : "text_file",
            onmousedown : (evt) => { this.contentInputGUI.inputTextFile(); }
        },
        // pdfファイル
        {
            className : "add_pdf_file",
            dataKey : "pdf_file",
            onmousedown : () => { this.contentInputGUI.inputPDFFile(); }
        },
        // URL
        {
            className : "add_url",
            dataKey : "url",
            onmousedown : (evt) => { this.contentInputGUI.inputURL(); }
        },
        // 動画ファイル
        {
            className : "add_movie",
            dataKey : "movie_file",
            onmousedown : (evt) => { this.contentInputGUI.inputVideoFile(); }
        },
        // ScreenShare
        {
            className : "screenshare",
            dataKey : "screenshare",
            onmousedown : (evt) => { this.contentInputGUI.inputScreenShare(); }        
        },
        // CameraShare
        {
            className : "camerashare",
            dataKey : "camerashare",
            onmousedown : (evt) => { this.contentInputGUI.inputCameraShare();  }
        }
    ];

    return [
        // 最前面へ
        {
            className : "move_to_front",
            dataKey : "move_to_front",
            onmousedown : (evt) => { this.action.changeContentIndex({ toFront : true }); }
        },
        // 最背面へ
        {
            className : "move_to_back",
            dataKey : "move_to_back",
            onmousedown : (evt) => { this.action.changeContentIndex({ toFront : false }); }
        },
        // コンテンツ追加
        {
            className : "add_content",
            dataKey : "add_content",
            submenu : subItems
        },
        // グループ変更
        {
            className : "change_group",
            dataKey : "change_group",
            submenu : true,
            submenuBottomPixel : "137px"
        },
        // 画像差し替え
        {
            className : "swap_image",
            dataKey : "swap_image",
            onmousedown : (evt) => { this.contentInputGUI.inputUpdateImageFile(); }
        },
        // 
        {
            className : "context_menu_control_videos",
            dataKey : "control_videos_in_a_group",
            onmousedown : (evt) => {
                this.videoController.show(!this.videoController.isShow());
            }
        },
        // グループ内全て選択
        {
            className : "select_all_in_a_group",
            dataKey : "select_all_in_a_group",
            onmousedown : (evt) => { this.action.selectContent({ type : Constants.TypeContent, onlyCurrentGroup : true }); }
        },
        // 全て選択
        {
            className : "select_all",
            dataKey : "select_all",
            onmousedown : (evt) => { this.action.selectContent({ type : Constants.TypeContent, onlyCurrentGroup : false }); }
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
            onmousedown : (evt) => { this.action.deleteContent(); }
        }
    ];
}

export default ContentMenuSetting;