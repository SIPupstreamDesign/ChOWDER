/**
 * This software was developed by the Tokyo University of Science - Space Education Program (T-SEP), which was funded by the 
 * Aerospace Science and Technology Promotion Program of the Ministry of Education, Culture, Sports, Science, and Technology (MEXT).
 */

(function(){
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

        // 選択可能な領域
        let select_area = document.getElementById("select_area");
        
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
        select_area.onmousemove = function f(eve){
            x = eve.clientX - select_area.getBoundingClientRect().left;
            y = eve.clientY - select_area.getBoundingClientRect().top;
            chngElm(x, y);
            if (!cropping) return;
            rect = createRect(downPoint, {x, y});
            chngRect(rect);
            eve.preventDefault();
        };

        window.onmouseup = function f(eve) {
            cropping = false;
            let sRect = rect;
            rect = {};
            closer(sRect);
        };

        select_area.onmousedown = function f(eve) {
            downPoint.x = eve.clientX - select_area.getBoundingClientRect().left;
            downPoint.y = eve.clientY - select_area.getBoundingClientRect().top;
            cropping = true;
            eve.preventDefault();
        };
        
        function closer(sRect){
            main.windowCloser(sRect);
        }

        
    }
            
    window.onload = setArea;
    
})();