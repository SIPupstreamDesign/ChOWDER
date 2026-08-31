/**
 * BulkUpdateMetaData ハンドラの await 順序テスト
 *
 * ChOWDERClient.handleBroadcast の BulkUpdateMetaData ケースのロジックを
 * 直接テストするため、ハンドラ内の制御フローをスタンドアロン関数として抽出して検証する。
 *
 * テスト対象の責務:
 *   - displayContentOnViewArea が全メタデータに対して順番に await されること
 *   - refreshMetadataList は全 displayContentOnViewArea 完了後に呼ばれること
 *   - displayContentOnViewArea の 1 つが例外を投げても残りが継続されること
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
    compareContentMetadataForDisplayOrder,
    normalizeContentZIndex,
} from '../../common/contentOrder';

// ============================================================
// ハンドラロジックの抽出
// ============================================================

/**
 * ChOWDERClient.handleBroadcast の BulkUpdateMetaData ケースを
 * テスタブルな形で抽出した関数。
 * 実装と 1:1 に対応させることで、将来の乖離を検出しやすくする。
 */
async function handleBulkUpdateMetaData(
    metadataList: any[],
    hasExistingElement: (metadataId: string) => boolean,
    displayContentOnViewArea: (metadata: any) => Promise<void>,
    updateWebGLContentLayout: (metadata: any) => void,
    updateContentLayout: (metadata: any) => void,
    refreshMetadataList: () => void,
): Promise<void> {
    const orderedMetadataList = [...metadataList]
        .map((metadata) => {
            return {
                ...metadata,
                zindex: normalizeContentZIndex(metadata.zindex),
            };
        })
        .sort(compareContentMetadataForDisplayOrder);
    for (const metadata of orderedMetadataList) {
        const exists = hasExistingElement(metadata.metadataId);
        if (metadata.type === 'webgl') {
            if (exists) {
                updateWebGLContentLayout(metadata);
            } else {
                await displayContentOnViewArea(metadata);
            }
        } else {
            if (exists) {
                updateContentLayout(metadata);
            } else {
                await displayContentOnViewArea(metadata);
            }
        }
    }
    refreshMetadataList();
}

// ============================================================
// テスト
// ============================================================

describe('handleBulkUpdateMetaData', () => {
    let callOrder: string[];

    beforeEach(() => {
        callOrder = [];
    });

    it('全メタデータに対して順番に displayContentOnViewArea が呼ばれること', async () => {
        const metadataList = [
            { metadataId: 'id-3', zindex: 1, createdAt: '2024-01-03T00:00:00.000Z' },
            { metadataId: 'id-1', zindex: 0, createdAt: '2024-01-01T00:00:00.000Z' },
            { metadataId: 'id-2', zindex: 0, createdAt: '2024-01-02T00:00:00.000Z' },
        ];

        const displayedIds: string[] = [];
        const updatedWebGLIds: string[] = [];
        const updatedContentIds: string[] = [];
        const displayContentOnViewArea = async (metadata: any) => {
            displayedIds.push(metadata.metadataId);
        };
        const hasExistingElement = (_metadataId: string): boolean => false;
        const updateWebGLContentLayout = (metadata: any): void => {
            updatedWebGLIds.push(metadata.metadataId);
        };
        const updateContentLayout = (metadata: any): void => {
            updatedContentIds.push(metadata.metadataId);
        };
        const refreshMetadataList = () => {};

        await handleBulkUpdateMetaData(
            metadataList,
            hasExistingElement,
            displayContentOnViewArea,
            updateWebGLContentLayout,
            updateContentLayout,
            refreshMetadataList,
        );

        assert.deepStrictEqual(displayedIds, ['id-1', 'id-2', 'id-3']);
        assert.deepStrictEqual(updatedWebGLIds, []);
        assert.deepStrictEqual(updatedContentIds, []);
    });

    it('refreshMetadataList は全 displayContentOnViewArea 完了後に呼ばれること', async () => {
        const metadataList = [
            { metadataId: 'id-2', type: 'webgl', zindex: 0, createdAt: '2024-01-02T00:00:00.000Z' },
            { metadataId: 'id-1', type: 'image', zindex: 0, createdAt: '2024-01-01T00:00:00.000Z' },
        ];

        // 各 display が完了したときと refresh が呼ばれたときをログ
        const displayContentOnViewArea = async (metadata: any) => {
            // 非同期遅延をシミュレート
            await Promise.resolve();
            callOrder.push(`display:${metadata.metadataId}`);
        };
        const hasExistingElement = (metadataId: string): boolean => {
            return metadataId === 'id-2';
        };
        const updateWebGLContentLayout = (metadata: any): void => {
            callOrder.push(`update-webgl:${metadata.metadataId}`);
        };
        const updateContentLayout = (metadata: any): void => {
            callOrder.push(`update-content:${metadata.metadataId}`);
        };
        const refreshMetadataList = () => {
            callOrder.push('refresh');
        };

        await handleBulkUpdateMetaData(
            metadataList,
            hasExistingElement,
            displayContentOnViewArea,
            updateWebGLContentLayout,
            updateContentLayout,
            refreshMetadataList,
        );

        assert.deepStrictEqual(callOrder, ['display:id-1', 'update-webgl:id-2', 'refresh']);
    });

    it('refreshMetadataList は display が 0 件でも呼ばれること', async () => {
        let refreshCalled = false;
        const hasExistingElement = (_metadataId: string): boolean => false;
        const updateWebGLContentLayout = (_metadata: any): void => {};
        const updateContentLayout = (_metadata: any): void => {};
        const refreshMetadataList = () => { refreshCalled = true; };

        await handleBulkUpdateMetaData(
            [],
            hasExistingElement,
            async (_m) => {},
            updateWebGLContentLayout,
            updateContentLayout,
            refreshMetadataList,
        );

        assert.strictEqual(refreshCalled, true);
    });

    it('displayContentOnViewArea が例外を投げた場合、残りのメタデータも処理されること', async () => {
        const metadataList = [
            { metadataId: 'id-2-fail', zindex: 0, createdAt: '2024-01-02T00:00:00.000Z' },
            { metadataId: 'id-1', zindex: 0, createdAt: '2024-01-01T00:00:00.000Z' },
            { metadataId: 'id-3', zindex: 1, createdAt: '2024-01-03T00:00:00.000Z' },
        ];

        const displayedIds: string[] = [];
        const updatedWebGLIds: string[] = [];
        const updatedContentIds: string[] = [];

        /**
         * ChOWDERClient の displayContentOnViewArea 内は try/catch で囲まれているため
         * 例外は飲み込まれる。ここではその挙動を再現する。
         */
        const displayContentOnViewArea = async (metadata: any) => {
            try {
                if (metadata.metadataId === 'id-2-fail') {
                    throw new Error('simulated failure');
                }
                displayedIds.push(metadata.metadataId);
            } catch {
                // 実装と同様にエラーを飲み込む
            }
        };
        const hasExistingElement = (_metadataId: string): boolean => false;
        const updateWebGLContentLayout = (metadata: any): void => {
            updatedWebGLIds.push(metadata.metadataId);
        };
        const updateContentLayout = (metadata: any): void => {
            updatedContentIds.push(metadata.metadataId);
        };
        const refreshMetadataList = () => {};

        await handleBulkUpdateMetaData(
            metadataList,
            hasExistingElement,
            displayContentOnViewArea,
            updateWebGLContentLayout,
            updateContentLayout,
            refreshMetadataList,
        );

        assert.deepStrictEqual(displayedIds, ['id-1', 'id-3']);
        assert.deepStrictEqual(updatedWebGLIds, []);
        assert.deepStrictEqual(updatedContentIds, []);
    });

    it('既存 webgl は displayContentOnViewArea ではなく updateWebGLContentLayout で更新されること', async () => {
        const metadataList = [
            { metadataId: 'webgl-1', type: 'webgl', zindex: 0, createdAt: '2024-01-01T00:00:00.000Z' },
        ];
        const displayedIds: string[] = [];
        const updatedWebGLIds: string[] = [];
        const updatedContentIds: string[] = [];

        await handleBulkUpdateMetaData(
            metadataList,
            (metadataId: string): boolean => metadataId === 'webgl-1',
            async (metadata: any): Promise<void> => {
                displayedIds.push(metadata.metadataId);
            },
            (metadata: any): void => {
                updatedWebGLIds.push(metadata.metadataId);
            },
            (metadata: any): void => {
                updatedContentIds.push(metadata.metadataId);
            },
            (): void => {},
        );

        assert.deepStrictEqual(displayedIds, []);
        assert.deepStrictEqual(updatedWebGLIds, ['webgl-1']);
        assert.deepStrictEqual(updatedContentIds, []);
    });
});
