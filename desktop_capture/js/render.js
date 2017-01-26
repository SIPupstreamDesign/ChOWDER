"use strict";
const electron = require('electron');
const app = electron.app;

let desktopCapturer = require('electron').desktopCapturer;
// エレクトロンだと必要ない？
window.navigator.getUserMedia = navigator.getUserMedia       ||
                                navigator.webkitGetUserMedia ||
                                navigator.mozGetUserMedia;

window.URL = window.URL || window.webkitURL;

(window.onload = function(){
    
    let capButton = document.getElementById('capture');
    capButton.addEventListener('onclick', captureImage, false);
    
    

    captureInit();

    function captureInit(){
        desktopCapturer.getSources({types: ['window', 'screen']}, function(error, sources) {
            if (error) throw error;
            for (let i = 0; i < sources.length; ++i) {
                console.log("sources["+i+"].name = "+ sources[i].name);
                if(sources[i].name != "Entire screen" && sources[i].name != "electron-capture") {
                    addImage(sources[i].thumbnail);
                }
                if (sources[i].name == "Entire screen") {
                    navigator.getUserMedia({
                        audio: false,
                        video: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: sources[i].id,
                                minWidth: 960,
                                maxWidth: 960,
                                minHeight: 540,
                                maxHeight: 540
                            }
                        }
                    }, gotStream, getUserMediaError);
                    //return;
                }
            }
        });
    }

    function addImage(image) {
        const elm = document.createElement("img");
        elm.className = "sumbnaile";
        elm.src = image.toDataURL();
        document.body.appendChild(elm);
    }

    function gotStream(stream) {
        document.querySelector('video').src = URL.createObjectURL(stream);
    }

    function captureImage(){
        let video = document.getElementById("video");
        let canvas = document.getElementById('canvas');
        let ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, 260, 260);
    }

    function getUserMediaError(e) {
        console.log('getUserMediaError');
    }
     
})();