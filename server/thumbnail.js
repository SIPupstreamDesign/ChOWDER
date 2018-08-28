

var sharp = require('sharp');

var ThumbnailW = 200;
var ThumbnailH = 150;

var PreviewWH = 1920;

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
    if (w <= PreviewWH && h <= PreviewWH) {
        // not need thumbnail
        callback(null, null);
        return;
    }

    var aspect = w / h;
    if (w > h) {
        w = Math.min(PreviewWH, w);
        h = w / aspect;
    } else {
        h = Math.min(PreviewWH, h);
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

module.exports = {
    createThumbnail : createThumbnail,
    createPreview : createPreview,
    create : create
}