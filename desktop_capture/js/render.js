"use strict";
const electron = require('electron');

// モジュールの追加
const desktopCapturer = electron.desktopCapturer;
const remote = electron.remote;

// エレクトロンだと必要ない？
window.navigator.getUserMedia = navigator.getUserMedia       ||
                                navigator.webkitGetUserMedia ||
                                navigator.mozGetUserMedia;

window.URL = window.URL || window.webkitURL;

(function(){
    
    captureInit();

    function captureInit(){
        desktopCapturer.getSources({types: ['window', 'screen']}, function(error, sources) {
            if (error) throw error;
            for (let i = 0; i < sources.length; ++i) {
                console.log("sources["+i+"].name = "+ sources[i].name);
                if(sources[i].name != "Entire screen" && sources[i].name != "electron-capture") {
                    addImage(sources[i].thumbnail);
                }
                // ストリーミング。後ほどアクティブなウィンドウを対象に切り替え。
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

    // canvas2dへ書き出す行程

    onload = function(){
        let capButton = document.getElementById('capture');
        capButton.addEventListener('click',function(eve){
            
            setInterval(function(){
                
                let video = document.getElementById('world');
                let canvas = document.getElementById('canvas');
                let ctx = canvas.getContext("2d");
                ctx.width = 250;
                ctx.height = 250;
                ctx.drawImage(video, 0, 0, 250, 250);
            }, false)
        },)
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


    function getUserMediaError(e) {
        console.log('getUserMediaError');
    }
     
})();