import './controller.css';
import { ChOWDERClient } from './ChOWDERClient';
import { initI18n, applyI18n } from '../i18n';

declare global {
    interface Window {
        chowderClientInitialized?: boolean;
    }
}

async function init() {
    await initI18n();
    applyI18n();
    document.body.style.visibility = 'visible';

    if (!window.chowderClientInitialized) {
        console.log('DOM loaded, initializing client...');
        window.chowderClientInitialized = true;
        new ChOWDERClient();
    } else {
        console.warn('Client already initialized, skipping...');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); });
} else {
    init();
}
