/**
 * ContentsListのサムネイルバッジ（Visible状態表示）の描画・更新を担当
 */
export class MetadataListBadgeRenderer {
    /**
     * バッジ要素を生成（初回作成用）
     * @param isVisible 表示状態
     * @param onClickCallback クリック時のコールバック
     */
    createBadgeElement(isVisible: boolean, onClickCallback: () => void): HTMLElement {
        const badge = document.createElement('div');
        badge.className = 'metadata-item-visible-badge';
        badge.dataset.visible = String(isVisible);

        const svg = this.createSvgIcon(isVisible);
        badge.innerHTML = svg;

        this.attachClickHandler(badge, onClickCallback);

        return badge;
    }

    /**
     * 既存バッジ要素の表示内容を更新
     * @param badgeElement 更新対象のバッジ要素
     * @param isVisible 新しい表示状態
     */
    updateBadgeVisibility(badgeElement: HTMLElement, isVisible: boolean): void {
        badgeElement.dataset.visible = String(isVisible);
        const svg = badgeElement.querySelector('svg') as SVGElement | null;
        if (svg) {
            svg.innerHTML = this.createSvgPathContent(isVisible);
        }
    }

    /**
     * SVG要素の HTML を生成
     */
    private createSvgIcon(isVisible: boolean): string {
        const pathContent = this.createSvgPathContent(isVisible);
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${pathContent}
        </svg>`;
    }

    /**
     * SVG path 内容を生成（目アイコンまたは目with斜線）
     */
    private createSvgPathContent(isVisible: boolean): string {
        if (isVisible) {
            return '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        } else {
            return '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        }
    }

    /**
     * バッジ要素にクリックハンドラーを登録
     */
    private attachClickHandler(badge: HTMLElement, callback: () => void): void {
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            callback();
        });
    }
}
