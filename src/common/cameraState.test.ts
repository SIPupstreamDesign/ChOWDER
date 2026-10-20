import assert from 'node:assert/strict';
import { it } from 'node:test';
import { isCameraRevision, isNewerCamera } from './cameraState';

it('orders camera revisions across generations without using clocks', (): void => {
    assert.equal(isNewerCamera({ generation: 2, revision: 1 }, { generation: 1, revision: 99 }), true);
    assert.equal(isNewerCamera({ generation: 1, revision: 100 }, { generation: 2, revision: 1 }), false);
    assert.equal(isNewerCamera({ generation: 2, revision: 1 }, { generation: 2, revision: 1 }), false);
    assert.equal(isCameraRevision({ generation: 0, revision: 1 }), false);
});