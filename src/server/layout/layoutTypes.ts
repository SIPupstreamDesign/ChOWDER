/**
 * ContentsLayout 関連の型定義
 */

/**
 * レイアウト内の1コンテンツのスナップショット
 * position/size/visibility のみ保存する。
 * binaryId, type, creatorId, date は復元対象外のため保存しない。
 * 拡張フィールド（[key: string]: any）も保存しない。
 */
export interface ContentLayoutEntry {
    /** コンテンツインスタンスの識別子 */
    metadataId: string;

    /** X座標 */
    posx: number;

    /** Y座標 */
    posy: number;

    /** 幅 */
    width: number;

    /** 高さ */
    height: number;

    /** 元の幅（リサイズ前） */
    orgWidth?: number;

    /** 元の高さ（リサイズ前） */
    orgHeight?: number;

    /** Z-index */
    zindex?: number;

    /** 可視性 */
    visible?: boolean;

    /** MIMEタイプ */
    mime?: string;
}

/**
 * コンテンツレイアウト（保存済みスナップショット）
 */
export interface ContentsLayout {
    /** レイアウトID（UUID） */
    layoutId: string;

    /** ユーザー定義名 */
    name: string;

    /** 作成日時（ISO8601） */
    createdAt: string;

    /** 更新日時（ISO8601） */
    updatedAt: string;

    /** 保存時点の全コンテンツスナップショット（live-streamは除く） */
    entries: ContentLayoutEntry[];
}

/**
 * レイアウト一覧の要素（名前とIDのみ）
 */
export interface ContentsLayoutSummary {
    layoutId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * SaveContentsLayout リクエスト
 */
export interface SaveContentsLayoutRequest {
    /** レイアウト名 */
    name: string;
    /**
     * 指定した場合は上書き保存、省略した場合は新規作成
     */
    layoutId?: string;
}

/**
 * RestoreContentsLayout リクエスト
 */
export interface RestoreContentsLayoutRequest {
    layoutId: string;
}

/**
 * DeleteContentsLayout リクエスト
 */
export interface DeleteContentsLayoutRequest {
    layoutId: string;
}
