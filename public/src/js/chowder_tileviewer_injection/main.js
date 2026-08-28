/**
 * Copyright (c) 2021 National Institute of Information and Communications Technology (NICT). All rights reserved.
 */
import Action from './action';
import Store from './store';

/**
 * tileviewerを使ったwebアプリケーションをchowder対応するための関数
 * injectChOWDER(viewerDiv); と呼び出す
 * @param instance TileViewerのinstance
 * @param viewerDiv viewerのdiv
 * @param timeCallback 時刻が変更されたとき呼び出される、function(time) {} 形式のコールバック関数
 */
window.injectChOWDER = (instance, viewerDiv, timeCallback = null) => {
    let action = new Action();
    let store = new Store(action);
    action.injectChOWDER({
        instance: instance,
        viewerDiv: viewerDiv,
        timeCallback: timeCallback
    });
};