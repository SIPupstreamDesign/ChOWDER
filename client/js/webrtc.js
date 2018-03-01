(function () {
	"use strict";
	function printError(e) {
		if (e) {
			console.error(e);
		}
	}

	function printDebug(a, b, c) {
		//console.error("WebRTC:", a ? a : "", b ? b : "", c ? c : "")
	}

	var MediaOptions = {
		'offerToReceiveAudio': true,
		'offerToReceiveVideo': true
	};

	var WebRTC = function () {
		EventEmitter.call(this);
		this.peer = this.prepareNewConnection();
		this.bandwidth = null;
		this.isScreenSharing = false;
	}
	WebRTC.prototype = Object.create(EventEmitter.prototype);

	WebRTC.prototype.prepareNewConnection = function () {
		printDebug("prepareNewConnection")
		var pc_config = {
			"iceServers": [
				{ "urls": "stun:stun.l.google.com:19302" },
				{ "urls": "stun:stun1.l.google.com:19302" },
				{ "urls": "stun:stun2.l.google.com:19302" }
			]
		};
		this.peer = null;
		try {
			this.peer = new RTCPeerConnection(pc_config);
		} catch (e) {
			printDebug("Failed to create peerConnection, exception: " + e.message);
			return;
		}
		this.peer.onicecandidate = function (evt) {
			printDebug("icecandidate");//, evt, this.peer);
			if (evt.candidate) {
				this.emit(WebRTC.EVENT_ICECANDIDATE, "tincle", evt.candidate);
			} else {
				this.emit(WebRTC.EVENT_ICECANDIDATE, "vanilla", this.peer.localDescription);
			}
		}.bind(this);

		this.peer.onnegotiationneeded = function (evt) {
			printDebug("onnegotiationneeded", evt);
			this.emit(WebRTC.EVENT_NEGOTIATION_NEEDED, evt);
		}.bind(this);

		this.peer.oniceconnectionstatechange = function (evt) {
			var state = this.peer.iceConnectionState;
			printDebug("oniceconnectionstatechange", state);
			if (state === "disconnected") {
				// 相手から切断された.
				// 30秒待って閉じる
				/*
				setTimeout(function () {
					if (this.peer.iceConnectionState === "disconnected") {
						this.close(true);
					}
				}.bind(this), 1000*30);
				*/
			} else if (state === "failed") {
				this.emit(WebRTC.EVENT_NEED_RESTART, null);
			} else if (state === "connected") {
				this.emit(WebRTC.EVENT_CONNECTED, null);
			}
		}.bind(this);

		if ('ontrack' in this.peer) {
			this.peer.ontrack = function (evt) {
				printDebug("Added remote stream", evt);
				this.emit(WebRTC.EVENT_ADD_STREAM, evt)
			}.bind(this);
			this.peer.onremovetrack = function (evt) {
				printDebug("Removed remote stream", evt);
				this.emit(WebRTC.EVENT_REMOVE_STREAM, evt)
			}.bind(this);
		} else {
			this.peer.onaddstream = function (evt) {
				printDebug("Added remote stream", evt);
				this.emit(WebRTC.EVENT_ADD_STREAM, evt)
			}.bind(this);
			this.peer.onremovestream = function (evt) {
				printDebug("Removed remote stream", evt);
				this.emit(WebRTC.EVENT_REMOVE_STREAM, evt)
			}.bind(this);
		}

		if (Constants.IsSafari) {
			if (MediaOptions.offerToReceiveAudio) {
				this.peer.addTransceiver('audio')
			}
			if (MediaOptions.offerToReceiveVideo) {
				this.peer.addTransceiver('video')
			}
		}

		return this.peer;
	};

	WebRTC.prototype.addStream = function (stream) {
		printDebug('Adding local stream...', stream);
		this.peer.addStream(stream);
	};

	WebRTC.prototype.offer = function (callback) {
		printDebug('offer');
		this.peer.createOffer(
			function (sdp) {
				// 成功
				sdp.sdp = this.setQuality(sdp.sdp);
				//printDebug("setLocalDescription", JSON.stringify(sdp))
				this.peer.setLocalDescription(sdp); // 自分で覚える
				callback(sdp); // コールバックで返す
			}.bind(this),
			function () {
				printDebug("Create Offer failed");
			},
			MediaOptions);
	}

	WebRTC.prototype.setQuality = function (sdp) {
		sdp = BandwidthHandler.setApplicationSpecificBandwidth(sdp, this.bandwidth, this.isScreenSharing)
		if (this.bandwidth && this.bandwidth.hasOwnProperty('video')) {
			sdp = BandwidthHandler.setVideoBitrates(sdp, {
				min : this.bandwidth.video,
				max : this.bandwidth.video_max,
			});
		}
		if (this.bandwidth && this.bandwidth.hasOwnProperty('audio')) {
			sdp = BandwidthHandler.setOpusAttributes(sdp, {
				"maxplaybackrate" : this.bandwidth.audio_max * 1024 * 8,
				"maxaveragebitrate" : this.bandwidth.audio_max * 1024 * 8
			});
		}
		return sdp;
	}

	WebRTC.prototype.answer = function (sdp, callback) {
		printDebug("WebRTC answer", sdp)
		this.peer.setRemoteDescription(new RTCSessionDescription(sdp),
			function () {
				this.peer.createAnswer(function (answer) {
					answer.sdp = this.setQuality(answer.sdp);
					this.peer.setLocalDescription(answer, function () {
						callback(answer);
					}, function (e) {
						printError(e)
					});
				}.bind(this), printError);
			}.bind(this),
			printError);
	};

	WebRTC.prototype.setAnswer = function (sdp, callback) {
		printDebug("setAnswer", sdp)
		this.peer.setRemoteDescription(new RTCSessionDescription(sdp), callback, function (e) {
			printError(e)
			callback(e);
		});
	};

	WebRTC.prototype.addIceCandidate = function (iceCandidate) {
		var candidate = new RTCIceCandidate(iceCandidate);
		printDebug("Received Candidate...");//, candidate)
		this.peer.addIceCandidate(candidate);
	};

	WebRTC.prototype.close = function (isEmit) {
		if (this.peer) {
			this.peer.close();
			if (isEmit) {
				this.emit(WebRTC.EVENT_CLOSED, null);
			}
		}
	};

	WebRTC.prototype.setBandWidth = function (bandwidth) {
		this.bandwidth = bandwidth;
		this.emit(WebRTC.EVENT_NEED_RESTART, null);
	};

	WebRTC.prototype.getBandWidth = function () {
		return this.bandwidth;
	};

	WebRTC.prototype.setIsScreenSharing = function (isScreenSharing) {
		this.isScreenSharing = isScreenSharing;
	};
	
	WebRTC.prototype.IsScreenSharing = function () {
		return this.isScreenSharing;
	};

	WebRTC.prototype.getStatus = function (callback) {
		getStats(this.peer, callback);
	}

	WebRTC.EVENT_CONNECTED = "connected";
	WebRTC.EVENT_CLOSED = "closed";
	WebRTC.EVENT_ADD_STREAM = "addstream";
	WebRTC.EVENT_NEED_RESTART = "need_restart";
	WebRTC.EVENT_REMOVE_STREAM = "removestream";
	WebRTC.EVENT_ICECANDIDATE = "icecandidate";
	WebRTC.EVENT_NEGOTIATION_NEEDED = "negotiationneeded";

	window.WebRTC = WebRTC;

}());