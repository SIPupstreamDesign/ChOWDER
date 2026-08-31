import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { SiteService, DEFAULT_SITE_ID } from './siteService';
import { REDIS_KEYS } from '../common/redisKeys.js';
import { createTestRedis, cleanupTestRedis } from '../tests/setup';

describe('SiteService', () => {
    let redis: Redis;
    let service: SiteService;

    beforeEach(() => {
        redis = createTestRedis();
        service = new SiteService(redis);
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    // ========================================
    // ensureDefaultSite
    // ========================================

    describe('ensureDefaultSite', () => {
        it('デフォルト Site が存在しない場合は作成されること', async () => {
            const site = await service.ensureDefaultSite();

            assert.strictEqual(site.siteId, DEFAULT_SITE_ID);
            assert.strictEqual(site.siteName, 'Default');
            assert.strictEqual(site.isDefault, true);
            assert.ok(site.createdAt);
            assert.ok(site.updatedAt);
        });

        it('デフォルト Site が既に存在する場合は再作成されないこと', async () => {
            const first = await service.ensureDefaultSite();
            const second = await service.ensureDefaultSite();

            assert.strictEqual(first.siteId, second.siteId);
            assert.strictEqual(first.createdAt, second.createdAt);
        });

        it('作成後に getSite で取得できること', async () => {
            await service.ensureDefaultSite();

            const site = await service.getSite({ siteId: DEFAULT_SITE_ID });

            assert.ok(site);
            assert.strictEqual(site.siteId, DEFAULT_SITE_ID);
            assert.strictEqual(site.isDefault, true);
        });

        it('getAllSites に含まれること', async () => {
            await service.ensureDefaultSite();

            const all = await service.getAllSites();

            assert.strictEqual(all.length, 1);
            assert.strictEqual(all[0].siteId, DEFAULT_SITE_ID);
        });

        it('デフォルト Site の color が #fbbf24 であること', async () => {
            const site = await service.ensureDefaultSite();

            assert.strictEqual(site.color, '#fbbf24');
        });
    });

    // ========================================
    // createSite
    // ========================================

    describe('createSite', () => {
        it('新しい Site を作成できること', async () => {
            const site = await service.createSite({
                siteName: 'Test Site',
                description: 'テスト用 Site',
            });

            assert.ok(site.siteId);
            assert.ok(site.siteId.startsWith('site_'));
            assert.strictEqual(site.siteName, 'Test Site');
            assert.strictEqual(site.description, 'テスト用 Site');
            assert.strictEqual(site.isDefault, false);
            assert.ok(site.createdAt);
            assert.ok(site.updatedAt);
        });

        it('description 省略で作成できること', async () => {
            const site = await service.createSite({ siteName: 'No Desc Site' });

            assert.strictEqual(site.siteName, 'No Desc Site');
            assert.strictEqual(site.description, undefined);
        });

        it('複数の Site を作成すると異なる siteId が付与されること', async () => {
            const a = await service.createSite({ siteName: 'Site A' });
            const b = await service.createSite({ siteName: 'Site B' });

            assert.notStrictEqual(a.siteId, b.siteId);
        });

        it('作成後に getSite で取得できること', async () => {
            const created = await service.createSite({ siteName: 'Retrieve Me' });

            const fetched = await service.getSite({ siteId: created.siteId });

            assert.ok(fetched);
            assert.strictEqual(fetched.siteId, created.siteId);
            assert.strictEqual(fetched.siteName, 'Retrieve Me');
        });
    });

    // ========================================
    // updateSite
    // ========================================

    describe('updateSite', () => {
        it('Site 名を更新できること', async () => {
            const created = await service.createSite({ siteName: 'Before' });

            const updated = await service.updateSite({
                siteId: created.siteId,
                siteName: 'After',
            });

            assert.ok(updated);
            assert.strictEqual(updated.siteName, 'After');
            assert.strictEqual(updated.siteId, created.siteId);
            assert.strictEqual(updated.createdAt, created.createdAt); // 作成日時は変わらない
        });

        it('description を更新できること', async () => {
            const created = await service.createSite({ siteName: 'My Site', description: 'Old' });

            const updated = await service.updateSite({
                siteId: created.siteId,
                description: 'New description',
            });

            assert.ok(updated);
            assert.strictEqual(updated.description, 'New description');
            assert.strictEqual(updated.siteName, 'My Site'); // 変更されていない
        });

        it('updatedAt が更新されること', async () => {
            const created = await service.createSite({ siteName: 'Time Test' });
            const originalUpdatedAt = created.updatedAt;

            // 1ms 待機してタイムスタンプが変わるようにする
            await new Promise(resolve => setTimeout(resolve, 2));

            const updated = await service.updateSite({
                siteId: created.siteId,
                siteName: 'Time Test Updated',
            });

            assert.ok(updated);
            assert.ok(updated.updatedAt >= originalUpdatedAt);
        });

        it('存在しない siteId の更新は null を返すこと', async () => {
            const result = await service.updateSite({
                siteId: 'nonexistent',
                siteName: 'Ghost',
            });

            assert.strictEqual(result, null);
        });

        it('isDefault フラグは更新されないこと', async () => {
            await service.ensureDefaultSite();

            const updated = await service.updateSite({
                siteId: DEFAULT_SITE_ID,
                siteName: 'Renamed Default',
            });

            assert.ok(updated);
            assert.strictEqual(updated.isDefault, true); // isDefault は変わらない
        });

        it('color を指定して更新できること', async () => {
            const created = await service.createSite({ siteName: 'Colorful Site' });

            const updated = await service.updateSite({
                siteId: created.siteId,
                color: '#ff3300',
            });

            assert.ok(updated);
            assert.strictEqual(updated.color, '#ff3300');
            assert.strictEqual(updated.siteName, 'Colorful Site'); // 他フィールドは変わらない
        });

        it('color を指定しない場合は既存の color が維持されること', async () => {
            const created = await service.createSite({ siteName: 'Color Keep' });
            await service.updateSite({ siteId: created.siteId, color: '#aabbcc' });

            // color を指定せずに siteName だけ更新
            const updated = await service.updateSite({
                siteId: created.siteId,
                siteName: 'Color Keep Updated',
            });

            assert.ok(updated);
            assert.strictEqual(updated.color, '#aabbcc'); // 既存の color が維持されること
        });
    });

    // ========================================
    // deleteSite
    // ========================================

    describe('deleteSite', () => {
        it('作成した Site を削除できること', async () => {
            const created = await service.createSite({ siteName: 'Delete Me' });

            const result = await service.deleteSite({ siteId: created.siteId });

            assert.strictEqual(result, true);

            const fetched = await service.getSite({ siteId: created.siteId });
            assert.strictEqual(fetched, null);
        });

        it('削除後に getAllSites に含まれないこと', async () => {
            const created = await service.createSite({ siteName: 'Vanish' });

            await service.deleteSite({ siteId: created.siteId });

            const all = await service.getAllSites();
            assert.ok(!all.some(s => s.siteId === created.siteId));
        });

        it('存在しない siteId の削除は false を返すこと', async () => {
            const result = await service.deleteSite({ siteId: 'nonexistent' });
            assert.strictEqual(result, false);
        });

        it('デフォルト Site は削除できないこと', async () => {
            await service.ensureDefaultSite();

            await assert.rejects(
                async () => await service.deleteSite({ siteId: DEFAULT_SITE_ID }),
                { message: 'Cannot delete the default site' }
            );

            // デフォルト Site はまだ存在する
            const site = await service.getSite({ siteId: DEFAULT_SITE_ID });
            assert.ok(site);
        });
    });

    // ========================================
    // getSite
    // ========================================

    describe('getSite', () => {
        it('存在する Site を取得できること', async () => {
            const created = await service.createSite({ siteName: 'Get Me' });

            const fetched = await service.getSite({ siteId: created.siteId });

            assert.ok(fetched);
            assert.strictEqual(fetched.siteId, created.siteId);
            assert.strictEqual(fetched.siteName, 'Get Me');
        });

        it('存在しない siteId は null を返すこと', async () => {
            const result = await service.getSite({ siteId: 'nonexistent' });
            assert.strictEqual(result, null);
        });
    });

    // ========================================
    // getAllSites
    // ========================================

    describe('getAllSites', () => {
        it('Site が存在しない場合は空配列を返すこと', async () => {
            const all = await service.getAllSites();
            assert.deepStrictEqual(all, []);
        });

        it('作成した全 Site を取得できること', async () => {
            await service.createSite({ siteName: 'Site 1' });
            await service.createSite({ siteName: 'Site 2' });

            const all = await service.getAllSites();

            assert.strictEqual(all.length, 2);
        });

        it('デフォルト Site が先頭に来ること', async () => {
            await service.createSite({ siteName: 'Non-default A' });
            await service.ensureDefaultSite();
            await service.createSite({ siteName: 'Non-default B' });

            const all = await service.getAllSites();

            assert.strictEqual(all[0].siteId, DEFAULT_SITE_ID);
        });
    });

    // ========================================
    // getDisplayWindowIds
    // ========================================

    describe('getDisplayWindowIds', () => {
        it('登録されていない Site は空配列を返すこと', async () => {
            const ids = await service.getDisplayWindowIds('site_empty');
            assert.deepStrictEqual(ids, []);
        });

        it('Redis の SITE.DISPLAY_WINDOW_LIST に手動で追加したIDを取得できること', async () => {
            const created = await service.createSite({ siteName: 'Window Test' });

            // Redis に直接 windowId を追加
            await redis.sadd(REDIS_KEYS.SITE.DISPLAY_WINDOW_LIST(created.siteId), 'window_001', 'window_002');

            const ids = await service.getDisplayWindowIds(created.siteId);

            assert.strictEqual(ids.length, 2);
            assert.ok(ids.includes('window_001'));
            assert.ok(ids.includes('window_002'));
        });
    });

    // ========================================
    // DisplaySpace
    // ========================================

    describe('DisplaySpace', () => {
        describe('getDisplaySpace', () => {
            it('デフォルト値を返すこと', async () => {
                const displaySpace = await service.getDisplaySpace('site-new');

                assert.strictEqual(displaySpace.virtualWidth, 3840);
                assert.strictEqual(displaySpace.virtualHeight, 2160);
                assert.strictEqual(displaySpace.splitX, 1);
                assert.strictEqual(displaySpace.splitY, 1);
                assert.strictEqual(displaySpace.scale, 1.0);
                assert.strictEqual(displaySpace.type, 'display_space');
                assert.strictEqual(displaySpace.siteId, 'site-new');
            });

            it('保存したデータを取得できること', async () => {
                await service.updateDisplaySpace('site-get', {
                    virtualWidth: 1920,
                    virtualHeight: 1080,
                });

                const displaySpace = await service.getDisplaySpace('site-get');

                assert.strictEqual(displaySpace.virtualWidth, 1920);
                assert.strictEqual(displaySpace.virtualHeight, 1080);
            });
        });

        describe('updateDisplaySpace', () => {
            it('幅と高さを更新できること', async () => {
                const updated = await service.updateDisplaySpace('site-upd', {
                    virtualWidth: 1920,
                    virtualHeight: 1080,
                });

                assert.strictEqual(updated.virtualWidth, 1920);
                assert.strictEqual(updated.virtualHeight, 1080);
                assert.strictEqual(updated.splitX, 1); // デフォルト値が保持される
                assert.strictEqual(updated.splitY, 1);
            });

            it('分割設定を更新できること', async () => {
                const updated = await service.updateDisplaySpace('site-split', {
                    splitX: 2,
                    splitY: 3,
                });

                assert.strictEqual(updated.splitX, 2);
                assert.strictEqual(updated.splitY, 3);
            });

            it('スケールを更新できること', async () => {
                const updated = await service.updateDisplaySpace('site-scale', {
                    scale: 0.5,
                });

                assert.strictEqual(updated.scale, 0.5);
            });

            it('siteId が結果に含まれること', async () => {
                const updated = await service.updateDisplaySpace('site-id-check', {
                    virtualWidth: 7680,
                    virtualHeight: 4320,
                });

                assert.strictEqual(updated.virtualWidth, 7680);
                assert.strictEqual(updated.siteId, 'site-id-check');
            });
        });

        describe('ensureDisplaySpace', () => {
            it('未保存の場合はデフォルト値で初期化して Redis に保存されること', async () => {
                const result = await service.ensureDisplaySpace('site-ensure-new');

                assert.strictEqual(result.virtualWidth, 3840);
                assert.strictEqual(result.siteId, 'site-ensure-new');

                // 別インスタンスで取得しても取れること
                const newService = new SiteService(redis);
                const fetched = await newService.getDisplaySpace('site-ensure-new');
                assert.strictEqual(fetched.virtualWidth, 3840);
            });

            it('既に保存済みの場合は既存値を返し上書きしないこと', async () => {
                await service.updateDisplaySpace('site-ensure-exist', { virtualWidth: 1920, virtualHeight: 1080 });

                const result = await service.ensureDisplaySpace('site-ensure-exist');

                assert.strictEqual(result.virtualWidth, 1920);
                assert.strictEqual(result.virtualHeight, 1080);
            });

            it('2回呼んでも冪等であること', async () => {
                const first = await service.ensureDisplaySpace('site-ensure-idem');
                const second = await service.ensureDisplaySpace('site-ensure-idem');

                assert.deepStrictEqual(first, second);
            });
        });

        describe('initializeDisplaySpace', () => {
            it('デフォルト値に初期化できること', async () => {
                await service.updateDisplaySpace('site-init', {
                    virtualWidth: 1920,
                    virtualHeight: 1080,
                    splitX: 2,
                });

                const initialized = await service.initializeDisplaySpace('site-init');

                assert.strictEqual(initialized.virtualWidth, 3840);
                assert.strictEqual(initialized.virtualHeight, 2160);
                assert.strictEqual(initialized.splitX, 1);
            });

            it('siteId が含まれること', async () => {
                const initialized = await service.initializeDisplaySpace('site-init-id');

                assert.strictEqual(initialized.siteId, 'site-init-id');
                assert.strictEqual(initialized.virtualWidth, 3840);
            });
        });

        describe('persistence', () => {
            it('サービスインスタンス間でデータが永続化されること', async () => {
                await service.updateDisplaySpace('site-persist', {
                    virtualWidth: 2048,
                    virtualHeight: 1536,
                });

                const newService = new SiteService(redis);
                const displaySpace = await newService.getDisplaySpace('site-persist');

                assert.strictEqual(displaySpace.virtualWidth, 2048);
                assert.strictEqual(displaySpace.virtualHeight, 1536);
            });
        });

        describe('getSite が displaySpace を含むこと', () => {
            it('ensureDefaultSite の結果に displaySpace が含まれること', async () => {
                const site = await service.ensureDefaultSite();

                assert.ok(site.displaySpace);
                assert.strictEqual(site.displaySpace.type, 'display_space');
                assert.strictEqual(site.displaySpace.virtualWidth, 3840);
            });

            it('createSite の結果に displaySpace が含まれること', async () => {
                const site = await service.createSite({ siteName: 'DS Site' });

                assert.ok(site.displaySpace);
                assert.strictEqual(site.displaySpace.type, 'display_space');
                assert.strictEqual(site.displaySpace.virtualWidth, 3840);
                assert.strictEqual(site.displaySpace.siteId, site.siteId);
            });

            it('getSite の結果に displaySpace が含まれること', async () => {
                const created = await service.createSite({ siteName: 'DS Site 2' });

                const fetched = await service.getSite({ siteId: created.siteId });

                assert.ok(fetched);
                assert.ok(fetched.displaySpace);
                assert.strictEqual(fetched.displaySpace.siteId, created.siteId);
            });

            it('getAllSites の各 site に displaySpace が含まれること', async () => {
                await service.createSite({ siteName: 'DS Site A' });
                await service.createSite({ siteName: 'DS Site B' });

                const all = await service.getAllSites();

                for (const site of all) {
                    assert.ok(site.displaySpace, `${site.siteName} に displaySpace がない`);
                    assert.strictEqual(site.displaySpace.type, 'display_space');
                }
            });
        });
    });
});
