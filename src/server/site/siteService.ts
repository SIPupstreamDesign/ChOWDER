/**
 * SiteService
 * Siteの管理（物理的な場所・DisplayWindow配置の管理単位）
 */

import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';
import { REDIS_KEYS } from '../common/redisKeys';
import {
    Site,
    CreateSiteRequest,
    UpdateSiteRequest,
    DeleteSiteRequest,
    GetSiteRequest,
    DisplaySpace,
    UpdateDisplaySpaceRequest,
} from './siteTypes';

/** デフォルト Site の ID */
export const DEFAULT_SITE_ID = 'default';

/** デフォルトの DisplaySpace 設定 */
const DEFAULT_DISPLAY_SPACE: Omit<DisplaySpace, 'siteId'> = {
    virtualWidth: 3840,
    virtualHeight: 2160,
    splitX: 1,
    splitY: 1,
    scale: 1.0,
    type: 'display_space',
};

/**
 * SiteServiceクラス
 */
export class SiteService {
    private redis: Redis;

    constructor(redis: Redis) {
        this.redis = redis;
    }

    /**
     * Site ID を生成
     */
    private generateSiteId(): string {
        return 'site_' + randomBytes(4).toString('hex');
    }

    /**
     * サーバー起動時にデフォルト Site を自動生成
     * すでに存在する場合は何もしない
     */
    async ensureDefaultSite(): Promise<Site> {
        const existing = await this.getSite({ siteId: DEFAULT_SITE_ID });
        if (existing) {
            return existing;
        }

        const now = new Date().toISOString();
        const defaultSite: Site = {
            siteId: DEFAULT_SITE_ID,
            siteName: 'Default',
            description: 'デフォルト Site（自動生成）',
            isDefault: true,
            createdAt: now,
            updatedAt: now,
            color: '#fbbf24',
        };

        await this.redis.set(
            REDIS_KEYS.SITE.DATA(DEFAULT_SITE_ID),
            JSON.stringify(defaultSite)
        );
        await this.redis.sadd(REDIS_KEYS.SITE.LIST, DEFAULT_SITE_ID);

        console.log('[SiteService] Default site created');

        await this.ensureDisplaySpace(DEFAULT_SITE_ID);

        return this.getSite({ siteId: DEFAULT_SITE_ID }) as Promise<Site>;
    }

    /**
     * Site を作成
     */
    async createSite(request: CreateSiteRequest): Promise<Site> {
        const siteId = this.generateSiteId();
        const now = new Date().toISOString();

        const site: Site = {
            siteId,
            siteName: request.siteName,
            description: request.description,
            isDefault: false,
            createdAt: now,
            updatedAt: now,
            ...(request.color !== undefined && { color: request.color }),
        };

        await this.redis.set(
            REDIS_KEYS.SITE.DATA(siteId),
            JSON.stringify(site)
        );
        await this.redis.sadd(REDIS_KEYS.SITE.LIST, siteId);

        await this.initializeDisplaySpace(siteId);

        return this.getSite({ siteId }) as Promise<Site>;
    }

    /**
     * Site を更新
     */
    async updateSite(request: UpdateSiteRequest): Promise<Site | null> {
        const current = await this.getSite({ siteId: request.siteId });
        if (!current) return null;

        const updated: Site = {
            ...current,
            ...(request.siteName !== undefined && { siteName: request.siteName }),
            ...(request.description !== undefined && { description: request.description }),
            ...(request.color !== undefined && { color: request.color }),
            updatedAt: new Date().toISOString(),
        };

        // displaySpace は Redis のサイトデータに含まないので履歴から除去して保存
        const { displaySpace: _ds, ...siteData } = updated;
        await this.redis.set(
            REDIS_KEYS.SITE.DATA(request.siteId),
            JSON.stringify(siteData)
        );

        return this.getSite({ siteId: request.siteId });
    }

    /**
     * Site を削除
     * デフォルト Site は削除不可
     */
    async deleteSite(request: DeleteSiteRequest): Promise<boolean> {
        const { siteId } = request;

        if (siteId === DEFAULT_SITE_ID) {
            throw new Error('Cannot delete the default site');
        }

        const exists = await this.redis.exists(REDIS_KEYS.SITE.DATA(siteId));
        if (!exists) return false;

        await this.redis.del(REDIS_KEYS.SITE.DATA(siteId));
        await this.redis.del(REDIS_KEYS.SITE.DISPLAY_SPACE(siteId));
        await this.redis.del(REDIS_KEYS.SITE.DISPLAY_WINDOW_LIST(siteId));
        await this.redis.srem(REDIS_KEYS.SITE.LIST, siteId);

        return true;
    }

    /**
     * Site を取得
     */
    async getSite(request: GetSiteRequest): Promise<Site | null> {
        const data = await this.redis.get(REDIS_KEYS.SITE.DATA(request.siteId));
        if (!data) return null;
        const site = JSON.parse(data) as Site;
        const displaySpace = await this.getDisplaySpace(site.siteId);
        return { ...site, displaySpace };
    }

    /**
     * 全 Site 一覧を取得
     */
    async getAllSites(): Promise<Site[]> {
        const siteIds = await this.redis.smembers(REDIS_KEYS.SITE.LIST);
        const sites: Site[] = [];

        for (const siteId of siteIds) {
            const site = await this.getSite({ siteId });
            if (site) {
                sites.push(site);
            }
        }

        // デフォルト Site を先頭に
        sites.sort((a, b) => {
            if (a.isDefault) return -1;
            if (b.isDefault) return 1;
            return a.createdAt.localeCompare(b.createdAt);
        });

        return sites;
    }

    /**
     * Site に属する WindowMetaData の ID 一覧を取得
     */
    async getDisplayWindowIds(siteId: string): Promise<string[]> {
        return this.redis.smembers(REDIS_KEYS.SITE.DISPLAY_WINDOW_LIST(siteId));
    }

    // ========================================
    // DisplaySpace メソッド群
    // ========================================

    /**
     * DisplaySpace を取得
     * 存在しない場合はデフォルト値を返す
     */
    async getDisplaySpace(siteId: string): Promise<DisplaySpace> {
        const key = REDIS_KEYS.SITE.DISPLAY_SPACE(siteId);
        const data = await this.redis.get(key);

        if (data) {
            return JSON.parse(data) as DisplaySpace;
        }

        return { ...DEFAULT_DISPLAY_SPACE, siteId };
    }

    /**
     * DisplaySpace を更新
     */
    async updateDisplaySpace(siteId: string, updates: UpdateDisplaySpaceRequest): Promise<DisplaySpace> {
        const key = REDIS_KEYS.SITE.DISPLAY_SPACE(siteId);
        const current = await this.getDisplaySpace(siteId);

        const updated: DisplaySpace = {
            ...current,
            ...updates,
            type: 'display_space',
            siteId,
        };

        await this.redis.set(key, JSON.stringify(updated));

        return updated;
    }

    /**
     * DisplaySpace を初期化（デフォルト値に戻す）
     */
    async initializeDisplaySpace(siteId: string): Promise<DisplaySpace> {
        const key = REDIS_KEYS.SITE.DISPLAY_SPACE(siteId);
        const initial: DisplaySpace = { ...DEFAULT_DISPLAY_SPACE, siteId };

        await this.redis.set(key, JSON.stringify(initial));

        return initial;
    }

    /**
     * DisplaySpace が未保存の場合だけデフォルト値で初期化して保存する
     * 既に保存済みの場合は既存値をそのまま返す
     */
    async ensureDisplaySpace(siteId: string): Promise<DisplaySpace> {
        const key = REDIS_KEYS.SITE.DISPLAY_SPACE(siteId);
        const data = await this.redis.get(key);

        if (data) {
            return JSON.parse(data) as DisplaySpace;
        }

        return this.initializeDisplaySpace(siteId);
    }
}
