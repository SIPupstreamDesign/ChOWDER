/**
 * ContentRenderer
 * コンテンツの DOM 描画責務を集約するクラス。
 * image / text / video / PDF / WebGL(iframe) / tileimage の各レンダリングと
 * WebGL コネクタ（IFrameConnector）の生存管理を担う。
 */

import { IFrameConnector } from '../common/IFrameConnector';
import { cameraMirrorUpdates } from '../common/cameraMirrorUpdates';
import { isCameraRevision, type CameraRevision } from '../../common/cameraState';
import { virtualToWindowCoordinates, type ContentMetadata, type WindowMetaData } from './contentCoordinates';
import { TileImageRenderer, type TileImageMetadata } from './TileImageRenderer';
import { resizeTextElem } from '../common/textUtils';

/** sendCommand の型エイリアス */
export type SendCommandFn = (method: string, params?: any) => Promise<any>;

/** ContentRenderer が DisplayClient に問い合わせる情報の取得関数 */
export type GetWindowMetaFn = () => WindowMetaData | null;
export type ReportIFrameInteractionFn = (metadataId: string, interaction: Record<string, unknown>) => void;

export class ContentRenderer {
    /** webgl コンテンツの metadataId → { iframe, connector, contentMeta } マップ */
    private webglConnectors: Map<string, { iframe: HTMLIFrameElement; connector: IFrameConnector; contentMeta: ContentMetadata }> = new Map();
    private readonly tileImageRenderer: TileImageRenderer;

    constructor(
        private readonly sendCommand: SendCommandFn,
        private readonly getWindowMeta: GetWindowMetaFn,
        private readonly reportIFrameInteraction?: ReportIFrameInteractionFn,
        private readonly getDiagnosticSessionId: () => string | null = () => null,
    ) {
        this.tileImageRenderer = new TileImageRenderer(sendCommand, getWindowMeta);
    }

    // ----------------------------------------------------------------
    // 画像
    // ----------------------------------------------------------------

    displayImage(elem: HTMLElement, data: ArrayBuffer, mime: string): void {
        const blob = new Blob([data], { type: mime });
        const url = URL.createObjectURL(blob);
        elem.innerHTML = `<img src="${url}" alt="content" />`;
    }

    // ----------------------------------------------------------------
    // テキスト
    // ----------------------------------------------------------------

    displayText(elem: HTMLElement, data: ArrayBuffer): void {
        try {
            const text = new TextDecoder().decode(data);
            const jsonObj = JSON.parse(text);
            const preElem = document.createElement('pre');
            preElem.innerHTML = jsonObj.value;
            preElem.style.color = jsonObj.fontColor || 'white';
            preElem.style.margin = '0';
            elem.innerHTML = '';
            elem.appendChild(preElem);
            // elem の高さが確定している場合は即時適用、まだ 0 なら style から取得
            const height = elem.clientHeight || parseFloat(elem.style.height) || 0;
            resizeTextElem(preElem, height);
        } catch (e) {
            console.error('[ContentRenderer] Failed to parse text content:', e);
            elem.innerHTML = '<pre>(text content unavailable)</pre>';
        }
    }

    resizeTextContent(elem: HTMLElement): void {
        const preElem = elem.querySelector('pre');
        if (preElem === null) {
            return;
        }

        const height = elem.clientHeight > 0
            ? elem.clientHeight
            : parseFloat(elem.style.height);
        if (!Number.isFinite(height) || height <= 0) {
            return;
        }

        resizeTextElem(preElem, height);
    }

    // ----------------------------------------------------------------
    // ビデオ
    // ----------------------------------------------------------------

    displayVideo(elem: HTMLElement, data: ArrayBuffer, mime: string): void {
        const blob = new Blob([data], { type: mime });
        const url = URL.createObjectURL(blob);
        elem.innerHTML = `<video src="${url}" controls autoplay loop></video>`;
    }

    // ----------------------------------------------------------------
    // PDF
    // ----------------------------------------------------------------

    displayPDF(elem: HTMLElement, result: any): void {
        const blob = result.binary instanceof Blob
            ? result.binary
            : new Blob([result.binary], { type: 'application/pdf' });
        const blobUrl: string = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        if (blob) {
            iframe.src = `${blobUrl}#toolbar=0`;
        } else {
            iframe.src = `data:${result.mime};base64,${result.binary}#toolbar=0`;
        }
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        elem.appendChild(iframe);
    }

    // ----------------------------------------------------------------
    // WebGL (iTowns) — iframe + IFrameConnector
    // ----------------------------------------------------------------

    displayWebGL(elem: HTMLElement, content: any, metadata: ContentMetadata): void {
        const metadataId = metadata.metadataId;
        // 既存の IFrameConnector を破棄
        const existing = this.webglConnectors.get(metadataId);
        if (existing) {
            existing.connector.destroy();
            this.webglConnectors.delete(metadataId);
        }

        const iframe = document.createElement('iframe');
        iframe.src = content.url;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.pointerEvents = 'none';
        iframe.style.border = 'none';
        elem.innerHTML = '';
        elem.appendChild(iframe);

        iframe.onload = () => {
            try {
                (iframe.contentWindow as any).chowder_itowns_view_type = 'display';
            } catch (_) { /* cross-origin guard */ }

            const connector = new IFrameConnector(iframe, 'display');
            this.webglConnectors.set(metadataId, { iframe, connector, contentMeta: metadata });
            connector.on('DiagnosticInteraction', (_error, params) => {
                if (typeof params === 'object' && params !== null) {
                    this.reportIFrameInteraction?.(metadataId, params as Record<string, unknown>);
                }
            });
            const reportFrameFocus = (event: FocusEvent): void => {
                this.reportIFrameInteraction?.(metadataId, {
                    type: `iframe-${event.type}`,
                    diagnosticSessionId: this.getDiagnosticSessionId(),
                    isTrusted: event.isTrusted,
                    target: { tagName: 'IFRAME', metadataId },
                });
            };
            if (this.getDiagnosticSessionId() !== null) {
                iframe.addEventListener('focus', reportFrameFocus);
                iframe.addEventListener('blur', reportFrameFocus);
            }
            connector.connect(() => {
                if (content.cameraWorldMatrix && content.cameraParams) {
                    try {
                        cameraMirrorUpdates.restore(connector, { ...content, metadataId });
                        this.sendInitLayers(connector, content);
                    } catch (e) {
                        this.sendInitLayers(connector, content);
                    }
                } else {
                    this.sendInitLayers(connector, content);
                }
                // 初回フラスタム調整
                this.sendWebGLResize(metadataId);
            });
        };
    }

    /**
     * 指定 metadataId のフラスタム調整を itowns iframe に送信する
     */
    sendWebGLResize(metadataId: string): void {
        const webgl = this.webglConnectors.get(metadataId);
        if (!webgl) return;
        // Display モード: setViewOffset は使わず、elem サイズ = document.body サイズ でフルレンダリング
        const resizeParams: Record<string, unknown> = { displayMode: true };
        const diagnosticSessionId = this.getDiagnosticSessionId();
        if (diagnosticSessionId !== null) {
            resizeParams.diagnosticSessionId = diagnosticSessionId;
        }
        webgl.connector.send('Resize', resizeParams);
    }

    /**
     * 全 WebGL コネクタのフラスタム調整を送信する（ウィンドウ移動・リサイズ時に使用）
     */
    sendAllWebGLResize(): void {
        for (const metadataId of this.webglConnectors.keys()) {
            this.sendWebGLResize(metadataId);
        }
    }

    /**
     * コンテンツのメタデータ（位置・サイズ）を更新し、フラスタム調整を再送する。
     * レイヤーリストに変更がある場合は差分のみ iframe に通知する（再ロードなし）。
     * （コンテンツ位置変更時に使用）
     */
    updateWebGLContentMeta(metadataId: string, newMeta: ContentMetadata): void {
        const webgl = this.webglConnectors.get(metadataId);
        if (!webgl) return;
        const oldMeta = webgl.contentMeta;
        webgl.contentMeta = newMeta;
        this.sendWebGLResize(metadataId);
        this.syncLayerList(webgl.connector, oldMeta, newMeta);
    }

    /**
     * 旧・新レイヤーリストを比較し、差分のみ iframe に送信する。
     * どちらかが null/undefined の場合は InitLayers で全初期化する。
     */
    private syncLayerList(connector: IFrameConnector, oldMeta: ContentMetadata, newMeta: ContentMetadata): void {
        const oldLayers = this.parseLayerList(oldMeta.layerList);
        const newLayers = this.parseLayerList(newMeta.layerList);

        if (!newLayers) return;

        if (!oldLayers) {
            // 旧レイヤーリストがない場合は全初期化
            connector.send('InitLayers', newLayers);
            return;
        }

        const oldMap = new Map<string, any>(oldLayers.map((l: any) => [l.id, l]));
        const newMap = new Map<string, any>(newLayers.map((l: any) => [l.id, l]));

        // 削除されたレイヤー
        for (const id of oldMap.keys()) {
            if (!newMap.has(id)) {
                connector.send('DeleteLayer', { id });
            }
        }

        // 追加・変更されたレイヤー
        for (const [id, layer] of newMap.entries()) {
            if (!oldMap.has(id)) {
                connector.send('AddLayer', layer);
            } else if (JSON.stringify(oldMap.get(id)) !== JSON.stringify(layer)) {
                connector.send('ChangeLayerProperty', layer);
            }
        }
    }

    private parseLayerList(layerList: string | undefined | null): any[] | null {
        if (!layerList) return null;
        try {
            return JSON.parse(layerList);
        } catch {
            return null;
        }
    }

    /**
     * WebGL コネクタへカメラ更新を転送
     */
    sendWebGLCameraUpdate(
        metadataId: string,
        cameraWorldMatrix: string,
        cameraParams: string,
        diagnostic?: { diagnosticId: string; diagnosticSessionId: string },
        onDiagnostic?: (result: any) => void,
        revision?: CameraRevision,
    ): void {
        if (!isCameraRevision(revision)) {
            return;
        }
        if (!cameraMirrorUpdates.remember({ ...revision, metadataId, cameraWorldMatrix, cameraParams, ...diagnostic })) {
            return;
        }
        const webgl = this.webglConnectors.get(metadataId);
        if (!webgl) return;
        try {
            cameraMirrorUpdates.send(webgl.connector, metadataId, onDiagnostic
                ? (error, result) => {
                    if (!error) {
                        onDiagnostic(result);
                    }
                }
                : undefined);
        } catch (e) {
            console.error('[ContentRenderer] UpdateCamera parse error:', e);
        }
    }

    /**
     * 指定 metadataId の WebGL コネクタを破棄
     */
    destroyWebGL(metadataId: string): void {
        const webgl = this.webglConnectors.get(metadataId);
        if (webgl) {
            webgl.connector.destroy();
            this.webglConnectors.delete(metadataId);
        }
    }

    /**
     * 全 WebGL コネクタを破棄
     */
    destroyAllWebGL(): void {
        for (const { connector } of this.webglConnectors.values()) {
            connector.destroy();
        }
        this.webglConnectors.clear();
    }

    // ----------------------------------------------------------------
    // タイルイメージ（LOD判定 + 画面外スキップ + ちらつき防止）
    //
    // ちらつき防止のための3つの工夫（旧実装に基づく）:
    //  1. DOM要素の使い回し: <img>要素を初回のみ生成し、以降は src だけ更新。
    //     innerHTML='' を呼ばないのでコンテンツ移動時も既存画像が消えない。
    //  2. reduction_image を常時バックグラウンドに配置: タイル表示中も縮小版を
    //     タイルの下に置いておくことで、タイルがまだ空のセルでも空白にならない。
    //  3. keyvalue キャッシュ: 同一 keyvalue のタイルは GetTileContent を再発行しない。
    //     座標変更などコンテンツ内容が変わっていない場合はダウンロードゼロ。
    //
    // LOD 判定:
    //  - スクリーン表示サイズ ≤ reductionWidth/Height → reduction_image のみ表示
    //  - それ以上 → タイル表示（reduction は裏に維持）
    //
    // 画面外スキップ:
    //  - 各タイルの仮想矩形を virtualToWindowCoordinates() でスクリーン変換
    //  - ウィンドウ矩形 [0, 0, pixelWidth, pixelHeight] と非重複なタイルはリクエストしない
    // ----------------------------------------------------------------

    async displayTileImage(elem: HTMLElement, meta: TileImageMetadata): Promise<void> {
        await this.tileImageRenderer.update(elem, meta);
    }

    destroyTileImage(metadataId: string): void {
        this.tileImageRenderer.destroy(metadataId);
    }

    destroyAllTileImages(): void {
        this.tileImageRenderer.destroyAll();
    }

    // ----------------------------------------------------------------
    // ユーティリティ
    // ----------------------------------------------------------------

    escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private sendInitLayers(connector: IFrameConnector, content: any): void {
        if (!content.layerList) return;
        try {
            const layerList = JSON.parse(content.layerList);
            connector.send('InitLayers', layerList);
        } catch (e) {
            console.error('[ContentRenderer] Failed to parse layerList:', e);
        }
    }
}
