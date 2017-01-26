"use strict";
const electron = require('electron');
let metabinary = require('./js/metabinary.js');
let ws_connector = require('./js/ws_connector.js')

// モジュールの追加
const desktopCapturer = electron.desktopCapturer;
const remote = electron.remote;

// エレクトロンだと必要ない？
window.navigator.getUserMedia = navigator.getUserMedia       ||
                                navigator.webkitGetUserMedia ||
                                navigator.mozGetUserMedia;

window.URL = window.URL || window.webkitURL;

(function(){
    
    initCapturing();

    function initCapturing(){
        desktopCapturer.getSources({types: ['window', 'screen']}, function(error, sources) {
            if (error) throw error;
            for (let i = 0; i < sources.length; ++i) {
                console.log("sources["+i+"].name = "+ sources[i].name);
                console.log(sources);
                if(sources[i].name != "electron-capture") {
                    addImage(sources[i].thumbnail);
                }
                // ストリーミング。後ほどアクティブなウィンドウを対象に切り替えていく。
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

    // canvas2dへイメージとして
    let video = document.getElementById('world');
    let canvas = document.getElementById('canvas');
    let ctx = canvas.getContext("2d");
    
    ctx.width = 640;
    ctx.height = 450;

    let cap = false;
    let capButton = document.getElementById('capture');
    let drawInterval;

    capButton.addEventListener('click',function(eve){
        // フラグがオフであれば
        if(cap === false){
            cap = true;
            capButton.value = "Capture Stop";
            drawInterval = setInterval(drawImage(),2000);
        }
        // フラグがオンであれば
        else if(cap === true){
            cap = false;
            capButton.value = "Capture Start";
            clearInterval(drawInterval);
            ctx.clearRect(0, 0, ctx.width, ctx.height);
        }
    },false);


    function addImage(image) {
        const elm = document.createElement("img");
        elm.className = "sumbnaile";
        elm.src = image.toDataURL();
        elm.value += "</br>" + elm.name;
        document.body.appendChild(elm);
    }

    function drawImage(){     
        ctx.drawImage(video, 0, 0, 960, 540, 0, 0, ctx.width, ctx.height);
    }


    function gotStream(stream) {
        document.querySelector('video').src = URL.createObjectURL(stream);
    }

    function replaceFocus(sources1, sources2){
        let tmpId;
        let tmpName;
        let tmpThumbnail;

        tmpId = sources1.id;
        tmpName = source1.name;
        tmpThumbnail = source1.thumbnail;

        source1.id = source2.id;
        source1.name = source2.name;
        source1.thumbnail = source2.thumbnail;

        source2.id = tmpId;
        source2.name = tmpName;
        source2.thumbnail = tmpThumbnail;
    }

    function getUserMediaError(e) {
        console.log('getUserMediaError');
    }
     
})();