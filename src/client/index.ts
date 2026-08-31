import { initI18n, applyI18n, setLocale, currentLocale, type Locale } from './i18n';

function updateLangButtons(): void {
    const locale = currentLocale();
    const switcher = document.getElementById('index-lang-switcher');
    switcher?.querySelectorAll<HTMLButtonElement>('.lang-seg-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === locale);
    });
}

async function init(): Promise<void> {
    await initI18n();
    applyI18n();
    updateLangButtons();

    const switcher = document.getElementById('index-lang-switcher');
    switcher?.addEventListener('click', async (e: MouseEvent) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lang-seg-btn');
        if (!btn) return;
        const lang = btn.getAttribute('data-lang') as Locale;
        if (lang && lang !== currentLocale()) {
            await setLocale(lang);
            updateLangButtons();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); });
} else {
    init();
}
