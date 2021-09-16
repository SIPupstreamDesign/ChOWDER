const HimawariDate = "2019/04/30";
const OptionHimawarJP = {
    //backgroundImage: "https://himawari8-dl.nict.go.jp/himawari8/img/D531107/thumbnail/600/" + HimawariDate + "/000000_0_0.png",
    foregroundImages: [
        "https://himawari8-dl.nict.go.jp/himawari8/img/D531107/%cd/%w/" + HimawariDate + "/000000_%x_%y.png",
        "https://himawari8-dl.nict.go.jp/himawari8/img/D531107/%cd/%ws/coastline/ffff00_%x_%y.png",
        //"img/weathermap/%cd/%w/2019-04-30/000000_%x_%y.png"
    ],
    scales: [
        { width: 600, height: 480, size: 1.0, count: 1 },
        { width: 600, height: 480, size: 1.0, count: 2 },
        { width: 600, height: 480, size: 1.0, count: 4 },
        { width: 600, height: 480, size: 1.0, count: 5 },
        /*
        { width: 600, height: 480, size: 0.5, count: 1 },
        { width: 600, height: 480, size: 0.7, count: 1 },
        { width: 600, height: 480, size: 1.0, count: 1 },
        { width: 600, height: 480, size: 1.4, count: 1 },
        { width: 600, height: 480, size: 1.0, count: 2 },
        { width: 600, height: 480, size: 1.4, count: 2 },
        { width: 600, height: 480, size: 1.0, count: 4 },
        { width: 600, height: 480, size: 1.2, count: 5 },
        { width: 600, height: 480, size: 2.0, count: 5 },
        { width: 600, height: 480, size: 2.8, count: 5 },
        { width: 600, height: 480, size: 4.0, count: 5 }
        */
    ],
    geodeticSystem: "himawari8.jp",
    // 1以外にしてはならない。1以外にするとCSSのleft, topが%で指定されるため、
    // リサイズ時に外側のdivサイズに依存して位置が勝手に動く
    drawingSize: 1
};

const OptionGSI = {
    // backgroundImage: "https://cyberjapandata.gsi.go.jp/xyz/std/0/0/0.png",
    foregroundImages: [
        "https://cyberjapandata.gsi.go.jp/xyz/std/%z/%x/%y.png"
    ],
    scales: [
        { width: 256, height: 256, size: 1.0, count: 32, zoom: 5 },
        { width: 256, height: 256, size: 1.0, count: 64, zoom: 6 },
        { width: 256, height: 256, size: 1.0, count: 128, zoom: 7 },
        { width: 256, height: 256, size: 1.0, count: 256, zoom: 8 },
        { width: 256, height: 256, size: 1.0, count: 512, zoom: 9 },
        { width: 256, height: 256, size: 1.0, count: 1024, zoom: 10 },
        { width: 256, height: 256, size: 1.0, count: 2048, zoom: 11 },
        { width: 256, height: 256, size: 1.0, count: 4096, zoom: 12 },
        { width: 256, height: 256, size: 1.0, count: 8192, zoom: 13 },
        { width: 256, height: 256, size: 1.0, count: 16384, zoom: 14 },
        { width: 256, height: 256, size: 1.0, count: 32768, zoom: 15 },
        { width: 256, height: 256, size: 1.0, count: 65536, zoom: 16 },
        { width: 256, height: 256, size: 1.0, count: 131072, zoom: 17 },
        { width: 256, height: 256, size: 1.0, count: 262144, zoom: 18 },
    ],
    geodeticSystem: "standard",
    // 1以外にしてはならない。1以外にするとCSSのleft, topが%で指定されるため、
    // リサイズ時に外側のdivサイズに依存して位置が勝手に動く
    drawingSize: 1
};

function createGSIScales(countParLevel) {
    let scales = [];
    for (let i = 5; i < 19; ++i) {
        for (let k = 0; k < countParLevel; ++k) {
            scales.push({
                width: 256,
                height: 256,
                count: Math.pow(2, i),
                zoom: i,
                size: 1.0 + k / countParLevel
            });
        }
    }
    return scales;
}

async function scaleInSameBounds(mx, my, mscale) {
    const tlieviewer = $(document.getElementById('tileviewer'));
    const objBoundsInfo = tlieviewer.k2goTileViewer("getBoundsInfo");
    const scale = objBoundsInfo.leftTop.absolute.scale;

    const absoluteBounds = {
        bounds: {
            absolute: {
                left: objBoundsInfo.leftTop.absolute.left - mx,
                top: objBoundsInfo.leftTop.absolute.top - my,
                right: objBoundsInfo.rightBottom.absolute.left - mx,
                bottom: objBoundsInfo.rightBottom.absolute.top - my,
                scale: scale + mscale,
                fixedScale: scale + mscale,
            }
        }
    };
    return new Promise(resolve => {
        tlieviewer.k2goTileViewer("create", absoluteBounds, () => {
            resolve("done");
        });
    });
}

async function fixedZoom(scale) {
    const tlieviewer = $(document.getElementById('tileviewer'));
    return new Promise(resolve => {
        tlieviewer.k2goTileViewer("fixedZoom", scale, (isScaleReset) => {
            resolve(isScaleReset);
        });
    });
}

window.onload = () => {
    //OptionGSI.scales = createScales(128);
    const tlieviewer = $(document.getElementById('tileviewer'));

    // 初回のみ直接引数に入れて各種optionのプロパティを生やす必要があるようだ
    // 日本中心にするためにあえて先にhimawariを入れて位置を取得している
    tlieviewer.k2goTileViewer(OptionHimawarJP);
    tlieviewer.k2goTileViewer("create");

    // ４隅の緯度経度を取得しておく
    let objBoundsInfo = tlieviewer.k2goTileViewer("getBoundsInfo");
    const degreesBounds = {
        bounds: {
            degrees: {
                left: objBoundsInfo.leftTop.degrees.left,
                top: objBoundsInfo.leftTop.degrees.top,
                right: objBoundsInfo.rightBottom.degrees.left,
                bottom: objBoundsInfo.rightBottom.degrees.top
            }
        }
    };
    //document.getElementById('tileviewer').style.pointerEvents = "none"

    let scale = 1.0;
    let isScaling = false;
    let isMoving = false;
    let mousePos = {}
    window.onmouseup = async(ev) => {
        isScaling = false;
        isMoving = false;
    };
    let isDoing = false;
    window.onmousemove = async(ev) => {
        if (isDoing) return;
        if (isScaling) {
            mv = {
                x: mousePos.x - ev.pageX,
                y: mousePos.y - ev.pageY
            }
            const distance = Math.sqrt(mv.x * mv.x + mv.y * mv.y);
            scale += distance / 1000.0 * Math.sign(mv.y);
            if (scale > 0.1) {
                isDoing = true;
                const isScaleReset = await fixedZoom(scale);
                isDoing = false;
            } else {
                scale = 0.1;
            }
        }
    };
    window.onmousedown = async(ev) => {
        if (ev.button === 0) {
            isMoving = true;
            mousePos = {
                x: ev.pageX,
                y: ev.pageY
            };
        }
        if (ev.button === 1) {

            isScaling = true;
            mousePos = {
                x: ev.pageX,
                y: ev.pageY
            };
        }
    };

    // ４隅の緯度経度をもとに、日本中心のGSIの地図にする
    tlieviewer.k2goTileViewer("deleteAllEntity");
    tlieviewer.k2goTileViewer("setOptions", OptionGSI);
    tlieviewer.k2goTileViewer("create", degreesBounds, function() {

        //injectChOWDER(document.getElementById('tileviewer'))
        // クリックしたとき同じ見た目でLoDレベルを上げたい
        /*
        window.onmousedown = async(ev) => {
            await scaleInSameBounds(0, 0, ev.button === 0 ? +1 : -1);
        };
        */
    });
};