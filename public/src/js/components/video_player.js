import Button from "./button";

/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

class VideoPlayer extends EventEmitter {
	constructor() {
        super();

        this.dom = document.createElement('div');
        this.video = document.createElement('video');

        // manipulator対策。あとで何とかする
        this.dom.play = true;

        this.dom.appendChild(this.video);
        
        this.video.setAttribute('crossorigin', '');
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('autoplay', '');
        this.video.setAttribute('data-plyr-config', '{ "clickToPlay" : false, "controls" : [ "play", "progress", "current-time", "mute", "volume", "fullscreen"] }');

        this.player = new Plyr(this.video);

        this.player.on('ready', () => {
            let container = this.dom.getElementsByClassName('plyr--full-ui')[0];
            container.style.width = "100%";
            container.style.height = "100%";
            this.emit(VideoPlayer.EVENT_READY, null);
        });
    }

    release() {
		this.video.pause();
		this.video.srcObject = null;
		if (this.video.src) {
			URL.revokeObjectURL(this.video.src);
		}
		this.video.src = "";
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