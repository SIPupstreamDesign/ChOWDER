import type { Manipulator } from '../../../manipulator';
import type { ContentUpdateData } from '../../types';

/**
 * コンテンツレンダラーが参照するコンテキスト。
 * `ContentManager` が保持する依存と操作用コールバックをまとめる。
 */
export interface RendererContext {
    /** プレビューエリア DOM 要素 */
    viewArea: HTMLElement | null;
    /** ドラッグ移動操作時にアスペクト比ロックを行うマニピュレータ */
    manipulator: Manipulator | null;
    /** 現在のズーム率を返す */
    getZoom: () => number;
    /** コンテンツ更新情報を更新キューに積む */
    pushUpdateStock: (data: ContentUpdateData) => void;
    /** 自身の Socket ID を返す */
    getSocketId: () => string | null;
    /** ログイン中のユーザー ID を返す */
    getCurrentUser: () => string | null;
    /** 編集モード番号を返す */
    getEditMode: () => number;
    /** コンテキストメニューを表示する */
    showRightClickMenu: (e: MouseEvent) => void;
    /** 指定 metadataId のコンテンツを選択状態にする */
    selectMetadata: (metadataId: string) => void;
    /** 要素の dataset から正規化した metadataId を取得する */
    getValidMetadataIdFromElem: (elem: HTMLElement) => string | null;
    /** ライブストリームサムネイルをキャプチャしてサーバーに送信する */
    captureAndSendLiveStreamThumbnail: (metadataId: string, video: HTMLVideoElement) => Promise<void>;
    /** LiveStreamManager を返す */
    getLiveStreamManager: () => import('../../../liveStreamManager').LiveStreamManager | null;
    /** キューに積まれた保留中のプロデューサーを取り出す */
    consumePendingProducer: (producerId: string) => any | null;
    /** 新規プロデューサーの受信処理を行う */
    handleNewProducer: (params: any, knownMetadata?: any) => Promise<void>;
    /** video-file 送信側のプレビュー要素を producerId から取得する */
    getVideoFilePreviewElement: (producerId: string) => HTMLVideoElement | null;
    /** video-file プレビュー要素のアタッチ待ちを登録する */
    setPendingVideoFileElemId: (elemId: string, producerId: string) => void;
    /** video-file の再生オーバーレイを構築する */
    buildVideoFileOverlay: (elem: HTMLElement, video: HTMLVideoElement) => void;
    /** overlay 用のダミー要素スタイル文字列 */
    dmyElmStr: string;
    /** WebGL コネクタの Map（IFrameConnector を格納） */
    webglConnectors: Map<string, { iframe: HTMLIFrameElement; connector: import('../../IFrameConnector').IFrameConnector }>;
}

/**
 * コンテンツタイプ別 DOM 生成を担うレンダラーの基底インターフェース。
 *
 * 各レンダラーは `mount` メソッドを実装し、受け取った `elem` に子要素を追加する。
 * マウント後の DOM 後処理（ライブストリームのアタッチ等）が必要な場合は
 * `mountPost` をオーバーライドする。
 */
export interface ContentRenderer {
    /**
     * 自クラスが処理すべきコンテンツタイプかどうかを判定する。
     * @param contentType サーバーから返される type 文字列
     */
    canHandle(contentType: string): boolean;

    /**
     * `elem` にコンテンツ種別固有の子要素を追加する。
     * @param elem コンテナ div 要素（click/mousedown 等の共通イベントは登録済み）
     * @param metadata サーバーのメタデータ
     * @param result `GetContent` コマンドの応答
     * @param ctx コンテキスト
     */
    mount(elem: HTMLElement, metadata: any, result: any, ctx: RendererContext): void;

    /**
     * `elem` が previewContent に appendChild された後に呼ばれる後処理。
     * 省略可。デフォルト実装は何もしない。
     */
    mountPost?(elem: HTMLElement, metadata: any, result: any, ctx: RendererContext): void;
}
