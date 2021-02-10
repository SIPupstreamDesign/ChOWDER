import Constants from "../common/constants";

/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

class VideoPlayer extends EventEmitter {
	constructor(isDisplay) {
        super();

        this.dom = document.createElement('div');
        this.video = document.createElement('video');
        this.isSeekEnabled = true;

        // manipulator対策。あとで何とかする
        this.dom.play = true;

        this.dom.appendChild(this.video);
        
        this.video.setAttribute('crossorigin', '');
        this.video.setAttribute('playsinline', '');
        // this.video.setAttribute('autoplay', '');
        if (Constants.IsMobile) {
            this.video.setAttribute('muted', 'muted');
        }
        this.video.removeAttribute('controls');
        if (isDisplay) {
            this.video.setAttribute('data-plyr-config', '{ "clickToPlay" : false, "controls" : [ "progress", "current-time", "mute", "volume", "fullscreen"] }');
        } else {
            this.video.setAttribute('data-plyr-config', '{ "clickToPlay" : false, "controls" : [ "play", "progress", "current-time", "mute", "volume", "fullscreen"] }');
        }

        this.player = new Plyr(this.video, {
            listeners: {
                seek: (e) => {
                    if (!this.isSeekEnabled) {
                        e.preventDefault();
                        return false;
                    } else {
                        return true;
                    }
                }
            }
        });

        this.player.on('ready', () => {
            let container = this.dom.getElementsByClassName('plyr--full-ui')[0];
            container.style.minWidth = "unset";
            container.style.width = "100%";
            container.style.height = "100%";
            this.emit(VideoPlayer.EVENT_READY, null);
        });
    }

    enableSeek(enable) {
        this.isSeekEnabled = enable;
    }

    release() {
		this.video.pause();
		this.video.srcObject = null;
		if (this.video.src) {
			URL.revokeObjectURL(this.video.src);
		}
		this.video.src = "";
    }
    
    isPlaying() {
        //https://stackoverflow.com/questions/36803176/how-to-prevent-the-play-request-was-interrupted-by-a-call-to-pause-error
        return this.video.currentTime > 0 && !this.video.paused && !this.video.ended 
                && this.video.readyState > this.video.HAVE_CURRENT_DATA;
    } 

    getDOM() {
        return this.dom;
    }

    getVideo() {
        return this.video;
    }
}

VideoPlayer.EVENT_READY = "ready"

export default VideoPlayer;