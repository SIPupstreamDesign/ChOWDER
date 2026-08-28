/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */


 "use strict";

class ContentsInput extends EventEmitter
{
    constructor() {
        super();

        this.dom = document.createElement('div');
        this.dom.style.display = "none";

        this.dom.innerHTML = `
            <div style="display:none">
            <hr>
            <div>
                <p style="margin-left:20px" data-key="add_text_file"></p>
                <input type="file" name="filename" class="text_file_input" style="margin-left:20px" />
            </div>
            <hr>
            <div>
                <p style="margin-left:20px" data-key="add_url"></p>
                <input type="text" class="url_input" style="margin-left:20px"/>
                <input class="btn url_send_button" type="button" value="Send" />
            </div>
            <hr>
            <div>
                <p style="margin-left:20px" data-key="add_image"></p>
                <input type="file" name="filename" class="image_file_input" style="margin-left:20px" />
            </div>
            <hr>
            <div>
                <p style="margin-left:20px" data-key="swap_image"></p>
                <span style="margin-left:20px">ID:</span><span class="update_content_id" >No Content Selected.</span>
                <input type="file" value="UpdateImage" class="update_image_input" style="margin-left:20px" />
            </div>
            <hr>
            <div>
                <p style="margin-left:20px" data-key="add_movie"></p>
                <input type="file" name="filename" class="video_file_input" style="margin-left:20px" />
            </div>
            <hr>
            <div>
                <p style="margin-left:20px" data-key="add_pdf"></p>
                <input type="file" name="filename" class="pdf_file_input" style="margin-left:20px" />
            </div>
            <hr>
            <div>
                <p style="margin-left:20px" data-key="add_tileimage"></p>
                <input type="file" name="filename" class="tileimage_file_input" style="margin-left:20px" />
            </div>
        </div>
        `

        this.initEvent();
    }

    initEvent() {
        let imageFileInput = this.dom.getElementsByClassName('image_file_input')[0];
        let tileimageFileInput = this.dom.getElementsByClassName('tileimage_file_input')[0];
        let textFileInput = this.dom.getElementsByClassName('text_file_input')[0];
        let pdfFileInput = this.dom.getElementsByClassName('pdf_file_input')[0];
        let updateImageInput = this.dom.getElementsByClassName('update_image_input')[0];
        let videoFileInput = this.dom.getElementsByClassName('video_file_input')[0];

        imageFileInput.addEventListener('change', (evt) => {
            this.emit(ContentsInput.EVENT_IMAGEFILEINPUT_CHANGE, null, evt, this.contextPosX, this.contextPosY);
            imageFileInput.value = "";
        }, false);

        tileimageFileInput.addEventListener('change', (evt) => {
            this.emit(ContentsInput.EVENT_TILEIMAGEFILEINPUT_CHANGE, null, evt, this.contextPosX, this.contextPosY);
            tileimageFileInput.value = "";
        }, false);

        textFileInput.addEventListener('change', (evt) => {
            this.emit(ContentsInput.EVENT_TEXTFILEINPUT_CHANGE, null, evt, this.contextPosX, this.contextPosY);
            textFileInput.value = "";
        }, false);

        pdfFileInput.addEventListener('change', (evt) => {
            this.emit(ContentsInput.EVENT_PDFFILEINPUT_CHANGE, null, evt, this.contextPosX, this.contextPosY);
            pdfFileInput.value = '';
        }, false);

        updateImageInput.onchange = (evt) => {
            this.emit(ContentsInput.EVENT_UPDATEIMAGEINPUT_CHANGE, null, evt);
            updateImageInput.value = "";
        };

        videoFileInput.addEventListener('change', (evt) => {
            this.emit(ContentsInput.EVENT_VIDEOFILEINPUT_CHANGE, null, evt, this.contextPosX, this.contextPosY);
            videoFileInput.value = "";
        }, false);
    }

    inputImageFile() {
        this.dom.getElementsByClassName('image_file_input')[0].click();
    }
    inputUpdateImageFile() {
        this.dom.getElementsByClassName('update_image_input')[0].click();
    }

    inputTextFile() {
        this.dom.getElementsByClassName('text_file_input')[0].click();
    }

    inputPDFFile() {
        this.dom.getElementsByClassName('pdf_file_input')[0].click();
    }

    inputTileimageFile() {
        this.dom.getElementsByClassName('tileimage_file_input')[0].click();
    }

    inputVideoFile() {
        this.dom.getElementsByClassName('video_file_input')[0].click();
    }

    getUpdateImageID() {
        return this.dom.getElementsByClassName('update_content_id')[0].innerHTML;
    }

    setUpdateImageID(id) {
        this.dom.getElementsByClassName('update_content_id')[0].innerHTML = id;
    }

    getDOM() {
        return this.dom;
    }
}

ContentsInput.EVENT_IMAGEFILEINPUT_CHANGE = "imagefileinput_change";
ContentsInput.EVENT_TILEIMAGEFILEINPUT_CHANGE = "tileimagefileinput_change";
ContentsInput.EVENT_TEXTFILEINPUT_CHANGE = "textfileinput_change";
ContentsInput.EVENT_PDFFILEINPUT_CHANGE = "pdffileinput_change";
ContentsInput.EVENT_UPDATEIMAGEINPUT_CHANGE = "updateimageinput_change";
ContentsInput.EVENT_VIDEOFILEINPUT_CHANGE = "videofileinput_change";

export default ContentsInput;

