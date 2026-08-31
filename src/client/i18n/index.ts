import i18next from 'i18next';
import en from './locales/en';
import ja from './locales/ja';

export type Locale = 'en' | 'ja';
export type TranslationKey = keyof typeof en;

const LOCALE_STORAGE_KEY = 'chowder_locale';

export async function initI18n(): Promise<void> {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
    const lng: Locale = saved ?? 'en';

    await i18next.init({
        lng,
        fallbackLng: 'en',
        resources: {
            en: { translation: en },
            ja: { translation: ja },
        },
    });
}

export function t(key: TranslationKey): string {
    return i18next.t(key);
}

export async function setLocale(locale: Locale): Promise<void> {
    await i18next.changeLanguage(locale);
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    applyI18n();
}

export function currentLocale(): Locale {
    return i18next.language as Locale;
}

export function applyI18n(): void {
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n') as TranslationKey;
        el.textContent = t(key);
    });
}
