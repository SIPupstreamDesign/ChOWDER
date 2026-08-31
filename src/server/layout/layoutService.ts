/**
 * ContentsLayoutService
 * VirtualDisplay上のコンテンツ位置スナップショットを保存・復元する
 */

import { Redis } from 'ioredis';
import { REDIS_KEYS } from '../common/redisKeys';
import { ContentService } from '../content/contentService';
import { ContentMetadata, ContentType } from '../content/contentTypes';
import {
    ContentsLayout,
    ContentsLayoutSummary,
    ContentLayoutEntry,
    SaveContentsLayoutRequest,
    RestoreContentsLayoutRequest,
    DeleteContentsLayoutRequest,
} from './layoutTypes';

/**
 * ContentMetadata から ContentLayoutEntry を生成する
 * identity フィールド（binaryId, type, creatorId, date）と拡張フィールドは除外する
 */
function toLayoutEntry(meta: ContentMetadata): ContentLayoutEntry {
    const entry: ContentLayoutEntry = {
        metadataId: meta.metadataId,
        posx: meta.posx,
        posy: meta.posy,
        width: meta.width,
        height: meta.height,
    };

    if (meta.orgWidth !== undefined) entry.orgWidth = meta.orgWidth;
    if (meta.orgHeight !== undefined) entry.orgHeight = meta.orgHeight;
    if (meta.zindex !== undefined) entry.zindex = meta.zindex;
    entry.visible = meta.visible ?? true;
    if (meta.mime !== undefined) entry.mime = meta.mime;

    return entry;
}

/**
 * ContentsLayout からサマリーを生成する（entries を除く）
 */
function toSummary(layout: ContentsLayout): ContentsLayoutSummary {
    return {
        layoutId: layout.layoutId,
        name: layout.name,
        createdAt: layout.createdAt,
        updatedAt: layout.updatedAt,
    };
}

export class LayoutService {
    private redis: Redis;
    private contentService: ContentService;

    constructor(redis: Redis, contentService: ContentService) {
        this.redis = redis;
        this.contentService = contentService;
    }

    /**
     * UUID生成（8文字）
     */
    private generateId(): string {
        const s4 = () => Math.floor((1 + Math.random()) * 0x10000000).toString(16).substring(1);
        return s4() + s4();
    }

    /**
     * レイアウトを保存する
     * - layoutId が省略された場合: 新規作成
     * - layoutId が指定されかつ存在する場合: 上書き保存（createdAt を保持）
     * - layoutId が指定されたが存在しない場合: 新規作成（新しい layoutId を採番）
     */
    async saveLayout(request: SaveContentsLayoutRequest): Promise<ContentsLayout> {
        const nowDate = new Date();
        const now = nowDate.toISOString();

        // 既存レイアウトを確認（上書き判定）
        let existingLayout: ContentsLayout | null = null;
        if (request.layoutId) {
            existingLayout = await this.getLayout(request.layoutId);
        }

        const layoutId = existingLayout ? existingLayout.layoutId : this.generateId();
        const createdAt = existingLayout ? existingLayout.createdAt : now;
        let updatedAt = now;
        if (existingLayout && updatedAt === createdAt) {
            // 同一ミリ秒で衝突した場合でも、更新時刻は作成時刻と区別できるようにする。
            updatedAt = new Date(nowDate.getTime() + 1).toISOString();
        }

        // 現在の全メタデータを取得し、live-stream を除外してエントリを生成
        const allMetadata = await this.contentService.getAllMetadata();
        const entries: ContentLayoutEntry[] = allMetadata
            .filter(meta => meta.type !== ContentType.LIVE_STREAM)
            .map(toLayoutEntry);

        const layout: ContentsLayout = {
            layoutId,
            name: request.name,
            createdAt,
            updatedAt,
            entries,
        };

        // レイアウトデータを保存し、layout:list に登録（MULTI/EXEC）
        const results = await this.redis.multi()
            .set(REDIS_KEYS.LAYOUT.DATA(layoutId), JSON.stringify(layout))
            .sadd(REDIS_KEYS.LAYOUT.LIST, layoutId)
            .exec();

        if (results === null) {
            throw new Error('Redis MULTI/EXEC transaction was aborted while saving layout');
        }
        for (const [err] of results) {
            if (err) {
                throw new Error(`Redis MULTI/EXEC command failed: ${err.message}`);
            }
        }

        return layout;
    }

    /**
     * レイアウトを1件取得する
     */
    async getLayout(layoutId: string): Promise<ContentsLayout | null> {
        const data = await this.redis.get(REDIS_KEYS.LAYOUT.DATA(layoutId));
        if (!data) return null;
        return JSON.parse(data) as ContentsLayout;
    }

    /**
     * 全レイアウトのサマリー一覧を取得する（entries は含まない）
     */
    async getAllLayouts(): Promise<ContentsLayoutSummary[]> {
        const layoutIds = await this.redis.smembers(REDIS_KEYS.LAYOUT.LIST);
        if (layoutIds.length === 0) return [];

        const summaries: ContentsLayoutSummary[] = [];
        for (const layoutId of layoutIds) {
            const layout = await this.getLayout(layoutId);
            if (layout) {
                summaries.push(toSummary(layout));
            }
        }

        return summaries;
    }

    /**
     * レイアウトを削除する
     * @returns 削除できた場合 true、存在しなかった場合 false
     */
    async deleteLayout(layoutId: string): Promise<boolean> {
        const exists = await this.redis.exists(REDIS_KEYS.LAYOUT.DATA(layoutId));
        if (!exists) return false;

        const results = await this.redis.multi()
            .del(REDIS_KEYS.LAYOUT.DATA(layoutId))
            .srem(REDIS_KEYS.LAYOUT.LIST, layoutId)
            .exec();

        if (results === null) {
            throw new Error('Redis MULTI/EXEC transaction was aborted while deleting layout');
        }
        for (const [err] of results) {
            if (err) {
                throw new Error(`Redis MULTI/EXEC command failed: ${err.message}`);
            }
        }

        return true;
    }

    /**
     * レイアウトを復元する
     * - 存在しないコンテンツはスキップする
     * - 全更新を MULTI/EXEC でアトミックに実行する
     *
     * @returns 更新された metadataId リストとスキップされた metadataId リスト、
     *          layoutId が存在しない場合は null
     */
    async restoreLayout(layoutId: string): Promise<{ updatedIds: string[]; skippedIds: string[]; } | null> {
        const layout = await this.getLayout(layoutId);
        if (!layout) return null;

        if (layout.entries.length === 0) {
            return { updatedIds: [], skippedIds: [] };
        }

        const now = new Date().toISOString();
        const toUpdate: Array<{ entry: ContentLayoutEntry; currentMeta: ContentMetadata }> = [];
        const skippedIds: string[] = [];

        // 各エントリの存在確認と現在のメタデータ取得
        for (const entry of layout.entries) {
            const currentMeta = await this.contentService.getMetadata(entry.metadataId);
            if (!currentMeta) {
                skippedIds.push(entry.metadataId);
            } else {
                toUpdate.push({ entry, currentMeta });
            }
        }

        if (toUpdate.length === 0) {
            return { updatedIds: [], skippedIds };
        }

        // 全更新をアトミックに実行（MULTI/EXEC）
        const pipeline = this.redis.multi();
        const updatedIds: string[] = [];

        for (const { entry, currentMeta } of toUpdate) {
            // identity フィールドは現在の値を維持し、レイアウトフィールドのみ上書き
            const updatedMeta: ContentMetadata = {
                ...currentMeta,
                posx: entry.posx,
                posy: entry.posy,
                width: entry.width,
                height: entry.height,
                ...(entry.orgWidth !== undefined && { orgWidth: entry.orgWidth }),
                ...(entry.orgHeight !== undefined && { orgHeight: entry.orgHeight }),
                ...(entry.zindex !== undefined && { zindex: entry.zindex }),
                visible: entry.visible,
                ...(entry.mime !== undefined && { mime: entry.mime }),
                // identity フィールドは CurrentMeta から継承済み（上書き防止）
                metadataId: currentMeta.metadataId,
                binaryId: currentMeta.binaryId,
                type: currentMeta.type,
                creatorId: currentMeta.creatorId,
                date: now,
            };

            pipeline.set(
                REDIS_KEYS.CONTENT.METADATA(entry.metadataId),
                JSON.stringify(updatedMeta)
            );
            updatedIds.push(entry.metadataId);
        }

        const results = await pipeline.exec();

        if (results === null) {
            throw new Error('Redis MULTI/EXEC transaction was aborted while restoring layout');
        }
        for (const [err] of results) {
            if (err) {
                throw new Error(`Redis MULTI/EXEC command failed: ${err.message}`);
            }
        }

        return { updatedIds, skippedIds };
    }
}
