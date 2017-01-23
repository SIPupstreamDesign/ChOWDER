(function () {

	var Management = function () {
		EventEmitter.call(this);

		this.authority = null;
		this.userList = null;
	};
	Management.prototype = Object.create(EventEmitter.prototype);

	/**
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

		// DBリスト初期化
		var db_select = document.getElementById("db_select");
		var option;
		db_select.innerHTML = "";
		for (i = 0; i < contents.dblist.length; i = i + 1) {
			option = document.createElement('option');
			option.value = contents.dblist[i];
			option.textContent = contents.dblist[i];
			db_select.appendChild(option);
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

		// 最大履歴保存数の適用
		var history_num_button = document.getElementById("apply_history_number_button");
		history_num_button.onclick = function () {
			var input = document.getElementById('history_number');
			this.emit(Management.EVENT_CHANGE_HISTORY_NUM, null, input.value);
		}.bind(this);

		// ユーザー名リストの設定
		if (this.userList) {
			var selects = document.getElementsByClassName('auth_select');
			for (k = 0; k < selects.length; k = k + 1) {
				var select = selects[k];
				select.innerHTML = "";
			}
			for (i = 0; i < this.userList.length; i = i + 1) {
				for (k = 0; k < selects.length; k = k + 1) {
					var select = selects[k];
					option = document.createElement('option');
					option.value = this.userList[i];
					option.innerText = this.userList[i];
					select.appendChild(option);
				}
			}
		}

		// 閲覧・編集権限の設定のリスト
		this.editableSelect = new window.SelectList();
		this.viewableSelect = new window.SelectList();
		var authTargetFrame = document.getElementById('auth_target_frame');
		authTargetFrame.innerHTML = "";
		for (i = 0; i < this.userList.length; i = i + 1) {
			this.editableSelect.add(this.userList[i]);
			this.viewableSelect.add(this.userList[i]);
		}
		authTargetFrame.appendChild(this.editableSelect.getDOM());
		authTargetFrame.appendChild(this.viewableSelect.getDOM());
	};

	Management.prototype.setAuthority = function (authority) {
		this.authority = authority;
	};

	Management.prototype.getAuthority = function () {
		return this.authority;
	};

	Management.prototype.setUserList = function (userList) {
		this.userList = userList;
	};
	
	// 新規DB保存領域作成&切り替え
	Management.EVENT_NEWDB = "newdb";
	Management.EVENT_CHANGEDB = "changedb";
	Management.EVENT_RENAMEDB = "renamedb";
	Management.EVENT_DELETEDB = "deletedb";

	// ダイアログ閉じた
	Management.EVENT_CLOSE = "close";
	
	// 最大履歴保存数の適用
	Management.EVENT_CHANGE_HISTORY_NUM = "change_history_num";

	window.Management = Management;

}());
