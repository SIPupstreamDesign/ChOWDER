'use strict'
const electron = require('electron');
const remote = electron.remote;
const main = remote.require("./main.js");

function createRect (a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  }
}

(function(){

    function setArea(){
        let x = 0;
        let y = 0;
        let cropping = false;
        let downPoint = {};
        let rect = {};
        
        function createRect (a, b) {
            return {
                x: Math.min(a.x, b.x),
                y: Math.min(a.y, b.y),
                width: Math.abs(a.x - b.x),
                height: Math.abs(a.y - b.y)
            }
        }
        // カーソル位置
        let cursorElm = document.getElementsByClassName("cursor");
        
        // カーソル修飾
        let indElm = document.getElementsByClassName("indicator");
        
        // 矩形
        let rectElm = document.getElementsByClassName('rect');
        
        function chngElm(x, y){
            let lx = x.toString(10) + 'px';
            let ly = y.toString(10) + 'px';
            cursorElm[0].style.left = lx;
            cursorElm[0].style.top = ly;
            indElm[0].textContent = lx + '\n' + ly;
        }

        function chngRect(dRect){
            rectElm[0].style.left = dRect.x.toString(10) + 'px'; 
            rectElm[0].style.top = dRect.y.toString(10) + 'px';
            rectElm[0].style.width = dRect.width.toString(10) + 'px';
            rectElm[0].style.height = dRect.height.toString(10) + 'px';
        }

        // マウスイベント全般を管理
        addEventListener('mousemove',function(eve){
            x = eve.clientX;
            y = eve.clientY;
            chngElm(x, y);
            if (!cropping) return;
            rect = createRect(downPoint, {x, y});
            chngRect(rect);
        }, false);

        addEventListener('mouseup', function (eve) {
            cropping = false;
            let sRect = rect;
            rect = {};
            closer(sRect);
        }, false);

        addEventListener('mousedown', function (eve) {
            downPoint.x = eve.clientX;
            downPoint.y = eve.clientY;
            cropping = true;
        }, false);
        

        function closer(sRect){
            main.windowCloser(sRect);
        }
    }

    window.onload = setArea;
    
})();

