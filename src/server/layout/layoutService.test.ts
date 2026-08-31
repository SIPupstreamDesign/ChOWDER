import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { LayoutService } from './layoutService';
import { ContentService } from '../content/contentService';
import { ContentType } from '../content/contentTypes';
import { createTestRedis, cleanupTestRedis } from '../tests/setup';

describe('LayoutService', () => {
    let redis: Redis;
    let contentService: ContentService;
    let service: LayoutService;

    beforeEach(() => {
        redis = createTestRedis();
        contentService = new ContentService(redis);
        service = new LayoutService(redis, contentService);
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    // ========================================
    // saveLayout
    // ========================================

    describe('saveLayout', () => {
        it('コンテンツが存在しない状態でレイアウトを保存できること', async () => {
            const layout = await service.saveLayout({ name: 'empty layout' });

            assert.ok(layout.layoutId);
            assert.strictEqual(layout.name, 'empty layout');
            assert.deepStrictEqual(layout.entries, []);
            assert.ok(layout.createdAt);
            assert.ok(layout.updatedAt);
        });

        it('コンテンツの位置情報をスナップショットとして保存できること', async () => {
            const binary = Buffer.from('test image');
            await contentService.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'user1',
                    posx: 100,
                    posy: 200,
                    width: 640,
                    height: 480,
                    orgWidth: 640,
                    orgHeight: 480,
                    zindex: 5,
                    visible: true,
                    mime: 'image/png',
                },
                binary,
            });

            const layout = await service.saveLayout({ name: 'layout1' });

            assert.strictEqual(layout.entries.length, 1);
            const entry = layout.entries[0];
            assert.ok(entry.metadataId);
            assert.strictEqual(entry.posx, 100);
            assert.strictEqual(entry.posy, 200);
            assert.strictEqual(entry.width, 640);
            assert.strictEqual(entry.height, 480);
            assert.strictEqual(entry.orgWidth, 640);
            assert.strictEqual(entry.orgHeight, 480);
            assert.strictEqual(entry.zindex, 5);
            assert.strictEqual(entry.visible, true);
            assert.strictEqual(entry.mime, 'image/png');
        });

        it('entry に binaryId, type, creatorId, date が含まれないこと', async () => {
            const binary = Buffer.from('test image');
            await contentService.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'user1',
                    posx: 0,
                    posy: 0,
                    width: 100,
                    height: 100,
                },
                binary,
            });

            const layout = await service.saveLayout({ name: 'layout1' });

            assert.strictEqual(layout.entries.length, 1);
            const entry = layout.entries[0] as any;
            assert.strictEqual(entry.binaryId, undefined);
            assert.strictEqual(entry.type, undefined);
            assert.strictEqual(entry.creatorId, undefined);
            assert.strictEqual(entry.date, undefined);
        });

        it('live-stream コンテンツはレイアウトに含まれないこと', async () => {
            // 通常コンテンツを追加
            const binary = Buffer.from('test image');
            await contentService.addContent({
                metadata: {
                    type: ContentType.IMAGE,
                    creatorId: 'user1',
                    posx: 0,
                    posy: 0,
                    width: 100,
                    height: 100,
                },
                binary,
            });

            // live-stream コンテンツを追加
            await contentService.addStreamMetadata({
                creatorId: 'user1',
                streamId: 'stream-1',
                streamName: 'WebCam1',
                userId: 'user1',
                socketId: 'socket-1',
                producerId: 'producer-1',
                posx: 50,
                posy: 50,
                width: 320,
                height: 240,
            });

            const layout = await service.saveLayout({ name: 'layout1' });

            // live-stream は含まれない
            assert.strictEqual(layout.entries.length, 1);
            const entry = layout.entries[0] as any;
            assert.notStrictEqual(entry.metadataId, undefined);
        });

        it('複数コンテンツを保存できること', async () => {
            const binary = Buffer.from('test');
            await contentService.addContent({
                metadata: { type: ContentType.IMAGE, creatorId: 'u1', posx: 0, posy: 0, width: 100, height: 100 },
                binary,
            });
            await contentService.addContent({
                metadata: { type: ContentType.TEXT, creatorId: 'u1', posx: 200, posy: 300, width: 400, height: 50 },
                binary,
            });

            const layout = await service.saveLayout({ name: 'multi' });

            assert.strictEqual(layout.entries.length, 2);
        });

        it('layoutId を指定して上書き保存できること', async () => {
            const binary = Buffer.from('test image');
            await contentService.addContent({
                metadata: { type: ContentType.IMAGE, creatorId: 'u1', posx: 100, posy: 100, width: 100, height: 100 },
                binary,
            });

            const original = await service.saveLayout({ name: 'layout1' });
            const originalCreatedAt = original.createdAt;

            // コンテンツ位置を更新
            const allMeta = await contentService.getAllMetadata();
            await contentService.updateMetadata(allMeta[0].metadataId, { posx: 999, posy: 888 });

            // 上書き保存
            const overwritten = await service.saveLayout({ name: 'layout1 updated', layoutId: original.layoutId });

            assert.strictEqual(overwritten.layoutId, original.layoutId);
            assert.strictEqual(overwritten.name, 'layout1 updated');
            assert.strictEqual(overwritten.createdAt, originalCreatedAt); // createdAt は変わらない
            assert.notStrictEqual(overwritten.updatedAt, originalCreatedAt);
            assert.strictEqual(overwritten.entries[0].posx, 999);
            assert.strictEqual(overwritten.entries[0].posy, 888);
        });

        it('存在しない layoutId を指定した場合は新規作成されること', async () => {
            const layout = await service.saveLayout({ name: 'new layout', layoutId: 'nonexistent-id' });

            assert.ok(layout.layoutId);
            assert.strictEqual(layout.name, 'new layout');
        });

        it('保存後に layout:list に登録されること', async () => {
            const layout = await service.saveLayout({ name: 'layout1' });

            const summaries = await service.getAllLayouts();
            assert.strictEqual(summaries.length, 1);
            assert.strictEqual(summaries[0].layoutId, layout.layoutId);
        });
    });

    // ========================================
    // getLayout
    // ========================================

    describe('getLayout', () => {
        it('存在するレイアウトを取得できること', async () => {
            const saved = await service.saveLayout({ name: 'layout1' });
            const fetched = await service.getLayout(saved.layoutId);

            assert.ok(fetched);
            assert.strictEqual(fetched.layoutId, saved.layoutId);
            assert.strictEqual(fetched.name, 'layout1');
        });

        it('存在しない layoutId の場合は null を返すこと', async () => {
            const result = await service.getLayout('no-such-id');
            assert.strictEqual(result, null);
        });
    });

    // ========================================
    // getAllLayouts
    // ========================================

    describe('getAllLayouts', () => {
        it('レイアウトが存在しない場合は空配列を返すこと', async () => {
            const summaries = await service.getAllLayouts();
            assert.deepStrictEqual(summaries, []);
        });

        it('保存した全レイアウトのサマリーを取得できること', async () => {
            await service.saveLayout({ name: 'layout A' });
            await service.saveLayout({ name: 'layout B' });

            const summaries = await service.getAllLayouts();

            assert.strictEqual(summaries.length, 2);
            const names = summaries.map(s => s.name).sort();
            assert.deepStrictEqual(names, ['layout A', 'layout B']);
            // entries は含まない
            for (const s of summaries) {
                assert.ok(s.layoutId);
                assert.ok(s.name);
                assert.ok(s.createdAt);
                assert.ok(s.updatedAt);
                assert.strictEqual((s as any).entries, undefined);
            }
        });
    });

    // ========================================
    // deleteLayout
    // ========================================

    describe('deleteLayout', () => {
        it('レイアウトを削除できること', async () => {
            const saved = await service.saveLayout({ name: 'to delete' });

            const result = await service.deleteLayout(saved.layoutId);

            assert.strictEqual(result, true);
            assert.strictEqual(await service.getLayout(saved.layoutId), null);

            const summaries = await service.getAllLayouts();
            assert.strictEqual(summaries.length, 0);
        });

        it('存在しない layoutId の場合は false を返すこと', async () => {
            const result = await service.deleteLayout('no-such-id');
            assert.strictEqual(result, false);
        });
    });

    // ========================================
    // restoreLayout
    // ========================================

    describe('restoreLayout', () => {
        it('存在しない layoutId の場合は null を返すこと', async () => {
            const result = await service.restoreLayout('no-such-id');
            assert.strictEqual(result, null);
        });

        it('コンテンツを保存時の状態に復元できること', async () => {
            const binary = Buffer.from('test image');
            const added = await contentService.addContent({
                metadata: { type: ContentType.IMAGE, creatorId: 'u1', posx: 100, posy: 200, width: 640, height: 480, zindex: 3, visible: true },
                binary,
            });

            // レイアウトを保存
            const layout = await service.saveLayout({ name: 'snapshot' });

            // コンテンツを別の位置に移動
            await contentService.updateMetadata(added.metadataId, { posx: 999, posy: 888, width: 100, height: 100 });

            // 復元
            const result = await service.restoreLayout(layout.layoutId);

            assert.ok(result);
            assert.strictEqual(result.updatedIds.length, 1);
            assert.strictEqual(result.skippedIds.length, 0);

            // 位置が元に戻っていることを確認
            const restored = await contentService.getMetadata(added.metadataId);
            assert.ok(restored);
            assert.strictEqual(restored.posx, 100);
            assert.strictEqual(restored.posy, 200);
            assert.strictEqual(restored.width, 640);
            assert.strictEqual(restored.height, 480);
            assert.strictEqual(restored.zindex, 3);
        });

        it('存在しないコンテンツはスキップされること', async () => {
            const binary = Buffer.from('test image');
            const added = await contentService.addContent({
                metadata: { type: ContentType.IMAGE, creatorId: 'u1', posx: 100, posy: 100, width: 100, height: 100 },
                binary,
            });

            const layout = await service.saveLayout({ name: 'snapshot' });

            // コンテンツを削除
            await contentService.deleteContent(added.metadataId);

            // 復元（存在しないのでスキップ）
            const result = await service.restoreLayout(layout.layoutId);

            assert.ok(result);
            assert.strictEqual(result.updatedIds.length, 0);
            assert.strictEqual(result.skippedIds.length, 1);
            assert.strictEqual(result.skippedIds[0], added.metadataId);
        });

        it('複数コンテンツをアトミックに復元できること', async () => {
            const binary = Buffer.from('test');
            const a = await contentService.addContent({
                metadata: { type: ContentType.IMAGE, creatorId: 'u1', posx: 10, posy: 20, width: 100, height: 100 },
                binary,
            });
            const b = await contentService.addContent({
                metadata: { type: ContentType.TEXT, creatorId: 'u1', posx: 200, posy: 300, width: 400, height: 50 },
                binary,
            });

            const layout = await service.saveLayout({ name: 'multi' });

            // 両方を移動
            await contentService.updateMetadata(a.metadataId, { posx: 0, posy: 0 });
            await contentService.updateMetadata(b.metadataId, { posx: 0, posy: 0 });

            const result = await service.restoreLayout(layout.layoutId);

            assert.ok(result);
            assert.strictEqual(result.updatedIds.length, 2);

            const restoredA = await contentService.getMetadata(a.metadataId);
            const restoredB = await contentService.getMetadata(b.metadataId);
            assert.strictEqual(restoredA!.posx, 10);
            assert.strictEqual(restoredB!.posx, 200);
        });

        it('binaryId, type, creatorId は復元で上書きされないこと', async () => {
            const binary = Buffer.from('test image');
            const added = await contentService.addContent({
                metadata: { type: ContentType.IMAGE, creatorId: 'originalUser', posx: 0, posy: 0, width: 100, height: 100 },
                binary,
            });

            const layout = await service.saveLayout({ name: 'snapshot' });

            await service.restoreLayout(layout.layoutId);

            const after = await contentService.getMetadata(added.metadataId);
            assert.ok(after);
            assert.strictEqual(after.binaryId, added.binaryId);
            assert.strictEqual(after.type, ContentType.IMAGE);
            assert.strictEqual(after.creatorId, 'originalUser');
        });

        it('visible=undefined のコンテンツを保存すると entry.visible が true になること', async () => {
            const binary = Buffer.from('test image');
            await contentService.addContent({
                metadata: { type: ContentType.IMAGE, creatorId: 'u1', posx: 0, posy: 0, width: 100, height: 100 },
                // visible を意図的に指定しない（undefined）
                binary,
            });

            const layout = await service.saveLayout({ name: 'snapshot' });

            assert.strictEqual(layout.entries.length, 1);
            assert.strictEqual(layout.entries[0].visible, true);
        });

        it('保存時 visible=false だったコンテンツは Restore 後も visible=false になること', async () => {
            const binary = Buffer.from('test image');
            const added = await contentService.addContent({
                metadata: { type: ContentType.IMAGE, creatorId: 'u1', posx: 0, posy: 0, width: 100, height: 100, visible: false },
                binary,
            });

            // visible=false でレイアウトを保存
            const layout = await service.saveLayout({ name: 'snapshot' });
            assert.strictEqual(layout.entries[0].visible, false);

            // コンテンツを visible=true に変更
            await contentService.updateMetadata(added.metadataId, { visible: true });
            const changed = await contentService.getMetadata(added.metadataId);
            assert.strictEqual(changed!.visible, true);

            // Restore → visible=false に戻る
            await service.restoreLayout(layout.layoutId);
            const restored = await contentService.getMetadata(added.metadataId);
            assert.ok(restored);
            assert.strictEqual(restored.visible, false);
        });
    });
});
