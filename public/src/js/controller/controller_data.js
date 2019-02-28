/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

 "use strict";

function hsv(h, s, v){
	if(s > 1 || v > 1){return;}
	let th = h % 360;
	let i = Math.floor(th / 60);
	let f = th / 60 - i;
	let m = v * (1 - s);
	let n = v * (1 - s * f);
	let k = v * (1 - s * (1 - f));
	let color = new Array();
	if(!s > 0 && !s < 0){
		color.push(v, v, v);
	} else {
		let r = new Array(v, n, m, m, k, v);
		let g = new Array(k, v, v, n, m, m);
		let b = new Array(m, m, k, v, v, n);
		color.push(r[i], g[i], b[i]);
	}
	return color;
}

function generateCursorColor() {
	let i = Math.floor(Math.random() * 14);
	let j, c;
	// hsv は約 7 分割されるような循環
	// 奇数回周目は v を半減させ視認性を上げる
	if(i < 7){
		j = 1.0;
	}else{
		j = 0.5;
	}
	c = hsv(49.21875 * i, 1.0, j);
	if(c){
		c[0] = Math.floor(c[0] * 255);
		c[1] = Math.floor(c[1] * 255);
		c[2] = Math.floor(c[2] * 255);
		return 'rgb(' + (c.join(',')) + ')';
	}
	return 'rgb(255, 255, 255)';
}


/**
 * コントローラの設定データ. コントローラIDごとに固有に持ち, サーバサイドに保存される.
 */
class ControllerData extends EventEmitter {
	constructor() {
		super();
		this.contentSnapType = "free";
		this.displaySnapType = "free";
		this.displayScale = 1;
		this.updateCursorEnable = false; // マウスカーソル送信が有効かどうか
		this.cursorColor = generateCursorColor();
		this.cursorSize = 100;
		this.groupCheck = {}; // グループがチェックされているかどうか. { groupID : true, groupID2 : false }の形式
	}
	set(data) {
		if (data) {
			if (data.hasOwnProperty('contentSnapType')) {
				this.contentSnapType = String(data.contentSnapType);
			}
			if (data.hasOwnProperty('displaySnapType')) {
				this.displaySnapType = String(data.displaySnapType);
			}
			if (data.hasOwnProperty('displayScale')) {
				this.displayScale = parseFloat(data.displayScale);
			}
			if (data.hasOwnProperty('updateCursorEnable')) {
				this.updateCursorEnable = Boolean(data.updateCursorEnable);
			}
			if (data.hasOwnProperty('cursorColor')) {
				this.cursorColor = String(data.cursorColor);
			}
			if (data.hasOwnProperty('cursorSize')) {
				let size = parseInt(data.cursorSize)
				if(isFinite(size)){
					this.cursorSize = size;
				}else{
					console.error("cursorsize expected Number");
				}
			}
			if (data.hasOwnProperty('groupCheck')) {
				for (let i in data.groupCheck) {
					this.groupCheck[i] = Boolean(data.groupCheck[i]);
				}
			}
			if (data.hasOwnProperty('contentSelectedGroup')) {
				this.contentSelectedGroup = String(data.contentSelectedGroup);
			}
			if (data.hasOwnProperty('displaySelectedGroup')) {
				this.displaySelectedGroup = String(data.displaySelectedGroup);
			}
		}
		this.emit('update', null, this.get());
	}
	get() {
		return {
			contentSnapType: this.contentSnapType,
			displaySnapType: this.displaySnapType,
			displayScale: this.displayScale,
			updateCursorEnable: this.updateCursorEnable,
			cursorColor: this.cursorColor,
			cursorSize: this.cursorSize,
			groupCheck: this.groupCheck,
			contentSelectedGroup: this.contentSelectedGroup,
			displaySelectedGroup: this.displaySelectedGroup
		};
	}
	setDisplayScale(scale) {
		this.displayScale = scale;
		this.emit('update', null, this.get());
	}
	getDisplayScale() {
		return this.displayScale;
	}
	setSnapType(isDisplay, type) {
		if (isDisplay) {
			this.displaySnapType = type;
		}
		else {
			this.contentSnapType = type;
		}
		this.emit('update', null, this.get());
	}
	getSnapType(isDisplay) {
		if (isDisplay) {
			return this.displaySnapType;
		}
		else {
			return this.contentSnapType;
		}
	}
	setUpdateCursorEnable(enable) {
		this.updateCursorEnable = enable;
		this.emit('update', null, this.get());
	}
	getUpdateCursorEnable() {
		return this.updateCursorEnable;
	}
	isUpdateCursorEnable() {
		return this.updateCursorEnable;
	}
	setCursorColor(color) {
		this.cursorColor = color;
		this.emit('update', null, this.get());
	}
	getCursorColor() {
		return this.cursorColor;
	}
	setCursorSize(cursorSize) {
		let size = parseInt(cursorSize)
		if(isFinite(size)){
			this.cursorSize = size;
		}else{
			console.error("cursorsize expected Number");
		}
		this.emit('update', null, this.get());
	}
	getCursorSize() {
		return this.cursorSize;
	}
}

ControllerData.EVENT_UPDATE = "update";
export default ControllerData;

