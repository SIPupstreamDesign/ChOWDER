(function () {
	"use strict";

	var Management = function () {
		EventEmitter.call(this);

		this.authority = null;
		this.userList = null;
		this.maxHistoryNum = 10;
		this.current_db = null;
		this.maxMesageSize = null;
	};
	Management.prototype = Object.create(EventEmitter.prototype);

	/**
	 *  DBの操作GUIの初期化
	 */
	Management.prototype.initDBGUI = function (contents) {
		// DBリスト初期化
		var db_select = document.getElementById("db_select");
		var option;
		var dbname, dbid;
		db_select.innerHTML = "";
		var i = 0;
		for (dbname in contents.dblist) {
			dbid = contents.dblist[dbname];
			option = document.createElement('option');
			option.value = dbname;
			option.textContent = dbname;
			db_select.appendChild(option);
			if (this.current_db === dbid) {
				db_select.selectedIndex = i;
			}
			++i;
		}

		var changeDisableFunc = function () {
			var e = document.getElementById("db_select");
			if (e.options.length > e.selectedIndex) {
				var name = e.options[e.selectedIndex].value;
				var isDisableEdit = (name === "default");
				document.getElementById('renamedb_button').disabled = isDisableEdit;
				document.getElementById('deletedb_button').disabled = isDisableEdit;
			}
		};

		db_select.onchange = changeDisableFunc;
		changeDisableFunc();

		// DB新規
		var newdb_button = document.getElementById('newdb_button');
		newdb_button.onclick = function () {
			window.input_dialog.text_input({
				name : i18next.t("save_name"),
				okButtonName : i18next.t("create"),
				opacity : 0.7,
				zIndex : 90000001,
				backgroundColor : "#888"
			}, function (value) {
				if (value.length > 0) {
					this.emit(Management.EVENT_NEWDB, null, value);
				}
			}.bind(this));
		}.bind(this);

		// DB切り替え
		var changedb_button = document.getElementById('changedb_button');
		changedb_button.onclick = function () {
			var e = document.getElementById("db_select");
			if (e.options.length > e.selectedIndex) {
				var name = e.options[e.selectedIndex].value;
				this.emit(Management.EVENT_CHANGEDB, null, name);
			}
		}.bind(this);

		// DB名前変更
		var renamedb_button = document.getElementById('renamedb_button');
		renamedb_button.onclick = function () {
			var e = document.getElementById("db_select");
			if (e.options.length > e.selectedIndex) {
				var name = e.options[e.selectedIndex].value;
				window.input_dialog.text_input({
					name : i18next.t('change_saving_name'),
					okButtonName : "OK",
					initialValue : name,
					opacity : 0.7,
					zIndex : 90000001,
					backgroundColor : "#888"
				}, function (value) {
					var k;
					if (name === value) {
						window.input_dialog.ok_input({
							name : i18next.t("already_exists"),
							opacity : 0.7,
							zIndex : 90000001,
							backgroundColor : "#888"
						})
						return;
					} else {
						for (k = 0; k < e.options.length; k = k + 1) {
							if (option.value === value) {
								window.input_dialog.ok_input({
									name : i18next.t("already_exists"),
									opacity : 0.7,
									zIndex : 90000001,
									backgroundColor : "#888"
								});
								return;
							}
						}
					}
					if (value.length === 0) {
						window.input_dialog.ok_input({
							name : i18next.t("cannot_empty"),
							opacity : 0.7,
							zIndex : 90000001,
							backgroundColor : "#888"
						})
					}

					this.emit(Management.EVENT_RENAMEDB, null, name, value);
				}.bind(this));
			}
		}.bind(this);

		// DB削除
		var deletedb_button = document.getElementById('deletedb_button');
		deletedb_button.onclick = function () {
			var e = document.getElementById("db_select");
			if (e.options.length > e.selectedIndex) {
				var name = e.options[e.selectedIndex].value;
				this.emit(Management.EVENT_DELETEDB, null, name);
			}
		}.bind(this);
		
		// DB初期化
		var initdb_button = document.getElementById('initdb_button');
		initdb_button.onclick = function () {
			var e = document.getElementById("db_select");
			if (e.options.length > e.selectedIndex) {
				var name = e.options[e.selectedIndex].value;
				this.emit(Management.EVENT_INITDB, null, name);
			}
		}.bind(this);
	};

	/**
	 *  履歴管理GUIの初期化
	 */
	Management.prototype.initHistoryGUI = function (contents) {
		// 最大履歴保存数の適用
		var history_num_button = document.getElementById("apply_history_number_button");
		var input = document.getElementById('history_number');
		history_num_button.onclick = function () {
			this.emit(Management.EVENT_CHANGE_HISTORY_NUM, null, input.value, function () {
				var message = document.getElementById('apply_history_message');
				message.style.visibility = "visible";
				setTimeout(function () {
					message.style.visibility = "hidden";
				}, 2000);
			});
		}.bind(this);
		input.value = this.maxHistoryNum;
	};

	/**
	 * ユーザーの権限データを返す
	 */
	Management.prototype.getUser = function (id) {
		var i;
		for (i = 0; i < this.userList.length; i = i + 1) {
			if (this.userList[i].id === id) {
				return this.userList[i];
			}
		}
		return null;
	};

	/**
	 * 閲覧・編集権限GUIの初期化
	 */
	Management.prototype.initAuthorityGUI = function (contents) {
		// 閲覧・編集権限の設定のリスト
		var i;
		var option;
		this.editableSelect = new window.SelectList();
		this.viewableSelect = new window.SelectList();
		this.displayEditableSelect = new window.SelectList();
		var authTargetFrame = document.getElementById('auth_target_frame');
		var authSelect = document.getElementById('auth_select');
		var applyButton = document.getElementById('apply_auth_button');
		var groupManipulateCheck = document.getElementById('group_add_delete_check');
		var groupManipulateLabel = document.getElementById('group_add_delete_label');
		var displayManipulateCheck = document.getElementById('display_manipulate_check');
		var displayManipulateLabel = document.getElementById('display_manipulate_label');
		var allAccessText = i18next.t("all");

		// グループの追加削除を許可のチェック
		groupManipulateLabel.onclick = function () {
			groupManipulateCheck.click();
		};
		
		// ディスプレイの操作を許可のチェック
		displayManipulateLabel.onclick = function () {
			displayManipulateCheck.click();
		};
		
		// ユーザー名リストの設定
		if (this.userList) {
			var select = authSelect;
			var user;
			select.innerHTML = "";
			for (i = 0; i < this.userList.length; i = i + 1) {
				user = this.userList[i];
				if (user.type !== "admin") {
					option = document.createElement('option');
					option.value = user.id;
					option.innerHTML = user.name;
					select.appendChild(option);	
				}
			}
		}

		// セレクト変更された
		authSelect.onchange = function () {
			// 編集可能、閲覧可能のリストを選択する.
			var index = authSelect.selectedIndex;
			var id = authSelect.childNodes[index].value;
			var listContentName;
			var user = this.getUser(id);
			this.viewableSelect.deselectAll();
			this.editableSelect.deselectAll();
			this.displayEditableSelect.deselectAll();
			if (user) {
				for (i = 0; i < this.userList.length; i = i + 1) {
					if (this.userList[i].type !== "admin")
					{
						listContentName = this.userList[i].id;
						if (user.viewable && (user.viewable === "all" || user.viewable.indexOf(listContentName) >= 0)) {
							this.viewableSelect.select(this.userList[i].name);
						}
						if (user.editable && (user.editable === "all" || user.editable.indexOf(listContentName) >= 0)) {
							this.editableSelect.select(this.userList[i].name);
						}
					}
				}
				for (i = 0; i < this.displayGroupList.length; i = i + 1) {
					listContentName = this.displayGroupList[i].id;
					if (user.displayEditable && (user.displayEditable === "all" || user.displayEditable.indexOf(listContentName) >= 0)) {
						this.displayEditableSelect.select(this.displayGroupList[i].name);
					}
				}
				if (user.viewable && user.viewable === "all") {
					this.viewableSelect.select(allAccessText);
				}
				if (user.viewable && user.editable === "all") {
					this.editableSelect.select(allAccessText);
				}
				if (user.displayEditable && user.displayEditable === "all") {
					this.displayEditableSelect.select(allAccessText);
				}
				if (user.hasOwnProperty('group_manipulatable')) {
					groupManipulateCheck.checked = user.group_manipulatable;
				}
				if (user.hasOwnProperty('display_manipulatable')) {
					displayManipulateCheck.checked = user.display_manipulatable;
				}
			}
		}.bind(this);

		// 全てが選択された場合
		this.editableSelect.on('change', function (err, text, isSelected) {
			if (text === allAccessText) {
				if (isSelected) {
					this.editableSelect.selectAll();
				} else {
					this.editableSelect.deselectAll();
				}
			} else {
				// 全てが選択された状態で全て以外が選択解除された. 全てを選択解除する.
				var editable = this.editableSelect.getSelectedValues();
				if (!isSelected && text !== allAccessText && editable.indexOf(allAccessText) >= 0) {
					this.editableSelect.deselect(allAccessText);
				}
			}
		}.bind(this));
		this.viewableSelect.on('change', function (err, text, isSelected) {
			if (text === allAccessText) {
				if (isSelected) {
					this.viewableSelect.selectAll();
				} else {
					this.viewableSelect.deselectAll();
				}
			} else {
				// 全てが選択された状態で全て以外が選択解除された. 全てを選択解除する.
				var viewable = this.viewableSelect.getSelectedValues();
				if (!isSelected && text !== allAccessText && viewable.indexOf(allAccessText) >= 0) {
					this.viewableSelect.deselect(allAccessText);
				}
			}
		}.bind(this));
		this.displayEditableSelect.on('change', function (err, text, isSelected) {
			if (text === allAccessText) {
				if (isSelected) {
					this.displayEditableSelect.selectAll();
				} else {
					this.displayEditableSelect.deselectAll();
				}
			} else {
				// 全てが選択された状態で全て以外が選択解除された. 全てを選択解除する.
				var displayEditable = this.displayEditableSelect.getSelectedValues();
				if (!isSelected && text !== allAccessText && displayEditable.indexOf(allAccessText) >= 0) {
					this.displayEditableSelect.deselect(allAccessText);
				}
			}
		}.bind(this));

		authTargetFrame.innerHTML = "";
		this.editableSelect.add(allAccessText, allAccessText);
		this.viewableSelect.add(allAccessText, allAccessText);
		this.displayEditableSelect.add(allAccessText, allAccessText);
		for (i = 0; i < this.userList.length; i = i + 1) {
			if (this.userList[i].type !== "admin" &&
				this.userList[i].type !== "display" &&
				this.userList[i].type !== "guest")
			{
				this.editableSelect.add(this.userList[i].name, this.userList[i].id);
				this.viewableSelect.add(this.userList[i].name, this.userList[i].id);
			}
		}
		for (i = 0; i < this.displayGroupList.length; ++i) {
			if (this.displayGroupList[i].id !== Constants.DefaultGroup) {
				this.displayEditableSelect.add(this.displayGroupList[i].name, this.displayGroupList[i].id);
			}
		}
		authTargetFrame.appendChild(this.editableSelect.getDOM());
		authTargetFrame.appendChild(this.viewableSelect.getDOM());
		authTargetFrame.appendChild(this.displayEditableSelect.getDOM());

		applyButton.onclick = function () {
			var index = authSelect.selectedIndex;
			if (index >= 0 && authSelect.childNodes.length > index) {
				var id = authSelect.childNodes[index].value;
				var editable = this.editableSelect.getSelectedValues();
				var viewable = this.viewableSelect.getSelectedValues();
				var displayEditable = this.displayEditableSelect.getSelectedValues();
				var group_manipulatable = groupManipulateCheck.checked;
				var display_manipulatable = displayManipulateCheck.checked;
				if (editable.indexOf(allAccessText) >= 0) {
					editable = "all";
				}
				if (viewable.indexOf(allAccessText) >= 0) {
					viewable = "all";
				}
				if (displayEditable.indexOf(allAccessText) >= 0) {
					displayEditable = "all";
				}
				console.error(displayEditable)
				
				this.emit(Management.EVENT_CHANGE_AUTHORITY,
					id, editable, viewable, displayEditable, group_manipulatable, display_manipulatable, function () {
						
					var message = document.getElementById('apply_auth_message');
					message.style.visibility = "visible";
					setTimeout(function () {
						message.style.visibility = "hidden";
					}, 2000);
				});
			}
		}.bind(this);

		// 初回の選択.
		authSelect.onchange();
	};
	
	/**
	 *  パスワード設定GUIの初期化
	 */
	Management.prototype.initPasswordGUI = function (contents) {
		var authSelect = document.getElementById('auth_select_pass');
		var prePass = document.getElementById('old_password');
		var pass = document.getElementById('new_password');
		var i;
		var option;
		
		// ユーザー名リストの設定
		if (this.userList) {
			var select = authSelect;
			select.innerHTML = "";
			for (i = 0; i < this.userList.length; i = i + 1) {
				option = document.createElement('option');
				option.value = this.userList[i].id;
				option.innerHTML = this.userList[i].name;
				select.appendChild(option);
			}
		}

		authSelect.onchange = function () {
			var i,
				type;
			prePass.value = "";
			pass.value = "";
			if (authSelect.selectedIndex >= 0) {
				var index = -1;
				var id = authSelect.childNodes[authSelect.selectedIndex].value;
				for (i = 0; i < this.userList.length; i = i + 1) {
					if (this.userList[i].id === id) {
						index = i;
						break;
					}
				}
				if (index >= 0 && this.userList.length > index) {
					type = this.userList[index].type;
					if (type === "admin") {
						prePass.disabled = false;
						pass.disabled = false;
					} else if (type === "group") {
						prePass.disabled = true;
						pass.disabled = false;
					} else {
						prePass.disabled = true;
						pass.disabled = true;
					}
				}
			}
		}.bind(this);

		var applyPassButton = document.getElementById('apply_pass_button');
		applyPassButton.onclick = function () {
			var index = authSelect.selectedIndex;
			if (index >= 0) {
				var id = this.userList[index].id;
				if (pass.value <= 0) {
					if (name === "Display" || name === "Gueset") {
						window.input_dialog.ok_input({
							name : i18next.t('cannot_set_to_this_user'),
							opacity : 0.7,
							zIndex : 90000001,
							backgroundColor : "#888"
						}, function () {
							return;
						});
					} else {
						window.input_dialog.ok_input({
							name : i18next.t('input_valid_password'),
							opacity : 0.7,
							zIndex : 90000001,
							backgroundColor : "#888"
						}, function () {
							return;
						});
					}
					return;
				}

				this.emit(Management.EVENT_CHANGE_PASSWORD, id, prePass.value, pass.value, function (err, reply) {
					console.error(err, reply)
					if (err) {
						window.input_dialog.ok_input({
							name : i18next.t('input_valid_password'),
							opacity : 0.7,
							zIndex : 90000001,
							backgroundColor : "#888"
						}, function () {
							return;
						});
					}
					var message = document.getElementById('apply_pass_message');
					message.style.visibility = "visible";
					setTimeout(function () {
						message.style.visibility = "hidden";
					}, 2000);
				});
			}
		}.bind(this);
	};

	/**
	 * 管理GUIを表示する
	 * @param contents.dblist dbリスト
	 */
	Management.prototype.show = function (contents) {
		var i, k;
		this.contents = contents;
		this.background = new PopupBackground();
		this.background.show();
		this.background.on('close', function () {
			management.style.display = "none";
			this.emit(window.Management.EVENT_CLOSE, null);
		}.bind(this));

		var management = document.getElementById('management');
		management.style.display = "block";

		// DBの操作GUIの初期化
		this.initDBGUI(contents);

		// 履歴管理GUIの初期化
		this.initHistoryGUI(contents);

		// 閲覧・編集権限GUIの初期化
		this.initAuthorityGUI(contents);

		// パスワード設定GUIの初期化
		this.initPasswordGUI(contents);

		// 権限情報をGUIに反映.
	};

	Management.prototype.close = function (authority) {
		if (this.background) {
			this.background.close();
		}
	};

	Management.prototype.setAuthority = function (authority) {
		this.authority = authority;
	};

	Management.prototype.getAuthority = function () {
		return this.authority;
	};

	Management.prototype.setMaxHistoryNum = function (num) {
		this.maxHistoryNum = num;
	};

	Management.prototype.setCurrentDB = function (dbid) {
		this.current_db = dbid;
	};

	Management.prototype.getMaxHistoryNum = function () {
		return this.maxHistoryNum;
	};

	Management.prototype.getAuthorityObject = function () {
		var authority = this.authority;
		return {
			isAdmin : function () {
				if (authority && authority.hasOwnProperty('is_admin')) {
					if (String(authority.is_admin) === "true") {
						return true;
					}
				}
				return false;
			},
			isViewable : function (groupID) {
				if (groupID === Constants.DefaultGroup) {
					return true;
				}
				if (groupID === undefined || groupID === "") {
					return true;
				}
				if (authority && authority.hasOwnProperty('viewable')) {
					if (authority.viewable === "all" || authority.viewable.indexOf(groupID) >= 0) {
						return true;
					}
				}
				return false;
			},
			isEditable : function (groupID) {
				if (groupID === Constants.DefaultGroup) {
					return true;
				}
				if (groupID === undefined || groupID === "") {
					return true;
				}
				if (authority) {
					if (authority.hasOwnProperty('editable')) {
						if (authority.editable === "all" || authority.editable.indexOf(groupID) >= 0) {
							return true;
						}
					}
				}
				return false;
			},
			isDisplayEditable : function (groupID) {
				if (groupID === Constants.DefaultGroup) {
					return true;
				}
				if (groupID === undefined || groupID === "") {
					return true;
				}
				if (authority) {
					if (authority.hasOwnProperty('displayEditable')) {
						if (authority.displayEditable === "all" || authority.displayEditable.indexOf(groupID) >= 0) {
							return true;
						}
					}
				}
				return false;
			},
			isGroupManipulable : function () {
				if (authority && authority.hasOwnProperty('group_manipulatable')) {
					return authority.group_manipulatable;
				}
				return false;
			},
			isDisplayManipulatable : function () {
				if (authority && authority.hasOwnProperty('display_manipulatable')) {
					return authority.display_manipulatable;
				}
				return false;
			}
		}
	};
	Management.prototype.isViewable = function (group) {
		return this.getAuthorityObject().isViewable(group);
	};

	Management.prototype.isEditable = function (group) {
		return this.getAuthorityObject().isEditable(group);
	};

	Management.prototype.isDisplayEditable = function (group) {
		return this.getAuthorityObject().isDisplayEditable(group);
	};

	Management.prototype.isDisplayManipulatable = function () {
		return this.getAuthorityObject().isDisplayManipulatable();
	};

	Management.prototype.setUserList = function (userList) {
		this.userList = userList;
	};

	Management.prototype.setDisplayGroupList = function (groupList) {
		this.displayGroupList = groupList;
	};
	
	Management.prototype.setMaxMessageSize = function (size) {
		this.maxMesageSize = size;
	}
	
	Management.prototype.getMaxMessageSize = function () {
		return this.maxMesageSize;
	}

	// 新規DB保存領域作成&切り替え
	Management.EVENT_NEWDB = "newdb";
	Management.EVENT_CHANGEDB = "changedb";
	Management.EVENT_RENAMEDB = "renamedb";
	Management.EVENT_DELETEDB = "deletedb";
	Management.EVENT_INITDB = "initdb";

	// パスワード変更
	Management.EVENT_CHANGE_PASSWORD = "change_password";

	// 権限変更変更
	Management.EVENT_CHANGE_AUTHORITY = "change_authority";

	// ダイアログ閉じた
	Management.EVENT_CLOSE = "close";
	
	// 最大履歴保存数の適用
	Management.EVENT_CHANGE_HISTORY_NUM = "change_history_num";

	/**
	 * 管理ページのイベント初期化.
	 * @method initManagementEvents
	 */
	function initManagementEvents(connector, login, management) {
		var updateGlobalSettingFunc = function () {
			connector.send('GetGlobalSetting', {}, function (err, reply) {
				if (reply && reply.hasOwnProperty('max_history_num')) {
					management.setMaxHistoryNum(reply.max_history_num);
					management.setCurrentDB(reply.current_db);
					if (reply.wsMaxMessageSize) {
						management.setMaxMessageSize(reply.wsMaxMessageSize)
					}
				}
			});
		}

		// 管理ページでパスワードが変更された
		management.on('change_password', function (userID, prePass, pass, callback) {
			var request = {
					id : userID,
					pre_password : prePass,
					password : pass,
				},
				loginkey = login.getLoginKey();
			if (loginkey.length > 0) {
				request.loginkey = loginkey;
			}
			connector.send('ChangePassword', request, callback);
		});
	
		// 権限の変更
		management.on('change_authority', function (
			userID, editable, viewable, displayEditable,
			group_manipulatable, display_manipulatable, callback)
		{
			var request = {
				id : userID,
				editable : editable,
				viewable : viewable,
				displayEditable : displayEditable,
				group_manipulatable : group_manipulatable,
				display_manipulatable : display_manipulatable
			};
			connector.send('ChangeAuthority', request, function (err, data) {
				connector.send('GetUserList', {}, function (err, userList) {
					management.setUserList(userList);
					if (callback) {
						callback();
					}
				});
			});
		});

		// 履歴保存数の変更
		management.on("change_history_num", function (err, value, callback) {
			connector.send("ChangeGlobalSetting", { max_history_num : value }, function () {
				updateGlobalSettingFunc();
				if (callback) {
					callback();
				}
			});
		});
		
		// 新規DB
		management.on('newdb', function (err, name) {
			connector.send("NewDB", { name : name }, function () {
			});
		}.bind(this));

		// DB名変更
		management.on('renamedb', function (err, preName, name) {
			connector.send("RenameDB", { name : preName, new_name : name }, function () {
			});
		}.bind(this));
		
		// DBの切り替え
		management.on('changedb', function (err, name) {
			connector.send("ChangeDB", { name : name }, function () {
			});
		}.bind(this));

		// DBの削除
		management.on('deletedb', function (err, name) {
			window.input_dialog.okcancel_input({
				name : "DB: " + name + " " + i18next.t('delete_is_ok'),
				opacity : 0.7,
				zIndex : 90000001,
				backgroundColor : "#888"
			}, function (isOK) {
				if (isOK) {
					connector.send("DeleteDB", { name : name }, function () {
					});
				}
			})
		}.bind(this));

		// DBの初期化
		management.on('initdb', function (err, name) {
			window.input_dialog.okcancel_input({
				name : "DB: " + name + " " + i18next.t('init_is_ok'),
				opacity : 0.7,
				zIndex : 90000001,
				backgroundColor : "#888"
			}, function (isOK) {
				if (isOK) {
					connector.send("InitDB", { name : name }, function () {
					});
				}
			})
		}.bind(this));

		updateGlobalSettingFunc();
	}
	
	window.Management = Management;
	window.Management.initManagementEvents = initManagementEvents;

}());
