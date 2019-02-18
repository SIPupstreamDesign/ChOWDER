/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Command from '../../common/command'
import Store from './store';
import Action from '../action';
import MediaPlayer from '../../common/mediaplayer'
import WebRTC from '../../common/webrtc';
import Vscreen from '../../common/vscreen'
import VideoPlayer from '../../components/video_player'
import Validator from '../../common/validator'

"use strict";

/**
 * random ID (8 chars)
 */
function generateID() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000000).toString(16).substring(1);
	}
	return s4() + s4();
}

function captureStream(video) {
	if (video.captureStream) {
		return video.captureStream();
	} else if (video.mozCaptureStream) {
		return video.mozCaptureStream();
	}
	return null;
}

class VideoStore {
	constructor(connector, state, store, action, cookie) {
        this.connector = connector;
        this.state = state;
        this.store = store;
		this.action = action;

		// WebRTC用キーから WebRTCインスタンスへのマップ
		this.webRTCDict = {};

		// id から video のバイナリデータへのマップ
		this.videoDict = {};

		// id から video エレメントへのマップ
		this.videoPlayerDict = {};

		// mp4boxで読み込んだsegmentsのキャッシュ
		this.segmentDict = {};

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
	};

	release() {
		let i;
		for (i in this.webRTCDict) {
			this.webRTCDict[i].close(true);
		}
		this.webRTCDict = {};
		let metaDataList = [];
		for (i in this.videoDict) {
			if (this.store.hasMetadata(i)) {
				metaDataList.push(this.store.getMetaData(i));
			}
		}
		if (metaDataList.length > 0) {
			this.store.operation.deleteContent(metaDataList);
		}

		for (i in this.videoDict) {
			this.deleteVideoData(i);
		}
		for (i in this.videoPlayerDict) {
			this.deleteVideoPlayer(i);
		}
	}
    
	processMovieBlob(metaData, videoElem, blob, id) {
		//let fileSize   = file.size;
		let offset = 0;
		let readBlock = null;

		// segmentをキャッシュする用
		this.segmentDict[id] = {
			audio : [],
			video : [],
			videoIndex : 0,
			audioIndex : 0,
			playHandle : null
		};

		const DURATION = 1001;
		const TIMESCALE = 30000;
		const SAMPLE_SEC = DURATION / TIMESCALE;
		
		let mp4box = new MP4Box();
		let player = null;
		let chunkSize  = 1024 * 1024 * 1024; // bytes
		mp4box.onReady = (info) => {
			let videoCodec = 'video/mp4; codecs=\"' + info.tracks[0].codec +  '\"';
			let audioCodec = null;
			if (info.tracks.length > 1) {
				audioCodec = 'audio/mp4; codecs=\"' + info.tracks[1].codec +  '\"';
			} 
			// console.log("codec", videoCodec, audioCodec,
			//	MediaSource.isTypeSupported(videoCodec),
			//	MediaSource.isTypeSupported(audioCodec)
			//);
			if (!player) {
				player = new MediaPlayer(videoElem, videoCodec, audioCodec);
			}

			let playVideo = () => {
				this.segmentDict[id].playHandle = setInterval(() => {
					let videoSegs = this.segmentDict[id].video;
					let audioSegs = this.segmentDict[id].audio;
					if (videoSegs.length > 0) {
						player.onVideoFrame(videoSegs[this.segmentDict[id].videoIndex]);
						++this.segmentDict[id].videoIndex;
					}
					if (audioSegs.length > 0) {
						player.onAudioFrame(audioSegs[this.segmentDict[id].audioIndex]);
						++this.segmentDict[id].audioIndex;
					}
				}, SAMPLE_SEC);
			};
			let stopVideo = () => {
				clearInterval(this.segmentDict[id].playHandle);
			};

			let samplesInfo;
			player.on(MediaPlayer.EVENT_SOURCE_OPEN, () => {
				if (info.isFragmented) {
					console.info("duration fragment", info.fragment_duration/info.timescale)
					player.setDuration(info.fragment_duration/info.timescale);
					metaData.video_duration = info.fragment_duration/info.timescale;
				} else {
					console.info("duration", info.duration/info.timescale)
					player.setDuration(info.duration/info.timescale);
					metaData.video_duration = info.duration/info.timescale;
				}
				mp4box.setSegmentOptions(info.tracks[0].id, player.buffer, { nbSamples: 1 } );
				mp4box.setSegmentOptions(info.tracks[1].id, player.audioBuffer, { nbSamples: 1 } );

				samplesInfo = mp4box.getTrackSamplesInfo(info.tracks[0].id);

				let initSegs = mp4box.initializeSegmentation();
				this.segmentDict[id].video.push(initSegs[0].buffer);
				this.segmentDict[id].audio.push(initSegs[1].buffer);
				playVideo();
				mp4box.start();
			});
			player.on(MediaPlayer.EVENT_NEED_RELOAD, (err, time) => {
				stopVideo();
				const segmentIndex = time / SAMPLE_SEC;
				console.log("MediaPlayer.EVENT_NEED_RELOAD", time, segmentIndex, this.segmentDict[id].videoIndex, time / SAMPLE_SEC);
				this.segmentDict[id].videoIndex = segmentIndex;
				this.segmentDict[id].audioIndex = segmentIndex;
				playVideo();
			});
		}

		mp4box.onSegment = ((metaDataID) => {
			return (id, user, buffer, sampleNum, is_last) => {
				if (user === player.buffer) {
					this.segmentDict[metaDataID].video.push(buffer);
					// console.log("videoseg")
					//player.onVideoFrame(buffer);
				}
				if (user === player.audioBuffer) {
					this.segmentDict[metaDataID].audio.push(buffer);
					// console.log("audioseg")
					//player.onAudioFrame(buffer);
				}
			}
		})(id);

		let onparsedbuffer = function(mp4box, buffer) {
			//console.log("Appending buffer with offset "+offset);
			buffer.fileStart = 0;
			mp4box.appendBuffer(buffer);
		}
		
		onparsedbuffer(mp4box, blob); // callback for handling read chunk

		/*
		let onBlockRead = function(evt) {
			if (evt.target.error == null) {
				onparsedbuffer(mp4box, evt.target.result); // callback for handling read chunk
				offset += evt.target.result.byteLength;
				//progressbar.progressbar({ value: Math.ceil(100*offset/fileSize) });
			} else {
				// console.log("Read error: " + evt.target.error);
				//finalizeUI(false);
				return;
			}
			if (offset >= fileSize) {
				//progressbar.progressbar({ value: 100 });
				// console.log("Done reading file");
				mp4box.flush();
				videoElem.play();
				//finalizeUI(true);
				return;
			}
			readBlock(offset, chunkSize, file);
		}
		
		
		readBlock = function(_offset, length, _file) {
			let r = new FileReader();
			let blob = _file.slice(_offset, length + _offset);
			r.onload = onBlockRead;
			r.readAsArrayBuffer(blob);
		}
		readBlock(offset, chunkSize, file);
		*/
	}

	/**
	 * WebRTC接続開始
	 * @method connectWebRTC
	 */
	connectWebRTC(metaData, keyStr) {
		let player = this.getVideoPlayer(metaData.id);
		let video = player.getVideo();
		let webRTC;
		if (!this.webRTCDict.hasOwnProperty(keyStr)) {
			// 初回読み込み時
			let stream = captureStream(video);
			webRTC = new WebRTC();
			webRTC.setIsScreenSharing(metaData.subtype === "screen");
			this.webRTCDict[keyStr] = webRTC;
			if (!stream) {
				// for safari
				stream = video.srcObject;
			}
			webRTC.addStream(stream);
			video.ontimeupdate = () => {
				let meta = this.store.getMetaData(metaData.id);
				if (meta && meta.isEnded === 'true') {
					for (let i in this.webRTCDict) {
						if (i.indexOf(meta.id) >= 0) {
							this.webRTCDict[i].removeStream();
							this.webRTCDict[i].addStream(captureStream(video));
						}
					}
					meta.isEnded = false;
					this.store.operation.updateMetadata(meta);
				}
			};
			webRTC.on(WebRTC.EVENT_ICECANDIDATE, (type, data) => {
				if (type === "tincle") {
					metaData.from = "controller";
					this.connector.sendBinary(Command.RTCIceCandidate, metaData, JSON.stringify({
						key: keyStr,
						candidate: data
					}), function (err, reply) { });
					delete metaData.from;
				}
			});
			webRTC.on(WebRTC.EVENT_NEGOTIATION_NEEDED, () => {
				let webRTC = this.webRTCDict[keyStr];
				webRTC.offer((sdp) => {
					this.connector.sendBinary(Command.RTCOffer, metaData, JSON.stringify({
						key: keyStr,
						sdp: sdp
					}), function (err, reply) { });
                });
                this._changeCameraMicEnable({
                    id : metaData.id,
                    isMicOn : metaData.is_audio_on,
                    isCameraOn : metaData.is_video_on
                })
			});
			webRTC.on(WebRTC.EVENT_CLOSED, () => {
				delete this.webRTCDict[keyStr];
			});
			webRTC.on(WebRTC.EVENT_NEED_RESTART, () => {
				let webRTC = this.webRTCDict[keyStr];
				webRTC.removeStream();
				webRTC.addStream(stream);
				webRTC.offer((sdp) => {
					this.connector.sendBinary(Command.RTCOffer, metaData, JSON.stringify({
						key: keyStr,
						sdp: sdp
					}), function (err, reply) { });
				});
			});
			webRTC.on(WebRTC.EVENT_CONNECTED, () => {
				setTimeout(((metaData) => {
					let webRTC = this.webRTCDict[keyStr];

					webRTC.getStatus((status) => {
						let meta = this.store.getMetaData(metaData.id);
						meta.webrtc_status = JSON.stringify({
							bandwidth: {
								availableSendBandwidth: status.bandwidth.availableSendBandwidth,
								actualEncBitrate: status.bandwidth.googActualEncBitrate,
								targetEncBitrate: status.bandwidth.googTargetEncBitrate,
								transmitBitrate: status.bandwidth.googTransmitBitrate,
							},
							resolution: status.resolutions.send,
							video_codec: status.video.send.codecs[0],
							audio_codec: status.video.send.codecs[0]
						});
						this.store.operation.updateMetadata(meta);
					});
				})(metaData), 5000);
			});


			let currentPos = 0;
			let maxBytes = 65535;
			const NUM_SEGMENTS_A_TIME = 5;
			let updateLoop = (loopCount) => {
				setTimeout(() => {
					let webRTC = this.webRTCDict[keyStr];
					if (this.segmentDict.hasOwnProperty(metaData.id)) {
						let videoSegments = this.segmentDict[metaData.id].video;
						//console.error("hoge", videoSegments)
						try {
							if (currentPos === videoSegments.length)
								return;

							// 10segmentsずつ送る.
							for (let maxPos = currentPos + 5; currentPos < maxPos && currentPos < videoSegments.length; ++currentPos) {
								// 1segmentについてmaxBytesで分割しながら送る
								if (videoSegments[currentPos].byteLength >= maxBytes) {
									let pos = 0;
									while (true) {
										if ((pos + maxBytes) > videoSegments[currentPos].byteLength) {
											//console.error("slice", pos)
											let data = videoSegments[currentPos].slice(pos);
											webRTC.datachannel.send(data);
										}
										else {
											//console.error("slice", pos, pos + maxBytes)
											webRTC.datachannel.send(videoSegments[currentPos].slice(pos, pos + maxBytes));
										}
										pos += maxBytes;
										if (pos > videoSegments[currentPos].byteLength) {
											break;
										}
									}
								}
								else {
									//console.error(videoSegments[currentPos].byteLength)
									webRTC.datachannel.send(videoSegments[currentPos]);
								}
							}
							if (loopCount > 0) {
								updateLoop(--loopCount);
							}
						}
						catch (e) {
							// 送信失敗した場合、途中から再送を試みる
							console.warn(e);
							updateLoop(Math.ceil((videoSegments.length - currentPos)/ NUM_SEGMENTS_A_TIME));
							//webRTC.emit(WebRTC.EVENT_NEED_RESTART, null);
						}
					}
				}, 500);
			};
			if (metaData.use_datachannel) {
				webRTC.on(WebRTC.EVENT_DATACHANNEL_OPEN, () => {
					let videoSegments = this.segmentDict[metaData.id].video;
					updateLoop(Math.ceil(videoSegments.length/ NUM_SEGMENTS_A_TIME));
				});
			}
		}
		else {
			webRTC = this.webRTCDict[keyStr];
		}
		webRTC.offer((sdp) => {
			this.connector.sendBinary(Command.RTCOffer, metaData, JSON.stringify({
				key: keyStr,
				sdp: sdp
			}), function (err, reply) { });
		});
	}
	
	/**
	 * 動画ファイル処理用内部関数
	 */
	__processVideoFile(metaData, video, blob) {
        let subType = metaData.subtype;
		let videoData;
		if (subType === "file") {
			metaData.use_datachannel = true;
			this.processMovieBlob(metaData, video, blob, metaData.id);
			/*
			videoData = URL.createObjectURL(blob);
			video.src = videoData;
			video.load();
			*/
		}
		this.setVideoData(metaData.id, videoData);
		
		video.oncanplaythrough = function () {
			if (subType !== "file") {
				window.setTimeout(function(){
					this.play()
				}.bind(this), 1000); // for chrome
			}
		};

		video.onloadedmetadata = (e) => {
			metaData.type = "video";
			if (!metaData.hasOwnProperty("width")) {
				metaData.width = Number(video.videoWidth);
			}
			if (!metaData.hasOwnProperty("height")) {
				metaData.height = Number(video.videoHeight);
			}
			metaData.group = this.store.getGroupStore().getCurrentGroupID();
		};
		video.onloadeddata = () => {
			let data;
			if (!metaData.hasOwnProperty('is_video_on') ||
				metaData.hasOwnProperty('is_video_on') && String(metaData.is_video_on) !== "false") {
				// サムネイル生成
				let canvas = document.createElement('canvas');
				let context = canvas.getContext("2d");
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
				context.drawImage(video, 0, 0);
				data = canvas.toDataURL("image/jpeg");
			}
			else {
				data = this.getElem(metaData.id, true).src;
			}
			this.store.getContentStore().addContent(metaData, data, (err, reply) => {
				video.onplay = ((id) => {
					return () => {
						if (subType !== 'file') { return; }
						console.error(id);
						let metaData = this.store.getMetaData(id);
						console.error(metaData)
						metaData.isPlaying = true;
						this.store.operation.updateMetadata(metaData);	
					}
				})(metaData.id);
		
				video.onpause = ((id) => {
					return () => {
						if (subType !== 'file') { return; }
						let metaData = this.store.getMetaData(id);
						metaData.isPlaying = false;
						this.store.operation.updateMetadata(metaData);
					}
				})(metaData.id);
		
				video.onended = ((id) => {
					return () => {
						if (subType !== 'file') { return; }
						let metaData = this.store.getMetaData(id);
						metaData.isPlaying = false;
						metaData.isEnded = true;
						this.store.operation.updateMetadata(metaData);
					}
				})(metaData.id);
				
			});
		};
	}
    
    /**
     * 動画ファイルの入力
     * @param {*} data 
     */
    _inputVideoFile(data) {
        let metaData = data.metaData;
		let blob = data.contentData;
		
		// 動画は実体は送らずメタデータのみ送る
		// データとしてSDPを送る
		// 追加後のメタデータとローカルで保持しているコンテンツデータを紐づけるため
		// IDはクライアントで作成する
		if (metaData.hasOwnProperty("id") && this.store.hasMetadata(metaData.id)) {
			metaData = this.store.getMetaData(metaData.id);
		}
		else {
			metaData.id = generateID();
		}
		if (this.hasVideoPlayer(metaData.id)) {
			let player = this.getVideoPlayer(metaData.id);
			let video = player.getVideo();
			this.__processVideoFile(metaData, video, blob);
		}
		else {
			//video = document.createElement('video');
			let player = new VideoPlayer();
			this.setVideoPlayer(metaData.id, player);
			let video = player.getVideo();
			// カメラ,スクリーン共有は追加したコントローラではmuteにする
			if (metaData.subType === "camera" || metaData.subType === "screen") {
				video.muted = true;
			}
			player.on(VideoPlayer.EVENT_READY, () => {
				this.__processVideoFile(metaData, video, blob);
			});
		}
	}
	
	/**
	 * 動画ファイル処理用内部関数
	 */
	__processVideoStream(metaData, video, blob) {
        let subType = metaData.subtype;
		let videoData;
		// stream
		if ('srcObject' in video) {
			videoData = blob;
			video.srcObject = blob;
		}
		else {
			videoData = URL.createObjectURL(blob);
			video.src = videoData;
		}
		
		setTimeout(() => {
			video.load();
			video.play();
		}, 100)

		this.setVideoData(metaData.id, videoData);
		
		video.onloadedmetadata = (e) => {
			metaData.type = "video";
			if (!metaData.hasOwnProperty("width")) {
				metaData.width = Number(video.videoWidth);
			}
			if (!metaData.hasOwnProperty("height")) {
				metaData.height = Number(video.videoHeight);
			}
			metaData.group = this.store.getGroupStore().getCurrentGroupID();
		};
		video.onloadeddata = () => {
			let data;
			if (!metaData.hasOwnProperty('is_video_on') ||
				metaData.hasOwnProperty('is_video_on') && String(metaData.is_video_on) !== "false") {
				// サムネイル生成
				let canvas = document.createElement('canvas');
				let context = canvas.getContext("2d");
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
				context.drawImage(video, 0, 0);
				data = canvas.toDataURL("image/jpeg");
			}
			else {
				data = this.getElem(metaData.id, true).src;
			}
			this.store.getContentStore().addContent(metaData, data, (err, reply) => {});
		};
	}

    /**
     * 動画ストリームを入力
     * @param {*} data 
     */
    _inputVideoStream(data) {
        let metaData = data.metaData;
        let blob = data.contentData;

		// 動画は実体は送らずメタデータのみ送る
		// データとしてSDPを送る
		// 追加後のメタデータとローカルで保持しているコンテンツデータを紐づけるため
		// IDはクライアントで作成する
		if (metaData.hasOwnProperty("id") && this.store.hasMetadata(metaData.id)) {
			metaData = this.store.getMetaData(metaData.id);
		} else {
			metaData.id = generateID();
		}
		if (this.hasVideoPlayer(metaData.id)) {
			let player = this.getVideoPlayer(metaData.id);
			let video = player.getVideo();
			this.__processVideoStream(metaData, video, blob);
		} else {
			let player = new VideoPlayer();
			this.setVideoPlayer(metaData.id, player);
			let video = player.getVideo();
			// カメラ,スクリーン共有は追加したコントローラではmuteにする
			if (metaData.subType === "camera" || metaData.subType === "screen") {
				video.muted = true;
			}
			player.on(VideoPlayer.EVENT_READY, () => {
				this.__processVideoStream(metaData, video, blob);
			});
		}
    }
    
	// TODO
	restartCamera(metadataID, deviceInfo) {
		let isCameraOn = deviceInfo.isCameraOn;
		let isMicOn = deviceInfo.isMicOn;
		let audioDeviceID = deviceInfo.audioDeviceID;
		let videoDeviceID = deviceInfo.videoDeviceID;

		let constraints = {};
		let saveDeviceID = {
			video_device : videoDeviceID,
			audio_device : audioDeviceID
		}
		if (videoDeviceID) {
			constraints.video = { deviceId : videoDeviceID }
		} else {
			constraints.video = true;
			saveDeviceID.video_device = true;
		}
		if (audioDeviceID) {
			constraints.audio = { deviceId : audioDeviceID }
		} else {
			constraints.audio = true;
			saveDeviceID.audio_device = true;
		}
		
		if (!constraints.video && !constraints.audio) {
			// どちらか有効にしないといけない
			constraints.audio = true;
			saveDeviceID.audio_device = audioDeviceID;
		}

		navigator.mediaDevices.getUserMedia(constraints).then(
			((saveDeviceID) => {
				return (stream) => {
					if (this.store.hasMetadata(metadataID)) {
						// カメラマイク有効情報を保存
						let meta = this.store.getMetaData(metadataID)
						meta.video_device = saveDeviceID.video_device,
						meta.audio_device = saveDeviceID.audio_device,
						meta.is_video_on = isCameraOn,
						meta.is_audio_on = isMicOn,
						this.store.setMetaData(metadataID, meta)
					}
					this.action.inputVideoStream({
						contentData : stream,
						metaData : {
							id : metadataID,
							group: this.store.getGroupStore().getCurrentGroupID(),
							posx: Vscreen.getWhole().x,
							posy: Vscreen.getWhole().y,
							visible: true
						}
					})
				};
			})(saveDeviceID),
			function (err) {
				console.error('Could not get stream: ', err);
			});
	}


    /**
     * 動画デバイスの変更
     * @param {*} data 
     * {
	 *    id : metaData.id,
	 *    deviceID : deviceID
     * }
     */
    _changeVideoDevice(data) {
        let metadataID = data.id;
        if (data.hasOwnProperty('deviceInfo') && this.hasVideoPlayer(metadataID)) {
            this.restartCamera(metadataID, data.deviceInfo);
        }
    }

    /**
     * 音声デバイスの変更
     */
    _changeAudioDevice(data) {
        let metadataID = data.id;
		if (data.hasOwnProperty('deviceInfo') && this.hasVideoPlayer(metadataID)) {
			this.restartCamera(metadataID, data.deviceInfo);
		}
    }

    /**
     * 動画クオリティの変更
     */
    _changeVideoQuality(data) {
        let metadataID = data.id;
		if (this.hasVideoPlayer(metadataID) && data.hasOwnProperty('quality')) {
			if (this.store.hasMetadata(metadataID)) {
				let meta = this.store.getMetaData(metadataID);
				meta.quality = JSON.stringify(data.quality);
				this.store.operation.updateMetadata(meta);
			}
		}
    }

    /**
     * 動画コンテンツのカメラ、マイクの有効無効を設定
     */
    _changeCameraMicEnable(data) {
        let metadataID = data.id;
        let isCameraOn = data.isCameraOn;
        let isMicOn = data.isMicOn;
		for (let i in this.webRTCDict) {
			if (i.indexOf(metadataID) >= 0) {
				let streams = this.webRTCDict[i].peer.getLocalStreams();
				for (let k = 0; k < streams.length; ++k) {
					let videos = streams[k].getVideoTracks();
					for (let n = 0; n < videos.length; ++n) {
						videos[n].enabled = String(isCameraOn) !== "false";
					}
					let audios = streams[k].getAudioTracks();
					for (let n = 0; n < audios.length; ++n) {
						audios[n].enabled = String(isMicOn) !== "false";
					}
				}
			}
        }
	}

	/**
	 * 全video巻き戻し
	 * @param {*} data
	 */
	_rewindAllVideo(data) {
		let groupID = this.store.getGroupStore().getCurrentGroupID();
		let sendIds = [];
		this.store.for_each_metadata((id, metaData) => {
			if (Validator.isContentType(metaData) || Validator.isLayoutType(metaData)) {
				if (
					(metaData.group === groupID) &&
					(metaData.type === 'video')
				) {
					sendIds.push(metaData.id);
				}
			}
		});

		if (sendIds.length !== 0) {
			this.store.operation.sendMessage({ids: sendIds, command: 'rewindVideo'}, () => {});
		}
	}

	/**
	 * 全video再生
	 * @param {*} data
	 */
	_playAllVideo(data) {
		let groupID = this.store.getGroupStore().getCurrentGroupID();
		let sendIds = [];
		this.store.for_each_metadata((id, metaData) => {
			if (Validator.isContentType(metaData) || Validator.isLayoutType(metaData)) {
				if (
					(metaData.group === groupID) &&
					(metaData.type === 'video')
				) {
					sendIds.push(metaData.id);
				}
			}
		});

		if (sendIds.length !== 0) {
			this.store.operation.sendMessage({ids: sendIds, command: 'playVideo', play: data.play}, () => {});
		}
	}

	
	getWebRTCDict() {
		return this.webRTCDict;
	}

	// video data
	setVideoData(id, data) {
		if (this.hasVideoData(id)) {
			this.deleteVideoData(id);
		}
		this.videoDict[id] = data;
	}
	getVideoData(id, data) {
		return this.videoDict[id];
	}

	hasVideoData(id) {
		return this.videoDict.hasOwnProperty(id);
	}
	deleteVideoData(id) {
		let videoData = this.videoDict[id];
		if (videoData && videoData.getVideoTracks) {
			videoData.getVideoTracks().forEach(function (track) {
				track.stop();
			});
		}
		if (videoData && videoData.getAudioTracks) {
			videoData.getAudioTracks().forEach(function (track) {
				track.stop();
			});
		}
		delete this.videoDict[id];
	}

	// video player
	setVideoPlayer(id, player) {
		this.videoPlayerDict[id] = player;
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
}

export default VideoStore;