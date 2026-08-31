/**
 * セッション管理
 * WebSocketコネクションとログイン状態を紐付け
 * メモリ（Map）で管理
 */

import { UserRole } from './authService';
import { allocateCursorColor } from './cursorColorAllocator';
import type { CursorColorHex } from './cursorColorTypes';

export interface SessionData {
    socketId: string;
    userId: string;
    role: UserRole;
    loginAt: string;
}

export class SessionManager {
    private sessions: Map<string, SessionData> = new Map();
    private cursorColors: Map<string, CursorColorHex> = new Map<string, CursorColorHex>();

    /**
     * 指定ユーザーのセッションに紐づくsocketId一覧を取得
     */
    async getSocketIdsByUserId(userId: string): Promise<string[]> {
        const socketIds: string[] = [];

        for (const [socketId, session] of this.sessions.entries()) {
            if (session.userId === userId) {
                socketIds.push(socketId);
            }
        }

        return socketIds;
    }

    /**
     * セッションを作成
     */
    async createSession(socketId: string, userId: string, role: UserRole): Promise<void> {
        const sessionData: SessionData = {
            socketId: socketId,
            userId: userId,
            role: role,
            loginAt: new Date().toISOString()
        };

        this.sessions.set(socketId, sessionData);
        console.log(`[SessionManager] Session created for user ${userId} (socket: ${socketId})`);
    }

    /**
     * セッション情報を取得
     */
    async getSession(socketId: string): Promise<SessionData | null> {
        return this.sessions.get(socketId) || null;
    }

    /**
     * セッションを削除
     */
    async removeSession(socketId: string): Promise<void> {
        const session = this.sessions.get(socketId);

        if (session) {
            this.sessions.delete(socketId);
            this.removeCursorColor(socketId);
            console.log(`[SessionManager] Session removed for user ${session.userId} (socket: ${socketId})`);
        } else {
            console.log(`[SessionManager] No session found for socket: ${socketId}`);
        }
    }

    /**
     * セッション単位のカーソル色を取得または新規割当
     */
    getOrCreateCursorColor(socketId: string): CursorColorHex {
        const existing = this.cursorColors.get(socketId);
        if (existing !== undefined) {
            return existing;
        }

        const color = allocateCursorColor({
            usedColors: this.getActiveCursorColors(),
        });
        this.cursorColors.set(socketId, color);
        return color;
    }

    /**
     * セッション単位のカーソル色を削除
     */
    removeCursorColor(socketId: string): void {
        this.cursorColors.delete(socketId);
    }

    /**
     * 現在アクティブなカーソル色一覧（重複除外）
     */
    getActiveCursorColors(): string[] {
        return Array.from(new Set(this.cursorColors.values()));
    }

    /**
     * 指定ユーザーの全セッションを削除
     */
    async removeSessionsByUserId(userId: string): Promise<number> {
        const targetSocketIds = await this.getSocketIdsByUserId(userId);

        for (const socketId of targetSocketIds) {
            await this.removeSession(socketId);
        }

        return targetSocketIds.length;
    }

    /**
     * 全てのセッションを取得（ログインユーザーリスト用）
     */
    async getAllSessions(): Promise<SessionData[]> {
        return Array.from(this.sessions.values());
    }

    /**
     * 認証チェック（パスワード認証済みコントローラのみ）
     * Display（UserRole.DISPLAY）は含まない
     */
    async isAuthenticated(socketId: string): Promise<boolean> {
        const session = this.sessions.get(socketId);
        if (!session) return false;

        // Displayセッションは認証済みとみなさない
        return session.role !== UserRole.DISPLAY;
    }

    /**
     * Admin権限チェック
     */
    async isAdmin(socketId: string): Promise<boolean> {
        const session = this.sessions.get(socketId);
        return session?.role === UserRole.ADMIN;
    }
}
