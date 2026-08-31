import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { WindowMetaDataService } from './windowMetaDataService';
import { DEFAULT_SITE_ID } from '../site/siteService';
import { createTestRedis, cleanupTestRedis } from '../tests/setup';

describe('WindowMetaDataService', () => {
    let redis: Redis;
    let service: WindowMetaDataService;

    beforeEach(() => {
        redis = createTestRedis();
        service = new WindowMetaDataService(redis);
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    describe('addWindowMetaData', () => {
        it('ウィンドウメタデータを追加できること', async () => {
            const window = await service.addWindowMetaData({
                posx: 100,
                posy: 200,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });

            assert.ok(window.id);
            assert.strictEqual(window.posx, 100);
            assert.strictEqual(window.posy, 200);
            assert.strictEqual(window.virtualWidth, 1920);
            assert.strictEqual(window.virtualHeight, 1080);
            assert.strictEqual(window.contentVisible, true); // デフォルト
            assert.strictEqual(window.type, 'display');
        });

        it('IDを指定して追加できること', async () => {
            const customId = 'custom_window_123';
            const window = await service.addWindowMetaData({
                id: customId,
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });

            assert.strictEqual(window.id, customId);
        });

        it('contentVisible属性を指定できること', async () => {
            const window = await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                contentVisible: false,
            });

            assert.strictEqual(window.contentVisible, false);
        });

        it('グループを指定できること', async () => {
            const window = await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                siteId: 'test-site',
            });

            assert.strictEqual(window.siteId, 'test-site');
        });

        it('displayIdを指定できること', async () => {
            const window = await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                displayId: 'display_123',
            });

            assert.strictEqual(window.type, 'display');
            assert.strictEqual(window.displayId, 'display_123');
        });

        it('siteIdを省略した場合はデフォルトサイトが設定されること', async () => {
            const window = await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });

            assert.strictEqual(window.siteId, DEFAULT_SITE_ID);
        });

        it('siteIdを省略した場合はデフォルトサイトのdisplay_window_listに登録されること', async () => {
            const window = await service.addWindowMetaData({
                id: 'window_no_site',
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                displayId: 'display_no_site',
            });

            const displayIds = await service.getDisplayIdsBySite(DEFAULT_SITE_ID);
            assert.ok(displayIds.includes('display_no_site'));
        });
    });

    describe('getWindowMetaData', () => {
        it('IDを指定して取得できること', async () => {
            const added = await service.addWindowMetaData({
                posx: 50,
                posy: 100,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });

            const retrieved = await service.getWindowMetaData({
                id: added.id,
                type: 'single',
            });

            assert.ok(!Array.isArray(retrieved));
            assert.strictEqual(retrieved?.id, added.id);
            assert.strictEqual(retrieved?.posx, 50);
        });

        it('全件取得できること', async () => {
            await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });
            await service.addWindowMetaData({
                posx: 1920,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });

            const windows = await service.getWindowMetaData({
                type: 'all',
            });

            assert.ok(Array.isArray(windows));
            assert.strictEqual(windows.length, 2);
        });

        it('存在しないIDはnullを返すこと', async () => {
            const result = await service.getWindowMetaData({
                id: 'nonexistent',
                type: 'single',
            });

            assert.strictEqual(result, null);
        });
    });

    describe('getWindowMetaDataByDisplayId', () => {
        it('displayIdからウィンドウメタデータを取得できること', async () => {
            await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                displayId: 'display_test_1',
            });

            const window = await service.getWindowMetaDataByDisplayId('display_test_1');

            assert.ok(window);
            assert.strictEqual(window.displayId, 'display_test_1');
        });

        it('存在しないdisplayIdはnullを返すこと', async () => {
            const window = await service.getWindowMetaDataByDisplayId('nonexistent');
            assert.strictEqual(window, null);
        });
    });

    describe('updateWindowMetaData', () => {
        it('ウィンドウメタデータを更新できること', async () => {
            const added = await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });

            const updated = await service.updateWindowMetaData({
                id: added.id,
                posx: 100,
                posy: 200,
            });

            assert.ok(updated);
            assert.strictEqual(updated.posx, 100);
            assert.strictEqual(updated.posy, 200);
            assert.strictEqual(updated.virtualWidth, 1920); // 変更されていない
        });

        it('contentVisible属性をtrueからfalseに更新できること', async () => {
            const added = await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });

            const updated = await service.updateWindowMetaData({
                id: added.id,
                contentVisible: false,
            });

            assert.ok(updated);
            assert.strictEqual(updated.contentVisible, false);
        });

        it('contentVisible属性をfalseからtrueに更新できること', async () => {
            const added = await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                contentVisible: false,
            });

            const updated = await service.updateWindowMetaData({
                id: added.id,
                contentVisible: true,
            });

            assert.ok(updated);
            assert.strictEqual(updated.contentVisible, true);
        });

        it('contentVisibleを省略したとき既存の値が維持されること', async () => {
            const added = await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                contentVisible: false,
            });

            const updated = await service.updateWindowMetaData({
                id: added.id,
                posx: 100,
                // contentVisible は省略
            });

            assert.ok(updated);
            assert.strictEqual(updated.posx, 100);
            assert.strictEqual(updated.contentVisible, false); // 変更されていない
        });

        it('存在しないIDの更新はnullを返すこと', async () => {
            const result = await service.updateWindowMetaData({
                id: 'nonexistent',
                posx: 100,
            });

            assert.strictEqual(result, null);
        });

        it('siteIdを省略したとき既存のsiteIdが維持されること', async () => {
            const added = await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                siteId: 'site_original',
            });

            const updated = await service.updateWindowMetaData({
                id: added.id,
                posx: 100,
                // siteId は省略
            });

            assert.ok(updated);
            assert.strictEqual(updated.siteId, 'site_original');
        });

        it('siteIdを変更すると旧Setから除去・新Setに追加されること', async () => {
            const siteA = 'site_update_a';
            const siteB = 'site_update_b';

            const added = await service.addWindowMetaData({
                id: 'window_move',
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                displayId: 'display_move',
                siteId: siteA,
            });

            await service.updateWindowMetaData({
                id: added.id,
                siteId: siteB,
            });

            const idsA = await service.getDisplayIdsBySite(siteA);
            const idsB = await service.getDisplayIdsBySite(siteB);

            assert.ok(!idsA.includes('display_move'), 'siteAから削除されていること');
            assert.ok(idsB.includes('display_move'), 'siteBに追加されていること');
        });
    });

    describe('deleteWindowMetaData', () => {
        it('ウィンドウメタデータを削除できること', async () => {
            const added = await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });

            const deleted = await service.deleteWindowMetaData({ id: added.id });
            assert.strictEqual(deleted, true);

            const retrieved = await service.getWindowMetaData({
                id: added.id,
                type: 'single',
            });
            assert.strictEqual(retrieved, null);
        });

        it('存在しないIDの削除はfalseを返すこと', async () => {
            const deleted = await service.deleteWindowMetaData({ id: 'nonexistent' });
            assert.strictEqual(deleted, false);
        });
    });

    describe('deleteAllWindows', () => {
        it('全ウィンドウを削除できること', async () => {
            await service.addWindowMetaData({
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });
            await service.addWindowMetaData({
                posx: 1920,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
            });

            const deletedCount = await service.deleteAllWindows();
            assert.strictEqual(deletedCount, 2);

            const windows = await service.getWindowMetaData({ type: 'all' });
            assert.ok(Array.isArray(windows));
            assert.strictEqual(windows.length, 0);
        });

        it('ウィンドウが存在しない場合は0を返すこと', async () => {
            const deletedCount = await service.deleteAllWindows();
            assert.strictEqual(deletedCount, 0);
        });
    });

    describe('getDisplayIdsBySite', () => {
        it('指定したsiteIdに属するdisplayIdの一覧を返すこと', async () => {
            const siteId = 'site_test_1';

            await service.addWindowMetaData({
                id: 'window_a',
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                displayId: 'display_a',
                siteId,
            });
            await service.addWindowMetaData({
                id: 'window_b',
                posx: 1920,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                displayId: 'display_b',
                siteId,
            });

            const displayIds = await service.getDisplayIdsBySite(siteId);

            assert.ok(Array.isArray(displayIds));
            assert.strictEqual(displayIds.length, 2);
            assert.ok(displayIds.includes('display_a'));
            assert.ok(displayIds.includes('display_b'));
        });

        it('displayIdを持たないwindowは結果に含まれないこと', async () => {
            const siteId = 'site_test_2';

            // displayId あり
            await service.addWindowMetaData({
                id: 'window_with_display',
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                displayId: 'display_c',
                siteId,
            });
            // displayId なし
            await service.addWindowMetaData({
                id: 'window_without_display',
                posx: 1920,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                siteId,
            });

            const displayIds = await service.getDisplayIdsBySite(siteId);

            assert.strictEqual(displayIds.length, 1);
            assert.strictEqual(displayIds[0], 'display_c');
        });

        it('display_window_listが空の場合は空配列を返すこと', async () => {
            const displayIds = await service.getDisplayIdsBySite('site_empty');

            assert.ok(Array.isArray(displayIds));
            assert.strictEqual(displayIds.length, 0);
        });

        it('別のsiteIdのdisplayIdは含まれないこと', async () => {
            const siteIdA = 'site_test_a';
            const siteIdB = 'site_test_b';

            await service.addWindowMetaData({
                id: 'window_site_a',
                posx: 0,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                displayId: 'display_site_a',
                siteId: siteIdA,
            });
            await service.addWindowMetaData({
                id: 'window_site_b',
                posx: 1920,
                posy: 0,
                virtualWidth: 1920,
                virtualHeight: 1080,
                pixelWidth: 1920,
                pixelHeight: 1080,
                displayId: 'display_site_b',
                siteId: siteIdB,
            });

            const displayIds = await service.getDisplayIdsBySite(siteIdA);

            assert.strictEqual(displayIds.length, 1);
            assert.strictEqual(displayIds[0], 'display_site_a');
        });
    });
});
