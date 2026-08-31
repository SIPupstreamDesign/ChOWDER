/**
 * 認証サービス
 * ユーザー作成、パスワード検証、初期ユーザー作成を担当
 */

import bcrypt from 'bcrypt';
import { Redis } from 'ioredis';
import { REDIS_KEYS, REDIS_PATTERNS } from '../common/redisKeys';

const SALT_ROUNDS = process.env.NODE_ENV === 'test' ? 1 : 10;

export const UserRole = {
    ADMIN: 'admin',
    MEMBER: 'member',
    DISPLAY: 'display',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface UserData {
    password: string;
    role: UserRole;
    createdAt: string;
}

export class AuthService {
    private redis: Redis;

    constructor(redis: Redis) {
        this.redis = redis;
    }

    /**
     * パスワードをハッシュ化
     */
    async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, SALT_ROUNDS);
    }

    /**
     * パスワードを検証
     */
    async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(password, hashedPassword);
    }

    /**
     * ユーザーを作成
     */
    async createUser(userId: string, password: string, role: UserRole): Promise<boolean> {
        const userKey = REDIS_KEYS.AUTH.USER(userId);

        // ユーザーが既に存在するかチェック
        const exists = await this.redis.exists(userKey);
        if (exists) {
            return false;
        }

        // パスワードをハッシュ化
        const hashedPassword = await this.hashPassword(password);

        // Redisに保存
        const userData: UserData = {
            password: hashedPassword,
            role: role,
            createdAt: new Date().toISOString()
        };

        await this.redis.hset(userKey, userData as any);
        return true;
    }

    /**
     * ユーザー情報を取得
     */
    async getUser(userId: string): Promise<UserData | null> {
        const userKey = REDIS_KEYS.AUTH.USER(userId);
        const userData = await this.redis.hgetall(userKey);

        if (!userData || !userData.password) {
            return null;
        }

        return {
            password: userData.password,
            role: userData.role as UserRole,
            createdAt: userData.createdAt
        };
    }

    /**
     * ログイン認証
     */
    async authenticate(userId: string, password: string): Promise<{ success: boolean; role?: UserRole }> {
        const user = await this.getUser(userId);

        if (!user) {
            return { success: false };
        }

        const isValid = await this.verifyPassword(password, user.password);

        if (!isValid) {
            return { success: false };
        }

        return { success: true, role: user.role as UserRole };
    }

    /**
     * 全ユーザー一覧を取得
     */
    async getAllUsers(): Promise<{ userId: string; role: string; createdAt: string }[]> {
        const keys = await this.redis.keys(REDIS_PATTERNS.ALL_USERS);
        const users: { userId: string; role: string; createdAt: string }[] = [];

        for (const key of keys) {
            const userData = await this.redis.hgetall(key);
            if (userData && userData.role) {
                const userId = key.replace('auth:user:', '');
                users.push({ userId, role: userData.role, createdAt: userData.createdAt || '' });
            }
        }

        return users.sort((a, b) => a.userId.localeCompare(b.userId));
    }

    /**
     * ユーザーを削除
     */
    async deleteUser(userId: string): Promise<boolean> {
        const userKey = REDIS_KEYS.AUTH.USER(userId);
        const exists = await this.redis.exists(userKey);
        if (!exists) return false;
        await this.redis.del(userKey);
        return true;
    }

    /**
     * パスワードを変更
     */
    async changePassword(userId: string, newPassword: string): Promise<boolean> {
        const userKey = REDIS_KEYS.AUTH.USER(userId);
        const exists = await this.redis.exists(userKey);
        if (!exists) return false;
        const hashedPassword = await this.hashPassword(newPassword);
        await this.redis.hset(userKey, 'password', hashedPassword);
        return true;
    }

    /**
     * 自身のパスワードを変更（旧パスワード検証あり）
     */
    async changeOwnPassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
        const user = await this.getUser(userId);
        if (!user) return false;
        const isValid = await this.verifyPassword(oldPassword, user.password);
        if (!isValid) return false;
        const hashedPassword = await this.hashPassword(newPassword);
        await this.redis.hset(REDIS_KEYS.AUTH.USER(userId), 'password', hashedPassword);
        return true;
    }

    /**
     * 初期adminユーザーを作成
     */
    async initializeDefaultUser(): Promise<void> {
        const initialized = await this.redis.get(REDIS_KEYS.AUTH.BOOTSTRAP_INITIALIZED);
        if (initialized === '1') {
            console.log('[AuthService] Auth bootstrap is already initialized');
            return;
        }

        const existingUserKeys = await this.redis.keys(REDIS_PATTERNS.ALL_USERS);
        if (existingUserKeys.length > 0) {
            await this.markBootstrapInitialized();
            console.log('[AuthService] Existing users detected. Skipping default bootstrap user creation and marking bootstrap as initialized');
            return;
        }

        console.log('[AuthService] Creating bootstrap admin user (id/password: ChOWDERAdministrator)');

        await this.createUser('ChOWDERAdministrator', 'ChOWDERAdministrator', UserRole.ADMIN);
        await this.markBootstrapInitialized();

        console.log('[AuthService] Bootstrap users created successfully');
    }

    /**
     * 初期ブートストラップの完了状態を取得
     */
    async isBootstrapInitialized(): Promise<boolean> {
        const initialized = await this.redis.get(REDIS_KEYS.AUTH.BOOTSTRAP_INITIALIZED);
        return initialized === '1';
    }

    /**
     * 初期ブートストラップ完了フラグを保存
     */
    private async markBootstrapInitialized(): Promise<void> {
        await this.redis.set(REDIS_KEYS.AUTH.BOOTSTRAP_INITIALIZED, '1');
    }
}
