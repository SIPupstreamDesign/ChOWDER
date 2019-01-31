
import Constants from '../../../common/constants'

/**
 * レイアウト設定
 */
function LayoutSetting() {
    let bigZIndex = 10000;
    let splitterSize = Constants.IsMobile ? 10 : 5;
    let splitterSizeStr = splitterSize + "px";

    return {
        className : 'layout',
        direction : 'horizontal',
        color : 'rgb(112, 180, 239)',
        contents : [
            {
                className : 'head_menu',
                position : 'top',
                size : "30px",
                minSize : "30px",
                zIndex : 1000000
            },
            {
                className : 'layout2',
                size : "-253px",
                direction : 'vertical',
                contents : [
                    {
                        className : 'preview_area',
                        size : "-263px"
                    },
                    {
                        size : splitterSizeStr,
                        splitter : splitterSizeStr,
                        zIndex : bigZIndex
                    },
                    {
                        className : 'rightArea',
                        position : 'right',
                        size : "260px",
                        minSize : "150px"
                    }
                ]
            },
            {
                size : splitterSizeStr,
                splitter : splitterSizeStr,
                zIndex : bigZIndex
            },
            {
                className : 'bottom_area',
                size : "220px",
                minSize : "100px"
            }]
    }
}

export default LayoutSetting