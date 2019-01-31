import Constants from '../../../common/constants'

/**
 * 下部タブアイテム
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