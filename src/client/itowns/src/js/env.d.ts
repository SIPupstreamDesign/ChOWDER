/**
 * グローバル変数・モジュールの型宣言
 */

// 3rdパーティの型情報がないJSファイルをanyとして扱う
declare module '*.js';
declare module '*.mjs';

declare const itowns: any;

interface Window {
    /** injectChOWDER: itownsビューをChOWDERに接続する関数 */
    injectChOWDER: (view: any, viewerDiv: HTMLElement, timeCallback?: ((date: Date) => void) | null) => void;
    /** resizeイベントリスナーの保持リスト（itowns側のresizeを制御するため） */
    resizeListeners: EventListenerOrEventListenerObject[];
    /** chowder_itowns_view_type: 表示モード ("itowns" | "display" | "controller") */
    chowder_itowns_view_type: string;
    /** encoding-japanese が window に公開するオブジェクト */
    Encoding: any;
    /** papaparse が window に公開するオブジェクト */
    Papa: any;
    /** colormap ライブラリのグローバル関数 */
    colormap: (options: { colormap: string; nshades: number; format: string; alpha: number }) => string[];
    /** パフォーマンス計測用フラグ */
    nowMeasurePerformance: number;
    /** パフォーマンス計測用テクスチャサイズ配列 */
    measureDLTex: number[];
    /** パフォーマンス計測用カウンタ */
    findb3dm: number;
}
