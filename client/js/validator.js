/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	var Validator = function () {};

	/**
	 * Validator初期設定
	 * @param {*} gui 
	 */
	Validator.prototype.init = function (gui) {
		this.gui = gui;
	};

	/**
	 * メタデータがwindowタイプであるか返す
	 */
	Validator.prototype.isWindowType = function (meta) {
		return (meta.type === Constants.TypeWindow);
	}

	/**
	 * メタデータがimage/url/textなどのコンテンツタイプであるか返す
	 */
	Validator.prototype.isContentType = function (meta) {
		return (meta.type !== Constants.TypeWindow && meta.type !== Constants.TypeLayout);
	}
	
	/**
	 * メタデータがレイアウトタイプであるか返す
	 */
	Validator.prototype.isLayoutType = function (meta) {
		return (meta.type === Constants.TypeLayout);
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
