import assert from 'node:assert/strict';
import { it } from 'node:test';
import { CameraMirrorUpdates, type CameraEnvelope } from './cameraMirrorUpdates';
import type { IFrameConnector } from './IFrameConnector';

function state(generation: number, revision: number): CameraEnvelope {
    return { metadataId: 'content', generation, revision, cameraWorldMatrix: '[]', cameraParams: '{}' };
}

it('retains the newest camera when an initial snapshot arrives late', (): void => {
    const updates = new CameraMirrorUpdates();
    updates.remember(state(1, 3));
    const sent: Array<{ revision: number }> = [];
    const connector = { send: (_method: string, params: { revision: number }): void => { sent.push(params); } } as IFrameConnector;
    updates.restore(connector, state(1, 1));
    assert.equal(sent[0].revision, 3);
});

it('rejects old content generations after URL replacement or deletion', (): void => {
    const updates = new CameraMirrorUpdates();
    updates.remember(state(2, 9));
    updates.forget('content');
    assert.equal(updates.remember(state(2, 10)), false);
    assert.equal(updates.remember(state(3, 1)), true);
});

it('does not discard a new URL camera when metadata arrives afterwards', (): void => {
    const updates = new CameraMirrorUpdates();
    updates.remember({ ...state(3, 1), sourceUrl: '/new' });
    updates.invalidateUrl('content', '/new');
    assert.equal(updates.remember({ ...state(3, 2), sourceUrl: '/new' }), true);
    updates.invalidateUrl('content', '/other');
    assert.equal(updates.remember({ ...state(3, 3), sourceUrl: '/new' }), false);
});