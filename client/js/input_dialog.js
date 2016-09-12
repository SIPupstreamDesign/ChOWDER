/*jslint devel:true*/
(function () {
	"use strict";
	var InputDialog;

	/**
	 * Group名入力ダイアログの表示をトグル
	 */
	function toggleTextInput() {
		var background = document.getElementById("popup_background"),
			input = document.getElementById("input_dialog");
		input.style.display = (input.style.display === "block") ? "none" : "block";
		background.style.display = input.style.display; 
		background.onclick = toggleTextInput;
	}

	function toggleColorInput() {
		var background = document.getElementById("popup_background"),
			color_picker = document.getElementById('color_dialog_picker'),
			color_dialog = document.getElementById('color_dialog');
		if (!color_dialog.style.display || color_dialog.style.display === "none") {
			background.style.display = "block";
			color_dialog.style.display = "block";
		} else {
			color_picker.innerHTML = "";
			background.style.display = "none";
			color_dialog.style.display = "none";
		}
		background.onclick = toggleColorInput;
	}

	function init_text_input(setting, okCallback) {
		var okbutton = document.getElementById('input_ok_button'),
			dialogname = document.getElementById('input_dialog_name'),
			input = document.getElementById("input_dialog_input");

		dialogname.textContent = setting.name;
		if (setting.initialValue) {
			input.value = setting.initialValue;
		}

		okbutton.value = setting.okButtonName;
		okbutton.onclick = function (evt) {
			var input = document.getElementById("input_dialog_input");
			if (okCallback) {
				okCallback(input.value);
			}
			input.value = "";
			toggleTextInput();
		};

		toggleTextInput();
	}

	function init_color_input(setting, okCallback) {
		var okbutton = document.getElementById('color_ok_button'),
			dialogname = document.getElementById('color_dialog_name'),
			color_picker = document.getElementById('color_dialog_picker');

		dialogname.textContent = setting.name;

		var colorselector = new ColorSelector(function(colorvalue){
		}, 234, 120); // 幅、高さ
		color_picker.appendChild(colorselector.elementWrapper);
		
		if (setting.initialValue) {
			var col = setting.initialValue.split('rgb(').join("");
			col = col.split(")").join("");
			col = col.split(",");
			colorselector.setColor(col[0], col[1], col[2], 1, true);
		}

		okbutton.value = setting.okButtonName;
		okbutton.onclick = function (evt) {
			var colorvalue = colorselector.getColor(),
				colorstr = "rgb(" + colorvalue[0] + "," + colorvalue[1] + "," + colorvalue[2] + ")";
			if (okCallback) {
				okCallback(colorstr);
			}
			toggleColorInput();
		};

		toggleColorInput();
	}

	window.input_dialog = {}
	window.input_dialog.text_input = init_text_input;
	window.input_dialog.color_input = init_color_input;
}());