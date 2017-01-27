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
        
        // 初期動作--------------------------------------------------------------------------------
        initCapturing();
        //ws_connector.connect();
        
        // 初期化----------------------------------------------------------------------------------
        let video = document.getElementById('world');
        let canvas = document.getElementById('canvas');
        let ctx = canvas.getContext("2d");

        ctx.width = 800;
        ctx.height = 600;

        let cap = false;
        let defCap = true;
        let capButton = document.getElementById('capture');
        let drawInterval;
        
        // キャプチャー対象周り-----------------------------------------------------------------    
        function initCapturing(){
            desktopCapturer.getSources({types: ['window', 'screen']}, function(error, sources) {
                //console.log(sources);
                if (error) throw error;
                for (let i = 0; i < sources.length; ++i) {
                    //console.log("sources["+i+"].name = "+ sources[i].name);
                    if(sources[i].name != "electron-capture") {
                        addImage(sources[i].thumbnail);
                    }
                    // ストリーミング。後ほど非同期にウィンドウの切り替えを実装
                    //addEventListener('onclick',viewer,false);
                    viewer(sources[0]);
                    //return
                }
            });
        }

        function refresh(){

        }

        // canvas2dへイメージとして送る-----------------------------------------------------------------
        capButton.addEventListener('click',function(eve){
            // フラグがオフであれば
            if(cap === false){
                cap = true;
                capButton.value = "Capture Stop";
                drawInterval = setInterval(drawCanvas,1000);
            }
            // フラグがオンであれば
            else if(cap === true){
                cap = false;
                capButton.value = "Capture Start";
                clearInterval(drawInterval);
            }
        },false);

        addEventListener('click',function(eve){

        }, false);

        // sourcesに関する関数--------------------------------------------------------------------
        // bodyへのhtmlタグ埋め込み
        function addImage(image) {
            const elm = document.createElement("img");
            elm.className = "sumbnaile";
            elm.src = image.toDataURL();
            document.body.appendChild(elm);
        }


        // キャンバスへ描画
        function drawCanvas(){
            ctx.drawImage(video, 0, 0, video.width, video.height, 0, 0, canvas.width, canvas.height);
            console.log(video.width);
            console.log(video.height);
            /* 送信
            ws_connector.sendBinary('AddContent', {
                "id" : sources[i].id, // 特定のID に固定する.
                "content_id" : "captured", // 特定のID に固定する.
                "type" : "image"
                },getImageBinary(canvas));
            */
        }
        
        function viewer(source){
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
                        chromeMediaSourceId: source.id,
                        minWidth: 800,
                        maxWidth: 800,
                        minHeight: 450,
                        maxHeight: 450
                    }
                }
            }, gotStream, getUserMediaError);
        }

        // デスクトップ情報の取得が成功したとき
        function gotStream(stream) {

            document.querySelector('video').src = URL.createObjectURL(stream);
        }

        // デスクトップ情報の取得に失敗したとき
        function getUserMediaError(e) {
            console.log('getUserMediaError');
        }

        // キャプチャーデータの入れ替え（未検証）
        function replaceSources(sources1, sources2){
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