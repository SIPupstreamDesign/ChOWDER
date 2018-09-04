

var sharp = require('sharp');

var ThumbnailW = 200;
var ThumbnailH = 150;

var previewWH = 1920;

function createThumbnail(metaData, inputBuffer, callback) {
    var w = Number(metaData.width);
    var h = Number(metaData.height);
    if (!w || !h) {
        callback("Invalid Image Size", null);
        return;
    }
    if (w <= ThumbnailW && h <= ThumbnailH) {
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
        .jpeg()
        .toBuffer()
        .then( (data) => {
            callback(null, data);
        })
        .catch( (err) => {
            callback(err, null);
        });
}

function createPreview(metaData, inputBuffer, callback) {
    var w = Number(metaData.width);
    var h = Number(metaData.height);
    if (!w || !h) {
        callback("Invalid Image Size", null);
        return;
    }
    if (w <= previewWH && h <= previewWH) {
        // not need thumbnail
        callback(null, null);
        return;
    }

    var aspect = w / h;
    if (w > h) {
        w = Math.min(previewWH, w);
        h = w / aspect;
    } else {
        h = Math.min(previewWH, h);
        w = h * aspect;
    }
    w = Math.floor(w);
    h = Math.floor(h);

    sharp(inputBuffer)
        .resize(w, h)
        .jpeg()
        .toBuffer()
        .then( (data) => {
            callback(null, data);
        })
        .catch( (err) => {
            callback(err, null);
        });
}

/**
 * preview画像, thumbnail画像を作ってcallbackで返す
 * @result callback = (err, thumbnail, preview)
 */
function create(metaData, inputBuffer, callback) {
    createThumbnail(metaData, inputBuffer, function (err, thumbnail) {
        if (err) {
            callback(err);
            return;
        }
        if (!thumbnail) {
            callback(err, thumbnail, null);
            return;
        }
        createPreview(metaData, inputBuffer, function (err, preview) {
            callback(err, thumbnail, preview)
            return;
        });
    });
}

function setPreviewWH(wh) {
    previewWH = wh;
}

module.exports = {
    setPreviewWH : setPreviewWH,
    createThumbnail : createThumbnail,
    createPreview : createPreview,
    create : create
}