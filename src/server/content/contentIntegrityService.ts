/**
 * コンテンツ整合性サービス
 *
 * Redisに残存する不完全なコンテンツデータを検出・削除する。
 *
 * 検出対象:
 *   1. content:binary:{id}  だけ残存（対応するmetadataなし）
 *   2. content:metadata:{id} だけ残存（binaryId != null なのに binaryなし）
 *   3. content:metadata:{id} が live-stream 型だが content:stream:{streamId} がない
 *   4. content:stream:{streamId} が metadataId を持つが content:metadata:{id} がない
 *   5. content:tile:{id} だけ残存（対応するmetadataなし）
 *
 * 使用例:
 *   const svc = new ContentIntegrityService(redis);
 *
 *   // 起動時: 猶予なし
 *   await svc.checkAndRepair();
 *
 *   // 定期実行: 5分以内に作成されたエントリは対象外
 *   await svc.checkAndRepair({ gracePeriodMs: 5 * 60 * 1000 });
 *
 *   // 削除せず検出のみ確認したいとき
 *   const result = await svc.checkAndRepair({ dryRun: true });
 */

import { Redis } from 'ioredis';
import { REDIS_KEYS, REDIS_PATTERNS } from '../common/redisKeys';

/** checkAndRepair() の実行オプション */
export interface CheckAndRepairOptions {
    /**
     * この期間内に作成されたエントリは削除対象外にする（ミリ秒）。
     * 定期実行時にサーバー稼働中の書き込み途中を誤削除しないための猶予時間。
     * デフォルト: 0（起動時チェックでは並行書き込みがないため不要）
     */
    gracePeriodMs?: number;

    /**
     * true の場合、削除は行わず検出のみ行う。
     * デフォルト: false
     */
    dryRun?: boolean;
}

/** checkAndRepair() の結果 */
export interface IntegrityCheckResult {
    /** binary のみ残存していたエントリの ID 一覧 */
    orphanedBinaries: string[];

    /** metadata のみ残存していたエントリの metadataId 一覧 */
    orphanedMetadata: string[];

    /** stream info が存在しない live-stream metadata の metadataId 一覧 */
    orphanedStreamMetadata: string[];

    /** metadata が存在しない stream info の streamId 一覧 */
    orphanedStreamInfos: string[];

    /** metadata が存在しない tile データの contentId 一覧 */
    orphanedTiles: string[];

    /** metadata が存在しない thumbnail の contentId 一覧 */
    orphanedThumbnails: string[];

    /** 削除（または検出）した合計件数 */
    totalDeleted: number;

    /** 実行にかかった時間（ミリ秒） */
    durationMs: number;

    /** dryRun モードで実行された場合は true */
    dryRun: boolean;
}

/** 起動時 live-stream 全削除の結果 */
export interface StartupLiveStreamPurgeResult {
    /** 削除した live-stream metadata 件数 */
    deletedLiveStreamMetadataCount: number;

    /** 削除した stream info 件数 */
    deletedStreamInfoCount: number;

    /** 削除（または削除対象）合計件数 */
    totalDeleted: number;

    /** 実行にかかった時間（ミリ秒） */
    durationMs: number;

    /** dryRun モードで実行された場合は true */
    dryRun: boolean;
}

export class ContentIntegrityService {
    private redis: Redis;

    constructor(redis: Redis) {
        this.redis = redis;
    }

    /**
     * Redis 内の不完全なコンテンツデータを検出・削除する。
     *
     * @param options - 実行オプション（gracePeriodMs, dryRun）
     * @returns 検出・削除したエントリの詳細
     */
    async checkAndRepair(options: CheckAndRepairOptions = {}): Promise<IntegrityCheckResult> {
        const { gracePeriodMs = 0, dryRun = false } = options;
        const startedAt = Date.now();

        const result: IntegrityCheckResult = {
            orphanedBinaries: [],
            orphanedMetadata: [],
            orphanedStreamMetadata: [],
            orphanedStreamInfos: [],
            orphanedTiles: [],
            orphanedThumbnails: [],
            totalDeleted: 0,
            durationMs: 0,
            dryRun,
        };

        await this.checkOrphanedBinaries(result, gracePeriodMs, dryRun);
        await this.checkOrphanedMetadata(result, gracePeriodMs, dryRun);
        await this.checkOrphanedStreamInfos(result, gracePeriodMs, dryRun);
        await this.checkOrphanedTiles(result, dryRun);
        await this.checkOrphanedThumbnails(result, dryRun);

        result.totalDeleted =
            result.orphanedBinaries.length +
            result.orphanedMetadata.length +
            result.orphanedStreamMetadata.length +
            result.orphanedStreamInfos.length +
            result.orphanedTiles.length +
            result.orphanedThumbnails.length;

        result.durationMs = Date.now() - startedAt;

        if (result.totalDeleted > 0) {
            console.log(
                `[ContentIntegrityService] ${dryRun ? '[DRY RUN] Detected' : 'Deleted'} ` +
                `${result.totalDeleted} orphaned entry/entries ` +
                `(binary:${result.orphanedBinaries.length}, ` +
                `metadata:${result.orphanedMetadata.length}, ` +
                `streamMetadata:${result.orphanedStreamMetadata.length}, ` +
                `streamInfo:${result.orphanedStreamInfos.length}, ` +
                `tile:${result.orphanedTiles.length}, ` +
                `thumbnail:${result.orphanedThumbnails.length}) ` +
                `in ${result.durationMs}ms`
            );
        } else {
            console.log(
                `[ContentIntegrityService] No orphaned entries found (${result.durationMs}ms)`
            );
        }

        return result;
    }

    /**
     * サーバ起動時に live-stream 関連データを全削除する。
     *
     * 削除対象:
     * - type === 'live-stream' の content:metadata:{id}
     * - すべての content:stream:{streamId}
     *
     * stream は WebRTC セッションに紐づく揮発データのため、
     * 再起動時に全件削除して stale 状態を残さない。
     */
    async purgeAllLiveStreamsOnStartup(dryRun: boolean = false): Promise<StartupLiveStreamPurgeResult> {
        const startedAt = Date.now();

        const metadataKeys = await this.redis.keys(REDIS_PATTERNS.CONTENT_METADATA);
        const liveStreamMetadataKeys: string[] = [];
        for (const metadataKey of metadataKeys) {
            const metadataStr = await this.redis.get(metadataKey);
            if (!metadataStr) {
                continue;
            }

            try {
                const metadata = JSON.parse(metadataStr) as { type?: string };
                if (metadata.type === 'live-stream') {
                    liveStreamMetadataKeys.push(metadataKey);
                }
            } catch {
                console.warn(`[ContentIntegrityService] Failed to parse metadata during startup stream purge: ${metadataKey}`);
            }
        }

        const streamInfoKeys = await this.redis.keys(REDIS_PATTERNS.CONTENT_STREAMS);

        if (!dryRun) {
            const keysToDelete = [...liveStreamMetadataKeys, ...streamInfoKeys];
            if (keysToDelete.length > 0) {
                await this.redis.del(...keysToDelete);
            }
        }

        const result: StartupLiveStreamPurgeResult = {
            deletedLiveStreamMetadataCount: liveStreamMetadataKeys.length,
            deletedStreamInfoCount: streamInfoKeys.length,
            totalDeleted: liveStreamMetadataKeys.length + streamInfoKeys.length,
            durationMs: Date.now() - startedAt,
            dryRun,
        };

        console.log(
            `[ContentIntegrityService] ${dryRun ? '[DRY RUN] Detected' : 'Deleted'} startup live-stream entries ` +
            `(metadata:${result.deletedLiveStreamMetadataCount}, streamInfo:${result.deletedStreamInfoCount}, total:${result.totalDeleted}) ` +
            `in ${result.durationMs}ms`
        );

        return result;
    }

    /**
     * パターン1: content:binary:{id} だけ残存しているエントリを検出・削除
     *
     * addContent / updateContent はいずれも MULTI/EXEC でアトミックに書き込むため、
     * 通常は binary と metadata は必ず同時に存在する。
     * binary だけ残存している場合は過去のクラッシュ等によるものと判断し削除する。
     *
     * binary キーには作成タイムスタンプがないため gracePeriodMs は適用しない。
     * 定期実行時も安全に削除できる（MULTI/EXEC 化以降、書き込み途中の binary 単独存在はない）。
     */
    private async checkOrphanedBinaries(
        result: IntegrityCheckResult,
        _gracePeriodMs: number,
        dryRun: boolean
    ): Promise<void> {
        const binaryKeys = await this.redis.keys(REDIS_PATTERNS.CONTENT_BINARY);

        for (const binaryKey of binaryKeys) {
            // content:binary:{id} → id を取り出す
            const id = this.extractId(binaryKey);
            const metadataExists = await this.redis.exists(REDIS_KEYS.CONTENT.METADATA(id));

            if (!metadataExists) {
                console.log(`[ContentIntegrityService] Orphaned binary found: ${binaryKey}`);
                if (!dryRun) {
                    await this.redis.del(binaryKey);
                }
                result.orphanedBinaries.push(id);
            }
        }
    }

    /**
     * パターン2・3: content:metadata:{id} の整合性チェック
     *
     * - パターン2: binaryId != null なのに content:binary:{binaryId} が存在しない
     * - パターン3: type == live-stream なのに content:stream:{streamId} が存在しない
     *
     * metadata の `date` フィールドを使って gracePeriodMs を適用する。
     */
    private async checkOrphanedMetadata(
        result: IntegrityCheckResult,
        gracePeriodMs: number,
        dryRun: boolean
    ): Promise<void> {
        const metadataKeys = await this.redis.keys(REDIS_PATTERNS.CONTENT_METADATA);
        const cutoff = Date.now() - gracePeriodMs;

        for (const metadataKey of metadataKeys) {
            const metadataStr = await this.redis.get(metadataKey);
            if (!metadataStr) continue;

            let metadata: any;
            try {
                metadata = JSON.parse(metadataStr);
            } catch {
                console.warn(`[ContentIntegrityService] Failed to parse metadata: ${metadataKey}`);
                continue;
            }

            // gracePeriod チェック: 最近作成されたエントリはスキップ
            if (gracePeriodMs > 0 && metadata.date) {
                const createdAt = new Date(metadata.date).getTime();
                if (createdAt > cutoff) {
                    continue;
                }
            }

            const metadataId = this.extractId(metadataKey);

            if (metadata.type === 'live-stream') {
                // パターン3: live-stream metadata に対応する StreamInfo がない
                if (metadata.streamId) {
                    const streamExists = await this.redis.exists(
                        REDIS_KEYS.CONTENT.STREAM(metadata.streamId)
                    );
                    if (!streamExists) {
                        console.log(
                            `[ContentIntegrityService] Orphaned stream metadata found: ` +
                            `metadataId=${metadataId}, streamId=${metadata.streamId}`
                        );
                        if (!dryRun) {
                            await this.redis.del(metadataKey);
                        }
                        result.orphanedStreamMetadata.push(metadataId);
                    }
                }
            } else {
                // パターン2: 通常コンテンツで binary が存在しない
                if (metadata.binaryId !== null && metadata.binaryId !== undefined) {
                    const binaryExists = await this.redis.exists(
                        REDIS_KEYS.CONTENT.BINARY(metadata.binaryId)
                    );
                    if (!binaryExists) {
                        console.log(
                            `[ContentIntegrityService] Orphaned metadata found: ` +
                            `metadataId=${metadataId}, binaryId=${metadata.binaryId}`
                        );
                        if (!dryRun) {
                            await this.redis.del(metadataKey);
                        }
                        result.orphanedMetadata.push(metadataId);
                    }
                }
            }
        }
    }

    /**
     * パターン4: content:stream:{streamId} が metadataId を持つが
     * 対応する content:metadata:{id} が存在しない
     *
     * StreamInfo の `created` フィールドを使って gracePeriodMs を適用する。
     */
    private async checkOrphanedStreamInfos(
        result: IntegrityCheckResult,
        gracePeriodMs: number,
        dryRun: boolean
    ): Promise<void> {
        const streamKeys = await this.redis.keys(REDIS_PATTERNS.CONTENT_STREAMS);
        const cutoff = Date.now() - gracePeriodMs;

        for (const streamKey of streamKeys) {
            const streamInfoStr = await this.redis.get(streamKey);
            if (!streamInfoStr) continue;

            let streamInfo: any;
            try {
                streamInfo = JSON.parse(streamInfoStr);
            } catch {
                console.warn(`[ContentIntegrityService] Failed to parse stream info: ${streamKey}`);
                continue;
            }

            // metadataId がない stream info（audio-only stream等）はスキップ
            if (!streamInfo.metadataId) continue;

            // gracePeriod チェック
            if (gracePeriodMs > 0 && streamInfo.created) {
                const createdAt = new Date(streamInfo.created).getTime();
                if (createdAt > cutoff) {
                    continue;
                }
            }

            const metadataExists = await this.redis.exists(
                REDIS_KEYS.CONTENT.METADATA(streamInfo.metadataId)
            );

            if (!metadataExists) {
                const streamId = this.extractId(streamKey);
                console.log(
                    `[ContentIntegrityService] Orphaned stream info found: ` +
                    `streamId=${streamId}, metadataId=${streamInfo.metadataId}`
                );
                if (!dryRun) {
                    await this.redis.del(streamKey);
                }
                result.orphanedStreamInfos.push(streamId);
            }
        }
    }

    /**
     * Redis キーの末尾セグメント（ID部分）を取り出す
     * 例: "content:binary:abc123" → "abc123"
     */
    private extractId(key: string): string {
        const parts = key.split(':');
        return parts[parts.length - 1];
    }

    /**
     * パターン5: content:tile:{id} が存在するが
     * 対応する content:metadata:{id} が存在しない
     *
     * deleteContent でタイルが削除されなかった場合や、
     * サーバークラッシュ時に deleteIncompleteContent が実行されなかった場合に発生する。
     */
    private async checkOrphanedTiles(
        result: IntegrityCheckResult,
        dryRun: boolean
    ): Promise<void> {
        const tileKeys = await this.redis.keys(REDIS_PATTERNS.CONTENT_TILES);

        for (const tileKey of tileKeys) {
            const id = this.extractId(tileKey);
            const metadataExists = await this.redis.exists(REDIS_KEYS.CONTENT.METADATA(id));

            if (!metadataExists) {
                console.log(`[ContentIntegrityService] Orphaned tile found: ${tileKey}`);
                if (!dryRun) {
                    await this.redis.del(tileKey);
                }
                result.orphanedTiles.push(id);
            }
        }
    }

    /**
     * パターン6: content:thumbnail:{id} が存在するが
     * 対応する content:metadata:{id} が存在しない
     *
     * deleteContent 実行後にサーバーがクラッシュした場合や、
     * クリーンアップパスで deleteThumbnail を呼び出す前に失敗した場合に発生する。
     */
    private async checkOrphanedThumbnails(
        result: IntegrityCheckResult,
        dryRun: boolean
    ): Promise<void> {
        const thumbnailKeys = await this.redis.keys(REDIS_PATTERNS.CONTENT_THUMBNAILS);

        for (const thumbnailKey of thumbnailKeys) {
            const id = this.extractId(thumbnailKey);
            const metadataExists = await this.redis.exists(REDIS_KEYS.CONTENT.METADATA(id));

            if (!metadataExists) {
                console.log(`[ContentIntegrityService] Orphaned thumbnail found: ${thumbnailKey}`);
                if (!dryRun) {
                    await this.redis.del(thumbnailKey);
                }
                result.orphanedThumbnails.push(id);
            }
        }
    }
}
