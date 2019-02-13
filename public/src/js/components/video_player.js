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
        
        this.video.style.width = "100%";
        this.video.style.height = "100%";
        this.video.setAttribute('crossorigin', '');
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('autoplay', '');
        this.video.setAttribute('data-plyr-config', '{ "clickToPlay" : false, "controls" : [ "play", "progress", "current-time", "mute", "volume", "fullscreen"] }');

        this.player = new Plyr(this.video);
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

export default VideoPlayer;