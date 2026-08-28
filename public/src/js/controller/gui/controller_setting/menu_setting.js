/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Translation from '../../../common/translation'
import ContentUtil from '../../content_util';

/**
 * 上部メニュー設定
 * GUI(gui.js)にバインドして使用する
 */
async function MenuSetting(management) {
    let settingMenu = [{
        VirtualDisplay : {
            func : () => {
                document.getElementById('display_tab_link').click();
                this.action.clickVirtualDisplay()
            }
        },
    }, {
        RemoteCursor : [{
            ON : {
                func : () => { this.action.updateRemoteCursor({isEnable : true}); }
            }
        }, {
            OFF : {
                func : () => { this.action.updateRemoteCursor({isEnable : false}); }
            }
        }, {
            Color : {
                // カーソルカラーの変更
                func : this.changeRemoteCursorColor.bind(this)
            }
        }, {
            Size : {
                // カーソルサイズの変更
                func : this.changeRemoteCursorSize.bind(this)
            }
        }]
    }, {
        Language : [{
            Japanese : {
                func : () => {
                    this.store.getCookie().setLanguage("ja_JP");
                    Translation.changeLanguage("ja_JP");
                    Translation.translate();
                }
            }
        }, {
            English : {
                func : () => {
                    this.store.getCookie().setLanguage("en_US");
                    Translation.changeLanguage("en_US");
                    Translation.translate();
                }
            }
        }]
    }];

    if (await management.isModerator() || management.getAuthorityObject().isAdmin()) {
        settingMenu.push( {
            Management : {
                func : () => { this.showManagementGUI(true); }
            }
        });
    }

    return [
        {
            Controller : [{
                    Display : {
                        func : () => {
                            let viewURL = "display.html?id=" + ContentUtil.generateID();
                            window.open(viewURL);
                        }
                    },
                }],
            url : "controller.html"
        },
        {
            Add : [{
                    Image : {
                        func : () => {
                            this.initContextPos();
                            this.contentInputGUI.inputImageFile();
                        }
                    }
                }, {
                    Movie : {
                        func : () => {
                            this.initContextPos();
                            this.contentInputGUI.inputVideoFile();
                        }
                    }
                }, {
                    Text : {
                        func : () => {
                            this.initContextPos();
                            this.contentInputGUI.inputText();
                        }
                    },
                }, {
                    TextFile : {
                        func : () => {
                            this.initContextPos();
                            this.contentInputGUI.inputTextFile();
                        }
                    },
                }, {
                    PDF : {
                        func : () => {
                            this.initContextPos();
                            this.contentInputGUI.inputPDFFile();
                        }
                    },
                }, {
                    Tileimage : {
                        func : () => {
                            this.initContextPos();
                            this.contentInputGUI.inputTileimageFile();
                        }
                    },
                }, {
                    URL : {
                        func : () => {
                            this.initContextPos();
                            this.contentInputGUI.inputURL();
                        }
                    }
                },
                /* {
                    WebGL : {
                        func : () => {
                            this.initContextPos();
                            this.contentInputGUI.inputWebGL();
                        }
                    }
                },*/ {
                    ScreenShare : {
                        func : () => {
                            this.initContextPos();
                            this.contentInputGUI.inputScreenShare();
                        }
                    }
                }, {
                    CameraShare : {
                        func : () => {
                            this.initContextPos();
                            this.contentInputGUI.inputCameraShare();
                        }
                    }
                }],
        },
        {
            Setting : settingMenu
        }
    ];
}

export default MenuSetting;