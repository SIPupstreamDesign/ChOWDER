/**
 * Display関連の型定義
 */

/**
 * WindowMetaData（各ディスプレイウィンドウの情報）
 */
export interface WindowMetaData {
    /** ウィンドウID */
    id: string;

    /** VirtualDisplay座標系でのウィンドウ左上X座標 */
    posx: number;

    /** VirtualDisplay座標系でのウィンドウ左上Y座標 */
    posy: number;

    /** VirtualDisplay座標系でのウィンドウ幅 */
    virtualWidth: number;

    /** VirtualDisplay座標系でのウィンドウ高さ */
    virtualHeight: number;

    /** 実際のブラウザピクセル幅 */
    pixelWidth: number;

    /** 実際のブラウザピクセル高さ */
    pixelHeight: number;

    /** コンテンツを表示するか否か（falseのときコントローラからまとめて制御できる） */
    contentVisible: boolean;

    /** タイプ識別子（常に'display'） */
    type: 'display';

    /** DisplayIDへの参照 */
    displayId?: string;

    /** Display表示名（UI表示用にキャッシュ） */
    displayName?: string;

    /** 所属 Site ID */
    siteId: string;

    /** オーナーユーザーID（将来の拡張用） */
    owner?: string;
}

/**
 * AddWindowMetaData リクエスト
 */
export interface AddWindowMetaDataRequest {
    id?: string;  // 指定されない場合は自動生成
    posx: number;
    posy: number;
    virtualWidth: number;
    virtualHeight: number;
    pixelWidth: number;
    pixelHeight: number;
    contentVisible?: boolean;
    displayId?: string;
    displayName?: string;
    siteId?: string;
}

/**
 * UpdateWindowMetaData リクエスト
 */
export interface UpdateWindowMetaDataRequest {
    id: string;
    posx?: number;
    posy?: number;
    virtualWidth?: number;
    virtualHeight?: number;
    pixelWidth?: number;
    pixelHeight?: number;
    contentVisible?: boolean;
    displayName?: string;
    /** Siteの変更 */
    siteId?: string;
}

/**
 * GetWindowMetaData リクエスト
 */
export interface GetWindowMetaDataRequest {
    id?: string;  // 指定されない場合は全件取得
    type?: 'all' | 'single';
}

/**
 * DeleteWindowMetaData リクエスト
 */
export interface DeleteWindowMetaDataRequest {
    id: string;
}

/**
 * Rect（矩形）
 */
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * GetDisplaysBySite リクエスト
 */
export interface GetDisplaysBySiteRequest {
    siteId: string;
}
