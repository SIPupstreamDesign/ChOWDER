
(function(global){
    'use strict';
    function ColorSelector(callback, w, h){
        this.elementWrapper = null;         // 全体を包んでいる div
        this.elementCanvas = null;          // 色を表示している canvas
        this.elementCurrentColor = null;    // 現在のカレントな色用の DOM
        this.elementHoverColor = null;      // ホバー中の色用の DOM
        this.elementColorString = null;     // ホバー中の色の 16 進数表記文字用の DOM
        this.canvasContext = null;          // canvas 2d context
        this.canvasImageData = null;        // imageData
        this.canvasWidth = w || 256;        // width
        this.canvasHeight = h || 128;       // height
        this.currentColor = [0, 0, 0, 1.0]; // カレントの色
        this.hoverColor = [0, 0, 0, 1.0];   // ホバー中の色
        this.setColorCallback = null;       // 色選択時に呼ばれるコールバック
        if(callback){this.setColorCallback = callback;}
        this.generate();
    }
    ColorSelector.prototype.click = function(eve){
        var x = parseInt(eve.offsetX, 10);
        var y = parseInt(eve.offsetY, 10);
        var i = y * this.canvasWidth + x;
        var j = i * 4;
        if(!isNaN(x) && !isNaN(y)){
            this.setColor(
                this.canvasImageData.data[j],
                this.canvasImageData.data[j + 1],
                this.canvasImageData.data[j + 2],
                this.canvasImageData.data[j + 3] / 255
            );
        }
    };
    ColorSelector.prototype.move = function(eve){
        var x = parseInt(eve.offsetX, 10);
        var y = parseInt(eve.offsetY, 10);
        var i = y * this.canvasWidth + x;
        var j = i * 4;
        if(!isNaN(x) && !isNaN(y)){
            this.setHoverColor(
                this.canvasImageData.data[j],
                this.canvasImageData.data[j + 1],
                this.canvasImageData.data[j + 2],
                this.canvasImageData.data[j + 3] / 255
            );
        }
    };
    ColorSelector.prototype.convertCSSColor = function(){
        var r = this.zeroPad(this.hoverColor[0].toString(16));
        var g = this.zeroPad(this.hoverColor[1].toString(16));
        var b = this.zeroPad(this.hoverColor[2].toString(16));
        return '#' + r + g + b;
    };
    ColorSelector.prototype.zeroPad = function(v){
        return v.length % 2 ? '0' + v : v;
    };
    ColorSelector.prototype.setColor = function(r, g, b, a, cancel){
        this.currentColor[0] = r;
        this.currentColor[1] = g;
        this.currentColor[2] = b;
        this.currentColor[3] = a;
        this.elementCurrentColor.style.backgroundColor = 'rgba(' + this.currentColor.join(',') + ')';
        if(cancel !== true){this.setColorCallback(this.currentColor.concat());}
    };
    ColorSelector.prototype.setHoverColor = function(r, g, b, a){
        this.hoverColor[0] = r;
        this.hoverColor[1] = g;
        this.hoverColor[2] = b;
        this.hoverColor[3] = a;
        this.elementHoverColor.style.backgroundColor = 'rgba(' + this.hoverColor.join(',') + ')';
        this.elementColorString.textContent = this.convertCSSColor();
    };
    ColorSelector.prototype.getColor = function(){
        var returnValue = this.currentColor.concat();
        return returnValue;
    };
    ColorSelector.prototype.generate = function(){
        var e, f, g, h, i, j, k;
        var gradient;
        e = document.createElement('div');
        e.style.backgroundColor = 'transparent';
        e.style.border = '0px solid silver';
        e.style.margin = '0';
        e.style.padding = '10px';
        e.style.width = (this.canvasWidth + 24) + 'px';
        e.style.position = 'absolute';
        e.style.display = 'flex';
        e.style.flexDirection = 'column';
        f = document.createElement('canvas');
        f.width = this.canvasWidth;
        f.height = this.canvasHeight;
        f.style.display = 'block';
        e.appendChild(f);
        g = document.createElement('div');
        g.style.margin = '5px 0px 0px';
        g.style.padding = '0';
        g.style.width = this.canvasWidth + 'px';
        g.style.height = '20px';
        g.style.display = 'flex';
        g.style.flexDirection = 'row';
        g.style.boxShadow = '0px 0px 0px 1px gray';
        e.appendChild(g);
        i = document.createElement('div');
        i.style.backgroundColor = 'black';
        i.style.margin = '0';
        i.style.padding = '0';
        i.style.width = parseInt(this.canvasWidth / 3, 10) + 'px';
        i.style.height = '20px';
        j = document.createElement('div');
        j.style.backgroundColor = 'black';
        j.style.margin = '0';
        j.style.padding = '0';
        j.style.width = parseInt(this.canvasWidth / 3, 10) + 'px';
        j.style.height = '20px';
        k = document.createElement('div');
        k.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
        k.style.margin = '0';
        k.style.padding = '0';
        k.style.minWidth = '100px';
        // k.style.width = parseInt(this.canvasWidth / 3, 10) + 'px';
        k.style.height = '20px';
        k.style.fontSize = 'smaller';
        k.style.lineHeight = '20px';
        k.style.color = '#444';
        k.style.fontFamily = '"ＭＳ ゴシック", Monaco, Ricty, monospace';
        k.style.textAlign = 'center';
        g.appendChild(j);
        g.appendChild(k);
        g.appendChild(i);

        h = f.getContext('2d');
        this.elementWrapper = e;
        this.elementCanvas = f;
        this.elementCurrentColor = i;
        this.elementHoverColor = j;
        this.elementColorString = k;
        this.canvasContext = h;

        gradient = h.createLinearGradient(0, 0, this.canvasWidth, 0);
        gradient.addColorStop(0.0,  "rgb(255,   0,   0)");
        gradient.addColorStop(0.15, "rgb(255,   0, 255)");
        gradient.addColorStop(0.33, "rgb(  0,   0, 255)");
        gradient.addColorStop(0.49, "rgb(  0, 255, 255)");
        gradient.addColorStop(0.67, "rgb(  0, 255,   0)");
        gradient.addColorStop(0.84, "rgb(255, 255,   0)");
        gradient.addColorStop(1.0,  "rgb(255,   0,   0)");
        h.fillStyle = gradient;
        h.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        gradient = h.createLinearGradient(0, 0, 0, this.canvasHeight);
        gradient.addColorStop(0.0,  "rgba(255, 255, 255, 1.0)");
        gradient.addColorStop(0.01, "rgba(255, 255, 255, 1.0)");
        gradient.addColorStop(0.5,  "rgba(255, 255, 255, 0.0)");
        gradient.addColorStop(0.5,  "rgba(  0,   0,   0, 0.0)");
        gradient.addColorStop(0.99, "rgba(  0,   0,   0, 1.0)");
        gradient.addColorStop(1.0,  "rgba(  0,   0,   0, 1.0)");
        h.fillStyle = gradient;
        h.fillRect(0, 0, h.canvas.width, h.canvas.height);

        this.canvasImageData = h.getImageData(0, 0, this.canvasWidth, this.canvasHeight);

        this.elementCanvas.addEventListener('click', this.click.bind(this), false);
        this.elementCanvas.addEventListener('mousemove', this.move.bind(this), false);

        return e;
    };

    global.ColorSelector = global.ColorSelector || ColorSelector;
})(this);



