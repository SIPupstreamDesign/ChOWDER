/**
 * LiveStreamController 単体テスト
 *
 * 検証する挙動:
 *   1. stopLiveStreamByProducerId() でカメラの producerId を渡すと stopCamera() が呼ばれ true を返す
 *   2. stopLiveStreamByProducerId() で画面共有の producerId を渡すと stopScreenShare() が呼ばれ true を返す
 *   3. stopLiveStreamByProducerId() で不明な producerId を渡すと false を返す
 *   4. stopLiveStreamByProducerId() で liveStreamManager が null のとき false を返す
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { LiveStreamController } from './LiveStreamController.js';

// ============================================================
// モック LiveStreamManager
// ============================================================

interface MockLiveStreamManager {
    cameraProducerIds: string[];
    screenProducerIds: string[];
    stopCameraCallCount: number;
    stopScreenShareCallCount: number;
    getCameraProducerIds(): string[];
    getScreenProducerIds(): string[];
    stopCamera(): Promise<void>;
    stopScreenShare(): Promise<void>;
}

function createMockLiveStreamManager(
    cameraIds: string[],
    screenIds: string[],
): MockLiveStreamManager {
    let stopCameraCallCount = 0;
    let stopScreenShareCallCount = 0;
    return {
        cameraProducerIds: cameraIds,
        screenProducerIds: screenIds,
        get stopCameraCallCount() { return stopCameraCallCount; },
        get stopScreenShareCallCount() { return stopScreenShareCallCount; },
        getCameraProducerIds() { return cameraIds; },
        getScreenProducerIds() { return screenIds; },
        async stopCamera(): Promise<void> { stopCameraCallCount++; },
        async stopScreenShare(): Promise<void> { stopScreenShareCallCount++; },
    };
}

// ============================================================
// LiveStreamController deps ファクトリ
// ============================================================

function makeDeps() {
    return {
        elements: {
            startCameraBtn: { disabled: false },
            cameraStatus: { textContent: '', style: { color: '' } },
            startScreenBtn: { disabled: false },
            screenStatus: { textContent: '', style: { color: '' } },
        },
        sendCmd: async () => ({}),
        sendBinaryCmd: async () => ({}),
        logFn: () => {},
        getSocketId: () => 'sock1',
        onRetryAttachments: () => {},
        onVideoFilePreviewReady: () => {},
        captureThumbnail: async () => {},
    };
}

/** LiveStreamController を生成し、モック LiveStreamManager を内部に注入するヘルパー */
function createControllerWithMock(
    cameraIds: string[],
    screenIds: string[],
): { ctrl: LiveStreamController; mockLsm: MockLiveStreamManager } {
    const ctrl = new LiveStreamController(makeDeps());
    const mockLsm = createMockLiveStreamManager(cameraIds, screenIds);
    (ctrl as any)._liveStreamManager = mockLsm;
    return { ctrl, mockLsm };
}

// ============================================================
// テスト
// ============================================================

describe('LiveStreamController: stopLiveStreamByProducerId', () => {
    describe('liveStreamManager が null のとき', () => {
        it('false を返すこと', async (): Promise<void> => {
            // Arrange
            const ctrl = new LiveStreamController(makeDeps());
            // _liveStreamManager は null のまま

            // Act
            const result = await ctrl.stopLiveStreamByProducerId('any-producer-id');

            // Assert
            return assert.strictEqual(result, false);
        });
    });

    describe('カメラの producerId を渡したとき', () => {
        it('stopCamera が呼ばれて true を返すこと', async (): Promise<void> => {
            // Arrange
            const { ctrl, mockLsm } = createControllerWithMock(['camera-producer-1'], []);
            (ctrl as any)._isCameraActive = true;

            // Act
            const result = await ctrl.stopLiveStreamByProducerId('camera-producer-1');

            // Assert
            assert.strictEqual(result, true, 'true を返すこと');
            return assert.strictEqual(mockLsm.stopCameraCallCount, 1, 'stopCamera が1回呼ばれること');
        });

        it('stopScreenShare は呼ばれないこと', async (): Promise<void> => {
            // Arrange
            const { ctrl, mockLsm } = createControllerWithMock(['camera-producer-1'], []);
            (ctrl as any)._isCameraActive = true;

            // Act
            await ctrl.stopLiveStreamByProducerId('camera-producer-1');

            // Assert
            return assert.strictEqual(mockLsm.stopScreenShareCallCount, 0, 'stopScreenShare は呼ばれないこと');
        });
    });

    describe('画面共有の producerId を渡したとき', () => {
        it('stopScreenShare が呼ばれて true を返すこと', async (): Promise<void> => {
            // Arrange
            const { ctrl, mockLsm } = createControllerWithMock([], ['screen-producer-1']);
            (ctrl as any)._isScreenActive = true;
            (ctrl as any)._currentScreenSessionId = 'session-1';

            // Act
            const result = await ctrl.stopLiveStreamByProducerId('screen-producer-1');

            // Assert
            assert.strictEqual(result, true, 'true を返すこと');
            return assert.strictEqual(mockLsm.stopScreenShareCallCount, 1, 'stopScreenShare が1回呼ばれること');
        });

        it('stopCamera は呼ばれないこと', async (): Promise<void> => {
            // Arrange
            const { ctrl, mockLsm } = createControllerWithMock([], ['screen-producer-1']);
            (ctrl as any)._isScreenActive = true;
            (ctrl as any)._currentScreenSessionId = 'session-1';

            // Act
            await ctrl.stopLiveStreamByProducerId('screen-producer-1');

            // Assert
            return assert.strictEqual(mockLsm.stopCameraCallCount, 0, 'stopCamera は呼ばれないこと');
        });
    });

    describe('不明な producerId を渡したとき', () => {
        it('false を返すこと', async (): Promise<void> => {
            // Arrange
            const { ctrl } = createControllerWithMock(['camera-producer-1'], ['screen-producer-1']);

            // Act
            const result = await ctrl.stopLiveStreamByProducerId('unknown-producer-id');

            // Assert
            return assert.strictEqual(result, false);
        });

        it('stopCamera も stopScreenShare も呼ばれないこと', async (): Promise<void> => {
            // Arrange
            const { ctrl, mockLsm } = createControllerWithMock(['camera-producer-1'], ['screen-producer-1']);

            // Act
            await ctrl.stopLiveStreamByProducerId('unknown-producer-id');

            // Assert
            assert.strictEqual(mockLsm.stopCameraCallCount, 0, 'stopCamera は呼ばれないこと');
            return assert.strictEqual(mockLsm.stopScreenShareCallCount, 0, 'stopScreenShare は呼ばれないこと');
        });
    });
});

// ============================================================
// handleNewProducer テスト
// ============================================================

/** consumeStream 呼び出しを記録するモック LiveStreamManager */
function makeMockLsmForConsume() {
    const consumeStreamCalls: Array<{ producerId: string; config: any }> = [];
    return {
        consumeStreamCalls,
        consumeStream: async (producerId: string, config: any) => {
            consumeStreamCalls.push({ producerId, config });
            return { stream: {} as any, kind: 'video' as const };
        },
        attachStreamToElement: () => {},
    };
}

describe('LiveStreamController: handleNewProducer', () => {
    let savedDocument: unknown;

    beforeEach(() => {
        savedDocument = (globalThis as any).document;
        // captureThumbnail 内の document.getElementById だけスタブ化
        (globalThis as any).document = { getElementById: () => null };
    });

    afterEach(() => {
        (globalThis as any).document = savedDocument;
    });

    it('knownMetadata が渡されると metadataList が空でも consumeStream が呼ばれること（既ログイン時バグ修正確認）', async () => {
        const ctrl = new LiveStreamController(makeDeps());
        const mockLsm = makeMockLsmForConsume();
        (ctrl as any)._liveStreamManager = mockLsm;

        const knownMetadata = {
            metadataId: 'meta-fix-1',
            type: 'live-stream',
            producerId: 'prod-fix-1',
            streamName: 'test-stream',
            posx: 0, posy: 0, width: 320, height: 180,
        };

        // metadataList は空（stale な状態を再現）
        await ctrl.handleNewProducer(
            { producerId: 'prod-fix-1', userId: 'other-user', socketId: 'other-socket', kind: 'video' },
            [],
            knownMetadata,
        );

        assert.strictEqual(mockLsm.consumeStreamCalls.length, 1, 'consumeStream が1回呼ばれること');
        assert.strictEqual(mockLsm.consumeStreamCalls[0].producerId, 'prod-fix-1');
    });

    it('knownMetadata がなく metadataList にメタデータがある場合も consumeStream が呼ばれること', async () => {
        const ctrl = new LiveStreamController(makeDeps());
        const mockLsm = makeMockLsmForConsume();
        (ctrl as any)._liveStreamManager = mockLsm;

        const metaInList = {
            metadataId: 'meta-fix-2',
            type: 'live-stream',
            producerId: 'prod-fix-2',
            streamName: 'stream2',
            posx: 0, posy: 0, width: 320, height: 180,
        };

        await ctrl.handleNewProducer(
            { producerId: 'prod-fix-2', userId: 'other-user', socketId: 'other-socket', kind: 'video' },
            [metaInList],
        );

        assert.strictEqual(mockLsm.consumeStreamCalls.length, 1, 'consumeStream が1回呼ばれること');
    });

    it('knownMetadata がなく metadataList にも存在しない場合、pending に積まれて consumeStream は呼ばれないこと', async () => {
        const ctrl = new LiveStreamController(makeDeps());
        const mockLsm = makeMockLsmForConsume();
        (ctrl as any)._liveStreamManager = mockLsm;

        await ctrl.handleNewProducer(
            { producerId: 'prod-fix-3', userId: 'other-user', socketId: 'other-socket', kind: 'video' },
            [],
        );

        assert.strictEqual(mockLsm.consumeStreamCalls.length, 0, 'consumeStream は呼ばれないこと');
        assert.strictEqual((ctrl as any)._pendingStreamProducers.length, 1, 'pending に1件積まれること');
        assert.strictEqual((ctrl as any)._pendingStreamProducers[0].producerId, 'prod-fix-3');
    });

    it('socketId が自分と一致するとき consumeStream は呼ばれないこと', async () => {
        const ctrl = new LiveStreamController(makeDeps()); // makeDeps は getSocketId: () => 'sock1'
        const mockLsm = makeMockLsmForConsume();
        (ctrl as any)._liveStreamManager = mockLsm;

        const knownMetadata = {
            metadataId: 'meta-fix-4',
            type: 'live-stream',
            producerId: 'prod-fix-4',
            posx: 0, posy: 0, width: 320, height: 180,
        };

        // socketId = 'sock1'（自分と同じ）
        await ctrl.handleNewProducer(
            { producerId: 'prod-fix-4', userId: 'my-user', socketId: 'sock1', kind: 'video' },
            [],
            knownMetadata,
        );

        assert.strictEqual(mockLsm.consumeStreamCalls.length, 0, '自分のストリームは consume されないこと');
    });
});
