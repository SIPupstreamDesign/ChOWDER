import type { ContentMetadata, ContentUpdateData } from '../types';
import { MetadataListBadgeRenderer } from './renderers/MetadataListBadgeRenderer';

/**
 * Visible状態変更時の結果データ
 */
export interface VisibleStateChangeData {
    metadataId: string;
    newVisibleState: boolean;
    updateStock: ContentUpdateData;
}

/**
 * UI要素への参照集合
 */
export interface VisibleStateUIElements {
    contentVisibleCheckbox: HTMLElement;
    metadataListItem: HTMLElement | null;
    badge: HTMLElement | null;
}

/**
 * Visible状態の一元管理・同期を担当
 */
export class VisibleStateManager {
    /**
     * Visible状態をトグル
     */
    toggleVisible(
        metadataId: string,
        metadataList: ContentMetadata[],
        uiElements: VisibleStateUIElements,
        badgeRenderer: MetadataListBadgeRenderer,
        onStateChanged: (data: VisibleStateChangeData) => void
    ): VisibleStateChangeData | null {
        const metadata = metadataList.find(m => m.metadataId === metadataId);
        if (!metadata) return null;

        const newVisible = metadata.visible === false ? true : false;

        // メタデータ更新
        this.updateMetadataList(metadataList, metadataId, newVisible);

        // UI同期
        this.syncUICheckbox(uiElements.contentVisibleCheckbox, newVisible);
        this.updateItemVisibility(uiElements.metadataListItem, newVisible);

        // バッジ更新
        if (uiElements.badge) {
            badgeRenderer.updateBadgeVisibility(uiElements.badge, newVisible);
        }

        // 更新データ生成
        const updateStock = this.buildUpdateStock(metadataId, metadataList, newVisible);

        const result: VisibleStateChangeData = {
            metadataId,
            newVisibleState: newVisible,
            updateStock,
        };

        onStateChanged(result);
        return result;
    }

    /**
     * チェックボックス変更時にメタデータを同期
     */
    syncMetadataFromCheckbox(
        metadataId: string,
        metadataList: ContentMetadata[],
        checkboxChecked: boolean,
        uiElements: VisibleStateUIElements,
        badgeRenderer: MetadataListBadgeRenderer,
        onStateChanged: (data: VisibleStateChangeData) => void
    ): VisibleStateChangeData | null {
        const metadata = metadataList.find(m => m.metadataId === metadataId);
        if (!metadata) return null;

        // メタデータ更新
        this.updateMetadataList(metadataList, metadataId, checkboxChecked);

        // UI同期
        this.updateItemVisibility(uiElements.metadataListItem, checkboxChecked);

        // バッジ更新
        if (uiElements.badge) {
            badgeRenderer.updateBadgeVisibility(uiElements.badge, checkboxChecked);
        }

        // 更新データ生成
        const updateStock = this.buildUpdateStock(metadataId, metadataList, checkboxChecked);

        const result: VisibleStateChangeData = {
            metadataId,
            newVisibleState: checkboxChecked,
            updateStock,
        };

        onStateChanged(result);
        return result;
    }

    /**
     * _metadataList の visible フラグを更新
     */
    private updateMetadataList(metadataList: ContentMetadata[], metadataId: string, visible: boolean): void {
        const metadata = metadataList.find(m => m.metadataId === metadataId);
        if (metadata) {
            metadata.visible = visible;
        }
    }

    /**
     * contentVisible チェックボックスを同期
     */
    private syncUICheckbox(checkboxElm: HTMLElement, visible: boolean): void {
        if (checkboxElm) {
            checkboxElm.dataset.checked = String(visible);
            (checkboxElm as any).checked = visible;
        }
    }

    /**
     * メタデータリスト項目の表示状態を同期
     */
    private updateItemVisibility(itemElm: HTMLElement | null, visible: boolean): void {
        if (!itemElm) return;
        itemElm.dataset.visible = String(visible);
    }

    /**
     * サーバー送信用の更新データを生成
     */
    private buildUpdateStock(metadataId: string, metadataList: ContentMetadata[], visible: boolean): ContentUpdateData {
        const metadata = metadataList.find(m => m.metadataId === metadataId);

        return {
            metadataId,
            binaryId: metadata?.binaryId ?? '',
            type: 'content',
            contentType: (metadata as any)?.contentType ?? '',
            posx: metadata?.posx ?? 0,
            posy: metadata?.posy ?? 0,
            width: metadata?.width ?? 0,
            height: metadata?.height ?? 0,
            visible,
            originWidth: (metadata as any)?.originWidth ?? metadata?.width ?? 0,
            originHeight: (metadata as any)?.originHeight ?? metadata?.height ?? 0,
            zindex: (metadata as any)?.zindex ?? 1,
        };
    }
}
