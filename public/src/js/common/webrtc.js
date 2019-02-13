/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Constants from './constants.js';

"use strict";
function printError(e) {
	if (e) {
		console.error(e);
	}
}

function printDebug(a, b, c) {
	//console.error("WebRTC:", a ? a : "", b ? b : "", c ? c : "")
}

let MediaOptions = {
	'offerToReceiveAudio': true,
	'offerToReceiveVideo': true
};

class WebRTC extends EventEmitter {
	constructor() {
		super();
		this.peer = this.prepareNewConnection();
		this.bandwidth = null;
		this.isScreenSharing = false;
		this.peer.currentStream = null;
	}
	prepareNewConnection() {
		printDebug("prepareNewConnection");
		let pc_config = {
			"iceServers": [
				{ "urls": "stun:stun.l.google.com:19302" },
				{ "urls": "stun:stun1.l.google.com:19302" },
				{ "urls": "stun:stun2.l.google.com:19302" }
			]
		};
		this.peer = null;
		try {
			this.peer = new RTCPeerConnection(pc_config);

		}
		catch (e) {
			printDebug("Failed to create peerConnection, exception: " + e.message);
			return;
		}

		if (Constants.IsChrome) {
			this.peer.ondatachannel = (evt) => {
				// evt.channelにDataChannelが格納されているのでそれを使う
				printDebug("ondatachannel", evt.channel)
				if (evt.channel) {
					this.datachannel = evt.channel;
					this.datachannel.onopen = (event) => {
						printDebug("datachannel.onopen")
						this.emit(WebRTC.EVENT_DATACHANNEL_OPEN, null);
					};
					this.datachannel.onclose = () =>  {
						printDebug("datachannel.onclose");
						this.emit(WebRTC.EVENT_DATACHANNEL_CLOSE, null);
					};
					this.datachannel.onmessage = (event) => {
						printDebug("event", event)
						this.emit(WebRTC.EVENT_DATACHANNEL_MESSAGE, null, event.data);
					};
					this.datachannel.onerror = function (error) {
						printDebug('dataChannel.onerror', error);
					};
				}
			};
		}
		
		this.peer.onicecandidate = (evt) => {
			printDebug("icecandidate", evt.candidate); //, evt, this.peer);
			if (evt.candidate) {
				this.emit(WebRTC.EVENT_ICECANDIDATE, "tincle", evt.candidate);
			}
			else {
				this.emit(WebRTC.EVENT_ICECANDIDATE, "vanilla", this.peer.localDescription);
			}
		};
		this.peer.onnegotiationneeded = (evt) => {
			printDebug("onnegotiationneeded", evt);
			this.emit(WebRTC.EVENT_NEGOTIATION_NEEDED, evt);
		};
		this.peer.oniceconnectionstatechange = (evt) => {
			let state = this.peer.iceConnectionState;
			printDebug("oniceconnectionstatechange", state);
			if (state === "disconnected") {
				// 相手から切断された.
				// 30秒待って閉じる
				/*
				setTimeout(function () {
					if (this.peer.iceConnectionState === "disconnected") {
						this.close(true);
					}
				}, 1000*30);
				*/
			}
			else if (state === "failed") {
				this.emit(WebRTC.EVENT_NEED_RESTART, null);
			}
			else if (state === "connected") {
				this.emit(WebRTC.EVENT_CONNECTED, null);
			}
		};
		if ('ontrack' in this.peer) {
			this.peer.ontrack = (evt) => {
				printDebug("Added remote stream", evt);
				this.emit(WebRTC.EVENT_ADD_STREAM, evt);
			};
			this.peer.onremovetrack = (evt) => {
				printDebug("Removed remote stream", evt);
				this.emit(WebRTC.EVENT_REMOVE_STREAM, evt);
			};
		}
		else {
			this.peer.onaddstream = (evt) => {
				printDebug("Added remote stream", evt);
				this.emit(WebRTC.EVENT_ADD_STREAM, evt);
			};
			this.peer.onremovestream = (evt) => {
				printDebug("Removed remote stream", evt);
				this.emit(WebRTC.EVENT_REMOVE_STREAM, evt);
			};
		}
		if (Constants.IsSafari) {
			if (MediaOptions.offerToReceiveAudio) {
				this.peer.addTransceiver('audio');
			}
			if (MediaOptions.offerToReceiveVideo) {
				this.peer.addTransceiver('video');
			}
		}
		return this.peer;
	}
	addStream(stream) {
		printDebug('Adding local stream...', stream);
		this.peer.addStream(stream);
		this.peer.currentStream = stream;
	}
	removeStream() {
		this.peer.removeStream(this.peer.currentStream);
	}

	// 送信側
	offer(callback) {
		let dataChannelOptions = {
			ordered: true,
			maxRetransmitTime: 100
		};

		// createOfferより前に作る必要がある
		if (Constants.IsChrome) {
			this.datachannel = this.peer.createDataChannel("myLabel" , dataChannelOptions);
			this.datachannel.binaryType = "arraybuffer";
			this.datachannel.onopen = () => {
				printDebug("datachannel.onopen")
				this.emit(WebRTC.EVENT_DATACHANNEL_OPEN, null);
			};
			this.datachannel.onmessage = () =>  {
				printDebug("datachannel.onmessage");
				this.emit(WebRTC.EVENT_DATACHANNEL_MESSAGE, null);
			};
			this.datachannel.onclose = () =>  {
				printDebug("datachannel.onclose");
				this.emit(WebRTC.EVENT_DATACHANNEL_CLOSE, null);
			};
			this.datachannel.onerror = function (error) {
				printDebug('dataChannel.onerror', error);
			};
		}
		
		printDebug('offer');
		this.peer.createOffer((sdp) => {
			// 成功
			sdp.sdp = this.setQuality(sdp.sdp);
			//printDebug("setLocalDescription", JSON.stringify(sdp))
			this.peer.setLocalDescription(sdp); // 自分で覚える
			callback(sdp); // コールバックで返す
		}, function () {
			printDebug("Create Offer failed");
		}, MediaOptions);
	}

	setQuality(sdp) {
		sdp = BandwidthHandler.setApplicationSpecificBandwidth(sdp, this.bandwidth, this.isScreenSharing);
		if (this.bandwidth && this.bandwidth.hasOwnProperty('video')) {
			sdp = BandwidthHandler.setVideoBitrates(sdp, {
				min: this.bandwidth.video,
				max: this.bandwidth.video_max,
			});
		}
		if (this.bandwidth && this.bandwidth.hasOwnProperty('audio')) {
			sdp = BandwidthHandler.setOpusAttributes(sdp, {
				"maxplaybackrate": this.bandwidth.audio_max * 1024 * 8,
				"maxaveragebitrate": this.bandwidth.audio_max * 1024 * 8
			});
		}
		return sdp;
	}

	// 受信側
	answer(sdp, callback, onetime) {
		this.peer.setRemoteDescription(new RTCSessionDescription(sdp), () => {
			printDebug("WebRTC answer", this.peer.signalingState );
			this.peer.createAnswer((answer) => {
				printDebug("WebRTC answer", this.peer.signalingState );
				answer.sdp = this.setQuality(answer.sdp);
				this.peer.setLocalDescription(answer, function () {
					callback(answer);
				}, function (e) {
					printError(e);
				});
			}, printError);
		}, () => {
			if (onetime) {
				return;
			}
			setTimeout(() => {
				this.answer(sdp, callback, true);
			}, 100);
		});
	}
	setAnswer(sdp, callback) {
		printDebug("setAnswer", sdp);
		this.peer.setRemoteDescription(new RTCSessionDescription(sdp), callback, function (e) {
			printError(e);
			callback(e);
		});
	}
	addIceCandidate(iceCandidate) {
		let candidate = new RTCIceCandidate(iceCandidate);
		printDebug("Received Candidate..."); //, candidate)
		this.peer.addIceCandidate(candidate);
	}
	close(isEmit) {
		if (this.peer) {
			this.peer.close();
			if (isEmit) {
				this.emit(WebRTC.EVENT_CLOSED, null);
			}
		}
		this.removeStream();
	}
	setBandWidth(bandwidth) {
		let preQuality = JSON.stringify(this.bandwidth);
		this.bandwidth = bandwidth;
		if (preQuality !== JSON.stringify(bandwidth)) {
			this.emit(WebRTC.EVENT_NEED_RESTART, null);
		}
	}
	getBandWidth() {
		return this.bandwidth;
	}
	setIsScreenSharing(isScreenSharing) {
		this.isScreenSharing = isScreenSharing;
	}
	IsScreenSharing() {
		return this.isScreenSharing;
	}
	getStatus(callback) {
		if (!Constants.IsFirefox) {
			getStats(this.peer, callback);
		}
	}
}

WebRTC.EVENT_CONNECTED = "connected";
WebRTC.EVENT_CLOSED = "closed";
WebRTC.EVENT_ADD_STREAM = "addstream";
WebRTC.EVENT_NEED_RESTART = "need_restart";
WebRTC.EVENT_REMOVE_STREAM = "removestream";
WebRTC.EVENT_ICECANDIDATE = "icecandidate";
WebRTC.EVENT_DATACHANNEL_MESSAGE = "datachannelmessage";
WebRTC.EVENT_NEGOTIATION_NEEDED = "negotiationneeded";
WebRTC.EVENT_DATACHANNEL_OPEN = "datachannelopen";
WebRTC.EVENT_DATACHANNEL_CLOSE = "datachannelclose";

export default WebRTC;
