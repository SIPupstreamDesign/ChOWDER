class TileViewer {
    constructor(viewerElem) {
        // TileViewerエレメント
        this.viewerElem = viewerElem;

        // 後の拡張で必要になる可能性があるので、親の下に1つdivを挟んでおく
        // タイルはこのdiv以下に追加していく
        this.transformElem = document.createElement('div');
        this.transformElem.style.left = "0px";
        this.transformElem.style.top = "0px";
        this.transformElem.style.width = "100%";
        this.transformElem.style.height = "100%";
        this.transformElem.style.overflow = "hidden";
        this.viewerElem.appendChild(this.transformElem);

        this.backgroundImage = new Image();
        this.backgroundImageID = "___tileviewer_background_image___"
        this.backgroundImage.id = this.backgroundImageID;
        this.backgroundImage.style.zIndex = -1;
        this.backgroundImage.style.display = "none";
        this.backgroundImage.style.position = "absolute";
        this.transformElem.appendChild(this.backgroundImage);

        // 地図定義情報
        this.options = {};

        // options内のscaleを合成(Union/和集合)したもの
        this.combinedScales = [];

        // TODO:this.options.mapsに移行予定
        this.layerParams = [];

        // LoDレベル0の画像全体を正規化した空間（左上0,0、右下1,1)を
        // カメラスペースと呼ぶこととする。
        // カメラスペースで、左上　x, y, 及び w, hによる仮想的なカメラを定義する
        // 
        // 例えば画像左上4分の1をカメラに収める場合
        // {x:0, y:0, w:0.5, h:0.5)となる
        // DOMの解像度などによらず、任意に設定する。
        this.baseScaleCamera = { x: 0, y: 0, w: 1, h: 1 };

        // baseScaleCameraから画面中心に対してどれだけスケーリングしたかを表すスケール値
        this.transformScale = 1.0;

        // transformScaleを考慮した実際の表示範囲を表すカメラ。
        // 座標系はbaseScaleCameraと同様のカメラスペース
        this.camera = { x: 0, y: 0, w: 1, h: 1 };

        // this.cameraの表示範囲全体について
        // 左上(0,0), 右下(1,1)としたときの
        // 実際に表示する領域[left, top, right, bottom]。
        // この領域外のタイルはカリングされる
        this.viewport = [0, 0, 1, 1];

        // this.combinedScale似たする現在の使用インデックス
        this.currentScaleIndex = 0;

        // ScaleIndexを固定とする場合trueにする
        this.isFixedScaleIndex = false;

        this.isEnableLimitOfMinimumScale = false;

        // タイル画像エレメントのclass名に必ず入れるclass
        this.tileImageClass = "___tile___";

        // リサイズ時のスケーリングを有効にする
        this._resizeScaling = this._resizeScaling.bind(this);
        this.enableResizeScaling();

        this.callbackDict = {};
    }

    _getRootElem() {
        return this.transformElem;
    }

    // タイル情報からタイル固有のクラス名を作成して返す
    _generateTileClass(tileIndex, tileInfo) {
        return tileIndex + "_" + tileInfo.scaleIndex + "_" + tileInfo.tx + "_" + tileInfo.ty;
    }

    // 現在の実装ではscaleIndex=0以降はscaleIndex=0の全体画像サイズに収まるように
    // 幅高さをスケールして表示される仕組みのため、
    // どのscaleIndexであっても全体画像サイズは必ずmapIndex=0のscaleIndex=0の全体画像サイズと同様となる。
    _getBaseSize() {
        // maps[0].scales[0]を基準とする
        if (this.options.maps.length > 0) {
            let res = {
                width: this.options.maps[0].scales[0].width,
                height: this.options.maps[0].scales[0].height,
                count: 1,
            };
            if (this.options.maps[0].scales[0].hasOwnProperty('zoom')) {
                res.zoom = 0;
            }
            return res;
        }
        return {
            width: 1000,
            height: 1000,
            count: 1,
        }
    }

    // scaleIndex0のものと比べたときの、scaleIndexの画像全体の比率
    _getScaleRatio(mapIndex = null, scaleIndex = this.currentScaleIndex) {
        let zero = this._getBaseSize();
        let s;
        if (mapIndex !== null) {
            s = this.options.maps[mapIndex].scales[scaleIndex];
        } else {
            s = this.combinedScales[scaleIndex];
        }
        return {
            x: (s.width * s.count) / (zero.width * zero.count),
            y: (s.height * s.count) / (zero.height * zero.count),
        }
    }

    // 全体画像サイズ(ピクセル数)を返す.
    // this.transformScaleによるスケールは考慮しない.
    // 
    // 現在の実装ではscaleIndex=0以降はscaleIndex=0の全体画像サイズに収まるように
    // 幅高さをスケールして表示される仕組みのため、
    // どのscaleIndexであっても全体画像サイズは必ずmapIndex=0のscaleIndex=0の全体画像サイズと同様となる。
    _getTotalImageSize() {
        const s = this._getBaseSize();
        return {
            w: (s.width * s.count),
            h: (s.height * s.count)
        }
    }

    // 現在のスケールでのスクリーンでの画像表示サイズを返す
    // this.transformScaleによるスケールを考慮。
    _getScreenImageSize() {
        const s = this.combinedScales[this.currentScaleIndex];
        const ratio = this._getScaleRatio();
        return {
            w: (s.width * s.count / ratio.x * this.transformScale),
            h: (s.height * s.count / ratio.y * this.transformScale)
        }
    }

    // 現在のビューワーのサイズ(幅,高さ)をピクセル単位で返す
    _getViewerSize() {
        const rect = this.viewerElem.getBoundingClientRect();
        return {
            w: rect.right - rect.left,
            h: rect.bottom - rect.top
        };
    }

    // 現在の表示対象画像を原寸表示するためのカメラ座標を計算して返す
    // this.transformScaleによるスケールは考慮しない.
    // カメラ座標系はscaleIndex 0 の画像の全体サイズを基準に定められる
    _calcActualPixelSizeCamera(cameraSpaceX, cameraSpaceY) {
        const viewerSize = this._getViewerSize();
        const totalImageSize = this._getTotalImageSize();
        const camera = {
            x: cameraSpaceX,
            y: cameraSpaceY,
            w: viewerSize.w / totalImageSize.w,
            h: viewerSize.h / totalImageSize.h
        };
        return camera;
    }

    // カメラ座標系の座標値での、タイル番号などの情報を返す。
    // 無効な座標を指定した場合はマイナス値が入ったものを返す。
    // scaleIndex及びthis.transformScaleによるスケールを考慮した座標が設定される。
    _calcTileInfoByCameraSpacePosition(cameraSpaceX, cameraSpaceY, mapIndex, mapScaleIndex) {
        const wh = this._calcTileSizeInCameraSpace(mapIndex, mapScaleIndex);
        let s = this.options.maps[mapIndex].scales[mapScaleIndex];
        if (cameraSpaceX >= 1.0 || cameraSpaceY >= 1.0) {
            return {
                x: -1,
                y: -1,
                tx: -1,
                ty: -1,
            }
        }
        const ratio = this._getScaleRatio(mapIndex, mapScaleIndex);
        const scaleIndexImageW = s.width / ratio.x * s.count;
        const scaleIndexImageH = s.height / ratio.y * s.count;
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
        let x = (tileInfo.tx * s.width / ratio.x) - (this.baseScaleCamera.x * scaleIndexImageW);
        let y = (tileInfo.ty * s.height / ratio.y) - (this.baseScaleCamera.y * scaleIndexImageH);

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

        tileInfo.scaleIndex = mapScaleIndex;
        return tileInfo;
    }

    _setBackgroundImage(url) {
        const s = this.combinedScales[this.currentScaleIndex];
        const ratio = this._getScaleRatio();
        const scaleIndexImageW = s.width / ratio.x * s.count;
        const scaleIndexImageH = s.height / ratio.y * s.count;

        const rect = this._getRootElem().getBoundingClientRect();
        const rectW = (rect.right - rect.left);
        const rectH = (rect.bottom - rect.top);
        const centerX = rect.left + rectW / 2;
        const centerY = rect.top + rectH / 2;

        let x = -(this.baseScaleCamera.x * scaleIndexImageW);
        let y = -(this.baseScaleCamera.y * scaleIndexImageH);
        let left = Math.floor((x - centerX) * this.transformScale + centerX);
        let top = Math.floor((y - centerY) * this.transformScale + centerY);

        let opacity = 1.0;
        let display = "inline";
        if (url) {
            opacity = this.layerParams[0].opacity;
            display = this.layerParams[0].visible ? "inline" : "none";
        }

        const wh = this._getScreenImageSize();
        this.backgroundImage.src = url;
        this.backgroundImage.style.left = left + "px";
        this.backgroundImage.style.top = top + "px";
        this.backgroundImage.style.width = wh.w + "px";
        this.backgroundImage.style.height = wh.h + "px";
        this.backgroundImage.style.display = display;
        this.backgroundImage.style.opacity = opacity;
    }

    // カメラスペースでの指定したスケールのタイル1枚の幅高さを返す
    _calcTileSizeInCameraSpace(mapIndex = null, scaleIndex = this.currentScaleIndex) {
        let s;
        if (mapIndex !== null) {
            s = this.options.maps[mapIndex].scales[scaleIndex];
        } else {
            s = this.combinedScales[scaleIndex];
        }
        return {
            w: 1.0 / s.count,
            h: 1.0 / s.count,
        };
    }

    // "x/y/z/"等を含んだURLをタイル情報を元に正しいURLに成形して返す
    _formatUrl(url, tileInfo, count, zoom = null) {
        try {
            url = url.replace(/{x}/g, tileInfo.tx.toString());
            url = url.replace(/{y}/g, tileInfo.ty.toString());
            url = url.replace(/%x/g, tileInfo.tx.toString());
            url = url.replace(/%y/g, tileInfo.ty.toString());
            url = url.replace(/%ws/g, tileInfo.tw.toString());
            url = url.replace(/%hs/g, tileInfo.th.toString());
            url = url.replace(/%w/g, tileInfo.tw.toString());
            url = url.replace(/%h/g, tileInfo.th.toString());
            url = url.replace(/%c/g, count.toString());
            if (zoom !== null) {
                url = url.replace(/{z}/g, zoom.toString());
                url = url.replace(/%z/g, zoom.toString());
            }
            return url;
        } catch (pError) {
            console.error("TileViewer _formatUrl error: " + pError);
        }
    }

    // タイルを読み込み、位置や幅高さを設定して返す
    // 既に読み込み済の場合は、読み込み済エレメントに対して位置や幅高さを設定して返す。
    _loadTile(mapIndex, tileInfo) {
        let resultTiles = [];
        let startIndex = this.options.hasOwnProperty('backgroundImage') ? 1 : 0;
        const layerParam = this.layerParams[mapIndex + startIndex];
        const tileClass = this._generateTileClass(mapIndex + startIndex, tileInfo);
        if (this._getRootElem().getElementsByClassName(tileClass).length > 0) {
            let elem = this._getRootElem().getElementsByClassName(tileClass)[0];
            elem.style.left = tileInfo.x + "px";
            elem.style.top = tileInfo.y + "px";
            elem.style.width = tileInfo.w + "px";
            elem.style.height = tileInfo.h + "px";
            elem.style.opacity = layerParam.opacity;
            elem.style.display = layerParam.visible ? "inline" : "none";
            /*
            if (mapIndex === 0) {
                elem.style.border = "4px solid blue";
            } else {
                elem.style.border = "2px solid red";
            }
            */
            resultTiles.push(elem);
        } else {
            const tile = new Image();
            tile.alt = " No Image"
            tile.classList.add(this.tileImageClass);
            tile.classList.add(tileClass);
            tile.style.fontSize = "12px";
            tile.style.color = "lightgray";
            /*
            if (mapIndex === 0) {
                tile.style.border = "4px solid blue";
            } else {
                tile.style.border = "2px solid red";
            }
            */
            tile.style.pointerEvents = "none"
            tile.style.position = "absolute";
            tile.style.left = tileInfo.x + "px";
            tile.style.top = tileInfo.y + "px";
            tile.style.width = tileInfo.w + "px";
            tile.style.height = tileInfo.h + "px";
            tile.style.opacity = layerParam.opacity;
            tile.style.display = layerParam.visible ? "inline" : "none";

            //tile.style.border = "1px solid gray";
            tile.style.boxSizing = "border-box";
            const s = this.options.maps[mapIndex].scales[tileInfo.scaleIndex];
            tile.src = this._formatUrl(this.options.maps[mapIndex].url, tileInfo, s.count, s.zoom);
            tile.style.zIndex = mapIndex + startIndex;
            this._getRootElem().appendChild(tile);
            resultTiles.push(tile);
        }
        return resultTiles;
    }

    // 全タイルの削除
    _removeTileElements() {
        let tiles = this._getRootElem().getElementsByClassName(this.tileImageClass);
        for (let i = tiles.length - 1; i >= 0; --i) {
            this._getRootElem().removeChild(tiles[i]);
        }
    }

    // 現在のカメラ情報から、表示されるべきタイルの配置情報を計算し
    // 2次元配列で返す。
    // 配列インデックスは左上を(0,0)としx,y方向に対して増加する。
    // 配列に格納される配置情報は以下の通り。
    // {
    //  x: カメラスペースでのタイルのサンプリングポイントのx座標(タイルの左上ではないことに注意),
    //  y: カメラスペースでのタイルのサンプリングポイントのy座標(タイルの左上ではないことに注意),
    //  tile : {
    //       x : タイルとして配置されるべきDOMエレメントのx座標(ピクセル数),
    //       y : タイルとして配置されるべきDOMエレメントのy座標(ピクセル数),
    //       w : タイルとして配置されるべきDOMエレメントの幅(ピクセル数),
    //       h : タイルとして配置されるべきDOMエレメントの高さ(ピクセル数),
    //      tx : 現在のレベルでのx方向のタイル番号,
    //      ty : 現在のレベルでのy方向のタイル番号, 
    //      tw : 現在のレベルでのタイルの幅(ピクセル数),
    //      tw : 現在のレベルでのタイルの高さ(ピクセル数)
    //  }
    _prepareTileElements(mapIndex, mapScaleIndex) {
        const camera = this.camera;
        const s = this.options.maps[mapIndex].scales[mapScaleIndex];

        // カメラスペースでの、タイル１枚の幅高さ
        const wh = this._calcTileSizeInCameraSpace(mapIndex, mapScaleIndex);
        // カメラスペースでの0.5ピクセル
        const texelHalfX = wh.w / s.width / 2;
        const texelHalfY = wh.h / s.height / 2;
        // カメラスペースでの1ピクセル
        const texelX = texelHalfX * 2;
        const texelY = texelHalfY * 2;
        // 現在のビューで見えるタイルについて
        // 読み込んだか判定するようの二次元配列を作成
        // 初期値は全てfalse
        let tileMatrix = [];
        for (let y = camera.y - texelHalfY; y < (camera.y + camera.h + wh.h + texelY); y += wh.h) {
            const tile = this._calcTileInfoByCameraSpacePosition(camera.x, y, mapIndex, mapScaleIndex);
            if (tile.ty >= 0) {
                // (*, y)に対応するタイルが存在する
                let row = [];
                for (let x = camera.x - texelHalfX; x < (camera.x + camera.w + wh.w + texelX); x += wh.w) {
                    const tile = this._calcTileInfoByCameraSpacePosition(x, y, mapIndex, mapScaleIndex);
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
        return tileMatrix;
    }

    // 配置情報を元に、実際にタイル(DOMエレメントを)を配置し、画像を読み込んでいく
    _fillTileElements(mapIndex, tileMatrix) {
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
            Array.prototype.push.apply(loadedElems, this._loadTile(mapIndex, entry.tile));
        }
        // 右方向
        for (let x = pos.x + 1; x < xCount; ++x) {
            const entry = tileMatrix[pos.y][x];
            Array.prototype.push.apply(loadedElems, this._loadTile(mapIndex, entry.tile));
        }

        // 左方向
        for (let x = pos.x - 1; x >= 0; --x) {
            const entry = tileMatrix[pos.y][x];
            Array.prototype.push.apply(loadedElems, this._loadTile(mapIndex, entry.tile));
        }

        // 上方向
        for (let y = pos.y - 1; y >= 0; --y) {
            for (let x = 0; x < xCount; ++x) {
                const entry = tileMatrix[y][x];
                Array.prototype.push.apply(loadedElems, this._loadTile(mapIndex, entry.tile));
            }
        }

        // 下方向
        for (let y = pos.y + 1; y < yCount; ++y) {
            for (let x = 0; x < xCount; ++x) {
                const entry = tileMatrix[y][x];
                Array.prototype.push.apply(loadedElems, this._loadTile(mapIndex, entry.tile));
            }
        }
        return loadedElems;
    }

    // fillで配置対象になっていないタイル(DOMエレメントを)が残っていたら消す
    _cullTileElements(loadedElems) {
        let tileElements = this._getRootElem().getElementsByClassName(this.tileImageClass);
        for (let i = tileElements.length - 1; i >= 0; --i) {
            if (loadedElems.indexOf(tileElements[i]) < 0) {
                this._getRootElem().removeChild(tileElements[i]);
            }
        }
    }

    _clearCache() {
        const rootElem = this._getRootElem();
        let tileElements = rootElem.children;
        for (let i = tileElements.length - 1; i >= 0; --i) {
            if (tileElements[i].id !== this.backgroundImageID) {
                rootElem.removeChild(tileElements[i]);
            }
        }
    }

    // スケールインデックスの変更
    _setScaleIndex(scaleIndex, withDispatch = true) {
        if (this.isFixedScaleIndex) {
            return false;
        }
        if (scaleIndex >= 0 && scaleIndex < this.combinedScales.length) {
            if (this.currentScaleIndex !== scaleIndex) {
                this.currentScaleIndex = scaleIndex;
                if (withDispatch) {
                    this._dispatchScaleIndex();
                }
                return true;
            }
        }
        return false;
    }

    // 位置の変更コールバックを発火させる
    // 位置が変更された場合必ず呼ぶ
    _dispatchPosition() {
        const event = new CustomEvent('position_changed', { detail: this.getCameraInfo() });
        this.transformElem.dispatchEvent(event);
    }

    // scaleIndex変更コールバックを発火させる
    // scaleIndex変更された場合必ず呼ぶ
    _dispatchScaleIndex() {
        const event = new CustomEvent('scale_index_changed', { detail: this.currentScaleIndex });
        this.transformElem.dispatchEvent(event);
    }

    // オプション変更コールバックを発火させる
    // オプションが変更された場合必ず呼ぶ
    _dispatchOptions() {
        const event = new CustomEvent('options_changed', { detail: JSON.parse(JSON.stringify(this.options)) });
        this.transformElem.dispatchEvent(event);
    }

    // リサイズ時に画面中心を維持し、ビューの横方向が画面内に常に収まるように維持するように
    // スケーリングを行う
    _resizeScaling(withDispatch = true) {
        const viewerSize = this._getViewerSize();
        const totalImageSize = this._getTotalImageSize();
        const preW = this.baseScaleCamera.w;
        const preH = this.baseScaleCamera.h;
        const scale = {
            w: viewerSize.w / (preW * totalImageSize.w),
            h: viewerSize.h / (preH * totalImageSize.h)
        };
        const bound = {
            left: this.baseScaleCamera.x,
            top: this.baseScaleCamera.y,
            right: this.baseScaleCamera.x + this.baseScaleCamera.w,
            bottom: this.baseScaleCamera.y + this.baseScaleCamera.h
        };

        // 画面中心を維持しつつスケール
        const pivotX = (bound.left + bound.right) / 2;
        const pivotY = (bound.top + bound.bottom) / 2;

        this.baseScaleCamera.x = (bound.left - pivotX) * scale.w + pivotX;
        this.baseScaleCamera.y = (bound.top - pivotY) * scale.h + pivotY;
        this.baseScaleCamera.w = (bound.right - bound.left) * scale.w;
        this.baseScaleCamera.h = (bound.bottom - bound.top) * scale.h;

        const diffScale = this.baseScaleCamera.w / preW;
        this.setTransformScale(this.transformScale * diffScale, withDispatch);
    }

    // baseScaleCameraを元にcameraを再設定する。
    // baseScaleCameraを変更した場合に呼ぶ
    // cameraには、baseScaleCameraの中央を基点としたtransformScaleによるスケールがかかる
    _updateCameraFromBaseCamera(withDispatch = true) {
        const cx = this.baseScaleCamera.x + this.baseScaleCamera.w / 2.0;
        const cy = this.baseScaleCamera.y + this.baseScaleCamera.h / 2.0;
        this.camera.w = this.baseScaleCamera.w / this.transformScale;
        this.camera.h = this.baseScaleCamera.h / this.transformScale;
        this.camera.x = (this.baseScaleCamera.x - cx) / this.transformScale + cx;
        this.camera.y = (this.baseScaleCamera.y - cy) / this.transformScale + cy;

        // カメラの座標が変更されたので、位置変更コールバックを発火
        if (withDispatch) {
            this._dispatchPosition();
        }
    }

    // this.combinedScalesのindexを
    // map[].scales[]内のindexに変換し返す
    // 存在しない場合は、
    // total_widthより小さく、total_widthに近いscaleのindexを返す
    _getMapScaleIndex(mapIndex, combindScaleIndex) {
        const cs = this.combinedScales[combindScaleIndex];
        const scales = this.options.maps[mapIndex].scales;
        for (let i = 0; i < scales.length; ++i) {
            const s = scales[i];
            if (s.width * s.count > cs.total_width) {
                return Math.max(0, i - 1);
            }
        }
        return scales.length - 1;
    }

    // 現在のカメラを元にタイルを更新する
    _update() {
        // 単一の背景画像の読み込みまたは非表示
        if (this.options.hasOwnProperty('backgroundImage')) {
            this._setBackgroundImage(this.options.backgroundImage);
        } else {
            this.backgroundImage.style.display = "none";
        }
        let loadedElems = [];
        // 各mapのscalesに対して、それぞれ別のindexでアクセスし、
        // 各mapごとのtileエレメントのセット(tileMatrix)を作成して、画像で埋める
        for (let i = 0; i < this.options.maps.length; ++i) {
            const scaleIndex = this._getMapScaleIndex(i, this.currentScaleIndex);
            const tileMatrix = this._prepareTileElements(i, scaleIndex);
            Array.prototype.push.apply(loadedElems, this._fillTileElements(i, tileMatrix));
        }
        this._cullTileElements(loadedElems);
    }

    _convertPixelPositionToCameraPosition(pixelPos) {
        const rect = this.viewerElem.getBoundingClientRect();
        const viewerSize = this._getViewerSize();
        return {
            x: this.camera.x + this.camera.w * ((pixelPos.x - rect.left) / viewerSize.w),
            y: this.camera.y + this.camera.h * ((pixelPos.y - rect.top) / viewerSize.h),
        }
    }

    /**
     * ある任意のピボット座標を中心とした、transformScaleによる拡縮を行う。
     * @param {*} scale 新たに設定するtransformScale
     * @param {*} pivotXY 拡縮の基点とするピボット（カメラ座標系で{x: .., y: .. }の形式
     * @param {*} withDispatch 変更イベントを発火するかどうか
     */
    _setTransformScaleWithPivot(scale, pivotXY, withDispatch = true) {
        // カメラ座標系での画面中心
        const centerXY = {
            x: this.camera.x + this.camera.w * 0.5,
            y: this.camera.y + this.camera.h * 0.5,
        };
        // ピボット位置を画面中心に動かすための移動量
        const centerToPivot = {
            x: centerXY.x - pivotXY.x,
            y: centerXY.y - pivotXY.y
        };
        // ピボット位置を画面中心にする
        this.baseScaleCamera.x -= centerToPivot.x;
        this.baseScaleCamera.y -= centerToPivot.y;
        const preTrans = this.transformScale;
        this._updateCameraFromBaseCamera(false);
        // 画面中心スケール
        this.setTransformScale(scale, false);
        const diffScale = this.transformScale / preTrans;
        // 移動させていたのをスケールを考慮しつつ、元の戻す
        this.baseScaleCamera.x += centerToPivot.x / diffScale;
        this.baseScaleCamera.y += centerToPivot.y / diffScale;
        this._updateCameraFromBaseCamera(withDispatch);
        this._update();
    }

    _getcZoomBaseScale(isPlus = true) {
        if (this.options.geodeticSystem === "standard") {
            return 2;
        } else {
            return 1.1;
        }
    }

    // this.optionを元に、新規に地図を読み込む
    // positionによりカメラ位置を指定する
    create(position, callback) {
        if (position) {
            // 位置情報による調整
            // 後の計算時に使用するため、先にscaleIndexを設定
            if (position.hasOwnProperty('scale')) {
                this._setScaleIndex(position.scale);
            }
            // 位置情報による調整
            if (position.hasOwnProperty('center')) {
                // カメラのwidth, heightをまず求める
                // 通常はブラウザの幅高さを使用する
                // positionにwidth, heightが指定されていればそちらを使用する
                const viewerSize = this._getViewerSize();
                let width = viewerSize.w;
                let height = viewerSize.h;
                if (position.hasOwnProperty('width')) {
                    width = position.width;
                }
                if (position.hasOwnProperty('height')) {
                    height = position.height;
                }
                const imageSize = this._getScreenImageSize();
                const cameraW = width / imageSize.w;
                const cameraH = height / imageSize.h;

                if (position.center.hasOwnProperty('relative')) {
                    const leftTop = position.center.relative;
                    this.baseScaleCamera.x = leftTop.left - cameraW / 2;
                    this.baseScaleCamera.y = leftTop.top - cameraH / 2;
                    this.baseScaleCamera.w = cameraW;
                    this.baseScaleCamera.h = cameraH;
                } else if (position.center.hasOwnProperty('absolute')) {
                    const leftTop = position.center.absolute;
                    const totalImageSize = this._getTotalImageSize();
                    const relativeX = (leftTop.left / totalImageSize.w);
                    const relativeY = (leftTop.top / totalImageSize.h);
                    this.baseScaleCamera.x = relativeX - cameraW / 2;
                    this.baseScaleCamera.y = relativeY - cameraH / 2;
                    this.baseScaleCamera.w = cameraW;
                    this.baseScaleCamera.h = cameraH;
                } else if (position.center.hasOwnProperty('degrees')) {
                    const leftTop = position.center.degrees;

                    // TODO
                }
            }
        } else {
            // 描画領域のサイズに対して、画像全体がちょうど納まる最適なスケールおよび位置に調整
            this.baseScaleCamera = {
                x: 0,
                y: 0,
                w: 1,
                h: 1
            }
        }

        this._resizeScaling();
        this._update();
    }

    move(mv, callback) {
        const screenImageSize = this._getScreenImageSize();
        const cameraSpaceMove = {
            x: mv.x / screenImageSize.w,
            y: mv.y / screenImageSize.h
        }
        this.baseScaleCamera.x -= cameraSpaceMove.x;
        this.baseScaleCamera.y -= cameraSpaceMove.y;
        this._updateCameraFromBaseCamera();
        this._update();
    }

    setTransformScale(scale, withDispatch = true) {
        // 余りにも小さいスケールにしようとした場合は失敗とする
        if (scale < 0.1e-10) return false;

        const preScale = this.transformScale;
        this.transformScale = scale;

        // 画面サイズの半分より小さくしようとした場合は失敗とする
        if (this.isEnableLimitOfMinimumScale) {
            const viewerSize = this._getViewerSize();
            const halfW = viewerSize.w * (this.viewport[2] - this.viewport[0]) / 2;
            if (this._getScreenImageSize().w < halfW) {
                this.transformScale = preScale;
                return false;
            }
        }

        while ((this.currentScaleIndex + 1 < this.combinedScales.length) &&
            scale >= this._getScaleRatio(null, this.currentScaleIndex + 1).x) {
            // LoDレベルを上げる
            if (!this._setScaleIndex(this.currentScaleIndex + 1)) {
                break;
            }
        }
        while (this.currentScaleIndex > 0 &&
            scale < this._getScaleRatio(null, this.currentScaleIndex).x) {
            // LoDレベルを下げる
            if (!this._setScaleIndex(this.currentScaleIndex - 1)) {
                break;
            }
        }

        this._updateCameraFromBaseCamera(withDispatch);
        this._update();
        return true;
    }

    /**
     * ズームインする。
     * @param {*} onlyLevel レベルのみ変更する場合はtrueとする
     * @param {*} pixelPos 拡縮の中心とする座標（viewerElem上でのx, y。単位：ピクセル数)
     *                     nullの場合は画面中心で拡縮を行う。
     */
    zoomIn(onlyLevel = false, pixelPos = null) {
        if (onlyLevel) {
            this._setScaleIndex(this.currentScaleIndex + 1);
            this._update();
        } else if (pixelPos) {
            // ピクセルでの位置を、カメラ座標系に変換
            const pivotXY = this._convertPixelPositionToCameraPosition(pixelPos);
            this._setTransformScaleWithPivot(this.transformScale + 0.5 * Math.pow(this._getcZoomBaseScale(), this.currentScaleIndex), pivotXY);
        } else {
            // 画面中心
            this.setTransformScale(this.transformScale + 0.05 * Math.pow(this._getcZoomBaseScale(), this.currentScaleIndex));
        }
    }

    /**
     * ズームアウトする。
     * @param {*} onlyLevel レベルのみ変更する場合はtrueとする
     * @param {*} pixelPos 拡縮の中心とする座標（viewerElem上でのx, y。単位：ピクセル数)
     *                     nullの場合は画面中心で拡縮を行う。
     */
    zoomOut(onlyLevel = false, pixelPos = null) {
        if (onlyLevel) {
            this._setScaleIndex(this.currentScaleIndex - 1);
            this._update();
        } else if (pixelPos) {
            // ピクセルでの位置を、カメラ座標系に変換
            const pivotXY = this._convertPixelPositionToCameraPosition(pixelPos);
            this._setTransformScaleWithPivot(this.transformScale - 0.5 * Math.pow(this._getcZoomBaseScale(), this.currentScaleIndex), pivotXY);
        } else {
            this.setTransformScale(this.transformScale - 0.05 * Math.pow(this._getcZoomBaseScale(), this.currentScaleIndex));
        }
    }

    /**
     * [left, top, right, bottom] の形式でViewportを設定する
     * Viewportは、現在のTileViewerの描画領域全体について
     * 左上(0,0), 右下(1,1)としたときの
     * 実際に表示する領域[left, top, right, bottom].
     * この領域外のタイルはカリングされる
     */
    setViewport(viewport) {
        this.viewport = JSON.parse(JSON.stringify(viewport));
        this._update();
    }

    /**
     * 
     * @returns viewportを返す
     */
    getViewport() {
        return JSON.parse(JSON.stringify(this.viewport));
    }

    /**
     * ズームレベルがscalesに定義されている場合は、現在のズームレベルを返す
     * ズームレベルが定義されていない場合は, -1を返す
     */
    getZoomLevel() {
        if (this.combinedScales[this.currentScaleIndex].hasOwnProperty('zoom')) {
            return Number(this.combinedScales[this.currentScaleIndex].zoom);
        }
        return -1;
    }

    /**
     * スケール等を含んだカメラ情報を返す。
     * この値を取得し、setCameraInfoを呼ぶことで、見た目を完全に再現させることができる。
     * ただし、ビューポートは別途取得する必要がある。
     * @returns スケールをすべて含んだカメラ情報
     */
    getCameraInfo() {
        let info = {
            camera: JSON.parse(JSON.stringify(this.camera)),
            baseScaleCamera: JSON.parse(JSON.stringify(this.baseScaleCamera)),
            transformScale: this.transformScale,
            scaleIndex: this.currentScaleIndex,
            fixedZoomLevel: this.isFixedScaleIndex,
        }
        if (this.getZoomLevel() >= 0) {
            info.zoomLevel = this.getZoomLevel();
        }
        return info;
    }

    /**
     * スケール等含んだカメラ情報をセットする。
     * getCameraInfoで得られた値を引数に入れることで、カメラ位置を復元できる。
     * ただし、ビューポートは別途指定する必要がある。
     */
    setCameraInfo(viewInfo) {
        // 固定ズームレベルの設定
        if (viewInfo.hasOwnProperty('fixedZoomLevel') && viewInfo.hasOwnProperty('zoomLevel')) {
            const scaleLen = this.combinedScales.length;
            for (let i = 0; i < scaleLen; ++i) {
                if (this.combinedScales[i].hasOwnProperty('zoom') &&
                    this.combinedScales[i].zoom == viewInfo.zoomLevel) {
                    this.setZoomLevel(viewInfo.fixedZoomLevel, i);
                }
            }
        } else if (viewInfo.hasOwnProperty('fixedZoomLevel') && viewInfo.hasOwnProperty('scaleIndex')) {
            this.setZoomLevel(viewInfo.fixedZoomLevel, viewInfo.scaleIndex);
        }
        this.baseScaleCamera = JSON.parse(JSON.stringify(viewInfo.baseScaleCamera));
        this._updateCameraFromBaseCamera(false);
        this._setScaleIndex(viewInfo.scaleIndex);
        this.setTransformScale(viewInfo.transformScale, false);
        this._resizeScaling(false);
    }

    /**
     * TileViewerの全オプション情報の設定
     * @param {*} options 
     */
    setOptions(options) {
        this.options = options;

        this._clearCache();

        // 古いものを削除してthis.combinedScalesを作り直す+
        this.combinedScales = [];
        let visitedTotalWidth = [];
        if (options.hasOwnProperty('maps')) {
            for (let i = 0; i < options.maps.length; ++i) {
                const map = options.maps[i];
                for (let j = 0; j < map.scales.length; ++j) {
                    let s = map.scales[j];
                    s.total_width = s.width * s.count;
                    // 今まで出現していないtotal_widthだった場合は、this.combinedScalesに追加
                    if (visitedTotalWidth.indexOf(s.total_width) < 0) {
                        visitedTotalWidth.push(s.total_width);
                        this.combinedScales.push(s);
                    }
                }
            }
        }
        this.combinedScales.sort((a, b) => {
            return a.total_width - b.total_width;
        });

        // 古いものを削除してthis.layerParamsを作り直す
        this.layerParams = [];

        if (options.hasOwnProperty('backgroundImage')) {
            this.layerParams.push({
                opacity: 1,
                visible: true
            });
        }

        if (options.hasOwnProperty('maps')) {
            for (let i = 0; i < options.maps.length; ++i) {
                this.layerParams.push({
                    opacity: 1,
                    visible: true
                });
            }
        }
        this._update();

        this._dispatchOptions();
    }

    setOpacity(layerIndex, opacity) {
        console.log("setOpacity", layerIndex, this.layerParams)
        this.layerParams[layerIndex].opacity = opacity;
        this._update();
    }

    setVisible(layerIndex, visible) {
        console.log("setVisible", layerIndex, visible)
        this.layerParams[layerIndex].visible = visible;
        this._update();
    }

    setZoomLevel(isFixedScaleIndex, scaleIndex) {
        if (this.isFixedScaleIndex != isFixedScaleIndex || (isFixedScaleIndex && this.currentScaleIndex != scaleIndex)) {
            console.log("setZoomLevel", this.isFixedScaleIndex, isFixedScaleIndex, this.currentScaleIndex, scaleIndex);
            // 一旦falseにしてscaleIndexを強制設定する
            const preFixed = this.isFixedScaleIndex;
            this.isFixedScaleIndex = false;
            if (this._setScaleIndex(scaleIndex, true)) {
                this._update();
            }
            // isFixedScaleIndexを最新の値に設定
            this.isFixedScaleIndex = isFixedScaleIndex;
            if (preFixed && !isFixedScaleIndex) {
                // 固定から非固定になったとき, 一旦resize相当を走らせて
                // スケールを自動設定する
                this._resizeScaling();
            }
        }
    }

    getOptions() {
        return JSON.parse(JSON.stringify(this.options));
    }

    enableResizeScaling() {
        window.addEventListener('resize', this._resizeScaling);
    }

    disableResizeScaling() {
        window.removeEventListener('resize', this._resizeScaling);
    }

    enableLimitOfMinimumScale() {
        this.isEnableLimitOfMinimumScale = true;
    }

    disableLimitOfMinimumScale() {
        this.isEnableLimitOfMinimumScale = false;
    }

    addPositionCallback(callback) {
        if (this.transformElem) {
            this.callbackDict[callback] = (ev) => {
                callback(ev.detail);
            };
            this.transformElem.addEventListener('position_changed', this.callbackDict[callback]);
            return true;
        }
        return false;
    }

    removePositionCallback(callback) {
        if (this.callbackDict.hasOwnProperty(callback)) {
            this.transformElem.removeEventListener('position_cahnged', this.callbackDict[callback]);
            return true;
        }
        return false;
    }

    addScaleIndexCallback(callback) {
        if (this.transformElem) {
            this.callbackDict[callback] = (ev) => {
                callback(ev.detail);
            };
            this.transformElem.addEventListener('scale_index_changed', this.callbackDict[callback]);
            return true;
        }
        return false;
    }

    removeScaleIndexCallback(callback) {
        if (this.callbackDict.hasOwnProperty(callback)) {
            this.transformElem.removeEventListener('scale_index_changed', this.callbackDict[callback]);
            return true;
        }
        return false;
    }


    addOptionsCallback(callback) {
        if (this.transformElem) {
            this.callbackDict[callback] = (ev) => {
                callback(ev.detail);
            };
            this.transformElem.addEventListener('options_changed', this.callbackDict[callback]);
            return true;
        }
        return false;
    }

    removeOptionsCallback(callback) {
        if (this.callbackDict.hasOwnProperty(callback)) {
            this.transformElem.removeEventListener('options_changed', this.callbackDict[callback]);
            return true;
        }
        return false;
    }
}
window.TileViewer = TileViewer;