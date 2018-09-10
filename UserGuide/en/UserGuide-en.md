User Guide for ChOWDER
=============================================================

{>>一般論として，日本語で読むと自然な文でも英語にしてみると前後文との重複が際立って気が散ることがあります．これらは必要に応じて消してしまいました．<<}
{>>日本語版にない情報が書いてあった場合は，なるべく残しました．<<}
{>>tiled displays という用語は，田の字のように，全体で矩形領域を構成するディスプレイ構成に聞こえます．ChOWDERはせっかく田の字以外の構成を許しているので，より広範な用語を探すと良いかもしれません．<<}

Table of Contents
---------------------------------------------------
{>>TODO: ToC作成<<}

{>>Getting Startedの項目は文章構造上不要なので消しました<<}

About ChOWDER
==================================================================

{>>導入が必要なので追加<<}
ChOWDER is a tiled displays manager designed especially for collaborations among different locations. Each location can have different physical configuration, i.e. different screen resolutions and tiling setup. Tiles may also have different resolutions within its tiled displays. New locations can be added during the meeting session in an *ad hoc* manner.
Contents resides in a single display area, or the *virtual display area*, and are rendered in your tiled displays. In the virtual display area, each tile is mapped to its rectangular region. This region can be modified interactively depending on the physical configuration and following the course of the meeting.

For example, members of two groups from different locations can co-work on a shared screen while another person can independently work on a separated issue and include the contents in a later stage. {>>あまり自信がないですが説得力のある事例ありますか？<<} For efficient network usage, the contents are firstly distributed to each display before being rendered, and then the coordinates in the virtual display area are communicated through the network. 

The rest of this user guide documents how you can set up and use ChOWDER.

System Requirements
==================================================================

ChOWDER requires a computer on which a single server program will run. Each tile of your tiled displays shall display a web browser window. The browser  renders a webpage, which is actually a client which renders the contents received from the server.

ChOWDER supports the following evironments.

Operating systems to run the server program:
  - Linux (CentOS 6 {>>or higher?<<})
  - Windows7 {>>or higher?<<}
  - MacOSX 10.10 {>>or higher?<<}

Web browsers to render client pages:
  - Safari 9.x {>>or higher<<}
  - Firefox 48.0 {>>or higher<<}
  - Google Chrome 53 {>>or higher<<}
  - Internet Explorer 11 {>>or higher<<}

Each tile must display a web browser in full screen mode.

Unarchiving the Source
==================================================================

Extract the archive files.
The top directory shall contain the following directories and file

- bin: Executables
- client: Client Applications
- doc: Documentations
- redis: Components for [Redis](https://redis.io)
- server: ChOWDER's Server
- chrome_extension: Google Chrome Extensions
- package.json: {>>Package configuration?<<}

{--Use the script located in the bin folder to start the Collaborative workspace driver. --} {>>後ろへ移動？<<}

Installation
==================================================================

Setting up Node.js
---------------------------------------------------

### Installing Node.js

The GUI Portal {>>GUI Portalとはなんですか？ChOWDER serverではだめでしょうか？<<} depends on Node.js. Download the latest version of Node.js from [the official website] (`http://nodejs.org/`). {>>Set it up following [which page]()???<<}

<img src="image/NodeJS.png" alt="node.jsのinstall画面" width="377" />
*The download page of Node.js, screen-captured at the time of writing this document.*

### Installing Submodules for Node.js 

Install in the {>>server?<<} application directory the third-party modules of Node.js required by ChOWDER. 
{>>how?<<}

Installing ChOWDER-Specific Components
---------------------------------------------------

### On Macs or Linux

Run the installation script in the `bin` directory.

~~~
  $ cd bin
  $ sh install.sh {>>./install.sh じゃだめですか？<<}
~~~

### On Windows

Run the installation script in the `bin` directory. 

~~~
  > cd bin
  > install.bat
~~~

Launching ChOWDER's Server
==================================================================

On Macs or Linux
---------------------------------------------------

Run the execution script in the `bin` directory.

~~~
  $ cd bin
  $ ./run.sh
~~~

On Windows
---------------------------------------------------

Run the execution script in the `bin` directory. 

~~~
  > cd bin
  > run.bat
~~~

- Redis may not run properly on Windows if the virtual memory is set to 0 kb. {>>To avoid this issue, set it to non-zero...は冗長なので削除<<}{>>このvirtual memoryというのはWindowsの機能でしょうか？それともretis?Node.js?<<}

Accessing ChOWDER from a Web Browser
---------------------------------------------------

{>>ChOWDER uses the same URL for the access to both the server and clients<<}
Enter ChOWDER's URL (`http://localhost:8080` by default) in the address bar of a web browser.
{--Once you see ChOWDER's startup page (see the image below), the server should be configured properly.--}{>>この文は，まず不要なのと，それとControllerのアクセスの説明そのものではないので，ここから削除します．<<}

<img src="image/home.png" alt="install終了後ホーム画面" width="585" />
*The home screen of ChOWDER's client page*

Quitting the Application
==================================================================

Kill the ChOWDER server and redis (e.g. by hitting CTRL+C in the terminal). {>>Redis may require manually killing its subprocess. You can, for example, use `ps` to find their process IDs and `kill` to kill them. 信じがたいのですが，本当でしょうか?　Windowsのみ？<<}

Managing Permissions
==================================================================
ChOWDER has 4 permission types. An *administrator* permission lets one access and edit all the functionalities of ChOWDER.
A *display* 
In a typical scenario, many users work in a group in front of a tiled displays system. A *group user* permission is designed for this purpose. By default, this permission lets one view and edit the contents of her belonging group from their own computers.

|User Categpry| Overview |Access Level|
| ---- | ---- | ---- |
|Administrator| Administrator can access all functions | All functions including Administrator Screen |
|Group User| User per Group | Default setting of access restrictions of the Administrator Screen permits editing and viewing for own group and default setting|
|Display| User Connected to Display | Default setting of access restrictions of the Administrator Screen permits editing and viewing for all groups |
|Guest| Guest User without Password | Default setting of access restrictions of the Administrator Screen permits editing and viewing for default setting only |

You can set password and level of access per user. 

Managing Administrative Users
---------------------------------------------------
{>>原文のInitial setup for administratorは長くて意味が取れなかったので<<}
{>>Administratorには何をする権限があるのでしょうか？<<}

{>>ChOWDER keeps the information of administrators in a redis database.<<}
You can modify the administrator configurations by starting up ChOWDER.
{>>デフォルトの管理者名はなんでしょうか？<<}
The default password for the administrator is “admin”. {>>administrator とは何をする人でしょうか？<<}
{>>この作業はファイルをパースするよりもGUIの方が利便的なのですがセキュリティ上の理由があるのでしょうか？<<}

The section "User Permissions and Administrator Screen" in this document gives a more 

The Administrator Configuration File
---------------------------------------------------
To add or remove an administrator during the startup, create an `admin.json` file directly under the root directory of ChOWDER (the same directory under which `README.md` is placed.) See below for an example `admin.json` (`admin.json.org` under the root directory has the same file contents).

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

In this example, the user "administrator" is added  and “administrator2” is deleted. {>>add コマンドでoverwriteするのはちょっと非直感的なので，この文では言及しません．<<}In fact, the name, "administrator" or "administrator2", can be an arbitrary character string.

The entry `“command” : “add”` adds an administrator (actually, the same command can be used for overwriting an existing administrator configuration).  `“command” : “delete”` deletes an administrator. The `"password"` entry is mandatory when adding an administrator.
The `admin.json` file will be processed when launching ChOWDER and administrators will be added or removed at that time. 
Once ChOWDER is launched, and thus the administrator configuration is reflected in the database, `admin.json` should be removed manually.{>>この挙動は修正されないのでしょうか？自動で消すなど．<<}

The Home Screen of ChOWDER
==================================================================

What’s on Your Home Screen?
---------------------------------------------------

To access ChOWDER, run the server and visit `http://localhost:8080` with a web browser to open the home screen. The screen offers two modes, *display* and *controller*.

- **Controller mode** lets you set the screen configuration and move the displayed contents.

- **Display mode** renders the content in the browser window.

Usually, you want to choose the controller mode on a computer screen and the display mode on tiled displays.

Navigating through the Controller Screen
=================================================================

Overview
---------------------------------------------------

In the controller screen, you can control what is displayed on the tiled displays and manage the tiling setup. The visual contents are added into a special area in the control screen, the [Contents] tab, to ease the contents management. You add files to this tab and toggle its visibility in the tiled displays (or in the virtual display area, to be more precise).

<img src="image/cont_1.png" alt="コントローラ画面概要" width="585" />
*Screenshot of the controller screen*

Connection Status
---------------------------------------------------

The icon in the upper right of the screen indicates the status of the connection to the server.

<img src="image/connect.png" alt="サーバーとの接続ありの状態" width="283" />
*Status icon when connected to the server*
<br>
<img src="image/disconnect.png" alt="サーバーとの接続が無い状態" width="283" />
*Status icon when not connected to the server*

The Virtual Display Area
---------------------------------------------------

The virtual display area is located in the center of the browser page. It shows how tiles are arranged together with the displayed visual contents such as images, documents, and videos. Use it for arranging the display tiling. You can also add, move, interact with, and delete visual contents.

<img src="image/TDD_View.png" alt="VirtualDisplayScreenの凡例" width="585" />
*Example of the virtual display area*

ChOWDER's Menubar
---------------------------------------------------

The menubar at the top of the browser page lists various actions that ChOWDER offers.

<img src="image/Upper.png" alt="画面上部領域" width="415" />
*Area at the Top of the Page*

### [Display]

You can add a display tile by clicking on the [Controller]>[Display] menu. 

<img src="image/Left_Display.png" alt="Displayボタン押下時" width="415" />
*Clicking on the [Display] menu*

### [Add]

This action adds various visual contents.
For details, see [Adding Contents](#Adding-Contents).

<img src="image/header01.png" alt="Addメニュー展開時" width="415" />
*The [Add] menu*

### [Settings]

{>>メニュー項目のSettingをSettingsに修正すべきです．<<}

Under [Settings], you can toggle the appearance of ChOWDER's *remote cursor*. {>>The remote cursor is a cursor that appears on the tiled displays... <<}

<img src="image/SettingMenu.png" alt="Settingメニュー展開時" width="415" />
*Selecting [Settings]*
{>>[VirtualDisplay]は何をするのでしょうか？<<}

<img src="image/remotecursor.png" alt="リモートカーソル" width="415" />
*The remote cursor*

### Returning to the Home Screen

You can return to ChOWDER's home screen by clicking on [ChOWDER].

<img src="image/home_return.png" alt="タイトル名のクリックでホームに戻る" width="415" />
*Returning to the home screen*

Displaying Visual Contents
---------------------------------------------------

You can display various contents by clicking on the [Add] action in the menubar on the top or using the menu button (looking like [三]) at the lower right corner inside the [Contents] tab. 

### Displaying Images

Display images by following one of the methods below. 

- Menubar >[Add]>[Image]
- [Contents] tab>[Add Contents]>[Image File]
- Right-click inside the [Contents] tab and select [Add Contents]>[Image File]

Images added will be listed in the [Contents] tab.

The following image formats are accepted.

- PNG
- JPEG
- GIF
- BMP

<img src="image/AddContent_Picture_View.png" alt="画像ファイルの追加例" width="434" />
*Opening an image*

### Displaying Videos

Display video files by following one of the methods below. 

- Menubar >[Add]>[Movie]
- [Contents] tab >[三]>[Add Content]>[Video File]
- Right-click inside the [Content] tab >[Add Content]>[Video File]

The MP4 video format is accepted by ChOWDER.
Once video files are imported, they are streamed via WebRTC. For more on WebRTC, see [Working with Video Contents](#Working-with-Video-Content).

<img src="image/AddContent_Movie_View.png" alt="動画ファイルの追加例" width="434" />
*Adding a Video*

### Displaying Text

Display text by following one of the methods below. 

- Menubar >[Add]>[Text]
- [Content] tab >[三]>[Add Content]>[Text]
- Right-click inside the [Content] tab >[Add Content]>[Text]

### Displaying Text Files

Display a text file by following one of the methods below. 

- Menubar >[Add]>[Text File]
- [Content] tab > [三]>[Add Content]>[Text File]
- Right-click inside the [Content] tab > [Add Content]>[Text File]

<img src="image/AddContent_TextFile_Select.png" alt="テキストファイルを選択" width="434" />
*Select TextFile*
<br>
<img src="image/AddContent_TextFile_View.png" alt="テキストファイルのVirtualScreenへの追加" width="585" />
Adding a text file in the virtual display area

### Displaying Webpages

Display webpages by following one of the methods below.

- Menubar >[Add]>[URL]
- [Contents] tab >[三]>[Add Content]>[URL]
- Right-click inside the [Contents] Tab >[Add Content]>[URL]

<img src="image/AddContent_URL.png" alt="URL送信ボタン" width="472" />
*The URL Button*

<img src="image/AddContent_URL_View.png" alt="URL追加後の様子" width="472" />
*Displaying a webpage*

### Sharing Screens

Share screens by following one of the methods below. 

-   Menubar >[Add]>[Shared Screen]
-   [Content] tab >[三]>[Add Content]>[Shared Screen]
-   Right-click inside the [Content] tab >[Add Content]>[Shared Screen]

Captured videos are streamed using WebRTC.
For instructions on working with video contents, refer to [Working with Video Contents](#Working-with-Video-Contents).

<img src="image/AddContent_ScreenShare_View.png" alt="スクリーン共有の追加例" width="434" />
*Displaying Screens*

### Sharing Cameras

Share cameras by following one of the methods below. 

-   Menubar >[Add]>[Shared Camera]
-   [Contents] tab >[三]>[Add Content]>[Shared Camera]
-   Right-click inside the [Contents] Tab>[Add Content]>[Shared Camera]

Captured videos are streamed using WebRTC.
For instructions on working with video contents, see [Working with Video Contents](#Working-with-Video-Contents).

<img src="image/AddContent_CameraShare_View.png" alt="カメラ共有の追加例" width="434" />
*Shared a camera*

The [Display] Tab
---------------------------------------------------

<img src="image/Display_TAB_2conn.png" alt="image" width="207" />
*Display Tab*

The [Display] tab shows the virtual display area and all display tiles connected to the ChOWDER server. ChOWDER's controller page allows you to move tiles in the virtual display areas. Adding Contents to the arranged Display enables a shared workspace. Use the mouse to drag and drop Display into the VirtualDisplaySpace.
The example above shows the environment when a client is connected. 

Virtual Display Setup
---------------------

<img src="image/VirtualDisplaySetting.png" alt="image" width="207" />
*Virtual Display Setup*

### Splits (Sub-Divisions) Setup

Go to the Display tab and select Virtual Display to set up Virtual Display in the Property window. In the example above, the Virtual Display settings are 1500 pixels for width, 1500 pixels for height, horizontal split (sub-division) 2, and vertical split (sub-division) 2. 

### Snap Function

The Snap function helps you accurately align your display with the selected area.
You can switch between modes using the dropdown list seen below. 

<img src="image/MIGIUE_Disp.png" alt="Snap機能の設定プルダウンボタン" width="207" />
*Pulldown Button for the Snap Function*

- Free: No restrictions
- Display: Display and Contents snap in alignment with the laid out Display
- Grid: Display and Contents snap in alignment with the split (sub-division) specified by VirtualDisplaySetting

The example below demonstrates using the snap function for layout purposes.

<img src="image/Snap1.png" alt="Snap機能ドラッグ時凡例" width="585" />
*Example of Drag Function with Snap*

You can enlarge and reduce the VirtualDisplaySpace using the Scale function.
Place the mouse inside the screen to right-click and drag to enlarge or reduce the screen.

<img src="image/MIGIUE_Scale.png" alt="scale後の例（コンテンツが小さく表示されている）" width="377" />
*Example of Scale Function (Contents are reduced in size)*

### Display and ID

You can differentiate between all connected Display by the Display ID shown above each Display. 
IDs are specific to the connected terminal whereby each terminal is assigned one ID. 

<img src="image/3Button1.png" alt="Display ID" width="283" />
*Display ID*

### Delete Button

The Delete button deletes the selected Display (by disconnecting from the ChOWDER server).

<img src="image/3Button2.png" alt="削除ボタン" width="377" />
*Delete Button*

Note you will not be able to delete VirtualDisplay

### Select All Button

The Select All button selects all connected Display.

<img src="image/3Button3.png" alt="全選択ボタン" width="377" />
*Select All Button*

Content Tab
--------------------------------
To view Contents in Display, go to the Contents tab on the bottom of the page and drag and drop Contents into Display.

### View Contents 

Select Content from the list and drag and drop to the VirtualScreen area in the middle of view Content.
<img src="image/DragAndDropContent.png" alt="Contentsの表示" width="434" />
*View Content(s)*

### Working with Content(s)

Once added, you can select Content by left-clicking the mouse, or by pressing Ctrl and left-clicking the mouse to select multiple Contents. 
After selecting, you will see the Content Manipulator and editing buttons (see image below). 

- Editing buttons
  - Highlight button — highlights selected contents
                       Highlighted contents appear in Display with thick borders according to Group color.
  - Metadata button — Metadata of Contents appear in Display
  - Hide button — Hides Contents from VirtualDisplaySpace
                  Hidden contents can be viewed again by going to Contents and dragging and dropping.

<img src="image/manip.png" alt="コンテンツ操作用マニピュレータ" height="321" />
*Contents Manipulator*

### Content Tab Menu

You will find various editing tools in the dropdown list by selecting the menu button located in the bottom right section of tab area.

<img src="image/DragAndDropContent2.png" alt="Contentsの追加" width="434" />
*Adding Contents*	

### Replacing Images

You can replace the image selected in Contents tab.
The example below shows how to replace images selected within the Contents tab.

<img src="image/SASHI.png" alt="画像の差し替えボタン" width="434" />
*Image Replacement Button*

Follow the example below to replace the Contents in the Contents tab.

<img src="image/YUMUSHI.PNG" alt="画像の差し替えし指定" width="434" />
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
*Group Setup*

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

You can add a Layout by right-clicking the Layout list on the bottom of the screen or through the menu on the lower right side of the screen. Adding to Layout will apply to Groups that have a check mark in the check box. 

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

Property Window
-------------------------------

<img src="image/Prop_Down.png" alt="image" width="188" />

The Property Window shows selected Contents, Display, ContentsID and other properties. Property allows you to edit items other than ID and set coordinates as well as the stacking order (Z-index). You can also download the selected Contents from the Download Button located on the bottom of the Property Window. 

Working with Video Content
-------------------------------

In addition to regular content control, by selecting video content while using a Controller connected to video data, you can view control (commands) pertaining to motion.  

### Video Control

The controls for video contents using the Controller connected to video can be seen below.

<img src="image/movie_control.png" alt="コントローラーでの動画コントロール" width="434" />
*Video Control Using Controller*

The function of each control is as follows:  

1. Play or Pause Video
2. Seekbar for Video
3. Volume control for the Controller
4. ON/OFF switch for transmitting video
5. ON/OFF switch for transmitting sound

### Video Setup

While using the Controller connected to video, you can select video content and switch between capture devices and change streaming settings in the Property Window. 

<img src="image/movie_setting.png" alt="動画設定" width="434" />
*Video Setup*

You can configure the settings per below:

1. Change video input device (only video contents from the camera can be set up)
2. Change audio input device (only video contents from the camera can be set up)
3. Set video quality. You can set the bitrate of the video streamed via WebRTC.
4. Set audio quality. You can set the bitrate of the audio streamed via WebRTC.
5. You can look up information on WebRTC quality saved in the metadata of Contents.

The Administrator Screen
---------------------------------------------------
Log into Controller as an Administrator to access the Administrator Screen via Management Menu. You can set user permissions and various other settings in the Administrator Screen.

<img src="image/management1.png" alt="管理者ログイン時のメニュー" width="585" />
*Menu for Administrator Login*
<br>
<img src="image/management2.png" alt="管理画面" width="585" height="auto" />
*Administrator Screen*

### Database Administration

You can create, switch, rename, delete and initialize storage space within the database administration ("DB Administration" in ChOWDER's GUI). Note that you will not be able to rename or delete the default storage area that is automatically created in the beginning. 

<img src="image/management3.png" alt=" DB 管理" width="585" />
*DB Administration*

### Change History Administration

You can set the maximum number of historical changes to contents in Change History Administration. Historical changes per content will be saved up to the maximum number you designate here. This is a globally set value where the same value will be applied even when changing DB.  

<img src="image/management4.png" alt=" 履歴管理" width="585" />
*Change History Administration*

### Viewing/Editing Permission Setup

You can set up each user’s permission in Viewing/Editing Rights Settings.

<img src="image/management5.png" alt=" 閲覧・編集権限の設定" width="585" />
*Viewing/Editing Permission Setup*

 1. Select user to set up.
 2. Choose whether selected user has permission to edit/view. Users with permission for “all” are able to edit/view newly created groups as well.
 3. Set up selected user with permission levels for editing groups and working with Display.

### Password Setup

You can change a user’s password in Password Setup
The previous password will be required only for changing the Administrator’s password. 

<img src="image/management6.png" alt="パスワードの設定" width="585" />
*Password Setup*


Working with Display Screen
==================================================================

Overview
---------------------------------------------------

<img src="image/display.png" alt="ディスプレイ画面概要" width="585" />

We describe how to work with Display including its tabs, windows and functions. 

Working with Display: Menu
---------------------------------------------------

Menu will appear by using a mouse or by touching the screen of a tablet in Display. There are a number of things you can do in Menu.

### Switch to Controller Screen

You can switch from Display mode to Controller mode.

<img src="image/displaymenu1.png" alt="コントローラ画面への切り替え" width="207" />
*Switching to Controller Screen*

### Switch to Full Screen

You can switch between full screen and window mode.  You can return from full screen to window mode by selecting the same menu or by pressing the ESC key. 

<img src="image/displaymenu2.png" alt="フルスリーンへの切り替え" width="207" />
*Switch to Full Screen*

### Display ID Setup

You can set up a recognizable Display ID in Controller. Type out the word (or letter combination) of your choice and press enter to set the ID. 

<img src="image/displaymenu3.png" alt="ディスプレイIDの設定" width="207" />
*Display ID Setup*

Coordinating with HIVE
==================================================================

Interactive Rendering
---------------------------------------------------

You can transmit the graphics screen during HIVE’s interactive rendering to view in ChOWDER (see image below).

<img src="image/hive.png" alt="HIVEインタラクティブレンダリングの送信例" width="600" />
*Example of Transmission from HIVE Interactive Rendering*

Select the ChOWDER button in the menu located at the top of HIVE and designate ChOWDER’s URL to transmit. The URL’s initial setting is ws://localhost:8081/v2/. To connect, replace localhost with the IP address of the computer ChOWDER is running on. The ChOWDER button changes colors when connected. 

<img src="image/hive1.png" alt="ChOWDER接続用メニュー項目" width="321" />
*Menu Item to Connect to ChOWDER *
<br>
<img src="image/hive2.png" alt="URL設定" width="321" />
*URL Setting*

SceneNodeEditor
---------------------------------------------------

You can transmit a rendered image using the RenderForSIP node in HIVE’s SceneNodeEditor to view in ChOWDER. The URL’s initial setting for SEND in Property is ws://localhost:8081/v2/.

<img src="image/scene_node_editor.png" alt="SceneNodeEditorでの送信例" width="600" />
*Example of Transmission from SceneNodeEditor*

Module System
---------------------------------------------------

You can transmit a rendered image using the ChOWDER node in HIVE’s ModuleSystem to view in ChOWDER. Since the ChOWDER node is able to connect with nodes that output BufferImageData format, you can send information of a variety of connectable nodes to ChOWDER.  

You can designate the address ChOWDER contents are transmitted to in Property of ChOWDER’s node. Default address is ws://localhost:8081/v2/. Use the ChOWDER server address instead. 

<img src="image/hivemodulesystem.png" alt="ModuleSystemでの送信例" width="600" />
*Example of Transmission Using ModuleSystem *

Using Google Chrome Extension
==================================================================

Overview
---------------------------------------------------

Google Chrome allows adding functions and features in what is called Extension. By adding the specific ChOWDER Extension to Google Chrome, you can capture a web browser screen in real-time and add to Contents. 

Installing Extension
---------------------------------------------------

The Extension file for Google Chrome named chrome\_extention.crx is located in the bin directory of Project root.

To install the Extension for Chrome, open the browser page for Extension per below. 

Drag and drop the Extension file to the page and install.

<img src="image/extension01.png" alt="拡張機能ページを開くメニュー" width="585" />
*Menu to Open Extension Page*
<br>
<img src="image/extension02.png" alt="Extensionファイルのドラッグアンドドロップ" width="585" />
*Drag and Drop the Extension File*

Use Extension to Capture
---------------------------------------------------

Once Extension is added, you can click the icon to begin Capture.

- Extension Menu
  - Capture — Captures web page currently in view and transmits to ChOWDER

  - AutoCapture — Captures web page currently in view at pre-set intervals and continuously transmits to ChOWDER

  - Setting — Opens Setup Menu

<img src="image/extension03.png" alt="Extensionのメニュー" width="207" />
*Extension Menu*
<br>
<img src="image/extension04.png" alt="AutoCapture開始後" width="207" />
*After Starting AutoCapture*

- Extension Setup

- URL — Sets URL to connect to ChOWDER

- Interval — Sets interval used in AutoCapture

<img src="image/extension_setting.png" alt="Extensionの設定" width="207" />
*Extension Setup*

Using Desktop Capture on ChOWDER
==================================================================

Overview
---------------------------------------------------
You can use ChOWDER Desktop Capture to select an entire desktop, an active application window, or any selected area to add as an image content to ChOWDER.

Installing and Operating Environment
---------------------------------------------------

### Running the Install Script

On Macs or Linux
Run the shell script below located in desktop capture.

       $cd desktop_capture
       $sh make$app.sh

On Windows  
Run the file below located in desktop capture.

        >cd desktop_capture
        >make$_app.bat

### Operating Environment

OS: Windows7, MacOSX 10.10

How to Use ChOWDER Desktop Capture
---------------------------------------------------

You can do the following things using ChOWDER Desktop Capture:

- Select capture target/area and transmit
- Set interval for transmission of captured image
- Set destination URL of captured image
- Set group captured image is transmitted to

### Select Capture Target/Area

#### Select Capture Target

During launch, ChOWDER Desktop Capture creates thumbnails of the following items that appear on the bottom of the page:
- Entire desktop
- Active window(s)

<img src="image/dc_cap01.png" alt="サムネイル一覧" width="400" />

Click on the thumbnail to change the capture target. The clicked target appears on the top of the screen in preview mode waiting to be captured. 

<img src="image/dc_cap02.png" alt="キャプチャ対象のプレビュー" width="300" />
*Preview of Capture Target*

Once the capture target is selected, press the “Capture Start” button to begin transmission to ChOWDER. 

<img src="image/dc_cap03.png" alt="Capture Start ボタン" width="600" />
*Capture Start Button*
<br>
<img src="image/dc_cap04.png" alt="Capture Start ボタンを押した時" width="600" />
*Pressing the Capture Start Button*

#### Selecting Capture Area
You can transmit a portion of the screen as an image to ChOWDER by selecting the capture area using ChOWDER Desktop Capture.

Pressing the “Set Capture Area” minimizes ChOWDER Desktop Capture and switches the mouse from cursor to indicator to select an area. In this state, you can select an area by pressing the mouse, so click and drag the mouse to the end of the area you want to capture and then release the mouse to complete the capture.

<img src="image/dc_cap05.png" alt="Set Capture Area ボタン" width="600" />
*Set Capture Area Button*
<br>
<img src="image/dc_cap06.png" alt="範囲選択状態" width="600" />
*Area Selection State*
<br>
<img src="image/dc_cap07.png" alt="範囲選択プレビュー" width="600" />
*Preview of Selected Area*

Similar to “Select Capture Target,” you can begin transmission of images by pressing the “Capture Start” button.

### Set Capture Interval

You can set the interval for image transmission using ChOWDER Desktop Capture. You can input a numerical value for Capture Interval(sec) on the form on the right or use the up and down arrows. The minimum interval is 0.05 seconds. When you press the “Reset” button, the value goes back to its initial value of 1 second.

<img src="image/dc_cap08.png" alt="キャプチャ間隔設定フォーム" width="600" />
*Form to Set Capture Interval*

Values for Capture Interval, ChOWDER URL and Target Group are kept even after quitting the application for the next time the application is launched. 

### Setting the URL Destination of Captured Image

You can set the URL destination (ChOWDER) an image is transmitted to using ChOWDER Desktop Capture. You can overwrite the form on the right of ChOWDER URL with the URL destination. Pressing the “Reset” button returns it to its initial value. 

<img src="image/dc_cap09.png" alt="送信先URL 設定フォーム" width="600" />
*Form to Set URL Destination*

### Set Up Capture Image Group

You can set the group the captured image is transmitted to by using ChOWDER Desktop Capture. Select from dropdown list on the right side of Target Group. Pressing the “Reload” button returns it to its initial value.
<img src="image/dc_cap10.png" alt="送信先グループ設定フォーム" width="600" />
*Form to Set Group for Image Transmission*


Using Google Chrome Extension for WebRTC
==================================================================

Overview
---------------------------------------------------

You can stream video content from screen sharing by using HTML5’s WebRTC function.
While screen sharing is usually not possible in Google Chrome due to security restrictions, installing Chrome Extension allows you to stream video.

Installing Extension
---------------------------------------------------

The file named chrome\_extention\_for\_webrtc.crx located in the bin directory of Project root is the Extension file for Google Chrome. 

To install and add the Extension for Chrome, open the browser page for Extension as previously described in Installing Extension. 

Drag and drop the Extension file to the page and install.


Capture Using Extension
---------------------------------------------------

Once you add Extension, run Add -> ScreenShare and input ExtensionID in the dialogue to start capture. 

<img src="image/AddContent_ScreenShare_View2.png" alt="ScreenShare開始時のExtensionIDの入力" width="600" />
*Inputting ExtensionID when Starting ScreenShare*


Using HTTPS
==================================================================

Overview
---------------------------------------------------

There may be occasions screen sharing and camera sharing are activated only when using HTTPS in Firefox and Google Chrome due to security restrictions. 

ChOWDER has a built-in HTTPS server as well as a temporary SSL certificate. Under default settings, you can access the URL below and add it as a one-off exception to use a page using HTTPS. 

- URL for HTTPS — https://localhost:9090
- WebSocket Port for HTTPS — https://localhost:9091
