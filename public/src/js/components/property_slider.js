class PropertySlider extends EventEmitter {
    /**
     * プロパティ入力用スライダー
     * bootstrapのcssと併用前提でデザインしてある
     * @param {String} leftLabel 左ラベル
     * @param {String} rightLabel 右ラベル
     * @param {String} value 初期入力値
		<div class="input-group">
			<span class="input-group-addon">x</span>
			<input type="text" class="form-control" id="content_transform_x" value="0">
			<span class="input-group-addon">px</span>
		</div>
	*/
    constructor(isEditable, leftLabel, rightLabel, value, scale = 1.0, isInteger = false, minVal = 0.0, maxVal = 1000.0) {
        super();
        this.scale = scale;
        this.isInteger = isInteger;
        this.minVal = minVal;
        this.maxVal = maxVal;
        this.dom = document.createElement('div');

        let group = document.createElement('div');

        let leftSpan = document.createElement('span');
        let rightSpan = document.createElement('span');
        this.input = document.createElement('input');

        this.slider = document.createElement('span')
        this.slider.className = "property_slider_slider";
        if (!isEditable) {
            this.slider.classList.add("disabled");
        }

        this.sliderBack = document.createElement('span')
        this.sliderBack.className = "property_slider_slider_back";

        group.className = "input-group property_slider_group";
        leftSpan.className = "property_slider input-group-addon property_slider_left_span";
        leftSpan.innerHTML = leftLabel;
        rightSpan.className = "property_slider input-group-addon";
        rightSpan.innerHTML = rightLabel;
        this.input.className = "property_slider form-control";
        this.input.disabled = !isEditable;

        group.appendChild(leftSpan);
        group.appendChild(this.sliderBack);
        group.appendChild(this.slider);
        group.appendChild(this.input);

        if (rightLabel) {
            group.appendChild(rightSpan);
        }
        this.dom.appendChild(group);
        this.onChange = (evt) => {
            try {
                let scaledVal = this.clamp(parseFloat(this.input.value), this.minVal, this.maxVal);
                let val = (scaledVal - this.minVal) / scale;
                this.slider.style.width = String(Math.max(0, Math.min(Math.floor(val * 100), 100))) + "px";
                if (!isNaN(val)) {
                    this.emit(PropertySlider.EVENT_CHANGE, null, scaledVal);
                } else {
                    throw false;
                }
            } catch (ex) {
                console.error(ex)
                this.input.value = 1.0;
            }
        };

        this.input.addEventListener('change', this.onChange);

        // 初期値の設定
        this.input.value = value * scale + this.minVal;
        let scaledVal = this.clamp(parseFloat(this.input.value), this.minVal, this.maxVal);
        let val = (scaledVal - this.minVal) / scale;
        this.slider.style.width = String(Math.max(0, Math.min(Math.floor(val * 100), 100))) + "px";
        this.initEvent();
    }

    clamp(val, minVal, maxVal) {
        return Math.max(minVal, Math.min(val, maxVal));
    }

    initEvent() {
        let isMouseDown = false;
        this.slider.onmousedown = (evt) => {
            if (this.slider.classList.contains('disabled')) {
                return;
            }
            isMouseDown = true;
        };
        this.sliderBack.onmousedown = (evt) => {
            isMouseDown = true;
        };
        this.onMouseMove = (evt) => {
            if (isMouseDown) {
                let rect = this.slider.getBoundingClientRect();
                let mouseDownPos = {
                    x: evt.clientX - rect.left,
                    y: evt.clientY - rect.top
                };
                let value = Math.min(1.0, Math.max(0.0, mouseDownPos.x / 100.0));
                value = this.clamp(value.toFixed(2) * this.scale + this.minVal, this.minVal, this.maxVal);
                this.input.value = this.isInteger ? Math.round(value) : value;
                this.onChange();
            }
        };
        this.dom.addEventListener('mousemove', this.onMouseMove, true);
        this.onMouseUp = (evt) => {
            isMouseDown = false;
        };
        window.addEventListener('mouseup', this.onMouseUp);
    }

    getValue() {
        return Number(this.input.value);
    }

    release() {
        if (this.input) {
            this.input.removeEventListener('change', this.onChange)
        }
        this.dom.removeEventListener('mousemove', this.onMouseMove)
        window.removeEventListener('mouseup', this.onMouseUp);
    }

    setEnable(isEnable) {
        if (!isEnable) {
            this.dom.style.pointerEvents = "none";
        } else {
            this.dom.style.pointerEvents = "auto";
        }
    }

    getDOM() {
        return this.dom;
    }
}

PropertySlider.EVENT_CHANGE = "change";
export default PropertySlider;