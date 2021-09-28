const HimawariDate = "2019/04/30";
const OptionHimawarJP = {
    backgroundImage: "https://himawari8-dl.nict.go.jp/himawari8/img/D531107/thumbnail/600/" + HimawariDate + "/000000_0_0.png",
    foregroundImages: [
        "https://himawari8-dl.nict.go.jp/himawari8/img/D531107/%cd/%w/" + HimawariDate + "/000000_%x_%y.png",
        "https://himawari8-dl.nict.go.jp/himawari8/img/D531107/%cd/%ws/coastline/ffff00_%x_%y.png",
        //"img/weathermap/%cd/%w/2019-04-30/000000_%x_%y.png"
    ],
    scales: [
        //{ width: 600, height: 480, size: 0.5, count: 1 },
        //{ width: 600, height: 480, size: 0.7, count: 1 },
        { width: 600, height: 480, size: 1.0, count: 1 },
        //{ width: 600, height: 480, size: 1.4, count: 1 },
        { width: 600, height: 480, size: 1.0, count: 2 },
        //{ width: 600, height: 480, size: 1.4, count: 2 },
        { width: 600, height: 480, size: 1.0, count: 4 },
        { width: 600, height: 480, size: 1.0, count: 5 },
        //{ width: 600, height: 480, size: 1.2, count: 5 },
        //{ width: 600, height: 480, size: 2.0, count: 5 },
        //{ width: 600, height: 480, size: 2.8, count: 5 },
        //{ width: 600, height: 480, size: 4.0, count: 5 }
    ],
    geodeticSystem: "himawari8.jp"
};


// 単体デバッグ用GUIを表示
function showDebugGUI(viewer) {
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
            const preViewport = viewer.getViewport();
            if (preViewport[0] === 0.5) {
                viewer.setViewport([0, 0, 1, 1]);
                document.body.removeChild(document.getElementById('viewport_rect'));
            } else {
                viewer.setViewport([0.5, 0, 1, 0.5]);
                let div = document.createElement('div');
                div.id = "viewport_rect"
                div.style.position = "absolute"
                div.style.left = "50%"
                div.style.width = "50%"
                div.style.height = "50%"
                div.style.border = "2px solid red"
                document.body.appendChild(div);
            }
        }
    }


    /*
    {
        let button = document.createElement('button');
        button.style.position = "absolute"
        button.style.left = "250px";
        button.style.top = "0px";
        button.style.width = "50px"
        button.style.height = "50px";
        button.innerText = "viewinfo"
        document.body.appendChild(button);

        button.onclick = () => {
            console.log(JSON.stringify(viewer.getCameraInfo()));
        }
    }

    {
        let button = document.createElement('button');
        button.style.position = "absolute"
        button.style.left = "300px";
        button.style.top = "0px";
        button.style.width = "50px"
        button.style.height = "50px";
        button.innerText = "resume"
        document.body.appendChild(button);

        button.onclick = () => {
            const viewInfo = { "camera": { "x": 0.87473024661842, "y": 0.3938979334483699, "w": 0.00862426776438951, "h": 0.007568359374999995 }, "baseScaleCamera": { "x": 0.8100482383854987, "y": 0.3371352381358699, "w": 0.13798828423023224, "h": 0.12109375 }, "transformScale": 16.00000000000001, "viewport": { "x": 0.8100482383854987, "y": 0.3371352381358699, "w": 0.13798828423023224, "h": 0.12109375 }, "scaleIndex": 4 }
            viewer.setCameraInfo(viewInfo);
        }
    }
    */

    viewer.addScaleIndexCallback((data) => {
        let scaleLabel = document.getElementById('__lod_scale_label__');
        if (scaleLabel) {
            const text = "Zoom Level : " + data;
            if (scaleLabel.innerHTML !== text) {
                scaleLabel.innerHTML = text;
            }
        }
    });
}

// マウス制御の有効化
function enableMouseEvents(viewer) {
    let mouse = {
        x: 0,
        y: 0
    }

    let isLeftDown = false;
    let isZoomDown = false;

    document.onmousedown = (ev) => {
        if (ev.button === 1 || (ev.ctrlKey == true && ev.button === 0)) {
            isZoomDown = true;
        } else if (ev.button === 0) {
            isLeftDown = true;
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
        if (isZoomDown) {
            if (Math.sign(ev.clientY - mouse.y) < 0) {
                viewer.zoomIn();
            } else {
                viewer.zoomOut();
            }
        }
    };

    document.onmouseup = (ev) => {
        isLeftDown = false;
        isZoomDown = false;
    };

    // ダブルクリックによるズーム
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
    let isLeftClicked = false;
    let isRightClicked = false;
    document.getElementById('tileviewer').onmousedown = (ev) => {
        // ダブルクリック
        if (isLeftClicked) {
            ev.preventDefault();
            isLeftClicked = false;
            viewer.zoomIn(false, { x: ev.clientX, y: ev.clientY });
            return;
        }
        if (isRightClicked) {
            ev.preventDefault();
            isRightClicked = false;
            viewer.zoomOut(false, { x: ev.clientX, y: ev.clientY });
            return;
        }
        // シングルクリック
        isLeftClicked = (ev.button === 0);
        isRightClicked = (ev.button === 2);
        setTimeout(function() {
            // single click
            isLeftClicked = false;
            isRightClicked = false;
        }, 350);
    };
}

window.onload = () => {
    let viewer = new TileViewer(document.getElementById('tileviewer'));
    viewer.setOptions(OptionHimawarJP);
    viewer.create();

    setTimeout(() => {
        injectChOWDER(viewer, document.getElementById('tileviewer'));

        if (window.chowder_view_type === undefined) {
            showDebugGUI(viewer);
        }
    }, 100);

    enableMouseEvents(viewer);
};