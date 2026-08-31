/**
 * Site関連の型定義
 */

/**
 * DisplaySpace（ディスプレイウィンドウを並べるための仮想座標空間・グリッドガイド）
 */
export interface DisplaySpace {
    /** 仮想座標空間の幅 */
    virtualWidth: number;

    /** 仮想座標空間の高さ */
    virtualHeight: number;

    /** X方向のグリッド分割数（配置ガイド表示用） */
    splitX: number;

    /** Y方向のグリッド分割数（配置ガイド表示用） */
    splitY: number;

    /** 表示スケール */
    scale: number;

    /** タイプ識別子 */
    type: 'display_space';

    /** 所属 Site ID */
    siteId: string;
}

/**
 * UpdateDisplaySpace リクエスト
 */
export interface UpdateDisplaySpaceRequest {
    virtualWidth?: number;
    virtualHeight?: number;
    splitX?: number;
    splitY?: number;
    scale?: number;
}

/**
 * Site（物理的な場所・物理ディスプレイ配置の管理単位）
 */
export interface Site {
    /** Site ID */
    siteId: string;

    /** Site 名（表示用） */
    siteName: string;

    /** 説明 */
    description?: string;

    /** デフォルト Site フラグ（サーバー起動時に自動生成） */
    isDefault: boolean;

    /** 作成日時 */
    createdAt: string;

    /** 更新日時 */
    updatedAt: string;

    /** Controller でディスプレイ矩形を表示するときに使う色（例: "#3399ff"） */
    color?: string;

    /** このSiteのDisplaySpace（グリッド・仮想座標空間設定）。API レスポンス時に付与される */
    displaySpace?: DisplaySpace;
}

/**
 * CreateSite リクエスト
 */
export interface CreateSiteRequest {
    siteName: string;
    description?: string;
    color?: string;
}

/**
 * UpdateSite リクエスト
 */
export interface UpdateSiteRequest {
    siteId: string;
    siteName?: string;
    description?: string;
    color?: string;
}

/**
 * DeleteSite リクエスト
 */
export interface DeleteSiteRequest {
    siteId: string;
}

/**
 * GetSite リクエスト
 */
export interface GetSiteRequest {
    siteId: string;
}
