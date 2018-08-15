User Guide
=============================================================

Table of Contents
---------------------------------------------------

-   [はじめに]
    -   [動作環境とインストール]
-   [アプリケーションの展開方法]
-   [アプリケーションのインストール方法]
    -   [インストール](#インストール)
    -   [インストールスクリプトの実行]
-   [アプリケーションの起動方法]
    -   [Mac/Linuxの場合]
    -   [Windowsの場合]
    -   [起動確認]
    -   [コントローラへアクセス]
-   [アプリケーションの終了方法]
    -   [サーバープログラムの終了]
    -   [redisの終了]
-   [管理者初期設定]
    -   [管理者設定ファイル]
-   [ChOWDERのホーム画面]
    -   [ホーム画面説明]
-   [コントローラ画面の操作]
    -   [概要]
    -   [接続状態について]
    -   [Virtual Display Screenについて]
    -   [メインメニュー]
    -   [コンテンツの追加]
    -   [Displayタブ]
    -   [Contentタブ]
    -   [Searchタブ]
    -   [Propertyウィンドウ]
    -   [動画コンテンツの操作]
-   [ユーザー権限と管理画面]
    -   [ユーザー権限]
    -   [管理画面]
-   [ディスプレイ画面の操作]
    -   [概要]
    -   [ディスプレイの操作：メニュー]
-   [HIVEとの連携]
    -   [インタラクティブレンダリング]
    -   [SceneNodeEditor]
    -   [Module System]
-   [Google Chrome Extensionの利用]
    -   [概要]
    -   [Extensionのインストール]
    -   [Extensionでキャプチャする]
-   [ChOWDER Desktop Captureの利用]
    -   [概要]
    -   [ChOWDER Desktop Captureの使い方]
-   [Google Chrome Extension for WebRTCの利用]
    -   [概要]
    -   [Extensionのインストール]
    -   [Extensionでキャプチャする]
-   [HTTPSの利用]
    -   [概要]

Getting Started
==================================================================

This user guide contains information on how to operate ChOWDER. 

System Requirements and Installation
---------------------------------------------------

The following operating systems and web browsers are supported by ChOWDER. 

* OS
    * Linux(CentOS6)
    * Windows7
    * MacOSX 10.10

* Web Browsers
    * Apple Safari 9.x
    * Firefox 48.0
    * Chrome 53
    * Internet Explorer 11

Opening the Application
==================================================================

Extract the archive files.
The extracted files will be organized as follows

* bin : Run Script Folder
* client : Client Application Folder
* doc : Document Folder
* redis : Redis Application Folder
* server : Server Application Folder
* chrome_extension : Google Chrome Extensions Folder
* package.json

Use the script located in the bin folder to start the Collaborative workspace driver. 

Installing the Application
==================================================================

Installation
---------------------------------------------------

### Installing Node.js

The GUI Portal requires the installation of Node.js. Download the latest version from the official website (http://nodejs.org/). (See image below)

<img src="image/NodeJS.png" alt="node.jsのinstall画面" width="377" />
*Screenshot of node.js*

### Installing the Submodule for Node.js 

Install the third-party module for Node.js required to run ChOWDER in the application’s directory. 

Run Install Script
---------------------------------------------------

### For Mac/Linux

Run the shell script located in the bin folder.

       $cd bin
       $sh install.sh

### For Windows

Run the following batch file located in the bin directory. 

      >cd bin
      >install.bat

Launching the Application
==================================================================

For Mac/Linux
---------------------------------------------------

Run the shell script located in the bin folder.

       ./run.sh

For Windows
---------------------------------------------------

Run the following batch file located in the bin directory. 

       >cd bin
       >run.bat

* Redis may not run properly in Windows if the Virtual Memory is set to 0 Kbyte. To avoid this issue, temporarily enable Virtual Memory. 


Launch Confirmation
---------------------------------------------------

Run the startup script to launch the ChOWDER server.

       $sh run.sh
       (run.bat for Windows)

Accessing Controller(s)
---------------------------------------------------

Type http://localhost:8080 in the address bar of the web browser to access ChOWDER. 
Once you access ChOWDER and see the image below, the installation is complete. 

<img src="image/home.png" alt="install終了後ホーム画面" width="585" />
*Screenshot of home screen after installation is complete*

How to Quit the Application
==================================================================

There are two ways to quit.

Shut Down the Server Program
---------------------------------------------------

Use CTRL+C to close the terminal launched by run.sh(bat) or kill the server program.

Shutdown Redis
---------------------------------------------------

Close the terminal that redis is running on. 
If redis server is running a process, locate the process using the ps command and then kill. 

Initial Setup for Administrator
==================================================================

You can add an administrator user during start-up. 
Default password for the administrator is “admin”.

Administrator Setup File
---------------------------------------------------
To add or remove an administrator during start-up, create an admin.json file in the first folder of ChOWDER (the same folder that README.md is located in.) The admin.json format is as follows (you can also find this inside the admin.json.org file).

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

In this example, the “administrator” user is added (by overwriting/saving) and “administrator2” user is deleted. 

Type the administrator’s name followed by “command” : “add” to add and “command” : “delete” to remove an administrator. You will need a password when adding an administrator.
This json file will be read when launching ChOWDER and the administrator will be added or removed at that time. 
Once ChOWDER is launched and registered with the DB, there is no longer a need for the admin.json file. 

The Home Screen of ChOWDER
==================================================================

What’s On Your Home Screen
---------------------------------------------------

ChOWDER has two types of controllers, a Display/Controller control and Display.  After launching the application, type http://localhost:8080 in the address bar of the web browser to access ChOWDER. You will see the home screen above.

-   Controller:  You will be directed to the controller screen.

-   Display : You will be directed to the display screen.

You have a choice to use the computer you are accessing between “controller” and “display” modes. 

Navigating the Controller Screen
=================================================================

Summary
---------------------------------------------------

The controller is set up per below.

<img src="image/cont_1.png" alt="コントローラ画面概要" width="585" />
*Screenshot of controller screen*

Connection Status
---------------------------------------------------

The icon on the upper right hand of the screen indicates the connection status with the server.

<img src="image/connect.png" alt="サーバーとの接続ありの状態" width="283" />
*Connected to the server*
<br>
<img src="image/disconnect.png" alt="サーバーとの接続が無い状態" width="283" />
*Not connected to the server*

The Virtual Display Screen
---------------------------------------------------

The Virtual Display Screen is located in the center of the page and is used for general purposes to manage the display connected to ChOWDER as well as moving, managing and deleting Contents. 

<img src="image/TDD_View.png" alt="VirtualDisplayScreenの凡例" width="585" />
*Example of the Virtual Display Screen*

Main Menu
---------------------------------------------------

### Menu at Top of the Page

The menu at the top of the page contains various commands.

<img src="image/Upper.png" alt="画面上部領域" width="415" />
*Area at the Top of the Page*

### The Display Button

You can open the Display window by clicking on the Display button, as shown below. 

<img src="image/Left_Display.png" alt="Displayボタン押下時" width="415" />
*Menu when Display Button is Selected*

### Add Menu
You can add various contents using the Add menu.
For details, refer to Adding Contents.

<img src="image/header01.png" alt="Addメニュー展開時" width="415" />
*Menu when Add is Selected*

### Setting Menu

Under Setting, you can turn the Remote Cursor on or off.

<img src="image/SettingMenu.png" alt="Settingメニュー展開時" width="415" />
*Menu when Setting is Selected*

The Remote Cursor appears as below.

<imgsrc="image/remotecursor.png" alt="リモートカーソル" width="415" />
*Remote Cursor*

### Return Home

You can return Home by clicking on the ChOWDER link as shown below.

<imgsrc="image/home_return.png" alt="タイトル名のクリックでホームに戻る" width="415" />
*Click on Title to Return Home*

Adding Contents
---------------------------------------------------

You can add various contents by selecting Add in the Main Menu or using the Content Tab from the Menu located on the lower right part of the page. 

### Adding an Image File

Add an image file of your choice to Contents by any of the following methods. 

-   Main Menu ? Add ? Image
-   Content Tab (lower right menu) ? Add Content ? Image File
-   Right-click within the Content Tab ? Add Content ? Image File

The following image formats are accepted.

-   PNG format
-   JPEG format
-   GIF format
-   BMP format

The example below shows the screen after adding an image as a Content.

<img src="image/AddContent_Picture_View.png" alt="画像ファイルの追加例" width="434" />
*Example of an Added Image File*

### Adding Video Files
Add a video file of your choice to Contents by any of the following methods. 

-   Main Menu ? Add ? Movie
-   Content Tab (lower right menu) ? Add Content ? Video File
-   Right-click within the Content Tab ? Add Content ? Video File

MP4 file formats are accepted.
Once video files are imported, they are streamed via WebRTC. For details on WebRTC, refer to Working with Video Content.

The example below shows the screen after adding a video as a Content.

<img src="image/AddContent_Movie_View.png" alt="動画ファイルの追加例" width="434" />
*Example of an Added Video File*

### Adding Text

Add text of your choice to Contents by any of the following methods. 

-   Main Menu ? Add ? Text
-   Content Tab (lower right menu) ? Add Content ? Text
-   Right-click within the Content Tab ? Add Content ? Text

### Adding Text Files

Add a text file of your choice to Contents by any of the following methods. 

-   Main Menu ? Add ?TextFile
-   Content Tab (lower right menu) ? Add Content ?TextFile
-   Right-click within the Content Tab ? Add Content ?TextFile

The example below shows adding a text file

<img src="image/AddContent_TextFile_Select.png" alt="テキストファイルを選択" width="434" />
*Select TextFile*
<br>
<img src="image/AddContent_TextFile_View.png" alt="テキストファイルのVirtualScreenへの追加" width="585" />
Add Textfile to VirtualScreen

### Adding URL

Add an image from the specified URL to Contents by any of the following methods. 

-   Main Menu ? Add ? URL
-   Content Tab (lower right menu) ? Add Content ? URL
-   Right-click within the Content Tab ? Add Content ? URL

See example below.

<img src="image/AddContent_URL.png" alt="URL送信ボタン" width="472" />
*Submit URL Button*

Adding an URL looks like below.

<img src="image/AddContent_URL_View.png" alt="URL追加後の様子" width="472" />
*Screen after Adding URL*

### Adding a Shared Screen

Add a shared screen to Contents by any of the following methods. 

-   Main Menu ? Add ?ScreenShare
-   Content Tab (lower right menu) ? Add Content ?ScreenShare
-   Right-click within the Content Tab ? Add Content ?ScreenShare

Captured videos are streamed via WebRTC.
For instructions on working with/ video contents, refer to Working with Video Contents.

The example below shows the screen after adding a shared screen.

<img src="image/AddContent_ScreenShare_View.png" alt="スクリーン共有の追加例" width="434" />
*Example of an Added Shared Screen*

### Shared Camera

Add a shared camera to Contents by any of the following methods. 

-   Main Menu ? Add ?CameraShare
-   Content Tab (lower right menu) ? Add Content ?CameraShare
-   Right-click within the Content Tab ? Add Content ?CameraShare

Captured videos are streamed via WebRTC.
For instructions on working with video contents, refer to Working with Video Contents.

The example below shows the screen after adding a shared camera to contents.

<img src="image/AddContent_CameraShare_View.png" alt="カメラ共有の追加例" width="434" />
*Example of an Added Shared Camera*

Display Tab
---------------------------------------------------

<img src="image/Display_TAB_2conn.png" alt="image" width="207" />
*Display Tab*

The Display tab shows the VirtualDisplay and all Display connected to the ChOWDER server. The Controller allows you to move the Display within VirtualDisplay. Adding Contents to the arranged Display enables a shared workspace. Use the mouse to drag and drop the Display into the VirtualDisplaySpace. 
The example above shows the environment once a client is connected. 

Setting Up Virtual Display
---------------------

<img src="image/VirtualDisplaySetting.png" alt="image" width="207" />
*Setting Up Virtual Display*

### Setting up Splits (Sub-Divisions)

Go to the Display tab and select Virtual Display to set up Virtual Display in the Property window. In the example above, the Virtual Display settings are 1500 pixels for width, 1500 pixels for height, horizontal split (sub-division) 2, and vertical split (sub-division) 2. 

### Snap Function

The Snap function helps you accurately align your display with the selected area.
You can switch between modes using the dropdown list seen below. 

<img src="image/MIGIUE_Disp.png" alt="Snap機能の設定プルダウンボタン" width="207" />
*Pulldown Button for the Snap Function*

* Free: No restrictions
* Display: Display and Contents snap in alignment with the laid out Display
* Grid: Display and Contents snap in alignment with the split (sub-division) specified by VirtualDisplaySetting

The example below demonstrates using the snap function for layout purposes. 

<img src="image/Snap1.png" alt="Snap機能ドラッグ時凡例" width="585" />
*Example of Drag Function with Snap*

You can enlarge and reduce the VirtualDisplaySpace using the Scale function. 
Place the mouse inside the screen to right-click and drag to enlarge or reduce the screen.

<img src="image/MIGIUE_Scale.png" alt="scale後の例（コンテンツが小さく表示されている）" width="377" />
*Example of Scale Function (Contents are reduced in size)*

### Display and ID

You can differentiate between all the connected Display by the Display ID shown above each Display. 
IDs are specific to the connected terminal whereby each terminal is assigned one ID. 

<img src="image/3Button1.png" alt="Display ID" width="283" />
*Display ID*

### Delete Button

The Delete button deletes the selected Display (by disconnecting from the ChOWDER server).

<img src="image/3Button2.png" alt="削除ボタン" width="377" />
*Delete Button*

Note you will not be able to delete the VirtualDisplay

### Select All Button

The Select All button selects all connected Display.

<img src="image/3Button3.png" alt="全選択ボタン" width="377" />
*Select All Button*

Content Tab
--------------------------------

To view Contents in Display, go to the Contents tab on the bottom of the page and drag and drop Contents into Display. 

### View Contents 

Select Content from the list and drag and drop to the VirtualScreen area in the middle to view Content. 
<img src="image/DragAndDropContent.png" alt="Contentsの表示" width="434" />
*View Content(s)*

### Working with Content(s)

Once added, you can select Content by left-clicking the mouse, or by pressing Ctrl and left-clicking the mouse to select multiple Contents. 
After selecting, you will see the Content Manipulator and editing buttons (see below image). 

-   Selection buttons
    -   Highlight button ? highlights selected contents
                         Highlighted contents appear in Display with thick borders according to Group color.
    -   Metadata button ? Metadata of Contents appear in Display
    -   Hide button ? Hides Contents from the VirtualDisplaySpace
                       Hidden contents can be viewed again by going to Contents and dragging and dropping.

<img src="image/manip.png" alt="コンテンツ操作用マニピュレータ" height="321" />
*Contents Manipulator*

### Content Tab Menu

You will find various editing tools in the dropdown list by selecting the menu button located in the bottom right section of tab area.

<img src="image/DragAndDropContent2.png" alt="Contentsの追加" width="434" />
*Adding Contents*	

### Replacing Images

The example below shows how to replace images selected within the Contents tab.

<img src="image/SASHI.png" alt="画像の差し替えボタン" width="434" />
*Image Replacement Button*

Follow the example below to replace the Contents in the Contents tab.

<img src="image/YUMUSHI.png" alt="画像の差し替えし指定" width="434" />
*Select Replacement Image*
<br>
<img src="image/SASHI2.png" alt="画像の差し替え結果" width="434" />
*Image Replaced*

### Group Setup

You can make changes to the settings of the Group assigned to Contents in the Content tab. You can add a group or change the order of groups by using the designated command buttons. In the settings menu, you can change the name of the group, the color of the group and delete the group.  

<img src="image/group1.png" alt="Groupの追加, 順序変更" height="321" />
*Adding Groups, Changing Order of Groups*

<br>
<img src="image/group2.png" alt="Groupの設定" height="321" />
*Group Setting*

### Assigning Groups

You can make changes to the Group assigned to Contents by right-clicking Contents or through the menu on the lower right side of the screen. 

<img src="image/group3.png" alt="Groupの変更" height="321" />
*Make Changes to Groups*

Search Tab
-------------------------------

You can search through added Contents using the Search tab.

<img src="image/search_tab.png" alt="Contentsの検索が可能" width="434" />
*Option to Search Contents*

### Search Metadata

You can search Metadata by using the text box in the Search tab. The search will be for Groups that have a check mark in the check box. 

<img src="image/searchcheck.png" alt="対象となるグループの選択" width="434" />
*Selecting Groups to Search*

Layout Tab
-------------------------------

The Layout tab allows you to save the current view of Contents as a Layout.

### Adding Layout

You can add to Layout by right-clicking the Layout list on the bottom of the screen or through the menu on the lower right side of the screen. Adding to Layout will apply to Groups that have a check mark in the check box. 

### Saving Layout

You can overwrite/save the current view of Contents in the selected Layout.

<img src="image/layout_tab.png" alt="Layoutタブ" width="434" />
*Layout Tab*

### Make Changes to Group

Change the Group composition of the Layout

<img src="image/layoutmenu1.png" alt="Layoutメニュー" width="434" />
*Layout Menu*

### Applying Layout

To apply a Layout, select Layout Contents from the Layout list on the bottom of the screen and drag and drop to the screen. 

PropertyWindow
-------------------------------

<img src="image/Prop_Down.png" alt="image" width="188" />

The Property Window shows the selected Contents, Display, ContentsID and other properties. Property allows you to edit items other than ID and set coordinates as well as the stacking order (Z-index). You can also download the selected Contents from the Download Button located on the bottom of the Property Window. 

Working with Video Content
-------------------------------

### Working with Video Content

In addition to regular content control, by selecting video content while using a Controller connected to video data, you can view control (commands) pertaining to motion.  

### Video Control

The controls for video contents using the Controller connected to video can be seen below.

<img src="image/movie_control.png" alt="コントローラーでの動画コントロール" width="434" />
*Video Control Using Controller*

The function of each control is as follows:  

-   i. Play or Pause Video
-   ii. Seekbar for Video
-   iii. Volume control for the computer’s controller
-   iv. ON/OFF switch for transmitting video
-   v. ON/OFF switch for transmitting sound

# Video Setup
動画を保持しているコントローラで、動画コンテンツを選択すると、Propertyウィンドウで、キャプチャデバイスの切り替えや、配信設定を行うことができます.

<img src="image/movie_setting.png" alt="動画設定" width="434" />
*動画設定*

以下の設定を行うことができます.

-   i. ビデオ入力デバイスを変更できます（カメラによる動画コンテンツの場合のみ設定可能）
-   ii. オーディオ入力デバイスを変更できます（カメラによる動画コンテンツの場合のみ設定可能）
-   iii. ビデオ品質の設定。WebRTCでストリーミングされるビデオのビットレートを設定できます.
-   ix. オーディオ品質の設定。WebRTCでストリーミングされるオーディオのビットレートを設定できます.
-   x. コンテンツのメタデータに保存されているWebRTC品質情報を参照できます.


ユーザー権限と管理画面
==================================================================

ユーザー権限
---------------------------------------------------
ユーザー以下の種別があり, 各ユーザーごとにパスワード及びアクセス権限を設定することができます.

|ユーザー|概要|アクセス|
|管理者|全ての機能にアクセスできる管理者|管理画面を含む全ての機能|
|グループユーザー|各グループごとのユーザー|管理者画面で設定したアクセス制限に従うデフォルトでは, 自グループとdefault のみの編集閲覧が可能　|
|Display| Display 接続時のユーザー|管理者画面で設定したアクセス制限に従うデフォルトでは, 全てのグループの編集閲覧が可能　|
|Guest| パスワード無しで入れるGuestユーザー|管理者画面で設定したアクセス制限に従うデフォルトでは, default のみ編集閲覧が可能　|

管理画面
---------------------------------------------------
コントローラーに, 管理者でログインすることで、Management メニューから, 管理画面にアクセスすることができます. 管理画面では, ユーザー権限や, 各種設定を行うことができます.

<img src="image/management1.png" alt="管理者ログイン時のメニュー" width="585" />
*管理者ログイン時のメニュー*
<br>
<img src="image/management2.png" alt="管理画面" width="585" height="auto" />
*管理画面*

DB 管理
DB 管理では, 保存領域の新規作成, 切り替え, 名前変更, 削除, 初期化, を行えます.ただし, 最初に自動で作られるdefault という保存領域については, 名前変更及び削除は行えません.

<img src="image/management3.png" alt=" DB 管理" width="585" />
*DB 管理*

履歴管理
履歴管理では, コンテンツの差し替え履歴の最大保存数を設定できます. 各コンテンツごとに, ここで設定した数だけ, 履歴が保存されます. この値は, グローバルな設定値で, DB を変更した場合でも同じ値が適用されます.

<img src="image/management4.png" alt=" 履歴管理" width="585" />
*履歴管理*


閲覧・編集権限の設定
閲覧・編集権限の設定では, ユーザーごとの権限の設定が行えます.

<img src="image/management5.png" alt=" 閲覧・編集権限の設定" width="585" />
*閲覧・編集権限の設定*

 1. 設定対象ユーザーを選択します.
 2. 選択中のユーザーが, 編集可能なユーザー, 及び, 閲覧可能なユーザーを選択します.「全て」を選択した場合は, 新規に作成されたグループも閲覧・編集対象となります.
 3. 選択中のユーザーに対して, グループの編集やDisplay の操作を許可するかどうか設定します.

パスワードの設定
パスワードの設定では, ユーザーのパスワード変更を行えます. 
管理者のパスワードを変更する場合のみ, 変更前のパスワードが必要となります.

<img src="image/management6.png" alt="パスワードの設定" width="585" />
*パスワードの設定*


ディスプレイ画面の操作
==================================================================

概要
---------------------------------------------------

<img src="image/display.png" alt="ディスプレイ画面概要" width="585" />

ディスプレイの操作方法について解説します。それぞれのタブ、ウィンドウ等、機能について解説します.

ディスプレイの操作：メニュー
---------------------------------------------------

ディスプレイでは、マウスもしくはタブレットの場合は画面へのタッチを行うと、メニューが表示されます。メニューではいくつかの操作を行うことができます。

コントローラ画面への切り替え

ディスプレイモードからコントローラモードへ切り替えることができます。

<img src="image/displaymenu1.png" alt="コントローラ画面への切り替え" width="207" />
*コントローラ画面への切り替え*

フルスクリーンへの切り替え

ウインドウモードとウインドウモードの切り替えが可能です。フルスリーンからウインドウモードに戻る場合は、同じメニューを再度選択またはESCキーを押すことで戻ることができます。

<img src="image/displaymenu2.png" alt="フルスリーンへの切り替え" width="207" />
*フルスリーンへの切り替え*

Display IDの設定

コントローラで認識可能なディスプレイのIDを設定することができます。任意の文字列を入力後、エンターキーを押すことで、設定することができます。

<img src="image/displaymenu3.png" alt="ディスプレイIDの設定" width="207" />
*ディスプレイIDの設定*

HIVEとの連携
==================================================================

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

HIVEのModuleSystemで, ChOWDERノードを使用することで, レンダリング画像をChOWDERに送信し, 表示させることができます. ChOWDERノードはBufferImageData形式の出力をもつノードと接続できるため、接続可能な様々なノードの情報をChOWDERに送信することができます。

ChOWDERノードのプロパティでは、ChOWDERのコンテンツ送信先アドレス指定します。デフォルトでは、 ws://localhost:8081/v2/ です。ここでは、ChOWDERサーバーのアドレスを指定してください。

<img src="image/hivemodulesystem.png" alt="ModuleSystemでの送信例" width="600" />
*ModuleSystemでの送信例*

Google Chrome Extensionの利用
==================================================================

概要
---------------------------------------------------

Google ChromeにはExtensionと呼ばれる機能を拡張する仕組みがあります。 Google Chromeに専用のChOWDER用Extensionを追加することで、ウェブブラウザの画面をリアルタイムにキャプチャし、コンテンツとして追加することができます。

Extensionのインストール
---------------------------------------------------

プロジェクトルートにあるbinディレクトリのなかにchrome_extention.crxという名前のファイルがあり、これがGoogle Chrome用のExtensionファイルです.

Chromeに拡張機能をインストールし追加するには、下図に示したようにブラウザの拡張機能のページを開きます.

そこにExtensionファイルをドラッグアンドドロップし、インストールします.

<img src="image/extension01.png" alt="拡張機能ページを開くメニュー" width="585" />
*拡張機能ページを開くメニュー*
<br>
<img src="image/extension02.png" alt="Extensionファイルのドラッグアンドドロップ" width="585" />
*Extensionファイルのドラッグアンドドロップ*

Extensionでキャプチャする
---------------------------------------------------

Extensionを追加したら、アイコンをクリックしてキャプチャを開始できます。

-   Extensionのメニュー

    -   Capture …現在表示しているウェブページをキャプチャして, ChOWDERへ送信します.

    -   AutoCapture…設定された時間間隔ごとに, 現在表示しているウェブページをキャプチャして, ChOWDERへ連続送信します.

    -   Setting …設定メニューを開きます.

<img src="image/extension03.png" alt="Extensionのメニュー" width="207" />
*Extensionのメニュー*	
<br>
<img src="image/extension04.png" alt="AutoCapture開始後" width="207" />
*AutoCapture開始後*

-   Extensionの設定

    -   URL …ChOWDERへ接続するためのURLを設定します.

    -   Interval …AutoCaptureで使用される, キャプチャ間隔を設定します.

<img src="image/extension_setting.png" alt="Extensionの設定" width="207" />
*Extensionの設定*

ChOWDER Desktop Captureの利用
==================================================================

概要
---------------------------------------------------
ChOWDER Desktop Capture を用いることで、デスクトップ全体、アクティブなアプリケーションウィンドウ、選択した範囲を画像コンテンツとしてChOWDERへ追加することができます。

インストールと動作環境
---------------------------------------------------

インストールスクリプトの実行

Mac の場合
desktop capture 配下の以下のシェルスクリプトを実行します。

       $cd desktop_capture
       $sh make$app.sh

Windows の場合
desktop capture 配下の以下のファイルを実行します。

>cd desktop_capture
>make$_app.bat

動作環境

OS : Windows7, MacOSX 10.10

ChOWDER Desktop Captureの使い方
---------------------------------------------------

ChOWDER Desktop Capture では

* キャプチャ対象/範囲の選択、送信
* キャプチャ画像の送信間隔の設定
* キャプチャ画像の送信先のURL の設定
* キャプチャ画像の送信先のグループの設定

を行うことができます。

キャプチャ対象/範囲の選択
キャプチャ対象の選択
ChOWDER Desktop Capture は起動時に
* デスクトップ全体
* アクティブなウィンドウ
をサムネイル化し、画面下部に表示します。

<img src="image/dc_cap01.png" alt="サムネイル一覧" width="400" />

キャプチャ対象の変更はサムネイルをクリックすることで行うことができます。クリックされた対象は画面上部にプレビューとして映し出されキャプチャ待機状態となります。

<img src="image/dc_cap02.png" alt="キャプチャ対象のプレビュー" width="300" />
*キャプチャ対象のプレビュー*

キャプチャ対象を選択した後に「Capture Start」ボタンを押下することでChOWDERへの画像送信が開始されます。

<img src="image/dc_cap03.png" alt="Capture Start ボタン" width="600" />
*Capture Start ボタン*
<br>
<img src="image/dc_cap04.png" alt="Capture Start ボタンを押した時" width="600" />
*Capture Start ボタンを押した時*

#### キャプチャ範囲の選択
ChOWDER Desktop Capture では範囲選択を行うことで、画面の一部をChOWDERに画像として送信することができます。

「Set Capture Area」ボタンを押下した後にChOWDER Desktop Capture が最小化され、マウスカーソルが範囲選択用のインジケータに変化します。この状態でマウスを押下すると範囲選択状態に移行するので、キャプチャを行いたい範囲までドラッグした後、マウスを離すことでキャプチャ範囲を指定することができます。

<img src="image/dc_cap05.png" alt="Set Capture Area ボタン" width="600" />
*Set Capture Area ボタン*
<br>
<img src="image/dc_cap06.png" alt="範囲選択状態" width="600" />
*範囲選択状態*
<br>
<img src="image/dc_cap07.png" alt="範囲選択プレビュー" width="600" />
*範囲選択プレビュー*

画像の送信は「キャプチャ対象の選択」と同様に、「Capture Start」ボタンを押下することで開始されます。

キャプチャ間隔の設定
ChOWDER Desktop Capture では、ChOWDERへの画像送信の送信間隔を設定することができます。Capture Interval(sec) の右側のフォームに数値を入力するか、上下ボタンを押すことで変更されます。最低間隔は0.05(sec) です。「Reset」ボタンを押すことで初期値(1sec) が入力されます。

<img src="image/dc_cap08.png" alt="キャプチャ間隔設定フォーム" width="600" />
*キャプチャ間隔設定フォーム*

Capture Interval、ChOWDER URL、Target Group の値は、本アプリケーションを終了しても次回起動時に保持され
ます。

キャプチャ画像の送信先のURL の設定
ChOWDER Desktop Capture では、画像の送信先（ChOWDER）のURL を設定することができます。ChOWDER URL の右側のフォームに送信先のURL を入力することで変更されます。「Reset」ボタンを押すことで初期値が入力されます。

<img src="image/dc_cap09.png" alt="送信先URL 設定フォーム" width="600" />
*送信先URL 設定フォーム*

キャプチャ画像のグループの設定
ChOWDER Desktop Capture では、キャプチャ画像の送信先グループを設定することができます。Target Group の右側のドロップダウンリストから選択することができます。「Reload」ボタンを押すことで初期値が入力されます。

<img src="image/dc_cap10.png" alt="送信先グループ設定フォーム" width="600" />
*送信先グループ設定フォーム*


Google Chrome Extension for WebRTCの利用
==================================================================

概要
---------------------------------------------------

HTML5の機能であるWebRTCを利用して,スクリーン共有による動画コンテンツの配信行うことができます。
GoogleChromeではセキュリティー制限によりスクリーン共有することは通常できませんが、ChromeExtensionをインストールすることで、動画配信することが可能です。


Extensionのインストール
---------------------------------------------------

プロジェクトルートにあるbinディレクトリのなかにchrome\_extention\_for\_webrtc.crxという名前のファイルがあり、これがGoogle Chrome用のExtensionファイルです.

Chromeに拡張機能をインストールし追加するには、[Extensionのインストール](#extensionのインストール) に示したようにブラウザの拡張機能のページを開きます.

そこにExtensionファイルをドラッグアンドドロップし、インストールします.

Extensionでキャプチャする
---------------------------------------------------

Extensionを追加したら、Add→ScreenShareを実行し、ダイアログにExtensionIDを入力することでキャプチャを開始できます。

<img src="image/AddContent_ScreenShare_View2.png" alt="ScreenShare開始時のExtensionIDの入力" width="600" />
*ScreenShare開始時のExtensionIDの入力*


HTTPSの利用
==================================================================

Summary
概要
---------------------------------------------------

FireFox及びGoogleChromeでは、セキュリティー制限により、HTTPSを使用したときのみ、スクリーン共有やカメラ共有が有効となる場合があります.
ChOWDERでは標準でHTTPSサーバーも立ち上がっていて、仮の証明書を備えています.
デフォルトでは以下のURLにアクセスし、例外に追加することで、HTTPSを使用したページを使用することができます.

-   HTTPS用URL … https://localhost:9090
-   HTTPS用WebSocketポート… https://localhost:9091


