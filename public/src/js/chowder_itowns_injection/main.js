
import Action from './action';
import Store from './store';

// itownsのresizeイベントを強制的に消す.
let originalAddEventListener = window.addEventListener;
let resizeListeners = [];
window.addEventListener = function (type, listener, capture) {
    if (type === "resize") {
        resizeListeners.push(listener);
    }
    originalAddEventListener(type, listener, capture);
};

let originalRemoveEventListener = window.removeEventListener;
window.removeEventListener = function (type, listener, capture) {
    if (type === "resize" && listener == undefined) {
        for (let i = 0; i < resizeListeners.length; ++i) {
            originalRemoveEventListener(type, resizeListeners[i], capture);
        }
        resizeListeners = [];
    } else {
        originalRemoveEventListener(type, listener, capture);
    }
};

/**
 * itownsを使ったwebアプリケーションをchowder対応するための関数
 * injectChOWDER(view, viewerDiv); と呼び出す
 * @param view itownsのviewインスタンス. GlobeViewやPlanarViewなど.
 * @param viewerDiv itownsのviewerのdiv
 */ 
window.injectChOWDER = (view, viewerDiv) => {
    let action = new Action();
    let store = new Store(action);
    action.injectChOWDER({
        view : view,
        viewerDiv : viewerDiv
    });
};
