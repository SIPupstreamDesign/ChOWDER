/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Translation from '../../../common/translation'

/**
 * 上部メニュー設定
 * GUI(gui.js)にバインドして使用する
 */
function MenuSetting(management) {
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
        }]	
    }, {
        Language : [{
            Japanese : {
                func : () => { 
                    this.store.getCookie().setLanguage("ja-JP");
                    Translation.changeLanguage("ja-JP");
                    Translation.translate();
                }
            }
        }, { 
            English : {
                func : () => {
                    this.store.getCookie().setLanguage("en-US");
                    Translation.changeLanguage("en-US");
                    Translation.translate();
                }
            }
        }]
    }];

    if (management.getAuthorityObject().isAdmin()) {
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
                            let viewURL = "display.html";
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
                            this.openTextInput();
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
                    URL : {
                        func : () => {
                            this.initContextPos();
                            this.contentInputGUI.inputURL();
                        }
                    }
                }, {
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