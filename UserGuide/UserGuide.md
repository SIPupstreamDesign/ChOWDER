利用説明書
========

目次
--------

-   [はじめに](#はじめに)
    -   [動作環境とインストール](#動作環境とインストール)
-   [アプリケーションの展開方法](#アプリケーションの展開方法)
-   [アプリケーションのインストール方法](#アプリケーションのインストール方法)
    -   [インストール](#インストール)
    -   [インストールスクリプトの実行](#インストールスクリプトの実行)
-   [アプリケーションの起動方法](#アプリケーションの起動方法)
    -   [Mac/Linuxの場合](#maclinuxの場合-1)
    -   [Windowsの場合](#windowsの場合-1)
    -   [起動確認](#起動確認)
    -   [コントローラへアクセス](#コントローラへアクセス)
-   [アプリケーションの終了方法](#アプリケーションの終了方法)
    -   [サーバープログラムの終了](#サーバープログラムの終了)
    -   [redisの終了](#redisの終了)
-   [ChOWDERのホーム画面](#chowderのホーム画面)
    -   [ホーム画面説明](#ホーム画面説明)
-   [コントローラ画面の操作](#コントローラ画面の操作)
    -   [概要](#概要)
    -   [接続状態について](#接続状態について)
    -   [コントローラの操作 : Virtual Display Screenについて](#コントローラの操作-virtual-display-screenについて)
    -   [コントローラの操作 : Displayタブ](#コントローラの操作-displayタブ)
    -   [Virtual Displayの設定](#virtual-displayの設定)
    -   [コントローラの操作 : Contentタブ](#コントローラの操作-contentタブ)
    -   [コントローラの操作 : Searchタブ](#コントローラの操作-searchタブ)
-   [コントローラの操作 : Propertyウィンドウ ](#コントローラの操作-propertyウィンドウ)
-   [コントローラの操作 : 上部表示領域](#コントローラの操作-上部表示領域)
    -   [上部に配置されたメニュー](#上部に配置されたメニュー)
    -   [Displayボタン](#displayボタン)
    -   [Addメニュー](#addメニュー)
    -   [Settingメニュー](#settingメニュー)
    -   [ホームに戻る](#ホームに戻る)
-   [ディスプレイ画面の操作](#ディスプレイ画面の操作)
    -   [概要](#概要-1)
    -   [ディスプレイの操作：メニュー](#ディスプレイの操作メニュー)
-   [HIVEとの連携](#hiveとの連携)
    -   [インタラクティブレンダリング](#インタラクティブレンダリング)
    -   [SceneNodeEditor](#scenenodeeditor)
    -   [Module System](#module-system)
-   [Google Chrome Extensionの利用](#google-chrome-extensionの利用)
    -   [概要](#概要-2)
    -   [Extensionのインストール](#extensionのインストール)
    -   [Extensionでキャプチャする](#extensionでキャプチャする)



はじめに
========

本書ではChOWDERの操作方法について解説します.

動作環境とインストール
----------------------

以下の環境で動作確認を行っております.

* OS
    * Linux(CentOS6)
    * Windows7
    * MacOSX 10.10
* Webブラウザ
    * Apple Safari 9.x
    * Firefox 48.0
    * Chrome 53
    * Internet Explorer 11

アプリケーションの展開方法
==========================

アーカイブファイルの解凍を行ってください.
解凍すると、以下の構成でファイルが作成されます.

* bin : 実行スクリプトフォルダ
* client : クライアントアプリケーションフォルダ
* doc : ドキュメントフォルダ
* redis : redisアプリケーションフォルダ
* server : サーバアプリケーションフォルダ
* chrome\_extension : Google Chrome 拡張機能フォルダ
* package.json

協調ワークスペースドライバの起動にはbinフォルダに格納されているスクリプトを使用します.

アプリケーションのインストール方法
==================================

インストール
------------

### Node.jsのインストール

ポータルGUIの動作にはNode.jsのインストールが必要です.
Node.jsの公式サイト(`http://nodejs.org/`)からNode.js本体をダウンロードし,インストールします.(下図)

<img src="image/NodeJS.png" alt="node.jsのinstall画面" width="377" />
*node.jsのinstall画面*

### Node.jsサブモジュールのインストール

アプリケーションを展開したディレクトリに, ChOWDERで利用しているNode.jsの必要なサードパーティモジュールのインストールを行います.

インストールスクリプトの実行
----------------------------

### Mac/Linuxの場合

bin配下の以下のシェルスクリプトを実行します.

       $cd bin
       $sh install.sh

### Windowsの場合

bin配下の以下のファイルを実行します.

       >cd bin
       >install.bat

アプリケーションの起動方法
==========================

### Mac/Linuxの場合

bin配下の以下のシェルスクリプトを実行します.

       ./run.sh

### Windowsの場合

bin配下の以下のファイルを実行します.

       >cd bin
       >run.bat

※ Windowsの場合、仮想メモリを0KByteにしていると、 redisが正常に起動しない場合があります.
その場合は一時的に仮想メモリを有効にしてご利用ください.

起動確認
--------

起動スクリプトを実行するとChOWDERサーバーが起動します.

       $sh run.sh
       (Windows版は run.bat)

コントローラへアクセス
----------------------

ChOWDERへのアクセスは、Webブラウザのアドレス欄に「 http://localhost:8080 」と入力することでアクセス出来ます.
アクセスし、下図の画面が表示されたらインストールは完了となります。.

<img src="image/home.png" alt="install終了後ホーム画面" width="585" />
*install終了後ホーム画面*

アプリケーションの終了方法
==========================

以下2点の操作にて終了させます.

### サーバープログラムの終了

run.sh(bat)を起動したterminalをCTRL+Cで終了するか、 serverプログラムをkillします.

### redisの終了

redisが起動しているterminalを終了させます.
また、プロセスとして起動している場合は、プロセスをpsコマンドにて見つけて killコマンドにて終了させます.

ChOWDERのホーム画面
===================

ホーム画面説明
--------------

ChOWDERは、以下の2つのコントローラ(Display, Controller制御)側か、Display側かを決定します.
ChOWDERへのアクセスは、前述のアプリケーション起動を行った後、Webブラウザのアドレス欄に「 http://localhost:8080 」と入力することでアクセス出来ます.
アクセスすると上述のホーム画面が表示されます.

-   Controller: コントローラ画面へと遷移します.

-   Display : ディスプレイ画面へと遷移します.

上記の通り、アクセスしたPCを「コントローラ」として使用するか、 「ディスプレイ」として使用するかを選択することができます.

コントローラ画面の操作
======================

概要
----

コントローラは下図の通りとなっております.

<img src="image/cont_1.PNG" alt="コントローラ画面概要" width="585" />
*コントローラ画面概要*

接続状態について
----------------

画面右上部分には、サーバーとの接続状態がアイコンで表示されます.

<img src="image/connect.PNG" alt="サーバーとの接続ありの状態" width="283" />
*サーバーとの接続ありの状態*

<img src="image/disconnect.PNG" alt="サーバーとの接続が無い状態" width="283" />
*サーバーとの接続が無い状態*

コントローラの操作 : Virtual Display Screenについて
---------------------------------------------------

中央はVirtual Display Screenと呼ばれ、ChOWDERに接続された ディスプレイの操作、Contentsの移動、操作、削除等を行う 汎用スペースとなっております.

<img src="image/TDD_View.PNG" alt="VirtualDisplayScreenの凡例" width="585" />
*VirtualDisplayScreenの凡例*

コントローラの操作 : Displayタブ
--------------------------------

<img src="image/Display_TAB_2conn.PNG" alt="image" width="207" />
*Displayタブ*

VirtualDisplayと、ChOWDERサーバーに接続されているDisplayの一覧を表示します.
コントローラは、このDisplayをVirtualDisplay上に配置することができます.
配置したDisplay上にContentsを追加することによってContentsを共有するワークスペースを実現します.
Displayはマウスドラッグドロップにより、VirtualDisplaySpaceに配置することができます.
上図は、クライアントが接続された環境の例となります.

Virtual Displayの設定
---------------------

<img src="image/VirtualDisplaySetting.PNG" alt="image" width="207" />
*Virtual Displayの設定*

### 分割数の設定

Displayタブにて, Virtual Display を選択すると, Property ウィンドウにて, Virtual Display の設定が行えます. 上図では, 幅1500ピクセル, 高さ1500ピクセル, 横方向分割数2, 縦方向分割数2, をVirtual Displayに設定しています.

### snap機能

Displayを正確に区画に配置するための機能として「snap機能」があります.
下図のドロップダウンリストからモードの変更が行えます.

<img src="image/MIGIUE_Disp.PNG" alt="Snap機能の設定プルダウンボタン" width="207" />
*Snap機能の設定プルダウンボタン*

* Free : 自由配置となります.
* Display : 配置したDisplayに対してDisplay及びContentsがスナップするようになります.
* Grid : VirtualDisplaySettingにより分割した区画に沿ってDisplay及びContentsがスナップするようになります.

下図にsnap機能を用いて配置する凡例を示します.

<img src="image/Snap1.png" alt="Snap機能ドラッグ時凡例" width="585" />
*Snap機能ドラッグ時凡例*

またVirtualDisplaySpaceの拡大縮小オプションとして、Scale機能があります.
画面内でマウスの右ボタンを押しながらドラッグ操作することで、画面全体を拡大縮小することができます.

<img src="image/MIGIUE_Scale.PNG" alt="scale後の例（コンテンツが小さく表示されている）" width="377" />
*scale後の例（コンテンツが小さく表示されている）*

### ディスプレイとID

接続されたDisplayのIDを各接続されたDisplay上に表示し、識別できるようにします.
尚、IDは、接続された端末固有であり、1端末につき1IDが割り当てられます.

<img src="image/3Button1.PNG" alt="Display ID" width="283" />
*Display ID*

### 削除ボタン

選択したDisplayを削除(ChOWDERサーバーから切断)します.

<img src="image/3Button2.PNG" alt="削除ボタン" width="377" />
*削除ボタン*

※尚、VirtualDisplayは削除することはできません.

### 全選択ボタン

接続されているDisplayすべてを選択状態にします.

<img src="image/3Button3.PNG" alt="全選択ボタン" width="377" />
*全選択ボタン*

コントローラの操作 : Contentタブ
--------------------------------

本アプリケーションでは, ディスプレイへのContentsの表示は, 画面下側のContentsタブからディスプレイにContentsをドラッグアンドドロップすることにより行います.

### Contentsの表示

Contents一覧から, 中央のVirtualScreenの領域へ, ドラッグアンドドロップすることで, 表示させることができます.

<img src="image/DragAndDropContent.png" alt="Contentsの表示" width="434" />
*Contentsの表示*

### Contents一覧への追加

Contentsの追加を行います.
タブ領域右下のメニューボタンを押下することで、各種操作が行えます.

<img src="image/DragAndDropContent2.png" alt="Contentsの追加" width="434" />
*Contentsの追加*

### テキストファイルの追加

メニューボタンからテキストファイルをContentsに追加します.
以下追加例となります.

<img src="image/AddContent_TextFile_Select.png" alt="テキストファイルを選択" width="434" />
*テキストファイルを選択*

<img src="image/AddContent_TextFile_View.png" alt="テキストファイルのVirtualScreenへの追加" width="585" />
*テキストファイルのVirtualScreenへの追加*

### URLの追加

右下のメニューから、指定されたURLのサイトの画像をContentsに追加します.
以下例となります.

<img src="image/AddContent_URL.PNG" alt="URL送信ボタン" width="472" />
*URL送信ボタン*

追加すると以下の通りとなります.

<img src="image/AddContent_URL_View.PNG" alt="URL追加後の様子" width="472" />
*URL追加後の様子*

### 画像の送信

右下のメニューから任意の画像ファイルをContentsに追加します.
対応している画像フォーマットは以下の通りです.

-   PNGフォーマット形式.
-   JPEGフォーマット形式.
-   GIFフォーマット形式.
-   BMPフォーマット形式.

以下は、画像をContentsとして追加したあとの表示例となります.

<img src="image/AddContent_Picture_View.PNG" alt="画像の追加例" width="434" />
*画像の追加例*

### 画像の差し替え

Contentsタブにて選択している画像の差し替えを行います.
差し替え例を以下に示します.

<img src="image/SASHI.PNG" alt="画像の差し替えボタン" width="434" />
*画像の差し替えボタン*

下図の通り指定すると、Contentsタブに存在するContentsが差し替わります。

<img src="image/YUMUSHI.PNG" alt="画像の差し替えし指定" width="434" />
*画像の差し替え指定*

<img src="image/SASHI2.PNG" alt="画像の差し替え結果" width="434" />
*画像の差し替え結果*

### コンテンツの操作

追加されたContentは, マウス左クリックにより選択, または, Ctrl + マウス左クリックにより複数選択することができます.
選択すると, 操作用マニピュレータ, 及び操作用ボタンが表示されます(下図)

-   選択時の操作用ボタン
    -   強調表示ボタン … 選択中のコンテンツを, 強調表示します.
        強調表示されたコンテンツは, Displayでグループ色の太い枠が付いた状態で表示されます
    -   メタ情報表示ボタン … コンテンツに設定されているメタ情報をDisplay側で表示させます.
    -   非表示ボタン … VirtualDisplaySpaceからコンテンツを非表示にします
        非表示にしたコンテンツは, コンテンツ一覧からドラッグすることで再び表示できます.

<img src="image/manip.png" alt="コンテンツ操作用マニピュレータ" height="321" />
*コンテンツ操作用マニピュレータ*

### Groupの設定

Contentタブでは, コンテンツに割り当てるGroupの設定が行えます.
ボタンにより, グループの追加, 及び, 作成したグループの順序入れ替えを行います.
また, 設定メニューにより, グループの名前変更, グループ色変更, 削除を行います.

<img src="image/group1.png" alt="Groupの追加, 順序変更" height="321" />
*Groupの追加, 順序変更*

<img src="image/group2.png" alt="Groupの設定" height="321" />
*Groupの設定*

### Groupの割り当て

コンテンツの右クリックメニュー, または, 画面右下のメニューから, コンテンツへ割り当てられたグループを, 変更することができます.

<img src="image/group3.png" alt="Groupの変更" height="321" />
*Groupの変更*

コントローラの操作 : Searchタブ
-------------------------------

Searchタブでは、追加したコンテンツのサーチが行えます.

<img src="image/search_tab.png" alt="Contentsの検索が可能" width="434" />
*Contentsの検索が可能*

### メタデータの検索

Searchタブにあるテキストボックスからは、メタデータの検索が行えます. 検索は、チェックボックスにチェックが入っているグループに対して行われます.

<img src="image/searchcheck.png" alt="対象となるグループの選択" width="434" />
*対象となるグループの選択*

コントローラの操作 : Propertyウィンドウ
========================================

<img src="image/Prop_Down.PNG" alt="image" width="188" />

Propertyウィンドウは選択されたContents、Display、ContentsID、 およびそれぞれのPropertyを表示します.
Propertyは以下の通りID以外を編集し、座標、表示の優先順位( Zindex )を 指定することができます.
また、選択されたContentsはPropertyウィンドウ下部のダウンロードボタンから ダウンロードすることができます.

コントローラの操作 : 上部表示領域
=================================

### 上部に配置されたメニュー

画面上部に配置されたメニューから各種操作が行えます.

<img src="image/Upper.PNG" alt="画面上部領域" width="415" />
*画面上部領域*

### Displayボタン

下図に示すとおり、Displayボタンを押下すると、 Displayウィンドウを開くことができます.

<img src="image/Left_Display.PNG" alt="Displayボタン押下時" width="415" />
*Displayボタン押下時*

### Addメニュー

Addメニューからは各種コンテンツを追加することができます.
操作方法の詳細については [コントローラの操作 : Contentタブ](#コントローラの操作-contentタブ) を参照してください.

<img src="image/header01.PNG" alt="Addメニュー展開時" width="415" />
*Addメニュー展開時*

### Settingメニュー

Settingメニューからはリモートカーソルの表示状態切替が行えます.

<img src="image/SettingMenu.PNG" alt="Settingメニュー展開時" width="415" />
*Settingメニュー展開時*

リモートカーソルは以下のように表示されます。

<img src="image/remotecursor.PNG" alt="リモートカーソル" width="415" />
*リモートカーソル*

### ホームに戻る

下図のように、ChOWDERと書かれた部分をクリックすると、 ホームに戻ることができます.

<img src="image/home_return.PNG" alt="タイトル名のクリックでホームに戻る" width="415" />
*タイトル名のクリックでホームに戻る*

ディスプレイ画面の操作
======================

概要
----

<img src="image/display.png" alt="ディスプレイ画面概要" width="585" />

ディスプレイの操作方法について解説します。 それぞれのタブ、ウィンドウ等、機能について解説します.

ディスプレイの操作：メニュー
----------------------------

ディスプレイでは、マウスもしくはタブレットの場合は画面へのタッチを行うと、メニューが表示されます。 メニューではいくつかの操作を行うことができます。

### コントローラ画面への切り替え

ディスプレイモードからコントローラモードへ切り替えることができます。

<img src="image/displaymenu1.png" alt="コントローラ画面への切り替え" width="207" />
*コントローラ画面への切り替え*

### フルスクリーンへの切り替え

ウインドウモードとウインドウモードの切り替えが可能です。 フルスリーンからウインドウモードに戻る場合は、同じメニューを再度選択またはESCキーを押すことで 戻ることができます。

<img src="image/displaymenu2.png" alt="フルスリーンへの切り替え" width="207" />
*フルスリーンへの切り替え*

### Display IDの設定

コントローラで認識可能なディスプレイのIDを設定することができます。 任意の文字列を入力後、エンターキーを押すことで、設定することができます。

<img src="image/displaymenu3.png" alt="ディスプレイIDの設定" width="207" />
*ディスプレイIDの設定*

HIVEとの連携
============

インタラクティブレンダリング
----------------------------

HIVEのインタラクティブレンダリング時に, グラフィクス画面をChOWDERに送信し, 表示させることができます (下図)

<img src="image/hive.png" alt="HIVEインタラクティブレンダリングの送信例" width="600" />
*HIVEインタラクティブレンダリングの送信例*

送信するには, HIVEの上部メニューにあるChOWDERボタンを押し, ChOWDERのURLを設定します.URLは, 初期状態では ws://localhost:8081/v2/ となっています. localhostの部分をChOWDERが動作しているPCのIPアドレスに変更して接続します. 接続中は, 上手のようにChOWDERボタンの色が変わります.

<img src="image/hive1.png" alt="ChOWDER接続用メニュー項目" width="321" />
*ChOWDER接続用メニュー項目*

<img src="image/hive2.png" alt="URL設定" width="321" />
*URL設定*

SceneNodeEditor
---------------

HIVEのSceneNodeEditorで, RenderForSIPノードを使用することで, レンダリング画像をChOWDERに送信し, 表示させることができます. プロパティのSEND先のURLは初期状態では ws://localhost:8081/v2/ となっています.

<img src="image/scene_node_editor.png" alt="SceneNodeEditorでの送信例" width="600" />
*SceneNodeEditorでの送信例*

Module System
-------------

HIVEのModuleSystemで, ChOWDERノードを使用することで, レンダリング画像をChOWDERに送信し, 表示させることができます. ChOWDERノードはBufferImageData形式の出力をもつノードと接続できるため、 接続可能な様々なノードの情報をChOWDERに送信することができます。

ChOWDERノードのプロパティでは、ChOWDERのコンテンツ送信先アドレス指定します。 デフォルトでは、 ws://localhost:8081/v2/ です。ここでは、ChOWDERサーバーのアドレスを指定してください。

<img src="image/hivemodulesystem.png" alt="ModuleSystemでの送信例" width="600" />
*ModuleSystemでの送信例*

Google Chrome Extensionの利用
=============================

概要
----

Google ChromeにはExtensionと呼ばれる機能を拡張する仕組みがあります。 Google Chromeに専用のChOWDER用Extensionを追加することで、ウェブブラウザの画面をリアルタイムにキャプチャし、コンテンツとして追加することができます。

Extensionのインストール
-----------------------

プロジェクトルートにあるbinディレクトリのなかにchrome\_extention.crxという名前のファイルがあり、これがGoogle Chrome用のExtensionファイルです.

Chromeに拡張機能をインストールし追加するには、下図に示したようにブラウザの拡張機能のページを開きます.

そこにExtensionファイルをドラッグアンドドロップし、インストールします.

<img src="image/extension01.png" alt="拡張機能ページを開くメニュー" width="585" />
*拡張機能ページを開くメニュー*

<img src="image/extension02.png" alt="Extensionファイルのドラッグアンドドロップ" width="585" />
*Extensionファイルのドラッグアンドドロップ*

Extensionでキャプチャする
-------------------------

Extensionを追加したら、アイコンをクリックしてキャプチャを開始できます。

-   Extensionのメニュー

    -   Capture … 現在表示しているウェブページをキャプチャして, ChOWDERへ送信します.

    -   AutoCapture … 設定された時間間隔ごとに, 現在表示しているウェブページをキャプチャして, ChOWDERへ連続送信します.

    -   Setting … 設定メニューを開きます.

<img src="image/extension03.png" alt="Extensionのメニュー" width="207" />
*Extensionのメニュー*

<img src="image/extension04.png" alt="AutoCapture開始後" width="207" />
*AutoCapture開始後*

-   Extensionの設定

    -   URL … ChOWDERへ接続するためのURLを設定します.

    -   Interval … AutoCaptureで使用される, キャプチャ間隔を設定します.

<img src="image/extension_setting.png" alt="Extensionの設定" width="207" />
*Extensionの設定*
