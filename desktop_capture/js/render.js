"use strict";

// エレクトロン依存のモジュールの追加
const electron = require('electron');
const desktopCapturer = electron.desktopCapturer;
const remote = electron.remote;

// エレクトロンだと必要ない？
window.navigator.getUserMedia = navigator.getUserMedia       ||
                                navigator.webkitGetUserMedia ||
                                navigator.mozGetUserMedia;

window.URL = window.URL || window.webkitURL;

(function(){

    function init(){
        
        // 初期化------------------------------------------------------------------------------
        let video = document.getElementById('video');
        let canvas = document.getElementById('canvas');
        let ctx = canvas.getContext("2d");
        canvas.style.display = "none";

        let localStream;
        let browserId = 0;

        let vw = 800;
        let vh = 450;
        canvas.width = vw;
        canvas.height = vh;

        let cap = false;
        let defCap = true;
        let capButton = document.getElementById('capture');
        let drawInterval;
        let capSource;
        let selected = 0;
        
        // 初期動作----------------------------------------------------------------------------
        initCapturing();
        //ws_connector.connect();
                
        // 起動時のキャプチャー-----------------------------------------------------------------    
        function initCapturing(){
            desktopCapturer.getSources({types: ['window', 'screen']}, 
            function(error, sources) {
                //console.log(sources);
                if (error) throw error;
                for (let i = 0; i < sources.length; ++i) {
                    // electronの画面は除外
                    if(sources[i].name != "electron-capture") {
                        addImage(sources[i].thumbnail);
                        //console.log("sources["+i+"].id = "+ sources[i].id);
                        //console.log("sources["+i+"].name = "+ sources[i].name);
                    }
                   
                }
                mainViewer(sources[selected]);
                //return
                capSource = sources;
            });
        }



        // canvas2dへイメージとして送る------------------------------------------------------------
        capButton.addEventListener('click',function(eve){
            // フラグがオフであれば
            if(cap === false){
                cap = true;
                capButton.value = "Capture Stop";
                drawInterval = setInterval(drawCanvas,100);
            }
            // フラグがオンであれば
            else if(cap === true){
                cap = false;
                capButton.value = "Capture Start";
                clearInterval(drawInterval);
            }
        },false);

        // キャプチャー対象の切り替え
        addEventListener('click',function(eve){
            let id;
            if(id = eve.target.id){
                console.log(id);
                selected = id;
                console.log(selected);
            }
        }, false);

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


        // キャンバスへ描画
        function drawCanvas(){
            ctx.drawImage(video, 0, 0, video.width, video.height, 
                                 0, 0, canvas.width, canvas.height);
            //console.log(video.width);
            //console.log(video.height);
            /* 送信
            ws_connector.sendBinary('AddContent', {
                "id" : sources[i].id, // 特定のID に固定する.
                "content_id" : "captured", // 特定のID に固定する.
                "type" : "image"
                },getImageBinary(canvas));
            */
        }
        
        function mainViewer(source){
            let media;
            if (source.name == "Entire screen") {
                media = 'desktop';
            }
            else {
                media = 'screen';
            }
            navigator.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: media,
                        // idを切り替えることでキャプチャー対象を選ぶことができる
                        chromeMediaSourceId: source.id, 
                        minWidth: vw,
                        maxWidth: vw,
                        minHeight: vh,
                        maxHeight: vh
                    }
                }
            }, gotStream, getUserMediaError);
        }

        // デスクトップ情報の取得が成功したとき
        function gotStream(stream) {
            localStream = stream;
            document.querySelector('video').src = URL.createObjectURL(stream);
           
        }

        // デスクトップ情報の取得に失敗したとき
        function getUserMediaError(e) {
            console.log('getUserMediaError');
        }

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