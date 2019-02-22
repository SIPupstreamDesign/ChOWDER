class NoticeBox extends EventEmitter {
    constructor(container){
        super();
        this.noticeList = [];
        this.container = container;
    }

    init(){
    }

    addDisplayPermission(displayid){
        let notice = {};
        notice.dom = document.createElement("span");
        notice.dom.textContent = "ID:" + displayid;
        notice.displayid = displayid;
        notice.dom.classList.add("notice_box_leaf")

        this.noticeList.push(notice);

        this.update();
    }

    update(){
        console.log("container",this.container)
        for(let i of this.noticeList){
            console.log("uopdate",i)
            this.container.appendChild(i.dom);
        }
    }
}

export default NoticeBox;
