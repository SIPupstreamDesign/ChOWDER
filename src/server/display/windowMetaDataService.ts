/**
 * WindowMetaDataService
 * 各ディスプレイウィンドウの情報を管理
 */

import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';
import { REDIS_KEYS, REDIS_PATTERNS } from '../common/redisKeys';
import { DEFAULT_SITE_ID } from '../site/siteService';
import {
    WindowMetaData,
    AddWindowMetaDataRequest,
    UpdateWindowMetaDataRequest,
    GetWindowMetaDataRequest,
    DeleteWindowMetaDataRequest,
} from './displayTypes';
import { isContentInWindow } from '../../common/coordinateTransform';
import { ContentMetadata } from '../content/contentTypes';

/**
 * WindowMetaDataサービスクラス
 */
export class WindowMetaDataService {
    private redis: Redis;

    constructor(redis: Redis) {
        this.redis = redis;
    }

    /**
     * ウィンドウIDを生成
     */
    private generateWindowId(): string {
        return 'window_' + randomBytes(4).toString('hex');
    }

    /**
     * WindowMetaDataを追加
     */
    async addWindowMetaData(request: AddWindowMetaDataRequest): Promise<WindowMetaData> {
        const windowId = request.id || this.generateWindowId();

        const windowMetaData: WindowMetaData = {
            id: windowId,
            posx: request.posx,
            posy: request.posy,
            virtualWidth: request.virtualWidth,
            virtualHeight: request.virtualHeight,
            pixelWidth: request.pixelWidth,
            pixelHeight: request.pixelHeight,
            contentVisible: request.contentVisible !== undefined ? request.contentVisible : true,
            type: 'display',
            displayId: request.displayId,
            displayName: request.displayName,
            siteId: request.siteId || DEFAULT_SITE_ID,
        };

        await this.redis.set(
            REDIS_KEYS.DISPLAY.WINDOW(windowId),
            JSON.stringify(windowMetaData)
        );

        // Siteの display_window_list Set に追加
        await this.redis.sadd(
            REDIS_KEYS.SITE.DISPLAY_WINDOW_LIST(windowMetaData.siteId),
            windowId
        );

        return windowMetaData;
    }

    /**
     * WindowMetaDataを取得
     */
    async getWindowMetaData(request: GetWindowMetaDataRequest): Promise<WindowMetaData | WindowMetaData[] | null> {
        const { id, type } = request;

        if (type === 'all' || !id) {
            // 全件取得
            const displayKeys = await this.redis.keys(REDIS_PATTERNS.DISPLAY_WINDOWS);
            const windows: WindowMetaData[] = [];

            for (const key of displayKeys) {
                const data = await this.redis.get(key);
                if (data) {
                    windows.push(JSON.parse(data) as WindowMetaData);
                }
            }

            return windows;
        } else {
            // 単一取得
            const data = await this.redis.get(REDIS_KEYS.DISPLAY.WINDOW(id!));
            if (data) {
                return JSON.parse(data) as WindowMetaData;
            }
            return null;
        }
    }

    /**
     * displayIdからWindowMetaDataを取得
     */
    async getWindowMetaDataByDisplayId(displayId: string): Promise<WindowMetaData | null> {
        const windows = await this.getWindowMetaData({ type: 'all' });
        if (!Array.isArray(windows)) return null;

        const window = windows.find(w => w.displayId === displayId);
        return window || null;
    }

    /**
     * WindowMetaDataを更新
     */
    async updateWindowMetaData(request: UpdateWindowMetaDataRequest): Promise<WindowMetaData | null> {
        const { id, ...updates } = request;

        const current = await this.getWindowMetaData({ id, type: 'single' });
        if (!current || Array.isArray(current)) {
            return null;
        }

        // siteId 変更時に Site Set を更新
        const newSiteId = updates.siteId || current.siteId || DEFAULT_SITE_ID;
        if (newSiteId !== current.siteId) {
            if (current.siteId) {
                await this.redis.srem(
                    REDIS_KEYS.SITE.DISPLAY_WINDOW_LIST(current.siteId),
                    id
                );
            }
            await this.redis.sadd(
                REDIS_KEYS.SITE.DISPLAY_WINDOW_LIST(newSiteId),
                id
            );
        }

        const updated: WindowMetaData = {
            ...current,
            ...updates,
            siteId: newSiteId,
        };

        await this.redis.set(
            REDIS_KEYS.DISPLAY.WINDOW(id),
            JSON.stringify(updated)
        );

        return updated;
    }

    /**
     * WindowMetaDataを削除
     */
    async deleteWindowMetaData(request: DeleteWindowMetaDataRequest): Promise<boolean> {
        const { id } = request;

        // Siteの display_window_list Set からも除去
        const data = await this.redis.get(REDIS_KEYS.DISPLAY.WINDOW(id));
        if (data) {
            const windowMetaData = JSON.parse(data) as WindowMetaData;
            if (windowMetaData.siteId) {
                await this.redis.srem(
                    REDIS_KEYS.SITE.DISPLAY_WINDOW_LIST(windowMetaData.siteId),
                    id
                );
            }
        }

        const result = await this.redis.del(REDIS_KEYS.DISPLAY.WINDOW(id));
        return result > 0;
    }

    /**
     * 指定されたウィンドウに表示されるコンテンツをフィルタリング
     */
    filterContentsInWindow(
        contents: ContentMetadata[],
        window: WindowMetaData
    ): ContentMetadata[] {
        return contents.filter((content) =>
            isContentInWindow(
                content.posx,
                content.posy,
                content.width,
                content.height,
                window.posx,
                window.posy,
                window.virtualWidth,
                window.virtualHeight
            )
        );
    }

    /**
     * 全ウィンドウを削除（デバッグ用）
     */
    async deleteAllWindows(): Promise<number> {
        const displayKeys = await this.redis.keys(REDIS_PATTERNS.DISPLAY_WINDOWS);
        if (displayKeys.length === 0) {
            return 0;
        }
        return await this.redis.del(...displayKeys);
    }

    /**
     * 指定したSiteに属するディスプレイIDの一覧を取得
     * Site の display_window_list から windowId を取得し、
     * 各 WindowMetaData の displayId を収集して返す
     */
    async getDisplayIdsBySite(siteId: string): Promise<string[]> {
        const windowIds = await this.redis.smembers(
            REDIS_KEYS.SITE.DISPLAY_WINDOW_LIST(siteId)
        );

        if (windowIds.length === 0) {
            return [];
        }

        const displayIds: string[] = [];

        for (const windowId of windowIds) {
            const data = await this.redis.get(REDIS_KEYS.DISPLAY.WINDOW(windowId));
            if (!data) continue;

            const window = JSON.parse(data) as WindowMetaData;
            if (window.displayId) {
                displayIds.push(window.displayId);
            }
        }

        return displayIds;
    }
}
