/**
 * ContentRenderer
 * コンテンツの DOM 描画責務を集約するクラス。
 * image / text / video / PDF / WebGL(iframe) / tileimage の各レンダリングと
 * WebGL コネクタ（IFrameConnector）の生存管理を担う。
 */

import { IFrameConnector } from './IFrameConnector';
import { virtualToWindowCoordinates, type ContentMetadata, type WindowMetaData } from './contentCoordinates';
import { resizeTextElem } from '../common/textUtils';

/** sendCommand の型エイリアス */
export type SendCommandFn = (method: string, params?: any) => Promise<any>;

/** ContentRenderer が DisplayClient に問い合わせる情報の取得関数 */
export type GetWindowMetaFn = () => WindowMetaData | null;

export class ContentRenderer {
    /** webgl コンテンツの metadataId → { iframe, connector, contentMeta } マップ */
    private webglConnectors: Map<string, { iframe: HTMLIFrameElement; connector: IFrameConnector; contentMeta: ContentMetadata }> = new Map();

    constructor(
        private readonly sendCommand: SendCommandFn,
        private readonly getWindowMeta: GetWindowMetaFn,
    ) {}

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

            const connector = new IFrameConnector(iframe);
            this.webglConnectors.set(metadataId, { iframe, connector, contentMeta: metadata });

            connector.connect(() => {
                if (content.cameraWorldMatrix && content.cameraParams) {
                    try {
                        connector.send('UpdateCamera', {
                            mat: JSON.parse(content.cameraWorldMatrix),
                            params: JSON.parse(content.cameraParams),
                        }, () => {
                            this.sendInitLayers(connector, content);
                        });
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
        webgl.connector.send('Resize', { displayMode: true });
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
    sendWebGLCameraUpdate(metadataId: string, cameraWorldMatrix: string, cameraParams: string): void {
        const webgl = this.webglConnectors.get(metadataId);
        if (!webgl) return;
        try {
            webgl.connector.send('UpdateCamera', {
                mat: JSON.parse(cameraWorldMatrix),
                params: JSON.parse(cameraParams),
            });
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

    async displayTileImage(elem: HTMLElement, meta: any): Promise<void> {
        const { metadataId, xsplit, ysplit, reductionWidth, reductionHeight, orgWidth, orgHeight } = meta;
        const TILE_SIZE: number = meta.tileSize;
        if (TILE_SIZE === undefined || TILE_SIZE === null) {
            console.error(`[ContentRenderer] displayTileImage: meta.tileSize is missing for metadataId=${metadataId}. Skipping render.`);
            return;
        }
        const xs = xsplit || 1;
        const ys = ysplit || 1;
        const imgW = orgWidth  || xs * TILE_SIZE;
        const imgH = orgHeight || ys * TILE_SIZE;
        const keyvalue = String(meta.keyvalue ?? metadataId);

        // LOD 判定
        const windowMeta = this.getWindowMeta();
        const coords = virtualToWindowCoordinates(meta.posx, meta.posy, meta.width, meta.height, windowMeta);
        const useReduction =
            coords.w <= (reductionWidth || 1920) &&
            coords.h <= (reductionHeight || 1080);

        // DOM構造を初回のみ構築（以降は使い回す）
        let container = elem.querySelector<HTMLElement>('.tile-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'tile-container';
            container.style.position = 'relative';
            container.style.width    = '100%';
            container.style.height   = '100%';

            // reduction image（常時バックグラウンド）
            const redImg = document.createElement('img');
            redImg.className = 'reduction_image';
            redImg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:fill;';
            container.appendChild(redImg);

            // タイルグリッド（reduction の上に重ねる）
            const tileGrid = document.createElement('div');
            tileGrid.className = 'tile-grid';
            tileGrid.style.cssText =
                `position:absolute;left:0;top:0;width:100%;height:100%;` +
                `display:grid;` +
                `grid-template-columns:repeat(${xs},1fr);` +
                `grid-template-rows:repeat(${ys},1fr);`;
            for (let yi = 0; yi < ys; yi++) {
                for (let xi = 0; xi < xs; xi++) {
                    const cell = document.createElement('div');
                    cell.style.overflow = 'hidden';
                    const img = document.createElement('img');
                    img.className = `tile_index_${yi * xs + xi}`;
                    img.style.cssText = 'width:100%;height:100%;object-fit:fill;display:block;';
                    cell.appendChild(img);
                    tileGrid.appendChild(cell);
                }
            }
            container.appendChild(tileGrid);

            elem.innerHTML = '';
            elem.appendChild(container);
        }

        const redImg   = container.querySelector<HTMLImageElement>('.reduction_image')!;
        const tileGrid = container.querySelector<HTMLElement>('.tile-grid')!;

        // LOD分岐
        if (useReduction) {
            tileGrid.style.display = 'none';
            redImg.style.display   = 'block';

            if (redImg.dataset.metadataId !== metadataId) {
                try {
                    const content = await this.sendCommand('GetContent', { metadataId });
                    if (content?.binary) {
                        if (redImg.src) URL.revokeObjectURL(redImg.src);
                        const blob = new Blob([content.binary], { type: 'image/png' });
                        redImg.src = URL.createObjectURL(blob);
                        redImg.dataset.metadataId = metadataId;
                    }
                } catch (err) {
                    console.error('[ContentRenderer] GetContent (reduction) failed:', err);
                }
            }
            return;
        }

        // タイルモード: reduction は裏に維持（ちらつき防止のバックグラウンド）
        redImg.style.display   = 'block';
        tileGrid.style.display = 'grid';

        if (redImg.dataset.metadataId !== metadataId) {
            this.sendCommand('GetContent', { metadataId })
                .then(content => {
                    if (content?.binary && redImg.dataset.metadataId !== metadataId) {
                        if (redImg.src) URL.revokeObjectURL(redImg.src);
                        const blob = new Blob([content.binary], { type: 'image/png' });
                        redImg.src = URL.createObjectURL(blob);
                        redImg.dataset.metadataId = metadataId;
                    }
                })
                .catch(() => {/* ignore */});
        }

        // 画面外スキップ + keyvalue キャッシュで必要タイルのみ取得
        const scaleX = meta.width  > 0 ? meta.width  / imgW : 1;
        const scaleY = meta.height > 0 ? meta.height / imgH : 1;
        const pixW = windowMeta?.pixelWidth  ?? window.innerWidth;
        const pixH = windowMeta?.pixelHeight ?? window.innerHeight;

        const fetchPromises: Promise<void>[] = [];

        for (let yi = 0; yi < ys; yi++) {
            for (let xi = 0; xi < xs; xi++) {
                const tileIndex = yi * xs + xi;
                const img = container.querySelector<HTMLImageElement>(`.tile_index_${tileIndex}`)!;

                if (img.dataset.keyvalue === keyvalue && img.src) {
                    continue;
                }

                const tvx = meta.posx + xi * TILE_SIZE * scaleX;
                const tvy = meta.posy + yi * TILE_SIZE * scaleY;
                const tvw = Math.min(TILE_SIZE, imgW - xi * TILE_SIZE) * scaleX;
                const tvh = Math.min(TILE_SIZE, imgH - yi * TILE_SIZE) * scaleY;
                const sc = virtualToWindowCoordinates(tvx, tvy, tvw, tvh, windowMeta);
                const inView =
                    sc.x + sc.w > 0 && sc.y + sc.h > 0 &&
                    sc.x < pixW    && sc.y < pixH;
                if (!inView) continue;

                fetchPromises.push(
                    this.sendCommand('GetTileContent', { metadataId, tileIndex })
                        .then(data => {
                            if (data?.binary) {
                                if (img.src) URL.revokeObjectURL(img.src);
                                const blob = new Blob([data.binary], { type: 'image/png' });
                                img.src = URL.createObjectURL(blob);
                                img.dataset.keyvalue = keyvalue;
                            }
                        })
                        .catch(() => {/* ignore */})
                );
            }
        }

        await Promise.all(fetchPromises);
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
