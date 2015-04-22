@ECHO OFF
del /Q nwjs-v0.12.0-win-x64\package.nw
7z a -tzip nwjs-v0.12.0-win-x64\package.nw index.html
7z a -tzip nwjs-v0.12.0-win-x64\package.nw package.json
copy /Y conf.json nwjs-v0.12.0-win-x64\
copy /b nwjs-v0.12.0-win-x64\nw.exe+nwjs-v0.12.0-win-x64\package.nw nwjs-v0.12.0-win-x64\standalone_display.exe
start nwjs-v0.12.0-win-x64\standalone_display.exe