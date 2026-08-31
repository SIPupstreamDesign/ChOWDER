/**
 * OTP（ワンタイムパスワード）サービス
 * itowns タブを自動ログインで開くためのトークン発行・検証を担当
 */

import crypto from 'crypto';
import { Redis } from 'ioredis';
import { UserRole } from './authService';
import { REDIS_KEYS } from '../common/redisKeys';

/** OTPトークンに紐づけるユーザー情報 */
export interface OtpPayload {
    userId: string;
    role: UserRole;
}

/** OTPの有効期限（秒） */
const OTP_TTL_SECONDS = 60;

export class OtpService {
    private redis: Redis;

    constructor(redis: Redis) {
        this.redis = redis;
    }

    /**
     * OTPトークンを生成してRedisに保存する
     * @param userId  発行元のユーザーID
     * @param role    発行元のロール
     * @returns 64文字のhexトークン（256bit乱数）
     */
    async generateOTP(userId: string, role: UserRole): Promise<string> {
        const token = crypto.randomBytes(32).toString('hex');
        const key = REDIS_KEYS.OTP.TOKEN(token);
        const payload: OtpPayload = { userId, role };

        await this.redis.set(key, JSON.stringify(payload));
        await this.redis.expire(key, OTP_TTL_SECONDS);

        return token;
    }

    /**
     * OTPトークンを検証する（ワンタイム: 検証後即削除）
     * @param token 検証するトークン
     * @returns ペイロード、または無効・期限切れの場合 null
     */
    async consumeOTP(token: string): Promise<OtpPayload | null> {
        if (!token || typeof token !== 'string') {
            return null;
        }
        const key = REDIS_KEYS.OTP.TOKEN(token);
        const raw = await this.redis.get(key);
        if (!raw) {
            return null;
        }

        // 取得後即削除（ワンタイム保証）
        await this.redis.del(key);

        try {
            return JSON.parse(raw) as OtpPayload;
        } catch {
            return null;
        }
    }
}
