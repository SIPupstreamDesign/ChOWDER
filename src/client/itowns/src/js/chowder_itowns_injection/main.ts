/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import { ITownsInjectionController } from './itowns_injection_controller';

// itownsのresizeイベントを強制的に消す
const originalAddEventListener = window.addEventListener.bind(window);
window.resizeListeners = [];
(window as any).addEventListener = (type: string, listener: any, capture?: any) => {
    if (type === 'resize') {
        window.resizeListeners.push(listener);
    }
    originalAddEventListener(type, listener, capture);
};

const originalRemoveEventListener = window.removeEventListener.bind(window);
(window as any).removeEventListener = (type: string, listener: any, capture?: any) => {
    if (type === 'resize' && listener === undefined) {
        for (const l of window.resizeListeners) {
            originalRemoveEventListener(type, l as EventListener, capture);
        }
        window.resizeListeners = [];
    } else {
        originalRemoveEventListener(type, listener, capture);
    }
};

/**
 * itownsを使ったwebアプリケーションをchowder対応するための関数
 * injectChOWDER(view, viewerDiv); と呼び出す
 * @param view itownsのviewインスタンス. GlobeViewやPlanarViewなど.
 * @param viewerDiv itownsのviewerのdiv
 * @param timeCallback 時刻が変更されたとき呼び出される function(time) {} 形式のコールバック関数
 */
window.injectChOWDER = (view: any, viewerDiv: HTMLElement, timeCallback: ((date: Date) => void) | null = null) => {
    new ITownsInjectionController(view, viewerDiv, timeCallback);
};
