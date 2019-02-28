/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Constants from '../../../common/constants'

/**
 * 下部タブアイテム
 * GUI(gui.js)にバインドして使用する
 */
function TabSetting() {
    return [
        {
            name : "Display",
            id : Constants.TabIDDisplay,
            onclick : () => { this.changeTab('Display'); },
            active : true,
        },
        {
            name : "Content",
            id : Constants.TabIDContent,
            onclick : () => { this.changeTab('Content'); }
        }, {
            name : "Search",
            id : Constants.TabIDSearch,
            onclick : () => { this.changeTab('Search'); }
        }, {
            name : "Layout",
            id : Constants.TabIDLayout,
            onclick : () => { this.changeTab('Layout'); }
        }
    ]
}

export default TabSetting;