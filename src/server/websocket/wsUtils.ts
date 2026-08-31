/**
 * WebSocket関連のユーティリティ関数
 */

import { randomBytes } from 'crypto';

/**
 * UUID8を生成（8文字の16進数列）
 * 暗号安全な乱数生成器（CSPRNG）を使用する。
 */
export function generateUUID8(): string {
    return randomBytes(4).toString('hex');
}
