"use strict";

// エレクトロン依存のモジュールの追加
const electron = require('electron');
const desktopCapturer = electron.desktopCapturer;
const remote = electron.remote;
const screen = electron.screen;
const ipc = electron.ipcRenderer;
const main = remote.require('./main.js');

window.URL = window.URL || window.webkitURL;

(function(){

    function init(){
        
        // 初期化------------------------------------------------------------------------------
        let video = document.getElementById('video');
        let localStream;
        let canvas = document.getElementById('canvas');
        let ctx = canvas.getContext("2d");
        let num = document.getElementById('interval');
        
        // キャプチャー情報
        let capSource;
        let browserId = 0;
        
        let vw = screen.getPrimaryDisplay().size.width;
        let vh = screen.getPrimaryDisplay().size.height;

        video.width = 800;
        video.height = 450;

        let cap = false;
        let capButton = document.getElementById('capture');

        let drawInterval;
        let drawTime;
        let selected = 0;
        
        let setArea = document.getElementById('setarea');
        let areaFlag = false;
        let areaX;
        let areaY;

        // 初期動作----------------------------------------------------------------------------
        initCapturing();
        //ws_connector.connect();
        
        // 起動時のキャプチャー-----------------------------------------------------------------    
        function initCapturing(){
            desktopCapturer.getSources({types: ['window', 'screen']}, 
            function(error, sources) {
                if (error) throw error;
                for (let i = 0; i < sources.length; ++i) {
                        addImage(sources[i].thumbnail);
                }
                mainViewer(sources[selected]);
                // キャプチャー情報の保持
                capSource = sources;
            });
        }
        
        // sourcesに関する関数--------------------------------------------------------------------
        // bodyへのサムネイル埋め込み
        function addImage(image) {
            const elm = document.createElement("img");
            elm.id = browserId;
            browserId++;
            elm.className = "sumbnaile";
            elm.src = image.toDataURL();
            document.body.appendChild(elm);
        }

        // 範囲選択用イベント-------------------------------------------------------------------
        setArea.addEventListener('click', function(eve){
            mainViewer(capSource[0]);
            main.areaSelector();
        }, false);
        
        ipc.on('rectData', function(event, data){
            // video を "none"に切り替えてキャンバスを表示する？
            canvas.width = data.width;
            canvas.height = data.height;
            let subX = video.videoWidth - data.width;
            let subY = video.videoHeight - data.height;
            
            video.style.display = "none";
            canvas.style.display = "inline";
            // windowのフレーム(8px)分のずれがある
            ctx.drawImage(video, data.x+8, data.y, 
                        (video.videoWidth - subX), 
                        (video.videoHeight - subY),
                        0, 0, data.width, data.height);
                
        });

        // canvas2dへイメージとして送る---------------------------------------------------------
        // 送信インターバル変更
        num.addEventListener("change",function(eve){
            drawTime = eve.target.value;
        },false);

        // キャプチャーイベント
        capButton.addEventListener('click',function(eve){
            // フラグがオフであれば
            if(cap === false){
                cap = true;
                capButton.value = "Capture Stop";
                drawInterval = setInterval(drawCanvas, drawTime*1000);
            }
            // フラグがオンであれば
            else if(cap === true){
                cap = false;
                capButton.value = "Capture Start";
                clearInterval(drawInterval);
            }
        },false);


        // キャンバスへ描画----------------------------------------------------------------------
        function drawCanvas(){
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            //sendImage(canvas);
        }
        
        function sendImage(getCanvas){
            ws_connector.sendBinary('AddContent', {
                "id" : "captured",         // 特定のID に固定する.
                "content_id" : "captured", // 特定のID に固定する.
                "type" : "image"
            },getImageBinary(getCanvas), function(){});
        }        
        
        // キャプチャー対象の切り替え-------------------------------------------------------------
        addEventListener('click', function(eve){
            if(canvas.style.display === "inline"){
                video.style.display = "inline";
                canvas.style.display = "none";
            }
            let id = eve.target.id;
            if(id != 'video' && id != 'setarea' && id != 'capture' && 
               id != 'interval' && id != 'canvas' && id){
                selected = id;
                if (localStream) localStream.getTracks()[0].stop();
                localStream = null;
                mainViewer(capSource[selected]);
            }
        }, false);

        // viewer-------------------------------------------------------------------------------
        function mainViewer(source){
            let media;
            if (source.name == "Entire screen") {
                media = 'screen';
            }
            else {
                media = 'desktop';
            }
            navigator.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: media,
                        chromeMediaSourceId: source.id, 
                        minWidth: 0,
                        maxWidth: vw,
                        minHeight: 0,
                        maxHeight: vh
                    }
                }
            }, gotStream, getUserMediaError);
        }

        // デスクトップ情報の取得が成功したとき
        function gotStream(stream) {
            localStream = stream;
            document.querySelector('video').src = URL.createObjectURL(localStream);
        }

        // デスクトップ情報の取得に失敗したとき
        function getUserMediaError(e) {
            console.log('getUserMediaError');
        }
        
        // バイナリデータへ変換
        function getImageBinary(canvas) {
            var base64 = canvas.toDataURL('image/png');
            // Base64からバイナリへ変換
            var bin = atob(base64.replace(/^.*,/, ''));
            var array = new ArrayBuffer(bin.length);
            var buffer = new Uint8Array(array);
            for (var i = 0; i < bin.length; i++) {
                buffer[i] = bin.charCodeAt(i);
            }
            // Blobを作成
            return array;
        }
        
    };

    window.onload = init;

    
})();