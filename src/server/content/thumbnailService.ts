/**
 * サムネイルサービス
 *
 * - IMAGE / TILEIMAGE: sharpで128px PNGに縮小
 * - その他: クライアントからPNGバイナリを受け取り保存
 * - Redisへの保存・取得・削除
 */

import sharp from 'sharp';
import type { Redis } from 'ioredis';
import { REDIS_KEYS } from '../common/redisKeys';

/** サムネイルの最大辺長（px） */
export const THUMBNAIL_SIZE = 128;

export class ThumbnailService {
    private redis: Redis;

    constructor(redis: Redis) {
        this.redis = redis;
    }

    /**
     * 画像バイナリから128px以下のPNGサムネイルを生成する。
     * 128pxより小さい画像は拡大せずそのまま返す。
     * @param binary 画像バイナリ（PNG / JPEG / WebP 等 sharpが対応する形式）
     * @param _mime MIMEタイプ（現在は未使用、将来の拡張用）
     */
    async generateFromBinary(binary: Buffer, _mime: string): Promise<Buffer> {
        return sharp(binary)
            .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
                fit: 'inside',       // 縦横比を維持
                withoutEnlargement: true,  // 128px以上の画像のみ縮小
            })
            .png()
            .toBuffer();
    }

    /**
     * サムネイルをRedisに保存する。
     */
    async saveThumbnail(metadataId: string, thumbnailPNG: Buffer): Promise<void> {
        await this.redis.set(REDIS_KEYS.CONTENT.THUMBNAIL(metadataId), thumbnailPNG);
    }

    /**
     * Redisからサムネイルを取得する。存在しない場合は null を返す。
     */
    async getThumbnail(metadataId: string): Promise<Buffer | null> {
        return this.redis.getBuffer(REDIS_KEYS.CONTENT.THUMBNAIL(metadataId));
    }

    /**
     * Redisからサムネイルを削除する。存在しない場合も例外にならない。
     */
    async deleteThumbnail(metadataId: string): Promise<void> {
        await this.redis.del(REDIS_KEYS.CONTENT.THUMBNAIL(metadataId));
    }
}
