/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

class Action extends EventEmitter
{
    constructor()
    {
        super();
    }

	// デバッグ用. release版作るときは消す
	emit() {
		if (arguments.length > 0) {
			if (!arguments[0]) {
				console.error("Not found EVENT NAME!")
			}
		}
		super.emit(...arguments);
    }

    init(data) {
        this.emit(Action.EVENT_INIT, null, data);
    }

    /**
     * websocket接続
     * @param {*} data
     */
    connect(data) {
        this.emit(Action.EVENT_CONNECT, null, data);
    }

    reloadUserList(data) {
        this.emit(Action.EVENT_RELOAD_USERLIST, null, data);
    }

    /**
     * ログイン
     * @param {*} data
     * {
     *  userList : userList,
     *  userid : "",
     *  password : "",
     *  loginkey : loginkey,
     * }
     */
    login(data) {
        this.emit(Action.EVENT_LOGIN, null, data);
    }

    /**
     * 権限情報確認のためのログイン
     * @param {*} data
     * {
     *  userid : "",
     *  password : "",
     *  loginkey : loginkey,
     * }
     */
    loginForCheckAuthority(data) {
        this.emit(Action.EVENT_LOGIN_FOR_CHECK_AUTHORITY, null, data);
    }

    /**
     * ログアウト
     * @param {*} data
     * {
     *    loginkey: loginkey
     * }
     */
    logout(data) {
        this.emit(Action.EVENT_LOGOUT, null, data);
    }

    /**
     * 全体設定を更新
     * @param {*} data
     */
    reloadGlobalSetting(data) {
        this.emit(Action.EVENT_RELOAD_GLOBAL_SETTING, null, data);
    }

    changeGlobalSetting(data) {
        this.emit(Action.EVENT_CHANGE_GLOBAL_SETTING, null, data);
    }

    /**
	 * 全てのコンテンツ、ディスプレイなどを取得し、グループを含めて全てリロード
     */
    reloadAll(data) {
        this.emit(Action.EVENT_RELOAD_ALL, null, data);
    }

    /**
     * グループリストを取得
     * @param {*} data
     * {
     *    callback : 終了時コールバック(option)
     * }
     */
    getGroupList(data) {
        this.emit(Action.EVENT_GET_GROUP_LIST, null, data);
    }

    /**
     * パスワード更新
     * @param {*} data
     */
    changePassword(data) {
        this.emit(Action.EVENT_CHANGE_PASSWORD, null, data);
    }

    /**
     * 権限更新
     * @param {*} data
     */
    changeAuthority(data) {
        this.emit(Action.EVENT_CHANGE_AUTHORITY, null, data);
    }

    /**
     * 選択中のコンテンツのインデックスを変更する
     * @param {*} data
     * {
	 *    zIndex : 設定するzIndex
     *    toFront : 最前面に移動ならtrue, 最背面に移動ならfalse. こちらの値がzIndexより優先される.
     * }
     */
    changeContentIndex(data) {
        this.emit(Action.EVENT_CHANGE_CONTENT_INDEX, null, data);
    }

    /**
     * コンテンツの可視不可視を変更
     * @param {*} data metaData
     */
    changeContentVisible(data) {
        this.emit(Action.EVENT_CHANGE_CONTENT_VISIBLE, null, data);
    }

    /**
     * コンテンツの時刻表示の可視不可視を変更
     * @param {*} data 
     */
    changeContentDisplayTime(data) {
        this.emit(Action.EVENT_CHANGE_DISPLAY_TIME, null, data);
    }

    /**
     * 選択中のコンテンツのTransformを変更
     * @param {*} data
     */
    changeContentTransform(data) {
        this.emit(Action.EVENT_CHANGE_CONTENT_TRANSFORM, null, data);
    }

    /**
     * 選択中のコンテンツのメモを変更
     * @param {*} data
     * {
     *    metaData : メモ挿入済メタデータ
     *    contentData : テキストコンテンツの場合は登録するテキスト, そうでない場合は不要
     *    callback : 終了時コールバック(option)
     * }
     */
    changeContentMetaInfo(data) {
        this.emit(Action.EVENT_CHANGE_CONTENT_METAINFO, null, data);
    }

    /**
     * 動画デバイスの変更
     * @param {*} data
     * {
	 *    id : metaData.id,
	 *    deviceID : deviceID
     * }
     */
    changeVideoDevice(data) {
        this.emit(Action.EVENT_CHANGE_VIDEO_DEVICE, null, data);
    }

    /**
     * 音声デバイスの変更
     * @param {*} data
     * {
	 *    id : metaData.id,
	 *    deviceID : deviceID
     * }
     */
    changeAudioDevice(data) {
        this.emit(Action.EVENT_CHANGE_AUDIO_DEVICE, null, data);
    }

    /**
     * 動画クオリティの変更
     * @param {*} data
     * {
	 *    id : metaData.id,
     *    quality : 動画クオリティ
     * }
     */
    changeVideoQuality(data) {
        this.emit(Action.EVENT_CHANGE_VIDEO_QUALITY, null, data);
    }

    /**
     * 時系列データ同期
     * @param {*} data
     * {
     *   isSync : 同期するならtrue, 同期解除ならfalse
     * }
     */
    syncContent(data) {
        this.emit(Action.EVENT_SYNC_CONTENT, null, data);
    }

    /**
     * 画像ファイルを入力
     * @param {*} data
     * {
     *   contentData : 画像ファイルArrayBuffer,
     *   metaData : 登録用メタデータ
     * }
     */
    inputImageFile(data) {
        this.emit(Action.EVENT_INPUT_IMAGE_FILE, null, data);
    }

    /**
     * 動画ファイルを入力
     * @param {*} data
     * {
     *   contentData : 動画ファイルblob,
     *   metaData : 登録用メタデータ
     * }
     */
    inputVideoFile(data) {
        this.emit(Action.EVENT_INPUT_VIDEO_FILE, null, data);
    }

    /**
     * PDFファイルを入力
     * @param {*} data
     * {
     *   contentData : PDFファイルArrayBuffer,
     *   metaData : 登録用メタデータ
     * }
     */
    inputPDFFile(data) {
        this.emit(Action.EVENT_INPUT_PDF_FILE, null, data);
    }

    /**
     * URLを入力
     * {
     *   contentData : URL,
     *   metaData : 登録用メタデータ
     * }
     */
    inputURL(data) {
        this.emit(Action.EVENT_INPUT_URL, null, data);
    }

    /**
     * WebGL URLを入力
     * {
     *   contentData : WebGL URL,
     *   metaData : 登録用メタデータ
     * }
     */
    inputWebGL(data) {
        this.emit(Action.EVENT_INPUT_WEBGL, null, data);
    }

    /**
     * テキストを入力
     * @param {*} data
     * {
     *   contentData : テキスト,
     *   metaData : 登録用メタデータ
     * }
     */
    inputText(data) {
        this.emit(Action.EVENT_INPUT_TEXT, null, data);
    }

    /**
     * レイアウトを入力
     * @param {*} data
     * {
     *    contentData : {
     *      contents : {
     *          コンテンツID : メタデータ
     *      }
     *    }
     * }
     * metaData : 登録用メタデータ
     */
    inputLayout(data) {
        this.emit(Action.EVENT_INPUT_LAYOUT, null, data);
    }

    /**
     * 動画ストリームを入力
     * @param {*} data
     * {
     *   contentData : 動画blob,
     *   metaData : 登録用メタデータ
     * }
     */
    inputVideoStream(data) {
        this.emit(Action.EVENT_INPUT_VIDEO_STREAM, null, data);
    }

    /**
     * 画像を差し替える
     * @param {*} data
     * {
     *   id : 対象コンテンツのmetadataのid,
     *   img : imgオブジェクト,
     *   file : 画像ファイルArrayBuffer
     * }
     */
    updateImage(data) {
        this.emit(Action.EVENT_UPDATE_IMAGE, null, data);
    }

    /**
     * レイアウトを差し替える
     * {
     *    contentData : {
     *      contents : {
     *          コンテンツID : メタデータ
     *      }
     *    }
     * }
     * metaData : 登録用メタデータ
     */
    updateLayout(data) {
        this.emit(Action.EVENT_UPDATE_LAYOUT, null, data);
    }

    /**
     * コンテンツ取得
     * @param {*} data
     * {
     *    request : リクエストメタデータ,
     *    callback : 終了時コールバック(option)
     * }
     */
    getContent(data) {
        this.emit(Action.EVENT_GET_CONTENT, null, data);
    }

    /**
     * 全て再取得
     * @param {*} data
     * {
     *    callback : 終了時コールバック(option)
     * }
     */
    getAll(data) {
        this.emit(Action.EVENT_GET_ALL, null, data);
    }

    /**
     * コンテンツ削除
     * @param data メタデータのリスト. nullの場合は選択中のコンテンツを削除
     */
    deleteContent(data) {
        this.emit(Action.EVENT_DELETE_CONTENT, null, data);
    }

    /**
     * コンテンツ選択
     * @param {*} data
     * {
     *   id : 特定のコンテンツの未選択する場合に記載,
     *   onlyCurrentGroup : 現在のグループ内のみ対象ならtrue, 全グループ対象ならfalse
     * }
     */
    selectContent(data) {
        this.emit(Action.EVENT_SELECT_CONTENT, null, data);
    }

    /**
     * コンテンツ選択解除
     * @param {*} data
     * {
     *   id : 特定のコンテンツの未選択する場合に記載,
     *   onlyCurrentGroup : 現在のグループ内のみ対象ならtrue, 全グループ対象ならfalse
     * }
     */
    unselectContent(data) {
        this.emit(Action.EVENT_UNSELECT_CONTENT, null, data);
    }

    /**
     * コンテンツ復元
     */
    restoreContent(data) {
        this.emit(Action.EVENT_RESTORE_CONTENT, null, data);
    }

    /**
     * Historyコンテンツ復元
     * @param {*} data
     * {
     *   id : 対象のメタデータID,
     *   restoreKey : 復元用キー,
     *   restoreValue : 復元用value
     * }
     */
    restoreHistoryContent(data) {
        this.emit(Action.EVENT_RESTORE_HISTORY_CONTENT, null, data);
    }

    /**
     * ディスプレイスケール変更
     * @param {*} data
     * {
     *    displayScale : スケール値
     * }
     */
    changeDisplayScale(data) {
        this.emit(Action.EVENT_CHANGE_DISPLAY_SCALE, null, data);
    }

    /**
     * ディスプレイ位置変更
     * {
     *    dx : x方向移動値,
     *    dy : y方向移動値
     * }
     */
    changeDisplayTrans(data) {
        this.emit(Action.EVENT_CHANGE_DISPLAY_TRANS, null, data);
    }

    /**
     * 選択中のディスプレイ削除
     */
    deleteDisplay(data) {
        this.emit(Action.EVENT_DELETE_DISPLAY, null, data);
    }

    /**
     * 選択中のディスプレイのID表示非表示
     * @param {*} data
     * {
     *    isShow : 表示か非表示か
     * }
     */
    showDisplayID(data) {
        this.emit(Action.EVENT_SHOW_DISPLAY_ID, null, data);
    }

    /**
     * 全ディスプレイリロード（デバッグ用）
     */
    reloadDisplay(data) {
        this.emit(Action.EVENT_RELOAD_DISPLAY, null, data);
    }

    /**
     * VirualDisplayボタンをクリックした
     * @param {*} data
     */
    clickVirtualDisplay(data) {
        this.emit(Action.EVENT_CLICK_VIRTUAL_DISPLAY, null, data);
    }

    /**
     * ディスプレイ色変更
     * @param {*} data
     * {
     *    color : カラー
     *    callback : 終了時コールバック(option)
     * }
     */
    changeDisplayColor(data) {
        this.emit(Action.EVENT_CHANGE_DISPLAY_COLOR, null, data);
    }

    /**
     * ディスプレイプロパティの変更
     * {
	 * width : w,
	 * height : h,
	 * centerX : 中心のX座標,
	 * centerY : 中心のY座標,
	 * splitX : 横分割数,
	 * splitY : 縦分割数,
	 * scale : スケール
	 * }
     */
    changeDisplayProperty(data) {
        this.emit(Action.EVENT_CHANGE_DISPLAY_PROPERTY, null, data);
    }

    /**
     * ディスプレイ可視不可視の変更
     * @param {*} data windowData
     */
    changeDisplayVisible(data) {
        this.emit(Action.EVENT_CHANGE_DISPLAY_VISIBLE, null, data);
    }

    /**
     * DBリスト更新
     */
    reloadDBList(data) {
        this.emit(Action.EVENT_RELOAD_DBLIST, null, data);
    }

    /**
     * DB新規作成
     * @param {*} data
     */
    newDB(data) {
        this.emit(Action.EVENT_NEW_DB, null, data);
    }

    /**
     * DB名前変更
     * @param {*} data
     */
    renameDB(data) {
        this.emit(Action.EVENT_RENAME_DB, null, data);
    }

    /**
     * DB変更
     * @param {*} data
     */
    changeDB(data) {
        this.emit(Action.EVENT_CHANGE_DB, null, data);
    }

    /**
     * DB削除
     * @param {*} data
     */
    deleteDB(data) {
        this.emit(Action.EVENT_DELETE_DB, null, data);
    }

    /**
     * DB初期化
     * @param {*} data
     */
    initDB(data) {
        this.emit(Action.EVENT_INIT_DB, null, data);
    }

    /**
     * グループ追加
     * @param {*} data
     * {
     *    groupName : グループ名
     * }
     */
    addGroup(data) {
        this.emit(Action.EVENT_ADD_GROUP, null, data);
    }

    /**
     * グループ削除
     * @param {*} data
     * {
     *    groupID : グループID
     * }
     */
    deleteGroup(data) {
        this.emit(Action.EVENT_DELETE_GROUP, null, data);
    }

    /**
     * 選択中のコンテンツのグループ変更
     * @param {*} data
     * {
     *    groupID : グループID
     * }
     */
    changeGroup(data) {
        this.emit(Action.EVENT_CHANGE_GROUP, null, data);
    }

    /**
     * Groupの選択が変更された
     * {
     *    groupID : グループID
     * }
     */
    changeGroupSelect(data) {
        this.emit(Action.EVENT_CHANGE_GROUP_SELECT, null, data);
    }

    /**
     * DisplayGroupの選択が変更された
     * {
     *    groupID : グループID
     * }
     */
    changeDisplayGroupSelect(data) {
        this.emit(Action.EVENT_CHANGE_DISPLAY_GROUP_SELECT, null, data);
    }

    /**
     * Groupを下に移動
     * {
     *    groupID : グループID
     * }
     */
    moveDownGroup(data) {
        this.emit(Action.EVENT_MOVE_DOWN_GROUP, null, data);
    }

    /**
     * Groupを上に移動
     * {
     *    groupID : グループID
     * }
     */
    moveUpGroup(data) {
        this.emit(Action.EVENT_MOVE_UP_GROUP, null, data);
    }

    /**
     * Group名を変更
     * {
     *    groupID : グループID
     *    groupName : グループ名
     * }
     */
    changeGroupName(data) {
        this.emit(Action.EVENT_CHANGE_GROUP_NAME, null, data);
    }

    /**
     * Group色を変更
     * {
     *    groupID : グループID
     *    color : グループカラー
     * }
     */
    changeGroupColor(data) {
        this.emit(Action.EVENT_CHANGE_GROUP_COLOR, null, data);
    }

    /**
     * タブの変更
     */
    changeTab(data) {
        this.emit(Action.EVENT_CHANGE_TAB, null, data);
    }

    /**
     * スナップタイプの変更
     * @param {*} data
     * {
     *   isDisplay : ディスプレイ用かどうか,
     *   snapType : スナップタイプ
     * }
     */
    changeSnapType(data) {
        this.emit(Action.EVENT_CHANGE_SNAP_TYPE, null, data);
    }

    /**
     * 検索文字列の変更
     * {
     *   text : text
     *   groups : groups
     * }
     */
    changeSearchInput(data) {
        this.emit(Action.EVENT_CHANGE_SEARCH_INPUT, null, data);
    }

    /**
     * コントローラIDを変更
     * @param {*} data
     * {
     *   id : コントローラid
     * }
     */
    changeControllerID(data) {
        this.emit(Action.EVENT_CHANGE_CONTROLLER_ID, null, data);
    }

    /**
     * リモートカーソルの有効無効設定
     * @param {*} data
     * {
     *   isEnable : 有効ならtrue
     *   x: mousePos.x,
     *   y: mousePos.y,
     *   rgb: 色
     * }
     */
    updateRemoteCursor(data) {
        this.emit(Action.EVENT_UPDATE_REMOTE_CURSOR, null, data);
    }

    /**
     * 全video巻き戻し
     */
    rewindAllVideo(data) {
        this.emit(Action.EVENT_REWIND_ALL_VIDEO, null, data);
    }

    /**
     * 全video再生
     */
    playAllVideo(data) {
        this.emit(Action.EVENT_PLAY_ALL_VIDEO, null, data);
    }

    /**
     * マニピュレータへのマウスダウン
     * @param {*} data
     */
    changeManipulatorMouseDownPos(data) {
        this.emit(Action.EVENT_CHANGE_MANIPULATOR_MOUSEDOWN_POS, null, data);
    }

    /**
     * マニピュレータの星がトグルされた
     * @param {*} data
     * {
     *    isActive : 押し込まれている状態かどうか
     * }
     */
    toggleManipulatorStar(data) {
        this.emit(Action.EVENT_TOGGLE_MANIPULATOR_STAR, null, data);
    }

    /**
     * マニピュレータのmemoがトグルされた
     * @param {*} data
     * {
     *    isActive : 押し込まれている状態かどうか
     * }
     */
    toggleManipulatorMemo(data) {
        this.emit(Action.EVENT_TOGGLE_MANIPULATOR_MEMO, null, data);
    }

    /**
     * マニピュレータ: pdfページ送り
     * @param {*} data
     * {
     *    id : メタデータのid
     *   delta : ページめくり
     *    callback : 終了時コールバック(option)
     * }
     */
    movePDFPageOnManipulator(data) {
        this.emit(Action.EVENT_MOVE_PDF_PAGE_ON_MANIPULATOR, null, data);
    }

    /**
     * マニピュレータ: 動画再生
     * @param {*} data
     * {
     *    id : メタデータのid,
     *    isPlaying : true=再生, flase=一時停止
     * }
     */
    playVideoOnManipulator(data) {
        this.emit(Action.EVENT_PLAY_VIDEO_ON_MANIPULATOR, null, data);
    }

    /**
     * 動画コンテンツのカメラ、マイクの有効無効を設定
     * @param {*} data
     * {
			isCameraOn : カメラが有効かどうか,
			isMicOn : マイクが有効かどうか
     * }
     */
    changeCameraMicEnable(data) {
        this.emit(Action.EVENT_CHANGE_CAMERA_MIC_ENABLE, null, data);
    }

    /**
     * コンテンツ用Elementのセットアップ（内部用）
     * TODO: データドリブンにしたい
     * @param {*} data
     * {
     *    element : セットアップするelement,
     *    id : メタデータのid
     * }
     */
    setupContentElement(data) {
        this.emit(Action.EVENT_SETUP_CONTENT_ELEMENT, null, data);
    }

    /**
     * 強調表示のトグル
     */
    toggleContentMarkIcon(data) {
        this.emit(Action.EVENT_TOGGLE_CONTENT_MARK_ICON, null, data);
    }

    /**
     * レイアウトの適用
     * @param {*} data
     * {
     *   type: metaData.type,
     *   id: metaData.id
     * }
     */
    applyContentLayout(data) {
        this.emit(Action.EVENT_APPLY_CONTENT_LAYOUT, null, data);
    }

    /**
     * アスペクト比の調整
	 * metaDataのorgWidth,orgHeightを元にアスペクト比を調整
     * @param {*} data metaData
     * {
     *   metaData : metaData,
     *    callback : 終了時コールバック(option)
     * }
     */
    correctContentAspect(data) {
        this.emit(Action.EVENT_CORRECT_CONTENT_ASPECT, null, data);
    }

    /**
     * 時系列コンテンツのアスペクト比の調整
     * @param {*} data metaData
     * {
     *   metaData : metaData,
     *    callback : 終了時コールバック(option)
     * }
     */
    correctHistoricalContentAspect(data) {
        this.emit(Action.EVENT_CORRECT_HISTORICAL_CONTENT_ASPECT, null, data);
    }

    /**
     * コンテンツまたはディスプレイのスナップ
     * @param {*} data
     * {
     *   metaData : メタデータ,
     *   screen スナップ先screenObject,
     *   element : 対象element
     * }
     */
    snapContentToScreen(data) {
        this.emit(Action.EVENT_SNAP_CONTENT_TO_SCREEN, null, data);
    }

    /**
     * 配信許可設定の再読み込み
     * @param {*} data windowData
     */
    reloadDisplayPermissionList(){
        this.emit(Action.EVENT_RELOAD_DISPLAY_PERMISSION_LIST, null, null);
    }

    /**
     * 配信許可設定の変更
     * @param {*} data 
     * {
     *    permissionList : ディスプレイ許可リスト,
     *    callback : 終了時コールバック(option)
     * }
     */
    changeDisplayPermissionList(data){
        this.emit(Action.EVENT_CHANGE_DISPLAY_PERMISSION_LIST, null, data);
    }

    /**
     * インラインフレームで開いたitownと通信するための関数を、コンテンツごとに登録
     * @param {*} data
     * {
     *   id : metaData.id,
     *   func : { hogeFunc : () => {}, .. }
     * }
     */
    addItownFunc(data) {
        this.emit(Action.EVENT_ADD_ITOWN_FUNC, null, data);
    }

    updateQgisMetadata(metaData){
        this.emit(Action.EVENT_UPDATE_QGIS_METADATA, null, metaData);
    }
};

Action.EVENT_INIT = "init";
Action.EVENT_CONNECT = "connect";
Action.EVENT_RELOAD_USERLIST = "reloadUserList";
Action.EVENT_CHANGE_PASSWORD = "changePassword";
Action.EVENT_CHANGE_AUTHORITY = "changeAuthority";
Action.EVENT_RELOAD_GLOBAL_SETTING = "reloadGlobalSetting";
Action.EVENT_CHANGE_GLOBAL_SETTING = "changeGlobalSetting";
Action.EVENT_RELOAD_ALL = "reloadAll";
Action.EVENT_LOGIN = "login";
Action.EVENT_LOGOUT = "logout";
Action.EVENT_CHANGE_CONTENT_INDEX = "changeContentIndex";
Action.EVENT_CHANGE_CONTENT_VISIBLE = "changeContentVisible";
Action.EVENT_CHANGE_DISPLAY_TIME = "changeContentDisplayTime";
Action.EVENT_CHANGE_CONTENT_TRANSFORM = "changeContentTransform";
Action.EVENT_CHANGE_CONTENT_METAINFO = "changeContentMetaInfo";
Action.EVENT_CHANGE_VIDEO_DEVICE = "changeVideoDevice";
Action.EVENT_CHANGE_AUDIO_DEVICE = "changeAudioDevice";
Action.EVENT_CHANGE_VIDEO_QUALITY = "changeVideoQuality";
Action.EVENT_INPUT_IMAGE_FILE = "inputImageFile";
Action.EVENT_INPUT_VIDEO_FILE = "inputVideoFile";
Action.EVENT_INPUT_PDF_FILE = "inputPDFFile";
Action.EVENT_INPUT_URL = "inputURL";
Action.EVENT_INPUT_WEBGL = "inputWebGL";
Action.EVENT_INPUT_TEXT = "inputText";
Action.EVENT_INPUT_LAYOUT = "inputLayout";
Action.EVENT_INPUT_VIDEO_STREAM = "inputVideoStream";
Action.EVENT_UPDATE_IMAGE = "updateImage";
Action.EVENT_UPDATE_LAYOUT = "updateLayout";
Action.EVENT_GET_ALL = "getAll";
Action.EVENT_GET_CONTENT = "getContent";
Action.EVENT_DELETE_CONTENT = "deleteContent";
Action.EVENT_SELECT_CONTENT = "selectContent";
Action.EVENT_UNSELECT_CONTENT = "unselectContent";
Action.EVENT_RESTORE_CONTENT = "restoreContent";
Action.EVENT_RESTORE_HISTORY_CONTENT = "restoreHistoryContent";
Action.EVENT_CHANGE_DISPLAY_SCALE = "changeDisplayScale";
Action.EVENT_CHANGE_DISPLAY_TRANS = "changeDisplayTrans";
Action.EVENT_DELETE_DISPLAY = "deleteDisplay";
Action.EVENT_SHOW_DISPLAY_ID = "showDisplayID";
Action.EVENT_RELOAD_DISPLAY = "reloadDisplay";
Action.EVENT_CLICK_VIRTUAL_DISPLAY = "clickVirtualDisplay";
Action.EVENT_CHANGE_DISPLAY_COLOR = "changeDisplayColor";
Action.EVENT_CHANGE_DISPLAY_PROPERTY = "changeDisplayProperty";
Action.EVENT_CHANGE_DISPLAY_VISIBLE = "changeDisplayVisible";
Action.EVENT_RELOAD_DBLIST = "reloadDBList";
Action.EVENT_NEW_DB = "newDB";
Action.EVENT_RENAME_DB = "renameDB";
Action.EVENT_CHANGE_DB = "changeDB";
Action.EVENT_DELETE_DB = "deleteDB";
Action.EVENT_INIT_DB = "initDB";
Action.EVENT_ADD_GROUP = "addGroup";
Action.EVENT_GET_GROUP_LIST = "getGroupList";
Action.EVENT_DELETE_GROUP = "deleteGroup";
Action.EVENT_CHANGE_GROUP = "changeGroup";
Action.EVENT_CHANGE_GROUP_SELECT = "changeGroupSelect";
Action.EVENT_CHANGE_DISPLAY_GROUP_SELECT = "changeDisplayGroupSelect";
Action.EVENT_CHANGE_GROUP_NAME = "changeGroupName";
Action.EVENT_CHANGE_GROUP_COLOR = "changeGroupColor";
Action.EVENT_CHANGE_TAB = "changeTab";
Action.EVENT_CHANGE_SNAP_TYPE = "changeSnapType";
Action.EVENT_CHANGE_SEARCH_INPUT = "changeSearchInput";
Action.EVENT_CHANGE_CONTROLLER_ID = "changeControllerID";
Action.EVENT_UPDATE_REMOTE_CURSOR = "updateRemoteCursor";
Action.EVENT_REWIND_ALL_VIDEO = "rewindAllVideo";
Action.EVENT_PLAY_ALL_VIDEO = "playAllVideo";
Action.EVENT_CHANGE_MANIPULATOR_MOUSEDOWN_POS = "changeManipulatorMouseDownPos";
Action.EVENT_TOGGLE_MANIPULATOR_STAR = "toggleManipulatorStar";
Action.EVENT_TOGGLE_MANIPULATOR_MEMO = "toggleManipulatorMemo";
Action.EVENT_MOVE_PDF_PAGE_ON_MANIPULATOR = "movePDFPageOnManipulator";
Action.EVENT_PLAY_VIDEO_ON_MANIPULATOR = "playVideoOnManipulator";
Action.EVENT_CHANGE_CAMERA_MIC_ENABLE = "changeCameraMicEnable";
Action.EVENT_SETUP_CONTENT_ELEMENT = "setupContentElement";
Action.EVENT_APPLY_CONTENT_LAYOUT = "applyContentLayout";
Action.EVENT_CORRECT_CONTENT_ASPECT = "correctContentAspect";
Action.EVENT_CORRECT_HISTORICAL_CONTENT_ASPECT = "correctHistoricalContentAspect";
Action.EVENT_SNAP_CONTENT_TO_SCREEN = "snapContentToScreen";
Action.EVENT_MOVE_UP_GROUP = "moveUpGroup";
Action.EVENT_MOVE_DOWN_GROUP = "moveDownGroup";
Action.EVENT_TOGGLE_CONTENT_MARK_ICON = "toggleContentMarkIcon";
Action.EVENT_LOGIN_FOR_CHECK_AUTHORITY = "loginForCheckAuthority";
Action.EVENT_SYNC_CONTENT = "syncContent";
Action.EVENT_RELOAD_DISPLAY_PERMISSION_LIST = "reloadDisplayPermissionList";
Action.EVENT_CHANGE_DISPLAY_PERMISSION_LIST = "changeDisplayPermissionList";
Action.EVENT_ADD_ITOWN_FUNC = "addItownFunc";
Action.EVENT_UPDATE_QGIS_METADATA = "updateQgisMetadata";

export default Action;
