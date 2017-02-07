@ECHO OFF
call npm install electron-packager
call node_modules\.bin\electron-packager . ChOWDER-Desktop-Capture --platform=win32 --arch=x64 --electron-version=1.4.15
