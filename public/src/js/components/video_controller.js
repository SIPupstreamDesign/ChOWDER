/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

class VideoController extends EventEmitter
{
    constructor() {
        super();
        
        this.dom = document.createElement('div');
        this.dom.className = "video_controller";
        this.dom.style.display = "none";

        let labelWrap = document.createElement('div');
        let label =  document.createElement('span');
        label.textContent = i18next.t('video_controller');
        labelWrap.appendChild(label);
        this.dom.appendChild(labelWrap);

        this.closeButton = document.createElement('img');
        this.closeButton.className = "video_controller_close";
        this.closeButton.src = "../image/video_close.png";
        this.rewindButton = document.createElement('img');
        this.rewindButton.className = "video_controller_rewind";
        this.rewindButton.src = "../image/video_rewind.png";
        this.playButton = document.createElement('img');
        this.playButton.className = "video_controller_play";
        this.playButton.src = "../image/video_play.png";

        this.dom.appendChild(this.closeButton);
        this.dom.appendChild(this.rewindButton);
        this.dom.appendChild(this.playButton);

        this.initVideoController();
    }

	initVideoController() {
		let elClose = this.closeButton;
		let elRewind = this.rewindButton;
		let elPlay = this.playButton;

		elClose.onclick = (evt) => {
			this.dom.style.display = 'none';
		};

		elRewind.onclick = (evt) => {
			this.emit(VideoController.EVENT_REWIND, null);
		};

		let isPlayButton = true;
		elPlay.onclick = (evt) => {
			this.emit('video_controller_play_clicked', null, isPlayButton);
			isPlayButton = !isPlayButton;
			elPlay.src = isPlayButton ? '../image/video_play.png' : '../image/video_pause.png';
		};
    }
    
    show(isShow) {
        this.dom.style.display = isShow ? "block" : "none"; 
    }
    
    isShow() {
        return this.dom.style.display === "block";
    }
    
    getDOM() {
        return this.dom;
    }
}

VideoController.EVENT_REWIND = "rewind";
VideoController.EVENT_PLAY = "play";

export default VideoController;