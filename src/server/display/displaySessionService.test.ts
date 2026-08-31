import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { DisplaySessionService } from './displaySessionService';
import { createTestRedis, cleanupTestRedis } from '../tests/setup';

describe('DisplaySessionService', () => {
    let redis: Redis;
    let service: DisplaySessionService;

    beforeEach(() => {
        redis = createTestRedis();
        service = new DisplaySessionService(redis);
    });

    afterEach(async () => {
        await cleanupTestRedis(redis);
    });

    describe('registerDisplay', () => {
        it('新しいディスプレイを登録できること', async () => {
            const displayName = '会議室A';
            const socketId = 'socket_123';
            const session = await service.registerDisplay(displayName, socketId, 1920, 1080);

            assert.ok(session.displayId);
            assert.strictEqual(session.displayName, displayName);
            assert.strictEqual(session.socketId, socketId);
            assert.strictEqual(session.status, 'pending');
            assert.strictEqual(session.isOnline, true);
            assert.strictEqual(session.screenWidth, 1920);
            assert.strictEqual(session.screenHeight, 1080);
        });

        it('既存の承認情報があれば復元されること', async () => {
            const displayName = '会議室B';
            const socketId1 = 'socket_456';
            const socketId2 = 'socket_789';

            // 最初の登録と承認
            const firstSession = await service.registerDisplay(displayName, socketId1, 1920, 1080);
            await service.approveDisplay(firstSession.displayId, 'window_test');

            // 切断してから再接続
            await service.onSocketDisconnect(socketId1);
            const reconnectedSession = await service.registerDisplay(displayName, socketId2, 1920, 1080);

            assert.strictEqual(reconnectedSession.displayId, firstSession.displayId);
            assert.strictEqual(reconnectedSession.displayName, displayName);
            assert.strictEqual(reconnectedSession.status, 'approved');
            assert.strictEqual(reconnectedSession.windowId, 'window_test');
            assert.strictEqual(reconnectedSession.isOnline, true);
        });

        it('同じ名前のオンラインディスプレイがある場合はsuffixが付与されること', async () => {
            const displayName = '会議室C';

            const session1 = await service.registerDisplay(displayName, 'socket_1', 1920, 1080);
            const session2 = await service.registerDisplay(displayName, 'socket_2', 1920, 1080);

            assert.strictEqual(session1.displayName, displayName);
            assert.strictEqual(session2.displayName, `${displayName}_2`);
            assert.notStrictEqual(session1.displayId, session2.displayId);
        });

        it('空の表示名はエラーになること', async () => {
            await assert.rejects(
                async () => await service.registerDisplay('', 'socket_xxx', 1920, 1080),
                { message: 'Display name cannot be empty' }
            );
        });

        it('無効な文字を含む表示名はエラーになること', async () => {
            await assert.rejects(
                async () => await service.registerDisplay('会議室:A', 'socket_xxx', 1920, 1080),
                { message: 'Display name contains invalid characters' }
            );
        });
    });

    describe('approveDisplay', () => {
        it('ディスプレイを承認できること', async () => {
            const session = await service.registerDisplay('会議室D', 'socket_111', 1920, 1080);

            const approved = await service.approveDisplay(session.displayId, 'window_123');

            assert.ok(approved);
            assert.strictEqual(approved.status, 'approved');
            assert.strictEqual(approved.windowId, 'window_123');
            assert.ok(approved.approvedAt);
        });

        it('存在しないディスプレイの承認はnullを返すこと', async () => {
            const result = await service.approveDisplay('nonexistent', 'window_123');
            assert.strictEqual(result, null);
        });
    });

    describe('getDisplaySession', () => {
        it('登録済みディスプレイのセッションを取得できること', async () => {
            const displayName = '会議室E';
            const session = await service.registerDisplay(displayName, 'socket_222', 1920, 1080);

            const retrieved = await service.getDisplaySession(session.displayId);

            assert.ok(retrieved);
            assert.strictEqual(retrieved.displayId, session.displayId);
            assert.strictEqual(retrieved.displayName, displayName);
        });

        it('存在しないディスプレイはnullを返すこと', async () => {
            const session = await service.getDisplaySession('nonexistent');
            assert.strictEqual(session, null);
        });
    });

    describe('getPendingDisplays / getApprovedDisplays', () => {
        it('pending/approvedのディスプレイを取得できること', async () => {
            const pending1 = await service.registerDisplay('会議室F', 'socket_a', 1920, 1080);
            const pending2 = await service.registerDisplay('会議室G', 'socket_b', 1920, 1080);
            const approved1 = await service.registerDisplay('会議室H', 'socket_c', 1920, 1080);
            await service.approveDisplay(approved1.displayId, 'window_1');

            const pending = await service.getPendingDisplays();
            const approved = await service.getApprovedDisplays();

            assert.strictEqual(pending.length, 2);
            assert.strictEqual(approved.length, 1);
            assert.strictEqual(approved[0].displayId, approved1.displayId);
            assert.strictEqual(approved[0].displayName, '会議室H');
        });

        it('getApprovedDisplays は approvedAt 昇順で返すこと', async () => {
            const d1 = await service.registerDisplay('表示室1', 'socket_sort_a', 1920, 1080);
            const d2 = await service.registerDisplay('表示室2', 'socket_sort_b', 1920, 1080);
            const d3 = await service.registerDisplay('表示室3', 'socket_sort_c', 1920, 1080);

            // 承認順: d2 → d3 → d1 の順に承認（各 11ms 間隔）
            await service.approveDisplay(d2.displayId, 'window_sort_2');
            await new Promise(r => setTimeout(r, 11));
            await service.approveDisplay(d3.displayId, 'window_sort_3');
            await new Promise(r => setTimeout(r, 11));
            await service.approveDisplay(d1.displayId, 'window_sort_1');

            const approved = await service.getApprovedDisplays();

            assert.strictEqual(approved.length, 3);
            assert.strictEqual(approved[0].displayId, d2.displayId, '最初に承認されたものが先頭');
            assert.strictEqual(approved[1].displayId, d3.displayId, '2番目に承認されたものが中間');
            assert.strictEqual(approved[2].displayId, d1.displayId, '最後に承認されたものが末尾');
        });

        it('approvedAt が未設定のレコードは末尾になること', async () => {
            const d1 = await service.registerDisplay('表示室A', 'socket_nodate_a', 1920, 1080);
            const d2 = await service.registerDisplay('表示室B', 'socket_nodate_b', 1920, 1080);

            await service.approveDisplay(d1.displayId, 'window_nodate_1');

            // d2 を approvedAt なしで強制的に approved にする（レガシーデータ模倣）
            const session2 = await service.getDisplaySession(d2.displayId);
            assert.ok(session2);
            session2.status = 'approved';
            delete (session2 as any).approvedAt;
            const { REDIS_KEYS } = await import('../common/redisKeys.js');
            await redis.set(REDIS_KEYS.DISPLAY.SESSION(d2.displayId), JSON.stringify(session2));

            const approved = await service.getApprovedDisplays();

            assert.strictEqual(approved.length, 2);
            assert.strictEqual(approved[0].displayId, d1.displayId, 'approvedAt あり が先頭');
            assert.strictEqual(approved[1].displayId, d2.displayId, 'approvedAt なし が末尾');
        });
    });

    describe('deleteDisplaySession', () => {
        it('ディスプレイセッションを削除できること', async () => {
            const session = await service.registerDisplay('会議室I', 'socket_333', 1920, 1080);

            const deleted = await service.deleteDisplaySession(session.displayId);
            assert.strictEqual(deleted, true);

            const retrieved = await service.getDisplaySession(session.displayId);
            assert.strictEqual(retrieved, null);
        });

        it('存在しないディスプレイの削除はfalseを返すこと', async () => {
            const deleted = await service.deleteDisplaySession('nonexistent');
            assert.strictEqual(deleted, false);
        });
    });

    describe('onSocketDisconnect', () => {
        it('切断時にオンライン状態を解除すること', async () => {
            const socketId = 'socket_444';
            const session = await service.registerDisplay('会議室J', socketId, 1920, 1080);

            const disconnectedId = await service.onSocketDisconnect(socketId);
            assert.strictEqual(disconnectedId, session.displayId);

            const retrieved = await service.getDisplaySession(session.displayId);
            assert.ok(retrieved);
            assert.strictEqual(retrieved.isOnline, false);
            assert.strictEqual(retrieved.socketId, '');
        });

        it('切断しても承認情報は保持されること', async () => {
            const socketId = 'socket_555';
            const session = await service.registerDisplay('会議室K', socketId, 1920, 1080);
            await service.approveDisplay(session.displayId, 'window_7');

            await service.onSocketDisconnect(socketId);

            const retrieved = await service.getDisplaySession(session.displayId);
            assert.ok(retrieved);
            assert.strictEqual(retrieved.status, 'approved');
            assert.strictEqual(retrieved.windowId, 'window_7');
        });
    });

    // ========================================
    // rejectDisplay
    // ========================================

    describe('rejectDisplay', () => {
        it('ディスプレイを拒否するとセッションが削除されること', async () => {
            const session = await service.registerDisplay('会議室L', 'socket_600', 1920, 1080);

            const result = await service.rejectDisplay(session.displayId);
            assert.strictEqual(result, true);

            const retrieved = await service.getDisplaySession(session.displayId);
            assert.strictEqual(retrieved, null);
        });

        it('存在しないディスプレイの拒否は false を返すこと', async () => {
            const result = await service.rejectDisplay('nonexistent');
            assert.strictEqual(result, false);
        });
    });

    // ========================================
    // changeDisplayName
    // ========================================

    describe('changeDisplayName', () => {
        it('ディスプレイ表示名を変更できること', async () => {
            const session = await service.registerDisplay('旧名前', 'socket_700', 1920, 1080);

            const updated = await service.changeDisplayName(session.displayId, '新名前');

            assert.ok(updated);
            assert.strictEqual(updated.displayName, '新名前');
            assert.strictEqual(updated.displayId, session.displayId);
        });

        it('変更後も他のフィールドは保持されること', async () => {
            const session = await service.registerDisplay('元の名前', 'socket_701', 1280, 720);
            await service.approveDisplay(session.displayId, 'window_rename');

            const updated = await service.changeDisplayName(session.displayId, '変更後');

            assert.ok(updated);
            assert.strictEqual(updated.status, 'approved');
            assert.strictEqual(updated.windowId, 'window_rename');
            assert.strictEqual(updated.screenWidth, 1280);
        });

        it('存在しない displayId は null を返すこと', async () => {
            const result = await service.changeDisplayName('nonexistent', '新名前');
            assert.strictEqual(result, null);
        });
    });

    // ========================================
    // getDisplaySessionBySocketId
    // ========================================

    describe('getDisplaySessionBySocketId', () => {
        it('socketId からセッションを取得できること', async () => {
            const socketId = 'socket_800';
            const session = await service.registerDisplay('会議室M', socketId, 1920, 1080);

            const retrieved = await service.getDisplaySessionBySocketId(socketId);

            assert.ok(retrieved);
            assert.strictEqual(retrieved.displayId, session.displayId);
            assert.strictEqual(retrieved.socketId, socketId);
        });

        it('未登録の socketId は null を返すこと', async () => {
            const result = await service.getDisplaySessionBySocketId('socket_unknown');
            assert.strictEqual(result, null);
        });

        it('切断後（onSocketDisconnect）は null を返すこと', async () => {
            const socketId = 'socket_801';
            await service.registerDisplay('会議室N', socketId, 1920, 1080);

            await service.onSocketDisconnect(socketId);

            const result = await service.getDisplaySessionBySocketId(socketId);
            assert.strictEqual(result, null);
        });
    });

    // ========================================
    // getAllDisplaySessions
    // ========================================

    describe('getAllDisplaySessions', () => {
        it('登録されたセッションが存在しない場合は空配列を返すこと', async () => {
            const sessions = await service.getAllDisplaySessions();
            assert.deepStrictEqual(sessions, []);
        });

        it('全ディスプレイセッションを取得できること', async () => {
            await service.registerDisplay('会議室O', 'socket_901', 1920, 1080);
            await service.registerDisplay('会議室P', 'socket_902', 1920, 1080);

            const sessions = await service.getAllDisplaySessions();

            assert.strictEqual(sessions.length, 2);
            const names = sessions.map(s => s.displayName).sort();
            assert.deepStrictEqual(names, ['会議室O', '会議室P']);
        });

        it('承認済みと未承認の両方が含まれること', async () => {
            const s1 = await service.registerDisplay('会議室Q', 'socket_903', 1920, 1080);
            const s2 = await service.registerDisplay('会議室R', 'socket_904', 1920, 1080);
            await service.approveDisplay(s2.displayId, 'window_all');

            const sessions = await service.getAllDisplaySessions();

            assert.strictEqual(sessions.length, 2);
            const statuses = sessions.map(s => s.status).sort();
            assert.deepStrictEqual(statuses, ['approved', 'pending']);
        });
    });

    // ========================================
    // resetAllOnlineStatus
    // ========================================

    describe('resetAllOnlineStatus', () => {
        it('オンラインのディスプレイがオフラインにリセットされること', async () => {
            await service.registerDisplay('会議室S', 'socket_a01', 1920, 1080);
            await service.registerDisplay('会議室T', 'socket_a02', 1920, 1080);

            // 両方 isOnline: true の状態でリセット
            const count = await service.resetAllOnlineStatus();

            assert.strictEqual(count, 2);

            const sessions = await service.getAllDisplaySessions();
            for (const s of sessions) {
                assert.strictEqual(s.isOnline, false);
                assert.strictEqual(s.socketId, '');
            }
        });

        it('既にオフラインのセッションはカウントされないこと', async () => {
            const session = await service.registerDisplay('会議室U', 'socket_b01', 1920, 1080);

            // 先に切断しておく
            await service.onSocketDisconnect('socket_b01');

            const count = await service.resetAllOnlineStatus();

            assert.strictEqual(count, 0);
        });

        it('承認情報はリセット後も保持されること', async () => {
            const session = await service.registerDisplay('会議室V', 'socket_c01', 1920, 1080);
            await service.approveDisplay(session.displayId, 'window_reset_test');

            await service.resetAllOnlineStatus();

            const retrieved = await service.getDisplaySession(session.displayId);
            assert.ok(retrieved);
            assert.strictEqual(retrieved.status, 'approved');
            assert.strictEqual(retrieved.windowId, 'window_reset_test');
            assert.strictEqual(retrieved.isOnline, false);
        });

        it('セッションが存在しない場合は 0 を返すこと', async () => {
            const count = await service.resetAllOnlineStatus();
            assert.strictEqual(count, 0);
        });
    });
});
