/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

// chowder_itowns_injectionで1jsにeventemitterもまとめたいので、このファイルでは直接importする
import EventEmitter from '../../../3rd/js/eventemitter3/index.js'

class Action extends EventEmitter
{
    constructor()
    {
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
     * itownsにinjectする
     * @param {*} data  
     * @param data.view itownsのviewインスタンス. GlobeViewやPlanarViewなど.
     * @param data.viewerDiv itownsのviewerのdiv
     */
    injectChOWDER(data) {
        this.emit(Action.EVENT_INJECT_CHOWDER, null, data);
    }
}

Action.EVENT_INJECT_CHOWDER = "injectChOWDER";

export default Action;