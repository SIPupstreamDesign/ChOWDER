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
		this.videoStreamDict = {};
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
			URL.revokeObjectURL(this.videoDict[i]);
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
	Store.prototype.set_group_list = function (grouplist) {
		this.groupList = grouplist;
		this.groupDict = {};
		this.for_each_group(function (i, group) {
			this.groupDict[group.id] = group;
		}.bind(this));
	};
	Store.prototype.get_group_list = function () {
		return this.groupList;
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
		this.videoDict[id] = data;
	};
	Store.prototype.get_video_data = function (id, data) {
		return this.videoDict[id];
	};
	Store.prototype.has_video_data = function (id) {
		return this.videoDict.hasOwnProperty(id);
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
