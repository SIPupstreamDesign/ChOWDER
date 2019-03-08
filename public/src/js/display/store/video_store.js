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

    getCodec(info) {
        let audioCodec = null;
        let videoCodec = null;
        for (let i = 0; i < info.tracks.length; ++i) {
            let track = info.tracks[i];
            if (track.hasOwnProperty('video')) {
                videoCodec = 'video/mp4; codecs=\"' + track.codec +  '\"';
            }
            else if (track.hasOwnProperty('audio')) {
                audioCodec = 'audio/mp4; codecs=\"' + track.codec +  '\"';
            }
        }
        if (!MediaSource.isTypeSupported(videoCodec)) {
            videoCodec = 'video/mp4; codecs="avc1.640033"';
        }
        if (!MediaSource.isTypeSupported(audioCodec)) {
            audioCodec = null;
        }
        return {
            audioCodec : audioCodec,
            videoCodec : videoCodec
        }
    }

    _requestWebRTC(data) {
        console.error("requestWebRTC")
        let metaData = data.metaData;
        let request = data.request;
        this.videoPlayerDict[metaData.id] = data.player;
        let elem = data.player.getVideo();
        let rtcKey = this.getRTCKey(metaData);
        let meta = this.store.getMetaData(metaData.id);
        const isUseDataChannel = this.isDataChannelUsed(metaData);
        
        // 既にDatachannel使ってるか？
        let isAlreadyUsed =  this.isDataChannelUsed(meta);
        // Datachannel使ってるか？
        let isDataChannelUsed = this.isDataChannelUsed(metaData);

        this.connector.sendBinary(Command.RTCRequest, metaData, request, () => {
            let webRTC = new WebRTC();
            this.webRTCDict[rtcKey] = webRTC;

            if (isDataChannelUsed) {
                // DataChannel使用開始
                URL.revokeObjectURL(elem.src); // 通常のWebRTC用のソースを消す.
                if (elem.hasOwnProperty('srcObject')) {
                    elem.srcObject = null;
                }
            }
            
            if (isDataChannelUsed) {
                let info = null;
                try {
                    info = JSON.parse(metaData.video_info);
                } catch(e) {
                    console.error(e, metaData.video_info);
                }
                console.error("isUseDataChannel!", info)
                
                if (info) {            
                    const codec = this.getCodec(info);    
                    const duration = info.duration/info.timescale;
                    
                    console.log("codec", codec.videoCodec, codec.audioCodec,
                        MediaSource.isTypeSupported(codec.videoCodec),
                        MediaSource.isTypeSupported(codec.audioCodec)
                    );
                    let player = new MediaPlayer(elem, codec.videoCodec, codec.audioCodec);
                    if (info.hasOwnProperty('duration') && info.hasOwnProperty('timescale')) {
                        player.setSampleSec(info.duration / info.timescale);
                    }
                    player.on(MediaPlayer.EVENT_SOURCE_OPEN, () => {
                        player.setDuration(duration);
                    });
                    player.on(MediaPlayer.EVENT_NEED_RELOAD, (err, time) => {
                        console.error("EVENT_NEED_RELOAD")
                    });
                    this.mediaPlayerDict[rtcKey] = player;
                    elem.load();
                }
            } else {
                if (this.mediaPlayerDict.hasOwnProperty(rtcKey)) {
                    this.mediaPlayerDict[rtcKey].release();
                    delete this.mediaPlayerDict[rtcKey];
                }
            }
            
            webRTC.on(WebRTC.EVENT_ADD_STREAM, (evt) => {

                if (!isUseDataChannel) {
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

            if (this.mediaPlayerDict.hasOwnProperty(rtcKey)) {
                webRTC.on(WebRTC.EVENT_DATACHANNEL_FOR_VIDEO_MESSAGE, ((mediaPlayer) => {
                    return (err, message) => {
                        mediaPlayer.onVideoFrame(message);
                    }
                })(this.mediaPlayerDict[rtcKey]));
            }
            
            if (this.mediaPlayerDict.hasOwnProperty(rtcKey)) {
                webRTC.on(WebRTC.EVENT_DATACHANNEL_FOR_AUDIO_MESSAGE, ((mediaPlayer) => {
                    return (err, message) => {
                        mediaPlayer.onAudioFrame(message);
                    }
                })(this.mediaPlayerDict[rtcKey]));
            }

			webRTC.on(WebRTC.EVENT_NEGOTIATION_NEEDED, () => {
                console.error("EVENT_NEGOTIATION_NEEDED")
            });
            webRTC.on(WebRTC.EVENT_CLOSED, ((rtcKey) => {
                return () => {
                    console.error("closed")
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
            // console.error("closewebrtc")

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