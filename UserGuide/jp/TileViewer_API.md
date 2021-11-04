<a name="TileViewer"></a>

## TileViewer
TileViewer

**Kind**: global class  

* [TileViewer](#TileViewer)
    * _instance_
        * [.convertPixelPosToCameraCoord(pixelPos)](#TileViewer+convertPixelPosToCameraCoord) ⇒
        * [.convertCameraCoordToLonLat(coord)](#TileViewer+convertCameraCoordToLonLat) ⇒
        * [.move(mv)](#TileViewer+move)
        * [.setTransformScale(scale, withDispatch)](#TileViewer+setTransformScale) ⇒
        * [.zoomIn(onlyLevel, pixelPos)](#TileViewer+zoomIn)
        * [.zoomOut(onlyLevel, pixelPos)](#TileViewer+zoomOut)
        * [.setViewport(viewport)](#TileViewer+setViewport)
        * [.getViewport()](#TileViewer+getViewport) ⇒
        * [.getZoomLevel()](#TileViewer+getZoomLevel)
        * [.getCameraInfo()](#TileViewer+getCameraInfo) ⇒
        * [.setCameraInfo()](#TileViewer+setCameraInfo)
        * [.generateScales(mapParams, geodeticSystem)](#TileViewer+generateScales) ⇒
        * [.setOptions(options, withUpdate)](#TileViewer+setOptions)
        * [.setBackgroundOpacity(opacity, withUpdate)](#TileViewer+setBackgroundOpacity)
        * [.getBackgroundOpacity()](#TileViewer+getBackgroundOpacity) ⇒
        * [.setBackgroundVisible(visible, withUpdate)](#TileViewer+setBackgroundVisible)
        * [.getBackgroundVisible()](#TileViewer+getBackgroundVisible) ⇒
        * [.setOpacity(mapIndex, opacity, withUpdate)](#TileViewer+setOpacity)
        * [.getOpacity(mapIndex)](#TileViewer+getOpacity) ⇒
        * [.setVisible(mapIndex, visible, withUpdate)](#TileViewer+setVisible)
        * [.getVisible(mapIndex)](#TileViewer+getVisible) ⇒
        * [.setDate(date)](#TileViewer+setDate)
        * [.getDate()](#TileViewer+getDate) ⇒
        * [.getOptions()](#TileViewer+getOptions) ⇒
        * [.enableResizeScaling()](#TileViewer+enableResizeScaling)
        * [.disableResizeScaling()](#TileViewer+disableResizeScaling)
        * [.enableLimitOfMinimumScale()](#TileViewer+enableLimitOfMinimumScale)
        * [.disableLimitOfMinimumScale()](#TileViewer+disableLimitOfMinimumScale)
        * [.addEventListener(eventName, callback)](#TileViewer+addEventListener) ⇒
        * [.removeEventListener(eventName, callback)](#TileViewer+removeEventListener) ⇒
    * _static_
        * [.convertStandardLonLatToCameraCoord(lonLat)](#TileViewer.convertStandardLonLatToCameraCoord) ⇒
        * [.convertCameraCoordToStandardLonLat(coord)](#TileViewer.convertCameraCoordToStandardLonLat) ⇒
        * [.convertHimawariFDLonLatToCameraCoord(lonLat)](#TileViewer.convertHimawariFDLonLatToCameraCoord) ⇒
        * [.convertCameraCoordToHimawariFDLonLat(coord)](#TileViewer.convertCameraCoordToHimawariFDLonLat) ⇒
        * [.convertHimawariJPLonLatToCameraCoord(lonLat)](#TileViewer.convertHimawariJPLonLatToCameraCoord) ⇒
        * [.convertCameraCoordToHimawariJPLonLat(coord)](#TileViewer.convertCameraCoordToHimawariJPLonLat) ⇒

<a name="TileViewer+convertPixelPosToCameraCoord"></a>

### tileViewer.convertPixelPosToCameraCoord(pixelPos) ⇒
ピクセル位置をカメラ位置に変換する

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: カメラ位置\{x: , y:  \}  

| Param | Type | Description |
| --- | --- | --- |
| pixelPos | <code>\*</code> | ピクセル位置\{x: , y:  \} |

<a name="TileViewer+convertCameraCoordToLonLat"></a>

### tileViewer.convertCameraCoordToLonLat(coord) ⇒
カメラ位置をgeodeticSystem値に応じたlon, latに変換して返すlon, latが存在しない場合はlon, latにnullを入れて返す

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: 緯度経度\{lon: , lat:  \}  

| Param | Type | Description |
| --- | --- | --- |
| coord | <code>\*</code> | カメラ位置\{x: , y:  \} |

<a name="TileViewer+move"></a>

### tileViewer.move(mv)
カメラを移動させる

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  

| Param | Type | Description |
| --- | --- | --- |
| mv | <code>Object</code> | { x : ..., y : ... } の形式で, 移動させる量をピクセル数で指定する. |

<a name="TileViewer+setTransformScale"></a>

### tileViewer.setTransformScale(scale, withDispatch) ⇒
カメラのスケーリング値を変更する

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: 成功したかどうか  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| scale | <code>Number</code> |  | baseScaleCameraに対するスケール値 |
| withDispatch | <code>Boolean</code> | <code>false</code> | trueを指定した場合スケール変更イベントを発火させる |

<a name="TileViewer+zoomIn"></a>

### tileViewer.zoomIn(onlyLevel, pixelPos)
ズームインする。

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| onlyLevel | <code>Boolean</code> | <code>false</code> | レベルのみ変更する場合はtrueとする |
| pixelPos | <code>Object</code> | <code></code> | 拡縮の中心とする座標（viewerElem上でのx, y。単位：ピクセル数)                     nullの場合は画面中心で拡縮を行う。 |

<a name="TileViewer+zoomOut"></a>

### tileViewer.zoomOut(onlyLevel, pixelPos)
ズームアウトする。

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| onlyLevel | <code>Boolean</code> | <code>false</code> | レベルのみ変更する場合はtrueとする |
| pixelPos | <code>Object</code> | <code></code> | 拡縮の中心とする座標（viewerElem上でのx, y。単位：ピクセル数)                     nullの場合は画面中心で拡縮を行う。 |

<a name="TileViewer+setViewport"></a>

### tileViewer.setViewport(viewport)
[left, top, right, bottom] の形式でViewportを設定するViewportは、現在のTileViewerの描画領域全体について左上(0,0), 右下(1,1)としたときの実際に表示する領域[left, top, right, bottom].この領域外のタイルはカリングされる

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  

| Param | Type | Description |
| --- | --- | --- |
| viewport | <code>Array</code> | [left, top, right, bottom] の形式のViewport |

<a name="TileViewer+getViewport"></a>

### tileViewer.getViewport() ⇒
**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: viewportを返す  
<a name="TileViewer+getZoomLevel"></a>

### tileViewer.getZoomLevel()
ズームレベルがscalesに定義されている場合は、現在のズームレベルを返すズームレベルが定義されていない場合は, -1を返す

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
<a name="TileViewer+getCameraInfo"></a>

### tileViewer.getCameraInfo() ⇒
スケール等を含んだカメラ情報を返す。この値を取得し、setCameraInfoを呼ぶことで、見た目を完全に再現させることができる。ただし、ビューポートは別途取得する必要がある。

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: スケールをすべて含んだカメラ情報  
<a name="TileViewer+setCameraInfo"></a>

### tileViewer.setCameraInfo()
スケール等含んだカメラ情報をセットする。getCameraInfoで得られた値を引数に入れることで、カメラ位置を復元できる。ただし、ビューポートは別途指定する必要がある。

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
<a name="TileViewer+generateScales"></a>

### tileViewer.generateScales(mapParams, geodeticSystem) ⇒
zoom率やgeodeticSystemに応じたscale設定を作成するstandardでは, zoom.minからzoom.maxまで、2の累乗で増えていくscale設定が作成されるhimawari8.jp及びhimawari8.fdでは、予め用意されたscale設定を返すhimawari8.jp及びhimawari8.fdで、urlにcoastが含まれている場合、予め用意された海岸線用のscale設定を返す

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: scale設定  

| Param | Type | Description |
| --- | --- | --- |
| mapParams | <code>Object</code> | options.maps内に記載されている1つのマップに対応したObject |
| geodeticSystem | <code>String</code> | 測地系の定義文字列 |

<a name="TileViewer+setOptions"></a>

### tileViewer.setOptions(options, withUpdate)
TileViewerの全オプション情報の設定

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | 全オプション情報 |
| withUpdate | <code>Boolean</code> | <code>true</code> | 更新するかどうか. falseを指定した場合は更新は行わない. |

<a name="TileViewer+setBackgroundOpacity"></a>

### tileViewer.setBackgroundOpacity(opacity, withUpdate)
背景画像に対するopacityプロパティを設定し、更新する.

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| opacity | <code>Number</code> |  | 0.0~1.0 |
| withUpdate | <code>Boolean</code> | <code>true</code> | 更新するかどうか. falseを指定した場合は更新は行わない. |

<a name="TileViewer+getBackgroundOpacity"></a>

### tileViewer.getBackgroundOpacity() ⇒
**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: 背景画像に対するopacityプロパティをを返す  
<a name="TileViewer+setBackgroundVisible"></a>

### tileViewer.setBackgroundVisible(visible, withUpdate)
背景画像に対するvisibleプロパティを設定し、更新する.

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| visible | <code>Boolean</code> |  | trueまたはfalse |
| withUpdate | <code>Boolean</code> | <code>true</code> | 更新するかどうか. falseを指定した場合は更新は行わない. |

<a name="TileViewer+getBackgroundVisible"></a>

### tileViewer.getBackgroundVisible() ⇒
**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: 背景画像に対するvisibleプロパティをを返す  
<a name="TileViewer+setOpacity"></a>

### tileViewer.setOpacity(mapIndex, opacity, withUpdate)
指定したmapに対して、opacityプロパティを設定し、更新する.

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| mapIndex | <code>Integer</code> |  | this.options.mapsに対するインデックス |
| opacity | <code>Number</code> |  | 0.0~1.0 |
| withUpdate | <code>Boolean</code> | <code>true</code> | 更新するかどうか. falseを指定した場合は更新は行わない. |

<a name="TileViewer+getOpacity"></a>

### tileViewer.getOpacity(mapIndex) ⇒
指定したmapIndexのopacityプロパティを返す. mapIndexにopacityプロパティが存在しない場合はデフォルト値1が返る.

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: 指定したmapIndexのopacityプロパティ  

| Param | Type | Description |
| --- | --- | --- |
| mapIndex | <code>Integer</code> | this.options.mapsに対するインデックス |

<a name="TileViewer+setVisible"></a>

### tileViewer.setVisible(mapIndex, visible, withUpdate)
指定したmapに対して、visibleプロパティを設定し、更新する.

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| mapIndex | <code>Integer</code> |  | this.options.mapsに対するインデックス |
| visible | <code>Boolean</code> |  | trueまたはfalse |
| withUpdate | <code>Boolean</code> | <code>true</code> | 更新するかどうか. falseを指定した場合は更新は行わない. |

<a name="TileViewer+getVisible"></a>

### tileViewer.getVisible(mapIndex) ⇒
指定したmapIndexのvisibleプロパティを返す. mapIndexにvisibleプロパティが存在しない場合はデフォルト値trueが返る.

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: 指定したmapIndexのvisibleプロパティ  

| Param | Type |
| --- | --- |
| mapIndex | <code>Integer</code> | 

<a name="TileViewer+setDate"></a>

### tileViewer.setDate(date)
日時を設定し、タイルを更新する

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  

| Param | Type | Description |
| --- | --- | --- |
| date | <code>Date</code> | 任意のDateオブジェクト |

<a name="TileViewer+getDate"></a>

### tileViewer.getDate() ⇒
**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: 設定されている日付を返す  
<a name="TileViewer+getOptions"></a>

### tileViewer.getOptions() ⇒
**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: 設定されているオプションを返す  
<a name="TileViewer+enableResizeScaling"></a>

### tileViewer.enableResizeScaling()
ウィンドウリサイズ時の自動スケール設定を有効にする

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
<a name="TileViewer+disableResizeScaling"></a>

### tileViewer.disableResizeScaling()
ウィンドウリサイズ時の自動スケール設定を無効にする

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
<a name="TileViewer+enableLimitOfMinimumScale"></a>

### tileViewer.enableLimitOfMinimumScale()
ウィンドウに対してタイル表示が小さすぎる場合にスケールを停止させる機能を有効にする

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
<a name="TileViewer+disableLimitOfMinimumScale"></a>

### tileViewer.disableLimitOfMinimumScale()
ウィンドウに対してタイル表示が小さすぎる場合にスケールを停止させる機能を無効にする

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
<a name="TileViewer+addEventListener"></a>

### tileViewer.addEventListener(eventName, callback) ⇒
イベントリスナーを追加する

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: 追加に成功したかどうか  

| Param | Type | Description |
| --- | --- | --- |
| eventName | <code>String</code> | イベント名。TileViewer.EVENT_～を参照 |
| callback | <code>function</code> | イベント発生時のコールバック関数 |

<a name="TileViewer+removeEventListener"></a>

### tileViewer.removeEventListener(eventName, callback) ⇒
イベントリスナーを削除する

**Kind**: instance method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: 削除に成功したかどうか  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| eventName | <code>String</code> |  | イベント名。TileViewer.EVENT_～を参照 |
| callback | <code>function</code> | <code></code> | イベントのコールバック関数。                     nullを指定した場合は対象イベント名のすべてのコールバックが削除される。 |

<a name="TileViewer.convertStandardLonLatToCameraCoord"></a>

### TileViewer.convertStandardLonLatToCameraCoord(lonLat) ⇒
メルカトル座標系における経度緯度をカメラ座標に変換して返す

**Kind**: static method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: カメラ座標 \{ x:  , y:  \}の形式で、xは0～1, y値については、0~1 であるが、メルカトル座標に収まらない緯度の場合は0未満または1より大きい値となる  

| Param | Type | Description |
| --- | --- | --- |
| lonLat | <code>Object</code> | \{ lon: , lat : \}の形式でdegree値.                    経度は -180～180,  緯度は-90~90を想定. |

<a name="TileViewer.convertCameraCoordToStandardLonLat"></a>

### TileViewer.convertCameraCoordToStandardLonLat(coord) ⇒
カメラ座標を、メルカトル座標系における経度緯度に変換して返す

**Kind**: static method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: 経度緯度\{ lon: , lat : \}の形式でdegree値.  

| Param | Type | Description |
| --- | --- | --- |
| coord | <code>Object</code> | \{ x:  , y:  \}の形式でカメラ座標値. |

<a name="TileViewer.convertHimawariFDLonLatToCameraCoord"></a>

### TileViewer.convertHimawariFDLonLatToCameraCoord(lonLat) ⇒
ひまわり8号 フルディスクを想定した緯度経度座標を、カメラ座標に変換して返す

**Kind**: static method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: カメラ座標 \{ x:  , y:  \}の形式x, y値は、0~1 であるが、フルディスクに収まらない緯度経度の場合はnullとなる  

| Param | Type | Description |
| --- | --- | --- |
| lonLat | <code>Object</code> | 経度緯度\{ lon: , lat : \}の形式でdegree値. |

<a name="TileViewer.convertCameraCoordToHimawariFDLonLat"></a>

### TileViewer.convertCameraCoordToHimawariFDLonLat(coord) ⇒
カメラ座標を、ひまわり8号 フルディスクを想定した緯度経度座標に変換して返す

**Kind**: static method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: 経度緯度\{ lon: , lat : \}の形式でdegree値. lon, lat値は、無効である場合nullが入る  

| Param | Type | Description |
| --- | --- | --- |
| coord | <code>Object</code> | カメラ座標 \{ x:  , y:  \}の形式 |

<a name="TileViewer.convertHimawariJPLonLatToCameraCoord"></a>

### TileViewer.convertHimawariJPLonLatToCameraCoord(lonLat) ⇒
ひまわり8号 日本域を想定した緯度経度座標を、カメラ座標に変換して返すhttps://www.data.jma.go.jp/suishin/jyouhou/pdf/456.pdf日本域は、北緯 48.5 度から北緯 21.5 度、東経 119 度から東経 152 度投影方法：緯度経度座標、測地系はWGS84に準拠

**Kind**: static method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: カメラ座標 \{ x:  , y:  \}の形式x, y値は、0~1 であるが、日本域に収まらない緯度経度の場合は0未満または1より大きい値となる  

| Param | Type | Description |
| --- | --- | --- |
| lonLat | <code>Object</code> | 経度緯度\{ lon: , lat : \}}の形式でdegree値. |

<a name="TileViewer.convertCameraCoordToHimawariJPLonLat"></a>

### TileViewer.convertCameraCoordToHimawariJPLonLat(coord) ⇒
カメラ座標を、ひまわり8号 日本域を想定した緯度経度に変換して返すhttps://www.data.jma.go.jp/suishin/jyouhou/pdf/456.pdf日本域は、北緯 48.5 度から北緯 21.5 度、東経 119 度から東経 152 度投影方法：緯度経度座標、測地系はWGS84に準拠

**Kind**: static method of [<code>TileViewer</code>](#TileViewer)  
**Returns**: カメラ座標 \{ lon: , lat : \}の形式lon, lat値は、無効である場合nullが入る  

| Param | Type | Description |
| --- | --- | --- |
| coord | <code>Object</code> | カメラ座標 \{ x:  , y:  \}の形式 |

