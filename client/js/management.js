(function () {

	var Management = function () {
		EventEmitter.call(this);

		this.authority = null;
		this.userList = null;
		this.maxHistoryNum = 10;
		this.current_db = null;
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
				name : "新規保存名",
				okButtonName : "作成",
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
					name : "保存名の変更",
					okButtonName : "OK",
					initialValue : name,
					opacity : 0.7,
					zIndex : 90000001,
					backgroundColor : "#888"
				}, function (value) {
					var k;
					if (name === value) {
						window.input_dialog.ok_input({
							name : "既に存在する名前です",
							opacity : 0.7,
							zIndex : 90000001,
							backgroundColor : "#888"
						})
						return;
					} else {
						for (k = 0; k < e.options.length; k = k + 1) {
							if (option.value === value) {
								window.input_dialog.ok_input({
									name : "既に存在する名前です",
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
							name : "空の名前にはできません",
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
	Management.prototype.getUser = function (name) {
		var i;
		for (i = 0; i < this.userList.length; i = i + 1) {
			if (this.userList[i].name === name) {
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
		this.editableSelect = new window.SelectList();
		this.viewableSelect = new window.SelectList();
		var authTargetFrame = document.getElementById('auth_target_frame');
		var authSelect = document.getElementById('auth_select');
		var applyButton = document.getElementById('apply_auth_button');
		var groupManipulateCheck = document.getElementById('group_add_delete_check');
		var groupManipulateLabel = document.getElementById('group_add_delete_label');
		var displayManipulateCheck = document.getElementById('display_manipulate_check');
		var displayManipulateLabel = document.getElementById('display_manipulate_label');
		var allAccessText = "全て";

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
					option.value = user.name;
					option.innerText = user.name;
					select.appendChild(option);	
				}
			}
		}

		// セレクト変更された
		authSelect.onchange = function () {
			// 編集可能、閲覧可能のリストを選択する.
			var index = authSelect.selectedIndex;
			var name = authSelect.childNodes[index].value;
			var listContentName;
			var user = this.getUser(name);
			this.viewableSelect.deselectAll();
			this.editableSelect.deselectAll();
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
				if (user.viewable && user.viewable === "all") {
					this.viewableSelect.select(allAccessText);
				}
				if (user.viewable && user.editable === "all") {
					this.editableSelect.select(allAccessText);
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

		authTargetFrame.innerHTML = "";
		this.editableSelect.add(allAccessText, allAccessText);
		this.viewableSelect.add(allAccessText, allAccessText);
		for (i = 0; i < this.userList.length; i = i + 1) {
			if (this.userList[i].type !== "admin" &&
				this.userList[i].type !== "display" &&
				this.userList[i].type !== "guest")
			{
				this.editableSelect.add(this.userList[i].name, this.userList[i].id);
				this.viewableSelect.add(this.userList[i].name, this.userList[i].id);
			}
		}
		authTargetFrame.appendChild(this.editableSelect.getDOM());
		authTargetFrame.appendChild(this.viewableSelect.getDOM());

		applyButton.onclick = function () {
			var index = authSelect.selectedIndex;
			if (index >= 0 && authSelect.childNodes.length > index) {
				var name = authSelect.childNodes[index].value;
				var editable = this.editableSelect.getSelectedValues();
				var viewable = this.viewableSelect.getSelectedValues();
				var group_manipulatable = groupManipulateCheck.checked;
				var display_manipulatable = displayManipulateCheck.checked;
				if (editable.indexOf(allAccessText) >= 0) {
					editable = "all";
				}
				if (viewable.indexOf(allAccessText) >= 0) {
					viewable = "all";
				}
				this.emit(Management.EVENT_CHANGE_AUTHORITY,
					name, editable, viewable, group_manipulatable, display_manipulatable, function () {
						
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
		
		// ユーザー名リストの設定
		if (this.userList) {
			var select = authSelect;
			select.innerHTML = "";
			for (i = 0; i < this.userList.length; i = i + 1) {
				option = document.createElement('option');
				option.value = this.userList[i].name;
				option.innerText = this.userList[i].name;
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
				var name = authSelect.childNodes[authSelect.selectedIndex].value;
				for (i = 0; i < this.userList.length; i = i + 1) {
					if (this.userList[i].name === name) {
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
				var name = this.userList[index].name;
				this.emit(Management.EVENT_CHANGE_PASSWORD, name, prePass.value, pass.value, function () {
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
		var background = new PopupBackground();
		background.show();
		background.on('close', function () {
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
				if (authority && authority.hasOwnProperty('viewable') && authority.hasOwnProperty('editable')) {
					if (authority.viewable === "all" && authority.editable === "all") {
						return true;
					}
				}
				return false;
			},
			isViewable : function (groupID) {
				if (groupID === "group_default") {
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
				if (groupID === "group_default") {
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

	Management.prototype.isDisplayManipulatable = function () {
		return this.getAuthorityObject().isDisplayManipulatable();
	};

	Management.prototype.setUserList = function (userList) {
		this.userList = userList;
	};
	
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

	window.Management = Management;

}());
