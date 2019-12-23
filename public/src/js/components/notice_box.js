/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */


import Button from './button';

class NoticeBox extends EventEmitter {
    constructor(container) {
        super();
        this.noticeList = [];
        this.container = document.createElement('div');
        this.container.className = "notice_box"

        this.title = document.createElement('div');
        this.title.innerText = "New Displays";
        this.title.className = "notice_box_title"
        this.container.appendChild(this.title);

    }

    init() {
    }

    /**
     * noticeboxにidを追加する
     * @method addDisplayPermissionLeaf
     * @param {Object} displayIDList [ displayidA, displayidB, .. ]
     */
    addDisplayPermissionLeaf(displayIDList) {
        for (let k = 0; k < displayIDList.length; ++k) {
            let displayID = displayIDList[k]

            let isFoundDisplayID = false;
            for (let i = 0; i < this.noticeList.length; ++i) {
                isFoundDisplayID = (displayID === this.noticeList[i].displayid);
            }
            // もうあるdisplayidは重複して作らない
            if (isFoundDisplayID) {
                continue;
            }
                
            let notice = {};
            notice.dom = document.createElement("span");
            notice.displayid = displayID;
            notice.dom.classList.add("notice_box_leaf");
    
            let idWrap = document.createElement("div");
            let idText = document.createElement("span");
            idWrap.appendChild(idText);
            idText.textContent = "ID:" + displayID;
            idText.classList.add("notice_box_id_wrap");
    
            notice.dom.appendChild(idWrap);
    
            let buttonWrap = document.createElement("span");
            buttonWrap.classList.add("notice_box_button_wrap");
    
            notice.acceptButton = new Button();
            notice.acceptButton.getDOM().classList.add("notice_box_accept_button");
            notice.acceptButton.setDataKey(i18next.t("allow"));
            notice.acceptCallback = (err) => {
                let displayPermissionList = [{ [displayID]: true }];
                this.emit(NoticeBox.EVENT_NOTICE_ACCEPT, err, displayPermissionList);
            };
            notice.acceptButton.on(Button.EVENT_CLICK, notice.acceptCallback);
    
            notice.rejectButton = new Button();
            notice.rejectButton.getDOM().classList.add("notice_box_reject_button");
            notice.rejectButton.setDataKey(i18next.t("block"));
            notice.rejectCallback = (err) => {
                let displayPermissionList = [{ [displayID]: false }];
                this.emit(NoticeBox.EVENT_NOTICE_REJECT, err, displayPermissionList);
            };
            notice.rejectButton.on(Button.EVENT_CLICK, notice.rejectCallback);
    
            buttonWrap.appendChild(notice.acceptButton.getDOM());
            buttonWrap.appendChild(notice.rejectButton.getDOM());
    
            notice.dom.appendChild(buttonWrap);
    
            this.noticeList.push(notice);    
        }
        this.update();
    }

    /**
     * noticeboxのidを削除する
     * @method deleteDisplayPermissionLeaf
     * @param {Object} displayIDList [ displayidA, displayidB, .. ]
     */

    deleteDisplayPermissionLeaf(displayIDList) {
        for (let k = 0; k < displayIDList.length; ++k) {
            let displayID = displayIDList[k];
            for (let i = this.noticeList.length - 1; i >= 0; --i) {
                let notice = this.noticeList[i];
                if (notice.displayid === displayID) {
                    this.container.removeChild(notice.dom);
                    this.noticeList.splice(i, 1);
                }
            }
        }
        if (this.noticeList.length > 0) {
            this.title.style.color = "white";
        } else {
            this.title.style.color = "#333";
        }
    }

    update() {
        for (let i = 0; i < this.noticeList.length; ++i) {
            let notice = this.noticeList[i];
            this.container.appendChild(notice.dom);
        }
        if (this.noticeList.length > 0) {
            this.title.style.color = "white";
        } else {
            this.title.style.color = "#333";
        }
    }

    getDOM() {
        return this.container;
    }
}

NoticeBox.EVENT_NOTICE_ACCEPT = "notice_accept";
NoticeBox.EVENT_NOTICE_REJECT = "notice_reject";

export default NoticeBox;
