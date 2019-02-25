/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
class NoticeBox extends EventEmitter {
    constructor(container){
        super();
        this.noticeList = [];
        this.container = container;
    }

    init(){
    }

    addDisplayPermissionLeaf(logindata){
        let notice = {};
        notice.dom = document.createElement("span");
        notice.logindata = logindata;
        notice.dom.classList.add("notice_box_leaf");


        let idWrap = document.createElement("span");
        idWrap.textContent = "ID:" + logindata.displayid;
        idWrap.classList.add("notice_box_id_wrap");

        notice.dom.appendChild(idWrap);


        let buttonWrap = document.createElement("span");
        buttonWrap.classList.add("notice_box_button_wrap");

        let acceptButton = document.createElement("span");
        acceptButton.classList.add("notice_box_accept_button");
        acceptButton.textContent = "accept";
        acceptButton.addEventListener("click",(err)=>{
            logindata.permission = true;
            this.emit(NoticeBox.EVENT_NOTICE_ACCEPT, err, logindata);
        },false);

        let rejectButton = document.createElement("span");
        rejectButton.classList.add("notice_box_reject_button");
        rejectButton.textContent = "reject";
        rejectButton.addEventListener("click",(err)=>{
            logindata.permission = false;
            this.emit(NoticeBox.EVENT_NOTICE_REJECT, err, logindata);
        },false);
        buttonWrap.appendChild(acceptButton);
        buttonWrap.appendChild(rejectButton);

        notice.dom.appendChild(buttonWrap);

        this.noticeList.push(notice);

        this.update();
    }

    deleteDisplayPermissionLeaf(logindata){
        for(let i in this.noticeList){
            if(this.noticeList[i].logindata.displayid === logindata.displayid){
                // console.log("deletDisplayPermissionLeaf",this.noticeList[i].logindata.displayid);
                this.container.removeChild(this.noticeList[i].dom);
                this.noticeList.splice(i,1);
                // TODO:leak?
            }
        }
    }

    update(){
        for(let i of this.noticeList){
            this.container.appendChild(i.dom);
        }
    }
}

NoticeBox.EVENT_NOTICE_ACCEPT = "notice_accept";
NoticeBox.EVENT_NOTICE_REJECT = "notice_reject";

export default NoticeBox;
