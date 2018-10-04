/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
(function () {
	"use strict";
	/**
	 * 選択リスト.
	 * selectと似ているが複数選択がマウス左クリックのみでできるもの
	 */

	var SelectList = function () {
		EventEmitter.call(this);
		this.dom = document.createElement('div');
		this.dom.className = "select_list_frame";
		this.selectClassName = 'selectlist_selected';
		this.contents = [];
	};
	SelectList.prototype = Object.create(EventEmitter.prototype);

	SelectList.prototype.add = function (text, value) {
		var row = document.createElement('div');
		row.innerHTML = text;
		row.value = value;
		row.className = "select_list_content";
		row.onclick = function (index) {
			this.contents[index].classList.toggle(this.selectClassName);
			this.emit(SelectList.EVENT_CHANGE, null, this.contents[index].innerHTML,
				this.contents[index].classList.contains(this.selectClassName));
		}.bind(this, this.contents.length);
		this.contents.push(row);
		this.dom.appendChild(row);
	};

	SelectList.prototype.getSelected = function () {
		var i;
		var selected = [];
		for (i = 0; i < this.contents.length; i = i + 1) {
			if (this.contents[i].classList.contains(this.selectClassName)) {
				selected.push(this.contents[i].innerHTML);
			}
		}
		return selected;
	};

	SelectList.prototype.getSelectedValues = function () {
		var i;
		var selected = [];
		for (i = 0; i < this.contents.length; i = i + 1) {
			if (this.contents[i].classList.contains(this.selectClassName)) {
				selected.push(this.contents[i].value);
			}
		}
		return selected;
	};

	SelectList.prototype.select = function (text) {
		var i;
		for (i = 0; i < this.contents.length; i = i + 1) {
			if (this.contents[i].innerHTML === text) {
				if (!this.contents[i].classList.contains(this.selectClassName)) {
					this.contents[i].classList.toggle(this.selectClassName);
				}
			}
		}
	};

	SelectList.prototype.deselect = function (text) {
		var i;
		for (i = 0; i < this.contents.length; i = i + 1) {
			if (this.contents[i].innerHTML === text) {
				if (this.contents[i].classList.contains(this.selectClassName)) {
					this.contents[i].classList.toggle(this.selectClassName);
				}
			}
		}
	};

	SelectList.prototype.selectAll = function () {
		var i;
		for (i = 0; i < this.contents.length; i = i + 1) {
			if (!this.contents[i].classList.contains(this.selectClassName)) {
				this.contents[i].classList.add(this.selectClassName);
			}
		}
	};

	SelectList.prototype.deselectAll = function () {
		var i;
		for (i = 0; i < this.contents.length; i = i + 1) {
			this.contents[i].classList.remove(this.selectClassName);
		}
	};

	SelectList.prototype.getDOM = function () {
		return this.dom;
	};

	SelectList.EVENT_CHANGE = "change";
	
	window.SelectList = SelectList;
}());
