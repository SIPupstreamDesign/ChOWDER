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
		this.peer.onicecandidate = (evt) => {
			printDebug("icecandidate"); //, evt, this.peer);
			if (evt.candidate) {
				this.emit(WebRTC.EVENT_ICECANDIDATE, "tincle", evt.candidate);
			}
			else {
				this.emit(WebRTC.EVENT_ICECANDIDATE, "vanilla", this.peer.localDescription);
			}
		};
		this.peer.ondatachannel = (evt) => {
			// evt.channelにDataChannelが格納されているのでそれを使う
			if (evt.channel) {
				//console.error("hoge", evt.channel)
				this.datachannel = evt.channel;
				this.datachannel.onopen = function (event) {
					//console.error("datachannel.onopen")
				};
				this.datachannel.onmessage = (event) => {
					//console.error("event", event)
					this.emit(WebRTC.EVENT_DATACHANNEL_MESSAGE, null, event.data);
				};
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
	offer(callback) {
		//console.error("offer")
		let dataChannelOptions = {
			ordered: true,
			maxRetransmitTime: 100,
		};
		this.datachannel = this.peer.createDataChannel("myLabel", dataChannelOptions);
		this.datachannel.binaryType = "arraybuffer";
		this.datachannel.onopen = () => {
			this.emit("datachannel.onopen");
		};
		this.datachannel.onclose = () =>  {
			printDebug("datachannel.onclose");
		};
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
	answer(sdp, callback) {
		printDebug("WebRTC answer", sdp);
		this.peer.setRemoteDescription(new RTCSessionDescription(sdp), () => {
			this.peer.createAnswer((answer) => {
				answer.sdp = this.setQuality(answer.sdp);
				this.peer.setLocalDescription(answer, function () {
					callback(answer);
				}, function (e) {
					printError(e);
				});
			}, printError);
		}, printError);
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
		getStats(this.peer, callback);
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

export default WebRTC;
