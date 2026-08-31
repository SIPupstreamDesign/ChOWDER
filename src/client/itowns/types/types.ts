/**
 * itowns2 型定義
 */

/** レイヤーデータ */
export interface LayerData {
    id: string;
    type: string;
    name?: string;
    url?: string;
    visible?: boolean;
    opacity?: number;
    color?: string;
    csv?: string;
    json?: string;
    [key: string]: any;
}

/** itownsコンテンツのメタデータ */
export interface ITownsMetaData {
    /** レガシーID（metadataId の別名） */
    id?: string;
    /** メタデータID */
    metadataId?: string;
    type: string;
    layerList: string; // JSON文字列
    sync?: boolean;
    webglType?: string;
    url?: string;
    user_data_text?: string;
    posx?: number;
    posy?: number;
    width?: number;
    height?: number;
    orgWidth?: number;
    orgHeight?: number;
    visible?: boolean;
    zindex?: number;
    creatorId?: string;
    binaryId?: string;
    date?: string;
}

/** タイムライン範囲バー */
export interface RangeBar {
    rangeStartTime: Date;
    rangeEndTime: Date;
}

/** WsConnector コールバック型 */
export type WSCallback = (err: any, res?: any) => void;

/** WsConnector バイナリコールバック型 */
export type WSBinaryCallback = (err: any, res?: { metaData: any; contentData: ArrayBuffer }) => void;
