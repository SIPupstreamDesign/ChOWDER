/**
 * DisplaySessionService - ディスプレイセッション管理
 */

import { Redis } from 'ioredis';
import { REDIS_KEYS } from '../common/redisKeys';

export interface DisplaySession {
    displayId: string;
    displayName: string;  // ユーザー指定の表示名（日本語可）
    socketId: string;
    status: 'pending' | 'approved';
    isOnline: boolean;
    screenWidth: number;  // 接続されたディスプレイの実際の解像度（ピクセル）
    screenHeight: number; // 接続されたディスプレイの実際の解像度（ピクセル）
    connectedAt: string;
    approvedAt?: string;
    windowId?: string;  // 承認時に作成されたWindowMetaDataへの参照
}

export class DisplaySessionService {
    private redisClient: Redis;

    // アクティブ接続をメモリで管理（socketId → displayId）
    private activeConnections: Map<string, string> = new Map();

    constructor(redisClient: Redis) {
        this.redisClient = redisClient;
    }

    /**
     * ディスプレイ表示名をバリデーション
     * @throws Error バリデーションエラー
     */
    private validateDisplayName(displayName: string): void {
        if (!displayName || displayName.trim().length === 0) {
            throw new Error('Display name cannot be empty');
        }

        if (displayName.length > 50) {
            throw new Error('Display name is too long (max 50 characters)');
        }

        // Redisキーに使えない文字をチェック（コロン、アスタリスク、改行など）
        const invalidChars = /[\r\n\t:*]/;
        if (invalidChars.test(displayName)) {
            throw new Error('Display name contains invalid characters');
        }
    }

    /**
     * ユニークなディスプレイ表示名を解決
     * 既存のオンラインディスプレイと重複する場合はsuffixを付与
     */
    private async resolveUniqueDisplayName(requestedName: string): Promise<{ displayName: string; displayId: string | null }> {
        // まず要求された名前をチェック
        const existingId = await this.redisClient.get(REDIS_KEYS.DISPLAY.NAME_TO_ID(requestedName));

        if (!existingId) {
            // マッピングがない = 新規の名前
            return { displayName: requestedName, displayId: null };
        }

        // 既存セッションを確認
        const existingSession = await this.getDisplaySession(existingId);
        if (existingSession && !existingSession.isOnline) {
            // オフラインなら再接続として使用可能
            return { displayName: requestedName, displayId: existingId };
        }

        // オンラインの場合はsuffix付与
        let suffix = 2;
        let candidateName = `${requestedName}_${suffix}`;

        while (true) {
            const candidateId = await this.redisClient.get(REDIS_KEYS.DISPLAY.NAME_TO_ID(candidateName));

            if (!candidateId) {
                // この名前は使用可能
                return { displayName: candidateName, displayId: null };
            }

            const candidateSession = await this.getDisplaySession(candidateId);
            if (candidateSession && !candidateSession.isOnline) {
                // オフラインなら使用可能（再接続）
                return { displayName: candidateName, displayId: candidateId };
            }

            // 次のsuffixを試す
            suffix++;
            candidateName = `${requestedName}_${suffix}`;

            // 無限ループ防止（通常はありえない）
            if (suffix > 1000) {
                throw new Error('Cannot resolve unique display name');
            }
        }
    }

    /**
     * ディスプレイを登録（承認情報があれば復元）
     */
    async registerDisplay(displayName: string, socketId: string, screenWidth: number, screenHeight: number): Promise<DisplaySession> {
        // バリデーション
        this.validateDisplayName(displayName);

        // ユニークな表示名を解決
        const { displayName: resolvedName, displayId: existingId } = await this.resolveUniqueDisplayName(displayName);

        let displayId: string;
        let existing: DisplaySession | null = null;

        if (existingId) {
            // 既存セッションを復元
            displayId = existingId;
            existing = await this.getDisplaySession(displayId);
        } else {
            // 新しいdisplayIDを生成
            displayId = 'display_' + Math.random().toString(36).substr(2, 9);
        }

        const session: DisplaySession = {
            displayId,
            displayName: resolvedName,
            socketId,
            isOnline: true,
            screenWidth,
            screenHeight,
            connectedAt: new Date().toISOString(),
            status: existing?.status || 'pending',
            windowId: existing?.windowId,
            approvedAt: existing?.approvedAt,
        };

        // セッション情報を永続化
        await this.redisClient.set(
            REDIS_KEYS.DISPLAY.SESSION(displayId),
            JSON.stringify(session)
        );

        // 表示名→IDマッピングを保存
        await this.redisClient.set(
            REDIS_KEYS.DISPLAY.NAME_TO_ID(resolvedName),
            displayId
        );

        // アクティブ接続をメモリに記録（socketId → displayId のマッピング）
        this.activeConnections.set(socketId, displayId);

        return session;
    }

    /**
     * ディスプレイを承認（windowIdを記録）
     */
    async approveDisplay(displayId: string, windowId: string): Promise<DisplaySession | null> {
        const session = await this.getDisplaySession(displayId);
        if (!session) return null;

        session.status = 'approved';
        session.windowId = windowId;
        session.approvedAt = new Date().toISOString();

        await this.redisClient.set(
            REDIS_KEYS.DISPLAY.SESSION(displayId),
            JSON.stringify(session)
        );

        return session;
    }

    /**
     * ディスプレイを拒否（セッションを削除）
     */
    async rejectDisplay(displayId: string): Promise<boolean> {
        return this.deleteDisplaySession(displayId);
    }

    /**
     * 表示名の変更
     */
     async changeDisplayName(displayId: string, displayName: string): Promise<DisplaySession | null> {
        const session = await this.getDisplaySession(displayId);
        if (!session) return null;
        session.displayName = displayName;

        await this.redisClient.set(
            REDIS_KEYS.DISPLAY.SESSION(displayId),
            JSON.stringify(session)
        );
        return session;
    }
    /**
     * ディスプレイセッション取得
     */
    async getDisplaySession(displayId: string): Promise<DisplaySession | null> {
        const data = await this.redisClient.get(REDIS_KEYS.DISPLAY.SESSION(displayId));
        if (!data) return null;
        return JSON.parse(data) as DisplaySession;
    }

    /**
     * socketIdからディスプレイセッション取得
     */
    async getDisplaySessionBySocketId(socketId: string): Promise<DisplaySession | null> {
        const displayId = this.activeConnections.get(socketId);
        if (!displayId) return null;
        return this.getDisplaySession(displayId);
    }

    /**
     * 全ディスプレイセッション取得
     */
    async getAllDisplaySessions(): Promise<DisplaySession[]> {
        const keys = await this.redisClient.keys(REDIS_KEYS.DISPLAY.SESSION('*'));
        const sessions: DisplaySession[] = [];

        for (const key of keys) {
            const data = await this.redisClient.get(key);
            if (data) {
                sessions.push(JSON.parse(data) as DisplaySession);
            }
        }

        return sessions;
    }

    /**
     * 未承認ディスプレイ一覧取得
     */
    async getPendingDisplays(): Promise<DisplaySession[]> {
        const allSessions = await this.getAllDisplaySessions();
        return allSessions.filter(s => s.status === 'pending');
    }

    /**
     * 承認済みディスプレイ一覧取得（approvedAt 昇順）
     */
    async getApprovedDisplays(): Promise<DisplaySession[]> {
        const allSessions = await this.getAllDisplaySessions();
        return allSessions
            .filter(s => s.status === 'approved')
            .sort((a, b) => {
                if (!a.approvedAt && !b.approvedAt) return 0;
                if (!a.approvedAt) return 1;
                if (!b.approvedAt) return -1;
                return a.approvedAt < b.approvedAt ? -1 : a.approvedAt > b.approvedAt ? 1 : 0;
            });
    }

    /**
     * ディスプレイセッション削除（承認情報も削除）
     */
    async deleteDisplaySession(displayId: string): Promise<boolean> {
        const session = await this.getDisplaySession(displayId);
        if (!session) return false;

        // アクティブ接続をメモリから削除
        this.activeConnections.delete(session.socketId);

        // 表示名→IDマッピングを削除
        await this.redisClient.del(REDIS_KEYS.DISPLAY.NAME_TO_ID(session.displayName));

        // セッションを削除
        await this.redisClient.del(REDIS_KEYS.DISPLAY.SESSION(displayId));

        return true;
    }

    /**
     * サーバー起動時にすべてのオンライン状態をリセット
     * （サーバー再起動時に残留するisOnline:trueを解消する）
     */
    async resetAllOnlineStatus(): Promise<number> {
        const sessions = await this.getAllDisplaySessions();
        let count = 0;

        for (const session of sessions) {
            if (session.isOnline) {
                session.isOnline = false;
                session.socketId = '';
                await this.redisClient.set(
                    REDIS_KEYS.DISPLAY.SESSION(session.displayId),
                    JSON.stringify(session)
                );
                count++;
            }
        }

        if (count > 0) {
            console.log(`[DisplaySessionService] Reset ${count} online display(s) to offline on startup`);
        }

        return count;
    }

    /**
     * socketId切断時の処理（オンライン状態を解除、承認情報は保持）
     */
    async onSocketDisconnect(socketId: string): Promise<string | null> {
        // メモリからdisplayIdを取得
        const displayId = this.activeConnections.get(socketId);

        if (displayId) {
            // セッション情報を取得して isOnline を false に更新
            const session = await this.getDisplaySession(displayId);
            if (session) {
                session.isOnline = false;
                session.socketId = ''; // socketId をクリア
                await this.redisClient.set(
                    REDIS_KEYS.DISPLAY.SESSION(displayId),
                    JSON.stringify(session)
                );
            }

            // アクティブ接続をメモリから削除
            this.activeConnections.delete(socketId);

            return displayId;
        }

        return null;
    }
}
