/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Store from './store';
import Menu from '../components/menu.js';
 
class GUI extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;
    }

    init() {
        console.log("display_setting gui init");
        
        let menuSetting = [];
        this.headMenu = new Menu("display_setting", menuSetting);
        document.getElementsByClassName('head_menu')[0].appendChild(this.headMenu.getDOM());

        this.store.on(Store.EVENT_CONNECT_SUCCESS, () => {
            console.log("CONNECT_SUCCESS")
        });
    }
}
export default GUI;