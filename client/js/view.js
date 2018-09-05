/*jslint devel:true*/
/*global Blob, URL, FileReader, DataView, Uint8Array, unescape, escape */

(function (vscreen, vscreen_util, connector) {
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

	console.log(location);
	var reconnectTimeout = 2000,
		timer,
		windowData = null,
		metaDataDict = {},
		groupDict = {},
		doneAddWindowMetaData,
		doneUpdateWindowMetaData,
		doneGetWindowMetaData,
		doneGetContent,
		doneGetMetaData,
		authority = null,
		controllers = {connectionCount: -1},
		webRTCDict = {},
		random_id_for_webrtc = generateID();

	function isFullScreen() {
		return !(!document.fullscreenElement &&    // alternative standard method
			!document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement );
	}

	function toggleFullScreen() {
		if (!isFullScreen()) {
			if (document.documentElement.requestFullscreen) {
				document.documentElement.requestFullscreen();
			} else if (document.documentElement.msRequestFullscreen) {
				document.documentElement.msRequestFullscreen();
			} else if (document.documentElement.mozRequestFullScreen) {
				document.documentElement.mozRequestFullScreen();
			} else if (document.documentElement.webkitRequestFullscreen) {
				document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
			}
		} else {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.msExitFullscreen) {
				document.msExitFullscreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			}
		}
	}

    function getTargetEvent(){
        if(window.ontouchstart !== undefined){
            return {
                mode: 'touch',
                start: 'touchstart',
                move: 'touchmove',
                end: 'touchend'
            };
        }else{
            return {
                mode: 'mouse',
                start: 'mousedown',
                move: 'mousemove',
                end: 'mouseup'
            };
        }
    }

	/**
	 * メタデータが表示中であるかを判別する
	 * @method isVisible
	 * @param {JSON} metaData 判別対象メタデータ
	 * @return {bool} 表示中であればtrueを返す.
	 */
	function isVisible(metaData) {
		return (metaData.hasOwnProperty('visible') && (metaData.visible === "true" || metaData.visible === true));
	}

	/**
	 * クライアントサイズを取得する.
	 * ただの `{width: window.innerWidth, height: window.innerHeight}`.
	 * @method getWindowSize
	 * @return {Object} クライアントサイズ
	 */
	function getWindowSize() {
		return {
			width : window.innerWidth,
			height : window.innerHeight
		};
	}

	/**
	 * エンコードされた文字列を返す.
	 * @method fixedEncodeURIComponent
	 * @param {String} str 文字列.
	 * @return {String} エンコードされた文字列
	 */
	function fixedEncodeURIComponent(str) {
		return encodeURIComponent(str).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
	}

	/**
	 * 辞書順でElementをareaに挿入.
	 * @method insertElementWithDictionarySort
	 * @param {Element} area  挿入先エリアのelement
	 * @param {Element} elem  挿入するelement
	 */
	function insertElementWithDictionarySort(area, elem) {
		var i,
			child,
			isFoundIDNode = false;
		if (!area.childNodes || area.childNodes.lendth === 0) {
			area.appendChild(elem);
			return;
		}
		for (i = 0; i < area.childNodes.length; i = i + 1) {
			child = area.childNodes[i];
			if (child.id && child.id.indexOf('_manip') < 0) {
				if (elem.id < child.id) {
					isFoundIDNode = true;
					area.insertBefore(elem, child);
					break;
				}
			}
		}
		if (!isFoundIDNode) {
			area.appendChild(elem);
			return;
		}
	}

	/**
	 * window idの取得.
	 * @method getWindowID
	 */
	function getWindowID() {
		return getQueryParams().id;
	}

	/**
	 * Parse `location.search` and return it as object.
	 * @returns {Object} result
	 */
	function getQueryParams() {
		var re = /[?&]([^=]+)=([^&]*)/g;
		var ret = {};
		var match;
		while ((match = re.exec(location.search)) !== null) { // while `re` is not depleted
			ret[match[1]] = match[2];
		}
		return ret;
	}

	/**
	 * Convert map into query params string.
	 * @param {Object} map Map of parameters you want to convert into
	 * @return {string} result
	 */
	function mapToQueryString(map) {
		var str = '?';
		for (var key in map) {
			if (map[key] !== undefined) {
				str += key + '=' + map[key] + '&';
			}
		}
		str = str.substring( 0, str.length - 1 ); // remove the last '&'

		return str;
	}

	/**
	 * Parse `location.search` and return it as object.
	 * @param {Object} map Map of parameters you want to set
	 */
	function setQueryParams(map) {
		var query = mapToQueryString(map);
		history.replaceState(null, '', location.href.match(/^[^?]+/)[0] + query);
	}

	/**
	 * View側Window[Display]登録
	 * @method registerWindow
	 */
	function registerWindow() {
		var wh = getWindowSize();

		vscreen.assignWhole(wh.width, wh.height, wh.width / 2.0, wh.height / 2.0, 1.0);

		var window_id = '';

		(function() { // since the variable `hash` is pretty local
			var hash = location.hash.substring(1); // legacy
			if (hash !== '') {
				window_id = decodeURIComponent(hash);
			}
		})();

		var query = getQueryParams(location.search) || {};
		window_id = query.id ? decodeURIComponent(query.id) : window_id;
		var groupId = undefined;

		var f = function() {
			if (window_id !== '') {
				connector.send('GetWindowMetaData', {id : window_id}, function (err, metaData) {
					if (!err && metaData) {
						var scale = parseFloat(query.scale) || parseFloat(metaData.orgWidth) / parseFloat(metaData.width);
						metaData.group = groupId || metaData.group,
						metaData.width = wh.width / scale;
						metaData.height = wh.height / scale;
						metaData.orgWidth = wh.width;
						metaData.orgHeight = wh.height;
						metaData.posx = query.posx || metaData.posx;
						metaData.posy = query.posy || metaData.posy;
						connector.send('AddWindowMetaData', metaData, doneAddWindowMetaData);
					} else {
						scale = parseFloat(query.scale) || 1.0;
						connector.send('AddWindowMetaData', {
							id: window_id,
							group: groupId,
							posx: query.posx || 0,
							posy: query.posy || 0,
							width: wh.width / scale,
							height: wh.height / scale,
							orgWidth: wh.width,
							orgHeight: wh.height,
							visible: true
						}, doneAddWindowMetaData);
					}
				});
			} else {
				var scale = parseFloat(query.scale) || 1.0;
				connector.send('AddWindowMetaData', {
					group: groupId,
					posx: query.posx || 0,
					posy: query.posy || 0,
					width: wh.width / scale,
					height: wh.height / scale,
					orgWidth: wh.width,
					orgHeight: wh.height,
					visible: true
				}, doneAddWindowMetaData);
			}
		};

		var groupName = decodeURIComponent(query.group || '');
		if (groupName) {
			connector.send('GetGroupList', {}, function (err, data) {
				for (var i = 0; i < data.displaygrouplist.length; i ++) {
					if (data.displaygrouplist[i].name === groupName) {
						groupId = data.displaygrouplist[i].id;
					}
				}
				f();
			});
		} else {
			f();
		}
	}

	/**
	 * リサイズ処理.
	 * リサイズされたサイズでUpdateWindowMetaDataを行う.
	 * @method registerWindow
	 */
	function resizeWindow() {
		var wh = getWindowSize(),
			cx = wh.width / 2.0,
			cy = wh.height / 2.0,
			metaData = windowData;
		if (!metaData) { return; }
		metaData.width = metaData.width * (wh.width / parseFloat(metaData.orgWidth));
		metaData.height = metaData.height * (wh.height / parseFloat(metaData.orgHeight));
		metaData.orgWidth = wh.width;
		metaData.orgHeight = wh.height;
		vscreen.assignWhole(wh.width, wh.height, cx, cy, 1.0);

		connector.send('UpdateWindowMetaData', [windowData], doneUpdateWindowMetaData);
	}

	function updateGroupDict(groupList) {
		var i;
		for (i = 0; i < groupList.length; ++i) {
			groupDict[groupList[i].id] = groupList[i];
		}
	}

	/**
	 * コンテンツまたはウィンドウの更新(再取得).
	 * @method update
	 * @param {String} updateType 更新の種類.
	 * @param {String} targetid 対象コンテンツID
	 */
	function update(updateType, targetid) {
		var previewArea = document.getElementById('preview_area');

		if (updateType === 'all') {
			console.log("update all");
			previewArea.innerHTML = "";
			connector.send('GetWindowMetaData', { id: getWindowID() }, function (err, json) {
				doneGetWindowMetaData(err, json);
				connector.send('GetMetaData', { type: 'all', id: '' }, doneGetMetaData);
			});
			connector.send('GetGroupList', {}, function (err, data) {
				if (!err && data.hasOwnProperty("grouplist")) {
					updateGroupDict(data.grouplist);
				}
			});
		} else if (updateType === 'window') {
			if (windowData !== null) {
				console.log("update winodow", windowData);
				connector.send('GetWindowMetaData', { id : windowData.id}, doneGetWindowMetaData);
			}
		} else if (updateType === 'group') {
			connector.send('GetGroupList', {}, function (err, data) {
				if (!err && data.hasOwnProperty("grouplist")) {
					updateGroupDict(data.grouplist);
				}
			});
		} else {
			console.log("update transform");
			if (targetid) {
				connector.send('GetMetaData', { type: '', id: targetid}, doneGetMetaData);
			} else {
				connector.send('GetMetaData', { type: 'all', id: ''}, doneGetMetaData);
			}
		}
	}

	/**
	 * コンテンツの選択
	 * @method select
	 * @param {String} targetid 対象コンテンツID
	 */
	function select(targetid) {
		var metaData,
			elem;
		if (metaDataDict.hasOwnProperty(targetid)) {
			metaData = metaDataDict[targetid];
			elem = document.getElementById(targetid);
			elem.style.borderWidth = "1px";
			elem.style.border = "solid";
			elem.is_dragging = true;
			
			if (elem.classList.contains("mark")) {
				elem.style.borderWidth = "6px";
				if (metaData.hasOwnProperty("group") && groupDict.hasOwnProperty(metaData.group)) {
					elem.style.borderColor = groupDict[metaData.group].color; 
				}
			}
		}
	}

	/**
	 * コンテンツタイプから適切なタグ名を取得する.
	 * @method getTagName
	 * @param {String} contentType コンテンツタイプ.
	 */
	function getTagName(contentType) {
		var tagName;
		if (contentType === 'text') {
			tagName = 'pre';
		} else if (contentType === 'video') {
			tagName = 'video';
		} else if (contentType === 'pdf') {
			tagName = 'canvas';
		} else if (contentType === 'tileimage') {
			tagName = 'div';
		} else {
			tagName = 'img';
		}
		return tagName;
	}

	/**
	 * 現在選択されているContentを非選択状態にする
	 * @method unselect
	 */
	function unselect() {
		var i,
			elem;
		for (i in metaDataDict) {
			if (metaDataDict.hasOwnProperty(i)) {
				elem = document.getElementById(metaDataDict[i].id);
				if (elem && elem.is_dragging) {
					elem.is_dragging = false;
					if (!elem.classList.contains("mark")) {
						elem.style.borderWidth = "0px";
					}
				}
			}
		}
	}

	/**
	 * 指定Contentを移動させる
	 * @oaram targetid コンテンツのid
	 * @param x ページのx座標
	 * @param y ページのy座標
	 */
	function translate(targetid, x, y) {
		var elem,
			metaData,
			i,
			max = 0;
		
		if (metaDataDict.hasOwnProperty(targetid)) {
			elem = document.getElementById(targetid);
			metaData = metaDataDict[targetid];
			metaData.posx = x;
			metaData.posy = y;
			
			vscreen_util.transPosInv(metaData);
			metaData.posx -= vscreen.getWhole().x;
			metaData.posy -= vscreen.getWhole().y;
			
			connector.send('UpdateMetaData', [metaData], function (err, reply) {
			});
		}
	}

	function translateZ(targetid) {
		var metaData,
			i,
			index,
			max = 0;
		
		if (metaDataDict.hasOwnProperty(targetid)) {
			metaData = metaDataDict[targetid];
			for (i in metaDataDict) {
				if (metaDataDict.hasOwnProperty(i)) {
					if (metaDataDict[i].id !== metaData.id && 
						!Validator.isWindowType(metaDataDict[i]) &&
						metaDataDict[i].hasOwnProperty("zIndex")) {
						index = parseInt(metaDataDict[i].zIndex, 10);
						if (!isNaN(index)) {
							max = Math.max(max, parseInt(metaDataDict[i].zIndex, 10));
						}
					}
				}
			}
			metaData.zIndex = max + 1;
			connector.send('UpdateMetaData', [metaData], function (err, reply) {});
		}
	}

	/**
	 * 現在選択されているContentのエレメントを返す. ない場合はnullが返る.
	 */
	function getSelectedElem() {
		var i,
			elem;
		for (i in metaDataDict) {
			if (metaDataDict.hasOwnProperty(i)) {
				elem = document.getElementById(metaDataDict[i].id);
				if (elem && elem.is_dragging) {
					return elem;
				}
			}
		}
		return null;
	}

	/**
	 * コンテンツにイベント等を設定.
	 * @param elem コンテンツのelement
	 * @param targetid コンテンツのid
	 */
    function setupContent(elem, targetid) {
        var d = getTargetEvent();
        if(d.mode === 'mouse'){
            elem.addEventListener(d.start, (function (elem) {
                return function (evt) {
                    var rect = elem.getBoundingClientRect();
                    unselect();
                    select(targetid);
                    elem.draggingOffsetLeft = evt.clientX - rect.left;
                    elem.draggingOffsetTop = evt.clientY - rect.top;
					translateZ(targetid);
                    evt.preventDefault();
                };
            }(elem)), false);
            window.onmouseup = function () {
                unselect();
            };
            window.onmousemove = function (evt) {
                var elem = getSelectedElem();
                if (elem && elem.is_dragging) {
                    translate(elem.id, evt.pageX - elem.draggingOffsetLeft, evt.pageY - elem.draggingOffsetTop);
                }
                evt.preventDefault();
            };
        }else{
            elem.addEventListener(d.start, (function (elem) {
                return function (evt) {
                    var rect = elem.getBoundingClientRect();
                    unselect();
                    select(targetid);
                    elem.draggingOffsetLeft = evt.changedTouches[0].clientX - rect.left;
                    elem.draggingOffsetTop = evt.changedTouches[0].clientY - rect.top;
					translateZ(targetid);
                    evt.preventDefault();
                };
            }(elem)), false);
            window.ontouchend = function () {
                unselect();
            };
            window.ontouchmove = function (evt) {
                var elem = getSelectedElem();
                if (elem && elem.is_dragging) {
                    translate(elem.id, evt.changedTouches[0].pageX - elem.draggingOffsetLeft, evt.changedTouches[0].pageY - elem.draggingOffsetTop);
                }
                evt.preventDefault();
            };
        }
    };

	function setupMemo(elem, metaData) {
		var previewArea = document.getElementById('preview_area'),
			memo = document.getElementById("memo:" + metaData.id),
			rect;
		if (elem && metaData.user_data_text) {
			if (memo) {
				memo.innerHTML = JSON.parse(metaData.user_data_text).text;
				rect = elem.getBoundingClientRect();
				memo.style.width = (rect.right - rect.left) + "px";
				memo.style.left = rect.left + "px";
				memo.style.top =  rect.bottom + "px";
				memo.style.zIndex = elem.style.zIndex;
			} else {
				memo = document.createElement("pre");
				memo.id = "memo:" + metaData.id;
				memo.className = "memo";
				memo.innerHTML = JSON.parse(metaData.user_data_text).text;
				rect = elem.getBoundingClientRect();
				memo.style.left = rect.left + "px";
				memo.style.top = rect.bottom + "px";
				memo.style.position = "absolute";
				memo.style.width = (rect.right - rect.left) + "px";
				memo.style.height = "auto";
				memo.style.whiteSpace = "pre-line";
				memo.style.zIndex = elem.style.zIndex;
				previewArea.appendChild(memo);
			}
			
			if (metaData.hasOwnProperty("group") && groupDict.hasOwnProperty(metaData.group)) {
				memo.style.borderColor = groupDict[metaData.group].color;
				memo.style.backgroundColor = groupDict[metaData.group].color; 
			}
		}
	}

	// このページのwebRTC用のキーを取得.
	// ディスプレイIDが同じでもページごとに異なるキーとなる.
	// (ページをリロードするたびに代わる)
	function getRTCKey(metaData) {
		return metaData.id + "_" + windowData.id + "_" + random_id_for_webrtc;
	}
	
	/**
	 * メタバイナリからコンテンツelementを作成してVirtualScreenに登録
	 * @method assignMetaBinary
	 * @param {JSON} metaData メタデータ
	 * @param {Object} contentData コンテンツデータ(テキストまたはバイナリデータ)
	 */
	function assignMetaBinary(metaData, contentData) {
		console.log(metaData);
		var previewArea = document.getElementById('preview_area'),
			tagName,
			blob,
			elem,
			mime = "image/jpeg",
			id,
			duplicatedElem;

		console.log("assignMetaBinary", "id=" + metaData.id);
		if (Validator.isWindowType(metaData) || (metaData.hasOwnProperty('visible') && String(metaData.visible) === "true")) {
			tagName = getTagName(metaData.type);

			// 既に読み込み済みのコンテンツかどうか
			if (document.getElementById(metaData.id)) {
				elem = document.getElementById(metaData.id);
				// 読み込み完了までテンポラリで枠を表示してる．枠であった場合は消す.
				if (elem.tagName.toLowerCase() !== tagName) {
					previewArea.removeChild(elem);
					elem = null;
				}
				// メタデータはGetMetaDataで取得済のものを使う.
				// GetContent送信した後にさらにGetMetaDataしてる場合があるため.
				if (metaDataDict.hasOwnProperty(metaData.id)) {
					metaData = metaDataDict[metaData.id];
				}
			}

			if (!elem) {
				elem = document.createElement(tagName);
				elem.id = metaData.id;
				elem.style.position = "absolute";
				elem.style.color = "white";
				setupContent(elem, elem.id);
				insertElementWithDictionarySort(previewArea, elem);
				//previewArea.appendChild(elem);
			}
			if (metaData.type === 'video') {
				var rtcKey = getRTCKey(metaData);
				elem.setAttribute("controls", "");
				elem.setAttribute('autoplay', '')
				elem.setAttribute('preload', "metadata")
				if (!webRTCDict.hasOwnProperty(rtcKey)) {
					metaData.from = "view";
					connector.sendBinary('RTCRequest', metaData, JSON.stringify({ key : rtcKey }), function () {
						var webRTC = new WebRTC();
						webRTCDict[rtcKey] = webRTC;
						webRTC.on('addstream', function (evt) {
							var stream = evt.stream ? evt.stream : evt.streams[0];
							elem.srcObject = stream;

							if (!webRTC.statusHandle) {
								var t = 0;
								webRTC.statusHandle = setInterval( function (rtcKey, webRTC) {
									t += 1;
									webRTC.getStatus(function (status) {
										var bytes = 0;
										if (status.video && status.video.bytesReceived) {
											bytes += status.video.bytesReceived;
										}
										if (status.audio && status.audio.bytesReceived) {
											bytes += status.audio.bytesReceived;
										}
										console.log("webrtc key:"+ rtcKey + "  bitrate:" + Math.floor(bytes * 8 / this / 1000) + "kbps");
									}.bind(t));
								}.bind(this, rtcKey, webRTCDict[rtcKey]), 1000);
							}
						}.bind(rtcKey));

						webRTC.on('icecandidate', function (type, data) {
							if (type === "tincle") {
								metaData.from = "view";
								connector.sendBinary('RTCIceCandidate', metaData, JSON.stringify({
									key : rtcKey,
									candidate: data
								}), function (err, reply) {});
								delete metaData.from;
							}
						});
						
						webRTC.on('closed', function () {
							if (webRTCDict.hasOwnProperty(this)) {
								if (webRTCDict[this].statusHandle) {
									clearInterval(webRTCDict[this].statusHandle);
									webRTCDict[this].statusHandle = null;
								}
								delete webRTCDict[this];
							}
						}.bind(rtcKey));
					});
					delete metaData.from;
				}
			} else if (metaData.type === 'text') {
				// contentData is text
				elem.innerHTML = contentData;
			} else if (metaData.type === 'pdf') {
				if (!elem.pdfSetupCompleted) {
					elem.pdfSetupCompleted = true;
					var context = elem.getContext('2d');

					var pdfjsLib = window['pdfjs-dist/build/pdf'];

					pdfjsLib.getDocument(contentData).then(function (pdf) {
						metaData.pdfNumPages = pdf.numPages;

						var lastTask = Promise.resolve();
						var lastDate = 0;
						var lastPage = 0;
						var lastWidth = 0;
						elem.loadPage = function (p, width) {
							var date = Date.now();
							lastDate = date;

							if (lastPage === p && lastWidth === width) { return; }

							setTimeout(function () {
								if (lastDate !== date) { return; }
								lastPage = p;
								lastWidth = width;

								pdf.getPage(p).then(function (page) {
									var viewport = page.getViewport(width / page.getViewport(1).width);

									var orgAspect = metaData.orgWidth / metaData.orgHeight;
									var pageAspect = viewport.width / viewport.height;

									elem.width = width;
									elem.height = width / orgAspect;

									var transform = [ 1, 0, 0, 1, 0, 0 ];
									if ( orgAspect < pageAspect ) {
										var margin = ( 1.0 / orgAspect - 1.0 / pageAspect ) * width;
										transform[ 5 ] = margin / 2;
									} else {
										margin = ( orgAspect - pageAspect ) * width;
										transform[ 4 ] = margin / 2;
										transform[ 0 ] = ( width - margin ) / width;
										transform[ 3 ] = transform[ 0 ];
									}

									lastTask = lastTask.then(function () {
										return page.render({
											canvasContext: context,
											viewport: viewport,
											transform: transform
										});
									});
								});
							}, lastPage === p ? 500 : 0);
						};
						elem.loadPage(parseInt(metaData.pdfPage), parseInt(metaData.width));
					});
				}
			} else if (metaData.type === 'tileimage') {
				// nothing to do
			} else {
				// contentData is blob
				if (metaData.hasOwnProperty('mime')) {
					mime = metaData.mime;
				}
				blob = new Blob([contentData], {type: mime});
				if (elem && blob) {
					URL.revokeObjectURL(elem.src);
					elem.src = URL.createObjectURL(blob);
				}
			}
			vscreen_util.assignMetaData(elem, metaData, false, groupDict);
			
			// 同じコンテンツを参照しているメタデータがあれば更新
			if (elem) {
				for (id in metaDataDict) {
					if (metaDataDict.hasOwnProperty(id) && id !== metaData.id) {
						if (metaData.content_id === metaDataDict[id].content_id) {
							duplicatedElem = document.getElementById(id);
							if (duplicatedElem) {
								if (metaData.type === 'text') {
									duplicatedElem.innerHTML = elem.innerHTML;
								} else {
									duplicatedElem.src = elem.src;
								}
								connector.send('GetMetaData', metaDataDict[id], doneGetMetaData);
							}
						}
					}
				}
			}

			setupMemo(elem, metaData);
		}
	}

	/**
	 * コンテンツロード完了まで表示する枠を作る.
	 * @method createBoundingBox
	 * @param {JSON} metaData メタデータ
	 */
	function createBoundingBox(metaData) {
		console.log("createBoundingBox", metaData);
		var previewArea = document.getElementById('preview_area'),
			tagName = 'div',
			elem = document.createElement(tagName);

		elem.id = metaData.id;
		elem.style.position = "absolute";
		elem.className = Constants.TemporaryBoundClass;
		setupContent(elem, elem.id);
		insertElementWithDictionarySort(previewArea, elem);
	}

	/**
	 * VirtualDisplay更新
	 * @method updateWindow
	 * @param {JSON} metaData VirtualDisplayメタデータ
	 */
	function updateWindow(metaData) {
		var cx = parseFloat(metaData.posx, 10),
			cy = parseFloat(metaData.posy, 10),
			w = parseFloat(metaData.width),
			h = parseFloat(metaData.height),
			orgW = parseFloat(vscreen.getWhole().orgW),
			scale = orgW / w;

		console.log("scale:" + scale);

		// scale
		vscreen.setWholePos(0, 0);
		vscreen.setWholeCenter(0, 0);
		vscreen.setWholeScale(scale);

		// trans
		vscreen.translateWhole(-cx, -cy);
	}

	/**
	 * リサイズに伴うDisplayの更新
	 * @method resizeViewport
	 * @param {JSON} windowData ウィンドウメタデータ
	 */
	function resizeViewport(windowData) {
		var wh = getWindowSize(),
			cx = wh.width / 2.0,
			cy = wh.height / 2.0,
			scale,
			id,
			metaTemp;

		updateWindow(windowData);

		for (id in metaDataDict) {
			if (metaDataDict.hasOwnProperty(id)) {
				if (document.getElementById(id)) {
					vscreen_util.assignMetaData(document.getElementById(id), metaDataDict[id], false, groupDict);
				}
			}
		}
	}

    if(getTargetEvent().mode === 'mouse'){
        window.document.addEventListener("mousedown", function () {
            var displayArea = document.getElementById('displayid_area');
            if (displayArea.style.display !== "none") {
                displayArea.style.display = "none";
            }
        });
    }else{
        window.document.addEventListener("touchstart", function () {
            var displayArea = document.getElementById('displayid_area');
            if (displayArea.style.display !== "none") {
                displayArea.style.display = "none";
            }
        });
    }

	/**
	 * ディスプレイIDの表示.
	 * @method showDisplayID
	 * @param {string} id ディスプレイID
	 */
	function showDisplayID(id) {
		console.log("showDisplayID:" + id);
		if (id && windowData.id === id) {
			document.getElementById('displayid_area').style.display = "block";
			setTimeout(function () {
				document.getElementById('displayid_area').style.display = "none";
			}, 8 * 1000);
		} else if (id === "") {
			document.getElementById('displayid_area').style.display = "block";
			setTimeout(function () {
				document.getElementById('displayid_area').style.display = "none";
			}, 8 * 1000);
		}
	}

	/**
	 * ディスプレイIDの変更.
	 * @method changeID
	 * @param {string} id 新しいディスプレイID
	 */
	function changeID(id) {
		var newId = id.replace(' ', '_');
		var params = {id: newId};

		connector.send('GetWindowMetaData', {id : getWindowID()}, function (err, metaDataCur) {
			if (!err && metaDataCur) {
				connector.send('GetWindowMetaData', {id : newId}, function (err, metaDataDst) {
					if (!err && metaDataDst) {
						params.posx = metaDataDst.posx;
						params.posy = metaDataDst.posy;
						params.scale = parseFloat(metaDataDst.orgWidth) / parseFloat(metaDataDst.width);
					} else {
						params.posx = metaDataCur.posx;
						params.posy = metaDataCur.posy;
						params.scale = parseFloat(metaDataCur.orgWidth) / parseFloat(metaDataCur.width);
					}
		
					setQueryParams(params);
					location.reload();
				});
			} else {
				console.error('Something weird is happening');
				console.error(err);
			}
		});
	}

	/**
	 * 表示非表示の更新.
	 * @method updatePreviewAreaVisible
	 * @param {JSON} json メタデータ
	 */
	function updatePreviewAreaVisible(json) {
		var previewArea = document.getElementById("preview_area"),
			elem = document.getElementById(json.id);
		console.log("updatePreviewAreaVisible", previewArea, elem);
		if (previewArea) {
			if (isVisible(json)) {
				vscreen_util.assignMetaData(previewArea, json, false, groupDict);
				previewArea.style.display = "block";
			} else {
				previewArea.style.display = "none";
			}
		}
		if (elem) {
			if (isVisible(json)) {
				vscreen_util.assignMetaData(elem, json, false, groupDict);
				elem.style.display = "block";
			} else {
				elem.style.display = "none";
			}
		}
	}

	/**
	 * コンテンツメタデータがウィンドウ内にあるか再計算する
	 * @method recalculateContentVisible
	 */
	function updateContentVisible() {
		var i;
		for (i in metaDataDict) {
			if (metaDataDict.hasOwnProperty(i)) {
				console.log(metaDataDict[i]);
				if (metaDataDict[i].type !== 'window') {
					doneGetMetaData(null, metaDataDict[i]);
				}
			}
		}
	}

	/**
	 * AddWindowMetaData終了コールバック
	 * @param {String} err エラー.なければnull
	 * @param {JSON} json メタデータ
	 */
	doneAddWindowMetaData = function (err, json) {
		console.log("doneAddWindowMetaData", json);
		var i;
		if (!err) {
			for (i = 0; i < json.length; i = i + 1) {
				metaDataDict[json[i].id] = json[i];
				windowData = json[i];
				window.parent.document.title = "Display ID:" + json[i].id;
				document.getElementById('input_id').value = json[i].id;
				document.getElementById('displayid').innerHTML = "ID:" + json[i].id;
				setQueryParams({id: json[i].id});
				updatePreviewAreaVisible(windowData);
				resizeViewport(windowData);
			}
		}
		update('all');
	};

	doneUpdateWindowMetaData = function (err, json) {
		console.log("doneUpdateWindowMetaData", json);
		var i;
		if (!err) {
			for (i = 0; i < json.length; i = i + 1) {
				metaDataDict[json[i].id] = json[i];
				windowData = json[i];
				window.parent.document.title = "Display ID:" + json[i].id;
				document.getElementById('input_id').value = json[i].id;
				document.getElementById('displayid').innerHTML = "ID:" + json[i].id;
				updatePreviewAreaVisible(windowData);
				resizeViewport(windowData);
			}
		}
	};

	/**
	 * GetWindowMetaData終了コールバック
	 * @param {String} err エラー.なければnull
	 * @param {JSON} json メタデータ
	 */
	doneGetWindowMetaData = function (err, json) {
		console.log("doneGetWindowMetaData", json);
		if (!err && json) {
			metaDataDict[json.id] = json;
			windowData = json;
			updatePreviewAreaVisible(windowData);
			resizeViewport(windowData);
			updateContentVisible();
		} else if (err) {
			authority = null;
			connector.send('Logout', {}, function () {
			});
		}
		/*else if (err) {
			changeID(null, windowData.id, true);
			windowData = null;
			updatePreviewAreaVisible({ visible : false});
			registerWindow();
		}
		*/
	};


	/**
	 * GetContent終了コールバック
	 * @param {String} err エラー.なければnull
	 * @param {Object} data コンテンツデータ
	 */
	doneGetContent = function (err, data) {
		console.log("doneGetContent", err, data);
		if (!err) {
			var metaData = data.metaData,
				contentData = data.contentData;

			// サムネイルなどの複数バイナリが入っている場合
			// contentData[0]はmetaDataのリスト.
			// contentData[1]はbinaryDataのリスト.
			// contentData[n][0]がコンテンツ本体
			if (data.contentData instanceof Array) {
				contentData = data.contentData[1][0];
			}
		
			// 閲覧可能か
			if (!isViewable(metaData.group)) {
				return;
			}
			// レイアウトは無視
			if (Validator.isLayoutType(metaData)) { return; }

			if (metaData.type === 'tileimage') {
				assignTileImage(metaData, contentData, true);
			} else {
				// コンテンツ登録&表示
				assignMetaBinary(metaData, contentData);
			}
		}
	};

	/**
	 * マークによるコンテンツ強調表示のトグル
	 * @param {Element} elem 対象エレメント
	 * @param {JSON} metaData メタデータ
	 */
	function toggleMark(elem, metaData) {
		var mark_memo = "mark_memo",
			mark = "mark",
			memo = null;
		if (elem && metaData.hasOwnProperty("id")) {
			if (metaData.hasOwnProperty(mark) && (metaData[mark] === 'true' || metaData[mark] === true)) {
				if (!elem.classList.contains(mark)) {
					elem.classList.add(mark);
					if (metaData.hasOwnProperty("group") && groupDict.hasOwnProperty(metaData.group)) {
						elem.style.borderColor = groupDict[metaData.group].color;
						elem.style.borderWidth = "6px";
					}
				}
			} else {
				if (elem.classList.contains(mark)) {
					elem.classList.remove(mark);
					elem.style.borderWidth = "0px";
				}
			}
			memo =  document.getElementById("memo:" + metaData.id);
			if (memo) {
				if (metaData.hasOwnProperty("group") && groupDict.hasOwnProperty(metaData.group)) {
					memo.style.borderColor = "lightgray";
					memo.style.backgroundColor = "lightgray"; 
				}
				if ( (metaData[mark_memo] === 'true' || metaData[mark_memo] === true) && 
					 (metaData["visible"] === 'true' || metaData["visible"] === true) )
				{
					memo.style.display = "block";
				} else {
					memo.style.display = "none";
				}
			}
		}
	}

	function deleteMark(elem, metaData) {
		var mark_memo = "mark_memo",
			mark = "mark",
			memo = null;

		if (elem && metaData.hasOwnProperty("id")) {
			memo =  document.getElementById("memo:" + metaData.id);
			if (memo) {
				memo.style.display = "none";
				if (memo.parentNode) {
					memo.parentNode.removeChild(memo);
				}
				delete metaData[mark_memo];
			}
		}
	}

	function isViewable(group) {
		// 権限情報があるか
		if (!authority) {
			return false;
		}
		if (group === undefined || group === "") {
			return true;
		}
		if (group === Constants.DefaultGroup) {
			return true;
		}
		if (groupDict.hasOwnProperty(group)) {
			if (authority.viewable === "all") {
				return true;
			}
			if (authority.viewable.indexOf(group) >= 0) {
				return true;
			}
		}
		return false;
	}

	/**
	 * タイル画像の枠を全部再生成する。中身の画像(image.src)は作らない。
	 * @param {*} elem 
	 * @param {*} metaData 
	 */
	function regenerateTileElements(elem, metaData) {
		var i, k;
		var image;
		var tileIndex = 0;
		var previewArea = document.getElementById('preview_area');
		if (elem) {
			// 読み込み完了までテンポラリで枠を表示してる．枠であった場合は消す.
			if (elem.className === Constants.TemporaryBoundClass) {
				previewArea.removeChild(elem);
				elem = null;
			}
		}
		if (!elem) {
			elem = document.createElement(getTagName(metaData.type));
			elem.id = metaData.id;
			elem.style.position = "absolute";
			elem.style.color = "white";
			setupContent(elem, elem.id);
			insertElementWithDictionarySort(previewArea, elem);
		}
		elem.innerHTML = "";
		// reduction image用
		image = new Image();
		image.style.position = "absolute";
		image.style.display = "inline";
		image.className = "reduction_image";
		elem.appendChild(image);

		// tile用
		for (i = 0; i < Number(metaData.ysplit); ++i) {
			for (k = 0; k < Number(metaData.xsplit); ++k) {
				image = new Image();
				image.style.position = "absolute";
				image.style.display = "inline";
				image.className = "tile_index_" + String(tileIndex);
				elem.appendChild(image);
				++tileIndex;
			}
		}
	}

	/**
	 * タイル画像はassignMetaBinaryではなくこちらでコンテンツ生成を行う。
	 * @param {*} metaData 
	 * @param {*} isReload 全て再読み込みする場合はtrue, 読み込んでいない部分のみ読み込む場合はfalse
	 */
	function assignTileImage(metaData, contentData, isReload) {
		var elem = document.getElementById(metaData.id);
		var i, k;
		var tileIndex = 0;
		var request = JSON.parse(JSON.stringify(metaData));

		// ウィンドウ枠内に入っているか判定用
		var whole = vscreen.transformOrgInv(vscreen.getWhole());
		whole.x = vscreen.getWhole().x;
		whole.y = vscreen.getWhole().y;

		var rect;
		var mime = "image/jpeg";
		var previousElem = null;
		var previousImage = null;
		var visible;
		var isInitial = true;

		for (i = 0; i < Number(metaData.ysplit); ++i) {
			for (k = 0; k < Number(metaData.xsplit); ++k) {
				request.tile_index = tileIndex; // サーバーでは通し番号でtile管理している
				rect = vscreen_util.getTileRect(metaData, k, i);
				visible = !vscreen_util.isOutsideWindow(rect, whole);
				var tileClassName = 'tile_index_' + String(tileIndex);

				if (visible) {
					if (elem && elem.getElementsByClassName(tileClassName).length > 0) {
						previousElem = elem.getElementsByClassName(tileClassName)[0]
					}
					if (previousElem) {
						previousImage = previousElem.src.length > 0;
					} else {
						// 最初の1個が見つからない場合はimageエレメントを全部作り直す
						regenerateTileElements(elem, metaData);
						elem = document.getElementById(metaData.id);
						vscreen_util.resizeTileImages(elem, metaData);
					}
					
					if (isInitial
						&& metaData.hasOwnProperty('reductionWidth')
						&& metaData.hasOwnProperty('reductionHeight')) {

						var reductionElem = elem.getElementsByClassName('reduction_image')[0];
					
						// contentData(reduction data)を生成
						// 解像度によらず生成する
						if (reductionElem.src.length === 0 || isReload) {
							if (!reductionElem.src.length === 0) {
								URL.revokeObjectURL(reductionElem.src);	
							}
							var blob = new Blob([contentData], {type: mime});
							reductionElem.src = URL.createObjectURL(blob);
						}

						// metadataの解像度がcontentData（縮小版画像）より小さいか調べる
						if (Number(metaData.width) <= Number(metaData.reductionWidth)
							&& Number(metaData.height) <= Number(metaData.reductionHeight)) {

							// reductionを表示、タイルを非表示に
							reductionElem.style.display = "inline";
							for (var n = 0; n < elem.children.length; ++n) {
								if (elem.children[n].className !== "reduction_image") {
									elem.children[n].style.display = "none"
								}
							}
							return;
						} else {
							// reductionを非表示、タイルを表示
							reductionElem.style.display = "none";
							for (var n = 0; n < elem.children.length; ++n) {
								if (elem.children[n].className !== "reduction_image") {
									elem.children[n].style.display = "inline"
								}
							}
						}
					}
					
					if (!previousImage || isReload) {
						connector.send('GetTileContent', request, function (err, data) {
							if (err) { console.error(err); return; }
							var tileClassName = 'tile_index_' + String(data.metaData.tile_index);
							var blob = new Blob([data.contentData], {type: mime});
							var image = elem.getElementsByClassName(tileClassName)[0];
							if (!previousImage) {
								URL.revokeObjectURL(image.src);	
							}
							image.src = URL.createObjectURL(blob);
						});
					}

					isInitial = false;
				}
				++tileIndex;
			}
		}
	}


	/**
	 * GetMetaData終了コールバック
	 * @param {String} err エラー.なければnull
	 * @param {JSON} json メタデータ
	 */
	doneGetMetaData = function (err, json) {
		var metaData = json,
			isUpdateContent = false;
		console.log("doneGetMetaData", json);
		if (!json) { return; }
		// レイアウトは無視
		if (Validator.isLayoutType(metaData)) { return; }
		// 復元したコンテンツか
		if (!json.hasOwnProperty('id')) { return; }
		if (metaDataDict.hasOwnProperty(json.id)) {
			isUpdateContent = (metaDataDict[json.id].restore_index !== json.restore_index);
			isUpdateContent = isUpdateContent || (metaDataDict[json.id].keyvalue !== json.keyvalue);
		}
		// 閲覧可能か
		if (!isViewable(json.group)) {
			return;
		}

		// 履歴からのコンテンツ復元.
		if (metaDataDict.hasOwnProperty(json.id) && json.hasOwnProperty('restore_index')) {
			if (metaDataDict[json.id].restore_index !== json.restore_index) {
				var request = { type: json.type, id: json.id, restore_index : json.restore_index };
				connector.send('GetContent', request, function (err, reply) {
					doneGetContent(err, reply);
					toggleMark(document.getElementById(json.id), metaData);
				});
			}
		}
		
		metaDataDict[json.id] = json;
		if (!err) {
			var elem = document.getElementById(json.id),
				isWindow = Validator.isWindowType(json),
				isOutside = false,
				whole;

			if (isWindow) {
				console.log(json.id, getWindowID());
				if (json.id !== getWindowID()) {
					return;
				}
			} else {
				whole = vscreen.transformOrgInv(vscreen.getWhole());
				whole.x = vscreen.getWhole().x;
				whole.y = vscreen.getWhole().y;
				isOutside = vscreen_util.isOutsideWindow(json, whole);
				//console.log(isOutside, json, vscreen.getWhole());
			}
			console.log("isOutside:", isOutside);

			if (isOutside) {
				if (elem) {
					// コンテンツが画面外にいった
					elem.style.display = "none";
					// webrtcコンテンツが画面外にいったら切断して削除しておく.
					var rtcKey = getRTCKey(json);
					if (webRTCDict.hasOwnProperty(rtcKey)) {
						webRTCDict[rtcKey].close(true);
						if (elem.parentNode) {
							elem.parentNode.removeChild(elem);
						}

						metaData.from = "view";
						connector.sendBinary('RTCClose', metaData, JSON.stringify({
							key : rtcKey
						}), function (err, reply) {});
						delete metaData.from;
					}
				}
			} else {
				if (elem && elem.tagName.toLowerCase() === getTagName(json.type)) {
					if (isVisible(json)) {
						vscreen_util.assignMetaData(elem, json, false, groupDict);
						elem.style.display = "block";

						// pdfページの切り替え
						if (json.type === 'pdf' && elem.loadPage) {
							elem.loadPage(parseInt(json.pdfPage), parseInt(json.width));
						}
					} else {
						elem.style.display = "none";
					}
				}
				if (isUpdateContent || (!isWindow && isVisible(json))) {
					if (isUpdateContent) {
						// updatecontentの場合はelemがあっても更新
						connector.send('GetContent', json, function (err, reply) {
							doneGetContent(err, reply);
							toggleMark(document.getElementById(json.id), metaData);
						});
					} else if (!elem) {
						// コンテンツがロードされるまで枠を表示しておく.
						createBoundingBox(json);
						// 新規コンテンツロード.
						connector.send('GetContent', json, function (err, reply) {
							doneGetContent(err, reply);
							toggleMark(document.getElementById(json.id), metaData);
						});
					}
					if (json.type === "tileimage") {
						// window範囲外で非表示になっているタイルが
						// window範囲内に来ていた場合は、その部分のタイルを読み込む
						assignTileImage(json, null, false);
					}
					elem = document.getElementById(json.id);
					vscreen_util.assignMetaData(elem, json, false, groupDict);
				}
				if (isWindow) {
					resizeViewport(windowData);
				} else {
					setupMemo(elem, metaData);
					toggleMark(elem, metaData);
				}
			}
		}
	};

	/**
	 * 読み込み済コンテンツの全削除
	 */
	function deleteAllElements() {
		var id,
			elem,
			previewArea = document.getElementById('preview_area');
		for (id in metaDataDict) {
			elem = document.getElementById(id);
			if (elem) {
				previewArea.removeChild(elem);
				delete metaDataDict[id];
			}
		}
	}

	/**
	 * リモートカーソルの自動リサイズ
	 */
	function autoResizeCursor(elems) {
		//var ratio = Number(window.devicePixelRatio);
		var width = Number(screen.width);
		var height = Number(screen.height);
		var w = width;
		var h = height;
		var area = w * h;
		var mul = area / 100000.0 / 40.0;
		for (var i = 0; i < elems.length; ++i) {
			elems[i].style.transform = "scale(" + mul + ")";
			elems[i].style.transformOrigin = "left top 0";
		}
		return mul;
	}

	/**
	 * 再接続.
	 * @method reconnect
	 */
	function reconnect() {
		var isDisconnect = false,
			client = connector.connect(function () {
				var disconnected_text = document.getElementById("disconnected_text");
				if (disconnected_text) {
					disconnected_text.style.display = "none";
				}
				if (!windowData) {
					console.log("registerWindow");
					var request = { id : "Display", password : "" };
					connector.send('Login', request, function (err, reply) {
						authority = reply.authority;
						registerWindow();
					});
				}
			}, (function () {
				return function (ev) {
					console.log('close', ev);
					var disconnected_text = document.getElementById("disconnected_text");
					if (disconnected_text) {
						disconnected_text.style.display = "block";
					}
					if (!isDisconnect) {
						setTimeout(function () {
							reconnect();
						}, reconnectTimeout);
					}
				};
			}()));

		connector.on("Update", function (data) {
			if (data === undefined) {
				update('window');
				update('group');
				update('content');
			}
		});

		connector.on("UpdateContent", function (data) {
			console.log("onUpdateContent", data);

			connector.send('GetMetaData', data, function (err, json) {
				// 閲覧可能か
				if (!isViewable(json.group)) {
					return;
				}
				if (json.type === "video") {
					var rtcKey = getRTCKey(json);
					if (webRTCDict.hasOwnProperty(rtcKey)) {
						webRTCDict[rtcKey].close(true);

						json.from = "view";
						connector.sendBinary('RTCClose', json, JSON.stringify({
							key : rtcKey
						}), function (err, reply) {});
						delete json.from;
					}
				}
				if (!err) {
					doneGetMetaData(err, json);
					connector.send('GetContent', json, function (err, reply) {
						if (metaDataDict.hasOwnProperty(json.id)) {
							doneGetContent(err, reply);
						}
					} );
				}
			});
		});

		connector.on("UpdateGroup", function (err, data) {
			update("group", "");
		});

		// 権限変更時に送られてくる
		connector.on("ChangeAuthority",function () {
			var request = { id : "Display", password : "" };
			connector.send('Login', request, function (err, reply) {
				authority = reply.authority;
				update('window');
				update('group');
				update('content');
			});
		});


		// DB切り替え時にブロードキャストされてくる
		connector.on("ChangeDB", function () {
			var request = { id : "Display", password : "" };
			connector.send('Login', request, function (err, reply) {
				authority = reply.authority;
				deleteAllElements();
				update('window');
				update('group');
				update('content');
			});
		});

		connector.on("DeleteContent", function (data) {
			console.log("onDeleteContent", data);
			var i,
				elem,
				previewArea = document.getElementById('preview_area');

			for (i = 0; i < data.length; ++i) {
				elem = document.getElementById(data[i].id);
				if (elem) {
					deleteMark(elem, metaDataDict[data[i].id]);
					previewArea.removeChild(elem);
					delete metaDataDict[data[i].id];
				}
			}
		});

		connector.on("DeleteWindowMetaData", function (data) {
			console.log("onDeleteWindowMetaData", data);
			update('window');
		});

		connector.on("UpdateWindowMetaData", function (data) {
			console.log("onUpdateWindowMetaData", data);
			var i;
			for (i = 0; i < data.length; ++i) {
				if (data[0].hasOwnProperty('id') && data[0].id === getWindowID()) {
					update('window');
					updatePreviewAreaVisible( data[0]);
					resizeViewport( data[0])
					return;
				}
			}
		});

        connector.on("UpdateMouseCursor", function (res) {
			var i, elem, pos, ctrlid = res.id,
				before, after,
				controllerID;
            if (res.hasOwnProperty('data') && res.data.hasOwnProperty('x') && res.data.hasOwnProperty('y')) {
                if (!controllers.hasOwnProperty(ctrlid)) {
                    ++controllers.connectionCount;
                    controllers[ctrlid] = {
                        index: controllers.connectionCount,
                        lastActive: 0
                    };
				}
                pos = vscreen.transform(vscreen.makeRect(res.data.x, res.data.y, 0, 0));
				elem = document.getElementById('hiddenCursor' + ctrlid);
				controllerID = document.getElementById('controllerID' + ctrlid);
                if (!elem) {
                    elem = document.createElement('div');
                    elem.id = 'hiddenCursor' + ctrlid;
                    elem.className = 'hiddenCursor';
                    elem.style.backgroundColor = 'transparent';
                    before = document.createElement('div');
                    before.className = 'before';
                    before.style.backgroundColor = res.data.rgb;
                    elem.appendChild(before);
                    after = document.createElement('div');
                    after.className = 'after';
                    after.style.backgroundColor = res.data.rgb;
					elem.appendChild(after);
					
                    controllerID = document.createElement('div');
                    controllerID.id = 'controllerID' + ctrlid;
					controllerID.className = 'controller_id';
					controllerID.style.color = res.data.rgb;
					controllerID.style.position = "absolute"
					controllerID.style.fontSize = "20px";
					controllerID.innerText = res.data.controllerID;
					document.body.appendChild(controllerID);
					
                    document.body.appendChild(elem);
					console.log('new controller cursor! => id: ' + res.data.connectionCount + ', color: ' + res.data.rgb);
                } else {
					controllerID.innerText = res.data.controllerID;
					controllerID.style.color = res.data.rgb;
					elem.getElementsByClassName('before')[0].style.backgroundColor = res.data.rgb;
					elem.getElementsByClassName('after')[0].style.backgroundColor = res.data.rgb;
				}
				controllerID.style.textShadow = 
						"1px 1px 0 white,"
						+ "-1px 1px 0 white,"
						+ " 1px -1px 0 white,"
						+ "-1px -1px 0 white";

				autoResizeCursor([elem, controllerID]);
                elem.style.left = Math.round(pos.x) + 'px';
				elem.style.top  = Math.round(pos.y) + 'px';
                controllerID.style.left = Math.round(pos.x) + 'px';
                controllerID.style.top  = Math.round(pos.y + 100) + 'px';
                controllers[ctrlid].lastActive = Date.now();
            } else {
                if (controllers.hasOwnProperty(ctrlid)) {
					elem = document.getElementById('hiddenCursor' + ctrlid);
					controllerID = document.getElementById('controllerID' + ctrlid);
                    if (elem) {
                        elem.style.left = '-999999px';
						elem.style.top  = '-999999px';
						controllerID.style.left = '-999999px';
						controllerID.style.top  = '-999999px';
                    }
                    if (elem.parentNode) { elem.removeChild(elem); }
                    if (controllerID.parentNode) { controllerID.removeChild(controllerID); }
                }
            }
        });

		connector.on("ShowWindowID", function (data) {
			console.log("onShowWindowID", data);
			var i;
			for (i = 0; i < data.length; i = i + 1) {
				showDisplayID(data[i].id);
			}
		});

		connector.on("UpdateMetaData", function (data) {
			var i;
			var previewArea = document.getElementById("preview_area");
			
			for (i = 0; i < data.length; ++i) {
				if (!isViewable(data[i].group)) {
					var elem = document.getElementById(data[i].id);
					if (elem) {
						previewArea.removeChild(elem);
					}
					var memo =  document.getElementById("memo:" + data[i].id);
					if (memo) {
						previewArea.removeChild(memo);
					}
				}
				update('', data[i].id);
			}
		});

		connector.on("RTCOffer", function (data) {
			//console.error("RTCOffer")
			if (!windowData) return;
			var metaData = data.metaData;
			var contentData = data.contentData;
			var parsed = null;
			var sdp = null;
			var rtcKey = null;
			try {
				var dataStr = StringUtil.arrayBufferToString(contentData.data);
				parsed = JSON.parse(dataStr);
				rtcKey = parsed.key;
				sdp = parsed.sdp;
			} catch (e) {
				console.error(e);
				return;
			}

			if (sdp) {
				if (webRTCDict.hasOwnProperty(rtcKey)) {
					var webRTC = webRTCDict[rtcKey];
					webRTC.answer(sdp, function (answer) {
						//console.error("WebRTC: send answer")
						connector.sendBinary('RTCAnswer', metaData, JSON.stringify({
							key : rtcKey,
							sdp : answer
						}), function () {});
					});
				}
			}
		});
		
		connector.on("RTCClose", function (data) {
			var metaData = data.metaData;
			if (metaData.from === "view") { return; }
			var contentData = data.contentData;
			var parsed = null;
			var rtcKey = null;
			try {
				var dataStr = StringUtil.arrayBufferToString(contentData.data);
				parsed = JSON.parse(dataStr);
				rtcKey = parsed.key;
			} catch (e) {
				console.error(e);
				return;
			}
			if (webRTCDict.hasOwnProperty(rtcKey)) {
				webRTCDict[rtcKey].close(true);
			}
		});

		connector.on("RTCIceCandidate", function (data) {
			//console.error("on RTCIceCandidate")
			var metaData = data.metaData;
			if (metaData.from === "view") { return; }
			var contentData = data.contentData;
			var parsed = null;
			var candidate = null;
			var rtcKey = null;
			try {
				var dataStr = StringUtil.arrayBufferToString(contentData.data);
				parsed = JSON.parse(dataStr);
				rtcKey = parsed.key;
				candidate = parsed.candidate;
			} catch (e) {
				console.error(e);
				return;
			}
			if (webRTCDict.hasOwnProperty(rtcKey)) {
				if (candidate) {
					webRTCDict[rtcKey].addIceCandidate(candidate);
				}
			}
		});

		connector.on("Disconnect", (function (client) {
			return function () {
				var previewArea = document.getElementById("preview_area"),
					disconnected_text = document.getElementById("disconnected_text");
				isDisconnect = true;
				client.close();

				if (previewArea) {
					previewArea.style.display = "none";
				}
				if (disconnected_text) {
					disconnected_text.innerHTML = "Display Deleted";
				}
			};
		}(client)));
	}

	/**
	 * 初期化
	 * @method init
	 */
	function init() {
		var input_id = document.getElementById('input_id'),
			registered = false,
			onfocus = false,
			hideMenuFunc = function () {
				console.log("onfocus:", onfocus);
				if (!onfocus) {
					console.log("hideMenuFunc");
					document.getElementById('head_menu').classList.add('hide');
				}
				registered = false;
			};

		reconnect();

		// resize event
		window.onresize = function () {
			if (timer) {
				clearTimeout(timer);
			}
			timer = setTimeout(function () {
				resizeWindow();
			}, 200);
		};

		window.addEventListener('mousemove', function (evt) {
			document.getElementById('head_menu').classList.remove('hide');
			if (!registered) {
				registered = true;
				setTimeout(hideMenuFunc, 3000);
			}
		});

		input_id.onfocus = function (ev) {
			console.log("onfocus");
			onfocus = true;
			document.getElementById('head_menu').classList.remove('hide');
			clearTimeout(hideMenuFunc);
		};
		input_id.onblur = function (ev) {
			console.log("onblur");
			onfocus = false;
			changeID(input_id.value);
		};
		input_id.onkeypress = function (ev) {
			console.log(ev.keyCode);
			if (ev.keyCode === 13) { // enter
				changeID(input_id.value);
			}
		};

		// スクロールを抑止する関数
		function preventScroll(event) {
			// preventDefaultでブラウザ標準動作を抑止する。
			event.preventDefault();
		}

		// 上部メニューの初期化.
		var menu = new Menu(document.getElementById('head_menu'),
			{
				menu : [{
					Display : [{
							Controller : {
								func : function () {
									window.open("controller.html"); // TODO コントローラIDの設定どうするか
								}
							}
						}],
					url : "view.html"
				},{
					Setting : [{
						Fullscreen : {
							func : function(evt, menu) { 
								if (!isFullScreen()) {
									menu.changeName("Fullscreen", "CancelFullscreen")
								} else {
									menu.changeName("CancelFullscreen", "Fullscreen")
								}
								toggleFullScreen();
							}
						}
					}]
				}]
			});
			
	}

	window.onload = init;
	window.onunload = function () {
		var i;
		for (i in webRTCDict) {
			webRTCDict[i].close();
		}
	}
}(window.vscreen, window.vscreen_util, window.ws_connector));
