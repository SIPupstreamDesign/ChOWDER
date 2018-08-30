/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */
(function () {
	"use strict";

	var Store = function () {
		this.isInitialized = false;
		this.groupList = [];
		this.groupDict = {};
		this.metaDataDict = {};
		this.videoDict = {};
		this.videoElemDict = {};
		this.cursorColor = 'rgb(255, 255, 255)';

		this.contentGroupList = [];
		this.displayGroupList = [];
	};
	
	// isInitialized
	Store.prototype.init = function () {
		this.isInitialized = true;
	};
	Store.prototype.is_initialized = function () {
		return this.isInitialized;
	};

	Store.prototype.release = function () {
		var i;
		for (i in this.videoDict) {
			this.delete_video_data(i);
		}
		for (i in this.videoElemDict) {
			this.delete_video_elem(i);
		}
	};

	// group
	Store.prototype.has_group = function (groupID) {
		return this.groupDict.hasOwnProperty(groupID);
	};
	Store.prototype.get_group = function (groupID) {
		return this.groupDict[groupID];
	};

	// group List
	Store.prototype.set_group_list = function (grouplist, displayGroupList) {
		this.contentGroupList = grouplist;
		this.displayGroupList = displayGroupList;

		var groupListMerged = [];
		Array.prototype.push.apply(groupListMerged, grouplist);
		Array.prototype.push.apply(groupListMerged, displayGroupList);
		this.groupList = groupListMerged;
		this.groupDict = {};
		this.for_each_group(function (i, group) {
			this.groupDict[group.id] = group;
		}.bind(this));
	};
	Store.prototype.get_group_list = function () {
		return this.groupList;
	};
	Store.prototype.get_content_group_list = function () {
		return this.contentGroupList;
	};
	Store.prototype.get_display_group_list = function () {
		return this.displayGroupList;
	};

	// group Dict
	Store.prototype.get_group_dict = function () {
		return this.groupDict;
	};

	Store.prototype.for_each_group = function (func) {
		var i;
		for (i = 0; i < this.groupList.length; ++i) {
			if (func(i, this.groupList[i]) === true) {
				break;
			}
		}
	};
	Store.prototype.for_each_content_group = function (func) {
		var i;
		for (i = 0; i < this.contentGroupList.length; ++i) {
			if (func(i, this.contentGroupList[i]) === true) {
				break;
			}
		}
	};
	Store.prototype.for_each_display_group = function (func) {
		var i;
		for (i = 0; i < this.displayGroupList.length; ++i) {
			if (func(i, this.displayGroupList[i]) === true) {
				break;
			}
		}
	};

	// metaData
	Store.prototype.get_metadata = function (id) {
		return this.metaDataDict[id];
	};
	Store.prototype.set_metadata = function (id, metaData) {
		this.metaDataDict[id] = metaData;
	};
	Store.prototype.has_metadata = function (id) {
		return this.metaDataDict.hasOwnProperty(id);
	};
	Store.prototype.delete_metadata = function (id) {
		delete this.metaDataDict[id];
	};

	// metaDataDict
	Store.prototype.for_each_metadata = function (func) {
		var i;
		for (i in this.metaDataDict) {
			if (this.metaDataDict.hasOwnProperty(i)) {
				if (func(i, this.metaDataDict[i]) === true) {
					break;
				}
			}
		}
	};
	Store.prototype.get_metadata_dict = function () {
		return this.metaDataDict;
	};

	// video data
	Store.prototype.set_video_data = function (id, data) {
		if (this.has_video_data(id)) {
			this.delete_video_data(id);
		}
		this.videoDict[id] = data;
	};
	Store.prototype.get_video_data = function (id, data) {
		return this.videoDict[id];
	};
	Store.prototype.has_video_data = function (id) {
		return this.videoDict.hasOwnProperty(id);
	};
	Store.prototype.delete_video_data = function (id) {
		var videoData = this.videoDict[id];
		if (videoData.getVideoTracks) {
			videoData.getVideoTracks().forEach(function (track) {
				track.stop();
			});
		}
		if (videoData.getAudioTracks) {
			videoData.getAudioTracks().forEach(function (track) {
				track.stop();
			});
		}
		delete this.videoDict[id];
	};

	// video elem
	Store.prototype.set_video_elem = function (id, elem) {
		this.videoElemDict[id] = elem;
	};
	Store.prototype.get_video_elem = function (id, elem) {
		return this.videoElemDict[id];
	};
	Store.prototype.has_video_elem = function (id) {
		return this.videoElemDict.hasOwnProperty(id);
	};
	Store.prototype.delete_video_elem = function (id) {
		var elem = this.videoElemDict[id];
		elem.pause();
		elem.srcObject = null;
		if (elem.src) {
			URL.revokeObjectURL(elem.src);
		}
		elem.src = "";
		delete this.videoElemDict[id];
	};

	// --------------------------
	// colors

	/**
	 * グループの色を返す
	 */
	Store.prototype.get_group_color = function (groupID) {
		this.for_each_group(function (i, group) {
			if (group.id === groupID) {
				if (group.color) {
					return group.color;
				}
			}
		});
		return Constants.ContentSelectColor;
	};

	/**
	 * 枠色を返す
	 */
	Store.prototype.get_border_color = function (meta) {
		if (Validator.isWindowType(meta)) {
			if (meta.hasOwnProperty('color')) {
				return meta.color;
			}
			return "#0080FF";
		}
		return this.get_group_color(meta.group);
	};

	/**
	 * リストエレメントのボーダーカラーをタイプ別に返す
	 */
	Store.prototype.get_list_border_color = function (meta) {
		if (Validator.isWindowType(meta)) {
			if (meta.hasOwnProperty('reference_count') && parseInt(meta.reference_count, 10) <= 0) {
				return "gray";
			} else {
				return "white";
			}
		}
		if (Validator.isContentType(meta)) {
			return "rgba(0,0,0,0)";
		}
		if (Validator.isLayoutType(meta)) {
			return "lightgray";
		}
		return "white";
	};

	/**
	 * リモートカーソルの色を返す
	 * TODO:コントローラーセッションと紐づけて保存復元
	 */
	Store.prototype.get_cursor_color = function () {
		return this.cursorColor;
	};
	
	/**
	 * リモートカーソルの色を設定する
	 */
	Store.prototype.set_cursor_color = function (color) {
		this.cursorColor = color;
	};
	
	/**
	 * コンテンツのzindexの習得.
	 * @param {boolean} isFront 最前面に移動ならtrue, 最背面に移動ならfalse
	 * */
	Store.prototype.get_zindex = function (metaData, isFront) {
		var max = 0,
			min = 0;

		this.for_each_metadata(function (i, meta) {
			if (meta.id !== metaData.id && 
				Validator.isContentType(meta.type) &&
				meta.hasOwnProperty("zIndex")) {
				max = Math.max(max, parseInt(meta.zIndex, 10));
				min = Math.min(min, parseInt(meta.zIndex, 10));
			}
		});
		if (isFront) {
			return max + 1;
		} else {
			return min - 1;
		}
	};

	window.Store = Store;
}());
