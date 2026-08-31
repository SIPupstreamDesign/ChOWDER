/**
 * LiveStreamManager 単体テスト
 *
 * セッション単位の WebRTC ストリーム管理を検証する。
 * 特に「カメラ停止が画面共有に影響しない」などの独立性を重点的にテストする。
 *
 * モック方針:
 *   - mediasoup-client の Device は constructor の deviceFactory オプションで差し替え
 *   - navigator.mediaDevices / document / URL は globalThis へのパッチで差し替え
 *   - sendCommand はテスト毎に生成するクロージャ関数で差し替え
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { LiveStreamManager, type MediasoupCallbacks, type LiveStreamManagerOptions } from './liveStreamManager';

// ============================================================
// モック用の型定義
// ============================================================

interface MockProducer {
    id: string;
    closed: boolean;
    close(): void;
}

interface MockTransport {
    id: string;
    closed: boolean;
    producers: MockProducer[];
    on(event: string, handler: any): void;
    produce(opts: any): Promise<MockProducer>;
    close(): void;
}

// ============================================================
// モックファクトリ
// ============================================================

/**
 * テスト実行中に生成されたすべての Transport を収集するリスト。
 * beforeEach でリセットすることで、テスト間の干渉を防ぐ。
 */
let createdTransports: MockTransport[] = [];

/**
 * モック Transport を生成する。
 *
 * mediasoup-client の Transport と同じ `on('produce', handler)` → `produce()` フローを
 * シミュレートし、handler が sendCommand('Produce') を通じて得た producerId を使って
 * Producer を生成する。
 */
function createMockTransport(id: string): MockTransport {
    let produceEventHandler: ((
        params: { kind: string; rtpParameters: unknown; appData: unknown },
        callback: (result: { id: string }) => void,
        errback: (err: Error) => void,
    ) => void) | null = null;

    const transport: MockTransport = {
        id,
        closed: false,
        producers: [],

        on(event: string, handler: any) {
            if (event === 'produce') {
                produceEventHandler = handler;
            }
            // 'connect' イベントはシミュレート不要（モック Transport は ICE 接続しない）
        },

        async produce(opts: any): Promise<MockProducer> {
            // mediasoup-client 内部の 'produce' イベント発火をシミュレート
            const producerId = await new Promise<string>((resolve, reject) => {
                if (!produceEventHandler) {
                    // イベントハンドラが未登録なら fallback
                    resolve(`fallback-producer-${Date.now()}`);
                    return;
                }
                produceEventHandler(
                    {
                        kind: opts.track?.kind ?? 'video',
                        rtpParameters: {},
                        appData: opts.appData ?? {},
                    },
                    ({ id: pid }) => resolve(pid),
                    reject,
                );
            });

            const producer: MockProducer = {
                id: producerId,
                closed: false,
                close() { this.closed = true; },
            };
            transport.producers.push(producer);
            return producer;
        },

        close() {
            transport.closed = true;
        },
    };

    createdTransports.push(transport);
    return transport;
}

/**
 * モック mediasoup Device を生成する。
 * createSendTransport / createRecvTransport が createMockTransport を返す。
 */
function createMockDevice(): any {
    return {
        rtpCapabilities: { codecs: [], headerExtensions: [] },
        async load(_opts: any): Promise<void> { /* noop */ },
        createSendTransport(opts: any): MockTransport {
            return createMockTransport(opts.id as string);
        },
        createRecvTransport(opts: any): MockTransport {
            return createMockTransport(opts.id as string);
        },
    };
}

/**
 * テスト用コールバックを生成する。
 *
 * CreateWebRtcTransport, Produce, CloseProducer などの
 * サーバー側コマンドをシミュレートする。
 * 各コールバックインスタンスはカウンタを独立して持つ。
 */
function createCallbacks(): MediasoupCallbacks & {
    closeProducerIds: string[];
} {
    let transportSeq = 0;
    let producerSeq = 0;
    const closeProducerIds: string[] = [];

    const sendCommand = async (method: string, params: any): Promise<any> => {
        switch (method) {
            case 'GetRouterRtpCapabilities':
                return { rtpCapabilities: { codecs: [], headerExtensions: [] } };

            case 'CreateWebRtcTransport':
                return {
                    id: `transport-${++transportSeq}`,
                    iceParameters: { usernameFragment: 'mock', password: 'mock', iceLite: false },
                    iceCandidates: [],
                    dtlsParameters: { role: 'auto', fingerprints: [] },
                };

            case 'ConnectWebRtcTransport':
                return {};

            case 'Produce':
                return { producerId: `producer-${++producerSeq}` };

            case 'CloseProducer':
                closeProducerIds.push(params.producerId as string);
                return {};

            default:
                return {};
        }
    };

    return {
        sendCommand,
        log: (_msg: string, _type?: 'info' | 'error' | 'success') => { /* noop */ },
        closeProducerIds,
    };
}

// ============================================================
// ブラウザ API モック
// ============================================================

let trackSeq = 0;

function createMockTrack(kind: 'video' | 'audio'): any {
    return {
        id: `track-${kind}-${++trackSeq}`,
        kind,
        stop() { /* noop */ },
        addEventListener() { /* noop */ },
    };
}

function createMockMediaStream(hasAudio = true): any {
    const vtTrack = createMockTrack('video');
    const atTrack = hasAudio ? createMockTrack('audio') : null;
    const tracks = atTrack ? [vtTrack, atTrack] : [vtTrack];
    return {
        getVideoTracks: () => [vtTrack],
        getAudioTracks: () => (atTrack ? [atTrack] : []),
        getTracks: () => tracks,
        active: true,
    };
}

let videoElSeq = 0;

/** video 要素モックを生成する。src セット時に onloadedmetadata を非同期発火する。 */
function createMockVideoElement(): any {
    const el: any = {
        _id: `mock-video-${++videoElSeq}`,
        style: { display: '' },
        loop: false,
        muted: false,
        playsInline: false,
        paused: true,
        onloadedmetadata: null as (() => void) | null,
        onerror: null as ((e?: any) => void) | null,
        captureStream() { return createMockMediaStream(); },
        async play() { el.paused = false; },
        pause() { el.paused = true; },
        remove() { /* noop */ },
    };

    let _src = '';
    Object.defineProperty(el, 'src', {
        get: () => _src,
        set: (value: string) => {
            _src = value;
            if (value) {
                // src 設定後、マイクロタスクで onloadedmetadata を発火（ブラウザ動作を模倣）
                Promise.resolve().then(() => {
                    if (el.onloadedmetadata) el.onloadedmetadata();
                });
            }
        },
        configurable: true,
    });

    return el;
}

/** テスト毎に生成されたすべての video 要素モックを収集するリスト */
let createdVideoElements: any[] = [];

/**
 * ブラウザ API (navigator, document, URL) を globalThis へパッチする。
 * afterEach でリストアを行う。
 */
const originalGlobals: Record<string, any> = {};

function patchBrowserAPIs() {
    const save = (key: string) => {
        originalGlobals[key] = (globalThis as any)[key];
    };

    save('document');
    save('URL');

    (globalThis as any).document = {
        createElement(tag: string) {
            if (tag === 'video') {
                const el = createMockVideoElement();
                createdVideoElements.push(el);
                return el;
            }
            return { style: {} };
        },
        getElementById: (_id: string) => null,
        body: { appendChild(_el: any) { /* noop */ } },
    };

    // URL.createObjectURL / revokeObjectURL を差し替え
    // Node.js では writable でない場合があるため try/catch で保護する
    try {
        const OrigURL = (globalThis as any).URL;
        const PatchedURL = class extends OrigURL {};
        (PatchedURL as any).createObjectURL = (_obj: any) => 'blob:mock-url';
        (PatchedURL as any).revokeObjectURL = (_url: string) => { /* noop */ };
        (globalThis as any).URL = PatchedURL;
    } catch {
        // URL が差し替えできない環境ではスキップ（startVideoFile テストは失敗の可能性あり）
    }
}

function restoreBrowserAPIs() {
    for (const [key, value] of Object.entries(originalGlobals)) {
        (globalThis as any)[key] = value;
    }
}

// ============================================================
// ヘルパー
// ============================================================

const DEFAULT_STREAM_CONFIG = {
    streamName: 'TestStream',
    posx: 0, posy: 0, width: 1280, height: 720,
};

/** LiveStreamManager をモック Device 注入で生成するヘルパー */
function createManager(callbacks: MediasoupCallbacks): LiveStreamManager {
    const options: LiveStreamManagerOptions = {
        deviceFactory: () => createMockDevice(),
        createObjectURL: (_obj: any) => 'blob:mock-url',
        revokeObjectURL: (_url: string) => { /* noop */ },
        getUserMedia: async (_c: any) => createMockMediaStream(),
        getDisplayMedia: async (_c: any) => createMockMediaStream(),
    };
    return new LiveStreamManager(callbacks, options);
}

// ============================================================
// テスト
// ============================================================

describe('LiveStreamManager', () => {
    let callbacks: ReturnType<typeof createCallbacks>;
    let manager: LiveStreamManager;

    beforeEach(() => {
        // 状態のリセット
        createdTransports = [];
        createdVideoElements = [];
        trackSeq = 0;
        videoElSeq = 0;

        callbacks = createCallbacks();
        manager = createManager(callbacks);

        patchBrowserAPIs();
    });

    afterEach(async () => {
        restoreBrowserAPIs();
        await manager.cleanup().catch(() => { /* cleanup errors を無視 */ });
    });

    // ==========================================================
    // カメラ
    // ==========================================================

    describe('startCamera / stopCamera', () => {
        it('startCamera 後に localStream が取得できること', async () => {
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            assert.ok(manager.localStream, 'localStream が null でないこと');
        });

        it('stopCamera 後に localStream が null になること', async () => {
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            await manager.stopCamera();
            assert.strictEqual(manager.localStream, null);
        });

        it('stopCamera がカメラ Transport を閉じること', async () => {
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            const cameraTransport = createdTransports[0];
            assert.ok(cameraTransport, 'カメラ Transport が作成されていること');

            await manager.stopCamera();
            assert.strictEqual(cameraTransport.closed, true, 'カメラ Transport が閉じられること');
        });

        it('stopCamera が CloseProducer をサーバーへ通知すること', async () => {
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            const cameraTrans = createdTransports[0];
            const producerIds = cameraTrans.producers.map(p => p.id);

            await manager.stopCamera();

            for (const pid of producerIds) {
                assert.ok(
                    callbacks.closeProducerIds.includes(pid),
                    `CloseProducer が producer ${pid} に対して呼ばれること`,
                );
            }
        });

        it('stopCamera が画面共有 Transport に影響しないこと（バグ修正確認）', async () => {
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            const sessionId = await manager.startScreenShare(DEFAULT_STREAM_CONFIG);
            const screenTransport = createdTransports[1];
            assert.ok(screenTransport, '画面共有 Transport が作成されていること');

            await manager.stopCamera();

            assert.strictEqual(
                screenTransport.closed, false,
                'カメラ停止後も画面共有 Transport は開いたままであること',
            );
        });

        it('stopCamera が動画ファイル Transport に影響しないこと（バグ修正確認）', async () => {
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            const mockFile = { name: 'test.mp4' } as File;
            const { sessionId } = await manager.startVideoFile(mockFile, DEFAULT_STREAM_CONFIG);
            const videoFileTransport = createdTransports[1];
            assert.ok(videoFileTransport, '動画ファイル Transport が作成されていること');

            await manager.stopCamera();

            assert.strictEqual(
                videoFileTransport.closed, false,
                'カメラ停止後も動画ファイル Transport は開いたままであること',
            );
        });
    });

    // ==========================================================
    // 画面共有
    // ==========================================================

    describe('startScreenShare / stopScreenShare', () => {
        it('startScreenShare が文字列の sessionId を返すこと', async () => {
            const sessionId = await manager.startScreenShare(DEFAULT_STREAM_CONFIG);
            assert.strictEqual(typeof sessionId, 'string', 'sessionId が string であること');
            assert.ok(sessionId.length > 0, 'sessionId が空でないこと');
        });

        it('stopScreenShare(sessionId) が指定セッションの Transport を閉じること', async () => {
            const sessionId = await manager.startScreenShare(DEFAULT_STREAM_CONFIG);
            const screenTransport = createdTransports[0];

            await manager.stopScreenShare(sessionId);

            assert.strictEqual(screenTransport.closed, true, '指定セッションの Transport が閉じられること');
        });

        it('stopScreenShare(sessionId) が CloseProducer をサーバーへ通知すること', async () => {
            const sessionId = await manager.startScreenShare(DEFAULT_STREAM_CONFIG);
            const screenTransport = createdTransports[0];
            const producerIds = screenTransport.producers.map(p => p.id);

            await manager.stopScreenShare(sessionId);

            for (const pid of producerIds) {
                assert.ok(
                    callbacks.closeProducerIds.includes(pid),
                    `CloseProducer が producer ${pid} に対して呼ばれること`,
                );
            }
        });

        it('複数の画面共有セッションを同時に起動できること', async () => {
            const sessionId1 = await manager.startScreenShare({ ...DEFAULT_STREAM_CONFIG, streamName: 'Screen1' });
            const sessionId2 = await manager.startScreenShare({ ...DEFAULT_STREAM_CONFIG, streamName: 'Screen2' });

            assert.notStrictEqual(sessionId1, sessionId2, 'sessionId が異なること');
            assert.strictEqual(createdTransports.length, 2, '2つの Transport が作成されること');
        });

        it('1つの画面共有を停止しても他の画面共有に影響しないこと', async () => {
            const sessionId1 = await manager.startScreenShare({ ...DEFAULT_STREAM_CONFIG, streamName: 'Screen1' });
            const sessionId2 = await manager.startScreenShare({ ...DEFAULT_STREAM_CONFIG, streamName: 'Screen2' });
            const transport1 = createdTransports[0];
            const transport2 = createdTransports[1];

            await manager.stopScreenShare(sessionId1);

            assert.strictEqual(transport1.closed, true, 'sessionId1 の Transport が閉じられること');
            assert.strictEqual(transport2.closed, false, 'sessionId2 の Transport は開いたままであること');
        });

        it('存在しない sessionId で stopScreenShare を呼ぶとエラーになること', async () => {
            await assert.rejects(
                () => manager.stopScreenShare('nonexistent-session-id'),
                /session/i,
                '存在しないセッションに対してエラーがスローされること',
            );
        });

        it('stopScreenShare がカメラ Transport に影響しないこと', async () => {
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            const cameraTransport = createdTransports[0];

            const sessionId = await manager.startScreenShare(DEFAULT_STREAM_CONFIG);
            await manager.stopScreenShare(sessionId);

            assert.strictEqual(
                cameraTransport.closed, false,
                '画面共有停止後もカメラ Transport は開いたままであること',
            );
        });
    });

    // ==========================================================
    // 動画ファイル
    // ==========================================================

    describe('startVideoFile / stopVideoFile', () => {
        const mockFile = { name: 'test.mp4' } as File;

        it('startVideoFile が { sessionId, videoElement } を返すこと', async () => {
            const result = await manager.startVideoFile(mockFile, DEFAULT_STREAM_CONFIG);

            assert.ok(result, '結果オブジェクトが返ること');
            assert.strictEqual(typeof result.sessionId, 'string', 'sessionId が string であること');
            assert.ok(result.sessionId.length > 0, 'sessionId が空でないこと');
            assert.ok(result.videoElement, 'videoElement が存在すること');
        });

        it('stopVideoFile(sessionId) が指定セッションの Transport を閉じること', async () => {
            const { sessionId } = await manager.startVideoFile(mockFile, DEFAULT_STREAM_CONFIG);
            const videoFileTransport = createdTransports[0];

            await manager.stopVideoFile(sessionId);

            assert.strictEqual(videoFileTransport.closed, true, '指定セッションの Transport が閉じられること');
        });

        it('stopVideoFile(sessionId) が CloseProducer をサーバーへ通知すること', async () => {
            const { sessionId } = await manager.startVideoFile(mockFile, DEFAULT_STREAM_CONFIG);
            const videoFileTrans = createdTransports[0];
            const producerIds = videoFileTrans.producers.map(p => p.id);

            await manager.stopVideoFile(sessionId);

            for (const pid of producerIds) {
                assert.ok(
                    callbacks.closeProducerIds.includes(pid),
                    `CloseProducer が producer ${pid} に対して呼ばれること`,
                );
            }
        });

        it('複数の動画ファイルセッションを同時に起動できること', async () => {
            const result1 = await manager.startVideoFile(mockFile, { ...DEFAULT_STREAM_CONFIG, streamName: 'Video1' });
            const result2 = await manager.startVideoFile(mockFile, { ...DEFAULT_STREAM_CONFIG, streamName: 'Video2' });

            assert.notStrictEqual(result1.sessionId, result2.sessionId, 'sessionId が異なること');
            assert.strictEqual(createdTransports.length, 2, '2 つの Transport が作成されること');
        });

        it('1 つの動画ファイルを停止しても他の動画ファイルセッションに影響しないこと', async () => {
            const result1 = await manager.startVideoFile(mockFile, { ...DEFAULT_STREAM_CONFIG, streamName: 'Video1' });
            const result2 = await manager.startVideoFile(mockFile, { ...DEFAULT_STREAM_CONFIG, streamName: 'Video2' });
            const transport1 = createdTransports[0];
            const transport2 = createdTransports[1];

            await manager.stopVideoFile(result1.sessionId);

            assert.strictEqual(transport1.closed, true, 'sessionId1 の Transport が閉じられること');
            assert.strictEqual(transport2.closed, false, 'sessionId2 の Transport は開いたままであること');
        });

        it('存在しない sessionId で stopVideoFile を呼ぶとエラーになること', async () => {
            await assert.rejects(
                () => manager.stopVideoFile('nonexistent-session-id'),
                /session/i,
                '存在しないセッションに対してエラーがスローされること',
            );
        });

        it('stopVideoFile がカメラ Transport に影響しないこと', async () => {
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            const cameraTransport = createdTransports[0];

            const { sessionId } = await manager.startVideoFile(mockFile, DEFAULT_STREAM_CONFIG);
            await manager.stopVideoFile(sessionId);

            assert.strictEqual(
                cameraTransport.closed, false,
                '動画ファイル停止後もカメラ Transport は開いたままであること',
            );
        });
    });

    // ==========================================================
    // cleanup
    // ==========================================================

    describe('cleanup', () => {
        it('cleanup がカメラ Transport を閉じること', async () => {
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            const cameraTransport = createdTransports[0];

            await manager.cleanup();

            assert.strictEqual(cameraTransport.closed, true, 'カメラ Transport が閉じられること');
        });

        it('cleanup が複数の画面共有 Transport をすべて閉じること', async () => {
            await manager.startScreenShare({ ...DEFAULT_STREAM_CONFIG, streamName: 'S1' });
            await manager.startScreenShare({ ...DEFAULT_STREAM_CONFIG, streamName: 'S2' });

            await manager.cleanup();

            for (const t of createdTransports) {
                assert.strictEqual(t.closed, true, `Transport ${t.id} が閉じられること`);
            }
        });

        it('cleanup が複数の動画ファイル Transport をすべて閉じること', async () => {
            const mockFile = { name: 'test.mp4' } as File;
            await manager.startVideoFile(mockFile, { ...DEFAULT_STREAM_CONFIG, streamName: 'V1' });
            await manager.startVideoFile(mockFile, { ...DEFAULT_STREAM_CONFIG, streamName: 'V2' });

            await manager.cleanup();

            for (const t of createdTransports) {
                assert.strictEqual(t.closed, true, `Transport ${t.id} が閉じられること`);
            }
        });

        it('cleanup がカメラ・画面共有・動画ファイルの全 Transport を閉じること', async () => {
            const mockFile = { name: 'test.mp4' } as File;
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            await manager.startScreenShare(DEFAULT_STREAM_CONFIG);
            await manager.startVideoFile(mockFile, DEFAULT_STREAM_CONFIG);
            assert.strictEqual(createdTransports.length, 3, '3 つの Transport が作成されていること');

            await manager.cleanup();

            for (const t of createdTransports) {
                assert.strictEqual(t.closed, true, `Transport ${t.id} が閉じられること`);
            }
        });

        it('cleanup 後に再度 startCamera を呼べること（Device が再初期化されること）', async () => {
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            await manager.cleanup();

            await assert.doesNotReject(
                () => manager.startCamera(DEFAULT_STREAM_CONFIG),
                '2 回目の startCamera がエラーにならないこと',
            );
        });
    });

    // ==========================================================
    // getStreamForProducer
    // ==========================================================

    describe('getStreamForProducer', () => {
        it('カメラプロデューサーIDからカメラストリームを返すこと', async () => {
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            const cameraTransport = createdTransports[0];
            const producerId = cameraTransport.producers[0].id;

            const stream = manager.getStreamForProducer(producerId);

            assert.strictEqual(stream, manager.localStream, 'カメラセッションのストリームが返ること');
        });

        it('画面共有プロデューサーIDから画面共有ストリームを返すこと', async () => {
            const sessionId = await manager.startScreenShare(DEFAULT_STREAM_CONFIG);
            const screenTransport = createdTransports[0];
            const producerId = screenTransport.producers[0].id;

            const stream = manager.getStreamForProducer(producerId);

            assert.strictEqual(stream, manager.getScreenStream(sessionId), '画面共有セッションのストリームが返ること');
        });

        it('不明なプロデューサーIDの場合は null を返すこと', async () => {
            const stream = manager.getStreamForProducer('nonexistent-producer-id');
            assert.strictEqual(stream, null);
        });

        it('カメラと画面共有が同時にある場合、プロデューサーIDで正しいストリームを区別すること', async () => {
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            const cameraTransport = createdTransports[0];
            const cameraProducerId = cameraTransport.producers[0].id;

            const sessionId = await manager.startScreenShare(DEFAULT_STREAM_CONFIG);
            const screenTransport = createdTransports[1];
            const screenProducerId = screenTransport.producers[0].id;

            assert.strictEqual(
                manager.getStreamForProducer(cameraProducerId),
                manager.localStream,
                'カメラプロデューサーIDがカメラストリームを返すこと',
            );
            assert.strictEqual(
                manager.getStreamForProducer(screenProducerId),
                manager.getScreenStream(sessionId),
                '画面共有プロデューサーIDが画面共有ストリームを返すこと',
            );
            assert.notStrictEqual(
                manager.getStreamForProducer(cameraProducerId),
                manager.getStreamForProducer(screenProducerId),
                'カメラと画面共有のストリームが別であること',
            );
        });

        it('動画ファイルプロデューサーIDから動画ファイルストリームを返すこと', async () => {
            const mockFile = { name: 'test.mp4' } as File;
            const { sessionId } = await manager.startVideoFile(mockFile, DEFAULT_STREAM_CONFIG);
            const videoTransport = createdTransports[0];
            const producerId = videoTransport.producers[0].id;

            // getScreenStream ではなく getStreamForProducer で取得できること
            const streamViaProducer = manager.getStreamForProducer(producerId);
            assert.ok(streamViaProducer, '動画ファイルセッションのストリームが返ること');
        });
    });

    // ==========================================================
    // getCameraProducerIds / getScreenProducerIds
    // ==========================================================

    describe('getCameraProducerIds / getScreenProducerIds', () => {
        it('カメラ未起動時は getCameraProducerIds が空配列を返すこと', () => {
            const ids = manager.getCameraProducerIds();
            return assert.deepStrictEqual(ids, []);
        });

        it('カメラ起動後は getCameraProducerIds が producerId を返すこと', async (): Promise<void> => {
            // Arrange
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            const cameraTransport = createdTransports[0];
            const expectedIds = cameraTransport.producers.map((p) => p.id);

            // Act
            const ids = manager.getCameraProducerIds();

            // Assert
            assert.ok(ids.length > 0, 'producerId が1件以上返ること');
            for (const eid of expectedIds) {
                return assert.ok(ids.includes(eid), `producerId ${eid} が含まれること`);
            }
        });

        it('カメラ停止後は getCameraProducerIds が空配列を返すこと', async (): Promise<void> => {
            // Arrange
            await manager.startCamera(DEFAULT_STREAM_CONFIG);

            // Act
            await manager.stopCamera();
            const ids = manager.getCameraProducerIds();

            // Assert
            return assert.deepStrictEqual(ids, []);
        });

        it('画面共有未起動時は getScreenProducerIds が空配列を返すこと', () => {
            const ids = manager.getScreenProducerIds();
            return assert.deepStrictEqual(ids, []);
        });

        it('画面共有起動後は getScreenProducerIds が producerId を返すこと', async (): Promise<void> => {
            // Arrange
            await manager.startScreenShare(DEFAULT_STREAM_CONFIG);
            const screenTransport = createdTransports[0];
            const expectedIds = screenTransport.producers.map((p) => p.id);

            // Act
            const ids = manager.getScreenProducerIds();

            // Assert
            assert.ok(ids.length > 0, 'producerId が1件以上返ること');
            for (const eid of expectedIds) {
                return assert.ok(ids.includes(eid), `producerId ${eid} が含まれること`);
            }
        });

        it('複数の画面共有セッションがある場合、全セッションの producerId を返すこと', async (): Promise<void> => {
            // Arrange
            await manager.startScreenShare({ ...DEFAULT_STREAM_CONFIG, streamName: 'S1' });
            await manager.startScreenShare({ ...DEFAULT_STREAM_CONFIG, streamName: 'S2' });
            const allExpectedIds = createdTransports.flatMap((t) => t.producers.map((p) => p.id));

            // Act
            const ids = manager.getScreenProducerIds();

            // Assert
            assert.ok(ids.length >= allExpectedIds.length, '全セッションの producerId が含まれること');
            for (const eid of allExpectedIds) {
                return assert.ok(ids.includes(eid), `producerId ${eid} が含まれること`);
            }
        });

        it('getCameraProducerIds と getScreenProducerIds は重複しないこと', async (): Promise<void> => {
            // Arrange
            await manager.startCamera(DEFAULT_STREAM_CONFIG);
            await manager.startScreenShare(DEFAULT_STREAM_CONFIG);

            // Act
            const cameraIds = manager.getCameraProducerIds();
            const screenIds = manager.getScreenProducerIds();

            // Assert
            for (const id of cameraIds) {
                return assert.ok(!screenIds.includes(id), `cameraId ${id} が screenIds に含まれないこと`);
            }
        });
    });
});
