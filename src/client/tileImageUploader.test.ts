import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TileImageUploader } from './tileImageUploader';

describe('TileImageUploader', () => {
    it('UpdateContent 完了通知で upload が resolve すること', async (): Promise<void> => {
        const handlers = new Map<string, (params: any) => void>();
        let uploader: TileImageUploader;
        uploader = new TileImageUploader(
            async (_method: string, _params: any): Promise<any> => {
                return {};
            },
            async (method: string, _params: any, _binary: ArrayBuffer): Promise<any> => {
                if (method === 'AddContent') {
                    return { metadataId: 'meta-1' };
                }
                if (method === 'UploadTileimage') {
                    uploader.handleUpdateContent({
                        metadata: {
                            metadataId: 'meta-1',
                            type: 'tileimage',
                            xsplit: 1,
                            ysplit: 1,
                            tileSize: 256,
                            orgWidth: 100,
                            orgHeight: 100,
                            reductionWidth: 100,
                            reductionHeight: 100,
                            tileFinished: true,
                            posx: 0,
                            posy: 0,
                            width: 100,
                            height: 100,
                        },
                    });
                }
                return { ok: true };
            },
            (method: string, handler: (params: any) => void): void => {
                handlers.set(method, handler);
            }
        );

        const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.bin', { type: 'application/octet-stream' });
        const uploadPromise = uploader.upload(file, { posx: 0, posy: 0, width: 100, height: 100 }, undefined, 1024, 1000);

        const result = await uploadPromise;
        assert.strictEqual(result.metadataId, 'meta-1');
    });

    it('TileimageUploadFailed 通知で upload が reject すること', async (): Promise<void> => {
        const handlers = new Map<string, (params: any) => void>();
        let triggered = false;
        const uploader = new TileImageUploader(
            async (_method: string, _params: any): Promise<any> => {
                return {};
            },
            async (method: string, _params: any, _binary: ArrayBuffer): Promise<any> => {
                if (method === 'AddContent') {
                    return { metadataId: 'meta-2' };
                }
                if (!triggered) {
                    triggered = true;
                    const failedHandler = handlers.get('TileimageUploadFailed');
                    if (failedHandler) {
                        failedHandler({ metadataId: 'meta-2', reason: 'processing failed' });
                    }
                }
                return { ok: true };
            },
            (method: string, handler: (params: any) => void): void => {
                handlers.set(method, handler);
            }
        );

        const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.bin', { type: 'application/octet-stream' });
        const uploadPromise = uploader.upload(file, { posx: 0, posy: 0, width: 100, height: 100 }, undefined, 1024, 1000);

        await assert.rejects(async (): Promise<void> => {
            await uploadPromise;
        });
    });

    it('完了通知が来ない場合は timeout で reject すること', async (): Promise<void> => {
        const uploader = new TileImageUploader(
            async (_method: string, _params: any): Promise<any> => {
                return {};
            },
            async (method: string, _params: any, _binary: ArrayBuffer): Promise<any> => {
                if (method === 'AddContent') {
                    return { metadataId: 'meta-3' };
                }
                return { ok: true };
            },
            (_method: string, _handler: (params: any) => void): void => {}
        );

        const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.bin', { type: 'application/octet-stream' });
        const uploadPromise = uploader.upload(file, { posx: 0, posy: 0, width: 100, height: 100 }, undefined, 1024, 10);

        await assert.rejects(async (): Promise<void> => {
            await uploadPromise;
        });
    });

    it('TileimageProgress 受信が続く場合は timeout せずに完了できること', async (): Promise<void> => {
        const handlers = new Map<string, (params: any) => void>();
        let uploader: TileImageUploader;
        let triggered = false;
        uploader = new TileImageUploader(
            async (_method: string, _params: any): Promise<any> => {
                return {};
            },
            async (method: string, _params: any, _binary: ArrayBuffer): Promise<any> => {
                if (method === 'AddContent') {
                    return { metadataId: 'meta-4' };
                }
                if (method === 'UploadTileimage' && triggered === false) {
                    triggered = true;
                    setTimeout(() => {
                        const progressHandler = handlers.get('TileimageProgress');
                        if (progressHandler !== undefined) {
                            progressHandler({
                                metadataId: 'meta-4',
                                receivedSegments: 1,
                                totalSegments: 2,
                                phase: 'processing',
                            });
                        }
                    }, 20);
                    setTimeout(() => {
                        uploader.handleUpdateContent({
                            metadata: {
                                metadataId: 'meta-4',
                                type: 'tileimage',
                                xsplit: 1,
                                ysplit: 1,
                                tileSize: 256,
                                orgWidth: 100,
                                orgHeight: 100,
                                reductionWidth: 100,
                                reductionHeight: 100,
                                tileFinished: true,
                                posx: 0,
                                posy: 0,
                                width: 100,
                                height: 100,
                            },
                        });
                    }, 45);
                }
                return { ok: true };
            },
            (method: string, handler: (params: any) => void): void => {
                handlers.set(method, handler);
            }
        );

        const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.bin', { type: 'application/octet-stream' });
        const result = await uploader.upload(file, { posx: 0, posy: 0, width: 100, height: 100 }, undefined, 1024, 30);
        assert.strictEqual(result.metadataId, 'meta-4');
    });

    it('最後の進捗以降に無通信が続く場合は timeout すること', async (): Promise<void> => {
        const handlers = new Map<string, (params: any) => void>();
        let triggered = false;
        const uploader = new TileImageUploader(
            async (_method: string, _params: any): Promise<any> => {
                return {};
            },
            async (method: string, _params: any, _binary: ArrayBuffer): Promise<any> => {
                if (method === 'AddContent') {
                    return { metadataId: 'meta-5' };
                }
                if (method === 'UploadTileimage' && triggered === false) {
                    triggered = true;
                    setTimeout(() => {
                        const progressHandler = handlers.get('TileimageProgress');
                        if (progressHandler !== undefined) {
                            progressHandler({
                                metadataId: 'meta-5',
                                receivedSegments: 1,
                                totalSegments: 2,
                                phase: 'processing',
                            });
                        }
                    }, 20);
                }
                return { ok: true };
            },
            (method: string, handler: (params: any) => void): void => {
                handlers.set(method, handler);
            }
        );

        const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.bin', { type: 'application/octet-stream' });
        const uploadPromise = uploader.upload(file, { posx: 0, posy: 0, width: 100, height: 100 }, undefined, 1024, 30);

        await assert.rejects(async (): Promise<void> => {
            await uploadPromise;
        });
    });
});
