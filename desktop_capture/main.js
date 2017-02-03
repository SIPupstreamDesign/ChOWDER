"use strict";
const electron = require('electron');

// モジュールの追加
const app = electron.app;
const ipcMain = electron.ipcMain;
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

let virtualWindow;
let mainWindow;

function createWindow () {

    // メインのウィンドウ。
    mainWindow = new BrowserWindow({
        width: 1440, 
        height: 810,
        show: true,
        autoHideMenuBar: true
    });

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

    // 仮想ウィンドウ
    virtualWindow = new BrowserWindow({
      left: 0,
      top: 0,
      frame: false,
      show: false,
      transparent: true,
      resizable: false,
      'always-on-top': true
    });

    // and load the index.html of the app.
    virtualWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'js/select.html'),
      protocol: 'file:',
      slashes: true
    }));

  // Open the DevTools.
  //mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    mainWindow = null;
    virtualWindow = null;
  });
}

exports.areaSelector = function() {
    
    // Screen APIの読み込み
    const screen = electron.screen;
    const size = screen.getPrimaryDisplay().size;
    
    // MainWindowを自動的に最小化
    mainWindow.minimize();
    virtualWindow.show();
    virtualWindow.setKiosk(true);

    //virtualWindow.maximize();


    // Open the DevTools.
    //mainWindow.webContents.openDevTools()
}

exports.windowCloser = function(rect){
    virtualWindow.hide();
    virtualWindow.reload();
    mainWindow.focus();
    mainWindow.webContents.send('rectData', rect);
    //console.log("window closer called")
}

exports.activeW = function(){
    mainWindow.show();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    app.quit();
});


app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null && virtualWindow === null) {
    createWindow();
  }
});