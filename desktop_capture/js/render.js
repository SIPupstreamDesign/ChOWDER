"use strict";

// エレクトロン依存のモジュールの追加
const electron = require('electron');
const desktopCapturer = electron.desktopCapturer;
const remote = electron.remote;
const screen = electron.screen;

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
        // キャンバスは非表示
        canvas.style.display = "none";

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
            desktopCapturer.getSources({types: ['window', 'screen'], thumbnailSize:{width:150, height:150}}, 
            function(error, sources) {
                //console.log(sources);
                if (error) throw error;
                for (let i = 0; i < sources.length; ++i) {
                    // electronの画面は除外したい
                    //if(sources[i].name != "electron-capture") {
                        addImage(sources[i].thumbnail);
                        console.log("sources["+i+"].id = "+ sources[i].id);
                        console.log("sources["+i+"].name = "+ sources[i].name);
                    //}
                }
                mainViewer(sources[selected]);
                // キャプチャー情報の保持
                capSource = sources;
                console.log(capSource);
            });
        }
        
        // 範囲選択用イベント-------------------------------------------------------------------
        setArea.addEventListener('click', function(eve){
            let areaFunc = remote.require('./main.js');
            areaFunc.areaSelector();
        }, false);

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

        // キャンバスへ描画-----------------------------------------------------------------------
        function drawCanvas(){
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            console.log(video.videoWidth, video.videoHeight);
            ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            // 送信
            /*
            ws_connector.sendBinary('AddContent', {
                "id" : "captured",         // 特定のID に固定する.
                "content_id" : "captured", // 特定のID に固定する.
                "type" : "image"
            },getImageBinary(canvas), function(){});
            */
        }
        
        
        // キャプチャー対象の切り替え-------------------------------------------------------------
        addEventListener('click', function(eve){
            let id = eve.target.id;
            if(id != 'video' && id != 'setarea' && id ){
                selected = id;
                if (localStream) localStream.getTracks()[0].stop();
                localStream = null;
                //replaceResources(id, selected);
                mainViewer(capSource[selected]);
            }
        }, false);


        // viewer-------------------------------------------------------------------------------
        function mainViewer(source){
            let media;
            console.log(source.id, source.name);
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
                        // idを切り替えることでキャプチャー対象を選ぶことができる
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