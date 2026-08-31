import { arrayBufferToBase64 } from '../../metaBinaryClient';
import { TileImageUploader } from '../../tileImageUploader';
import {
    captureThumbnailFromImage,
    captureThumbnailFromUrl,
    captureThumbnailFromPdfIframe,
    captureThumbnailFromVideo,
    waitAndCaptureThumbnailFromVideo,
    capturePlaceholder,
} from '../../thumbnailCapture';
import { resizeTextElem } from '../../common/textUtils';
import type { LiveStreamManager } from '../../liveStreamManager';
import { IFrameConnector } from '../IFrameConnector';
import { Manipulator } from '../../manipulator';
import type { ContentMetadata, ContentUpdateData } from '../types';
import type { LogFn, SendCommandFn } from '../websocket/WebSocketClient';
import {
    buildDisplayZIndexMapByOrder,
    compareContentMetadataForDisplayOrder,
    normalizeContentZIndex,
} from '../../../common/contentOrder';
import type { ContentRenderer, RendererContext } from './renderers/BaseRenderer';
import { ImageRenderer } from './renderers/ImageRenderer';
import { WebGLRenderer } from './renderers/WebGLRenderer';
import { LiveStreamRenderer } from './renderers/LiveStreamRenderer';
import { PdfRenderer, UrlRenderer, TextRenderer } from './renderers/MiscRenderers';
import { MetadataListBadgeRenderer } from './renderers/MetadataListBadgeRenderer';
import { MetadataListItemRenderer } from './renderers/MetadataListItemRenderer';
import { VisibleStateManager } from './VisibleStateManager';

export type SendBinaryCommandFn = (method: string, params: any, binary: ArrayBuffer) => Promise<any>;

export interface ContentManagerDeps {
    elements: any;
    sendCmd: SendCommandFn;
    sendBinaryCmd: SendBinaryCommandFn;
    logFn: LogFn;
    manipulator: Manipulator | null;
    getZoom: () => number;
    pushUpdateStock: (data: ContentUpdateData) => void;
    getSocketId: () => string | null;
    getCurrentUser: () => string | null;
    getLiveStreamManager: () => LiveStreamManager | null;
    tileUploader: TileImageUploader;
    registerBroadcast: (method: string, handler: (params: any) => void) => void;
    consumePendingProducer: (producerId: string) => any | null;
    handleNewProducer: (params: any, knownMetadata?: any) => Promise<void>;
    getEditMode: () => number;
    showRightClickMenu: (e:MouseEvent)=> void;
    /** 自分が送信者の video-file コンテンツを metadataId で停止する。停止した場合 true を返す。 */
    stopVideoFileByMetadata: (metadataId: string) => Promise<boolean>;
    /** 自分が送信者の camera/screen コンテンツを producerId で停止する。停止した場合 true を返す。 */
    stopLiveStreamByProducerId: (producerId: string) => Promise<boolean>;
    /** 動画ファイルを追加する。streamName は呼び出し元が一意性を保証して渡す。 */
    addVideoFile: (file: File, streamName: string) => Promise<void>;
}

interface ContentInspectionResult {
    kind: 'image' | 'video' | 'pdf' | 'unknown';
    mime: string;
    width: number | null;
    height: number | null;
    isSupported: boolean;
    reason: string;
    needsServerProbe: boolean;
}

export class ContentManager {
    private _metadataList: ContentMetadata[] = [];
    private _selectedMetadataId: string | null = null;
    private _thumbnailCache = new Map<string, string>();
    private _textContentCache = new Map<string, { value: string; fontColor: string }>();
    private _textResizeObservers = new Map<string, ResizeObserver>();
    private _webglConnectors = new Map<string, { iframe: HTMLIFrameElement; connector: IFrameConnector }>();
    private _displayInFlightByMetadataId = new Map<string, Promise<void>>();

    private readonly _contentRenderers: ContentRenderer[];
    private readonly _badgeRenderer = new MetadataListBadgeRenderer();
    private readonly _itemRenderer = new MetadataListItemRenderer();
    private readonly _visibleStateManager = new VisibleStateManager();

    private readonly el: any;
    private readonly sendCmd: SendCommandFn;
    private readonly sendBinaryCmd: SendBinaryCommandFn;
    private readonly logFn: LogFn;
    private readonly manipulator: Manipulator | null;
    private readonly getZoom: () => number;
    private readonly pushUpdateStock: (data: ContentUpdateData) => void;
    private readonly getSocketId: () => string | null;
    private readonly getCurrentUser: () => string | null;
    private readonly getLiveStreamManager: () => LiveStreamManager | null;
    private readonly tileUploader: TileImageUploader;
    private readonly consumePendingProducer: (producerId: string) => any | null;
    private readonly handleNewProducer: (params: any, knownMetadata?: any) => Promise<void>;
    private readonly getEditMode: () => number;
    private readonly showRightClickMenu: (e:MouseEvent) => void;
    private readonly stopVideoFileByMetadata: (metadataId: string) => Promise<boolean>;
    private readonly stopLiveStreamByProducerId: (producerId: string) => Promise<boolean>;
    private readonly _addVideoFileDep: (file: File, streamName: string) => Promise<void>;

    private readonly dmyElmStr:string = 'position:absolute;width:100%;height:100%;left:0;top:0;background-color:rgba(0,0,0,0.01);';

    private tileThresholds: { width: number; height: number } | null = null;

    constructor(deps: ContentManagerDeps) {
        this.el = deps.elements;
        this.sendCmd = deps.sendCmd;
        this.sendBinaryCmd = deps.sendBinaryCmd;
        this.logFn = deps.logFn;
        this.manipulator = deps.manipulator;
        this.getZoom = deps.getZoom;
        this.pushUpdateStock = deps.pushUpdateStock;
        this.getSocketId = deps.getSocketId;
        this.getCurrentUser = deps.getCurrentUser;
        this.getLiveStreamManager = deps.getLiveStreamManager;
        this.tileUploader = deps.tileUploader;
        this.consumePendingProducer = deps.consumePendingProducer;
        this.handleNewProducer = deps.handleNewProducer;
        this.getEditMode = deps.getEditMode;
        this.showRightClickMenu = deps.showRightClickMenu;
        this.stopVideoFileByMetadata = deps.stopVideoFileByMetadata;
        this.stopLiveStreamByProducerId = deps.stopLiveStreamByProducerId;
        this._addVideoFileDep = deps.addVideoFile;
        // TileImageUploader のコンストラクタが registerBroadcast を呼び出して
        // TileimageProgress ハンドラを自動登録するため、ここでの追加登録は不要
        this._contentRenderers = [
            new ImageRenderer(),
            new WebGLRenderer(),
            new LiveStreamRenderer(),
            new PdfRenderer(),
            new UrlRenderer(),
            new TextRenderer(this._textResizeObservers),
        ];
        this.initTileUploadOverlayCloseBehavior();
    }

    private initTileUploadOverlayCloseBehavior(): void {
        const overlay = this.el.tileUploadOverlay as HTMLElement | null;
        if (!overlay || typeof overlay.addEventListener !== 'function') {
            return;
        }
        overlay.addEventListener('click', (event: MouseEvent) => {
            if (overlay.dataset.state !== 'error') {
                return;
            }
            if (event.target !== overlay) {
                return;
            }
            this.hideTileUploadOverlay();
        });
    }

    /**
     * チェックボックスの change イベントリスナーをセットアップ
     */
    setupCheckboxListener(checkboxElement: HTMLElement): void {
        checkboxElement?.addEventListener('change', (e: Event) => {
            e.stopPropagation();
            if (e.target instanceof HTMLInputElement) {
                this.el.contentVisible.dataset.checked = String(e.target.checked);
                // バッジと要素の状態を同期
                this.syncCheckboxChangeWithBadge();
            }
            this.createUpdateStock(null);
        });
    }

    private showTileUploadOverlayForProgress(fileName: string): void {
        const overlay = this.el.tileUploadOverlay as HTMLElement | null;
        if (overlay !== null) {
            overlay.style.display = 'grid';
            overlay.dataset.state = 'uploading';
        }
        if (this.el.tileUploadFilename) {
            this.el.tileUploadFilename.textContent = fileName;
        }
        if (this.el.tileUploadBar) {
            this.el.tileUploadBar.value = 0;
            this.el.tileUploadBar.classList.remove('tile-upload-error');
        }
        if (this.el.tileUploadLabel) {
            this.el.tileUploadLabel.textContent = 'Uploading...';
            this.el.tileUploadLabel.classList.remove('tile-upload-error');
        }
    }

    private showTileUploadError(message: string): void {
        const overlay = this.el.tileUploadOverlay as HTMLElement | null;
        if (overlay !== null) {
            overlay.style.display = 'grid';
            overlay.dataset.state = 'error';
        }
        if (this.el.tileUploadLabel) {
            this.el.tileUploadLabel.textContent = `${message} Click outside this dialog to close.`;
            this.el.tileUploadLabel.classList.add('tile-upload-error');
        }
        if (this.el.tileUploadBar) {
            this.el.tileUploadBar.classList.add('tile-upload-error');
        }
    }

    private hideTileUploadOverlay(): void {
        const overlay = this.el.tileUploadOverlay as HTMLElement | null;
        if (overlay !== null) {
            overlay.style.display = 'none';
            overlay.dataset.state = 'idle';
        }
        if (this.el.tileUploadLabel) {
            this.el.tileUploadLabel.textContent = 'Uploading...';
            this.el.tileUploadLabel.classList.remove('tile-upload-error');
        }
        if (this.el.tileUploadBar) {
            this.el.tileUploadBar.classList.remove('tile-upload-error');
        }
    }

    get metadataList(): ContentMetadata[] { return this._metadataList; }
    get selectedMetadataId(): string | null { return this._selectedMetadataId; }
    get webglConnectors(): Map<string, { iframe: HTMLIFrameElement; connector: IFrameConnector }> { return this._webglConnectors; }

    private normalizeMetadataId(value: unknown): string | null {
        if (typeof value !== 'string') {
            return null;
        }
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return null;
        }
        const lower = trimmed.toLowerCase();
        if (lower === 'undefined' || lower === 'null') {
            return null;
        }
        return trimmed;
    }

    private getValidMetadataIdFromElem(elem: HTMLElement): string | null {
        return this.normalizeMetadataId(elem.dataset.metadataId);
    }

    private normalizeMetadataForOrder(metadata: ContentMetadata): ContentMetadata {
        return {
            ...metadata,
            zindex: normalizeContentZIndex(metadata.zindex),
        };
    }

    private sortMetadataListInPlace(): void {
        this._metadataList.sort(compareContentMetadataForDisplayOrder);
    }

    applyIncomingMetadata(metadata: ContentMetadata): void {
        const normalized = this.normalizeMetadataForOrder(metadata);
        const targetIndex = this._metadataList.findIndex((item) => {
            return item.metadataId === normalized.metadataId;
        });
        if (targetIndex >= 0) {
            this._metadataList[targetIndex] = normalized;
        } else {
            this._metadataList.push(normalized);
        }
        this.sortMetadataListInPlace();
    }

    reorderPreviewContentByMetadata(): void {
        const previewContent = this.el.previewContent as HTMLElement | null;
        if (!previewContent) {
            return;
        }
        this.sortMetadataListInPlace();
        const zIndexMap = buildDisplayZIndexMapByOrder(this._metadataList);
        let requiresUpdate = false;

        for (const metadata of this._metadataList) {
            const element = document.getElementById(`view-${metadata.metadataId}`) as HTMLElement | null;
            if (element === null || element.parentElement !== previewContent) {
                continue;
            }
            const expectedZIndex = zIndexMap.get(metadata.metadataId);
            if (expectedZIndex === undefined) {
                continue;
            }
            const currentZIndex = normalizeContentZIndex(Number(element.style.zIndex));
            if (currentZIndex !== expectedZIndex) {
                requiresUpdate = true;
                break;
            }
        }

        if (!requiresUpdate) {
            return;
        }

        for (const metadata of this._metadataList) {
            const element = document.getElementById(`view-${metadata.metadataId}`) as HTMLElement | null;
            if (element === null || element.parentElement !== previewContent) {
                continue;
            }
            const expectedZIndex = zIndexMap.get(metadata.metadataId);
            if (expectedZIndex === undefined) {
                continue;
            }
            element.style.zIndex = `${expectedZIndex}`;
        }
    }

    serchSetPos():number{
        let setPosX = 0;
        let setPosY = 0;
        //追加位置を探す
        for(let i=0; i < this._metadataList.length;i++){
            if(this._metadataList[i].posx == setPosX && this._metadataList[i].posy == setPosY){
                setPosX = setPosX + 100;
                setPosY = setPosY + 100;
                i = 0;
            }
        }
        return setPosX;
    }

    async addContent(): Promise<void> {
        // Video タブのファイル入力を最初に確認する
        const videoFile = (this.el.videoFileInput as HTMLInputElement)?.files?.[0];
        if (videoFile !== undefined) {
            await this.addVideoFile(videoFile);
            if (this.el.videoFileInput) { (this.el.videoFileInput as HTMLInputElement).value = ''; }
            return;
        }

        const file = this.el.fileInput.files?.[0];
        const urlinput = this.el.urlInput?.value ?? '';
        const textinput = this.el.textInput?.value ?? '';
        if (!file && !urlinput && !textinput) {
            this.logFn('Please select a file or input text', 'error');
            return;
        }

        if (file !== undefined && file.name.length > 0) {
            await this.addFileWithAutoDetection(file);
            if (this.el.fileInput) { this.el.fileInput.value = ''; }
            return;
        }

        let setPosX = this.serchSetPos();

        try {
            const metadata: any = {
                type: 'image',
                posx: setPosX,
                posy: setPosX,
                width: 640,
                height: 480,
                mime: '',
            };

            let arrayBuffer: ArrayBuffer | undefined;

            if (urlinput.length > 0) {
                const bufferStr = `{"type":"url", "value":"${urlinput}"}`;
                arrayBuffer = new TextEncoder().encode(bufferStr).buffer;
                metadata.type = 'url';
            }

            if (textinput.length > 0) {
                const textVal = textinput;
                const bufferStr = JSON.stringify({
                    type: 'text',
                    value: textVal,
                    fontColor: this.el.fontColor?.value ?? '#fff',
                });
                arrayBuffer = new TextEncoder().encode(bufferStr).buffer;
                metadata.type = 'text';
                // <pre> をマウントして自然サイズを計測
                const dmyDom = document.createElement('pre');
                dmyDom.innerHTML = textVal;
                dmyDom.style.position = 'absolute';
                dmyDom.style.visibility = 'hidden';
                document.body.appendChild(dmyDom);
                const forceReflow = dmyDom.offsetHeight;
                const rect = dmyDom.getBoundingClientRect();
                metadata.width = rect.width;
                metadata.height = rect.height;
                document.body.removeChild(dmyDom);
            }

            this.logFn('Adding content...', 'info');
            const addResult = await this.sendBinaryCmd('AddContent', metadata, arrayBuffer!);

            this.logFn('✅ Content added successfully', 'success');
            if (this.el.urlInput) this.el.urlInput.value = '';
            if (this.el.textInput) this.el.textInput.value = '';

            setTimeout(() => this.refreshMetadataList(), 500);

            if (addResult?.metadataId) {
                this.captureAndSendThumbnail(addResult.metadataId, metadata.type, arrayBuffer)
                    .catch((err) => console.warn('[ContentManager] Thumbnail capture failed:', err));
            }
        } catch (error: any) {
            this.logFn(`Failed to add content: ${error.message}`, 'error');
        }
    }

    /**
     * 既存メタデータの streamName を参照して衝突しない名前を返す。
     * baseName が未使用であればそのまま返す。
     * 重複する場合は baseName_2, baseName_3 ... と末尾に番号を付与する。
     */
    private _resolveUniqueStreamName(baseName: string): string {
        const usedNames = new Set(
            this._metadataList.map((m) => (m as any).streamName).filter(Boolean),
        );
        if (!usedNames.has(baseName)) { return baseName; }
        let counter = 2;
        while (usedNames.has(`${baseName}_${counter}`)) { counter++; }
        return `${baseName}_${counter}`;
    }

    /**
     * 動画ファイルを共有コンテンツとして追加する。
     * 追加前に最新のメタデータリストを取得してから streamName の一意性を解決する。
     */
    async addVideoFile(file: File): Promise<void> {
        await this.refreshMetadataList();
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'Video';
        const streamName = this._resolveUniqueStreamName(baseName);
        await this._addVideoFileDep(file, streamName);
    }

    async addTileimage(): Promise<void> {
        const file = this.el.tileimageFileInput?.files?.[0];
        if (!file) {
            this.logFn('Please select an image file', 'error');
            return;
        }
        await this.addImageFile(file);
        if (this.el.tileimageFileInput) { this.el.tileimageFileInput.value = ''; }
    }

    private async _inspectContentFile(file: File): Promise<ContentInspectionResult> {
        const MAX_INSPECT_BYTES = 256 * 1024;
        const probe = file.slice(0, MAX_INSPECT_BYTES);
        const probeBuffer = await probe.arrayBuffer();
        const result = await this.sendBinaryCmd('InspectContentData', {
            fileName: file.name,
            mime: file.type,
            fileSize: file.size,
            probeBytes: probeBuffer.byteLength,
        }, probeBuffer);
        return result as ContentInspectionResult;
    }

    private _cloneFileWithType(file: File, mime: string): File {
        if (mime.length === 0 || file.type === mime) {
            return file;
        }
        return new File([file], file.name, { type: mime, lastModified: file.lastModified });
    }

    async addFileWithAutoDetection(file: File): Promise<void> {
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
            await this.addImageFile(file);
            return;
        }
        if (file.type.startsWith('video/')) {
            await this.addVideoFile(file);
            return;
        }
        try {
            const inspected = await this._inspectContentFile(file);
            if (!inspected.isSupported) {
                this.logFn(`Unsupported file type: ${inspected.reason}`, 'error');
                return;
            }

            if (inspected.kind === 'image' || inspected.kind === 'pdf') {
                const typedFile = this._cloneFileWithType(file, inspected.mime);
                await this.addImageFile(typedFile);
                return;
            }

            if (inspected.kind === 'video') {
                const typedFile = this._cloneFileWithType(file, inspected.mime);
                await this.addVideoFile(typedFile);
                return;
            }

            this.logFn(`Unsupported file type: ${inspected.mime || file.type || 'unknown'}`, 'error');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.logFn(`Failed to inspect file type: ${message}`, 'error');
        }
    }

    /**
     * タイル化閾値をサーバー設定から設定する
     */
    setTileThresholds(thresholds: { width: number; height: number }): void {
        this.tileThresholds = thresholds;
    }

    /**
     * ファイルを受け取り、画像サイズに応じて通常の AddContent またはタイルイメージとして送信する共通エントリ。
     * - 幅または高さが 4000px 以上の画像 → タイルイメージ送信
     * - それ未満の画像および PDF → 通常の AddContent
     */
    async addImageFile(file: File): Promise<void> {
        if (this.tileThresholds === null) {
            this.logFn('サーバー設定が取得されていません。再接続してください。', 'error');
            return;
        }
        if (file.type === 'application/pdf') {
            await this._addContentFromFile(file);
            return;
        }
        if (!file.type.startsWith('image/')) {
            this.logFn(`Unsupported file type: ${file.type}`, 'error');
            return;
        }
        let size: { width: number; height: number };
        try {
            size = await this._resolveImageSize(file);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logFn(`Failed to read image: ${message}`, 'error');
            this.logFn('Fallback to tile upload because image size probe failed', 'info');
            await this._addTileimageFromFile(file);
            return;
        }
        if (size.width >= this.tileThresholds.width || size.height >= this.tileThresholds.height) {
            await this._addTileimageFromFile(file, size);
        } else {
            await this._addContentFromFile(file, size);
        }
    }

    /** 画像ファイルの自然サイズ（ピクセル）を非同期に取得する */
    private _resolveImageSize(file: File): Promise<{ width: number; height: number }> {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error(`Failed to load image: ${file.name}`));
            };
            img.src = url;
        });
    }

    /** ファイルを通常の AddContent コマンドで送信する */
    private async _addContentFromFile(file: File, imageSize?: { width: number; height: number }): Promise<void> {
        try {
            const arrayBuffer = await file.arrayBuffer();
            let initialWidth = 640;
            let initialHeight = 480;
            if (imageSize !== undefined) {
                const MAX_W = 1920;
                const MAX_H = 1080;
                const scaleW = imageSize.width > MAX_W ? MAX_W / imageSize.width : 1;
                const scaleH = imageSize.height > MAX_H ? MAX_H / imageSize.height : 1;
                const scale = Math.min(scaleW, scaleH);
                initialWidth  = Math.round(imageSize.width  * scale);
                initialHeight = Math.round(imageSize.height * scale);
            }

            let setPosX = this.serchSetPos();

            const normalizedContentType = (() => {
                if (file.type === 'application/pdf') {
                    return 'pdf';
                }
                if (file.type.startsWith('image/')) {
                    return 'image';
                }
                if (file.type.startsWith('video/')) {
                    return 'video';
                }
                return file.type;
            })();

            const metadata: any = {
                type: normalizedContentType,
                posx: setPosX,
                posy: setPosX,
                width: initialWidth,
                height: initialHeight,
                mime: '',
            };
            this.logFn('Adding content...', 'info');
            const addResult = await this.sendBinaryCmd('AddContent', metadata, arrayBuffer);
            this.logFn('✅ Content added successfully', 'success');
            setTimeout(() => { this.refreshMetadataList(); }, 500);
            if (addResult?.metadataId) {
                this.captureAndSendThumbnail(addResult.metadataId, metadata.type, arrayBuffer)
                    .catch((err: unknown) => { console.warn('[ContentManager] Thumbnail capture failed:', err); });
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.logFn(`Failed to add content: ${message}`, 'error');
        }
    }

    /** ファイルをタイルイメージとして送信する。進捗は logFn で通知する */
    private async _addTileimageFromFile(file: File, imageSize?: { width: number; height: number }): Promise<void> {
        const MAX_SEGMENT_SIZE = 512 * 1024;
        let hideOverlayOnExit = true;
        const MAX_W = 1920;
        const MAX_H = 1080;
        let initialWidth = MAX_W;
        let initialHeight = MAX_H;
        if (imageSize !== undefined) {
            const scaleW = imageSize.width > MAX_W ? MAX_W / imageSize.width : 1;
            const scaleH = imageSize.height > MAX_H ? MAX_H / imageSize.height : 1;
            const scale = Math.min(scaleW, scaleH);
            initialWidth  = Math.round(imageSize.width  * scale);
            initialHeight = Math.round(imageSize.height * scale);
        }
        const setPosX = this.serchSetPos();
        const contentMeta = {
            posx: setPosX,
            posy: setPosX,
            width: initialWidth,
            height: initialHeight,
        };
        this.showTileUploadOverlayForProgress(file.name);
        try {
            this.logFn(`Uploading tile image: ${file.name}...`, 'info');
            await this.tileUploader.upload(file, contentMeta, (phase, received, total) => {
                const pct = total > 0 ? Math.round((received / total) * 100) : 0;
                const label = phase === 'uploading'
                    ? `Uploading... ${received}/${total} segments (${pct}%)`
                    : `Processing tiles... ${received}/${total} (${pct}%)`;
                if (this.el.tileUploadBar) { this.el.tileUploadBar.value = pct; }
                if (this.el.tileUploadLabel) { this.el.tileUploadLabel.textContent = label; }
                if (this.el.tileimageProgressBar) { this.el.tileimageProgressBar.value = pct; }
                if (this.el.tileimageProgressLabel) { this.el.tileimageProgressLabel.textContent = label; }
                const logLabel = phase === 'uploading'
                    ? `Uploading tile image: ${pct}%`
                    : `Processing tiles: ${pct}%`;
                this.logFn(logLabel, 'info');
            }, MAX_SEGMENT_SIZE);
            this.logFn(`✅ Tile image uploaded successfully: ${file.name}`, 'success');
            setTimeout(() => { this.refreshMetadataList(); }, 500);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.logFn(`Failed to upload tile image: ${message}`, 'error');
            hideOverlayOnExit = false;
            if (message.toLowerCase().includes('timed out')) {
                this.showTileUploadError('Tile upload timed out.');
            } else {
                this.showTileUploadError(`Tile upload failed: ${message}`);
            }
            setTimeout(() => { this.refreshMetadataList(); }, 100);
        } finally {
            if (hideOverlayOnExit) {
                this.hideTileUploadOverlay();
            }
        }
    }

    async refreshMetadataList(): Promise<void> {
        try {
            this.logFn('Fetching metadata list...', 'info');
            const result = await this.sendCmd('GetMetaData', {});
            const list: ContentMetadata[] = result.metadataList || [];
            this._metadataList = list
                .map((metadata) => {
                    return this.normalizeMetadataForOrder(metadata);
                })
                .sort(compareContentMetadataForDisplayOrder);
            this.renderMetadataList();
            this.logFn(`✅ Fetched ${this._metadataList.length} items`, 'success');
        } catch (error: any) {
            this.logFn(`Failed to fetch metadata: ${error.message}`, 'error');
        }
    }

    /** バッジクリック時にVisible状態をトグル */
    private toggleContentVisible(metadataId: string): void {
        // 1. まずコンテンツを選択（renderMetadataList で新しいバッジを生成）
        this.selectMetadata(metadataId);

        // 2. その後、バッジと要素を取得
        const item = this.el.metadataList?.querySelector(`[data-metadata-id="${metadataId}"]`) as HTMLElement | null;
        const badge = item?.querySelector('.metadata-item-visible-badge') as HTMLElement | null;

        // 3. Visible状態を変更
        const result = this._visibleStateManager.toggleVisible(
            metadataId,
            this._metadataList,
            {
                contentVisibleCheckbox: this.el.contentVisible,
                metadataListItem: item,
                badge,
            },
            this._badgeRenderer,
            (changeData) => {
                // VDAの表示を更新
                this.createUpdateStock(null);
                // サーバーに送信
                this.pushUpdateStock(changeData.updateStock);
            }
        );
    }

    renderMetadataList(): void {
        if (!this.el.metadataList) return;

        this.el.metadataList.innerHTML = '';
        this._metadataList.forEach((metadata) => {
            // バッジ作成
            const badge = this._badgeRenderer.createBadgeElement(
                metadata.visible !== false,
                () => this.toggleContentVisible(metadata.metadataId)
            );

            // テキストプレビューまたはサムネイル
            const textPreview = metadata.type === 'text' 
                ? this._textContentCache.get(metadata.metadataId)
                : undefined;
            const thumbnailUrl = !textPreview && metadata.type !== 'text'
                ? this._thumbnailCache.get(metadata.metadataId)
                : undefined;

            // リスト項目作成
            const item = this._itemRenderer.createListItem({
                metadata,
                isSelected: metadata.metadataId === this._selectedMetadataId,
                thumbnailUrl,
                textPreview,
                badgeElement: badge,
            });

            // イベントハンドラー登録
            item.addEventListener('click', () => this.selectMetadata(metadata.metadataId));
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                (e as any).isVisible = item.dataset.visible;
                this.selectMetadata(metadata.metadataId);
                this.showRightClickMenu(e);
            });

            this.el.metadataList.appendChild(item);
        });

        this.fetchAndApplyThumbnails();
    }

    private async fetchAndApplyThumbnails(): Promise<void> {
        for (const metadata of this._metadataList) {
            if (metadata.type === 'text') {
                // テキストは GetContent でテキスト本文を取得して HTML 表示
                if (this._textContentCache.has(metadata.metadataId)) continue;
                try {
                    const result = await this.sendCmd('GetContent', { metadataId: metadata.metadataId });
                    if (result?.binary) {
                        const json = JSON.parse(new TextDecoder().decode(result.binary));
                        const entry = { value: json.value ?? '', fontColor: json.fontColor || 'white' };
                        this._textContentCache.set(metadata.metadataId, entry);
                        const item = this.el.metadataList?.querySelector(
                            `[data-metadata-id="${metadata.metadataId}"]`,
                        ) as HTMLElement | null;
                        if (item) this.applyTextThumbnail(item, entry.value, entry.fontColor);
                    }
                } catch {
                    // テキスト取得失敗時は何もしない
                }
                continue;
            }
            if (this._thumbnailCache.has(metadata.metadataId)) continue;
            try {
                const result = await this.sendCmd('GetThumbnail', { metadataId: metadata.metadataId });
                if (result?.binary) {
                    const base64 = arrayBufferToBase64(result.binary);
                    const dataUrl = `data:image/png;base64,${base64}`;
                    this._thumbnailCache.set(metadata.metadataId, dataUrl);
                    this.applyThumbnailToItem(metadata.metadataId, dataUrl);
                }
            } catch {
                // サムネイルなし
            }
        }
    }

    applyThumbnailToItem(metadataId: string, dataUrl: string): void {
        const item = this.el.metadataList?.querySelector(
            `[data-metadata-id="${metadataId}"]`,
        ) as HTMLElement | null;
        if (item) {
            this._itemRenderer.applyThumbnail(item, dataUrl);
        }
    }

    applyTextThumbnail(item: HTMLElement, value: string, fontColor: string): void {
        this._itemRenderer.applyTextPreview(item, value, fontColor);
    }

    invalidateThumbnailCache(metadataId: string): void {
        this._thumbnailCache.delete(metadataId);
        this._textContentCache.delete(metadataId);
    }

    updateTextThumbnailLocal(metadataId: string, value: string, fontColor: string): void {
        this._textContentCache.set(metadataId, { value, fontColor });
        const item = this.el.metadataList?.querySelector(
            `[data-metadata-id="${metadataId}"]`,
        ) as HTMLElement | null;
        if (item) this.applyTextThumbnail(item, value, fontColor);
    }

    async refreshTextThumbnail(metadataId: string): Promise<void> {
        try {
            const result = await this.sendCmd('GetContent', { metadataId });
            if (result?.binary) {
                const json = JSON.parse(new TextDecoder().decode(result.binary));
                const entry = { value: json.value ?? '', fontColor: json.fontColor || 'white' };
                this._textContentCache.set(metadataId, entry);
                const item = this.el.metadataList?.querySelector(
                    `[data-metadata-id="${metadataId}"]`,
                ) as HTMLElement | null;
                if (item) this.applyTextThumbnail(item, entry.value, entry.fontColor);
            }
        } catch {
            // 取得失敗時は何もしない
        }
    }

    /** チェックボックス変更時にバッジUIを同期 */
    syncCheckboxChangeWithBadge(): void {
        const metadataId = this._selectedMetadataId;
        if (!metadataId) return;

        const isChecked = (this.el.contentVisible as any).checked;
        const item = this.el.metadataList?.querySelector(
            `[data-metadata-id="${metadataId}"]`,
        ) as HTMLElement | null;
        const badge = item?.querySelector('.metadata-item-visible-badge') as HTMLElement | null;

        // バッジを更新
        if (badge) {
            this._badgeRenderer.updateBadgeVisibility(badge, isChecked);
        }

        // リスト項目のデータ属性を更新
        if (item) {
            item.dataset.visible = String(isChecked);
        }
    }

    selectMetadata(metadataId: string): void {
        if(this.getEditMode() != 1){return;}

        this._selectedMetadataId = metadataId;
        this.renderMetadataList();

        const metadata = this._metadataList.find((m) => m.metadataId === metadataId);
        const isOthersLiveStream = (metadata as any)?.type === 'live-stream' &&
            (metadata as any)?.socketId !== this.getSocketId();
        this.el.deleteBtn.disabled = isOthersLiveStream;
        if (this.el.contentInfoBody) this.el.contentInfoBody.style.display = 'block';
        this.logFn(`Selected: ${metadataId}`, 'info');
        this.manipulator?.removeManipulator();

        if (this.el.infoContentType) {
            this.el.infoContentType.textContent = metadata?.type || '';
        }

        this.updateContentsParameter(null);

        const contentItemsDom = [...this.el.previewContent.children];
        contentItemsDom.forEach((contentDom: any) => {
            if (contentDom.dataset.metadataId === metadataId) {
                contentDom.classList.add('content-active');
                this.manipulator?.init(this.createUpdateStock);
                // webgl はビューポートアスペクト比、画像/映像は読み込み時に取得したアスペクト比でロック
                const itownsAspect = (contentDom.dataset.itownsAspect !== undefined && contentDom.dataset.itownsAspect !== '')
                    ? Number(contentDom.dataset.itownsAspect)
                    : null;
                const contentAspect = (contentDom.dataset.contentAspect !== undefined && contentDom.dataset.contentAspect !== '')
                    ? Number(contentDom.dataset.contentAspect)
                    : null;
                this.manipulator?.setAspectRatio(itownsAspect ?? contentAspect);
                if (this.el.viewArea) this.manipulator?.showManipulator(contentDom, this.el.viewArea, this.getZoom());
                this.updateContentsParameter(contentDom);
            } else {
                contentDom.classList.remove('content-active');
            }
        });

    }

    updateContentsParameter(baseElm: HTMLElement | null): void {

        if (baseElm) {
            this.el.posX.value = baseElm.dataset.worldX;
            this.el.posY.value = baseElm.dataset.worldY;
            this.el.width.value = baseElm.dataset.width;
            this.el.height.value = baseElm.dataset.height;
            this.el.zIndex.value = baseElm.style.zIndex;
            const isVisible = baseElm.dataset.visible !== 'false';
            this.el.contentVisible.dataset.checked = String(isVisible);
            this.el.contentVisible.checked = isVisible;
            baseElm.style.display = isVisible ? 'block' : 'none';
            this.el.editTextInput.value = "";

            if (baseElm.dataset.metaBinary) {
                if (baseElm.dataset.metaBinary) {
                    const jsonObject = JSON.parse(baseElm.dataset.metaBinary);
                    if (this.el.infoContentType.innerText == "text") {
                        this.el.editTextInput.value = jsonObject.value;
                        if (this.el.editContentFontColor) this.el.editContentFontColor.value = jsonObject.fontColor ?? '#ffffff';
                    }
                }
            }

            const isText = this.el.infoContentType?.innerText === 'text';
            if (this.el.fixTextWap) this.el.fixTextWap.style.display = isText ? '' : 'none';
            if (this.el.fixFontColWap) this.el.fixFontColWap.style.display = isText ? '' : 'none';

        } else {
            this.el.posX.value = "";
            this.el.posY.value = "";
            this.el.width.value = "";
            this.el.height.value = ""
            this.el.zIndex.value = "";
            this.el.contentVisible.dataset.checked = "true";
            this.el.contentVisible.checked = true;
        }
    }

    async deleteContent(): Promise<void> {
        if (!this._selectedMetadataId) {
            this.logFn('No content selected', 'error');
            return;
        }
        if (!confirm(`Delete content ${this._selectedMetadataId}?`)) return;

        const targetId = this._selectedMetadataId;
        try {
            this.logFn(`Deleting ${targetId}...`, 'info');

            // 自分が送信中の live-stream の場合は Stop 処理を行う。
            // Stop 成功時はサーバー側から DeleteContent が自動配信されるため
            // こちらからは送らない。
            const stoppedVideoFile = await this.stopVideoFileByMetadata(targetId);
            if (stoppedVideoFile) {
                this.logFn('✅ Video file share stopped', 'success');
                this.resetSelectedMetadata();
                return;
            }

            const targetMetadata = this._metadataList.find((m) => m.metadataId === targetId);
            if (targetMetadata?.type === 'live-stream') {
                const producerId = (targetMetadata as any).producerId as string | undefined;
                if (producerId) {
                    const stoppedLiveStream = await this.stopLiveStreamByProducerId(producerId);
                    if (stoppedLiveStream) {
                        this.logFn('✅ Live stream stopped', 'success');
                        this.resetSelectedMetadata();
                        return;
                    }
                }
            }

            await this.sendCmd('DeleteContent', { metadataId: targetId });
            this.logFn('✅ Content deleted', 'success');
            this.resetSelectedMetadata();
            this.refreshMetadataList();
        } catch (error: any) {
            this.logFn(`Failed to delete: ${error.message}`, 'error');
        }
    }

    retryOwnStreamAttachments(): void {
        const lsm = this.getLiveStreamManager();
        if (!lsm || !this.el.viewArea) return;
        const items = this.el.viewArea.querySelectorAll('.content-item');
        for (const itemEl of items) {
            const item = itemEl as HTMLElement;
            if (item.dataset.publisherSocketId !== this.getSocketId()) continue;
            const video = item.querySelector('video') as HTMLVideoElement | null;
            if (!video || video.srcObject) continue;
            const producerId = item.dataset.producerId || null;
            const stream = producerId
                ? lsm.getStreamForProducer(producerId)
                : lsm.localStream;
            if (stream) {
                lsm.attachStreamToElement(item.id, stream, 'video');
                console.log(`[ContentManager] Retried stream attachment for ${item.id}`);
            }
        }
    }

    async captureAndSendThumbnail(
        metadataId: string,
        type: string,
        rawBinary?: ArrayBuffer,
    ): Promise<void> {
        let thumbnailBuffer: ArrayBuffer | null = null;

        if (type === 'image' || type?.startsWith('image/')) {
            if (rawBinary) {
                try {
                    thumbnailBuffer = await captureThumbnailFromImage(rawBinary);
                } catch {
                    thumbnailBuffer = await capturePlaceholder('Image');
                }
            } else {
                thumbnailBuffer = await capturePlaceholder('Image');
            }
        } else if (type === 'text') {
            // テキストはサムネイル画像を使わず HTML 要素で直接表示するためスキップ
            return;
        } else if (type === 'url') {
            try {
                const json = JSON.parse(new TextDecoder().decode(rawBinary));
                thumbnailBuffer = await captureThumbnailFromUrl(json.value ?? '');
            } catch {
                thumbnailBuffer = await capturePlaceholder('URL');
            }
        } else if (type === 'pdf') {
            await new Promise((r) => setTimeout(r, 1500));
            const iframe = document.querySelector(`#view-${metadataId} iframe`) as HTMLIFrameElement | null;
            if (iframe) {
                thumbnailBuffer = await captureThumbnailFromPdfIframe(iframe);
            } else {
                thumbnailBuffer = await capturePlaceholder('PDF');
            }
        } else if (type === 'webgl') {
            return;
        } else {
            thumbnailBuffer = await capturePlaceholder(type || 'Content');
        }

        if (!thumbnailBuffer) return;

        await this.sendBinaryCmd('UpdateThumbnail', { metadataId }, thumbnailBuffer);
        console.log(`[ContentManager] Thumbnail sent for ${metadataId} (type: ${type})`);
    }

    async captureAndSendLiveStreamThumbnail(metadataId: string, video: HTMLVideoElement): Promise<void> {
        try {
            const thumbnailBuffer = await waitAndCaptureThumbnailFromVideo(video);
            await this.sendBinaryCmd('UpdateThumbnail', { metadataId }, thumbnailBuffer);
            console.log(`[ContentManager] Live stream thumbnail sent for ${metadataId}`);
        } catch (err) {
            console.warn('[ContentManager] Live stream thumbnail capture failed:', err);
            const fallback = await capturePlaceholder('Live');
            await this.sendBinaryCmd('UpdateThumbnail', { metadataId }, fallback);
        }
    }

    async displayAllContentsOnCanvas(): Promise<void> {
        const orderedMetadataList = [...this._metadataList].sort(compareContentMetadataForDisplayOrder);
        for (const metadata of orderedMetadataList) {
            await this.displayContentOnViewArea(metadata);
        }
    }

    async displayContentOnViewArea(metadata: any): Promise<void> {
        const normalizedMetadataId = this.normalizeMetadataId(metadata?.metadataId);
        if (normalizedMetadataId === null) {
            return;
        }

        const inFlight = this._displayInFlightByMetadataId.get(normalizedMetadataId);
        if (inFlight !== undefined) {
            await inFlight;
            return;
        }

        const task = this.displayContentOnViewAreaInternal(metadata, normalizedMetadataId);
        this._displayInFlightByMetadataId.set(normalizedMetadataId, task);
        try {
            await task;
        } finally {
            const current = this._displayInFlightByMetadataId.get(normalizedMetadataId);
            if (current === task) {
                this._displayInFlightByMetadataId.delete(normalizedMetadataId);
            }
        }
    }

    private async displayContentOnViewAreaInternal(metadata: any, normalizedMetadataId: string): Promise<void> {
        try {
            const existingElem = document.getElementById(`view-${normalizedMetadataId}`) as HTMLElement | null;
            if (existingElem !== null) {
                console.warn(
                    `[ContentManager] displayContentOnViewArea called for existing element: ${normalizedMetadataId}. `
                    + 'Use updateWebGLContentLayout/updateContentLayout instead.',
                );
                return;
            }

            const result = await this.sendCmd('GetContent', { metadataId: normalizedMetadataId });
            if (!this.el.viewArea) {
                return;
            }

            const existingAfterFetch = document.getElementById(`view-${normalizedMetadataId}`) as HTMLElement | null;
            if (existingAfterFetch !== null) {
                return;
            }

            const normalizedMetadata = {
                ...metadata,
                metadataId: normalizedMetadataId,
            };
            const elem = this._createContentElem(normalizedMetadata, result);

            const ctx = this._buildRendererContext();
            const renderer = this._contentRenderers.find((r) => {
                return r.canHandle(result.type ?? normalizedMetadata.type ?? '');
            });
            if (renderer !== undefined) {
                try {
                    renderer.mount(elem, normalizedMetadata, result, ctx);
                } catch (error: unknown) {
                    console.warn(`[ContentManager] renderer.mount failed for ${normalizedMetadataId}:`, error);
                }
            }

            if (normalizedMetadata.visible !== false) {
                elem.style.display = 'block';
            } else {
                elem.style.display = 'none';
            }

            this.el.previewContent.appendChild(elem);

            if (renderer !== undefined && renderer.mountPost !== undefined) {
                try {
                    renderer.mountPost(elem, normalizedMetadata, result, ctx);
                } catch (error: unknown) {
                    console.warn(`[ContentManager] renderer.mountPost failed for ${normalizedMetadataId}:`, error);
                }
            }
        } catch (error: any) {
            console.error(`Failed to display content ${normalizedMetadataId}:`, error);
        }
    }

    /**
     * コンテンツ表示用のコンテナ div を生成し、共通属性・イベントを設定して返す。
     */
    private _createContentElem(metadata: any, result: any): HTMLElement {
        const elem = document.createElement('div');
        elem.id = `view-${metadata.metadataId}`;
        elem.classList.add('content-item');

        elem.addEventListener('click', (e) => {
            e.preventDefault();
            this.selectMetadata(metadata.metadataId);
        });

        elem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.selectMetadata(metadata.metadataId);
            this.showRightClickMenu(e);
        });

        elem.addEventListener('mousedown', (e) => {
            if (e.buttons !== 1) {
                return;
            }
            if (this.getEditMode() !== 1) {
                return;
            }
            this._startDragging(elem, e);
        });

        elem.dataset.metadataId = `${metadata.metadataId}`;
        elem.dataset.binaryId = `${metadata.binaryId}`;
        elem.dataset.type = `${result.type ?? metadata.type ?? ''}`;
        elem.dataset.worldX = `${metadata.posx}`;
        elem.dataset.worldY = `${metadata.posy}`;
        elem.dataset.width = `${metadata.width}`;
        elem.dataset.height = `${metadata.height}`;
        elem.dataset.originWidth = `${metadata.originWidth}`;
        elem.dataset.originHeight = `${metadata.originHeight}`;
        elem.dataset.visible = metadata.visible !== false ? 'true' : 'false';
        elem.style.left = `${metadata.posx}px`;
        elem.style.top = `${metadata.posy}px`;
        elem.style.width = `${metadata.width}px`;
        elem.style.height = `${metadata.height}px`;
        const normalizedZIndex = normalizeContentZIndex(metadata.zindex);
        elem.style.zIndex = `${normalizedZIndex}`;
        elem.style.userSelect = 'none';

        return elem;
    }

    /**
     * ドラッグ移動を開始する。mousemove/mouseup のリスナーを設定して位置を追跡する。
     */
    private _startDragging(elem: HTMLElement, startEvent: MouseEvent): void {
        this.selectMetadata(elem.dataset.metadataId ?? '');

        const zoom = this.getZoom();
        let startX = startEvent.clientX;
        let startY = startEvent.clientY;

        const onMouseMove = (e2: MouseEvent) => {
            const dx = (e2.clientX - startX) / zoom;
            const dy = (e2.clientY - startY) / zoom;
            const x2 = Number(elem.dataset.worldX) + dx;
            const y2 = Number(elem.dataset.worldY) + dy;
            elem.style.left = `${x2}px`;
            elem.style.top = `${y2}px`;
            elem.dataset.worldX = `${x2}`;
            elem.dataset.worldY = `${y2}`;
            startX = e2.clientX;
            startY = e2.clientY;

            const metadataId = this.getValidMetadataIdFromElem(elem);
            if (metadataId === null) {
                return;
            }
            this.pushUpdateStock({
                metadataId,
                binaryId: elem.dataset.binaryId ?? '',
                type: 'content',
                contentType: elem.dataset.type ?? '',
                posx: x2,
                posy: y2,
                width: Number(elem.dataset.width),
                height: Number(elem.dataset.height),
                visible: elem.dataset.visible === 'true',
                originWidth: Number(elem.dataset.originWidth),
                originHeight: Number(elem.dataset.originHeight),
                zindex: Number(elem.style.zIndex),
            });

            // webgl はビューポートアスペクト比、画像/映像は読み込み時に取得したアスペクト比でロック
            const itownsAspectDrag = (elem.dataset.itownsAspect !== undefined && elem.dataset.itownsAspect !== '')
                ? Number(elem.dataset.itownsAspect)
                : null;
            const contentAspectDrag = (elem.dataset.contentAspect !== undefined && elem.dataset.contentAspect !== '')
                ? Number(elem.dataset.contentAspect)
                : null;
            this.manipulator?.setAspectRatio(itownsAspectDrag ?? contentAspectDrag);
            this.manipulator?.showManipulator(elem, this.el.viewArea, this.getZoom());
        };

        elem.classList.add('content-active');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', onMouseMove);
            elem.classList.remove('content-active');
        }, { once: true });
    }

    /**
     * 各レンダラーに渡すコンテキストオブジェクトを生成する。
     */
    private _buildRendererContext(): RendererContext {
        const getVideoFilePreviewElement = (producerId: string): HTMLVideoElement | null => {
            const candidate = this.el._getVideoFilePreviewElement;
            if (typeof candidate !== 'function') {
                return null;
            }
            const result = candidate(producerId);
            return result ?? null;
        };

        const setPendingVideoFileElemId = (elemId: string, producerId: string): void => {
            const candidate = this.el._setPendingVideoFileElemId;
            if (typeof candidate === 'function') {
                candidate(elemId, producerId);
            }
        };

        const buildVideoFileOverlay = (elem: HTMLElement, video: HTMLVideoElement): void => {
            const candidate = this.el._buildVideoFileOverlay;
            if (typeof candidate === 'function') {
                candidate(elem, video);
            }
        };

        return {
            viewArea: this.el.viewArea as HTMLElement | null,
            manipulator: this.manipulator,
            getZoom: this.getZoom,
            pushUpdateStock: this.pushUpdateStock,
            getSocketId: this.getSocketId,
            getCurrentUser: this.getCurrentUser,
            getEditMode: this.getEditMode,
            showRightClickMenu: this.showRightClickMenu,
            selectMetadata: (id: string) => { this.selectMetadata(id); },
            getValidMetadataIdFromElem: (elem: HTMLElement) => { return this.getValidMetadataIdFromElem(elem); },
            captureAndSendLiveStreamThumbnail: (metadataId: string, video: HTMLVideoElement) => {
                return this.captureAndSendLiveStreamThumbnail(metadataId, video);
            },
            getLiveStreamManager: this.getLiveStreamManager,
            consumePendingProducer: this.consumePendingProducer,
            handleNewProducer: this.handleNewProducer,
            getVideoFilePreviewElement,
            setPendingVideoFileElemId,
            buildVideoFileOverlay,
            dmyElmStr: this.dmyElmStr,
            webglConnectors: this._webglConnectors,
        };
    }

    /**
     * text コンテンツの表示内容のみを in-place 更新する。要素の再生成は行わない。
     */
    updateTextContentPreview(metadataId: string, textValue: string, fontColor: string): void {
        const elem = document.getElementById(`view-${metadataId}`) as HTMLElement | null;
        if (elem === null) {
            return;
        }
        let preElem = elem.querySelector('pre') as HTMLPreElement | null;
        if (preElem === null) {
            preElem = document.createElement('pre');
            preElem.style.margin = '0';
            elem.insertBefore(preElem, elem.firstChild);
        }
        preElem.innerHTML = textValue;
        preElem.style.color = fontColor || 'white';
        const height = Number(elem.dataset.height);
        const resizeHeight = Number.isFinite(height) && height > 0 ? height : elem.clientHeight;
        if (resizeHeight > 0) {
            resizeTextElem(preElem, resizeHeight);
        }
        const encodedMeta = JSON.stringify({
            type: 'text',
            value: textValue,
            fontColor,
        });
        elem.dataset.metaBinary = encodedMeta;
        if (this.manipulator?.targetElement === elem) {
            this.manipulator.moveManipulator(elem);
        }
    }

    removeContentFromViewArea(metadataId: string): void {
        const elem = document.getElementById(`view-${metadataId}`);
        if (elem) elem.remove();
    }

    /**
     * webgl コンテンツの位置・サイズのみを更新する。iframe は再作成しない。
     * UpdateMetaData ブロードキャストで局面・サイズ変更を受け取ったときに使用。
     */
    updateWebGLContentLayout(metadata: any): void {
        const elem = document.getElementById(`view-${metadata.metadataId}`) as HTMLElement | null;
        if (!elem) return;
        const normalizedZIndex = normalizeContentZIndex(metadata.zindex);
        elem.style.left   = `${metadata.posx}px`;
        elem.style.top    = `${metadata.posy}px`;
        elem.style.width  = `${metadata.width}px`;
        elem.style.height = `${metadata.height}px`;
        elem.style.zIndex = `${normalizedZIndex}`;
        elem.dataset.worldX = String(metadata.posx);
        elem.dataset.worldY = String(metadata.posy);
        elem.dataset.width  = String(metadata.width);
        elem.dataset.height = String(metadata.height);
        elem.dataset.type = elem.dataset.type ?? 'webgl';
        const isVisible = metadata.visible !== false;
        elem.dataset.visible = isVisible ? 'true' : 'false';
        elem.style.display = isVisible ? 'block' : 'none';
        if (metadata.width > 0 && metadata.height > 0) {
            elem.dataset.itownsAspect = String(metadata.height / metadata.width);
        }
        if (this.manipulator?.targetElement === elem) {
            const aspect = Number(elem.dataset.itownsAspect) || null;
            this.manipulator.setAspectRatio(aspect);
            this.manipulator.moveManipulator(elem);
        }
        const webgl = this._webglConnectors.get(metadata.metadataId);
        if (webgl) {
            webgl.connector.send('Resize', { displayMode: true }, (err: unknown) => {
                if (err) {
                    console.warn('[ContentManager] webgl Resize failed:', err);
                }
            });
        }
    }

    /**
     * 非 webgl コンテンツの位置・サイズ・表示状態のみを更新する。要素は再作成しない。
     * UpdateMetaData ブロードキャストで位置・サイズ変更を受け取ったときに使用。
     */
    updateContentLayout(metadata: any): void {
        const elem = document.getElementById(`view-${metadata.metadataId}`) as HTMLElement | null;
        if (!elem) return;
        const normalizedZIndex = normalizeContentZIndex(metadata.zindex);
        elem.style.left   = `${metadata.posx}px`;
        elem.style.top    = `${metadata.posy}px`;
        elem.style.width  = `${metadata.width}px`;
        elem.style.height = `${metadata.height}px`;
        elem.style.zIndex = `${normalizedZIndex}`;
        elem.dataset.worldX = String(metadata.posx);
        elem.dataset.worldY = String(metadata.posy);
        elem.dataset.width  = String(metadata.width);
        elem.dataset.height = String(metadata.height);
        const isVisible = metadata.visible !== false;
        elem.dataset.visible = isVisible ? 'true' : 'false';
        elem.style.display = isVisible ? 'block' : 'none';
        if (this.manipulator?.targetElement === elem) {
            this.manipulator.moveManipulator(elem);
        }
    }

    clearViewArea(): void {
        if (this.el.viewArea) {
            this.el.viewArea.innerHTML = '';
            this.logFn('ViewArea cleared', 'info');
        }
    }

    /** createUpdateStock: content 要素の現在位置を updateStock に積む */
    createUpdateStock = (elem: HTMLElement | null): ContentUpdateData | null => {
        const visibleFlg = this.el.contentVisible.dataset.checked === 'true';

        if (!elem) {
            const elems = document.querySelectorAll<HTMLElement>(`[data-metadata-id="${this._selectedMetadataId}"]`);
            if (!elems) return null;

            if(elems.length == 1){
                elem =  elems[0];
                elem.dataset.visible = this.el.contentVisible.dataset.checked;
                elem.style.display = visibleFlg ? 'block' : 'none';
            } else {
                elems.forEach((el2) => {
                    el2.dataset.visible = this.el.contentVisible.dataset.checked;
                    if(Object.hasOwn(el2.dataset, 'worldX')){
                        //↑のプロパティで、VDAプレビュー内か下段リスト内かを判別している
                        elem = el2;
                        el2.style.display = visibleFlg ? 'block' : 'none';
                    }
                });
            }
        }

        if (!elem) return null;

        const metadataId = this.getValidMetadataIdFromElem(elem);
        if (metadataId === null) {
            return null;
        }

        //MetadaListからターゲットを探して変更する
        for(let i=0; i<this._metadataList.length;i++){
            if(this._metadataList[i].metadataId == metadataId){
                this._metadataList[i].visible = visibleFlg;
                break;
            }
        }

        const refUpdateStock: ContentUpdateData = {
            metadataId,
            binaryId: elem.dataset.binaryId ?? '',
            type: 'content',
            contentType: elem.dataset.type ?? '',
            posx: Number(elem.dataset.worldX),
            posy: Number(elem.dataset.worldY),
            width: Number(elem.dataset.width),
            height: Number(elem.dataset.height),
            visible: visibleFlg,
            originWidth: Number(elem.dataset.originWidth),
            originHeight: Number(elem.dataset.originHeight),
            zindex:Number(elem.style.zIndex),
        }

        this.pushUpdateStock(refUpdateStock);
        return refUpdateStock;
    }

    resetSelectedMetadata(): void {
        this._selectedMetadataId = null;
        this.manipulator?.removeManipulator();
        if (this.el.contentInfoBody) this.el.contentInfoBody.style.display = 'none';
        this.updateContentsParameter(null);
    }

    clearContentList(): void {
        this._metadataList = [];
        if (this.el.metadataList) this.el.metadataList.innerHTML = '';
        this.updateContentsParameter(null);
    }

    contentMoveToMostTopBack (flg:number) : void {
        let minZ = 655350;
        let maxZ = -655350;

        let targetDom: any = null;

        const contentItemsDom = [...this.el.previewContent.children];
        contentItemsDom.forEach((contentDom: any) => {
            if(contentDom.dataset.metadataId == this._selectedMetadataId ){ targetDom = contentDom; }
            const targetZ = normalizeContentZIndex(Number(contentDom.style.zIndex));
            minZ = Math.min(minZ, targetZ);
            maxZ = Math.max(maxZ, targetZ);
        });

        if(targetDom){
            if(flg == 1){
                targetDom.style.zIndex = maxZ + 1;
            }
            if(flg == -1){
                targetDom.style.zIndex = minZ - 1;
            }
            this.el.zIndex.value = targetDom.style.zIndex;
            const event = new Event('change', { bubbles: false });
            // 3. 取得した要素に対してイベントを発火させる
            this.el.zIndex?.dispatchEvent(event);
        }
        if (this._selectedMetadataId) this.selectMetadata(this._selectedMetadataId);
    }

    contentSetVisible (flg:boolean) : void {
        this.el.contentVisible.checked = flg;
        const changeEvent = new Event('change');
        this.el.contentVisible.dispatchEvent(changeEvent);
    }

}
