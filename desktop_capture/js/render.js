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
        // 初期動作
        initCapturing();
        console.log(ws_connector);
        ws_connector.connect();
        
        // デスクトップ取得--------------------------------------------------------------------------------------
    
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

        // canvas2dへイメージとして送る--------------------------------------------------------------------
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
                setInterval(drawCanvas(),2000);
            }
            // フラグがオンであれば
            else if(cap === true){
                cap = false;
                capButton.value = "Capture Start";
                clearInterval(drawInterval);
                ctx.clearRect(0, 0, ctx.width, ctx.height);
            }
        },false);

        // 送受信や描画に関する関数群-----------------------------------------------------------------------
        // bodyへのhtmlタグ埋め込み
        function addImage(image) {
            const elm = document.createElement("img");
            elm.className = "sumbnaile";
            elm.src = image.toDataURL();
            document.body.appendChild(elm);
        }

        // キャンバスへ描画
        function drawCanvas(){     
            ctx.drawImage(video, 0, 0, 960, 540, 0, 0, ctx.width, ctx.height);
            //console.log(canvas.toDataURL("image/jpeg"));
            ws_connector.sendBinary('AddContent', {
                "id" : "videotest", // 特定のID に固定する.
                "content_id" : "videotest", // 特定のID に固定する.
                "type" : "image"
                },getImageBinary(canvas));
        }

        // デスクトップ情報の取得が成功したとき
        function gotStream(stream) {
            document.querySelector('video').src = URL.createObjectURL(stream);
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