/**
 * Redis キー定義
 *
 * キー構造:
 * - 階層的に分類（auth, content, display, controller, site）
 * - Site機能では site:{siteId}:display_space を使用
 * - 索引・統計は含まない（シンプル版）
 */

export const REDIS_KEYS = {
  /**
   * 認証・ユーザー関連
   */
  AUTH: {
    /** ユーザー情報: auth:user:{userId} (Hash) */
    USER: (userId: string) => `auth:user:${userId}`,

    /** 初期ブートストラップ完了フラグ: auth:bootstrap:initialized (String) */
    BOOTSTRAP_INITIALIZED: 'auth:bootstrap:initialized',
  },

  /**
   * コンテンツ関連
   */
  CONTENT: {
    /** メタデータ: content:metadata:{contentId} (String - JSON) */
    METADATA: (contentId: string) => `content:metadata:${contentId}`,

    /** バイナリデータ: content:binary:{contentId} (String - Binary) */
    BINARY: (contentId: string) => `content:binary:${contentId}`,

    /** ストリーム情報: content:stream:{streamId} (String - JSON) */
    STREAM: (streamId: string) => `content:stream:${streamId}`,

    /** タイル画像データ: content:tile:{contentId} (Hash: tileIndex -> Binary) */
    TILE_DATA: (contentId: string) => `content:tile:${contentId}`,

    /** サムネイル画像（PNG 128px）: content:thumbnail:{contentId} (String - Binary) */
    THUMBNAIL: (contentId: string) => `content:thumbnail:${contentId}`,

    /** iTowns カメラデータ: content:camera:{contentId} (String - JSON) */
    CAMERA: (contentId: string) => `content:camera:${contentId}`,
  },

  /**
   * ディスプレイ関連
   */
  DISPLAY: {
    /** Display用ウィンドウメタデータ: display:window:{windowId} (String - JSON) */
    WINDOW: (windowId: string) => `display:window:${windowId}`,

    /** Displayセッション: display:session:{displayId} (String - JSON) */
    SESSION: (displayId: string) => `display:session:${displayId}`,

    /** Display表示名→ID マッピング: display:name_to_id:{displayName} (String) */
    NAME_TO_ID: (displayName: string) => `display:name_to_id:${displayName}`,
  },

  /**
   * Site関連
   */
  SITE: {
    /** Site全体データ: site:{siteId} (String - JSON) */
    DATA: (siteId: string) => `site:${siteId}`,

    /** Site一覧: site:list (Set) */
    LIST: 'site:list',

    /** Site固有のDisplaySpace設定: site:{siteId}:display_space (String - JSON) */
    DISPLAY_SPACE: (siteId: string) => `site:${siteId}:display_space`,

    /** SiteのDisplayWindowリスト: site:{siteId}:display_window_list (Set) */
    DISPLAY_WINDOW_LIST: (siteId: string) => `site:${siteId}:display_window_list`,
  },

  /**
   * OTP（ワンタイムパスワード）関連
   */
  OTP: {
    /** OTPトークン: otp:token:{token} (String - JSON, TTL=60s) */
    TOKEN: (token: string) => `otp:token:${token}`,
  },

  /**
   * ContentsLayout関連
   */
  LAYOUT: {
    /** レイアウトデータ: layout:{layoutId} (String - JSON) */
    DATA: (layoutId: string) => `layout:${layoutId}`,

    /** レイアウト一覧: layout:list (Set) */
    LIST: 'layout:list',
  },
} as const;

/**
 * パターンマッチング用（SCAN, KEYSコマンドで使用）
 */
export const REDIS_PATTERNS = {
  /** すべての認証キー */
  ALL_AUTH: 'auth:*',

  /** すべてのユーザーキー */
  ALL_USERS: 'auth:user:*',

  /** すべてのコンテンツキー */
  ALL_CONTENT: 'content:*',

  /** コンテンツメタデータのみ */
  CONTENT_METADATA: 'content:metadata:*',

  /** コンテンツバイナリのみ */
  CONTENT_BINARY: 'content:binary:*',

  /** コンテンツストリームのみ */
  CONTENT_STREAMS: 'content:stream:*',

  /** コンテンツタイルのみ */
  CONTENT_TILES: 'content:tile:*',

  /** コンテンツサムネイルのみ */
  CONTENT_THUMBNAILS: 'content:thumbnail:*',

  /** すべてのディスプレイキー */
  ALL_DISPLAY: 'display:*',

  /** Display用ウィンドウのみ */
  DISPLAY_WINDOWS: 'display:window:*',

  /** Displayセッションのみ */
  DISPLAY_SESSIONS: 'display:session:*',

  /** Display名前マッピングのみ */
  DISPLAY_NAME_MAPPINGS: 'display:name_to_id:*',

  /** すべてのSiteキー */
  ALL_SITES: 'site:*',

  /** Site一覧 */
  SITE_LIST: 'site:list',
} as const;
