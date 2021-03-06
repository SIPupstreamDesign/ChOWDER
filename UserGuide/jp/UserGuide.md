利用説明書
========================================================================================

目次
---------------------------------------------------

-   [はじめに](#はじめに)
    -   [動作環境とインストール](#動作環境とインストール)
-   [アプリケーションの展開方法](#アプリケーションの展開方法)
-   [アプリケーションのインストール方法](#アプリケーションのインストール方法)
    -   [インストール](#インストール)
    -   [インストールスクリプトの実行](#インストールスクリプトの実行)
-   [アプリケーションの起動方法](#アプリケーションの起動方法)
    -   [Mac/Linuxの場合](#maclinuxの場合)
    -   [Windowsの場合](#windowsの場合)
    -   [起動確認](#起動確認)
    -   [コントローラへアクセス](#コントローラへアクセス)
-   [アプリケーションの終了方法](#アプリケーションの終了方法)
    -   [サーバープログラムの終了](#サーバープログラムの終了)
    -   [redisの終了](#redisの終了)
-   [サーバー設定](#サーバー設定)
    -   [サーバー基本設定](#サーバー基本設定)
    -   [管理者初期設定](#管理者初期設定)
    -   [管理者設定ファイル](#管理者設定ファイル)
-   [ChOWDERのホーム画面](#chowderのホーム画面)
    -   [ホーム画面説明](#ホーム画面説明)
-   [コントローラ画面の操作](#コントローラ画面の操作)
    -   [概要](#概要)
    -   [接続状態について](#接続状態について)
    -   [Virtual Display Screenについて](#virtual-display-screenについて)
    -   [メインメニュー](#メインメニュー)
    -   [コンテンツの追加](#コンテンツの追加)
    -   [Displayタブ](#displayタブ)
    -   [Contentタブ](#contentタブ)
    -   [Searchタブ](#searchタブ)
    -   [Propertyウィンドウ](#propertyウィンドウ)
    -   [動画コンテンツの操作](#動画コンテンツの操作)
-   [コントローラ権限と管理画面](#コントローラ権限と管理画面)
    -   [コントローラ権限](#コントローラ権限)
    -   [管理画面](#管理画面)
-   [ディスプレイ画面の操作](#ディスプレイ画面の操作)
    -   [概要](#概要-1)
    -   [ディスプレイの操作：メニュー](#ディスプレイの操作：メニュー)
-   [HIVEとの連携](#hiveとの連携)
    -   [インタラクティブレンダリング](#インタラクティブレンダリング)
    -   [SceneNodeEditor](#scenenodeeditor)
    -   [Module System](#module-system)
-   [Google Chrome Extensionの利用](#google-chrome-extensionの利用)
    -   [概要](#概要-2)
    -   [Extensionのインストール](#extensionのインストール)
    -   [Extensionでキャプチャする](#extensionでキャプチャする)
-   [ChOWDER Desktop Captureの利用](#chowder-desktop-captureの利用)
    -   [概要](#概要-3)
    -   [ChOWDER Desktop Captureの使い方](#chowder-desktop-captureの使い方)
-   [Google Chrome Extension for WebRTCの利用](#google-chrome-extension-for-webrtcの利用)
    -   [概要](#概要-4)
    -   [Extensionのインストール](#extensionのインストール-2)
    -   [ChOWDERサーバーが別PCで動作している場合](#chowderサーバーが別pcで動作している場合)
    -   [Extensionでキャプチャする](#extensionでキャプチャする-1)
-   [大規模画像データ送信アプリケーションの利用](#大規模画像データ送信アプリケーションの利用)
    -   [概要](#概要-5)
    -   [アプリケーションの設定](#アプリケーションの設定-1)
    -   [アプリケーションの利用方法](#アプリケーションの利用方法)
-   [大規模画像データの表示と操作](#大規模画像データの表示と操作)
-   [Electron版ChOWDERディスプレイアプリケーションの利用](#Electron版ChOWDERディスプレイアプリケーションの利用)
    -   [概要](#概要-6)
    -   [アプリケーションのインストール](#アプリケーションのインストール)
    -   [アプリケーションの起動](#アプリケーションの起動)
    -   [アプリケーションの設定](#アプリケーションの設定-2)
    -   [アプリケーションの設定の反映](#アプリケーションの設定の反映)
    -   [リモートホストへのインストール](#リモートホストへのインストール)
-   [HTTPSの利用](#httpsの利用)
    -   [概要](#概要-7)
    
はじめに
========================================================================================

本書ではChOWDERの操作方法について解説します.

動作環境とインストール
---------------------------------------------------

以下の環境で動作確認を行っております.

* OS
    * Linux(CentOS7)
    * Windows10
    * MacOSX 10.12
* Webブラウザ
    * Apple Safari 12.x
    * Firefox 65
    * Chrome 72
    * Edge 44

アプリケーションの展開方法
========================================================================================

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
========================================================================================

インストール
---------------------------------------------------

### Node.jsのインストール

ポータルGUIの動作にはNode.jsのインストールが必要です.
Node.jsの公式サイト(`http://nodejs.org/`)からNode.js本体をダウンロードし,インストールします.(下図)

<img src="image/NodeJS.png" alt="node.jsのinstall画面" width="377" />
*node.jsのinstall画面*

### Node.jsサブモジュールのインストール

アプリケーションを展開したディレクトリに, ChOWDERで利用しているNode.jsの必要なサードパーティモジュールのインストールを行います.

インストールスクリプトの実行
---------------------------------------------------

### Mac/Linuxの場合

bin配下の以下のシェルスクリプトを実行します.

       $cd bin
       $sh install.sh

### Windowsの場合

bin配下の以下のファイルを実行します.

       >cd bin
       >install.bat

 - Windowsでは, インストール時に, hiredisモジュールやPythonのエラーが表示されますが, 必須モジュールではないため, 問題なく動作します.

アプリケーションの起動方法
========================================================================================

Mac/Linuxの場合
---------------------------------------------------

bin配下の以下のシェルスクリプトを実行します.

       ./run.sh

Windowsの場合
---------------------------------------------------

bin配下の以下のファイルを実行します.

       >cd bin
       >run.bat

※ Windowsの場合、仮想メモリを0KByteにしていると、 redisが正常に起動しない場合があります.
その場合は一時的に仮想メモリを有効にしてご利用ください.

起動確認
---------------------------------------------------

起動スクリプトを実行するとChOWDERサーバーが起動します.

       $sh run.sh
       (Windows版は run.bat)

コントローラへアクセス
---------------------------------------------------

ChOWDERへのアクセスは、Webブラウザのアドレス欄に「 http://localhost:8080 」と入力することでアクセス出来ます.
アクセスし、下図の画面が表示されたらインストールは完了となります。.

<img src="image/home.png" alt="install終了後ホーム画面" width="585" />
*install終了後ホーム画面*

アプリケーションの終了方法
========================================================================================

以下2点の操作にて終了させます.

サーバープログラムの終了
---------------------------------------------------

run.sh(bat)を起動したterminalをCTRL+Cで終了するか、 serverプログラムをkillします.

redisの終了
---------------------------------------------------

redisが起動しているterminalを終了させます.
また、プロセスとして起動している場合は、プロセスをpsコマンドにて見つけて killコマンドにて終了させます.

サーバー設定
========================================================================================

サーバー基本設定
---------------------------------------------------
サーバープログラムでは、起動時に`server/setting.json`ファイルを読み込み、各種設定を行っています。


    {
        "wsMaxMessageSize": 67108864,
        "reductionResolution" : 1920,
        "enableMeasureTime" : false
    }

-   `wsMaxMessageSize`には、サーバーが1回で送受信できる最大メッセージサイズを設定します。
-   `reductionResolution`には、大規模画像データの縮小画像のサイズを設定します。このサイズ以上の大規模画像データを登録した場合は、縮小画像が生成され、表示解像度によっては縮小画像が表示に使用されます。
-   `enableMeasureTime`には、時刻ログ出力を有効にするかどうかを設定します。時刻ログ出力を有効にした場合、tileimage/log、server/logに対してログファイルが出力されます。また、Display上でDisplayでのログがダウンロードできるようになります。

管理者初期設定
---------------------------------------------------

管理者コントローラを起動時に設定することができます.
デフォルトでは, 管理者パスワードは「admin」に設定されています

管理者設定ファイル
---------------------------------------------------
ChOWDER の最上位フォルダ(README.md があるフォルダ) に, admin.json ファイルを作成することで,
起動時に管理者の追加削除を行うことができます. admin.json の書式は以下の通りです(admin.json.org ファイルにも記
載しております)

    {
        "administrator" : {
            "command" : "add",
            "password" : "admin"
        },
        "administrator2" : {
            "command" : "delete",
            "password" : "admin2"
        }
    }

この例では, コントローラ”administrator”が追加(上書き) され, ”administrator2”が削除されます

キーとして管理者名を入れ, 追加(上書き) する場合は, ”command” : ”add”
削除する場合は”command” : ”delete” と記載します. 追加時には”password”が必須です.
このjson ファイルはChOWDER 起動時に読み込まれ, DB に管理者が登録または削除されます.
一度ChOWDER を起動して, DB に登録された後は, admin.json ファイルは不要となります.

ChOWDERのホーム画面
========================================================================================

ホーム画面説明
---------------------------------------------------

ChOWDERへのアクセスは、前述のアプリケーション起動を行った後、Webブラウザのアドレス欄に「 http://localhost:8080 」と入力することでアクセス出来ます.
アクセスすると上述のホーム画面が表示されます.
ChOWDERは、以下の2つのモード(Display, Controller)を持っており、ホーム画面でどちらのモードを使うかを決定します.

-   Controller: コントローラ画面へと遷移します.

-   Display : ディスプレイ画面へと遷移します.

上記の通り、アクセスしたPCを「コントローラ」として使用するか、 「ディスプレイ」として使用するかを選択することができます.

コントローラ画面の操作
========================================================================================

概要
---------------------------------------------------

コントローラは下図の通りとなっております.

<img src="image/cont_1.png" alt="コントローラ画面概要" width="585" />
*コントローラ画面概要*

接続状態について
---------------------------------------------------

画面右上部分には、サーバーとの接続状態がアイコンで表示されます.

<img src="image/connect.png" alt="サーバーとの接続ありの状態" width="283" />
*サーバーとの接続ありの状態*
<br>
<img src="image/disconnect.png" alt="サーバーとの接続が無い状態" width="283" />
*サーバーとの接続が無い状態*

Virtual Display Screenについて
---------------------------------------------------

中央はVirtual Display Screenと呼ばれ、ChOWDERに接続された ディスプレイの操作、Contentsの移動、操作、削除等を行う 汎用スペースとなっております.

<img src="image/TDD_View.png" alt="VirtualDisplayScreenの凡例" width="585" />
*VirtualDisplayScreenの凡例*

メインメニュー
---------------------------------------------------

### 上部に配置されたメニュー

画面上部に配置されたメニューから各種操作が行えます.

<img src="image/Upper.png" alt="画面上部領域" width="415" />
*画面上部領域*

### Displayボタン

下図に示すとおり、Displayボタンを押下すると、 Displayウィンドウを開くことができます.

<img src="image/Left_Display.png" alt="Displayボタン押下時" width="415" />
*Displayボタン押下時*

### Addメニュー

Addメニューからは各種コンテンツを追加することができます.
操作方法の詳細については [コンテンツの追加](#コンテンツの追加) を参照してください.

<img src="image/header01.png" alt="Addメニュー展開時" width="415" />
*Addメニュー展開時*

### Settingメニュー

Settingメニューからはリモートカーソルの表示状態切替や、言語の切り替え、管理画面の表示が行えます。管理画面の表示は管理者のみ可能です。
管理画面については [コントローラ権限と管理画面](#コントローラ権限と管理画面) を参照してください。

<img src="image/SettingMenu.png" alt="Settingメニュー展開時" width="415" />
*Settingメニュー展開時*

リモートカーソルは以下のように表示されます。

<img src="image/remotecursor.png" alt="リモートカーソル" width="415" />
*リモートカーソル*

ディスプレイに表示されるリモートカーソルのサイズを、VirtualDisplayを基準としたピクセル数で指定します。

<img src="image/cursorsize.png" alt="カーソルサイズ" width="415" />
*カーソルサイズ*


言語の切り替えは以下のメニューで行います。

<img src="image/SettingMenu_language.png" alt="言語切り替え" width="415" />
*言語切り替え*

### ホームに戻る

下図のように、ChOWDERと書かれた部分をクリックすると、 ホームに戻ることができます.

<img src="image/home_return.png" alt="タイトル名のクリックでホームに戻る" width="415" />
*タイトル名のクリックでホームに戻る*

### コントローラIDの設定

下図の部分で、コントローラIDの設定を行うことができます。
コントローラIDを変更すると、別のコントローラとして認識されるので、パスワードの再入力が求められる場合があります。

<img src="image/controller_id.png" alt="コントローラIDの設定" width="415" />
*コントローラIDの設定*


コンテンツの追加
---------------------------------------------------

メインメニューのAdd、または、コンテンツタブ右下のメニューから、各種コンテンツを追加することができます。

### 画像ファイルの追加

任意の画像ファイルをContentsに追加します.
以下のいずれかの方法で追加できます

-   メインメニュー → Add → Image.
-   Contentタブ右下メニュー → コンテンツ追加 → 画像ファイル.
-   Contentタブで右クリック → コンテンツ追加 → 画像ファイル.

対応している画像フォーマットは以下の通りです.

-   PNGフォーマット形式.
-   JPEGフォーマット形式.
-   GIFフォーマット形式.
-   BMPフォーマット形式.

以下は、画像をContentsとして追加したあとの表示例となります.

<img src="image/AddContent_Picture_View.png" alt="画像ファイルの追加例" width="434" />
*画像ファイルの追加例*

### 動画ファイルの追加
任意の動画ファイルをContentsに追加します.
以下のいずれかの方法で追加できます.

-   メインメニュー → Add → Movie.
-   Contentタブ右下メニュー → コンテンツ追加 → 動画ファイル.
-   Contentタブで右クリック → コンテンツ追加 → 動画ファイル.

MP4フォーマット形式の動画に対応しています.\\
読み込んだ動画は、WebRTCを使用してストリーミング配信されます。\\
WebRTCの詳細については  [動画コンテンツの操作](#動画コンテンツの操作)  を参照してください.

以下は、動画ファイルをContentsとして追加したあとの表示例となります.

<img src="image/AddContent_Movie_View.png" alt="動画ファイルの追加例" width="434" />
*動画ファイルの追加例*

### テキストの追加

任意のテキストをContentsに追加します.
以下のいずれかの方法で追加できます.

-   メインメニュー → Add → Text.
-   Contentタブ右下メニュー → コンテンツ追加 → テキスト.
-   Contentタブで右クリック → コンテンツ追加 → テキスト.

### テキストファイルの追加

任意のテキストファイルをContentsに追加します.
以下のいずれかの方法で追加できます.

-   メインメニュー → Add → TextFile.
-   Contentタブ右下メニュー → コンテンツ追加 → テキストファイル.
-   Contentタブで右クリック → コンテンツ追加 → テキストファイル.

以下追加例となります.

<img src="image/AddContent_TextFile_Select.png" alt="テキストファイルを選択" width="434" />
*テキストファイルを選択*
<br>
<img src="image/AddContent_TextFile_View.png" alt="テキストファイルのVirtualScreenへの追加" width="585" />
*テキストファイルのVirtualScreenへの追加*

### URLの追加

指定されたURLのサイトの画像をContentsに追加します.
以下のいずれかの方法で追加できます.

-   メインメニュー → Add → URL.
-   Contentタブ右下メニュー → コンテンツ追加 → URL.
-   Contentタブで右クリック → コンテンツ追加 → URL.

以下例となります.

<img src="image/AddContent_URL.png" alt="URL送信ボタン" width="472" />
*URL送信ボタン*

追加すると以下の通りとなります.

<img src="image/AddContent_URL_View.png" alt="URL追加後の様子" width="472" />
*URL追加後の様子*

### PDFの追加

任意のPDFドキュメントをContentsに追加します.
以下のいずれかの方法で追加できます.

-   メインメニュー → Add → PDF.
-   Contentタブ右下メニュー → コンテンツ追加 → PDFファイル.
-   Contentタブで右クリック → コンテンツ追加 → PDFファイル.

以下は、PDFをContentsとして追加したあとの表示例となります.

<img src="image/AddContent_PDF_View.png" alt="PDFファイルの追加例" width="434" />
*PDFファイルの追加例*

### スクリーン共有の追加

スクリーン共有をContentsに追加します.
以下のいずれかの方法で追加できます.

-   メインメニュー → Add → ScreenShare
-   Contentタブ右下メニュー → コンテンツ追加 → スクリーン共有
-   Contentタブで右クリック → コンテンツ追加 → スクリーン共有

キャプチャーした動画が、WebRTCを使用してストリーミング配信されます.
動画コンテンツの操作方法については [動画コンテンツの操作](#動画コンテンツの操作) を参照してください.

以下は、スクリーン共有を追加したあとの表示例となります.

<img src="image/AddContent_ScreenShare_View.png" alt="スクリーン共有の追加例" width="434" />
*スクリーン共有の追加例*

### カメラ共有

カメラ共有をContentsに追加します.
以下のいずれかの方法で追加できます.

-   メインメニュー → Add → CameraShare
-   Contentタブ右下メニュー → コンテンツ追加 → カメラ共有
-   Contentタブで右クリック → コンテンツ追加 → カメラ共有

キャプチャーした動画が、WebRTCを使用してストリーミング配信されます.
動画コンテンツの操作方法については [動画コンテンツの操作](#動画コンテンツの操作) を参照してください.

以下は、カメラ共有をContentsとして追加したあとの表示例となります.

<img src="image/AddContent_CameraShare_View.png" alt="カメラ共有の追加例" width="434" />
*カメラ共有の追加例*


Displayタブ
---------------------------------------------------

<img src="image/Display_TAB_2conn.png" alt="image" width="207" />
*Displayタブ*

VirtualDisplayと、ChOWDERサーバーに接続されているDisplayの一覧を表示します.
コントローラは、このDisplayをVirtualDisplay上に配置することができます.
配置したDisplay上にContentsを追加することによってContentsを共有するワークスペースを実現します.
Displayはマウスドラッグドロップにより、VirtualDisplaySpaceに配置することができます.
上図は、クライアントが接続された環境の例となります.

<img src="image/newdisplay.png" alt="image" width="207" />

NewDisplays欄には、新規にアクセスされたDisplayが表示され、
新規Displayに対するコンテンツ配信の許可不許可を指定できます。
許可するまではDisplay側にコンテンツは配信されません。
一度選択すると、情報が保存され、次のアクセスでは保存された許可情報に従って配信されます.

Virtual Displayの設定
---------------------

<img src="image/VirtualDisplaySetting.png" alt="image" width="207" />
*Virtual Displayの設定*

### 分割数の設定

Displayタブにて, Virtual Display を選択すると, Property ウィンドウにて, Virtual Display の設定が行えます. 上図では, 幅1500ピクセル, 高さ1500ピクセル, 横方向分割数2, 縦方向分割数2, をVirtual Displayに設定しています.

### snap機能

Displayを正確に区画に配置するための機能として「snap機能」があります.
下図のドロップダウンリストからモードの変更が行えます.

<img src="image/MIGIUE_Disp.png" alt="Snap機能の設定プルダウンボタン" width="207" />
*Snap機能の設定プルダウンボタン*

* Free : 自由配置となります.
* Display : 配置したDisplayに対してDisplay及びContentsがスナップするようになります.
* Grid : VirtualDisplaySettingにより分割した区画に沿ってDisplay及びContentsがスナップするようになります.

下図にsnap機能を用いて配置する凡例を示します.

<img src="image/Snap1.png" alt="Snap機能ドラッグ時凡例" width="585" />
*Snap機能ドラッグ時凡例*

またVirtualDisplaySpaceの拡大縮小オプションとして、Scale機能があります.
画面内でマウスの右ボタンを押しながらドラッグ操作することで、画面全体を拡大縮小することができます.

<img src="image/MIGIUE_Scale.png" alt="scale後の例（コンテンツが小さく表示されている）" width="377" />
*scale後の例（コンテンツが小さく表示されている）*

### ディスプレイとID

接続されたDisplayのIDを各接続されたDisplay上に表示し、識別できるようにします.
尚、IDは、接続された端末固有であり、1端末につき1IDが割り当てられます.

<img src="image/3Button1.png" alt="Display ID" width="283" />
*Display ID*

### 削除ボタン

選択したDisplayを削除(ChOWDERサーバーから切断)します.

<img src="image/3Button2.png" alt="削除ボタン" width="377" />
*削除ボタン*

※尚、VirtualDisplayは削除することはできません.

### 全選択ボタン

接続されているDisplayすべてを選択状態にします.

<img src="image/3Button3.png" alt="全選択ボタン" width="377" />
*全選択ボタン*


### DisplayGroupの設定

Displayタブでは, ディスプレイに割り当てるDisplayGroupの設定が行えます.
各DisplayGroupでは, Virtual Displayを1つ設定することができます.

ボタンにより, グループの追加, 及び, 作成したグループの順序入れ替えを行います.
また, 設定メニューにより, グループの名前変更, グループ色変更, 削除を行います.

<img src="image/display_group1.png" alt="DisplayGroupの追加, 順序変更" height="321" />
*DisplayGroupの追加, 順序変更*
<br>
<img src="image/display_group2.png" alt="DisplayGroupの設定" height="321" />
*DisplayGroupの設定*

### DisplayGroupの割り当て

ディスプレイ右クリックメニュー, または, 画面右下のメニューから, ディスプレイへ割り当てられたグループを, 変更することができます. ただしVirtualDisplayのグループは変更できません.

<img src="image/display_group3.png" alt="DisplayGroupの変更" height="321" />
*DisplayGroupの変更*


Contentタブ
--------------------------------

本アプリケーションでは, ディスプレイへのContentsの表示は, 画面下側のContentsタブからディスプレイにContentsをドラッグアンドドロップすることにより行います.

### Contentsの表示

Contents一覧から, 中央のVirtualScreenの領域へ, ドラッグアンドドロップすることで, 表示させることができます.

<img src="image/DragAndDropContent.png" alt="Contentsの表示" width="434" />
*Contentsの表示*

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

### Contentタブメニュー

タブ領域右下のメニューボタンを押下することで、各種操作が行えます.

<img src="image/DragAndDropContent2.png" alt="Contentsの追加" width="434" />
*Contentsの追加*

### 画像の差し替え

Contentsタブにて選択している画像の差し替えを行います.
差し替え例を以下に示します.

<img src="image/SASHI.png" alt="画像の差し替えボタン" width="434" />
*画像の差し替えボタン*

下図の通り指定すると、Contentsタブに存在するContentsが差し替わります。

<img src="image/YUMUSHI.PNG" alt="画像の差し替えし指定" width="434" />
*画像の差し替え指定*
<br>
<img src="image/SASHI2.png" alt="画像の差し替え結果" width="434" />
*画像の差し替え結果*

### Groupの設定

Contentタブでは, コンテンツに割り当てるGroupの設定が行えます.
ボタンにより, グループの追加, 及び, 作成したグループの順序入れ替えを行います.
また, 設定メニューにより, グループの名前変更, グループ色変更, 削除を行います.

<img src="image/group1.png" alt="Groupの追加, 順序変更" height="321" />
*Groupの追加, 順序変更*
<br>
<img src="image/group2.png" alt="Groupの設定" height="321" />
*Groupの設定*

### Groupの割り当て

コンテンツの右クリックメニュー, または, 画面右下のメニューから, コンテンツへ割り当てられたグループを, 変更することができます.

<img src="image/group3.png" alt="Groupの変更" height="321" />
*Groupの変更*

Searchタブ
-------------------------------

Searchタブでは、追加したコンテンツのサーチが行えます.

<img src="image/search_tab.png" alt="Contentsの検索が可能" width="434" />
*Contentsの検索が可能*

### メタデータの検索

Searchタブにあるテキストボックスからは、メタデータの検索が行えます. 検索は、チェックボックスにチェックが入っているグループに対して行われます.

<img src="image/searchcheck.png" alt="対象となるグループの選択" width="434" />
*対象となるグループの選択*

Layoutタブ
-------------------------------

Layout タブでは、現在のコンテンツの表示状態を、Layout として保存することができます. 

### Layoutの追加

Layout の追加は画面下部Layout リスト内の右クリックメニュー, または画面右下のメニューから行えます. 追加は、
チェックボックスにチェックが入っているグループに対して行われます.

### Layoutの上書き

選択中のレイアウトに, 現在のコンテンツの表示状態を上書きします.

<img src="image/layout_tab.png" alt="Layoutタブ" width="434" />
*Layoutタブ*

### Groupの変更

Layout が所属するグループを変更します.

<img src="image/layoutmenu1.png" alt="Layoutメニュー" width="434" />
*Layout メニュー*

### Layoutの適用

画面下部Layout リスト内のLayout コンテンツを画面にドラッグアンドドロップすることで適用されます.

Propertyウィンドウ
-------------------------------

<img src="image/Prop_Down.png" alt="image" width="188" />

Propertyウィンドウは選択されたContents、Display、ContentsID、 およびそれぞれのPropertyを表示します.
Propertyは以下の通りID以外を編集し、座標、表示の優先順位( Zindex )を 指定することができます.
また、選択されたContentsはPropertyウィンドウ下部のダウンロードボタンから ダウンロードすることができます.

動画コンテンツの操作
-------------------------------

動画データを保持しているコントローラー上で、動画コンテンツを選択すると、通常のコンテンツのコントロールに加えて、動作用のコントロールが表示されます.

### 動画コントロール

動画を保持しているコントローラーでは、動画コンテンツに次のようにコントロールが表示されます.

<img src="image/movie_control.png" alt="コントローラーでの動画コントロール" width="434" />
*コントローラーでの動画コントロール*

各コントロールでは以下の操作が可能です

1. 動画の再生、一時停止
2. 動画のシーク
3. コントローラPC上での音声コントロール
4. 動画送信のON/OFF
5. 音声送信のON/OFF

### 動画設定
動画を保持しているコントローラで、動画コンテンツを選択すると、Propertyウィンドウで、キャプチャデバイスの切り替えや、配信設定を行うことができます.

<img src="image/movie_setting.png" alt="動画設定" width="434" />
*動画設定*

以下の設定を行うことができます.

1. ビデオ入力デバイスを変更できます（カメラによる動画コンテンツの場合のみ設定可能）
2. オーディオ入力デバイスを変更できます（カメラによる動画コンテンツの場合のみ設定可能）
3. ビデオ品質の設定。
   `手動`を選択することで、WebRTCでストリーミングされるビデオのビットレートを設定できます.(※1)
   `原寸`を選択すると、WebRTC Datachannelを使用した配信モードに切り替わり、動画を原寸で劣化無しに配信することができます(※2)
4. オーディオ品質の設定。WebRTCでストリーミングされるオーディオのビットレートを設定できます.(※1)
5. コンテンツのメタデータに保存されているWebRTC品質情報を参照できます.

(※1)
ここで設定したビットレートは配信開始時のビットレートとして使用されます。
ビットレートはWebRTCによって配信時に最適なビットレートに自動的に変更されていくため、
設定したビットレートと実ビットレートは異なります。

(※2)
`原寸`での配信は、動画ファイルを配信する場合にのみ有効です。

### 動画の一括操作

同じグループ内にある動画コンテンツを、一括で再生・一時停止・頭出しすることができます。
操作は以下の手順で行います。

1. Contentタブで右クリック → グループ内動画の一括操作
2. 画面下に表示された動画一括制御コントローラより操作

<img src="image/movie_bulk.png" alt="動画設定" width="434" />
*動画の一括操作*


コントローラ権限と管理画面
========================================================================================

コントローラ権限
---------------------------------------------------
コントローラは以下の種別があり, 各コントローラごとにパスワード及びアクセス権限を設定することができます.

|種別|概要|アクセス|
| ---- | ---- | ---- |
|管理者|全ての機能にアクセスできる管理者|管理画面を含む全ての機能|
|グループ|各コンテンツグループごとの権限|管理者画面で設定したアクセス制限に従うデフォルトでは, 自グループとdefault のみの編集閲覧が可能　|

特殊な権限
Guest及びDisplayはパスワード無しで利用でき、アクセス権限のみを設定することができます.

|種別|概要|アクセス|
| ---- | ---- | ---- |
|Guest| パスワード無しで入れるGuest|管理者画面で設定したアクセス制限に従うデフォルトでは, default のみ編集閲覧が可能　|
|Display| Display 接続時の権限|管理者画面で設定したアクセス制限に従うデフォルトでは, 全てのグループの編集閲覧が可能　|

管理画面
---------------------------------------------------
コントローラーに, 管理者でログインすることで、Management メニューから, 管理画面にアクセスすることができま
す. 管理画面では, コントローラ権限や, 各種設定を行うことができます.

<img src="image/management1.png" alt="管理者ログイン時のメニュー" width="585" />
*管理者ログイン時のメニュー*
<br>
<img src="image/management2.png" alt="管理画面" width="585" height="auto" />
*管理画面*

### DB 管理
DB 管理では, 保存領域の新規作成, 切り替え, 名前変更, 削除, 初期化, を行えます.ただし, 最初に自動で作ら
れるdefault という保存領域については, 名前変更及び削除は行えません.

<img src="image/management3.png" alt=" DB 管理" width="585" />
*DB 管理*

### 履歴管理
履歴管理では, コンテンツの差し替え履歴の最大保存数を設定できます. 各コンテンツごとに, ここで設定した数だけ,
履歴が保存されます. この値は, グローバルな設定値で, DB を変更した場合でも同じ値が適用されます.

<img src="image/management4.png" alt=" 履歴管理" width="585" />
*履歴管理*


### 閲覧・編集権限の設定
閲覧・編集権限の設定では, コントローラごとの権限の設定が行えます.

<img src="image/management5.png" alt=" 閲覧・編集権限の設定" width="585" />
*閲覧・編集権限の設定*

 1. 設定対象コントローラを選択します.
 2. 選択中のコントローラが, 編集可能なコンテンツグループ, 及び, 閲覧可能なコンテンツグループを選択します.「全て」を選択した場合は, 新規に作成されたグループも閲覧・編集対象となります.
 3. 選択中のコントローラが, 編集可能なサイトを選択します.「全て」を選択した場合は, 新規に作成されたサイトも閲覧・編集対象となります.
 4. 選択中のコントローラに対して, グループの編集やDisplayを許可するかどうか設定します.

### パスワードの設定
パスワードの設定では, コントローラのパスワード変更を行えます. 
管理者のパスワードを変更する場合のみ, 変更前のパスワードが必要となります.

<img src="image/management6.png" alt="パスワードの設定" width="585" />
*パスワードの設定*

### ディスプレイ設定
ディスプレイ設定では, コンテンツ配信許可設定を変更できます.
許可されたディスプレイのみに配信されます.

<img src="image/management7.png" alt="ディスプレイ設定" width="585" />
*ディスプレイ設定*


ディスプレイ画面の操作
========================================================================================

概要
---------------------------------------------------

<img src="image/display.png" alt="ディスプレイ画面概要" width="585" />

ディスプレイの操作方法について解説します。 それぞれのタブ、ウィンドウ等、機能について解説します.

ディスプレイの操作：メニュー
---------------------------------------------------

ディスプレイでは、マウスもしくはタブレットの場合は画面へのタッチを行うと、メニューが表示されます。 メニューではいくつかの操作を行うことができます。

### コントローラ画面への切り替え

ディスプレイモードからコントローラモードへ切り替えることができます。

<img src="image/displaymenu1.png" alt="コントローラ画面への切り替え" width="207" />
*コントローラ画面への切り替え*

### フルスクリーンへの切り替え

ウインドウモードとフルスクリーンモードの切り替えが可能です。 フルスリーンからウインドウモードに戻る場合は、同じメニューを再度選択またはESCキーを押すことで 戻ることができます。

<img src="image/displaymenu2.png" alt="フルスリーンへの切り替え" width="207" />
*フルスリーンへの切り替え*

### Display IDの設定

コントローラで認識可能なディスプレイのIDを設定することができます。 任意の文字列を入力後、エンターキーを押すことで、設定することができます。

<img src="image/displaymenu3.png" alt="ディスプレイIDの設定" width="207" />
*ディスプレイIDの設定*

HIVEとの連携
========================================================================================

インタラクティブレンダリング
---------------------------------------------------

HIVEのインタラクティブレンダリング時に, グラフィクス画面をChOWDERに送信し, 表示させることができます (下図)

<img src="image/hive.png" alt="HIVEインタラクティブレンダリングの送信例" width="600" />
*HIVEインタラクティブレンダリングの送信例*

送信するには, HIVEの上部メニューにあるChOWDERボタンを押し, ChOWDERのURLを設定します.URLは, 初期状態では ws://localhost:8081/v2/ となっています. localhostの部分をChOWDERが動作しているPCのIPアドレスに変更して接続します. 接続中は, 上手のようにChOWDERボタンの色が変わります.

<img src="image/hive1.png" alt="ChOWDER接続用メニュー項目" width="321" />
*ChOWDER接続用メニュー項目*
<br>
<img src="image/hive2.png" alt="URL設定" width="321" />
*URL設定*

SceneNodeEditor
---------------------------------------------------

HIVEのSceneNodeEditorで, RenderForSIPノードを使用することで, レンダリング画像をChOWDERに送信し, 表示させることができます. プロパティのSEND先のURLは初期状態では ws://localhost:8081/v2/ となっています.

<img src="image/scene_node_editor.png" alt="SceneNodeEditorでの送信例" width="600" />
*SceneNodeEditorでの送信例*

Module System
---------------------------------------------------

HIVEのModuleSystemで, ChOWDERノードを使用することで, レンダリング画像をChOWDERに送信し, 表示させることができます. ChOWDERノードはBufferImageData形式の出力をもつノードと接続できるため、 接続可能な様々なノードの情報をChOWDERに送信することができます。

ChOWDERノードのプロパティでは、ChOWDERのコンテンツ送信先アドレス指定します。 デフォルトでは、 ws://localhost:8081/v2/ です。ここでは、ChOWDERサーバーのアドレスを指定してください。

<img src="image/hivemodulesystem.png" alt="ModuleSystemでの送信例" width="600" />
*ModuleSystemでの送信例*

Google Chrome Extensionの利用
========================================================================================

概要
---------------------------------------------------

Google ChromeにはExtensionと呼ばれる機能を拡張する仕組みがあります。 Google Chromeに専用のChOWDER用Extensionを追加することで、ウェブブラウザの画面をリアルタイムにキャプチャし、コンテンツとして追加することができます。

Extensionのインストール
---------------------------------------------------

Chromeに拡張機能をインストールし追加するには、Chromeの拡張機能をデベロッパーモードで使用する必要があります.

 1. 下図に示したようにブラウザの拡張機能のページを開きます.
 2. デベロッパーモードのトグルを有効にし、デベロッパーモードにします. 
 3. 一旦Chromeを再起動した後に、再度拡張機能ページを開きます.
 4. 拡張機能ページの、パッケージ化されていない拡張機能を読み込む、というメニューをクリックし、
  `ChOWDER/chrome_extension`ディレクトリを選択することで、追加されます。

<img src="image/extension01.png" alt="拡張機能ページを開くメニュー" width="585" />
*拡張機能ページを開くメニュー*
<br>
<img src="image/extension02.png" alt="デベロッパーモードをトグル" width="585" />
*デベロッパーモードをトグルし、パッケージ化されていない拡張機能を読み込む*

Extensionでキャプチャする
---------------------------------------------------

Extensionを追加したら、アイコンをクリックしてキャプチャを開始できます。

-   Extensionのメニュー

    -   Capture … 現在表示しているウェブページをキャプチャして, ChOWDERへ送信します.

    -   AutoCapture … 設定された時間間隔ごとに, 現在表示しているウェブページをキャプチャして, ChOWDERへ連続送信します.

    -   Setting … 設定メニューを開きます.

<img src="image/extension03.png" alt="Extensionのメニュー" width="207" />
*Extensionのメニュー*
<br>
<img src="image/extension04.png" alt="AutoCapture開始後" width="207" />
*AutoCapture開始後*

-   Extensionの設定

    -   URL … ChOWDERへ接続するためのURLを設定します.

    -   Interval … AutoCaptureで使用される, キャプチャ間隔を設定します.
  
<img src="image/extension_setting.png" alt="Extensionの設定" width="207" />
*Extensionの設定*

ChOWDER Desktop Captureの利用
========================================================================================

概要
---------------------------------------------------
ChOWDER Desktop Capture を用いることで、デスクトップ全体、アクティブなアプリケーションウィンドウ、選択
した範囲を画像コンテンツとしてChOWDER へ追加することができます。

インストールと動作環境
---------------------------------------------------

### インストールスクリプトの実行

Mac の場合
desktop capture 配下の以下のシェルスクリプトを実行します。

       $cd desktop_capture
       $sh make$app.sh

Windows の場合
desktop capture 配下の以下のファイルを実行します。

       >cd desktop_capture
       >make$_app.bat

### 動作環境

OS : Windows7, MacOSX 10.10

ChOWDER Desktop Captureの使い方
---------------------------------------------------

ChOWDER Desktop Capture では

* キャプチャ対象/範囲の選択、送信
* キャプチャ画像の送信間隔の設定
* キャプチャ画像の送信先のURL の設定
* キャプチャ画像の送信先のグループの設定
 
を行うことができます。

### キャプチャ対象/範囲の選択
#### キャプチャ対象の選択
ChOWDER Desktop Capture は起動時に
* デスクトップ全体
* アクティブなウィンドウ
をサムネイル化し、画面下部に表示します。

<img src="image/dc_cap01.png" alt="サムネイル一覧" width="400" />

キャプチャ対象の変更はサムネイルをクリックすることで行うことができます。クリックされた対象は画面上部にプ
レビューとして映し出されキャプチャ待機状態となります。

<img src="image/dc_cap02.png" alt="キャプチャ対象のプレビュー" width="300" />
*キャプチャ対象のプレビュー*

キャプチャ対象を選択した後に「Capture Start」ボタンを押下することでChOWDER への画像送信が開始されます。

<img src="image/dc_cap03.png" alt="Capture Start ボタン" width="600" />
*Capture Start ボタン*
<br>
<img src="image/dc_cap04.png" alt="Capture Start ボタンを押した時" width="600" />
*Capture Start ボタンを押した時*

#### キャプチャ範囲の選択
ChOWDER Desktop Capture では範囲選択を行うことで、画面の一部をChOWDER に画像として送信することがで
きます。

「Set Capture Area」ボタンを押下した後にChOWDER Desktop Capture が最小化され、マウスカーソルが範囲選択用
のインジケータに変化します。この状態でマウスを押下すると範囲選択状態に移行するので、キャプチャを行いたい範
囲までドラッグした後、マウスを離すことでキャプチャ範囲を指定することができます。

<img src="image/dc_cap05.png" alt="Set Capture Area ボタン" width="600" />
*Set Capture Area ボタン*
<br>
<img src="image/dc_cap06.png" alt="範囲選択状態" width="600" />
*範囲選択状態*
<br>
<img src="image/dc_cap07.png" alt="範囲選択プレビュー" width="600" />
*範囲選択プレビュー*

画像の送信は「キャプチャ対象の選択」と同様に、「Capture Start」ボタンを押下することで開始されます。

### キャプチャ間隔の設定
ChOWDER Desktop Capture では、ChOWDER への画像送信の送信間隔を設定することができます。Capture
Interval(sec) の右側のフォームに数値を入力するか、上下ボタンを押すことで変更されます。最低間隔は0.05(sec) で
す。「Reset」ボタンを押すことで初期値(1sec) が入力されます。

<img src="image/dc_cap08.png" alt="キャプチャ間隔設定フォーム" width="600" />
*キャプチャ間隔設定フォーム*

Capture Interval、ChOWDER URL、Target Group の値は、本アプリケーションを終了しても次回起動時に保持され
ます。

### キャプチャ画像の送信先のURL の設定
ChOWDER Desktop Capture では、画像の送信先（ChOWDER）のURL を設定することができます。ChOWDER
URL の右側のフォームに送信先のURL を入力することで変更されます。「Reset」ボタンを押すことで初期値が入力さ
れます。

<img src="image/dc_cap09.png" alt="送信先URL 設定フォーム" width="600" />
*送信先URL 設定フォーム*

### キャプチャ画像のグループの設定
ChOWDER Desktop Capture では、キャプチャ画像の送信先グループを設定することができます。Target Group の右
側のドロップダウンリストから選択することができます。「Reload」ボタンを押すことで初期値が入力されます。

<img src="image/dc_cap10.png" alt="送信先グループ設定フォーム" width="600" />
*送信先グループ設定フォーム*


Google Chrome Extension for WebRTCの利用
========================================================================================

概要
---------------------------------------------------

HTML5の機能であるWebRTCを利用して,スクリーン共有による動画コンテンツの配信行うことができます。
GoogleChromeではセキュリティー制限によりスクリーン共有することは通常できませんが、ChromeExtensionをインストールすることで、
動画配信することが可能です。


Extensionのインストール
---------------------------------------------------
Chromeに拡張機能をインストールし追加するには、Chromeの拡張機能をデベロッパーモードで使用する必要があります.

 1. [Extensionのインストール](#extensionのインストール) に示したようにブラウザの拡張機能のページを開きます.
 2. デベロッパーモードのトグルを有効にし、デベロッパーモードにします. 
 3. 一旦Chromeを再起動した後に、再度拡張機能ページを開きます.
 4. 拡張機能ページの、パッケージ化されていない拡張機能を読み込む、というメニューをクリックし、
  `ChOWDER/chrome_extension_for_webrtc`ディレクトリを選択することで、追加されます。

ChOWDERサーバーが別PCで動作している場合
---------------------------------------------------

chrome_extension_for_webrtc/manifest.jsonの"matches"にサーバーURLを追加する必要があります.
変更した際はエクステンションの再インストールが必要です.

```
[before]
  "externally_connectable": {
    "matches": ["*://127.0.0.1/*", "*://localhost/*"]
  },
```

```
[after]
  "externally_connectable": {
    "matches": ["*://127.0.0.1/*", "*://localhost/*", "*://any.somedomain.co.jp/*"]
  },
```


Extensionでキャプチャする
---------------------------------------------------

Extensionを追加したら、Add→ScreenShareを実行し、ダイアログにExtensionIDを入力することでキャプチャを開始できます。

<img src="image/AddContent_ScreenShare_View2.png" alt="ScreenShare開始時のExtensionIDの入力" width="600" />
*ScreenShare開始時のExtensionIDの入力*


大規模画像データ送信アプリケーションの利用
========================================================================================

概要
--------------------------------------------------------------------------------

CLIアプリケーション経由で、巨大な画像データをChOWDERサーバーに送信できます。


アプリケーションの設定
--------------------------------------------------------------------------------

設定ファイルを用いて、分割数やコンテンツID・グループを指定することができます。
設定ファイルは `tileimage` ディレクトリ下に `config.json` というファイル名で作成します。
設定ファイルの書式は以下の通りです:

    {
        "id": "APIUser",
        "password": "password",
        "url": "ws://localhost:8081/v2/",
        "xsplit": 8,
        "ysplit": 8,
        "contentid": "contentid",
        "contentgrp": "default",
        "reload_latest" : true,
	    "visible" : true
    }

-   `id` は `APIUser` で固定となります。
-   `password` には、 `APIUser` のパスワードを指定します。パスワードは、[管理画面](#管理画面) のパスワードの設定より変更が可能です。
-   `url` には、ChOWDER WebSocketサーバのURLを指定します。
-   `xsplit` ・ `ysplit` にはそれぞれ、横・縦方向の画像分割数を指定できます。
-   `contentid` ・ `contentgrp` にはそれぞれ、コンテンツID・コンテンツグループを指定します。
-   `reload_latest`には、`--metadata`オプションを使用して登録した最新画像を, Displayで表示し続けるかどうかを`true`または`false`で指定します。
-   `visible`には、登録した画像の可視不可視を`true`または`false`で設定します。

アプリケーションの利用方法
--------------------------------------------------------------------------------

コマンドプロンプトもしくはターミナルから、以下のコマンドを実行します。
コマンド引数を用いて、送信する画像のパスを指定します。

### Mac/Linuxの場合

`bin` ディレクトリ下で以下のシェルスクリプトを実行します.

    ./tileimage.sh

### Windowsの場合

`bin` ディレクトリ下で以下のコマンドを実行します.

    tileimage.bat

### コマンドオプション

-   `--config` (オプション) : 設定ファイルのパスを指定できます。デフォルトでは `tileimage/tileimage.json` を使います。
-   `--metadata` (オプション) : 画像のメタデータを設定できます。

コマンド例は以下の通りです:

    ./tileimage.sh --config=conf.json --metadata="{\"key\":\"value\"}" image.jpg
    

大規模画像データの表示と操作
========================================================================================

大規模画像データ送信アプリケーションによって登録された、大規模画像データは、
コントローラ上では、以下のようなアイコン付きで表示されます。
また、コントローラ上では、画像はオリジナルのサイズではなく、縮小版の画像が表示されます。

<img src="image/bigimage1.jpg" alt="大規模画像" width="500" />

ディスプレイ上では、他の画像コンテンツと同様に表示されます。

<img src="image/bigimage2.jpg" alt="大規模画像" width="500" />

コントローラ上で、大規模画像を選択し、以下の操作を行うことができます。

<img src="image/bigimage3.jpg" alt="大規模画像データ操作" width="600" />

 1. 大規模画像データの`metadata`として登録されている`key`を切り替えることができます。
 2. 大規模画像データの`metadata`として登録されている`value`を切り替えることができます。 `value`を切り替えることにより、大規模画像データの表示が、対応した画像データに切り替わります。
 3. この同期ボタンを押すと、選択中の大規模画像データが、同期状態になります。同じグループ内の、全ての同期状態のコンテンツは、`metadata`の `key` `value` の選択によって、対応した画像データに同時に切り替わります。
 4. 2の `value`変更操作を、スライダーを用いて行うことができます。


Electron版ChOWDERディスプレイアプリケーションの利用
========================================================================================

概要
--------------------------------------------------------------------------------

Electron版ChOWDERディスプレイアプリケーションを利用して、フレームレスウインドウを画面上に自動的に配置することができます。


アプリケーションのインストール
---------------------------------------------------


Electron版ChOWDERディスプレイのインストールは、ChOWDERのインストールに含まれています。
[アプリケーションのインストール方法](#アプリケーションのインストール方法) の項に沿って、node.jsをインストールし、ChOWDERのインストールスクリプトを実行してください。

アプリケーションの起動
---------------------------------------------------

`standalone-electron` ディレクトリ下の、以下のファイルを実行することで、Electron版ChOWDERディスプレイが起動します。
 - Windows版: ChOWDER-Standalone-Electron-win32-x64/ChOWDER-Standalone-Electron.exe
 - Mac版: ChOWDER-Standalone-Electron-darwin-x64/ChOWDER-Standalone-Electron.app
 - Linux版: ChOWDER-Standalone-Electron-linux-x64/ChOWDER-Standalone-Electron


アプリケーションの設定
---------------------------------------------------

Electron版ChOWDERディスプレイの設定は、JSON形式による設定ファイルで行うことができます。
設定ファイルは `standalone-electron` ディレクトリ下に `conf.json` というファイル名で作成します。
設定ファイルの書式は以下の通りです:

    {
        "url": "http://localhost:8080/view.html",
        "password" : "password",
        "windows": {
            "tile1": {
                "group": "sample",
                "position": [0, 0],
                "size" : [1920, 1080],
                "vda_position": [0, 0],
                "vda_scale": 1.0,
                "fullscreen": false,
                "frame": false
            },
            "tile2": {
                "group": "sample",
                "position": [1920, 0],
                "size" : [1920, 1080],
                "vda_position": [1920, 0],
                "vda_scale": 1.0,
                "fullscreen": false,
                "frame": false
            }
        }
    }

-   `url` には、ChOWDERサーバのURLを指定します。
-   `password` には、ディスプレイ配信許可用のパスワードを指定します。
     コントローラで`ElectronDisplay`に対して同様のパスワードを設定することで、
     ディスプレイの許可設定を個別に行うことなしに、コンテンツが配信されます。
-   `windows` は、ディスプレイIDをキー・ディスプレイ設定を値として持ったオブジェクトとなります。
    -   `group` には、サイトを指定します。
    -   `position` には、スクリーン左上を原点としたときの、ウインドウの位置`[横方向, 縦方向]`を指定します。
    -   `size` には、ウインドウのサイズ`[幅, 高さ]`を指定します。
    -   `vda_position` には、Virtual Display Screenの左上を原点としたときの、VDAの位置`[横方向, 縦方向]`を指定します。
    -   `vda_scale` には、VDA上における拡大率を指定します。
    -   `fullscreen` には、ウインドウのフルスクリーン表示を行うかどうかを指定します。
    -   `frame` には、ウインドウのフレームを表示するかどうかを指定します。

アプリケーションの設定の反映
---------------------------------------------------

`standalone-electron` ディレクトリで`npm install`を実行し、パッケージを上書きすることで、設定が反映されます。

リモートホストへのインストール
---------------------------------------------------

リモートホストへ、実行ファイルを含む以下のフォルダをコピーし、実行することで、リモートホスト上でもElectron版ChOWDERディスプレイが起動します
 - Windows版: ChOWDER-Standalone-Electron-win32-x64
 - Mac版: ChOWDER-Standalone-Electron-darwin-x64
 - Linux版: ChOWDER-Standalone-Electron-linux-x64

リモートホストへコピーした後に、設定ファイルを編集する場合は、実行ファイルのあるディレクトリにある、`conf.json`を編集してください。


HTTPSの利用
========================================================================================

概要
---------------------------------------------------

FireFox及びGoogleChromeでは、セキュリティー制限により、HTTPSを使用したときのみ、スクリーン共有やカメラ共有が有効となる場合があります.
ChOWDERでは標準でHTTPSサーバーも立ち上がっていて、仮の証明書を備えています.
デフォルトでは以下のURLにアクセスし、例外に追加することで、HTTPSを使用したページを使用することができます.

-   HTTPS用URL … https://localhost:9090
-   HTTPS用WebSocketポート … https://localhost:9091

