/**
 * Admin button pending-display badge controller.
 */
export class AdminPendingBadge {
    private badgeElement: HTMLSpanElement | null = null;

    init(targetButton: HTMLElement | null): void {
        if (targetButton === null) {
            return;
        }

        const existingBadge = targetButton.querySelector('.admin-pending-badge');
        if (existingBadge instanceof HTMLSpanElement) {
            this.badgeElement = existingBadge;
            this.setVisible(false);
            return;
        }

        const badge = document.createElement('span');
        badge.className = 'admin-pending-badge';
        badge.setAttribute('aria-hidden', 'true');
        targetButton.appendChild(badge);

        this.badgeElement = badge;
        this.setVisible(false);
    }

    setVisible(visible: boolean): void {
        if (this.badgeElement === null) {
            return;
        }
        this.badgeElement.style.display = visible ? 'block' : 'none';
    }
}

export default new AdminPendingBadge();