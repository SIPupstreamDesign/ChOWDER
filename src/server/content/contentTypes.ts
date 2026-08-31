/**
 * コンテンツ管理の型定義
 */

/**
 * コンテンツタイプ
 */
export const ContentType = {
    IMAGE: 'image',
    VIDEO: 'video',
    TEXT: 'text',
    PDF: 'pdf',
    URL: 'url',
    WEBGL: 'webgl',
    TILEIMAGE: 'tileimage',
    LIVE_STREAM: 'live-stream',
} as const;
export type ContentType = typeof ContentType[keyof typeof ContentType];

/**
 * コンテンツメタデータ
 */
export interface ContentMetadata {
    /** メタデータID（コンテンツインスタンスの識別子） */
    metadataId: string;

    /** バイナリID（実データの識別子） */
    binaryId: string;

    /** コンテンツタイプ */
    type: ContentType;

    /** 作成者のユーザーID */
    creatorId: string;

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

    /** 可視性 */
    visible?: boolean;

    /** Z-index（小文字で統一） */
    zindex?: number;

    /** MIMEタイプ */
    mime?: string;

    /** 更新日時（ISO 8601形式） */
    date?: string;

    /** 作成日時（ISO 8601形式）。更新時は変更しない。 */
    createdAt: string;

    // ===== WebGL (iTowns) 専用フィールド =====

    /** コンテンツURL（webgl タイプ） */
    url?: string;

    /** レイヤーリスト JSON 文字列（webgl / iTowns） */
    layerList?: string;

    /** タイムラインの同期フラグ（webgl / iTowns） */
    sync?: boolean;

    /** WebGL サブタイプ識別子 */
    webglType?: string;

    /** ユーザー任意テキスト */
    user_data_text?: string;
}

/**
 * iTowns カメラデータ（content:camera:{id} に独立保存）
 * UpdateCameraMatrix コマンドでのみ更新される。
 * ContentMetadata には含まれない。
 */
export interface ITownsCameraData {
    metadataId: string;
    cameraWorldMatrix: string; // Three.js Matrix4 の JSON 文字列
    cameraParams: string;      // カメラパラメータの JSON 文字列
}

/**
 * ライブストリームメタデータ（ContentMetadataの拡張）
 */
export interface StreamMetadata extends Omit<ContentMetadata, 'binaryId'> {
    type: (typeof ContentType)['LIVE_STREAM'];
    binaryId: null;          // ストリームはバイナリなし
    streamId: string;        // StreamInfoへの参照
    streamName: string;      // "WebCam1", "Screen Share" など
    userId: string;          // mediasoup管理用のユーザーID（StreamInfoと同じ値）
    socketId: string;        // WebSocketのID
    producerId: string;      // Video ProducerのID（削除時に使用）
    subtype?: 'camera' | 'screen' | 'video-file'; // 配信種別
    // creatorIdは親のContentMetadataから継承（配信開始者のID）
}

/**
 * バイナリデータの参照情報
 */
export interface BinaryReference {
    /** バイナリID */
    binaryId: string;

    /** 参照カウント */
    refCount: number;

    /** データサイズ（バイト） */
    size: number;

    /** MIMEタイプ */
    mime?: string;
}

/**
 * コンテンツ追加のリクエスト
 */
export interface AddContentRequest {
    /** メタデータ（metadataIdとtypeは省略可） */
    metadata: Partial<ContentMetadata> & {
        type?: ContentType | string; // 文字列リテラルも許可
    };

    /**
     * バイナリデータ（Buffer）。
     * tileimage タイプはアップロード前の段階ではバイナリがないため省略可。
     */
    binary?: Buffer | null;
}

/**
 * ライブストリームメタデータ追加リクエスト
 */
export interface AddStreamMetadataRequest {
    streamId: string;
    streamName: string;
    creatorId: string;       // 配信開始者のユーザーID
    userId: string;          // mediasoup管理用のユーザーID
    socketId: string;
    producerId: string;
    posx: number;
    posy: number;
    width: number;
    height: number;
    subtype?: 'camera' | 'screen' | 'video-file'; // 配信種別
}

/**
 * コンテンツ更新のリクエスト
 */
export interface UpdateContentRequest {
    /** メタデータID */
    metadataId: string;

    /** 更新するバイナリデータ（省略可） */
    binary?: Buffer;

    /** 更新するメタデータ */
    metadata: Partial<ContentMetadata>;
}

/**
 * タイルイメージ用メタデータ（ContentMetadataを継承）
 */
export interface TileImageMetadata extends ContentMetadata {
    type: (typeof ContentType)['TILEIMAGE'];
    /** 横方向のタイル分割数 */
    xsplit: number;
    /** 縦方向のタイル分割数 */
    ysplit: number;
    /** タイル1枚の辺の長さ（ピクセル）: デフォルト256 */
    tileSize: number;
    /** 縮小版（LOD用）の幅（ピクセル） */
    reductionWidth: number;
    /** 縮小版（LOD用）の高さ（ピクセル） */
    reductionHeight: number;
    /** 全タイルの保存が完了したか */
    tileFinished: boolean;
}

/**
 * GetTileContent リクエスト
 */
export interface GetTileContentRequest {
    /** コンテンツのメタデータID */
    metadataId: string;
    /** 取得するタイルの通し番号（0 から xsplit*ysplit-1） */
    tileIndex: number;
}

/**
 * タイルイメージアップロード進捗通知のペイロード
 */
export interface TileimageProgressPayload {
    /** アップロード対象コンテンツのメタデータID */
    metadataId: string;
    /** 受信済みセグメント数 */
    receivedSegments: number;
    /** 全セグメント数 */
    totalSegments: number;
    /** フェーズ */
    phase: 'uploading' | 'processing';
}

/**
 * コンテンツ取得のレスポンス
 */
export interface GetContentResponse {
    /** メタデータ */
    metadata: ContentMetadata;

    /** バイナリデータ */
    binary: Buffer;

    /** カメラデータ（webgl タイプのみ、存在する場合） */
    cameraData?: ITownsCameraData;
}
