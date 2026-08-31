/**
 * mediasoup 関連の型定義
 */

import type {
    RtpCapabilities,
    DtlsParameters,
    IceCandidate,
    IceParameters,
    RtpParameters,
} from 'mediasoup/types';

/**
 * ストリーム情報（Redisに保存）
 */
export interface StreamInfo {
    streamId: string;
    userId: string;
    socketId: string;
    producerIds: string[];  // video/audio の Producer ID
    streamName: string;     // "WebCam1", "Screen Share" など
    metadataId?: string;    // ContentMetadataへの参照
    created: string;        // ISO timestamp
}

/**
 * Transport情報（メモリ管理用）
 */
export interface TransportInfo {
    transportId: string;
    socketId: string;
    direction: 'send' | 'recv';
    created: Date;
}

/**
 * Producer情報（メモリ管理用）
 */
export interface ProducerInfo {
    producerId: string;
    socketId: string;
    userId: string;
    kind: 'audio' | 'video';
    streamId?: string;      // StreamInfo と紐付け
    created: Date;
}

/**
 * Consumer情報（メモリ管理用）
 */
export interface ConsumerInfo {
    consumerId: string;
    socketId: string;       // 受信者のsocketId
    producerId: string;     // どのProducerを受信しているか
    kind: 'audio' | 'video';
    created: Date;
}

/**
 * WebRTC Transport作成リクエスト
 */
export interface CreateTransportRequest {
    direction: 'send' | 'recv';
}

/**
 * WebRTC Transport作成レスポンス
 */
export interface CreateTransportResponse {
    id: string;
    iceParameters: IceParameters;
    iceCandidates: IceCandidate[];
    dtlsParameters: DtlsParameters;
}

/**
 * Transport接続リクエスト
 */
export interface ConnectTransportRequest {
    transportId: string;
    dtlsParameters: DtlsParameters;
}

/**
 * Producer作成リクエスト
 */
export interface ProduceRequest {
    transportId: string;
    kind: 'audio' | 'video';
    rtpParameters: RtpParameters;
    streamName?: string;    // "WebCam1" など
    posx?: number;          // 表示位置X
    posy?: number;          // 表示位置Y
    width?: number;         // 表示幅
    height?: number;        // 表示高さ
    subtype?: 'camera' | 'screen' | 'video-file'; // 配信種別
}

/**
 * Producer作成レスポンス
 */
export interface ProduceResponse {
    producerId: string;
    streamId?: string;      // streamName が指定された場合
    metadataId?: string;    // StreamMetadataのID（video producerの場合のみ）
}

/**
 * Consumer作成リクエスト
 */
export interface ConsumeRequest {
    transportId: string;
    producerId: string;
    rtpCapabilities: RtpCapabilities;
}

/**
 * Consumer作成レスポンス
 */
export interface ConsumeResponse {
    consumerId: string;
    producerId: string;
    kind: 'audio' | 'video';
    rtpParameters: RtpParameters;
}

/**
 * アクティブなProducerリストの取得レスポンス
 */
export interface ActiveProducersResponse {
    producers: Array<{
        producerId: string;
        userId: string;
        socketId: string;  // 送信元のsocketIdを追加
        kind: 'audio' | 'video';
        streamId?: string;
        streamName?: string;
        metadataId?: string;  // StreamMetadataへの参照
    }>;
}
