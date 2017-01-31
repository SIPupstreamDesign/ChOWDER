'use strict'
const electron = require('electron');
const desktopCapturer = electron.desktopCapturer;

function createRect (a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  }
}

(function(){

    function init(){


    }

    window.onload = init;
    
})();