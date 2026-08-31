export interface JSONRPCMessage {
    jsonrpc: string;
    id?: string;
    method: string;
    params?: any;
    result?: any;
    error?: any;
}

export interface ContentMetadata {
    metadataId: string;
    binaryId: string;
    type: string;
    posx: number;
    posy: number;
    width: number;
    height: number;
    zindex?:number;
    mime?: string;
    visible?: boolean;
    /** 作成日時（ISO 8601形式）。更新時は変更しない。 */
    createdAt: string;
}

export interface ContentUpdateData {
    type: 'content';
    contentType: string;
    metadataId: string;
    binaryId: string;
    posx: number;
    posy: number;
    width: number;
    height: number;
    visible: boolean;
    originWidth: number;
    originHeight: number;
    zindex: number;
}

export interface DisplayUpdateData {
    type: 'display';
    windowId: string;
    posx: number;
    posy: number;
    width: number;
    height: number;
    visible: boolean;
    originWidth: number;
    originHeight: number;
    zindex: number;
}

export type UpdateStockData = ContentUpdateData | DisplayUpdateData;

/** @deprecated UpdateStockData を使用してください */
export type updateStockData = UpdateStockData;

export interface DragState {
    isDragging: boolean;
    startX: number;
    startY: number;
    startCenterX: number;
    startCenterY: number;
}
