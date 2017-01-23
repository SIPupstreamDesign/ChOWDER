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
		this.contents = [];
	};
	SelectList.prototype = Object.create(EventEmitter.prototype);

	SelectList.prototype.add = function (text) {
		var row = document.createElement('div');
		row.innerText = text;
		row.className = "select_list_content";
		row.onclick = function (index) {
			this.contents[index].classList.toggle('selectlist_selected');
		}.bind(this, this.contents.length);
		this.contents.push(row);
		this.dom.appendChild(row);
	};

	SelectList.prototype.getDOM = function () {
		return this.dom;
	};
	
	window.SelectList = SelectList;
}());
