/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */


import Button from './button';

class NoticeBox extends EventEmitter {
    constructor(container){
        super();
        this.noticeList = [];
        this.container = document.createElement('div');
        this.container.className = "notice_box"
        
        this.title = document.createElement('div');
        this.title.innerText = "New Displays";
        this.title.className = "notice_box_title"
        this.container.appendChild(this.title);

    }

    init(){
    }

    addDisplayPermissionLeaf(logindata){
        for(let i = 0; i < this.noticeList.length; ++i){
            if(logindata.displayid === this.noticeList[i].logindata.displayid){
                // もうあるdisplayidは重複して作らない
                return;
            }
        }
        let notice = {};
        notice.dom = document.createElement("span");
        notice.logindata = logindata;
        notice.dom.classList.add("notice_box_leaf");


        let idWrap = document.createElement("div");
        let idText = document.createElement("span");
        idWrap.appendChild(idText);
        idText.textContent = "ID:" + logindata.displayid;
        idText.classList.add("notice_box_id_wrap");

        notice.dom.appendChild(idWrap);


        let buttonWrap = document.createElement("span");
        buttonWrap.classList.add("notice_box_button_wrap");

        notice.acceptButton = new Button();
        notice.acceptButton.getDOM().classList.add("notice_box_accept_button");
        notice.acceptButton.setDataKey("accept"); // todo translation
        notice.acceptCallback = (err)=>{
            logindata.permission = true;
            this.emit(NoticeBox.EVENT_NOTICE_ACCEPT, err, logindata);
        };
        notice.acceptButton.on(Button.EVENT_CLICK, notice.acceptCallback);

        notice.rejectButton = new Button();
        notice.rejectButton.getDOM().classList.add("notice_box_reject_button");
        notice.rejectButton.setDataKey("reject"); // todo translation
        notice.rejectCallback = (err)=>{
            logindata.permission = false;
            this.emit(NoticeBox.EVENT_NOTICE_REJECT, err, logindata);
        };
        notice.rejectButton.on(Button.EVENT_CLICK, notice.rejectCallback);

        buttonWrap.appendChild(notice.acceptButton.getDOM());
        buttonWrap.appendChild(notice.rejectButton.getDOM());

        notice.dom.appendChild(buttonWrap);

        this.noticeList.push(notice);

        this.update();
    }

    deleteDisplayPermissionLeaf(logindata){
        for(let i = 0; i < this.noticeList.length; ++i){
            let notice = this.noticeList[i];
            if(notice.logindata.displayid === logindata.displayid){
                this.container.removeChild(notice.dom);
                this.noticeList.splice(i,1);
            }
        }
        if (this.noticeList.length > 0) {
            this.title.style.color = "white";
        } else {
            this.title.style.color = "#333";
        }
    }

    update(){
        for(let i = 0; i < this.noticeList.length; ++i){
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
