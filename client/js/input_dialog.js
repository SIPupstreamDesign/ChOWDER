/*jslint devel:true*/
(function () {
	"use strict";
	var InputDialog;

	/**
	 * Group名入力ダイアログの表示をトグル
	 */
	function init_text_input(setting, okCallback) {
		var okbutton = document.getElementById('input_ok_button'),
			dialogname = document.getElementById('input_dialog_name'),
			input = document.getElementById("input_dialog_input"),
			background = new PopupBackground(),
			inputCover = document.getElementById("input_dialog");

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
			background.close();
			inputCover.style.display = "none";
		};
		
		background.show();
		background.on('close', function () {
			inputCover.style.display = "none";
		});
		inputCover.style.display = "block";
	}

	function init_color_input(setting, okCallback) {
		var okbutton = document.getElementById('color_ok_button'),
			dialogname = document.getElementById('color_dialog_name'),
			color_picker = document.getElementById('color_dialog_picker'),
			background = new PopupBackground(),
			color_dialog = document.getElementById('color_dialog');

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
			background.close();
			color_picker.style.display = "none";
			color_dialog.style.display = "none";
		};

		background.show();
		background.on('close', function () {
			color_picker.style.display = "none";
			color_dialog.style.display = "none";
		});
		color_picker.style.display = "block";
		color_dialog.style.display = "block";
	}

	function okcancel_input(setting, callback) {
		var dialog = document.getElementById('okcancel_dialog_name'),
			ok_button = document.getElementById('okcancel_dialog_ok_button'),
			cancel_button = document.getElementById("okcancel_dialog_cancel_button"),
			input = document.getElementById("okcancel_dialog"),
			background = new PopupBackground();

		dialog.textContent = setting.name;

		ok_button.onclick = function (evt) {
			if (callback) { callback(true); }
			background.close();
			input.style.display = "none";
		};
		cancel_button.onclick = function (evt) {
			if (callback) { callback(false); }
			background.close();
			input.style.display = "none";
		};

		background.show();
		background.on('close', function () {
			input.style.display = "none";
		});
		input.style.display = "block";
	}

	window.input_dialog = {}
	window.input_dialog.text_input = init_text_input;
	window.input_dialog.color_input = init_color_input;
	window.input_dialog.okcancel_input = okcancel_input;
}());