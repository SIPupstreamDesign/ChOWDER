

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

		this.currentGroupID = Constants.DefaultGroup;

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

		this.connector.send('AddGroup', metaData, (err, groupID) => {
			// UserList再取得
			this.connector.send('GetUserList', {}, (err, userList) => {
                this.store.emit(Store.EVENT_GROUP_ADDED, err, userList);
			});
		});

    }

	/**
	 * グループリストを取得
	 * @param {*} data 
	 */
	_getGroupList(data) {
		let callback;
		if (data && data.hasOwnProperty('callback')) {
			callback = data.callback;
			delete data.callback;
		}
		this.store.operation.getGroupList(data);
	}

    /**
     * グループ削除
     */
    _deleteGroup(data) {
        let groupID = data.groupID;
        
		this.store.for_each_group((i, group) =>{
            console.error(group.id, groupID);
			if (group.id === groupID) {
				this.connector.send('DeleteGroup', group, (err, reply) => {
					// console.log("DeleteGroup done", err, reply);
					let deleteList = [];
					// console.log("UpdateGroup done", err, reply);
					if (!err) {
						// コンテンツも削除
						this.store.for_each_metadata((id, metaData) => {
							if (Validator.isContentType(metaData) || Validator.isLayoutType(metaData)) {
								if (metaData.group === groupID) {
									deleteList.push(metaData);
								}
							}
						});
						if (deleteList.length > 0) {
							this.connector.send('DeleteContent', deleteList, controller.doneDeleteContent);
						}
					}
					// UserList再取得
					this.connector.send('GetUserList', {}, (err, userList) => {
						this.store.getManagement().setUserList(userList);
					});
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

				this.store.for_each_group((k, group_) => {
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
					this.connector.send('UpdateGroup', group, (err, reply) => {
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
		this.currentGroupID = groupID;
        this.store.operation.getVirtualDisplay(groupID, (err, data) => {
            this.store.getState().setDisplaySelectedGroup(groupID);
            this.store.emit(Store.EVENT_GROUP_SELECT_CHANGED, err, data);
        });
    }

	/**
	 * Groupを１つ下に
	 */
	_moveDownGroup(data) {
        let groupID = data.groupID;
		let iterateGroupFunc = this.store.for_each_content_group;
		let targetGroupList = this.store.getContentGroupList();
		if (Validator.isDisplayTabSelected()) {
			iterateGroupFunc = this.store.for_each_display_group;
			targetGroupList = this.store.getDisplayGroupList();
		}
		iterateGroupFunc((i, group) => {
			let target;
			if (group.id === groupID && groupID !== Constants.DefaultGroup) {
				if (i > 0 && i < (targetGroupList.length - 1)) {
					target = {
						id: group.id,
						index: i + 2
					};
					this.connector.send('ChangeGroupIndex', target, (err, reply) => {
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
		let iterateGroupFunc = this.store.for_each_content_group;
		let targetGroupList = this.store.getContentGroupList();
		if (Validator.isDisplayTabSelected()) {
			iterateGroupFunc = this.store.for_each_display_group;
			targetGroupList = this.store.getDisplayGroupList();
		}
		iterateGroupFunc((i, group) => {
			let target;
			if (group.id === groupID && groupID !== Constants.DefaultGroup) {
				if (i > 1 && i <= (targetGroupList.length - 1)) {
					target = {
						id: group.id,
						index: i - 1
					};
					this.connector.send('ChangeGroupIndex', target, (err, reply) => {
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

		this.store.for_each_group((i, group) => {
			let oldName;
			if (group.id === groupID) {
				oldName = group.name;
				group.name = groupName;
				this.connector.send('UpdateGroup', group, ((oldName, newName) => {
					return (err, reply) => {
						// console.log("UpdateGroup done", err, reply);
						if (!err) {
							// グループリスト更新
							this.connector.send('GetUserList', {}, (err, userList) => {
								this.store.getManagement().setUserList(userList);
							});
						}
					};
				})(oldName, groupName));
			}
		});
	}

	/**
	 * Group色変更
	 */
	_changeGroupColor(data) {
        let groupID = data.groupID;
        let color = data.color;

		this.store.for_each_group((i, group) => {
			if (group.id === groupID) {
				group.color = color;
				this.connector.send('UpdateGroup', group, (err, reply) => {
				});
				return true;
			}
		});	
	}

}

export default GroupStore;