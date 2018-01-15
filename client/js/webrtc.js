(function () {
	"use strict";

	var MediaOptions = { 
		'mandatory': { 'OfferToReceiveAudio': true, 'OfferToReceiveVideo': true }
	};

	var WebRTC = function () {
		this.onAddStream = this.onAddStream.bind(this);
		this.onRemoveStream = this.onRemoveStream.bind(this);
		this.onIceCandidate = this.onIceCandidate.bind(this);
	}

	WebRTC.prototype.prepareNewConnection = function () {
		console.log("prepareNewConnection")
		var pc_config = { "iceServers": [] };
		this.peer = null;
		try {
			this.peer = new webkitRTCPeerConnection(pc_config);
		} catch (e) {
			console.log("Failed to create peerConnection, exception: " + e.message);
			return;
		}
		this.peer.addEventListener('icecandidate', this.onIceCandidate);
		this.peer.addEventListener("addstream", this.onAddStream);
		this.peer.addEventListener("removestream", this.onRemoveStream);
		return this.peer;
	}

	WebRTC.prototype.addStream = function (stream) {
		console.log('Adding local stream...');
		this.peer.addStream(stream);
	}

	WebRTC.prototype.offer = function (callback) {
		var peer = this.prepareNewConnection();
		peer.createOffer(
			function (sdp) {
				// 成功
				console.log("setLocalDescription")
				peer.setLocalDescription(sdp); // 自分で覚える
				callback(sdp); // コールバックで返す
			}.bind(this),
			function () {
				console.log("Create Offer failed");
			},
			MediaOptions);
	}

	WebRTC.prototype.sendSDP = function (sdp) {
		var text = JSON.stringify(sdp);
		console.log("---sending sdp text ---");
		//console.log(text);
		//textForSendSDP.value = text;
	}

	WebRTC.prototype.sendCandidate = function (candidate) {
		var text = JSON.stringify(candidate);
		console.log("---sending candidate text ---");
		console.log(text);
		//textForSendICE.value = (textForSendICE.value + CR + iceSeparator + CR + text + CR);
		//textForSendICE.scrollTop = textForSendICE.scrollHeight;
	}

	WebRTC.prototype.onIceCandidate = function (evt) {
			console.log("onIceCandidate")
			if (evt.candidate) {
				console.log(evt.candidate);
				this.sendCandidate({
					type: "candidate",
					sdpMLineIndex: evt.candidate.sdpMLineIndex,
					sdpMid: evt.candidate.sdpMid,
					candidate: evt.candidate.candidate
				});
			} else {
				console.log("End of candidates. ------------------- phase=" + evt.eventPhase);
			}
		}

	WebRTC.prototype.onAddStream = function () {
		console.log("Added remote stream");
		//remoteVideo.src = window.webkitURL.createObjectURL(event.stream);
	}

	WebRTC.prototype.onRemoveStream = function () {
		console.log("Remove remote stream");
		//remoteVideo.src = "";
	}

	window.WebRTC = WebRTC;

}());