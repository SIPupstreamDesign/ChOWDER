/*jslint devel:true*/
/*global io, socket, FileReader, Uint8Array, Blob, URL, event */
(function () {
	"use strict";

	var State = function () {
		this.lastSelectContentID = null;
		this.lastSelectWindowID = null;
		this.draggingIDList = [];
		this.selectedIDList = [];
		this.isCtrlDown = false; // Ctrlボタンを押してるかどうか
		this.dragOffsetTop = 0;
		this.dragOffsetLeft = 0;
		this.mouseDownPos = [];
		this.dragRect = {};

		this.isSelectionRectDragging = false
		this.isSelectionRectShown = false;

		this.contentSelectedGroup = Constants.DefaultGroup; //選択中のグループ
		this.displaySelectedGroup = Constants.DefaultGroup;
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
	State.prototype.add_selected_id = function (id) {
		this.selectedIDList.push(id);
	};
	State.prototype.for_each_selected_id = function (func) {
		var i;
		for (i = 0; i < this.selectedIDList.length; ++i) {
			if (func(i, this.selectedIDList[i]) === true) {
				break;
			}
		}
	};

	// isCtrlDown
	State.prototype.set_ctrl_down = function (is_down) {
		this.isCtrlDown = is_down;
	};
	State.prototype.is_ctrl_down = function () {
		return this.isCtrlDown;
	};

	// dragOffsetTop
	State.prototype.set_drag_offset_top = function (offset) {
		this.dragOffsetTop = offset;
	};
	State.prototype.get_drag_offset_top = function () {
		return this.dragOffsetTop;
	};

	// dragOffsetLeft
	State.prototype.set_drag_offset_left = function (offset) {
		this.dragOffsetLeft = offset;
	};
	State.prototype.get_drag_offset_left = function () {
		return this.dragOffsetLeft;
	};
	
	// mouseDownPos
	State.prototype.set_mousedown_pos = function (pos) {
		this.mouseDownPos = pos;
	};
	State.prototype.get_mousedown_pos = function () {
		return this.mouseDownPos;
	};

	// dragRect
	State.prototype.clear_drag_rect = function () {
		this.dragRect = {};
	};
	State.prototype.set_drag_rect = function (id, rect) {
		this.dragRect[id] = rect;
	};
	State.prototype.get_drag_rect = function (id) {
		return this.dragRect[id];
	};
	State.prototype.has_drag_rect = function (id) {
		return this.dragRect.hasOwnProperty(id);
	};
	
	// group selection
	State.prototype.set_content_selected_group = function (groupID) {
		this.contentSelectedGroup = groupID;
	}
	State.prototype.get_content_selected_group = function () {
		return this.contentSelectedGroup;
	}

	State.prototype.set_display_selected_group = function (groupID) {
		this.displaySelectedGroup = groupID;
	}
	State.prototype.get_display_selected_group = function () {
		return this.displaySelectedGroup;
	}

	// isSelectionRectDragging
	State.prototype.set_selection_rect_dragging = function (isDragging) {
		this.isSelectionRectDragging = isDragging;
	}
	State.prototype.is_selection_rect_dragging = function () {
		return this.isSelectionRectDragging;
	}
	
	State.prototype.set_selection_rect_shown = function (isShown) {
		this.isSelectionRectShown = isShown;
	}
	State.prototype.is_selection_rect_shown = function () {
		return this.isSelectionRectShown;
	}
	
	

	//----------------------------------
	/**
	 * 選択されているContentIDを返却する
	 * @method getSelectedID
	 * @return {String} コンテンツID
	 */
	State.prototype.get_selected_id = function () {
		//var contentID = document.getElementById('content_id');
		if (this.get_selected_id_list().length > 0) {
			return this.get_selected_id_list()[0];
		}
		return null;//contentID.innerHTML;
	}

	window.State = State;
}());
