import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TileImageUploader } from './tileImageUploader';

describe('TileImageUploader', () => {
    it('UpdateContent 完了通知で upload が resolve すること', async (): Promise<void> => {
        const handlers = new Map<string, (params: any) => void>();
        const commandMethods: string[] = [];
        let declaredUploadId = '';
        let uploader: TileImageUploader;
        uploader = new TileImageUploader(
            async (_method: string, _params: any): Promise<any> => {
                return {};
            },
            async (method: string, params: any, _binary: ArrayBuffer): Promise<any> => {
                commandMethods.push(method);
                if (method === 'AddContent') {
                    assert.strictEqual(params.tileImageUpload.byteLength, 4);
                    assert.strictEqual(params.tileImageUpload.segment_max, 1);
                    assert.strictEqual(params.tileImageUpload.file_ext, 'bin');
                    assert.strictEqual(typeof params.tileImageUpload.uploadId, 'string');
                    declaredUploadId = params.tileImageUpload.uploadId;
                    return { metadataId: 'meta-1' };
                }
                if (method === 'UploadTileimage') {
                    assert.strictEqual(params.uploadId, declaredUploadId);
                    assert.strictEqual(params.id, undefined);
                    assert.strictEqual(params.byteLength, 4);
                    assert.strictEqual(params.segment_max, 1);
                    assert.strictEqual(params.file_ext, 'bin');
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
            },
            0,
        );

        const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.bin', { type: 'application/octet-stream' });
        const uploadPromise = uploader.upload(file, { posx: 0, posy: 0, width: 100, height: 100 }, undefined, 1024, 1000);

        const result = await uploadPromise;
        assert.strictEqual(result.metadataId, 'meta-1');
        assert.deepStrictEqual(commandMethods, ['AddContent', 'UploadTileimage']);
    });

    it('RPCエラーオブジェクトのmessageをAddContentとsegment失敗の両方で保持する', { timeout: 5000 }, async (): Promise<void> => {
        for (const failingMethod of ['AddContent', 'UploadTileimage']) {
            const uploader = new TileImageUploader(
                async (): Promise<object> => { return {}; },
                async (method: string): Promise<object> => {
                    if (method === failingMethod) {
                        throw { code: -32071, message: 'Segment does not match the AddContent upload descriptor' };
                    }
                    return { metadataId: 'meta-rpc-failure' };
                },
                (): void => { },
            );
            const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.bin');
            await assert.rejects(
                uploader.upload(file, { posx: 0, posy: 0, width: 100, height: 100 }),
                (error: unknown): boolean => {
                    return error instanceof Error
                        && error.message === 'Segment does not match the AddContent upload descriptor';
                },
            );
            assert.strictEqual((uploader as any).pendingUploads.size, 0);
        }
    });

    it('ファイルのarrayBuffer取得に失敗した場合はAddContentを送らない', async (): Promise<void> => {
        let commandCount = 0;
        const uploader = new TileImageUploader(
            async (_method: string, _params: any): Promise<any> => {
                return {};
            },
            async (_method: string, _params: any, _binary: ArrayBuffer): Promise<any> => {
                commandCount += 1;
                return { metadataId: 'meta-failed-read' };
            },
            (_method: string, _handler: (params: any) => void): void => { },
            0,
        );
        const file = {
            name: 'broken.png',
            arrayBuffer: async (): Promise<ArrayBuffer> => {
                throw new Error('file read failed');
            },
        } as unknown as File;

        await assert.rejects(async (): Promise<void> => {
            await uploader.upload(file, { posx: 0, posy: 0, width: 100, height: 100 });
        });

        assert.strictEqual(commandCount, 0);
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
            },
            0,
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
            (_method: string, _handler: (params: any) => void): void => { }
            , 0
        );

        const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.bin', { type: 'application/octet-stream' });
        const uploadPromise = uploader.upload(file, { posx: 0, posy: 0, width: 100, height: 100 }, undefined, 1024, 10);

        await assert.rejects(async (): Promise<void> => {
            await uploadPromise;
        });
    });

    it('completion timeout overrideはserver worker timeout+余裕のminimum未満にならない', { timeout: 5000 }, async (): Promise<void> => {
        const uploader = new TileImageUploader(
            async (_method: string, _params: any): Promise<any> => { return {}; },
            async (method: string, _params: any, _binary: ArrayBuffer): Promise<any> => {
                if (method === 'AddContent') {
                    return { metadataId: 'meta-timeout-minimum' };
                }
                return { ok: true };
            },
            (_method: string, _handler: (params: any) => void): void => { },
        );
        const file = new File([new Uint8Array([1])], 'a.bin', { type: 'application/octet-stream' });
        const uploadPromise = uploader.upload(
            file,
            { posx: 0, posy: 0, width: 1, height: 1 },
            undefined,
            512 * 1024,
            10,
        );

        await new Promise<void>((resolve): void => { setTimeout(resolve, 30); });
        assert.strictEqual((uploader as any).pendingUploads.has('meta-timeout-minimum'), true);
        uploader.cancelAll();
        await assert.rejects(uploadPromise, /Upload cancelled/);
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
            },
            0,
        );

        const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.bin', { type: 'application/octet-stream' });
        const result = await uploader.upload(file, { posx: 0, posy: 0, width: 100, height: 100 }, undefined, 1024, 30);
        assert.strictEqual(result.metadataId, 'meta-4');
    });

    it('TileimageHeartbeatは進捗callbackを増やさずidle timeoutだけ延長する', { timeout: 5000 }, async (): Promise<void> => {
        const handlers = new Map<string, (params: any) => void>();
        const progressValues: number[] = [];
        let uploader: TileImageUploader;
        let triggered = false;
        uploader = new TileImageUploader(
            async (_method: string, _params: any): Promise<any> => {
                return {};
            },
            async (method: string, _params: any, _binary: ArrayBuffer): Promise<any> => {
                if (method === 'AddContent') {
                    return { metadataId: 'meta-heartbeat' };
                }
                if (method === 'UploadTileimage' && triggered === false) {
                    triggered = true;
                    setTimeout(() => {
                        handlers.get('TileimageHeartbeat')?.({ metadataId: 'meta-heartbeat' });
                    }, 20);
                    setTimeout(() => {
                        uploader.handleUpdateContent({
                            metadata: {
                                metadataId: 'meta-heartbeat',
                                type: 'tileimage',
                                tileFinished: true,
                            },
                        });
                    }, 45);
                }
                return { ok: true };
            },
            (method: string, handler: (params: any) => void): void => {
                handlers.set(method, handler);
            },
            0,
        );

        const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.bin', { type: 'application/octet-stream' });
        const result = await uploader.upload(
            file,
            { posx: 0, posy: 0, width: 100, height: 100 },
            (_phase, received): void => { progressValues.push(received); },
            1024,
            30,
        );

        assert.strictEqual(result.metadataId, 'meta-heartbeat');
        assert.deepStrictEqual(progressValues, []);
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
            },
            0,
        );

        const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.bin', { type: 'application/octet-stream' });
        const uploadPromise = uploader.upload(file, { posx: 0, posy: 0, width: 100, height: 100 }, undefined, 1024, 30);

        await assert.rejects(async (): Promise<void> => {
            await uploadPromise;
        });
    });
});
