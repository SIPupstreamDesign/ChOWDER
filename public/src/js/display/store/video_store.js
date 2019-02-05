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
        
        this.player = null;

        this.webRTCDict = {};
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

    playFragmentVideo(videoElem, data) {
        this.player.onVideoFrame(data);
    }

    _requestWebRTC(data) {
        console.error("requestWebRTC")
        let metaData = data.metaData;
        let request = data.request;
        let elem = data.element;
        let rtcKey = this.getRTCKey(metaData);
        this.connector.sendBinary(Command.RTCRequest, metaData, request, () => {
            let webRTC = new WebRTC();
            this.webRTCDict[rtcKey] = webRTC;
            webRTC.on(WebRTC.EVENT_ADD_STREAM, (evt) => {
                if (metaData.use_datachannel) {
                    this.player = new MediaPlayer(elem, 'video/mp4; codecs="avc1.640033"');
                    this.player.on('sourceOpen', () => {
                        this.player.setDuration(313.47);
                    })
                } else {
                    let stream = evt.stream ? evt.stream : evt.streams[0];
                    elem.srcObject = stream;
                }

                if (!webRTC.statusHandle) {
                    let t = 0;
                    webRTC.statusHandle = setInterval( ((rtcKey, webRTC) => {
                        t += 1;
                        webRTC.getStatus(function (status) {
                            let bytes = 0;
                            if (status.video && status.video.bytesReceived) {
                                bytes += status.video.bytesReceived;
                            }
                            if (status.audio && status.audio.bytesReceived) {
                                bytes += status.audio.bytesReceived;
                            }
                            // console.log("webrtc key:"+ rtcKey + "  bitrate:" + Math.floor(bytes * 8 / this / 1000) + "kbps");
                        });
                    })(rtcKey, this.webRTCDict[rtcKey]), 1000);
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

            webRTC.on(WebRTC.EVENT_DATACHANNEL_MESSAGE, (err, message) => {
                console.error("datachannelmessage", message)
                this.playFragmentVideo(elem, message);
            });
            
            webRTC.on(WebRTC.EVENT_CLOSED, ((rtcKey) => {
                return () => {
                    if (this.webRTCDict.hasOwnProperty(rtcKey)) {
                        if (webRTCDict[rtcKey].statusHandle) {
                            clearInterval(this.webRTCDict[rtcKey].statusHandle);
                            this.webRTCDict[rtcKey].statusHandle = null;
                        }
                        delete this.webRTCDict[rtcKey];
                    }
                }
            })(rtcKey));
        });
    }
};

export default VideoStore;