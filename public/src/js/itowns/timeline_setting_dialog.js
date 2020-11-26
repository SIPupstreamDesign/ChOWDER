/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

import PopupBackground from "../components/popup_background";
import Button from "../components/button";
import DateInput from "../components/date_input";

class TimelineSettingDialog extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;

        this.setting = {};

        this.init();

    }

    init() {

        this.dom = document.createElement('div');
        this.dom.className = "timeline_setting_dialog";

        this.wrap = document.createElement('div');
        this.wrap.className = "timeline_setting_dialog_wrap";

        let createRow = () => {
            let row = document.createElement('div');
            row.className = "timeline_setting_row";
            this.wrap.appendChild(row);
            return row;
        }

        {
            this.title = document.createElement('p');
            this.title.className = "timeline_setting_dialog_title";
            this.title.innerText = 'Timeline Setting';
            this.wrap.appendChild(this.title)
        }

        {
            let row = createRow();
            this.startDate = new DateInput();
            this.startDate.getDOM().style.left = "100px"
            this.startDate.getDOM().style.position = "absolute"
            row.appendChild(this.startDate.getDOM());
            this.startDateLabel = document.createElement('p');
            this.startDateLabel.innerText = 'Start Date';
            row.appendChild(this.startDateLabel);
            row.style.top = "60px"
            row.style.left = "40px"
            row.style.position = "absolute"
        }

        {
            let row = createRow();
            this.endDate = new DateInput();
            this.endDate.getDOM().style.left = "100px"
            this.endDate.getDOM().style.position = "absolute"
            row.appendChild(this.endDate.getDOM());
            this.endDateLabel = document.createElement('p');
            this.endDateLabel.innerText = 'End Date';
            row.appendChild(this.endDateLabel);
            row.style.top = "100px"
            row.style.left = "40px"
            row.style.position = "absolute"
        }

        {
            let row = createRow();
            this.rangeStart = new DateInput();
            this.rangeStart.getDOM().style.left = "100px"
            this.rangeStart.getDOM().style.position = "absolute"
            row.appendChild(this.rangeStart.getDOM());
            this.rangeStartLabel = document.createElement('p');
            this.rangeStartLabel.innerText = 'Range Start';
            row.appendChild(this.rangeStartLabel);
            row.style.top = "140px"
            row.style.left = "40px"
            row.style.position = "absolute"
        }

        {
            let row = createRow();
            this.rangeEnd = new DateInput();
            this.rangeEnd.getDOM().style.left = "100px"
            this.rangeEnd.getDOM().style.position = "absolute"
            row.appendChild(this.rangeEnd.getDOM());
            this.rangeEndLabel = document.createElement('p');
            this.rangeEndLabel.innerText = 'Range End';
            row.appendChild(this.rangeEndLabel);
            row.style.top = "180px"
            row.style.left = "40px"
            row.style.position = "absolute"
        }

        this.okButton = new Button();
        this.okButton.setDataKey("OK");
        this.okButton.getDOM().className = "layer_dialog_ok_button btn btn-primary";
        this.dom.appendChild(this.okButton.getDOM());

        this.cancelButton = new Button();
        this.cancelButton.setDataKey("Cancel");
        this.cancelButton.getDOM().className = "layer_dialog_cancel_button btn btn-light";
        this.dom.appendChild(this.cancelButton.getDOM());

        this.dom.appendChild(this.wrap);


        this.endCallback = null;
        let isOK = false;
        this.background = new PopupBackground();
        this.background.on('close', () => {
            this.data = {
                start: this.startDate.getDate(),
                end: this.endDate.getDate()
            };
            if (this.store.getTimelineRangeBar()) {
                this.data.rangeStartTime = this.rangeStart.getDate();
                this.data.rangeEndTime = this.rangeEnd.getDate();
            }
            
            console.log("close", this.data);

            if (this.endCallback) {
                this.endCallback(isOK, this.data);
                this.endCallback = null;
            }
            this.close();
        });
        this.okButton.on('click', () => {
            console.log("OK")
            isOK = true;
            this.background.close();
        });

        this.cancelButton.on('click', () => {
            console.log("Cancel")
            isOK = false;
            this.background.close();
        });
    }

    close() {
        this.dom.style.display = "none";
    }

    show(endCallback) {
        //this.idInput.setValue("Layer_" + Math.floor(Math.random() * 100));
        this.startDate.setDate(this.store.getTimelineStartTime());
        this.endDate.setDate(this.store.getTimelineEndTime());

        if (this.store.getTimelineRangeBar()) {
            this.dom.style.height = "300px";
            this.rangeStart.getDOM().style.display = "block"
            this.rangeStartLabel.style.display = "block"
            this.rangeEnd.getDOM().style.display = "block"
            this.rangeEndLabel.style.display = "block"

            this.rangeStart.setDate(this.store.getTimelineRangeBar().rangeStartTime);
            this.rangeEnd.setDate(this.store.getTimelineRangeBar().rangeEndTime);
        } else {
            this.dom.style.height = "200px";
            this.rangeStart.getDOM().style.display = "none"
            this.rangeStartLabel.style.display = "none"
            this.rangeEnd.getDOM().style.display = "none"
            this.rangeEndLabel.style.display = "none"
        }

        this.endCallback = endCallback;
        this.dom.style.display = "block";
        this.background.show(this.setting.opacity, this.setting.zIndex);
    }

    getDOM() {
        return this.dom;
    }
}

export default TimelineSettingDialog;