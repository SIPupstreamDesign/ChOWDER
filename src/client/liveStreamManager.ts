/**
 * LiveStreamManager - mediasoup-client を使ったライブストリーミング管理
 *
 * セッション単位でストリームを管理する。各セッションが独立した sendTransport を持つため、
 * カメラ停止が画面共有に影響する（旧実装の transport 共用バグ）を解消している。
 *
 * 送信機能:
 *   - カメラ: 最大 1 セッション（startCamera / stopCamera）
 *   - 画面共有: 複数セッション（startScreenShare → sessionId, stopScreenShare(sessionId)）
 *   - 動画ファイル: 複数セッション（startVideoFile → {sessionId, videoElement}, stopVideoFile(sessionId)）
 *
 * 受信機能:
 *   - consumeStream / attachStreamToElement / detachStreamFromElement は変更なし
 */

import * as mediasoupClient from 'mediasoup-client';
import type {
    Device,
    Transport,
    Producer,
    Consumer,
    RtpCapabilities,
    DtlsParameters,
    MediaKind,
    RtpParameters,
    AppData,
} from 'mediasoup-client/types';

// ============================================================
// 公開型
// ============================================================

export interface StreamConfig {
    streamName: string;
    posx: number;
    posy: number;
    width: number;
    height: number;
}

/** サーバーとの通信用コールバック */
export interface MediasoupCallbacks {
    sendCommand(method: string, params: any): Promise<any>;
    log(message: string, type?: 'info' | 'error' | 'success'): void;
    onNewProducer?(producerId: string, userId: string, kind: 'audio' | 'video', streamId?: string): void;
}

/**
 * テスト用の依存性注入オプション。
 * 省略した場合はすべてデフォルト（本番用）の実装を使う。
 */
export interface LiveStreamManagerOptions {
    /** mediasoup Device のファクトリ（テスト時にモックを注入する） */
    deviceFactory?: () => Device;
    /** URL.createObjectURL の代替（テスト時に差し替え可能） */
    createObjectURL?: (obj: Blob | MediaSource) => string;
    /** URL.revokeObjectURL の代替（テスト時に差し替え可能） */
    revokeObjectURL?: (url: string) => void;
    /** navigator.mediaDevices.getUserMedia の代替（テスト時に差し替え可能） */
    getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
    /** navigator.mediaDevices.getDisplayMedia の代替（テスト時に差し替え可能） */
    getDisplayMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
}

// ============================================================
// 内部型（セッション）
// ============================================================

/** 送信セッション 1 件分の共通構造 */
interface StreamSession {
    transport: Transport;
    producers: Map<'video' | 'audio', Producer>;
    stream: MediaStream;
}

/** 動画ファイルセッション固有の追加情報 */
interface VideoFileSession extends StreamSession {
    videoElement: HTMLVideoElement;
    objectUrl: string;
}

// ============================================================
// LiveStreamManager
// ============================================================

export class LiveStreamManager {
    // mediasoup Device（初回利用時に遅延初期化）
    private device: Device | null = null;
    private readonly deviceFactory: () => Device;

    // URL ユーティリティ（テスト差し替え可能）
    private readonly _createObjectURL: (obj: Blob | MediaSource) => string;
    private readonly _revokeObjectURL: (url: string) => void;
    private readonly _getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
    private readonly _getDisplayMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;

    // コールバック
    private readonly callbacks: MediasoupCallbacks;

    // 送信セッション
    private cameraSession: StreamSession | null = null;
    private screenSessions: Map<string, StreamSession> = new Map();
    private videoFileSessions: Map<string, VideoFileSession> = new Map();

    // 受信
    private recvTransports: Map<string, Transport> = new Map();
    private consumers: Map<string, Consumer> = new Map();

    // セッション ID 生成用カウンタ
    private sessionIdCounter = 0;

    constructor(callbacks: MediasoupCallbacks, options?: LiveStreamManagerOptions) {
        this.callbacks = callbacks;
        this.deviceFactory = options?.deviceFactory ?? (() => new mediasoupClient.Device());
        this._createObjectURL = options?.createObjectURL ?? URL.createObjectURL.bind(URL);
        this._revokeObjectURL = options?.revokeObjectURL ?? URL.revokeObjectURL.bind(URL);
        this._getUserMedia = options?.getUserMedia ?? ((c) => navigator.mediaDevices.getUserMedia(c));
        this._getDisplayMedia = options?.getDisplayMedia ?? ((c) => navigator.mediaDevices.getDisplayMedia(c));
    }

    // ----------------------------------------------------------
    // public アクセサ
    // ----------------------------------------------------------

    /** カメラストリーム（カメラ未起動時は null） */
    get localStream(): MediaStream | null {
        return this.cameraSession?.stream ?? null;
    }

    /** カメラセッションの全 producerId を返す */
    getCameraProducerIds(): string[] {
        if (!this.cameraSession) return [];
        return [...this.cameraSession.producers.values()].map((p) => p.id);
    }

    /** 画面共有セッションの全 producerId を返す */
    getScreenProducerIds(): string[] {
        const ids: string[] = [];
        for (const session of this.screenSessions.values()) {
            for (const producer of session.producers.values()) {
                ids.push(producer.id);
            }
        }
        return ids;
    }

    /** 指定セッションの画面共有ストリームを返す（セッションが存在しない場合は null） */
    getScreenStream(sessionId: string): MediaStream | null {
        return this.screenSessions.get(sessionId)?.stream ?? null;
    }

    /**
     * producerId に対応するローカルストリームを返す（自分が送信中のセッションのもの）。
     * カメラ・画面共有・動画ファイルを横断して検索する。見つからなければ null。
     */
    getStreamForProducer(producerId: string): MediaStream | null {
        if (this.cameraSession) {
            for (const producer of this.cameraSession.producers.values()) {
                if (producer.id === producerId) return this.cameraSession.stream;
            }
        }
        for (const session of this.screenSessions.values()) {
            for (const producer of session.producers.values()) {
                if (producer.id === producerId) return session.stream;
            }
        }
        for (const session of this.videoFileSessions.values()) {
            for (const producer of session.producers.values()) {
                if (producer.id === producerId) return session.stream;
            }
        }
        return null;
    }

    // ----------------------------------------------------------
    // カメラ
    // ----------------------------------------------------------

    /** カメラを起動して送信開始 */
    async startCamera(config: StreamConfig): Promise<void> {
        try {
            this.callbacks.log('Starting camera...', 'info');
            await this.initializeDevice();

            const stream = await this._getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true,
            });
            this.callbacks.log('✅ Camera and microphone acquired', 'success');

            const transport = await this.createSendTransport();
            const producers = new Map<'video' | 'audio', Producer>();

            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                const p = await transport.produce({
                    track: videoTrack,
                    appData: this.buildAppData(config),
                });
                producers.set('video', p);
            }

            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                const p = await transport.produce({
                    track: audioTrack,
                    appData: this.buildAppData(config),
                });
                producers.set('audio', p);
            }

            this.cameraSession = { transport, producers, stream };
            this.callbacks.log('✅ Camera started', 'success');
        } catch (error: any) {
            this.callbacks.log(`Failed to start camera: ${error.message}`, 'error');
            throw error;
        }
    }

    /** カメラを停止 */
    async stopCamera(): Promise<void> {
        if (!this.cameraSession) return;
        try {
            this.callbacks.log('Stopping camera...', 'info');
            await this.closeSession(this.cameraSession);
            this.cameraSession = null;
            this.callbacks.log('✅ Camera stopped', 'success');
        } catch (error: any) {
            this.callbacks.log(`Failed to stop camera: ${error.message}`, 'error');
            throw error;
        }
    }

    // ----------------------------------------------------------
    // 画面共有
    // ----------------------------------------------------------

    /**
     * 画面共有を起動して送信開始。
     * @returns 新規セッションの sessionId（stopScreenShare で使用する）
     */
    async startScreenShare(config: StreamConfig): Promise<string> {
        try {
            this.callbacks.log('Starting screen share...', 'info');

            await this.initializeDevice();

            const stream = await this._getDisplayMedia({
                video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: true,
            });
            this.callbacks.log('✅ Screen capture acquired', 'success');

            const sessionId = this.generateSessionId();
            const transport = await this.createSendTransport();
            const producers = new Map<'video' | 'audio', Producer>();

            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                // ユーザーがブラウザの共有停止ボタンを押した場合に自動停止する
                videoTrack.addEventListener('ended', () => {
                    this.callbacks.log('Screen sharing stopped by user', 'info');
                    this.stopScreenShare(sessionId).catch(err => {
                        this.callbacks.log(`Error during auto-stop: ${err.message}`, 'error');
                    });
                });

                const p = await transport.produce({
                    track: videoTrack,
                    appData: this.buildAppData(config),
                });
                producers.set('video', p);
                this.callbacks.log(`✅ Screen video producer created [id:${p.id}]`, 'success');
            }

            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                const p = await transport.produce({
                    track: audioTrack,
                    appData: this.buildAppData(config),
                });
                producers.set('audio', p);
                this.callbacks.log(`✅ Screen audio producer created [id:${p.id}]`, 'success');
            }

            this.screenSessions.set(sessionId, { transport, producers, stream });
            this.callbacks.log('✅ Screen share started', 'success');
            return sessionId;
        } catch (error: any) {
            this.callbacks.log(`Failed to start screen share: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 指定セッションの画面共有を停止する。
     * @param sessionId startScreenShare が返した sessionId
     */
    async stopScreenShare(sessionId: string): Promise<void> {
        const session = this.screenSessions.get(sessionId);
        if (!session) {
            throw new Error(`Screen share session not found: ${sessionId}`);
        }
        try {
            this.callbacks.log('Stopping screen share...', 'info');
            await this.closeSession(session);
            this.screenSessions.delete(sessionId);
            this.callbacks.log('✅ Screen share stopped', 'success');
        } catch (error: any) {
            this.callbacks.log(`Failed to stop screen share: ${error.message}`, 'error');
            throw error;
        }
    }

    // ----------------------------------------------------------
    // 動画ファイル
    // ----------------------------------------------------------

    /**
     * 動画ファイルを読み込んで配信開始。
     * @returns sessionId と再生中の videoElement（コントローラ側のプレビュー表示に使用）
     */
    async startVideoFile(
        file: File,
        config: StreamConfig,
    ): Promise<{ sessionId: string; videoElement: HTMLVideoElement; producerId: string }> {
        try {
            this.callbacks.log('Starting video file share...', 'info');
            await this.initializeDevice();

            const video = document.createElement('video') as HTMLVideoElement;
            video.style.display = 'none';
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            document.body.appendChild(video);

            const objectUrl = this._createObjectURL(file);

            // メタデータ読み込み待ち（src セット前にハンドラを登録）
            const loadPromise = new Promise<void>((resolve, reject) => {
                video.onloadedmetadata = () => resolve();
                video.onerror = () => reject(new Error('Failed to load video file'));
            });
            video.src = objectUrl;
            await loadPromise;

            await video.play();
            this.callbacks.log('✅ Video file loaded and playing', 'success');

            // captureStream() で MediaStream を取得（Firefox 対応）
            const captureStreamFn: () => MediaStream =
                (video as any).captureStream?.bind(video) ??
                (video as any).mozCaptureStream?.bind(video);
            if (!captureStreamFn) {
                throw new Error('captureStream() is not supported in this browser');
            }
            const stream = captureStreamFn();

            const sessionId = this.generateSessionId();
            const transport = await this.createSendTransport();
            const producers = new Map<'video' | 'audio', Producer>();

            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                const p = await transport.produce({
                    track: videoTrack,
                    appData: { ...this.buildAppData(config), subtype: 'video-file' },
                });
                producers.set('video', p);
                this.callbacks.log(`✅ Video file producer created [id:${p.id}]`, 'success');
            }

            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                const p = await transport.produce({
                    track: audioTrack,
                    appData: { streamName: config.streamName, subtype: 'video-file' },
                });
                producers.set('audio', p);
                this.callbacks.log(`✅ Video file audio producer created [id:${p.id}]`, 'success');
            }

            this.videoFileSessions.set(sessionId, {
                transport,
                producers,
                stream,
                videoElement: video,
                objectUrl,
            });

            this.callbacks.log('✅ Video file share started', 'success');
            const videoProducerId = producers.get('video')?.id ?? '';
            return { sessionId, videoElement: video, producerId: videoProducerId };
        } catch (error: any) {
            this.callbacks.log(`Failed to start video file share: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 指定セッションの動画ファイル配信を停止する。
     * @param sessionId startVideoFile が返した sessionId
     */
    async stopVideoFile(sessionId: string): Promise<void> {
        const session = this.videoFileSessions.get(sessionId);
        if (!session) {
            throw new Error(`Video file session not found: ${sessionId}`);
        }
        try {
            this.callbacks.log('Stopping video file share...', 'info');
            await this.closeSession(session);
            this.releaseVideoFileResources(session);
            this.videoFileSessions.delete(sessionId);
            this.callbacks.log('✅ Video file share stopped', 'success');
        } catch (error: any) {
            this.callbacks.log(`Failed to stop video file share: ${error.message}`, 'error');
            throw error;
        }
    }

    // ----------------------------------------------------------
    // 受信
    // ----------------------------------------------------------

    /**
     * 既に consumeStream 済みの producerId に対応する MediaStream を返す。
     * BulkUpdateMetaData などで video 要素が再作成された際に既存ストリームを再アタッチするために使用する。
     * 対応する consumer が存在しない場合は null を返す。
     */
    getStreamForExistingConsumer(producerId: string): MediaStream | null {
        const consumer = this.consumers.get(producerId);
        if (!consumer || consumer.track.readyState === 'ended') return null;
        return new MediaStream([consumer.track]);
    }

    /**
     * リモートストリームを受信する。
     * @returns MediaStream と kind を含むオブジェクト（呼び出し側で要素にアタッチする）
     */
    async consumeStream(
        producerId: string,
        config: StreamConfig,
    ): Promise<{ stream: MediaStream; kind: 'audio' | 'video' }> {
        try {
            this.callbacks.log(`Consuming stream from producer ${producerId}...`, 'info');
            await this.initializeDevice();

            const recvTransport = await this.createRecvTransport(producerId);

            const result = await this.callbacks.sendCommand('Consume', {
                transportId: recvTransport.id,
                producerId,
                rtpCapabilities: this.device!.rtpCapabilities,
            });

            const consumer = await recvTransport.consume({
                id: result.consumerId,
                producerId: result.producerId,
                kind: result.kind,
                rtpParameters: result.rtpParameters,
            });

            this.consumers.set(producerId, consumer);

            await this.callbacks.sendCommand('ResumeConsumer', { consumerId: consumer.id });

            this.callbacks.log(
                `✅ Consumer created [id:${consumer.id}, kind:${consumer.kind}]`,
                'success',
            );

            const stream = new MediaStream([consumer.track]);
            return { stream, kind: result.kind };
        } catch (error: any) {
            this.callbacks.log(`Failed to consume stream: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * ストリームを既存の要素にアタッチ（Controller / Display 共通）
     */
    attachStreamToElement(
        elementId: string,
        stream: MediaStream,
        kind: 'audio' | 'video',
    ): void {
        const elem = document.getElementById(elementId);
        if (!elem) {
            this.callbacks.log(`⚠️ Element not found: ${elementId}`, 'error');
            return;
        }

        if (kind === 'video') {
            let video = elem.querySelector('video');
            if (!video) {
                video = document.createElement('video');
                video.autoplay = true;
                video.playsInline = true;
                video.muted = false;
                video.style.width = '100%';
                video.style.height = '100%';
                video.style.objectFit = 'contain';
                elem.appendChild(video);
                this.callbacks.log(`Video element created in ${elementId}`, 'info');
            }
            video.srcObject = stream;
            video.play().catch(err => {
                this.callbacks.log(`Failed to play video: ${err.message}`, 'error');
            });
            this.callbacks.log(`✅ Video stream attached to ${elementId}`, 'success');
        } else if (kind === 'audio') {
            const audioId = `audio-${elementId}`;
            let audio = document.getElementById(audioId) as HTMLAudioElement;
            if (!audio) {
                audio = document.createElement('audio');
                audio.id = audioId;
                audio.autoplay = true;
                audio.style.display = 'none';
                document.body.appendChild(audio);
            }
            audio.srcObject = stream;
            audio.play().catch(err => {
                this.callbacks.log(`Failed to play audio: ${err.message}`, 'error');
            });
            this.callbacks.log(`✅ Audio stream attached to ${audioId}`, 'success');
        }
    }

    /** ストリームを要素からデタッチ */
    detachStreamFromElement(elementId: string, kind: 'audio' | 'video'): void {
        if (kind === 'video') {
            const elem = document.getElementById(elementId);
            if (elem) {
                const video = elem.querySelector('video');
                if (video) {
                    video.srcObject = null;
                    this.callbacks.log(`Video stream detached from ${elementId}`, 'info');
                }
            }
        } else if (kind === 'audio') {
            const audioId = `audio-${elementId}`;
            const audio = document.getElementById(audioId) as HTMLAudioElement;
            if (audio) {
                audio.srcObject = null;
                audio.remove();
                this.callbacks.log(`Audio stream detached from ${audioId}`, 'info');
            }
        }
    }

    // ----------------------------------------------------------
    // クリーンアップ
    // ----------------------------------------------------------

    /** すべてのセッションと受信トランスポートを閉じる */
    async cleanup(): Promise<void> {
        const errors: Error[] = [];

        if (this.cameraSession) {
            await this.closeSession(this.cameraSession).catch(e => errors.push(e));
            this.cameraSession = null;
        }

        for (const [sessionId, session] of this.screenSessions.entries()) {
            await this.closeSession(session).catch(e => errors.push(e));
            this.screenSessions.delete(sessionId);
        }

        for (const [sessionId, session] of this.videoFileSessions.entries()) {
            await this.closeSession(session).catch(e => errors.push(e));
            this.releaseVideoFileResources(session);
            this.videoFileSessions.delete(sessionId);
        }

        for (const consumer of this.consumers.values()) {
            consumer.close();
        }
        this.consumers.clear();

        for (const transport of this.recvTransports.values()) {
            transport.close();
        }
        this.recvTransports.clear();

        this.device = null;

        if (errors.length > 0) {
            this.callbacks.log(
                `cleanup completed with ${errors.length} error(s): ${errors.map(e => e.message).join(', ')}`,
                'error',
            );
        }
    }

    // ----------------------------------------------------------
    // プライベートメソッド
    // ----------------------------------------------------------

    /** Device を遅延初期化する */
    private async initializeDevice(): Promise<void> {
        if (this.device) return;

        this.callbacks.log('Initializing mediasoup Device...', 'info');
        const result = await this.callbacks.sendCommand('GetRouterRtpCapabilities', {});
        const rtpCapabilities: RtpCapabilities = result.rtpCapabilities;

        this.device = this.deviceFactory();
        await this.device.load({ routerRtpCapabilities: rtpCapabilities });
        this.callbacks.log('✅ mediasoup Device initialized', 'success');
    }

    /**
     * セッション専用の Send Transport を新規作成する。
     * 各セッションが独立した Transport を持つことで、片方の停止が他方に影響しない。
     */
    private async createSendTransport(): Promise<Transport> {
        this.callbacks.log('Creating send transport...', 'info');

        const transportData = await this.callbacks.sendCommand('CreateWebRtcTransport', {
            direction: 'send',
        });

        const transport = this.device!.createSendTransport({
            id: transportData.id,
            iceParameters: transportData.iceParameters,
            iceCandidates: transportData.iceCandidates,
            dtlsParameters: transportData.dtlsParameters,
        });

        transport.on(
            'connect',
            async (
                { dtlsParameters }: { dtlsParameters: DtlsParameters },
                callback: () => void,
                errback: (error: Error) => void,
            ) => {
                try {
                    await this.callbacks.sendCommand('ConnectWebRtcTransport', {
                        transportId: transport.id,
                        dtlsParameters,
                    });
                    callback();
                } catch (error: any) {
                    errback(error);
                }
            },
        );

        transport.on(
            'produce',
            async (
                { kind, rtpParameters, appData }: { kind: MediaKind; rtpParameters: RtpParameters; appData: AppData },
                callback: ({ id }: { id: string }) => void,
                errback: (error: Error) => void,
            ) => {
                try {
                    const data = appData as Record<string, unknown>;
                    const result = await this.callbacks.sendCommand('Produce', {
                        transportId: transport.id,
                        kind,
                        rtpParameters,
                        streamName: data['streamName'],
                        posx: data['posx'],
                        posy: data['posy'],
                        width: data['width'],
                        height: data['height'],
                        subtype: data['subtype'],
                    });
                    callback({ id: result.producerId });
                } catch (error: any) {
                    errback(error);
                }
            },
        );

        this.callbacks.log('✅ Send transport created', 'success');
        return transport;
    }

    /** Recv Transport を新規作成する */
    private async createRecvTransport(producerId: string): Promise<Transport> {
        this.callbacks.log('Creating recv transport...', 'info');

        const transportData = await this.callbacks.sendCommand('CreateWebRtcTransport', {
            direction: 'recv',
        });

        const recvTransport = this.device!.createRecvTransport({
            id: transportData.id,
            iceParameters: transportData.iceParameters,
            iceCandidates: transportData.iceCandidates,
            dtlsParameters: transportData.dtlsParameters,
        });

        recvTransport.on(
            'connect',
            async (
                { dtlsParameters }: { dtlsParameters: DtlsParameters },
                callback: () => void,
                errback: (error: Error) => void,
            ) => {
                try {
                    await this.callbacks.sendCommand('ConnectWebRtcTransport', {
                        transportId: recvTransport.id,
                        dtlsParameters,
                    });
                    callback();
                } catch (error: any) {
                    errback(error);
                }
            },
        );

        this.recvTransports.set(producerId, recvTransport);
        this.callbacks.log('✅ Recv transport created', 'success');
        return recvTransport;
    }

    /**
     * セッションをクリーンアップする共通処理。
     * 各 Producer をサーバーへ通知してから閉じ、ストリームのトラックを停止し、Transport を閉じる。
     */
    private async closeSession(session: StreamSession): Promise<void> {
        for (const [kind, producer] of session.producers.entries()) {
            try {
                await this.callbacks.sendCommand('CloseProducer', { producerId: producer.id });
                this.callbacks.log(`Server notified: CloseProducer [${kind}:${producer.id}]`, 'info');
            } catch (error: any) {
                this.callbacks.log(
                    `Failed to notify server for CloseProducer [${kind}]: ${error.message}`,
                    'error',
                );
            }
            producer.close();
        }
        session.producers.clear();

        session.stream.getTracks().forEach(track => track.stop());
        session.transport.close();
    }

    /** 動画ファイルセッション固有のリソースを解放する */
    private releaseVideoFileResources(session: VideoFileSession): void {
        try {
            session.videoElement.pause();
            session.videoElement.src = '';
            session.videoElement.remove();
        } catch { /* DOM 操作の失敗は無視 */ }
        try {
            this._revokeObjectURL(session.objectUrl);
        } catch { /* revokeObjectURL の失敗は無視 */ }
    }

    /** appData の共通部分を組み立てる */
    private buildAppData(config: StreamConfig): Record<string, unknown> {
        return {
            streamName: config.streamName,
            posx: config.posx,
            posy: config.posy,
            width: config.width,
            height: config.height,
        };
    }

    /** 一意なセッション ID を生成する */
    private generateSessionId(): string {
        return `session-${++this.sessionIdCounter}-${Date.now()}`;
    }
}
