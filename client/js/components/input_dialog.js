/*jslint devel:true*/
(function () {
	"use strict";
	/**
	 * １行の入力ダイアログを表示
	 * @param setting.name ダイアログタイトル
	 * @param setting.initialValue 初期値
	 * @param setting.okButtonName OKボタン表示名
	 * @param setting.opacity  背景のopacity
	 * @param setting.zIndex 背景のzIndex
	 * @param setting.backgroundColor 背景色
	 */
	function init_text_input(setting, okCallback) {
		var input_dialog,
			input_dialog_name,
			input_dialog_input,
			okbutton,
			background = new PopupBackground(),
			closeFunc;

		/*
		<div class="input_dialog">
			<p style="margin-top:20px;margin-left:20px" class="input_dialog_name"></p>
			<input type="text" class="input_dialog_input" style="margin-left:20px"/>
			<input class="btn input_ok_button" type="button" value="OK" />
		</div>
		*/
		input_dialog = document.createElement('div');
		input_dialog.className = "input_dialog";
		if (setting.backgroundColor) {
			input_dialog.style.backgroundColor = setting.backgroundColor;
		}

		input_dialog_name = document.createElement('p');
		input_dialog_name.style.marginTop = "20px";
		input_dialog_name.style.marginLeft = "20px";
		input_dialog_name.className = "input_dialog_name";
		input_dialog.appendChild(input_dialog_name);

		input_dialog_input = document.createElement("input");
		input_dialog_input.type = "text";
		input_dialog_input.className = "input_dialog_input";
		input_dialog_input.style.marginLeft = "20px";
		input_dialog.appendChild(input_dialog_input);

		okbutton = document.createElement("input");
		okbutton.type = "button";
		okbutton.value = "OK";
		okbutton.className = "btn input_ok_button";
		input_dialog.appendChild(okbutton);
		document.body.appendChild(input_dialog);

		input_dialog_name.textContent = setting.name;
		if (setting.initialValue) {
			input_dialog_input.value = setting.initialValue;
		}

		closeFunc = (function (input_dialog) {
			return function () {
				document.body.removeChild(input_dialog);
			};
		}(input_dialog));

		okbutton.value = setting.okButtonName;
		okbutton.onclick = function (evt) {
			if (okCallback) {
				okCallback(input_dialog_input.value);
			}
			background.close();
			closeFunc();
		};
		background.show(setting.opacity, setting.zIndex);
		background.on('close', closeFunc);
	}

	/**
	 * 複数行の入力ダイアログを表示
	 * @param setting.name ダイアログタイトル
	 * @param setting.initialValue 初期値
	 * @param setting.okButtonName OKボタン表示名
	 * @param setting.opacity  背景のopacity
	 * @param setting.zIndex 背景のzIndex
	 * @param setting.backgroundColor 背景色
	 */
	function init_multi_text_input(setting, callback) {
		var text_input_dialog,
			dialog_label,
			textarea,
			ok_button,
			background = new PopupBackground(),
			closeFunc;
		/*
		<div id="text_input_dialog">
			<p style="margin-top:20px;margin-left:20px">テキストの追加</p>
			<textarea  id="text_input" style="margin-left:20px"></textarea>
			<input class="btn" type="button" value="Send" id="text_send_button" />
		</div>
		*/
		text_input_dialog = document.createElement('div');
		text_input_dialog.className = "text_input_dialog";
		if (setting.backgroundColor) {
			text_input_dialog.style.backgroundColor = setting.backgroundColor;
		}

		dialog_label = document.createElement('p');
		dialog_label.style.marginTop = "20px";
		dialog_label.style.marginLeft = "20px";
		text_input_dialog.appendChild(dialog_label);

		textarea = document.createElement('textarea');
		textarea.style.marginLeft = "20px";
		textarea.className = "text_input";
		text_input_dialog.appendChild(textarea);

		ok_button = document.createElement("input");
		ok_button.type = "button";
		ok_button.value = "Send";
		ok_button.className = "btn text_send_button";
		text_input_dialog.appendChild(ok_button);
		document.body.appendChild(text_input_dialog);

		dialog_label.textContent = setting.name;
		if (setting.initialValue) {
			textarea.value = setting.initialValue;
		}

		closeFunc = (function (text_input_dialog) {
			return function () {
				document.body.removeChild(text_input_dialog);
			};
		}(text_input_dialog));

		ok_button.value = setting.okButtonName;
		ok_button.onclick = function (evt) {
			if (callback) { 
				var width = (textarea.clientWidth + 1);
				var height = (textarea.clientHeight + 1);
				callback(textarea.value, width, height);
			}
			background.close();
			closeFunc();
		};
		background.show(setting.opacity, setting.zIndex);
		background.on('close', closeFunc);
	}

	/**
	 * 色入力ダイアログを表示
	 * @param setting.name ダイアログタイトル
	 * @param setting.initialValue 初期値
	 * @param setting.okButtonName OKボタン表示名
	 * @param setting.opacity  背景のopacity
	 * @param setting.zIndex 背景のzIndex
	 * @param setting.backgroundColor 背景色
	 */
	function init_color_input(setting, okCallback) {
		var color_dialog,
			dialogname,
			color_picker,
			okbutton,
			background = new PopupBackground(),
			closeFunc;

		/*
		<div class="color_dialog">
			<p style="margin-top:20px;margin-left:20px" class="color_dialog_name"></p>
			<div class="color_dialog_picker"></div>
			<input class="btn color_ok_button" type="button" value="OK" />
		</div>
		*/
		color_dialog = document.createElement('div');
		color_dialog.className = "color_dialog";

		dialogname = document.createElement('p');
		dialogname.style.marginTop = "20px";
		dialogname.style.marginLeft = "20px";
		dialogname.className = "color_dialog_name";
		color_dialog.appendChild(dialogname);

		color_picker = document.createElement('div');
		color_picker.className = "color_dialog_picker";
		color_dialog.appendChild(color_picker);

		okbutton = document.createElement("input");
		okbutton.type = "button";
		okbutton.value = "OK";
		okbutton.className = "btn color_ok_button";
		color_dialog.appendChild(okbutton);
		document.body.appendChild(color_dialog);

		dialogname.textContent = setting.name;

		var colorselector = new ColorSelector(function(colorvalue){}, 234, 120); // 幅、高さ
		color_picker.appendChild(colorselector.elementWrapper);
		if (setting.initialValue) {
			var col = setting.initialValue.split('rgb(').join("");
			col = col.split(")").join("");
			col = col.split(",");
			colorselector.setColor(col[0], col[1], col[2], 1, true);
		}

		closeFunc = (function (color_dialog) {
			return function () {
				document.body.removeChild(color_dialog);
			};
		}(color_dialog));

		okbutton.value = setting.okButtonName;
		okbutton.onclick = function (evt) {
			var colorvalue = colorselector.getColor(),
				colorstr = "rgb(" + colorvalue[0] + "," + colorvalue[1] + "," + colorvalue[2] + ")";
			if (okCallback) {
				okCallback(colorstr);
			}
			background.close();
			closeFunc();
		};

		background.show(setting.opacity, setting.zIndex);
		background.on('close', closeFunc);
	}

	/**
	 * OK Cancel ダイアログを表示
	 * @param setting.name ダイアログタイトル
	 * @param setting.opacity  背景のopacity
	 * @param setting.zIndex 背景のzIndex
	 * @param setting.backgroundColor 背景色
	 */
	function okcancel_input(setting, callback) {
		var dialog,
			ok_button,
			cancel_button,
			dialog_div,
			background = new PopupBackground(),
			closeFunc;

		/*
		<div class="okcancel_dialog">
			<p style="margin-top:20px;margin-left:20px" class="okcancel_dialog_name"></p>
			<input class="btn okcancel_dialog_ok_button" type="button" value="OK"  />
			<input class="btn okcancel_dialog_cancel_button" type="button" value="Cancel"  />
		</div>
		*/
		dialog_div = document.createElement('div');
		dialog_div.className = "okcancel_dialog";
		if (setting.backgroundColor) {
			dialog_div.style.backgroundColor = setting.backgroundColor;
		}

		dialog = document.createElement('p');
		dialog.style.marginTop = "20px";
		dialog.style.marginLeft = "20px";
		dialog.className = "okcancel_dialog_name";
		dialog_div.appendChild(dialog);

		ok_button = document.createElement("input");
		ok_button.type = "button";
		ok_button.value = "OK";
		ok_button.className = "btn okcancel_dialog_ok_button";
		dialog_div.appendChild(ok_button);

		cancel_button = document.createElement("input");
		cancel_button.type = "button";
		cancel_button.value = "Cancel";
		cancel_button.className = "btn okcancel_dialog_cancel_button";
		dialog_div.appendChild(cancel_button);
		document.body.appendChild(dialog_div);

		dialog.textContent = setting.name;

		closeFunc = (function (dialog_div) {
			return function () {
				document.body.removeChild(dialog_div);
			};
		}(dialog_div));

		ok_button.onclick = function (evt) {
			if (callback) { callback(true); }
			background.close();
			closeFunc();
		};
		cancel_button.onclick = function (evt) {
			if (callback) { callback(false); }
			background.close();
			closeFunc();
		};

		background.show(setting.opacity, setting.zIndex);
		background.on('close', closeFunc);
	}

	/**
	 * YES NO Cancel ダイアログを表示
	 * @param setting.name ダイアログタイトル
	 * @param setting.yesButtonName
	 * @param setting.noButtonName
	 * @param setting.cancelButtonName
	 * @param setting.opacity  背景のopacity
	 * @param setting.zIndex 背景のzIndex
	 * @param setting.backgroundColor 背景色
	 */
	function yesnocancel_input(setting, callback) {
		var dialog,
			yes_button,
			no_button,
			cancel_button,
			dialog_div,
			background = new PopupBackground(),
			closeFunc;

		/*
		<div class="okcancel_dialog">
			<p style="margin-top:20px;margin-left:20px" class="okcancel_dialog_name"></p>
			<input class="btn okcancel_dialog_yes_button" type="button" value="Yes"  />
			<input class="btn okcancel_dialog_no_button" type="button" value="No"  />
			<input class="btn okcancel_dialog_cancel_button" type="button" value="Cancel"  />
		</div>
		*/
		dialog_div = document.createElement('div');
		dialog_div.className = "okcancel_dialog";
		if (setting.backgroundColor) {
			dialog_div.style.backgroundColor = setting.backgroundColor;
		}

		dialog = document.createElement('p');
		dialog.style.marginTop = "20px";
		dialog.style.marginLeft = "20px";
		dialog.className = "yesnocancel_dialog_name";
		dialog_div.appendChild(dialog);

		yes_button = document.createElement("input");
		yes_button.type = "button";
		yes_button.value = "YES";
		yes_button.className = "btn yesnocancel_dialog_yes_button";
		dialog_div.appendChild(yes_button);
		if (setting.yesButtonName) {
			yes_button.value = setting.yesButtonName;
		}
		
		no_button = document.createElement("input");
		no_button.type = "button";
		no_button.value = "NO";
		no_button.className = "btn yesnocancel_dialog_no_button";
		dialog_div.appendChild(no_button);
		if (setting.noButtonName) {
			no_button.value = setting.noButtonName;
		}

		cancel_button = document.createElement("input");
		cancel_button.type = "button";
		cancel_button.value = "Cancel";
		cancel_button.className = "btn yesnocancel_dialog_cancel_button";
		dialog_div.appendChild(cancel_button);
		if (setting.cancelButtonName) {
			cancel_button.value = setting.cancelButtonName;
		}
		document.body.appendChild(dialog_div);

		dialog.textContent = setting.name;

		closeFunc = (function (dialog_div) {
			return function () {
				document.body.removeChild(dialog_div);
			};
		}(dialog_div));

		yes_button.onclick = function (evt) {
			if (callback) { callback("yes"); }
			background.close();
			closeFunc();
		};
		no_button.onclick = function (evt) {
			if (callback) { callback("no"); }
			background.close();
			closeFunc();
		};
		cancel_button.onclick = function (evt) {
			if (callback) { callback("cancel"); }
			background.close();
			closeFunc();
		};

		background.show(setting.opacity, setting.zIndex);
		background.on('close', closeFunc);
	}

	/**
	 * OK Cancel ダイアログを表示
	 * @param setting.name ダイアログタイトル
	 * @param setting.opacity  背景のopacity
	 * @param setting.zIndex 背景のzIndex
	 * @param setting.backgroundColor 背景色
	 */
	function ok_input(setting, callback) {
		var dialog,
			ok_button,
			dialog_div,
			background = new PopupBackground(),
			closeFunc;

		/*
		<div class="okcancel_dialog">
			<p style="margin-top:20px;margin-left:20px" class="okcancel_dialog_name"></p>
			<input class="btn okcancel_dialog_ok_button" type="button" value="OK"  />
		</div>
		*/
		dialog_div = document.createElement('div');
		dialog_div.className = "okcancel_dialog";
		if (setting.backgroundColor) {
			dialog_div.style.backgroundColor = setting.backgroundColor;
		}

		dialog = document.createElement('p');
		dialog.style.marginTop = "20px";
		dialog.style.marginLeft = "20px";
		dialog.className = "okcancel_dialog_name";
		dialog_div.appendChild(dialog);

		ok_button = document.createElement("input");
		ok_button.type = "button";
		ok_button.value = "OK";
		ok_button.className = "btn okcancel_dialog_ok_button";
		dialog_div.appendChild(ok_button);
		document.body.appendChild(dialog_div);

		dialog.textContent = setting.name;

		closeFunc = (function (dialog_div) {
			return function () {
				document.body.removeChild(dialog_div);
			};
		}(dialog_div));

		ok_button.onclick = function (evt) {
			if (callback) { callback(true); }
			background.close();
			closeFunc();
		};

		background.show(setting.opacity, setting.zIndex);
		background.on('close', closeFunc);
	}

	window.input_dialog = {}
	window.input_dialog.text_input = init_text_input;
	window.input_dialog.init_multi_text_input = init_multi_text_input;
	window.input_dialog.color_input = init_color_input;
	window.input_dialog.okcancel_input = okcancel_input;
	window.input_dialog.yesnocancel_input = yesnocancel_input;
	window.input_dialog.ok_input = ok_input;
}());