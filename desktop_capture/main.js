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

    // 親ウィンドウ。メインのウィンドウ。
    mainWindow = new BrowserWindow({
        width: 1600, 
        height: 900,
        autoHideMenuBar: true
    });

  // メインウィンドウのみ可視
  mainWindow.show();

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
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
    
    // MainWindowを自動的に最小化
    mainWindow.minimize();

    // Screen APIの読み込み
    const screen = electron.screen;
    const size = screen.getPrimaryDisplay().size;
    
    // 仮想ウィンドウ
    virtualWindow = new BrowserWindow({
      left: 0,
      top: 0,
      width: size.width,
      height: size.height,
      frame: false,
      show: true,
      transparent: true,
      resizable: false,
      'always-on-top': true
    });

    virtualWindow.maximize();

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
      virtualWindow = null;
    });


}

exports.windowCloser = function(rect){
    virtualWindow.close();
    mainWindow.focus();
    //mainWindow.webContents.send('closed', rect);
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null && virtualWindow === null) {
    createWindow();
  }
});