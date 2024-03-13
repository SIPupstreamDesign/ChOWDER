/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */


import Command from '../../common/command';
import Action from '../action';
import Validator from '../../common/validator';
import Store from './store'
import Constants from '../../common/constants';

class GroupStore
{
	constructor(connector, state, store, action) {
		this.connector = connector;
        this.state = state;
        this.store = store;
		this.action = action;

		this.groupList = [];
		this.groupDict = {};
		this.contentGroupList = [];
		this.displayGroupList = [];

		this.initEvents();
	}

	initEvents() {
		for (let i in Action) {
			if (i.indexOf('EVENT') >= 0) {
				this.action.on(Action[i], ((method) => {
					return (err, data) => {
						if (this[method]) {
							this[method](data);
						}
					};
				})('_' + Action[i]));
			}
		}
	};

    /**
     * グループ追加
     * @param {*} data 
     */
    _addGroup(data) {

		let groupColor = "rgb(" + Math.floor(Math.random() * 128 + 127) + ","
			+ Math.floor(Math.random() * 128 + 127) + ","
			+ Math.floor(Math.random() * 128 + 127) + ")";
		let metaData = { name: data.groupName, color: groupColor };

		// Displayタブの追加ボタン押したときはDisplayグループとして追加する
		if (Validator.isDisplayTabSelected()) {
			metaData.type = "display";
		} else {
			// それ以外のタブではContentグループ.
			metaData.type = "content";
		}

		this.connector.send(Command.AddGroup, metaData, (err, groupID) => {
			// UserList再取得
			this.action.reloadUserList();
			this.action.reloadContentGroupList();
		});

    }

	/**
	 * グループリストを取得
	 * @param {*} data 
	 */
	_getGroupList(data) {
		let callback = Store.extractCallback(data);
		this.store.operation.getGroupList(callback);
	}

    /**
     * グループ削除
     */
    _deleteGroup(data) {
        let groupID = data.groupID;
        
		this.for_each_group((i, group) =>{
			if (group.id === groupID) {
				this.connector.send(Command.DeleteGroup, group, (err, reply) => {
					// console.log("DeleteGroup done", err, reply);
					// console.log("UpdateGroup done", err, reply);
					if (!err) {
						// コンテンツやDisplayも削除
						let contentMetaDataList = [];
						let displayMetaDataList = [];
						this.store.for_each_metadata((id, metaData) => {
							if (Validator.isContentType(metaData) || Validator.isLayoutType(metaData)) {
								if (metaData.group === groupID) {
									contentMetaDataList.push(metaData);
								}
							} else if (Validator.isWindowType(metaData)) {
								if (metaData.group === groupID) {
									displayMetaDataList.push(metaData);
								}
							}
						});
						if (contentMetaDataList.length > 0) {
							this.store.operation.deleteContent(contentMetaDataList);
						}
						if (displayMetaDataList.length > 0) {
							this.store.operation.deleteWindow(displayMetaDataList);
						}
					}
					// UserList再取得
					this.action.reloadUserList();
					this.action.reloadContentGroupList();

				});
				return true; // break
			}
		});
    }

    /**
     * グループ変更
     * @param {*} data 
     */
    _changeGroup(data) {
        let groupID = data.groupID;

		let targetMetaDataList = [];
		let group;

		this.store.getState().for_each_selected_id((i, id) => {
			if (this.store.hasMetadata(id)) {
				let metaData = this.store.getMetaData(id);
				metaData.group = groupID;

				this.for_each_group((k, group_) => {
					if (group_.id === groupID) {
						targetMetaDataList.push(metaData);
						group = group_;
						return true; // break
					}
				});
			}
		});

		if (targetMetaDataList.length > 0) {
			this.store.operation.updateMetadataMulti(targetMetaDataList, ((group) => {
				return (err, data) => {
					this.connector.send(Command.UpdateGroup, group, (err, reply) => {
					});
				};
			})(group));
		}
    }

    /**
     * Groupの選択が変更された
     */
    _changeGroupSelect(data) {
		let groupID = data.groupID;
		this.store.getState().setContentSelectedGroup(groupID);
		this.store.emit(Store.EVENT_GROUP_SELECT_CHANGED, null, data);
	}
	
    /**
     * DisplayGroupの選択が変更された
     */
	_changeDisplayGroupSelect(data) {
		let groupID = data.groupID;
		this.currentDisplayGroupID = groupID;
        this.store.operation.getVirtualDisplay(groupID, (err, data) => {
            this.store.getState().setDisplaySelectedGroup(groupID);
            this.store.emit(Store.EVENT_DISPLAY_GROUP_SELECT_CHANGED, err, data);
        }, true);
	}

	/**
	 * Groupを１つ下に
	 */
	_moveDownGroup(data) {
        let groupID = data.groupID;
		let iterateGroupFunc = this.for_each_content_group.bind(this);
		let targetGroupList = this.getContentGroupList();
		if (Validator.isDisplayTabSelected()) {
			iterateGroupFunc = this.for_each_display_group.bind(this);
			targetGroupList = this.getDisplayGroupList();
		}
		iterateGroupFunc((i, group) => {
			let target;
			if (group.id === groupID && groupID !== Constants.DefaultGroup) {
				if (i > 0 && i < (targetGroupList.length - 1)) {
					target = {
						id: group.id,
						index: i + 2
					};
					this.connector.send(Command.ChangeGroupIndex, target, (err, reply) => {
						if (err) { console.error(err); }
						// console.log("ChangeGroupIndex done", err, reply);
					});
					return true;
				}
			}
		});
	}

	/**
	 * Groupを１つ上に
	 */
	_moveUpGroup(data) {
        let groupID = data.groupID;
		let iterateGroupFunc = this.for_each_content_group.bind(this);
		let targetGroupList = this.getContentGroupList();
		if (Validator.isDisplayTabSelected()) {
			iterateGroupFunc = this.for_each_display_group.bind(this);
			targetGroupList = this.getDisplayGroupList();
		}
		iterateGroupFunc((i, group) => {
			let target;
			if (group.id === groupID && groupID !== Constants.DefaultGroup) {
				if (i > 1 && i <= (targetGroupList.length - 1)) {
					target = {
						id: group.id,
						index: i - 1
					};
					this.connector.send(Command.ChangeGroupIndex, target, (err, reply) => {
						if (err) { console.error(err); }
						// console.log("ChangeGroupIndex done", err, reply);
					});
					return true;
				}
			}
		});
	}

	/**
	 * Group名変更
	 */
	_changeGroupName(data) {
        let groupID = data.groupID;
        let groupName = data.groupName;

		this.for_each_group((i, group) => {
			if (group.id === groupID) {
				let oldName = group.name;
				group.name = groupName;
				this.connector.send(Command.UpdateGroup, group, (err, reply) => {
					// console.log("UpdateGroup done", err, reply);
					if (!err) {
						// グループリスト更新
						this.action.reloadUserList();
						this.action.reloadContentGroupList();
					} else {
						console.error("Error update group failed", err)
					}
				});
			}
		});
	}

	/**
	 * Group色変更
	 */
	_changeGroupColor(data) {
        let groupID = data.groupID;
        let color = data.color;

		this.for_each_group((i, group) => {
			if (group.id === groupID) {
				group.color = color;
				this.connector.send(Command.UpdateGroup, group, (err, reply) => {
				});
				return true;
			}
		});	
	}

	/**
	 * 指定したグループIDのグループがあるかどうか
	 */
	hasGroup(groupID) {
		return this.groupDict.hasOwnProperty(groupID);
	}
	
	/**
	 * 指定したグループIDのグループ情報を返す
	 */
	getGroup(groupID) {
		return this.groupDict[groupID];
	}

	/**
	 * グループリストを取得
	 */
	getGroupList() {
		return this.groupList;
	}

	/**
	 * コンテンツグループリストを取得
	 */
	getContentGroupList() {
		return this.contentGroupList;
	}
	
	/**
	 * ディスプレイグループリストを取得
	 */
	getDisplayGroupList() {
		return this.displayGroupList;
	}

	/**
	 * ディスプレイグループごとにfuncを実行
	 * @param {*} func 
	 */
	for_each_display_group(func) {
		let i;
		for (i = 0; i < this.displayGroupList.length; ++i) {
			if (func(i, this.displayGroupList[i]) === true) {
				break;
			}
		}
	}

	/**
	 * グループリストを設定
	 * TODO 何とかして消す
	 */
	setGroupList(grouplist, displayGroupList) {
		this.contentGroupList = grouplist;
		this.displayGroupList = displayGroupList;

		let groupListMerged = [];
		Array.prototype.push.apply(groupListMerged, grouplist);
		Array.prototype.push.apply(groupListMerged, displayGroupList);
		this.groupList = groupListMerged;
		this.groupDict = {}
		this.for_each_group((i, group) => {
			this.groupDict[group.id] = group;
		});
	}


	/**
	 * グループの色を返す
	 */
	getGroupColor(meta) {
		let groupID = meta.group;
		this.for_each_group(function (i, group) {
			if (group.id === groupID) {
				if (group.color) {
					return group.color;
				}
			}
		});
		if (meta.type === Constants.TypeContent) {
			return Constants.ContentSelectColor;
		}
		return Constants.ContentSelectColor;
	}

	/**
	 * グループ辞書を取得
	 */
	getGroupDict() {
		return this.groupDict;
	}

	/**
	 * 現在のグループIDを取得
	 */
	getCurrentGroupID() {
		return this.state.getContentSelectedGroup();
	}

	/**
	 * グループごとにfuncを実行
	 * @param {*} func 
	 */
	for_each_group(func) {
		let i;
		for (i = 0; i < this.groupList.length; ++i) {
			if (func(i, this.groupList[i]) === true) {
				break;
			}
		}
	}
	
	/**
	 * コンテンツグループごとにfuncを実行
	 * @param {*} func 
	 */
	for_each_content_group(func) {
		let i;
		for (i = 0; i < this.contentGroupList.length; ++i) {
			if (func(i, this.contentGroupList[i]) === true) {
				break;
			}
		}
	}
	
}

export default GroupStore;