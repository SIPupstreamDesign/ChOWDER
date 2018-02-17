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
		'mandatory': { 'OfferToReceiveAudio': true, 'OfferToReceiveVideo': true }
	};

	var WebRTC = function () {
		EventEmitter.call(this);
		this.peer = this.prepareNewConnection();
	}
	WebRTC.prototype = Object.create(EventEmitter.prototype);

	WebRTC.prototype.prepareNewConnection = function () {
		printDebug("prepareNewConnection")
		var pc_config = { "iceServers": [
			{"urls": "stun:stun.l.google.com:19302"},
			{"urls": "stun:stun1.l.google.com:19302"},
			{"urls": "stun:stun2.l.google.com:19302"}
		] };
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
			printDebug("oniceconnectionstatechange", this.peer.iceConnectionState);
			if (this.peer.iceConnectionState === "disconnected") {
				// 相手から切断された.
				this.peer.close();
			} else if (this.peer.iceConnectionState === "closed") {
				this.emit(WebRTC.EVENT_CLOSED, null);
			} else if (this.peer.iceConnectionState === "connected") {
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
				//printDebug("setLocalDescription", JSON.stringify(sdp))
				this.peer.setLocalDescription(sdp); // 自分で覚える
				callback(sdp); // コールバックで返す
			}.bind(this),
			function () {
				printDebug("Create Offer failed");
			},
			MediaOptions);
	}

    WebRTC.prototype.answer = function(sdp, callback) {
		printDebug("WebRTC answer", sdp)
		this.peer.setRemoteDescription(new RTCSessionDescription(sdp), 
			function () {
				this.peer.createAnswer(function (answer) {
					this.peer.setLocalDescription(answer, function () {
						callback(answer);
					}, function (e) {
						printError(e)
					});
				}.bind(this), printError);
			}.bind(this), 
			printError,
			MediaOptions);
	};
	
    WebRTC.prototype.setAnswer = function(sdp, callback) {
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

	WebRTC.prototype.close = function () {
		if (this.peer) {
			this.peer.close();
		}
	};


	WebRTC.EVENT_CONNECTED = "connected";
	WebRTC.EVENT_CLOSED = "closed";
	WebRTC.EVENT_ADD_STREAM = "addstream";
	WebRTC.EVENT_REMOVE_STREAM = "removestream";
	WebRTC.EVENT_ICECANDIDATE = "icecandidate";
	WebRTC.EVENT_NEGOTIATION_NEEDED = "negotiationneeded";

	window.WebRTC = WebRTC;

}());