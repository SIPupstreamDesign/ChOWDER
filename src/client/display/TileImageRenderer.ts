import { virtualToWindowCoordinates, type ContentMetadata, type WindowMetaData } from './contentCoordinates';
import { getTileRect, getVisibleTileIndices, shouldUseReduction } from './tileImageGeometry';

type SendCommandFn = (method: string, params?: any) => Promise<any>;

export interface TileImageMetadata extends ContentMetadata {
    type: 'tileimage';
    xsplit: number;
    ysplit: number;
    tileSize: number;
    reductionWidth: number;
    reductionHeight: number;
    orgWidth: number;
    orgHeight: number;
    tileFinished: boolean;
    keyvalue?: string;
}

interface TileElement {
    container: HTMLDivElement;
    image: HTMLImageElement;
}

interface TileImageSession {
    generationKey: string;
    metadata: TileImageMetadata;
    abortController: AbortController;
    container: HTMLDivElement;
    reductionImage: HTMLImageElement;
    tileLayer: HTMLDivElement;
    tileElements: Map<number, TileElement>;
    tileUrls: Map<number, string>;
    tilePromises: Map<number, Promise<void>>;
    failedTileIndices: Set<number>;
    visibleTiles: Set<number>;
    reductionUrl: string | null;
    reductionFailed: boolean;
    reductionPromise: Promise<void> | null;
}

const MAX_CACHED_TILE_URLS = 128;
const MAX_CONCURRENT_IMAGE_REQUESTS = 8;
const TILE_IMAGE_MIME_TYPE = 'image/jpeg';

export class TileImageRenderer {
    private readonly sessions: Map<string, TileImageSession> = new Map();
    private activeImageRequests = 0;
    private readonly queuedImageRequestSlots: Array<() => void> = [];

    constructor(
        private readonly sendCommand: SendCommandFn,
        private readonly getWindowMeta: () => WindowMetaData | null,
    ) { }

    async update(elem: HTMLElement, metadata: TileImageMetadata): Promise<void> {
        if (!this.isValidMetadata(metadata)) {
            console.error(`[TileImageRenderer] Invalid tile metadata for metadataId=${metadata.metadataId}`);
            return;
        }

        const generationKey = this.getGenerationKey(metadata);
        let session = this.sessions.get(metadata.metadataId);
        if (session !== undefined && session.generationKey !== generationKey) {
            this.destroy(metadata.metadataId);
            session = undefined;
        }
        if (session === undefined) {
            session = this.createSession(elem, metadata, generationKey);
            this.sessions.set(metadata.metadataId, session);
        }
        const activeSession = session;

        activeSession.metadata = metadata;
        const windowMeta = this.getWindowMeta();
        const coords = windowMeta === null
            ? { w: 0, h: 0 }
            : virtualToWindowCoordinates(metadata.posx, metadata.posy, metadata.width, metadata.height, windowMeta);
        const useReduction = shouldUseReduction(
            coords.w,
            coords.h,
            metadata.reductionWidth,
            metadata.reductionHeight,
            window.devicePixelRatio || 1,
        );

        if (useReduction) {
            activeSession.visibleTiles = new Set<number>();
            activeSession.tileLayer.style.display = 'none';
            activeSession.reductionImage.style.display = 'block';
            this.syncVisibleTileElements(activeSession);
            this.trimTileCache(activeSession);
            await this.loadReductionImage(activeSession, metadata.metadataId);
            return;
        }

        const visibleTileIndices = getVisibleTileIndices(
            metadata.orgWidth,
            metadata.orgHeight,
            metadata.tileSize,
            metadata,
            windowMeta,
        );
        activeSession.visibleTiles = new Set<number>(visibleTileIndices);
        activeSession.reductionImage.style.display = 'block';
        activeSession.tileLayer.style.display = 'block';
        this.syncVisibleTileElements(activeSession);
        this.trimTileCache(activeSession);

        void this.loadReductionImage(activeSession, metadata.metadataId);
        await Promise.all(visibleTileIndices.map((tileIndex: number): Promise<void> => {
            return this.loadTile(activeSession, metadata.metadataId, tileIndex);
        }));
    }

    destroy(metadataId: string): void {
        const session = this.sessions.get(metadataId);
        if (session === undefined) {
            return;
        }

        session.abortController.abort();
        if (session.reductionUrl !== null) {
            URL.revokeObjectURL(session.reductionUrl);
        }
        for (const url of session.tileUrls.values()) {
            URL.revokeObjectURL(url);
        }
        session.container.remove();
        this.sessions.delete(metadataId);
    }

    destroyAll(): void {
        for (const metadataId of this.sessions.keys()) {
            this.destroy(metadataId);
        }
    }

    private isValidMetadata(metadata: TileImageMetadata): boolean {
        const values = [
            metadata.xsplit,
            metadata.ysplit,
            metadata.tileSize,
            metadata.orgWidth,
            metadata.orgHeight,
            metadata.width,
            metadata.height,
        ];
        return values.every((value: number): boolean => { return Number.isFinite(value) && value > 0; })
            && Number.isInteger(metadata.xsplit)
            && Number.isInteger(metadata.ysplit)
            && Number.isInteger(metadata.tileSize)
            && Number.isInteger(metadata.orgWidth)
            && Number.isInteger(metadata.orgHeight)
            && Number.isInteger(metadata.reductionWidth)
            && Number.isInteger(metadata.reductionHeight)
            && metadata.xsplit === Math.ceil(metadata.orgWidth / metadata.tileSize)
            && metadata.ysplit === Math.ceil(metadata.orgHeight / metadata.tileSize)
            && getTileRect(metadata.orgWidth, metadata.orgHeight, metadata.tileSize, 0) !== null;
    }

    private getGenerationKey(metadata: TileImageMetadata): string {
        return JSON.stringify([
            String(metadata.keyvalue ?? ''),
            metadata.binaryId,
            metadata.metadataId,
            metadata.orgWidth,
            metadata.orgHeight,
            metadata.tileSize,
            metadata.xsplit,
            metadata.ysplit,
            metadata.reductionWidth,
            metadata.reductionHeight,
        ]);
    }

    private createSession(
        elem: HTMLElement,
        metadata: TileImageMetadata,
        generationKey: string,
    ): TileImageSession {
        const container = document.createElement('div');
        container.className = 'tile-container';
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = '100%';

        const reductionImage = document.createElement('img');
        reductionImage.className = 'reduction_image';
        reductionImage.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:fill;';
        container.appendChild(reductionImage);

        const tileLayer = document.createElement('div');
        tileLayer.className = 'tile-layer';
        tileLayer.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:none;';
        container.appendChild(tileLayer);

        elem.replaceChildren(container);

        return {
            generationKey,
            metadata,
            abortController: new AbortController(),
            container,
            reductionImage,
            tileLayer,
            tileElements: new Map<number, TileElement>(),
            tileUrls: new Map<number, string>(),
            tilePromises: new Map<number, Promise<void>>(),
            failedTileIndices: new Set<number>(),
            visibleTiles: new Set<number>(),
            reductionUrl: null,
            reductionFailed: false,
            reductionPromise: null,
        };
    }

    private syncVisibleTileElements(session: TileImageSession): void {
        const metadata = session.metadata;
        for (const [tileIndex, tileElement] of session.tileElements.entries()) {
            if (!session.visibleTiles.has(tileIndex)) {
                tileElement.container.remove();
                session.tileElements.delete(tileIndex);
            }
        }

        for (const tileIndex of session.visibleTiles) {
            const rect = getTileRect(metadata.orgWidth, metadata.orgHeight, metadata.tileSize, tileIndex);
            if (rect === null) {
                continue;
            }

            let tileElement = session.tileElements.get(tileIndex);
            if (tileElement === undefined) {
                const tileContainer = document.createElement('div');
                tileContainer.className = `tile_index_${tileIndex}`;
                tileContainer.style.cssText =
                    `position:absolute;overflow:hidden;` +
                    `left:${rect.left / metadata.orgWidth * 100}%;` +
                    `top:${rect.top / metadata.orgHeight * 100}%;` +
                    `width:${rect.width / metadata.orgWidth * 100}%;` +
                    `height:${rect.height / metadata.orgHeight * 100}%;`;

                const image = document.createElement('img');
                image.style.cssText = 'display:block;width:100%;height:100%;object-fit:fill;';
                tileContainer.appendChild(image);
                session.tileLayer.appendChild(tileContainer);
                tileElement = { container: tileContainer, image };
                session.tileElements.set(tileIndex, tileElement);
            }

            const cachedUrl = session.tileUrls.get(tileIndex);
            if (cachedUrl !== undefined && tileElement.image.src !== cachedUrl) {
                tileElement.image.src = cachedUrl;
                this.touchTileUrl(session, tileIndex, cachedUrl);
            }
        }
    }

    private async loadReductionImage(session: TileImageSession, metadataId: string): Promise<void> {
        if (session.reductionUrl !== null || session.reductionFailed) {
            return;
        }
        if (session.reductionPromise !== null) {
            return session.reductionPromise;
        }

        const loadPromise = this.withImageRequestSlot((): Promise<string | null> => {
            return this.fetchDecodedUrl(session, 'GetContent', { metadataId });
        })
            .then((url: string | null): void => {
                if (url === null) {
                    return;
                }
                if (!this.isCurrentSession(metadataId, session)) {
                    URL.revokeObjectURL(url);
                    return;
                }
                session.reductionUrl = url;
                session.reductionImage.src = url;
            })
            .catch((error: unknown): void => {
                if (!session.abortController.signal.aborted) {
                    session.reductionFailed = true;
                    console.error(`[TileImageRenderer] Failed to load reduction image for metadataId=${metadataId}:`, error);
                }
            })
            .finally((): void => {
                if (session.reductionPromise === loadPromise) {
                    session.reductionPromise = null;
                }
            });

        session.reductionPromise = loadPromise;
        return loadPromise;
    }

    private async loadTile(session: TileImageSession, metadataId: string, tileIndex: number): Promise<void> {
        const cachedUrl = session.tileUrls.get(tileIndex);
        if (cachedUrl !== undefined) {
            this.touchTileUrl(session, tileIndex, cachedUrl);
            this.mountTile(session, tileIndex, cachedUrl);
            return;
        }

        const existingPromise = session.tilePromises.get(tileIndex);
        if (existingPromise !== undefined) {
            return existingPromise;
        }
        if (session.failedTileIndices.has(tileIndex)) {
            return;
        }

        const request = this.withImageRequestSlot((): Promise<string | null> => {
            return this.fetchDecodedUrl(session, 'GetTileContent', { metadataId, tileIndex });
        })
            .then((url: string | null): void => {
                if (url === null) {
                    return;
                }
                if (!this.isCurrentSession(metadataId, session)) {
                    URL.revokeObjectURL(url);
                    return;
                }
                session.tileUrls.set(tileIndex, url);
                if (session.visibleTiles.has(tileIndex)) {
                    this.mountTile(session, tileIndex, url);
                }
                this.trimTileCache(session);
            })
            .catch((error: unknown): void => {
                if (!session.abortController.signal.aborted) {
                    session.failedTileIndices.add(tileIndex);
                    console.error(`[TileImageRenderer] Failed to load tile ${tileIndex} for metadataId=${metadataId}:`, error);
                }
            })
            .finally((): void => {
                session.tilePromises.delete(tileIndex);
            });

        session.tilePromises.set(tileIndex, request);
        return request;
    }

    private async withImageRequestSlot<T>(operation: () => Promise<T>): Promise<T> {
        await this.acquireImageRequestSlot();
        try {
            return await operation();
        } finally {
            this.releaseImageRequestSlot();
        }
    }

    private acquireImageRequestSlot(): Promise<void> {
        if (this.activeImageRequests < MAX_CONCURRENT_IMAGE_REQUESTS) {
            this.activeImageRequests += 1;
            return Promise.resolve();
        }
        return new Promise<void>((resolve): void => {
            this.queuedImageRequestSlots.push(resolve);
        });
    }

    private releaseImageRequestSlot(): void {
        const nextRequest = this.queuedImageRequestSlots.shift();
        if (nextRequest !== undefined) {
            nextRequest();
            return;
        }
        this.activeImageRequests -= 1;
    }

    private async fetchDecodedUrl(
        session: TileImageSession,
        method: string,
        params: Record<string, unknown>,
    ): Promise<string | null> {
        const retryDelays = [250, 1000];
        let lastError: unknown;

        for (let attempt = 0; attempt < 3; attempt++) {
            if (session.abortController.signal.aborted) {
                return null;
            }

            let url: string | null = null;
            try {
                const response = await this.sendCommand(method, params);
                const binary = response?.binary;
                if (!(binary instanceof ArrayBuffer) && !ArrayBuffer.isView(binary)) {
                    throw new Error('Image response did not contain binary data');
                }

                let blob: Blob;
                if (binary instanceof ArrayBuffer) {
                    blob = new Blob([binary], { type: TILE_IMAGE_MIME_TYPE });
                } else {
                    const imageBytes = new Uint8Array(binary.byteLength);
                    imageBytes.set(new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength));
                    blob = new Blob([imageBytes], { type: TILE_IMAGE_MIME_TYPE });
                }
                url = URL.createObjectURL(blob);
                const image = new Image();
                image.src = url;
                await image.decode();
                if (session.abortController.signal.aborted) {
                    URL.revokeObjectURL(url);
                    return null;
                }
                return url;
            } catch (error: unknown) {
                lastError = error;
                if (url !== null) {
                    URL.revokeObjectURL(url);
                }
                if (attempt < retryDelays.length) {
                    const shouldRetry = await this.waitForRetry(
                        retryDelays[attempt],
                        session.abortController.signal,
                    );
                    if (!shouldRetry) {
                        return null;
                    }
                }
            }
        }

        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }

    private waitForRetry(delayMs: number, signal: AbortSignal): Promise<boolean> {
        return new Promise<boolean>((resolve): void => {
            if (signal.aborted) {
                resolve(false);
                return;
            }

            const onAbort = (): void => {
                clearTimeout(timeoutId);
                resolve(false);
            };
            const timeoutId = setTimeout((): void => {
                signal.removeEventListener('abort', onAbort);
                resolve(true);
            }, delayMs);
            signal.addEventListener('abort', onAbort, { once: true });
        });
    }

    private mountTile(session: TileImageSession, tileIndex: number, url: string): void {
        const tileElement = session.tileElements.get(tileIndex);
        if (tileElement === undefined || !session.visibleTiles.has(tileIndex)) {
            return;
        }
        if (tileElement.image.src !== url) {
            tileElement.image.src = url;
        }
        this.touchTileUrl(session, tileIndex, url);
    }

    private touchTileUrl(session: TileImageSession, tileIndex: number, url: string): void {
        session.tileUrls.delete(tileIndex);
        session.tileUrls.set(tileIndex, url);
    }

    private trimTileCache(session: TileImageSession): void {
        if (session.tileUrls.size <= MAX_CACHED_TILE_URLS) {
            return;
        }

        for (const [tileIndex, url] of session.tileUrls.entries()) {
            if (session.tileUrls.size <= MAX_CACHED_TILE_URLS) {
                break;
            }
            if (session.visibleTiles.has(tileIndex)) {
                continue;
            }
            session.tileUrls.delete(tileIndex);
            URL.revokeObjectURL(url);
        }
    }

    private isCurrentSession(metadataId: string, session: TileImageSession): boolean {
        return this.sessions.get(metadataId) === session && !session.abortController.signal.aborted;
    }
}