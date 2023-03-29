/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.log("not found sharp");
    // console.error(e)
    // do nothing
}

let images;
try {
    images = require('images');
} catch (e) {
    console.log("not found images");
    // console.error(e)
    if (!sharp && !images) {
        throw 'It seems both `images` and `sharp` are failed to be installed, one of these two is required at least';
    }
}

let ThumbnailW = 200;
let ThumbnailH = 150;

let previewWH = 1920;

function createThumbnail(metaData, inputBuffer, callback) {
    let w = Number(metaData.width);
    let h = Number(metaData.height);
    if (!w || !h) {
        callback("Invalid Image Size", null);
        return;
    }
    if (w <= ThumbnailW && h <= ThumbnailH) {
        // not need thumbnail
        callback(null, null);
        return;
    }
    let aspect = w / h;
    if (w > h) {
        w = Math.min(ThumbnailW, w);
        h = w / aspect;
    } else {
        h = Math.min(ThumbnailH, h);
        w = h * aspect;
    }
    w = Math.floor(w);
    h = Math.floor(h);

    if (sharp) {
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
    } else if (images) {
        let data = images(inputBuffer)
            .resize(w, h)
            .encode('jpg');
        callback(null, data);
    }
}

function createPreview(metaData, inputBuffer, callback) {
    let w = Number(metaData.width);
    let h = Number(metaData.height);
    if (!w || !h) {
        callback("Invalid Image Size", null);
        return;
    }
    if (w <= previewWH && h <= previewWH) {
        // not need thumbnail
        callback(null, null);
        return;
    }

    let aspect = w / h;
    if (w > h) {
        w = Math.min(previewWH, w);
        h = w / aspect;
    } else {
        h = Math.min(previewWH, h);
        w = h * aspect;
    }
    w = Math.floor(w);
    h = Math.floor(h);

    if (sharp) {
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
    } else if (images) {
        let data = images(inputBuffer)
            .resize(w, h)
            .encode('jpg');
        callback(null, data);
    }
}

/**
 * preview画像, thumbnail画像を作ってcallbackで返す
 * @result callback = (err, thumbnail, preview)
 */
function create(metaData, inputBuffer, callback) {
    createThumbnail(metaData, inputBuffer, (err, thumbnail)=>{
        if (err) {
            callback(err);
            return;
        }
        if (!thumbnail) {
            callback(err, thumbnail, null);
            return;
        }
        createPreview(metaData, inputBuffer, (err, preview)=>{
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