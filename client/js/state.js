/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */
(function () {
	"use strict";

	var State = function () {
		this.lastSelectContentID = null;
		this.lastSelectWindowID = null;
		this.draggingIDList = [];
		this.selectedIDList = [];
	};

	// lastSelectContentID
	State.prototype.get_last_select_content_id = function () {
		return this.lastSelectContentID;
	};
	State.prototype.set_last_select_content_id = function (id) {
		this.lastSelectContentID = id;
	};

	// lastSelectWindowID
	State.prototype.get_last_select_window_id = function () {
		return this.lastSelectWindowID;
	};
	State.prototype.set_last_select_window_id = function (id) {
		this.lastSelectWindowID = id;
	};

	// draggingIDList
	State.prototype.set_dragging_id_list = function (list) {
		this.draggingIDList = list;
	};
	State.prototype.get_dragging_id_list = function () {
		return this.draggingIDList;
	};
	State.prototype.for_each_dragging_id = function (func) {
		var i;
		for (i = 0; i < this.draggingIDList.length; ++i) {
			if (func(i, this.draggingIDList[i]) === true) {
				break;
			}
		}
	};

	// selectedIDList
	State.prototype.set_selected_id_list = function (list) {
		this.selectedIDList = list;
	};
	State.prototype.get_selected_id_list = function () {
		return this.selectedIDList;
	};
	State.prototype.for_each_selected_id = function (func) {
		var i;
		for (i = 0; i < this.selectedIDList.length; ++i) {
			if (func(i, this.selectedIDList[i]) === true) {
				break;
			}
		}
	};

	window.State = State;
}());
