/**
 * Copyright (c) 2021 National Institute of Information and Communications Technology (NICT). All rights reserved.
 */

// chowder_tileviewer_injectionで1jsにeventemitterもまとめたいので、このファイルでは直接importする
import EventEmitter from '../../../3rd/js/eventemitter3/index.js'

class Action extends EventEmitter {
    constructor() {
        super();
    }

    // デバッグ用. release版作るときは消す
    emit() {
        if (arguments.length > 0) {
            if (!arguments[0]) {
                console.error("Not found EVENT NAME!");
            }
        }
        super.emit(...arguments);
    }

    /**
     * tileviewerにinjectする
     * @param {*} data  
     * @param data.viewerDiv tileviewerのviewerのdiv
     */
    injectChOWDER(data) {
        this.emit(Action.EVENT_INJECT_CHOWDER, null, data);
    }
}

Action.EVENT_INJECT_CHOWDER = "injectChOWDER";

export default Action;