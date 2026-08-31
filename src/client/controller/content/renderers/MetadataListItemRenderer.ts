import type { ContentMetadata } from '../../types';

/**
 * リスト項目の生成設定
 */
export interface MetadataListItemConfig {
    metadata: ContentMetadata;
    isSelected: boolean;
    thumbnailUrl?: string;
    textPreview?: { value: string; fontColor: string };
    badgeElement: HTMLElement;
}

/**
 * ContentsListのメタデータリスト項目（サムネイル+バッジ）の描画を担当
 */
export class MetadataListItemRenderer {
    /**
     * リスト項目（item div）を生成
     */
    createListItem(config: MetadataListItemConfig): HTMLElement {
        const item = document.createElement('div');
        item.className = 'metadata-item';
        item.dataset.metadataId = config.metadata.metadataId;
        item.dataset.type = config.metadata.type;
        item.dataset.visible = String(config.metadata.visible !== false);

        if (config.isSelected) {
            item.classList.add('selected');
        }

        // テキストプレビューを適用
        if (config.textPreview) {
            this.applyTextPreview(item, config.textPreview.value, config.textPreview.fontColor);
        } else if (config.thumbnailUrl) {
            // サムネイル背景を適用
            this.applyThumbnail(item, config.thumbnailUrl);
        }

        // オーバーレイ（コンテンツ名・タイプ）を追加
        const overlay = this.createOverlayElement(config.metadata);
        item.appendChild(overlay);

        // バッジを追加
        item.appendChild(config.badgeElement);

        return item;
    }

    /**
     * 既存項目の選択状態・表示状態を更新
     */
    updateItemState(item: HTMLElement, isSelected: boolean, isVisible: boolean): void {
        item.dataset.visible = String(isVisible);
        item.style.display = isVisible ? 'block' : 'none';

        if (isSelected) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    }

    /**
     * テキストプレビューをアイテムに追加
     */
    applyTextPreview(item: HTMLElement, value: string, fontColor: string): void {
        // 既存のテキストプレビューがあれば削除
        const existing = item.querySelector('.metadata-item-text-preview');
        if (existing) existing.remove();

        const pre = document.createElement('pre');
        pre.className = 'metadata-item-text-preview';
        pre.textContent = value;
        pre.style.color = fontColor;

        item.appendChild(pre);
    }

    /**
     * サムネイル背景をアイテムに適用
     */
    applyThumbnail(item: HTMLElement, dataUrl: string): void {
        // テキストタイプは background-image を適用しない
        if (item.dataset.type !== 'text') {
            item.style.backgroundImage = `url(${dataUrl})`;
        }
    }

    /**
     * オーバーレイ要素（コンテンツ名・タイプ）を生成
     */
    private createOverlayElement(metadata: ContentMetadata): HTMLElement {
        const overlay = document.createElement('div');
        overlay.className = 'metadata-item-overlay';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'metadata-item-name';
        nameDiv.textContent = (metadata as any).streamName ?? metadata.metadataId;

        const typeDiv = document.createElement('div');
        typeDiv.className = 'metadata-item-type';
        typeDiv.textContent = metadata.type;

        overlay.appendChild(nameDiv);
        overlay.appendChild(typeDiv);

        return overlay;
    }
}
