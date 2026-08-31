/**
 * ConnectionScreen
 * 接続画面・承認待ち画面・拒否画面・ローディング表示・メニューバーの
 * UI 初期化と表示制御を担うクラス。
 * Cookie を使った表示名の履歴管理も含む。
 */

import { setLocale, currentLocale, applyI18n, t, type Locale } from '../i18n';

export interface ConnectionCallbacks {
    /** 接続ボタン押下時。displayName と displayId を渡す */
    onConnect: (displayName: string, displayId: string) => void;
    /** 表示名変更ボタン押下時 */
    onChangeDisplayName: (displayName: string) => void;
}

export class ConnectionScreen {
    constructor(private readonly callbacks: ConnectionCallbacks) {
        this.initLoginPage();
        this.initChangeDisplayNameForm();
        this.initFullscreenButton();
        this.initControllerButton();
        this.initLangSwitcher();

        const rejectedReloadBtn = document.getElementById('rejected-reload-btn');
        rejectedReloadBtn?.addEventListener('click', () => {
            window.location.reload();
        });
    }

    // ----------------------------------------------------------------
    // 公開メソッド（DisplayClient から呼ばれる）
    // ----------------------------------------------------------------

    hideConnectionScreen(): void {
        const screen = document.getElementById('connection-screen');
        screen?.classList.add('hidden');
    }

    private updateLangButtons(): void {
        const locale = currentLocale();
        const switcher = document.getElementById('display-lang-switcher');
        switcher?.querySelectorAll<HTMLButtonElement>('.lang-seg-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === locale);
        });
    }

    private updatePlaceholder(): void {
        const input = document.getElementById('display-name-input') as HTMLInputElement | null;
        if (input) input.placeholder = t('displayNamePlaceholder');
    }

    private initLangSwitcher(): void {
        this.updateLangButtons();
        this.updatePlaceholder();
        const switcher = document.getElementById('display-lang-switcher');
        switcher?.addEventListener('click', async (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lang-seg-btn');
            if (!btn) return;
            const lang = btn.getAttribute('data-lang') as Locale;
            if (lang && lang !== currentLocale()) {
                await setLocale(lang);
                this.updateLangButtons();
                this.updatePlaceholder();
            }
        });
    }

    showWaitingScreen(displayName: string): void {
        const screen = document.getElementById('waiting-screen');
        const displayIdElem = document.getElementById('waiting-display-id');
        if (screen && displayIdElem) {
            displayIdElem.textContent = displayName;
            screen.classList.add('show');
        }
        this.showLoading(false);
    }

    hideWaitingScreen(): void {
        const screen = document.getElementById('waiting-screen');
        screen?.classList.remove('show');
    }

    showRejectedScreen(): void {
        this.hideWaitingScreen();
        this.showLoading(false);
        history.replaceState(null, '', window.location.pathname);
        const screen = document.getElementById('rejected-screen');
        screen?.classList.add('show');
    }

    showLoading(show: boolean): void {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.className = show ? '' : 'hidden';
        }
    }

    /**
     * 承認後に表示名変更フォームの初期値を設定し、Cookie を更新する
     */
    onApproved(displayName: string): void {
        this.saveDisplayNameToCookie(displayName);
        const input = document.getElementById('change-display-name-input') as HTMLInputElement | null;
        if (input) input.value = displayName;
    }

    // ----------------------------------------------------------------
    // 初期化（private）
    // ----------------------------------------------------------------

    private initLoginPage(): void {
        console.log('initLoginPage');
        const connectButton = document.getElementById('connect-btn');
        const displayNameInput = document.getElementById('display-name-input') as HTMLInputElement;
        const datalist = document.getElementById('display-name-list') as HTMLDataListElement;

        this.populateDatalistFromCookie(datalist);

        connectButton?.addEventListener('click', () => {
            const displayName = displayNameInput.value;
            const displayId = self.crypto.randomUUID().slice(0, 7);
            this.callbacks.onConnect(displayName, displayId);
        });
    }

    /** URLパラメータに displayName があれば自動接続する。構築後に呼ぶこと */
    connectIfUrlParam(): void {
        const urlDisplayName = new URLSearchParams(window.location.search).get('displayName');
        if (urlDisplayName) {
            const displayId = self.crypto.randomUUID().slice(0, 7);
            this.callbacks.onConnect(urlDisplayName, displayId);
        }
    }

    private initFullscreenButton(): void {
        const btn = document.getElementById('full-screen-button') as HTMLButtonElement;
        btn?.addEventListener('click', () => this.toggleFullScreen());
    }

    private toggleFullScreen(): void {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }

    private initControllerButton(): void {
        const btn = document.getElementById('controller-button') as HTMLButtonElement;
        btn?.addEventListener('click', () => {
            window.location.href = window.location.origin + window.location.pathname.replace('/display.html', '');
        });
    }

    private initChangeDisplayNameForm(): void {
        const changeBtn = document.getElementById('change-display-btn');
        const displayNameInput = document.getElementById('change-display-name-input') as HTMLInputElement;
        const datalist = document.getElementById('change-display-name-list') as HTMLDataListElement;

        this.populateDatalistFromCookie(datalist);

        changeBtn?.addEventListener('click', () => {
            this.callbacks.onChangeDisplayName(displayNameInput.value);
        });
    }

    // ----------------------------------------------------------------
    // Cookie ヘルパー（private）
    // ----------------------------------------------------------------

    private readDisplayNameCookie(): string[] {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const key = cookie.split('=')[0]?.trim();
            if (key === 'displayName') {
                return (cookie.split('=')[1] ?? '').split(':').filter(Boolean);
            }
        }
        return [];
    }

    private populateDatalistFromCookie(datalist: HTMLDataListElement | null): void {
        if (!datalist) return;
        const names = this.readDisplayNameCookie();
        for (const name of names) {
            const option = document.createElement('option');
            option.text = name;
            datalist.appendChild(option);
        }
    }

    private saveDisplayNameToCookie(displayName: string): void {
        const existing = this.readDisplayNameCookie().filter(n => n !== displayName);
        // 最大5件保持（新しいものを先頭に）
        const list = [displayName, ...existing].slice(0, 5);
        document.cookie = 'displayName=' + list.join(':');
    }
}
