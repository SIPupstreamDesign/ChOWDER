/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import ColorSelector from './colorselector.js';
import PopupBackground from './popup_background.js';

'use strict';

class RemoteCursorColorPicker extends EventEmitter {
    constructor() {
        super();

        this.dom = document.createElement('div');
        this.dom.style.display = "none";
        this.dom.className = "forcolorpicker";
        this.dom.innerHTML =`
        <h4 style="color:white">Remote Cursor Color Setting</h4>
        <input type="button" class="btn  btn-primary cursor_color_ok" value="OK" />
        <input type="button" class="btn  btn-primary cursor_color_cancel" value="Cancel" />
        `
    }

    show(cursorColor) {
		let background = new PopupBackground(0.5);
		let pickerDOM = this.dom;
		let colorselector = new ColorSelector(function (colorvalue) {
		}, 234, 120); // 幅、高さ

		colorselector.setColorStr(cursorColor);

		background.on('close', ((colorselector, pickerDOM) => {
            return () => {
                pickerDOM.removeChild(colorselector.elementWrapper);
                pickerDOM.style.display = "none";
                this.emit(RemoteCursorColorPicker.EVENT_CLOSE, null);
            }
		})(colorselector, pickerDOM));

		let ok = pickerDOM.getElementsByClassName('cursor_color_ok')[0];
		let cancel = pickerDOM.getElementsByClassName('cursor_color_cancel')[0];
		cancel.onclick = () => {
			background.close();
			if (colorselector.elementWrapper.parentNode) {
				colorselector.elementWrapper.parentNode.removeChild(colorselector.elementWrapper);
			}
            pickerDOM.style.display = "none";
            
            this.emit(RemoteCursorColorPicker.EVENT_CANCEL, null);
		};
		ok.onclick = () => {
			let colorvalue = colorselector.getColor();
            let colorstr = "rgb(" + colorvalue[0] + "," + colorvalue[1] + "," + colorvalue[2] + ")";
            this.emit(RemoteCursorColorPicker.EVENT_OK, null, colorstr);
			cancel.click();
		}
		ok.ontouchend = ok.click;
		cancel.ontouchend = cancel.click;
		
		pickerDOM.style.borderRadius = "10px";
		pickerDOM.style.background = "rgb(83, 83, 83)";
		pickerDOM.appendChild(colorselector.elementWrapper);
		pickerDOM.style.display = "inline";
		background.show();
    }

    getDOM() {
        return this.dom;
    }
}

RemoteCursorColorPicker.EVENT_OK = "ok";
RemoteCursorColorPicker.EVENT_CLOSE = "close";
RemoteCursorColorPicker.EVENT_CANCEL = "cancel";

export default RemoteCursorColorPicker;