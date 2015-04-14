/*jslint devel:true */
/*global $, $ready, $animate, io, fs, URL */
(function () {
	"use strict";

	var animtab = {},
		buttonNum = 0,
		initialOverflow = {},
		isMoving = {};
	
	/**
	 * key, valueを与えると連想配列で返す
	 * @method to_json
	 * @param {Object} key キー
	 * @param {Object} value 値
	 * @return json 連祖配列
	 */
	function to_json(key, value) {
		var json = {};
		json[key] = value;
		return json;
	}
	
	/**
	 * "px"付きの文字列からpxを取り数値文字列として返す.
	 * @method to_num
	 * @param {String} pixelStr px付き文字列
	 * @return CallExpression 数値文字列
	 */
	function to_num(pixelStr) {
		return pixelStr.split('px').join('');
	}
	
	/// initialize dialog and set separator 
	/**
	 * ドラッグ可能なセパレータをセットアップ
	 * @method setupSeparator
	 * @param {String} direction 方向文字列
	 * @param {Element} separator セパレータエレメント
	 * @param {Element} button ボタンエレメント
	 * @param {Array} targets ターゲットリスト
	 * @param {String} whstr 幅高さ文字列
	 */
	function setupSeparator(direction, separator, button, targets, whstr) {
		var dragging = "no", // "no", "ready", "yes"
			buttonID = Object.keys(button)[0],
			targetID = Object.keys(targets)[0],
			buttonElem = document.getElementById(buttonID),
			diffButtonTargetMax = 0,
			id,
			maxValue = 0,
			targetMaxOffset = {},
			target;
		
		diffButtonTargetMax = to_num(button[buttonID].max) - to_num(targets[targetID].max);
		//console.log("diffButtonTargetMax" + diffButtonTargetMax);
		
		// find max value
		for (id in targets) {
			if (targets.hasOwnProperty(id)) {
				target = targets[id];
				if (to_num(target.max) > maxValue) {
					maxValue = to_num(target.max);
				}
			}
		}
		
		// create targetMaxOffset dict
		for (id in targets) {
			if (targets.hasOwnProperty(id)) {
				target = targets[id];
				targetMaxOffset[id] = maxValue - to_num(target.max);
			}
		}
		
		separator.onmousedown = function (e) {
			var target,
				id;
			
			e.preventDefault();
			
			dragging = "ready";
			for (id in targets) {
				if (targets.hasOwnProperty(id)) {
					target = document.getElementById(id);
					target.style.overflow = "hidden";
				}
			}
		};
		
		separator.onmouseover = function (e) {
			//e.preventDefault();
			
			if (direction === 'left') {
				separator.style.cursor = "w-resize";
			} else if (direction === 'right') {
				separator.style.cursor = "e-resize";
			} else if (direction === 'top') {
				separator.style.cursor = "s-resize";
			} else if (direction === 'bottom') {
				separator.style.cursor = "n-resize";
			}
		};
		document.addEventListener('mouseup', function (e) {
			var target,
				id;
			
			e.preventDefault();
			
			dragging = "no";
			for (id in targets) {
				if (targets.hasOwnProperty(id)) {
					target = document.getElementById(id);
					target.style.overflow = initialOverflow[id];
				}
			}
		});
		document.addEventListener('mousemove', function (e) {
			e.preventDefault();
			
			var offset,
				pos,
				i,
				target,
				id;
			if (dragging === "yes") {
				isMoving[separator] = true;
				
				if (direction === 'left') {
					offset = window.pageXOffset || document.documentElement.scrollLeft;
					pos = offset + e.clientX;
				} else if (direction === 'right') {
					offset = window.pageXOffset || document.documentElement.scrollLeft;
					pos = document.documentElement.clientWidth - (offset + e.clientX);
				} else if (direction === 'top') {
					offset = window.pageYOffset || document.documentElement.scrollTop;
					pos = offset + e.clientY;
				} else if (direction === 'bottom') {
					offset = window.pageYOffset || document.documentElement.scrollTop;
					pos = document.documentElement.clientHeight - (offset + e.clientY);
				}
				//console.log(direction + ":" + pos);
				for (id in targets) {
					if (targets.hasOwnProperty(id)) {
						target = document.getElementById(id);
						target.style[whstr] = (pos - targetMaxOffset[id]) + 'px';
						targets[id].max = (pos - targetMaxOffset[id]) + 'px';
					}
				}
				separator.style[direction] = pos + 'px';
				buttonElem.style[direction] = (pos + diffButtonTargetMax) + 'px';
				button[buttonID].max = (pos + diffButtonTargetMax) + 'px';
			}
			if (dragging === "ready") {
				dragging = "yes";
			}
		});
	}
	
	/**
	 * タブの作成
	 * @method create
	 * @param {String} direction 方向文字列
	 * @param {Element} button ボタンエレメント
	 * @param {Array} targets ターゲットリスト
	 * @param {String} textlabel テキストラベル
	 * @param {Function} cbopen オープンコールバック
	 * @param {Function} cbclose クローズコールバック
	 * @return createAnimateButton タブ開閉ファンクション
	 */
	function create(direction, button, targets, textlabel, cbopen, cbclose) {
		var buttonElem = document.createElement("input"),
			separatorElem = document.createElement("span"),
			buttonID = Object.keys(button)[0],
			buttonMin = button[buttonID].min,
			buttonMax = button[buttonID].max,
			whstr,
			json,
			time = 100,
			state = 0,
			targetElem,
			targetMin,
			targetMax,
			minimum = Number.MAX_VALUE,
			maximum = Number.MIN_VALUE,
			temp,
			id,
			isDragging = "no";
		
		/*
		buttonElem.type = "button";
		buttonElem.id = buttonID;
		buttonElem.className = buttonID;
		buttonElem.style.position = "absolute";
		buttonElem.value = beforeLabel;
		*/
		separatorElem.innerHTML = textlabel;
		
		if (direction === 'bottom' || direction === 'top') {
			whstr = 'height';
			//separatorElem.style.width = "100px";
			//separatorElem.style.height = "20px";
		} else if (direction === 'right' || direction === 'left') {
			whstr = 'width';
			//separatorElem.style.width = "20px";
			//separatorElem.style.height = "100px";
		}
		separatorElem.id = buttonID;
		separatorElem.className = buttonID;
		separatorElem.style.position = "absolute";
		
		// add elements
		document.body.appendChild(separatorElem);
		//document.body.appendChild(buttonElem);
		
		for (id in targets) {
			if (targets.hasOwnProperty(id)) {
				targetElem = $(id);
				initialOverflow[id] = targetElem.style.overflow;
				targetMin = targets[id].min;
				targetMax = targets[id].max;
				temp = to_num(targetMin);
				if (temp < minimum) {
					minimum = temp;
				}
				temp = to_num(targetMax);
				//console.log(temp);
				if (temp > maximum) {
					maximum = temp;
				}
			}
		}
		//console.log("maximum:" + maximum);
		separatorElem.style[direction] = maximum + 'px';
		if (buttonMin === 'auto') {
			buttonMin = minimum + 'px';
		}
		if (buttonMax === 'auto') {
			buttonMax = maximum + 'px';
		}
		//console.log("buttonMin:" + buttonMin);
		//console.log("buttonMax:" + buttonMax);
		button[buttonID].min = buttonMin;
		button[buttonID].max = buttonMax;
		
		/**
		 * アニメーション付きで開閉するタブボタンを作る
		 * @method createAnimateButton
		 * @param {Boolean} isOpen trueの場合タブが開く.falseの場合タブが閉じる.
		 */
		function createAnimateButton(isOpen) {
			var i = 0,
				id,
				targetElem,
				targetMin,
				targetMax;
			
			buttonMin = button[buttonID].min;
			buttonMax = button[buttonID].max;
			
			if (state === 0 && isOpen === true) {
				return;
			} else if (state === 2 && isOpen === false) {
				return;
			}
			
			if (isOpen === true) {
				state = 2;
			} else if (isOpen === false) {
				state = 0;
			}
			
			function beforeTarget() {
				state = 2;
			}
			
			function afterTarget() {
				targetElem.style.overflow = initialOverflow[id];
				state = 0;
			}
			
			function beforeButton() {
				//buttonElem.value = afterLabel;
			}
			
			function afterButton() {
				//buttonElem.value = beforeLabel;
			}
			
			function beforeSep() {}

			function afterSep() {}
			
			for (id in targets) {
				if (targets.hasOwnProperty(id)) {
					targetElem = $(id);
					targetElem.style.overflow = "hidden";
					targetMin = targets[id].min;
					targetMax = targets[id].max;
					if (state === 0) {
						if (cbopen) {
							cbopen();
						}
						state = 1;
						$animate(targetElem, to_json(whstr, { from: targetMax, to: targetMin }), time, beforeTarget);
						//$animate(buttonElem, to_json(direction, { from : buttonMax, to : buttonMin }), time, beforeButton);
						$animate(separatorElem, to_json(direction, { from : buttonMax, to : buttonMin }), time, beforeSep);
					} else if (state === 2) {
						state = 3;
						if (cbclose) {
							cbclose();
						}
						$animate(targetElem, to_json(whstr, { from: targetMin, to: targetMax }), time, afterTarget);
						//$animate(buttonElem, to_json(direction, { from : buttonMin, to : buttonMax }), time, afterButton);
						$animate(separatorElem, to_json(direction, { from : buttonMin, to : buttonMax }), time, afterSep);
					}
				}
			}
		}
		
		isMoving[separatorElem] = false;
		setupSeparator(direction, separatorElem, button, targets, whstr);
		
		/**
		 * タブボタンの作成
		 * @method createButton
		 * @param {String} direction 方向文字列
		 * @param {Array} targets ターゲットリスト
		 */
		function createButton(direction, targets) {
			separatorElem.addEventListener('click', function () {
				if (isMoving.hasOwnProperty(separatorElem)) {
					//console.log("isMoving:" + isMoving[separatorElem]);
					if (!isMoving[separatorElem]) {
						createAnimateButton();
					}
					isMoving[separatorElem] = false;
				}
			});
		}
		
		$ready((function (direction, button, targets, textlabel) { return function () {
			createButton(direction, button, targets, textlabel);
		}; }(direction, button, targets, textlabel)));
		
		return createAnimateButton;
	}
	
	window.animtab = animtab;
	window.animtab.create = create;
}());
