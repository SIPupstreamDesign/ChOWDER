'use strict'
//const electron = require('electron');

function createRect (a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  }
}

(function(){

    let x = 0;
    let y = 0;
    let cropping = false;
    let downPoint = {};
    let rect = {};

    function setArea(){
        
        /*
        // 矩形描画
        const rectElm = document.getElementsByClassName('rect');
        rectElm.style.left = this.rect.x; 
        rectElm.style.top = this.rect.y;
        rectElm.style.width = this.rect.width;
        rectElm.style.height = this.rect.height;
        */
        // カーソル位置
        let cursorElm = document.getElementsByClassName("cursor");
        console.log(cursorElm);
        // カーソル修飾
        let indElm = window.document.getElementsByClassName("indicator");
        
        function chngElm(x, y){
            let lx = x.toString(10) + 'px';
            let ly = y.toString(10) + 'px';
            cursorElm[0].style.left = lx;
            cursorElm[0].style.top = ly;
            indElm[0].textContent = lx + '\n' + ly;
        }

        // マウスイベント全般を管理
        addEventListener('mousemove',function(eve){
            x = eve.clientX;
            y = eve.clientY;
            chngElm(x, y);
            if (!this.cropping) return
            eve.rect = createRect(eve.downPoint.x, eve.downPoint.y);
        }, false);

        addEventListener('mouseup', function (eve) {
            this.cropping = false;
            this.rect = {};
        }, false);

        addEventListener('mousedown', function (eve) {
            this.downPoint.x = eve.clientX;
            this.downPoint.y = eve.clientY;
            console.log(this.downPoint.x, this.downPoint.y);
            this.cropping = true;
        }, false);

    }

    window.onload = setArea;
    
})();

