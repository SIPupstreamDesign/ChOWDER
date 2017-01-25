// WebRTC
window.navigator.getUserMedia = navigator.getUserMedia       ||
                                navigator.webkitGetUserMedia ||
                                navigator.mozGetUserMedia;

window.URL = window.URL || window.webkitURL;

(function(){

    // Then web page load ended
    window.addEventListener('load', function(){

        navigator.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sources[n].id,
                }
            }
        }, function(stream){
            let video = document.createElement('video');
            document.body.appendChild(video);
            video.src = window.URL.createObjectURL(stream);
            video.play();
        });

       
    },false);

})();