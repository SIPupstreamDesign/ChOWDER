/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */
(function () {
	"use strict";

	var Store = function () {
		this.isInitialized = false;
		this.groupList = [];
		this.groupDict = {};
		this.metaDataDict = {};
	};
	
	// isInitialized
	Store.prototype.init = function () {
		this.isInitialized = true;
	};
	Store.prototype.is_initialized = function () {
		return this.isInitialized;
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

	window.Store = Store;
}());
