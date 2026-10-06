import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TileImageGenerationGate } from './tileImageGenerationGate';
import type { TileImageUploadDescriptor } from './tileImageService';

function createDescriptor(uploadId: string): TileImageUploadDescriptor {
    return {
        uploadId,
        byteLength: 4,
        segment_max: 1,
        file_ext: 'png',
    };
}

describe('TileImageGenerationGate', () => {
    it('AddContent前に1件を予約し、metadata bind後はreceivingへ遷移する', (): void => {
        const gate = new TileImageGenerationGate();

        const firstDescriptor = createDescriptor('upload-1');
        assert.strictEqual(gate.tryReserve(firstDescriptor, 'socket-1', 'user-1'), true);
        assert.strictEqual(gate.tryReserve(createDescriptor('upload-2'), 'socket-2', 'user-2'), false);
        assert.strictEqual(gate.bindMetadata('upload-1', 'socket-1', 'metadata-1'), true);
        assert.deepStrictEqual(gate.getReservationForSocket('socket-1'), {
            uploadId: 'upload-1',
            metadataId: 'metadata-1',
            socketId: 'socket-1',
            userId: 'user-1',
            descriptor: firstDescriptor,
            phase: 'receiving',
        });
    });

    it('AddContent保存中の切断はcancelを記録し、metadata bind後まで予約を保持する', (): void => {
        const gate = new TileImageGenerationGate();
        const descriptor = createDescriptor('upload-1');
        gate.tryReserve(descriptor, 'socket-1', 'user-1');

        const cancellation = gate.cancelForSocket('socket-1');
        assert.deepStrictEqual(cancellation, {
            reservation: {
                uploadId: 'upload-1',
                metadataId: null,
                socketId: 'socket-1',
                userId: 'user-1',
                descriptor,
                phase: 'cancelled',
            },
            cleanupAfterMetadataCreate: true,
        });
        assert.strictEqual(gate.tryReserve(createDescriptor('upload-2'), 'socket-2', 'user-2'), true);
        assert.strictEqual(gate.bindMetadata('upload-1', 'socket-1', 'metadata-1'), false);
        assert.strictEqual(gate.getReservationForSocket('socket-1'), null);
        assert.strictEqual(gate.release('upload-1', 'socket-1'), null);
    });

    it('segment受信中の切断はcleanup contextを返して生成枠を解放する', (): void => {
        const gate = new TileImageGenerationGate();
        const descriptor = createDescriptor('upload-1');
        gate.tryReserve(descriptor, 'socket-1', 'user-1');
        gate.bindMetadata('upload-1', 'socket-1', 'metadata-1');

        const cancellation = gate.cancelForSocket('socket-1');
        assert.deepStrictEqual(cancellation, {
            reservation: {
                uploadId: 'upload-1',
                metadataId: 'metadata-1',
                socketId: 'socket-1',
                userId: 'user-1',
                descriptor,
                phase: 'receiving',
            },
            cleanupAfterMetadataCreate: false,
        });
        assert.strictEqual(gate.getReservationForSocket('socket-1'), null);
        assert.strictEqual(gate.tryReserve(createDescriptor('upload-2'), 'socket-2', 'user-2'), true);
    });

    it('Worker処理中の切断では生成枠を維持し、完了時に解放する', (): void => {
        const gate = new TileImageGenerationGate();
        gate.tryReserve(createDescriptor('upload-1'), 'socket-1', 'user-1');
        gate.bindMetadata('upload-1', 'socket-1', 'metadata-1');
        assert.strictEqual(gate.markProcessing('upload-1', 'socket-1'), true);

        assert.strictEqual(gate.cancelForSocket('socket-1'), null);
        assert.strictEqual(gate.tryReserve(createDescriptor('upload-2'), 'socket-2', 'user-2'), false);
        assert.strictEqual(gate.isProcessing('upload-1', 'socket-1'), true);
        assert.strictEqual(gate.release('upload-1', 'socket-1')?.metadataId, 'metadata-1');
        assert.strictEqual(gate.tryReserve(createDescriptor('upload-2'), 'socket-2', 'user-2'), true);
    });
});