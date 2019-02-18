/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

const DURATION = 1001;
const TIMESCALE = 30000;
const SAMPLE_SEC = DURATION / TIMESCALE;

// 現在位置から後ろ10秒キャッシュする.
// それより前のバッファは削除する.(大容量動画対策)
const CACHE_TIME = 10;

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
		// https://developer.mozilla.org/ja/docs/Web/API/HTMLMediaElement/srcObject
		try {
			videoElem.srcObject = this.mediaSource;
		} catch (error) {
			videoElem.src = URL.createObjectURL(this.mediaSource);
		}
		this.video.setAttribute("autoplay", "")

		this.updateBuffer = this.updateBuffer.bind(this);
		this.onSourceOpen = this.onSourceOpen.bind(this);
		this.onVideoFrame = this.onVideoFrame.bind(this);
		this.mediaSource.addEventListener('sourceopen', this.onSourceOpen);

		this.bufferRemovedPos = 0;
		this.audioBufferRemovedPos = 0;

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
			
			if (this.buffer) {
				if (!this.isRepeat() && this.video.currentTime > this.video.duration - 1 && this.video.readyState == 2) {
					// 終わり
					if (this.queue.length === 0) {
						this.mediaSource.endOfStream();
						return;
					}
				}
				if (this.video.currentTime > this.bufferRemovedPos + CACHE_TIME) {
					// 現在時刻が削除済バッファ最終位置よりCACHE_TIME秒以上後ろであった.
					// 現在時刻-CACHE_TIME秒の地点までのバッファを削除する.
					if (!this.buffer.updating && this.buffer.buffered.length > 0 && this.buffer.buffered.end(0) <= this.duration) {
						const time = this.getSampleTime(this.video.currentTime - CACHE_TIME);
						if (time > this.bufferRemovedPos) {
							//console.error("remove", time)
							this.buffer.remove(0, time);
							if (this.audioBuffer) {
								this.audioBuffer.remove(0, time);
							}
							this.bufferRemovedPos = time;
						}
					}
				} else if (this.video.currentTime < this.preTime) {
					// 現在時刻が削除済バッファ最終位置より手前であった.
					// 削除済バッファを参照しようとしているため、
					// this.bufferRemovedPosから最後まで削除した上で、
					// 現在時刻から再ロードする要求を送る.
					if (!this.preventUpdate) {
						this.preventUpdate = true;
						this.queue = [];
						this.audioQueue = [];
						
						if (this.buffer) {
							this.buffer.abort();
						}
						if (this.audioBuffer) {
							this.audioBuffer.abort();
						}
						this.bufferRemovedPos = 0;
						this.setOffsetTime(0);
						this.emit(MediaPlayer.EVENT_NEED_RELOAD, null, 0);
					}
				}
			}
			this.preTime = this.video.currentTime;
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
		if (this.preventUpdate) {
			return;
		}
		//console.error("onupdatebuffer")
		// https://cs.chromium.org/chromium/src/media/filters/source_buffer_platform.cc?l=9
		// 12 MB for audio, 150 MB for video
		try {
			if (this.buffer && this.queue.length > 0 && !this.buffer.updating) {
				let data = this.queue[0];
				this.buffer.appendBuffer(data);
				this.queue.shift();
			}
			if (this.audioBuffer && this.audioQueue.length > 0 && !this.audioBuffer.updating) {
				let data = this.audioQueue[0];
				this.audioBuffer.appendBuffer(data);
				this.audioQueue.shift();
			}
		} catch (e) {
			if (this.buffer) {
				if (this.video.currentTime > this.bufferRemovedPos + CACHE_TIME) {
					// 現在時刻が削除済バッファ最終位置よりCACHE_TIME秒以上後ろであった.
					// 現在時刻-CACHE_TIME秒の地点までのバッファを削除する.
					if (this.buffer.buffered.length > 0 && this.buffer.buffered.end(0) <= this.duration) {
						const time = this.getSampleTime(this.video.currentTime - CACHE_TIME);
						if (time > this.bufferRemovedPos) {
							//console.error("remove", time, this.buffer.buffered)
							this.buffer.remove(0, time);
							if (this.audioBuffer) {
								this.audioBuffer.remove(0, time);
							}
							this.mediaSource.setLiveSeekableRange(time, this.buffer.buffered.end(0));
							this.bufferRemovedPos = time;
						}
					}
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
		this.emit(MediaPlayer.EVENT_SOURCE_OPEN);
	}
	release() {
		// console.log("release MediaPlayer")
		if (this.buffer) {
			this.buffer.abort();
			this.buffer.removeEventListener('update', this.updateBuffer);
			this.buffer.removeEventListener('updateend', this.updateBuffer);
		}
		if (this.audioBuffer) {
			this.audioBuffer.abort();
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
	getSampleTime(time) {
		let numSampleSec = time / SAMPLE_SEC;
		numSampleSec = numSampleSec - (numSampleSec - Math.floor(numSampleSec));
		return SAMPLE_SEC * numSampleSec;
	}
	onVideoFrame(data) {
		this.preventUpdate = false;
		if (this.buffer && typeof data === 'object'){
			if (this.buffer.updating || this.queue.length > 0) {
				this.queue.push(data);
			} else {
				try {
					// console.log("appendVideo")
					this.buffer.appendBuffer(data);
				} catch(e) {
					/*
					if (this.video.currentTime > 8) {
						const time = this.getSampleTime(this.video.currentTime - 8);
						console.error("remove", time)
						this.buffer.remove(0, time);
						this.loadedStartTime = time;
					}
					*/
					this.queue.push(data);
				}
			}
		}
	}
	onAudioFrame(data) {
		this.preventUpdate = false;
		if (!this.audioBuffer) return;
		if (this.audioBuffer && typeof data === 'object'){
			if (this.audioBuffer.updating || this.audioQueue.length > 0) {
				this.audioQueue.push(data);
			} else {
				try {
					// console.log("appendAudio")
					this.audioBuffer.appendBuffer(data);
				} catch(e) {
					/*
					if (this.video.currentTime > 8) {
						const time = this.getSampleTime(this.video.currentTime - 8);
						this.audioBuffer.remove(0, time);
					}
					*/
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
		}
		if (this.audioBuffer) {
			this.audioBuffer.timestampOffset = time;
		}
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
MediaPlayer.EVENT_NEED_RELOAD = "reload";
MediaPlayer.EVENT_SOURCE_OPEN = "sourceOpen";
export default MediaPlayer;
