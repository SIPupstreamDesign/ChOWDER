

var sharp = require('sharp');

var ThumbnailW = 200;
var ThumbnailH = 150;

function createThumbnail(metaData, inputBuffer, callback) {
    var w = Number(metaData.width);
    var h = Number(metaData.height);
    if (!w || !h) {
        callback("Invalid Image Size", null);
        return;
    }
    if (w <= ThumbnailW || h <= ThumbnailH) {
        // not need thumbnail
        callback(null, null);
        return;
    }
    var aspect = w / h;
    if (w > h) {
        w = Math.min(ThumbnailW, w);
        h = w / aspect;
    } else {
        h = Math.min(ThumbnailH, h);
        w = h * aspect;
    }
    w = Math.floor(w);
    h = Math.floor(h);

    sharp(inputBuffer)
        .resize(w, h)
        .png()
        .toBuffer()
        .then( (data) => {
            callback(null, data);
        })
        .catch( (err) => {
            callback(err, null);
        });
}


module.exports = {
    createThumbnail : createThumbnail
}