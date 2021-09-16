const HimawariDate = "2019/04/30";
const OptionHimawarJP = {
    backgroundImage: "https://himawari8-dl.nict.go.jp/himawari8/img/D531107/thumbnail/600/" + HimawariDate + "/000000_0_0.png",
    foregroundImages: [
        "https://himawari8-dl.nict.go.jp/himawari8/img/D531107/%cd/%w/" + HimawariDate + "/000000_%x_%y.png",
        "https://himawari8-dl.nict.go.jp/himawari8/img/D531107/%cd/%ws/coastline/ffff00_%x_%y.png",
        //"img/weathermap/%cd/%w/2019-04-30/000000_%x_%y.png"
    ],
    scales: [
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
    ],
    geodeticSystem: "himawari8.jp",
    // 1以外にしてはならない。1以外にするとCSSのleft, topが%で指定されるため、
    // リサイズ時に外側のdivサイズに依存して位置が勝手に動く
    drawingSize: 1
};

const OptionGSI = {
    backgroundImage: "https://cyberjapandata.gsi.go.jp/xyz/std/0/0/0.png",
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

async function scaleUpInSameBounds(optionScales) {
    const tlieviewer = $(document.getElementById('tileviewer'));
    const objBoundsInfo = tlieviewer.k2goTileViewer("getBoundsInfo");
    console.log("objBoundsInfo.leftTop.absolute.scale", objBoundsInfo.leftTop.absolute.scale)
    const scale = objBoundsInfo.leftTop.absolute.scale;
    const preScale = optionScales[scale];
    const postScale = optionScales[scale + 1];
    const wRatio = (postScale.count * postScale.width) / (preScale.count * preScale.width);
    const hRatio = (postScale.count * postScale.height) / (preScale.count * preScale.height);
    const absoluteBounds = {
        bounds: {
            absolute: {
                left: objBoundsInfo.leftTop.absolute.left * wRatio,
                top: objBoundsInfo.leftTop.absolute.top * hRatio,
                right: objBoundsInfo.rightBottom.absolute.left * wRatio,
                bottom: objBoundsInfo.rightBottom.absolute.top * hRatio,
                scale: scale + 1,
            }
        }
    };
    console.log("create", JSON.stringify(absoluteBounds))
    return new Promise(resolve => {
        tlieviewer.k2goTileViewer("create", absoluteBounds, () => {
            resolve("done");
        });
    });
}

window.onload = () => {
    let viewer = new TileViewer(document.getElementById('tileviewer'));
    viewer.setOptions(OptionGSI);
    viewer.create();

    setTimeout(() => {

        injectChOWDER(viewer, document.getElementById('tileviewer'));
    }, 100)

    {
        let button = document.createElement('button');
        button.style.position = "absolute"
        button.style.left = "0px";
        button.style.top = "0px";
        button.style.width = "50px"
        button.style.height = "50px";
        button.innerText = "+"
        document.body.appendChild(button);

        button.onclick = () => {
            viewer.zoomIn();
        }
    }

    {
        let button = document.createElement('button');
        button.style.position = "absolute"
        button.style.left = "50px";
        button.style.top = "0px";
        button.style.width = "50px"
        button.style.height = "50px";
        button.innerText = "-"
        document.body.appendChild(button);

        button.onclick = () => {
            viewer.zoomOut();
        }
    }

    {
        let button = document.createElement('button');
        button.style.position = "absolute"
        button.style.left = "100px";
        button.style.top = "0px";
        button.style.width = "50px"
        button.style.height = "50px";
        button.innerText = "level+"
        document.body.appendChild(button);

        button.onclick = () => {
            viewer.zoomIn(true);
        }
    }

    {
        let button = document.createElement('button');
        button.style.position = "absolute"
        button.style.left = "150px";
        button.style.top = "0px";
        button.style.width = "50px"
        button.style.height = "50px";
        button.innerText = "level-"
        document.body.appendChild(button);

        button.onclick = () => {
            viewer.zoomOut(true);
        }
    }

    {
        let button = document.createElement('button');
        button.style.position = "absolute"
        button.style.left = "200px";
        button.style.top = "0px";
        button.style.width = "50px"
        button.style.height = "50px";
        button.innerText = "viewport"
        document.body.appendChild(button);

        button.onclick = () => {
            viewer.setViewport([0.5, 0, 1, 0.5]);

            let div = document.createElement('div');
            div.style.position = "absolute"
            div.style.left = "50%"
            div.style.width = "50%"
            div.style.height = "50%"
            div.style.border = "2px solid red"
            document.body.appendChild(div);
        }
    }


    let mouse = {
        x: 0,
        y: 0
    }

    let isLeftDown = false;
    let isMiddleDown = false;

    document.onmousedown = (ev) => {
        if (ev.button === 0) {
            isLeftDown = true;
        } else if (ev.button === 1) {
            isMiddleDown = true;
        }
        mouse = {
            x: ev.clientX,
            y: ev.clientY
        }
    };

    document.onmousemove = (ev) => {
        if (isLeftDown) {
            const mv = {
                x: ev.clientX - mouse.x,
                y: ev.clientY - mouse.y
            };
            viewer.move(mv);
            mouse = {
                x: ev.clientX,
                y: ev.clientY
            }
        }
        if (isMiddleDown) {
            if (Math.sign(ev.clientY - mouse.y) < 0) {
                viewer.zoomIn();
            } else {
                viewer.zoomOut();
            }
        }
    };

    document.onmouseup = (ev) => {
        isLeftDown = false;
        isMiddleDown = false;
    };

    /*
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

    // ４隅の緯度経度をもとに、日本中心のGSIの地図にする
    tlieviewer.k2goTileViewer("deleteAllEntity");
    tlieviewer.k2goTileViewer("setOptions", OptionGSI);
    tlieviewer.k2goTileViewer("create", degreesBounds, function() {
        // クリックしたとき同じ見た目でLoDレベルを上げたい
        window.onclick = async() => {
            await scaleUpInSameBounds(OptionGSI.scales);
        };
    });
    */
};