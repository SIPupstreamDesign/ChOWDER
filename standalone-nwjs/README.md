# NodeWebkit版Viewer作成方法(Windows)

1． node.jsをインストール

2．nwjsを以下からダウンロードしてpackage.jsonと同ディレクトリに解凍します.
  * http://nwjs.io/
  * 対応バージョン v0.12.3

3．2で解凍したもののフォルダ名を nwjs に変更します.

4．7zip をダウンロードしてインストールしてパスに加えるか, exe/dllをpackage.jsonと同ディレクトリに配置します.
  * http://www.7-zip.org/

5．create_package.bat をダブルクリックで作成&起動します.

# NodeWebkit版Viewer作成方法(Linux)

1． node.jsをインストール

2．nwjsを以下からダウンロードしてpackage.jsonと同ディレクトリに解凍します.
  * http://nwjs.io/
  * 対応バージョン v0.12.3

3．2で解凍したもののフォルダ名を nwjs に変更します.

4．sh make_webkitapp.sh を実行します

5．作成成功すると起動します.



## オプションについて

conf.jsonを編集することで、Viewerの起動設定を変更できます.


| パラメータ | 形式 | 意味 |
|---|---|---|
| url | 文字列 | viewのurlです |
| ws_url | 文字列 | websocketサーバのurlです |
| id | リスト | 立ち上げるビューのIDを複数設定します |
| rect | {ビューID1: [x,y,width,height], ビューID2: ... } | 各ビューIDに対して左上座標と幅高さを指定できます |
| fullscreen | true/false | 起動時にフルスクリーンで起動するかどうか設定します |
| frame | true/false | ウィンドウのフレーム有り無しを設定します |
