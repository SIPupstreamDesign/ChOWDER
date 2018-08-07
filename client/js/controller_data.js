(function () {
	"use strict";
    
    /**
     * コントローラの設定データ. コントローラIDごとに固有に持ち, サーバサイドに保存される.
     */
	var ControllerData = function() {
		EventEmitter.call(this);
        this.contentSnapType = "free";
        this.displaySnapType = "free";
		this.displayScale = 1;
		this.updateCursorEnable = false;// マウスカーソル送信が有効かどうか 
		this.cursorColor = 'rgb(255, 255, 255)';
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
        }
        this.emit('update', null, this.get());
    };
    
    ControllerData.prototype.get = function () {
        return {
            contentSnapType : this.contentSnapType,
            displaySnapType : this.displaySnapType,
            displayScale : this.displayScale,
            updateCursorEnable : this.updateCursorEnable,
            cursorColor : this.cursorColor
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
	

    ControllerData.EVENT_UPDATE = "update";
    window.ControllerData = ControllerData;
}());
