/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

 "use strict";

/**
 * 選択リスト.
 * selectと似ているが複数選択がマウス左クリックのみでできるもの
 */
class SelectList extends EventEmitter {
	constructor() {
		super();
		this.dom = document.createElement('div');
		this.dom.className = "select_list_frame";
		this.selectClassName = 'selectlist_selected';
		this.contents = [];
	}
	add(text, value) {
		let row = document.createElement('div');
		row.innerHTML = text;
		row.value = value;
		row.className = "select_list_content";
		row.onclick = function (index) {
			this.contents[index].classList.toggle(this.selectClassName);
			this.emit(SelectList.EVENT_CHANGE, null, this.contents[index].innerHTML, this.contents[index].classList.contains(this.selectClassName));
		}.bind(this, this.contents.length);
		this.contents.push(row);
		this.dom.appendChild(row);
	}
	clear(){
		this.contents = [];
		while (this.dom.firstChild){
			this.dom.removeChild(this.dom.firstChild)
		};
	}
	getSelected() {
		let selected = [];
		for (let i = 0; i < this.contents.length; i = i + 1) {
			if (this.contents[i].classList.contains(this.selectClassName)) {
				selected.push(this.contents[i].innerHTML);
			}
		}
		return selected;
	}
	getSelectedValues() {
		let selected = [];
		for (let i = 0; i < this.contents.length; i = i + 1) {
			if (this.contents[i].classList.contains(this.selectClassName)) {
				selected.push(this.contents[i].value);
			}
		}
		return selected;
	}
	selectValue(value) {
		for (let i = 0; i < this.contents.length; i = i + 1) {
			if (this.contents[i].value === value) {
				if (!this.contents[i].classList.contains(this.selectClassName)) {
					this.contents[i].classList.toggle(this.selectClassName);
				}
			}
		}
	}
	deselectValue(value) {
		for (let i = 0; i < this.contents.length; i = i + 1) {
			if (this.contents[i].value === value) {
				if (this.contents[i].classList.contains(this.selectClassName)) {
					this.contents[i].classList.toggle(this.selectClassName);
				}
			}
		}
	}
	select(text) {
		for (let i = 0; i < this.contents.length; i = i + 1) {
			if (this.contents[i].innerHTML === text) {
				if (!this.contents[i].classList.contains(this.selectClassName)) {
					this.contents[i].classList.toggle(this.selectClassName);
				}
			}
		}
	}
	deselect(text) {
		for (let i = 0; i < this.contents.length; i = i + 1) {
			if (this.contents[i].innerHTML === text) {
				if (this.contents[i].classList.contains(this.selectClassName)) {
					this.contents[i].classList.toggle(this.selectClassName);
				}
			}
		}
	}
	selectAll() {
		for (let i = 0; i < this.contents.length; i = i + 1) {
			if (!this.contents[i].classList.contains(this.selectClassName)) {
				this.contents[i].classList.add(this.selectClassName);
			}
		}
	}
	deselectAll() {
		for (let i = 0; i < this.contents.length; i = i + 1) {
			this.contents[i].classList.remove(this.selectClassName);
		}
	}
	getValues() {
		let values = [];
		for (let i = 0; i < this.contents.length; i = i + 1) {
			values.push(this.contents[i].value);
		}
		return values;
	}
	getDOM() {
		return this.dom;
	}
}

SelectList.EVENT_CHANGE = "change";

export default SelectList;

