/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */
(function () {
	"use strict";

    function hsv(h, s, v){
        if(s > 1 || v > 1){return;}
        var th = h % 360;
        var i = Math.floor(th / 60);
        var f = th / 60 - i;
        var m = v * (1 - s);
        var n = v * (1 - s * f);
        var k = v * (1 - s * (1 - f));
        var color = new Array();
        if(!s > 0 && !s < 0){
            color.push(v, v, v);
        } else {
            var r = new Array(v, n, m, m, k, v);
            var g = new Array(k, v, v, n, m, m);
            var b = new Array(m, m, k, v, v, n);
            color.push(r[i], g[i], b[i]);
        }
        return color;
	}
	
	function generateCursorColor() {
		var i = Math.floor(Math.random() * 14);
		var j, c;
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
	var ControllerData = function() {
		EventEmitter.call(this);
        this.contentSnapType = "free";
        this.displaySnapType = "free";
		this.displayScale = 1;
		this.updateCursorEnable = false;// マウスカーソル送信が有効かどうか 
		this.cursorColor = generateCursorColor();
		this.groupCheck = {}; // グループがチェックされているかどうか. { groupID : true, groupID2 : false }の形式
	};
	ControllerData.prototype = Object.create(EventEmitter.prototype);
    
    ControllerData.prototype.set = function (data) {
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
            if (data.hasOwnProperty('groupCheck')) {
				for (var i in data.groupCheck) {
					this.groupCheck[i] = Boolean(data.groupCheck[i])
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
    };
    
    ControllerData.prototype.get = function () {
        return {
            contentSnapType : this.contentSnapType,
            displaySnapType : this.displaySnapType,
            displayScale : this.displayScale,
            updateCursorEnable : this.updateCursorEnable,
			cursorColor : this.cursorColor,
			groupCheck : this.groupCheck,
			contentSelectedGroup : this.contentSelectedGroup,
			displaySelectedGroup : this.displaySelectedGroup
        };
    };

	ControllerData.prototype.setDisplayScale = function (scale) {
		this.displayScale = scale;
        this.emit('update', null, this.get());
	};
	ControllerData.prototype.getDisplayScale = function () {
		console.log("cookie - display_scale:" + this.displayScale);
		return this.displayScale;
	};
	
	ControllerData.prototype.setSnapType = function (isDisplay, type) {
		if (isDisplay) {
			this.displaySnapType = type;
		} else {
			this.contentSnapType = type;
		}
        this.emit('update', null, this.get());
	};
	ControllerData.prototype.getSnapType = function (isDisplay) {
		if (isDisplay) {
			return this.displaySnapType;
		} else {
			return this.contentSnapType;
		}
	};

	ControllerData.prototype.setUpdateCursorEnable = function (enable) {
		this.updateCursorEnable = enable;
        this.emit('update', null, this.get());
	};
	ControllerData.prototype.isUpdateCursorEnable = function () {
		return this.updateCursorEnable;
	};

	ControllerData.prototype.setCursorColor = function (color) {
		this.cursorColor = color;
        this.emit('update', null, this.get());
	};
	
	ControllerData.prototype.getCursorColor = function () {
		return this.cursorColor;
	};

	// ControllerData.prototype.initGroupCheck = function (groupList) {
	// 	var i,
	// 		id,
	// 		groupIDDict = {};
			
	// 	for (i = 0; i < groupList.length; i = i + 1) {
	// 		groupIDDict[groupList[i].id] = true;
	// 	}
	// 	// 存在しないグループがcontrollerDataにあったら消しておく
	// 	for (id in this.groupCheck) {
	// 		if (!groupIDDict.hasOwnProperty(id)) {
	// 			delete this.groupCheck[id];
	// 		}
	// 	}
	// 	// 新規に追加されたグループ分を追加
	// 	for (i = 0; i < groupList.length; i = i + 1) {
	// 		if (!this.groupCheck.hasOwnProperty(groupList[i].id)) {
	// 			this.groupCheck[groupList[i].id] = false;
	// 		}
	// 	}
	// };
	// ControllerData.prototype.setGroupCheck = function (groupID, checked) {
	// 	this.groupCheck[groupID] = checked;
    //     this.emit('update', null, this.get());
	// };
	// ControllerData.prototype.getGroupCheckDict = function () {
	// 	return this.groupCheck;
	// };
	// ControllerData.prototype.isGroupChecked = function (groupID) {
	// 	if (groupID === undefined) return true;
	// 	return this.groupCheck[groupID] === true;
	// };

    ControllerData.EVENT_UPDATE = "update";
    window.ControllerData = ControllerData;
}());
