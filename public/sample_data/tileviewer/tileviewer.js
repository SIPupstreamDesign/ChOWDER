class TileViewer {
    constructor(viewerElem) {
        // TileViewerエレメント
        this.viewerElem = viewerElem;

        this.transformElem = document.createElement('div');
        this.transformElem.style.left = "0px";
        this.transformElem.style.top = "0px";
        this.transformElem.style.width = "100%";
        this.transformElem.style.height = "100%";
        this.transformElem.style.overflow = "hidden";
        this._resetOrigin()
        this.viewerElem.appendChild(this.transformElem);

        // 地図定義情報など
        this.options = {};

        // 画像全体を正規化した空間（つまり左上0,0、右下1,1)で
        // 左上　x, y, 及び w, hによる仮想的なカメラを定義する
        // 例えば画像左上4分の1をカメラに収める場合
        // {x:0, y:0, w:0.5, h:0.5)となる
        // DOMの解像度などによらず、任意に設定する。
        this.camera = { x: 0, y: 0, w: 1, h: 1 };
        this.baseScaleCamera = { x: 0, y: 0, w: 1, h: 1 };

        // カメラの表示範囲全体について
        // 左上(0,0), 右下(1,1)としたときの
        // 実際に表示する領域[left, top, right, bottom]
        // この領域外のタイルはカリングされる
        // DOMの解像度などによらず、任意に設定する。
        this.viewport = [0, 0, 1, 1];

        this.currentScaleIndex = 0;

        this.transformScale = 1.0;

        // タイル画像エレメントのclass名に必ず入れるclass
        this.tileImageClass = "___tile___";

        window.addEventListener('resize', () => {
            const rect = this.viewerElem.getBoundingClientRect();
            const rectW = (rect.right - rect.left);
            const rectH = (rect.bottom - rect.top);
            const totalImageSize = this._getTotalImageSize();
            const preW = this.baseScaleCamera.w * totalImageSize.w;
            const preH = this.baseScaleCamera.h * totalImageSize.h;
            const pivotX = (this.camera.x - this.baseScaleCamera.x);
            const pivotY = (this.camera.y - this.baseScaleCamera.y);
            const scale = {
                w: rectW / preW,
                h: rectH / preH
            };
            this.baseScaleCamera.x = (this.baseScaleCamera.x - this.camera.x) * scale.w + this.camera.x;
            this.baseScaleCamera.y = (this.baseScaleCamera.y - this.camera.y) * scale.h + this.camera.y;
            this.baseScaleCamera.w = (this.baseScaleCamera.w - pivotX) * scale.w + pivotX;
            this.baseScaleCamera.h = (this.baseScaleCamera.h - pivotY) * scale.h + pivotY;

            this._updateCameraFromBaseCamera();
            this._update();
        });
    }

    _resetOrigin() {
        this._getRootElem().style.transformOrigin = "0 0";
    }

    _getRootElem() {
        return this.transformElem;
    }

    // scaleIndex0のものと比べたときの、scaleIndexの画像全体の比率
    _getScaleRatio(scaleIndex = this.currentScaleIndex) {
        const zero = this.options.scales[0];
        const s = this.options.scales[scaleIndex];
        return {
            x: (s.width * s.count) / (zero.width * zero.count),
            y: (s.height * s.count) / (zero.height * zero.count),
        }
    }

    // css transformを考慮した全体画像サイズを返す
    _getTotalImageSize() {
        const s = this.options.scales[this.currentScaleIndex];
        const ratio = this._getScaleRatio();
        return {
            w: (s.width * s.count / ratio.x),
            h: (s.height * s.count / ratio.y)
        }
    }

    // 現在の表示対象画像を原寸表示するためのカメラ座標を計算して返す
    // css transformを考慮しない
    // カメラ座標系はscaleIndex 0 の画像の全体サイズを基準に定められる
    _calcActualPixelSizeCamera(cameraSpaceX, cameraSpaceY) {
        const rect = this.viewerElem.getBoundingClientRect();
        const rectW = (rect.right - rect.left);
        const rectH = (rect.bottom - rect.top);
        const totalImageSize = this._getTotalImageSize();
        const camera = {
            x: cameraSpaceX,
            y: cameraSpaceY,
            w: rectW / totalImageSize.w,
            h: rectH / totalImageSize.h
        };
        return camera;
    }

    // カメラ座標系の座標値での、タイル番号などの情報を返す
    // 無効な座標を指定した場合はマイナス値を返す
    // css transformを考慮しない
    // scaleIndexによるズームを考慮する
    _calcTileInfoByCameraSpacePosition(cameraSpaceX, cameraSpaceY) {
        const wh = this._calcTileSizeInCameraSpace();
        const s = this.options.scales[this.currentScaleIndex];
        if ((cameraSpaceX + wh.w) < 0.0 || cameraSpaceX >= 1.0 ||
            (cameraSpaceY + wh.h) < 0.0 || cameraSpaceY >= 1.0) {
            return {
                x: -1,
                y: -1,
                tx: -1,
                ty: -1,
            }
        }
        const ratio = this._getScaleRatio();
        const totalImageW = s.width / ratio.x * s.count;
        const totalImageH = s.height / ratio.y * s.count;
        const rect = this._getRootElem().getBoundingClientRect();
        const rectW = (rect.right - rect.left);
        const rectH = (rect.bottom - rect.top);
        const centerX = rect.left + rectW / 2;
        const centerY = rect.top + rectH / 2;

        let tileInfo = {
            tx: Math.floor(s.count * cameraSpaceX),
            ty: Math.floor(s.count * cameraSpaceY),
            tw: s.width,
            th: s.height
        };
        // タイルの左上のElementSpaceのx, y座標を計算
        // (あるレベルでタイル開始ピクセル位置) - (カメラの左上のピクセル位置)
        // transform scaleがかかる前の座標系でのx, yを計算
        let x = (tileInfo.tx * s.width / ratio.x) - (this.baseScaleCamera.x * totalImageW);
        let y = (tileInfo.ty * s.height / ratio.y) - (this.baseScaleCamera.y * totalImageH);

        tileInfo.x = Math.floor((x - centerX) * this.transformScale + centerX);
        tileInfo.y = Math.floor((y - centerY) * this.transformScale + centerY);
        tileInfo.w = Math.ceil(s.width / ratio.x * this.transformScale);
        tileInfo.h = Math.ceil(s.height / ratio.y * this.transformScale);

        if ((tileInfo.x + tileInfo.w) < (rect.left + rectW * this.viewport[0])) {
            tileInfo.x = -1;
            tileInfo.tx = -1;
        }
        if (tileInfo.x >= (rect.left + rectW * this.viewport[2])) {
            tileInfo.x = -1;
            tileInfo.tx = -1;
        }
        if ((tileInfo.y + tileInfo.h) < (rect.top + rectH * this.viewport[1])) {
            tileInfo.y = -1;
            tileInfo.ty = -1;
        }
        if (tileInfo.y >= (rect.top + rectH * this.viewport[3])) {
            tileInfo.y = -1;
            tileInfo.ty = -1;
        }

        tileInfo.scaleIndex = this.currentScaleIndex;
        return tileInfo;
    }

    // カメラ座標系での現在のスケールのタイル1枚の幅高さを返す
    _calcTileSizeInCameraSpace() {
        const s = this.options.scales[this.currentScaleIndex];
        const ratio = this._getScaleRatio();
        return {
            w: 1.0 / s.count,
            h: 1.0 / s.count,
        };
    }

    // タイルを読み込み、位置や幅高さを設定して返す
    // 既に読み込み済の場合は、読み込み済エレメントに対して位置や幅高さを設定して返す。
    _loadTile(tileInfo) {
        const tileClass = tileInfo.scaleIndex + "_" + tileInfo.tx + "_" + tileInfo.ty;
        if (this._getRootElem().getElementsByClassName(tileClass).length > 0) {
            let elem = this._getRootElem().getElementsByClassName(tileClass)[0];
            elem.style.left = tileInfo.x + "px";
            elem.style.top = tileInfo.y + "px";
            elem.style.width = tileInfo.w + "px";
            elem.style.height = tileInfo.h + "px";
            return elem;
        }
        const tile = new Image();
        tile.classList.add(this.tileImageClass);
        tile.classList.add(tileClass);
        tile.style.pointerEvents = "none"
        tile.style.position = "absolute";
        tile.style.left = tileInfo.x + "px";
        tile.style.top = tileInfo.y + "px";
        tile.style.width = tileInfo.w + "px";
        tile.style.height = tileInfo.h + "px";
        //tile.style.border = "1px solid gray";
        tile.style.boxSizing = "border-box";
        tile.innerText = tileInfo.scaleIndex;
        const s = this.options.scales[this.currentScaleIndex];
        tile.src = this._formatUrl(this.options.foregroundImages[0], tileInfo, s.count, s.zoom);
        this._getRootElem().appendChild(tile);
        return tile;
    }

    _formatUrl(url, tileInfo, count, zoom = null) {
        try {
            url = url.replace(/%x/g, tileInfo.tx.toString());
            url = url.replace(/%y/g, tileInfo.ty.toString());
            url = url.replace(/%w/g, tileInfo.tw.toString());
            url = url.replace(/%h/g, tileInfo.th.toString());
            url = url.replace(/%c/g, count.toString());
            if (zoom !== null) {
                url = url.replace(/%z/g, zoom.toString());
            }
            return url;
        } catch (pError) {
            console.error("TileViewer _formatUrl error: " + pError);
        }
    }

    _removeTileElements() {
        let tiles = this._getRootElem().getElementsByClassName(this.tileImageClass);
        for (let i = tiles.length - 1; i >= 0; --i) {
            this._getRootElem().removeChild(tiles[i]);
        }
    }

    // css transformによるカメラのオフセットを計算
    // 現在のtransformScaleにおいて、カメラ座標系で
    // カメラのx, y, w, hに対して必要なオフセット量を返す
    _calcCameraCSSTransformOffset() {
        const totalImageSize = this._getTotalImageSize();
        const rect = this.viewerElem.getBoundingClientRect();
        const rectW = (rect.right - rect.left);
        const rectH = (rect.bottom - rect.top);
        return {
            x: -(rectW * (this.transformScale - 1.0) / 2.0) / totalImageSize.w,
            y: -(rectH * (this.transformScale - 1.0) / 2.0) / totalImageSize.h,
        };
    }

    _fillTileElements() {
        const camera = this.camera;

        // カメラスペースでの、タイル１枚の幅高さ
        const wh = this._calcTileSizeInCameraSpace();
        // 現在のビューで見えるタイルについて
        // 読み込んだか判定するようの二次元配列を作成
        // 初期値は全てfalse
        let tileMatrix = [];
        for (let y = camera.y; y < (camera.y + camera.h + wh.h); y += wh.h) {
            const tile = this._calcTileInfoByCameraSpacePosition(camera.x, y);
            if (tile.ty >= 0) {
                // (*, y)に対応するタイルが存在する
                let row = [];
                for (let x = camera.x; x < (camera.x + camera.w + wh.w); x += wh.w) {
                    const tile = this._calcTileInfoByCameraSpacePosition(x, y);
                    if (tile.tx >= 0) {
                        // (x, y)に対応するタイルが存在する
                        row.push({
                            x: x,
                            y: y,
                            tile: tile
                        });
                    }
                }
                tileMatrix.push(row);
            }
        }
        const yCount = tileMatrix.length;
        if (yCount <= 0) return [];
        const xCount = tileMatrix[0].length;
        if (xCount <= 0) return [];

        let loadedElems = [];

        // まず真ん中の画像を読み込む
        const pos = {
            x: Math.floor(xCount / 2),
            y: Math.floor(yCount / 2),
        };
        const entry = tileMatrix[pos.y][pos.x];
        if (!entry.isLoaded) {
            loadedElems.push(this._loadTile(entry.tile));
        }

        // 右方向
        for (let x = pos.x + 1; x < xCount; ++x) {
            const entry = tileMatrix[pos.y][x];
            loadedElems.push(this._loadTile(entry.tile));
        }

        // 左方向
        for (let x = pos.x - 1; x >= 0; --x) {
            const entry = tileMatrix[pos.y][x];
            loadedElems.push(this._loadTile(entry.tile));
        }

        // 上方向
        for (let y = pos.y - 1; y >= 0; --y) {
            for (let x = 0; x < xCount; ++x) {
                const entry = tileMatrix[y][x];
                loadedElems.push(this._loadTile(entry.tile));
            }
        }

        // 下方向
        for (let y = pos.y + 1; y < yCount; ++y) {
            for (let x = 0; x < xCount; ++x) {
                const entry = tileMatrix[y][x];
                loadedElems.push(this._loadTile(entry.tile));
            }
        }
        return loadedElems;
    }

    // fillで対象になっていないタイルが残っていたら消す
    _cullTileElements(loadedElems) {
        let tileElements = this._getRootElem().getElementsByClassName(this.tileImageClass);
        for (let i = tileElements.length - 1; i >= 0; --i) {
            if (loadedElems.indexOf(tileElements[i]) < 0) {
                this._getRootElem().removeChild(tileElements[i]);
            }
        }
    }

    _update() {
        this._cullTileElements(this._fillTileElements());
    }

    create(position, callback) {
        this.camera = this._calcActualPixelSizeCamera(0.5, 0.3);
        this.baseScaleCamera = JSON.parse(JSON.stringify(this.camera));

        this._update();
    }

    move(mv, callback) {
        const s = this.options.scales[this.currentScaleIndex];
        const ratio = this._getScaleRatio();
        const totalImageW = (s.width * s.count / ratio.x * this.transformScale);
        const totalImageH = (s.height * s.count / ratio.y * this.transformScale);
        const cameraSpaceMove = {
            x: mv.x / totalImageW,
            y: mv.y / totalImageH
        }
        this.baseScaleCamera.x -= cameraSpaceMove.x;
        this.baseScaleCamera.y -= cameraSpaceMove.y;
        this._updateCameraFromBaseCamera();
        this._update();
    }

    setTransformScale(scale) {
        if (scale <= 0.1) return false;
        const preScale = this.transformScale;
        this.transformScale = scale;

        if (this.currentScaleIndex + 1 < this.options.scales.length) {
            if (scale >= this._getScaleRatio(this.currentScaleIndex + 1).x) {
                // LoDレベルを上げる
                this.currentScaleIndex++;
            }
        }
        if (this.currentScaleIndex > 0) {
            if (scale < this._getScaleRatio(this.currentScaleIndex).x) {
                // LoDレベルを下げる
                this.currentScaleIndex--;
            }
        }

        this._updateCameraFromBaseCamera();

        this._update();
    }

    zoomIn(onlyLevel) {
        if (onlyLevel) {
            this.currentScaleIndex++;
            this._update();
        } else {
            this.setTransformScale(this.transformScale + 0.05 * Math.pow(2, this.currentScaleIndex));
        }
    }

    zoomOut(onlyLevel) {
        if (onlyLevel) {
            if (this.currentScaleIndex > 0) {
                this.currentScaleIndex--;
                this._update();
            }
        } else {
            this.setTransformScale(this.transformScale - 0.05 * Math.pow(2, this.currentScaleIndex));
        }
    }

    _updateCameraFromBaseCamera() {
        const cx = this.baseScaleCamera.x + this.baseScaleCamera.w / 2.0;
        const cy = this.baseScaleCamera.y + this.baseScaleCamera.h / 2.0;
        this.camera.w = this.baseScaleCamera.w / this.transformScale;
        this.camera.h = this.baseScaleCamera.h / this.transformScale;
        this.camera.x = (this.baseScaleCamera.x - cx) / this.transformScale + cx;
        this.camera.y = (this.baseScaleCamera.y - cy) / this.transformScale + cy;
    }

    // [left, top, right, bottom] の形式で
    // Viewportを設定する
    // Viewportは、現在のTileViewerの描画領域全体について
    // 左上(0,0), 右下(1,1)としたときの
    // 実際に表示する領域[left, top, right, bottom].
    // この領域外のタイルはカリングされる
    setViewport(viewport) {
        this.viewport = viewport;
        this._update();
    }

    setOptions(options) {
        this.options = options;
    }

    getOptions() {
        return JSON.parse(JSON.stringify(this.options));
    }
}
window.TileViewer = TileViewer;