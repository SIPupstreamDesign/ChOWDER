/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Command from '../../common/command';
import Store from './store';
import Action from '../action';
import MediaPlayer from '../../common/mediaplayer'
import WebRTC from '../../common/webrtc';
import DisplayUtil from '../display_util';

"use strict";

const random_id_for_webrtc = DisplayUtil.generateID();

class VideoStore {
    constructor(connector, store, action) {
        this.connector = connector;
        this.store = store;
		this.action = action;
        
		// WebRTC用キーから WebRTCインスタンスへのマップ
        this.webRTCDict = {};

        // WebRTC用キーから MediaPlayerインスタンスへのマップ
        this.mediaPlayerDict = {};

        // idからVideoPlayerインスタンスへのマップ
        this.videoPlayerDict = {};

		this.initEvents();
	}

	initEvents() {
		for (let i in Action) {
			if (i.indexOf('EVENT') >= 0) {
				this.action.on(Action[i], ((method) => {
					return (err, data) => {
						if (this[method]) {
							this[method](data);
						}
					};
				})('_' + Action[i]));
			}
		}
	}

    release() {
        for (let i in this.webRTCDict) {
            this.webRTCDict[i].close();
        }
        for (let i in this.mediaPlayerDict) {
            this.mediaPlayerDict[i].release();
        }
        for (let i in this.videoPlayerDict) {
            this.videoPlayerDict[i].release();
        }
    }

    playFragmentVideo(rtcKey, data) {
        if (this.mediaPlayerDict.hasOwnProperty(rtcKey)) {
            this.mediaPlayerDict[rtcKey].onVideoFrame(data);
        } else {
            console.error("Error : not found rtc entry. rtckey", rtcKey)
        }
    }

    _requestWebRTC(data) {
        console.error("requestWebRTC")
        let metaData = data.metaData;
        let request = data.request;
        this.videoPlayerDict[metaData.id] = data.player;
        let elem = data.player.getVideo();
        let rtcKey = this.getRTCKey(metaData);
        this.connector.sendBinary(Command.RTCRequest, metaData, request, () => {
            let webRTC = new WebRTC();
            this.webRTCDict[rtcKey] = webRTC;
            webRTC.on(WebRTC.EVENT_ADD_STREAM, (evt) => {
                const isUseDataChannel = this.isDataChannelUsed(metaData);

                if (isUseDataChannel) {
                    console.error("isUseDataChannel!")
                    if (!this.mediaPlayerDict.hasOwnProperty(rtcKey)) {
                        let player = new MediaPlayer(elem, 'video/mp4; codecs="avc1.640033"');
                        player.on(MediaPlayer.EVENT_SOURCE_OPEN, () => {
                            if (metaData.hasOwnProperty('video_duration')) {
                                player.setDuration(metaData.video_duration);
                            }
                        });
                        player.on(MediaPlayer.EVENT_NEED_RELOAD, (err, time) => {
                            /*
                            stopVideo();
                            const segmentIndex = time / SAMPLE_SEC;
                            console.log("MediaPlayer.EVENT_NEED_RELOAD", time, segmentIndex, this.segmentDict[id].videoIndex, time / SAMPLE_SEC);
                            this.segmentDict[id].videoIndex = segmentIndex;
                            this.segmentDict[id].audioIndex = segmentIndex;
                            playVideo();
                            */
                           // TODO
                        });
                        this.mediaPlayerDict[rtcKey] = player;
                    }
                } else {
                    let stream = evt.stream ? evt.stream : evt.streams[0];
                    try {
                        elem.srcObject = stream;
                    } catch(e) {
                        elem.src = stream;
                    }
                }

                if (!webRTC.statusHandle) {
                    let t = 0;
                    webRTC.statusHandle = setInterval( ((rtcKey) => {
                        let webRTC = this.webRTCDict[rtcKey];
                        t += 1;
                        webRTC.getStatus((status) => {
                            let bytes = 0;
                            if (status.video && status.video.bytesReceived) {
                                bytes += status.video.bytesReceived;
                            }
                            if (status.audio && status.audio.bytesReceived) {
                                bytes += status.audio.bytesReceived;
                            }
                            // console.log("webrtc key:"+ rtcKey + "  bitrate:" + Math.floor(bytes * 8 / this / 1000) + "kbps");
                        });
                    })(rtcKey), 1000);
                }
            });

            webRTC.on(WebRTC.EVENT_ICECANDIDATE, ((rtcKey) => {
                return (type, data) => {
                    if (type === "tincle") {
                        metaData.from = "view";
                        this.connector.sendBinary(Command.RTCIceCandidate, metaData, JSON.stringify({
                            key : rtcKey,
                            candidate: data
                        }), function (err, reply) {});
                        delete metaData.from;
                    }
                }
            })(rtcKey));

            webRTC.on(WebRTC.EVENT_DATACHANNEL_MESSAGE, ((rtcKey) => {
                return (err, message) => {
                    console.error("datachannelmessage", message)
                    this.playFragmentVideo(rtcKey, message);
                }
            })(rtcKey));
            
            webRTC.on(WebRTC.EVENT_CLOSED, ((rtcKey) => {
                return () => {
                    if (this.mediaPlayerDict.hasOwnProperty(rtcKey)) {
                        this.mediaPlayerDict[rtcKey].release();
                        delete this.mediaPlayerDict[rtcKey];
                    }
                    if (this.webRTCDict.hasOwnProperty(rtcKey)) {
                        if (this.webRTCDict[rtcKey].statusHandle) {
                            clearInterval(this.webRTCDict[rtcKey].statusHandle);
                            this.webRTCDict[rtcKey].statusHandle = null;
                        }
                        this.webRTCDict[rtcKey].close();
                        delete this.webRTCDict[rtcKey];
                    }
                }
            })(rtcKey));
        });
    }

	getWebRTCDict() {
		return this.webRTCDict;
	}

    // このページのwebRTC用のキーを取得.
    // ディスプレイIDが同じでもページごとに異なるキーとなる.
    // (ページをリロードするたびに代わる)
    getRTCKey(metaData) {
        return metaData.id + "_" + this.store.getWindowData().id + "_" + random_id_for_webrtc;
    }
    
	isDataChannelUsed(metaData) {
        let isUseDataChannel = false;
		try {
            if (metaData.hasOwnProperty('quality')) {
                let quality = JSON.parse(metaData.quality);
                isUseDataChannel = (quality 
                    && quality.hasOwnProperty('raw_resolution') 
                    && quality.raw_resolution === true);
            }
		} catch(e) {
			console.error(e);
		}
		return isUseDataChannel;
	}
	getVideoPlayer(id) {
		return this.videoPlayerDict[id];
	}
	hasVideoPlayer(id) {
		return this.videoPlayerDict.hasOwnProperty(id);
	}
	deleteVideoPlayer(id) {
		let player = this.videoPlayerDict[id];
		player.release();
		delete this.videoPlayerDict[id];
    }
    
    closeVideo(json) {
		let webRTCDict = this.getWebRTCDict();
		let rtcKey = this.getRTCKey(json);
		if (webRTCDict.hasOwnProperty(rtcKey)) {
            webRTCDict[rtcKey].close(true);
            console.error("closewebrtc")

			json.from = "view";
			this.connector.sendBinary(Command.RTCClose, json, JSON.stringify({
				key : rtcKey
			}), function (err, reply) {});
			delete json.from;
        }
        if (this.hasVideoPlayer(json.id)) {
            let player = this.getVideoPlayer(json.id);
            URL.revokeObjectURL(player.video.src); // 通常のWebRTC用のソースを消す.
            if (player.video.hasOwnProperty('srcObject')) {
                player.video.srcObject = null;
            }
        }
        if (this.mediaPlayerDict.hasOwnProperty(rtcKey)) {
            this.mediaPlayerDict[rtcKey].release();
            delete this.mediaPlayerDict[rtcKey]
        }
    }
};

export default VideoStore;