/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

class MediaPlayer extends EventEmitter {
	constructor(videoElem, codecString, audioCodecString) {
		super();
		this.video = videoElem;
		this.codecString = codecString;
		this.audioCodecString = audioCodecString;
		this.buffer = null;
		this.audioBuffer = null;
		this.audioQueue = [];
		this.queue = [];
		this.isOpened = false;
		this.duration = 0;
		this.loadedStartTime = 0;
		this.mediaSource = new MediaSource();
		videoElem.src = window.URL.createObjectURL(this.mediaSource);
		this.video.setAttribute("autoplay", "")

		this.updateBuffer = this.updateBuffer.bind(this);
		this.onSourceOpen = this.onSourceOpen.bind(this);
		this.onVideoFrame = this.onVideoFrame.bind(this);
		this.mediaSource.addEventListener('sourceopen', this.onSourceOpen);

		this.repeatEvent = function (self) {
			if (this.currentTime > this.duration - 1 && this.readyState == 2) {
				this.currentTime = 0;
				if (self.loadedStartTime !== 0) {
					self.emit(MediaPlayer.EVENT_NEED_RESTART, null, 0);
				} else {
					this.play();
				}
			}
		}.bind(this.video, this);

		this.timeUpdated = () => {
			if (!this.buffer) return;
			if (this.buffer.buffered.length > 0) {
				let start = this.buffer.buffered.start(0)
				if (this.video.currentTime > start + 10) {
					if (this.buffer.buffered.end(0) < this.duration) {
						this.buffer.remove(0, this.video.currentTime - 10);
						this.updateBuffer();
					}
				}
			}
			if (this.audioBuffer && this.audioBuffer.buffered.length > 0) {
				let start = this.audioBuffer.buffered.start(0)
				if (this.video.currentTime > start + 10) {
					if (this.audioBuffer.buffered.end(0) < this.duration) {
						this.audioBuffer.remove(0, this.video.currentTime - 10);
						this.updateBuffer();
					}
				}
			}
			/*
			if (self.buffer && self.loadedStartTime !== 0) {
				if (self.video.currentTime < self.loadedStartTime) {
					self.emit(MediaPlayer.EVENT_NEED_RESTART, null, this.currentTime);
				}
			}
			*/
		};

		this.repeat = false;
		this.setRepeat(this.repeat);
		this.video.addEventListener('timeupdate', this.timeUpdated);
	}
	updateBuffer() {	
		// https://cs.chromium.org/chromium/src/media/filters/source_buffer_platform.cc?l=9
		// 12 MB for audio, 150 MB for video
		if (this.buffer && this.queue.length > 0 && !this.buffer.updating) {
			try {
				let data = this.queue[0];
				this.buffer.appendBuffer(data);
				this.queue.shift()
			} catch (e) {
				if (this.video.currentTime > 8) {
					this.buffer.remove(0, this.video.currentTime - 8);
					this.loadedStartTime = this.video.currentTime - 8;
				}
			}
		}
		if (this.audioBuffer && this.audioQueue.length > 0 && !this.audioBuffer.updating) {
			try {
				let data = this.audioQueue[0];
				this.audioBuffer.appendBuffer(data);
				this.audioQueue.shift()
			} catch (e) {
				if (this.video.currentTime > 8) {
					this.audioBuffer.remove(0, this.video.currentTime - 8);
				}
			}
		}
	}
	onSourceOpen(ev) {
		if (ev.target.readyState !== "open") {
			return;
		}
		if (this.buffer) {
			return;
		}
		this.isOpened = true;
		
		if (this.audioCodecString) {
			this.audioBuffer = this.mediaSource.addSourceBuffer(this.audioCodecString);
			this.audioBuffer.mode = 'sequence';
			this.audioBuffer.addEventListener('update', this.updateBuffer);
			this.audioBuffer.addEventListener('updateend', () => {
				this.updateBuffer();
			});
		}
		if (this.codecString) {
			this.buffer = this.mediaSource.addSourceBuffer(this.codecString);
			this.buffer.mode = 'sequence';
			this.buffer.addEventListener('update', this.updateBuffer);
			this.buffer.addEventListener('updateend', () => {
				this.updateBuffer();
			});
		}
		this.emit("sourceOpen");
	}
	release() {
		// console.log("release MediaPlayer")
		if (this.buffer) {
			this.buffer.removeEventListener('update', this.updateBuffer);
			this.buffer.removeEventListener('updateend', this.updateBuffer);
		}
		if (this.audioBuffer) {
			this.audioBuffer.removeEventListener('update', this.updateBuffer);
			this.audioBuffer.removeEventListener('updateend', this.updateBuffer);
		}
		this.mediaSource.removeEventListener('sourceopen', this.onSourceOpen);
		this.video.removeEventListener('timeupdate', this.repeatEvent);
		this.video.removeEventListener('timeupdate', this.timeUpdated);
		this.video.currentTime = 0;
		this.buffer = null;
		this.queue = [];
		this.audioBuffer = null;
		this.audioQueue = [];
	}
	setDuration(duration) {
		this.duration = duration;
		if (this.isOpened && this.mediaSource && this.buffer && !this.buffer.updating) {
			this.mediaSource.duration = this.duration;
		}
	}
	onVideoFrame(data) {
		if (this.buffer && typeof data === 'object'){
			if (this.buffer.updating || this.queue.length > 0) {
				this.queue.push(data);
			} else {
				try {
					// console.log("appendVideo")
					this.buffer.appendBuffer(data);
				} catch(e) {
					if (this.video.currentTime > 8) {
						console.error("hoge")
						this.buffer.remove(0, this.video.currentTime - 8);
						this.loadedStartTime = this.video.currentTime - 8;
					}
					this.queue.push(data);
				}
			}
		}
	}
	onAudioFrame(data) {
		if (!this.audioBuffer) return;
		if (this.audioBuffer && typeof data === 'object'){
			if (this.audioBuffer.updating || this.audioQueue.length > 0) {
				this.audioQueue.push(data);
			} else {
				try {
					// console.log("appendAudio")
					this.audioBuffer.appendBuffer(data);
				} catch(e) {
					if (this.video.currentTime > 8) {
						this.audioBuffer.remove(0, this.video.currentTime - 8);
					}
					this.audioQueue.push(data);
				}
			}
		}
	}
	setRepeat(repeat) {
		if (this.isRepeat() != repeat) {
			if (repeat) {
				this.video.addEventListener('timeupdate', this.repeatEvent);
			} else {
				this.video.removeEventListener('timeupdate', this.repeatEvent);
			}
			this.repeat = repeat;
		}
	}
	isRepeat() {
		return this.repeat;
	}
	setOffsetTime(time) {
		this.loadedStartTime = time;
		if (this.buffer) {
			this.buffer.timestampOffset = time;
			this.buffer.currentTime = time;
		}
		if (this.audioBuffer) {
			this.audioBuffer.timestampOffset = time;
			this.audioBuffer.currentTime = time;
		}
		this.video.currentTime = time;
	}
	setSize(width, height) {
		this.video.width = wh.width;
		this.video.height = wh.height;
	}
	setPosition(x, y) {
		this.video.style.left = String(x) + "px";
		this.video.style.top = String(y) + "px";
	}
}

MediaPlayer.EVENT_NEED_RESTART = "restart";
export default MediaPlayer;
