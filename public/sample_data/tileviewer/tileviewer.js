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

        // 画像全体を正規化した空間（つまり左上0,0、右下1,1)で
        // 左上　x, y, 及び w, hによる仮想的なカメラを定義する
        // これをカメラスペースと呼ぶこととする。
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

        // opeions.scales[]の現在の使用インデックス
        this.currentScaleIndex = 0;

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
    // このクラス名は動作的には無くても動くが、表示された地図のタイルをdevtoolで調べるときに便利なので入れている
    _generateTileClass(tileIndex, tileInfo) {
        return tileIndex + "_" + tileInfo.scaleIndex + "_" + tileInfo.tx + "_" + tileInfo.ty;
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

    // 全体画像サイズ(ピクセル数)を返す.
    // this.transformScaleによるスケールは考慮しない.
    // 
    // 現在の実装ではscaleIndex=0以降はscaleIndex=0の全体画像サイズに収まるように
    // 幅高さをスケールして表示される仕組みのため、
    // どのscaleIndexであっても全体画像サイズは必ずsacaleIndex=0の全体画像サイズと同様となる。
    _getTotalImageSize() {
        const s = this.options.scales[0];
        //const ratio = this._getScaleRatio();
        return {
            w: (s.width * s.count),
            h: (s.height * s.count)
        }
    }

    // 現在のスケールでのスクリーンでの画像表示サイズを返す
    // this.transformScaleによるスケールを考慮。
    _getScreenImageSize() {
        const s = this.options.scales[this.currentScaleIndex];
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

        tileInfo.scaleIndex = this.currentScaleIndex;
        return tileInfo;
    }

    _setBackgroundImage(url) {
        const s = this.options.scales[this.currentScaleIndex];
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

        const wh = this._getScreenImageSize();
        this.backgroundImage.src = url;
        this.backgroundImage.style.left = left + "px";
        this.backgroundImage.style.top = top + "px";
        this.backgroundImage.style.width = wh.w + "px";
        this.backgroundImage.style.height = wh.h + "px";
        this.backgroundImage.style.display = "block";
    }

    // カメラスペースでの現在のスケールのタイル1枚の幅高さを返す
    _calcTileSizeInCameraSpace() {
        const s = this.options.scales[this.currentScaleIndex];
        return {
            w: 1.0 / s.count,
            h: 1.0 / s.count,
        };
    }

    // "x/y/z/"等を含んだURLをタイル情報を元に正しいURLに成形して返す
    _formatUrl(url, tileInfo, count, zoom = null) {
        try {
            url = url.replace(/%x/g, tileInfo.tx.toString());
            url = url.replace(/%y/g, tileInfo.ty.toString());
            url = url.replace(/%ws/g, tileInfo.tw.toString());
            url = url.replace(/%hs/g, tileInfo.th.toString());
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

    // タイルを読み込み、位置や幅高さを設定して返す
    // 既に読み込み済の場合は、読み込み済エレメントに対して位置や幅高さを設定して返す。
    _loadTile(tileInfo) {
        let resultTiles = [];
        for (let i = 0; i < this.options.foregroundImages.length; ++i) {
            const tileClass = this._generateTileClass(i, tileInfo);
            if (this._getRootElem().getElementsByClassName(tileClass).length > 0) {
                let elem = this._getRootElem().getElementsByClassName(tileClass)[0];
                elem.style.left = tileInfo.x + "px";
                elem.style.top = tileInfo.y + "px";
                elem.style.width = tileInfo.w + "px";
                elem.style.height = tileInfo.h + "px";
                resultTiles.push(elem);
            } else {
                const tile = new Image();
                tile.alt = " No Image"
                tile.classList.add(this.tileImageClass);
                tile.classList.add(tileClass);
                tile.style.fontSize = "12px"
                tile.style.color = "lightgray"
                tile.style.pointerEvents = "none"
                tile.style.position = "absolute";
                tile.style.left = tileInfo.x + "px";
                tile.style.top = tileInfo.y + "px";
                tile.style.width = tileInfo.w + "px";
                tile.style.height = tileInfo.h + "px";
                //tile.style.border = "1px solid gray";
                tile.style.boxSizing = "border-box";
                const s = this.options.scales[this.currentScaleIndex];
                tile.src = this._formatUrl(this.options.foregroundImages[i], tileInfo, s.count, s.zoom);
                tile.style.zIndex = i;
                this._getRootElem().appendChild(tile);
                resultTiles.push(tile);
            }
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
    _prepareTileElements() {
        const camera = this.camera;
        const s = this.options.scales[this.currentScaleIndex];

        // カメラスペースでの、タイル１枚の幅高さ
        const wh = this._calcTileSizeInCameraSpace();
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
            const tile = this._calcTileInfoByCameraSpacePosition(camera.x, y);
            if (tile.ty >= 0) {
                // (*, y)に対応するタイルが存在する
                let row = [];
                for (let x = camera.x - texelHalfX; x < (camera.x + camera.w + wh.w + texelX); x += wh.w) {
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
        return tileMatrix;
    }

    // 配置情報を元に、実際にタイル(DOMエレメントを)を配置し、画像を読み込んでいく
    _fillTileElements(tileMatrix) {
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
            Array.prototype.push.apply(loadedElems, this._loadTile(entry.tile));
        }
        // 右方向
        for (let x = pos.x + 1; x < xCount; ++x) {
            const entry = tileMatrix[pos.y][x];
            Array.prototype.push.apply(loadedElems, this._loadTile(entry.tile));
        }

        // 左方向
        for (let x = pos.x - 1; x >= 0; --x) {
            const entry = tileMatrix[pos.y][x];
            Array.prototype.push.apply(loadedElems, this._loadTile(entry.tile));
        }

        // 上方向
        for (let y = pos.y - 1; y >= 0; --y) {
            for (let x = 0; x < xCount; ++x) {
                const entry = tileMatrix[y][x];
                Array.prototype.push.apply(loadedElems, this._loadTile(entry.tile));
            }
        }

        // 下方向
        for (let y = pos.y + 1; y < yCount; ++y) {
            for (let x = 0; x < xCount; ++x) {
                const entry = tileMatrix[y][x];
                Array.prototype.push.apply(loadedElems, this._loadTile(entry.tile));
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

    // スケールインデックスの変更
    _setScaleIndex(scaleIndex, withDispatch = true) {
        if (scaleIndex >= 0 && scaleIndex < this.options.scales.length) {
            if (this.currentScaleIndex !== scaleIndex) {
                this.currentScaleIndex = scaleIndex;
                if (scaleIndex) {
                    this._dispatchScaleIndex();
                }
            }
        }
    }

    // 位置の変更コールバックを発火させる
    // 位置が変更された場合必ず呼ぶ
    _dispatchPosition() {
        const event = new CustomEvent('position_changed', { detail: JSON.stringify(this.getCameraInfo()) });
        this.transformElem.dispatchEvent(event);
    }

    // scaleIndex変更コールバックを発火させる
    // scaleIndex変更された場合必ず呼ぶ
    _dispatchScaleIndex() {
        const event = new CustomEvent('scale_index_changed', { detail: this.currentScaleIndex });
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

    // 現在のカメラを元にタイルを更新する
    _update() {
        if (this.options.hasOwnProperty('backgroundImage')) {
            this._setBackgroundImage(this.options.backgroundImage);
        }
        const tileMatrix = this._prepareTileElements();
        const loadedElems = this._fillTileElements(tileMatrix);
        this._cullTileElements(loadedElems);
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
        const viewerSize = this._getViewerSize();
        const halfW = viewerSize.w / 2;
        if (this._getScreenImageSize().w < halfW) {
            this.transformScale = preScale;
            return false;
        }


        if (this.currentScaleIndex + 1 < this.options.scales.length) {
            if (scale >= this._getScaleRatio(this.currentScaleIndex + 1).x) {
                // LoDレベルを上げる
                this._setScaleIndex(this.currentScaleIndex + 1);
            }
        }
        if (this.currentScaleIndex > 0) {
            if (scale < this._getScaleRatio(this.currentScaleIndex).x) {
                // LoDレベルを下げる
                this._setScaleIndex(this.currentScaleIndex - 1);
            }
        }

        this._updateCameraFromBaseCamera(withDispatch);
        this._update();
        return true;
    }

    zoomIn(onlyLevel) {
        if (onlyLevel) {
            this._setScaleIndex(this.currentScaleIndex + 1);
            this._update();
        } else {
            this.setTransformScale(this.transformScale + 0.05 * Math.pow(2, this.currentScaleIndex));
        }
    }

    zoomOut(onlyLevel) {
        if (onlyLevel) {
            this._setScaleIndex(this.currentScaleIndex - 1);
            this._update();
        } else {
            this.setTransformScale(this.transformScale - 0.05 * Math.pow(2, this.currentScaleIndex));
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

    getViewport() {
        return JSON.parse(JSON.stringify(this.viewport));
    }

    /**
     * スケールやビューポートをすべて含んだカメラ情報を返す。
     * この値を取得し、setCameraInfoを呼ぶことで、見た目を完全に再現させることができる。
     * @returns スケールやビューポートをすべて含んだカメラ情報
     */
    getCameraInfo() {
        return {
            camera: JSON.parse(JSON.stringify(this.camera)),
            baseScaleCamera: JSON.parse(JSON.stringify(this.baseScaleCamera)),
            transformScale: this.transformScale,
            viewport: JSON.parse(JSON.stringify(this.viewport)),
            scaleIndex: this.currentScaleIndex
        }
    }

    /**
     * スケールやビューポートをすべて含んだカメラ情報をセットする。
     * getCameraInfoで得られた値を引数に入れることで、カメラ位置を復元できる
     */
    setCameraInfo(viewInfo) {
        this.baseScaleCamera = JSON.parse(JSON.stringify(viewInfo.baseScaleCamera));
        this._updateCameraFromBaseCamera(false);
        this.viewport = JSON.parse(JSON.stringify(viewInfo.viewport));
        this._setScaleIndex(viewInfo.scaleIndex);
        this.setTransformScale(viewInfo.transformScale, false);
        this._resizeScaling(false);
    }

    setOptions(options) {
        this.options = options;
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
}
window.TileViewer = TileViewer;