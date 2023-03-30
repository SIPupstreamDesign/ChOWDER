/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from './constants.js';
import InputDialog from '../components/input_dialog.js';

"use strict";

class Validator
{
	/**
	 * Validator初期設定
	 * @param {*} gui 
	 */
	init(store, gui) {
		this.management = store.getManagement();
		this.store = store;
		this.gui = gui;
		this.state = this.store.getState();
	};

	isVisibleWindow(windowData) {
		if (this.isVisible(windowData)) {
			return this.isCurrentGroupWindow(windowData);
		}
		return false;
	}

	isCurrentGroupWindow(windowData) {
		if (windowData.group === this.state.getDisplaySelectedGroup()) {
			return true;
		}
		if (this.state.getDisplaySelectedGroup() === Constants.DefaultGroup
			&& !this.store.getGroupDict().hasOwnProperty(windowData.group)) {
			return true;
		}
		return false;
	}

	/**
	 * メタデータがVirtualDisplayタイプであるか返す
	 */
	isVirtualDisplayType(meta) {
		return (meta.type === Constants.TypeVirtualDisplay);
	}

	/**
	 * メタデータがwindowタイプであるか返す
	 */
	isWindowType(meta) {
		return (meta.hasOwnProperty('type') && meta.type === Constants.TypeWindow);
	}

	/**
	 * メタデータがimage/url/textなどのコンテンツタイプであるか返す
	 */
	isContentType(meta) {
		return (meta.hasOwnProperty('type') && 
			(meta.type !== Constants.TypeWindow 
				&& meta.type !== Constants.TypeLayout 
				&& meta.type !== Constants.TypeVirtualDisplay));
	}
	
	/**
	 * メタデータがレイアウトタイプであるか返す
	 */
	isLayoutType(meta) {
		return (meta.hasOwnProperty('type') && meta.type === Constants.TypeLayout);
	}
	
	/**
	 * メタデータがテキストタイプであるか返す
	 */
	isTextType(meta) {
		return (meta.hasOwnProperty('type') && meta.type === Constants.TypeText);
	}

	/**
	 * メタデータが動画タイプであるか返す
	 */
	isVideoType(meta)  {
		return (meta.hasOwnProperty('type') && meta.type === Constants.TypeVideo);
	}

	/**
	 * メタデータがVirtualDisplayであるか返す
	 */
	isVirtualDisplayID(id) {
		return (id.indexOf(Constants.WholeWindowListID) === 0 || id.indexOf(Constants.WholeWindowID) === 0);
	}

	/**
	 * メタデータが表示中かを判定する
	 * @method isVisible
	 * @param {Object} metaData メタデータ
	 * @return {bool} 表示中であればtrue
	 */
	isVisible(metaData) {
		return (metaData.hasOwnProperty('visible') && (metaData.visible === "true" || metaData.visible === true));
	}
	
	/**
	 * VirtualDisplayのモードがFreeModeかを判別する
	 * @method isFreeMode
	 * @return {bool} FreeModeであればtrueを返す.
	 */
	isFreeMode() {
		return this.store.getControllerData().getSnapType(this.isDisplayTabSelected()) === Constants.SnapTypeFree;
	}
	
	/**
	 * VirtualDisplayのモードがGridModeかを判別する
	 * @method isGridMode
	 * @return {bool} GridModeであればtrueを返す.
	 */
	isGridMode() {
		return this.store.getControllerData().getSnapType(this.isDisplayTabSelected()) === Constants.SnapTypeGrid;
	}
	
	/**
	 * VirtualDisplayのモードがDisplayModeかを判別する
	 * @method isDisplayMode
	 * @return {bool} DisplayModeであればtrueを返す.
	 */
	isDisplayMode() {
		return this.store.getControllerData().getSnapType(this.isDisplayTabSelected()) === Constants.SnapTypeDisplay;
	}
	
	/**
	 * リストでディスプレイタブが選択されているかを判別する。
	 * @method isDisplayTabSelected
	 * @return {bool} リストでディスプレイタブが選択されていたらtrueを返す.
	 */
	isDisplayTabSelected() {
		return this.gui.isActiveTab(Constants.TabIDDisplay);
	}

	/**
	 * リストでレイアウトタブが選択されているかを判別する。
	 * @method isLayoutTabSelected
	 * @return {bool} リストでディスプレイタブが選択されていたらtrueを返す.
	 */
	isLayoutTabSelected() {
		return this.gui.isActiveTab(Constants.TabIDLayout);
	}

	/**
	 * リストでUserタブが選択されているかを判別する。
	 * @method isUserTabSelected
	 * @return {bool} リストでuserタブが選択されていたらtrueを返す.
	 */
	isUserTabSelected() {
		return this.gui.isActiveTab(Constants.TabIDUsers);
	}


	/**
	 * メタデータのtypeが現在開いているタブに合致するか返す
	 */
	isCurrentTabMetaData(meta) {
		if (this.isDisplayTabSelected() && this.isWindowType(meta)) {
			return true;
		} else if (this.isLayoutTabSelected() && this.isLayoutType(meta)) {
			return true;
		} else if ((this.gui.isActiveTab(Constants.TabIDContent) || this.gui.isActiveTab(Constants.TabIDSearch))
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
	isUnvisibleID(id) {
		return (id.indexOf("onlist:") >= 0);
	}
	
	/**
	 * アップロード容量をチェックし、容量オーバーならfalseを返す
	 */
	checkCapacity(byteLength) {
		let maxSize = this.management.getMaxMessageSize();
		if (byteLength >= maxSize) {
			InputDialog.showOKCancelInput({
				name: "Overcapacity. Capacity limit of " + maxSize / 1000000 + "MB",
				okButtonName: "OK"
			}, function (isOK) {
			});
			return false;
		}
		return true;
	}
};

export default Validator = new Validator();
