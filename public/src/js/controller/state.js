/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../common/constants.js';

"use strict";

class State {
	constructor() {
		this.lastSelectContentID = null;
		this.lastSelectWindowID = null;
		this.draggingIDList = [];
		this.selectedIDList = [];
		this.isCtrlDown_ = false; // Ctrlボタンを押してるかどうか
		this.isShiftDown_ = false; // Shiftボタンを押してるかどうか
		this.isSpaceDown_ = false;
		this.mouseDownPos = [0, 0];
		this.dragRect = {};
		this.isSelectionRectDragging_ = false;
		this.isSelectionRectShown_ = false;
		this.isMouseDownOnList_ = false;
		this.contentSelectedGroup = Constants.DefaultGroup; //選択中のグループ
		this.displaySelectedGroup = Constants.DefaultGroup;
		this.contextPos = {
			x : 0,
			y : 0
		}
	}
	getContextPos() {
		return this.contextPos;
	}
	setContextPos(x, y) {
		this.contextPos.x = x;
		this.contextPos.y = y;
	}
	// lastSelectContentID
	getLastSelectContentID() {
		return this.lastSelectContentID;
	}
	setLastSelectContentID(id) {
		this.lastSelectContentID = id;
	}
	// lastSelectWindowID
	getLastSelectWindowID() {
		return this.lastSelectWindowID;
	}
	setLastSelectWindowID(id) {
		this.lastSelectWindowID = id;
	}
	// draggingIDList
	setDraggingIDList(list) {
		this.draggingIDList = list;
	}
	getDraggingIDList() {
		return this.draggingIDList;
	}
	for_each_dragging_id(func) {
		let i;
		for (i = 0; i < this.draggingIDList.length; ++i) {
			if (func(i, this.draggingIDList[i]) === true) {
				break;
			}
		}
	}
	// selectedIDList
	setSelectedIDList(list) {
		this.selectedIDList = list;
	}
	getSelectedIDList() {
		return this.selectedIDList;
	}
	addSelectedID(id) {
		this.selectedIDList.push(id);
	}
	for_each_selected_id(func) {
		let i;
		for (i = 0; i < this.selectedIDList.length; ++i) {
			if (func(i, this.selectedIDList[i]) === true) {
				break;
			}
		}
	}
	// isCtrlDown
	setCtrlDown(is_down) {
		this.isCtrlDown_ = is_down;
	}
	isCtrlDown() {
		return this.isCtrlDown_;
	}
	// isShiftDown
	setShiftDown(is_down) {
		this.isShiftDown_ = is_down;
	}
	isShiftDown() {
		return this.isShiftDown_;
	}
	// isSpaceDown
	setSpaceDown(is_down) {
		this.isSpaceDown_ = is_down;
	}
	isSpaceDown() {
		return this.isSpaceDown_;
	}
	// mouseDownPos
	setMousedownPos(pos) {
		this.mouseDownPos = pos;
	}
	getMousedownPos() {
		return this.mouseDownPos;
	}
	// dragRect
	clearDragRect() {
		this.dragRect = {};
	}
	setDragRect(id, rect) {
		this.dragRect[id] = rect;
	}
	getDragRect(id) {
		return this.dragRect[id];
	}
	hasDragRect(id) {
		return this.dragRect.hasOwnProperty(id);
	}
	// group selection
	setContentSelectedGroup(groupID) {
		this.contentSelectedGroup = groupID;
	}
	getContentSelectedGroup() {
		return this.contentSelectedGroup;
	}
	setDisplaySelectedGroup(groupID) {
		this.displaySelectedGroup = groupID;
	}
	getDisplaySelectedGroup() {
		return this.displaySelectedGroup;
	}
	// isSelectionRectDragging
	setSelectionRectDragging(isDragging) {
		this.isSelectionRectDragging_ = isDragging;
	}
	isSelectionRectDragging() {
		return this.isSelectionRectDragging_;
	}
	setSelectionRectShown(isShown) {
		this.isSelectionRectShown_ = isShown;
	}
	isSelectionRectShown() {
		return this.isSelectionRectShown_;
	}
	// isMouseDownOnList
	setMousedownOnList(onList) {
		this.isMouseDownOnList_ = onList;
	}
	isMousedownOnList() {
		return this.isMouseDownOnList_;
	}
	//----------------------------------
	/**
		 * 選択されているContentIDを返却する
		 * @method getSelectedID
		 * @return {String} コンテンツID
		 */
	getSelectedID() {
		//let contentID = document.getElementById('content_id');
		if (this.getSelectedIDList().length > 0) {
			return this.getSelectedIDList()[0];
		}
		return null; //contentID.innerHTML;
	}
}

export default State;

