/*jslint devel:true*/
(function () {
	"use strict";
	var InputDialog;

	/**
	 * Group名入力ダイアログの表示をトグル
	 */
	function toggleGroupNameInput() {
		var background = document.getElementById("popup_background"),
			input = document.getElementById("input_dialog");
		input.style.display = (input.style.display === "block") ? "none" : "block";
		background.style.display = input.style.display; 
		background.onclick = toggleGroupNameInput;
	}
	
	InputDialog = function (name, initialValue, okName, okCallback) {
		var okbutton = document.getElementById('input_ok_button'),
			dialogname = document.getElementById('input_dialog_name'),
			input = document.getElementById("input_dialog_input");

		dialogname.textContent = name;
		input.value = initialValue;

		okbutton.value = okName;
		okbutton.onclick = function (evt) {
			var input = document.getElementById("input_dialog_input");
			if (okCallback) {
				okCallback(input.value);
			}
			input.value = "";
			toggleGroupNameInput();
		};

		toggleGroupNameInput();
	};


	function init(setting, okCallback) {
		return new InputDialog(setting.name, setting.initialName, setting.okButtonName, okCallback);
	}

	window.input_dialog = init;
}());