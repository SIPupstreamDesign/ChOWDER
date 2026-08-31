import { LiveStreamManager, type MediasoupCallbacks } from '../../liveStreamManager';
import type { LogFn, SendCommandFn, SendBinaryCommandFn } from '../websocket/WebSocketClient';

export interface LiveStreamControllerDeps {
    elements: any;
    sendCmd: SendCommandFn;
    sendBinaryCmd: SendBinaryCommandFn;
    logFn: LogFn;
    getSocketId: () => string | null;
    onRetryAttachments: () => void;
    /** 送信側 video-file: pendingElemId パスで srcVideo が DOM に挿入されたときに呼ばれる */
    onVideoFilePreviewReady: (elemId: string, video: HTMLVideoElement) => void;
    /** ストリームアタッチ後にサムネイルを取得してサーバーへ送信する */
    captureThumbnail: (metadataId: string, video: HTMLVideoElement) => Promise<void>;
}

export class LiveStreamController {
    private _liveStreamManager: LiveStreamManager | null = null;
    private _isCameraActive = false;
    private _isScreenActive = false;
    private _currentScreenSessionId: string | null = null;
    private _pendingStreamProducers: any[] = [];

    /** producerId → sessionId のマップ（自分が送信中の video-file セッション管理） */
    private _producerIdToSessionId = new Map<string, string>();
    /** metadataId → sessionId のマップ（Delete 時に sessionId を逆引きするため） */
    private _metadataIdToSessionId = new Map<string, string>();
    /** producerId → HTMLVideoElement のマップ（送信側プレビュー要素） */
    private _videoFilePreviewElements = new Map<string, HTMLVideoElement>();
    /** producerId → elemId のマップ（startVideoFile 完了前に displayContentOnViewArea が呼ばれた場合の遅延マウント用） */
    private _pendingVideoFileElems = new Map<string, string>();

    private readonly el: any;
    private readonly sendCmd: SendCommandFn;
    private readonly logFn: LogFn;
    private readonly getSocketId: () => string | null;
    private readonly onRetryAttachments: () => void;
    private readonly onVideoFilePreviewReady: (elemId: string, video: HTMLVideoElement) => void;
    private readonly captureThumbnail: (metadataId: string, video: HTMLVideoElement) => Promise<void>;

    constructor(deps: LiveStreamControllerDeps) {
        this.el = deps.elements;
        this.sendCmd = deps.sendCmd;
        this.logFn = deps.logFn;
        this.getSocketId = deps.getSocketId;
        this.onRetryAttachments = deps.onRetryAttachments;
        this.onVideoFilePreviewReady = deps.onVideoFilePreviewReady;
        this.captureThumbnail = deps.captureThumbnail;
    }

    get liveStreamManager(): LiveStreamManager | null { return this._liveStreamManager; }

    /** pendingStreamProducers から指定 producerId のエントリを取り出して返す（破壊的） */
    consumePendingProducer(producerId: string): any | null {
        const idx = this._pendingStreamProducers.findIndex((p) => p.producerId === producerId);
        if (idx < 0) return null;
        const [entry] = this._pendingStreamProducers.splice(idx, 1);
        return entry;
    }

    private initLiveStreamManager(): void {
        if (this._liveStreamManager) return;

        const callbacks: MediasoupCallbacks = {
            sendCommand: (method, params) => this.sendCmd(method, params),
            log: (message, type) => this.logFn(message, type),
        };

        this._liveStreamManager = new LiveStreamManager(callbacks);
    }

    async startCamera(): Promise<void> {
        try {
            if (this._isCameraActive) {
                this.logFn('Camera is already active', 'error');
                return;
            }

            this.initLiveStreamManager();

            const config = {
                streamName: this.el.streamName.value || 'WebCam',
                posx: parseInt(this.el.streamX.value),
                posy: parseInt(this.el.streamY.value),
                width: parseInt(this.el.streamWidth.value),
                height: parseInt(this.el.streamHeight.value),
            };

            this.el.startCameraBtn.disabled = true;
            this.el.cameraStatus.textContent = 'Starting camera...';

            await this._liveStreamManager!.startCamera(config);

            this._isCameraActive = true;
            if (this.el.stopCameraBtn) this.el.stopCameraBtn.disabled = false;
            this.el.cameraStatus.textContent = '🟢 Camera Active';
            this.el.cameraStatus.style.color = '#4ade80';

            this.onRetryAttachments();
        } catch (error: any) {
            this.logFn(`Failed to start camera: ${error.message}`, 'error');
            this.el.startCameraBtn.disabled = false;
            this.el.cameraStatus.textContent = '❌ Failed to start';
            this.el.cameraStatus.style.color = '#f87171';
        }
    }

    async stopCamera(): Promise<void> {
        try {
            if (!this._isCameraActive || !this._liveStreamManager) return;

            if (this.el.stopCameraBtn) this.el.stopCameraBtn.disabled = true;
            this.el.cameraStatus.textContent = 'Stopping camera...';

            await this._liveStreamManager.stopCamera();

            this._isCameraActive = false;
            this.el.startCameraBtn.disabled = false;
            this.el.cameraStatus.textContent = '⚫ Camera Stopped';
            this.el.cameraStatus.style.color = '#666';
        } catch (error: any) {
            this.logFn(`Failed to stop camera: ${error.message}`, 'error');
        }
    }

    async startScreenShare(): Promise<void> {
        try {
            if (this._isScreenActive) {
                this.logFn('Screen share is already active', 'error');
                return;
            }

            this.initLiveStreamManager();

            const config = {
                streamName: this.el.screenName.value || 'Screen Share',
                posx: parseInt(this.el.screenX.value),
                posy: parseInt(this.el.screenY.value),
                width: parseInt(this.el.screenWidth.value),
                height: parseInt(this.el.screenHeight.value),
            };

            this.el.startScreenBtn.disabled = true;
            this.el.screenStatus.textContent = 'Starting screen share...';

            const sessionId = await this._liveStreamManager!.startScreenShare(config);
            this._currentScreenSessionId = sessionId;

            this._isScreenActive = true;
            if (this.el.stopScreenBtn) this.el.stopScreenBtn.disabled = false;
            this.el.screenStatus.textContent = '🟢 Screen Share Active';
            this.el.screenStatus.style.color = '#4ade80';

            this.onRetryAttachments();
        } catch (error: any) {
            this.logFn(`Failed to start screen share: ${error.message}`, 'error');
            this.el.startScreenBtn.disabled = false;
            this.el.screenStatus.textContent = '❌ Failed to start';
            this.el.screenStatus.style.color = '#f87171';
        }
    }

    async stopScreenShare(): Promise<void> {
        try {
            if (!this._isScreenActive || !this._liveStreamManager) return;

            if (this.el.stopScreenBtn) this.el.stopScreenBtn.disabled = true;
            this.el.screenStatus.textContent = 'Stopping screen share...';

            await this._liveStreamManager.stopScreenShare(this._currentScreenSessionId!);
            this._currentScreenSessionId = null;

            this._isScreenActive = false;
            this.el.startScreenBtn.disabled = false;
            this.el.screenStatus.textContent = '⚫ Screen Share Stopped';
            this.el.screenStatus.style.color = '#666';
        } catch (error: any) {
            this.logFn(`Failed to stop screen share: ${error.message}`, 'error');
        }
    }

    async startVideoFileShare(): Promise<void> {
        const fileInput = this.el.videoFileInput as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (!file) {
            this.logFn('Please select a video file', 'error');
            return;
        }
        await this.startVideoFileShareWithFile(file);
    }

    /**
     * File オブジェクトを受け取ってビデオファイル共有を開始する。
     * D&D・ファイルダイアログ共通エントリ。複数セッションの同時共有に対応する。
     * @param streamName 既存メタデータとの重複を解消済みの名前を呼び出し元が渡す
     */
    async startVideoFileShareWithFile(file: File, streamName: string = file.name): Promise<void> {
        this.initLiveStreamManager();

        const config = {
            streamName,
            posx: parseInt(this.el.videoFileX?.value ?? '0', 10),
            posy: parseInt(this.el.videoFileY?.value ?? '0', 10),
            width: parseInt(this.el.videoFileWidth?.value ?? '1280', 10),
            height: parseInt(this.el.videoFileHeight?.value ?? '720', 10),
        };

        try {
            this.logFn(`Starting video file share: ${file.name}...`, 'info');
            const { sessionId, videoElement: hiddenVideo, producerId } =
                await this._liveStreamManager!.startVideoFile(file, config);

            this._producerIdToSessionId.set(producerId, sessionId);
            this._videoFilePreviewElements.set(producerId, hiddenVideo);

            const pendingElemId = this._pendingVideoFileElems.get(producerId);
            if (pendingElemId !== undefined) {
                this._pendingVideoFileElems.delete(producerId);
                const pendingElem = document.getElementById(pendingElemId);
                if (pendingElem) {
                    hiddenVideo.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
                    pendingElem.insertBefore(hiddenVideo, pendingElem.firstChild);
                    this._buildVideoFileOverlay(pendingElem, hiddenVideo);
                    this.onVideoFilePreviewReady(pendingElemId, hiddenVideo);
                }
            }

            this.logFn(`✅ Video file share started: ${file.name}`, 'success');
        } catch (error: any) {
            this.logFn(`Failed to start video file share: ${error.message}`, 'error');
        }
    }

    /**
     * NewContentAdded ブロードキャストを受信したときに呼ぶ。
     * producerId → metadataId の対応を登録し、Delete 時の逆引きを可能にする。
     */
    registerVideoFileMetadata(producerId: string, metadataId: string): void {
        const sessionId = this._producerIdToSessionId.get(producerId);
        if (sessionId !== undefined) {
            this._metadataIdToSessionId.set(metadataId, sessionId);
        }
    }

    /**
     * metadataId で識別される video-file セッションを停止する。
     * 自分が送信者のセッションが見つかった場合は停止して true を返す。
     * 見つからない場合は false を返す。
     */
    async stopVideoFileByMetadata(metadataId: string): Promise<boolean> {
        const sessionId = this._metadataIdToSessionId.get(metadataId);
        if (sessionId === undefined || !this._liveStreamManager) { return false; }

        try {
            const producerId = [...this._producerIdToSessionId.entries()]
                .find(([, sid]) => sid === sessionId)?.[0];

            if (producerId !== undefined) {
                const srcVideo = this._videoFilePreviewElements.get(producerId);
                if (srcVideo) {
                    srcVideo.ontimeupdate = null;
                    srcVideo.onplay = null;
                    srcVideo.onpause = null;
                    srcVideo.onended = null;
                }
                this._videoFilePreviewElements.delete(producerId);
                this._producerIdToSessionId.delete(producerId);
                this._pendingVideoFileElems.delete(producerId);
            }

            await this._liveStreamManager.stopVideoFile(sessionId);
            this._metadataIdToSessionId.delete(metadataId);
            return true;
        } catch (error: any) {
            this.logFn(`Failed to stop video file share: ${error.message}`, 'error');
            return false;
        }
    }

    /** ログアウト時など、全 video-file セッションを停止する */
    async stopAllVideoFileSessions(): Promise<void> {
        const metadataIds = [...this._metadataIdToSessionId.keys()];
        for (const metadataId of metadataIds) {
            await this.stopVideoFileByMetadata(metadataId);
        }
    }

    /**
     * producerId で識別される自分の camera または screen share セッションを停止する。
     * 停止した場合 true、対象が見つからない場合 false を返す。
     */
    async stopLiveStreamByProducerId(producerId: string): Promise<boolean> {
        if (!this._liveStreamManager) return false;
        const cameraIds = this._liveStreamManager.getCameraProducerIds();
        if (cameraIds.includes(producerId)) {
            await this.stopCamera();
            return true;
        }
        const screenIds = this._liveStreamManager.getScreenProducerIds();
        if (screenIds.includes(producerId)) {
            await this.stopScreenShare();
            return true;
        }
        return false;
    }

    _buildVideoFileOverlay(elem: HTMLElement, srcVideo: HTMLVideoElement): void {
        if (elem.querySelector('.vf-overlay')) return;

        const fmt = (s: number) =>
            !isFinite(s)
                ? '0:00'
                : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

        const overlay = document.createElement('div');
        overlay.className = 'vf-overlay';

        const playBtn = document.createElement('button');
        playBtn.className = 'vf-play-btn';
        playBtn.textContent = srcVideo.paused ? '▶' : '⏸';
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (srcVideo.paused) srcVideo.play(); else srcVideo.pause();
        });

        const seek = document.createElement('input');
        seek.type = 'range';
        seek.className = 'vf-seek';
        seek.min = '0';
        seek.step = '0.01';
        seek.value = '0';
        seek.addEventListener('mousedown', (e) => e.stopPropagation());
        seek.addEventListener('click', (e) => e.stopPropagation());
        seek.addEventListener('input', (e) => {
            e.stopPropagation();
            srcVideo.currentTime = parseFloat(seek.value);
        });

        const timeEl = document.createElement('span');
        timeEl.className = 'vf-time';
        timeEl.textContent = '0:00 / 0:00';

        srcVideo.ontimeupdate = () => {
            seek.max = String(srcVideo.duration || 0);
            seek.value = String(srcVideo.currentTime);
            timeEl.textContent = `${fmt(srcVideo.currentTime)} / ${fmt(srcVideo.duration)}`;
        };
        srcVideo.onplay = () => { playBtn.textContent = '⏸'; };
        srcVideo.onpause = () => { playBtn.textContent = '▶'; };
        srcVideo.onended = () => { playBtn.textContent = '▶'; };

        overlay.appendChild(playBtn);
        overlay.appendChild(seek);
        overlay.appendChild(timeEl);
        elem.appendChild(overlay);
    }

    async handleNewProducer(params: any, metadataList: any[], knownMetadata?: any): Promise<void> {
        const { producerId, userId, socketId, kind } = params;

        if (socketId === this.getSocketId()) return;

        console.log(`[LiveStreamController] New ${kind} producer available from ${userId}`);

        try {
            this.initLiveStreamManager();

            let metadata: any = knownMetadata;
            if (!metadata) {
                for (const meta of metadataList) {
                    if (meta.type === 'live-stream' && (meta as any).producerId === producerId) {
                        metadata = meta;
                        break;
                    }
                }
            }

            if (!metadata) {
                console.log(`[LiveStreamController] Metadata not yet available for producer ${producerId}, pending...`);
                this._pendingStreamProducers.push(params);
                return;
            }

            const config = {
                streamName: (metadata as any).streamName || `Stream from ${userId}`,
                posx: metadata.posx,
                posy: metadata.posy,
                width: metadata.width,
                height: metadata.height,
            };

            const { stream, kind: streamKind } = await this._liveStreamManager!.consumeStream(producerId, config);
            const elementId = `view-${metadata.metadataId}`;
            this._liveStreamManager!.attachStreamToElement(elementId, stream, streamKind);
            console.log(`[LiveStreamController] Stream attached to ${elementId}`);

            // ストリームをアタッチした後、サムネイルキャプチャを実行
            // stream attachment 完了後が確実なタイミング
            if (streamKind === 'video') {
                const elem = document.getElementById(elementId);
                const video = elem?.querySelector('video');
                if (video) {
                    this.captureThumbnail(metadata.metadataId, video).catch((err) => {
                        console.warn(
                            '[LiveStreamController] captureThumbnail after attach failed:',
                            `metadataId=${metadata.metadataId}, videoWidth=${video.videoWidth}, readyState=${video.readyState}`,
                            err
                        );
                    });
                }
            }
        } catch (error: any) {
            this.logFn(`Failed to consume stream: ${error.message}`, 'error');
        }
    }

    async fetchActiveProducers(metadataList: any[]): Promise<void> {
        try {
            const result = await this.sendCmd('GetActiveProducers', {});
            const producers = result.producers || [];
            this.logFn(`Found ${producers.length} active producers`, 'info');
            for (const producer of producers) {
                await this.handleNewProducer(producer, metadataList);
            }
        } catch (error: any) {
            this.logFn(`Failed to fetch active producers: ${error.message}`, 'error');
        }
    }

    stopAllStreams(): void {
        if (this._isCameraActive) { this.stopCamera(); }
        if (this._isScreenActive) { this.stopScreenShare(); }
        this.stopAllVideoFileSessions().catch((err: unknown) => {
            console.warn('[LiveStreamController] stopAllVideoFileSessions failed:', err);
        });
    }

    /**
     * startVideoFile 完了前に displayContentOnViewArea が呼ばれた場合に、
     * producerId をキーとして elemId を保持する。
     */
    setPendingVideoFileElemId(elemId: string, producerId: string): void {
        this._pendingVideoFileElems.set(producerId, elemId);
    }

    getVideoFilePreviewElementByProducerId(producerId: string): HTMLVideoElement | null {
        return this._videoFilePreviewElements.get(producerId) ?? null;
    }
}
