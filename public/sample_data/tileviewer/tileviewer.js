/**
 * Copyright (c) 2021 National Institute of Information and Communications Technology (NICT). All rights reserved.
 */

// ズームレベルの切り替えをスムーズに行うかというフラグ
// - trueの場合 ズームレベル 2から3に遷移するとき、
//   ズームレベル2.5の時点で、LoDレベル3のタイルが縮小表示される。
//   その後ズームレベル3.0の時点で等倍表示となり、3.499.. までレベル3が拡大表示される。
// - falseの場合 ズームレベル 2から3に遷移するとき、
//   ズームレベル3.0の時点で、LoDレベル3のタイルが(等倍)表示される。
//   その後3.999.. までレベル3が拡大表示される。
const SMOOTH_SCALING = true;

/** TileViewer */
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

        // 表示対象時刻。nullの場合は現在時刻とみなす
        this.date = null;

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

        // 更新時のタイムアウト処理用時間デフォルト値
        // options.timeoutに値があればそちらを使用する
        this.timeout = 0;
        // 時刻変更時のタイムアウト処理用時間デフォルト値
        // options.timeout_on_setting_dateに値があればそちらを使用する
        this.timeout_on_setting_date = 1000;
        // timeout_on_setting_dateを時刻変更時のみに適用するためのフラグ
        this.isSettingDate = false;

        this.updateCancelFuncs = [];

        // addEventListenerで登録したコールバックを保持
        this.callbackDict = {};

        // update()の内部処理を行うかどうかのフラグ
        this.isDisableUpdate = false;

        this.loadingStatus = "loading"
    }

    _disableUpdate() {
        this.isDisableUpdate = true;
    }

    _enableUpdate() {
        this.isDisableUpdate = false;
    }

    // タイル画像が存在しないときに基準とするサイズを返す
    _getEmptyScaleInfo() {
        return JSON.parse(JSON.stringify({
            width: 512,
            height: 512,
            count: 1
        }));
    }

    _getRootElem() {
        return this.transformElem;
    }

    // タイル情報からタイル固有のクラス名を作成して返す
    _generateTileClass(mapIndex, tileInfo) {
        return "map_" + mapIndex + "_" + tileInfo.scaleIndex + "_" + tileInfo.tx + "_" + tileInfo.ty;
    }

    // scaleIndexにおいて有効なcombinedScalesが存在するか返す
    _hasValidScales(scaleIndex = this.currentScaleIndex) {
        return scaleIndex >= 0 && scaleIndex < this.combinedScales.length;
    }

    // 現在の実装ではscaleIndex=0以降はscaleIndex=0の全体画像サイズに収まるように
    // 幅高さをスケールして表示される仕組みのため、
    // どのscaleIndexであっても全体画像サイズは必ずmapIndex=0のscaleIndex=0の全体画像サイズと同様となる。
    _getBaseSize() {
        // maps[0].scales[0]を基準とする
        if (this.options.hasOwnProperty('maps') && this.options.maps.length > 0) {
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
        return this._getEmptyScaleInfo();
    }

    // scaleIndex0のものと比べたときの、scaleIndexの画像全体の比率
    _getScaleRatio(mapIndex = null, scaleIndex = this.currentScaleIndex) {
        let zero = this._getBaseSize();
        let s;
        if (mapIndex !== null) {
            s = this.options.maps[mapIndex].scales[scaleIndex];
        } else if (this._hasValidScales(scaleIndex)) {
            s = this.combinedScales[scaleIndex];
        } else {
            s = this._getEmptyScaleInfo();
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
        let s;
        if (this._hasValidScales()) {
            s = this.combinedScales[this.currentScaleIndex];
        } else {
            s = this._getEmptyScaleInfo();
        }
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

        /*
        tileInfo.x = Math.floor((x - centerX) * this.transformScale + centerX);
        tileInfo.y = Math.floor((y - centerY) * this.transformScale + centerY);
        tileInfo.w = Math.ceil(s.width / ratio.x * this.transformScale);
        tileInfo.h = Math.ceil(s.height / ratio.y * this.transformScale);
        */

        tileInfo.x = ((x - centerX) * this.transformScale + centerX);
        tileInfo.y = ((y - centerY) * this.transformScale + centerY);
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
        let s;
        let ratio;
        if (this._hasValidScales()) {
            s = this.combinedScales[this.currentScaleIndex];
            ratio = this._getScaleRatio();
            const wh = this._getScreenImageSize();
            this.backgroundImage.style.width = wh.w + "px";
            this.backgroundImage.style.height = wh.h + "px";
        } else {
            s = this._getEmptyScaleInfo();
            ratio = {
                x: 1,
                y: 1
            };
            this.backgroundImage.style.width = "auto";
            this.backgroundImage.style.height = "auto";
        }
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
            if (this.options.hasOwnProperty('backgroundOpacity')) {
                opacity = Number(this.options.backgroundOpacity);
            }
            if (this.options.hasOwnProperty('backgroundVisible')) {
                if (String(this.options.backgroundVisible) === "false") {
                    display = "none";
                }
            }
        }

        this.backgroundImage.onerror = () => {
            this.backgroundImage.src = 'no_image.png';
            this.backgroundImage.removeAttribute('onerror');
        };
        this.backgroundImage.src = this._formatUrl(url);
        this.backgroundImage.style.left = left + "px";
        this.backgroundImage.style.top = top + "px";
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
            if (this.date) {
                url = url.replace(/%YYYY/g, this.date.getUTCFullYear());
                url = url.replace(/%MM/g, ("0" + (this.date.getUTCMonth() + 1)).slice(-2));
                url = url.replace(/%DD/g, ("0" + this.date.getUTCDate()).slice(-2));
                url = url.replace(/%hh/g, ("0" + this.date.getUTCHours()).slice(-2));
                if (this.options.geodeticSystem === "himawari8.jp") {
                    // ひまわりJPは2.5分ごとのデータ
                    const num150 = Math.floor((this.date.getUTCMinutes() * 60 + this.date.getUTCSeconds()) / 150);
                    const minutes = Math.floor((num150 * 150) / 60);
                    const second = (num150 * 150) % 60;
                    url = url.replace(/%mm/g, ("0" + minutes).slice(-2));
                    url = url.replace(/%ss/g, ("0" + second).slice(-2));
                } else if (this.options.geodeticSystem === "himawari8.fd") {
                    // ひまわりFDは10分ごとのデータ
                    const minutes = Math.floor(this.date.getUTCMinutes() / 10) * 10;
                    url = url.replace(/%mm/g, ("0" + minutes).slice(-2));
                    url = url.replace(/%ss/g, "00");
                } else {
                    url = url.replace(/%mm/g, ("0" + this.date.getUTCMinutes()).slice(-2));
                    url = url.replace(/%ss/g, ("0" + this.date.getUTCSeconds()).slice(-2));
                }
            } else {
                const date = new Date(Date.now());
                url = url.replace(/%YYYY/g, date.getUTCFullYear());
                url = url.replace(/%MM/g, ("0" + (date.getUTCMonth() + 1)).slice(-2));
                url = url.replace(/%DD/g, ("0" + date.getUTCDate()).slice(-2));
                url = url.replace(/%hh/g, ("0" + date.getUTCHours()).slice(-2));
                if (this.options.geodeticSystem === "himawari8.jp") {
                    // ひまわりは2.5分ごとのデータ
                    const num150 = Math.floor((date.getUTCMinutes() * 60 + date.getUTCSeconds()) / 150);
                    const minutes = Math.floor((num150 * 150) / 60);
                    const second = (num150 * 150) % 60;
                    url = url.replace(/%mm/g, ("0" + minutes).slice(-2));
                    url = url.replace(/%ss/g, ("0" + second).slice(-2));
                } else if (this.options.geodeticSystem === "himawari8.fd") {
                    // ひまわりFDは10分ごとのデータ
                    const minutes = Math.floor(date.getUTCMinutes() / 10) * 10;
                    url = url.replace(/%mm/g, ("0" + minutes).slice(-2));
                    url = url.replace(/%ss/g, "00");
                } else {
                    url = url.replace(/%mm/g, ("0" + date.getUTCMinutes()).slice(-2));
                    url = url.replace(/%ss/g, ("0" + date.getUTCSeconds()).slice(-2));
                }
            }

            if (tileInfo) {
                url = url.replace(/{x}/g, tileInfo.tx.toString());
                url = url.replace(/{y}/g, tileInfo.ty.toString());
                url = url.replace(/%x/g, tileInfo.tx.toString());
                url = url.replace(/%y/g, tileInfo.ty.toString());
                url = url.replace(/%ws/g, tileInfo.tw.toString());
                url = url.replace(/%hs/g, tileInfo.th.toString());
                url = url.replace(/%w/g, tileInfo.tw.toString());
                url = url.replace(/%h/g, tileInfo.th.toString());
                url = url.replace(/%c/g, count.toString());
            }
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
        const startIndex = this.options.hasOwnProperty('backgroundImage') ? 1 : 0;
        const s = this.options.maps[mapIndex].scales[tileInfo.scaleIndex];
        const tileClass = this._generateTileClass(mapIndex, tileInfo);
    
        // visibilityにより複数タイルのロード待ち中非表示とする
        let timeout = this.options.hasOwnProperty('timeout') ? this.options.timeout : this.timeout;
        if (this.isSettingDate) {
            timeout = this.options.hasOwnProperty('timeout_on_setting_date') ? this.options.timeout_on_setting_date : this.timeout_on_setting_date;
        }
        
        if (this._getRootElem().getElementsByClassName(tileClass).length > 0) {
            let elem = this._getRootElem().getElementsByClassName(tileClass)[0];
            const url =  this._formatUrl(this.options.maps[mapIndex].url, tileInfo, s.count, s.zoom);
            if (elem.src !== url) {
                if (timeout > 0) {
                    elem.style.display = "none";
                }
                elem.src = url;
            }
            elem.style.left = tileInfo.x + "px";
            elem.style.top = tileInfo.y + "px";
            elem.style.width = tileInfo.w + "px";
            elem.style.height = tileInfo.h + "px";
            elem.style.opacity = this.getOpacity(mapIndex);
            elem.style.display = this.getVisible(mapIndex) ? "inline" : "none";
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
            tile.style.opacity = this.getOpacity(mapIndex);
            tile.style.display = this.getVisible(mapIndex) ? "inline" : "none";
            
            if (timeout > 0) {
                tile.style.display = "none";
            }

            tile.onerror = () => {
                tile.src = 'no_image.png';
                tile.removeAttribute('onerror');
            };
            //tile.style.border = "1px solid gray";
            tile.style.boxSizing = "border-box";
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
    async _fillTileElements(mapIndex, tileMatrix, updateCancelFuncs) {
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

        const isTilesLoaded = () => {
            const targetLength = Math.floor(loadedElems.length);
            let loadedCount = 0;
            for (let i = 0; i < loadedElems.length; ++i) {
                loadedCount += (loadedElems[i].complete ? 1 : 0);
            }
            if (loadedCount >= targetLength) {
                return true;
            }
            return false;
        }

        const waitForLoad = new Promise(resolve => {
            let loadingHandle = null;
            updateCancelFuncs.push(() => {
                if (loadingHandle) {
                    clearInterval(loadingHandle);
                }
                resolve(false);
            });
            if (isTilesLoaded()) {
                if (loadingHandle) {
                    clearInterval(loadingHandle);
                }
                resolve(true);
                return;
            }
            loadingHandle = setInterval(() => {
                if (isTilesLoaded()) {
                    clearInterval(loadingHandle);
                    resolve(true);
                }
            }, 50);
            let timeout = this.options.hasOwnProperty('timeout') ? this.options.timeout : this.timeout;
            if (this.isSettingDate) {
                timeout = this.options.hasOwnProperty('timeout_on_setting_date') ? this.options.timeout_on_setting_date : this.timeout_on_setting_date;
            }
            setTimeout(() => {
                clearInterval(loadingHandle);
                resolve(true);
            }, timeout);
        });

        if (await waitForLoad) {
            for (let i = 0; i < loadedElems.length; ++i) {
                loadedElems[i].style.display = this.getVisible(mapIndex) ? "inline" : "none";
            }

            return loadedElems;
        }
        return null;
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

    // タイルのキャッシュを削除する
    // @param {Integer} mapIndex null以外が指定された場合は、特定のmapIndexのキャッシュのみ削除する
    _clearCache(mapIndex = null) {
        const rootElem = this._getRootElem();
        let tileElements = rootElem.children;
        for (let i = tileElements.length - 1; i >= 0; --i) {
            if (tileElements[i].id !== this.backgroundImageID) {
                if (mapIndex !== null) {
                    // 特定レイヤのキャッシュのみ削除
                    const pos = tileElements[i].className.indexOf('map_' + mapIndex);
                    if (pos >= 0) {
                        rootElem.removeChild(tileElements[i]);
                    }
                } else {
                    // 全キャッシュ削除
                    rootElem.removeChild(tileElements[i]);
                }
            }
        }
        if (this.loadingStatus !== "loading") {
            this.loadingStatus = "loading";
            this._dispatchLoadingStatus();
        }
    }

    // スケールインデックスの変更
    _setScaleIndex(scaleIndex) {
        if (this.isFixedScaleIndex) {
            return false;
        }
        if (this._hasValidScales(scaleIndex)) {
            if (this.currentScaleIndex !== scaleIndex) {
                this.currentScaleIndex = scaleIndex;
                this._dispatchScaleIndex();
                return true;
            }
        }
        return false;
    }

    // 位置の変更コールバックを発火させる
    // 位置が変更された場合必ず呼ぶ
    _dispatchPosition() {
        const event = new CustomEvent(TileViewer.EVENT_POSITION_CHANGED, { detail: this.getCameraInfo() });
        this.transformElem.dispatchEvent(event);
    }

    // scaleIndex変更コールバックを発火させる
    // scaleIndex変更された場合必ず呼ぶ
    _dispatchScaleIndex() {
        const event = new CustomEvent(TileViewer.EVENT_SCALE_INDEX_CHANGED, { detail: this.currentScaleIndex });
        this.transformElem.dispatchEvent(event);
    }

    // オプション変更コールバックを発火させる
    // オプションが変更された場合必ず呼ぶ
    _dispatchOptions() {
        const event = new CustomEvent(TileViewer.EVENT_OPTIONS_CHANGED, { detail: JSON.parse(JSON.stringify(this.options)) });
        this.transformElem.dispatchEvent(event);
    }

    // 読み込み状況変更コールバックを発火させる
    // 読み込み状況が変更された場合必ず呼ぶ
    // @param status 読み込み状況を示す文字列
    _dispatchLoadingStatus() {
        const event = new CustomEvent(TileViewer.EVENT_LOADING_STATUS_CHANGED, { detail: this.loadingStatus });
        this.transformElem.dispatchEvent(event);
    }

    // リサイズ時に画面中心を維持し、ビューの横方向が画面内に常に収まるように維持するように
    // スケーリングを行う
    async _resizeScaling(withDispatch = false) {
        await this._withUpdate(() => {
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
        });
    }

    // baseScaleCameraを元にcameraを再設定する。
    // baseScaleCameraを変更した場合に呼ぶ
    // cameraには、baseScaleCameraの中央を基点としたtransformScaleによるスケールがかかる
    _updateCameraFromBaseCamera(withDispatch = false) {
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
        const scales = this.options.maps[mapIndex].scales;
        if (this._hasValidScales(combindScaleIndex)) {
            const cs = this.combinedScales[combindScaleIndex];
            for (let i = 0; i < scales.length; ++i) {
                const s = scales[i];
                if (s.width * s.count > cs.total_width) {
                    return Math.max(0, i - 1);
                }
            }
        }
        return scales.length - 1;
    }

    _setZoomLevel(isFixedScaleIndex, scaleIndex) {
        if (this.isFixedScaleIndex != isFixedScaleIndex || (isFixedScaleIndex && this.currentScaleIndex != scaleIndex)) {
            console.log("setZoomLevel", this.isFixedScaleIndex, isFixedScaleIndex, this.currentScaleIndex, scaleIndex);
            // 一旦falseにしてscaleIndexを強制設定する
            const preFixed = this.isFixedScaleIndex;
            this.isFixedScaleIndex = false;
            this._setScaleIndex(scaleIndex);

            // isFixedScaleIndexを最新の値に設定
            this.isFixedScaleIndex = isFixedScaleIndex;
        }
    }

    // ある任意のピボット座標を中心とした、transformScaleによる拡縮を行う。
    // @param {*} scale 新たに設定するtransformScale
    // @param {*} pivotXY 拡縮の基点とするピボット（カメラ座標系で{x: .., y: .. }の形式
    async _setTransformScaleWithPivot(scale, pivotXY) {
        this._withUpdate(() => {
            this._disableUpdate();
            
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
            this._updateCameraFromBaseCamera(true);
        });
    }

    _getZoomBaseScale(isPlus = true) {
        if (this.options.geodeticSystem === "standard") {
            return 2;
        } else {
            return 1.1;
        }
    }


    _createStandardScaleEntries(width, height, minZoom, maxZoom) {
        let result = [];
        for (let i = minZoom; i <= maxZoom; ++i) {
            result.push({ width: width, height: height, count: Math.pow(2, i), zoom: i });
        }
        return result;
    }

    
    // 指定したfuncを実行し、最後にupdate()を行う。
    // updateFlagがfalseの場合はupdate()は行わない。
    // func内で、さらに_withUpdate()がネストして使用されていた場合、
    // 最初の_withUpdate()のupdate()のみ実行される。
    // 非同期で複数個所から同じタイミングで呼んだ場合は、それらのうち最も最初のupdate()のみ成功する。
    // @param {*} func 
    // @param {*} updateFlag 
     async _withUpdate(func, updateFlag = true) {
        const preUpdate = this.isDisableUpdate;
        try {
            this._disableUpdate();
            func();
        } catch(e) {
            throw e;
        } finally {
            this.isDisableUpdate = preUpdate;
            if (updateFlag) {
                await this.update();
            }
        }
    }

    // 現在のカメラを元にタイルを更新する
    async update() {
        if (this.isDisableUpdate) {
            return;
        }
        if (this.loadingStatus !== "loading") {
            this.loadingStatus = "loading";
            this._dispatchLoadingStatus();
        }
        
        for (let i = 0; i < this.updateCancelFuncs.length; ++i) {
            this.updateCancelFuncs[i]();
        }
        this.updateCancelFuncs = [];

        // 単一の背景画像の読み込みまたは非表示
        if (this.options.hasOwnProperty('backgroundImage')) {
            this._setBackgroundImage(this.options.backgroundImage);
        } else {
            this.backgroundImage.style.display = "none";
        }
        // 各mapのscalesに対して、それぞれ別のindexでアクセスし、
        // 各mapごとのtileエレメントのセット(tileMatrix)を作成して、画像で埋める
        if (this.options.hasOwnProperty('maps')) {
            let loadedElems = [];
            for (let i = 0; i < this.options.maps.length; ++i) {
                const scaleIndex = this._getMapScaleIndex(i, this.currentScaleIndex);
                const tileMatrix = this._prepareTileElements(i, scaleIndex);
                const tiles = await this._fillTileElements(i, tileMatrix, this.updateCancelFuncs);
                if (!tiles) {
                    // キャンセルされた
                    return;
                }
                Array.prototype.push.apply(loadedElems, tiles);
            }
            this._cullTileElements(loadedElems);
        }
        if (this.loadingStatus !== "loaded") {
            this.loadingStatus = "loaded";
            this._dispatchLoadingStatus();
        }
    }

    // this.optionを元に、新規に地図を読み込む
    // positionによりカメラ位置を指定する
    async create(position) {
        await this._withUpdate(() => {
            if (this.options.hasOwnProperty('initialPosition')) {
                position = this.options.initialPosition;
            }
                
            if (position) {
                // 位置情報による調整
                // 後の計算時に使用するため、先にscaleIndexを設定
                if (position.hasOwnProperty('scale')) {
                    //this._setScaleIndex(position.scale);
                }
                // 位置情報による調整
                if (position.hasOwnProperty('center')) {
                    // 4隅の座標は特に指定されていないので、
                    // 現在のtransformScaleを使用して画面サイズによる拡縮を行う
                    this._resizeScaling(false);

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
                        const degrees = position.center.degrees;
                        let lonLat = {
                            lon : null,
                            lat : null
                        };
                        if (degrees.hasOwnProperty('lon') && degrees.hasOwnProperty('lat')) {
                            lonLat.lon = Number(degrees.lon);
                            lonLat.lat = Number(degrees.lat);
                        } else if (degrees.hasOwnProperty('left') && degrees.hasOwnProperty('top')) {
                            lonLat.lon = Number(degrees.left);
                            lonLat.lat = Number(degrees.top);
                        }
                        if (lonLat.lon !== null && lonLat.lat !== null) {
                            let coord = null;
                            if (this.options.geodeticSystem === "standard") {
                                coord = TileViewer.convertStandardLonLatToCameraCoord(lonLat);
                            } else if (this.options.geodeticSystem === "himawari8.fd") {
                                coord = TileViewer.convertHimawariFDLonLatToCameraCoord(lonLat);
                            } else if (this.options.geodeticSystem === "himawari8.jp") {
                                coord = TileViewer.convertHimawariJPLonLatToCameraCoord(lonLat);
                            }
                            if (coord.x !== null && coord.y !== null) {
                                this.baseScaleCamera.x = Math.max(0.0, Math.min(1.0, coord.x)) - cameraW / 2;
                                this.baseScaleCamera.y = Math.max(0.0, Math.min(1.0, coord.y)) - cameraH / 2;
                            }
                        }

                        this.baseScaleCamera.w = cameraW;
                        this.baseScaleCamera.h = cameraH;
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
            this._resizeScaling(true);
            
            if (position && position.hasOwnProperty('scale')) {
                this._setScaleIndex(position.scale);
            }
        });
    }

    /**
     * ピクセル位置をカメラ位置に変換する
     * @param {*} pixelPos ピクセル位置\{x: , y:  \}
     * @returns カメラ位置\{x: , y:  \}
     */
    convertPixelPosToCameraCoord(pixelPos) {
        const rect = this.viewerElem.getBoundingClientRect();
        const viewerSize = this._getViewerSize();
        return {
            x: this.camera.x + this.camera.w * ((pixelPos.x - rect.left) / viewerSize.w),
            y: this.camera.y + this.camera.h * ((pixelPos.y - rect.top) / viewerSize.h),
        }
    }

    /**
     * カメラ位置をgeodeticSystem値に応じたlon, latに変換して返す
     * lon, latが存在しない場合はlon, latにnullを入れて返す
     * @param {*} coord カメラ位置\{x: , y:  \}
     * @returns 緯度経度\{lon: , lat:  \}
     */
    convertCameraCoordToLonLat(coord) {
        if (this.options.geodeticSystem === "himawari8.fd") {
            return TileViewer.convertCameraCoordToHimawariFDLonLat(coord);
        } else if (this.options.geodeticSystem === "himawari8.jp") {
            return TileViewer.convertCameraCoordToHimawariJPLonLat(coord);
        } else if (this.options.geodeticSystem === "standard") {
            return TileViewer.convertCameraCoordToStandardLonLat(coord);
        } else {
            return {
                lon : null,
                lat : null
            };
        }
    }

    /**
     * カメラを移動させる
     * @param {Object} mv { x : ..., y : ... } の形式で, 移動させる量をピクセル数で指定する.
     */
    async move(mv) {
        const screenImageSize = this._getScreenImageSize();
        const cameraSpaceMove = {
            x: mv.x / screenImageSize.w,
            y: mv.y / screenImageSize.h
        }
        this.baseScaleCamera.x -= cameraSpaceMove.x;
        this.baseScaleCamera.y -= cameraSpaceMove.y;
        this._updateCameraFromBaseCamera(true);
        await this.update();
    }

    /**
     * カメラのスケーリング値を変更する
     * @param {Number} scale baseScaleCameraに対するスケール値
     * @param {Boolean} withDispatch trueを指定した場合スケール変更イベントを発火させる
     * @returns 成功したかどうか
     */
    async setTransformScale(scale, withDispatch = false) {
        // 余りにも小さいスケールにしようとした場合は失敗とする
        if (scale < 0.1e-10) return false;

        await this._withUpdate(() => {
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
            
            const calcNextHalfX = () => {
                const nextS = this.combinedScales[this.currentScaleIndex + 1];
                const nextTotalX = (nextS.width * nextS.count);
                const currentS = this.combinedScales[this.currentScaleIndex];
                const currentTotalX = (currentS.width * currentS.count);
                const t = currentTotalX / (nextTotalX + currentTotalX);

                const nextX = this._getScaleRatio(null, this.currentScaleIndex + 1).x;
                const currentX = this._getScaleRatio(null, this.currentScaleIndex).x;
                return currentX + t * (nextX - currentX);
            }
            
            const calcPreHalfX = () => {
                const preS = this.combinedScales[this.currentScaleIndex - 1];
                const preTotalS = (preS.width * preS.count);
                const currentS = this.combinedScales[this.currentScaleIndex];
                const currentTotalX = (currentS.width * currentS.count);
                const t = currentTotalX / (preTotalS + currentTotalX);

                const currentX = this._getScaleRatio(null, this.currentScaleIndex).x;
                const preX = this._getScaleRatio(null, this.currentScaleIndex - 1).x;
                return currentX + t * (preX - currentX);
            }

            const calcNextIndexChangePoint = () => {
                if (SMOOTH_SCALING === true) {
                    return calcNextHalfX();
                } else {
                    return this._getScaleRatio(null, this.currentScaleIndex + 1).x
                }
            }
            
            const calcPreIndexChangePoint = () => {
                if (SMOOTH_SCALING === true) {
                    return calcPreHalfX();
                } else {
                    return this._getScaleRatio(null, this.currentScaleIndex).x
                }
            }

            while ((this.currentScaleIndex + 1 < this.combinedScales.length) &&
                scale >= calcNextIndexChangePoint()) {
                // LoDレベルを上げる
                if (!this._setScaleIndex(this.currentScaleIndex + 1)) {
                    break;
                }
            }
            while (this.currentScaleIndex > 0 &&
                scale < calcPreIndexChangePoint()) {
                // LoDレベルを下げる
                if (!this._setScaleIndex(this.currentScaleIndex - 1)) {
                    break;
                }
            }

            this._updateCameraFromBaseCamera(withDispatch);
        });
        return true;
    }

    _calcScalingFactor() {
        let  offset = 0;
        if (this.combinedScales.length > 0 && this.combinedScales[0].hasOwnProperty('zoom')) {
            offset = Math.max(0, this.combinedScales[0].zoom - 1);
            return Math.pow(this._getZoomBaseScale(), this.currentScaleIndex + offset);
        }
        if (this.combinedScales.length > 0) {
            const factor = this.combinedScales[this.currentScaleIndex].total_width / this.combinedScales[0].total_width * 0.3;
            return factor;
        }
        return Math.pow(this._getZoomBaseScale(), this.currentScaleIndex);
    }

    /**
     * ズームインする。
     * @param {Boolean} onlyLevel レベルのみ変更する場合はtrueとする
     * @param {Object} pixelPos 拡縮の中心とする座標（viewerElem上でのx, y。単位：ピクセル数)
     *                     nullの場合は画面中心で拡縮を行う。
     * @param {Number} speed ズームアウト時の速度に乗算される係数. onlyLevel = falseの場合にのみ有効. デフォルトは1.0.
     */
     async zoomIn(onlyLevel = false, pixelPos = null, speed = 1.0) {
        // mapがない場合などはズーム無効
        if (!this._hasValidScales()) {
            return false;
        }

        await this._withUpdate(() => {
            if (onlyLevel) {
                this._clearCache();
                this._setScaleIndex(this.currentScaleIndex + 1);
            } else if (pixelPos) {
                // ピクセルでの位置を、カメラ座標系に変換
                const pivotXY = this.convertPixelPosToCameraCoord(pixelPos);
                this._setTransformScaleWithPivot(this.transformScale + 0.5 * this._calcScalingFactor() * speed, pivotXY);
            } else {
                // 画面中心
                this.setTransformScale(this.transformScale + 0.05 * this._calcScalingFactor() * speed, true);
            }
        });
        return true;
    }

    /**
     * ズームアウトする。
     * @param {Boolean} onlyLevel レベルのみ変更する場合はtrueとする
     * @param {Object} pixelPos 拡縮の中心とする座標（viewerElem上でのx, y。単位：ピクセル数)
     *                     nullの場合は画面中心で拡縮を行う。
     * @param {Number} speed ズームアウト時の速度に乗算される係数. onlyLevel = falseの場合にのみ有効. デフォルトは1.0.
     */
    async zoomOut(onlyLevel = false, pixelPos = null, speed = 1.0) {
        // mapがない場合などはズーム無効
        if (!this._hasValidScales()) {
            return false;
        }
        await this._withUpdate(() => {
            this._disableUpdate();
                
            if (onlyLevel) {
                this._clearCache();
                this._setScaleIndex(this.currentScaleIndex - 1);
            } else if (pixelPos) {
                // ピクセルでの位置を、カメラ座標系に変換
                const pivotXY = this.convertPixelPosToCameraCoord(pixelPos);
                this._setTransformScaleWithPivot(this.transformScale - 0.5 * this._calcScalingFactor() * speed, pivotXY);
            } else {
                this.setTransformScale(this.transformScale - 0.05 * this._calcScalingFactor() * speed, true);
            }
        });
        return true;
    }

    /**
     * [left, top, right, bottom] の形式でViewportを設定する
     * Viewportは、現在のTileViewerの描画領域全体について
     * 左上(0,0), 右下(1,1)としたときの
     * 実際に表示する領域[left, top, right, bottom].
     * この領域外のタイルはカリングされる
     * @param {Array} viewport [left, top, right, bottom] の形式のViewport
     */
    async setViewport(viewport) {
        this.viewport = JSON.parse(JSON.stringify(viewport));
        await this.update();
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
        if (this._hasValidScales()) {
            if (this.combinedScales[this.currentScaleIndex].hasOwnProperty('zoom')) {
                return Number(this.combinedScales[this.currentScaleIndex].zoom);
            }
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
    async setCameraInfo(viewInfo) {
        await this._withUpdate(() => {
            // 固定ズームレベルの設定
            if (viewInfo.hasOwnProperty('fixedZoomLevel'))
            {
                if (viewInfo.hasOwnProperty('zoomLevel')) {
                    const scaleLen = this.combinedScales.length;
                    for (let i = 0; i < scaleLen; ++i) {
                        if (this.combinedScales[i].hasOwnProperty('zoom') &&
                            this.combinedScales[i].zoom == viewInfo.zoomLevel) {
                            this._setZoomLevel(viewInfo.fixedZoomLevel, i);
                        }
                    }
                } else if (viewInfo.hasOwnProperty('scaleIndex')) {
                    this._setZoomLevel(viewInfo.fixedZoomLevel, viewInfo.scaleIndex);
                }
            } 
                
            this.baseScaleCamera = JSON.parse(JSON.stringify(viewInfo.baseScaleCamera));
            this._updateCameraFromBaseCamera(false);
            this._setScaleIndex(viewInfo.scaleIndex);
            this.setTransformScale(viewInfo.transformScale, true);
            this._resizeScaling(true);
        });
    }

    /**
     * zoom率やgeodeticSystemに応じたscale設定を作成する
     * standardでは, zoom.minからzoom.maxまで、2の累乗で増えていくscale設定が作成される
     * himawari8.jp及びhimawari8.fdでは、予め用意されたscale設定を返す
     * himawari8.jp及びhimawari8.fdで、urlにcoastが含まれている場合、
     * 予め用意された海岸線用のscale設定を返す
     * @param {Object} mapParams options.maps内に記載されている1つのマップに対応したObject
     * @param {String} geodeticSystem 測地系の定義文字列
     * @returns scale設定
     */
    generateScales(mapParams, geodeticSystem) {
        if (mapParams.hasOwnProperty('scales')) {
            return JSON.parse(JSON.stringify(mapParams.scales));
        }
        if (geodeticSystem === "standard") {
            return this._createStandardScaleEntries(256, 256, mapParams.zoom.min, mapParams.zoom.max);
        }
        else if (geodeticSystem === "himawari8.jp") {
            if (mapParams.url.indexOf('coast') >= 0) {
                return [
                    { width: 300, height: 240, count: 1 },
                    { width: 420, height: 336, count: 1 },
                    { width: 600, height: 480, count: 1 },
                    { width: 840, height: 672, count: 1 },
                    { width: 600, height: 480, count: 2 },
                    { width: 840, height: 672, count: 2 },
                    { width: 600, height: 480, count: 3 },
                    { width: 600, height: 480, count: 4 },
                    { width: 600, height: 480, count: 5 },
                    { width: 720, height: 576, count: 5 },
                    { width: 1200, height: 960, count: 5 },
                    { width: 1680, height: 1344, count: 5 },
                    { width: 2400, height: 1920, count: 5 }
                ]
            } else {
                return [
                    { width: 600, height: 480, count: 1 },
                    { width: 600, height: 480, count: 2 },
                    { width: 600, height: 480, count: 3 },
                    { width: 600, height: 480, count: 4 },
                    { width: 600, height: 480, count: 5 }
                ]
            }

        } else if (geodeticSystem === "himawari8.fd") {
            if (mapParams.url.indexOf('coast') >= 0) {
                return [
                    { width: 275, height: 275, count: 1 },
                    { width: 385, height: 385, count: 1 },
                    { width: 550, height: 550, count: 1 },
                    { width: 770, height: 770, count: 1 },
                    { width: 550, height: 550, count: 2 },
                    { width: 770, height: 770, count: 2 },
                    { width: 550, height: 550, count: 4 },
                    { width: 770, height: 770, count: 4 },
                    { width: 550, height: 550, count: 8 },
                    { width: 770, height: 770, count: 8 },
                    { width: 550, height: 550, count: 16 },
                    { width: 550, height: 550, count: 20 }
                ]
            } else {
                return [
                    { width: 550, height: 550, count: 1 },
                    { width: 550, height: 550, count: 2 },
                    { width: 550, height: 550, count: 4 },
                    { width: 550, height: 550, count: 8 },
                    { width: 550, height: 550, count: 16 },
                    { width: 550, height: 550, count: 20 }
                ]
            }
        }
         return [];
    }

    /**
     * TileViewerの全オプション情報の設定
     * @param {Object} options 全オプション情報
     * @param {Boolean} withUpdate 更新するかどうか. falseを指定した場合は更新は行わない.
     */
    async setOptions(options, withUpdate = true) {
        console.log('setOptions', options)

        await this._withUpdate(() => {
            this.options = options;
            this._clearCache();

            let preCS = null;
            let preTotalWidth;
            if (this._hasValidScales()) {
                preCS = this.combinedScales[this.currentScaleIndex];
                preTotalWidth = preCS.width * preCS.count;
            }
            const preFixedScale = this.isFixedScaleIndex;

            // 古いものを削除してthis.combinedScalesを作り直す
            this.combinedScales = [];
            let visitedTotalWidth = [];
            if (options.hasOwnProperty('maps')) {
                // zoom率やgeodeticSystemからscaleを生成
                for (let i = 0; i < options.maps.length; ++i) {
                    let map = options.maps[i];
                    if (!map.hasOwnProperty('scales')) {
                        map.scales = this.generateScales(map, options.geodeticSystem);
                    }
                }

                // this.combinedScalesを作り直す
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
            // combinedScalesが増減した可能性があるので、
            // scaleIndexを再設定
            if (preCS) {
                for (let i = 0; i < this.combinedScales.length; ++i) {
                    const s = this.combinedScales[i];
                    if (s.width * s.count > preTotalWidth) {
                        this.isFixedScaleIndex = false;
                        this._setScaleIndex(Math.max(0, i - 1));
                        this.isFixedScaleIndex = preFixedScale;
                        break;
                    }
                }
            }

            this._dispatchOptions();
        }, withUpdate);
    }
    
    /**
     * 背景画像に対するopacityプロパティを設定し、更新する.
     * @param {Number} opacity  0.0~1.0
     * @param {Boolean} withUpdate 更新するかどうか. falseを指定した場合は更新は行わない.
     */
    async setBackgroundOpacity(opacity, withUpdate = true) {
        this.options.backgroundOpacity = opacity;
        if (withUpdate) {
            await this.update();
        }
    }

    /**
     * @returns 背景画像に対するopacityプロパティをを返す
     */
    getBackgroundOpacity() {
        if (this.options.hasOwnProperty('backgroundOpacity')) {
            return Number(this.options.backgroundOpacity);
        }
        return 1;
    }

    /**
     * 背景画像に対するvisibleプロパティを設定し、更新する.
     * @param {Boolean} visible trueまたはfalse
     * @param {Boolean} withUpdate 更新するかどうか. falseを指定した場合は更新は行わない.
     */
    async setBackgroundVisible(visible, withUpdate = true) {
        this.options.backgroundVisible = visible;
        if (withUpdate) {
            await this.update();
        }
    }

    /**
     * @returns 背景画像に対するvisibleプロパティをを返す
     */
    getBackgroundVisible() {
        if (this.options.hasOwnProperty('backgroundVisible')) {
            return this.options.backgroundVisible === "true";
        }
        return true;
    }

    /**
     * 指定したmapに対して、opacityプロパティを設定し、更新する.
     * @param {Integer} mapIndex this.options.mapsに対するインデックス
     * @param {Number} opacity  0.0~1.0
     * @param {Boolean} withUpdate 更新するかどうか. falseを指定した場合は更新は行わない.
     */
    async setOpacity(mapIndex, opacity, withUpdate = true) {
        // console.log("setOpacity", mapIndex, opacity)
        this.options.maps[mapIndex].opacity = opacity;
        if (withUpdate) {
            await this.update();
        }
    }

    /**
     * 指定したmapIndexのopacityプロパティを返す. 
     * mapIndexにopacityプロパティが存在しない場合はデフォルト値1が返る.
     * @param {Integer} mapIndex this.options.mapsに対するインデックス
     * @returns  指定したmapIndexのopacityプロパティ
     */
    getOpacity(mapIndex) {
        if (mapIndex >= 0 && mapIndex < this.options.maps.length) {
            const mapParam = this.options.maps[mapIndex];
            return mapParam.hasOwnProperty('opacity') ? Number(mapParam.opacity) : 1;
        }
        return 1;
    }

    /**
     * 指定したmapに対して、visibleプロパティを設定し、更新する.
     * @param {Integer} mapIndex this.options.mapsに対するインデックス
     * @param {Boolean} visible trueまたはfalse
     * @param {Boolean} withUpdate 更新するかどうか. falseを指定した場合は更新は行わない.
     */
    async setVisible(mapIndex, visible, withUpdate = true) {
        // console.log("setVisible", mapIndex, visible)
        this.options.maps[mapIndex].visible = visible;
        if (withUpdate) {
            await this.update();
        }
    }

    /**
     * 指定したmapIndexのvisibleプロパティを返す. 
     * mapIndexにvisibleプロパティが存在しない場合はデフォルト値trueが返る.
     * @param {Integer} mapIndex 
     * @returns 指定したmapIndexのvisibleプロパティ
     */
    getVisible(mapIndex) {
        if (mapIndex >= 0 && mapIndex < this.options.maps.length) {
            const mapParam = this.options.maps[mapIndex];
            if (mapParam.hasOwnProperty('visible') && String(mapParam.visible) === "false") {
                return false;
            }
        }
        return true;
    }

    /**
     * 日時を設定し、タイルを更新する
     * @param {Date} date 任意のDateオブジェクト
     */
    async setDate(date) {
        this.date = date;
    
        let hasDateContent = false;
        for (let i = 0; i < this.options.maps.length; ++i) {
            const map = this.options.maps[i];
            if (map.url.indexOf('%YYYY') >= 0 ||
                map.url.indexOf('%MM') >= 0 ||
                map.url.indexOf('%DD') >= 0 ||
                map.url.indexOf('%hh') >= 0 ||
                map.url.indexOf('%mm') >= 0 ||
                map.url.indexOf('%ss') >= 0) {
                    hasDateContent = true;
                    break;
            }
        }

        if (hasDateContent) {
            this.isSettingDate = true;
            await this._withUpdate(() => {
            });
            this.isSettingDate = false;
        }
    }

    /**
     * @returns 設定されている日付を返す
     */
    getDate() {
        return new Date(this.date.valueOf());
    }

    /**
     * @returns 設定されているオプションを返す
     */
    getOptions() {
        return JSON.parse(JSON.stringify(this.options));
    }

    /**
     * ウィンドウリサイズ時の自動スケール設定を有効にする
     */
    enableResizeScaling() {
        window.addEventListener('resize', this._resizeScaling);
    }

    /**
     * ウィンドウリサイズ時の自動スケール設定を無効にする
     */
    disableResizeScaling() {
        window.removeEventListener('resize', this._resizeScaling);
    }

    /**
     * ウィンドウに対してタイル表示が小さすぎる場合にスケールを停止させる機能を有効にする
     */
    enableLimitOfMinimumScale() {
        this.isEnableLimitOfMinimumScale = true;
    }

    /**
     * ウィンドウに対してタイル表示が小さすぎる場合にスケールを停止させる機能を無効にする
     */
    disableLimitOfMinimumScale() {
        this.isEnableLimitOfMinimumScale = false;
    }

    /**
     * イベントリスナーを追加する
     * @param {String} eventName イベント名。TileViewer.EVENT_～を参照
     * @param {Function} callback イベント発生時のコールバック関数
     * @returns 追加に成功したかどうか
     */
    addEventListener(eventName, callback) {
        if (this.transformElem) {
            this.callbackDict[callback] = (ev) => {
                callback(ev.detail);
            };
            this.transformElem.addEventListener(eventName, this.callbackDict[callback]);
            return true;
        }
        return false;
    }

    /**
     * イベントリスナーを削除する
     * @param {String} eventName イベント名。TileViewer.EVENT_～を参照
     * @param {Function} callback イベントのコールバック関数。
     *                     nullを指定した場合は対象イベント名のすべてのコールバックが削除される。
     * @returns 削除に成功したかどうか
     */
    removeEventListener(eventName, callback = null) {
        if (callback === null) {
            this.transformElem.removeEventListener(eventName);
            // TODO this.callbackDictから消せるようにする
            return true;
        } else if (this.callbackDict.hasOwnProperty(callback)) {
            this.transformElem.removeEventListener(eventName, this.callbackDict[callback]);
            return true;
        }
        return false;
    }
}

const DEGTORAD = (Math.PI / 180.0);
const RADTODEG = (180.0 / Math.PI);

/**
 * メルカトル座標系における経度緯度をカメラ座標に変換して返す
 * @param {Object} lonLat \{ lon: , lat : \}の形式でdegree値. 
 *                   経度は -180～180,  緯度は-90~90を想定.
 * @returns カメラ座標 \{ x:  , y:  \}の形式で、xは0～1, 
 * y値については、0~1 であるが、メルカトル座標に収まらない緯度の場合は0未満または1より大きい値となる
 */
TileViewer.convertStandardLonLatToCameraCoord = (lonLat) => {
    let lon = lonLat.lon;
    let lat = lonLat.lat;
    while (lon > 180.0) { lon -= 360.0; } // [deg]
    while (lon < -180.0) { lon += 360.0; } // [deg]
    let x = lon / 360 + 0.5;
    const y = Math.log(Math.tan((90 + lat) * DEGTORAD / 2)) / Math.PI;
    return { x : x, y : 1.0 - (y + 1) / 2 };
};

/**
 * カメラ座標を、メルカトル座標系における経度緯度に変換して返す
 * @param {Object} coord \{ x:  , y:  \}の形式でカメラ座標値. 
 * @returns 経度緯度\{ lon: , lat : \}の形式でdegree値. 
 */
TileViewer.convertCameraCoordToStandardLonLat = (coord) => {
    let x = coord.x * 2 - 1;  // -1 ~ +1
    let y = coord.y * 2 - 1;  // -1 ~ +1
    const lon = x * 180;
    const lat = -(Math.atan(Math.exp(y * Math.PI)) * 2 * RADTODEG - 90); 
    return { lon: lon, lat : lat };
};

const SCLUNIT = 1.525878906250000e-05; 	// (= 2^-16)  scaling function 
const Rs = 42164;
const Req =  6378.1370;
const Rpol =  6356.7523;
const Rval11 =  0.00669438444;
const Rval12 =  0.993305616;
const Rval13 =  1.006739501;
const sub_lon = 140.7;
// band5~16の5500x5500の値を使用して計算
// 最後に5500で割って0~1にして返す
const COFF = 2750.5;
const LOFF = 2750.5;
const LFAC = 20466275;
const CFAC = 20466275;
const Sd = 1737122264;

/**
 * ひまわり8号 フルディスクを想定した緯度経度座標を、カメラ座標に変換して返す
 * @param {Object} lonLat 経度緯度\{ lon: , lat : \}の形式でdegree値. 
 * @returns カメラ座標 \{ x:  , y:  \}の形式
 * x, y値は、0~1 であるが、フルディスクに収まらない緯度経度の場合はnullとなる
 */
TileViewer.convertHimawariFDLonLatToCameraCoord = (lonLat) => {

    let lon = lonLat.lon;
    let lat = lonLat.lat;
    // (1) init
    // invalid value
    const invalidValue = {
        x : null,
        y : null
    }; 
    // (2) check latitude
    if (lat < -90.0 || 90.0 < lat) {
        console.error("invalid lat", lat);
        return invalidValue;
    }
    // (3) check longitude
    while (lon > 180.0) { lon -= 360.0; } // [deg]
    while (lon < -180.0) { lon += 360.0; } // [deg]
    // (4) degree to radian
    lon = lon * DEGTORAD; // [rad]
    lat = lat * DEGTORAD; // [rad]
    // (5) geocentric latitude
    // Global Specification 4.4.3.2
    // phi = arctan( (Rpol^2)/(Req^2) * tan(lat) )
    // 
    // (Rpol^2)/(Req^2) =Rval12
    const phi = Math.atan(Rval12 * Math.tan(lat));
    // (6) The length of Re
    // Re = (Rpol) / sqrt( 1 - (Req^2 - Rpol^2) / Req^2 * cos^2(phi) )
    //
    // Rpol = Rpol
    // (Req^2 - Rpol^2) / Req^2 = Rval11
    const Re = (Rpol) / Math.sqrt(1 - Rval11 * Math.cos(phi) * Math.cos(phi));
    // (7) The cartesian components of the vector rs result as follows:
    // r1 = h - Re * cos(phi) * cos(Le-Ld)
    // r2 =    -Re * cos(phi) * sin(Le-Ld)
    // r3 =     Re * sin(phi)
    //
    // Le : longitude
    // Ld : sub_lon = sub_lon
    // h  : distance from Earth's center to satellite (=Rs)
    const r1 = Rs - Re * Math.cos(phi) * Math.cos(lon - sub_lon * DEGTORAD);
    const r2 = - Re * Math.cos(phi) * Math.sin(lon - sub_lon * DEGTORAD);
    const r3 = Re * Math.sin(phi);
    // (8) check seeablibity
    //	double vx = Re * cos(phi) * cos( lon - sub_lon * DEGTORAD );
    //	if(0 < -r1 * vx - r2 * r2 + r3 * r3){
    //		return(ERROR_END);
    //	}
    if (0 < (r1 * (r1 - Rs) + (r2 * r2) + (r3 * r3))) {
        return invalidValue;
    }
    // (9) The projection function is as follows:
    // x  = arctan(-r2/r1)
    // y  = arcsin(r3/rn)
    // rn = sqrt(r1^2 + r2^2 + r3^2)
    const rn = Math.sqrt(r1 * r1 + r2 * r2 + r3 * r3);
    const x = Math.atan2(-r2, r1) * RADTODEG;
    const y = Math.asin(-r3 / rn) * RADTODEG;
    // (10)
    // Global Specification 4.4.4
    // c  = COFF + nint(x * 2^-16 * CFAC)
    // l  = LOFF + nint(y * 2^-16 * LFAC)
    const c = (COFF + x * SCLUNIT * CFAC) / 5500;
    const l = (LOFF + y * SCLUNIT * LFAC) / 5500;
    return {
        x : c,
        y : l
    };
};

/**
 * カメラ座標を、ひまわり8号 フルディスクを想定した緯度経度座標に変換して返す
 * @param {Object} coord カメラ座標 \{ x:  , y:  \}の形式
 * @returns 経度緯度\{ lon: , lat : \}の形式でdegree値. 
 * lon, lat値は、無効である場合nullが入る
 */
TileViewer.convertCameraCoordToHimawariFDLonLat = (coord) => {
    // invalid value
    const invalidValue = {
        lon : null,
        lat : null
    }; 
    let c = coord.x * 5500;
    let l = coord.y * 5500;
    // (2) the intermediate coordinates (x,y)
    // Global Specification 4.4.4 Scaling Function 
    //    c = COFF + nint(x * 2^-16 * CFAC)
    //    l = LOFF + nint(y * 2^-16 * LFAC)
    // The intermediate coordinates (x,y) are as follows :
    //    x = (c -COFF) / (2^-16 * CFAC)
    //    y = (l -LOFF) / (2^-16 * LFAC)
    //    SCLUNIT = 2^-16
    const x = DEGTORAD * (c - COFF) / (SCLUNIT * CFAC);
    const y = DEGTORAD * (l - LOFF) / (SCLUNIT * LFAC);
    // (3) longtitude,latitude
    // Global Specification 4.4.3.2
    // The invers projection function is as follows : 
    //   lon = arctan(S2/S1) + sub_lon
    //   lat = arctan( (Req^2/Rpol^2) * S3 / Sxy )
    // 
    // Thererin the variables S1,S2,S3,Sxy are as follows :
    //    S1  = Rs - Sn * cos(x) * cos(y)
    //    S2  = Sn * sin(x) * cos(y)
    //    S3  =-Sn * sin(y)
    //    Sxy = sqrt(S1^2 + S2^2)
    //    Sn  =(Rs * cos(x) * cos(y) - Sd ) /
    //         (cos(y) * cos(y) + (Req^2/Rpol^2) * sin(y) * sin(y))
    //    Sd  =sqrt( (Rs * cos(x) * cos(y))^2
    //               - ( cos(y) * cos(y) + (Req^2/Rpol^2) * sin(y) * sin(y) )
    //               * (Rs^2 - Req^2)
    // The variables Rs,Rpol,Req,(Req^2/Rpol^2),(Rs^2 - Req^2) are as follows :
    //    Rs  : distance from Earth center to satellite= Rs
    //    Rpol: polar radius of the Earth              = Rpol
    //    Req : equator raidus of the Earth            = Req
    //    (Req^2/Rpol^2)                               = Rval13
    //    (Rs^2 - Req^2)                               = Sd
    let sd = (Rs * Math.cos(x) * Math.cos(y)) *
        (Rs * Math.cos(x) * Math.cos(y)) -
        (Math.cos(y) * Math.cos(y) + Rval13 * Math.sin(y) * Math.sin(y)) *
        Sd;
    if (sd < 0) {
        return invalidValue;
    } else {
        sd = Math.sqrt(sd);
    }
    const Sn = (Rs * Math.cos(x) * Math.cos(y) - sd) /
                 (Math.cos(y) * Math.cos(y) + Rval13 * Math.sin(y) * Math.sin(y));
    const S1 = Rs - (Sn * Math.cos(x) * Math.cos(y));
    const S2 = Sn * Math.sin(x) * Math.cos(y);
    const S3 = -Sn * Math.sin(y);
    const Sxy = Math.sqrt(S1 * S1 + S2 * S2);

    let lon = RADTODEG * Math.atan2(S2, S1) + sub_lon;
    let lat = RADTODEG * Math.atan(Rval13 * S3 / Sxy);

    //(4) check longtitude
    while (lon > 180.0) { lon = lon - 360.0; }
    while (lon < -180.0) { lon = lon + 360.0; }

    return {
        lon: lon,
        lat: lat
    }
};

/**
 * ひまわり8号 日本域を想定した緯度経度座標を、カメラ座標に変換して返す
 * https://www.data.jma.go.jp/suishin/jyouhou/pdf/456.pdf
 * 日本域は、北緯 48.5 度から北緯 21.5 度、東経 119 度から東経 152 度
 * 投影方法：緯度経度座標、測地系はWGS84に準拠 
 * @param {Object} lonLat 経度緯度\{ lon: , lat : \}}の形式でdegree値. 
 * @returns カメラ座標 \{ x:  , y:  \}の形式
 * x, y値は、0~1 であるが、日本域に収まらない緯度経度の場合は0未満または1より大きい値となる
 */
TileViewer.convertHimawariJPLonLatToCameraCoord = (lonLat) => {
    let lon = lonLat.lon;
    let lat = lonLat.lat;
    while (lon > 180.0) { lon -= 360.0; }
    while (lon < -180.0) { lon += 360.0; }
    const x = (lon - 119.0) / (152.0 - 119.0);
    const y = (1 - (lat -  21.5) / ( 48.5 -  21.5));
    return {
        x : x,
        y : y
    }
};

/**
 * カメラ座標を、ひまわり8号 日本域を想定した緯度経度に変換して返す
 * https://www.data.jma.go.jp/suishin/jyouhou/pdf/456.pdf
 * 日本域は、北緯 48.5 度から北緯 21.5 度、東経 119 度から東経 152 度
 * 投影方法：緯度経度座標、測地系はWGS84に準拠 
 * @param {Object} coord カメラ座標 \{ x:  , y:  \}の形式
 * @returns カメラ座標 \{ lon: , lat : \}の形式
 * lon, lat値は、無効である場合nullが入る
 */

TileViewer.convertCameraCoordToHimawariJPLonLat = (coord) => {
    const lon = coord.x * (152.0 - 119.0) + 119.0;
    const lat = (1 - coord.y) * (48.5 - 21.5) + 21.5;
    return {
        lon : (lon < 119 || lon > 152) ? null : lon,
        lat : (lat < 21.5 || lat > 48.5) ? null : lat
    };
};

TileViewer.EVENT_POSITION_CHANGED = 'position_changed';
TileViewer.EVENT_SCALE_INDEX_CHANGED = 'scale_index_changed';
TileViewer.EVENT_OPTIONS_CHANGED = 'options_changed';
TileViewer.EVENT_LOADING_STATUS_CHANGED = 'loading_status_changed';

window.TileViewer = TileViewer;