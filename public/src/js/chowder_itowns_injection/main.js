/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
import Action from './action';
import Store from './store';

// itownsのresizeイベントを強制的に消す.
let originalAddEventListener = window.addEventListener;
window.resizeListeners = [];
window.addEventListener = function (type, listener, capture) {
    if (type === "resize") {
        window.resizeListeners.push(listener);
    }
    originalAddEventListener(type, listener, capture);
};

let originalRemoveEventListener = window.removeEventListener;
window.removeEventListener = function (type, listener, capture) {
    if (type === "resize" && listener == undefined) {
        for (let i = 0; i < window.resizeListeners.length; ++i) {
            originalRemoveEventListener(type, window.resizeListeners[i], capture);
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
 * @param timeCallback 時刻が変更されたとき呼び出される、function(time) {} 形式のコールバック関数
 */ 
window.injectChOWDER = (view, viewerDiv, timeCallback = null) => {
    let action = new Action();
    let store = new Store(action);
    action.injectChOWDER({
        view : view,
        viewerDiv : viewerDiv,
        timeCallback : timeCallback
    });
};
