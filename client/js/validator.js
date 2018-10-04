/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */
/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	var Validator = function () {};

	/**
	 * Validator初期設定
	 * @param {*} gui 
	 */
	Validator.prototype.init = function (store, gui, state) {
		this.store = store;
		this.gui = gui;
		this.state = state;
	};

	Validator.prototype.isVisibleWindow = function (windowData) {
		if (this.isVisible(windowData)) {
			return this.isCurrentGroupWindow(windowData);
		}
		return false;
	}

	Validator.prototype.isCurrentGroupWindow = function (windowData) {
		if (windowData.group === this.state.get_display_selected_group()) {
			return true;
		}
		if (this.state.get_display_selected_group() === Constants.DefaultGroup
			&& !this.store.get_group_dict().hasOwnProperty(windowData.group)) {
			return true;
		}
		return false;
	}

	/**
	 * メタデータがVirtualDisplayタイプであるか返す
	 */
	Validator.prototype.isVirtualDisplayType = function (meta) {
		return (meta.type === Constants.TypeVirtualDisplay);
	}

	/**
	 * メタデータがwindowタイプであるか返す
	 */
	Validator.prototype.isWindowType = function (meta) {
		return (meta.hasOwnProperty('type') && meta.type === Constants.TypeWindow);
	}

	/**
	 * メタデータがimage/url/textなどのコンテンツタイプであるか返す
	 */
	Validator.prototype.isContentType = function (meta) {
		return (meta.hasOwnProperty('type') && 
			(meta.type !== Constants.TypeWindow 
				&& meta.type !== Constants.TypeLayout 
				&& meta.type !== Constants.TypeVirtualDisplay));
	}
	
	/**
	 * メタデータがレイアウトタイプであるか返す
	 */
	Validator.prototype.isLayoutType = function (meta) {
		return (meta.hasOwnProperty('type') && meta.type === Constants.TypeLayout);
	}
	
	/**
	 * メタデータがテキストタイプであるか返す
	 */
	Validator.prototype.isTextType = function (meta) {
		return (meta.hasOwnProperty('type') && meta.type === Constants.TypeText);
	}

	/**
	 * メタデータがVirtualDisplayであるか返す
	 */
	Validator.prototype.isVirtualDisplayID = function (id) {
		return (id.indexOf(Constants.WholeWindowListID) === 0 || id.indexOf(Constants.WholeWindowID) === 0);
	}

	/**
	 * メタデータが表示中かを判定する
	 * @method isVisible
	 * @param {Object} metaData メタデータ
	 * @return {bool} 表示中であればtrue
	 */
	Validator.prototype.isVisible = function (metaData) {
		return (metaData.hasOwnProperty('visible') && (metaData.visible === "true" || metaData.visible === true));
	}
	
	/**
	 * VirtualDisplayのモードがFreeModeかを判別する
	 * @method isFreeMode
	 * @return {bool} FreeModeであればtrueを返す.
	 */
	Validator.prototype.isFreeMode = function () {
		return this.gui.get_snap_type() === Constants.SnapTypeFree;
	}
	
	/**
	 * VirtualDisplayのモードがGridModeかを判別する
	 * @method isGridMode
	 * @return {bool} GridModeであればtrueを返す.
	 */
	Validator.prototype.isGridMode = function () {
		return this.gui.get_snap_type() === Constants.SnapTypeGrid;
	}
	
	/**
	 * VirtualDisplayのモードがDisplayModeかを判別する
	 * @method isDisplayMode
	 * @return {bool} DisplayModeであればtrueを返す.
	 */
	Validator.prototype.isDisplayMode = function () {
		return this.gui.get_snap_type() === Constants.SnapTypeDisplay;
	}
	
	/**
	 * リストでディスプレイタブが選択されているかを判別する。
	 * @method isDisplayTabSelected
	 * @return {bool} リストでディスプレイタブが選択されていたらtrueを返す.
	 */
	Validator.prototype.isDisplayTabSelected = function () {
		return this.gui.is_active_tab(Constants.TabIDDisplay);
	}

	/**
	 * リストでレイアウトタブが選択されているかを判別する。
	 * @method isLayoutTabSelected
	 * @return {bool} リストでディスプレイタブが選択されていたらtrueを返す.
	 */
	Validator.prototype.isLayoutTabSelected = function () {
		return this.gui.is_active_tab(Constants.TabIDLayout);
	}

	/**
	 * メタデータのtypeが現在開いているタブに合致するか返す
	 */
	Validator.prototype.isCurrentTabMetaData = function (meta) {
		if (this.isDisplayTabSelected() && this.isWindowType(meta)) {
			return true;
		} else if (this.isLayoutTabSelected() && this.isLayoutType(meta)) {
			return true;
		} else if ((this.gui.is_active_tab(Constants.TabIDContent) || this.gui.is_active_tab(Constants.TabIDSearch))
					 && this.isContentType(meta)) {
			return true;
		}
		return false;
	}

	/**
	 * リスト表示中かをIDから判別する
	 * @method isUnvisibleID
	 * @param {String} id コンテンツID
	 * @return {bool} リストに表示されているコンテンツのIDであればtrueを返す.
	 */
	Validator.prototype.isUnvisibleID = function (id) {
		return (id.indexOf("onlist:") >= 0);
	}
	
	window.Validator = new Validator();
}());
