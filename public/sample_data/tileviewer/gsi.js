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
    geodeticSystem: "standard"
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
    viewer.setOptions(OptionGSI);
    viewer.create({
        center: {
            relative: {
                left: 0.88,
                top: 35 / 90
            }
        }
    });

    setTimeout(() => {
        injectChOWDER(viewer, document.getElementById('tileviewer'));

        if (window.chowder_view_type === undefined) {
            showDebugGUI(viewer);
        }
    }, 100);

    enableMouseEvents(viewer);
};