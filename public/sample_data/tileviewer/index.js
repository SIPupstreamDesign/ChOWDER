/**
 * Copyright (c) 2021 National Institute of Information and Communications Technology (NICT). All rights reserved.
 */

// 単体デバッグ用GUIを表示
function showDebugGUI(viewer) {
    {
        let button = document.createElement('button');
        button.style.position = "absolute"
        button.style.left = "0px";
        button.style.top = "0px";
        button.style.width = "50px"
        button.style.height = "50px";
        button.style.zIndex = 10;
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
        button.style.zIndex = 10;
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
        button.style.zIndex = 10;
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
        button.style.zIndex = 10;
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
        button.style.zIndex = 10;
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

    {
        let button = document.createElement('button');
        button.style.position = "absolute"
        button.style.left = "250px";
        button.style.top = "0px";
        button.style.width = "50px"
        button.style.height = "50px";
        button.style.zIndex = 10;
        button.innerText = "10/1 9:00"
        document.body.appendChild(button);

        button.onclick = () => {
            viewer.setDate(new Date(2021, 10 - 1, 1, 9, 0, 0, 0));
        }
    }


    {
        let scaleLabel = document.createElement('div');
        scaleLabel.id = "__lod_scale_label__";
        scaleLabel.style.position = "fixed";
        scaleLabel.style.left = "0px";
        scaleLabel.style.bottom = "0px";
        scaleLabel.style.width = "500px";
        scaleLabel.style.height = "20px";
        scaleLabel.style.bottom = "0px";
        scaleLabel.style.zIndex = "1";
        scaleLabel.style.background = "lightgray";
        scaleLabel.style.color = "black";
        scaleLabel.innerHTML = "Zoom Level : " + viewer.getZoomLevel() 
        + " / TransformScale: " + viewer.getCameraInfo().transformScale;
        document.body.appendChild(scaleLabel);
    }

    viewer.addEventListener(TileViewer.EVENT_SCALE_INDEX_CHANGED, (data) => {
        let scaleLabel = document.getElementById('__lod_scale_label__');
        if (scaleLabel) {
            const text = "Zoom Level : " + data
                + " / TransformScale: " + viewer.getCameraInfo().transformScale;
            if (scaleLabel.innerHTML !== text) {
                scaleLabel.innerHTML = text;
            }
        }
    });
    
    viewer.addEventListener(TileViewer.EVENT_POSITION_CHANGED, (data) => {
        let scaleLabel = document.getElementById('__lod_scale_label__');
        if (scaleLabel) {
            const text = "Zoom Level : " + viewer.getZoomLevel() 
                + " / TransformScale: " + viewer.getCameraInfo().transformScale;
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

    let yMovingAverage = [null, null, null];
    let yMovingAverageIndex = 0;

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
        yMovingAverage[0] = mouse.y;
        yMovingAverageIndex = 1;
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
            // 前回のマウス位置と、現在のマウスY座標の差が
            // 3回連続プラスかマイナスになった場合に
            // zoomInまたはzoomOutを行う
            yMovingAverage[yMovingAverageIndex % 3] = Math.sign(ev.clientY - mouse.y);
            ++yMovingAverageIndex;
            if (yMovingAverageIndex > 2) {
                let val = 0;
                for (let i = 0; i < 3; ++i) {
                    val += yMovingAverage[i];
                }
                if (val == -3) {
                    viewer.zoomIn();
                } else if (val === 3) {
                    viewer.zoomOut();
                }
            }
            mouse = {
                x: ev.clientX,
                y: ev.clientY
            }
        }
    };

    document.onmouseup = (ev) => {
        isLeftDown = false;
        isZoomDown = false;
        yMovingAverage = [null, null, null];
        yMovingAverageIndex = 0;
    };

    // ダブルクリックによるズーム
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
    let leftClickPos = false;
    let rightClickPos = false;
    document.getElementById('tileviewer').onmousedown = (ev) => {
        // ダブルクリック
        if (leftClickPos) {
            const distance2 =
                Math.pow(ev.clientX - leftClickPos.x, 2) +
                Math.pow(ev.clientY - leftClickPos.y, 2);
            ev.preventDefault();
            leftClickPos = null;
            if (distance2 < 5) {
                viewer.zoomIn(false, { x: ev.clientX, y: ev.clientY });
            }
            return;
        }
        if (rightClickPos) {
            const distance2 =
                Math.pow(ev.clientX - rightClickPos.x, 2) +
                Math.pow(ev.clientY - rightClickPos.y, 2);
            ev.preventDefault();
            rightClickPos = null;
            if (distance2 < 5) {
                viewer.zoomOut(false, { x: ev.clientX, y: ev.clientY });
            }
            return;
        }
        // シングルクリック
        leftClickPos = (ev.button === 0) ? { x: ev.clientX, y: ev.clientY } : null;
        rightClickPos = (ev.button === 2) ? { x: ev.clientX, y: ev.clientY } : null;
        setTimeout(function() {
            // single click
            leftClickPos = null;
            rightClickPos = null;
        }, 350);
    };

    // ホイールイベント
    let onWheel = (e) => {
        if (!e) e = window.event; //for legacy IE
        let delta = e.deltaY ? -(e.deltaY) : e.wheelDelta ? e.wheelDelta : -(e.detail);
        if (delta < 0) {
            //下にスクロールした場合の処理
            viewer.zoomOut(false, { x: e.clientX, y: e.clientY }, 0.3);
        } else if (delta > 0) {
            //上にスクロールした場合の処理
            viewer.zoomIn(false, { x: e.clientX, y: e.clientY }, 0.3);
        }
    };
    let mousewheelevent = 'onwheel' in document ? 'wheel' : 'onmousewheel' in document ? 'mousewheel' : 'DOMMouseScroll';
    try {
        document.addEventListener(mousewheelevent, onWheel, false);
    } catch (e) {
        document.attachEvent("onmousewheel", onWheel); //for legacy IE
    }
}

window.onload =  () => {
    const viewer = new TileViewer(document.getElementById('tileviewer'));
    
    // jsonパラメータがあれば取得
    const url = new URL(location.href);
    const params = url.searchParams;
    const jsonName = params.get('json');
    if (jsonName) {
        fetch('settings/' + jsonName+'.json')
            .then(response => response.json())
            .then(async data => {
                await viewer.setOptions(data);
                await viewer.create();
                
                if (window.chowder_view_type !== undefined) {
                    injectChOWDER(viewer, document.getElementById('tileviewer'));
                } else {
                    showDebugGUI(viewer);
                }
                enableMouseEvents(viewer);
            });
    }
};
